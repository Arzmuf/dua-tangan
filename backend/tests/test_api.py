from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.db import SessionLocal, engine
from app.seed import seed_demo
from app.services.tone import check_tone

from .conftest import signup


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def test_auth_and_onboarding(client):
    headers = signup(client, "Nadia Wulandari", "Nadia@Example.com")
    me = client.get("/me", headers=headers).json()
    assert me["user"]["email"] == "nadia@example.com"
    assert me["family"] is None

    assert client.post("/auth/login", json={"email": "nadia@example.com", "password": "nope"}).status_code == 401
    assert client.post("/auth/login", json={"email": "NADIA@example.com", "password": "secret123"}).status_code == 200
    assert client.get("/home", headers=headers).status_code == 409  # no family yet
    assert client.get("/me").status_code == 401

    res = client.post("/families/join", json={"invite_code": "ZZZZZZ"}, headers=headers)
    assert res.status_code == 404


def test_family_is_limited_to_two_parents(client, parents):
    code = client.get("/family", headers=parents["nadia"]).json()["invite_code"]
    third = signup(client, "Someone Else", "third@example.com")
    res = client.post("/families/join", json={"invite_code": code}, headers=third)
    assert res.status_code == 409


def test_handoff_proposal_change_and_check_in(client, parents):
    nadia, reza = parents["nadia"], parents["reza"]
    start = datetime.now(timezone.utc) + timedelta(days=2)
    res = client.post(
        "/events",
        json={"starts_at": iso(start), "to_parent_id": parents["reza_id"], "location": "Gambir Station"},
        headers=nadia,
    )
    assert res.status_code == 201, res.text
    event = res.json()
    assert event["status"] == "pending"
    assert event["actions"]["cancel"] and not event["actions"]["confirm"]

    home = client.get("/home", headers=reza).json()
    assert [e["id"] for e in home["pending_events"]] == [event["id"]]
    assert client.get("/home", headers=nadia).json()["waiting_on_partner"] == 1

    # The proposer can't confirm their own proposal.
    assert client.post(f"/events/{event['id']}/confirm", headers=nadia).status_code == 409
    confirmed = client.post(f"/events/{event['id']}/confirm", headers=reza).json()
    assert confirmed["status"] == "confirmed"
    assert client.get("/home", headers=nadia).json()["next_handoff"]["id"] == event["id"]

    new_start = start + timedelta(days=7)
    res = client.post(
        f"/events/{event['id']}/change",
        json={"starts_at": iso(new_start), "reason": "Family event"},
        headers=reza,
    )
    assert res.status_code == 200, res.text
    assert res.json()["change"]["reason"] == "Family event"
    assert client.post(f"/events/{event['id']}/change/accept", headers=reza).status_code == 409
    moved = client.post(f"/events/{event['id']}/change/accept", headers=nadia).json()
    assert moved["change"] is None
    assert datetime.fromisoformat(moved["starts_at"]) == new_start

    # Check-in only opens 3 hours before the handoff.
    assert client.post(f"/events/{event['id']}/check-in", headers=nadia).status_code == 409
    soon = client.post(
        "/events",
        json={
            "starts_at": iso(datetime.now(timezone.utc) + timedelta(hours=1)),
            "to_parent_id": parents["nadia_id"],
            "location": "School gate",
        },
        headers=reza,
    ).json()
    client.post(f"/events/{soon['id']}/confirm", headers=nadia)
    checked = client.post(f"/events/{soon['id']}/check-in", headers=nadia).json()
    assert checked["checked_in_by"]["first_name"] == "Nadia"
    assert checked["actions"]["check_in"] is False

    past = client.post(
        "/events",
        json={"starts_at": iso(datetime.now(timezone.utc) - timedelta(days=1)), "to_parent_id": parents["nadia_id"], "location": "X"},
        headers=reza,
    )
    assert past.status_code == 422


def test_handoffs_cannot_clash(client, parents):
    nadia, reza = parents["nadia"], parents["reza"]
    start = datetime.now(timezone.utc) + timedelta(days=3)
    body = {"starts_at": iso(start), "to_parent_id": parents["reza_id"], "location": "Gambir"}
    first = client.post("/events", json=body, headers=nadia).json()
    clash = client.post("/events", json={**body, "starts_at": iso(start + timedelta(minutes=30))}, headers=reza)
    assert clash.status_code == 409
    assert "already a handoff" in clash.json()["detail"]
    later = client.post("/events", json={**body, "starts_at": iso(start + timedelta(hours=2))}, headers=reza)
    assert later.status_code == 201

    # Moving a handoff onto another one is refused too; nudging it within its own slot is fine.
    client.post(f"/events/{first['id']}/confirm", headers=reza)
    onto_other = client.post(
        f"/events/{first['id']}/change", json={"starts_at": iso(start + timedelta(hours=2))}, headers=nadia
    )
    assert onto_other.status_code == 409
    nudge = client.post(
        f"/events/{first['id']}/change", json={"starts_at": iso(start + timedelta(minutes=30))}, headers=nadia
    )
    assert nudge.status_code == 200

    # A pending change reserves its target slot.
    second = client.post("/events", json={**body, "starts_at": iso(start + timedelta(days=7))}, headers=nadia).json()
    client.post(f"/events/{second['id']}/confirm", headers=reza)
    client.post(f"/events/{first['id']}/change/decline", headers=reza)
    client.post(f"/events/{second['id']}/change", json={"starts_at": iso(start + timedelta(days=14))}, headers=reza)
    taken = client.post("/events", json={**body, "starts_at": iso(start + timedelta(days=14))}, headers=nadia)
    assert taken.status_code == 409


def test_expenses_and_balance(client, parents):
    nadia, reza = parents["nadia"], parents["reza"]
    res = client.post(
        "/expenses",
        json={"title": "School shoes", "category": "clothing", "amount": 340000, "paid_by_id": parents["reza_id"]},
        headers=reza,
    )
    assert res.status_code == 201, res.text
    shoes = res.json()
    assert shoes["owed_amount"] == 170000
    assert shoes["debtor"]["first_name"] == "Nadia"

    home = client.get("/home", headers=nadia).json()
    assert [x["id"] for x in home["pending_expenses"]] == [shoes["id"]]
    assert client.post(f"/expenses/{shoes['id']}/approve", headers=reza).status_code == 409
    approved = client.post(f"/expenses/{shoes['id']}/approve", headers=nadia).json()
    assert approved["status"] == "approved"

    assert client.get("/expenses", headers=nadia).json()["balance"]["amount"] == -170000
    assert client.get("/expenses", headers=reza).json()["balance"]["amount"] == 170000

    settled = client.post(f"/expenses/{shoes['id']}/settle", headers=nadia).json()
    assert settled["status"] == "settled"
    assert client.get("/expenses", headers=nadia).json()["balance"]["amount"] == 0

    # Fully covered by the payer: settled as soon as it's approved.
    gift = client.post(
        "/expenses",
        json={"title": "Birthday gift", "amount": 100000, "paid_by_id": parents["nadia_id"], "payer_share": 100},
        headers=nadia,
    ).json()
    assert client.post(f"/expenses/{gift['id']}/approve", headers=reza).json()["status"] == "settled"

    withdrawn = client.post(
        "/expenses", json={"title": "Oops", "amount": 5000, "paid_by_id": parents["nadia_id"]}, headers=nadia
    ).json()
    assert client.delete(f"/expenses/{withdrawn['id']}", headers=reza).status_code == 409
    assert client.delete(f"/expenses/{withdrawn['id']}", headers=nadia).status_code == 204


def test_messages_tone_and_unread(client, parents):
    nadia, reza = parents["nadia"], parents["reza"]
    calm = client.post("/messages", json={"body": "Kirana has a slight fever, gave paracetamol."}, headers=reza).json()
    assert calm["tone"] == "calm" and calm["mine"] is True
    heated = client.post(
        "/messages", json={"body": "You always leave this until the last minute!!", "is_urgent": True}, headers=reza
    ).json()
    assert heated["tone"] == "heated"

    assert client.get("/home", headers=nadia).json()["unread_messages"] == 2
    msgs = client.get("/messages", headers=nadia).json()
    assert [m["mine"] for m in msgs] == [False, False]
    assert client.post("/messages/read", headers=nadia).status_code == 204
    assert client.get("/home", headers=nadia).json()["unread_messages"] == 0

    record = client.get("/record?flagged=true", headers=nadia).json()
    assert record["flagged_count"] == 1
    assert "(urgent)" in record["entries"][0]["summary"]

    tone = client.post("/messages/tone", json={"body": "Kamu selalu telat, keterlaluan"}, headers=nadia).json()
    assert tone["tone"] == "heated" and tone["tip"]


def test_tone_rules():
    assert check_tone("Can we swap weekends? My cousin's wedding is that Saturday.").tone == "calm"
    assert check_tone("Whatever works for you is fine").tone == "calm"
    assert check_tone("You never answer my messages").tone == "heated"
    assert check_tone("THIS IS NOT OK").tone == "heated"
    assert check_tone("Why would you do that?!").tone == "heated"
    assert check_tone("Thanks!! See you Saturday").tone == "calm"
    assert check_tone("Kirana lagi males makan, tolong dicek ya").tone == "calm"


def test_child_info_crud(client, parents):
    nadia, reza, child = parents["nadia"], parents["reza"], parents["child_id"]
    res = client.post(
        f"/children/{child}/info", json={"category": "health", "label": "Allergies", "value": "Peanuts"}, headers=nadia
    )
    assert res.status_code == 201, res.text
    item = res.json()
    updated = client.patch(f"/info/{item['id']}", json={"value": "Peanuts, cashews"}, headers=reza).json()
    assert updated["value"] == "Peanuts, cashews"
    assert updated["updated_by"]["first_name"] == "Reza"
    assert len(client.get(f"/children/{child}/info", headers=nadia).json()) == 1
    assert client.delete(f"/info/{item['id']}", headers=nadia).status_code == 204
    assert client.get(f"/children/{child}/info", headers=nadia).json() == []


def test_other_families_cannot_see_data(client, parents):
    event = client.post(
        "/events",
        json={
            "starts_at": iso(datetime.now(timezone.utc) + timedelta(days=1)),
            "to_parent_id": parents["reza_id"],
            "location": "Gambir",
        },
        headers=parents["nadia"],
    ).json()
    stranger = signup(client, "Stranger", "stranger@example.com")
    client.post("/families", json={"child_name": "Bima"}, headers=stranger)
    assert client.post(f"/events/{event['id']}/confirm", headers=stranger).status_code == 404
    assert client.get(f"/children/{parents['child_id']}/info", headers=stranger).status_code == 404
    assert client.get("/record", headers=stranger).json()["count"] == 1  # only their own "created" entry


def test_record_detects_tampering(client, parents):
    nadia = parents["nadia"]
    client.post(
        "/expenses", json={"title": "Doctor visit", "amount": 210000, "paid_by_id": parents["nadia_id"]}, headers=nadia
    )
    record = client.get("/record", headers=nadia).json()
    assert record["verification"]["valid"] is True
    assert record["count"] == 3  # created, joined, expense

    with engine.begin() as conn:
        conn.execute(text("UPDATE record_entries SET summary = summary || ' (edited)' WHERE seq = 2"))
    verification = client.get("/record", headers=nadia).json()["verification"]
    assert verification == {**verification, "valid": False, "broken_seq": 2}

    report = client.get("/record/report", headers=nadia).json()
    assert report["verification"]["valid"] is False
    assert len(report["entries"]) == 3


def test_support_requests(client, parents):
    nadia = parents["nadia"]
    counsellors = client.get("/support/counsellors", headers=nadia).json()
    assert len(counsellors) == 3
    res = client.post(
        "/support/requests",
        json={"counsellor_id": counsellors[0]["id"], "session_type": "child", "preferred_time": "Thu afternoon"},
        headers=nadia,
    )
    assert res.status_code == 201, res.text
    assert client.get("/support/requests", headers=parents["reza"]).json()[0]["status"] == "requested"


def test_demo_seed(client):
    with SessionLocal() as db:
        seed_demo(db)
    login = client.post("/auth/login", json={"email": "nadia@duatangan.app", "password": "demo1234"}).json()
    nadia = {"Authorization": f"Bearer {login['access_token']}"}
    home = client.get("/home", headers=nadia).json()
    assert len(home["pending_events"]) == 2  # a change request and a new handoff
    assert len(home["pending_expenses"]) == 1
    assert home["balance"]["amount"] == 150000
    assert home["unread_messages"] == 1
    assert home["next_handoff"] is not None
    record = client.get("/record", headers=nadia).json()
    assert record["verification"]["valid"] is True
    assert record["flagged_count"] == 1

    reza_login = client.post("/auth/login", json={"email": "reza@duatangan.app", "password": "demo1234"}).json()
    reza = {"Authorization": f"Bearer {reza_login['access_token']}"}
    reza_home = client.get("/home", headers=reza).json()
    assert reza_home["pending_events"] == [] and reza_home["pending_expenses"] == []
    assert reza_home["waiting_on_partner"] == 3

import os

# Tests always run against a separate database: they drop and recreate every table.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://duatangan:duatangan@localhost:5432/duatangan_test"
)
os.environ["SEED_DEMO"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.migrate import drop_everything  # noqa: E402


@pytest.fixture()
def client():
    drop_everything()
    with TestClient(app) as c:
        yield c


def signup(client: TestClient, name: str, email: str) -> dict:
    res = client.post("/auth/register", json={"full_name": name, "email": email, "password": "secret123"})
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture()
def parents(client):
    """Two parents sharing one family with a child called Kirana."""
    nadia = signup(client, "Nadia Wulandari", "nadia@example.com")
    reza = signup(client, "Reza Prasetyo", "reza@example.com")
    res = client.post("/families", json={"child_name": "Kirana", "time_zone": "Asia/Jakarta"}, headers=nadia)
    assert res.status_code == 201, res.text
    code = res.json()["family"]["invite_code"]
    res = client.post("/families/join", json={"invite_code": code.lower()}, headers=reza)
    assert res.status_code == 200, res.text
    family = res.json()["family"]
    ids = {m["first_name"]: m["id"] for m in family["members"]}
    return {
        "nadia": nadia,
        "reza": reza,
        "nadia_id": ids["Nadia"],
        "reza_id": ids["Reza"],
        "child_id": family["children"][0]["id"],
    }

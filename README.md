# Dua Tangan

A shared, calm space for co-parents: plan handoffs together, split costs fairly, keep your child's key info in one place, and talk with a gentle tone check. Every action lands in a tamper-evident record that you can export.

This is the MVP. It is meant for early testing, not production.

| Part | Stack |
| --- | --- |
| App | React Native with Expo (SDK 57) and Expo Router. Runs on the web and in Expo Go (iOS and Android). |
| API | FastAPI, SQLAlchemy 2, JWT auth |
| Database | PostgreSQL |

## What's in the MVP

- **Home** – what needs your answer (handoffs, changes, expenses) with one-tap Accept/Decline, plus your next handoff, balance, unread messages and the child's info.
- **Schedule** – propose a handoff, and your co-parent confirms or declines it. Propose a change to a confirmed handoff, which needs the other parent's OK. Check in at the handoff. Handoffs within an hour of each other are refused as clashes. Meeting places suggest neutral public spots (mall lobbies, parks, a station) and nudge away from anyone's home.
- **Chat** – messages between the two parents. A tone check flags heated wording (English and Indonesian) before sending. You can mark a message as urgent, or start from a quick message: pick a category (health update, schedule, expenses, check-in), then a template, or save your own.
- **Expenses** – add a cost with a split, your co-parent approves it, then settle up. The running balance only counts approved expenses.
- **Child info** – health, school, contacts and other details, kept in sync for both parents. Phone numbers get a call button.
- **Info bank** – an append-only log, with tabs for messages, expenses, the calendar, health & notes, and documents. Each entry is sealed with a SHA-256 hash chained to the previous one, so any edit or deletion is detected. Upload important documents (PDFs, photos, Word files up to 5 MB); each file's hash is sealed into the log. Export it all as a printable PDF.
- **Support** – book talks, webinars and workshops from our partner Sekala Jiwa on Eventbrite-style event pages, or request a session with a counsellor (the first is free). Payment is a demo that always succeeds, and every booking is final: no refunds or cancellations.
- **Admin** – manage accounts (create, edit, reset passwords, deactivate, delete) and the events parents can book, with each event's bookings.

## Repository layout

```
backend/   FastAPI app (app/), demo seed, tests
mobile/    Expo app — routes in src/app, shared UI in src/components, API + helpers in src/lib
docker-compose.yml   optional local PostgreSQL
```

## Run it locally

You need Python 3.11+, Node 20+, PostgreSQL 14+ and, for phones, the **Expo Go** app.

### 1. Database

With a local PostgreSQL (for example via Homebrew):

```bash
psql -d postgres -c "CREATE ROLE duatangan LOGIN PASSWORD 'duatangan';"
psql -d postgres -c "CREATE DATABASE duatangan OWNER duatangan;"
psql -d postgres -c "CREATE DATABASE duatangan_test OWNER duatangan;"   # only needed for the tests
```

If you don't have PostgreSQL installed, run `docker compose up -d` from the repo root instead.

### 2. API

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env              # optional, the defaults work locally
uvicorn app.main:app --host 0.0.0.0 --port 8077 --reload
```

On first start the API creates the tables and a demo family. Interactive API docs are at http://localhost:8077/docs.

The API uses port **8077** rather than FastAPI's usual 8000, which other local projects often occupy. `--host 0.0.0.0` lets phones on your Wi-Fi reach it.

### 3. App

```bash
cd mobile
npm install
npx expo start
```

- **Web:** press `w`.
- **Phone:** scan the QR code with Expo Go (Android) or the Camera app (iOS). The phone must be on the same Wi-Fi as your computer.

The app finds the API on its own. It uses the same host it was loaded from, on port 8077. To point it elsewhere, set `EXPO_PUBLIC_API_URL` (or just `EXPO_PUBLIC_API_PORT`) before `npx expo start`:

```bash
EXPO_PUBLIC_API_URL=https://api.example.com npx expo start
```

## Demo accounts

| Parent | Email | Password |
| --- | --- | --- |
| Nadia | nadia@duatangan.app | demo1234 |
| Reza | reza@duatangan.app | demo1234 |

Both share a child, Kirana. Nadia has three requests waiting (a schedule change, a new handoff and an expense). Sign in as each parent, in two browser windows or on web plus a phone, to see both sides of every request. The sign-in screen has one-tap buttons for both.

The demo's dates are relative to the day you seed it, in your computer's time zone. To start fresh:

```bash
cd backend && python -m app.seed --reset     # drops all data and rebuilds the demo
```

To start with a real family, create an account and choose **Start a new family space**. Share the 6-letter code, and your co-parent picks **Join my co-parent**.

There is no demo admin, because its password would be public. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (see below) and that account is created on startup. Admins without a family land on the admin dashboard; admins with one find it on their profile.

## Configuration

Backend settings live in `backend/.env`; see `backend/.env.example`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+psycopg://duatangan:duatangan@localhost:5432/duatangan` | Database connection |
| `JWT_SECRET` | dev value | **Change before deploying anywhere** |
| `JWT_EXPIRES_DAYS` | `30` | Session length |
| `CORS_ORIGINS` | `["*"]` | Allowed web origins |
| `SEED_DEMO` | `true` | Create the demo family when the database is empty |
| `DEMO_TIME_ZONE` | this machine's zone | Time zone of the demo family, e.g. `Asia/Jakarta` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | unset | The first admin, created on startup. An existing account with that email is only made an admin if its password matches |

## Database migrations

The schema comes from Alembic migrations in `backend/migrations`, and the API applies any new ones when it starts, locally and on Render. A database created before migrations existed is recognised and brought up to date without losing data.

To change the schema, edit `app/models.py`, then from `backend/`:

```bash
alembic revision --autogenerate -m "what changed"   # review the new file in migrations/versions
alembic upgrade head                                # or just restart the API
```

New columns on tables that already hold rows need a `server_default` (see `0005_user_roles.py`).

## Put it online

`render.yaml` deploys the API and the web app to [Render](https://render.com) for free, with the database on [Neon](https://neon.tech). Render's own free database is deleted after 30 days.

1. On Neon, create a project in the Singapore region, next to the API. Open **Connect**, turn off connection pooling, and copy the connection string.
2. On Render, choose **New → Blueprint**, pick this repo, and paste the Neon string as `DATABASE_URL`, unchanged.
3. The web app is served at `https://dua-tangan.onrender.com` and the API at `https://dua-tangan-api.onrender.com`. If Render gives the API another address, update `EXPO_PUBLIC_API_URL` in `render.yaml`.
4. For the admin area, add `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` to the API's **Environment** settings on Render.

Render's free API sleeps after 15 minutes without traffic, so the next visit waits about a minute while it wakes up. To reset the hosted demo, run the seed from your computer against Neon:

```bash
cd backend && DATABASE_URL='<neon connection string>' python -m app.seed --reset
```

## Tests and checks

```bash
cd backend && pytest                   # API flows: both parents, clashes, balance, tone, record tampering,
                                       # bookings, documents, admin, migrations
cd mobile && npm run typecheck && npx expo lint
```

`pytest` uses the separate `duatangan_test` database and recreates its tables before each test.

## Troubleshooting

- **"Can't reach Dua Tangan" on a phone:** check that the API runs with `--host 0.0.0.0`, that the phone and computer share a Wi-Fi network, and that the macOS firewall allows incoming connections for Python. The screen shows the address the app tried.
- **Port 8081 in use:** Expo offers another port. Accept it.
- **Times look shifted:** the app shows times in the device's time zone, and record entries are written in the family's time zone. Reseed with `DEMO_TIME_ZONE` set if your demo was created somewhere else.

## Not in this MVP (yet)

- Push notifications (the app refreshes in the background instead: chat every 4 seconds, home every 15).
- Real payments. Bookings go through `app/services/payments.py`, which pretends every charge succeeds; plug a provider in there.
- Location-verified check-ins, and a read-only view for professionals.
- An AI rewrite of heated messages (the tone check is rule-based).

# MicroStore

Event-driven supermarket demo that showcases an inventory microservice, a billing microservice, Apache Kafka for messaging, PostgreSQL for persistence, and a React/Vite frontend. `docker-compose` orchestrates every dependency so you can explore the full workflow—from adding stock to generating invoices—locally.

---

## Architecture At A Glance

- `inventory_service` (FastAPI)  
  Handles CRUD for products, decrements stock, and publishes completed sales to Kafka (`invoices_topic`).
- `billing_service` (FastAPI)  
  Consumes Kafka events, persists invoices, and exposes historical billing data.
- `frontend` (React + Vite)  
  Single-page dashboard for admins/cashiers to manage stock and review invoices.
- Infrastructure: PostgreSQL (two databases), Kafka + Zookeeper, Kafka UI, all managed by Docker Compose.

```
Frontend (Vite/React) ──> Inventory API (FastAPI) ──> PostgreSQL (inventory_db)
                                     │
                                     └─(sales events)→ Kafka → Billing Consumer → PostgreSQL (billing_db)
```

---

## Tech Stack

| Layer        | Tools |
|--------------|-------|
| Frontend     | React 18, Vite, Tailwind-esque utility classes, Lucide icons |
| Backend APIs | FastAPI, Pydantic, SQLAlchemy |
| Messaging    | Apache Kafka 7.4 (Confluent images), Kafka UI |
| Databases    | PostgreSQL 15 |
| DevOps       | Docker, Docker Compose |

---

## Repository Layout

```
billing_service/     FastAPI consumer + SQLAlchemy models for invoices
inventory_service/   FastAPI producer + SQLAlchemy models for products
frontend/            React SPA (Vite)
init_db.sql          Creates billing_db and inventory_db on container start
docker-compose.yml   All services + Kafka UI
```

---

## Prerequisites

| Tool | Why | Install (macOS example) |
|------|-----|-------------------------|
| Docker Desktop 4.x+ | Containers for Postgres/Kafka/services | `brew install --cask docker` → launch Docker.app once |
| Docker Compose v2   | Already bundled with Docker Desktop | `docker compose version` (verify) |
| Node.js 18+ (optional) | Run the Vite dev server outside Docker | `brew install node` |
| Python 3.10+ (optional) | Run FastAPI services directly | `brew install python` |

> Windows/Linux: download Docker Desktop from https://www.docker.com/products/docker-desktop and follow the installer; ensure virtualization is enabled.

---

## Quick Start (Docker Compose)

1. **Clone & enter the repo**
   ```bash
   git clone <repo-url> MicroStore-app
   cd MicroStore-app
   ```
2. **Start everything**
   ```bash
   docker compose up --build
   ```
3. **Wait for health logs**
   - `ms_inventory` and `ms_billing` will retry DB/Kafka connections until ready.
4. **Use the app**
   - Frontend: http://localhost:5173
   - Inventory API docs: http://localhost:8000/docs
   - Billing API docs: http://localhost:8001/docs
   - Kafka UI: http://localhost:8080
5. **Stop**
   ```bash
   docker compose down
   ```
6. **Reset state (optional)**
   ```bash
   docker compose down -v   # removes postgres_data volume
   ```

---

## Local Development Without Docker

You still need PostgreSQL and Kafka running (easiest: keep `docker compose up postgres kafka zookeeper kafka-ui`).

### Backend (FastAPI services)

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r inventory_service/requirements.txt
pip install -r billing_service/requirements.txt
```

Set environment variables per service (example for inventory):

```bash
export DATABASE_URL="postgresql://admin:password123@localhost:5432/inventory_db"
export KAFKA_BOOTSTRAP_SERVERS="localhost:9092"
uvicorn main:app --reload --port 8000 --app-dir inventory_service
```

Billing service:

```bash
export DATABASE_URL="postgresql://admin:password123@localhost:5432/billing_db"
export KAFKA_BOOTSTRAP_SERVERS="localhost:9092"
uvicorn main:app --reload --port 8001 --app-dir billing_service
```

Run both terminals simultaneously.

### Frontend (Vite)

```bash
cd frontend
npm install
npm run dev -- --host
```

The app expects the APIs at `http://localhost:8000` and `http://localhost:8001`. Adjust `INVENTORY_API`/`BILLING_API` constants in `frontend/src/App.jsx` if you change ports or hostnames.

---

## Demo Data Seeder

Need a realistic dataset? Use the seeding script to populate 100 products, a year’s worth of restocks, and 20k+ sales line items:

```bash
python scripts/seed_databases.py
```

Environment variables:

| Variable | Default |
|----------|---------|
| `INVENTORY_DATABASE_URL` | `postgresql://admin:password123@localhost:5432/inventory_db` |
| `BILLING_DATABASE_URL`   | `postgresql://admin:password123@localhost:5432/billing_db` |

The script truncates the affected tables (`products`, `stock_movements`, `invoices`, `invoice_items`) before loading fresh data, so run it only in disposable/dev environments.

---

## Operational Notes

- Kafka topic `invoices_topic` is created lazily; the inventory service produces to it and the billing service consumes from it. Kafka UI shows payloads for debugging.
- Both backend services automatically create their tables via SQLAlchemy metadata on startup.
- `init_db.sql` ensures databases exist before the services attach.
- Frontend login is purely client-side: enter `admin` for admin permissions or any other username for the cashier role.

---

## Common Issues & Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `DATABASE_URL environment variable is not set` on startup | Missing env var when running outside Docker | Export the correct connection string before launching FastAPI or add it to your shell profile. |
| `psycopg2.OperationalError: could not connect to server` | Postgres container not ready or port conflict | Check `docker compose ps`, ensure `5432` isn’t used by another local instance, retry after Postgres logs `database system is ready to accept connections`. |
| `Kafka not ready yet (NoBrokersAvailable)` | Kafka container still booting | Wait a few seconds; inventory/billing services retry automatically. For manual runs verify `KAFKA_BOOTSTRAP_SERVERS`. |
| `Failed to create producer: ...` in `inventory_service` | Kafka conf invalid or broker unreachable | Confirm `bootstrap.servers` matches running broker (`localhost:9092` outside Docker, `kafka:29092` inside). |
| Frontend shows empty tables forever | APIs unreachable due to CORS/port mismatch | Confirm services are listening on `8000/8001` and update the API constants if you proxied through another host. |
| `Bind for 0.0.0.0:5173 failed: port is already allocated` | Port used by another process | Stop other Vite/dev servers or change exposed port (`ports` section in `docker-compose.yml`). |

Check detailed logs with:
```bash
docker compose logs -f inventory_service
docker compose logs -f billing_service
docker compose logs -f kafka
```

---

## Next Steps

- Add authentication/authorization instead of the demo-only login.
- Introduce automated tests (FastAPI + pytest) and CI.
- Add observability (Prometheus/Grafana) or tracing for the Kafka pipeline.

Happy hacking!


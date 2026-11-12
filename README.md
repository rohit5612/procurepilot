# ProcurePilot

**ProcurePilot** is a procurement web app for teams that buy goods and services with approvals, budgets, and audit trails. Employees run the classic **procure-to-pay** flow (requisitions → purchase orders → goods receipt), and use **AI Buy** to describe a need in plain language, compare supplier offers, pass policy checks, and pay with **PayPal** sandbox checkout.

Built for the [PayPal × AI hackathon](https://devpost.com) — meaningful use of **PayPal** (Checkout) and **AI** (intake + explanations).

## What it does

| Area | Capability |
|------|------------|
| **Procurement** | Requisitions, POs, approvals, GRN tied to PO receiving |
| **Masters** | Items, suppliers, sites (ERP-style master data) |
| **AI Buy** | Natural-language request → structured fields → offer compare → recommendation |
| **Policy** | Spend caps, category rules, budget reservation before checkout |
| **Pay** | PayPal JS SDK + server capture; payment events on the purchase record |

Humans stay in control: AI prepares and explains choices; checkout runs only after policy allows it.

## Tools used (for judges)

| Tool | Role in this project |
|------|----------------------|
| **PayPal Checkout (Sandbox)** | Client SDK buttons; server creates/captures orders; webhooks optional for async paid events |
| **Ollama** (or OpenAI-compatible API) | Parses AI Buy text and generates short “why this offer” explanations (`AI_PROVIDER` in server env) |
| **Channel3** | Live product search API for offer comparison (`CHANNEL3_ENABLED`) |
| **AG Grid** | Side-by-side offer comparison grid in AI Buy |
| **PostgreSQL** | ERP procurement schema, policies, payment ledger |

Demo without live AI: set `AI_FALLBACK_HEURISTICS=true`. Demo offers without Channel3: `PROCUREPILOT_DEMO_OFFERS=true`.

## Run locally

**Requirements:** Node.js 18+, PostgreSQL 14+, npm. Optional: Redis (`REDIS_URL` — `docker compose up -d redis`), local [Ollama](https://ollama.com), PayPal sandbox app, Channel3 API key.

### 1. Database

```bash
createdb procurepilot
# or: psql -c "CREATE DATABASE procurepilot;"
```

### 2. Environment

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env`: `DB_*`, `JWT_SECRET`, and for the hackathon demo set at minimum:

- `PAYPAL_ENABLED=true`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_PUBLIC_CLIENT_ID` (sandbox)
- `CHANNEL3_ENABLED=true`, `CHANNEL3_API_KEY` (optional; demo offers work without it)
- `AI_PROVIDER=ollama` and run `ollama pull llama3.2`, or use heuristics fallback

Match PayPal to the client:

- `client/.env`: `VITE_PAYPAL_ENABLED=true`, `VITE_PAYPAL_CLIENT_ID` = sandbox client id  
- `VITE_API_URL=http://localhost:5000` (backend origin; paths add `/api/...` automatically)

### 3. Install and migrate

```bash
cd server && npm install && npm run db:migrate
cd ../client && npm install
```

### 4. Login (bundled superuser)

Migration **15** seeds a demo superuser on fresh databases (`npm run db:migrate`):

| Field | Value |
|-------|--------|
| Username | `admin` |
| Email | `admin@procurepilot.dev` |
| Password | `ProcurePilot2025!` |

Use this account to approve new registrations under **User Management**. Change the password before any public deployment.

### 5. Start dev servers

```bash
# terminal 1
cd server && npm run dev

# terminal 2
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Try **ProcurePilot → AI Buy** for the hackathon path, or **Procurement** for PR/PO/GRN.

**PayPal webhooks (optional):** Browser capture is enough for a local demo. For webhook testing, expose `http://localhost:5000/api/procurepilot/paypal/webhook` (e.g. ngrok) and set `PAYPAL_WEBHOOK_ID` in `server/.env`.

## Repository layout

- `client/` — React (Vite) UI  
- `server/` — Express API, Prisma SQL migrations, ProcurePilot services  
- `server/.env.example`, `client/.env.example` — full variable reference  
- `env.example` — quick copy checklist (same templates)

## License

MIT — see [LICENSE](LICENSE).

## Submission checklist

- [ ] Public repo with **LICENSE** in the root  
- [ ] This README (features + **run instructions** + **tools table**)  
- [ ] Working build (local or hosted URL)  
- [ ] Demo video (&lt; 3 min, YouTube) showing AI Buy + PayPal on your device  

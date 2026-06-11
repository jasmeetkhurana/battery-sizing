# Solar + BESS Savings Studio

A guided savings tool for large electricity consumers in India (industrial, commercial, mining, EV charging, data centers and more). Users describe their site and today's hourly power mix (grid + DG ± existing solar ± exchange power), design a new solution (solar rooftop/open access + BESS + exchange power) from a managed product catalog, and see hour-by-hour how the new mix serves their demand and what they save.

## Flow

1. **Your Site** — site basics, location, sanctioned load, objectives
2. **Today's Power Mix** — per-source hourly demand editor (stacked chart, drag to shape each source) with source costs; computes baseline cost
3. **New Solution** — solar PV (rooftop or open access), BESS, and exchange power blocks with real products, live totals, compatibility checks, and a live savings estimate
4. **Savings & Dispatch** — before/after stacked dispatch charts, savings cards, assumptions
5. **Your Details** — company and contact collected last, then submit + PDF report

## Stack

- **Frontend**: vanilla JS SPA with a custom design system, canvas load-curve editor, jsPDF report
- **Backend**: Node.js + Express + SQLite (`better-sqlite3`), single process
- **Admin panel**: schema-driven product/category management at `/admin`

## Run

```bash
npm install
npm start
```

- App: http://localhost:3000
- Admin panel: http://localhost:3000/admin — default password `loop-admin` (override with the `ADMIN_TOKEN` environment variable)

The product catalog is seeded automatically on first run from the bundled manufacturer datasheets (Adani Solar modules, Hopewind inverters / MV stations / PCS, Great Power BESS). To force a reseed, stop the server, delete `server/data.sqlite*`, and start again.

## Product catalog

Categories carry a `specSchema` (list of typed spec fields) that drives both the admin form and the configurator display, so new categories and products can be added entirely from the admin panel without code changes. Wind products are excluded from v1 but can be added later as a new category.

Seeded catalog:

| Category | Products |
| --- | --- |
| PV Module | Adani ELAN SHINE TOPCon bifacial 605–640 Wp |
| PV String Inverter (C&I) | Hopewind HSNV 60–150 kW |
| Utility String Inverter | Hopewind HSHV 320–385 kW (1500 V) |
| MV Transformer Station | Hopewind HPMVS 3000 / 6000 / 9000 |
| BESS Cabinet (AC-coupled) | Great Power Magna-C&I-215 / 260 |
| BESS Cabinet (DC) | Great Power Magna-UTL-373 / 418 |
| BESS Container | Great Power Max-20HC-3440 / 5000 |
| String PCS | Hopewind ESHV 145–250 kW |
| PCS Turnkey Station | Hopewind HPPS 1250–7500 |

## API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/categories` | – | List categories with spec schemas |
| POST/PUT | `/api/categories` | admin | Create / update category |
| GET | `/api/products` | – | List active products (`?categoryId=`, `?includeInactive=1`) |
| POST/PUT/DELETE | `/api/products` | admin | Create / update / deactivate product |
| POST | `/api/submissions` | – | Save a full intake + solution payload |
| GET | `/api/submissions` | admin | List submissions |

Admin requests send the password in the `x-admin-token` header.

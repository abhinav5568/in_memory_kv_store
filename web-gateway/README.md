# web-gateway

Provisioning + account dashboard layer in front of the TCP KV engine
(`/engine/client`). It does **not** sit in the runtime path of `get`/`set`/`del`
— once a user has their `uuid`, their own application talks to the TCP engine
directly via `KVClient`. This gateway only exists to:

1. Let a user sign up with email + password
2. Call `INIT` on the TCP engine to mint a fresh `uuid`
3. Persist `{email, password_hash, uuid}` in SQLite
4. Show the user their `uuid` (dashboard) so they can plug it into `KVClient`

## ⚠️ One assumption to verify

`server/services/tcpProvision.service.js` assumes the engine responds to
`INIT\n` with a line like `UUID|<uuid>` (mirroring the `CACHE_ID|...` /
`VALUE|...` framing already in your `KVClient`). If your server's actual
`INIT` reply uses a different prefix, update `SUCCESS_PREFIXES` in that file
— everything else is decoupled from this detail.

## Setup

```bash
# Server
cd server
cp .env.example .env   # edit JWT_SECRET, TCP_ENGINE_HOST/PORT
npm install
npm run dev             # http://localhost:4000

# Client (separate terminal)
cd client
npm install
npm run dev              # http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:4000`, so the React
app can call `fetch("/api/auth/signup")` etc. without CORS headaches locally.

## API

| Method | Path              | Auth | Description                          |
|--------|-------------------|------|---------------------------------------|
| POST   | /api/auth/signup  | –    | `{email, password}` → creates account, calls INIT, returns `uuid` |
| POST   | /api/auth/login   | –    | `{email, password}` → sets JWT cookie |
| POST   | /api/auth/logout  | –    | Clears cookie                         |
| GET    | /api/user/me      | JWT  | Returns `{id, email, uuid, created_at}` |

Session is a stateless JWT in an `httpOnly` cookie (`token`), so no server-side
session store is needed.

## What's deliberately left out for now

- **Live admin visibility into cache data** (per your answer, this is a later
  phase). When you're ready: add a `services/tcpAdmin.service.js` that opens a
  connection using the stored `uuid` (reusing the `KVClient` `AUTH` flow) to
  run read-only inspection commands, exposed via a new
  `GET /api/user/cache-stats` route guarded by `requireAuth`.
- **uuid rotation/revocation** — not requested yet, but worth a `POST
  /api/user/rotate-uuid` endpoint later if users need to invalidate a leaked
  uuid without losing their account.
- **Rate limiting on /signup and /login** — recommend adding
  `express-rate-limit` before this goes anywhere near production, since
  `/signup` triggers a real TCP round-trip per request.

## Project structure

```
web-gateway/
├── server/
│   ├── index.js
│   ├── config/db.js                  # SQLite connection + schema
│   ├── models/user.model.js          # users table access
│   ├── services/tcpProvision.service.js  # one-off INIT call to the engine
│   ├── controllers/{auth,user}.controller.js
│   ├── routes/{auth,user}.routes.js
│   ├── middleware/auth.middleware.js # JWT cookie guard
│   └── utils/{password,jwt}.util.js
└── client/
    └── src/
        ├── pages/{SignUp,Login,Dashboard}.jsx
        ├── api/auth.js
        └── App.jsx
```

# 🏏 Cricket Player Auction Management System

A full-stack system to run a live cricket player auction: register players, create teams and captains, run rounds of live bidding with real-time updates on every screen, sell / unsold / release / re-auction players, and keep a complete, never-deleted auction and financial history.

| Layer | Tech |
| --- | --- |
| Backend | Node.js 18+, Express 4, Mongoose 8, Socket.IO 4, JWT, bcrypt |
| Database | MongoDB Atlas (multi-document transactions) |
| Frontend | React 18 + Vite, React Router 6, Axios, socket.io-client |
| Architecture | MVC: `routes → controllers → services → models`, REST API + WebSocket events |

---

## Table of contents

1. [Features](#features)
2. [Project structure](#project-structure)
3. [MongoDB Atlas setup](#mongodb-atlas-setup)
4. [Installation](#installation)
5. [Environment variables](#environment-variables)
6. [Running the app](#running-the-app)
7. [Sample data](#sample-data)
8. [Database design & relationships](#database-design--relationships)
9. [Business rules](#business-rules)
10. [API documentation](#api-documentation)
11. [Socket.IO events](#socketio-events)
12. [Error handling & validation](#error-handling--validation)
13. [Deployment](#deployment)
14. [Troubleshooting](#troubleshooting)

---

## Features

- **Player management** – add/edit/view/delete players with photo, type, batting/bowling style, T‑shirt size, address, base price, status. Search by name, filter by type/batting/bowling/status, sort by name/base price/status, pagination.
- **Team management** – name, logo, colour, captain, total/used/remaining budget (always derived), min/max squad size, budget progress bar.
- **Captain management** – one captain per team, enforced in the database; reassigning moves the captain.
- **Live auction console** – current player card, current bid, highest bidder (highlighted), per-team **BID** buttons with the exact next amount, **SOLD / UNSOLD / NEXT PLAYER / Cancel**, bid log, round statistics.
- **Public live screen** (`/live`) – read‑only projector view that updates in real time, with SOLD / UNSOLD overlays.
- **Configurable bid rules** – bid increment, minimum base price, maximum bid, default base price, *allow previous team to re‑bid*.
- **SOLD** – runs in one MongoDB transaction: auction record → player → team budget → squad → ledger entry.
- **Release / Re‑auction** – refund the team, remove from squad, player becomes `Re-Auction`, original sale record preserved (stamped `releasedAt`), ledger gets `PLAYER_RELEASE`.
- **Rounds** – close a round and move unsold players into the next round's pool; per‑round sold/unsold/amount stats.
- **Auction history** – every auction record with filters (round, team, status, later released, search); click through to a player's complete timeline with every bid.
- **Team dashboard** – info, budget, squad with bid amounts, type statistics, full transaction ledger with running balance, released‑player history.
- **Admin dashboard** – KPIs and quick actions.
- **Security** – JWT admin auth, bcrypt password hashing, rate‑limited login, Helmet, CORS allow‑list, secrets only in `.env`.
- **Responsive UI** – works on desktop, tablet and phone.

---

## Project structure

```text
cricket-auction/
├── server/
│   ├── config/        env.js (dotenv + validation), db.js (Mongoose connection, replica-set detection)
│   ├── models/        Admin, Player, Team, Captain, Auction, Bid, Transaction, Round, Settings
│   ├── services/      auctionService (bid/sold/unsold/release/re-auction/history),
│   │                  teamService, playerService, captainService, dashboardService
│   ├── controllers/   thin HTTP handlers
│   ├── routes/        Express routers (+ /api/upload, /api/health)
│   ├── middleware/    auth (JWT), validators (express-validator), validate, upload (multer), errorHandler
│   ├── utils/         ApiError, asyncHandler, transaction (runInTransaction), socket, format
│   ├── scripts/       seed.js
│   ├── uploads/       uploaded images (served at /uploads)
│   ├── app.js         Express app
│   └── server.js      HTTP + Socket.IO bootstrap
├── client/
│   ├── src/
│   │   ├── components/  Layout, TeamCard, PlayerCard, BudgetBar, Badge, Modal, PhotoUpload, …
│   │   ├── pages/       AdminDashboard, AuctionPage, LiveDisplayPage, Players*, Teams*, TeamDashboard,
│   │   │                Captains, Pool (unsold/released), History, Rounds, Settings, Login
│   │   ├── services/    api.js (axios + all endpoints), socket.js
│   │   ├── hooks/       useAuth, useToast, useConfirm, useAuctionSocket
│   │   ├── utils/       format.js
│   │   ├── App.jsx      routes
│   │   └── index.css    sports theme
│   ├── index.html
│   └── vite.config.js   dev proxy → :5000
├── .env.example
├── package.json         root scripts (install:all, dev, seed, build, start)
└── README.md
```

---

## MongoDB Atlas setup

1. Go to <https://cloud.mongodb.com> and sign in / create a free account.
2. **Create a cluster** → choose the free **M0** tier, pick a region close to you, click *Create*.
3. **Database Access** → *Add New Database User* → authentication *Password* → choose a username/password → role **Read and write to any database** → *Add User*.
4. **Network Access** → *Add IP Address* → *Allow access from anywhere* (`0.0.0.0/0`) for development, or add your server's IP for production.
5. **Database → Connect → Drivers** → copy the connection string, e.g.
   ```text
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<username>` / `<password>` and add the database name before the `?`:
   ```text
   mongodb+srv://auctionadmin:MyPass123@cluster0.abcde.mongodb.net/cricket_auction?retryWrites=true&w=majority
   ```
   > If your password contains special characters (`@ : / ? # & %`) URL‑encode them (e.g. `@` → `%40`).
7. Paste it as `MONGODB_URI` in `.env`. Atlas clusters are replica sets, so **multi‑document transactions work out of the box**.

---

## Installation

Requires **Node.js 18 or newer** (tested on Node 24) and npm.

```bash
cd cricket-auction

# install root, server and client dependencies
npm run install:all

# create your environment file
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

Edit `.env` (see next section), then seed and start.

---

## Environment variables

`.env` in the project root (also read from `server/.env` if present):

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | no | API port (default `5000`) |
| `NODE_ENV` | no | `development` / `production` |
| `MONGODB_URI` | **yes** | MongoDB Atlas connection string |
| `JWT_SECRET` | **yes** | Long random string used to sign admin tokens |
| `JWT_EXPIRES_IN` | no | Token lifetime, default `12h` |
| `CLIENT_URL` | no | Comma‑separated allowed browser origins (default `http://localhost:5173`) |
| `USE_TRANSACTIONS` | no | `true` (default). Set `false` only for a local standalone `mongod` |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | no | First admin created by the seed script (default `admin@auction.com` / `Admin@123`) |

Example:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://auctionadmin:MyPass123@cluster0.abcde.mongodb.net/cricket_auction?retryWrites=true&w=majority
JWT_SECRET=please_change_me_to_a_64_char_random_string
JWT_EXPIRES_IN=12h
CLIENT_URL=http://localhost:5173
USE_TRANSACTIONS=true
ADMIN_NAME=Auction Admin
ADMIN_EMAIL=admin@auction.com
ADMIN_PASSWORD=Admin@123
```

Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

The client needs no environment variables in development (Vite proxies `/api`, `/uploads`, `/socket.io` to port 5000). For a separately hosted API set `VITE_API_URL=https://api.example.com/api` and `VITE_SOCKET_URL=https://api.example.com` in `client/.env`.

---

## Running the app

### Seed sample data (admin + 4 teams + captains + 20 players)

```bash
npm run seed              # adds data, skips what already exists
npm run seed -- --fresh   # wipes all auction data first
```

### Development (backend + frontend together)

```bash
npm run dev
```

- API: <http://localhost:5000/api> (health: `/api/health`)
- Admin UI: <http://localhost:5173> → log in with `admin@auction.com` / `Admin@123`
- Public live screen: <http://localhost:5173/live>

Run them separately with `npm run server` and `npm run client`.

### Production (single server serves API + built React app)

```bash
npm run build     # builds client/dist
NODE_ENV=production npm start
```

Express serves `client/dist` for every non‑API route, so the whole app runs from one origin on `PORT`.

### If no admin exists

Open the login page: it switches to **"Create the first admin account"** (backed by `POST /api/auth/setup`, which only works while the `admins` collection is empty).

---

## Sample data

The seed creates:

| Team | Budget | Captain | Max / Min players |
| --- | ---: | --- | --- |
| Royal Strikers | ₹50,000 | Rohan Desai | 8 / 5 |
| Thunder Kings | ₹50,000 | Amit Shah | 8 / 5 |
| Green Warriors | ₹50,000 | Kiran Mehta | 8 / 5 |
| Golden Eagles | ₹50,000 | Sanjay Rao | 8 / 5 |

and 20 players (Virat Patel, Rahul Patel, Jay Shah, …) with base prices ₹1,500–₹3,500, plus settings: increment ₹500, min base ₹500, no max bid, previous team may re‑bid.

Sample documents you can insert manually (Atlas → Browse Collections → Insert Document):

```json
// players
{
  "name": "Virat Patel", "phone": "9876510000", "playerType": "Batsman",
  "battingStyle": "Right Hand", "bowlingStyle": "None", "tshirtSize": "L",
  "address": "Ahmedabad, Gujarat", "photo": "", "basePrice": 2000,
  "status": "Available", "currentTeam": null, "soldPrice": 0,
  "auctionRound": 1, "releaseCount": 0
}
```
```json
// teams  (remainingBudget is recomputed on save; also add an INITIAL_BUDGET transaction)
{
  "name": "Royal Strikers", "logo": "", "color": "#d62828", "captain": null,
  "totalBudget": 50000, "usedBudget": 0, "remainingBudget": 50000,
  "maxPlayers": 8, "minPlayers": 5, "players": []
}
```
```json
// transactions
{ "team": ObjectId("..."), "type": "INITIAL_BUDGET", "amount": 50000, "balanceAfter": 50000, "description": "Initial budget ₹50,000" }
```

---

## Database design & relationships

```text
Admin              Settings (singleton: bidIncrement, minBid, maxBid, allowPreviousTeamRebid, currentRound)
                   Round (number, status OPEN/CLOSED, playersAtStart)

Captain 1 ──── 1 Team                  Team.captain  → Captain,  Captain.team → Team (unique partial index)
Team    1 ──── * Player                Team.players[] → Player,  Player.currentTeam → Team
Player  1 ──── * Auction               one Auction document per time a player goes on the block (per round)
Auction 1 ──── * Bid                   every bid ever placed, with team, amount, round
Team    1 ──── * Transaction           financial ledger: INITIAL_BUDGET / PLAYER_PURCHASE / PLAYER_RELEASE / BUDGET_ADJUSTMENT
Auction 1 ──── * Transaction           purchase/release entries reference the auction they belong to
```

### Collections

**players** – `name, phone, playerType, battingStyle, bowlingStyle, tshirtSize, address, photo, basePrice, status (Available|Sold|Unsold|Released|Re-Auction), currentTeam, soldPrice, auctionRound, releaseCount, lastReleasedAt, timestamps`

**teams** – `name (unique), logo, color, captain, totalBudget, usedBudget, remainingBudget, maxPlayers, minPlayers, players[], timestamps`.
`remainingBudget = totalBudget − usedBudget` is recomputed in a `pre('validate')` hook and must be ≥ 0 (schema `min`), so a negative budget can never be saved.

**captains** – `name, phone, photo, team` with a unique partial index on `team` → one captain per team at the database level.

**auctions** – `player, round, status (LIVE|SOLD|UNSOLD|CANCELLED), basePrice, currentBid, highestBidder, bidCount, finalBid, winningTeam, previousTeam, startedAt, completedAt, releasedAt, conductedBy`.
A unique partial index on `status: 'LIVE'` guarantees only one live auction at a time. **Records are never deleted.**

**bids** – `auction, player, team, bidderName, amount, round, placedBy, createdAt`

**transactions** – `team, player, auction, type, amount (signed), balanceAfter, round, description, createdBy, createdAt`.
The team dashboard shows the ledger and recomputes the balance from it (`ledgerBalance`) to prove it matches `remainingBudget`.

**rounds** – `number (unique), status, playersAtStart, startedAt, closedAt`

**settings** – singleton (`key: 'global'`).

---

## Business rules

| Rule | Where enforced |
| --- | --- |
| First bid = base price; each next bid = current + `bidIncrement` | `auctionService.computeNextBid` |
| Team cannot bid if next amount > remaining budget → **"Insufficient budget for this bid."** | `placeBid` |
| Team cannot bid when already highest bidder (duplicate bid) | `placeBid` |
| Team cannot bid when squad is full (`maxPlayers`) | `placeBid`, `markSold` |
| Bids above `maxBid` (when > 0) are rejected | `placeBid` |
| Previous owner may be blocked from re‑bidding (`allowPreviousTeamRebid`) | `placeBid` using `auction.previousTeam` |
| Money is **not** deducted on bids, only on SOLD | `placeBid` only updates the auction document |
| SOLD updates auction + player + team + squad + ledger atomically | `markSold` inside `runInTransaction` |
| Sold player cannot be sold again unless released | `markSold` checks `player.status / currentTeam` |
| Player cannot belong to two teams | `currentTeam` single ref + checks above |
| Release = remove from squad + refund + `Re-Auction` + preserve record + ledger | `releasePlayer` in one transaction |
| Re‑auction round = close round, move Unsold → `Re-Auction`, `currentRound + 1` | `startReAuction` in one transaction |
| Only one live auction at a time | unique partial index + check |
| Concurrent bids cannot overwrite each other | optimistic `findOneAndUpdate` on `bidCount` |
| Budget can never be negative; cannot lower total budget below used | Team schema + `updateTeam` |
| Duplicate team names rejected (case‑insensitive) | unique index + `createTeam/updateTeam` |
| Phone numbers validated (Indian 10‑digit or international) | validators + schema |
| Players with auction history cannot be deleted | `deletePlayer` |
| Team with players cannot be deleted | `deleteTeam` |

Budget example that the ledger reproduces exactly:

```text
+ ₹50,000  Initial budget            balance 50,000
- ₹10,000  Player A purchase         balance 40,000
+ ₹10,000  Player A release          balance 50,000
-  ₹8,000  Player B purchase         balance 42,000
```

---

## API documentation

Base URL: `http://localhost:5000/api`. All responses are JSON `{ success, ... }`. Protected routes need `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint | Auth | Body | Description |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | – | `{ email, password }` | Returns `{ token, admin }` |
| GET | `/auth/me` | ✔ | | Current admin |
| GET | `/auth/setup-status` | – | | `{ needsSetup }` |
| POST | `/auth/setup` | – | `{ name, email, password }` | Create first admin (only when none exist) |
| POST | `/auth/change-password` | ✔ | `{ currentPassword, newPassword }` | |

### Players

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/players/meta` | Enum lists (types, styles, sizes, statuses) |
| GET | `/players` | Query: `search, playerType, battingStyle, bowlingStyle, status (comma list), team, released=true, sort (name|basePrice|status|createdAt), order (asc|desc), page, limit` |
| GET | `/players/:id` | |
| POST | `/players` | `{ name, phone, playerType, battingStyle, bowlingStyle, tshirtSize, address, photo, basePrice, status }` |
| PUT | `/players/:id` | Partial update (cannot set `Sold`; a sold player's status only changes via release) |
| DELETE | `/players/:id` | Blocked if sold or has auction history |
| POST | `/players/:id/release` | Release from team: refund, `Re-Auction`, ledger entry |
| GET | `/players/:id/history` | `{ player, timeline[], transactions[], currentOwner }` |

### Teams

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/teams` | List (public) |
| GET | `/teams/:id` | With captain + players |
| POST | `/teams` | `{ name, logo, color, totalBudget, maxPlayers, minPlayers, captain }` → creates `INITIAL_BUDGET` ledger entry |
| PUT | `/teams/:id` | Budget change creates `BUDGET_ADJUSTMENT` |
| DELETE | `/teams/:id` | Blocked while the team owns players |
| PUT | `/teams/:id/captain` | `{ captainId }` (or `null` to remove) |
| GET | `/teams/:id/dashboard` | `{ team, squad[], stats, ledger[], ledgerBalance, releasedHistory[] }` (public) |

### Captains

`GET /captains`, `POST /captains { name, phone, photo, team }`, `GET/PUT/DELETE /captains/:id`

### Auctions

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/auctions/current` | – | Full live state: `{ auction, bids, teams, settings, stats, nextBidAmount }` |
| POST | `/auctions/start` | ✔ | `{ playerId? }` – start for a given player or the next in pool |
| POST | `/auctions/:id/bid` | ✔ | `{ teamId }` – validates budget/increment/rules |
| POST | `/auctions/:id/sold` | ✔ | `{ teamId, amount }` records the result of a verbal auction (validated against base price, max bid, budget, squad size, re-bid rule). Omit the body to sell to the current highest bidder from button bidding. Transactional. |
| POST | `/auctions/:id/unsold` | ✔ | Mark unsold |
| POST | `/auctions/:id/cancel` | ✔ | Return player to pool, no result |
| POST | `/auctions/next` / `/auctions/:id/next` | ✔ | Auto‑unsold a bid‑less live player, start the next one |
| POST | `/auctions/reauction` | ✔ | `{ includeUnsold: true }` – close round, open next with unsold players |
| GET | `/auctions/history` | – | Query: `round, team, status, player, released=true, search, page, limit` |
| GET | `/auctions/rounds` | – | Per‑round stats |
| GET | `/auctions/pool` | ✔ | `{ pool, unsold, released }` |

### Other

| Method | Endpoint | Description |
| --- | --- | --- |
| GET / PUT | `/settings` | `{ auctionName, bidIncrement, minBid, maxBid, defaultBasePrice, allowPreviousTeamRebid }` |
| GET | `/dashboard` | Admin KPIs, live auction, recent sales, teams |
| POST | `/upload` | multipart field `image` → `{ url: "/uploads/..." }` |
| GET | `/health` | |

### Sample requests

```bash
# login
curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@auction.com","password":"Admin@123"}'
# → {"success":true,"token":"eyJ...","admin":{...}}
TOKEN=eyJ...

# add a player
curl -s -X POST http://localhost:5000/api/players -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Virat Patel","phone":"9876543210","playerType":"Batsman","battingStyle":"Right Hand","bowlingStyle":"None","tshirtSize":"L","address":"Ahmedabad","basePrice":2000}'

# add a team
curl -s -X POST http://localhost:5000/api/teams -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Team A","totalBudget":50000,"maxPlayers":15,"minPlayers":11,"color":"#d62828"}'

# start auction (next player in pool) and bid
curl -s -X POST http://localhost:5000/api/auctions/start -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
curl -s -X POST http://localhost:5000/api/auctions/<auctionId>/bid -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"teamId":"<teamId>"}'
# → 400 {"success":false,"message":"Insufficient budget for this bid.","details":{"required":2500,"remaining":1000,"team":"Team A"}}

# sold (teams bid verbally; admin records winner + price) / unsold / next
curl -s -X POST http://localhost:5000/api/auctions/<auctionId>/sold -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"teamId":"<teamId>","amount":7000}'
curl -s -X POST http://localhost:5000/api/auctions/<auctionId>/unsold -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:5000/api/auctions/next -H "Authorization: Bearer $TOKEN"

# release a sold player, then start round 2
curl -s -X POST http://localhost:5000/api/players/<playerId>/release -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:5000/api/auctions/reauction -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"includeUnsold":true}'

# history
curl -s "http://localhost:5000/api/auctions/history?round=1&status=SOLD"
curl -s http://localhost:5000/api/players/<playerId>/history -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:5000/api/teams/<teamId>/dashboard
```

Example `GET /api/players/:id/history` response:

```json
{
  "success": true,
  "player": { "name": "Virat Patel", "status": "Sold", "soldPrice": 4000, "releaseCount": 1 },
  "currentOwner": { "name": "Green Warriors" },
  "timeline": [
    { "round": 1, "status": "SOLD", "finalBid": 4500, "team": { "name": "Thunder Kings" }, "releasedAt": "2026-10-07T10:21:00.000Z", "bids": [ ... ] },
    { "round": 2, "status": "SOLD", "finalBid": 4000, "team": { "name": "Green Warriors" }, "releasedAt": null, "bids": [ ... ] }
  ],
  "transactions": [ { "type": "PLAYER_PURCHASE", "amount": -4500 }, { "type": "PLAYER_RELEASE", "amount": 4500 }, { "type": "PLAYER_PURCHASE", "amount": -4000 } ]
}
```

---

## Socket.IO events

Connect to the API origin (`io("http://localhost:5000")`). Every event payload contains `message`, `at` and a full `state` object identical to `GET /api/auctions/current`, so clients can replace their state in one step.

| Event | Extra payload | When |
| --- | --- | --- |
| `auction:started` | | A player goes on the block |
| `auction:bid` | `bid: { team, teamId, amount }` | A bid is placed |
| `auction:sold` | `sale: { player, team, amount, round }` | SOLD |
| `auction:unsold` | `player: { name, id }` | UNSOLD |
| `auction:cancelled` | | Auction cancelled |
| `auction:pool-empty` | | NEXT pressed with nothing left |
| `player:released` | `release: { player, team, refund }` | Release |
| `round:started` | `round` | Re‑auction round opened |
| `teams:updated`, `players:updated`, `settings:updated` | | CRUD changes |

Mutations are only possible through the authenticated REST API; sockets are broadcast‑only.

---

## Error handling & validation

- Every error is JSON: `{ "success": false, "message": "...", "details": [...] }` with proper status codes (`400` validation / business rule, `401` auth, `403`, `404`, `409` conflict/duplicate, `429` rate limit, `500`).
- `express-validator` chains validate bodies (`middleware/validators.js`), Mongoose schemas validate persistence (enums, required, min, phone regex), and services enforce business rules (`ApiError`).
- Mongoose `ValidationError`, `CastError` and duplicate‑key (`11000`) errors are translated to friendly messages in `middleware/errorHandler.js`.
- Multi‑document operations (SOLD, UNSOLD, release, re‑auction, team create/update/delete, captain assignment) run in `runInTransaction`; if any step throws, the whole transaction is aborted and nothing is written.
- The server detects a non‑replica‑set MongoDB on startup and logs a warning (transactions are disabled in that case only).

---

## Deployment

### Option 0 – Vercel (single project, included config)

The repo ships with `vercel.json` and `api/index.js`, which wraps the Express app as one serverless function while the React build is served as static files.

1. Import the GitHub repo in Vercel (or run `npx vercel` in the project root).
2. Environment variables (Production): `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`, `USE_TRANSACTIONS=true`, `VITE_DISABLE_SOCKET=true`.
3. Deploy. Install/build/output settings are read from `vercel.json`.

Vercel limitations to know about:

- Serverless functions cannot keep WebSocket connections open, so Socket.IO is disabled there (`VITE_DISABLE_SOCKET=true`). The auction console and the public `/live` screen fall back to **polling every 2.5 seconds**, which is still fast enough for a live auction. For true push updates host the API on a long‑running Node service (Options A/B below).
- The filesystem is read‑only, so photo uploads do not persist. Paste image URLs (e.g. Cloudinary, Google Drive direct links) instead of uploading.

### Option A – single service (Render / Railway / Fly.io / VPS)

1. Push the repository to GitHub.
2. Create a **Web Service** from the repo.
   - Build command: `npm run install:all && npm run build`
   - Start command: `npm start`
3. Environment variables: `NODE_ENV=production`, `PORT` (provided by host), `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL=https://your-app.onrender.com`.
4. The API, Socket.IO and the built React app are served from the same origin. Make sure WebSockets are enabled (they are on Render/Railway by default).
5. Uploaded images live on the server disk (`server/uploads`). On hosts with ephemeral disks attach a persistent volume or paste image URLs (e.g. Cloudinary/S3) instead of uploading.

### Option B – separate frontend (Vercel/Netlify) + API (Render)

1. Deploy `server/` as a Node service (root dir `server`, start `node server.js`) with the env variables above and `CLIENT_URL=https://your-frontend.vercel.app`.
2. Deploy `client/` as a static Vite site with `VITE_API_URL=https://your-api.onrender.com/api` and `VITE_SOCKET_URL=https://your-api.onrender.com`. Build command `npm run build`, output `dist`. Add an SPA rewrite (`/* → /index.html`).

### VPS with PM2 + Nginx

```bash
npm run install:all && npm run build
npm i -g pm2
NODE_ENV=production pm2 start server/server.js --name cricket-auction
pm2 save && pm2 startup
```

Nginx: proxy `/` to `http://127.0.0.1:5000` and add `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";` for Socket.IO. Put TLS in front with Let's Encrypt.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Missing required environment variables` | Copy `.env.example` → `.env` and fill `MONGODB_URI`, `JWT_SECRET` |
| `MongoServerSelectionError` / ETIMEOUT | Atlas → Network Access: add your IP; check username/password URL encoding |
| `Transaction numbers are only allowed on a replica set member` | Use Atlas, or run a local replica set, or set `USE_TRANSACTIONS=false` for a standalone local mongod |
| Login says "Too many login attempts" | 30 attempts / 15 min per IP; wait or restart the server |
| Images don't show in production | Ensure `/uploads` is persistent, or use external image URLs |
| Live screen not updating | Check the browser can reach `/socket.io` (proxy must forward WebSocket upgrades) |

---

## Default credentials (after `npm run seed`)

```text
Email:    admin@auction.com
Password: Admin@123
```

Change the password from **Bid Rules & Settings → Change admin password** before a real event.

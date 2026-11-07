# CELESTIAL LOBBY Cloudflare backend

This is a separate server-side foundation. It does not silently alter the current GitHub Pages storefront.

## Files
- worker.js: Cloudflare Worker API for authentication and business records.
- schema.sql: D1 database schema.
- Required D1 binding name: DB.
- Existing Worker: https://ownersendo.ecelestiallobby.workers.dev/

## Dashboard setup (mobile)
1. Cloudflare Dashboard → Workers & Pages → D1 SQL Database → Create database. Name it celestial-lobby-db.
2. Open the database → Console. Paste all of schema.sql and run it.
3. Workers & Pages → ownersendo → Settings → Bindings → Add → D1 database. Variable name DB; select celestial-lobby-db; save.
4. Open ownersendo → Edit code. Replace Hello World with all contents of worker.js; deploy.
5. Settings → Variables and Secrets. Add these as Secrets: BOOTSTRAP_OWNER_ACCESS_ID, BOOTSTRAP_OWNER_PASSWORD, BOOTSTRAP_OWNER_KEY. Use a private Access ID, a unique random password of 16+ characters, and a separate random one-time key of 32+ characters. Never place secrets in GitHub or chat.
6. Initialize Owner once by POSTing JSON {"bootstrapKey":"YOUR_BOOTSTRAP_OWNER_KEY"} to /api/bootstrap. Then sign in at /api/auth/login and change the password through /api/auth/password. The Owner initialization route refuses to create a second Owner.
7. Test GET /api/health.

## API routes
POST /api/bootstrap; POST /api/auth/login; GET /api/auth/me; POST /api/auth/logout; POST /api/auth/password.
GET/POST /api/accounts; PATCH /api/accounts/:id (status).
GET/POST /api/orders; PATCH /api/orders/:id (status).
GET/POST /api/inventory; POST /api/codes/validate; GET /api/audit.

Account issuance returns a generated Access ID and one-time temporary password. The password is stored only as a salted PBKDF2 hash; the temporary password is returned once and must be changed on first login.

## Important rollout notes
- Owner has full permissions. Admin has operational permissions but cannot create Owner accounts. Sales has order/customer workflow permissions. Client order listing is limited to that client's own orders. Celestial Army currently has a narrow operational baseline; assign/refine permissions before live use.
- CORS is restricted to https://ecelestiallobby.github.io. Change ORIGIN in worker.js if the production frontend origin changes.
- The React screens are not yet connected to this API. Current localStorage records and browser Owner override remain demo-only until frontend integration is completed and tested.
- The former client-side Owner phrase is compromised because public JavaScript is readable. Retire it; do not reuse it as a password or secret.
- Do not enter real customer/payment information yet. Before production, add robust edge rate limiting, D1 backup/restore procedures, monitoring, stronger input validation, CSRF review, and security testing.

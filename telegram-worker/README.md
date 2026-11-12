# CELESTIAL LOBBY Telegram Bot

This folder contains the first implementation of the existing `@celestiallobbybot` as the central Telegram bot for the CELESTIAL LOBBY portal.

## What is implemented

- `/start` distinguishes first-time and returning users using Cloudflare KV.
- Inline-button navigation for Welcome, Guest Environment, Client Center, Support, Account Security, and Employee Access.
- Owner menu is shown only to Telegram IDs in the server-side `OWNER_TELEGRAM_IDS` allowlist.
- A Launch Portal Mini App button opens the existing GitHub Pages portal.
- FAQ and policy guidance is deliberately limited to known CELESTIAL LOBBY rules and clearly marks unavailable live integrations.
- A protected server-to-server restriction notification endpoint is prepared for lockout, onboarding restriction, suspension, and terminated-access events.
- Telegram webhook requests are checked using Telegram's webhook secret header.

## Important boundaries

- The website is still a browser-local demo. This bot does not turn localStorage into a trusted account database.
- No account ID, employee credential, AGP code, password, payment data, or customer document should be sent to the bot.
- The restriction notification endpoint must only be called by a trusted backend. Do not call it directly from GitHub Pages JavaScript because its bearer secret must remain private.
- A Telegram user's numeric ID is not automatically linked to a CELESTIAL LOBBY client account. A verified account-linking flow is a separate future task.
- Telegram `initData` is not trusted by the frontend. A future backend must validate its signature before using Telegram identity for account authorization.
- The bot does not create orders, collect payments, approve exceptions, or modify account status.
- No live messages can be sent until a replacement BotFather token is stored as a backend secret and the webhook is configured.

## Deployment outline (later, when ready)

1. Create a Cloudflare Worker project and a KV namespace named for bot sessions.
2. Replace the KV namespace ID in `wrangler.toml`.
3. From this folder, install Wrangler in your own environment and authenticate with Cloudflare.
4. Set secrets. Never place values in source files:
   - `BOT_TOKEN`: the newly rotated BotFather token.
   - `TELEGRAM_WEBHOOK_SECRET`: a new random secret used to authenticate Telegram webhook calls.
   - `EVENT_INGEST_SECRET`: a separate random secret reserved for trusted backend restriction events.
   - `OWNER_TELEGRAM_IDS`: optional comma-separated numeric Telegram IDs authorized to see the Owner menu.
5. Deploy the Worker and configure the Telegram webhook to its `/webhook` URL, supplying the same webhook secret in Telegram's `secret_token` field.
6. Configure the bot's Mini App domain in BotFather for `ecelestiallobby.github.io`.
7. Test `/start`, returning-user greeting, menu callbacks, Mini App launch, and protected restriction notifications.

The deployment and live tests are intentionally pending. The repository does not contain a bot token or any secret values.

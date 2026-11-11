# Text to paste into the Hypixel Developer Dashboard

Application type: **Personal** (non-monetized public Discord bot)

**Project name:** BlockStat Bot

**Description:**
A free Discord bot that shows Hypixel information only when a user runs a slash command. Commands: `/stats` and `/game` (player and per-game stats), `/compare` (two players), `/guild`, `/skyblock` (profile summary with skill average), `/bazaar` (item price lookup), `/network` (players online), `/skin`, and `/link` (links a Discord user to a Minecraft account, verified by matching the Discord field on the profile).

**Endpoints used:** `GET /v2/player`, `GET /v2/guild`, `GET /v2/skyblock/profiles` (key required, user-triggered, cached 1 hour) and `GET /v2/skyblock/bazaar`, `GET /v2/counts` (public, cached 1-2 minutes, only fetched when a user runs a command).

**How we follow the API Policy:**
- Every request is triggered by a user command. There is no continuous polling, no stat history and no session tracking.
- Player responses are cached for 1 hour and identical concurrent requests are merged into one.
- The bot keeps its own request budget below the default limit and backs off on HTTP 429.
- Per-user cooldown on commands.
- No betting or gambling, no monetization, and no tracking of specific players or ranks.
- Nick/disguised players are not de-anonymized (the bot only reads data returned for a username the user typed).
- The API key is stored in an environment variable on the server and is never shared or placed in code.
- The bot states in its embeds and in `/about` that it is not affiliated with or endorsed by Hypixel.

**Source code:** (add your GitHub repository URL here)

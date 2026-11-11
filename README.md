# BlockStat Bot

A small Discord bot that shows Hypixel stats on demand. **Not affiliated with or endorsed by Hypixel.**

## Commands
- `/stats`, `/game` (Bed Wars, SkyWars, Duels, Murder Mystery), `/compare`, `/guild`, `/skyblock`, `/bazaar`, `/network`, `/skin`, `/help`
- `/stats [player]` - network level, karma, achievements, Bed Wars and SkyWars summary
- `/compare first second` - side-by-side comparison
- `/link player` / `/unlink` - link your Minecraft account (verified via the Discord field on your Hypixel profile)
- `/about`

## Setup
1. Create a bot at https://discord.com/developers/applications (copy token and application ID).
2. `cp .env.example .env` and fill in the values (Hypixel key from https://developer.hypixel.net).
3. Install and run:

```bash
npm install
npm run deploy
npm start
```

## Design notes
- Requests only happen when a user runs a command; nothing is polled or stored as history.
- Player data is cached for 1 hour, concurrent identical requests share one call.
- Built-in request budget (240 per 5 min), 429 back-off, and per-user cooldown.
- The API key lives only in `.env` (git-ignored).

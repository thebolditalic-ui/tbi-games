# tbi-games

Static site behind **games.thebolditalic.com** — The Bold Italic's games hub.

Deployed to Vercel (project `tbi-games`). No build step; files are served as-is from the repo root.

## Structure
- `index.html` — games hub / landing page
- `crosswords/` — daily crossword game
- `fog_city_frenzy/` — Fog City Frenzy
- `assets/` — shared images + fonts
- `vercel.json` — routing (ads.txt redirect to the main site)

## Adding a game
Add a folder with its own `index.html`, drop a card/link into `index.html`, commit. Vercel auto-deploys on push to `main`.

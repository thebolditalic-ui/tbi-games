# The Trolley Problem — Build & Systems Doc

**Audience:** a Claude instance (or engineer) taking over this game. This is the top-down. It covers architecture, the animation cadence and how it's produced, the pipeline for adding/toggling rounds, image sizing, the Supabase wiring, and how the same game serves both as a standalone page and as a banner iframe.

**Canonical location:** `tbi-games/trolley_problem/TROLLEY-BUILD.md` (this file). Served at `https://games.thebolditalic.com/trolley_problem/TROLLEY-BUILD.md`. Linked from the admin dash at **Site → Games → The Trolley Problem → Build doc**. Also indexed in Claude memory as `reference_trolley_round_pipeline` (start there for the terse version).

---

## 0. TL;DR for the impatient

- Two repos, both git-backed, auto-deploy to Vercel on push to `main`:
  - **`thebolditalic-ui/tbi-games`** → `games.thebolditalic.com` (the game).
  - **`thebolditalic-ui/tbi-events-frontend`** → `admin.thebolditalic.com` (the round builder + stats).
- The game is **one big static HTML file** (`game.html` for the hub, `embed.html` for the banner iframe). No build step. All JS is inline.
- New matchups are uploaded by the user in the admin **round builder** (`/trolley-rounds`) → land in the Supabase table `trolley_pipeline` as `status='ready'`. **Claude's job** is to "ship" them: optimize the SVGs, write the death captions, generate a `rounds/batchN.js` bundle, wire it in, deploy, and flip the rows to `status='shipped'`.
- Every matchup can be **toggled on/off** from the admin; the game reads the on/off state live from an anon view and drops disabled matchups from its pool.
- To deploy: commit + push with the GitHub PAT in the connections runbook. **`git add` any NEW file** (a new `batchN.js`), because `git commit -a` won't stage it.

---

## 1. Repos, URLs, hosting

| Thing | Where |
|---|---|
| Game code | GitHub `thebolditalic-ui/tbi-games`, root dir served by Vercel |
| Game (hub, public) | `https://games.thebolditalic.com/trolley_problem/` |
| Game (embed, hidden) | `https://games.thebolditalic.com/trolley_problem/embed.html` |
| Admin round builder | `https://admin.thebolditalic.com/trolley-rounds` |
| Admin stats | `https://admin.thebolditalic.com/trolley-stats` |
| Admin repo | GitHub `thebolditalic-ui/tbi-events-frontend` |
| Supabase project | ref `scawgrjcjgcmvsimvash` |

Deploys are automatic on push to `main` (~30–40s). There is **no bundler / no framework** — the game is hand-written HTML+CSS+inline-JS. Edit the file, push, done.

Auth for pushing: a `github_pat_…` token lives in `TBI-CONNECTIONS-RUNBOOK.md` (workspace root). Push with:
`git push "https://x-access-token:${TOK}@github.com/thebolditalic-ui/tbi-games.git" HEAD:main`

**Sandbox note:** the mounted folders reject in-place git/zip writes ("Operation not permitted"). Clone into `/tmp` (native fs) and work there.

---

## 2. File layout (`tbi-games/trolley_problem/`)

- **`index.html`** — the public landing page at `/trolley_problem/`. It's a thin wrapper that `<iframe>`s `game.html?v=…` (cache-busted). Title card, share chrome, etc. live here.
- **`game.html`** (~337 KB) — the **hub game**. Music ON (`CONFIG.MUSIC_URL` points at the Supabase mp3). Has a title card. Tracks a `view` on load + a `play` on interaction.
- **`embed.html`** (~337 KB) — the **banner-embed variant**. Byte-for-byte the same game logic, but: music OFF (`MUSIC_URL:""` so the mp3 is never fetched), no title card (auto-starts on the first matchup), trimmed chrome, and a stricter play tracker. This is what gets iframed into thebolditalic.com articles by the banner system.
- **`rounds/batch1.js`, `batch2.js`, `batch3.js`** — round bundles Claude ships (see §7). Each sets `window.__TROLLEY_BATCH = {...}`.

`game.html` and `embed.html` share ~99% of their code. **When you change game mechanics, apply the edit to BOTH files** (they are not DRY — this is intentional so each is a self-contained static file). Diff them if unsure; the differences are only music/title/tracker.

---

## 3. Game data model (all inline in game.html / embed.html)

Four global structures drive everything:

```js
const ITEMS = { slug: { name:"Display Name", tag:"food", svg:S(`<inner svg>`, "0 0 200 200") }, ... }
const DEATHS = { slug: { word:"SPLAT!", color:"#hex", shake:.6, after:"the run-over line.", run(f,d,api){…} }, ... }
const MATCHUPS = [ ["slugA","slugB"], ... ]     // each item used once
const PROFILES = { tag: { e:"🕶️", t:"Profile Title", b:"blurb" }, ... }
```

- **`S(inner, viewBox="0 0 200 200")`** wraps raw inner SVG markup in a full `<svg xmlns viewBox>` string. Item art is inline SVG (no image fetches).
- **`ITEMS[slug].tag`** groups items (food / landmark / outdoors / transit / weather / nature / party / sports / people). **Every tag MUST have an entry in `PROFILES`** — the results screen does `PROFILES[topTag]` with no fallback, so an unknown tag throws. Reuse an existing tag or add a profile.
- **`DEATHS[slug]`**: `word` = the impact star-burst word; `color` = its background; `shake` = screen-shake intensity 0–1; `after` = the caption shown after the smash (the joke); `run(f,d,api)` = the bespoke destruction animation (optional — falls back to `DEATHS._default.run` on throw).
- **`MATCHUPS`** entries are 2-slug arrays. Shipped (pipeline) matchups also carry a **non-index `.pid` property** = the `trolley_pipeline.id`, used for on/off filtering (see §6). It's a property on the array, NOT a third element, because the game does `shuffle(order[idx])` on the pair and a third element would get shuffled into a card slot. `.pid` survives `.slice()`/`shuffle` at the outer level but is dropped by the inner pair `shuffle` (which only makes a throwaway copy).

The **original 10 matchups** are hard-coded inline in the file. The next 16 (batch1/2/3) are merged in at runtime from the bundles (see §5).

---

## 4. The round flow & cadence (this is the "juice")

One round = one matchup = two choices. The player saves one; the trolley flattens the other. The sequence and the timings that produce the feel:

```
startGame()          → loads batches, builds the shuffled POOL, sets the 20-round run, shows round 1
renderRound()        → draws the two .choice cards ("💛 SAVE THIS")
choose(saved,doomed) → the cinematic: rescue rises, trolley rolls in
runTrolley(onHit)    → rAF physics: approach → FREEZE at center → exit; calls onHit() at impact
destroy(doomedId)    → the smash: flash + shake + star-word + the bespoke run() + drop "remains" + caption
concludeRound(after) → shows the after-line + the live vote bar
advance()            → next round, or the results screen
```

### The impact cadence (what makes it land)
Inside `runTrolley`, the trolley eases toward center; a **slow-zone** scales the arena down and zooms in (`cinema` class) as it approaches, then a **FREEZE** (~155 ms, arena scale→0) at the exact hit frame, then it accelerates out. `destroy()` fires **on that freeze frame**:

1. `flashGo()` — a white flash wipe.
2. `shakeStage(intensity)` — screen shake (`.shake` / `.shakeBig`).
3. `starWord(word, color)` — a comic-book star-burst word ("SPLAT!", "KABOOM!") that pops then flies out.
4. `cfg.run(fighter, doomEl, api)` — the **bespoke per-item animation** (see below).
5. after ~340 ms, `api.remains(signSVG(text,color))` drops a little roadside **sign / puddle** where the victim was.
6. `concludeRound(after)` fires ~1250 ms later: the **`after` caption** (the written joke, e.g. "Guac everywhere") slides in, and the vote bar tallies.

### The little jokes & street animations
- **The nervous victim**: the doomed card has class `nervous` (a jitter) and `✖ ✖` "x-eyes" before impact.
- **Speed lines**: the trolley has `<div class="speed">` streaks + a `roll` wheel animation.
- **The bespoke `run()` per item** is where the personality lives. It's a small function using the `api`:
  - `api.sfx(name)` — crash / crack / poof / splash / zap / rumble.
  - `api.anim(el, keyframes, opts)` — Web Animations API on the victim (scale/rotate/fade out).
  - `api.burst({emojis:[…] | colors:[…], count, spread, rise, size})` — confetti/emoji particle burst.
  - `api.remains(html, label?)` — drops persistent debris: `signSVG("CRUMBS","#hex")`, `puddleSVG(c1,c2)`, `rubbleSVG`, etc.
  - `api.hide()`, `api.overlay(css,frames,opts)` — extras.
  - The **generator's default `run()`** (used for shipped items, see §7) does: sfx → scale/rotate-out anim → an emoji burst → a color-confetti burst → drop the sign/puddle. That's the standard cadence; per-item flavor comes from the emojis/colors/word/after and the sign text.
- **The written line ("after")** is the payoff. Examples of the voice: "No rice, no problem, no burrito. Guac everywhere." / "Flattened. Their last words were 'we're pre-revenue.'" / "It cracked open like a fortune cookie. Not your day." Keep them short, SF-specific, darkly comic, **no em dashes** (house style — commas/periods/parentheses only).

### Reading the votes back
`renderVote()` calls the Supabase RPC result (`voteP`) and animates a % bar ("54% of players saved it too"). Below a few votes it shows "you're one of the first to weigh in."

**To retune the feel:** the numbers to touch are in `runTrolley` (`duration`, `SLOW_ZONE`, `MIN_SCALE`, `FREEZE`) and the `setTimeout` offsets in `destroy` / the bespoke runs. Everything is time-based; there's no game loop beyond the trolley's rAF.

---

## 5. How the pool is assembled + batch loading

`startGame()` (in both files):

```
await ensureBatches(4000)                       // load rounds/batch*.js, merge into ITEMS/DEATHS/PROFILES/MATCHUPS
MATCHUPS.forEach(tag inline originals with .pid via ORIG_PIDS)
DIS = await fetchDisabled(1500)                 // which pipeline ids are switched OFF (anon read of trolley_pool)
pool = MATCHUPS.filter(m => m.pid==null || !DIS[m.pid])   // drop disabled; inline items w/o pid always stay
POOL = shuffle(pool)
order = POOL.slice(0, Math.min(20, POOL.length))          // a random 20-of-N per play
```

- **`EXTRA_BATCHES = ['rounds/batch1.js','rounds/batch2.js','rounds/batch3.js']`** — add each new bundle here.
- **Bundles load SEQUENTIALLY** (a `for … await loadBatch()` loop inside a timeout race). This is deliberate: `loadBatch` reads a single shared `window.__TROLLEY_BATCH` global, and loading in parallel (`Promise.all`) races — batch1's payload can get overwritten. Sequential = safe. The `ensureBatches(4000)` timeout is a graceful fallback: if the network is slow, it plays with whatever loaded (down to just the inline originals) rather than hanging.
- **`order = POOL.slice(0, min(20, POOL.length))`** = the game auto-loads up to **20 random pairings**. When the enabled pool is ≤20 it plays them all; when it's bigger, each play is a fresh random 20. "Keep going" (`keepGoing()`) reveals the next slice if any remain.

If you add a **batch4+**: append its file to `EXTRA_BATCHES` in both files, keep it sequential, and consider bumping the `ensureBatches(…)` timeout if the total payload grows (batch1 alone is ~175 KB gzipped).

---

## 6. Toggling matchups on/off (self-serve for the user)

Every shipped matchup is a row in `trolley_pipeline` with an `enabled` boolean, toggled from the admin round-builder's pipeline list. The game respects it **live, no re-ship needed**:

- Admin toggle → `UPDATE trolley_pipeline SET enabled=… WHERE id=…` (authenticated).
- The game reads on/off state from a **column-limited anon view**: `public.trolley_pool` = `select id, batch_id, pos, enabled from trolley_pipeline`, `GRANT SELECT … TO anon`. (The base table is authenticated-only; the view exposes only id/enabled, never the SVGs.) `fetchDisabled()` does `GET /rest/v1/trolley_pool?select=id&enabled=is.false`, 1.5 s timeout, `{}` on failure so a slow net never empties the game.
- Each shipped matchup carries `.pid` = its pipeline id, so the filter `m.pid==null || !DIS[m.pid]` drops disabled ones. A disabled matchup is still *downloaded* (it's in the batch JS) but excluded from `POOL`.

**Never run a blanket `UPDATE trolley_pipeline SET enabled=true`** — that clobbers the user's own toggles. If you must reset test toggles, restore only the ids you changed.

The **original 10** are also toggleable: they were registered as pipeline rows (`batch_id='Original 10 (baked in)'`, ids 12–21, empty `a_svg`/`b_svg` since their art is inline) and the game tags the inline matchups with those ids via `ORIG_PIDS`.

---

## 7. SHIPPING A BATCH — the exact steps (Claude's core job)

When the user says "I added N to the pipeline," they mean N rows are sitting in `trolley_pipeline` with `status='ready'`. Turn them into a playable bundle:

1. **Read the ready rows.**
   `SELECT id,pos,a_label,b_label,length(a_svg),length(b_svg) FROM trolley_pipeline WHERE status='ready'`.

2. **Pull the SVGs** (base64 to be safe through the content filter):
   `SELECT id, encode(convert_to(a_svg,'UTF8'),'base64') … WHERE status='ready'` → decode to `/tmp/svgs_raw/<id>_<side>.svg`.

3. **Optimize the SVGs** (see §8). Target 25–40 KB, ensure a `viewBox`.

4. **Assign slugs, tags, deaths, captions.** Pick short unique slugs (not colliding with existing 52). Pick a `tag` that already has a PROFILE. Write each item's death config (`word/color/shake/sfx/emojis/bcolors/after/remains`) in the voice. Build a generator like `outputs/gen_batchN.py` (copy `gen_batch2.py`): it has a `POS` map (pos→slugs), `PID` map (pos→pipeline id), `LAB` (labels), and `M` (the death dict). It emits `rounds/batchN.js` with `matchups:[["a","b",<pid>], …]` and `profiles:{}` (empty when all tags already exist), plus a `caps` list for the caption backfill.

5. **Wire it in.** Add `'rounds/batchN.js'` to `EXTRA_BATCHES` in **both** `embed.html` and `game.html`.

6. **Deploy.** `git add trolley_problem/rounds/batchN.js` (NEW file — `commit -a` skips it), commit, push with the PAT.

7. **Persist + flip status.** For each row: `UPDATE trolley_pipeline SET a_death=…, b_death=…, a_slug=…, b_slug=…, status='shipped' WHERE id=…`. (Writing `a_slug`/`b_slug` keeps the **stats page** correct — it joins `trolley_votes` by slug.)

8. **Verify live** (see §10): the game page loads, `MATCHUPS.length` grew by N, the new pair + `.pid` are present, `DEATHS[slug].run` is a function.

Single vs multiple rounds is identical — the builder lets the user save 1, up to 5, or up to 10 at a time; you ship however many are `status='ready'`.

---

## 8. Image sizing (keep the illustration intact)

Uploaded SVGs are often 50–90 KB (Adobe/Illustrator exports with high path precision). Target **25–40 KB** each so a batch doesn't bloat the iframe. Tool: `svgo` (local install `/tmp/node_modules/.bin/svgo`, NOT `-g`).

**Two configs, escalate only if needed:**

- **Default pass** (`floatPrecision:1`): `preset-default` with `removeViewBox:false` + `removeDimensions`. Try this first. Usually 40–60% smaller, visually lossless.
- **Aggressive pass** (`floatPrecision:0`) — use when the default leaves it >40 KB: `preset-default` with `convertPathData:{floatPrecision:0,transformPrecision:0}` + `cleanupNumericValues:{floatPrecision:0}` + `removeDimensions`. Integer coordinates. On a 200-unit viewBox this is sub-pixel, so the illustration stays crisp; it routinely takes 85 KB → ~17 KB. (Real example: the Drag Queens/Kings art.)

**Rules to preserve integrity:**
- Always keep the `viewBox`. `removeDimensions` strips `width`/`height`; if the source had no `viewBox`, add one from width/height **before** running svgo, or the art collapses.
- Never rasterize. If an "SVG" contains `data:image/...` (an embedded PNG/JPEG), svgo can't shrink it — the file is huge because it's a bitmap in disguise. Flag it to the user and ask for true vector art. (`grep -c 'data:image' file.svg` to check.)
- Don't over-simplify paths (don't crank `floatPrecision` negative or merge paths) — you'll lose detail. `floatPrecision:0` is the floor.
- Keep art roughly **square (1:1 to ~4:3)**. Very tall art (a Coit Tower / Transamerica) needs width-only CSS sizing hacks (`.choice[data-id="x"] .art svg{max-width:…}`) to not blow out the card; avoid tall uploads when possible.

---

## 9. Supabase wiring

Project `scawgrjcjgcmvsimvash`. Anon key is baked into the game (`CONFIG.SUPABASE_ANON_KEY`). Writes/DDL from the sandbox go through the **Management API** (`POST https://api.supabase.com/v1/projects/{ref}/database/query`, `sbp_…` token in the runbook, browser User-Agent).

| Table / fn | Purpose | Access |
|---|---|---|
| `trolley_votes` (`item_id text`, `count bigint`) | one row per item = how many times it was **saved** | RLS on; read via authed policy or the RPC |
| `vote_trolley(p_saved,p_a,p_b)` | SECURITY DEFINER RPC: increments the saved item, returns the pair's counts | anon-callable (the game uses this) |
| `game_plays` (`at,game,session_id,referrer,event`) | `view` on load, `play` on real interaction | RLS on; authed read policy |
| `reader_presence` | "reading right now" for the dashboard | — |
| `trolley_pipeline` | the round pipeline (labels, SVGs, deaths, slugs, enabled, status) | RLS `for all to authenticated` |
| `trolley_pool` (view) | id/batch_id/pos/enabled only | anon SELECT (game reads on/off) |

**Percentages** come from `trolley_votes`: for a matchup (a,b), `savesA = count[a]`, `savesB = count[b]`, `A% = savesA / (savesA+savesB)`. Each item appears in exactly one matchup, so its total count IS its saves in that matchup. The "run them both over" easter egg saves neither, so it doesn't touch either count (fine — the % is share-of-those-who-picked-a-side).

**Play/vote logging cost:** a non-engaging pageview makes **zero** Supabase calls (music off in the embed, no on-load view write in the embed, only a cheap `trolley_pool` read at start). Writes scale with engagement, not pageviews. Keep it that way.

---

## 10. Two surfaces: standalone game vs banner iframe

### As a standalone game
`games.thebolditalic.com/trolley_problem/` serves `index.html`, which iframes `game.html` (music on, title card, full chrome). Static file on Vercel's CDN.

### As a banner iframe on thebolditalic.com
The game rides the **banner system** so it can appear inside articles next to a Mediavine ad. The mechanism (all in `TBI-banner-snippet-supabase.html`, pasted into Ghost → Settings → Code Injection → **Site Footer**):

- On each article pageview the snippet fetches the active banner from Supabase (`banners` table, anon read). A **game banner** is a row with an `embed_url` (pointing at `embed.html`) instead of a `creative_url`.
- When the banner is a game, the snippet renders `<iframe class="tbi-game-embed" src=embed_url loading=lazy>` filling the slot (lazy so it's off pages the reader never scrolls to).
- **Ad adjacency:** `dockGameToAd()` waits (MutationObserver) for Mediavine to place its own in-content ad, then docks the game **right above** that committed ad, so the ad sits directly beneath the game. (Mediavine spaces ads away from a big iframe, so plain paragraph placement leaves a gap — hence the dock.)
- **Ad-free zone:** `ensureAdFreeZone()` wraps the opening N real paragraphs in `.tbi-mv-ad-free-zone` (blocklisted in the Mediavine dashboard) so no ad starts on top of the lede. Currently N=3, applied to **every** article (game pages included; the game just docks to the first ad after the buffer).
- The embed reports a distinct dashboard presence (`/trolley-embed/`, light-blue "reading now" row) and fires `game_plays 'play'` only on a real `.choice`/`.choice-both` click.

**Verification caveat:** the banner snippet renders via `requestAnimationFrame`, which is **paused in hidden/background tabs**. Chrome automation loads pages hidden, so **you cannot verify the banner render via automation** — verify on a real device. You CAN, however, fully verify the game itself by loading `embed.html`/`game.html` directly (it's a normal foreground page) and inspecting `MATCHUPS`, `POOL`, `ITEMS`, etc. in the console.

---

## 11. The admin round builder & stats (tbi-events-frontend)

- **`/trolley-rounds`** (`trolley-rounds.html`): the builder. Opens with **one** pairing row + "Add 4 more (total 5)" / "Add 9 more (total 10)" jump buttons. Each row = SVG upload + label per side. Save → inserts `status='ready'` rows into `trolley_pipeline`. Below, the **pipeline list** groups rows by batch with an on/off switch per row (writes `enabled`). The "Original 10 (baked in)" group shows label-only rows (their art is inline in the game).
- **`/trolley-stats`** (`trolley-stats.html`): reads `trolley_pipeline` (labels + slugs + enabled) joined to `trolley_votes` (by slug) → per-matchup counts + %, sorted by most votes, plus total plays/appearances. Data-driven, so new shipped batches appear automatically (as long as you wrote `a_slug`/`b_slug` at ship time).
- **Routing:** both are static pages behind `vercel.json` rewrites (`/trolley-rounds → /trolley-rounds.html`, same for stats). They're also listed in `middleware.js` `STATIC_PAGE_PATHS` — **required**, or the events middleware treats the slug-shaped path as an event and 404s it for bots/crawlers (humans still get it via the rewrite, which masks the bug). When curl-testing an admin page use a **browser User-Agent** (curl's default UA hits the bot path).
- Both pages use the shared admin shell: Supabase-js UMD, email/password login → the `authenticated` role.

---

## 12. Special mechanics already built

- **"OK, run them both over."** — on the Tech Bros vs SF Republican round only, `renderRound` adds a red `.choice-both` button (`bothOpt` flag). Click → `chooseBoth()` lines both items up on the street and `runTrolleyLine()` drives the trolley across, smacking one then the other (staggered `smack(0)`@660 ms, `smack(1)`@1590 ms), drops "NO SURVIVORS", neither saved (`voteP=null`; `renderVote` guarded against a null `curSaved`). To add more "both/neither" specials, generalize `bothOpt`.
- **Sequential batch load + `ensureBatches` timeout** — see §5.
- **Originals registered in the pipeline** so they're toggleable — see §6.

---

## 13. Gotchas checklist

- `git add` a NEW `batchN.js` before committing (`-a` won't stage new files).
- Apply mechanic edits to **both** `game.html` and `embed.html`.
- Every new `tag` needs a `PROFILES` entry.
- `.pid` is a **property on the pair array**, not a third element (the pair gets `shuffle`d).
- Don't blanket-reset `enabled` — you'll wipe the user's toggles.
- No em dashes in any player-facing copy or captions.
- Write `a_slug`/`b_slug` when shipping so the stats page can join.
- Verify the game by loading the page directly; you can't verify the banner render under automation (hidden-tab rAF).
- Load-order/timeout: bundles are sequential on purpose (shared global race).

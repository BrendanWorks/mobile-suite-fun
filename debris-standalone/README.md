# DEBRIS

A neon, asteroids-style arcade shooter. Rotate, thrust, and shoot your way through
endless waves of rocks and UFO ambushes, chasing your local high score.

This is a standalone extraction of the "Debris" mini-game from the
[rowdy_game](https://github.com/BrendanWorks/rowdy_game) party-game collection,
rebuilt as its own deployable app with a title screen, pause/mute, a power-up
system, and local high-score tracking.

## What's new versus the original mini-game

- **Standalone app** — title screen, pause menu, game-over screen with
  restart, no dependency on the parent app's auth/session system.
- **Power-ups** — rocks occasionally drop Rapid Fire, Spread Shot, Shield,
  or an Extra Life. Fly over one to collect it.
- **Parallax starfield** for depth behind the arena grid.
- **Pause** (`P` / `Esc`) and **mute** (`M`), both with on-screen buttons too.
- **Explosion sound** on every rock kill, with a small pool of voices so
  chained kills don't cut each other off.
- **Local high score**, saved in your browser via `localStorage`.
- **Rogue-lite upgrades, phase-dash, and volatile rocks** — clear a sector
  and pick one of three permanent upgrades; dash through danger with a
  brief window of invincibility; watch out for the rocks that chain-detonate
  their neighbors.
- **Installable, works offline** — see below.
- Removed a leftover debug "click here for a free life" hot zone from the
  original build.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Rotate | `←` `→` or `A` `D` | hold left/right side of the screen |
| Thrust | `↑` or `W` | hold either side (after a beat) |
| Fire | `Space` | tap, or two fingers |
| Dash | `Shift` | DASH button |
| Pause | `P` or `Esc` | pause icon |
| Mute | `M` | speaker icon |

Add `?debug=1` to the URL for an on-screen overlay of fps, frame time,
entity counts, and audio engine state — useful for chasing down performance
issues on a specific device.

## Offline & installable

The game is a Progressive Web App: after the first visit, a service worker
has everything it needs cached (code, styles, and every sound) to run with
no network connection at all. This happens automatically in the background
— nothing blocks the first play, and there's no install prompt to dismiss.

To actually install it (optional, and it works fine as a regular tab
without this):
- **iPhone (Safari)**: Share → Add to Home Screen
- **Android (Chrome)**: menu → Install app / Add to Home Screen
- **Desktop (Chrome/Edge)**: install icon in the address bar

Installed or not, once you've loaded it once, it'll keep working offline.

## Running locally

```bash
npm install
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`).

## Building for production

```bash
npm install
npm run build
```

Output goes to `dist/`. Preview it locally with `npm run preview`.

## Deploying

This is a static site — any static host works.

**Vercel**
```bash
npm i -g vercel
vercel
```
Framework preset: Vite. Build command `npm run build`, output directory `dist`.

**Netlify**
```bash
npm i -g netlify-cli
netlify deploy --build
```
Build command `npm run build`, publish directory `dist`.

**Anything else** (GitHub Pages, Cloudflare Pages, S3, nginx, etc.) — just
run `npm run build` and serve the contents of `dist/` as static files.

## Project structure

```
src/
  Game.tsx           the game engine (canvas render loop, physics, entities)
  App.tsx            screen state machine: title -> playing -> game over
  TitleScreen.tsx     title screen UI
  GameOverScreen.tsx  game-over UI
  index.css          all styling
public/sounds/       audio assets (shoot, boost, UFO, explosion, pickup, music)
```

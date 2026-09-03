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
- **Visible on-screen touch controls** on mobile instead of hidden gesture
  zones — rotate, thrust, and fire buttons you can actually see.
- Removed a leftover debug "click here for a free life" hot zone from the
  original build.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Rotate | `←` `→` or `A` `D` | left / right buttons |
| Thrust | `↑` or `W` | up button |
| Fire | `Space` | FIRE button |
| Pause | `P` or `Esc` | pause icon |
| Mute | `M` | speaker icon |

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

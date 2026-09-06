import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { insertEntry, validateSubmission, type LeaderboardEntry } from './lib/leaderboard-logic.js';

// A casual, no-auth top-10 board: three initials, a score, and enough
// context to render a row. Nothing here is meant to be tamper-proof --
// anyone who can read the network tab can forge a request. The checks
// in leaderboard-logic.ts are just enough friction to stop a trivial
// script kiddie without getting in the way of an honest player who just
// had a great run.

const RATE_LIMIT_MS = 5000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default async (req: Request, context: Context): Promise<Response> => {
  const store = getStore({ name: 'leaderboard', consistency: 'strong' });

  if (req.method === 'GET') {
    const list = (await store.get('top10', { type: 'json' })) as LeaderboardEntry[] | null;
    return json(list ?? []);
  }

  if (req.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const validated = validateSubmission((body ?? {}) as Record<string, unknown>);
  if (!validated.ok) {
    return json({ error: validated.error }, 400);
  }

  // Per-IP throttle: not airtight (IPs are shared and rotate), just enough
  // to stop a trivial tight-loop spam script. A shared IP (office wifi, a
  // mobile carrier's NAT) can trip this for two different real players in
  // quick succession -- the client retries once after a short delay to
  // keep that case invisible rather than surfacing an error for it.
  const ip = context.ip || 'unknown';
  const rateKey = `rl:${ip}`;
  const lastSubmit = await store.get(rateKey, { type: 'text' });
  const now = Date.now();
  if (lastSubmit && now - Number(lastSubmit) < RATE_LIMIT_MS) {
    return json({ error: 'submitting too fast' }, 429);
  }
  await store.set(rateKey, String(now));

  const list = ((await store.get('top10', { type: 'json' })) as LeaderboardEntry[] | null) ?? [];
  const entry: LeaderboardEntry = {
    initials: validated.initials,
    score: validated.score,
    wave: validated.wave,
    rocksDestroyed: validated.rocksDestroyed,
    ts: now,
  };
  const { list: next, rank } = insertEntry(list, entry);
  await store.setJSON('top10', next);

  return json({ list: next, rank });
};

export const config: Config = {
  path: '/api/leaderboard',
};

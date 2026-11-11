import { Cache } from './cache.js';

export const cache = new Cache();
setInterval(() => cache.sweep(), 10 * 60 * 1000).unref();

const PLAYER_TTL = 60 * 60 * 1000; // 1 hour: player data is cached, never polled
const UUID_TTL = 24 * 60 * 60 * 1000;
const BUDGET_PER_5MIN = 240; // stay under the default 300/5min limit

let windowStart = Date.now();
let used = 0;
let blockedUntil = 0;

export class ApiError extends Error {}

export function spendBudget() {
  const now = Date.now();
  if (now < blockedUntil) {
    throw new ApiError('The API is rate limited right now. Try again in a minute.');
  }
  if (now - windowStart > 5 * 60 * 1000) {
    windowStart = now;
    used = 0;
  }
  if (used >= BUDGET_PER_5MIN) {
    throw new ApiError('The bot is busy. Please try again in a few minutes.');
  }
  used++;
}

export function getUuid(name) {
  const clean = name.trim();
  if (!/^[A-Za-z0-9_]{1,16}$/.test(clean)) {
    return Promise.reject(new ApiError('That is not a valid Minecraft username.'));
  }
  return cache.wrap(`uuid:${clean.toLowerCase()}`, UUID_TTL, async () => {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${clean}`);
    if (res.status === 404 || res.status === 204) throw new ApiError(`Player "${clean}" was not found.`);
    if (!res.ok) throw new ApiError('Could not reach the Minecraft profile service.');
    const data = await res.json();
    return { uuid: data.id, name: data.name };
  });
}

export function getPlayer(uuid) {
  return cache.wrap(`player:${uuid}`, PLAYER_TTL, async () => {
    spendBudget();
    const res = await fetch(`https://api.hypixel.net/v2/player?uuid=${uuid}`, {
      headers: { 'API-Key': process.env.HYPIXEL_API_KEY },
    });
    if (res.status === 429) {
      const reset = Number(res.headers.get('retry-after') ?? res.headers.get('ratelimit-reset') ?? 60);
      blockedUntil = Date.now() + reset * 1000;
      throw new ApiError('Hypixel rate limit reached. Try again shortly.');
    }
    if (res.status === 403) throw new ApiError('The Hypixel API key is invalid or expired.');
    if (!res.ok) throw new ApiError(`Hypixel API error (${res.status}).`);
    const data = await res.json();
    if (!data.player) throw new ApiError('This player has never joined Hypixel.');
    return data.player;
  });
}

// Helpers -------------------------------------------------------------

export function networkLevel(exp = 0) {
  return 1 + (-8750 + Math.sqrt(8750 * 8750 + 5000 * exp)) / 2500;
}

export function rankOf(p) {
  if (p.rank && p.rank !== 'NORMAL') return p.rank.replace(/_/g, ' ');
  if (p.monthlyPackageRank === 'SUPERSTAR') return 'MVP++';
  const map = { MVP_PLUS: 'MVP+', MVP: 'MVP', VIP_PLUS: 'VIP+', VIP: 'VIP' };
  const pkg = p.newPackageRank ?? p.packageRank;
  return map[pkg] ?? 'Default';
}

export function discordTag(p) {
  return p.socialMedia?.links?.DISCORD ?? null;
}

export function summarize(p) {
  const bw = p.stats?.Bedwars ?? {};
  const sw = p.stats?.SkyWars ?? {};
  const ratio = (a, b) => (b ? (a / b).toFixed(2) : String(a ?? 0));
  return {
    name: p.displayname,
    rank: rankOf(p),
    level: networkLevel(p.networkExp),
    karma: p.karma ?? 0,
    achievementPoints: p.achievementPoints ?? 0,
    firstLogin: p.firstLogin ? Math.floor(p.firstLogin / 1000) : null,
    lastLogin: p.lastLogin ? Math.floor(p.lastLogin / 1000) : null,
    bedwars: {
      stars: p.achievements?.bedwars_level ?? 0,
      wins: bw.wins_bedwars ?? 0,
      fkdr: ratio(bw.final_kills_bedwars ?? 0, bw.final_deaths_bedwars ?? 0),
      wlr: ratio(bw.wins_bedwars ?? 0, bw.losses_bedwars ?? 0),
    },
    skywars: {
      wins: sw.wins ?? 0,
      kdr: ratio(sw.kills ?? 0, sw.deaths ?? 0),
    },
  };
}

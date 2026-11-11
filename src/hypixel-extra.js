import { ApiError, cache, spendBudget } from './hypixel.js';

const HOUR = 60 * 60 * 1000;

async function call(path, auth) {
  if (auth) spendBudget();
  const res = await fetch(`https://api.hypixel.net${path}`, auth ? { headers: { 'API-Key': process.env.HYPIXEL_API_KEY } } : {});
  if (res.status === 429) throw new ApiError('Hypixel rate limit reached. Try again shortly.');
  if (res.status === 403) throw new ApiError('The Hypixel API key is invalid or expired.');
  if (!res.ok) throw new ApiError(`Hypixel API error (${res.status}).`);
  return res.json();
}

export const getGuild = (uuid) =>
  cache.wrap(`guild:${uuid}`, HOUR, async () => (await call(`/v2/guild?player=${uuid}`, true)).guild ?? null);

export const getSkyblock = (uuid) =>
  cache.wrap(`sb:${uuid}`, HOUR, async () => (await call(`/v2/skyblock/profiles?uuid=${uuid}`, true)).profiles ?? []);

// Public endpoints (no key needed), cached briefly.
export const getBazaar = () =>
  cache.wrap('bazaar', 2 * 60 * 1000, async () => (await call('/v2/skyblock/bazaar', false)).products ?? {});

export const getCounts = () => cache.wrap('counts', 60 * 1000, () => call('/v2/counts', false));

// SkyBlock skill level from total XP (levels 1-50, approximate for capped skills).
const XP = [
  50, 175, 375, 675, 1175, 1925, 2925, 4425, 6425, 9925, 14925, 22425, 32425, 47425, 67425, 97425, 147425, 222425,
  322425, 522425, 822425, 1222425, 1722425, 2322425, 3022425, 3822425, 4722425, 5722425, 6822425, 8022425, 9322425,
  10722425, 12222425, 13822425, 15522425, 17322425, 19222425, 21222425, 23322425, 25522425, 27822425, 30222425,
  32722425, 35322425, 38072425, 40972425, 44072425, 47472425, 51172425, 55172425,
];

export function skillLevel(xp = 0) {
  let l = 0;
  while (l < XP.length && xp >= XP[l]) l++;
  if (l >= XP.length) return l;
  const prev = l === 0 ? 0 : XP[l - 1];
  return l + (xp - prev) / (XP[l] - prev);
}

export const SKILLS = ['FARMING', 'MINING', 'COMBAT', 'FORAGING', 'FISHING', 'ENCHANTING', 'ALCHEMY', 'TAMING'];

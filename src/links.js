import { promises as fs } from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data', 'links.json');
let links = null;

async function load() {
  if (links) return links;
  try {
    links = JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch {
    links = {};
  }
  return links;
}

export async function getLink(discordId) {
  return (await load())[discordId] ?? null;
}

export async function setLink(discordId, value) {
  const all = await load();
  all[discordId] = value;
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

export async function removeLink(discordId) {
  const all = await load();
  delete all[discordId];
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

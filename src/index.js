import 'dotenv/config';
import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { commands } from './commands.js';
import { ApiError } from './hypixel.js';

for (const k of ['DISCORD_TOKEN', 'HYPIXEL_API_KEY']) {
  if (!process.env[k]) {
    console.error(`Missing ${k} in .env`);
    process.exit(1);
  }
}

const byName = new Map(commands.map((c) => [c.data.name, c]));
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Per-user cooldown so one user cannot burn the API budget.
const lastUse = new Map();
const COOLDOWN_MS = 3000;

client.once(Events.ClientReady, (c) => console.log(`Logged in as ${c.user.tag}`));

client.on(Events.InteractionCreate, async (i) => {
  if (!i.isChatInputCommand()) return;
  const cmd = byName.get(i.commandName);
  if (!cmd) return;

  const now = Date.now();
  if (now - (lastUse.get(i.user.id) ?? 0) < COOLDOWN_MS) {
    return i.reply({ content: 'Slow down a little.', flags: MessageFlags.Ephemeral });
  }
  lastUse.set(i.user.id, now);

  await i.deferReply();
  try {
    await cmd.execute(i);
  } catch (err) {
    if (!(err instanceof ApiError)) console.error(err);
    const msg = err instanceof ApiError ? err.message : 'Something went wrong.';
    await i.editReply({ content: msg, embeds: [] });
  }
});

client.login(process.env.DISCORD_TOKEN);

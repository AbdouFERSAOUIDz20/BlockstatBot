import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { ApiError, getPlayer, getUuid } from './hypixel.js';
import { SKILLS, getBazaar, getCounts, getGuild, getSkyblock, skillLevel } from './hypixel-extra.js';
import { getLink } from './links.js';

const FOOTER = { text: 'Not affiliated with or endorsed by Hypixel. Data is cached.' };
const fmt = (n) => Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
const ratio = (a = 0, b = 0) => (b ? (a / b).toFixed(2) : String(a));

async function resolveName(i, option = 'player') {
  const name = i.options.getString(option);
  if (name) return name;
  const link = await getLink(i.user.id);
  if (!link) throw new ApiError('Give a username, or use /link first.');
  return link.name;
}

const playerOpt = (o) => o.setName('player').setDescription('Minecraft username (empty = your linked account)');

// Per-game stat readers -------------------------------------------------
const GAMES = {
  bedwars: (p) => {
    const s = p.stats?.Bedwars ?? {};
    return {
      title: 'Bed Wars',
      lines: [
        ['Stars', p.achievements?.bedwars_level ?? 0],
        ['Games', fmt(s.games_played_bedwars)],
        ['Wins / Losses', `${fmt(s.wins_bedwars)} / ${fmt(s.losses_bedwars)} (WLR ${ratio(s.wins_bedwars, s.losses_bedwars)})`],
        ['Kills / Deaths', `${fmt(s.kills_bedwars)} / ${fmt(s.deaths_bedwars)} (KDR ${ratio(s.kills_bedwars, s.deaths_bedwars)})`],
        ['Final K / D', `${fmt(s.final_kills_bedwars)} / ${fmt(s.final_deaths_bedwars)} (FKDR ${ratio(s.final_kills_bedwars, s.final_deaths_bedwars)})`],
        ['Beds broken', fmt(s.beds_broken_bedwars)],
        ['Winstreak', fmt(s.winstreak)],
      ],
    };
  },
  skywars: (p) => {
    const s = p.stats?.SkyWars ?? {};
    return {
      title: 'SkyWars',
      lines: [
        ['Wins / Losses', `${fmt(s.wins)} / ${fmt(s.losses)} (WLR ${ratio(s.wins, s.losses)})`],
        ['Kills / Deaths', `${fmt(s.kills)} / ${fmt(s.deaths)} (KDR ${ratio(s.kills, s.deaths)})`],
        ['Assists', fmt(s.assists)],
        ['Coins', fmt(s.coins)],
        ['Winstreak', fmt(s.win_streak)],
      ],
    };
  },
  duels: (p) => {
    const s = p.stats?.Duels ?? {};
    return {
      title: 'Duels',
      lines: [
        ['Wins / Losses', `${fmt(s.wins)} / ${fmt(s.losses)} (WLR ${ratio(s.wins, s.losses)})`],
        ['Kills / Deaths', `${fmt(s.kills)} / ${fmt(s.deaths)} (KDR ${ratio(s.kills, s.deaths)})`],
        ['Best winstreak', fmt(s.best_overall_winstreak)],
        ['Current winstreak', fmt(s.current_winstreak)],
      ],
    };
  },
  murder: (p) => {
    const s = p.stats?.MurderMystery ?? {};
    return {
      title: 'Murder Mystery',
      lines: [
        ['Games', fmt(s.games)],
        ['Wins', fmt(s.wins)],
        ['Murderer wins', fmt(s.murderer_wins)],
        ['Detective wins', fmt(s.detective_wins)],
        ['Kills / Deaths', `${fmt(s.kills)} / ${fmt(s.deaths)} (KDR ${ratio(s.kills, s.deaths)})`],
      ],
    };
  },
};

export const extraCommands = [
  {
    data: new SlashCommandBuilder()
      .setName('game')
      .setDescription('Detailed stats for one game mode')
      .addStringOption((o) =>
        o
          .setName('game')
          .setDescription('Game')
          .setRequired(true)
          .addChoices(
            { name: 'Bed Wars', value: 'bedwars' },
            { name: 'SkyWars', value: 'skywars' },
            { name: 'Duels', value: 'duels' },
            { name: 'Murder Mystery', value: 'murder' },
          ),
      )
      .addStringOption(playerOpt),
    async execute(i) {
      const { uuid } = await getUuid(await resolveName(i));
      const p = await getPlayer(uuid);
      const g = GAMES[i.options.getString('game')](p);
      await i.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x55ff99)
            .setTitle(`${g.title} - ${p.displayname}`)
            .setThumbnail(`https://mc-heads.net/avatar/${uuid}/128`)
            .addFields(g.lines.map(([name, value]) => ({ name, value: String(value), inline: true })))
            .setFooter(FOOTER),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder().setName('guild').setDescription("Show a player's guild").addStringOption(playerOpt),
    async execute(i) {
      const { uuid, name } = await getUuid(await resolveName(i));
      const g = await getGuild(uuid);
      if (!g) throw new ApiError(`${name} is not in a guild.`);
      const e = new EmbedBuilder()
        .setColor(0xaa66ff)
        .setTitle(`${g.name}${g.tag ? ` [${g.tag}]` : ''}`)
        .addFields(
          { name: 'Members', value: String(g.members?.length ?? 0), inline: true },
          { name: 'Guild EXP', value: fmt(g.exp), inline: true },
          { name: 'Created', value: `<t:${Math.floor(g.created / 1000)}:D>`, inline: true },
        )
        .setFooter(FOOTER);
      if (g.description) e.setDescription(g.description.slice(0, 300));
      if (g.preferredGames?.length) e.addFields({ name: 'Preferred games', value: g.preferredGames.join(', ').slice(0, 300) });
      await i.editReply({ embeds: [e] });
    },
  },
  {
    data: new SlashCommandBuilder().setName('skyblock').setDescription('SkyBlock profile summary').addStringOption(playerOpt),
    async execute(i) {
      const { uuid, name } = await getUuid(await resolveName(i));
      const profiles = await getSkyblock(uuid);
      if (!profiles.length) throw new ApiError(`${name} has no SkyBlock profiles (or their API access is off).`);
      const prof = profiles.find((p) => p.selected) ?? profiles[0];
      const m = prof.members?.[uuid] ?? {};
      const exp = m.player_data?.experience ?? {};
      const levels = SKILLS.map((s) => [s, skillLevel(exp[`SKILL_${s}`] ?? 0)]);
      const avg = levels.reduce((a, [, l]) => a + l, 0) / levels.length;
      const skills = levels.map(([s, l]) => `${s[0]}${s.slice(1).toLowerCase()}: **${l.toFixed(1)}**`).join('\n');
      await i.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xffcc33)
            .setTitle(`SkyBlock - ${name}`)
            .setThumbnail(`https://mc-heads.net/avatar/${uuid}/128`)
            .setDescription(`Profile: **${prof.cute_name}** (${prof.game_mode ?? 'classic'}) - ${profiles.length} profile(s)`)
            .addFields(
              { name: 'Skill average (approx.)', value: avg.toFixed(2), inline: true },
              { name: 'Purse', value: fmt(m.currencies?.coin_purse), inline: true },
              { name: 'Bank', value: prof.banking ? fmt(prof.banking.balance) : 'Hidden', inline: true },
              { name: 'Skills', value: skills },
            )
            .setFooter(FOOTER),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('bazaar')
      .setDescription('Look up a SkyBlock Bazaar item price')
      .addStringOption((o) => o.setName('item').setDescription('Item name, e.g. enchanted diamond').setRequired(true)),
    async execute(i) {
      const q = i.options.getString('item').trim().toUpperCase().replace(/\s+/g, '_');
      const products = await getBazaar();
      const ids = Object.keys(products);
      const exact = ids.includes(q) ? q : null;
      const matches = exact ? [exact] : ids.filter((id) => id.includes(q)).slice(0, 10);
      if (!matches.length) throw new ApiError(`No Bazaar item matches "${q}".`);
      if (!exact && matches.length > 1) {
        await i.editReply(`Multiple matches, be more specific:\n${matches.map((m) => `- \`${m}\``).join('\n')}`);
        return;
      }
      const id = matches[0];
      const s = products[id].quick_status;
      const margin = s.buyPrice - s.sellPrice;
      await i.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x33ddaa)
            .setTitle(id.replace(/_/g, ' '))
            .addFields(
              { name: 'Buy (instant)', value: fmt(s.buyPrice), inline: true },
              { name: 'Sell (instant)', value: fmt(s.sellPrice), inline: true },
              { name: 'Spread', value: `${fmt(margin)} (${ratio(margin * 100, s.sellPrice)}%)`, inline: true },
              { name: 'Buy volume (week)', value: fmt(s.buyMovingWeek), inline: true },
              { name: 'Sell volume (week)', value: fmt(s.sellMovingWeek), inline: true },
            )
            .setFooter({ text: 'Prices cached ~2 min. Not affiliated with or endorsed by Hypixel.' }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder().setName('network').setDescription('Current player counts on the network'),
    async execute(i) {
      const c = await getCounts();
      const games = Object.entries(c.games ?? {})
        .sort((a, b) => b[1].players - a[1].players)
        .slice(0, 10)
        .map(([k, v]) => `**${k.replace(/_/g, ' ')}**: ${fmt(v.players)}`)
        .join('\n');
      await i.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3399ff)
            .setTitle(`Players online: ${fmt(c.playerCount)}`)
            .setDescription(games)
            .setFooter({ text: 'Cached ~1 min. Not affiliated with or endorsed by Hypixel.' }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder().setName('skin').setDescription("Show a player's skin").addStringOption(playerOpt),
    async execute(i) {
      const { uuid, name } = await getUuid(await resolveName(i));
      await i.editReply({
        embeds: [new EmbedBuilder().setTitle(name).setImage(`https://mc-heads.net/body/${uuid}/256`).setFooter(FOOTER)],
      });
    },
  },
  {
    data: new SlashCommandBuilder().setName('help').setDescription('List all commands'),
    async execute(i) {
      await i.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('BlockStat Bot - commands')
            .setDescription(
              [
                '`/stats` overview - `/game` detailed per-game stats',
                '`/compare` two players side by side',
                '`/guild` guild info - `/skyblock` profile summary',
                '`/bazaar` item prices - `/network` players online',
                '`/skin` skin render',
                '`/link` / `/unlink` link your account (verified in-game)',
              ].join('\n'),
            )
            .setFooter(FOOTER),
        ],
      });
    },
  },
];

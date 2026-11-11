import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { extraCommands } from './extra-commands.js';
import { ApiError, discordTag, getPlayer, getUuid, summarize } from './hypixel.js';
import { getLink, removeLink, setLink } from './links.js';

const FOOTER = { text: 'Not affiliated with or endorsed by Hypixel. Data is cached for up to 1 hour.' };
const fmt = (n) => Number(n).toLocaleString('en-US');

async function load(name) {
  const { uuid } = await getUuid(name);
  const player = await getPlayer(uuid);
  return { uuid, player, s: summarize(player) };
}

function statsEmbed({ uuid, s }) {
  const e = new EmbedBuilder()
    .setColor(0x55aaff)
    .setTitle(`[${s.rank}] ${s.name}`)
    .setThumbnail(`https://mc-heads.net/avatar/${uuid}/128`)
    .addFields(
      { name: 'Network Level', value: s.level.toFixed(2), inline: true },
      { name: 'Karma', value: fmt(s.karma), inline: true },
      { name: 'Achievement Points', value: fmt(s.achievementPoints), inline: true },
      {
        name: 'Bed Wars',
        value: `Stars: ${s.bedwars.stars}\nWins: ${fmt(s.bedwars.wins)}\nFKDR: ${s.bedwars.fkdr}\nWLR: ${s.bedwars.wlr}`,
        inline: true,
      },
      {
        name: 'SkyWars',
        value: `Wins: ${fmt(s.skywars.wins)}\nK/D: ${s.skywars.kdr}`,
        inline: true,
      },
    )
    .setFooter(FOOTER);
  if (s.firstLogin) e.addFields({ name: 'First login', value: `<t:${s.firstLogin}:D>`, inline: true });
  if (s.lastLogin) e.addFields({ name: 'Last login', value: `<t:${s.lastLogin}:R>`, inline: true });
  return e;
}

const base = [
  {
    data: new SlashCommandBuilder()
      .setName('stats')
      .setDescription('Show Hypixel stats for a player')
      .addStringOption((o) => o.setName('player').setDescription('Minecraft username (leave empty for your linked account)')),
    async execute(i) {
      let name = i.options.getString('player');
      if (!name) {
        const link = await getLink(i.user.id);
        if (!link) throw new ApiError('Give a username, or use /link first.');
        name = link.name;
      }
      await i.editReply({ embeds: [statsEmbed(await load(name))] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('compare')
      .setDescription('Compare two players')
      .addStringOption((o) => o.setName('first').setDescription('First username').setRequired(true))
      .addStringOption((o) => o.setName('second').setDescription('Second username').setRequired(true)),
    async execute(i) {
      const [a, b] = await Promise.all([load(i.options.getString('first')), load(i.options.getString('second'))]);
      const row = (label, x, y) => `**${label}**: ${x}  vs  ${y}`;
      const e = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle(`${a.s.name} vs ${b.s.name}`)
        .setDescription(
          [
            row('Network Level', a.s.level.toFixed(2), b.s.level.toFixed(2)),
            row('Karma', fmt(a.s.karma), fmt(b.s.karma)),
            row('Achievement Points', fmt(a.s.achievementPoints), fmt(b.s.achievementPoints)),
            row('Bed Wars Stars', a.s.bedwars.stars, b.s.bedwars.stars),
            row('Bed Wars FKDR', a.s.bedwars.fkdr, b.s.bedwars.fkdr),
            row('Bed Wars Wins', fmt(a.s.bedwars.wins), fmt(b.s.bedwars.wins)),
            row('SkyWars Wins', fmt(a.s.skywars.wins), fmt(b.s.skywars.wins)),
            row('SkyWars K/D', a.s.skywars.kdr, b.s.skywars.kdr),
          ].join('\n'),
        )
        .setFooter(FOOTER);
      await i.editReply({ embeds: [e] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('link')
      .setDescription('Link your Minecraft account (verified through your Hypixel Discord field)')
      .addStringOption((o) => o.setName('player').setDescription('Your Minecraft username').setRequired(true)),
    async execute(i) {
      const { uuid, player } = await load(i.options.getString('player'));
      const tag = discordTag(player);
      if (!tag) {
        throw new ApiError(
          'No Discord is set on that Hypixel profile. In-game: My Profile → Social Media → Discord, set your username, then retry. (Changes can take up to an hour to show because data is cached.)',
        );
      }
      if (tag.toLowerCase().replace(/^@/, '') !== i.user.username.toLowerCase()) {
        throw new ApiError(`That profile is linked to a different Discord user (${tag}).`);
      }
      await setLink(i.user.id, { uuid, name: player.displayname });
      await i.editReply(`Linked to **${player.displayname}**. You can now use \`/stats\` without a name.`);
    },
  },
  {
    data: new SlashCommandBuilder().setName('unlink').setDescription('Remove your linked Minecraft account'),
    async execute(i) {
      await removeLink(i.user.id);
      await i.editReply('Your link was removed.');
    },
  },
  {
    data: new SlashCommandBuilder().setName('about').setDescription('About this bot'),
    async execute(i) {
      await i.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('BlockStat Bot')
            .setDescription(
              'Looks up Hypixel stats only when a user asks. No background tracking or stat history is stored. Results are cached for up to 1 hour to limit API usage.\n\nThis project is not affiliated with or endorsed by Hypixel.',
            ),
        ],
      });
    },
  },
];

export const commands = [...base, ...extraCommands];

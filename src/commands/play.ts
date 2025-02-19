import { dashboard } from '../dashboard/index.js';
import { embeds } from '../embeds/index.js';
import { isUserInBlacklist } from '../utils/functions/isUserInBlacklist.js';
import { LoadType } from '../@types/index.js';

import type { ChatInputCommandInteraction, Client, Message } from 'discord.js';
import type { Bot } from '../@types/index.js';


export const name = 'play';
export const aliases = ['p'];
export const description = 'Enter your song link or song name to play';
export const usage = 'play <URL/song name>';
export const voiceChannel = true;
export const showHelp = true;
export const sendTyping = true;
export const requireAdmin = false;
export const options = [
    {
        name: 'play',
        description: 'The song link or song name',
        type: 3,
        required: true
    }
];


export const execute = async (bot: Bot, client: Client, message: Message, args: string[]) => {
    if (!args[0]) {
        return message.reply({ content: `❌ | Write the name of the music you want to search.`, allowedMentions: { repliedUser: false } });
    }

    const str = args.join(' ');
    const res = await client.lavashark.search(str);

    if (res.loadType === LoadType.ERROR) {
        bot.logger.emit('error', bot.shardId, `Search Error: ${(res as any).data?.message}`);
        return message.reply({ content: `❌ | No results found. (${(res as any).data?.message})`, allowedMentions: { repliedUser: false } });
    }
    else if (res.loadType === LoadType.EMPTY) {
        return message.reply({ content: `❌ | No matches.`, allowedMentions: { repliedUser: false } });
    }


    const validBlackist = isUserInBlacklist(message.member?.voice.channel, bot.blacklist);
    if (validBlackist.length > 0) {
        return message.reply({
            embeds: [embeds.blacklist(bot.config.bot.embedsColor, validBlackist)],
            allowedMentions: { repliedUser: false }
        });
    }


    // Creates the audio player
    const player = client.lavashark.createPlayer({
        guildId: String(message.guild?.id),
        voiceChannelId: String(message.member?.voice.channelId),
        textChannelId: message.channel.id,
        selfDeaf: true
    });

    if (!player.setting) {
        player.setting = {
            queuePage: null,
            volume: null
        };
    }

    const curVolume = player.setting.volume ?? bot.config.bot.volume.default;

    try {
        // Connects to the voice channel
        await player.connect();
        player.metadata = message;
    } catch (error) {
        bot.logger.emit('error', bot.shardId, 'Error joining channel: ' + error);
        return message.reply({ content: `❌ | I can't join voice channel.`, allowedMentions: { repliedUser: false } });
    }

    try {
        // Intial dashboard
        if (!player.dashboard) await dashboard.initial(bot, message, player);
    } catch (error) {
        await dashboard.destroy(bot, player, bot.config.bot.embedsColor);
    }


    if (res.loadType === LoadType.PLAYLIST) {
        player.addTracks(res.tracks, (message.author as any));
    }
    else {
        const track = res.tracks[0];
        player.addTracks(track, (message.author as any));
    }

    if (!player.playing) {
        player.filters.setVolume(curVolume);
        await player.play()
            .catch(async (error) => {
                bot.logger.emit('error', bot.shardId, 'Error playing track: ' + error);
                await message.reply({ content: `❌ | The service is experiencing some problems, please try again.`, allowedMentions: { repliedUser: false } });
                return player.destroy();
            });
    }

    return message.react('👍');
};

export const slashExecute = async (bot: Bot, client: Client, interaction: ChatInputCommandInteraction) => {
    const str = interaction.options.getString('play');
    const res = await client.lavashark.search(str!);

    if (res.loadType === LoadType.ERROR) {
        bot.logger.emit('error', bot.shardId, `Search Error: ${(res as any).data?.message}`);
        return interaction.editReply({ content: `❌ | No results found. (${(res as any).data?.message})`, allowedMentions: { repliedUser: false } });
    }
    else if (res.loadType === LoadType.EMPTY) {
        return interaction.editReply({ content: `❌ | No matches.`, allowedMentions: { repliedUser: false } });
    }


    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);
    const { channel } = guildMember!.voice;

    const validBlackist = isUserInBlacklist(channel, bot.blacklist);
    if (validBlackist.length > 0) {
        return interaction.editReply({
            embeds: [embeds.blacklist(bot.config.bot.embedsColor, validBlackist)],
            allowedMentions: { repliedUser: false }
        });
    }


    // Creates the audio player
    const player = client.lavashark.createPlayer({
        guildId: String(interaction.guild?.id),
        voiceChannelId: String(channel?.id),
        textChannelId: interaction.channel?.id,
        selfDeaf: true
    });

    if (!player.setting) {
        player.setting = {
            queuePage: null,
            volume: null
        };
    }

    const curVolume = player.setting.volume ?? bot.config.bot.volume.default;

    try {
        // Connects to the voice channel
        await player.connect();
        player.metadata = interaction;
        player.filters.setVolume(curVolume);
    } catch (error) {
        bot.logger.emit('error', bot.shardId, 'Error joining channel: ' + error);
        return interaction.editReply({ content: `❌ | I can't join voice channel.`, allowedMentions: { repliedUser: false } });
    }

    try {
        // Intial dashboard
        if (!player.dashboard) await dashboard.initial(bot, interaction, player);
    } catch (error) {
        await dashboard.destroy(bot, player, bot.config.bot.embedsColor);
    }


    if (res.loadType === LoadType.PLAYLIST) {
        player.addTracks(res.tracks, (interaction.user as any));
    }
    else {
        const track = res.tracks[0];
        player.addTracks(track, (interaction.user as any));
    }

    if (!player.playing) {
        player.filters.setVolume(curVolume);
        await player.play()
            .catch(async (error) => {
                bot.logger.emit('error', bot.shardId, 'Error playing track: ' + error);
                await interaction.editReply({ content: `❌ | The service is experiencing some problems, please try again.`, allowedMentions: { repliedUser: false } });
                return player.destroy();
            });
    }

    return interaction.editReply({ content: '✅ | Music added.', allowedMentions: { repliedUser: false } });
};
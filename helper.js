const ytdl = require('ytdl-core');
const { YTSearcher } = require('ytsearcher');
const { createAudioResource, joinVoiceChannel, getVoiceConnection, createAudioPlayer, AudioPlayerStatus } = require('@discordjs/voice');
// var http = require('http'); http.createServer(function (req, res) { res.write("I'm alive"); res.end(); }).listen(8080);



// const client = new Client({
//     intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES],
//   });
const searcher = new YTSearcher(process.env.YTAPI);


const queues = new Map();

// client.on('ready', () => {
//     console.log(`Logged in as ${client.user.tag}!`);
//   let activities = [`with my balls`, `with your dad`, `with the gang` ],i = 0;
//   setInterval(
//     () => client.user.setActivity(`${activities[i++ % activities.length]}`,       
//     {type:"STREAMING",url:"https://youtu.be/rTawvzH0MQ4" }), 5000)

//     client.application.commands.create({
//         name: 'play',
//         description: 'Play a song',
//         options: [{
//           name: 'song',
//           type: 'STRING',
//           description: 'The URL or search term of the song',
//           required: true
//         }]
//       })
//       .then(console.log)
//       .catch(console.error);
//       client.application.commands.create({
//         name: 'stop',
//         description: 'Stop the music',
//       })
//       .then(console.log)
//       .catch(console.error);
//       client.application.commands.create({
//         name: 'queue',
//         description: 'Show the queue of songs',
//       })
//       .then(console.log)
//       .catch(console.error);
//       client.application.commands.create({
//         name: 'skip',
//         description: 'Skip to the next song',
//       })
//       .then(console.log)
//       .catch(console.error);
//   });

async function commands(interaction, discord_api) {
    const serverQueue = queues.get(interaction.guild_id);
    if (interaction.data.name === 'play') {
        const searchString = interaction.data.options.find(option => option.name === 'song').value
        const videoResult = await searcher.search(searchString, { type: 'video' });
        const song = { title: videoResult.first.title, url: videoResult.first.url };
        const guildId = interaction.guild_id;
        const userId = interaction.member.user.id;
        
        // Get the guild object
        const guild = await discord_api.get(`/guilds/${guildId}`).data;
        
        // Get the member object for the user
        const member = await discord_api.get(`/guilds/${guildId}/members/${userId}`).data;
        
        // Get the voice state of the member
        console.log(guild.voiceState)
        const voiceState = guild.voiceStates.find(vs => vs.user_id === member.user.id);
        
        // Get the voice channel of the member, if any
        const voiceChannel = voiceState?.channel_id;
        if (!serverQueue) {
            const queue = {
                textChannel: interaction.channel,
                voiceChannel: voiceChannel,
                connection: null,
                songs: [],
                playing: true,
            };
            queues.set(interaction.guild_id, queue);
            queue.songs.push(song);
            await interaction.reply(`**${song.title}** has been added to the queue!`);
            try {
                const connection = getVoiceConnection(interaction.guild_id);
                if (!connection) {
                    if (!voiceChannel) {
                        return interaction.reply('You need to be in a voice channel to play music');
                    }

                    const player = joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: voiceChannel.guild_id,
                        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                    });
                    queue.connection = player;
                }
                await playSong(interaction, queue.songs[0]);
            } catch (error) {
                console.error(error);
                queues.delete(interaction.guild_id);
                await interaction.reply('There was an error connecting to the voice channel!');
            }
        } else {
            serverQueue.songs.push(song);
            await interaction.reply(`**${song.title}** has been added to the queue!`);
        }
    } else if (interaction.data.name === 'stop') {
        if (serverQueue) {
            serverQueue.songs = [];
            serverQueue.connection.destroy();
            serverQueue.player.stop();
            await interaction.reply('Music stopped!');
        } else {
            await interaction.reply('There is nothing playing.');
        }
    } else if (interaction.data.name === 'skip') {
        if (serverQueue && serverQueue.connection) {
            console.log(serverQueue)
            serverQueue.songs.shift();
            playSong(interaction, serverQueue.songs[0]);
            await interaction.reply('Skipped the current song!');
        } else {
            serverQueue.connection.destroy();
            queue.player.stop();
            await interaction.reply('There is nothing playing.');
        }
    } else if (interaction.data.name === 'queue') {
        if (serverQueue && serverQueue.songs.length > 0) {
            const queue = serverQueue.songs.map((song, index) => `${index + 1}. **${song.title}**`);
            await interaction.reply(`__**Song Queue:**__\n${queue.join('\n')}`);
        } else {
            await interaction.reply('There are no songs in the queue.');
        }
    }
}



async function playSong(interaction, song) {

    const queue = queues.get(interaction.guild_id);
    console.log(song)
    if (!song) {
        queue.connection.destroy();
        queue.player.stop();
        queues.delete(interaction.guild_id);
        return;
    }
    const stream = ytdl(song.url, { filter: 'audioonly' });

    const audioResource = createAudioResource(stream);
    const audioPlayer = createAudioPlayer();
    queue.player = audioPlayer;
    queue.connection.subscribe(audioPlayer);

    console.log(queue.player)
    queue.player.play(audioResource);
    queue.player.on('error', (error) => {
        console.error(error);
        queue.songs.shift();
        playSong(interaction, queue.songs[0]);
    });
    queue.player
        .on(AudioPlayerStatus.Idle, () => {
            queue.songs.shift();
            playSong(interaction, queue.songs[0]);
        })
}



module.exports = {
    commands
}

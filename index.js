const { Client, Intents } = require('discord.js');
const ytdl = require('ytdl-core');
const { YTSearcher } = require('ytsearcher');
require('dotenv').config({path: __dirname + '/.env'})
const { createAudioResource, joinVoiceChannel, getVoiceConnection, createAudioPlayer } = require('@discordjs/voice');
// const { clientId, guildId, token, publicKey } = require('./config.json');
require('dotenv').config()
const helper = require('./helper')
const APPLICATION_ID = process.env.APPLICATION_ID 
const TOKEN = process.env.TOKEN 
const PUBLIC_KEY = process.env.PUBLIC_KEY || 'not set'

const axios = require('axios');
const express = require('express');
const { InteractionType, InteractionResponseType, verifyKeyMiddleware } = require('discord-interactions');


const app = express();
// app.use(bodyParser.json());

const discord_api = axios.create({
  baseURL: 'https://discord.com/api/v10',
  timeout: 3000,
  headers: {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
	"Access-Control-Allow-Headers": "Authorization",
	"Authorization": `Bot ${TOKEN}`
  }
});

app.post('/interactions', verifyKeyMiddleware(PUBLIC_KEY), async (req, res) => {
  const interaction = req.body;
  console.log(interaction)
  // const serverQueue = queues.get(interaction.guild_id);

  // if (interaction.type === InteractionType.APPLICATION_COMMAND) {
  //   console.log(interaction.data.name)
  //   if(interaction.data.name == 'yo'){
  //     return res.send({
  //       type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
  //       data: {
  //         content: `Yo ${interaction.member.user.username}!`,
  //       },
  //     });
  //   }

  //   if(interaction.data.name == 'dm'){
  //     // https://discord.com/developers/docs/resources/user#create-dm
  //     let c = (await discord_api.post(`/users/@me/channels`,{
  //       recipient_id: interaction.member.user.id
  //     })).data
  //     try{
  //       // https://discord.com/developers/docs/resources/channel#create-message
  //       let res = await discord_api.post(`/channels/${c.id}/messages`,{
  //         content:'Yo! I got your slash command. I am not able to respond to DMs just slash commands.',
  //       })
  //       console.log(res.data)
  //     }catch(e){
  //       console.log(e)
  //     }

  //     return res.send({
  //       // https://discord.com/developers/docs/interactions/receiving-and-responding#responding-to-an-interaction
  //       type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
  //       data:{
  //         content:'👍'
  //       }
  //     });
  //   }
  //   if (interaction.data.name == 'play'){

  //     helper.commands(interaction, discord_api)
  //   }
  // }

});



const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES],
});
const searcher = new YTSearcher(process.env.YTAPI);


const queues = new Map();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.application.commands.create({
      name: 'play',
      description: 'Play a song',
      options: [{
        name: 'song',
        type: 'STRING',
        description: 'The URL or search term of the song',
        required: true
      }]
    })
    .then(console.log)
    .catch(console.error);
    client.application.commands.create({
      name: 'stop',
      description: 'Stop the music',
    })
    .then(console.log)
    .catch(console.error);
    client.application.commands.create({
      name: 'queue',
      description: 'Show the queue of songs',
    })
    .then(console.log)
    .catch(console.error);
    client.application.commands.create({
      name: 'skip',
      description: 'Skip to the next song',
    })
    .then(console.log)
    .catch(console.error);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const serverQueue = queues.get(interaction.guild.id);
  if (interaction.commandName === 'play') {
    const searchString = interaction.options.getString('song');
    const videoResult = await searcher.search(searchString, { type: 'video' });
    const song = { title: videoResult.first.title, url: videoResult.first.url };
    if (!serverQueue) {
      const queue = {
        textChannel: interaction.channel,
        voiceChannel: interaction.member.voice.channel,
        connection: null,
        songs: [],
        playing: true,
      };
      queues.set(interaction.guild.id, queue);
      queue.songs.push(song);
      try {
          const connection = getVoiceConnection(interaction.guildId);
          if (!connection) {
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
              return interaction.reply('You need to be in a voice channel to play music');
            }
        
            const player = joinVoiceChannel({
              channelId: voiceChannel.id,
              guildId: voiceChannel.guild.id,
              adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });
            queue.connection = player;
          }
        await playSong(interaction, queue.songs[0]);
      } catch (error) {
        console.error(error);
        queues.delete(interaction.guild.id);
        await interaction.reply('There was an error connecting to the voice channel!');
      }
  } else {
      serverQueue.songs.push(song);
      await interaction.reply(`**${song.title}** has been added to the queue!`);
    }
  } else if (interaction.commandName === 'stop') {
    if (serverQueue) {
      serverQueue.songs = [];
      serverQueue.connection.destroy();
      await interaction.reply('Music stopped!');
    } else {
      await interaction.reply('There is nothing playing.');
    }
  } else if (interaction.commandName === 'skip') {
    if (serverQueue && serverQueue.connection) {
      console.log(serverQueue)
      serverQueue.songs.shift();
      playSong(interaction, serverQueue.songs[0]);
      await interaction.reply('Skipped the current song!');
    } else {
      serverQueue.connection.destroy();
      await interaction.reply('There is nothing playing.');
    }
  } else if (interaction.commandName === 'queue') {
    if (serverQueue && serverQueue.songs.length > 0) {
      const queue = serverQueue.songs.map((song, index) => `${index + 1}. **${song.title}**`);
      await interaction.reply(`__**Song Queue:**__\n${queue.join('\n')}`);
    } else {
      await interaction.reply('There are no songs in the queue.');
    }
  }
});



async function playSong(interaction, song) {

  const queue = queues.get(interaction.guildId);
  if (!song) {
    queue.voiceChannel.leave();
    queues.delete(interaction.guild.id);
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
    .on('finish', () => {
      queue.songs.shift();
      playSong(interaction, queue.songs[0]);
    })
}


async function handleQueue(interaction, queue) {
  const serverQueue = queues.get(interaction.guild.id);
  if (!queue) {
    await serverQueue.voiceChannel.leave();
    queues.delete(interaction.guild.id);
    return;
  }
  serverQueue.songs.push(queue);
  await interaction.reply(`**${queue.title}** has been added to the queue!`);
  if (!serverQueue.playing) {
    serverQueue.playing = true;
    await playSong(interaction, serverQueue.songs[0]);
  }
}
client.login(TOKEN);


app.get('/r', async (req, res) =>{
  let slash_commands = [
    {
      "name": "play",
      "description": "Play a song",
      "options": [{
        "name": "song",
        "type": "STRING",
        "description": "The URL or search term of the song",
        "required": "true"
      }]
    },
    {
      "name": "stop",
      "description": "Stop the music",
      "options": []
    },
    {
      "name": "queue",
      "description": "Show the queue of songs",
      "options": []
    },
    {
      "name": "skip",
      "description": "Skip to the next song",
      "options": []
    }
  ]
  try{
    discordResponse = discord_api.post(`/applications/${APPLICATION_ID}/commands`, json=slash_commands)
    return res.send(`Registered Commands`)
  }catch(e){
    console.error(e.code)
    console.error(e.response?.data)
    return res.send(`${e.code} error from discord`)
  }
    
})


app.get('/', async (req,res) =>{
  return res.send('Follow documentation ')
})


app.listen(8999, () => {

})


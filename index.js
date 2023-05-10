
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

const queues = new Map();


app.post('/interactions', verifyKeyMiddleware(PUBLIC_KEY), async (req, res) => {
  const interaction = req.body;
  const serverQueue = queues.get(interaction.guildId);

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    console.log(interaction.data.name)
    if(interaction.data.name == 'yo'){
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Yo ${interaction.member.user.username}!`,
        },
      });
    }

    if(interaction.data.name == 'dm'){
      // https://discord.com/developers/docs/resources/user#create-dm
      let c = (await discord_api.post(`/users/@me/channels`,{
        recipient_id: interaction.member.user.id
      })).data
      try{
        // https://discord.com/developers/docs/resources/channel#create-message
        let res = await discord_api.post(`/channels/${c.id}/messages`,{
          content:'Yo! I got your slash command. I am not able to respond to DMs just slash commands.',
        })
        console.log(res.data)
      }catch(e){
        console.log(e)
      }

      return res.send({
        // https://discord.com/developers/docs/interactions/receiving-and-responding#responding-to-an-interaction
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data:{
          content:'👍'
        }
      });
    }
    if (interaction.data.name == 'play'){
      // const searchString = interaction.data.options.find(option => option.name === 'song').value
      // console.log(searchString)

      // const videoResult = await searcher.search(searchString, { type: 'video' });
      // const song = { title: videoResult.first.title, url: videoResult.first.url };
      // if(!serverQueue)
      helper.commands(interaction)
    }
  }

});


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


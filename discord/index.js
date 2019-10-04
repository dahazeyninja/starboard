const config = require('../config.json');

const Discord = require('discord.js');
const client = new Discord.Client();

const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('database.db');

const starboard = require('./starboard');

client.on('ready', () => {
	console.log('[Discord Bot] Ready!');
	client.user.setActivity('for stars', {type: 'WATCHING'});
});

client.on('messageReactionAdd', (reaction, user) => {
	// console.log(`${user.username} reacted with "${reaction.emoji.name}".`);
	starboard(db, reaction, user, 'add');
	// MESSAGE_REACTION_ADD
});

client.on('messageReactionRemove', (reaction, user) => {
	// console.log(`${user.username} removed their "${reaction.emoji.name}" reaction.`);
	starboard(db, reaction, user, 'remove');
	// MESSAGE_REACTION_REMOVE
});
client.on('messageReactionRemoveAll', (reaction, user) => {
	// console.log(`${user.username} removed ALL "${reaction.emoji.name}" reactions.`);
	starboard(db, reaction, user, 'removeall');
	// MESSAGE_REACTION_REMOVE_ALL
});

const events = {
	MESSAGE_REACTION_ADD: 'messageReactionAdd',
	MESSAGE_REACTION_REMOVE: 'messageReactionRemove',
	MESSAGE_REACTION_REMOVE_ALL: 'messageReactionRemoveAll'
};

// This is here because discord does not send full reaction events when a message is not cached (I think)
// This takes the partial raw event and then builds/caches/emits the full one for use
client.on('raw', async function(event) {
	if (!events.hasOwnProperty(event.t)) {
		return;
	}

	// console.log(event.t);
	const {d: data} = event;
	const user = client.users.get(data.user_id);
	const channel = client.channels.get(data.channel_id);

	if (channel.messages.has(data.message_id)) {
		// console.log('channel already has message');

		return;
	}

	const message = await channel.fetchMessage(data.message_id);
	
	const emojiKey = (data.emoji.id) ? `${data.emoji.name}:${data.emoji.id}` : data.emoji.name;
	let reaction = message.reactions.get(emojiKey);

	if (!reaction) {
		// Create an object that can be passed through the event like normal
		const emoji = new Discord.Emoji(client.guilds.get(data.guild_id), data.emoji);

		reaction = new Discord.MessageReaction(message, emoji, 0, data.user_id === client.user.id);
	}

	await reaction.fetchUsers();

	client.emit(events[event.t], reaction, user);

});

client.on('error', (error) => {
	console.error(error);
});

client.login(config.token);

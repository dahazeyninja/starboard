const config = require('../../config.json');
var db;

module.exports = function(database, messageReaction, user, type){
	db = database;

	switch(type){
	case 'add':
		reactionAdd(messageReaction, user);
		break;
	case 'remove':
		reactionRemove(messageReaction, user);
		break;
	case 'removeAll':
		break;
	default:
	}

};

async function reactionAdd(messageReaction, user){
	const {count, emoji, message, users} = messageReaction;

	// console.log(messageReaction);
	if (message.channel.type !== 'text' || emoji.name !== '⭐'){
		return;
	}

	if (user.id === message.author.id && !config.self_star){
		messageReaction.remove(user);
		return;
	}

	if (count < config.threshold) {
		return;
	}

	const {channel, guild} = message;
	let starboard;

	if(channel.nsfw){
		starboard = await getNSFWStarboardChannel(guild);
		if (!starboard.nsfw){
			console.log('NSFW Starboard channel is not an NSFW channel');

			return;
		}
	} else {
		starboard = await getStarboardChannel(guild);
	}

	if(!starboard || channel.id === starboard.id){
		console.log('no starboard or starboard same as message channel');

		return;
	}


	const starId = await getMessageFromDatabase(message.id);

	if (starId){
		const starMessage = await starboard.fetchMessage(starId);

		if (starMessage){
			starMessage.edit(`${count} ⭐ - <#${channel.id}> ${message.url}`);
		}
	} else {
		const starMessage = await starboard.send(`${count} ⭐ - <#${channel.id}> ${message.url}`, {embed: createEmbed(message)});

		db.run('INSERT INTO starboard (msgid,starid) VALUES (?,?);', [message.id, starMessage.id], function(err){
			if(err && err.message === 'SQLITE_CONSTRAINT: UNIQUE constraint failed: starboard.msgid'){
				starMessage.delete();
				reactionAdd(messageReaction, user);
			} else if (err){
				console.log(err);
			}
		});
	}
}

async function reactionRemove(messageReaction, user){
	const {count, emoji, message, users} = messageReaction;

	// return console.log(messageReaction);
	if (message.channel.type !== 'text' || emoji.name !== '⭐'){
		return;
	}

	if (user.id === message.author.id && !config.self_star){
		return;
	}

	const {channel, guild} = message;
	let starboard;

	if(channel.nsfw){
		starboard = await getNSFWStarboardChannel(guild);
	} else {
		starboard = await getStarboardChannel(guild);
	}

	if(!starboard || channel.id === starboard.id){
		return;
	}


	const starId = await getMessageFromDatabase(message.id);

	if (starId){
		const starMessage = await starboard.fetchMessage(starId);

		if(!starMessage){
			return;
		}

		if (count >= config.threshold){
			starMessage.edit(`${count} ⭐ - <#${channel.id}> ${message.url}`);
		} else if (count < config.threshold || count === 0) {
			starMessage.delete();
			db.run('DELETE FROM starboard WHERE starid = ?;', [starMessage.id]);
		}
	}
}

function getMessageFromDatabase(msgid){
	return new Promise((resolve) => {
		db.get('SELECT * FROM starboard WHERE msgid = ?', msgid, (err, row) => {
			if(err){
				console.error(err);
			}
			if (row){
				resolve(row.starid);
			} else {
				resolve(null);
			}
		});
	});
}

function getStarboardChannel(guild){
	return new Promise((resolve) => {
		if (config.channel){
			resolve(guild.channels.find((c) => c.name.toLowerCase() === config.channel));
		} else {
			resolve(guild.channels.find((c) => c.name.toLowerCase() === 'starboard'));
		}
	});
}

function getNSFWStarboardChannel(guild){
	return new Promise((resolve) => {
		if (config.nsfw_channel){
			resolve(guild.channels.find((c) => c.name.toLowerCase() === config.nsfw_channel));
		} else {
			resolve(null);
		}
	});
}

function createEmbed(message){
	if(message.embeds.length > 0 && message.embeds[0].type === 'rich' && message.embeds[0].url.includes('twitter.com')){
		const [embed] = message.embeds;
		const fields = [];

		fields.push({
			name: `Tweet from ${embed.author.name}`,
			value: embed.description
		});

		const richEmbed = {
			color: 0xaa98ae,
			author: {
				name: `${message.author.username}#${message.author.discriminator}`,
				icon_url: message.author.avatarURL
			},
			description: message.content,
			thumbnail: {
				url: embed.author.iconURL
			},
			timestamp: Date.now(),
			footer: {
				icon_url: embed.footer.proxyIconUrl,
				text: embed.footer.text

			}
		};

		if (embed.image){
			richEmbed.image = {
				url: embed.image.proxyURL
			};
		}

		if(embed.fields[0]){
			embed.fields.forEach((field) => {
				fields.push({
					name: field.name,
					value: field.value,
					inline: field.inline
				});
			});
		}

		richEmbed.fields = fields;

		return richEmbed;
	}
	const richEmbed = {
		color: 0xaa98ae,
		author: {
			name: `${message.author.username}#${message.author.discriminator}`,
			icon_url: message.author.avatarURL
		},
		description: message.content,
		timestamp: Date.now(),
		image: resolveAttachment(message)
	};

	return richEmbed;

}

function resolveAttachment(message) {
	const attachments = message.attachments.array();

	if (attachments.length > 0 && attachments[0].width) {
		return {url: attachments[0].url};
	} else if (message.embeds.length > 0 && message.embeds[0].type === 'image') {
		return message.embeds[0].image || message.embeds[0].thumbnail;
	}

	return null;
}

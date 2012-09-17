var Channel = require('./Channel.js').Channel;

channels = [];

exports.Client = function (socket) {
	this.socket = socket;
	this._buffer = '';

	this.hasRegistered = false;
	this.hasQuit = false;

	this.ipAddress = false;
	this.hostname = false;
	this.username = false;
	this.realname = false;
	this.nickname = false;

	this.channels = [];

	this.sendMessage = function (data) {
		console.log(data);
		var message = '';
		for (var i = 0; i < data.length; i++) {
			message += (data[i].toString().indexOf(' ') >= 0 && data[i].substr(0,1) != ':' ? ':' : '') + data[i] + (i + 1 < data.length ? ' ' : '');
		}
		this.socket.write(message + "\n");
	}

	this.buffer = function (data) {
		this._buffer += data.replace(/\r/g,"\n").replace(/\n\n/g,"\n");
		while (this._buffer.indexOf("\n") >= 0) {
			var eol = this._buffer.indexOf("\n");
			this.parse(this._buffer.substr(0,eol));
			this._buffer = this._buffer.substr(eol + 1);
		}
	}

	this.parse = function (message) {
		var data = [];
		var temp = message.toString().split(' ');
		for (var i = 0; i < temp.length; i++) {
			if (temp[i].substr(0,1) != ':') {
				data.push(temp[i]);
			} else {
				data.push(temp[i].substr(1) + (temp.length > i + 1 ? ' ' + temp.slice(i + 1).join(' ') : ''));
				break;
			}
		}
		console.log(data);

		// TODO: Argument count and command existence validation.

		switch (data[0]) {
			case 'USER'	: ircUser	(this,data); break;
			case 'NICK'	: ircNick	(this,data); break;
		}

		if (this.username && this.nickname) {
			if (!this.hasRegistered) {
				this.sendMessage([
					':' + config.serverAddress,
					'001',
					this.nickname,
					'Welcome to ' + config.serverAddress + '!'
				]);
				this.hasRegistered = true;
			}
		} else {
			// TODO: Numeric for not registered.
			return;
		}

		switch (data[0]) {
			case 'JOIN'		: ircJoin		(this,data); break;
			case 'TOPIC'	: ircTopic		(this,data); break;
			case 'NAMES'	: ircNames		(this,data); break;
			case 'PRIVMSG'	: ircPrivmsg	(this,data); break;
			case 'PART'		: ircPart		(this,data); break;
			case 'QUIT'		: ircQuit		(this,data); break;
		}
	}

	this.quit = function (reason) {
		if (this.hasQuit) { return; } this.hasQuit = true;

		for (var i = 0; i < this.channels.length; i++) {
			this.channels[i].sendMessage([
				':' + this.getHostmask(),
				'QUIT',
				reason
			]);
			var newUsers = []; // TODO: Get rid of this loop with Array.filter();
			for (var j = 0; j < this.channels[i].users.length; j++) {
				if (this.channels[i].users[j].nickname != this.nickname) {
					newUsers.push(this.channels[i].users[j]);
				}
			}
			this.channels[i].users = newUsers;
		}
		this.socket.end();
		this.socket.destroy();
	}

	this.setNickname = function (nickname) {
		// TODO: Validation!
		// TODO: Broadcast if in any channels.
		// TODO: Tell the user it succeeded if he's registered and it did indeed succeed.
		for (var i = 0; i < clients.length; i++) {
			if (clients[i].nickname == nickname) {
				// TODO: Numeric.
				return;
			}
		}
		if (this.nickname && this.username) {
			this.sendMessage([
				':' + this.getHostmask(),
				'NICK',
				nickname
			]);
			var client = this;
			this.channels.map(function (ch) { ch.sendMessage([
				':' + client.getHostmask(),
				'NICK',
				nickname
			],client); });
		}
		this.nickname = nickname;
	}

	this.getHostmask = function () {
		return this.nickname + '!' + this.username + '@' + this.hostname;
	}
}

function ircUser(self,data) {
	// TODO: Validation!
	self.username = data[1];
	self.realname = data[4];
}
function ircNick(self,data) {
	self.setNickname(data[1]);
}
function ircJoin(self,data) {
	if (data[1].substr(0,1) != '#' && data[1].substr(0,1) != '&') {
		// TODO: Numeric.
		return;
	}

	var channel;
	channels.map(function (ch) { if (ch.name == data[1]) { channel = ch; return; } });
	if (!channel) {
		channel = new Channel(data[1]);
		channels.push(channel);
		channel.topic = 'This IRC server is currently under development.';
		channel.topicSetter = config.serverAddress;
		channel.modes.o = [];
		channel.modes.o.push(self.nickname);
	}

	for (var i = 0; i < channel.users.length; i++) {
		if (self.nickname == channel.users[i].nickname) {
			// TODO: Numeric.
			return;
		}
	}

	channel.users.push(self);
	self.channels.push(channel);

	channel.sendMessage([
		':' + self.getHostmask(),
		'JOIN',
		data[1]
	]);

	ircTopic(self,data);
	ircNames(self,data);
}
function ircTopic(self,data) {
	var channel;
	channels.map(function (ch) { if (ch.name == data[1]) { channel = ch; return; } });

	if (!channel) {
		// TODO: Numeric.
		return;
	}

	if (channel.topicSetter) {
		self.sendMessage([
			':' + config.serverAddress,
			'332',
			self.nickname,
			data[1],
			':' + channel.topic
		]);
		self.sendMessage([
			':' + config.serverAddress,
			'333',
			self.nickname,
			data[1],
			channel.topicSetter,
			channel.topicTS
		]);
	} else {
		// TODO: Channel has no topic. Send numeric?
	}
}
function ircNames(self,data) {
	var channel;
	channels.map(function (ch) { if (ch.name == data[1]) { channel = ch; return; } });

	if (!channel) {
		// TODO: Numeric.
		return;
	}

	var prefixes = {};
	for (var mode in channel.modes) {
		prefixes[mode] = [];
		for (var i = 0; i < channel.modes[mode].length; i++) {
			prefixes[channel.modes[mode][i]] = config.prefixes[mode];
		}
	}

	var names = '';
	channel.users.map(function (client) {
		names += ' ' + (prefixes[client.nickname] ? prefixes[client.nickname] : '') + client.nickname;
	});
	names = names.substr(1);
	self.sendMessage([
		':' + config.serverAddress,
		'353',
		self.nickname,
		'=',
		data[1],
		names
	]);
	self.sendMessage([
		':' + config.serverAddress,
		'366',
		self.nickname,
		data[1],
		'End of /NAMES list.'
	]);
}
function ircPrivmsg(self,data) {
	var target;
	if (data[1].substr(0,1) == '#' || data[1].substr(0,1) == '&') {
		channels.map(function (ch) { if (ch.name == data[1]) { target = ch; return; } });
	} else {
		clients.map(function (client) { if (client.nickname == data[1]) { target = client; return; } });
	}
	if (target) {
		target.sendMessage([
			':' + self.getHostmask(),
			'PRIVMSG',
			data[1],
			':' + data[2]
		],self);
	} else {
		// TODO: Numeric.
	}
}
function ircPart(self,data) {
	var newChannels = [];
	for (var i = 0; i < self.channels.length; i++) {
		if (self.channels[i].name == data[1]) {
			self.channels[i].sendMessage([
				':' + self.getHostmask(),
				'PART',
				data[1],
				(data[2] ? ':' + data[2] : '')
			]);
			var newUsers = [];
			for (var j = 0; j < self.channels[i].users.length; j++) {
				if (self.channels[i].users[j].nickname != self.nickname) {
					newUsers.push(self.channels[i].users[j]);
				}
			}
			self.channels[i].users = newUsers;
		} else {
			newChannels.push(self.channels[i]);
		}
	}
	self.channels = newChannels;
}
function ircQuit(self,data) {
	self.quit('Quit: ' + data[1]);
}

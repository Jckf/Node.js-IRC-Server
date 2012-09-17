exports.Channel = function (name) {
	this.name = name;
	this.modes = {
		'n':true,
		't':true
	};
	this.users = [];
	this.topic = '';
	this.topicTS = Math.round(new Date().getTime() / 1000);
	this.topicSetter = false;

	this.sendMessage = function (data,source) {
		for (var i = 0; i < this.users.length; i++) {
			if (!source || source != this.users[i]) {
				this.users[i].sendMessage(data);
			}
		}
	}
}

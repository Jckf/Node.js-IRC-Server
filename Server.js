var net = require('net');
var dns = require('dns');
var Client = require('./Client.js').Client;

clients = [];
config = {
	'serverAddress':'node.js',
	'prefixes':{
		'o':'@'
	}
};

var server = net.createServer(function (socket) {
	var client = new Client(socket);

	socket.on('data',clientDataRef(client));
	socket.on('close',clientOutRef(client));

	client.ipAddress = socket.remoteAddress;
	dns.reverse(client.ipAddress,function (error,result) { // TODO: DNS lookups might be slow and break things.
		if (error) {
			client.hostname = client.ipAddress;
		} else {
			client.hostname = result[0];
		}
	});

	clients.push(client);
});
server.listen(6667);

function clientDataRef(client) {
	return function (message) {
		client.buffer(message.toString());
	}
}
function clientOutRef(client) {
	return function (error) {
		client.quit('Poof!');
		clients = clients.splice(clients.indexOf(client),1);
	}
}

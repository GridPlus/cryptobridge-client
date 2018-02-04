// Start your server and connect to peers
const net = require('net');
const server = require('./src/server.js');
const peers = require('./src/peers.js');

// This is the server that peers will connect to and message
const s = server.createServer(8000);

// Connect to known peers
peers.connectToKnownPeers((err, p) => {
  console.log('connected to', p ? p.length : 0, 'peers')
  const obj = { type: 'SIGREQ' }
  p[0].send('thing', new Buffer(JSON.stringify(obj), 'utf8'))
});

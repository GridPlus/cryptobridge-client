// Create a server object

const net = require('net');

exports.createServer = function(port=3001, options={}) {
  const server = net.createServer((socket) => {
    socket.on('end', () => {
      console.log('client disconnected');
    });
    socket.on('data', (data) => { handleMsg(data) });
  });
  server.on('error', (err) => {
    throw err;
  });
  server.listen(port, () => {
    console.log('server bound');
  });
  return server;
}

// Main control function
function handleMsg(data) {
  const msg = JSON.parse(data.toString('utf8'));
  console.log('this', this)
  switch (msg.type) {
    case 'SIGREQ':
      console.log('signature request', msg);
      break;
    case 'SIGPASS':
      console.log('passing signature', msg);
      // signatures.saveSig()
      break;
    case 'PROP':
      console.log('new proposer', msg);
      break;
    case 'PEERSREQ':
      console.log('someone asking for peers list', msg);
      break;
    default:
      console.log('got ping', msg);
      break;
  }
}

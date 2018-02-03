// Create a server object

const net = require('net');

exports.createServer = function(port=3001, options={}) {
  const server = net.createServer((c) => {
    c.on('end', () => {
      console.log('client disconnected');
    });
    c.pipe(c);
  });
  server.on('error', (err) => {
    throw err;
  });
  server.on('message', (msg) => {
    switch (msg.type) {
      case 'SIGREQ':
        console.log('signature request', msg);
        break;
      case 'SIGPASS':
        console.log('passing signature', msg);
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
  })
  
  server.listen(port, () => {
    console.log('server bound');
  });
  return server;
}

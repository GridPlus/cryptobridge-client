const net = require('net');

// Run a bridge client. This has a set of peers and two web3 clients corresponding
// to a particular bridge, which corresponds to two specific networks.
class Bridge {
  constructor(opts) {
    if (!opts) { opts = {}; }
    this.port = opts.port || 8000;
    this.peers = opts.peers || [];
    this.clients = opts.clients || [];

    this.server = net.createServer((socket) => {
      socket.on('end', () => {
        console.log('client disconnected');
      });
      socket.on('data', (data) => {
        this.handleMsg(data);
      });
    });

    this.server.listen(this.port, () => {
      console.log(`Server listening on ${this.port}`)
    })
  }

  // Handle an incoming socket message
  handleMsg(data) {
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
}

module.exports = Bridge;

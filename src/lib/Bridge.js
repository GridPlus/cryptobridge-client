const net = require('net');
const fs = require('fs');
const sync = require('./sync');

// Run a bridge client. This has a set of peers and two web3 clients corresponding
// to a particular bridge, which corresponds to two specific networks.
class Bridge {
  constructor(opts) {
    if (!opts) { opts = {}; }
    this.port = opts.port || 8000;
    this.peers = opts.peers || [];
    this.clients = opts.clients || [];
    this.index = opts.index || '';
    this.datadir = opts.datadir || `${process.cwd()}/data`;

    // Create a server and listen to peer messages
    this.server = net.createServer((socket) => {
      socket.on('end', () => {
        console.log('client disconnected');
      });
      socket.on('data', (data) => {
        this.handleMsg(data);
      });
    });

    // Sync headers from the two networks
    this.sync(this.index.split('_')[0], this.clients[0])
    this.sync(this.index.split('_')[1], this.clients[1])

    // Listen on port
    this.server.listen(this.port, () => {
      console.log(`Server listening on ${this.port}`)
    })
  }

  // Sync a given client. Headers are persisted in sets of 100 along with their
  // corresponding block numbers
  sync(addr, client) {
    const fPath = `${this.datadir}/${addr}/headers`;
    // Sync saved headers and return the last line of the file
    sync.syncHeaders(fPath, (err, cache) => {
      // Make sure we don't write the last line twice. The purpose of saving the
      // cache is so we can keep writing to unfinished lines
      if (cache.length > 9) { cache = []; }
      if (err) { console.log(err); }
      else {
        client.eth.getBlockNumber((err, currentBlock) => {
          let cacheBlock = 0;
          if (cache[cache.length - 1] != undefined) { cacheBlock = cache[cache.length - 1][0]; }
          if (err) { console.log(`ERROR: ${err}`); }
          else if (currentBlock > cacheBlock) {
            // Create a write stream so we can write to the header file
            const stream = fs.createWriteStream(fPath, { flags: 'a' });
            sync.syncData(currentBlock, cacheBlock, client, stream, cache, (err) => {
              if (err) { console.log(`ERROR: ${err}`); }
            });
          }
        })
      }
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

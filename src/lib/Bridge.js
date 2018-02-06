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
    this.addrs = this.index.split('_');
    this.cache = [];

    // Create a server and listen to peer messages
    this.server = net.createServer((socket) => {
      socket.on('end', () => {
        console.log('client disconnected');
      });
      socket.on('data', (data) => {
        this.handleMsg(data);
      });
    });

    // Listen on port
    this.server.listen(this.port, () => {
      console.log(`Server listening on ${this.port}`)
    })


    // TODO: This is writing a second set of header data after it has been written. Looks like it's starting from block 1...


    // Sync headers from the two networks
    for (let i = 0; i < 1; i++) {
      sync.checkHeaders(`${this.datadir}/${this.addrs[i]}/headers`, (err, cache) => {
        if (err) { console.log('Error getting headers', err, i); }
        else {
          this.cache[i] = cache;
          this.sync(this.addrs[i], cache, this.clients[i], (err, newCache) => {
            if (err) { console.log(`ERROR: ${err}`); }
            this.cache[i] = newCache;

            // Continue syncing periodically
            setInterval(() => {
              this.sync(this.addrs[i], this.cache[i], this.clients[i], (err, newCache) => {
                if (err) { console.log(`ERROR: ${err}`); }
                this.cache[i] = newCache;
              })
            }, opts.queryDelay || 10000);
          })
        }
      })
    }
  }

  // Sync a given client. Headers are persisted in sets of 100 along with their
  // corresponding block numbers
  sync(addr, cache, client, cb) {
    const fPath = `${this.datadir}/${addr}/headers`;
    // Make sure we don't write the last line twice. The purpose of saving the
    // cache is so we can keep writing to unfinished lines
    if (cache.length > 99) { cache = []; }
    client.eth.getBlockNumber((err, currentBlock) => {
      let cacheBlock = 0;
      if (cache[cache.length - 1] != undefined) { cacheBlock = parseInt(cache[cache.length - 1][0]); }
      if (err) { console.log(`ERROR: ${err}`); }
      else if (currentBlock > cacheBlock) {
        // Create a write stream so we can write to the header file
        const stream = fs.createWriteStream(fPath, { flags: 'a' });
        sync.syncData(currentBlock, cacheBlock, client, stream, cache, (err, newCache) => {
          if (err) { cb(err); }
          else { cb(null, newCache); }
        });
      }
      else { cb(null, cache); }
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

const net = require('net');
const fs = require('fs');
const sync = require('./sync');
const bridges = require('./bridgesUtil.js');
const Log = require('./../log.js');
let logger;

// Run a bridge client. This has a set of peers and two web3 clients corresponding
// to a particular bridge, which corresponds to two specific networks.
class Bridge {
  constructor(opts) {
    logger = Log.getLogger();

    if (!opts) { opts = {}; }
    this.port = opts.port || 8000;
    this.peers = opts.peers || [];
    this.clients = opts.clients || [];
    this.index = opts.index || '';
    this.datadir = opts.datadir || `${process.cwd()}/data`;
    this.addrs = this.index.split('_');
    // Header data (number, timestamp, prevHeader, txRoot, receiptsRoot) is
    // stored in lines with 100 entries each. The remainder is kept in a cache.
    this.cache = [];
    // Data for the bridges are kept in memory. It is indexed based on
    // [bridgeToQuery][bridgedChain], where these indices are the addesses
    // of the bridge contracts sitting on those chains.
    this.bridgeData = {};
    this.bridgeData[this.addrs[0]] = {};
    this.bridgeData[this.addrs[0]][this.addrs[1]] = {};
    this.bridgeData[this.addrs[1]] = {};
    this.bridgeData[this.addrs[1]][this.addrs[0]] = {};


    // Create a server and listen to peer messages
    this.server = net.createServer((socket) => {
      socket.on('end', () => {
        logger.log('error', 'Server socket connection ended')
      });
      socket.on('data', (data) => {
        this.handleMsg(data);
      });
    });

    // Listen on port
    this.server.listen(this.port, () => {
      logger.log('info', `Listening on port ${this.port}`)
    })

    // Sync headers from the two networks
    for (let i = 0; i < 2; i++) {
      sync.checkHeaders(`${this.datadir}/${this.addrs[i]}/headers`, (err, cache) => {
        if (err) { log.error('Error getting headers', err, i); }
        else {
          this.cache[i] = cache;
          this.sync(this.addrs[i], cache, this.clients[i], (err, newCache) => {
            if (err) { logger.log('warn', `ERROR: ${err}`); }
            else { this.cache[i] = newCache; }
            // Get the bridge data. This will be updated periodically (when we get new
            // messages)
            if (i == 0) {
              this.getBridgeData(this.addrs[0], this.addrs[1], this.clients[0], (err) => {
                if (err) { logger.log('warn', `ERROR: ${err}`); }
              });
            } else {
              this.getBridgeData(this.addrs[1], this.addrs[0], this.clients[1], (err) => {
                if (err) { logger.log('warn', `ERROR: ${err}`); }
              });
            }
            // Continue syncing periodically
            setInterval(() => {
              this.sync(this.addrs[i], this.cache[i], this.clients[i], (err, newCache) => {
                if (err) { logger.log('warn', `ERROR: ${err}`); }
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
      if (err) { cb(err); }
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

  // Get current data on the bridges
  getBridgeData(queryAddr, bridgedAddr, client, cb) {
    bridges.getLastBlock(queryAddr, bridgedAddr, client, (err, lastBlock) => {
      if (err) { cb(err); }
      else {
        this.bridgeData[queryAddr][bridgedAddr].lastBlock = lastBlock;
        bridges.getProposer(queryAddr, client, (err, proposer) => {
          if (err) { cb(err); }
          else {
            this.bridgeData[queryAddr][bridgedAddr].proposer = proposer;
          }
        })
      }
    })
  }

  // Handle an incoming socket message
  handleMsg(data) {
    const msg = JSON.parse(data.toString('utf8'));
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

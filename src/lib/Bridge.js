// Bridge server to manage peer connections, blockchain data, and signatures.
const net = require('net');
const fs = require('fs');
const config = require('../config.js');
const sync = require('./util/sync.js');
const bridges = require('./util/bridges.js');
const merkle = require('./util/merkle.js');
const util = require('./util/util.js');
const Log = require('./../log.js');
const Peer = require('./Peer.js').Peer;
const Wallet = require('./Wallet.js');
let logger;

// This will later be made dynamic
let NCHAINS = 2;

// Run a bridge client. This has a set of peers and two web3 clients corresponding
// to a particular bridge, which corresponds to two specific networks.
class Bridge {
  constructor(opts) {
    logger = Log.getLogger();
    if (!opts) { opts = {}; }

    this.wallet = opts.wallet || new Wallet();
    logger.log('info', `Wallet setup: ${this.wallet.getAddress()}`)
    this.port = opts.port || 8000;
    this.externalHost = opts.host || 'localhost';
    this.peers = opts.peers || {};
    this.clients = opts.clients || [];
    this.index = opts.index || '';
    this.datadir = opts.datadir || `${process.cwd()}/data`;
    this.addrs = this.index.split('_');
    // Collected signatures. Indexed as (chainToPropose -> bridgedChain -> signer -> sig)
    this.sigs = {};
    // Number of blocks to wait to propose
    this.proposeThreshold = opts.proposeThreshold || 4;
    // Header data (number, timestamp, prevHeader, txRoot, receiptsRoot) is
    // stored in lines with 100 entries each. The remainder is kept in a cache.
    this.cache = [];
    // Data for the bridges are kept in memory. It is indexed based on
    // [bridgeToQuery][bridgedChain], where these indices are the addesses
    // of the bridge contracts sitting on those chains.
    this.bridgeData = {};
    this.bridgeData[this.addrs[0]] = { lastBlocks: {}, proposer: null };
    this.bridgeData[this.addrs[1]] = { lastBlocks: {}, proposer: null };

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
    for (let i = 0; i < NCHAINS; i++) {
      sync.checkHeaders(`${this.datadir}/${this.addrs[i]}/headers`, (err, cache) => {
        if (err) { logger.error('Error getting headers', err, i); }
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
            }, opts.queryDelay || 1000);
            // Do stuff if you're the proposer
            setInterval(() => {
              const bdata = this.bridgeData[this.addrs[i]];
              if (bdata.proposer == this.wallet.getAddress()) {
                console.log('im the proposer')
                this.getRootsAndBroadcast(i);
              }
            }, opts.queryDelay || 1000);
          })
        }
      })
    }
  }


  // Sync a given client. Headers are persisted in sets of 100 along with their
  // corresponding block numbers
  sync(chain, cache, client, cb) {
    const fPath = `${this.datadir}/${chain}/headers`;
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
      console.log('lastBlock', lastBlock)
      if (err) { cb(err); }
      else {
        this.bridgeData[queryAddr].lastBlocks[bridgedAddr] = lastBlock;
        bridges.getProposer(queryAddr, client, (err, proposer) => {
          console.log('proposer', proposer)
          if (err) { cb(err); }
          else {
            this.bridgeData[queryAddr].proposer = proposer;
          }
        })
      }
    })
  }

  // Check the signature counts for each saved chain. Propose a root if a
  // threshold is met. If the proposal goes through, wipe all sigs from memory.
  tryPropose() {
    this.addrs.forEach((bridge, i) => {
      bridges.getThreshold(bridge, this.clients[i], (err, thresh) => {
        if (this.sigs[bridge] != undefined) {
          Object.keys(this.sigs[bridge]).forEach((mappedChain) => {
            let end = 0;
            let start = 0;
            let checkedSigs = [];
            let sigs = this.sigs[bridge][mappedChain];
            Object.keys(sigs).forEach((i) => {
              if (sigs[i].end > end) {
                end = sigs[i].end; start = sigs[i].start;
                checkedSigs.push(sigs[i]);
              };
            });
            if (checkedSigs.length >= thresh) {
              bridges.propose(checkedSigs, bridge, mappedChain, this.wallet, this.clients[i],
                (err, txHash) => {
                  if (err) { logger.log('error', `Error sending proposal: ${err}`); }
                  else { logger.log('info', `Successfully proposed root: ${txHash}`)}
              }, this.gasPrice);
            }
          })
        }
      })
    })
  }

  // Get roots for all saved, bridged chains that are not this one. Broadcast
  // any roots that meet your criteria for blocks elapsed
  getRootsAndBroadcast(i) {
    const bdata = this.bridgeData[this.addrs[i]];
    for (let j = 0; j < NCHAINS; j++) {
      if (i != j) {
        const chain = this.addrs[j];
        const lastBlock = bdata.lastBlocks[chain];
        const currentBlock = parseInt(this.cache[j][this.cache[j].length - 2][1]);
        const start = lastBlock + 1;
        const end = lastBlock + 1 + util.lastPowTwo(currentBlock - lastBlock - 1);
        if (end - start > this.proposeThreshold) {
          this.getProposalRoot(chain, start, end, (err, hRoot) => {
            if (err) { logger.log('warn', `Error getting proposal root: ${err}`); }
            else {
              const msg = {
                type: 'SIGREQ',
                from: `${this.externalHost}:${this.port}`,
                data: { chain, start, end, root: hRoot }
              };
              this.broadcastMsg(msg)
            }
          })
        }
      }
    }
  }

  /*propose(queryAddr, bridgedAddr, client, cb) {
    const d = this.bridgeData[queryAddr][bridgedAddr];
    const currentN = this.cache[this.cache.length - 1].n;
    if (d.proposer != this.wallet.getAddress() || this.proposeThreshold - 1 > currentN - d.lastBlock) {
      // Do nothing if you're not the propose and/or not enough blocks have elapsed
      cb(null, null);
    } else {
      // Get the root
      const range = util.lastPowTwo(currentN - d.lastBlock - 1);
      console.log('range', range)
      getProposalRoot(queryAddr, d.lastBlock + 1, d.lastBlock + 1 + range, (err, headerRoot) => {
        // Broadcast root with metadata to all known peers
      })
    }
  }*/

  // If this client is elected as the proposer, get the relevant data and form
  // the block header Merkle root.
  getProposalRoot(chain, startBlock, endBlock, cb) {
    console.log('startBlock', startBlock, 'endBlock', endBlock)
    sync.loadHeaders(startBlock, endBlock, `${this.datadir}/${chain}/headers`, (err, headers, n) => {
      if (n < endBlock) { cb('Not synced to that block. Try again later.'); }
      else {
        const headerRoot = merkle.getMerkleRoot(headers);
        cb(null, headerRoot);
      }
    })
  }



  // Handle an incoming socket message
  handleMsg(data) {
    const msg = JSON.parse(data.toString('utf8'));
    switch (msg.type) {
      case 'SIGREQ':
        this.verifyProposedRoot(msg.data, (err, sig) => {
          if (err) { logger.log('warn', `Error with SIGREQ: ${err}`); }
          else {
            console.log('got sig', 'peer', this.peers[msg.from])
            if (!this.peers[msg.from] || this.peers[msg.from].state == 'closed') { this.addPeer(msg.from); }
            msg.data.sig = sig;
            console.log('broadcasting sig', msg.data)
            this.broadcastMsg({ type: 'SIGPASS', data: msg.data });
          }
        });
        break;
      case 'SIGPASS':
        let client;
        // This header root can potentially be proposed to any chain that is not
        // the one it originates from. Check if the signature was made by someone
        // who is a validator on each chain.
        this.addrs.forEach((addr, i) => {
          if (addr != msg.data.chain) {
            client = this.clients[i];
            const chain = msg.data.chain;
            // Check if this is a validator on the desired chain. If so, save
            // the signature
            bridges.checkSig(msg.data.root, msg.data.sig, addr, client, (err, signer) => {
              if (signer) {
                if (!this.sigs[addr]) { this.sigs[addr] = {}; }
                if (!this.sigs[addr][chain]) { this.sigs[addr][chain] = {}; }
                if (!this.sigs[addr][chain][signer]) { this.sigs[addr][chain][signer] = {}; }
                this.sigs[addr][msg.data.chain][signer] = msg.data;
                this.tryPropose();
              }
            })
          }
        })
        break;
      case 'PEERSREQ':
        console.log('someone asking for peers list', msg);
        break;
      default:
        logger.log('info', `Got msg with no type: ${msg}`)
        break;
    }
  }

  // With a SIGREQ, verify a proposed header root and return a signature
  // if it metches your history
  verifyProposedRoot(data, cb) {
    if (util.lastPowTwo(data.end - data.start) != data.end - data.start) {
      cb('Range not a power of two');
    } else {
      this.getProposalRoot(data.chain, data.start, data.end, (err, hRoot) => {
        if (err) { cb(err); }
        else if (hRoot != data.root) { cb('Roots do not match'); }
        else {
          const sig = this.wallet.sign(hRoot);
          cb(null, sig);
        }
      })
    }
  }

  addPeer(host) {
    const params = host.split(':');
    const peer = new Peer(params[0], params[1]);
    peer.connect();
    this.peers[host] = peer;
    // Save the peer
    config.addPeers([peer], this.datadir, this.index, () => {})
  }

  // Broadcast a message to all peers
  broadcastMsg(_msg) {
    const msg = JSON.stringify(_msg);
    Object.keys(this.peers).forEach((p) => {
      if (this.peers[p].state == 'connected') {
        this.peers[p].send('msg', msg);
      }
    })
  }
}

module.exports = Bridge;

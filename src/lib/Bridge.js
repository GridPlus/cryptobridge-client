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


// Run a bridge client. This has a set of peers and two web3 clients corresponding
// to a particular bridge, which corresponds to two specific networks.
class Bridge {
  constructor(opts) {
    logger = Log.getLogger();
    if (!opts) { opts = {}; }
    // If the user wants to set a specific logging level (including null)
    logger = opts.logging == undefined ? logger : Log.setLevel(opts.logging);
    this.wallet = opts.wallet ? opts.wallet : new Wallet();
    logger.log('info', `Wallet setup: ${this.wallet.getAddress()}`)
    this.port = opts.port ? opts.port : 8000;
    this.externalHost = opts.host ? opts.host : 'localhost';
    this.peers = opts.peers ? opts.peers : {};
    this.clients = opts.clients ? opts.clients : [];
    this.index = opts.index ? opts.index : '';
    this.datadir = opts.datadir ? opts.datadir : `${process.cwd()}/data`;
    this.addrs = this.index == '' ? [] : this.index.split('_');
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
    // Propsal roots will be cached here
    this.proposal = null;

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

    // Ping all peers so they will connect to you
    setTimeout(() => { this.pingPeers() }, 1000);

    // Sync headers from the two networks
    // NOTE: This should start at 0. 1 is for debugging
    for (let i = 0; i < this.addrs.length; i++) {
      sync.checkHeaders(`${this.datadir}/${this.addrs[i]}/headers`, (err, cache) => {
        if (err) { logger.error('Error getting headers', err, i); }
        else {
          if (cache.length < 100) { this.cache[i] = cache; }
          else { this.cache[i] = []; }
          const cacheBlock = util.getCacheBlock(cache);
          this.sync(this.addrs[i], this.clients[i], this.cache[i], cacheBlock, (err, newCache) => {
            if (err) { logger.log('warn', `ERROR: ${err}`); }
            else { this.cache[i] = newCache; }
            // Get the bridge data. This will be updated periodically (when we get new
            // messages)
            let pairIndex = i % 2 == 0 ? i + 1 : i - 1;
            this.getBridgeData(this.addrs[i], this.addrs[pairIndex], this.clients[i], (err) => {
              if (err) { logger.warn(err); }
            });
            setInterval(() => {
              // Clean up peer connections
              this.cleanPeers()
              // Sync
              const cacheBlock = util.getCacheBlock(this.cache[i]);
              this.sync(this.addrs[i], this.clients[i], this.cache[i], cacheBlock, (err, newCache) => {
                if (err) { logger.log('warn', `ERROR: ${err}`); }
                this.cache[i] = newCache;
              });
              // Try to propose if applicable
              const bdata = this.bridgeData[this.addrs[i]];
              if (bdata.proposer == this.wallet.getAddress()) {
                this.getRootsAndBroadcast(i);
              }
            }, opts.queryDelay || 2000);
          });
        };
      });
    };

    // Ping peers periodically
    setInterval(() => { this.pingPeers() }, 300000)
  }


  // Sync a given client. Headers are persisted in sets of 100 along with their
  // corresponding block numbers
  // NOTE: cacheblock is passed in the event of an empty cache to make sure
  // we don't write any new lines
  sync(chain, client, cache, cacheBlock, cb) {
    const fPath = `${this.datadir}/${chain}/headers`;
    client.eth.getBlockNumber((err, currentBlock) => {
      if (!cacheBlock && cache[cache.length - 1] != undefined) {
        cacheBlock = parseInt(cache[cache.length - 1][0]);
      }
      if (err) { cb(err); }
      else if (currentBlock > cacheBlock) {
        // Create a write stream so we can write to the header file
        const stream = fs.createWriteStream(fPath, { flags: 'a' });
        sync.syncData(currentBlock, cacheBlock, client, stream, cache, (err, newCache) => {
          if (err) { cb(err); }
          else { cb(null, newCache); }
        });
      } else { cb(null, cache); }
    });
  }

  // Get current data on the bridges
  getBridgeData(queryAddr, bridgedAddr, client, cb) {
    bridges.getLastBlock(queryAddr, bridgedAddr, client, (err, lastBlock) => {
      if (err) { cb(err); }
      else {
        this.bridgeData[queryAddr].lastBlocks[bridgedAddr] = lastBlock;
        bridges.getProposer(queryAddr, client, (err, proposer) => {
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
            if (this.proposal != null) {
              bridges.checkReceiptLogs(1, this.proposal, this.clients[i], (err, success) => {
                if (err) { logger.warning(`Problem getting receipt: ${err}`); }
                else if (success) {
                  logger.info(`Successfully proposed root: ${this.proposal}`)
                  this.proposal = null;
                  this.sigs[bridge][mappedChain] = [];
                  this.getBridgeData(bridge, mappedChain, this.clients[i], (err) => {
                    if (err) { logger.warn(`Error getting new bridge data: ${err}`); }
                  })
                }
              })
            } else if (checkedSigs.length >= thresh) {
              bridges.propose(checkedSigs, bridge, mappedChain, this.wallet, this.clients[i],
                (err, txHash) => {
                  if (err) { logger.error(`Error sending proposal: ${err}`); }
                  else {
                    this.proposal = txHash;
                    logger.info(`Submitted proposal root: ${txHash}`);
                  }
              }, this.gasPrice);
            }
          });
        }
      });
    });
  }

  // Get roots for all saved, bridged chains that are not this one. Broadcast
  // any roots that meet your criteria for blocks elapsed
  getRootsAndBroadcast(i) {
    const bdata = this.bridgeData[this.addrs[i]];
    for (let j = 0; j < this.addrs.length; j++) {
      if (i != j) {
        const chain = this.addrs[j];
        const lastBlock = bdata.lastBlocks[chain];
        const currentBlock = parseInt(this.cache[j][this.cache[j].length - 1][0]);
        const start = lastBlock + 1;
        const end = lastBlock + 1 + util.lastPowTwo(currentBlock - lastBlock - 1);
        if (end - start >= this.proposeThreshold) {
          this.getProposalRoot(chain, start, end, this.cache[j], (err, hRoot) => {
            if (err) { logger.warn(`Error getting proposal root: ${err}`); }
            else if (!hRoot) {
              const cacheBlock = util.getCacheBlock(this.cache[j]);
              this.sync(chain, this.clients[j], this.cache[j], cacheBlock, (err, newCache) => {
                if (err) { logger.warn(`Error syncing: ${err}`); }
                else { this.cache[j] = newCache; }
              })
            } else {
              const msg = {
                type: 'SIGREQ',
                from: `${this.externalHost}:${this.port}`,
                data: { chain, start, end, root: hRoot },
                peers: Object.keys(this.peers)
              };
              this.broadcastMsg(msg);
            }
          });
        }
      }
    }
  }

  // If this client is elected as the proposer, get the relevant data and form
  // the block header Merkle root.
  getProposalRoot(chain, startBlock, endBlock, cache=[], cb) {
    sync.loadHeaders(startBlock, endBlock, `${this.datadir}/${chain}/headers`, (err, headers, n) => {
      headers = util.concatHeadersCache(headers, cache, endBlock);
      const cacheBlock = util.getCacheBlock(cache);
      if (err) { cb(err); }
      else if (n < endBlock && cacheBlock < endBlock) {
        cb(null, null);
      } else {
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
            this.addPeersFromMsg(msg);
            msg.data.sig = sig;
            this.broadcastMsg({ type: 'SIGPASS', data: msg.data, peers: Object.keys(this.peers) }, msg.peers);
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
      case 'PING':
        this.addPeersFromMsg(msg);
      default:
        break;
    }
  }

  // With a SIGREQ, verify a proposed header root and return a signature
  // if it metches your history
  verifyProposedRoot(data, cb) {
    const i = this.addrs.indexOf(data.chain);
    if (util.lastPowTwo(data.end - data.start) != data.end - data.start) {
      cb('Range not a power of two');
    } else if (i < 0) {
      cb ('Not watching that chain');
    } else {
      this.getProposalRoot(data.chain, data.start, data.end, this.cache[i], (err, hRoot) => {
        if (err) { cb(err); }
        else if (hRoot != data.root) { cb('Roots do not match'); }
        else if (hRoot) {
          const sig = this.wallet.sign(hRoot);
          cb(null, sig);
        }
      })
    }
  }

  cleanPeers() {
    Object.keys(this.peers).forEach((i) => {
      if (this.peers[i].state == 'closed') { delete this.peers[i]; }
    })
  }

  // Add peers from an incoming message. There are two places to look for peers:
  // 1. msg.from - the sender should be added as a peer if it isn't one
  // 2. msg.peers - the sender may include its list of peers - check this against yours
  addPeersFromMsg(msg) {
    let toAdd = [];
    if (this.checkAddPeer(msg.from)) { toAdd.push(msg.from); }
    if (typeof msg.peers == 'object' && Array.isArray(msg.peers)) {
      msg.peers.forEach((p) => { if (this.checkAddPeer(p)) { toAdd.push(p); }; })
    }
    toAdd.forEach((host) => {
      const params = host.split(':');
      const peer = new Peer(params[0], params[1]);
      peer.connect();
      this.peers[host] = peer;
      logger.info(`Added peer connection. ${Object.keys(this.peers).length} open connections.`)
      // Save the peer
      config.addPeers([peer], this.datadir, this.index, this.handleAddPeer);
    })
  }

  // Decide whether this peer should be added
  checkAddPeer(p) {
    if (Object.keys(this.peers).indexOf(p) >= 0) { return false; }
    else if (p == `${this.externalHost}:${this.port}`) { return false; }
    else { return true; }
  }

  // Broadcast a message to all peers
  broadcastMsg(_msg, contacted=[]) {
    let toContact = [];
    let toAdd = [];
    // Don't send to disconnected peers or to peers already contacted
    Object.keys(this.peers).forEach((p) => {
      if (this.peers[p].state == 'connected' && contacted.indexOf(p) == -1) {
        toContact.push(p);
        contacted.push(p); // Also add them to the contacted list for future broadcasts
      }
    })
    _msg.peers = contacted;
    const msg = JSON.stringify(_msg);
    // Send messages to uncontacted peers
    toContact.forEach((host) => {
      this.peers[host].send('msg', msg);
    })
    // Grab some peers
    contacted.forEach((p) => {
      if (Object.keys(this.peers).indexOf(p) == -1) {
        const params = p.split(':')
        if (params[0] != this.externalHost && parseInt(params[1]) != parseInt(this.port)) {
          const peer = new Peer(params[0], params[1]);
          toAdd.push(peer);
        }
      }
    })
    config.addPeers(toAdd, this.datadir, this.index, this.handleAddPeer);
  }

  // Ping peers
  pingPeers() {
    const host = `${this.externalHost}:${this.port}`;
    const ping = JSON.stringify({ type: 'PING', from: host, peers: Object.keys(this.peers) });
    Object.keys(this.peers).forEach((p) => {
      this.peers[p].send('msg', ping);
    })
  }

  handleAddPeer(err, newSaves) {
    if (err) { logger.warn(err); }
    else if (newSaves > 0){ logger.info(`Saved ${newSaves} new peers.`); }
  }

}

module.exports = Bridge;

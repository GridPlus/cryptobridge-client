// Connect and message peers
const fs = require('fs');
const Peer = require('./lib/Peer.js').Peer;
const Promise = require('bluebird').Promise;
const Log = require('./log');

// Given a list of hosts, form p2p connections with them.
function connectToPeers(peers, cb, connections=[], logging=null) {
  let logger = logging == undefined? Log.getLogger() : Log.setLevel(logging);
  if (peers.length == 0) { cb(connections); }
  else {
    // Peer stored as e.g. localhost:7545
    let disconnected = false;
    const loc = peers.pop().split(':');
    const peer = new Peer(loc[0], parseInt(loc[1]));
    const name = `${loc[0]}:${loc[1]}`;
    peer.on('connect', (c) => {
      logger.log('info', `Connected to peer ${name}`);
    })
    peer.on('end', (d) => {
      logger.log('info', `Disconnected from ${name}`);
    })
    peer.on('error', (e) => {
      logger.log('warn', `Error from ${name}: ${e.error}`);
      peer.disconnect();
      disconnected = true;
    })
    peer.on('message', (m) => {
      logger.log('info', `Message from ${name} : ${m}`);
    })
    peer.connect();
    setTimeout(() => {
      if (!disconnected) { connections.push(peer); }
      connectToPeers(peers, cb, connections, logging);
    }, 200);
  }
}
exports.connectToPeers = connectToPeers;

// Load known peer addresses into memory
function getSavedPeers(cb, path=`${process.cwd()}/data`) {
  if (!fs.existsSync(path)) { fs.mkdirSync(path); }
  const fPath = `${path}/peers`;
  fs.readFile(fPath, (err, peers) => {
    if (err) { cb(err); }
    else { cb(null, peers.toString('utf-8').replace(/(\r\n|\n|\r)/gm,"").split(',')); }
  });
}

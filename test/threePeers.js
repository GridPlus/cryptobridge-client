// Connect to three peers (four total clients)
// The peers will have no peers themselves
// Send a message with a signature request containing all four peers
// Check to see if the three peers now have all the peers themselves
const assert = require('assert');
const fs = require('fs');
const Bridge = require('../src/lib/Bridge.js');
const Log = require('../src/log.js');
const Web3 = require('web3');
const config = require('../data/config.json');
const Peers = require('../src/peers.js');

const index = Object.keys(config)[0];
const web3A = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));
const web3B = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
const hosts = [web3A, web3B]

Log.setLogger(`${process.cwd()}`);

const b2 = new Bridge({
  port: 10000,
  clients: hosts,
  index: index,
  peers: []
})

const peerHosts = [ 'localhost:10000' ]
Peers.connectToPeers(peerHosts, (err, peers) => {
  const b1 = new Bridge({
    port: 9999,
    clients: hosts,
    index: index,
    peers: peers
  })
})

fs.unlinkSync(`${process.cwd()}/log`)

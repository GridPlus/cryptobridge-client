// Connect to three peers (four total clients)
// The peers will have no peers themselves
// Send a message with a signature request containing all four peers
// Check to see if the three peers now have all the peers themselves
const assert = require('assert');
const fs = require('fs');
const Bridge = require('../src/lib/Bridge.js');
const Log = require('../src/log.js');
const Web3 = require('web3');
const config = require('../src/config.js');
const util = require('../src/lib/util/util.js');
// For now you need to have a config file defined.
// TODO: Make this script self-contained
const tmpconfig = require('../data/config.json');
const Peers = require('../src/peers.js');

const index = Object.keys(tmpconfig)[0];
const web3A = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));
const web3B = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
const hosts = [web3A, web3B]
const dir = `${process.cwd()}/test/tmp`;
Log.setLogger(dir);

let b1;
let b2;
let b3;
let b4;
const d1 = `${dir}/b1`;

describe('Simple peer connections', () => {
  before(() => {
    const d2 = `${dir}/b2`;
    const d3 = `${dir}/b3`;
    const d4 = `${dir}/b4`;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
      fs.mkdirSync(d1);
      fs.mkdirSync(d2);
      fs.mkdirSync(d3);
      fs.mkdirSync(d4);
    }
    b2 = new Bridge({ port: 10000, clients: hosts, peers: {}, datadir: d2, logging: 0 })
    b3 = new Bridge({ port: 10001, clients: hosts, peers: {}, datadir: d3, logging: 0 })
    b4 = new Bridge({ port: 10002, clients: hosts, peers: {}, datadir: d4, logging: 0 })
  })

  it('Should connect to peers', (done) => {
    const peerHosts = [ 'localhost:10000', 'localhost:10001', 'localhost:10002' ];
    config.loadPeers(peerHosts, (err, peers) => {
      assert(err === null);
      b1 = new Bridge({ port: 9999, clients: hosts, peers: peers, datadir: d1, logging: 0 });
      setTimeout(() => {
        assert(Object.keys(b1.peers).length === 3);
        done();
      }, 500);
    })
  })

  it('Should make sure the other clients are peerless', (done) => {
    assert(Object.keys(b2.peers).length === 0);
    assert(Object.keys(b3.peers).length === 0);
    assert(Object.keys(b4.peers).length === 0);
    done();
  })

  it('Should ping the peers', (done) => {
    b1.pingPeers();
    setTimeout(() => { done(); }, 500);
  })

  it('Should check that b2 has new peers', (done) => {
    assert(Object.keys(b2.peers).length === 3);
    assert(Object.keys(b3.peers).length === 3);
    assert(Object.keys(b4.peers).length === 3);
    done();
  })

  it('Should delete testing directories', () => {
    util.deleteFolderRecursive(dir);
  })
})


const logdir = `${dir}/log`;
if (fs.existsSync(logdir)) {
  fs.unlinkSync(logdir);
}

// Should create a set of clients and connect them all (via bootstrapping one
// fully connected bootstrap node)
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
let b5;
let b6;
const d1 = `${dir}/b1`;
const d2 = `${dir}/b2`;
const d3 = `${dir}/b3`;
const d4 = `${dir}/b4`;
const d5 = `${dir}/b5`;
const d6 = `${dir}/b6`;

describe('Total peer transfer via a well connected bootstrapped node', () => {
  before(() => {

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
      fs.mkdirSync(d1);
      fs.mkdirSync(d2);
      fs.mkdirSync(d3);
      fs.mkdirSync(d4);
      fs.mkdirSync(d5);
      fs.mkdirSync(d6);
    }
    b1 = new Bridge({ port: 10001, clients: hosts, peers: {}, datadir: d1, logging: 0 })
  });

  it('Should connect b2 to b1', (done) => {
    const peerHosts = [ 'localhost:10001' ];
    config.loadPeers(peerHosts, (err, peers) => {
      assert(err === null);
      b2 = new Bridge({ port: 10002, clients: hosts, peers: peers, datadir: d2, logging: 0 });
      setTimeout(() => {
        assert(Object.keys(b2.peers).length === 1);
        done();
      }, 1000);
    })
  });

  it('Should connect b3 to b1', (done) => {
    const peerHosts = [ 'localhost:10001' ];
    config.loadPeers(peerHosts, (err, peers) => {
      assert(err === null);
      b3 = new Bridge({ port: 10003, clients: hosts, peers: peers, datadir: d3, logging: 0 });
      setTimeout(() => {
        assert(Object.keys(b3.peers).length === 1);
        done();
      }, 1000);
    })
  });

  it('Should connect b4 to b1', (done) => {
    const peerHosts = [ 'localhost:10001' ];
    config.loadPeers(peerHosts, (err, peers) => {
      assert(err === null);
      b4 = new Bridge({ port: 10004, clients: hosts, peers: peers, datadir: d4, logging: 0 });
      setTimeout(() => {
        assert(Object.keys(b4.peers).length === 1);
        done();
      }, 1000);
    })
  });

  it('Should connect b5 to b1', (done) => {
    const peerHosts = [ 'localhost:10001' ];
    config.loadPeers(peerHosts, (err, peers) => {
      assert(err === null);
      b5 = new Bridge({ port: 10005, clients: hosts, peers: peers, datadir: d5, logging: 0 });
      setTimeout(() => {
        assert(Object.keys(b5.peers).length === 1);
        done();
      }, 1000);
    })
  });

  it('Should connect b6 to b1', (done) => {
    const peerHosts = [ 'localhost:10001' ];
    config.loadPeers(peerHosts, (err, peers) => {
      assert(err === null);
      b6 = new Bridge({ port: 10006, clients: hosts, peers: peers, datadir: d6, logging: 0 });
      setTimeout(() => {
        assert(Object.keys(b6.peers).length === 1);
        done();
      }, 1000);
    })
  });

  it('Should check that b2, b3, b4, b5, b6 all have one peer each', (done) => {
    assert(Object.keys(b2.peers).length === 1);
    assert(Object.keys(b3.peers).length === 1);
    assert(Object.keys(b4.peers).length === 1);
    assert(Object.keys(b5.peers).length === 1);
    assert(Object.keys(b6.peers).length === 1);
    done();
  });

  it('Should ensure b1 is connected to 5 peers', (done) => {
    assert(Object.keys(b1.peers).length === 5);
    done();
  })

  it('Should ping peers from b1', (done) => {
    b1.pingPeers();
    setTimeout(() => { done(); }, 1000);
  })

  it('Should ensure all peers are connected to 5 peers each', (done) => {
    assert(Object.keys(b1.peers).length === 5);
    assert(Object.keys(b2.peers).length === 5);
    assert(Object.keys(b3.peers).length === 5);
    assert(Object.keys(b4.peers).length === 5);
    assert(Object.keys(b5.peers).length === 5);
    assert(Object.keys(b6.peers).length === 5);
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

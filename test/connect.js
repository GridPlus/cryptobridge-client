// Run the client
const Peer = require('p2p-node').Peer;
const net = require('net');
const assert = require('assert');

describe('p2p Connections', function () {
  it('Should create two servers and connect to both', (done) => {
    let server1Listening = false;
    let server2Listening = false;
    let peer1Connected = false;
    let peer2Connected = false;
    const server1 = net.createServer((c) => { c.pipe(c); })
    server1.on('error', (err) => { throw err; })
    server1.listen(3001, () => { server1Listening = true;})
    const server2 = net.createServer((c) => { c.pipe(c); })
    server2.on('error', (err) => { throw err; })
    server2.listen(3002, () => { server2Listening = true; })
    const p1 = new Peer('localhost', 3001);
    p1.on('connect', (d) => { peer1Connected = true; })
    p1.on('error', (e) => { throw e; })
    const p2 = new Peer('localhost', 3002);
    p2.on('connect', (d) => {
      peer2Connected = true;
      assert(server1Listening == true);
      assert(server2Listening == true);
      assert(peer1Connected == true);
      assert(peer2Connected == true);
      done();
    })
    p2.on('error', (e) => { throw e; })

    setTimeout(() => { p1.connect() }, 100)
    setTimeout(() => { p2.connect() }, 200);
  })
})



// let peers = [];
//
// // files.getPeers()
// .map((peer) => {
//   const tmpSocket = new io.Socket();
//   tmpSocket.connect(peer);
//   peers.push(tmpSocket);
// })

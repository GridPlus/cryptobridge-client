// Start your server and connect to peers
const fs = require('fs');
const net = require('net');
const config = require('./src/config.js');
const server = require('./src/server.js');
const peers = require('./src/peers.js');
const argv = require('yargs')
  .usage('Usage: $0 <cmd> [options]')
  .command('add', 'Add a network group: network_a_host,network_a_address,network_b_host,network_b_address')
  .alias('a', 'add')
  .command('bootstrap', 'Add bootstrap peers, represented by hostnames and separated by commas')
  .alias('b', 'bootstrap')
  .command('datadir', 'Set a directory for all data (config, headers, peers, etc)')
  .alias('d', 'datadir')
  .command('network', 'Specify the network address (bridge contract address) to use')
  .alias('n', 'network')
  .argv;

let DIR = `${process.cwd()}/data`;
let NET_INDEX = null;
if (argv.datadir) {
  // Change the data directory
  DIR = argv.datadir;
}
if (!fs.existsSync(DIR)) { fs.mkdirSync(DIR); }

if(argv.network) {
  // Specify two networks being bridged
  if (argv.network.length != 2) { console.log('ERROR: Please supply two networks, e.g. `--network 0x...a --network 0x...b`'); }
  NET_INDEX = config.getNetIndex(argv.network);
}


if (argv.add) {
  // Add a bridge group
  const group = argv.add.split(',');
  if (group.length != 4) { console.log('ERROR: To add a bridge group, please pass arguments separated by commas: "network_a_host,network_a_address,network_b_host,network_b_address"')}
  config.addGroup(group, DIR, (err) => {
    if (err) { console.log(`ERROR: ${err}`) }
    else { console.log('Successfully added bridge group.')}
  })
}

if(argv.bootstrap) {
  // Add bootstrap peers
  if (!NET_INDEX) { NET_INDEX = config.getFirstIndex(DIR) }
  const _peers = argv.bootstrap.split(',');
  peers.connectToPeers(_peers, (conns) => {
    if (conns.length > 0) {
      config.addPeers(conns, DIR, NET_INDEX, (err) => {
        if (err) { console.log(`ERROR: ${err}`); }
        else { console.log(`Successfully bootstrapped ${conns.length} peers on bridge ${NET_INDEX}`)}
        conns.forEach((conn) => { conn.disconnect(); })
      })
    } else {
      console.log('ERROR: Could not add any bootstrapped peers.')
    }
  })
}


// // This is the server that peers will connect to and message
// const s = server.createServer(8000);
//
// // Connect to known peers
// peers.connectToKnownPeers((err, p) => {
//   console.log('connected to', p ? p.length : 0, 'peers')
//   const obj = { type: 'SIGREQ' }
//   p[0].send('thing', new Buffer(JSON.stringify(obj), 'utf8'))
// });

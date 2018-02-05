// Start your server and connect to peers
const fs = require('fs');
const net = require('net');
const networks = require('./src/networks.js');
const server = require('./src/server.js');
const peers = require('./src/peers.js');
const argv = require('yargs')
  .usage('Usage: $0 <cmd> [options]')
  .command('add', 'Add a network group: network_a_host,network_a_address,network_b_host,network_b_address')
  .alias('a', 'add')
  .command('datadir', 'Set a directory for all data (config, headers, peers, etc)')
  .alias('d', 'datadir')
  .argv;

let DIR = `${process.cwd()}/data`;

if (argv.datadir) {
  // Change the data directory
  DIR = argv.datadir;
}
if (!fs.existsSync(DIR)) { fs.mkdirSync(DIR); }

if (argv.add) {
  // Add a bridge group
  const group = argv.add.split(',');
  if (group.length != 4) { console.log('ERROR: To add a bridge group, please pass arguments separated by commas: "network_a_host,network_a_address,network_b_host,network_b_address"')}
  networks.addGroup(group, DIR, (err) => {
    if (err) { console.log(`ERROR: ${err}`) }
    else { console.log('Successfully added bridge group.')}
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

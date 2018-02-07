// Start your server and connect to peers
const fs = require('fs');
const net = require('net');
const prompt = require('prompt');
const config = require('./src/config.js');
const Bridge = require('./src/lib/Bridge.js');
const Peers = require('./src/peers.js');
const Clients = require('./src/clients.js');
const Log = require('./src/log.js');
const Wallet = require('./src/lib/Wallet.js');

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
  .command('start', 'Start bridge client. Begin listening to peers and connected blockchains')
  .alias('s', 'start')
  .command('wallet', 'Generate a new wallet. You will be prompted for a password')
  .alias('w', 'wallet')
  .argv;

console.log('Bridge Client v0.1\n')

let DIR = `${process.cwd()}/data`;
let INDEX = null;
if (argv.datadir) {
  // Change the data directory
  DIR = argv.datadir;
}
if (!fs.existsSync(DIR)) { fs.mkdirSync(DIR); }
// Setup the logger
Log.setLogger(DIR);


if(argv.network) {
  // Specify two networks being bridged
  if (argv.network.length != 2) { console.log('ERROR: Please supply two networks, e.g. `--network 0x...a --network 0x...b`'); }
  INDEX = config.getNetIndex(argv.network);
} else if (!argv.add) {
  try {
    INDEX = config.getFirstIndex(DIR)
  } catch (err) {
    console.log('ERROR: Cannot retrieve default index. You can add a bridge with --add network_a_host,network_a_address,network_b_host,network_b_addr');
    process.exit(1);
  }
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

if (argv.bootstrap) {
  // Add bootstrap peers
  const _peers = argv.bootstrap.split(',');
  Peers.connectToPeers(_peers, (conns) => {
    if (conns.length > 0) {
      config.addPeers(conns, DIR, INDEX, (err) => {
        if (err) { console.log(`ERROR: ${err}`); }
        else { console.log(`Successfully bootstrapped ${conns.length} peers on bridge ${INDEX}`)}
        conns.forEach((conn) => { conn.disconnect(); })
      })
    } else {
      console.log('ERROR: Could not add any bootstrapped peers.')
    }
  })
}

if (argv.wallet) {
  let pw;
  let randomness;
  let done = false;

  let questions = [{
    name: 'Password',
    hidden: true,
    replace: '*'
  }, {
    name: 'Re-enter password',
    hidden: true,
    replace: '*'
  }];

  if (argv.wallet == true) {
    questions.push({
      name: 'Randomness (just type random stuff)',
      hidden: true,
      replace: '*',
    })
  }

  prompt.start();
  prompt.get(questions, (err, res) => {
    if (res['Password'] != res['Re-enter password']) {
      console.log('Error: Your passwords do not match')
    }
    console.log('res', res);
  })
  // console.log('Generating new wallet. Please enter a password.')
  // process.stdout.write('Password> ');
  // process.stdin.setEncoding('utf8');
  // process.stdin.once('data', (d) => {
  //   pw = d;
  //   process.stdout.write('Retype password> ');
  //   process.stdin.once('data', (d2) => {
  //     if (d2 != pw) { console.log('Error: Passwords do not match.')}
  //     else {
  //       if (argv.wallet != true) {
  //         randomness = argv.wallet
  //       }
  //     }
  //   }).resume();
  // }).resume();
}

if (argv.start) {
  // Start listening to peers and blockchains
  let peers;
  let clients;
  config.getPeers(DIR, INDEX, (err, _peers) => {
    peers = _peers;
    config.getHosts(DIR, INDEX, (err, _hosts) => {
      Clients.connectToClients(_hosts, (err, _clients) => {
        const _port = isNaN(parseInt(argv.start)) ? null : parseInt(argv.start);
        const _wallet = new Wallet();
        // Start a new Bridge client. This consists of a server listening to
        // a given port and handling socket messages from peers. The client
        // also checks linked web3 hosts for updated blockchain data.
        const b = new Bridge({
          index: INDEX,
          peers: _peers,
          clients: _clients,
          datadir: DIR,
          port: _port,
          wallet: _wallet,
        });
      })
    })
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

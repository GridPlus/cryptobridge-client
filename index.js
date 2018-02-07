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
  .command('create-wallet', 'Generate a new wallet. You will be prompted for a password')
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

// Add a bridge
if (argv.add) {
  // Add a bridge group
  const group = argv.add.split(',');
  if (group.length != 4) { console.log('ERROR: To add a bridge group, please pass arguments separated by commas: "network_a_host,network_a_address,network_b_host,network_b_address"')}
  config.addGroup(group, DIR, (err) => {
    if (err) { console.log(`ERROR: ${err}`) }
    else { console.log('Successfully added bridge group.')}
  })
}

// Bootstrap with peers
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

// Wallets - create or import
if (argv['create-wallet']) {
  let pw;
  let done = false;
  _createWallet();
}

if (argv.start) {
  // Get wallet
  let walletIndex;
  if (!argv.wallet) {
    // If no wallet is provided, pull the first one in DATADIR/wallets
    if (!fs.existsSync(`${DIR}/wallets`) || fs.readdirSync(`${DIR}/wallets`) == 0) {
      _createWallet();
    }
    walletIndex = 0;
  } else {
    // Otherwise the user passes in an index of the desired wallet file within
    // the DATADIR. This defaults to zero
    walletIndex = parseInt(argv.wallet);
  }
  let wallet = new Wallet();
  let seed = fs.readFileSync(`${DIR}/wallets/${fs.readdirSync(`${DIR}/wallets`)[0]}`);
  prompt.start();
  let q = 'Enter password to unlock wallet';
  prompt.get({ name: q, hidden: true, replace: '*' }, (err, res) => {
    wallet.rehydrate(seed.toString('utf8'), res[q]);
    // Start listening to peers and blockchains
    let peers;
    let clients;
    config.getPeers(DIR, INDEX, (err, _peers) => {
      peers = _peers;
      config.getHosts(DIR, INDEX, (err, _hosts) => {
        Clients.connectToClients(_hosts, (err, _clients) => {
          const _port = isNaN(parseInt(argv.start)) ? null : parseInt(argv.start);
          // Start a new Bridge client. This consists of a server listening to
          // a given port and handling socket messages from peers. The client
          // also checks linked web3 hosts for updated blockchain data.
          const b = new Bridge({
            index: INDEX,
            peers: _peers,
            clients: _clients,
            datadir: DIR,
            port: _port,
            wallet: wallet,
          });
          console.log(`Wallet address: ${wallet.getAddress()}`)
          console.log('Bridge client started')
        })
      })
    })
  })
}

function _createWallet() {
  let qText = ['Password', 'Re-enter password'];

  let questions = [{
    name: qText[0],
    hidden: true,
    replace: '*'
  }, {
    name: qText[1],
    hidden: true,
    replace: '*'
  }];
  prompt.start();
  prompt.get(questions, (err, res) => {
    if (res[qText[0]] != res[qText[1]]) {
      console.log('Error: Your passwords do not match')
    } else {
      const w = new Wallet({ password: res[qText[0]] });
      w.save(DIR)
    }
  })
}

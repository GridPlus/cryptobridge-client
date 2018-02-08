// Start your server and connect to peers
const fs = require('fs');
const jsonfile = require('jsonfile');
const leftPad = require('left-pad');
const net = require('net');
const prompt = require('prompt');
const config = require('./src/config.js');
const Bridge = require('./src/lib/Bridge.js');
const staking = require('./src/lib/util/staking.js');
const util = require('./src/lib/util/util.js');
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
  .command('list-wallets', 'List indices for saved wallets')
  .command('proposal-threshold', 'Number of blocks that must elapse before you will propose a root. Must be a power of two. Default 512')
  .alias('t', 'threshold')
  .command('stake', 'Stake a specified number of tokens. Must be coupled with --bridge (address) and may be coupled with --gasprice')
  .command('bridge', 'Bridge to stake on. This is the address of the bridge contract. Must be part of a bridge you have previously saved.')
  .command('gasprice', 'Gas price to use when making a transaction')
  .argv;

console.log('Bridge Client v0.1\n')

// Datadir
let DIR = `${process.cwd()}/data`;
let INDEX = null;
let WALLET = null;
if (argv.datadir) { DIR = argv.datadir; }
if (!fs.existsSync(DIR)) { fs.mkdirSync(DIR); }

// Setup the logger
Log.setLogger(DIR);

// Numerical parameters/config
let THRESH = 512;
if (argv['proposal-threshold']) { THRESH = util.lastPowTwo(argv['proposal-threshold']); }


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
  _createWallet((w) => {
    console.log(`Created wallet with address ${w.getAddress()}`);
  });
}

// Get wallet list
if (argv['list-wallets']) {
  if (!fs.existsSync(`${DIR}/wallets`) || fs.readdirSync(`${DIR}/wallets`) == 0) {
    console.log('No wallets saved. You can create one with --create-wallet');
  } else {
    _getAddresses(fs.readdirSync(`${DIR}/wallets`), (addrs) => {
      console.log('Saved wallets:')
      addrs.forEach((addr, i) => {
        console.log(`[${i}]\t${addr}`)
      })
    })
  }
}


// If process is being started, it needs a wallet. User can specify a wallet
// index with --wallet (or -w) or create a new wallet if none exists.
// File index starts with unix timestamp, so order of creation is preserved.
if (argv.start) {
  if (!fs.existsSync(`${DIR}/wallets`) || fs.readdirSync(`${DIR}/wallets`) == 0) {
    // If there are no saved wallets, create a new wallet
    console.log("No wallet detected. Let's create one.")
    _createWallet((_wallet) => {
      WALLET = _wallet;
    });
  } else if (argv.wallet) {
    // If an index was passed, rehydrate the wallet with that file's data
    if (isNaN(parseInt(argv.wallet))) {
      console.log('Error parsing wallet input. Please provide an index for which wallet to use. To see saved wallets, select --list-wallets');
    }
    const path = `${DIR}/wallets/${fs.readdirSync(`${DIR}/wallets`)[parseInt(argv.wallet)]}`;
    _unlockWallet(path, (_wallet) => {
      WALLET = _wallet;
      start();
    })
  } else {
    // Otherwise, unlock the default wallet (index 0)
    const path = `${DIR}/wallets/${fs.readdirSync(`${DIR}/wallets`)[0]}`;
    _unlockWallet(path, (_wallet) => {
      WALLET = _wallet;
      start();
    })
  }
}

// Start the server and p2p connections
function start() {
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
          proposeThreshold: THRESH,
          wallet: WALLET,
        });
        console.log(`Wallet address: ${WALLET.getAddress()}`)
        console.log('Bridge client started')
      })
    })
  })
};

// Stake tokens
if (argv.stake) {
  if (isNaN(parseInt(argv.stake))) { console.log('Please supply an integer to --stake')}
  if (!argv.bridge) { console.log('You must specify a bridge address (--bridge) if you wish to stake tokens'); }
  if (!fs.existsSync(`${DIR}/wallets`) || fs.readdirSync(`${DIR}/wallets`) == 0) {
    console.log("No wallet detected. Create one with --create-wallet");
  }
  const walletIndex = argv.wallet ? argv.wallet : 0;
  const path = `${DIR}/wallets/${fs.readdirSync(`${DIR}/wallets`)[parseInt(walletIndex)]}`;
  _unlockWallet(path, (wallet) => {
    config.getAllHosts(DIR, (err, hosts) => {
      let host;
      let client;
      hosts.forEach((h) => { if (h[0] == argv.bridge) { host = h[1]; } })
      if (!host) { console.log('Bridge not found. You can add a bridge with --add'); }
      else {
        // Connect to the client
        Clients.connectToClients([host], (err, clients) => {
          if (err) { console.log('Error connecting to clients', err); }
          else if (clients) {   // Not sure why, but sometimes clients is undefined
            client = clients[0];
            const from = wallet.getAddress();
            const gasPrice = argv.gasprice ? argv.gasprice : 1000000000;
            console.log(`Staking ${argv.stake} tokens from ${from} on ${host}`)
            staking.stake(argv.bridge, argv.stake, from, client, wallet, gasPrice);
          }
        })
      }
    })
  })
}


// Given a seed (saved in a wallet file), rehydrate a wallet with a password
function _unlockWallet(path, cb) {
  let wallet = new Wallet();
  prompt.start();
  let q = 'Enter password to unlock wallet';
  prompt.get({ name: q, hidden: true, replace: '*' }, (err, res) => {
    if (err) { throw new Error('Could not unlock wallet.'); }
    wallet.rehydrate(path, res[q]);
    cb(wallet);
  })
}

// Create a new wallet with a password. It will save that to a file in an
// encrypted seed.
function _createWallet(cb) {
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
      cb(w);
    }
  })
}

// Given a set of file paths, get addresses
function _getAddresses(paths, cb, addrs=[]) {
  if (paths.length == 0) { cb(addrs.reverse()); }
  else {
    const path = paths.pop();
    jsonfile.readFile(`${DIR}/wallets/${path}`, (err, data) => {
      if (err) { throw new Error('Could not get addresses. Wallet file(s) may be corrupted.'); }
      else {
        addrs.push(data.address);
        _getAddresses(paths, cb, addrs);
      }
    })
  }
}

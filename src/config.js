// Connect to and handle networks
const fs = require('fs');
const jsonfile = require('jsonfile');

// Network indexes are formatted `networkA_networkB` where each network is
// represented by the address of the deployed bridge contract on the given
// blockchain.
exports.getNetIndex = function(networks) {
  const tmpA = parseInt(networks[0]);
  const tmpB = parseInt(networks[1]);
  if (tmpB > tmpA) { return `${tmpA}_${tmpB}`; }
  else { return `${tmpB}_${tmpA}`; }
}

exports.getFirstIndex = function(dir) {
  const fPath = `${dir}/config.json`;
  try {
    const config = jsonfile.readFileSync(fPath);
    return Object.keys(config)[0];
  } catch(err) {
    throw new Error(err);
  }
}


// Add a bridge group. This consists of a network entry point (host) and bridge
// contract address on two separate networks that are bridged. They are ordered
// into networkA and networkB based on what the bridge contract addresses evaluate
// to.
exports.addGroup = function(group, dir, cb) {
  const fPath = `${dir}/config.json`;
  let hostA;
  let hostB;
  let addrA;
  let addrB;
  if (parseInt(group[3]) > parseInt(group[1])) {
    hostA = group[0];
    addrA = group[1];
    hostB = group[2];
    addrB = group[3];
  } else {
    hostA = group[2];
    addrA = group[3];
    hostB = group[0];
    addrB = group[1];
  }
  _ifExists(fPath, (err, data, exists) => {
    if (err) { cb(err); }
    else {
      const i = `${addrA}_${addrB}`;
      if (!exists) {
        data = {};
        data[i] = { };
      };
      let isSaved = false;
      Object.keys(data).forEach((k) => {
        if (data[k].hostA == hostA && data[k].hostB == hostB && data[k].addrA == addrA && data[k].addrB == addrB) { isSaved = true; }
      })
      if (isSaved) { cb('Bridge group already saved.'); }
      else {
        data[i].hostA = hostA;
        data[i].hostB = hostB;
        data[i].addrA = addrA;
        data[i].addrB = addrB;
        // Create files for header data
        if (!fs.existsSync(`${dir}/${addrA}`)) { fs.mkdirSync(`${dir}/${addrA}`); }
        if (!fs.existsSync(`${dir}/${addrB}`)) { fs.mkdirSync(`${dir}/${addrB}`); }

        jsonfile.writeFile(fPath, data, { spaces: 2 }, (err, success) => {
          if (err) { cb(err); }
          else { cb(null); }
        })
      }
    }
  })
}

// Add a set of peers to the config file. These are represented as host:port
// and are comma separated. The peer groups are indexed based on the networks
exports.addPeers = function(peers, dir, index, cb) {
  const fPath = `${dir}/config.json`
  _ifExists(fPath, (err, data, exists) => {
    if (err) { cb(err); }
    else {
      if (!exists) { cb('ERROR: Config file does not exist. Start by adding a bridge with --add') }
      else if (!data[index].peers) { data[index].peers = [] }
      // Add the peers in a list
      peers.forEach((peer) => {
        data[index].peers.push(`${peer.host.host}:${peer.host.port}`);
      })
      jsonfile.writeFile(fPath, data, { spaces: 2}, (err, success) => {
        if (err) { cb(err); }
        else { cb(null); }
      })
    }
  })
}

// Get saved peers in an index
exports.getPeers = function(dir, index, cb) {
  const fPath = `${dir}/config.json`;
  _ifExists(fPath, (err, data, exists) => {
    if (err) { cb(err); }
    else if (!exists) { cb('No peers saved.'); }
    else { cb(null, data[index].peers); }
  })
}

// Get saved hosts (web3 connectios) in an index
exports.getHosts = function(dir, index, cb) {
  const fPath = `${dir}/config.json`;
  _ifExists(fPath, (err, data, exists) => {
    if (err) { cb(err); }
    else if (!exists) { cb('No peers saved.'); }
    else { cb(null, [ data[index].hostA, data[index].hostB ]); }
  })
}

function _ifExists(path, cb) {
  jsonfile.readFile(path, (err, f) => {
    if (err && err.code != 'ENOENT') { cb(err); }
    else if (err && err.code == 'ENOENT') { cb(null, {}, false); }
    else { cb(null, f, true); }
  })
}

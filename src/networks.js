// Connect to and handle networks
const fs = require('fs');
const jsonfile = require('jsonfile');

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
  jsonfile.readFile(fPath, (err, f) => {
    if (err && err.code == 'ENOENT') { f = { groups: [] } }
    if (err && err.code != 'ENOENT') { cb(err); }
    else {
      let isSaved = false;
      f.groups.forEach((g) => {
        if (g.hostA == hostA && g.hostB == hostB && g.addrA == addrA && g.addrB == addrB) { isSaved = true; }
      })
      if (isSaved) { cb('Bridge group already saved.'); }
      else {
        f.groups.push({ hostA, hostB, addrA, addrB })
        jsonfile.writeFile(fPath, f, { spaces: 2 }, (err, success) => {
          if (err) { cb(err); }
          else { cb(null); }
        })
      }
    }
  })
}

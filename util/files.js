// Functions for managing files
const fs = require('fs');
const Promise = require('bluebird').Promise;

// Get a list of peers, stored as host addresses separated by commas.
function getSavedPeers(path=`${process.cwd()/data}`) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (err, peers) => {
      if (err) { return reject(err); }
      else { return resolve(peers.slice(',')); }
    });
  });
}

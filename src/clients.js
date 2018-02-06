// Connect to and handle data from web3 clients
const Web3 = require('web3');

// Load a list of connections to web3 clients
function connectToClients(hosts, cb, clients=[]) {
  if (hosts.length == 0) {
    // Clients will be in reverse order
    cb(null, clients.reverse()); 
  } else {
    try {
      const host = hosts.pop();
      const web3 = new Web3(new Web3.providers.HttpProvider(host));
      clients.push(web3);
      connectToClients(hosts, cb, clients);
    } catch (err) {
      cb(err);
    }
  }
}
exports.connectToClients = connectToClients;

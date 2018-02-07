// Wallet for signing messages and making transactions
const crypto = require('crypto');
const ethwallet = require('ethereumjs-wallet');
const ethutil = require('ethereumjs-util');

class Wallet {
  constructor(opts) {
    
    this.wallet = new ethwallet(opts.pkey || crypto.randomBytes(32))
  }

  salt(n, r) {

  }

  // Get the address of this wallet
  getAddress() {
    return '0x' + this.wallet.getAddress().toString('hex');
  }

  // Sign a message hash
  sign(h) {
    return ethutil.sign(h, this.wallet._privKey)
  }
}

module.exports = Wallet;

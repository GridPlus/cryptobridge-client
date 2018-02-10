// Wallet for signing messages and making transactions
const crypto = require('crypto');
const ethwallet = require('ethereumjs-wallet');
const ethutil = require('ethereumjs-util');
const ethtx = require('ethereumjs-tx');
const fs = require('fs');
const cipherAlgo = 'AES-256-CFB8';
const jsonfile = require('jsonfile');

class Wallet {
  constructor(opts) {
    if (!opts) { opts = {}; }
    this.password = opts.password ? opts.password : '';
    this.wallet = new ethwallet(crypto.randomBytes(32));
  }

  save(dir=`${process.cwd()}`) {
    const cipher = crypto.createCipher(cipherAlgo, this.password);
    let crypted = cipher.update(this.wallet.getPrivateKey().toString('hex'), 'utf8', 'hex')
    crypted += cipher.final('hex');
    if (!fs.existsSync(`${dir}/wallets`)) { fs.mkdirSync(`${dir}/wallets`); }
    let fPath = `${dir}/wallets/${new Date().getTime()}_${crypto.randomBytes(8).toString('hex')}`;
    let f = {
      seed: crypted,
      address: this.getAddress(),
    };
    jsonfile.writeFile(fPath, f, { flag: 'a+', spaces: 2}, (err) => {
      if (err) { throw new Error(`Could not save wallet file: ${err}`)}
    })
  }

  rehydrate(fPath, password) {
    jsonfile.readFile(fPath, (err, f) => {
      const decipher = crypto.createDecipher(cipherAlgo, password);
      let decrypted = decipher.update(f.seed, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      this.wallet = new ethwallet(Buffer.from(decrypted, 'hex'))
    })
  }

  // Get the address of this wallet
  getAddress() {
    return '0x' + this.wallet.getAddress().toString('hex');
  }

  // Sign a message hash
  sign(h) {
    if (h.substr(0, 2) == '0x') { h = h.slice(2); }
    const _sig = ethutil.ecsign(Buffer.from(h, 'hex'), this.wallet._privKey)
    let sig = {
      r: _sig.r.toString('hex'),
      s: _sig.s.toString('hex'),
      v: _sig.v
    };
    console.log('\n------------------\nsigned from', this.getAddress(), '\n--------------------------\n')
    return sig;
  }

  // Sign a transaction
  signTx(txParams) {
    const tx = new ethtx(txParams);
    tx.sign(this.wallet.getPrivateKey());
    return `0x${tx.serialize().toString('hex')}`;
  }
}

module.exports = Wallet;

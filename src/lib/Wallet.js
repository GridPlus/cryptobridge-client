// Wallet for signing messages and making transactions
const crypto = require('crypto');
const ethwallet = require('ethereumjs-wallet');
const ethutil = require('ethereumjs-util');
const fs = require('fs');
const cipherAlgo = 'AES-256-CFB8';

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
    fs.open(fPath, 'a+', (err, f) => {
      fs.writeFileSync(fPath, crypted);
    })
  }

  rehydrate(data, password) {
    const decipher = crypto.createDecipher(cipherAlgo, password);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    this.wallet = new ethwallet(Buffer.from(decrypted, 'hex'))
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

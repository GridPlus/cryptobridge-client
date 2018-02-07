// Wallet for signing messages and making transactions
const crypto = require('crypto');
const ethwallet = require('ethereumjs-wallet');
const ethutil = require('ethereumjs-util');
const fs = require('fs');

class Wallet {
  constructor(opts) {
    console.log('opts', opts)
    this.password = opts.password ? opts.password : '';
    console.log('this.pw', this.password)
    this.wallet = new ethwallet(crypto.randomBytes(32));
  }

  save(dir=`${process.cwd()}`) {
    console.log('pw', this.password)
    const cipher = crypto.createCipher('AES-256-CFB8', this.password);
    let crypted = cipher.update(this.wallet.getPrivateKey(), 'utf8', 'hex')
    crypted += cipher.final('hex');
    if (!fs.existsSync(`${dir}/wallets`)) { fs.mkdirSync(`${dir}/wallets`); }
    let fPath = `${dir}/wallets/${new Date().getTime()}_${crypto.randomBytes(8).toString('hex')}`;
    fs.open(fPath, 'a+', (err, f) => {
      fs.writeFileSync(fPath, crypted);
    })
  }

  // rehydrate(fPath, )



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

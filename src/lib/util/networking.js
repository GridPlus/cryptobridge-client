// Setup a host to map to an externally facing IP via NAT-PMP
// https://tools.ietf.org/html/draft-cheshire-nat-pmp-03
const natpmp = require('nat-pmp');
const netroute = require('netroute');

exports.getExternalIp = function(port) {
  console.log('hello')
  const gateway = netroute.getGateway();
  const client = new natpmp.Client(gateway);
  client.portMapping({ public: port, private: port, ttl: 0 }, (err, info) => {
    console.log('goodbye')
    if (err) { console.log('error', err); }
    else { console.log('info', info); }
  })
}

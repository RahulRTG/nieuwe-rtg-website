/* Eigen HTTP/2-listener op node:http2 (kern, geen dependency), als opt-in naast
   node:http en onze HTTP/1.1-motor. HTTP/2 multiplext veel kleine verzoeken over
   een verbinding (geen head-of-line-blocking op protocolniveau) en comprimeert
   headers (HPACK); dat scheelt op app-boot met veel losse calls en assets.

   Twee modi, allebei via de compat-laag (dezelfde (req,res)-vorm die ons web-
   framework verwacht, zodat de app ongewijzigd blijft):
   - MET TLS (RTG_TLS_CERT + RTG_TLS_KEY): createSecureServer met ALPN 'h2' en
     allowHTTP1:true, zodat browsers HTTP/2 spreken en oudere clients gewoon
     HTTP/1.1 op dezelfde poort houden. Dit is de productievorm.
   - ZONDER cert: cleartext HTTP/2 (h2c) voor lokaal/test, waar geen certificaat
     voorhanden is.

   Opt-in met RTG_EIGEN_HTTP2=1 (web.listen kiest hem). Node's node:http blijft
   de veilige standaard. */
'use strict';
const http2 = require('http2');
const fs = require('fs');

function maakServer(app) {
  const certPad = process.env.RTG_TLS_CERT;
  const keyPad = process.env.RTG_TLS_KEY;
  if (certPad && keyPad) {
    // Productie: HTTP/2 over TLS, met HTTP/1.1 als terugval op dezelfde poort.
    return http2.createSecureServer({
      cert: fs.readFileSync(certPad),
      key: fs.readFileSync(keyPad),
      allowHTTP1: true
    }, app);
  }
  // Lokaal/test: cleartext HTTP/2 (h2c), geen certificaat nodig.
  return http2.createServer(app);
}

module.exports = { maakServer };

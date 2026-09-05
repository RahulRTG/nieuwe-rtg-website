/* PostgreSQL SSLRequest en geverifieerde TLS-upgrade.

   Afgesplitst van client.js om de wireclient leesbaar te houden. De transport-
   policy beslist vooraf óf een verbinding is toegestaan; deze laag voert de
   beloofde CA- en hostnaamcontrole werkelijk uit. */
'use strict';

const net = require('net');
const tls = require('tls');

function openSsl(client, opts, reject) {
  // SSLRequest: Int32(8), Int32(80877103); server antwoordt S of N.
  const rauw = net.connect(opts, () => {
    const m = Buffer.alloc(8);
    m.writeInt32BE(8, 0); m.writeInt32BE(80877103, 4); rauw.write(m);
  });
  rauw.once('data', (antwoord) => {
    if (antwoord[0] !== 0x53) {
      reject(new Error('pg: server weigert SSL')); rauw.destroy(); return;
    }
    const ssl = client.cfg.ssl && typeof client.cfg.ssl === 'object' ? client.cfg.ssl : {};
    const verifieer = ssl.rejectUnauthorized !== false;
    const identiteit = String(ssl.servername || client.cfg.host || opts.host);
    const tlsOpties = { socket: rauw, rejectUnauthorized: verifieer,
      minVersion: ssl.minVersion || 'TLSv1.2' };
    /* IP-adressen horen niet in SNI, maar worden wel als IP-SAN gecontroleerd.
       Namen worden zowel als SNI als verificatie-identiteit doorgegeven. */
    if (net.isIP(identiteit) === 0) tlsOpties.servername = identiteit;
    if (verifieer)
      tlsOpties.checkServerIdentity = (_naam, cert) => tls.checkServerIdentity(identiteit, cert);
    for (const naam of ['ca', 'cert', 'key', 'crl', 'ciphers']) {
      if (ssl[naam] != null) tlsOpties[naam] = ssl[naam];
    }
    const veilig = tls.connect(tlsOpties, () => {
      if (verifieer && !veilig.authorized) {
        const e = new Error('pg: TLS-peer niet vertrouwd' +
          (veilig.authorizationError ? ': ' + veilig.authorizationError : ''));
        client._fout(e); veilig.destroy(); return;
      }
      client._verzendStartup();
    });
    client.sock = veilig;
    veilig.setNoDelay(true);
    veilig.on('data', data => client._ontvang(data));
    veilig.on('error', fout => client._fout(fout));
    veilig.on('close', () => client._sluiten());
  });
  rauw.on('error', fout => client._fout(fout));
  return rauw;
}

module.exports = { openSsl };

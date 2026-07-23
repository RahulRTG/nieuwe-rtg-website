/* Eigen INTERNE certificaat-autoriteit (CA), in huis op onze x509-laag. Waar de
   ACME-client (lib/acme) certificaten voor PUBLIEKE domeinen bij Let's Encrypt
   haalt, geeft deze CA certificaten uit voor het EIGEN, interne verkeer: mTLS
   tussen de RTG-servers onderling, de zaakdoos, de noodserver en losse instances.
   Een intern component vertrouwt alleen ons CA-cert (de trust anchor) en accepteert
   dan elk certificaat dat wij ondertekenden -- en niets anders.

   Root -> leaf (geen intermediates: pathLen 0). Het TEKENEN doet Node's crypto;
   wij bouwen alleen de X.509/CRL-bytes. De CA-sleutel en de intrekkingslijst staan
   onder <datamap>/tls/ca en worden NOOIT gecommit (zie .gitignore). */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const x509 = require('./x509');

function serieel() { const b = crypto.randomBytes(16); b[0] &= 0x7f; if (!b[0]) b[0] = 1; return b; } // positief, niet-nul

function maakCA(opties) {
  opties = opties || {};
  const basis = opties.dataDir || process.env.RTG_DATA_DIR || path.join(__dirname, '..', 'data');
  const dir = path.join(basis, 'tls', 'ca');
  try { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); } catch (e) {}
  const caCrtPad = path.join(dir, 'ca.crt'), caKeyPad = path.join(dir, 'ca.key'), revPad = path.join(dir, 'ingetrokken.json');
  const naam = { cn: opties.naam || 'RTG Interne CA', org: opties.org || 'Rahul Travel Group' };

  // Bestaande root-CA laden, of eenmalig een nieuwe maken en persisteren (0600).
  let caCertPem, caKeyPem, vers = false;
  try { caCertPem = fs.readFileSync(caCrtPad, 'utf8'); caKeyPem = fs.readFileSync(caKeyPad, 'utf8'); }
  catch (e) {
    const paar = x509.genKeyPair({ type: opties.keyType || 'ec' });
    const r = x509.bouwCert({ subjectNaam: naam, subjectSpkiDer: paar.spkiDer, subjectType: paar.type,
      issuerNaam: naam, issuerKey: paar, issuerSkiDer: x509.skiVan(paar.spkiDer), isCA: true, pathLen: 0, days: (opties.jaren || 10) * 365 });
    caCertPem = r.certPem; caKeyPem = paar.keyPem; vers = true;
    try { fs.writeFileSync(caCrtPad, caCertPem, { mode: 0o600 }); fs.writeFileSync(caKeyPad, caKeyPem, { mode: 0o600 }); } catch (x) {}
  }
  const privateKey = crypto.createPrivateKey(caKeyPem);
  const caKeyObj = { type: privateKey.asymmetricKeyType === 'rsa' ? 'rsa' : 'ec', privateKey };
  const caSpkiDer = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const caSki = x509.skiVan(caSpkiDer);

  function laadRev() { try { return JSON.parse(fs.readFileSync(revPad, 'utf8')); } catch (e) { return []; } }
  function bewaarRev(lijst) { try { fs.writeFileSync(revPad, JSON.stringify(lijst), { mode: 0o600 }); } catch (e) {} }

  /* Geef een certificaat uit voor een GEGEVEN publieke sleutel (SPKI-DER). Voor
     een server-cert (serverAuth) of, met isClient, een client-cert (clientAuth)
     voor mTLS-authenticatie. Geeft de serial terug zodat je 'm later kunt intrekken. */
  function geefUitVoorSpki(o) {
    const serial = serieel();
    const namen = o.names || (o.cn ? [o.cn] : []);
    const r = x509.bouwCert({
      subjectNaam: { cn: o.cn || namen[0], org: o.org }, subjectSpkiDer: o.spkiDer, subjectType: o.subjectType || 'ec',
      issuerNaam: naam, issuerKey: caKeyObj, issuerSkiDer: caSki, namen, isClient: !!o.isClient, days: o.days || 397, serial
    });
    return { certPem: r.certPem, chainPem: r.certPem + caCertPem, serial: serial.toString('hex') };
  }
  /* Maak zelf een sleutelpaar EN geef er een certificaat voor uit (het gemak dat
     een intern component nodig heeft: één aanroep -> cert + key + keten). */
  function geefUit(o) {
    o = o || {};
    const leaf = x509.genKeyPair({ type: o.keyType || 'ec' });
    return Object.assign({ keyPem: leaf.keyPem },
      geefUitVoorSpki({ spkiDer: leaf.spkiDer, subjectType: leaf.type, cn: o.cn, names: o.names, days: o.days, isClient: o.isClient, org: o.org }));
  }
  // Trek een certificaat in (op serial); komt in de CRL te staan.
  function trekIn(serialHex) {
    serialHex = String(serialHex).toLowerCase();
    const lijst = laadRev();
    if (!lijst.some(r => String(r.serial).toLowerCase() === serialHex)) { lijst.push({ serial: serialHex, datum: new Date().toISOString() }); bewaarRev(lijst); }
    return lijst.length;
  }
  function ingetrokkenLijst() { return laadRev(); }
  function crl() {
    const lijst = laadRev().map(r => ({ serial: r.serial, datum: r.datum }));
    return x509.maakCRL({ issuerNaam: naam, issuerKey: caKeyObj, issuerSkiDer: caSki, ingetrokken: lijst, nummer: lijst.length, geldigDagen: 7 });
  }

  return {
    caCertPem, caKeyPem, naam, ski: caSki, vers,
    bundelPem: () => caCertPem,                       // de trust anchor voor interne clients
    geefUit, geefUitVoorSpki, geefUitServer: (o) => geefUit(Object.assign({}, o, { isClient: false })),
    geefUitClient: (o) => geefUit(Object.assign({}, o, { isClient: true })),
    trekIn, ingetrokken: ingetrokkenLijst, crlPem: () => crl().crlPem, crlDer: () => crl().crlDer,
    info: () => x509.certInfo(caCertPem)
  };
}

module.exports = { maakCA };

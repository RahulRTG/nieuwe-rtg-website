/* De boot-lijm tussen de native TLS-server (lib/tls) en de ACME-client (lib/acme):
   op aanvraag (env-gated, standaard UIT) haalt de app bij het opstarten zelf een
   echt Let's Encrypt-certificaat en laadt dat LIVE in de draaiende TLS-server
   (geen herstart). Alles wat privaat is -- de ACME-accountsleutel en het
   opgehaalde certificaat -- staat onder <datamap>/tls en wordt nooit gecommit.

   HTTP-01 heeft poort 80 nodig (de CA haalt daar de challenge op). Deze module
   start daarvoor een kleine HTTP-responder die de challenge serveert en al het
   overige verkeer naar HTTPS stuurt (301) -- zo is de klassieke "http -> https"-
   redirect meteen geregeld, zonder aparte reverse proxy. */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const x509 = require('./x509');
const { maakAcme, maakUitdagingWinkel, planVernieuwing } = require('./acme');

function tlsMap(dataDir) {
  const basis = dataDir || process.env.RTG_DATA_DIR || path.join(__dirname, '..', 'data');
  const dir = path.join(basis, 'tls');
  try { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); } catch (e) {}
  return dir;
}

/* De ACME-accountsleutel: eenmalig maken en persisteren (0600). Dezelfde account
   over herstarts heen betekent dat Let's Encrypt ons herkent (en de rate-limits
   niet telkens opnieuw raken). */
function laadAccountSleutel(dataDir) {
  const pad = path.join(tlsMap(dataDir), 'acme-account.key');
  try { return fs.readFileSync(pad, 'utf8'); }
  catch (e) {
    const key = x509.genKeyPair({ type: 'ec' }).keyPem;
    try { fs.writeFileSync(pad, key, { mode: 0o600 }); } catch (x) {}
    return key;
  }
}

// Het live certificaat op schijf (keten + sleutel), voor warme herstart en om te
// beslissen of vernieuwen nodig is.
function certPaden(dataDir) { const d = path.join(tlsMap(dataDir), 'live'); try { fs.mkdirSync(d, { recursive: true, mode: 0o700 }); } catch (e) {} return { cert: path.join(d, 'fullchain.pem'), key: path.join(d, 'privkey.pem') }; }
function bewaarCert(dataDir, certPem, keyPem) { const p = certPaden(dataDir); fs.writeFileSync(p.cert, certPem, { mode: 0o600 }); fs.writeFileSync(p.key, keyPem, { mode: 0o600 }); }
function laadCert(dataDir) { const p = certPaden(dataDir); try { return { cert: fs.readFileSync(p.cert, 'utf8'), key: fs.readFileSync(p.key, 'utf8') }; } catch (e) { return null; } }

/* Start de hele ACME-lus. Geeft { httpServer, planner, stop, status } terug nadat
   het (initiële) certificaat er is. Injecteerbaar voor de test: maakVraag levert
   de HTTP-transport (standaard de echte lib/http), http01Poort=0 kan in de test.
   Faalt de uitgifte, dan blijft de app gewoon op het self-signed cert draaien. */
async function startAcme(opties) {
  const { server, domains, email, dataDir } = opties;
  const dagenVoor = opties.dagenVoor || 30;
  const log = opties.log || (() => {});
  const winkel = maakUitdagingWinkel();
  const vraag = (opties.maakVraag || (() => require('./http').vraag))(winkel);
  const client = maakAcme({ accountKey: laadAccountSleutel(dataDir), winkel, staging: opties.staging, vraag, directoryUrl: opties.directoryUrl });

  // Poort 80: challenge serveren + al het andere naar HTTPS sturen (301).
  const httpServer = http.createServer((req, res) => {
    const p = String(req.url || '').split('?')[0];
    if (p.startsWith('/.well-known/acme-challenge/')) return winkel.middleware(req, res, () => { res.statusCode = 404; res.end('Not Found'); });
    const host = String(req.headers.host || (domains && domains[0]) || '').split(':')[0];
    res.statusCode = 301; res.setHeader('Location', 'https://' + host + (req.url || '/')); res.end();
  });
  await new Promise((r) => httpServer.listen(opties.http01Poort != null ? opties.http01Poort : 80, r));

  async function verversNu() {
    const c = await client.verkrijgCertificaat({ domains, email });
    bewaarCert(dataDir, c.certPem, c.keyPem);
    if (server && server.herlaadCert) server.herlaadCert(c.certPem, c.keyPem);
    return c;
  }

  // Hebben we al een geldig cert op schijf? Dan meteen inladen en pas vernieuwen
  // als het bijna verloopt -- scheelt een onnodige uitgifte bij elke herstart.
  // Mislukt de uitgifte, dan NOOIT gooien: de app blijft op het self-signed cert
  // draaien, de HTTP-01-responder blijft staan, en de planner probeert het later
  // opnieuw. We geven altijd een stopbare handle terug (geen dangling poort-80).
  let status;
  try {
    const bestaand = laadCert(dataDir);
    if (bestaand && x509.certInfo(bestaand.cert).validTo.getTime() - Date.now() > dagenVoor * 86400000) {
      if (server && server.herlaadCert) server.herlaadCert(bestaand.cert, bestaand.key);
      status = 'hergebruikt';
      log('[tls] bestaand certificaat hergebruikt (geldig tot ' + x509.certInfo(bestaand.cert).validTo.toISOString() + ')');
    } else {
      const c = await verversNu();
      status = 'nieuw';
      log('[tls] nieuw Let\'s Encrypt-certificaat, geldig tot ' + c.geldigTot.toISOString());
    }
  } catch (e) {
    status = 'mislukt';
    log('[tls] ACME-uitgifte mislukt; app blijft op het self-signed cert: ' + e.message);
  }

  const planner = planVernieuwing({ server, dagenVoor, log, huidigCert: () => { const b = laadCert(dataDir); return b && b.cert; }, verkrijg: verversNu });
  return { httpServer, planner, status, verversNu, stop: () => { try { httpServer.close(); } catch (e) {} try { planner.stop(); } catch (e) {} } };
}

module.exports = { startAcme, laadAccountSleutel, bewaarCert, laadCert, tlsMap };

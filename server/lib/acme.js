/* Eigen ACME v2-client (RFC 8555) voor Let's Encrypt -- de app haalt en vernieuwt
   ECHTE certificaten zelf, zonder certbot en zonder externe proxy. Het is JSON
   over HTTPS met een nonce-protocol; elk verzoek is een JWS die met de account-
   sleutel is ondertekend (lib/jws). We doen HTTP-01: de app bewijst dat ze de
   domeinnaam beheert door op http://<domein>/.well-known/acme-challenge/<token>
   de juiste sleutel te serveren.

   De HTTP-client (lib/http) en de klok zijn injecteerbaar, zodat de hele
   toestandsmachine offline tegen een nep-ACME-server te testen is -- geen echte
   Let's Encrypt nodig in de test. De echte, live uitgifte staat in PRODUCTION.md.

   Certificaten worden NOOIT gecommit (zie .gitignore); de accountsleutel en de
   opgehaalde certificaten staan onder <datamap>/tls. */
'use strict';
const jws = require('./jws');
const x509 = require('./x509');

const LE_PROD = 'https://acme-v02.api.letsencrypt.org/directory';
const LE_STAGING = 'https://acme-staging-v02.api.letsencrypt.org/directory';

function veiligJSON(tekst) { try { return JSON.parse(tekst); } catch (e) { return null; } }

/* De challenge-winkel: token -> keyAuthorization. De app serveert deze op de
   .well-known-route (via de middleware) zolang de validatie loopt. */
function maakUitdagingWinkel() {
  const m = new Map();
  return {
    zet: (token, keyAuth) => m.set(token, keyAuth),
    haal: (token) => m.get(token) || null,
    weg: (token) => m.delete(token),
    aantal: () => m.size,
    // Express-achtige middleware: beantwoordt alleen de acme-challenge-paden,
    // laat de rest door. Mount met app.use(winkel.middleware).
    middleware: (req, res, next) => {
      const p = String(req.url || '').split('?')[0];
      const pre = '/.well-known/acme-challenge/';
      if (!p.startsWith(pre)) return next();
      const keyAuth = m.get(p.slice(pre.length));
      if (!keyAuth) { res.statusCode = 404; return res.end('Not Found'); }
      res.statusCode = 200; res.setHeader('Content-Type', 'text/plain'); res.end(keyAuth);
    }
  };
}

function maakAcme(opties) {
  opties = opties || {};
  const vraag = opties.vraag || require('./http').vraag;
  const slaap = opties.slaap || ((ms) => new Promise(r => setTimeout(r, ms)));
  const directoryUrl = opties.directoryUrl || (opties.staging ? LE_STAGING : LE_PROD);
  const winkel = opties.winkel || maakUitdagingWinkel();
  // De accountsleutel (EC P-256): het "wie ben ik" van de ACME-account.
  const accountKey = opties.accountKey || x509.genKeyPair({ type: 'ec' }).privateKey;
  const { alg, jwk } = jws.jwkVan(accountKey);
  const duim = jws.thumbprint(jwk);
  let nonce = null, kid = null, dir = null;

  async function haalDirectory() { if (!dir) dir = (await vraag({ url: directoryUrl, method: 'GET', maxRetries: 1 })).json(); return dir; }
  async function haalNonce() {
    const d = await haalDirectory();
    const r = await vraag({ url: d.newNonce, method: 'HEAD', maxRetries: 1 });
    nonce = r.headers['replay-nonce'] || null;
  }

  // Een ondertekende ACME-POST (of POST-as-GET met payload==''). Herhaalt één keer
  // bij een badNonce (het protocol geeft dan een verse nonce terug).
  async function post(url, payload, herhaald) {
    if (!nonce) await haalNonce();
    const beschermd = { alg, nonce, url };
    if (kid) beschermd.kid = kid; else beschermd.jwk = jwk;
    const body = JSON.stringify(jws.tekenJWS(beschermd, payload, accountKey));
    const r = await vraag({ url, method: 'POST', headers: { 'content-type': 'application/jose+json' }, body, maxRetries: 0 });
    nonce = r.headers['replay-nonce'] || null;
    const parsed = veiligJSON(r.tekst);
    if (r.status === 400 && !herhaald && parsed && /badNonce/.test(parsed.type || '')) return post(url, payload, true);
    return { status: r.status, headers: r.headers, body: parsed, tekst: r.tekst };
  }

  // Poll een resource tot 'valid' (of gooi bij 'invalid'); begrensd aantal beurten.
  async function wachtOp(haal, opties2) {
    const max = (opties2 && opties2.beurten) || 30, pauze = (opties2 && opties2.pauze) || 2000;
    for (let i = 0; i < max; i++) {
      const s = await haal();
      if (s && s.status === 'valid') return s;
      if (s && s.status === 'invalid') throw new Error('ACME: ' + JSON.stringify(s.error || s.status));
      await slaap(pauze);
    }
    throw new Error('ACME: time-out bij het wachten op "valid"');
  }

  /* De hele flow: account -> order -> HTTP-01 per domein -> finalize met CSR ->
     certificaat ophalen. Geeft { certPem (keten), keyPem, geldigTot } terug. */
  async function verkrijgCertificaat(o) {
    const domeinen = o.domains;
    const d = await haalDirectory();
    // account (maakt 'm aan of vindt de bestaande); de account-URL wordt onze kid
    const acc = await post(d.newAccount, { termsOfServiceAgreed: true, contact: o.email ? ['mailto:' + o.email] : [] });
    if (acc.status >= 400) throw new Error('ACME account-fout ' + acc.status + ': ' + (acc.body && acc.body.detail || acc.tekst));
    kid = acc.headers['location'];
    // order voor de domeinen
    const order = await post(d.newOrder, { identifiers: domeinen.map(dom => ({ type: 'dns', value: dom })) });
    if (order.status >= 400) throw new Error('ACME order-fout ' + order.status + ': ' + (order.body && order.body.detail || order.tekst));
    const orderUrl = order.headers['location'];
    let staat = order.body;
    // elke autorisatie via HTTP-01 oplossen
    for (const authUrl of staat.authorizations) {
      const auth = await post(authUrl, '');                                   // POST-as-GET
      const ch = (auth.body.challenges || []).find(c => c.type === 'http-01');
      if (!ch) throw new Error('ACME: geen http-01-challenge voor ' + (auth.body.identifier && auth.body.identifier.value));
      winkel.zet(ch.token, ch.token + '.' + duim);                            // keyAuthorization
      await post(ch.url, {});                                                 // "ik ben er klaar voor"
      await wachtOp(() => post(authUrl, '').then(r => r.body), { pauze: o.pauze });
      winkel.weg(ch.token);
    }
    // CSR maken en de order finaliseren
    const certPaar = x509.genKeyPair({ type: o.keyType || 'ec' });
    const { csrDer } = x509.maakCSR({ key: certPaar, cn: domeinen[0], names: domeinen });
    const fin = await post(staat.finalize, { csr: jws.b64url(csrDer) });
    if (fin.status >= 400) throw new Error('ACME finalize-fout ' + fin.status + ': ' + (fin.body && fin.body.detail || fin.tekst));
    // wachten tot de order 'valid' is, dan het certificaat (PEM-keten) ophalen
    staat = await wachtOp(() => post(orderUrl, '').then(r => r.body), { pauze: o.pauze });
    const certRes = await post(staat.certificate, '');
    const certPem = certRes.tekst;
    return { certPem, keyPem: certPaar.keyPem, geldigTot: x509.certInfo(certPem).validTo };
  }

  return { verkrijgCertificaat, winkel, thumbprint: duim, jwk, _post: post };
}

/* Vernieuwingsplanner: kijk periodiek of het huidige cert binnen `dagenVoor`
   dagen verloopt en haal dan een nieuw op, dat de TLS-server LIVE inlaadt
   (server.herlaadCert) -- geen herstart, geen verbroken verbindingen. Draait
   alleen als ACME expliciet is aangezet; de timer houdt het proces niet vast. */
function planVernieuwing(opties) {
  const { server, huidigCert, verkrijg, log, dagenVoor = 30, elkeUur = 12 } = opties;
  const nu = opties.nu || (() => Date.now());
  async function ronde() {
    try {
      const info = huidigCert() && x509.certInfo(huidigCert());
      const overDagen = info ? (info.validTo.getTime() - nu()) / 86400000 : -1;
      if (overDagen > dagenVoor) return;
      const nieuw = await verkrijg();
      if (nieuw && server && server.herlaadCert) server.herlaadCert(nieuw.certPem, nieuw.keyPem);
      if (log) log('ACME: certificaat vernieuwd, geldig tot ' + (nieuw && nieuw.geldigTot));
    } catch (e) { if (log) log('ACME-vernieuwing mislukt: ' + e.message); }
  }
  const timer = setInterval(ronde, elkeUur * 3600000);
  if (timer.unref) timer.unref();
  return { ronde, stop: () => clearInterval(timer) };
}

module.exports = { maakAcme, maakUitdagingWinkel, planVernieuwing, LE_PROD, LE_STAGING };

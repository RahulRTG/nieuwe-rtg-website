/* RTG Zegel: "bewijs alles, toon niets, werkt offline".

   Een lid bewijst een FEIT aan een partner (18+, geldig lid, welke pas) zonder
   de onderliggende data te tonen: geen naam, geen geboortedatum, geen pasnummer.
   Het zegel is een compact, ondertekend token dat de partner-app met alleen de
   PUBLIEKE sleutel controleert -- dus offline, zonder serveroproep.

   Drie eigenschappen die dit uniek maken, allemaal op onze eigen node:crypto:
   1. Selectieve onthulling: alleen expliciet toegestane claims gaan mee; ruwe
      persoonsgegevens komen er nooit in.
   2. Offline verifieerbaar: Ed25519-handtekening; controleer() heeft geen server,
      geen state -- alleen de publieke sleutel.
   3. Onkoppelbare identiteit: het onderwerp is een PAARSGEWIJS pseudoniem
      (HMAC over codenaam + partner). Twee partners kunnen een lid nooit
      onderling matchen; hetzelfde lid bij dezelfde partner blijft wel herkenbaar.

   Geen eigen cryptografie uitgevonden: puur Ed25519 + HMAC-SHA256 uit node:crypto. */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Alleen deze claims mogen in een zegel. Zo kan er per ongeluk nooit een ruw
// persoonsgegeven (naam, geboortedatum, ...) in belanden: selectieve onthulling.
const CLAIMS_TOEGESTAAN = new Set(['leeftijd18', 'leeftijd21', 'lid', 'pas', 'foundation', 'zakelijk']);

const b64u = (b) => Buffer.from(b).toString('base64url');

/* Pure, offline verificatie: alleen de publieke sleutel (base64url SPKI-DER)
   nodig. Geen server, geen state. Dit is wat een partner-app draait. */
function controleer(token, publiekeSleutelB64u, nu) {
  try {
    const punt = String(token).indexOf('.');
    if (punt < 0) return { geldig: false, reden: 'vorm' };
    const p = String(token).slice(0, punt);
    const s = String(token).slice(punt + 1);
    const pub = crypto.createPublicKey({ key: Buffer.from(publiekeSleutelB64u, 'base64url'), format: 'der', type: 'spki' });
    const payload = Buffer.from(p, 'base64url');
    if (!crypto.verify(null, payload, pub, Buffer.from(s, 'base64url'))) return { geldig: false, reden: 'handtekening' };
    const data = JSON.parse(payload.toString('utf8'));
    const t = nu || Math.floor(Date.now() / 1000);
    if (data.exp && t > data.exp) return { geldig: false, reden: 'verlopen', sub: data.sub };
    return { geldig: true, sub: data.sub, claims: data.claims || {}, exp: data.exp, partner: data.aud || null };
  } catch (e) { return { geldig: false, reden: 'fout' }; }
}

/* EEN SLEUTEL PUBLICEREN, EN DAT IS IETS ANDERS DAN HEM SCHRIJVEN.

   Hier stond `existsSync` gevolgd door `writeFileSync`. Dat is kijken-dan-doen
   over PROCESSEN, en in de vloot (server/vloot.js) komen er vier tegelijk op
   dezelfde datamap:

     1 proces A: existsSync -> false, begint te schrijven
     2 proces B: existsSync -> TRUE  (het bestand bestaat, de inhoud nog niet)
     3 proces B: leest leeg, en createPrivateKey gooit
        error:1E08010C:DECODER routines::unsupported

   Dat is geen hypothese: op 15 september 2026 viel er in CI een servergroep op
   om, in test/eigenaar-wedloop.test.js -- een toets die over het eigenaars-
   ACCOUNT gaat en deze fout dus bij toeval vond. test/zegel-wedloop.test.js
   lokt hem gericht uit.

   WAAROM link() EN NIET rename(). De voor de hand liggende reparatie is
   volledig naar een tijdelijk bestand schrijven en dat hernoemen. Die is wel
   atomair, maar de LAATSTE schrijver wint -- en dan draagt elk proces een
   andere sleutel en verifieert het ene de tokens van het andere niet meer. Er
   valt dan niets meer om; er klopt alleen niets meer, en dat faalt stiller dan
   de wedloop zelf. link() faalt met EEXIST in plaats van te overschrijven, dus
   de EERSTE schrijver wint en iedereen leest daarna dezelfde sleutel.

   EN HIJ REGENEREERT NOOIT STIL. Staat er iets dat niet te lezen is, dan gooit
   deze functie met de naam van het bestand erbij. Een onleesbare sleutel
   vervangen zou elk bestaand token ongeldig maken zonder dat iemand erom
   vroeg -- dat is een besluit van een mens, niet van een opstartpad. */
function publiceer(pad, inhoud) {
  const tmp = pad + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, inhoud, { mode: 0o600 });
  try {
    fs.linkSync(tmp, pad);
  } catch (e) {
    /* EEXIST is de normale uitkomst van een verloren wedloop: een ander proces
       was ons voor, en we lezen hieronder gewoon zijn sleutel. Elke andere fout
       betekent dat er NIET atomair gepubliceerd kon worden, en dan hoort het
       opstarten hardop te stoppen: stil terugvallen op een gewone schrijfactie
       zet de wedloop terug die deze functie juist weghaalt. */
    if (e.code !== 'EEXIST') {
      try { fs.unlinkSync(tmp); } catch (e2) { /* opruimen mag de fout niet maskeren */ }
      throw new Error('de sleutel ' + path.basename(pad) + ' kon niet atomair worden gepubliceerd: ' +
        (e && e.message || e));
    }
  }
  try { fs.unlinkSync(tmp); } catch (e) { /* het tijdelijke bestand is klaar met zijn werk */ }
}

/* Lees wat er staat, of publiceer en lees dan wat er staat -- want bij een
   verloren wedloop is dat de sleutel van een ander proces en niet de onze. */
function leesOfPubliceer(pad, maak, lees) {
  if (!fs.existsSync(pad)) publiceer(pad, maak());
  return lees(pad);
}

/* De uitgevende kant: houdt de geheime Ed25519-sleutel en de HMAC-master vast
   (in de datamap, 0600, staat in .gitignore -- net als de andere sleutels). */
function maakZegel({ dataDir }) {
  const sleutelPad = path.join(dataDir, 'zegel.key');
  const masterPad = path.join(dataDir, 'zegel-master.key');
  let priv, pubDer, master;

  const pem = leesOfPubliceer(sleutelPad,
    () => crypto.generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }),
    (p) => fs.readFileSync(p, 'utf8'));
  try {
    priv = crypto.createPrivateKey(pem);
  } catch (e) {
    throw new Error('de zegelsleutel in ' + sleutelPad + ' is niet te lezen (' + (e && e.message || e) +
      '). Hij wordt met opzet NIET vervangen: dat zou elk bestaand token ongeldig maken. ' +
      'Zet hem terug uit een reservekopie, of verwijder hem bewust om een nieuwe te laten maken.');
  }
  pubDer = crypto.createPublicKey(priv).export({ type: 'spki', format: 'der' });

  master = leesOfPubliceer(masterPad, () => crypto.randomBytes(32), (p) => fs.readFileSync(p));

  function publiekeSleutel() { return b64u(pubDer); }

  // Paarsgewijs pseudoniem: stabiel per (codenaam, partner), onkoppelbaar erbuiten.
  function pseudoniem(codenaam, partner) {
    return 'pw_' + crypto.createHmac('sha256', master).update(String(codenaam) + '|' + String(partner || 'RTG')).digest('base64url').slice(0, 16);
  }

  // Maak een zegel. claims wordt gefilterd op de whitelist (selectieve onthulling);
  // geldigMin is de levensduur in minuten (kort: het is een momentbewijs).
  function zegel({ codenaam, partner, claims, geldigMin }) {
    const toegestaan = {};
    for (const k of Object.keys(claims || {})) if (CLAIMS_TOEGESTAAN.has(k)) toegestaan[k] = claims[k];
    const iat = Math.floor(Date.now() / 1000);
    const data = {
      v: 1, sub: pseudoniem(codenaam, partner), aud: partner || null,
      claims: toegestaan, iat, exp: iat + Math.max(1, Math.min(1440, Number(geldigMin) || 5)) * 60
    };
    const payload = Buffer.from(JSON.stringify(data));
    const p = payload.toString('base64url');
    const s = crypto.sign(null, payload, priv).toString('base64url');
    return p + '.' + s;
  }

  return {
    publiekeSleutel, pseudoniem, zegel,
    controleer: (token, nu) => controleer(token, publiekeSleutel(), nu)
  };
}

module.exports = { maakZegel, controleer, CLAIMS_TOEGESTAAN };

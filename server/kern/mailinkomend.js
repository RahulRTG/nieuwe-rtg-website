/* INKOMENDE POST VAN BUITEN: uitpakken, stempelen, en het origineel bewaren.

   De buitenpoort van het huis (routes/werkmail.js -> werkmail.buitenIn) nam tot
   nu toe een afzender, een onderwerp en platte tekst aan. Dat werkt zolang er
   een provider voor staat die het echte werk doet. Zodra RTG zijn eigen post
   ontvangt, komt er een RFC 5322-bericht binnen: koppen, MIME-delen, base64,
   bijlagen, en een afzender die van alles beweert.

   VIER REGELS, en de laatste is de belangrijkste:

   1. HET ORIGINEEL BLIJFT ONGEWIJZIGD BEWAARD. Wat wij ervan maken is een
      afgeleide. Voor een audit, een juridische bewaarplicht of gewoon om een
      fout te kunnen navertellen, moet je terug kunnen naar de bytes zoals ze
      binnenkwamen. Wie alleen het resultaat bewaart, kan achteraf nooit
      aantonen wat er stond.
   2. DE UITSLAG VAN DE CONTROLES WORDT OPGESLAGEN, NIET WEGGEGOOID. SPF, DKIM
      en DMARC leveren een oordeel; dat hoort bij het bericht te blijven staan,
      ook als het "geen" is. `Authentication-Results` van een tussenliggende
      server wordt GELEZEN maar nooit als waarheid aangenomen -- die kop kan
      iedereen typen.
   3. WAT WIJ NIET BEGRIJPEN, VERZINNEN WE NIET. Een onbekende codering levert
      een leesbare melding op, geen half ontcijferde tekst.
   4. ALLES VAN BUITEN IS ONBETROUWD. Dat was al zo (kern/rtmail.js), en deze
      laag verandert er niets aan: links blijven onklikbaar, bijlagen worden
      geregistreerd maar niet opgeslagen als iets dat te openen valt. Een
      ontleder die van een bijlage een bestand maakt, is precies de plek waar
      een malwarelaag hoort te zitten -- en die hebben we hier niet, dus doen
      we het niet. */
'use strict';

const MAX = 2 * 1024 * 1024;   // een binnenkomend bericht boven 2 MB nemen we niet aan

// een kop-blok naar een object; doorgevouwen regels (RFC 5322) worden hersteld
function koppenVan(kop) {
  const uit = {};
  const regels = String(kop).split(/\r?\n/);
  let huidig = null;
  for (const r of regels) {
    if (/^[ \t]/.test(r) && huidig) { uit[huidig] += ' ' + r.trim(); continue; }
    const i = r.indexOf(':');
    if (i < 0) continue;
    huidig = r.slice(0, i).toLowerCase().trim();
    uit[huidig] = (uit[huidig] ? uit[huidig] + ', ' : '') + r.slice(i + 1).trim();
  }
  return uit;
}

// =?UTF-8?B?...?= en =?...?Q?...?= terugvertalen; onbekend blijft staan zoals het is
function ontcijferKop(s) {
  return String(s == null ? '' : s).replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (heel, set, wijze, data) => {
    try {
      if (/^b$/i.test(wijze)) return Buffer.from(data, 'base64').toString(/utf-?8/i.test(set) ? 'utf8' : 'latin1');
      const q = data.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
      return Buffer.from(q, 'binary').toString(/utf-?8/i.test(set) ? 'utf8' : 'latin1');
    } catch (e) { return heel; }
  });
}

function ontcijferLijf(data, codering, charset) {
  const c = String(codering || '').toLowerCase();
  const set = /utf-?8/i.test(charset || '') ? 'utf8' : 'latin1';
  try {
    if (c === 'base64') return { ok: true, tekst: Buffer.from(data.replace(/\s+/g, ''), 'base64').toString(set) };
    if (c === 'quoted-printable') {
      const q = data.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
      return { ok: true, tekst: Buffer.from(q, 'binary').toString(set) };
    }
    if (!c || c === '7bit' || c === '8bit' || c === 'binary') return { ok: true, tekst: data };
  } catch (e) { /* valt hieronder door */ }
  return { ok: false, waarom: 'de codering "' + c + '" begrijpt deze laag niet; de tekst is niet omgezet' };
}

const grensVan = (ct) => (/boundary\s*=\s*"?([^";]+)"?/i.exec(ct || '') || [])[1] || null;
const charsetVan = (ct) => (/charset\s*=\s*"?([^";]+)"?/i.exec(ct || '') || [])[1] || null;
const adresVan = (s) => (/<([^>]+)>/.exec(s || '') || [null, String(s || '').trim()])[1] || '';

/* Een MIME-boom platslaan tot: de beste tekst, en een lijst bijlagen. "Beste"
   is text/plain boven text/html -- niet uit smaak maar omdat RTMAIL platte
   tekst rendert en HTML hier nooit wordt uitgevoerd. */
function delen(kop, lijf, diep) {
  const ct = kop['content-type'] || 'text/plain';
  const grens = grensVan(ct);
  if (!grens || (diep || 0) > 4) {
    const uit = ontcijferLijf(lijf, kop['content-transfer-encoding'], charsetVan(ct));
    const naam = (/filename\s*=\s*"?([^";]+)"?/i.exec(kop['content-disposition'] || '') || [])[1] || null;
    if (naam || /^application\//i.test(ct)) {
      return { tekst: '', bijlagen: [{ naam: naam || '(zonder naam)', soort: ct.split(';')[0].trim(), bytes: lijf.length }] };
    }
    return { tekst: uit.ok ? uit.tekst : '[' + uit.waarom + ']', bijlagen: [], html: /^text\/html/i.test(ct) };
  }
  const stukken = String(lijf).split(new RegExp('--' + grens.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  let plat = '', html = '';
  const bijlagen = [];
  for (const s of stukken) {
    const t = s.replace(/^\r?\n/, '');
    if (!t.trim() || /^--/.test(t)) continue;
    const scheiding = t.search(/\r?\n\r?\n/);
    if (scheiding < 0) continue;
    const k = koppenVan(t.slice(0, scheiding));
    const l = t.slice(scheiding).replace(/^\r?\n\r?\n/, '');
    const d = delen(k, l, (diep || 0) + 1);
    bijlagen.push(...d.bijlagen);
    if (d.html) html = html || d.tekst;
    else plat = plat || d.tekst;
  }
  return { tekst: plat || html, bijlagen };
}

module.exports = ({ db, save, crypto, dkim }) => {
  const nu = () => new Date().toISOString();

  function O() {
    if (!db.data.mailIn || typeof db.data.mailIn !== 'object') db.data.mailIn = { originelen: [] };
    if (!Array.isArray(db.data.mailIn.originelen)) db.data.mailIn.originelen = [];
    return db.data.mailIn;
  }

  /* De uitslag van de drie controles. DKIM rekenen we ECHT na als er een
     publieke sleutel wordt meegegeven; SPF en DMARC vragen DNS en een IP en
     worden hier dus als "niet gecontroleerd" gemeld in plaats van als "goed".
     Dat verschil is het hele punt: een systeem dat niet-gecontroleerd als
     geslaagd toont, is misleidender dan een systeem dat niets toont. */
  function stempel(koppen, lijf, { publiekeSleutel, ip } = {}) {
    const uit = { dkim: 'geen', spf: 'niet gecontroleerd', dmarc: 'niet gecontroleerd', ip: ip || null };
    const veld = koppen['dkim-signature'];
    if (veld) {
      uit.dkim = 'aanwezig, niet nagerekend (geen publieke sleutel meegegeven)';
      if (publiekeSleutel && dkim) {
        try {
          const r = dkim.controleer({ koppen, lijf, veld, publiekeSleutel });
          uit.dkim = r.ok ? 'geslaagd' : 'GEZAKT: ' + r.waarom;
        } catch (e) { uit.dkim = 'GEZAKT: ' + e.message; }
      }
    }
    /* Wat een tussenliggende server beweert, bewaren we als BEWERING. Nooit als
       uitslag -- die kop kan iedereen typen. */
    if (koppen['authentication-results']) uit.beweerdDoorOnderweg = koppen['authentication-results'].slice(0, 300);
    if (koppen['arc-authentication-results']) uit.arc = koppen['arc-authentication-results'].slice(0, 300);
    return uit;
  }

  /* Een ruw bericht ontleden. Geeft altijd iets bruikbaars terug of een fout
     met de reden -- nooit een half ontcijferd bericht. */
  function ontleed(ruw, opties) {
    const s = String(ruw == null ? '' : ruw);
    if (!s.trim()) return { error: 'Er kwam een leeg bericht binnen.' };
    if (s.length > MAX) return { error: 'Dit bericht is groter dan ' + (MAX / 1048576) + ' MB en wordt niet aangenomen.' };
    const scheiding = s.search(/\r?\n\r?\n/);
    if (scheiding < 0) return { error: 'Dit bericht heeft geen kop-blok; het is geen e-mail.' };
    const koppen = koppenVan(s.slice(0, scheiding));
    const lijf = s.slice(scheiding).replace(/^\r?\n\r?\n/, '');
    if (!koppen.from) return { error: 'Een bericht zonder From nemen we niet aan.' };
    const d = delen(koppen, lijf, 0);
    return { ok: true,
      van: adresVan(koppen.from), naar: adresVan(koppen.to),
      onderwerp: ontcijferKop(koppen.subject) || '(geen onderwerp)',
      tekst: String(d.tekst || '').slice(0, 20000),
      bijlagen: d.bijlagen.slice(0, 40),
      messageId: koppen['message-id'] || null,
      datum: koppen.date || null,
      koppen, controles: stempel(koppen, lijf, opties || {}) };
  }

  /* Het origineel wegleggen. Alleen de bytes en een verwijzing; de afgeleide
     staat in RTMAIL. Bewust begrensd, want dit is de enige plek in het huis
     waar we ruwe post van buiten bewaren. */
  function bewaarOrigineel(ruw, afgeleideId) {
    const o = O();
    const rij = { id: crypto.randomBytes(6).toString('hex'), bericht: afgeleideId || null,
      bytes: Buffer.byteLength(String(ruw)), ruw: String(ruw).slice(0, MAX), at: nu() };
    o.originelen.unshift(rij);
    o.originelen = o.originelen.slice(0, 5000);
    save();
    return { id: rij.id, bytes: rij.bytes };
  }
  const origineel = (id) => O().originelen.find(r => r.id === id || r.bericht === id) || null;

  return { ontleed, stempel, bewaarOrigineel, origineel, koppenVan, ontcijferKop, ontcijferLijf, delen, adresVan };
};

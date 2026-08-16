/* Kern-module "De Ontsmetter": de eigen malware-scanner van RTG.

   EERLIJK over wat dit is: dit is GEEN kernel-antivirus die de computer van een
   bezoeker scant -- dat is een ander soort product en dat zouden we niet waar
   kunnen maken. Dit is de best mogelijke afweer voor het PLATFORM zelf: elk
   bestand en elke payload die RTG binnenkomt (paspoortfoto's, selfies, uploads)
   wordt gescand met dezelfde technieken die een echte antivirus gebruikt --
   handtekeningen, heuristiek en entropie -- en besmette of verdachte inhoud
   wordt geweigerd, in quarantaine gezet en op het boardroom-bord gemeld.

   Technieken:
   1. HANDTEKENINGEN (updatebare definities): bekende kwaadaardige byte- en
      tekstpatronen -- de EICAR-testhandtekening (de industriestandaard om een
      scanner te testen), uitvoerbare-bestand-magie (PE/MZ, ELF, Mach-O), scripts
      verstopt in afbeeldingen (<?php, <script), webshell-patronen
      (eval(base64_decode, shell_exec, ...) en gevaarlijke PDF-/macro-tokens.
   2. HEURISTIEK: magie-vs-opgegeven-type (een "png" die in werkelijkheid een
      .exe is), dubbele extensie (foto.jpg.exe), gevaarlijke extensie.
   3. ENTROPIE: Shannon-entropie om verpakte/versleutelde payloads te betrappen
      die zich als iets onschuldigs voordoen.

   De definities zijn DATA (updatebaar): nieuwe handtekeningen toevoegen kan
   De definities staan in ./definities.js, de analyse in ./analyse.js. Deze
   fabriek houdt de tellingen bij, meldt op het bord en bewaakt de uploads. */

const crypto = require('crypto');
const { standaardDefinities, GEVAARLIJKE_EXT } = require('./definities');
const { hexNaarBytes, entropie, beginMet, magieKlopt, handtekeningScan, laagAf,
  MAX_LAAG, MAX_UITPAK, HEX } = require('./analyse');
module.exports = (ctx) => {
  ctx = ctx || {};
  const db = ctx.db || { data: {} };
  const save = ctx.save || function () {};
  const beveilig = ctx.beveilig || null;
  const wacht = ctx.wacht || null; // optioneel: bron in quarantaine voorstellen
  let definities = standaardDefinities();

  function S() {
    if (!db.data.av) db.data.av = { totaal: 0, besmet: 0, verdacht: 0, schoon: 0, laatste: [], versie: 1 };
    return db.data.av;
  }

  /* De pure scan: geef een verdict terug zonder iets te wijzigen.
     verdict: 'schoon' | 'verdacht' | 'besmet'. */
  function scan(buf, meta) {
    meta = meta || {};
    if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf || '');
    const redenen = [];
    let ernst = 'schoon';
    const hef = (e) => { if (e === 'besmet' || (e === 'verdacht' && ernst === 'schoon')) ernst = e; };

    // 1. handtekeningen
    for (const d of definities) {
      if (d.mimes && !d.mimes.includes(String(meta.mime || ''))) continue;
      let raak = false;
      if (d.type === 'tekst') {
        raak = buf.indexOf(Buffer.from(d.patroon, 'latin1')) !== -1;
      } else if (d.type === 'bytes' && HEX.test(d.patroon)) {
        const naald = hexNaarBytes(d.patroon);
        raak = d.waar === 'start' ? beginMet(buf, naald) : buf.indexOf(naald) !== -1;
      }
      if (raak) { redenen.push('handtekening: ' + d.naam); hef(d.ernst); }
    }

    // 2. heuristiek: magie vs opgegeven type. Alleen 'verdacht' (niet hard
    // blokkeren): een echt uitvoerbaar bestand of webshell wordt al door zijn
    // eigen handtekening als 'besmet' gepakt; een enkele type-mismatch mag geen
    // legitieme-maar-ongewone upload tegenhouden.
    if (!magieKlopt(buf, meta.mime)) { redenen.push('type-vervalsing: de inhoud komt niet overeen met het opgegeven ' + meta.mime); hef('verdacht'); }

    // 3. heuristiek: gevaarlijke of dubbele extensie in de bestandsnaam
    const naam = String(meta.naam || '').toLowerCase();
    const delen = naam.split('.').filter(Boolean);
    if (delen.length >= 2 && GEVAARLIJKE_EXT.has(delen[delen.length - 1])) { redenen.push('gevaarlijke extensie: .' + delen[delen.length - 1]); hef('besmet'); }
    if (delen.length >= 3 && GEVAARLIJKE_EXT.has(delen[delen.length - 1])) { redenen.push('dubbele extensie: ' + naam); hef('besmet'); }

    // 4. heuristiek: entropie. Beeldformaten zijn van nature hoog-entropisch
    // (comprimeerd), dus alleen voor NIET-beeld opgegeven typen alarmeren.
    const isBeeld = /image\//.test(String(meta.mime || ''));
    const H = entropie(buf);
    if (!isBeeld && buf.length > 256 && H > 7.5) { redenen.push('hoge entropie (' + H.toFixed(2) + '): mogelijk verpakt/versleuteld'); hef('verdacht'); }

    // 5. multi-laag / obfuscatie: pel gzip-, deflate- en base64-lagen af en scan
    // de binnenkant op handtekeningen. Zo verstopt een aanvaller een webshell,
    // EICAR of uitvoerbaar bestand niet achter compressie of encoding. Begrensd
    // in diepte (MAX_LAAG) en uitpak-grootte (MAX_UITPAK) tegen zip-bommen.
    let laag = buf;
    for (let i = 0; i < MAX_LAAG; i++) {
      const binnen = laagAf(laag);
      if (!binnen) break;
      const bs = handtekeningScan(binnen, '', definities);
      if (bs.ernst !== 'schoon') {
        for (const r of bs.redenen) redenen.push('laag ' + (i + 1) + ': ' + r);
        hef(bs.ernst);
        // een container-laag (gzip/zip -> alleen 'verdacht') mag zelf nog een
        // besmette payload omhullen: doorpellen. Alleen bij een harde besmetting
        // stoppen we, want dieper zoeken voegt dan niets meer toe.
        if (bs.ernst === 'besmet') break;
      }
      laag = binnen;
    }

    return {
      verdict: ernst,
      redenen,
      entropie: Number(H.toFixed(2)),
      bytes: buf.length,
      sha256: crypto.createHash('sha256').update(buf).digest('hex')
    };
  }

  /* Scan + verwerk: telt mee, meldt op het bord bij verdacht/besmet, en stelt
     (als De Wacht meedraait) voor om de bron af te snijden bij een echte
     besmetting. Geeft het verdict terug zodat de route kan weigeren. */
  function legVast(r, meta) {
    meta = meta || {};
    const s = S();
    s.totaal += 1;
    s[r.verdict] = (s[r.verdict] || 0) + 1;
    if (r.verdict !== 'schoon') {
      s.laatste.unshift({ at: new Date().toISOString(), naam: meta.naam || '(upload)', verdict: r.verdict,
        redenen: r.redenen.slice(0, 4), sha256: r.sha256.slice(0, 16), bron: meta.bron || '' });
      if (s.laatste.length > 50) s.laatste.length = 50;
    }
    save();
    if (r.verdict !== 'schoon' && beveilig) {
      beveilig.meld('malware', r.verdict === 'besmet' ? 'kritiek' : 'waarschuwing',
        'De Ontsmetter ' + (r.verdict === 'besmet' ? 'BLOKKEERDE besmette' : 'markeerde verdachte') + ' upload' +
        (meta.bron ? ' van ' + meta.bron : '') + ': ' + r.redenen.join('; ') + '.',
        { bron: 'malware:' + (meta.bron || r.sha256.slice(0, 12)) });
    }
    // bij een harde besmetting: stel voor de bron af te snijden (mens beslist)
    if (r.verdict === 'besmet' && wacht && meta.bron) {
      try {
        wacht.voorstel({ soort: 'afweer', titel: 'Uploader afsnijden: ' + meta.bron,
          uitleg: 'Deze bron uploadde besmette inhoud (' + r.redenen.join('; ') + '). Voorstel: in quarantaine zetten.',
          actie: { soort: 'quarantaine', bron: meta.bron, reden: 'besmette upload' } });
      } catch (e) {}
    }
    return r;
  }

  function verwerk(buf, meta) {
    meta = meta || {};
    return legVast(scan(buf, meta), meta);
  }

  // Ook een ClamAV-treffer loopt door hetzelfde meld- en afsnijpad.
  function registreerExtern(oordeel, meta) {
    if (!oordeel || !['schoon', 'verdacht', 'besmet'].includes(oordeel.verdict))
      throw new Error('Ongeldig extern malware-oordeel.');
    return legVast(oordeel, meta || {});
  }

  // De decodeer- en groottepoort staat apart om deze scanner klein te houden.
  const scanDataUrl = require('./data-url')({ legVast, verwerk });

  // Praktische poort voor de intake-plekken: geef {ok:false, error} terug bij een
  // BESMET bestand (verdacht mag door, maar staat wel op het bord).
  function veiligeFoto(dataUrl, meta) {
    const r = scanDataUrl(dataUrl, meta);
    if (r.verdict === 'besmet') return { ok: false, error: 'Dit bestand is geweigerd door de beveiliging (mogelijke malware).', verdict: r.verdict };
    return { ok: true, verdict: r.verdict };
  }

  /* Loop door een verzoek-body (string/array/object, begrensde diepte) en scan
     elke ingesloten beeld-/PDF-data-URL. Geeft de EERSTE besmette treffer terug
     of null. Zo dekt één middleware alle upload-plekken (snaps, Salon, markt,
     clips, ...) zonder elke route apart te hoeven aanraken. */
  const DATA_URL_KOP = /^data:(image\/[a-z0-9.+-]+|application\/pdf);base64,/i;
  function scanBody(body, meta, diepte) {
    diepte = diepte || 0;
    if (diepte > 6 || body == null) return null;
    if (typeof body === 'string') {
      if (body.length > 64 && DATA_URL_KOP.test(body)) {
        const r = scanDataUrl(body, meta);
        if (r.verdict === 'besmet') return r;
      }
      return null;
    }
    if (Array.isArray(body)) {
      for (let i = 0; i < body.length && i < 200; i++) { const t = scanBody(body[i], meta, diepte + 1); if (t) return t; }
      return null;
    }
    if (typeof body === 'object') {
      for (const k of Object.keys(body)) { const t = scanBody(body[k], meta, diepte + 1); if (t) return t; }
    }
    return null;
  }

  function voegSignatuurToe(sig) {
    if (!sig || !sig.id || !sig.patroon) return false;
    if (definities.some(d => d.id === sig.id)) return false;
    definities.push({ id: String(sig.id).slice(0, 40), naam: String(sig.naam || sig.id).slice(0, 80),
      ernst: sig.ernst === 'besmet' ? 'besmet' : 'verdacht', type: sig.type === 'bytes' ? 'bytes' : 'tekst',
      waar: sig.waar === 'start' ? 'start' : 'overal', patroon: String(sig.patroon).slice(0, 200), mimes: sig.mimes || null });
    S().versie = (S().versie || 1) + 1; save();
    return true;
  }

  function stand() {
    const s = S();
    return { totaal: s.totaal, besmet: s.besmet, verdacht: s.verdacht, schoon: s.schoon,
      definities: definities.length, versie: s.versie, laatste: s.laatste.slice(0, 20) };
  }

  return { scan, verwerk, registreerExtern, scanDataUrl, veiligeFoto, scanBody, voegSignatuurToe, stand,
    definities: () => definities.map(d => ({ id: d.id, naam: d.naam, ernst: d.ernst })) };
};

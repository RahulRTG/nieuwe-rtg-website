/* DE KAART OP DIT TOESTEL -- ophalen, nakijken, weer weghalen.

   De server zegt wat er TE HALEN is (server/kern/navigatie/toestelpakket.js).
   Wat er STAAT weet alleen deze kant, en daarom meet dit bestand het in plaats
   van het te onthouden: geen lijstje in localStorage dat zegt "u hebt Frankrijk",
   maar een blik in de opslag zelf. Een onthouden lijst en een lege cache lopen
   binnen een week uit elkaar, en dan belooft het scherm een kaart die er niet is.

   DRIE DINGEN DIE EEN BROWSER ANDERS DOET DAN EEN TELEFOON-APP, en ze staan
   hier alle drie hardop:

     1. ZONDER HTTPS IS ER GEEN OPSLAG. `caches` en `crypto.subtle` bestaan
        alleen in een beveiligde context. Op http (behalve localhost) kan dit
        dus niet, en dan zegt `kan()` dat met de reden -- geen knop die stil
        niets doet.
     2. DE BROWSER MAG HET WEGGOOIEN. Opslag is niet van ons. We VRAGEN
        `navigator.storage.persist()`, en het antwoord staat op het scherm:
        blijft hij staan, of mag de browser hem opruimen als de schijf vol
        loopt? Beloven dat een kaart offline blijft, kan deze laag niet.
     3. EEN STUK BESTAND IS ERGER DAN GEEN BESTAND. Een afgekapte of omgekiepte
        graaf levert geen foutmelding maar een ROUTE: de motor leest onzin uit
        de typed arrays en rekent er een net uitziende weg mee. Elk deel wordt
        daarom tegen het controlegetal uit het manifest gehouden, en wat niet
        klopt gaat er meteen weer uit.

   DE OPSLAG IS DE CACHE STORAGE en niet IndexedDB: de delen zijn hele
   bestanden achter een adres, en dat is precies waar de Cache API voor is. De
   sleutel is het adres uit het manifest, zodat er geen tweede naamgeving
   ontstaat naast de server. */
(function (w) {
  'use strict';
  if (w.RTGKaartPakket) return;

  var BAK = 'rtg-kaart-v1';

  function kan() {
    if (!w.caches || !w.isSecureContext) {
      return { ok: false, reden: 'Deze browser geeft alleen op https opslag vrij voor kaarten. Op een ' +
        'onbeveiligde verbinding kan RTG een kaart dus niet op uw toestel zetten.' };
    }
    if (!(w.crypto && w.crypto.subtle)) {
      return { ok: false, reden: 'Deze browser kan een gedownloade kaart niet controleren, en een halve ' +
        'kaart levert routes op die er goed uitzien. RTG bewaart hem daarom niet.' };
    }
    return { ok: true };
  }

  function som(buffer) {
    return w.crypto.subtle.digest('SHA-256', buffer).then(function (d) {
      var u = new Uint8Array(d), s = '';
      for (var i = 0; i < 16; i++) s += u[i].toString(16).padStart(2, '0');
      return s;
    });
  }

  /* HET PLAATSELIJKE MANIFEST. Na een geslaagde download gaat het manifest dat
     de server stuurde MEE de bak in, onder een adres dat de server niet kent
     (`__manifest` staat niet in zijn gesloten lijst en zou daar 404 geven --
     precies goed: dit is plaatselijk en van niemand anders).

     Zonder dat stuk zou deze kant moeten weten hoeveel delen een pakket heeft,
     en dan staat de gesloten lijst van de server hier voor de tweede keer. Nu
     staat er een: het manifest van de bouw die werkelijk is binnengehaald --
     met de versie, de sommen en de naamsvermelding, zodat het scherm die ook
     OFFLINE kan noemen. ODbL vraagt vermelding zolang de gegevens er zijn, en
     niet alleen op het moment van downloaden. */
  var MERK = '__manifest';
  var voorVan = function (code) { return '/api/nav/gebied/pakket/' + String(code || '') + '/'; };

  /* Wat staat er van DIT gebied in de opslag? Gemeten uit de bak zelf, en
     nagekeken tegen het manifest dat bij de download hoorde. Geen manifest in
     de bak betekent: er is hier nooit een volledige download afgerond -- dan
     zegt deze functie hoeveel losse delen er liggen en `volledig: false`, met
     `bijGebrek` erbij zodat het scherm het verschil kan noemen. */
  async function stand(code) {
    var m = kan();
    if (!m.ok) return { kan: false, reden: m.reden, op: false, delen: 0, bytes: 0, volledig: false };
    var bak = await w.caches.open(BAK);
    var voor = voorVan(code);
    var sleutels = (await bak.keys()).filter(function (r) { return r.url.indexOf(voor) !== -1; });
    var mf = null;
    var mfAntwoord = await bak.match(voor + MERK);
    if (mfAntwoord) { try { mf = await mfAntwoord.json(); } catch (e) { mf = null; } }
    var delen = sleutels.filter(function (r) { return r.url.indexOf(voor + MERK) === -1; });
    var bytes = 0;
    for (var i = 0; i < delen.length; i++) {
      var a = await bak.match(delen[i]);
      if (a) bytes += (await a.arrayBuffer()).byteLength;
    }
    if (!mf || !Array.isArray(mf.delen)) {
      return { kan: true, op: false, volledig: false, delen: delen.length, bytes: bytes,
        bijGebrek: delen.length ? 'Er liggen ' + delen.length + ' losse delen van deze kaart, maar geen ' +
          'afgeronde download. RTG gebruikt hem niet.' : null };
    }
    var mist = [];
    for (var j = 0; j < mf.delen.length; j++) {
      var d = mf.delen[j];
      var got = await bak.match(d.adres);
      if (!got) { mist.push(d.naam); continue; }
      var lang = (await got.arrayBuffer()).byteLength;
      if (lang !== d.bytes) mist.push(d.naam);
    }
    return { kan: true, op: mist.length === 0, volledig: mist.length === 0, mist: mist,
      delen: delen.length, bytes: bytes, versie: mf.versie ?? null, gehaaldOp: mf.gehaaldOp || null,
      naamsvermelding: mf.naamsvermelding || null, licentie: mf.licentie || null,
      bytesVerwacht: mf.bytesTotaal ?? null };
  }

  /* HET PAKKET BINNENHALEN. Per deel: ophalen, controleren, bewaren. Valt er
     een deel af, dan gaat het HELE gebied er weer uit -- zeven achtste van een
     graaf is geen kaart, en laten staan zou betekenen dat de volgende ronde
     denkt dat er al iets is.

     De voortgang wordt per deel gemeld en niet per byte. Een reader per deel
     zou vloeiender zijn, maar dan houdt deze laag een groeiende lijst brokken
     vast NAAST wat de fetch zelf al buffert; bij een landgraaf is dat het
     verschil tussen krap en stuk. */
  async function haal(code, opties) {
    var o = opties || {};
    var m = kan();
    if (!m.ok) return { error: m.reden };
    var manifest = o.manifest;
    if (!manifest || !Array.isArray(manifest.delen)) return { error: 'Geen manifest om op te halen.' };
    var kop = o.token ? { Authorization: 'Bearer ' + o.token } : {};
    var bak = await w.caches.open(BAK);
    var gedaan = 0, bytes = 0;
    for (var i = 0; i < manifest.delen.length; i++) {
      var d = manifest.delen[i];
      if (typeof o.opVoortgang === 'function') {
        o.opVoortgang({ deel: d.naam, klaar: gedaan, totaal: manifest.delen.length, bytes: bytes });
      }
      var r = null;
      try { r = await fetch(d.adres, { headers: kop, cache: 'no-store' }); }
      catch (e) { r = null; }
      if (!r || !r.ok) {
        await weg(code);
        return { error: 'Het deel ' + d.naam + ' kwam niet binnen' + (r ? ' (' + r.status + ')' : '') +
          '. Er staat nu niets van deze kaart op dit toestel.' };
      }
      var buf = await r.arrayBuffer();
      if (buf.byteLength !== d.bytes || (await som(buf)) !== d.som) {
        await weg(code);
        return { error: 'Het deel ' + d.naam + ' kwam anders binnen dan RTG heeft klaargezet, dus RTG ' +
          'bewaart deze kaart niet. Een halve kaart rekent routes uit die er goed uitzien.' };
      }
      /* Bewaren met een eigen antwoord: het antwoord van de fetch is al
         gelezen, en de Cache API wil er een verse. */
      await bak.put(d.adres, new Response(buf, { headers: { 'Content-Type': d.soort || 'application/octet-stream',
        'Content-Length': String(buf.byteLength) } }));
      gedaan++; bytes += buf.byteLength;
    }
    /* Pas NU het manifest erbij, als laatste handeling: zolang het er niet
       staat, is dit een halve download en zegt `stand()` dat ook. Zou het merk
       vooraf gaan, dan zou een afgebroken download er compleet uitzien. */
    var merk = JSON.parse(JSON.stringify(manifest));
    merk.gehaaldOp = new Date().toISOString();
    await bak.put(voorVan(code) + MERK, new Response(JSON.stringify(merk),
      { headers: { 'Content-Type': 'application/json' } }));
    if (typeof o.opVoortgang === 'function') {
      o.opVoortgang({ deel: null, klaar: gedaan, totaal: manifest.delen.length, bytes: bytes });
    }
    return { ok: true, delen: gedaan, bytes: bytes, blijft: await blijftStaan() };
  }

  async function weg(code) {
    if (!w.caches) return { ok: false, weg: 0 };
    var bak = await w.caches.open(BAK);
    var voor = voorVan(code);
    var sleutels = await bak.keys();
    var n = 0;
    for (var i = 0; i < sleutels.length; i++) {
      if (sleutels[i].url.indexOf(voor) !== -1 && await bak.delete(sleutels[i])) n++;
    }
    return { ok: true, weg: n };
  }

  /* Mag de browser dit opruimen? `persisted()` zegt hoe het NU staat,
     `persist()` vraagt het. Beide kunnen ontbreken, en dan is het antwoord
     `null` -- onbekend, en dat is iets anders dan nee. */
  async function blijftStaan() {
    try {
      if (!navigator.storage) return null;
      if (navigator.storage.persisted && await navigator.storage.persisted()) return true;
      if (navigator.storage.persist) return await navigator.storage.persist();
      return null;
    } catch (e) { return null; }
  }

  async function ruimte() {
    try {
      if (!navigator.storage || !navigator.storage.estimate) {
        return { gebruikt: null, quotum: null, blijft: null,
          reden: 'Deze browser zegt niet hoeveel opslag er vrij is.' };
      }
      var s = await navigator.storage.estimate();
      return { gebruikt: s.usage ?? null, quotum: s.quota ?? null, blijft: await blijftStaan() };
    } catch (e) {
      return { gebruikt: null, quotum: null, blijft: null, reden: 'De opslag is niet te bevragen.' };
    }
  }

  w.RTGKaartPakket = { kan: kan, stand: stand, haal: haal, weg: weg, ruimte: ruimte, BAK: BAK };
}(window));

/* DE KAART OP DIT TOESTEL -- ophalen, nakijken, weer weghalen.

   De server zegt wat er TE HALEN is (server/kern/navigatie/toestelpakket.js).
   Wat er STAAT weet alleen deze kant, en daarom meet dit bestand het in plaats
   van het te onthouden: geen lijstje in localStorage dat zegt "u hebt Frankrijk",
   maar een blik in de opslag zelf. Een onthouden lijst en een lege cache lopen
   binnen een week uit elkaar, en dan belooft het scherm een kaart die er niet is.

   WAT DEZE BROWSER KAN EN BELOOFT staat in ./kaartopslag.js -- daar is dit
   bestand langs geknipt toen het over de 10 kB-grens ging. Hier staat het
   PAKKET: wat er ligt, hoe het binnenkomt en hoe het weer weggaat. Elk deel
   wordt tegen het controlegetal uit het manifest gehouden, want een afgekapte
   of omgekiepte graaf levert geen foutmelding maar een ROUTE.

   De sleutel in de opslag is het ADRES uit het manifest, zodat er geen tweede
   naamgeving ontstaat naast de server. */
(function (w) {
  'use strict';
  if (w.RTGKaartPakket) return;

  /* De opslagkant van dit toestel staat in ./kaartopslag.js: wat deze
     browser kan, hoeveel ruimte er is, of hij het bewaart, en hoe een
     controlegetal wordt gerekend. Ontbreekt dat bestand, dan kan deze laag
     niets -- en dan zegt `kan()` dat in plaats van te doen alsof. */
  var O = w.RTGKaartOpslag || null;
  var BAK = O ? O.BAK : 'rtg-kaart-v1';
  var kan = O ? O.kan : function () {
    return { ok: false, reden: 'De opslaglaag van RTG (shared/kaartopslag.js) is niet geladen, dus '
      + 'kan deze pagina geen kaart op uw toestel zetten.' };
  };
  var som = O ? O.som : function () { return Promise.resolve(null); };
  var blijftStaan = O ? O.blijftStaan : function () { return Promise.resolve(null); };

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
    /* DE LENGTE UIT DE KOP EN NIET UIT HET LICHAAM. Hier stond
       `(await a.arrayBuffer()).byteLength`, en dat leest bij elke keer dat het
       paneel opengaat de HELE graaf uit de opslag om hem op te tellen -- bij een
       landkaart honderden megabytes voor een getal dat al in de kop staat. Wij
       zetten die kop zelf bij het bewaren (`Content-Length`), dus hij is er; is
       hij er toch niet, dan blijft het bij `null` en niet bij een verzonnen nul
       (dat verschil ziet de toets: hij vergelijkt met bytesVerwacht). */
    var bytes = 0, lengteOnbekend = false;
    for (var i = 0; i < delen.length; i++) {
      var a = await bak.match(delen[i]);
      if (!a) continue;
      var lang = Number(a.headers.get('content-length'));
      if (Number.isFinite(lang) && lang > 0) bytes += lang; else lengteOnbekend = true;
    }
    if (!mf || !Array.isArray(mf.delen)) {
      return { kan: true, op: false, volledig: false, delen: delen.length,
        bytes: lengteOnbekend ? null : bytes,
        bijGebrek: delen.length ? 'Er liggen ' + delen.length + ' losse delen van deze kaart, maar geen ' +
          'afgeronde download. RTG gebruikt hem niet.' : null };
    }
    var mist = [];
    for (var j = 0; j < mf.delen.length; j++) {
      var d = mf.delen[j];
      var got = await bak.match(d.adres);
      if (!got) { mist.push(d.naam); continue; }
      /* Ook hier de kop en niet het lichaam. Ontbreekt de kop, dan is dit deel
         NIET nagekeken en telt het als ontbrekend -- niet als aanwezig. Bij een
         kaart is "ik weet het niet" hetzelfde waard als "hij is er niet". */
      var deelLang = Number(got.headers.get('content-length'));
      if (!Number.isFinite(deelLang) || deelLang !== d.bytes) mist.push(d.naam);
    }
    return { kan: true, op: mist.length === 0, volledig: mist.length === 0, mist: mist,
      delen: delen.length, bytes: lengteOnbekend ? null : bytes,
      versie: mf.versie ?? null, gehaaldOp: mf.gehaaldOp || null,
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

  /* `kan` en `ruimte` worden DOORGEGEVEN en niet nagebouwd: het scherm heeft
     EEN adres voor deze laag, en de regels wonen op een plek (LAT.md regel 4). */
  w.RTGKaartPakket = { kan: kan, stand: stand, haal: haal, weg: weg, BAK: BAK,
    ruimte: function () { return O ? O.ruimte() : Promise.resolve({ gebruikt: null, quotum: null,
      blijft: null, reden: 'De opslaglaag is niet geladen.' }); } };
}(window));

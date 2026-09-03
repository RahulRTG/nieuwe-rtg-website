/* DE VIJANDIGE RANDEN -- de ontleders die bytes van BUITEN lezen.

   STANDAARD.md par. 6 stelt de eis: elk pad dat bytes van buiten ontleedt,
   draagt een budget -- op lengte, op diepte en op tijd. De nul-afhankelijkheden-
   keuze is een besliste positie met een normtand en een gemeten voordeel, maar
   zij verplaatst het risico: RTG is zijn eigen leverancier, en dan hoort de
   rekening van een leverancier betaald te worden.

   DIT BESTAND IS DIE REKENING VOOR TWEE ONTLEDERS, en allebei stonden ze open
   toen het werd geschreven -- niet als vermoeden maar uitgevoerd:

     server/webauthn/cbor.js       negen bytes blokkeerden de event-loop 9,3
                                   seconden. Bereikbaar voor elk INGELOGD lid
                                   via POST /api/webauthn/registreer.
     server/pgwire/protocol.js     foutVelden() liep oneindig door zodra een
                                   NUL-afsluiter ontbrak.

   WAAROM TIJD HIER EEN BEWERING IS EN GEEN GEVOEL. Node is een draad. Een
   ontleder die op negen bytes negen seconden rekent, is niet een trage route
   maar een stilstaand platform -- de gebruiker die op dat moment betaalt, wacht
   mee. "Gooit uiteindelijk een fout" is dus geen geslaagde afloop; de bewering
   is dat hij BINNEN EEN BUDGET gooit. Vandaar de klok in deze toetsen, met een
   ruime grens (250 ms): hij hoort nooit te tikken op een gerepareerde ontleder,
   ook niet op een belaste machine, en hij tikt gegarandeerd op de kapotte.

   DE TEGENPROEVEN STAAN ER NAAST, en dat is hier geen formaliteit. Een grens
   die te streng is, weigert geldige invoer -- en dan is de reparatie een
   storing. Elke grenstoets heeft daarom een broer die bewijst dat een geldig
   document er nog steeds doorheen komt, met dezelfde waarde als ervoor.

   DE PROEF DRAAIT IN EEN KINDPROCES, en dat is geen omslachtigheid maar een
   geleerde les uit dit huis zelf. De eerste versie van dit bestand riep de
   ontleder rechtstreeks aan. Bij `foutVelden` op een onafgesloten bericht liep
   de suite daardoor niet ROOD maar VAST: geen enkele bewering kwam eruit, de
   draaier tikte na vijf minuten af, en de uitslag zei niets over het onderwerp.
   Dat is eerlijkheidspunt 6.7 en 6.10 in TAKEN.md, in het klein nagemaakt --
   *een toets die vastloopt is erger dan een toets die zakt*, want een hangende
   suite kost een time-out en een schouderophalen.

   Een vastloper hoort hier dus een UITSLAG te zijn. Het kind krijgt een budget;
   komt het er niet uit, dan wordt het gedood en is DAT de bevinding, met naam
   en al. Zo kan deze toets de fout meten die hij onderzoekt zonder eraan ten
   onder te gaan.

   Los: node --test test/vijandigerand.test.js */
/* ---------------------------------------------------------------------------
   DE VOLLEDIGE UITLEG VAN DE DRIE CBOR-BUDGETTEN, hierheen verhuisd uit
   server/webauthn/cbor.js. Dat bestand zat op 9713 van de 10240 bytes, en de
   omvangregel telt commentaar mee -- dezelfde val als TAKEN.md 7.21, een
   bestand verderop. De uitleg hoort bij de toets die de budgetten bewaakt, dus
   hij verliest niets door hier te staan; de code draagt de korte versie.

DRIE BUDGETTEN, EN ZE KOMEN ALLE DRIE UIT EEN GEMETEN GAT (STANDAARD.md par. 6).

   1. LEZEN VOORBIJ HET EINDE. `buf[p]` is `undefined` voorbij de buffer,
      `undefined >> 5` is 0 en `undefined & 0x1f` is 0 -- dus las deze functie
      daar een keurige "unsigned int 0" en liep door op verzonnen bytes. Een
      ontleder die data VERZINT waar er geen is, is erger dan een die valt: de
      aanroeper krijgt een geldig ogende waarde terug.

   2. EEN LENGTE DIE NIET KAN. Bij `ai === 27` komt de lengte uit acht bytes en
      werd hij onbeperkt overgenomen. Negen bytes (`9b ff ff ff ff ff ff ff ff`)
      lieten de lus in case 4 achttien triljoen keer aftellen: gemeten 9325 ms
      event-loop-blokkade, bereikbaar voor elk ingelogd lid via
      POST /api/webauthn/registreer. Node is een draad, dus dat is geen trage
      route maar een stilstaand platform.

      De grens is niet een verzonnen maximum maar de buffer zelf: een element
      kost minstens een byte en een mappaar minstens twee, dus meer beloven dan
      er nog ligt kan per definitie niet kloppen. Daarmee weigert hij precies
      het onmogelijke en geen enkel geldig document.

   3. EEN STRING DIE MEER BELOOFT DAN ER IS. `subarray` KLEMT en gooit niet, dus
      een bytestring van 200 die er 3 heeft kwam er als 3 uit -- met de belofte
      dat het er 200 waren. Bij een COSE-sleutel is dat het verschil tussen een
      sleutel en een stuk van een sleutel.

   WAT ER MET OPZET NIET WORDT BEGRENSD: majortype 0 en 1. Daar is de waarde
   geen byte-aantal maar het GETAL zelf, en een grote unsigned int is volkomen
   geldige CBOR. Wie daar dezelfde grens op zet, weigert echte invoer.
   ------------------------------------------------------------------------ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const { cborLees } = require('../server/webauthn/cbor');
const { foutVelden } = require('../server/pgwire/protocol');

const WORTEL = path.join(__dirname, '..');

/* Het budget waarbinnen een ontleder een oordeel hoort te vellen. Ruim gekozen:
   een gerepareerde ontleder zit hier ordes onder, en de kapotte versie zat er
   ordes boven (9325 ms voor de CBOR-lezer, oneindig voor foutVelden). Een grens
   die precies tussen twee metingen ligt, wordt op een drukke machine een
   wisselvallige toets. */
const BUDGET_MS = 250;
/* Wat het kind zelf mag kosten: het budget plus de opstart van een node-proces.
   Ruim, want de bewering gaat over de ONTLEDER en niet over de opstarttijd. */
const KIND_MS = 5000;

/* Voert een ontleed-uitdrukking uit in een eigen proces en rapporteert drie
   dingen: liep hij vast, gooide hij, en hoe lang deed hij erover.

   `uitdrukking` is JavaScript dat de ontleder aanroept. De meting gebeurt IN
   het kind, zodat de opstarttijd van node er niet bij wordt geteld. */
function ontleedApart(nodig, uitdrukking) {
  const code = `
    const { ${nodig.naam} } = require(${JSON.stringify(path.join(WORTEL, nodig.pad))});
    const start = process.hrtime.bigint();
    let gooide = '';
    try { ${uitdrukking} } catch (e) { gooide = String(e && e.message || e); }
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    process.stdout.write(JSON.stringify({ ms, gooide }));
  `;
  const r = spawnSync(process.execPath, ['-e', code], { cwd: WORTEL, timeout: KIND_MS, encoding: 'utf8' });
  if (r.signal || (r.error && r.error.code === 'ETIMEDOUT')) {
    return { vast: true, ms: Infinity, gooide: null };
  }
  let uit = null;
  try { uit = JSON.parse(r.stdout); } catch (e) { uit = null; }
  if (!uit) throw new Error('het kindproces gaf niets leesbaars terug (exit ' + r.status + '): ' +
    String(r.stderr || '').trim().split('\n').slice(0, 2).join(' | ').slice(0, 200));
  return { vast: false, ms: uit.ms, gooide: uit.gooide || null };
}

const CBOR = { pad: 'server/webauthn/cbor.js', naam: 'cborLees' };
const PGWIRE = { pad: 'server/pgwire/protocol.js', naam: 'foutVelden' };

/* De bewering die bij elke vijandige invoer hoort: geen vastloper, en binnen
   het budget een oordeel. Op een plek, zodat vijf toetsen niet vijf keer
   dezelfde zin uit elkaar laten lopen. */
function eisBegrensd(uitslag, wat) {
  assert.equal(uitslag.vast, false,
    wat + ': de ontleder liep VAST (geen uitslag binnen ' + KIND_MS + ' ms). ' +
    'Node is een draad, dus dit is geen trage route maar een stilstaand platform.');
  assert.ok(uitslag.ms < BUDGET_MS,
    wat + ': de ontleder deed er ' + uitslag.ms.toFixed(0) + ' ms over; de eis is onder ' + BUDGET_MS + ' ms.');
}

/* ======================= CBOR ======================= */

test('CBOR: een lengte van 2^64-1 wordt geweigerd binnen het budget, niet uitgerekend', () => {
  /* 0x9b = array, met een 64-bits lengte erachter. De acht ff-bytes zeggen
     "hier komen 18 triljoen elementen". De lus in case 4 telde die af.

     Dit zijn de negen bytes uit de audit, letterlijk. */
  const u = ontleedApart(CBOR, 'cborLees(Buffer.from([0x9b,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff]), 0);');
  eisBegrensd(u, 'array met een 64-bits lengte');
  assert.ok(u.gooide, 'negen bytes die 18 triljoen elementen beloven horen te worden geweigerd');
});

test('CBOR: een map met een onmogelijke lengte wordt net zo geweigerd', () => {
  /* case 5 heeft dezelfde lus als case 4 en dus dezelfde fout. Een reparatie
     die alleen de array afdekt, laat de helft open -- vandaar deze tweede. */
  const u = ontleedApart(CBOR, 'cborLees(Buffer.from([0xbb,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff]), 0);');
  eisBegrensd(u, 'map met een 64-bits lengte');
  assert.ok(u.gooide, 'een map die 18 triljoen paren belooft hoort te worden geweigerd');
});

test('CBOR: lezen voorbij het einde gooit, en verzint geen nul', () => {
  /* DIT IS DE STILSTE VAN DE DRIE. `buf[p]` is `undefined` voorbij het einde,
     `undefined >> 5` is 0 en `undefined & 0x1f` is 0 -- dus las de lezer daar
     een geldige "unsigned int 0" en liep vrolijk door op verzonnen bytes.

     Een ontleder die data verzint waar er geen is, is erger dan een die valt:
     de aanroeper krijgt een geldig ogende waarde terug. */
  const leeg = Buffer.alloc(0);
  assert.throws(() => cborLees(leeg, 0), /CBOR/,
    'voorbij het einde lezen hoort te gooien in plaats van een verzonnen 0 terug te geven');
  const eenByte = Buffer.from([0x00]);
  assert.throws(() => cborLees(eenByte, 5), /CBOR/,
    'een positie buiten de buffer hoort te gooien');
});

test('CBOR: een bytestring die meer belooft dan er is, wordt geweigerd in plaats van stil afgekapt', () => {
  /* `subarray` KLEMT en gooit niet: een string van 200 bytes die er 3 heeft,
     kwam er als 3 bytes uit -- met de belofte dat het er 200 waren. Bij een
     COSE-sleutel is dat precies het verschil tussen een sleutel en een stuk
     van een sleutel. */
  const kort = Buffer.from([0x58, 0xc8, 0x01, 0x02, 0x03]);  // byte string, lengte 200, drie bytes
  assert.throws(() => cborLees(kort, 0), /CBOR/,
    'een bytestring die 200 bytes belooft en er 3 heeft, hoort te worden geweigerd');
});

test('CBOR: diepe nesting wordt begrensd in plaats van de stapel op te blazen', () => {
  /* 20.000 geneste arrays van een element. Zonder dieptegrens is dit een
     RangeError uit de stapel -- die is te vangen, maar een stapeloverloop in
     een verzoekafhandelaar laat onbepaald wat half af achter. */
  const u = ontleedApart(CBOR, 'cborLees(Buffer.alloc(20000, 0x81), 0);');
  eisBegrensd(u, 'twintigduizend geneste arrays');
  assert.ok(u.gooide, 'diepe nesting hoort te worden geweigerd');
  assert.match(String(u.gooide), /CBOR/,
    'en met de eigen foutmelding, niet met een stapeloverloop: ' + String(u.gooide).slice(0, 80));
});

test('DE TEGENPROEF: geldige CBOR komt er ongewijzigd doorheen', () => {
  /* Zonder deze zou een lezer die ALTIJD gooit alle toetsen hierboven halen.
     Vier vormen die WebAuthn echt gebruikt: int, bytestring, array en map. */
  assert.equal(cborLees(Buffer.from([0x0a]), 0).waarde, 10, 'unsigned int');
  assert.equal(cborLees(Buffer.from([0x29]), 0).waarde, -10, 'negatieve int');

  const bytes = cborLees(Buffer.from([0x43, 0xaa, 0xbb, 0xcc]), 0);
  assert.deepEqual([...bytes.waarde], [0xaa, 0xbb, 0xcc], 'bytestring van drie');
  assert.equal(bytes.eind, 4, 'en het eind wijst voorbij de laatste byte');

  assert.equal(cborLees(Buffer.from([0x63, 0x61, 0x62, 0x63]), 0).waarde, 'abc', 'tekststring');
  assert.deepEqual(cborLees(Buffer.from([0x83, 0x01, 0x02, 0x03]), 0).waarde, [1, 2, 3], 'array van drie');

  const m = cborLees(Buffer.from([0xa2, 0x01, 0x02, 0x03, 0x04]), 0).waarde;
  assert.equal(m.get(1), 2, 'map: eerste paar');
  assert.equal(m.get(3), 4, 'map: tweede paar');

  /* Een geldige, redelijk geneste vorm hoort NIET tegen de dieptegrens te
     lopen. Zonder deze bewering zou een grens van 1 alle toetsen halen. */
  const genest = Buffer.from([0x81, 0x81, 0x81, 0x81, 0x81, 0x00]);   // vijf diep
  assert.deepEqual(cborLees(genest, 0).waarde, [[[[[0]]]]], 'vijf niveaus diep is gewoon geldig');
});

/* ======================= PGWIRE ======================= */

test('pgwire: een foutbericht zonder afsluitende NUL loopt niet oneindig door', () => {
  /* `p.indexOf(0, o + 1)` geeft -1 als er geen NUL meer komt. Dan werd
     `o = -1 + 1 = 0` en begon de lus overnieuw bij byte nul -- voor altijd.

     Bereikbaar vanaf de Postgres-KANT en niet vanaf een lid, dus dit is de
     lichtste van de twee. Een oneindige lus in de databaseclient legt wel het
     hele proces stil, en "onze database is te vertrouwen" is precies het soort
     aanname dat een ontleder niet hoort te maken. */
  const u = ontleedApart(PGWIRE,
    "foutVelden(Buffer.from('Mer is iets mis en deze tekst eindigt nooit', 'utf8'));");
  eisBegrensd(u, 'foutbericht zonder afsluitende NUL');
});

test('DE TEGENPROEF: een goed gevormd foutbericht wordt nog steeds gelezen', () => {
  /* Zonder deze zou `return {}` als eerste regel alle toetsen hierboven halen. */
  const goed = Buffer.concat([
    Buffer.from('SFATAL\0', 'utf8'),
    Buffer.from('C28P01\0', 'utf8'),
    Buffer.from('Mwachtwoord klopt niet\0', 'utf8'),
    Buffer.from([0])
  ]);
  const f = foutVelden(goed);
  assert.equal(f.S, 'FATAL', 'de ernst');
  assert.equal(f.C, '28P01', 'de SQLSTATE-code');
  assert.equal(f.M, 'wachtwoord klopt niet', 'de melding');
});

/* PAST DE SLEUTEL VAN DE FAALPROEF IN HET SLOT VAN DE BEWIJSMATRIX?

   scripts/bewijsmatrix.js leest FAALPROEF.json met perRouteKaart(), en die
   bouwt zijn sleutel als `r.methode + ' ' + r.pad` -- zo lezen alle registers
   van die familie. scripts/faalproef.js schreef alleen een samengestelde
   `route`, dus elke sleutel werd 'undefined undefined' en de FAILURE-kolom
   matchte NIETS: het register vulde zich, de matrix draaide, en er kwam nooit
   een cel uit.

   Dat is de reden dat deze toets bestaat, en waarom hij niet naar de INHOUD van
   een ronde kijkt maar naar de VORM. Een koppeling die je niet van het ene eind
   tot het andere hebt zien werken, is geen koppeling -- LAT.md regel 11, maar
   dan op bedrading in plaats van op gedrag.

   Er draait hier geen ronde: die duurt een half uur en heeft een server nodig.
   In plaats daarvan wordt de rij gebouwd zoals faalproef.js hem bouwt, en door
   de ECHTE perRouteKaart van de matrix gehaald.

   Draai los: node --test test/faalproefvorm.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* De velden die faalproef.js per rij wegschrijft. Verandert die vorm, dan hoort
   deze regel mee te veranderen -- en dan zakt de koppeling hieronder. */
const RIJ = {
  methode: 'POST', pad: '/api/proef/vorm', route: 'POST /api/proef/vorm',
  rol: 'member', profiel: 'duurzaam', effect: 'opslag=1',
  perVerraad: { 'schrijf-faalt': { staat: 'bewezen', reden: 'expliciete fout (status 500)' } },
  failure: 'bewezen', reden: 'schrijf-faalt: expliciete fout (status 500)',
};

test('de matrix vindt een faalproef-rij terug op zijn eigen sleutel', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-faalvorm-'));
  const bestand = path.join(map, 'FAALPROEF.json');
  fs.writeFileSync(bestand, JSON.stringify({ soort: 'meting', perRoute: [RIJ] }));

  /* De matrix als GEREEDSCHAP en niet als script: hij leest zijn registers via
     een injecteerbare inventaris, dus hier kan de echte lezer worden gedraaid
     zonder de hele matrix te bouwen. */
  const bm = require('../scripts/bewijsmatrix.js');
  assert.equal(typeof bm.perRouteKaart, 'function',
    'bewijsmatrix.js hoort perRouteKaart naar buiten te geven, anders is deze koppeling niet te toetsen');

  const kaart = bm.perRouteKaart(bestand);
  assert.ok(kaart, 'het register is gelezen');
  assert.ok(kaart.has('POST /api/proef/vorm'),
    'de sleutel van de matrix (methode + " " + pad) vindt de rij van de faalproef terug');
  assert.equal(kaart.get('POST /api/proef/vorm').failure, 'bewezen');
  assert.equal(kaart.has('undefined undefined'), false,
    'en er ontstaat geen verzamelsleutel waar alles in verdwijnt');

  fs.rmSync(map, { recursive: true, force: true });
});

test('faalproef.js schrijft methode en pad werkelijk apart weg', () => {
  /* De vorige toets bewijst dat de sleutel PAST; deze dat de proef hem ook
     ZO opschrijft. Zonder de tweede zou een rij zonder methode/pad hier groen
     blijven omdat de toets zijn eigen rij verzint. */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'faalproef.js'), 'utf8');
  assert.match(bron, /const rij = \{ methode: r\.methode, pad: r\.pad/,
    'de rij van faalproef.js draagt methode en pad apart');
});

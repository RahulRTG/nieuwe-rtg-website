/* RTG Zegel (server/lib/zegel.js): bewijs zonder tonen, offline verifieerbaar.
   Getoetst: selectieve onthulling (ruwe persoonsgegevens komen er nooit in),
   offline verificatie met alleen de publieke sleutel, afwijzing van geknoei en
   van een verlopen zegel, en onkoppelbare paarsgewijze pseudoniemen.
   Draai los: node --experimental-sqlite --test test/zegel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakZegel, controleer } = require('../server/lib/zegel');

function verseMap() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zegel-')); }

test('1. selectieve onthulling: alleen toegestane claims, ruwe gegevens eruit', () => {
  const z = maakZegel({ dataDir: verseMap() });
  const token = z.zegel({ codenaam: 'FALCON', partner: 'KIKUNOI', geldigMin: 5,
    claims: { leeftijd18: true, pas: 'business', naam: 'Jan de Vries', geboortedatum: '1990-01-01' } });
  const r = z.controleer(token);
  assert.equal(r.geldig, true);
  assert.equal(r.claims.leeftijd18, true);
  assert.equal(r.claims.pas, 'business');
  assert.equal(r.claims.naam, undefined, 'naam is NIET in het zegel beland');
  assert.equal(r.claims.geboortedatum, undefined, 'geboortedatum is NIET in het zegel beland');
  // het token bevat de ruwe gegevens ook letterlijk niet
  assert.doesNotMatch(Buffer.from(token.split('.')[0], 'base64url').toString(), /Jan|1990/);
});

test('2. offline verifieerbaar met ALLEEN de publieke sleutel', () => {
  const z = maakZegel({ dataDir: verseMap() });
  const pub = z.publiekeSleutel();
  const token = z.zegel({ codenaam: 'FALCON', partner: 'KIKUNOI', claims: { leeftijd18: true } });
  // een partner-app die alleen de publieke sleutel kent (geen server) verifieert:
  const r = controleer(token, pub);
  assert.equal(r.geldig, true);
  assert.equal(r.claims.leeftijd18, true);
  assert.match(r.sub, /^pw_/, 'het onderwerp is een pseudoniem, geen naam/codenaam');
});

test('3. geknoei wordt geweigerd', () => {
  const z = maakZegel({ dataDir: verseMap() });
  const pub = z.publiekeSleutel();
  const token = z.zegel({ codenaam: 'FALCON', partner: 'KIKUNOI', claims: { pas: 'lifestyle' } });
  const [p, s] = token.split('.');
  // knoei met de payload (maak er stiekem business van)
  const data = JSON.parse(Buffer.from(p, 'base64url').toString());
  data.claims.pas = 'business';
  const vals = Buffer.from(JSON.stringify(data)).toString('base64url') + '.' + s;
  assert.equal(controleer(vals, pub).geldig, false, 'gewijzigde payload faalt op de handtekening');
  // een zegel van een ANDERE uitgever faalt ook
  const ander = maakZegel({ dataDir: verseMap() });
  assert.equal(controleer(token, ander.publiekeSleutel()).geldig, false, 'verkeerde uitgever faalt');
});

test('4. een verlopen zegel is ongeldig', () => {
  const z = maakZegel({ dataDir: verseMap() });
  const token = z.zegel({ codenaam: 'FALCON', partner: 'KIKUNOI', claims: { lid: true }, geldigMin: 5 });
  const overTienMin = Math.floor(Date.now() / 1000) + 10 * 60;
  const r = z.controleer(token, overTienMin);
  assert.equal(r.geldig, false);
  assert.equal(r.reden, 'verlopen');
});

test('5. onkoppelbaar: pseudoniem verschilt per partner, stabiel per partner', () => {
  const z = maakZegel({ dataDir: verseMap() });
  const bijKiku1 = z.pseudoniem('FALCON', 'KIKUNOI');
  const bijKiku2 = z.pseudoniem('FALCON', 'KIKUNOI');
  const bijSakura = z.pseudoniem('FALCON', 'SAKURA');
  assert.equal(bijKiku1, bijKiku2, 'zelfde lid + zelfde partner = herkenbaar');
  assert.notEqual(bijKiku1, bijSakura, 'zelfde lid, andere partner = onkoppelbaar');
  // en dat werkt door in het zegel-onderwerp
  const tKiku = z.controleer(z.zegel({ codenaam: 'FALCON', partner: 'KIKUNOI', claims: { lid: true } }));
  const tSak = z.controleer(z.zegel({ codenaam: 'FALCON', partner: 'SAKURA', claims: { lid: true } }));
  assert.notEqual(tKiku.sub, tSak.sub, 'twee venues kunnen het lid niet matchen');
});

test('6. sleutels blijven stabiel tussen herstarts (uit de datamap geladen)', () => {
  const map = verseMap();
  const a = maakZegel({ dataDir: map });
  const pub1 = a.publiekeSleutel();
  const token = a.zegel({ codenaam: 'FALCON', partner: 'KIKUNOI', claims: { lid: true } });
  const b = maakZegel({ dataDir: map }); // "herstart": zelfde map
  assert.equal(b.publiekeSleutel(), pub1, 'zelfde publieke sleutel na herstart');
  assert.equal(b.controleer(token).geldig, true, 'een eerder zegel blijft geldig na herstart');
});

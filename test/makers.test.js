/* DE METING VAN DE MAKERS -- en of hij werkelijk iets onderscheidt.

   scripts/makers.js beantwoordt de vraag uit CREATE.md par. 3: delen twee makers
   een MODEL, of alleen een woord? Op die vraag "ja" zeggen terwijl je de
   huishouding telt, levert een gedeeld projectbegrip op dat in de hele
   makerslaag terechtkomt -- en dat is precies de fout die PLATFORM.md bij Cercle
   en Entourage al een keer heeft voorkomen.

   Deze toets legt daarom niet vast dat de meter DRAAIT, maar dat hij de vijf
   dingen uit elkaar houdt die hem anders om de tuin leiden:

     1. een gesloten woordenschat tegenover een zin, een pad of een foutmelding;
     2. een woord in de CODE tegenover een woord in het COMMENTAAR;
     3. taal tegenover vorm: gedeelde bloktaal telt, gedeelde huishouding niet;
     4. vorm ZONDER gedeelde opslag is geen gedeelde kern;
     5. het BEWIJS bij een terecht oordeel -- een klein lijstje dat toevallig
        1,00 haalt, mag geen grote woordenschat van 0,71 verdringen.

   Die vijfde is geen bedachte val. De eerste versie van het script haalde JA op
   Website-maker <-> Atelier en citeerde als bewijs ['id','type','verberg',
   'varianten'] -- een uitsluitlijstje dat in beide bestanden woordelijk staat.
   Het oordeel klopte en het bewijs was waardeloos.

   Draai los: node --test test/makers.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../scripts/makers');

/* Verzonnen makers, zodat er te toetsen valt met een uitkomst die je vooraf
   weet. Dat is de reden dat analyse() los staat van lees() (LAT-regel 10). */
const maker = (id, o) => Object.assign({ id, naam: id, bestanden: 1, paden: ['x/' + id + '.js'],
  vormen: [], talen: [], opslag: [], levensloop: [], poorten: [] }, o);
const vorm = (bestand, kern) => ({ bestand, velden: kern, kern });
const taal = (bestand, woorden) => ({ bestand, woorden });

test('1 - een gesloten woordenschat wordt herkend, een zin niet', () => {
  const gevonden = M.talenVan("const TYPES = ['hero', 'kop', 'tekst', 'knop', 'beeld'];");
  assert.equal(gevonden.length, 1);
  assert.deepEqual(gevonden[0], ['hero', 'kop', 'tekst', 'knop', 'beeld']);

  // een lijst zinnen is geen woordenschat: hoofdletters en spaties vallen af
  assert.equal(M.talenVan("const X = ['Stel ons een vraag', 'Verstuur', 'Bedankt', 'Sluiten'];").length, 0);
  // en een lijst paden ook niet
  assert.equal(M.talenVan("const Y = ['https://a.nl/x', 'https://b.nl/y', 'https://c.nl/z', 'https://d.nl/q'];").length, 0);
  // drie woorden is nog geen afspraak
  assert.equal(M.talenVan("const Z = ['een', 'twee', 'drie'];").length, 0);
});

test('2 - commentaar telt niet mee, tekenreeksen wel', () => {
  const bron = "/* ooit stond hier ['aap', 'noot', 'mies', 'wim', 'zus'] */\n"
    + "const T = ['hero', 'kop', 'tekst', 'knop'];";
  const gevonden = M.talenVan(bron);
  assert.equal(gevonden.length, 1, 'alleen de lijst uit de CODE hoort gevonden te worden');
  assert.deepEqual(gevonden[0], ['hero', 'kop', 'tekst', 'knop']);

  // en een // in een tekenreeks eet de regel niet op
  const bewaard = M.zonderCommentaar("const u = 'https://rtg.nl'; // weg hiermee\nconst v = 1;");
  assert.match(bewaard, /https:\/\/rtg\.nl/);
  assert.doesNotMatch(bewaard, /weg hiermee/);
});

test('3 - gedeelde bloktaal is een gedeelde kern, ook zonder gedeelde opslag', () => {
  /* Dit is het echte geval: het Atelier bewaart sjablonen in atelierSites en de
     maker sites in ledenSites. Twee kasten, een formaat. */
  const a = maker('maker', { talen: [taal('maker.js', ['hero', 'kop', 'tekst', 'knop', 'beeld', 'citaat'])], opslag: ['ledenSites'] });
  const b = maker('studio', { talen: [taal('studio.js', ['hero', 'kop', 'tekst', 'knop', 'beeld'])], opslag: ['atelierSites'] });
  const r = M.analyse([a, b]);
  assert.equal(r.paren.length, 1);
  assert.equal(r.paren[0].gedeeldeKern, true);
  assert.equal(r.paren[0].via, 'taal');
  assert.equal(r.paren[0].opslagGedeeld.length, 0, 'juist zonder gedeelde opslag');
});

test('4 - vorm zonder gedeelde opslag is GEEN gedeelde kern', () => {
  /* Twee makers die { kop, tekst, blokken } delen maar in een andere kast
     schrijven, delen de Nederlandse taal en geen model. */
  const velden = ['kop', 'tekst', 'blokken', 'kleur'];
  const a = maker('een', { vormen: [vorm('een.js', velden)], opslag: ['eenDing'] });
  const b = maker('twee', { vormen: [vorm('twee.js', velden)], opslag: ['tweeDing'] });
  const r = M.analyse([a, b]);
  assert.equal(r.paren[0].vorm, 1, 'de vormen zijn identiek');
  assert.equal(r.paren[0].gedeeldeKern, false, 'en toch geen gedeelde kern');
  assert.match(r.paren[0].waarom, /drempel/);

  // dezelfde twee, nu in dezelfde kast: dan telt het wel
  const c = maker('twee', { vormen: [vorm('twee.js', velden)], opslag: ['eenDing'] });
  const r2 = M.analyse([a, c]);
  assert.equal(r2.paren[0].gedeeldeKern, true);
  assert.equal(r2.paren[0].via, 'vorm');
});

test('5 - het bewijs is de grootste woordenschat, niet de hoogste gelijkenis', () => {
  /* De val waar de eerste versie in liep: een uitsluitlijstje dat in beide
     bestanden woordelijk staat haalt 1,00 en verdringt de bloktaal. */
  const huishouding = ['id', 'type', 'verberg', 'varianten'];
  const bloktaal = ['hero', 'kop', 'tekst', 'knop', 'beeld', 'kolommen', 'galerij', 'citaat', 'ruimte', 'voettekst'];
  const a = maker('maker', { talen: [taal('schoon.js', bloktaal.concat(['zaakdata', 'formulier', 'faq', 'prijzen'])), taal('schoon.js', huishouding)] });
  const b = maker('studio', { talen: [taal('atelier.js', bloktaal), taal('atelier.js', huishouding)] });
  const p = M.analyse([a, b]).paren[0];
  assert.equal(p.gedeeldeKern, true);
  assert.ok(p.taalGedeeld.includes('hero'), 'de bloktaal hoort het bewijs te zijn');
  assert.ok(!p.taalGedeeld.includes('varianten'), 'het uitsluitlijstje hoort het NIET te zijn');
  assert.equal(p.taal, 0.71, 'en het gerapporteerde getal hoort bij dat bewijs');
});

test('6 - zonder enige overlap komt er niets uit', () => {
  const a = maker('lesmaker', { talen: [taal('les.js', ['klas', 'vraag', 'antwoord', 'score'])], opslag: ['lessen'] });
  const b = maker('clips', { talen: [taal('clip.js', ['knip', 'geluid', 'ondertitel', 'duur'])], opslag: ['clips'] });
  const p = M.analyse([a, b]).paren[0];
  assert.equal(p.gedeeldeKern, false);
  assert.equal(p.taal, 0);
  assert.equal(p.via, null);
});

test('7 - de echte meting draait, en vindt precies de twee webmakers', () => {
  const r = M.meet();
  assert.ok(r.gemeten.makers >= 8, 'alle makers uit de lijst horen gemeten te worden');
  assert.ok(r.gemeten.bestanden > 40, 'en dat over hun echte bestanden');
  const kern = r.paren.filter(p => p.gedeeldeKern);
  assert.equal(kern.length, 1, 'vandaag deelt precies een paar een kern');
  assert.deepEqual([kern[0].a, kern[0].b].sort(), ['websitemaker', 'websitestudio']);
  assert.ok(kern[0].taalGedeeld.includes('hero') && kern[0].taalGedeeld.includes('galerij'),
    'en het bewijs is de bloktaal, niet de huishouding');
});

test('8 - elke maker uit de lijst heeft bestanden gevonden', () => {
  /* Een prefix die nergens op slaat, geeft een maker zonder bestanden -- en dan
     meet dit script stilzwijgend niets over hem. Dat hoort op te vallen. */
  const r = M.meet();
  const leeg = r.makers.filter(m => !m.bestanden).map(m => m.id);
  assert.deepEqual(leeg, [], 'makers zonder bestanden: de prefix in MAKERS klopt niet meer');
});

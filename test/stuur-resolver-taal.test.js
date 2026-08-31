/* DE TAALSUITE VAN DE CAPABILITY-RESOLVER -- de veiligheidskant.

   test/stuur-resolver.test.js bewijst de GRENS: er komt nooit een pad bij. Deze
   suite bewijst het andere gevaar, en dat is subtieler: dat er niets van de
   verkeerde kant AFGAAT. Een resolver die een gevraagd vermogen wegfiltert,
   laat de AI zeggen "dat kan ik niet" over iets dat de gebruiker gewoon mag --
   een leugen met een technische oorzaak, en van buiten niet te zien.

   HET SUCCESCRITERIUM VAN BLOK 0 IS DEKKING BOVEN COMPACTHEID. Liever veertien
   relevante paden dan drie waarvan de juiste ontbreekt. De compactheid is een
   kostenpost; de dekking is de veiligheid. Daarom is DEKKING hier een harde
   toets en compactheid alleen een meter (scripts/resolver.js).

   NEGEN TAALVORMEN, want de vraag is niet of het model alles begrijpt maar of
   de resolver door een taaltruc iets kan verbergen of toevoegen: synoniemen,
   scheidbare werkwoorden, domeinjargon, spelfouten, samengestelde opdrachten,
   impliciete intentie, negatie, en promptinjectie waarin een routepad wordt
   genoemd. Waar de weging het niet weet, hoort de terugval aan te gaan -- niet
   een gok op een los werkwoord.

   Corpus en meter delen een bestand (scripts/resolver-corpus.js): een tweede
   lijst zou de toets iets anders laten bewaken dan de meter meet. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { rapport, routesUitRegister } = require('../scripts/resolver');
const { CORPUS } = require('../scripts/resolver-corpus');
const { resolveer } = require('../server/kern/stuur/resolver');
const { toegestanePaden } = require('../server/kern/stuur/beleid');

const R = rapport();

test('0. de meting deugt: er is een corpus en er zijn echte routes', () => {
  assert.ok(!R.fout, R.fout);
  assert.ok(CORPUS.length >= 20, 'te klein corpus: ' + CORPUS.length);
  assert.ok(new Set(CORPUS.map(z => z.soort)).size >= 9, 'te weinig taalvormen beproefd');
  assert.ok(R.routes > 1000, 'te weinig routes: ' + R.routes);
});

test('1. DEKKING IS VOLLEDIG: geen enkele zin verliest het gevraagde vermogen', () => {
  const uitleg = R.gemistDoor.map(g =>
    '[' + g.zin.soort + '] "' + g.zin.zin + '" mist ' + g.gemist.join(' ') +
    ' (kreeg: ' + (g.versmald ? g.uitslag.paden.join(' ') : 'de volledige lijst') + ')').join('\n  ');
  assert.equal(R.dekking, 100, 'dekking ' + R.dekking + '% -- gemist:\n  ' + uitleg);
});

test('2. per taalvorm apart, zodat een gemiddelde geen categorie verbergt', () => {
  for (const soort of new Set(CORPUS.map(z => z.soort))) {
    const eis = R.rijen.filter(x => x.zin.soort === soort && (x.zin.moet || []).length);
    if (!eis.length) continue;
    const gemist = eis.filter(x => !x.dekt);
    assert.equal(gemist.length, 0,
      'taalvorm "' + soort + '" verliest ' + gemist.length + ' van ' + eis.length + ' vermogens: ' +
      gemist.map(g => '"' + g.zin.zin + '"').join(', '));
  }
});

test('3. promptinjectie voegt nooit een pad toe dat de rol niet heeft', () => {
  for (const rij of R.rijen)
    assert.deepEqual(rij.gesmokkeld, [],
      'pad gesmokkeld via "' + rij.zin.zin + '": ' + rij.gesmokkeld.join(' '));
});

test('4. elke zin uit het corpus levert een deelverzameling van de toegestane lijst', () => {
  const alle = routesUitRegister();
  for (const zin of CORPUS) {
    const toe = new Set(toegestanePaden(alle, zin.rol));
    for (const p of resolveer(zin.zin, [...toe]).paden)
      assert.ok(toe.has(p), 'pad buiten de toegestane lijst bij "' + zin.zin + '": ' + p);
  }
});

test('5. dun bewijs versmalt niet: een typefout valt terug in plaats van te gokken', () => {
  const alle = routesUitRegister();
  const toe = toegestanePaden(alle, 'member');
  const r = resolveer('zet een afsrpaak in mijn agneda', toe);
  assert.equal(r.versmald, false, 'versmalde op een enkel losstaand werkwoord: ' + r.paden.join(' '));
  assert.match(r.reden, /te dun|woorden/i);
});

test('6. de terugval is geen dood spoor: de volledige lijst komt echt terug', () => {
  const alle = routesUitRegister();
  const toe = toegestanePaden(alle, 'member');
  const r = resolveer('qqqq wwww eeee', toe);
  assert.equal(r.paden.length, toe.length);
});

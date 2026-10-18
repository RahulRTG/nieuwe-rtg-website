/* WAT MAAKT TWEE AANROEPEN HETZELFDE VERZOEK -- de meter, en zijn eigen ijking.

   IDEMIDENTITEIT.json beantwoordt de vraag die na #269/#270 overbleef: waar zit
   nog een identiteit die te smal is? Deze toets bewaakt drie dingen, en de
   volgorde is de volgorde waarin ze mis kunnen gaan:

     1. de lezer leest zijn eigen invoer goed (de ijking in het script);
     2. het ingecheckte register klopt met een VERSE meting -- een register dat
        niet is hergedraaid, is een bewering over het verleden;
     3. de tweede familie wordt echt meegenomen. Dat is de duurste: het gebrek
        dat #270 repareerde zat NIET op een metIdem-aanroepplek, dus een meter
        die alleen die leest, meldt rust terwijl er een gat staat.

   Draai los: node --test test/idemidentiteit.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const M = require('../scripts/idemidentiteit');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'IDEMIDENTITEIT.json');

test('1 - de lezer haalt zijn eigen ijking', () => {
  /* Een meter die niet kan uitslaan is geen meter. Deze ijking is vier keer
     aangedaan en sloeg vier keer uit: commentaar niet uitwitten, kaal splitsen
     op komma, tekenreeksen als namen tellen, en de regex die stilzwijgend een
     teken VOOR "idem" eiste (waardoor `idemZoek` werd gemist en
     `verzoekIdemZoek` niet). */
  assert.deepEqual(M.ijk(), [], 'de ijking van scripts/idemidentiteit.js hoort schoon te zijn');
});

test('2 - het register klopt met een verse meting', () => {
  assert.ok(fs.existsSync(REGISTER), 'IDEMIDENTITEIT.json hoort te bestaan -- draai: npm run idemidentiteit');
  const staat = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  const vers = M.meet();
  /* De datum en de commit horen te verschillen zodra je op een andere dag meet;
     de UITSLAG niet. Alleen daarop wordt vergeleken. */
  for (const veld of ['aanroepplekken', 'verklaard', 'geenAfdruk', 'voegtNietsToe', 'voegtToe',
    'nietTeLezen', 'handwerkPlekken', 'handwerkVergelijkt', 'handwerkGeenVergelijking']) {
    assert.equal(staat[veld], vers[veld],
      'IDEMIDENTITEIT.json loopt achter op de code (' + veld + ') -- draai: npm run idemidentiteit');
  }
  assert.deepEqual(staat.plekken.map(p => p.bestand + ':' + p.regel + ':' + p.uitspraak),
    vers.plekken.map(p => p.bestand + ':' + p.regel + ':' + p.uitspraak));
  assert.deepEqual(staat.handwerk.map(h => h.bestand + ':' + h.regel + ':' + h.uitspraak),
    vers.handwerk.map(h => h.bestand + ':' + h.regel + ':' + h.uitspraak));
});

test('3 - de tweede familie wordt meegenomen, en dat is de dragende bewering', () => {
  const r = M.meet();

  /* HET GEBREK VAN #270 ZAT HIER EN NIET BIJ metIdem. `kern/directpay/verzoek.js`
     zoekt zelf een eerdere aanroep op en vergelijkt met de hand. Zou deze meter
     alleen metIdem lezen, dan had hij over precies die route niets gezegd. */
  const verzoek = r.handwerk.find(h => h.bestand === 'server/kern/directpay/verzoek.js');
  assert.ok(verzoek, 'het betaalverzoek hoort in de tweede familie te staan');
  assert.deepEqual(verzoek.vergeleken, ['bedrag', 'naarCodename'],
    'en te laten zien dat het sinds #270 op bedrag EN ontvanger vergelijkt');

  /* En de meter VINDT plekken die niets vergelijken. Hier stond dat er in de
     LEVENDE code minstens een moest staan (rij.js), en dat maakte van de laatste
     reparatie een rode toets: een ratel die omlaag moet, kon zijn nul niet halen.
     Sinds 18 oktober 2026 vergelijkt rij.js wel (soort, bedrag, bron en
     bestemming), dus de uitslag wordt nu op een VASTE invoer geijkt: een
     opzoeking die het oude antwoord blind teruggeeft, en een die vergelijkt.
     Dat bewijst hetzelfde -- de lezer kan beide vormen zien -- zonder dat er
     een gebrek in het huis hoeft te blijven staan om hem te laten slagen. */
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-idemid-'));
  const blind = path.join(map, 'blind.js');
  const kijkt = path.join(map, 'kijkt.js');
  fs.writeFileSync(blind, "function plaats(o) {\n  const al = vindOpIdem(o.sleutel);\n  if (al) return al;\n  return o;\n}\n");
  fs.writeFileSync(kijkt, "function plaats(o) {\n  const al = vindOpIdem(o.sleutel);\n  if (al && al.centen !== o.centen) throw new Error('anders');\n  if (al) return al;\n  return o;\n}\n");
  try {
    const [b] = M.handwerk([blind]);
    const [k] = M.handwerk([kijkt]);
    assert.equal(b && b.uitspraak, 'geenVergelijking', 'een blinde herhaling hoort als geenVergelijking te tellen');
    assert.equal(k && k.uitspraak, 'vergelijkt', 'en een die vergelijkt als vergelijkt');
    assert.deepEqual(k.vergeleken, ['centen']);
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
  const rij = r.handwerk.find(h => h.bestand === 'server/kern/betaalopdracht/rij.js');
  assert.ok(rij, 'de betaalrij hoort in de tweede familie te staan');
  assert.deepEqual(rij.vergeleken, ['bestemming', 'bron', 'centen', 'soort'],
    'en te laten zien dat zij sinds 18 oktober 2026 de economische identiteit vergelijkt');
  assert.ok(r.handwerkPlekken >= 4, 'vier plekken waren er bij het schrijven; minder betekent dat de lezer iets mist');
});

test('4 - `voegtToe` wordt niet als goedkeuring geregistreerd', () => {
  /* De gevaarlijkste faalvorm van deze meter is geruststelling. `voegtToe` zegt
     alleen dat de afdruk iets draagt dat de sleutel niet heeft -- niet dat hij
     alles draagt waarop de handler onderscheidt. Precies dat was #270. */
  const r = M.meet();
  assert.equal(r.voegtToeIsGeenGoedkeuring, true);
  assert.equal(r.graad, 'vermoed', 'lexicaal gelezen, dus nooit hoger dan vermoed');
  assert.ok(r.waaromVermoed && r.waaromVermoed.length > 40, 'en de reden staat erbij');
});

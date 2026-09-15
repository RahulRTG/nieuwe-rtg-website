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

  /* En de familie is niet leeg op een andere manier: er staan plekken in die
     NIETS vergelijken. Dat is geen aanklacht (rij.js dient een klacht in in
     plaats van een oud antwoord terug te geven) maar het is wel de lijst waar
     de volgende migratie uit komt. */
  assert.ok(r.handwerkGeenVergelijking >= 1,
    'de meter hoort ook de plekken te vinden die niets vergelijken; vindt hij er nul, kijk of hij nog leest');
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

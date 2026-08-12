/* DE SAVE-BUNDEL: WAT BIJ ELKAAR HOORT, LANDT IN EEN COMMIT.

   Wet RTG-041. Het venster staat woordelijk in de kop van server/db/index.js:
   in de sqlite-stand flusht save() synchroon, en een overdracht flusht TWEE
   keer -- eerst het geld (pasToe), dan pas de idem-sleutel (metIdem). Een crash
   daartussen, plus de retry waar idem-sleutels nu juist voor bestaan, boekte
   ECHT dubbel. 137 centen, met de hand gevonden onder kill -9.

   De reparatie is bijeen(): een AsyncLocalStorage die de saves uit de eigen
   async-context uitstelt en aan het eind een keer flusht. Die reparatie was
   nooit vastgehouden -- geen enkele toets raakte bijeen(), en geen enkele toets
   kilt een server om daarna met dezelfde sleutel te hertesten.

   WAT DEZE TOETS WEL EN NIET DOET, en dat verschil hoort hier te staan.

   WEL: hij bewaakt het MECHANISME en de BEDRADING, allebei deterministisch.
   Binnen de bundel worden N saves een flush; buiten de bundel flusht elke save
   meteen; een save uit een ANDERE context flusht gewoon door terwijl de bundel
   openstaat (dat is de veiligheid zelf -- een omstander hoort niet te wachten);
   en beide geldlagen die metIdem gebruiken, geven bijeen ook echt mee. Die
   laatste is het regressierisico dat ik bij naam kan noemen: een nieuwe
   geldlaag die bijeen vergeet, valt stilzwijgend terug op twee losse flushes en
   niets wordt rood.

   NIET: hij kilt geen proces. De echte crashproef -- server hard afbreken
   tijdens een boeking, herstarten, dezelfde sleutel opnieuw -- vraagt een
   variabel kill-moment en meerdere rondes voordat je mag zeggen dat het venster
   echt geraakt is. Dat staat nog open in RTG-041, en deze toets doet niet alsof
   hij dat vervangt.

   Gemuteerd en zien zakken: het uitstellen in save() weghalen zodat elke save
   meteen flusht (toets 1, 3 en 4 rood), doos.open niet sluiten voor de flush
   (toets 4 rood), en bijeen uit de aanroep in kern/pay/index.js halen (toets 5
   rood).

   Die tweede mutatie zakte eerst NIET, en dat weerlegde mijn eigen kopregel: het
   sluiten van de doos beschermt een geval dat de toetsen hierboven niet raken --
   een timer die BINNEN de bundel is gezet en pas erna opslaat. Toets 4 is daar
   alsnog voor geschreven; zonder die toets stond hier een bewering over een
   mutatie die ik niet had zien zakken.
   Draai los: node --test test/bijeen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');

/* De bundel nagebouwd uit de ECHTE bron. server/db/index.js opent een database
   en start timers zodra je hem laadt; dat is te zwaar en te traag voor een toets
   over een mechanisme van twintig regels. We halen daarom bijeen() en save()
   letterlijk uit het bestand en draaien ze met een geteld flush-doel.

   Dat is geen namaak: valt de vorm in de bron weg of verandert hij, dan vindt
   deze toets zijn haakjes niet meer en zakt hij -- en dat is de bedoeling. */
function bundelUitBron() {
  const bron = fs.readFileSync(path.join(WORTEL, 'server/db/index.js'), 'utf8');
  const m = /const bijeenContext = new AsyncLocalStorage\(\);\s*(async function bijeen\([\s\S]*?\n\})/.exec(bron);
  assert.ok(m, 'bijeen() is niet meer in de verwachte vorm te vinden in server/db/index.js');
  const s = /function save\(\) \{\s*if \(!db\.writable\) return;\s*const doos = bijeenContext\.getStore\(\);\s*(if \(doos && doos\.open\)[^\n]*)/.exec(bron);
  assert.ok(s, 'save() stelt niet meer uit binnen een bundel, of de vorm is veranderd');

  const { AsyncLocalStorage } = require('async_hooks');
  const bijeenContext = new AsyncLocalStorage();
  const tel = { flushes: 0 };
  const postgres = { flushVoorrangDirect: async () => {} };
  const save = () => {
    const doos = bijeenContext.getStore();
    if (doos && doos.open) { doos.nodig = true; return; }
    tel.flushes++;
  };
  // eslint-disable-next-line no-eval
  const bijeen = eval('(' + m[1].replace(/^async function bijeen/, 'async function') + ')');
  return { bijeen, save, tel, bijeenContext, postgres };
}

test('binnen de bundel worden veel saves EEN flush', async () => {
  const b = bundelUitBron();
  await b.bijeen(async () => { b.save(); b.save(); b.save(); });
  assert.equal(b.tel.flushes, 1,
    'drie saves in een bundel horen tot een commit te leiden; ' + b.tel.flushes +
    ' betekent dat er een moment op schijf bestaat waarin het geld geboekt is en de sleutel niet');
});

test('buiten de bundel flusht elke save gewoon meteen', async () => {
  const b = bundelUitBron();
  b.save(); b.save();
  assert.equal(b.tel.flushes, 2,
    'zonder bundel hoort elke save direct te landen; anders zou de bundel gewoon uitstel voor iedereen zijn');
});

test('een bundel zonder schrijfacties flusht niets', async () => {
  const b = bundelUitBron();
  await b.bijeen(async () => {});
  assert.equal(b.tel.flushes, 0, 'lezen mag geen commit veroorzaken');
});

/* DE NALOPER. Een timer die binnen de bundel is gezet, erft de async-context.
   Sluit de bundel zijn doos niet voordat er geflusht wordt, dan zet zo'n late
   save alleen een vlag op een doos waar niemand meer naar kijkt -- en dan landt
   die schrijfactie NOOIT. Dat is stil verlies, en het is precies waar het
   sluiten van de doos voor bedoeld is. */
test('een save die NA de bundel binnenkomt, flusht echt', async () => {
  const b = bundelUitBron();
  await b.bijeen(async () => {
    b.save();
    setTimeout(() => b.save(), 5); // erft de context, valt buiten de bundel
  });
  const naBundel = b.tel.flushes;
  assert.equal(naBundel, 1, 'de bundel zelf flusht een keer');
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(b.tel.flushes, 2,
    'de late save hoort ECHT te flushen; blijft het op ' + naBundel + ', dan is die schrijfactie ' +
    'stil verdwenen in een gesloten doos waar niemand meer naar kijkt');
});

/* DE BEDRADING, en dit is het regressierisico dat ik bij naam kan noemen: een
   nieuwe geldlaag die metIdem gebruikt maar bijeen vergeet, valt stilzwijgend
   terug op twee losse flushes -- precies het venster van de 137 centen -- en er
   wordt niets rood. Daarom telt deze toets de aanroepplekken en eist bij elke
   plek dat bijeen echt wordt meegegeven. */
test('elke geldlaag die metIdem gebruikt, geeft ook bijeen mee', () => {
  const plekken = [];
  const zoek = (map) => {
    for (const naam of fs.readdirSync(path.join(WORTEL, map), { withFileTypes: true })) {
      const rel = map + '/' + naam.name;
      if (naam.isDirectory()) { zoek(rel); continue; }
      if (!naam.name.endsWith('.js')) continue;
      const bron = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
      for (const regel of bron.split('\n')) {
        if (/require\(['"][^'"]*lib\/idem['"]\)\(/.test(regel)) plekken.push({ rel, regel: regel.trim() });
      }
    }
  };
  zoek('server');

  assert.ok(plekken.length >= 2,
    'er horen minstens twee geldlagen te zijn die de idem-laag gebruiken (pay en bank); ' +
    'gevonden: ' + plekken.length + ' -- als dit er nul zijn, meet deze toets niets');
  for (const p of plekken) {
    assert.match(p.regel, /\bbijeen\b/,
      p.rel + ' bouwt een idem-laag zonder bijeen mee te geven. Dan flushen het geld en de ' +
      'idem-sleutel apart, en een crash daartussen plus een retry boekt dubbel:\n  ' + p.regel);
  }
});

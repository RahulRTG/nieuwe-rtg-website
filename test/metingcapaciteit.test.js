/* DE METING PER CAPABILITY -- en de vloer die een leeg cijfer tegenhoudt.

   Waarom deze laag bestaat: de tenantstand droeg met opzet GEEN
   beschikbaarheidsgetal, met de reden dat de meting platformbreed is en een
   storing in een onderdeel dat een klant niet gebruikt als ZIJN storing zou
   verschijnen. Dat is niet op te lossen met een preciezer percentage maar door
   te tonen WELK onderdeel het was.

   Vier beweringen, en de eerste twee zijn de reden dat dit bestand er is:

   1. Een percentage over te weinig verzoeken wordt NIET gegeven. Nul fouten op
      drie verzoeken leest groener dan elk echt cijfer.
   2. Wat geen functie heeft, verdwijnt niet maar krijgt een eigen regel. Een
      totaal dat klopt terwijl er iets ontbreekt, is de gevaarlijkste vorm.
   3. Er wordt gegroepeerd op de BESTAANDE functiekaart en niet op een nieuwe.
   4. Het venster staat erbij, met wat het niet is.

   Draai los: node --test test/metingcapaciteit.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const mc = require('../server/meting-capaciteit');

/* Een functiekaart in het klein. De echte staat in server/functies.js; door hem
   hier in te spuiten is deze toets los te draaien EN is te zien dat deze module
   niets over de catalogus zelf aanneemt. */
const KAART = {
  '/api/alfa/': { id: 'alfa', naam: 'Alfa' },
  '/api/beta/': { id: 'beta', naam: 'Beta' }
};
const functieVoorPad = (pad) => {
  for (const p of Object.keys(KAART)) if (String(pad).startsWith(p)) return KAART[p];
  return null;
};
const reeks = (rijen) => ({ gestart: Date.now() - 3600000, verzoeken: rijen });

test('1. onder de vloer komt er geen percentage maar een reden', () => {
  const uit = mc.meet(reeks([
    { route: '/api/alfa/een', status: '2xx', aantal: mc.VLOER + 10 },
    { route: '/api/alfa/een', status: '5xx', aantal: 2 },
    { route: '/api/beta/een', status: '2xx', aantal: 3 }
  ]), functieVoorPad);

  const alfa = uit.find(c => c.id === 'alfa');
  const beta = uit.find(c => c.id === 'beta');
  assert.equal(typeof alfa.foutpercentage, 'number', 'genoeg verkeer: een cijfer');
  assert.equal(alfa.foutpercentage, Number((2 / (mc.VLOER + 12) * 100).toFixed(3)));
  assert.equal(alfa.nietGemeten, null);

  /* DE ASSERTIE WAAR DEZE TOETS VOOR BESTAAT. Beta heeft nul fouten, en toch
     staat er geen 0%. Nul op drie verzoeken is geen meting -- en het ziet er
     groener uit dan elk echt cijfer. */
  assert.equal(beta.foutpercentage, null);
  assert.match(beta.nietGemeten, /te weinig verzoeken/);
  assert.match(beta.nietGemeten, /groener leest dan het is|groener lezen dan het is/);
  assert.equal(beta.verzoeken, 3, 'het AANTAL staat er wel: dat is wel gemeten');
});

test('2. wat geen functie heeft verdwijnt niet', () => {
  const uit = mc.meet(reeks([
    { route: '/api/health', status: '2xx', aantal: 400 },
    { route: '(onbekend)', status: '4xx', aantal: 9 },
    { route: '/api/alfa/een', status: '2xx', aantal: 60 }
  ]), functieVoorPad);

  const zonder = uit.find(c => c.id === mc.ZONDER.id);
  assert.ok(zonder, 'de regel bestaat: ' + uit.map(c => c.id).join(', '));
  assert.equal(zonder.verzoeken, 409, 'en draagt ALLE verzoeken die nergens onder vallen');
  assert.equal(zonder.routes, 2);
  assert.equal(uit.reduce((n, c) => n + c.verzoeken, 0), 469, 'het totaal klopt zonder dat er iets is weggelaten');
});

test('3. er wordt gesorteerd op drukte, en 4xx telt niet als storing', () => {
  const uit = mc.meet(reeks([
    { route: '/api/beta/een', status: '2xx', aantal: 500 },
    { route: '/api/alfa/een', status: '4xx', aantal: 100 },
    { route: '/api/alfa/een', status: '2xx', aantal: 100 }
  ]), functieVoorPad);
  assert.equal(uit[0].id, 'beta', 'de drukste eerst; dat is de volgorde waarin iemand kijkt');
  const alfa = uit.find(c => c.id === 'alfa');
  assert.equal(alfa.clientfouten4xx, 100);
  assert.equal(alfa.foutpercentage, 0,
    'een 4xx is een afgewezen verzoek en geen storing -- anders telt elke verkeerde inlog als downtime');
});

test('4. de stand draagt zijn venster, en zegt wat er ook hier niet gemeten is', () => {
  const nepMeting = { reeksen: () => reeks([{ route: '/api/alfa/een', status: '2xx', aantal: 70 }]) };
  const st = mc.stand(nepMeting, { functieVoorPad });
  assert.ok(st.venster.sinds && st.venster.seconden >= 3600);
  assert.match(st.venster.let, /geen maandcijfer/,
    'zonder die zin is elk getal hier een bewering zonder tijdsaanduiding');
  assert.equal(st.verzoeken, 70);
  assert.deepEqual(st.nietGemeten.map(n => n.wat), ['per organisatie', 'over een langere periode']);
  for (const n of st.nietGemeten) assert.ok(n.reden.length > 40, n.wat + ' heeft een reden');
});

test('5. een kapotte functiekaart maakt de meting niet kapot', () => {
  /* Een capability-indeling die gooit, mag de hele stand niet meenemen: dan is
     een fout in de CATALOGUS ineens een storing in de METING. Alles valt dan
     terug op de regel "buiten de functiecatalogus", en dat is zichtbaar. */
  const stuk = () => { throw new Error('catalogus stuk'); };
  const uit = mc.meet(reeks([{ route: '/api/alfa/een', status: '2xx', aantal: 80 }]), stuk);
  assert.equal(uit.length, 1);
  assert.equal(uit[0].id, mc.ZONDER.id);
  assert.equal(uit[0].verzoeken, 80, 'het verkeer is niet verdwenen');
});

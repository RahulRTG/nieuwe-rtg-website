/* Life Command (LIFE.md fase 5): de eerste laag van deze wereld die iets MAG.

   De vijf besluiten die deze toetsen bewaken:

     1. er is geen weg die uitvoert zonder een expliciete keuze van de mens
     2. een voorstel wordt afgeleid en niet bewaard -- wat niet meer geldt,
        bestaat niet meer
     3. uitvoeren gaat via het DOMEIN, nooit met een eigen schrijfactie erlangs
     4. het log is append-only, en het beweert nooit dat er iets gebeurde dat
        mislukte
     5. rust is een uitkomst, en een voorstel hangt aan een openstaande zaak --
        nooit aan een gevoel over hoe het gaat tussen twee mensen

   Bij elke toets staat de mutatie die hem hoort te laten zakken; ze zijn alle
   met die mutatie gedraaid en gezien zakken (LAT.md regel 2). */
const test = require('node:test');
const assert = require('node:assert/strict');
const maakCommand = require('../server/kern/socialecommand');

const dag = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

/* Een nagemaakte db plus de twee lagen die Life Command leest. De vorm van
   mijnAgenda is uit kern/genootschap/bijeenkomst.js overgenomen (publiek()):
   `wat`, `groep`, `groepId`, `mijnAntwoord` -- niet verzonnen. */
function opzet(over) {
  const db = { data: {} };
  const geschreven = [];
  const kern = {
    socialegraaf: {
      beeld: () => ({ telling: { wachtOpMij: 0, wachtOpAnder: 0, achterstallig: 0 }, stil: [] }),
      lijn: () => ({ vakken: [], later: 0, stil: [] })
    },
    bijeenkomst: {
      mijnAgenda: () => ({ komt: [] }),
      antwoord: (sess, gid, id, wat) => { geschreven.push({ gid, id, wat }); return { ok: true }; }
    }
  };
  Object.assign(kern, over || {});
  const k = maakCommand({ kern, db, save: () => {}, klok: () => new Date('2026-08-11T12:00:00Z') });
  return { c: k.socialecommand, db, geschreven, kern };
}

const bijeenkomst = (o) => Object.assign({ id: 'b1', groepId: 'g1', groep: 'De Kring',
  wat: 'Borrel', datum: dag(5), tijd: '20:00', mijnAntwoord: null, gastheer: 'Ux' }, o);

/* DE BELANGRIJKSTE TOETS VAN DEZE FASE. Het werkwoord van deze wereld is
   samenstellen en klaarzetten; uitvoeren gebeurt na een keuze van de mens.
   Er hoort dus GEEN functie te bestaan die zelf handelt.

   DE MUTATIE: voeg aan index.js een functie toe die een voorstel uitvoert zonder
   keuze (bijvoorbeeld `voerUit(key, id)`). */
test('er is geen weg die uitvoert zonder bevestiging', () => {
  const { c } = opzet();
  assert.deepEqual(Object.keys(c).sort(), ['bevestig', 'command', 'log'],
    'command leest, log leest, en bevestig is de enige die handelt');
});

/* DE MUTATIE: laat bevestig() de keuze niet toetsen tegen v.keuzes, of vul een
   standaardkeuze in als er geen is meegegeven. Dan is klaarzetten stiekem
   uitvoeren geworden. */
test('bevestigen zonder geldige keuze verandert niets', () => {
  const { c, geschreven } = opzet({
    bijeenkomst: { mijnAgenda: () => ({ komt: [bijeenkomst()] }),
      antwoord: () => { throw new Error('had niet aangeroepen mogen worden'); } }
  });
  const id = c.command('k').voorstellen[0].id;
  for (const keuze of ['', null, 'vast', 'JA ']) {
    const r = c.bevestig('k', id, keuze);
    assert.ok(r.error, 'keuze "' + keuze + '" hoort geweigerd te worden');
  }
  assert.deepEqual(geschreven, []);
  assert.deepEqual(c.log('k'), [], 'een geweigerde bevestiging staat niet in het log');
});

/* Een voorstel wordt AFGELEID en niet bewaard: wat niet meer op de lijst staat,
   kan niet bevestigd worden. Zo kan een mens niets bevestigen dat intussen is
   afgelast of beantwoord.

   DE MUTATIE: bewaar de voorstellen bij het opvragen en zoek in die voorraad in
   plaats van opnieuw af te leiden. */
test('een voorstel dat niet meer geldt, kan niet bevestigd worden', () => {
  let afgelast = false;
  const { c, geschreven } = opzet({
    bijeenkomst: {
      mijnAgenda: () => ({ komt: [bijeenkomst({ afgelast: afgelast ? dag(0) : null })] }),
      antwoord: () => { throw new Error('had niet aangeroepen mogen worden'); }
    }
  });
  const id = c.command('k').voorstellen[0].id;
  afgelast = true;
  assert.equal(c.command('k').voorstellen.length, 0, 'een afgelaste bijeenkomst vraagt niets meer');
  const r = c.bevestig('k', id, 'ja');
  assert.equal(r.status, 404);
  assert.deepEqual(geschreven, []);
});

/* Uitvoeren gaat via het DOMEIN. Zou deze laag zelf schrijven, dan bestond een
   antwoord op twee plekken (LAT.md regel 4).

   DE MUTATIE: laat bevestig() het antwoord in een eigen opslag zetten in plaats
   van kern.bijeenkomst.antwoord aan te roepen. */
test('bevestigen loopt door het domein en schrijft niets zelf', () => {
  const { c, geschreven, db } = opzet({
    bijeenkomst: { mijnAgenda: () => ({ komt: [bijeenkomst()] }),
      antwoord: (sess, gid, id, wat) => { geschreven.push({ gid, id, wat }); return { ok: true }; } }
  });
  const id = c.command('k').voorstellen[0].id;
  const r = c.bevestig('k', id, 'ja');
  assert.equal(r.ok, true);
  assert.deepEqual(geschreven, [{ gid: 'g1', id: 'b1', wat: 'ja' }]);
  /* De enige eigen opslag van deze wereld is het log. Staat er iets anders in
     db.data, dan is er een tweede waarheid ontstaan. */
  assert.deepEqual(Object.keys(db.data), ['socialeacties']);
});

/* HET LOG BEWEERT NOOIT DAT ER IETS GEBEURDE DAT MISLUKTE. Het domein voert
   eerst uit; pas daarna wordt er geschreven.

   DE MUTATIE: schrijf in index.js het log VOOR de domeinaanroep. Dan staat er
   een handeling in de verantwoording die nooit is gebeurd. */
test('een mislukte handeling komt niet in het log', () => {
  const { c } = opzet({
    bijeenkomst: { mijnAgenda: () => ({ komt: [bijeenkomst()] }),
      antwoord: () => ({ error: 'Het is vol. Zeg iemand af, dan komt er een plaats vrij.' }) }
  });
  const id = c.command('k').voorstellen[0].id;
  const r = c.bevestig('k', id, 'ja');
  assert.ok(r.error);
  assert.deepEqual(c.log('k'), []);
});

/* Het log draagt WIE, WAT, WAAROM en de GEGEVENS waarop het rustte (GELD.md
   par. 5). Zonder die regels is een log een lijst beweringen.

   DE MUTATIE: laat `gegevens` weg bij het schrijven, of zet `wie` op 'rahul'
   terwijl de mens bevestigde. */
test('het log zegt wie, wat, waarom en waarop het rustte', () => {
  const { c } = opzet({
    bijeenkomst: { mijnAgenda: () => ({ komt: [bijeenkomst()] }),
      antwoord: () => ({ ok: true }) }
  });
  const id = c.command('k').voorstellen[0].id;
  c.bevestig('k', id, 'misschien');
  const rij = c.log('k')[0];
  assert.equal(rij.wie, 'lid', 'de mens bevestigde; het log mag niet zeggen dat het systeem koos');
  assert.match(rij.wat, /misschien/);
  assert.match(rij.wat, /Borrel/);
  assert.equal(rij.waarom, 'klaargezet door Rahul, bevestigd door u');
  assert.ok(rij.gegevens.length >= 2, 'de verantwoording reist mee');
  assert.match(rij.gegevens[0], /De Kring/);
});

/* APPEND-ONLY: er is geen functie die wist, en meekijken is geen meeschrijven.

   DE MUTATIE: geef in actielog.js de opgeslagen rijen terug in plaats van
   kopieen. Dan herschrijft wie een rij muteert het log. */
test('het log is append-only en geeft kopieen', () => {
  const { c } = opzet({
    bijeenkomst: { mijnAgenda: () => ({ komt: [bijeenkomst()] }), antwoord: () => ({ ok: true }) }
  });
  c.bevestig('k', c.command('k').voorstellen[0].id, 'ja');
  const eerste = c.log('k')[0];
  eerste.wat = 'HERSCHREVEN';
  eerste.gegevens.push('erbij verzonnen');
  const opnieuw = c.log('k')[0];
  assert.notEqual(opnieuw.wat, 'HERSCHREVEN');
  assert.ok(!opnieuw.gegevens.includes('erbij verzonnen'));
});

/* RUST IS EEN UITKOMST (ONTWERP.md). Een cockpit die altijd iets te melden
   heeft, is een lijst.

   DE MUTATIE: laat `rustig` altijd false zijn, of vul de cockpit met een tip
   wanneer er niets speelt. */
test('niets openstaand is een uitkomst en geen lege staat', () => {
  const { c } = opzet();
  const d = c.command('k');
  assert.equal(d.rustig, true);
  assert.deepEqual(d.voorstellen, []);
  assert.deepEqual(d.stand, { wachtOpMij: 0, wachtOpAnder: 0, achterstallig: 0 });
});

/* EEN VOORSTEL HANGT AAN EEN OPENSTAANDE ZAAK. Een bijeenkomst waar al op
   geantwoord is, vraagt niets meer -- ook niet "wilt u het nog wijzigen".

   DE MUTATIE: laat de `mijnAntwoord`-controle weg in voorstellen.js. Dan stelt
   het systeem voor om iets te doen dat allang gedaan is, en dat is het
   aandacht-bedelen dat CLAUDE.md verbiedt. */
test('waar al op geantwoord is, staat geen voorstel', () => {
  const { c } = opzet({
    bijeenkomst: { mijnAgenda: () => ({ komt: [
      bijeenkomst({ id: 'b1', mijnAntwoord: 'ja' }),
      bijeenkomst({ id: 'b2', wat: 'Lezing', mijnAntwoord: null })
    ] }), antwoord: () => ({ ok: true }) }
  });
  const v = c.command('k').voorstellen;
  assert.deepEqual(v.map(x => x.titel), ['Lezing']);
  assert.deepEqual(v[0].keuzes, ['ja', 'misschien', 'nee']);
  assert.ok(v[0].gevolg, 'wat er gebeurt bij bevestigen staat er vooraf bij');
});

/* Een bron die stukgaat wordt gemeld: een cockpit waar een bron uit is
   weggevallen ziet er RUSTIG uit, en dat is de gevaarlijkste stilte die deze
   wereld kent.

   DE MUTATIE: haal de try/catch uit voorstellen(), of laat de naam niet in
   stil[] belanden. */
test('een stukke bron maakt de cockpit niet stilletjes rustig', () => {
  const { c } = opzet({
    bijeenkomst: { mijnAgenda: () => { throw new Error('genootschap stuk'); },
      antwoord: () => ({ ok: true }) }
  });
  const d = c.command('k');
  assert.deepEqual(d.stil, ['bijeenkomsten']);
});

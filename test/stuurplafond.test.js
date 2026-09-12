/* HET UITVOERINGSPLAFOND (server/kern/stuur/plafond.js).

   Dit bestand bewaakt de regel waarop de hele omlegging van de vraagbalk rust:
   geen enkele bestaande vraag mag door een routewissel automatisch een side
   effect krijgen. Elke toets hieronder draagt zijn MUTATIE -- de wijziging die
   hem hoort te laten zakken -- want een toets die je niet hebt zien zakken is
   geen toets (LAT.md regel 2). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { plafondVan, TREDEN, NIVEAUS_BIJ_TREDE, STANDAARD } = require('../server/kern/stuur/plafond');
const { beleidVoor, toegestanePaden, NIVEAUS } = require('../server/kern/stuur/beleid');

/* De echte paden, niet verzonnen: een fixture die zich aan de aangenomen vorm
   houdt in plaats van aan die van de bron, is precies de fout uit CARRIERE.md
   par. 6 (achttien groene toetsen boven een kapotte functie). */
function echtePaden() {
  let reg;
  try { reg = require('../IDEMPROEF.json'); } catch (e) { return []; }
  return [...new Set((reg.perRoute || [])
    .filter(r => r && r.methode === 'POST' && typeof r.pad === 'string')
    .map(r => r.pad))].sort();
}
const ALLE = echtePaden();
const TOEGESTAAN = ALLE.length ? toegestanePaden(ALLE, 'member') : [];

test('zonder mandaat is het plafond `tonen` -- leeg is dicht', () => {
  /* DE MUTATIE: zet STANDAARD in plafond.js op 'uitvoeren'. */
  assert.ok(TOEGESTAAN.length, 'geen toegestane paden; er is niets gemeten');
  const uit = plafondVan({ paden: TOEGESTAAN, wereld: 'member' });
  assert.equal(uit.trede, 'tonen', 'zonder mandaat hoort er niets zelfstandigs te mogen');
  assert.equal(STANDAARD, 'tonen');
});

test('op `tonen` komt er GEEN pad door dat iets verandert', () => {
  /* Dit is de veiligheidsregel zelf. Niet "er zijn er minder" maar: van elk pad
     dat overblijft is het beleidsniveau `lezen`.
     DE MUTATIE: voeg NIVEAUS.klein toe aan NIVEAUS_BIJ_TREDE.tonen. */
  const uit = plafondVan({ paden: TOEGESTAAN, wereld: 'member' });
  assert.ok(uit.paden.length, 'er blijft niets over; dan meet deze toets niets');
  for (const pad of uit.paden) {
    assert.equal(beleidVoor(pad, 'member').niveau, NIVEAUS.lezen,
      pad + ' kwam door het plafond `tonen` heen terwijl het niet alleen leest');
  }
});

test('het plafond kan alleen VERLAGEN, nooit verhogen', () => {
  /* Een aanroeper die `uitvoeren` vraagt terwijl er geen mandaat is, krijgt
     `tonen`. Anders zou de vraag zelf de bevoegdheid bepalen, en dat is precies
     wat mandaat.js verbiedt.
     DE MUTATIE: laat plafondVan de gevraagde trede winnen in plaats van de
     laagste van beide. */
  const uit = plafondVan({ paden: TOEGESTAAN, wereld: 'member', gevraagd: 'uitvoeren' });
  assert.equal(uit.trede, 'tonen', 'de gevraagde trede won van het mandaat');
});

test('strenger vragen mag wel', () => {
  const uit = plafondVan({ paden: TOEGESTAAN, wereld: 'member', gevraagd: 'geen' });
  assert.equal(uit.trede, 'geen');
  assert.equal(uit.paden.length, 0, 'op trede `geen` hoort er niets door te komen');
});

test('een onzinnige trede opent niets', () => {
  /* DE MUTATIE: laat geldigeTrede() onbekende waarden doorlaten. Een typefout
     hoort geen bevoegdheid te openen. */
  for (const raar of ['UITVOEREN!', 'admin', '', null, 0, {}, ['uitvoeren']]) {
    const uit = plafondVan({ paden: TOEGESTAAN, wereld: 'member', gevraagd: raar });
    assert.equal(uit.trede, 'tonen', JSON.stringify(raar) + ' veranderde de trede');
  }
});

test('de uitkomst is altijd een DEELVERZAMELING van de invoer', () => {
  /* Structureel, niet als vuistregel: deze laag mag niets toevoegen.
     DE MUTATIE: laat plafondVan een pad teruggeven dat niet in `paden` zat. */
  const in0 = new Set(TOEGESTAAN);
  for (const trede of TREDEN) {
    const uit = plafondVan({ paden: TOEGESTAAN, wereld: 'member', gevraagd: trede });
    for (const pad of uit.paden) assert.ok(in0.has(pad), pad + ' zat niet in de invoer');
  }
});

test('de treden zijn cumulatief: meer mogen betekent nooit minder mogen', () => {
  /* DE MUTATIE: haal NIVEAUS.lezen weg uit NIVEAUS_BIJ_TREDE.uitvoeren. */
  for (let i = 1; i < TREDEN.length; i++) {
    const lager = new Set(NIVEAUS_BIJ_TREDE[TREDEN[i - 1]]);
    for (const niveau of lager) {
      assert.ok(NIVEAUS_BIJ_TREDE[TREDEN[i]].indexOf(niveau) >= 0,
        TREDEN[i] + ' mist ' + niveau + ', dat ' + TREDEN[i - 1] + ' wel had');
    }
  }
});

test('een verboden pad komt op geen enkele trede door', () => {
  /* DE MUTATIE: laat plafondVan NIVEAUS.verboden ergens toe. */
  const verzonnen = '/api/office/geheim/dit-bestaat-niet';
  for (const trede of TREDEN) {
    const uit = plafondVan({ paden: [verzonnen], wereld: 'member', gevraagd: trede });
    assert.equal(uit.paden.length, 0, 'een verboden pad kwam door op ' + trede);
  }
});

test('het antwoord zegt altijd WAT er werd tegengehouden en waarom', () => {
  /* Een versmalling die niet zegt wat hij weghield, is de faalvorm waar
     EXECUTIE.md blok 0 voor waarschuwt. */
  const uit = plafondVan({ paden: TOEGESTAAN, wereld: 'member' });
  assert.ok(uit.reden && uit.reden.length > 20, 'geen leesbare reden');
  assert.ok(uit.grens && /verlagen/i.test(uit.grens), 'de grens staat er niet bij');
  assert.equal(typeof uit.geweerd, 'object');
  assert.ok(Object.keys(uit.geweerd).length, 'niets geweerd; dan meet deze toets niets');
});

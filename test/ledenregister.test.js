/* Ledenregister (kern/ledenregister.js): leden op codenaam, gesplitst per
   stad/land/alfabet/geslacht en pas, met de omzet per pas en de 30%-
   foundationsplit (20% lokaal, 10% RTF). Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

function maak(rijen) {
  const accounts = { ledenRegisterRijen: () => rijen };
  const onboarding = { store: () => ({ profielen: {
    'user-1': { velden: { woonplaats: 'Ibiza' } },
    'user-2': { velden: { woonplaats: 'Amsterdam' } },
    'user-3': { velden: { woonplaats: 'Ibiza' } }
  } }) };
  const geldPasprijzen = () => ({ passen: { rtg: { maandCenten: 6500 }, lifestyle: { maandCenten: 2000000 } } });
  return require('../server/kern/ledenregister')({ accounts, onboarding, geldPasprijzen, ledenAantal: () => rijen.length }).ledenregister;
}

const RIJEN = [
  { id: 1, key: 'user-1', tier: 'rtg', codename: 'Anemoon', geslacht: 'v', land: 'ES' },
  { id: 2, key: 'user-2', tier: 'lifestyle', codename: 'Berkenhout', geslacht: 'm', land: 'NL' },
  { id: 3, key: 'user-3', tier: 'rtg', codename: 'Ceder', geslacht: 'x', land: 'ES' },
  { id: 4, key: 'user-4', tier: 'guest', codename: 'Dennenhout', geslacht: null, land: null },
  { id: 5, key: 'user-5', tier: 'business', codename: 'Eik', geslacht: 'm', land: 'NL' }
];

test('splitst per pas, geslacht, land en stad', () => {
  const lr = maak(RIJEN);
  const r = lr.register();
  const pas = Object.fromEntries(r.perPas.map(p => [p.pas, p.aantal]));
  assert.equal(pas.rtg, 2);
  assert.equal(pas.lifestyle, 1);
  assert.equal(pas.business, 1);
  assert.equal(pas.gratis, 1); // de gast telt als gratis
  const gesl = Object.fromEntries(r.perGeslacht.map(g => [g.naam, g.aantal]));
  assert.equal(gesl.Vrouw, 1); assert.equal(gesl.Man, 2); assert.equal(gesl.X, 1);
  const stad = Object.fromEntries(r.perStad.map(s => [s.naam, s.aantal]));
  assert.equal(stad.Ibiza, 2); assert.equal(stad.Amsterdam, 1);
});

test('omzet per pas en de 30%-split (20% lokaal, 10% RTF)', () => {
  const lr = maak(RIJEN);
  const r = lr.register();
  const omzet = Object.fromEntries(r.omzet.map(o => [o.pas, o]));
  assert.equal(omzet.rtg.maandOmzet, 130);       // 2 x 65

  /* SINDS DE LADDER (20 augustus 2026) zijn Business EN Lifestyle contractueel:
     hun bijdrage staat op het contract van het lid en niet in de prijslijst.
     Deze staat telt ze daarom niet mee, en dat is de bedoeling -- hij rekende
     Lifestyle voorheen op de lijstprijs van 20.000, wat voor elk lid met een
     andere afspraak een verzonnen omzetregel opleverde.

     De val die hier bewaakt wordt: NIET stilzwijgend nul. Een contractuele
     trede hoort `opMaat` te zijn en geen maandomzet van 0,00 -- dat is dezelfde
     `|| 0`-fout die deze module eerder al eens maakte. */
  for (const pas of ['lifestyle', 'business']) {
    assert.equal(omzet[pas].opMaat, true, pas + ' is contractueel');
    assert.equal(omzet[pas].maandOmzet, null, pas + ': geen bedrag, en nadrukkelijk niet nul');
    assert.equal(omzet[pas].prijsPP, null, pas + ': ook geen prijs per lid');
  }
  // het totaal loopt dus alleen over de treden met een lijstprijs
  assert.equal(r.split.totaalOmzet, 130);
  assert.equal(r.split.foundation30, Math.round(130 * 0.30 * 100) / 100);
  assert.equal(r.split.lokaal20, Math.round(130 * 0.20 * 100) / 100);
  assert.equal(r.split.rtf10, Math.round(130 * 0.10 * 100) / 100);
  // en de leden die er niet in zitten, worden wel geteld: 1 Lifestyle + 1 Business
  assert.equal(r.split.businessOpMaat, 2,
    'een lid buiten het totaal hoort zichtbaar te blijven, anders lijkt het totaal compleet');
});

test('de alfabetische lijst is te filteren per pas en stad', () => {
  const lr = maak(RIJEN);
  const alle = lr.register().lijst.map(m => m.codenaam);
  assert.deepEqual(alle, ['Anemoon', 'Berkenhout', 'Ceder', 'Dennenhout', 'Eik']); // alfabetisch
  const rtgIbiza = lr.register({ pas: 'rtg', stad: 'Ibiza' }).lijst.map(m => m.codenaam);
  assert.deepEqual(rtgIbiza, ['Anemoon', 'Ceder']);
});

/* De aanwas per bedrijf. Een werkgever kan een wervingslink sturen waarmee
   iemand gratis lid wordt en meteen in dienst treedt; wie zo binnenkomt draagt
   die herkomst mee (member_state.via, zie routes/supplier/werving/uitnodiging.js).
   Voor RTG is dat een ander getal dan losse aanmeldingen: een zaak die vijftig
   mensen binnenbrengt is een kanaal.

   De regel die hier ook wordt bewaakt: geteld wordt WELK bedrijf hoeveel leden
   bracht, en de lijst blijft op codenaam. Het register kent geen echte namen en
   dat mag hier niet gaan schuiven. */
const RIJEN_VIA = [
  { id: 1, key: 'user-1', tier: 'rtg', codename: 'Anemoon', geslacht: 'v', land: 'NL',
    via: { soort: 'zaak', code: 'ESVEDRA', naam: 'Es Vedra Tours' } },
  { id: 2, key: 'user-2', tier: 'rtg', codename: 'Berkenhout', geslacht: 'm', land: 'NL',
    via: { soort: 'zaak', code: 'ESVEDRA', naam: 'Es Vedra Tours' } },
  { id: 3, key: 'user-3', tier: 'rtg', codename: 'Ceder', geslacht: 'x', land: 'NL',
    via: { soort: 'zaak', code: 'KIKUNOI', naam: 'Kikunoi' } },
  { id: 4, key: 'user-4', tier: 'rtg', codename: 'Dennenhout', geslacht: null, land: 'NL' }
];

test('telt wie er via welk bedrijf lid is geworden, op naam van het bedrijf', () => {
  const lr = maak(RIJEN_VIA);
  const r = lr.register();
  assert.equal(r.viaBedrijf, 3, 'drie van de vier kwamen via een werkgever binnen');
  const per = r.perBedrijf.map(b => [b.naam, b.aantal]);
  assert.deepEqual(per, [['Es Vedra Tours', 2], ['Kikunoi', 1]], 'grootste kanaal eerst');
  assert.equal(r.perBedrijf[0].code, 'ESVEDRA', 'de zaakcode reist mee om op te kunnen zoeken');
});

test('de aanwas per bedrijf noemt bedrijven, nooit personen', () => {
  const lr = maak(RIJEN_VIA);
  const r = lr.register();
  // in de lijst staat per lid hoogstens de naam van het BEDRIJF; de leden zelf
  // blijven codenamen, precies zoals de rest van dit register
  const anemoon = r.lijst.find(m => m.codenaam === 'Anemoon');
  assert.equal(anemoon.via, 'Es Vedra Tours');
  assert.equal(anemoon.naam, undefined, 'geen echte naam in het register');
  assert.equal(anemoon.email, undefined, 'en geen e-mailadres');
  const zonder = r.lijst.find(m => m.codenaam === 'Dennenhout');
  assert.equal(zonder.via, null, 'wie zichzelf aanmeldde heeft geen aanbrenger');
});

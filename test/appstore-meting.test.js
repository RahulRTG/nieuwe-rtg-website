/* CIJFERS OVER EEN APP -- en of er werkelijk geen mens in zit.

   Besloten op 27 augustus 2026: privacyarme tellingen per dag. De verleiding bij
   zo'n meter is precies één ding, en het is het ding waar dit huis om draait:
   je hebt het lid tóch bij de hand -- de brug moet immers weten wat dat lid
   heeft verleend -- dus "unieke gebruikers" is een regel code weg.

   Deze toets houdt vier dingen vast:

     1. de meter kan het lid niet eens tellen: hij heeft er geen parameter voor,
        en zijn aanroeper geeft hem niets anders dan de appsleutel en de code;
     2. er staan geen tijdstippen in, alleen dagen;
     3. elke uitgang van de brug telt mee -- ook de weigeringen, want dat is wat
        een uitgever kan repareren;
     4. de teller schrijft niet bij elke aanroep naar schijf, want save() schrijft
        de hele database weg.

   Draai los: node --test test/appstore-meting.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const M = require('../server/kern/appstore/meting');
const { maakBrug } = require('../server/kern/appstore/brug');

const WORTEL = path.join(__dirname, '..');

function bouw() {
  const staat = { opslag: {}, bakjes: {}, meting: {} };
  let schrijvingen = 0;
  const brug = maakBrug({
    S: () => staat, save: () => { schrijvingen++; }, boek() {},
    nu: () => new Date().toISOString(), eigen: (o, k) => o[k]
  });
  return { brug, staat, tel: () => schrijvingen };
}
const ctx = (extra) => Object.assign({
  key: 'lid1', sleutel: 'mijn-app', codenaam: 'Havik', taal: 'nl', pas: 'rtg',
  verleend: ['profiel.basis'], vraagt: ['profiel.basis']
}, extra || {});

test('1 - de meter kan het lid niet tellen: hij heeft er geen parameter voor', () => {
  /* Dit is de belangrijkste toets van dit bestand, en hij kijkt naar de BRON.
     Een meter die het lid meekrijgt, telt het vroeg of laat -- of iemand voegt
     later "unieke gebruikers" toe omdat de waarde er toch al is. */
  const bron = fs.readFileSync(path.join(WORTEL, 'server/kern/appstore/meting.js'), 'utf8');
  assert.match(bron, /function tel\(sleutel, code\)/,
    'tel() hoort alleen een appsleutel en een foutcode aan te nemen');
  /* Commentaar EN tekenreeksen eraf. Die tweede is nodig en niet gemakzuchtig:
     de waarschuwing die met elk antwoord meereist zegt zelf "er wordt niet
     bijgehouden welk lid je app gebruikt" -- dat woord ontkent het lek, het is
     er niet een. Zonder deze streep zakt de toets op zijn eigen belofte. */
  const kaal = bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/'(?:[^'\\]|\\.)*'/g, "''");
  for (const woord of ['codenaam', 'key', 'lid', 'sessie']) {
    assert.ok(!new RegExp('\\b' + woord + '\\b').test(kaal),
      '"' + woord + '" hoort in de code van de meter niet voor te komen');
  }
});

test('2 - en de brug geeft hem ook niets anders', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'server/kern/appstore/brug.js'), 'utf8');
  assert.match(bron, /meting\.tel\(sleutel, r && r\.code \? r\.code : null\)/,
    'de brug hoort alleen de sleutel en de code door te geven');
});

test('3 - aanroepen en weigeringen worden geteld, uitgesplitst naar code', () => {
  const { brug } = bouw();
  brug.roep(ctx({ methode: 'profiel.wieBenIk' }));
  brug.roep(ctx({ methode: 'profiel.wieBenIk' }));
  brug.roep(ctx({ methode: 'bericht.zet', args: { tekst: 'hoi daar' } }));  // niet gevraagd
  brug.roep(ctx({ methode: 'zomaar.iets' }));                               // bestaat niet

  const c = brug.meting.cijfers('mijn-app');
  assert.equal(c.totaal.aanroepen, 4);
  assert.equal(c.totaal.weigeringen, 2);
  assert.equal(c.totaal.codes.RTG_MACHTIGING_NIET_GEVRAAGD, 1);
  assert.equal(c.totaal.codes.RTG_METHODE_ONBEKEND, 1);
});

test('4 - er staan dagen in en geen tijdstippen', () => {
  const { brug, staat } = bouw();
  brug.roep(ctx({ methode: 'profiel.wieBenIk' }));
  const dagen = Object.keys(staat.meting['mijn-app'].dagen);
  assert.equal(dagen.length, 1);
  assert.match(dagen[0], /^\d{4}-\d{2}-\d{2}$/, 'een dag, niet een moment');
  const alles = JSON.stringify(staat.meting);
  assert.ok(!/T\d{2}:\d{2}/.test(alles), 'er hoort nergens een tijdstip in de opslag te staan');
  assert.ok(!/lid1|Havik/.test(alles), 'en nergens een lid');
});

test('5 - de teller schrijft niet bij elke aanroep naar schijf', () => {
  /* save() schrijft de HELE database weg en de brug staat 120 aanroepen per
     minuut toe. Bij elke aanroep opslaan maakt van een teller een schrijfstorm --
     dezelfde reden waarom de rem in kern/appstore/brug.js in het geheugen zit. */
  const { brug, tel } = bouw();
  for (let i = 0; i < 50; i++) brug.roep(ctx({ methode: 'profiel.wieBenIk' }));
  assert.ok(tel() <= 2, 'vijftig aanroepen horen hooguit een of twee schrijvingen te geven, waren er ' + tel());
  // maar de telling zelf klopt wel, want optellen gebeurt altijd
  assert.equal(brug.meting.cijfers('mijn-app').totaal.aanroepen, 50);
});

test('6 - de dagenlijst blijft begrensd', () => {
  const { brug, staat } = bouw();
  brug.roep(ctx({ methode: 'profiel.wieBenIk' }));
  const r = staat.meting['mijn-app'];
  /* ECHT verschillende dagen, en dat is niet vanzelfsprekend: de eerste versie
     bouwde ze uit (i%12, i%28) en die herhalen zich na 84 stuks -- onder de
     grens van 90, dus snoei had nooit iets te doen en de mutatie die snoei
     weghaalde bleef groen. Nu een echte reeks. */
  const begin = Date.UTC(2020, 0, 1);
  for (let i = 0; i < M.DAGEN_MAX + 20; i++) {
    const d = new Date(begin + i * 86400000).toISOString().slice(0, 10);
    r.dagen[d] = { aanroepen: 1, weigeringen: 0, codes: {} };
  }
  assert.ok(Object.keys(r.dagen).length > M.DAGEN_MAX,
    'de proef hoort de grens echt te overschrijden, anders toetst hij niets');
  brug.roep(ctx({ methode: 'profiel.wieBenIk' }));
  assert.ok(Object.keys(r.dagen).length <= M.DAGEN_MAX,
    'de oudste dag hoort eraf te vallen, gevonden: ' + Object.keys(r.dagen).length);
});

test('7 - de waarschuwing reist mee met elk antwoord', () => {
  /* Zonder die zin leest iemand "412 aanroepen" als "412 gebruikers", en dat is
     precies het misverstand dat deze meter niet mag voeden. */
  const { brug } = bouw();
  const c = brug.meting.cijfers('mijn-app');
  assert.match(c.let, /geen mensen/);
  assert.match(c.let, /niet bijgehouden welk lid/);
});

test('8 - een app zonder aanroepen geeft nullen en geen fout', () => {
  const { brug } = bouw();
  const c = brug.meting.cijfers('bestaat-niet');
  assert.equal(c.totaal.aanroepen, 0);
  assert.deepEqual(c.dagen, []);
  assert.ok(c.let, 'ook dan hoort de waarschuwing erbij te staan');
});

test('9 - cijfersVan geeft alleen de apps die je meegeeft', () => {
  /* De meter weet met opzet niet wie welke app bezit -- dat weet de motor. Zou
     hij het zelf uitzoeken, dan was er een tweede plek waar eigendom wordt
     bepaald (LAT-regel 4). */
  const { brug } = bouw();
  brug.roep(ctx({ methode: 'profiel.wieBenIk' }));
  brug.roep(ctx({ sleutel: 'app-van-een-ander', methode: 'profiel.wieBenIk' }));
  const uit = brug.meting.cijfersVan(['mijn-app']);
  assert.equal(uit.length, 1);
  assert.equal(uit[0].sleutel, 'mijn-app');
  assert.equal(uit[0].totaal.aanroepen, 1);
});

test('10 - de route geeft alleen de eigen apps door', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'server/routes/appstore/uitgever.js'), 'utf8');
  assert.match(bron, /'\/api\/appstore\/uitgever\/cijfers', supplierAuth, metOrg/,
    'de cijfers horen achter metOrg, anders leest een zaak zonder organisatie mee');
  assert.match(bron, /appstore\.uitgeverApps\(o\.org\)/,
    'en de apps horen uit de organisatie van de INLOG te komen, niet uit het verzoek');
});

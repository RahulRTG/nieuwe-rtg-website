/* DE MENSGRONDEN (scripts/lib/mensgrond.js) en hun meter (scripts/mensgrond.js).

   De lijst beweert iets dat in twee richtingen kan breken, en elke richting is een
   andere schade:
     - een grond die STIL wegvalt, laat de machine een besluit nemen dat bij een mens
       hoort (de overtreding);
     - een grond die er niet is maar wel geteld wordt, houdt een mens aan het werk die
       er niet hoeft te staan (de schuld, verborgen).
   Deze toets bewaakt daarom vooral de RICHTING van elke twijfel, en de vorm waarin
   de meter telt: per grond, nooit als percentage mensenwerk.

   Regel 5, 6 en 7 zijn elk een fout die de meter in zijn eerste rondes werkelijk
   maakte: een niet-bewezen lezing een overtreding noemen, /api/logout tot
   automatiseringsschuld verklaren, en de terugstortstand -- de juridische positie
   van RTG -- "mens tot er bewijs is" noemen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const mg = require('../scripts/lib/mensgrond');
const { meet } = require('../scripts/mensgrond');

const WORTEL = path.join(__dirname, '..');
let U = null;
const uitslag = () => (U = U || meet());

test('1. de lijst is gesloten, en elke vertaling wijst naar een grond die bestaat', () => {
  assert.deepEqual(mg.NAMEN, ['fysieke-aanwezigheid', 'oordeel', 'toestemming', 'relatie',
    'wettelijke-bevoegdheid', 'tweede-persoon', 'geld', 'onomkeerbaar', 'terugweg-onbewezen'],
    'de gesloten lijst mensgronden is veranderd. Een grond erbij of eraf is een besluit (AUTONOMIE.md par. 2.9), geen opruimwerk.');
  for (const g of [...Object.values(mg.UIT_EFFECT), ...Object.values(mg.UIT_BODEM),
    ...mg.UIT_NOOIT_AUTONOOM.map(r => r.grond).filter(Boolean), ...Object.values(mg.UIT_DEUR)])
    assert.ok(mg.GRONDEN[g], 'vertaling naar een grond die niet in de lijst staat: ' + g);
  /* Elk pad waar geen mandaat over gaat, heeft een grond -- gelezen uit mandaat.js zelf. */
  for (const r of mg.UIT_NOOIT_AUTONOOM)
    assert.ok(r.grond, 'mandaat.js NOOIT_AUTONOOM heeft een patroon zonder mensgrond: ' + r.patroon.source);
  assert.equal(mg.UIT_NOOIT_AUTONOOM.length, require('../server/kern/stuur/mandaat').NOOIT_AUTONOOM.length);
  /* BLOCKED is geen grond: wachten op een ander is een toestand (ONBEKEND/UITSTELLEN). */
  assert.ok(!mg.GRONDEN.blocked && !mg.GRONDEN.geblokkeerd && !mg.GRONDEN.wacht,
    'een wachtstand is als mensgrond opgenomen; dat is een toestand van de controlplane, geen reden voor een mens');
});

test('2. elk effect is ingedeeld: een grond, of geen grond MET reden', () => {
  const { NAMEN } = require('../server/kern/isolatie/effectwoorden');
  for (const e of NAMEN) {
    assert.ok(mg.UIT_EFFECT[e] || mg.GEEN_GROND[e],
      'het effect ' + e + ' is nergens ingedeeld. Een nieuw effect blijft zichtbaar onbeslist en nooit stil zonder grond.');
    assert.ok(!(mg.UIT_EFFECT[e] && mg.GEEN_GROND[e]), e + ' staat in beide lijsten');
  }
});

test('3. CAN_VERIFY en CAN_RECOVER zijn poorten en geen stemmen', () => {
  const g = mg.grondenVan({ pad: '/api/x/y', kant: 'klant', effecten: ['CONFIGUREREN'], effectgraad: 'verklaard', herstel: 'bewezen' });
  const alles = { gevolg: true, terugweg: true, herhaling: true, bewijs: true };
  assert.equal(mg.deelIn({ gronden: g, machineBereik: true, poorten: alles, niveau: 'klein' }).uitkomst, 'machinewerk');
  /* Drie van vier is niet genoeg, voor elk van de twee harde poorten apart. */
  for (const weg of ['gevolg', 'terugweg']) {
    const p = Object.assign({}, alles, { [weg]: false });
    assert.equal(mg.deelIn({ gronden: g, machineBereik: true, poorten: p, niveau: 'klein' }).uitkomst, 'overtreding',
      'met ' + weg + ' gezakt en de rest groen liet de indeling de machine toch gaan');
  }
});

test('4. een blijvende grond onder machinebereik is altijd een overtreding', () => {
  for (const [effect, grond] of Object.entries(mg.UIT_EFFECT)) {
    const g = mg.grondenVan({ pad: '/api/x', kant: 'rtg', effecten: [effect], effectgraad: 'verklaard', herstel: 'bewezen' });
    assert.ok(g.blijvend.includes(grond));
    const d = mg.deelIn({ gronden: g, machineBereik: true, niveau: 'klein',
      poorten: { gevolg: true, terugweg: true, herhaling: true, bewijs: true } });
    assert.equal(d.uitkomst, 'overtreding', effect + ' gaf geen overtreding onder machinebereik');
  }
  /* Geld zonder effectverklaring: het pad alleen moet volstaan (NOOIT_AUTONOOM). */
  const geld = mg.grondenVan({ pad: '/api/pay/stuur', kant: 'klant', effecten: null, herstel: 'bewezen' });
  assert.ok(geld.blijvend.includes('geld'), 'een betaalpad zonder effectprofiel verloor zijn grond geld');
});

test('5. een niet-bewezen lezing is onbekend, geen overtreding', () => {
  const g = mg.grondenVan({ pad: '/api/x', kant: 'klant', effecten: null, herstel: 'onbewezen' });
  assert.equal(mg.deelIn({ gronden: g, machineBereik: true, niveau: 'lezen', poorten: {} }).uitkomst, 'onbekend');
  assert.equal(mg.deelIn({ gronden: g, machineBereik: true, niveau: 'lezen', poorten: {}, schrijftGemeten: true }).uitkomst,
    'overtreding', 'een lezing die gemeten schrijft, hoort een overtreding te zijn');
});

test('6. schuld bestaat alleen in RTG\'s eigen werk, en alleen op zekere effecten', () => {
  const poorten = { gevolg: true, terugweg: true, herhaling: true, bewijs: true };
  const basis = { pad: '/api/office/x', effecten: ['CONFIGUREREN'], effectgraad: 'verklaard', herstel: 'bewezen' };
  assert.equal(mg.deelIn({ gronden: mg.grondenVan(Object.assign({ kant: 'rtg' }, basis)), poorten }).uitkomst,
    'automatiseringsschuld');
  /* Een klant die over zijn eigen zaken beslist, is geen handwerk van RTG. */
  const klant = mg.deelIn({ gronden: mg.grondenVan(Object.assign({ kant: 'klant' }, basis)), poorten });
  assert.equal(klant.uitkomst, 'geldig');
  assert.match(klant.waarom, /toestemming/);
  /* En wie onbekend is, wordt nooit stil RTG-werk. */
  assert.equal(mg.deelIn({ gronden: mg.grondenVan(Object.assign({ kant: 'onbekend' }, basis)), poorten }).uitkomst, 'onbekend');
  /* Een vermoeden uit een categorie draagt geen schuld. */
  const vermoed = mg.grondenVan(Object.assign({ kant: 'rtg' }, basis, { effectgraad: 'vermoed' }));
  assert.equal(mg.deelIn({ gronden: vermoed, poorten }).uitkomst, 'onbekend');
  /* De eigen keuze van een klant maakt een MANDAAT geen overtreding: het mandaat is zijn toestemming. */
  assert.equal(mg.deelIn({ gronden: mg.grondenVan(Object.assign({ kant: 'klant' }, basis)), machineBereik: true,
    niveau: 'klein', poorten }).uitkomst, 'machinewerk');
});

test('7. wat achter de deur van de eigenaar staat, is een oordeel', () => {
  const g = mg.grondenVan({ pad: '/api/office/bank/terugstorting', rol: 'boardroom', kant: 'rtg',
    effecten: ['CONFIGUREREN'], effectgraad: 'verklaard', herstel: 'bewezen' });
  assert.ok(g.blijvend.includes('oordeel'), 'de terugstortstand verloor zijn grond oordeel');
  const vrij = mg.grondenVan({ pad: '/api/office/kosten/vrijgeven', kant: 'rtg', effecten: [], effectgraad: 'vermoed', herstel: 'nvt' });
  assert.ok(vrij.blijvend.includes('oordeel'), 'vrijgeven (KOSTEN.md: een mens geeft vrij) verloor zijn grond');
});

test('8. de meter telt per grond en nooit een percentage mensenwerk', () => {
  const u = uitslag();
  const tekst = JSON.stringify(u.gemeten);
  assert.ok(!/pct|percentage|ratio|afhankelijkheid/i.test(Object.keys(u.gemeten).join(' ')),
    'de meter draagt een samengesteld cijfer over mensenwerk; dat duwt toestemming en oordeel weg (AUTONOMIE.md par. 2.9)');
  assert.ok(tekst.length > 0);
  for (const n of mg.NAMEN) assert.ok(u.gemeten.perGrond[n], 'grond ' + n + ' ontbreekt in de telling');
  for (const n of Object.keys(mg.GRONDEN).filter(n => mg.GRONDEN[n].nietGemeten))
    assert.ok(u.ongemeten[n], n + ' heeft geen bron per route en hoort met reden in ongemeten te staan, nooit als 0');
  const som = Object.values(u.gemeten.perUitkomst).reduce((a, b) => a + b, 0);
  assert.equal(som, u.gemeten.muterend, 'elke muterende handeling hoort precies een uitkomst te dragen');
});

test('9. de kleine handelingen van het beleid hebben geen bewezen terugweg', () => {
  /* Een vondst en geen wens: KLEIN in kern/stuur/beleid-lijsten.js heet "een kleine
     omkeerbare handeling", maar van geen enkele is de terugweg beproefd. Zakt dit,
     dan is er een terugweg bewezen -- en dan hoort deze regel bijgewerkt, niet weg. */
  const ov = uitslag().perRoute.filter(r => r.uitkomst === 'overtreding');
  assert.ok(ov.every(r => r.niveau === 'klein' || r.niveau === 'lezen'), 'een overtreding buiten de AI-lijsten');
  assert.ok(ov.some(r => r.pad === '/api/mediaos/volg'));
});

test('10. het register loopt niet achter op een verse meting', () => {
  const doel = path.join(WORTEL, 'MENSGROND.json');
  const oud = JSON.parse(fs.readFileSync(doel, 'utf8'));
  const nu = uitslag();
  for (const veld of ['overtreding', 'onbekend']) {
    assert.ok(nu.gemeten.perUitkomst[veld] <= oud.gemeten.perUitkomst[veld],
      'MENSGROND.json loopt achter of ' + veld + ' is gestegen (' + oud.gemeten.perUitkomst[veld] + ' -> ' +
      nu.gemeten.perUitkomst[veld] + '). Deze teller mag alleen dalen; draai npm run mensgrond:vastleggen na een reparatie.');
  }
  assert.ok(oud.stempel && oud.stempel.commit, 'MENSGROND.json draagt geen stempel');
});

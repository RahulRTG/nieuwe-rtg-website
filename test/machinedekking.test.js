/* DE MACHINEDEKKING (scripts/machinedekking.js).

   Deze meter beweert iets dat makkelijk stil kan verschuiven: hoeveel van de
   eigen motoren raakt een handeling. Zo'n getal kan om twee redenen stijgen --
   omdat er werkelijk iets is aangesloten, of omdat een token breder is gaan
   meten. Het tweede voelt als vooruitgang en is het niet. Deze toets bewaakt
   daarom niet de UITSLAG maar de EERLIJKHEID van de meting:

     1 elke as heeft een bron die BESTAAT -- verdwijnt de motor, dan zakt de
       meter in plaats van stil op nul te gaan staan;
     2 een as zonder bruikbaar token is `ongemeten` en nooit 0;
     3 de twee route-assen worden nergens opgeteld of gemiddeld;
     4 de hubgrens werkt -- een routebestand met tientallen requires erft niet
       het hele huis (dat gebeurde echt: /api/notifications stond op tien assen);
     5 de kern-tas zit niet in de route-as (dezelfde fout, andere kant: een hub
       in de tas zette 4162 routes op "idempotent");
     6 wat niet gemeten IS, staat met een reden in `ongemeten`;
     7 de meter leest EXECUTION_MAP.json en rekent die assen niet zelf.

   Regel 4 en 5 zijn de belangrijkste, want ze zijn beide een fout die deze meter
   in zijn eerste ronde werkelijk heeft gemaakt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { meet, bouwGraaf, ASSEN, UIT_EXECUTIONMAP, ONGEMETEN } = require('../scripts/machinedekking');

const WORTEL = path.join(__dirname, '..');
const U = meet();

test('1. elke as heeft een bron die bestaat', () => {
  for (const [naam, as] of Object.entries(ASSEN)) {
    assert.ok(as.bron, naam + ' heeft geen bron');
    assert.ok(fs.existsSync(path.join(WORTEL, as.bron)),
      'de bron van as "' + naam + '" bestaat niet meer: ' + as.bron +
      ' -- die motor is verdwenen of verplaatst, en dan meet deze as niets');
  }
  assert.ok(Object.keys(ASSEN).length >= 16, 'er zijn assen verdwenen uit het register');
});

test('2. een as zonder bruikbaar token staat als ongemeten, nooit als 0', () => {
  for (const [naam, as] of Object.entries(ASSEN)) {
    if (as.uitRouter) continue;
    const heeftToken = Array.isArray(as.tokens) && as.tokens.length > 0;
    if (!heeftToken) {
      assert.ok(ONGEMETEN[naam],
        'as "' + naam + '" heeft geen bruikbaar token (alle tokens afgekeurd op breedte) en staat ' +
        'toch niet in ONGEMETEN. Dan leest zijn 0 als "gemeten en nergens aangesloten", en dat is onwaar.');
    }
  }
});

test('3. de twee route-assen worden nooit opgeteld of gemiddeld', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'machinedekking.js'), 'utf8');
  assert.ok(!/handler\s*\+\s*\w*\.?bestand|bestand\s*\+\s*\w*\.?handler/.test(bron),
    'de meter telt de handler-as en de bestand-as bij elkaar op. Twee ondergrenzen die ' +
    'verschillende dingen missen, geven samen geen bovengrens.');
  for (const v of Object.values(U.gemeten.perAs)) {
    assert.equal(typeof v.handler, 'number');
    assert.equal(typeof v.bestand, 'number');
  }
});

test('4. de hubgrens houdt: een route in een hub erft niet het hele huis', () => {
  assert.ok(U.gemeten.hubs.length > 0, 'er is geen enkele hub gevonden; dan werkt de grens niet');
  assert.ok(U.gemeten.hubdrempel >= 20, 'de hubdrempel is zo laag geworden dat gewone modules meetellen');
  assert.equal(typeof U.gemeten.bestandsasOnbruikbaar, 'number');

  /* De echte controle: geen enkele route mag op de bestandsas MEER assen dragen
     dan er assen bestaan, en een route uit een hub mag op de bestandsas nooit
     meer dragen dan op de handleras -- want daar IS zijn bestandsas gelijk aan
     zijn handlerspan. */
  const hubs = new Set(U.gemeten.hubs);
  for (const r of U.perRoute) {
    if (!hubs.has(r.bestand)) continue;
    assert.ok(r.boven.length <= r.onder.length,
      r.pad + ' woont in de hub ' + r.bestand + ' en draagt op de bestandsas meer assen ' +
      '(' + r.boven.join(',') + ') dan in zijn eigen handlertekst (' + r.onder.join(',') + ')');
  }
});

test('5. de kern-tas zit niet in de route-as, en geen hub is een buur', () => {
  /* GEDRAGSTOETS EN GEEN TEKSTGOK. De eerste versie hiervan zocht in de brontekst
     naar `set.add(b)` en zakte op de viaZak-lus die er terecht staat -- een toets
     die de verkeerde plek leest, zakt bij goede code en slaagt bij slechte. Nu
     wordt de GRAAF nagerekend: de buren van een bestand zijn precies zichzelf
     plus wat het rechtstreeks requiret, hubs uitgezonderd. Zodra iemand de
     kern-herkomst er weer in stopt, is een buur niet meer uit een require te
     verklaren en zakt deze toets. */
  const g = bouwGraaf();
  const bestaat = new Set(g.alle);
  const los = (van, spec) => {
    if (!spec.startsWith('.')) return null;
    const p = path.posix.normalize(path.posix.join(path.posix.dirname(van), spec));
    for (const k of [p, p + '.js', p + '/index.js']) if (bestaat.has(k)) return k;
    return null;
  };
  let nagekeken = 0;
  for (const [f, set] of g.buren) {
    const direct = new Set([f]);
    for (const m of (g.tekst.get(f) || '').matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const d = los(f, m[1]); if (d) direct.add(d);
    }
    for (const b of set) {
      assert.ok(direct.has(b),
        'buur "' + b + '" van ' + f + ' is niet uit een require te verklaren -- de kern-herkomst ' +
        'zit weer in de route-as, en daarmee erft elke route die `save` gebruikt de motoren van server.js');
      assert.ok(b === f || !g.hub.has(b),
        'de hub "' + b + '" staat als buur van ' + f + '; dan erft die route het hele huis');
    }
    nagekeken++;
  }
  assert.ok(nagekeken > 1000, 'de graaf is te klein om iets te bewijzen: ' + nagekeken + ' bestanden');
});

test('6. wat niet gemeten is, staat met een reden in ongemeten', () => {
  assert.ok(Object.keys(ONGEMETEN).length >= 3);
  for (const [naam, reden] of Object.entries(ONGEMETEN)) {
    assert.ok(typeof reden === 'string' && reden.length > 60,
      'ongemeten."' + naam + '" heeft geen uitgeschreven reden. Een lege reden wordt binnen een jaar een nul.');
    assert.ok(!Object.prototype.hasOwnProperty.call(U.gemeten.perAs, naam),
      naam + ' staat zowel in ongemeten als in de tellingen; dan is hij toch een getal geworden.');
  }
});

test('7. de assen uit de executiekaart worden gelezen en niet zelf gerekend', () => {
  for (const [naam, as] of Object.entries(UIT_EXECUTIONMAP)) {
    assert.ok(as.veld, naam + ' noemt geen veld in EXECUTION_MAP.json');
    assert.ok(U.gemeten.perAs[naam] && U.gemeten.perAs[naam].uitKaart === true,
      naam + ' is niet als kaart-as gemarkeerd in de uitslag');
  }
  assert.ok(U.bronnen['EXECUTION_MAP.json'], 'de brondigest van de executiekaart ontbreekt in de uitslag');
});

test('8. de poort hangt aan absolute getallen die alleen mogen dalen', () => {
  const reg = path.join(WORTEL, 'MACHINEDEKKING.json');
  assert.ok(fs.existsSync(reg), 'MACHINEDEKKING.json ontbreekt; draai npm run machinedekking:vastleggen');
  const oud = JSON.parse(fs.readFileSync(reg, 'utf8'));
  for (const veld of ['mutatiesZonderEnigeAs', 'motorenZonderRouteBereik']) {
    assert.equal(typeof oud.gemeten[veld], 'number', veld + ' staat niet in het register');
    assert.ok(U.gemeten[veld] <= oud.gemeten[veld],
      veld + ' is gestegen van ' + oud.gemeten[veld] + ' naar ' + U.gemeten[veld] +
      '. Deze teller mag alleen dalen: een nieuwe handeling hoort de machine te gebruiken, ' +
      'niet eromheen te lopen.');
  }
});

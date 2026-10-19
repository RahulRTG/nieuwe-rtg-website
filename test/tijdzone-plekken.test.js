/* DE PLEKKEN DIE DE KLOK VAN DE CONTAINER LAZEN.

   Elke toets hieronder draait in een proces met TZ=UTC -- precies zoals de
   server in productie draait -- op een vast moment (RTG_KLOK of een meegegeven
   Date) waarop de oude code het fout had:

     17:30 UTC in de zomer  = 19:30 in Amsterdam ("Goedemiddag" was fout)
     23:30 UTC              = al de volgende dag in Amsterdam
     de nacht van 25 oktober 2026, als de zomertijd eindigt

   Zonder TZ=UTC zou een toets op een ontwikkelmachine in Amsterdam ook met de
   oude code slagen, en dan bewijst hij niets.

   Draai los: node --test test/tijdzone-plekken.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');

function inUtc(klok, code) {
  const uit = execFileSync(process.execPath, ['-e', code], {
    encoding: 'utf8', cwd: WORTEL,
    env: { ...process.env, TZ: 'UTC', RTG_KLOK: klok, NODE_ENV: 'test' }
  });
  return JSON.parse(uit.trim().split('\n').pop());
}

test('de cockpitgroet om 19:30 in Amsterdam is Goedenavond', () => {
  const groet = inUtc('2026-07-15T17:30:00Z', `
    const c = require('./server/kern/levenslijn/cockpit')({ feiten: () =>
      ({ achterstallig: [], komt: [], lijn: { fasen: [] }, telling: {} }) });
    console.log(JSON.stringify(c.cockpit('lid').groet.zin));`);
  assert.equal(groet, 'Goedenavond');
});

test('wie om half twee Amsterdamse tijd jarig is, is 18 (de 18+-grens)', () => {
  const lft = inUtc('2026-07-15T23:30:00Z', `
    console.log(JSON.stringify(require('./server/lib/leeftijd').leeftijdVan('2008-07-16')));`);
  assert.equal(lft, 18);
});

test('dagContext leest uur en weekdag in Amsterdam', () => {
  const ctx = inUtc('', `
    const { dagContext } = require('./server/kern/context');
    const a = dagContext(new Date('2026-07-15T17:30:00Z'));
    const b = dagContext(new Date('2026-07-15T23:30:00Z'));
    console.log(JSON.stringify([a.uur, a.weekdag, b.uur, b.weekdag]));`);
  assert.deepEqual(ctx, [19, 'woensdag', 1, 'donderdag']);
});

test('de weekdagfactor van 23:30 UTC op donderdag is die van vrijdag in Amsterdam', () => {
  const f = inUtc('', `
    const { weekdagFactor } = require('./server/kern/afgeleid');
    console.log(JSON.stringify(weekdagFactor(new Date('2026-07-16T23:30:00Z'))[1]));`);
  assert.equal(f, 'vrijdag/zaterdag, druk');
});

test('happy hour 17:00-19:00 telt om 17:30 Amsterdamse tijd, niet om 17:30 UTC', () => {
  const r = inUtc('', `
    const { happyKorting } = require('./server/kern/horeca/happy');
    const h = { instel: { happy: [{ van: '17:00', tot: '19:00', procent: 20 }] } };
    console.log(JSON.stringify([
      !!happyKorting(h, null, '2026-07-15T15:30:00Z'),   // 17:30 in Amsterdam
      !!happyKorting(h, null, '2026-07-15T17:30:00Z')    // 19:30 in Amsterdam
    ]));`);
  assert.deepEqual(r, [true, false]);
});

test('nachturen tellen in Nederlandse tijd, ook in de nacht dat de zomertijd eindigt', () => {
  const r = inUtc('', `
    const { nachtUren } = require('./server/kern/payroll/uren');
    // 21:00-23:00 UTC in de zomer = 23:00-01:00 in Amsterdam: twee nachturen
    const zomer = nachtUren(Date.parse('2026-07-15T21:00:00Z'), Date.parse('2026-07-15T23:00:00Z'), 0, 6);
    // 25 oktober: 22:00 UTC (24-10) tot 05:00 UTC = 00:00-06:00 lokaal, zeven echte uren
    const herfst = nachtUren(Date.parse('2026-10-24T22:00:00Z'), Date.parse('2026-10-25T05:00:00Z'), 0, 6);
    console.log(JSON.stringify([zomer, herfst]));`);
  assert.deepEqual(r, [1, 7]);
});

test('een waardevenster 09:00-17:00 leest de Amsterdamse klok', () => {
  const r = inUtc('', `
    const { binnenVenster } = require('./server/kern/waarde/policy');
    console.log(JSON.stringify([
      binnenVenster('09:00-17:00', new Date('2026-07-15T07:30:00Z')),  // 09:30 lokaal
      binnenVenster('09:00-17:00', new Date('2026-07-15T15:30:00Z'))   // 17:30 lokaal
    ]));`);
  assert.deepEqual(r, [true, false]);
});

test('een bestelling om "19:42" ligt om 19:42 Amsterdamse tijd', () => {
  const r = inUtc('', `
    const c = require('./server/kern/horeca/cadans-doel');
    const anker = Date.parse('2026-07-15T17:00:00Z'); // 19:00 lokaal
    const ms = c.klokTijdNaarMs('19:42', anker);
    console.log(JSON.stringify([new Date(ms).toISOString(), c.hhmm(ms)]));`);
  assert.deepEqual(r, ['2026-07-15T17:42:00.000Z', '19:42']);
});

test('balans: de week begint vandaag in Amsterdam, en 23:30 is laat eten', () => {
  const r = inUtc('', `
    const { weekBeeld } = require('./server/kern/balans');
    const nu = new Date('2026-07-15T23:30:00Z');
    const rijen = [{ at: '2026-07-15T21:30:00Z', naar: 'partner:x' }, { at: '2026-07-15T18:00:00Z', naar: 'partner:x' }];
    const w = weekBeeld({ nu, rijen });
    console.log(JSON.stringify([w.dagen[0], w.laat]));`);
  // 21:30 UTC is 23:30 in Amsterdam (laat); 18:00 UTC is 20:00 (niet laat)
  assert.deepEqual(r, ['2026-07-16', 1]);
});

test('de agendabadge telt om 01:30 in Amsterdam de afspraak van gisteren niet meer mee', () => {
  const r = inUtc('2026-07-15T23:30:00Z', `
    const { maakAgenda } = require('./server/kern/agenda');
    const a = maakAgenda({ db: { data: {} }, save() {}, bijeen: async fn => fn(), inBundel: () => false,
      crypto: require('crypto'), anthropic: null, schoon: (s, n) => (s == null ? '' : String(s).slice(0, n)) });
    (async () => {
      await a.voegToe('lid:x', { titel: 'Gisteren', datum: '2026-07-15' });
      await a.voegToe('lid:x', { titel: 'Vandaag', datum: '2026-07-16' });
      console.log(JSON.stringify(a.telling('lid:x')));
    })();`);
  assert.equal(r, 1);
});

test('balans: om 00:30 in Amsterdam (22:30 UTC) begint het weekbeeld op de nieuwe dag', () => {
  const r = inUtc('2026-07-15T22:30:00Z', `
    const { weekBeeld } = require('./server/kern/balans');
    const agenda = [{ datum: '2026-07-15', titel: 'gisteren' }, { datum: '2026-07-22', titel: 'over zes dagen' }];
    const w = weekBeeld({ agenda });
    console.log(JSON.stringify([w.dagen[0], w.dagen[6], w.perDag[0], w.perDag[6]]));`);
  assert.deepEqual(r, ['2026-07-16', '2026-07-22', 0, 1]);
});

test('levens-, geld-, sociale graaf en levenslijn delen een dag: die van het lid', () => {
  const r = inUtc('2026-07-15T22:30:00Z', `
    const L = require('./server/kern/levensgraaf/hulp');
    const G = require('./server/kern/geldgraaf/hulp');
    const S = require('./server/kern/socialegraaf/hulp');
    const LL = require('./server/kern/levenslijn/hulp');
    console.log(JSON.stringify([L.vandaag(), G.vandaag(),
      L.dagVan('2026-07-15T22:45:00Z'), G.dagVan('2026-07-15T21:30:00Z'),
      L.straks('2026-07-15'), L.straks('2026-07-16'),
      S.vandaag(), LL.dagVan('2026-07-15T22:45:00Z')]));`);
  assert.deepEqual(r, ['2026-07-16', '2026-07-16', '2026-07-16', '2026-07-15', '', '2026-07-16',
    '2026-07-16', '2026-07-16']);
});

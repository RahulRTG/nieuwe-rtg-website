/* DE BEWIJSBRON, TAK VOOR TAK (scripts/lib/bewijsbron.js).

   test/appcontract.test.js beproeft de drie vragen (koppeling, vers,
   uitkomst) met het echte contract. Hier staan de randen eromheen: een
   ingang zonder schuine streep, scripts van buiten en relatieve scripts, een
   te breed voorvoegsel, een register zonder stempel of met alleen een datum,
   een voltooiproef-deel dat niet bestaat, een storing zonder naam, en een
   ronde met een onbekende stand. Alles loopt over een lezer in het geheugen
   en een opgegeven versheid; er wordt geen register gelezen of geschreven.

   Los: node --test test/bewijsbron-takken.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const B = require('../scripts/lib/bewijsbron');

const lezer = (bestanden) => (rel) => (Object.hasOwn(bestanden, rel) ? bestanden[rel] : null);
const vers = () => ({ vers: true, reden: 'vers op abc' });
const oud = () => ({ vers: false, reden: 'gemeten op oud' });
const STEMPEL = { op: '2026-10-01T00:00:00Z', commit: 'abc1234', instrument: 'scripts/x.js' };

test('proefRoutes: letterlijke API-paden zonder slotstreep, en null als de proef ontbreekt', () => {
  const r = B.proefRoutes('p.js', lezer({ 'p.js': "f('/api/a/b/'); g(\"/api/c\"); h(`/api/d.e`); i('/niet/api')" }));
  assert.deepEqual([...r].sort(), ['/api/a/b', '/api/c', '/api/d.e']);
  assert.equal(B.proefRoutes('weg.js', lezer({})), null);
  assert.equal(B.proefRoutes('leeg.js', lezer({ 'leeg.js': '' })).size, 0);
});

test('smalVoorvoegsel telt pas vanaf twee segmenten na /api', () => {
  assert.equal(B.smalVoorvoegsel('/api/'), false);
  assert.equal(B.smalVoorvoegsel('/api/stad/'), false);
  assert.equal(B.smalVoorvoegsel('/api/supplier/horeca/'), true);
});

test('ingangRoutes: geen ingang of geen schuine streep geeft null', () => {
  assert.equal(B.ingangRoutes(null), null);
  assert.equal(B.ingangRoutes('apps/x.html'), null);
});

test('ingangRoutes volgt eigen scripts (absoluut en relatief), slaat vreemde over en negeert brede voorvoegsels', () => {
  const html = '<script src="https://cdn.voorbeeld/x.js"></script>' +
    '<script defer src="/shared/a.js?v=2"></script>' +
    '<script type="module" src="../lib/b.js"></script>' +
    '<script src="zonder-rij.js"></script>';
  const schermroutes = { perScherm: [
    { bestand: 'public/apps/s.html', exact: ['/api/eigen/'], voorvoegsels: ['/api/'] },
    { bestand: 'public/shared/a.js', exact: ['/api/gedeeld'] },
    { bestand: 'public/lib/b.js', voorvoegsels: ['/api/supplier/horeca/', '/api/stad/'] }
  ] };
  const r = B.ingangRoutes('/apps/s.html#tab?x=1', { lees: lezer({ 'public/apps/s.html': html }), schermroutes });
  assert.deepEqual(r.bestanden, ['public/apps/s.html', 'public/shared/a.js', 'public/lib/b.js', 'public/apps/zonder-rij.js']);
  assert.deepEqual([...r.exact].sort(), ['/api/eigen', '/api/gedeeld']);
  assert.deepEqual([...r.voor], ['/api/supplier/horeca/'], 'een voorvoegsel van een segment raakt alles en telt niet');
});

test('ingangRoutes leest SCHERMROUTES.json via de lezer, en een ontbrekende ingang levert alleen zichzelf', () => {
  const sr = JSON.stringify({ perScherm: [{ bestand: 'public/apps/weg.html', exact: ['/api/z'] }] });
  const r = B.ingangRoutes('/apps/weg.html', { lees: lezer({ 'SCHERMROUTES.json': sr }) });
  assert.deepEqual(r.bestanden, ['public/apps/weg.html']);
  assert.deepEqual([...r.exact], ['/api/z']);
  const zonder = B.ingangRoutes('/apps/weg.html', { lees: lezer({}) });
  assert.equal(zonder.exact.size, 0);
});

test('gedeeld: exact of via voorvoegsel, gesorteerd', () => {
  const ing = { exact: new Set(['/api/b']), voor: new Set(['/api/supplier/horeca/']) };
  assert.deepEqual(B.gedeeld(new Set(['/api/supplier/horeca/menu', '/api/b', '/api/c']), ing),
    ['/api/b', '/api/supplier/horeca/menu']);
  assert.deepEqual(B.gedeeld(new Set(['/api/c']), ing), []);
});

/* --- de keten ---------------------------------------------------------- */

function keten(reg, opties = {}) {
  return B.ketenUitslag('K.json', { lees: lezer({ 'K.json': typeof reg === 'string' ? reg : JSON.stringify(reg) }),
    versheid: vers, ...opties });
}

test('ketenUitslag: ontbrekend, kapot, geen stempel of een kale datum is NIET_GETEST', () => {
  assert.equal(B.ketenUitslag('weg.json', { lees: lezer({}), versheid: vers }).bewijs, null);
  const kapot = keten('{kapot');
  assert.equal(kapot.status, 'NIET_GETEST');
  assert.match(kapot.reden, /geen geldige JSON/);
  const geen = keten({ schakels: [{ nr: 1, stand: 'gesloten' }] });
  assert.match(geen.reden, /draagt geen stempel en geen commit/);
  assert.equal(geen.bewijs.op, null);
  const datum = keten({ stempel: '2026-09-01', schakels: [{ nr: 1, stand: 'gesloten' }] });
  assert.equal(datum.status, 'NIET_GETEST');
  assert.match(datum.reden, /alleen een datum \(2026-09-01\)/);
  assert.equal(datum.bewijs.op, '2026-09-01');
  assert.equal(datum.bewijs.commit, null);
  const verouderd = keten({ stempel: STEMPEL, schakels: [{ nr: 1, stand: 'gesloten' }] }, { versheid: oud });
  assert.match(verouderd.reden, /^bewijs vervallen: gemeten op oud/);
  assert.equal(verouderd.bewijs.instrument, 'scripts/x.js');
});

test('ketenUitslag: een stempel zonder op, commit of instrument geeft nulvelden', () => {
  const r = keten({ stempel: {}, schakels: [{ nr: 1, stand: 'gesloten' }] });
  assert.equal(r.status, 'BEWEZEN');
  assert.deepEqual(r.bewijs, { register: 'K.json', op: null, commit: null, instrument: null });
  assert.match(r.reden, /1 schakels gesloten, 0 storingen gehouden/);
});

test('ketenUitslag: een deel kiezen, en een deel dat er niet staat', () => {
  const reg = { stempel: STEMPEL, apps: { stad: { voltooibaar: { schakels: [{ nr: 1, stand: 'gesloten' }], storingen: [{ stand: 'gehouden' }] } } } };
  const goed = keten(reg, { deel: ['apps', 'stad', 'voltooibaar'] });
  assert.equal(goed.status, 'BEWEZEN');
  assert.equal(goed.bewijs.deel, 'apps/stad/voltooibaar');
  for (const deel of [['apps', 'weg', 'voltooibaar'], ['apps', 'stad', 'nergens', 'dieper'], ['stempel', 'op']]) {
    const r = keten(reg, { deel });
    assert.equal(r.status, 'NIET_GETEST', deel.join('/'));
    assert.match(r.reden, new RegExp('kent ' + deel.join('/') + ' niet'));
  }
});

test('ketenUitslag: geen schakels is niets om te laten tellen', () => {
  const r = keten({ stempel: STEMPEL, schakels: 'geen lijst', storingen: 'ook niet' });
  assert.equal(r.status, 'NIET_GETEST');
  assert.match(r.reden, /draagt geen schakels/);
});

test('ketenUitslag: elke vorm van een open keten is DEFECT, met de eerste oorzaak als reden', () => {
  const s = [{ nr: 1, stand: 'gesloten' }];
  const gevallen = [
    [{ schakels: [{ nr: 2, stand: 'open', wat: 'betalen' }] }, /schakel 2 staat open \(betalen\)/],
    [{ schakels: [{ nr: 3, stand: 'stuk' }] }, /schakel 3 staat stuk \(\)/],
    [{ schakels: s, storingen: [{ wat: 'netwerk weg', stand: 'gebroken' }] }, /storing "netwerk weg" staat gebroken/],
    [{ schakels: s, storingen: [{ naam: 'db-uitval', stand: 'gebroken' }] }, /storing "db-uitval"/],
    [{ schakels: s, storingen: [{ stand: 'gebroken' }] }, /storing "\?" staat gebroken/],
    [{ schakels: s, telling: { stuk: 1 } }, /zegt zelf dat hij niet sluit/],
    [{ schakels: s, telling: { gebroken: 1 } }, /zegt zelf dat hij niet sluit/],
    [{ schakels: s, sluit: false }, /zegt zelf dat hij niet sluit/]
  ];
  for (const [reg, re] of gevallen) {
    const r = keten({ stempel: STEMPEL, ...reg });
    assert.equal(r.status, 'GEBLOKKEERD_DOOR_DEFECT', String(re));
    assert.match(r.reden, re);
  }
});

/* --- de ronde ---------------------------------------------------------- */

function ronde(reg, functie, opties = {}) {
  return B.rondeUitslag('R.json', functie, { lees: lezer({ 'R.json': typeof reg === 'string' ? reg : JSON.stringify(reg) }),
    versheid: vers, ...opties });
}

test('rondeUitslag: elke grendel en de overgenomen stand', () => {
  assert.match(B.rondeUitslag('weg.json', 'f', { lees: lezer({}), versheid: vers }).reden, /nooit vastgelegd/);
  assert.match(ronde('{kapot', 'f').reden, /geen geldige JSON/);
  const geenStempel = ronde({ regels: [] }, 'f');
  assert.match(geenStempel.reden, /geen stempel met commit/);
  assert.deepEqual(geenStempel.bewijs, { register: 'R.json', op: null, commit: null });
  assert.match(ronde({ stempel: STEMPEL }, 'f', { versheid: oud }).reden, /bewijs vervallen/);
  assert.match(ronde({ stempel: STEMPEL }, 'f').reden, /kent f niet/);
  const onbekend = ronde({ stempel: STEMPEL, regels: [{ functie: 'f', status: 'MISSCHIEN' }] }, 'f');
  assert.equal(onbekend.status, 'NIET_GETEST');
  assert.match(onbekend.reden, /onbekende stand MISSCHIEN/);
  const goed = ronde({ stempel: STEMPEL, regels: [{ functie: 'g', status: 'BEWEZEN' },
    { functie: 'f', status: 'GEBLOKKEERD_DOOR_CONFIG', reden: 'sleutel ontbreekt' }] }, 'f');
  assert.equal(goed.status, 'GEBLOKKEERD_DOOR_CONFIG', 'de stand wordt overgenomen, nooit opgewaardeerd');
  assert.equal(goed.reden, 'sleutel ontbreekt');
  assert.equal(goed.bewijs.commit, 'abc1234');
});

/* --- de samenstelling -------------------------------------------------- */

const BESTANDEN = {
  'scripts/keten.js': "go('/api/winkel/mand'); go('/api/winkel/afrekenen')",
  'scripts/ronde.js': '',
  'public/apps/winkel.html': '<script src="winkel.js"></script>',
  'KETEN.json': JSON.stringify({ stempel: STEMPEL, schakels: [{ nr: 1, stand: 'gesloten' }] }),
  'VOLTOOI.json': JSON.stringify({ stempel: STEMPEL, apps: { winkel: {
    persistent: { schakels: [{ nr: 1, stand: 'gesloten' }] } } } }),
  'RONDE.json': JSON.stringify({ stempel: STEMPEL, regels: [{ functie: 'winkel', status: 'BEWEZEN', reden: 'ok' }] })
};
const SR = { perScherm: [{ bestand: 'public/apps/winkel.js', exact: ['/api/winkel/mand'] }] };
const basis = (extra) => ({ lees: lezer(BESTANDEN), versheid: vers, schermroutes: SR, algemeen: {}, ...extra });

test('bewijsVoor: geen contract en geen algemene bron geeft null', () => {
  assert.equal(B.bewijsVoor('winkel', 'bereikbaar', '/apps/winkel.html', basis({ contract: {} })), null);
});

test('bewijsVoor: een algemene bron van de verkeerde soort wordt geweigerd, een goede telt per rij', () => {
  assert.throws(() => B.bewijsVoor('winkel', 'bevoegd', '/apps/winkel.html', basis({ contract: {},
    algemeen: { bevoegd: { soort: 'liegronde', register: 'RONDE.json', instrument: 'scripts/ronde.js' } } })),
  /een liegronde mag geen bevoegd leveren/);
  assert.throws(() => B.bewijsVoor('winkel', 'bevoegd', '/apps/winkel.html', basis({ contract: {},
    algemeen: { bevoegd: { soort: 'onbekend', register: 'RONDE.json' } } })), /een onbekend mag geen bevoegd/);
  const r = B.bewijsVoor('winkel', 'bevoegd', '/apps/winkel.html', basis({ contract: {},
    algemeen: { bevoegd: { soort: 'bevoegdronde', register: 'RONDE.json', instrument: 'scripts/ronde.js' } } }));
  assert.equal(r.status, 'BEWEZEN');
  assert.deepEqual(r.bron, { soort: 'bevoegdronde', instrument: 'scripts/ronde.js' });
});

test('bewijsVoor: een contractbron moet een bekend bewijs zijn en van de juiste soort', () => {
  assert.throws(() => B.bewijsVoor('winkel', 'snel', '/apps/winkel.html',
    basis({ contract: { winkel: { snel: { soort: 'ketenproef' } } } })), /"snel" is geen van de acht bewijzen/);
  assert.throws(() => B.bewijsVoor('winkel', 'bevoegd', '/apps/winkel.html',
    basis({ contract: { winkel: { bevoegd: { soort: 'ketenproef' } } } })), /een ketenproef mag geen bevoegd leveren \(winkel\)/);
  assert.throws(() => B.bewijsVoor('winkel', 'bevoegd', '/apps/winkel.html',
    basis({ contract: { winkel: { bevoegd: { soort: 'nieuw' } } } })), /een nieuw mag geen bevoegd/);
});

test('bewijsVoor: zonder gedeelde route telt de proef niet, met een wel', () => {
  const contract = { winkel: { belofte: 'je kunt afrekenen',
    voltooibaar: { soort: 'ketenproef', register: 'KETEN.json', instrument: 'scripts/keten.js' } } };
  const geen = B.bewijsVoor('winkel', 'voltooibaar', '/apps/winkel.html', basis({ contract, schermroutes: { perScherm: [] } }));
  assert.equal(geen.status, 'NIET_GETEST');
  assert.match(geen.reden, /raakt geen enkele route die \/apps\/winkel\.html aanroept/);
  const weg = B.bewijsVoor('winkel', 'voltooibaar', '/apps/winkel.html', basis({ contract: { winkel: {
    voltooibaar: { soort: 'ketenproef', register: 'KETEN.json', instrument: 'scripts/weg.js' } } } }));
  assert.equal(weg.status, 'NIET_GETEST', 'een proef die niet bestaat raakt niets');
  const zonderIngang = B.bewijsVoor('winkel', 'voltooibaar', 'winkel.html', basis({ contract }));
  assert.equal(zonderIngang.status, 'NIET_GETEST');
  const raak = B.bewijsVoor('winkel', 'voltooibaar', '/apps/winkel.html', basis({ contract }));
  assert.equal(raak.status, 'BEWEZEN');
  assert.deepEqual(raak.bron, { soort: 'ketenproef', instrument: 'scripts/keten.js', belofte: 'je kunt afrekenen', gedeeldeRoutes: 1 });
});

test('bewijsVoor: een voltooiproef leest het deel van zijn eigen functie en bewijs', () => {
  const contract = { winkel: { persistent: { soort: 'voltooiproef', register: 'VOLTOOI.json', instrument: 'scripts/keten.js' },
    herstelbaar: { soort: 'voltooiproef', register: 'VOLTOOI.json', instrument: 'scripts/keten.js' } } };
  const p = B.bewijsVoor('winkel', 'persistent', '/apps/winkel.html', basis({ contract }));
  assert.equal(p.status, 'BEWEZEN');
  assert.equal(p.bewijs.deel, 'apps/winkel/persistent');
  const h = B.bewijsVoor('winkel', 'herstelbaar', '/apps/winkel.html', basis({ contract }));
  assert.equal(h.status, 'NIET_GETEST');
  assert.match(h.reden, /kent apps\/winkel\/herstelbaar niet/);
});

test('stelSamen vervangt alleen de bewijzen waarvoor een bron bestaat', () => {
  const contract = { winkel: { voltooibaar: { soort: 'ketenproef', register: 'KETEN.json', instrument: 'scripts/keten.js' } } };
  const rij = { functie: 'winkel', ingang: '/apps/winkel.html', bewijzen: { bereikbaar: { status: 'GEEN_FIXTURE' } } };
  const gedaan = B.stelSamen(rij, basis({ contract,
    algemeen: { waarheidsgetrouw: { soort: 'liegronde', register: 'RONDE.json', instrument: 'scripts/ronde.js' } } }));
  assert.deepEqual(gedaan, ['voltooibaar', 'waarheidsgetrouw']);
  assert.equal(rij.bewijzen.bereikbaar.status, 'GEEN_FIXTURE', 'wat het contract niet noemt blijft exact staan');
  assert.equal(rij.bewijzen.voltooibaar.status, 'BEWEZEN');
  assert.equal(rij.bewijzen.waarheidsgetrouw.status, 'BEWEZEN');
  const leeg = { functie: 'ander', ingang: '/apps/ander.html', bewijzen: {} };
  assert.deepEqual(B.stelSamen(leeg, basis({ contract })), []);
  assert.equal(Object.keys(leeg.bewijzen).length, 0);
});

test('zonder opgegeven lezer en versheid gebruikt bewijsVoor de echte, en dat blijft een geldige stand', () => {
  /* Leest alleen: de echte registers en de echte versheid. De uitslag hangt
     van de boom af, dus alleen de vorm wordt getoetst. */
  const r = B.bewijsVoor('bestaat-niet', 'waarheidsgetrouw', '/apps/app.html');
  assert.ok(['BEWEZEN', 'GEBLOKKEERD_DOOR_DEFECT', 'GEBLOKKEERD_DOOR_CONFIG', 'NIET_GETEST'].includes(r.status), r.status);
  assert.equal(r.bron.soort, 'liegronde');
});

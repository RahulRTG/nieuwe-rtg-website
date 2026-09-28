/* ============================================================================
   HET BEWIJSVERVAL PER ROUTE -- scripts/routeversheid.js en de aansluiting op
   staatVan() in scripts/vertrouwen.js (PROOF.md par. 2a).

   Wat dit bestand bewijst:

     1. DE GRAAD BESLIST. Een wijziging aan een GEMETEN afhankelijkheid (het
        handlerbestand uit de router, een kern-naam uit CONTEXTPROEF) laat een
        bewezen cel vervallen; een wijziging aan een VERMOEDE (de statische
        sluiting) staat erbij en laat niets vervallen. Niet gokken.
     2. PER CEL, NIET PER ROUTE. Elke bewezen cel kent het register dat hem
        bewees en diens commit; een cel uit een jonger register is niet
        verouderd omdat een ouder register dat wel is.
     3. DRIE SOORTEN BLIJVEN APART: defect (gezakt -> geschorst), ontbrekend
        (ongemeten -> verzwakt), verouderd (-> verschaald). De stand kiest er
        een, de rij draagt ze alle drie.
     4. GEEN NIEUWE STANDEN: de uitkomst is een stand die PROOF.md al kent.
     5. DE DRIE BLINDE VLEKKEN van de eerste ronde (fabrieksparameters en de
        montagewortel), elk een toets.
     6. DE LIJST CEL -> REGISTER dekt elk bron-label van de bewijsmatrix.
     7. TEGENPROEF op de echte boom, en: de module schrijft niets.

   De end-to-end-proef (echte route, echt instrument, in een worktree) is
   scripts/vervalproef.js; die duurt minuten en staat daarom niet hier.

   Draai los: node --test test/routeversheid.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const rv = require('../scripts/routeversheid');
const { staatVan, bereken } = require('../scripts/vertrouwen');

const graaf = {
  'server/routes/a.js': ['server/kern/a.js', 'server/server.js'],
  'server/kern/a.js': ['server/lib/b.js'],
  'server/server.js': ['server/kern/alles.js'],
  'server/lib/b.js': []
};
const buren = (b) => ({ naar: graaf[b] || [], ongevolgd: 0 });
const afh = rv.afhankelijkhedenVan({ handler: 'server/routes/a.js', runtime: ['dom.betaal'],
  naamNaarBestand: (n) => (n === 'dom.betaal' ? ['server/kern/betaal.js'] : []), buren });
const reg = { register: 'POORTWACHT.json', commit: 'c1', herdraai: 'npm run meetronde -- --alleen=poortwacht' };
const registerVan = (bron) => (bron === 'poortwacht' || bron === 'rolproef' ? reg : null);
const sinds = (...b) => () => ({ gewijzigd: new Set(b) });

/* ---------------------------------------------------------------------------
   1. DE GRAAD BESLIST
   ------------------------------------------------------------------------- */
test('1a. de afhankelijkheden dragen een graad: handler en runtime gemeten, de sluiting vermoed', () => {
  assert.equal(afh.gemeten.get('server/routes/a.js').graad, 'gemeten');
  assert.match(afh.gemeten.get('server/kern/betaal.js').koppeling, /CONTEXTPROEF/);
  assert.equal(afh.vermoed.get('server/lib/b.js').graad, 'vermoed');
  assert.match(afh.vermoed.get('server/lib/b.js').koppeling, /a\.js -> server\/kern\/a\.js -> server\/lib\/b\.js/,
    'de keten is uit te leggen');
  assert.ok(!afh.vermoed.has('server/kern/alles.js'), 'niet door de montagewortel heen');
});

test('1b. een gewijzigde GEMETEN afhankelijkheid laat een bewezen cel vervallen, met de uitlegketen', () => {
  const v = rv.vervalVan({ cellen: { AUTH: { staat: 'bewezen', bron: 'poortwacht' } }, afh, registerVan,
    gewijzigdVoor: sinds('server/routes/a.js') });
  assert.equal(v.verouderd.length, 1);
  const u = rv.uitleg('POST /api/a', v.verouderd[0])[0];
  assert.equal(u.bestand, 'server/routes/a.js');
  assert.match(u.koppeling, /ROUTEBRON.*gemeten/);
  assert.match(u.bewijs, /AUTH uit POORTWACHT\.json, gemeten op c1/);
  assert.match(u.herdraai, /--alleen=poortwacht/);
});

test('1c. een gewijzigde VERMOEDE afhankelijkheid laat niets vervallen -- ze staat erbij', () => {
  const v = rv.vervalVan({ cellen: { AUTH: { staat: 'bewezen', bron: 'poortwacht' } }, afh, registerVan,
    gewijzigdVoor: sinds('server/lib/b.js') });
  assert.equal(v.verouderd.length, 0);
  assert.equal(v.vermoed.length, 1);
});

test('1d. een niet-gerelateerde wijziging raakt niets', () => {
  const v = rv.vervalVan({ cellen: { AUTH: { staat: 'bewezen', bron: 'poortwacht' } }, afh, registerVan,
    gewijzigdVoor: sinds('server/routes/ander.js') });
  assert.deepEqual([v.verouderd.length, v.vermoed.length, v.onbekend.length], [0, 0, 0]);
});

test('1e. zonder gemeten bestand of meetcommit: onbekend, nooit actueel', () => {
  const zonder = rv.afhankelijkhedenVan({ handler: null, buren });
  const v1 = rv.vervalVan({ cellen: { AUTH: { staat: 'bewezen', bron: 'poortwacht' } }, afh: zonder, registerVan,
    gewijzigdVoor: sinds() });
  assert.equal(v1.onbekend.length, 1);
  const v2 = rv.vervalVan({ cellen: { AUTH: { staat: 'bewezen', bron: 'poortwacht' } }, afh, registerVan,
    gewijzigdVoor: () => ({ reden: 'ondiepe kloon' }) });
  assert.match(v2.onbekend[0].reden, /ondiepe kloon/);
});

/* ---------------------------------------------------------------------------
   2. PER CEL
   ------------------------------------------------------------------------- */
test('2. elke cel rekent tegen de commit van ZIJN register', () => {
  const regs = { poortwacht: { ...reg, commit: 'oud' }, rolproef: { ...reg, register: 'ROLPROEF.json', commit: 'nieuw' } };
  const v = rv.vervalVan({ cellen: { AUTH: { staat: 'bewezen', bron: 'poortwacht' }, ACL: { staat: 'bewezen', bron: 'rolproef' } },
    afh, registerVan: (b) => regs[b],
    gewijzigdVoor: (c) => ({ gewijzigd: new Set(c === 'oud' ? ['server/routes/a.js'] : []) }) });
  assert.deepEqual(v.verouderd.map((x) => x.schakel), ['AUTH']);
});

test('2b. alleen BEWEZEN cellen kunnen vervallen; een leesroute-cel en een cel zonder register niet', () => {
  const v = rv.vervalVan({ cellen: {
    AUTH: { staat: 'ongemeten', bron: 'poortwacht' }, STATE: { staat: 'nvt', bron: 'leesroute' },
    ACL: { staat: 'bewezen', bron: 'leesroute' } }, afh, registerVan, gewijzigdVoor: sinds('server/routes/a.js') });
  assert.deepEqual([v.verouderd.length, v.onbekend.length], [0, 0]);
});

/* ---------------------------------------------------------------------------
   3 en 4. DE AANSLUITING OP STAATVAN: bestaande standen, drie soorten apart
   ------------------------------------------------------------------------- */
const alleBewezen = () => Object.fromEntries(['AUTH', 'ACL', 'INPUT', 'OUTPUT', 'STATE', 'SIDE_EFFECT', 'AUDIT',
  'IDEMPOTENCY', 'FAILURE', 'ROLLBACK', 'PRIVACY'].map((s) => [s, { staat: 'bewezen', bron: 'poortwacht' }]));

test('3a. bewezen -> verschaald door een verouderde cel, met de keten in de reden', () => {
  const cellen = alleBewezen();
  assert.equal(staatVan(cellen, 1, 30, [], { verouderd: [] }).staat, 'bewezen');
  const verval = rv.vervalVan({ cellen, afh, registerVan, gewijzigdVoor: sinds('server/routes/a.js') });
  const s = staatVan(cellen, 1, 30, [], verval);
  assert.equal(s.staat, 'verschaald');
  assert.match(s.reden, /server\/routes\/a\.js veranderde sinds c1/);
  assert.match(s.heropent, /--alleen=poortwacht/);
});

test('3b. een vermoed-verval laat een bewezen route bewezen', () => {
  const cellen = alleBewezen();
  const verval = rv.vervalVan({ cellen, afh, registerVan, gewijzigdVoor: sinds('server/lib/b.js') });
  assert.equal(staatVan(cellen, 1, 30, [], verval).staat, 'bewezen');
});

test('3c. defect en ontbrekend gaan voor, maar verouderd blijft zichtbaar in de rij', () => {
  const cellen = alleBewezen();
  cellen.FAILURE = { staat: 'gezakt', bron: 'faalproef' };
  cellen.STATE = { staat: 'ongemeten', bron: 'staatproef' };
  const u = bereken([{ methode: 'POST', pad: '/api/a', cellen }], 1, 30, [],
    (k, c) => rv.vervalVan({ cellen: c, afh, registerVan, gewijzigdVoor: sinds('server/routes/a.js') }));
  const rij = u.perRoute['POST /api/a'];
  assert.equal(rij.staat, 'geschorst', 'een gezakte cel is DEFECT, en dat gaat voor');
  assert.deepEqual(rij.defect, ['FAILURE']);
  assert.deepEqual(rij.ontbrekend, ['STATE']);
  assert.ok(rij.verouderd.length > 0, 'verouderd staat er apart bij, ook als de stand iets anders zegt');
  assert.deepEqual([u.soorten.defect, u.soorten.ontbrekend, u.soorten.verouderd], [1, 1, 1]);
});

test('3d. de hele cyclus op routeniveau: bewezen -> verschaald -> hermeting -> bewezen', () => {
  const cellen = alleBewezen();
  const wereld = { commit: 'c1', gewijzigdSinds: { c1: [] } };
  const stand = () => staatVan(cellen, 1, 30, [], rv.vervalVan({ cellen, afh,
    registerVan: () => ({ ...reg, commit: wereld.commit }),
    gewijzigdVoor: (c) => ({ gewijzigd: new Set(wereld.gewijzigdSinds[c] || []) }) })).staat;
  assert.equal(stand(), 'bewezen');
  wereld.gewijzigdSinds.c1 = ['server/routes/a.js'];        // de handler verandert na c1
  assert.equal(stand(), 'verschaald');
  wereld.commit = 'c2'; wereld.gewijzigdSinds.c2 = [];      // het register wordt op c2 hermeten
  assert.equal(stand(), 'bewezen', 'alleen een hermeting brengt hem terug -- geen knop');
  wereld.gewijzigdSinds.c2 = ['server/routes/ander.js'];    // en een niet-gerelateerde wijziging raakt hem niet
  assert.equal(stand(), 'bewezen');
});

test('4. staatVan kent geen nieuwe standen', () => {
  const cellen = alleBewezen();
  const verval = rv.vervalVan({ cellen, afh, registerVan, gewijzigdVoor: sinds('server/routes/a.js') });
  assert.ok(['bewezen', 'verschaald', 'verzwakt', 'geschorst', 'ongemeten'].includes(staatVan(cellen, 1, 30, [], verval).staat));
});

/* ---------------------------------------------------------------------------
   5. DE DRIE BLINDE VLEKKEN VAN DE EERSTE RONDE
   ------------------------------------------------------------------------- */
test('5a. const { .. } = kern: de namen worden gelezen', () => {
  const g = rv.kernGebruik('module.exports = (kern) => {\n  const { app, rechterhandAI } = kern;\n  kern.notify();\n};');
  assert.deepEqual(g.namen, ['app', 'notify', 'rechterhandAI']);
});

test('5b. de tas gedestructureerd in de PARAMETER (rtfos/governance.js)', () => {
  assert.deepEqual(rv.kernGebruik('module.exports = ({ app, officeAuth, rtfos }) => {};').namen, ['app', 'officeAuth', 'rtfos']);
});

test('5c. module.exports = N, met N elders gedefinieerd; een object is geen fabriek', () => {
  assert.equal(rv.fabriekParam('function mount(ctx) {}\nmodule.exports = mount;'), 'ctx');
  assert.equal(rv.fabriekParam('module.exports = { a: 1 };'), null);
});

test('5d. een domeinmodule uit de montagewortel wordt naar zijn require gevolgd', () => {
  const kaart = rv.montageHerkomst({ 'server/server.js':
    "const journalistiek = require('./kern/journalistiek')({ db });\nfunction addTicket() {}" },
  (p) => p === 'server/kern/journalistiek.js');
  assert.equal(kaart.get('journalistiek'), 'server/kern/journalistiek.js');
  assert.equal(kaart.has('addTicket'), false);
});

test('5e. burenIndex: een naam die KERNHERKOMST niet kent is een gat', () => {
  const ix = { bestanden: new Map([['server/routes/r.js', { pad: 'server/routes/r.js', kanten: { opgelost: [] } }]]) };
  const b = rv.burenIndex(ix, [], new Map(), () => 'module.exports = (kern) => { const { onbekend } = kern; };', new Map());
  assert.equal(b('server/routes/r.js').ongevolgd, 1);
});

/* ---------------------------------------------------------------------------
   6. CEL -> REGISTER
   ------------------------------------------------------------------------- */
test('6. elk bron-label in scripts/bewijsmatrix.js heeft een register, of is met opzet zonder', () => {
  const bron = fs.readFileSync(path.join(__dirname, '../scripts/bewijsmatrix.js'), 'utf8');
  const labels = new Set([...bron.matchAll(/bron: '([a-z-]+)'/g)].map((m) => m[1]));
  assert.ok(labels.size >= 10, 'de lezer vond te weinig labels -- dan bewijst deze toets niets');
  for (const l of labels) {
    assert.ok(rv.CEL_REGISTER[l] || rv.ZONDER_REGISTER.has(l), 'bron-label zonder register: ' + l);
  }
});

/* ---------------------------------------------------------------------------
   7. DE ECHTE BOOM
   ------------------------------------------------------------------------- */
test('7a. tegenproef: gemeten tegen HEAD veroudert niets, en de koppeling bestaat echt', () => {
  const b = rv.bouwer({ sinds: 'HEAD' });
  const route = 'POST /api/pay/oplaad';
  const a = b.afhankelijkheden(route);
  assert.equal(a.handler, 'server/routes/pay.js');
  const v = b.verval(route, { AUTH: { staat: 'bewezen', bron: 'poortwacht' } });
  assert.deepEqual([v.verouderd.length, v.vermoed.length, v.onbekend.length], [0, 0, 0]);
});

test('7b. een onbestaande meetcommit is niet vast te stellen, met de reden', () => {
  assert.ok(rv.gewijzigdSinds('0000000000000000000000000000000000000000').reden);
});

test('7c. de module schrijft niets', () => {
  const bron = fs.readFileSync(path.join(__dirname, '../scripts/routeversheid.js'), 'utf8');
  assert.doesNotMatch(bron, /writeFileSync|appendFileSync|renameSync/);
});

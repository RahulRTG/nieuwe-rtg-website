/* DE POSTGRESQL-SPIEGEL ONDER STORING (server/accounts/mirror.js).

   Wat deze module beschermt: met DATABASE_URL is PostgreSQL de waarheid over
   wie er een account heeft en welke personeelsplek actief is; SQLite is de
   lokale cache die elke sessiecontrole leest. Loopt die cache achter -- een
   gemiste melding, een half ingelezen start, een rij die in PostgreSQL bewust
   is gewist -- dan laat een node een INGETROKKEN identiteit weer binnen. Deze
   module moet dus dicht gaan zodra hij het niet zeker weet, en zichzelf
   herstellen door opnieuw volledig in te lezen.

   De PostgreSQL-kant is hier een nagespeelde laag (maakPgAccounts wordt
   vervangen) en de lokale cache een echte SQLite-database in het geheugen.
   De herstarttimer wordt bediend met de nep-klok van node:test, er wordt niet
   geslapen. De echte PostgreSQL-route staat in test/accounts-requestcommit.pg.test.js.

   Wat hier niet mag sneuvelen:
   1. zolang de spiegel niet gereed is, faalt alles wat op PostgreSQL rust
      DICHT: geen commit, geen intrekkingsopslag, geen pool, en in productie
      geen accountmutatie zonder gereserveerd id;
   2. bij de start wint PostgreSQL: een lokaal verouderde rij wordt
      overschreven; buiten productie gaan lokaal-only rijen eenmalig naar
      PostgreSQL;
   3. in productie verdwijnt een lokale rij die in PostgreSQL is gewist, en
      een mislukte start laat de cache heel (ROLLBACK) en de spiegel dicht;
   4. een gemiste melding (de rij kon niet worden opgehaald) zet de spiegel
      meteen op niet-gereed en plant een volledige herinlezing -- en pas die
      maakt hem weer gereed;
   5. een melding van onszelf wordt overgeslagen; een gewiste user verdwijnt
      ook lokaal; een onbekende soort doet niets;
   6. een storingsmelding van een OUDE verbinding raakt de nieuwe niet; de
      herstart gebeurt met terugval en hoogstens een tegelijk;
   7. na afsluiten wordt er niets meer herstart, en een falende afsluiting
      gooit niet.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in pullEen de catch-tak `planAccountHerstel(e, 'notify-pull')` vervangen
     door een lege catch
     -> "4. een gemiste melding zet de spiegel dicht" ZAKT (RAAK).
   - in startPostgresEenmaal de regel `S.zin('DELETE FROM users').run();`
     weggehaald
     -> "3. in productie verdwijnt een lokaal achtergebleven, in PostgreSQL
        gewiste rij" ZAKT (RAAK).

   Draai: node --test test/mirror-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');

const oudeUrl = process.env.DATABASE_URL, oudeEnv = process.env.NODE_ENV, oudeHerkans = process.env.PG_HERKANS_MS;
process.env.DATABASE_URL = 'postgresql://proef.invalid/rtg';
delete process.env.PG_HERKANS_MS;
if (oudeEnv === 'production') delete process.env.NODE_ENV;

const S = require('../server/accounts/state');
const pgaccounts = require('../server/pgaccounts');
const echteMaak = pgaccounts.maakPgAccounts;
const mirror = require('../server/accounts/mirror');

test.after(() => {
  pgaccounts.maakPgAccounts = echteMaak;
  if (oudeUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oudeUrl;
  if (oudeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oudeEnv;
  if (oudeHerkans !== undefined) process.env.PG_HERKANS_MS = oudeHerkans;
});

const USER_COLS = ['id', 'codename', 'sessies_vanaf'];
const STAFF_COLS = ['id', 'supplier_code', 'active'];

function cache(users = [], staff = []) {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, codename TEXT, sessies_vanaf INTEGER)');
  db.exec('CREATE TABLE supplier_staff (id INTEGER PRIMARY KEY, supplier_code TEXT, active INTEGER)');
  for (const u of users) db.prepare('INSERT INTO users VALUES (?,?,?)').run(u.id, u.codename, u.sessies_vanaf || 0);
  for (const s of staff) db.prepare('INSERT INTO supplier_staff VALUES (?,?,?)').run(s.id, s.supplier_code, s.active);
  S.db = db;
  return db;
}
const lokaleUsers = () => S.db.prepare('SELECT * FROM users ORDER BY id').all().map(r => ({ ...r }));
const lokaleStaff = () => S.db.prepare('SELECT * FROM supplier_staff ORDER BY id').all().map(r => ({ ...r }));

/* De nagespeelde PostgreSQL-laag. `tabel` is wat er in PostgreSQL staat. */
function nepPg({ users = [], staff = [], userCols = USER_COLS } = {}) {
  const pg = {
    tabel: { users: new Map(users.map(u => [u.id, u])), supplier_staff: new Map(staff.map(s => [s.id, s])) },
    USER_COLS: userCols, STAFF_COLS,
    geupsert: [], gesloten: 0, blokken: 0, luisteraar: null, onFout: null,
    queryFout: null, sluitFout: null, startFout: null, blokFout: null, eigen: new Set(),
    blok: () => ({ volgende: 1000, eind: 1300 }),
    pool: {
      query: async (sql, [id]) => {
        if (pg.queryFout) throw pg.queryFout;
        const t = /FROM (\w+)/.exec(sql)[1];
        const rij = pg.tabel[t].get(id);
        return { rows: rij ? [rij] : [] };
      }
    },
    intrekkingen: { bewaar: async (r) => ['bewaar', r], lijst: async (t) => ['lijst', typeof t], voltooi: async (k) => ['voltooi', k] },
    schema: async () => { if (pg.startFout) throw pg.startFout; },
    pullAlles: async () => ({ users: [...pg.tabel.users.values()], staff: [...pg.tabel.supplier_staff.values()] }),
    reserveerBlok: async () => { pg.blokken++; if (pg.blokFout) throw pg.blokFout; return pg.blok(); },
    luister: async (fn) => { pg.luisteraar = fn; },
    vanMij: (payload) => pg.eigen.has(payload),
    pasAccountWijzigingenToe: async (client, w) => ({ client, aantal: w.length }),
    upsertUser: async (rij) => { pg.geupsert.push(['user', rij.id]); },
    upsertStaff: async (rij) => { pg.geupsert.push(['staff', rij.id]); },
    deleteUser: async () => {},
    sluit: async () => { pg.gesloten++; if (pg.sluitFout) throw pg.sluitFout; }
  };
  return pg;
}
/* Elke start maakt een nieuwe verbinding; de toets ziet ze allemaal. */
const verbindingen = [];
let volgende = null;
pgaccounts.maakPgAccounts = ({ onFout }) => {
  const pg = volgende ? volgende() : nepPg();
  pg.onFout = onFout;
  verbindingen.push(pg);
  return pg;
};
const laatste = () => verbindingen[verbindingen.length - 1];

async function stil(fn) {
  const w = console.warn, l = console.log;
  console.warn = () => {}; console.log = () => {};
  try { return await fn(); } finally { console.warn = w; console.log = l; }
}
/* Laat de microtaken uitlopen (geen timer, geen slaap). */
async function uitlopen(n = 20) { for (let i = 0; i < n; i++) await Promise.resolve(); }

test('1. zolang de spiegel niet gereed is, faalt alles wat op PostgreSQL rust dicht', async () => {
  cache();
  assert.equal(mirror.PGMODE, true);
  assert.equal(mirror.authoriteitKlaar(), false);
  assert.equal(mirror.postgresKlaar(), false);
  assert.equal(mirror.accountPool(), null);
  await assert.rejects(mirror.commitAccountWijzigingen(null, []), { code: 'PG_ACCOUNTS_NIET_KLAAR' });
  for (const roep of [() => mirror.bewaarIntrekking({}), () => mirror.gedeeldeIntrekkingen(), () => mirror.voltooiIntrekkingen([])]) {
    await assert.rejects(roep(), { code: 'INTREKOPSLAG_ONZEKER' }, 'een intrekking zonder gedeelde opslag is geen intrekking');
  }
  // Buiten productie: zonder blok geen id, wel een stil antwoord (SQLite kiest zelf).
  assert.equal(mirror.nieuwId(), null);
  // In productie: geen accountmutatie zonder gereserveerd id.
  process.env.NODE_ENV = 'production';
  try {
    assert.throws(() => mirror.nieuwId(), (e) => e.code === 'PG_ACCOUNTS_ID_ONZEKER' && e.status === 503);
  } finally { if (oudeEnv === undefined || oudeEnv === 'production') delete process.env.NODE_ENV; else process.env.NODE_ENV = oudeEnv; }
});

test('2. bij de start wint PostgreSQL, en lokaal-only rijen gaan eenmalig mee', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  cache([{ id: 1, codename: 'oud', sessies_vanaf: 0 }, { id: 2, codename: 'alleen-lokaal' }],
    [{ id: 5, supplier_code: 'ZAAK1', active: 1 }, { id: 6, supplier_code: 'LOKAAL', active: 1 }]);
  volgende = () => nepPg({ users: [{ id: 1, codename: 'nieuw', sessies_vanaf: 99 }], staff: [{ id: 5, supplier_code: 'ZAAK1', active: 0 }] });
  const a = stil(() => mirror.startPostgres());
  const b = mirror.startPostgres();
  assert.equal(await a, true);
  assert.equal(await b, true, 'een tweede start terwijl de eerste loopt, wacht op dezelfde');
  assert.equal(verbindingen.length, 1, 'er is precies een verbinding gemaakt');
  const pg = laatste();
  assert.equal(mirror.authoriteitKlaar(), true);
  assert.deepEqual(lokaleUsers().find(u => u.id === 1), { id: 1, codename: 'nieuw', sessies_vanaf: 99 }, 'PostgreSQL wint, ook een intrekking');
  assert.equal(lokaleStaff().find(s => s.id === 5).active, 0, 'een in PostgreSQL uitgezette plek staat ook lokaal uit');
  assert.ok(lokaleUsers().some(u => u.id === 2), 'buiten productie blijft een lokaal-only rij staan');
  // De wachtrij duwt de lokaal-only rijen naar PostgreSQL na zijn korte pauze.
  t.mock.timers.tick(150);
  await uitlopen();
  assert.deepEqual(pg.geupsert.sort(), [['staff', 6], ['user', 2]]);
  // Gereed: alles delegeert naar de verbinding.
  assert.equal(mirror.accountPool(), pg.pool);
  assert.deepEqual(await mirror.commitAccountWijzigingen('client', [1, 2]), { client: 'client', aantal: 2 });
  assert.deepEqual(await mirror.bewaarIntrekking({ k: 1 }), ['bewaar', { k: 1 }]);
  assert.deepEqual(await mirror.gedeeldeIntrekkingen(), ['lijst', 'number']);
  assert.deepEqual(await mirror.voltooiIntrekkingen(['a']), ['voltooi', ['a']]);
});

test('2b. ids komen uit het gereserveerde blok en worden ruim op tijd bijgevuld', async () => {
  const pg = laatste();
  const voor = pg.blokken;
  assert.equal(mirror.nieuwId(), 1000);
  assert.equal(mirror.nieuwId(), 1001);
  assert.equal(pg.blokken, voor, 'ruim binnen het blok: niet bijvullen');
  pg.blok = () => ({ volgende: 5000, eind: 5010 });
  // Loop het blok af tot er minder dan honderd over zijn: dan wordt er bijgevuld.
  let id;
  for (let i = 0; i < 200; i++) { id = mirror.nieuwId(); if (pg.blokken > voor) break; }
  assert.equal(id, 1200, 'bij minder dan honderd over wordt bijgevuld, en het id is nog gewoon geldig');
  await uitlopen();
  assert.equal(mirror.nieuwId(), 5000, 'daarna komt het nieuwe blok');
  // Een mislukte reservering gooit niet, en een leeg blok buiten productie geeft null.
  pg.blokFout = new Error('pool weg');
  const ids = [];
  await stil(async () => { for (let i = 0; i < 30; i++) { ids.push(mirror.nieuwId()); await uitlopen(); } });
  assert.ok(ids.includes(null), 'een uitgeput blok zonder aanvulling levert null en geen verzonnen id');
  assert.ok(!ids.slice(ids.indexOf(null)).some(x => x !== null), 'en daarna niets meer tot er een nieuw blok is');
  pg.blokFout = null;
  pg.blok = () => ({ volgende: 7000, eind: 7500 });
  mirror.nieuwId();
  await uitlopen();
  assert.equal(mirror.nieuwId(), 7000, 'na herstel van de reservering weer ids');
});

test('5. meldingen: een eigen melding wordt overgeslagen, een gewiste user verdwijnt, een onbekende soort doet niets', async () => {
  const pg = laatste();
  let extern = 0;
  mirror.onExternalChange(() => { extern++; });
  // Een melding van onszelf: niets ophalen, niets overschrijven.
  pg.tabel.users.set(1, { id: 1, codename: 'van-ons', sessies_vanaf: 99 });
  pg.eigen.add('user:1');
  await pg.luisteraar('user:1');
  assert.equal(lokaleUsers().find(u => u.id === 1).codename, 'nieuw');
  assert.equal(extern, 0);
  // Een melding van een andere instance: de rij komt binnen en de buitenwereld hoort het.
  pg.eigen.clear();
  pg.tabel.users.set(3, { id: 3, codename: 'derde', sessies_vanaf: 0 });
  await pg.luisteraar('user:3');
  assert.ok(lokaleUsers().some(u => u.id === 3 && u.codename === 'derde'));
  assert.equal(extern, 1);
  // Gewist in PostgreSQL: ook lokaal weg. Een ingetrokken identiteit blijft niet hangen.
  pg.tabel.users.delete(3);
  await pg.luisteraar('user:3');
  assert.ok(!lokaleUsers().some(u => u.id === 3));
  assert.equal(extern, 2);
  // Personeel: een bijgewerkte plek komt binnen; een ontbrekende rij laat de cache staan.
  pg.tabel.supplier_staff.set(5, { id: 5, supplier_code: 'ZAAK1', active: 1 });
  await pg.luisteraar('staff:5');
  assert.equal(lokaleStaff().find(s => s.id === 5).active, 1);
  // Een veld dat in de melding ontbreekt wordt NULL, en houdt niet de oude (actieve) waarde.
  pg.tabel.supplier_staff.set(6, { id: 6, supplier_code: 'LOKAAL' });
  await pg.luisteraar('staff:6');
  assert.equal(lokaleStaff().find(s => s.id === 6).active, null);
  await pg.luisteraar('staff:404');
  assert.equal(lokaleStaff().length, 2);
  // Onbekende soort of geen dubbele punt: niets.
  const voor = JSON.stringify([lokaleUsers(), lokaleStaff()]);
  await pg.luisteraar('bestelling:1');
  await pg.luisteraar('rommel');
  assert.equal(JSON.stringify([lokaleUsers(), lokaleStaff()]), voor);
  assert.equal(mirror.authoriteitKlaar(), true, 'gewone meldingen laten de spiegel gereed');
  mirror.onExternalChange(null);
});

test('4. een gemiste melding zet de spiegel dicht, en pas een volledige herinlezing opent hem weer', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pg = laatste();
  pg.queryFout = new Error('verbinding verbroken');
  await stil(() => pg.luisteraar('user:1'));
  assert.equal(mirror.authoriteitKlaar(), false, 'na een gemiste melding is de cache niet te vertrouwen');
  await assert.rejects(mirror.commitAccountWijzigingen(null, []), { code: 'PG_ACCOUNTS_NIET_KLAAR' });
  await assert.rejects(mirror.bewaarIntrekking({}), { code: 'INTREKOPSLAG_ONZEKER' });
  assert.equal(mirror.accountPool(), null);
  // Nog een fout terwijl de herstart gepland staat: geen tweede timer, geen tweede verbinding.
  await stil(() => pg.luisteraar('user:1'));
  // Intussen is in PostgreSQL een plek uitgezet; de herinlezing moet dat meenemen.
  volgende = () => nepPg({ users: [{ id: 1, codename: 'nieuw', sessies_vanaf: 123 }], staff: [{ id: 5, supplier_code: 'ZAAK1', active: 0 }] });
  const aantal = verbindingen.length;
  t.mock.timers.tick(999);
  await uitlopen();
  assert.equal(verbindingen.length, aantal, 'voor de terugvaltijd geen herstart');
  await stil(async () => { t.mock.timers.tick(1); await uitlopen(60); });
  assert.equal(verbindingen.length, aantal + 1, 'precies een herstart');
  assert.equal(pg.gesloten, 1, 'de oude verbinding is gesloten');
  assert.equal(mirror.authoriteitKlaar(), true, 'na de herinlezing weer gereed');
  assert.equal(lokaleStaff().find(s => s.id === 5).active, 0);
  assert.equal(lokaleUsers().find(u => u.id === 1).sessies_vanaf, 123, 'de intrekking uit PostgreSQL staat lokaal');
});

test('6. een storingsmelding van een oude verbinding raakt de nieuwe niet; een mislukte herstart probeert later opnieuw', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const oud = verbindingen[verbindingen.length - 2];
  const nu = laatste();
  await stil(() => oud.onFout(new Error('oude pool sterft'), 'pool'));
  await stil(() => oud.onFout(new Error('zonder bron')));
  assert.equal(mirror.authoriteitKlaar(), true, 'de oude verbinding zegt niets meer over de nieuwe');
  // De nieuwe meldt een storing; de herstart faalt bij het schema.
  volgende = () => { const pg = nepPg(); pg.startFout = new Error('schema onbereikbaar'); return pg; };
  await stil(() => nu.onFout(new Error('nieuwe pool hapert'), 'pool'));
  assert.equal(mirror.authoriteitKlaar(), false);
  const aantal = verbindingen.length;
  await stil(async () => { t.mock.timers.tick(1000); await uitlopen(60); });
  assert.equal(verbindingen.length, aantal + 1, 'eerste herstart (na 1 s) is geprobeerd');
  assert.equal(mirror.authoriteitKlaar(), false, 'een mislukte start opent niets');
  // De volgende poging wacht langer (terugval): na 1 s nog niets, na 2 s wel.
  volgende = () => nepPg({ users: [{ id: 1, codename: 'nieuw', sessies_vanaf: 123 }], staff: [{ id: 5, supplier_code: 'ZAAK1', active: 0 }] });
  await stil(async () => { t.mock.timers.tick(1000); await uitlopen(60); });
  assert.equal(verbindingen.length, aantal + 1, 'de tweede poging wacht langer dan de eerste');
  await stil(async () => { t.mock.timers.tick(1000); await uitlopen(60); });
  assert.equal(verbindingen.length, aantal + 2);
  assert.equal(mirror.authoriteitKlaar(), true);
});

test('3. in productie verdwijnt een lokaal achtergebleven, in PostgreSQL gewiste rij; een mislukte start laat de cache heel', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  process.env.NODE_ENV = 'production';
  try {
    cache([{ id: 1, codename: 'nieuw' }, { id: 66, codename: 'gewist-in-pg' }], [{ id: 5, supplier_code: 'ZAAK1', active: 1 }, { id: 77, supplier_code: 'WEG', active: 1 }]);
    volgende = () => nepPg({ users: [{ id: 1, codename: 'nieuw', sessies_vanaf: 5 }], staff: [{ id: 5, supplier_code: 'ZAAK1', active: 1 }] });
    assert.equal(await stil(() => mirror.startPostgres()), true);
    assert.deepEqual(lokaleUsers().map(u => u.id), [1], 'de in PostgreSQL gewiste user komt een koude node niet meer in');
    assert.deepEqual(lokaleStaff().map(s => s.id), [5]);
    assert.deepEqual(laatste().geupsert, [], 'productie duwt geen lokale rijen naar PostgreSQL');

    // Een start die halverwege faalt (een kolom die de cache niet kent): ROLLBACK, cache heel, dicht.
    volgende = () => nepPg({ users: [{ id: 1, codename: 'x', onbekend: 1 }], userCols: ['id', 'codename', 'onbekend'] });
    const voor = lokaleUsers();
    await assert.rejects(stil(() => mirror.startPostgres()));
    assert.deepEqual(lokaleUsers(), voor, 'de cache is teruggerold');
    assert.deepEqual(lokaleStaff().map(s => s.id), [5], 'ook de al gewiste personeelstabel is terug');
    assert.equal(mirror.authoriteitKlaar(), false, 'een half ingelezen spiegel is niet gereed');
  } finally {
    if (oudeEnv === undefined || oudeEnv === 'production') delete process.env.NODE_ENV; else process.env.NODE_ENV = oudeEnv;
  }
});

test('7. na afsluiten wordt er niets meer herstart, en een falende afsluiting gooit niet', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  cache([{ id: 1, codename: 'nieuw' }]);
  volgende = () => nepPg({ users: [{ id: 1, codename: 'nieuw' }] });
  await stil(() => mirror.startPostgres());
  const pg = laatste();
  // Een herstart staat gepland op het moment van afsluiten.
  await stil(() => pg.onFout(new Error('hapering'), 'pool'));
  pg.sluitFout = new Error('sluiten mislukt');
  await mirror.flushBijAfsluiten();
  assert.equal(mirror.authoriteitKlaar(), false);
  const aantal = verbindingen.length;
  await stil(async () => { t.mock.timers.tick(60000); await uitlopen(60); });
  assert.equal(verbindingen.length, aantal, 'de geplande herstart is geannuleerd');
  // Ook een nieuwe storing na afsluiten plant niets meer.
  await stil(() => pg.onFout(new Error('na afsluiten'), 'pool'));
  await stil(async () => { t.mock.timers.tick(60000); await uitlopen(60); });
  assert.equal(verbindingen.length, aantal);
  // Twee keer afsluiten mag.
  await mirror.flushBijAfsluiten();
});

test('7b. een gereed afgesloten spiegel spoelt eerst zijn wachtrij, ook als dat faalt', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  cache([{ id: 1, codename: 'nieuw' }, { id: 9, codename: 'lokaal' }]);
  volgende = () => nepPg({ users: [{ id: 1, codename: 'nieuw' }] });
  await stil(() => mirror.startPostgres());
  const pg = laatste();
  assert.equal(mirror.authoriteitKlaar(), true);
  pg.upsertUser = async () => { throw new Error('pg weg'); };
  await mirror.flushBijAfsluiten();
  assert.equal(pg.gesloten, 1);
  assert.equal(mirror.authoriteitKlaar(), false);
});

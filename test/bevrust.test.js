/* ============================================================================
   RUST OVER DE DATUMGRENS in het beveiligingsrooster (ARBEID.md par. 4 punt 5).

   De autoplanner keek voor rust alleen binnen dezelfde kalenderdatum. Een
   nachtdienst loopt van 23:00 tot 07:00 de VOLGENDE ochtend, dus een bewaker
   die de nacht draaide kon om 07:00 op de dagdienst worden gezet terwijl een
   collega vrij was. Deze toetsen draaien de ECHTE planning- en aanvragenlaag op
   een kleine nagebouwde context, zodat ze de rekensom toetsen en niet de server.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { BEVEILIGING_SHIFTS } = require('../server/kern/beveiliging');

function wereld(diensten) {
  const lijst = diensten.map(d => Object.assign({ supplierCode: 'Z', status: 'gepland', postId: 'P' }, d));
  const ctx = {
    db: { data: { bevDiensten: lijst } }, save() {}, sseToSupplier() {},
    BEV_SHIFTS: BEVEILIGING_SHIFTS,
    shiftVan: sid => BEVEILIGING_SHIFTS.find(x => x.id === sid) || null,
    functieAan: () => true, vandaag: () => '2026-09-24', nu: () => 't',
    id: (() => { let n = 0; return p => p + (++n); })(),
    guards: () => [{ id: 1 }, { id: 2 }], guardNaam: (s, g) => 'Bewaker ' + g,
    postVan: () => ({ id: 'P', naam: 'Post', klant: 'K' }),
    diensten: () => ctx.db.data.bevDiensten
  };
  Object.assign(ctx, require('../server/kern/beveiliging/rooster/planning')(ctx));
  /* het rooster zelf is hier een vaste open plek: een dagdienst op de 24e */
  ctx.rooster = () => ({ dagen: [{ posten: [{ postId: 'P', shifts: [{ shiftId: 'dag', open: 1 }] }] }] });
  Object.assign(ctx, require('../server/kern/beveiliging/rooster/aanvragen')(ctx));
  return ctx;
}

test('wie de nacht draaide, staat om 07:00 niet op de dagdienst', () => {
  /* bewaker 1 draaide de nacht van de 23e (tot 07:00 op de 24e) en heeft minder
     uren, dus zonder rustregel had de planner hem gekozen */
  const w = wereld([
    { guardId: 1, datum: '2026-09-23', shiftId: 'nacht' },
    { guardId: 2, datum: '2026-09-01', shiftId: 'dag' }, { guardId: 2, datum: '2026-09-02', shiftId: 'dag' }
  ]);
  const r = w.planAuto({ code: 'Z' }, '2026-09-24');
  assert.equal(r.gemaakt.length, 1);
  assert.equal(r.gemaakt[0].guardId, 2, 'de uitgeruste collega, niet de nachtwaker');
  assert.equal(r.gemaakt[0].door, 'autoplan', 'achteraf is te zien dat de automaat plaatste');
});

test('de rustregel kijkt ook vooruit: een dienst voor een al geplande dag erna', () => {
  const w = wereld([{ guardId: 1, datum: '2026-09-25', shiftId: 'dag' }]);
  assert.match(w.rustBotsing({ code: 'Z' }, 1, '2026-09-24', 'nacht'), /geen 11 uur rust/);
  assert.match(w.rustBotsing({ code: 'Z' }, 1, '2026-09-24', 'avond'), /geen 11 uur rust/, 'avond tot 23:00, dag om 07:00: acht uur');
  assert.equal(w.rustBotsing({ code: 'Z' }, 1, '2026-09-24', 'dag'), null, 'dag op dag: zestien uur rust');
});

test('binnen een dag blijft het de oude regel: geen twee diensten', () => {
  const w = wereld([{ guardId: 1, datum: '2026-09-24', shiftId: 'dag' }]);
  for (const sid of ['avond', 'nacht']) assert.ok(w.rustBotsing({ code: 'Z' }, 1, '2026-09-24', sid), sid);
});

test('de automaat plant nooit tegen de rust in; een mens krijgt de botsing te zien', () => {
  const w = wereld([{ guardId: 1, datum: '2026-09-23', shiftId: 'nacht' }]);
  const dienst = { postId: 'P', shiftId: 'dag', datum: '2026-09-24', guardId: 1 };
  assert.equal(w.zetDienst({ code: 'Z' }, dienst, { door: 'autoplan' }).status, 409);
  const mens = w.zetDienst({ code: 'Z' }, dienst);
  assert.equal(mens.ok, true);
  assert.equal(mens.dienst.door, 'mens');
  assert.match(mens.rustWaarschuwing, /geen 11 uur rust/);
});

test('`door` komt niet uit het verzoek: een body met door=autoplan telt als mens', () => {
  const w = wereld([]);
  const r = w.zetDienst({ code: 'Z' }, { postId: 'P', shiftId: 'dag', datum: '2026-09-24', guardId: 1, door: 'autoplan' });
  assert.equal(r.dienst.door, 'mens');
});

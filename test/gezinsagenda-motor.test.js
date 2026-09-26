/* De gezinsagenda is geen tweede agenda meer (SCHERMEIGENAAR.json,
   consolidatieronde van 23 september 2026): hij schrijft en leest via
   dezelfde motor als de ledenagenda, onder de sleutel gezin:<code>.

   Deze toets draait de ECHTE motor (kern/agenda-pro.js) onder de ECHTE
   gezinsroutes (foundation/gasten/gezinsagenda.js), op een database in het
   geheugen, en kijkt waar de punten terechtkomen. De zwarte-doostoetsen
   (rtfagenda, gezin-weghalen) houden vast dat het gezin niets merkt; deze
   houdt vast dat het er ook echt EEN agenda is.
   Draai los: node --test test/gezinsagenda-motor.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakAgendaPro } = require('../server/kern/agenda-pro');
const { agendaGezinSleutel } = require('../server/kern/agenda');

function wereld(gezinnen) {
  const db = { data: { foundation: { gezinnen } } };
  const routes = {};
  const router = { post: (p, f) => { routes['POST ' + p] = f; }, get: (p, f) => { routes['GET ' + p] = f; } };
  let bewaard = 0;
  const save = () => { bewaard++; };
  const G = () => db.data.foundation.gezinnen;
  const sessie = req => {
    const g = G()[req.body.code];
    const p = g && Object.values(g.profielen).find(x => x.token === req.body.token);
    return p ? { g, p } : null;
  };
  const ctx = { router, db, save, G, F: () => db.data.foundation, nu: () => new Date().toISOString(),
    rid: () => 'x' + Math.random().toString(36).slice(2, 6),
    schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n || 200),
    isGast: p => p.rol === 'gast',
    sessieVan: (req, res) => sessie(req) || (res.status(403).json({ error: 'nee' }), null),
    familieVan: (req, res) => { const s = sessie(req); if (!s || s.p.rol === 'gast') { res.status(403).json({ error: 'nee' }); return null; } return s; } };
  const leven = require('../server/foundation/gasten/gezinsagenda')(ctx);
  const motor = maakAgendaPro({ db, save, bijeen: async f => f(), inBundel: () => false, crypto,
    schoon: ctx.schoon, keyVanCodenaam: async () => null, codenaamVan: () => null,
    sseToCustomer: () => {}, boekingenVanKlant: () => [] });
  async function roep(sleutel, body) {
    let status = 200, uit;
    const res = { status(c) { status = c; return res; }, json(b) { uit = b; return res; } };
    await routes[sleutel]({ body, params: {} }, res);
    return { status, body: uit };
  }
  return { db, leven, motor, roep, bewaard: () => bewaard };
}

function gezin(code, agenda) {
  const g = { code, naam: 'Proef', profielen: {
    ma: { id: 'ma', naam: 'Mam', rol: 'beheerder', token: 't-ma' },
    noor: { id: 'noor', naam: 'Noor', rol: 'kind', kleur: '#3A7BD5', token: 't-noor' },
    op: { id: 'op', naam: 'Oppas', rol: 'gast', token: 't-op' } } };
  if (agenda) g.agenda = agenda;
  return g;
}

test('1. een nieuw gezinspunt landt in de agendamotor onder gezin:<code>, niet in het gezinsrecord', async () => {
  const w = wereld({ GZ1: gezin('GZ1') });
  w.leven.setAgenda(w.motor);
  const r = await w.roep('POST /gezin/agenda', { code: 'GZ1', token: 't-ma', titel: 'Zwemles', datum: '2026-09-05', tijd: '16:00', wie: 'noor' });
  assert.equal(r.status, 200);
  const punten = w.db.data.agendas[agendaGezinSleutel('GZ1')];
  assert.equal(punten.length, 1, 'het punt staat in dezelfde opslag als elke andere agenda');
  assert.equal(punten[0].wie, 'noor');
  assert.equal(punten[0].door, 'ma');
  assert.equal(w.db.data.foundation.gezinnen.GZ1.agenda, undefined, 'er is geen tweede lijst in het gezinsrecord');
});

test('2. het bereik komt van de motor: wat de motor weet, ziet het gezin, met kleur en naam erbij', async () => {
  const w = wereld({ GZ2: gezin('GZ2') });
  w.leven.setAgenda(w.motor);
  // rechtstreeks via de motor gezet, zoals elke andere agenda dat doet
  await w.motor.bewaarAfspraak(agendaGezinSleutel('GZ2'), { titel: 'Zakgeld', datum: '2026-08-31', herhaal: 'maand', herhaalTot: '2026-10-31', wie: 'noor' });
  const b = await w.roep('POST /gezin/agenda/bereik', { code: 'GZ2', token: 't-op', van: '2026-08-01', tot: '2026-11-30' });
  assert.deepEqual(b.body.items.map(i => i.datum), ['2026-08-31', '2026-09-30', '2026-10-31'],
    'de klemregel is die van de motor, want er is geen tweede uitrol meer');
  assert.equal(b.body.items[1].basis, '2026-08-31', 'bewerken rekent met de startdatum van de reeks');
  assert.equal(b.body.items[0].wieKleur, '#3A7BD5');
  assert.equal(b.body.magBewerken, false, 'de oppas leest mee en schrijft niet');
});

test('3. de overname: oude gezinspunten gaan een keer over, met hun eigen id, en het veld verdwijnt', async () => {
  const oud = [{ id: 'a1', titel: 'Tandarts', datum: '2026-10-01', tijd: '09:00', wie: 'noor', door: 'ma', herhaal: 'geen', herhaalTot: '', notitie: 'kaart mee', at: '2026-09-01T10:00:00Z' },
    { id: 'a2', titel: 'Noor jarig', datum: '2026-03-15', tijd: '', wie: '', door: 'ma', herhaal: 'jaar', herhaalTot: '', notitie: '', at: '2026-01-01T10:00:00Z' }];
  const w = wereld({ GZ3: gezin('GZ3', oud) });
  w.leven.setAgenda(w.motor);
  const punten = w.db.data.agendas[agendaGezinSleutel('GZ3')];
  assert.deepEqual(punten.map(p => p.id), ['a1', 'a2'], 'een oppas of koppeling die het id kent, blijft het vinden');
  assert.equal(punten[0].notitie, 'kaart mee');
  assert.equal(punten[1].herhaal, 'jaar');
  assert.equal(w.db.data.foundation.gezinnen.GZ3.agenda, undefined);
  assert.ok(w.bewaard() > 0, 'de overname wordt weggeschreven');
  // idempotent: nog eens binden zet niets dubbel
  w.db.data.foundation.gezinnen.GZ3.agenda = oud;
  w.leven.setAgenda(w.motor);
  assert.equal(w.db.data.agendas[agendaGezinSleutel('GZ3')].length, 2);
  const b = await w.roep('POST /gezin/agenda/bereik', { code: 'GZ3', token: 't-ma', van: '2027-03-01', tot: '2027-03-31' });
  assert.ok(b.body.items.find(i => i.titel === 'Noor jarig' && i.datum === '2027-03-15'), 'een overgenomen reeks rolt gewoon door');
});

test('4. verzetten via de gezinsroute houdt wat niet werd meegestuurd', async () => {
  const w = wereld({ GZ4: gezin('GZ4') });
  w.leven.setAgenda(w.motor);
  const r = await w.roep('POST /gezin/agenda', { code: 'GZ4', token: 't-ma', titel: 'Zwemles', datum: '2026-09-05', tijd: '16:00', wie: 'noor', notitie: 'handdoek' });
  await w.roep('POST /gezin/agenda/wijzig', { code: 'GZ4', token: 't-ma', itemId: r.body.item.id, datum: '2026-09-06' });
  const p = w.db.data.agendas[agendaGezinSleutel('GZ4')];
  assert.equal(p.length, 1);
  assert.equal(p[0].datum, '2026-09-06');
  assert.equal(p[0].tijd, '16:00', 'de motor bewaart in zijn geheel, dus de route vult aan wat niet meekwam');
  assert.equal(p[0].notitie, 'handdoek');
  assert.equal(p[0].wie, 'noor');
  assert.equal(p[0].door, 'ma', 'wie het zette verschuift niet');
});

test('5. zonder motor zegt de gezinsagenda dat hij er even niet is, en valt hij niet terug op een eigen lijst', async () => {
  const w = wereld({ GZ5: gezin('GZ5') });
  const r = await w.roep('POST /gezin/agenda', { code: 'GZ5', token: 't-ma', titel: 'X', datum: '2026-09-05' });
  assert.equal(r.status, 503);
  assert.equal(w.db.data.foundation.gezinnen.GZ5.agenda, undefined);
});

test('6. een gewist gezin laat geen punten achter in de motor', async () => {
  const w = wereld({ GZ6: gezin('GZ6') });
  w.leven.setAgenda(w.motor);
  await w.roep('POST /gezin/agenda', { code: 'GZ6', token: 't-ma', titel: 'Tandarts', datum: '2026-10-01' });
  assert.equal(w.db.data.agendas[agendaGezinSleutel('GZ6')].length, 1);
  w.leven.wisGezinsagenda('GZ6');
  assert.equal(w.db.data.agendas[agendaGezinSleutel('GZ6')], undefined);
});

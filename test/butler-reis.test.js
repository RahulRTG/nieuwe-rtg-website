/* De Butler-reislaag: Rahul regelt met een vraag een hele reis (verblijf,
   transfer, diner, activiteit) die op een enkel "ja" in zijn geheel wordt
   geboekt; koopt kleding (apart leggen in de juiste maat bij de modezaak);
   en voorspelt wat er nog nodig is. Draai los:
   node --experimental-sqlite --test test/butler-reis.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-butlerreis-'));

const api = (pad, body) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lid },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = (await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json()).token;
  assert.ok(lid);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('voorspellen: Rahul zegt wat er nog nodig is, met bruikbare zinnen', async () => {
  const r = await api('fluister', { q: 'wat heb ik nodig?' });
  assert.equal(r.status, 200);
  assert.ok(/klaarzetten/i.test(r.body.antwoord), 'de voorspelling noemt wat hij zou klaarzetten');
  assert.ok(/plan mijn weekend|reserveer|regel/i.test(r.body.antwoord), 'elke tip komt met een bruikbare zin');
});

test('een hele reis op een vraag: voorstel met totaalprijs, en het ene "ja" boekt alles', async () => {
  const v = await api('fluister', { q: 'plan mijn weekend naar Ibiza met 4 vrienden' });
  assert.equal(v.status, 200);
  assert.equal(v.body.voorstel, true, 'de reis is eerst een voorstel (drempel: er is geld mee gemoeid)');
  assert.ok(/Mijn voorstel voor uw reis/i.test(v.body.antwoord));
  assert.ok(/€/.test(v.body.antwoord), 'het voorstel noemt de totaalprijs');

  const ja = await api('fluister', { q: 'ja' });
  assert.equal(ja.status, 200);
  assert.ok(/Uw reis staat/i.test(ja.body.antwoord), 'na het ene ja staat de reis');
  assert.ok(/✓/.test(ja.body.antwoord), 'minstens een onderdeel is echt gelukt');

  // het verblijf is echt geboekt en staat in de app
  const mijn = await api('verblijf/mijn', {});
  assert.equal(mijn.status, 200);
  assert.ok((mijn.body.verblijven || []).length >= 1, 'het verblijf staat onder Reizen');
});

test('kleding kopen: gevonden in de collectie, en na "ja" hangt het apart in de juiste maat', async () => {
  const v = await api('fluister', { q: 'koop een linnen overhemd voor mij' });
  assert.equal(v.status, 200);
  assert.equal(v.body.voorstel, true, 'apart leggen claimt voorraad, dus eerst een voorstel');
  assert.ok(/Linnen overhemd/i.test(v.body.antwoord));
  assert.ok(/maat/i.test(v.body.antwoord), 'het voorstel noemt de maat');

  const ja = await api('fluister', { q: 'ja' });
  assert.equal(ja.status, 200);
  assert.ok(/apart/i.test(ja.body.antwoord), 'het stuk hangt apart bij de zaak');

  const mijn = await api('retail/mijn', {});
  assert.equal(mijn.status, 200);
  assert.ok((mijn.body.apart || []).some(a => /Linnen overhemd/i.test(a.artikelNaam || '')), 'het apart gelegde stuk staat in de app');
});

test('een AI-hart: het personeel praat met Rahul en krijgt een echte servicedag', async () => {
  const roster = await api('supplier/roster', { code: 'HOSHI' });
  const m = (roster.body.staff || []).find(x => x.role === 'manager');
  const pda = (await (await fetch(base + '/api/supplier/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'HOSHI', staffId: m.id, pin: '1234' })
  })).json()).token;
  assert.ok(pda);
  const vraag = q => fetch(base + '/api/staff/fluister', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pda },
    body: JSON.stringify({ q })
  }).then(async x => ({ status: x.status, body: await x.json().catch(() => ({})) }));
  // het ene hart: ook hier heet de assistent Rahul
  const wie = await vraag('wie ben je?');
  assert.equal(wie.status, 200);
  assert.ok(/Rahul/.test(wie.body.antwoord), 'de assistent heet Rahul, ook voor personeel');
  // en hij bouwt de servicedag uit de echte dagstand van de eigen zaak
  const dag = await vraag('plan mijn servicedag');
  assert.equal(dag.status, 200);
  assert.ok(/servicedag bij/i.test(dag.body.antwoord), 'het dagplan komt uit de eigen zaakstand');
});

test('fotocoach: Rahul geeft gerichte tips voor vakantie- en food-fotografie', async () => {
  const vak = await api('fluister', { q: 'geef me een fototip voor mijn vakantie' });
  assert.equal(vak.status, 200);
  assert.ok(/horizon|gouden uur/i.test(vak.body.antwoord), 'de vakantietip gaat over compositie en licht');
  const food = await api('fluister', { q: 'fototip voor mijn eten?' });
  assert.equal(food.status, 200);
  assert.ok(/bord|boven/i.test(food.body.antwoord), 'de food-tip gaat over het bord en de hoek');
});

test('nee blijft nee: een afgewezen kledingvoorstel wordt niet uitgevoerd', async () => {
  const v = await api('fluister', { q: 'koop een zijden slipdress' });
  assert.equal(v.body.voorstel, true);
  const nee = await api('fluister', { q: 'nee' });
  assert.ok(/niet door|van tafel/i.test(nee.body.antwoord));
  const mijn = await api('retail/mijn', {});
  assert.ok(!(mijn.body.apart || []).some(a => /slipdress/i.test(a.artikelNaam || '')), 'niets apart gelegd zonder ja');
});

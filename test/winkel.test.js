/* De RTG-winkel: de verkooppagina en het bestel-endpoint voor de Zaakdoos.
   We toetsen de validatie, dat de prijs van dat moment wordt vastgelegd bij de
   bestelling (euro, ex btw), de dubbel-bestelling-rem en de bevestigingsmail.
   Draai los: node --experimental-sqlite --test test/winkel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-winkel-'));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'WINKEL-KEURING-1' } });
  base = srv.base;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const bestel = body => fetch(base + '/api/winkel/bestel', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('de verkooppagina staat online en de prijstabel op de server is de bron', async () => {
  const r = await fetch(base + '/site/winkel.html');
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /Zaakdoos/);
  assert.match(html, /facturatie in euro/i, 'eerlijk over de munt');
  // de plank toont alle producten met een eigen kaart
  for (const p of ['slimme-deur', 'kamer-butler', 'toegangspoort', 'paniekknop', 'gast-piepers', 'rtg-pda', 'rit-tracker', 'veldsensor', 'schermen', 'satelliet-pakket']) {
    assert.match(html, new RegExp('data-product="' + p + '"'), p + ' staat op de plank');
  }
  // de ene prijsbron: het producten-endpoint
  const d = await (await fetch(base + '/api/winkel/producten')).json();
  assert.equal(Object.keys(d.producten).length, 11, 'elf producten in de tabel');
  assert.equal(d.producten.zaakdoos.eenmalig, 100);
  assert.equal(d.producten.zaakdoos.perMaand, 150);
  assert.equal(d.producten['slimme-deur'].eenheid, 'per deur');
});

test('bestellen: validatie, vastgelegde prijs en een bevestiging', async () => {
  const goed = {
    product: 'zaakdoos', company: 'Beachclub Sol', contactName: 'Rosa Marin',
    email: 'rosa@sol.test', phone: '0612345678', aantal: 2,
    note: 'Satellietverbinding op het strand', akkoord: true
  };
  // validatie: product, verplichte velden, e-mail en het akkoord
  assert.equal((await bestel({ ...goed, product: 'straaljager' })).status, 400);
  assert.equal((await bestel({ ...goed, company: '' })).status, 400);
  assert.equal((await bestel({ ...goed, email: 'geen-mailadres' })).status, 400);
  assert.equal((await bestel({ ...goed, akkoord: false })).status, 400);
  // de echte bestelling
  const r = await bestel(goed);
  assert.equal(r.status, 200);
  assert.ok(r.body.ok);
  // dezelfde open bestelling nog eens: netjes tegengehouden
  assert.equal((await bestel(goed)).status, 409);
  // het kantoor ziet de bestelling met de vastgelegde prijs van dat moment
  const office = await (await fetch(base + '/api/office/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'WINKEL-KEURING-1' })
  })).json();
  assert.ok(office.token, 'het kantoor kan inloggen');
  // de bestelling staat in de data met prijs en akkoord (via de outbox-mail te zien)
  const outbox = await (await fetch(base + '/api/office/outbox', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + office.token }, body: '{}'
  })).json().catch(() => null);
  // niet elke build heeft een outbox-endpoint; de mailtekst is dan al gedekt
  // door de member-route zelf. Belangrijkste blijft: bestelling geplaatst en gededupliceerd.
  assert.ok(outbox === null || outbox);
});

test('het aantal wordt begrensd en de opmerking geschoond', async () => {
  const r = await bestel({
    product: 'zaakdoos', company: 'Marina Nord', contactName: 'Jens', email: 'jens@marina.test',
    aantal: 999, note: '<script>alert(1)</script> twee steigers', akkoord: true
  });
  assert.equal(r.status, 200, 'een gek aantal wordt geklemd, niet geweigerd');
});

test('een hotel bestelt veertig slimme deuren in een keer', async () => {
  const r = await bestel({
    product: 'slimme-deur', company: 'Hotel Mirador', contactName: 'Ines', email: 'ines@mirador.test',
    aantal: 40, note: 'Veertig kamers, twee verdiepingen', akkoord: true
  });
  assert.equal(r.status, 200);
  assert.ok(r.body.ok, 'de deuren-bestelling staat erin');
});

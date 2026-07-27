/* Golf 6: de ondernemersintake en de automatische bedrijfsprovisioning.
   Getoetst: de aanvraag draagt de bedrijfsbehoeften; zonder menselijk
   akkoord gebeurt er niets; na akkoord + eerste termijn voldaan staat de
   zaak er (met dorp van het genre en de wensen uit de intake), en de
   eigenaar kan met de eenmalige PIN op de zaak inloggen.
   Draai los: node --experimental-sqlite --test test/bedrijfsintake.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-intake-'));
const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  office = (await json(await raw('/office/login', { code: 'RTG-OFFICE' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('ondernemersintake: behoeften mee, mens beslist, zaak na eerste voldane termijn', async () => {
  // 1. de aanvraag met bedrijfsintake (de AI vraagt wat er nodig is)
  let r = await json(await raw('/aanmelding/aanvraag', { pas: 'business', naam: 'Imre Dekker', contact: 'imre@zaak.test',
    bedrijf: { naam: 'Dekker Interieur', type: 'vakwerk', plaats: 'Ibiza', behoeften: ['Offertes en facturen', 'Team van drie op de PDA'] } }));
  assert.equal(r.ok, true);
  const id = r.aanmelding.id;
  assert.equal(r.aanmelding.bedrijf.type, 'vakwerk');
  assert.equal(r.aanmelding.bedrijf.behoeften.length, 2);

  // 2. zonder akkoord geen zaak; termijn aftekenen kan pas na het besluit
  r = await json(await raw('/aanmelding/termijn-voldaan', { id, maand: 1 }, office));
  assert.ok(r.error, 'zonder betaalschema (geen akkoord) valt aftekenen netjes uit');

  // 3. de ENE menselijke handeling
  r = await json(await raw('/aanmelding/beslis', { id, besluit: 'geaccepteerd', notitie: 'welkom' }, office));
  assert.equal(r.ok, true);

  // 4. de eerste termijn wordt afgetekend: de zaak wordt automatisch klaargezet
  r = await json(await raw('/aanmelding/termijn-voldaan', { id, maand: 1 }, office));
  assert.equal(r.ok, true);
  assert.ok(r.zaak && r.zaak.code, 'de zaak is geprovisioned');
  assert.match(String(r.zaak.pin || ''), /^\d{4}$/, 'de eigenaars-PIN komt eenmalig mee');
  const code = r.zaak.code;

  // 5. de eigenaar logt in en heeft het dorp van zijn genre + de wensen
  const roster = (await json(await raw('/supplier/roster', { code }))).staff;
  const eigenaar = roster.find(x => x.role === 'manager');
  assert.ok(eigenaar, 'de eigenaar staat op het rooster');
  const sup = (await json(await raw('/supplier/login', { code, staffId: eigenaar.id, pin: r.zaak.pin }))).token;
  assert.ok(sup, 'de eigenaar kan met de eenmalige PIN inloggen');
  const dorp = await json(await raw('/supplier/dorp', {}, sup));
  assert.ok((dorp.afdelingen || []).some(a => a.key === 'offertes'), 'het vakwerk-dorp staat klaar (offertes-afdeling)');
  const wensen = await json(await raw('/supplier/wensen', {}, sup));
  assert.ok((wensen.wensen || []).some(w => w.wens.indexOf('Offertes') >= 0), 'de intake-behoeften staan als open wensen bij de zaak');

  // 6. dubbel aftekenen van dezelfde termijn wordt geweigerd; er komt geen tweede zaak
  r = await json(await raw('/aanmelding/termijn-voldaan', { id, maand: 1 }, office));
  assert.ok(r.error, 'een termijn wordt maar een keer afgetekend');
});

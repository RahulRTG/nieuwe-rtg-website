/* DE INHOUDSWACHT -- elke blinde route krijgt zijn vormcontract terug.

   INHOUDSKAART.json draagt per (voorheen) blinde route het ware
   antwoordprofiel: status, sleutels, en welke velden dragend zijn. Dit bestand
   dwingt die profielen af, route voor route, elk als eigen toets. De liegpoort
   vervangt een antwoord door `200 {ok:true}`; elke route hieronder wiens
   profiel meer belooft dan dat, zakt dus onder een leugen over precies die
   route -- en zo meet de OUTPUT-band deze wacht per route na, met controlerun.

   De aanroepvolgorde is DEZELFDE als waarin de kaart is opgenomen
   (gesorteerd), zodat de toestand die eerdere aanroepen opbouwen gelijk loopt
   met de opname. Wat hier bewaakt wordt is de VORM: wie meer wil borgen dan
   sleutels en gevuldheid schrijft alsnog een echte toets (de kaart is de
   vloer, niet het plafond).

   Draai los: node --experimental-sqlite --test test/inhoudswacht.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');
const { profielVan } = require('../scripts/inhoudskaart');

const KAART = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'INHOUDSKAART.json'), 'utf8'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-inhoud-'));

let BASE, child;
const tokens = {};

async function doe(methode, pad, lijf, tok) {
  const r = await fetch(BASE + pad, { method: methode,
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
    body: methode === 'GET' || methode === 'HEAD' ? undefined : JSON.stringify(lijf || {}) });
  let data = null; try { data = await r.json(); } catch (e) {}
  return { status: r.status, data };
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: {
    RTG_DATA_DIR: TMP, RTG_DEMO: '1', SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE-PROEF' } }));
  tokens.member = (await doe('POST', '/api/login', { tier: 'rtg' })).data.token;
  tokens.office = (await doe('POST', '/api/office/login', { code: 'RTG-OFFICE-PROEF' })).data.token;
  tokens.supplier = (await doe('POST', '/api/supplier/login', { username: 'rahul', password: 'Imran' })).data.token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* plausibelLijf komt uit dezelfde bron als waarmee de kaart is opgenomen:
   een ander lijf zou een ander antwoord uitlokken en de vorm laten afwijken
   om een reden die niets met de route te maken heeft (LAT.md regel 4). */
const { plausibelLijf } = require('../scripts/lib/rolproef');

const rij = Object.values(KAART.perRoute || {})
  .filter(p => !p.onwaarneembaar)
  .sort((a, b) => (a.methode + ' ' + a.pad).localeCompare(b.methode + ' ' + b.pad));

for (const p of rij) {
  test('vormcontract ' + p.methode + ' ' + p.pad, async () => {
    const uit = await doe(p.methode, p.pad, plausibelLijf(p.pad), tokens[p.rol]);
    assert.equal(uit.status, p.status,
      'de status hoort ' + p.status + ' te zijn (kaart), kreeg ' + uit.status +
      ': ' + JSON.stringify(uit.data).slice(0, 120));
    const nu = profielVan(uit.data);
    for (const s of p.sleutels) {
      assert.ok(nu.sleutels.includes(s),
        'sleutel "' + s + '" hoort in het antwoord (kaart); er kwam: ' + nu.sleutels.join(', '));
    }
    for (const d of p.dragend) {
      assert.ok(nu.dragend.includes(d),
        'veld "' + d + '" hoort dragend te zijn (niet leeg); het antwoord droeg: ' + nu.dragend.join(', '));
    }
  });
}

test('de kaart zelf is niet leeg en draagt alleen bewaakbare profielen', () => {
  assert.ok(rij.length >= 50, 'de wacht hoort tientallen routes te dekken, vond ' + rij.length);
  for (const p of rij) {
    assert.ok(p.sleutels.length, p.methode + ' ' + p.pad + ' heeft een leeg profiel; dan bewaakt dit niets');
    assert.ok(p.status !== 200 || p.sleutels.some(s => s !== 'ok'),
      p.methode + ' ' + p.pad + ' is niet van de leugen te onderscheiden en hoort onwaarneembaar te heten');
  }
});

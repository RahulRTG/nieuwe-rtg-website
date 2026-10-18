/* DE KASSA EN DE FACTUUR VAN EEN ZAAK BEVESTIGEN NIET WAT DE OPSLAG NOG NIET HEEFT.

   De schrijfproef mat onder `schrijf-verloren` twee geldroutes van de zaak als
   VALS_SUCCES: /api/supplier/pos/checkout (200, lasten gesloten -- en na de
   herstart weer open, terwijl een gast met RTG Pay al was afgeschreven) en
   /api/supplier/facturen/maak (200 met een factuurnummer dat nergens stond).
   Sinds 18 oktober 2026 lopen ze door een duurzame bundel: eenmaligVast() in
   kern/kassa/herhaling.js en boekVast() in kern/facturatie/motor.js.

   De vorm is die van de schrijfproef zelf: de wereld wordt EERLIJK opgezet (een
   open kamerrekening), daarna start dezelfde datamap opnieuw met het verraad.
   Een server die vanaf het begin liegt, kan geen rekening openen om af te
   rekenen -- dan meet de toets zijn opstelling in plaats van de route.

   Draai los: node --test test/zaakgeldduurzaam.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const MAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zgd-'));
const api = (base, pad, body, token) => fetch(base + '/api/' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const zaak = async (base) => {
  const s = await api(base, 'supplier/login', { username: 'rahul', password: 'Imran' });
  assert.ok(s.body.token, 'de demozaak hoort in te loggen: ' + JSON.stringify(s.body).slice(0, 160));
  return s.body.token;
};

let srv = null;
test.after(() => { stop(srv && srv.child); try { fs.rmSync(MAP, { recursive: true, force: true }); } catch (e) {} });

test('1. eerlijk: een kamerrekening openen, uitchecken en een factuur maken werkt', async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: MAP } });
  const tok = await zaak(srv.base);
  const bon = await api(srv.base, 'supplier/pos/sale', { total: 12.5, method: 'kamer', room: 'Kamer-eerlijk',
    items: [{ name: 'Ontbijt', qty: 1, price: 12.5 }], idem: 'zgd-bon-1' }, tok);
  assert.equal(bon.status, 200, JSON.stringify(bon.body).slice(0, 200));
  const uit = await api(srv.base, 'supplier/pos/checkout', { room: 'Kamer-eerlijk', method: 'contant', idem: 'zgd-uit-1' }, tok);
  assert.equal(uit.status, 200, JSON.stringify(uit.body).slice(0, 200));
  /* De await-controle: een niet-afgewachte belofte serialiseert naar `{}`. */
  assert.equal(uit.body.ok, true);
  const f = await api(srv.base, 'supplier/facturen/maak', { soort: 'dienst', koperNaam: 'Proef Koper',
    regels: [{ omschrijving: 'Consult', aantal: 1, stuk: 80 }] }, tok);
  assert.equal(f.status, 200, JSON.stringify(f.body).slice(0, 200));
  assert.match(String(f.body.factuur && f.body.factuur.nummer), /\d/);

  /* De wereld voor ronde 2: een OPEN kamerrekening, eerlijk vastgelegd. */
  const open = await api(srv.base, 'supplier/pos/sale', { total: 20, method: 'kamer', room: 'Kamer-verraad',
    items: [{ name: 'Diner', qty: 1, price: 20 }], idem: 'zgd-bon-2' }, tok);
  assert.equal(open.status, 200);
  stop(srv.child); srv = null;
});

test('2. onder een liegende opslag geven uitchecken en factureren geen 2xx', async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: MAP, RTG_VERRAAD: 'schrijf-verloren' } });
  const tok = await zaak(srv.base);
  const uit = await api(srv.base, 'supplier/pos/checkout', { room: 'Kamer-verraad', method: 'contant', idem: 'zgd-uit-2' }, tok);
  assert.equal(uit.status, 503, 'uitchecken over een opslag die niets bewaart is een vals succes: ' + uit.status);
  const f = await api(srv.base, 'supplier/facturen/maak', { soort: 'dienst', koperNaam: 'Proef Koper',
    regels: [{ omschrijving: 'Consult', aantal: 1, stuk: 80 }] }, tok);
  assert.equal(f.status, 503, 'een factuurnummer dat nergens staat is een vals succes: ' + f.status);
  /* En een weigering van het werk zelf blijft zijn eigen antwoord. */
  const geen = await api(srv.base, 'supplier/pos/checkout', { room: 'Bestaat-niet', method: 'contant', idem: 'zgd-uit-3' }, tok);
  assert.equal(geen.status, 404);
});

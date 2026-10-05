/* ============================================================================
   PAYROLL-BRONNEN EN SSRF -- regressie voor RTG-V1-RELEASE C5.

   DE FOUT: de payroll-bronlaag haalde een door het kantoor opgegeven adres op
   zonder filter op interne adressen, en volgde omleidingen. Een bron op
   169.254.169.254 (cloud-metadata) of 10.x liet de server zijn eigen netwerk
   uitlezen; een 302 naar binnen omzeilde elke controle op het eerste adres.

   DE FIX: ../server/kern/ssrf.js veiligeExternalUrl bij het registreren
   (dekking-bronnen.js) EN bij het ophalen (bijwerken.js urlBron, voor bronnen
   die van voor de fix in de opslag staan), plus redirect: 'error' en een
   tijdslimiet.

   Zonder de fix: interne adressen worden geregistreerd (200 i.p.v. 400), de
   ophaler wordt aangeroepen, en er gaat geen redirect-verbod mee.

   Draai los: node --test test/payroll-ssrf.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const maakBronnen = require('../server/kern/payroll/dekking-bronnen');
const { urlBron } = require('../server/kern/payroll/bijwerken');

function bronnen() {
  const db = { data: {} };
  const opslag = { bak: (n) => (db.data[n] = db.data[n] || {}) };
  return maakBronnen({ opslag, save: () => {}, tijd: () => '2026-10-05T00:00:00.000Z' });
}

const INTERN = [
  'https://169.254.169.254/latest/meta-data/',
  'https://127.0.0.1/regels.json',
  'https://10.0.0.5/regels.json',
  'https://192.168.1.10/regels.json',
  'https://[::1]/regels.json',
  'https://localhost/regels.json',
  'https://metadata.google.internal/computeMetadata/v1/',
];

test('1. een intern adres wordt niet als bron geregistreerd', () => {
  const b = bronnen();
  for (const url of INTERN) {
    const r = b.zetBron('NL', { naam: 'x', url }, 'A. Bakker');
    assert.equal(r.status, 400, url + ' hoort geweigerd te worden: ' + JSON.stringify(r));
  }
  assert.equal(b.bronnenVan('NL').length, 0, 'en er staat er geen enkele in de opslag');
});

test('2. een gewoon extern https-adres blijft gewoon werken', () => {
  const b = bronnen();
  assert.ok(b.zetBron('NL', { naam: 'Belastingdienst', url: 'https://regels.voorbeeld.nl/nl.json' }, 'A. Bakker').ok);
});

test('3. een bron met een intern adres in de opslag wordt bij het ophalen geweigerd (de ophaler wordt niet aangeroepen)', async () => {
  for (const url of INTERN) {
    let aangeroepen = false;
    const bron = urlBron({ url, fetchImpl: async () => { aangeroepen = true; return { ok: true, json: async () => ({}) }; } });
    await assert.rejects(() => bron.haal(), /geweigerd/, url);
    assert.equal(aangeroepen, false, url + ': de server mag dit adres nooit aanroepen');
  }
});

test('4. de ophaler volgt geen omleiding en heeft een tijdslimiet', async () => {
  let opties = null;
  const bron = urlBron({ url: 'https://regels.voorbeeld.nl/nl.json',
    fetchImpl: async (u, o) => { opties = o; return { ok: true, json: async () => ({ ok: 1 }) }; } });
  assert.deepEqual(await bron.haal(), { ok: 1 });
  assert.equal(opties.redirect, 'error', 'een 302 naar binnen omzeilt anders de adrescontrole');
  assert.ok(opties.signal, 'zonder tijdslimiet zet een zwijgende bron de ronde vast');
});

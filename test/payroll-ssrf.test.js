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

/* --- de herkeuring van C5 --------------------------------------------------- */
const { haalBron, keurBronUrl, MAX_BYTES } = require('../server/kern/payroll/bronophalen');

const OOK_INTERN = [
  'https://redis/regels.json', 'https://motor:3100/regels.json', 'https://postgres/regels.json',
  'https://localhost./regels.json', 'https://metadata.google.internal./computeMetadata/v1/',
  'http://regels.voorbeeld.nl/nl.json',
];

test('5. een naam van een label, een afsluitende punt en http worden overal geweigerd', async () => {
  const b = bronnen();
  for (const url of OOK_INTERN) {
    assert.equal(b.zetBron('NL', { naam: 'x', url }, 'A. Bakker').status, 400, url + ' bij het registreren');
    let aangeroepen = false;
    const bron = urlBron({ url, fetchImpl: async () => { aangeroepen = true; return { ok: true, json: async () => ({}) }; } });
    await assert.rejects(() => bron.haal(), /geweigerd/, url + ' bij het ophalen');
    assert.equal(aangeroepen, false, url + ': nooit aanroepen');
  }
  assert.equal(keurBronUrl('https://regels.voorbeeld.nl./nl.json'), null, 'een publiek domein met een afsluitende punt blijft gewoon een publiek domein');
});

test('6. de tijdslimiet breekt ook het LEZEN van een lijf af dat nooit eindigt', { timeout: 10000 }, async () => {
  const nooit = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{"a":')); }, pull() { return new Promise(() => {}); } });
  const begin = Date.now();
  await assert.rejects(() => haalBron('https://regels.voorbeeld.nl/nl.json', async () => new Response(nooit), 150),
    /niet binnen 150 ms/);
  assert.ok(Date.now() - begin < 5000, 'de limiet gaat ook af als de koppen er al zijn');
});

test('7. een antwoord boven de groottegrens wordt afgebroken', async () => {
  const blok = new Uint8Array(256 * 1024).fill(32);
  let gestuurd = 0;
  const groot = new ReadableStream({ pull(c) { gestuurd += blok.length; c.enqueue(blok); if (gestuurd > MAX_BYTES * 2) c.close(); } });
  await assert.rejects(() => haalBron('https://regels.voorbeeld.nl/nl.json', async () => new Response(groot)), /meer dan/);
  assert.ok(gestuurd <= MAX_BYTES + 2 * blok.length, 'er is gestopt met lezen, niet alles binnengehaald');
});

test('8. een gewoon antwoord via een echte stroom komt door', async () => {
  const r = await haalBron('https://regels.voorbeeld.nl/nl.json', async () => new Response('{"versie":"nl-2026.1"}'));
  assert.deepEqual(r, { versie: 'nl-2026.1' });
});

test('9. het PRODUCTIEPAD (urlBron) breekt een te groot antwoord ook af, en leest een BOM', async () => {
  /* Toetsen 6-8 roepen haalBron rechtstreeks aan. Zou urlBron terugvallen op een
     eigen fetch met r.json(), dan bleven die groen terwijl precies de hang en de
     ontbrekende grens van ronde 1 terug zijn (tweede herkeuring van C5). */
  const blok = new Uint8Array(256 * 1024).fill(32);
  let gestuurd = 0;
  const groot = new ReadableStream({ pull(c) { gestuurd += blok.length; c.enqueue(blok); if (gestuurd > MAX_BYTES * 2) c.close(); } });
  await assert.rejects(() => urlBron({ url: 'https://regels.voorbeeld.nl/nl.json', fetchImpl: async () => new Response(groot) }).haal(), /meer dan/);
  const metBom = urlBron({ url: 'https://regels.voorbeeld.nl/nl.json', fetchImpl: async () => new Response('﻿{"versie":"nl-2026.2"}') });
  assert.deepEqual(await metBom.haal(), { versie: 'nl-2026.2' });
});

test('10. een punt in de naam maakt nog geen publiek domein: interne netwerknamen worden geweigerd', () => {
  for (const url of ['https://redis.rtg_data/x.json', 'https://redis.rtg-data/x.json', 'https://REDIS.RTG_DATA./x.json',
    'https://motor.rtg_data:3100/x.json', 'https://db.internal/x.json',
    'https://nas.lan/x.json', 'https://printer.local/x.json', 'https://x.home.arpa/x.json']) {
    assert.match(String(keurBronUrl(url)), /publiek topdomein|privé|gereserveerd|eigen netwerk/, url);
  }
  for (const url of ['https://regels.voorbeeld.nl/nl.json', 'https://loontabel.voorbeeld.invalid/nl.json', 'https://xn--bcher-kva.example/x.json',
    'https://regels.voorbeeld.xn--p1ai/x.json', 'https://regels.voorbeeld.museum/x.json'])
    assert.equal(keurBronUrl(url), null, url + ' blijft gewoon mogen');
});

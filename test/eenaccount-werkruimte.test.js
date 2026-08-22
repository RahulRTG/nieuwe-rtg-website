/* Een inlog voor alles -- ook voor het RTG Werk OS.

   WAT HIER OP HET SPEL STAAT. Het huis heeft een sleutelbos: je registreert je
   een keer als RTG-lid, en elke werkrol (personeel, zaak, kantoor) is daarna
   een KOPPELING aan dat ene account. De werkruimtes van het Werk OS deden daar
   niet aan mee: die hielden hun eigen tweede inlog (werkruimtecode +
   lid-token). Wie zijn RTG-account er al aan gekoppeld had -- met beide
   sleutels in de hand, vanuit de werkruimte zelf -- moest daarna alsnog een
   tweede keer inloggen. De koppeling lag er, maar was maar een kant op
   leesbaar.

   Dit is de andere kant. En omdat het om een TOKEN gaat dat toegang geeft tot
   een organisatie, toetsen we niet alleen dat het werkt maar vooral waar het
   NIET mag werken:

   - zonder koppeling geen sleutel;
   - de sleutel draagt de eigen functie en de eigen organisatie, en twee
     werkruimtes blijven twee regels (de grens uit server/bedrijf/index.js);
   - een ander RTG-account krijgt het token niet;
   - uit dienst betekent meteen weg -- ook voor een lijst die een tel eerder
     is gelezen.

   Draai los: node --test test/eenaccount-werkruimte.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function versDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ewr-')); }

async function post(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

async function nieuwLid(base, naam) {
  const u = Math.random().toString(36).slice(2, 10);
  const r = await post(base, '/api/auth/register', { name: naam || 'Lid', email: 'l' + u + '@x.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1982-02-02', tier: 'rtg' });
  assert.ok(r.data.token, 'lid aangemeld: ' + JSON.stringify(r.data).slice(0, 200));
  return r.data.token;
}

/* Een werkruimte met een toegelaten medewerker. Levert de sleutels op die de
   losse inlog ook zou opleveren. */
async function werkruimteMetLid(base, bedrijf, functie) {
  const mk = await post(base, '/api/bedrijf/werkruimte/maak', { naam: bedrijf });
  assert.ok(mk.data.werkruimte, 'werkruimte gemaakt: ' + JSON.stringify(mk.data).slice(0, 200));
  const code = mk.data.werkruimte, beheerToken = mk.data.beheerToken;

  const aan = await post(base, '/api/bedrijf/lid/aanmeld', { werkruimte: code, naam: 'Jamie', functie });
  assert.ok(aan.data.lidToken, 'lid aangemeld bij de werkruimte');
  assert.equal(aan.data.status, 'wacht', 'en staat nog niet binnen');

  const toe = await post(base, '/api/bedrijf/lid/besluit',
    { werkruimte: code, beheerToken, lidId: aan.data.lidId, akkoord: true });
  assert.equal(toe.data.lid.status, 'actief', 'de werkruimte laat hem toe');

  return { code, beheerToken, lidId: aan.data.lidId, lidToken: aan.data.lidToken, naam: bedrijf };
}

const rollenVan = async (base, tok) => (await post(base, '/api/account/rollen', {}, tok)).data.rollen || [];
const werkRollen = (rollen) => rollen.filter(r => r.rol === 'werkruimte');

test('een gekoppelde werkruimte is een sleutel aan het ene account, met eigen functie en bedrijf', async () => {
  const TMP = versDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const lid = await nieuwLid(base);
    const wr = await werkruimteMetLid(base, 'Meridiaan Bouw B.V.', 'Controller');

    // 1) zonder koppeling geen sleutel -- ook al bestaat de werkruimte
    assert.deepEqual(werkRollen(await rollenVan(base, lid)), [],
      'een niet-gekoppelde werkruimte hoort niet aan de sleutelbos te hangen');

    // 2) koppelen doet de persoon zelf, vanuit de werkruimte, met BEIDE sleutels
    const kop = await post(base, '/api/bedrijf/lid/koppel',
      { werkruimte: wr.code, lidToken: wr.lidToken }, lid);
    assert.equal(kop.status, 200, 'koppelen lukt: ' + JSON.stringify(kop.data).slice(0, 200));

    // 3) nu hangt hij er wel, met zijn eigen functie en zijn eigen organisatie
    const na = werkRollen(await rollenVan(base, lid));
    assert.equal(na.length, 1, 'een werkruimte, een sleutel');
    assert.equal(na[0].code, wr.code);
    assert.equal(na[0].zaakNaam, 'Meridiaan Bouw B.V.', 'de organisatie staat erbij');
    assert.equal(na[0].naam, 'Controller', 'en de eigen functie');

    // 4) en openen gaat zonder tweede inlog: het account levert de werksessie
    const start = await post(base, '/api/account/start', { rol: 'werkruimte', code: wr.code }, lid);
    assert.equal(start.status, 200, 'starten lukt: ' + JSON.stringify(start.data).slice(0, 200));
    assert.equal(start.data.token, wr.lidToken, 'en levert precies de sleutel die hij al had');
    assert.equal(start.data.code, wr.code);

    // 5) die sleutel opent de werkruimte ook echt
    const mijn = await post(base, '/api/bedrijf/koppeling',
      { werkruimte: start.data.code, lidToken: start.data.token });
    assert.equal(mijn.status, 200, 'de geleverde sleutel werkt in de werkruimte');
    assert.equal(mijn.data.gekoppeld, true);
  } finally {
    await stop(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

test('twee werkruimtes blijven twee aparte sleutels, en een ander account krijgt er geen', async () => {
  const TMP = versDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const lid = await nieuwLid(base, 'Jamie');
    const vreemde = await nieuwLid(base, 'Iemand anders');

    const a = await werkruimteMetLid(base, 'Meridiaan Bouw B.V.', 'Controller');
    const b = await werkruimteMetLid(base, 'Noordkaap Zorg', 'Teamleider');
    await post(base, '/api/bedrijf/lid/koppel', { werkruimte: a.code, lidToken: a.lidToken }, lid);
    await post(base, '/api/bedrijf/lid/koppel', { werkruimte: b.code, lidToken: b.lidToken }, lid);

    const rollen = werkRollen(await rollenVan(base, lid));
    assert.equal(rollen.length, 2, 'twee organisaties, twee regels -- geen bundel');
    const perBedrijf = Object.fromEntries(rollen.map(r => [r.zaakNaam, r.naam]));
    assert.deepEqual(perBedrijf, { 'Meridiaan Bouw B.V.': 'Controller', 'Noordkaap Zorg': 'Teamleider' },
      'elk met zijn eigen functie');

    // de grens: het andere account ziet er niets van en krijgt geen sleutel
    assert.deepEqual(werkRollen(await rollenVan(base, vreemde)), [],
      'een ander RTG-account heeft hier niets te zoeken');
    const steel = await post(base, '/api/account/start', { rol: 'werkruimte', code: a.code }, vreemde);
    assert.notEqual(steel.status, 200, 'en krijgt het lid-token niet');
    assert.notEqual(steel.data.token, a.lidToken, 'echt niet');
  } finally {
    await stop(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

test('uit dienst trekt de sleutel meteen in, ook uit een lijst die al gelezen was', async () => {
  const TMP = versDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const lid = await nieuwLid(base);
    const wr = await werkruimteMetLid(base, 'Meridiaan Bouw B.V.', 'Controller');
    await post(base, '/api/bedrijf/lid/koppel', { werkruimte: wr.code, lidToken: wr.lidToken }, lid);

    // de lijst is gelezen; hierna gaat het lid uit dienst
    assert.equal(werkRollen(await rollenVan(base, lid)).length, 1, 'de sleutel hangt er');
    const uit = await post(base, '/api/bedrijf/lid/uit-dienst',
      { werkruimte: wr.code, beheerToken: wr.beheerToken, lidId: wr.lidId, reden: 'einde opdracht' });
    assert.equal(uit.status, 200, 'uit dienst: ' + JSON.stringify(uit.data).slice(0, 200));

    assert.deepEqual(werkRollen(await rollenVan(base, lid)), [], 'de sleutel is weg van de bos');
    const start = await post(base, '/api/account/start', { rol: 'werkruimte', code: wr.code }, lid);
    assert.notEqual(start.status, 200, 'en de deur gaat niet meer open');
  } finally {
    await stop(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

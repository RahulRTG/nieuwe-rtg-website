/* De terugvalcode van een supportbevestiging (service.balie_bevestigingscode),
   control voor control. De code BLIJFT zes cijfers -- een lid leest hem aan de
   telefoon voor -- en is daarom een verklaarde korte menscode: pas gemaakt als
   het lid hem opvraagt, een keer getoond, alleen als hash bewaard, gebonden aan
   EEN bevestiging van EEN zaak en EEN medewerker, geldig tot het verzoek
   verloopt, eenmalig, drie foute pogingen en drie keer opvragen, constant-time
   vergeleken, en geclaimd in de collectietransactie. Toets 9 draait tegen een
   ECHTE server; de raceproef over twee instances staat in
   test/codedeuren-claim.pg.test.js.

   Draai los: node --test test/service-bevestigingscode.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const REDEN = 'de operationele werkruimte reageert sinds gisteren niet';

function laag() {
  const db = { data: {}, writable: true };
  const save = () => {};
  const sleutels = [];
  let vergelijkingen = 0;
  const telCrypto = Object.assign(Object.create(crypto), {
    timingSafeEqual: (a, b) => { vergelijkingen++; return crypto.timingSafeEqual(a, b); } });
  const basis = require('../server/db/collectie-bewerken')({ store: 'json', db, save });
  const zaken = require('../server/kern/service/zaak')({ db, save, crypto });
  const machtigingen = require('../server/kern/service/machtiging')({ db, save, crypto, zaken, inzagelog: { noteerVast: async () => ({ ok: true }) } });
  const bev = require('../server/kern/service/bevestiging')({ db, save, crypto: telCrypto, zaken, machtigingen,
    bewerkCollectie: (s, w) => { sleutels.push(s); return basis(s, w); } });
  const zaak = (melder) => zaken.open({ melder: melder || 'user-7', onderwerp: 'zaak', titel: 'Werkruimte reageert niet' }).zaak;
  const vraag = (z, mens) => bev.vraag({ zaakId: z.id, mens: mens || 'nadia', capabilities: ['organisatie.stand'], reden: REDEN }).bevestiging;
  const rij = id => db.data.serviceBevestigingen.find(b => b.id === id);
  return { db, bev, machtigingen, zaak, vraag, rij, sleutels, tel: () => vergelijkingen, nul: () => { vergelijkingen = 0; } };
}

test('1. de code bestaat pas als het lid hem opvraagt, staat nergens anders en alleen als hash', async () => {
  const l = laag();
  const z = l.zaak();
  const v = l.vraag(z);
  assert.equal(l.rij(v.id).code_hash, null, 'bij het vragen bestaat er nog geen code');
  assert.equal('code' in l.rij(v.id), false, 'het verzoek draagt een kale code');
  const t = await l.bev.toon(v.id, { melder: 'user-7' });
  assert.match(t.code, /^\d{6}$/);
  assert.match(l.rij(v.id).code_hash, /^[a-f0-9]{64}$/);
  assert.equal('code' in l.rij(v.id), false, 'de kale code staat op de rij');
  for (const zicht of [l.bev.voorLid('user-7'), l.bev.lijst({ zaak: z.id })])
    assert.equal(JSON.stringify(zicht).includes('"code'), false, 'een overzicht draagt de code of de hash');
});

test('2. gebonden aan EEN bevestiging, EEN zaak en EEN medewerker', async () => {
  const l = laag();
  const a = l.zaak(), b = l.zaak();
  const va = l.vraag(a), vb = l.vraag(b);
  const code = (await l.bev.toon(va.id, { melder: 'user-7' })).code;
  assert.equal((await l.bev.metCode(code, { mens: 'nadia', zaak: b.id })).status, 404, 'de code van zaak A opende zaak B');
  assert.equal((await l.bev.metCode(code, { mens: 'joris', zaak: a.id })).status, 404, 'een collega gebruikte de code');
  assert.equal((await l.bev.metCode(code, { mens: 'nadia' })).status, 400, 'zonder zaak geen code');
  // de hash draagt het id van de bevestiging: overgeplakt naar een andere opent hij niets
  l.rij(vb.id).code_hash = l.rij(va.id).code_hash;
  assert.equal((await l.bev.metCode(code, { mens: 'nadia', zaak: b.id })).status, 404);
  assert.equal((await l.bev.toon(va.id, { melder: 'user-9' })).status, 403, 'een ander lid vraagt de code op');
});

test('3. geldig zolang het verzoek open staat, en daarna dicht', async () => {
  const l = laag();
  const z = l.zaak();
  const v = l.vraag(z);
  const code = (await l.bev.toon(v.id, { melder: 'user-7' })).code;
  assert.ok(Date.parse(v.tot) - Date.parse(v.at) <= 5 * 60000, 'langer dan vijf minuten');
  l.rij(v.id).tot = new Date(Date.now() - 1000).toISOString();
  assert.equal((await l.bev.metCode(code, { mens: 'nadia', zaak: z.id })).status, 404, 'een verlopen code opende iets');
  assert.equal((await l.bev.toon(v.id, { melder: 'user-7' })).status, 400, 'een verlopen verzoek geeft nog een code');
});

test('4. eenmalig, en de claim levert precies de gevraagde machtiging', async () => {
  const l = laag();
  const z = l.zaak();
  const v = l.vraag(z);
  const code = (await l.bev.toon(v.id, { melder: 'user-7' })).code;
  const r = await l.bev.metCode(code, { mens: 'nadia', zaak: z.id });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.machtiging.capabilities, ['organisatie.stand']);
  assert.equal(r.bevestiging.via, 'code');
  assert.equal(l.rij(v.id).code_hash, null, 'de hash bleef na gebruik staan');
  assert.equal((await l.bev.metCode(code, { mens: 'nadia', zaak: z.id })).status, 404, 'een tweede keer');
  assert.equal((await l.bev.bevestig(v.id, { melder: 'user-7' })).status, 400, 'en de knop daarna ook niet meer');
});

test('5. de rem: drie foute pogingen doden de code, en hooguit drie keer opvragen', async () => {
  const l = laag();
  const z = l.zaak();
  const v = l.vraag(z);
  const code = (await l.bev.toon(v.id, { melder: 'user-7' })).code;
  const fout = String((Number(code) + 1) % 1000000).padStart(6, '0');
  for (let i = 0; i < 3; i++) assert.equal((await l.bev.metCode(fout, { mens: 'nadia', zaak: z.id })).status, 404);
  assert.equal(l.rij(v.id).codePogingen, 3);
  assert.equal((await l.bev.metCode(code, { mens: 'nadia', zaak: z.id })).status, 404, 'na drie fouten werkte de juiste code nog');
  assert.equal((await l.bev.toon(v.id, { melder: 'user-7' })).status, 429, 'na drie fouten nog een nieuwe code');
  assert.equal((await l.bev.bevestig(v.id, { melder: 'user-7' })).ok, true, 'de knop in de app blijft werken');
  const v2 = l.vraag(z);
  for (let i = 0; i < 3; i++) assert.match((await l.bev.toon(v2.id, { melder: 'user-7' })).code, /^\d{6}$/);
  assert.equal((await l.bev.toon(v2.id, { melder: 'user-7' })).status, 429, 'een vierde keer opvragen');
});

test('6. opnieuw opvragen roteert, en weigeren trekt de code in', async () => {
  const l = laag();
  const z = l.zaak();
  const v = l.vraag(z);
  const eerste = (await l.bev.toon(v.id, { melder: 'user-7' })).code;
  let tweede = (await l.bev.toon(v.id, { melder: 'user-7' })).code;
  if (tweede === eerste) tweede = (await l.bev.toon(v.id, { melder: 'user-7' })).code;
  assert.equal((await l.bev.metCode(eerste, { mens: 'nadia', zaak: z.id })).status, 404, 'de vorige code werkt na opnieuw opvragen');
  const w = l.vraag(z, 'joris');
  const c = (await l.bev.toon(w.id, { melder: 'user-7' })).code;
  assert.equal((await l.bev.weiger(w.id, { melder: 'user-7' })).ok, true);
  assert.equal(l.rij(w.id).code_hash, null);
  assert.equal((await l.bev.metCode(c, { mens: 'joris', zaak: z.id })).status, 404, 'de code van een geweigerd verzoek');
});

test('7. constant-time: elk verzoek van deze medewerker bij deze zaak wordt vergeleken', async () => {
  // vijf open verzoeken van dezelfde medewerker bij dezelfde zaak, elk met een eigen code
  async function vijf() {
    const l = laag();
    const z = l.zaak();
    const v = l.vraag(z);
    for (let i = 1; i < 5; i++) l.db.data.serviceBevestigingen.push(Object.assign(JSON.parse(JSON.stringify(l.rij(v.id))), { id: 'BEV-KLOON' + i }));
    const ids = l.db.data.serviceBevestigingen.map(b => b.id);
    const codes = [];
    for (const id of ids) codes.push((await l.bev.toon(id, { melder: 'user-7' })).code);
    return { l, z, codes };
  }
  const tellingen = [];
  for (const positie of [0, 4]) {
    const { l, z, codes } = await vijf();
    l.nul();
    assert.equal((await l.bev.metCode(codes[positie], { mens: 'nadia', zaak: z.id })).ok, true);
    tellingen.push(l.tel());
  }
  const { l, z, codes } = await vijf();
  l.nul();
  const mis = codes.includes('000000') ? '999999' : '000000';
  assert.equal((await l.bev.metCode(mis, { mens: 'nadia', zaak: z.id })).status, 404);
  tellingen.push(l.tel());
  assert.deepEqual(tellingen, [5, 5, 5], 'de positie van de treffer bepaalt het aantal vergelijkingen');
  l.nul();
  assert.equal((await l.bev.metCode('12ab', { mens: 'nadia', zaak: z.id })).status, 400);
  assert.equal(l.tel(), 0);
});

test('8. de claim loopt in de collectietransactie, en een geweigerde machtiging geeft hem terug', async () => {
  const l = laag();
  const z = l.zaak();
  const v = l.vraag(z);
  const echt = l.machtigingen.verleen;
  l.machtigingen.verleen = () => ({ status: 409, error: 'gesimuleerd: de zaak verhuisde' });
  const r = await l.bev.bevestig(v.id, { melder: 'user-7' });
  assert.equal(r.status, 409);
  assert.equal(l.rij(v.id).gebruiktAt, null, 'de claim bleef staan terwijl er niets openging');
  l.machtigingen.verleen = echt;
  assert.equal((await l.bev.bevestig(v.id, { melder: 'user-7' })).ok, true);
  assert.ok(l.sleutels.length && l.sleutels.every(s => s === 'serviceBevestigingen'));
  const zonder = require('../server/kern/service/bevestiging')({ db: { data: {} }, save() {}, crypto,
    zaken: { vind: () => null }, machtigingen: {} });
  assert.equal((await zonder.metCode('123456', { mens: 'nadia', zaak: 'SUP-1' })).status, 503, 'zonder transactie geen claim');
});

test('9. echte server: het lid vraagt de code op, en de rem houdt over de routes', async () => {
  const geheim = require('../server/lib/eenmalig-geheim-routes');
  for (const r of ['/api/service/bevestiging/toon', '/api/supplier/service/bevestiging/toon'])
    assert.equal(geheim.isEenmalig('POST', r), true, r + ': geen antwoordcache mag deze kale code heronthullen');
  const srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  const p = async (pad, body, tok) => {
    const r = await fetch(srv.base + pad, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' },
      tok ? { Authorization: 'Bearer ' + tok } : {}), body: JSON.stringify(body || {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  try {
    const lid = (await p('/api/auth/register', { name: 'Code Lid', email: 'bevcode' + Date.now() + '@x.nl',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' })).body.token;
    const balie = await kantoorAlsPersoon(srv.base);
    const z = (await p('/api/service/open', { onderwerp: 'zaak', titel: 'Mijn werkruimte reageert niet' }, lid)).body.zaak;
    const v = await p('/api/office/service/bevestiging/vraag', { id: z.id, capabilities: ['organisatie.stand'], reden: REDEN }, balie);
    assert.equal(v.status, 200, JSON.stringify(v.body));
    assert.equal((await p('/api/service/bevestiging/toon', { id: v.body.bevestiging.id })).status, 401, 'zonder sessie');
    const t = await p('/api/service/bevestiging/toon', { id: v.body.bevestiging.id }, lid);
    assert.equal(t.status, 200, JSON.stringify(t.body));
    const fout = String((Number(t.body.code) + 1) % 1000000).padStart(6, '0');
    for (let i = 0; i < 3; i++)
      assert.equal((await p('/api/office/service/bevestiging/code', { id: z.id, code: fout }, balie)).status, 404);
    assert.equal((await p('/api/office/service/bevestiging/code', { id: z.id, code: t.body.code }, balie)).status, 404,
      'na drie foute pogingen opende de juiste code nog');
    assert.equal((await p('/api/service/bevestiging/toon', { id: v.body.bevestiging.id }, lid)).status, 429);
    assert.equal((await p('/api/service/bevestig', { id: v.body.bevestiging.id }, lid)).status, 200, 'de knop blijft');
  } finally { await stop(srv); }
});

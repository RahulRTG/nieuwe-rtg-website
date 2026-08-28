/* De noodkaart (kern/noodkaart.js): het kleinste beetje dat een vreemde over u
   moet weten als u het zelf niet kunt vertellen.

   Twee dingen worden hier vastgezet, en het zijn allebei grenzen:

   1. HIJ DUPLICEERT UW ZORGPROFIEL NIET. Allergenen worden GELEZEN uit
      kern/gastzorg.js. Haalt u er een weg, dan staat hij ook niet meer op de
      kaart -- een kopie zou in een ambulance een allergie tonen die u vorig
      jaar hebt geschrapt.
   2. NIEMAND KAN HEM OPVRAGEN. Er is geen route waarmee een zaak of een kantoor
      de noodkaart van een lid ophaalt. U toont hem zelf.
   Draai los: node --test test/noodkaart.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, lid2, sup;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-nood-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'KIKUNOI' } });
  base = srv.base;
  const login = tier => fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier }) }).then(r => r.json()).then(d => d.token);
  lid = await login('rtg');
  lid2 = await login('business');
  sup = (await api('supplier/login', { username: 'rahul', password: 'Imran' }, '')).body.token;
  assert.ok(lid && lid2 && sup);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een verse kaart is leeg en staat uit, en zegt wie hem kan opvragen', async () => {
  const r = await api('noodkaart', {}, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.kaart.aan, false, 'niets staat aan tot u het aanzet');
  assert.equal(r.body.kaart.contactNaam, '');
  assert.deepEqual(r.body.kaart.allergenen, []);
  assert.match(r.body.uitleg, /niemand kan hem op afstand opvragen/i,
    'het scherm leest zelf dat dit geen dossier is dat iemand kan bevragen');
});

test('het zorgprofiel wordt GELEZEN, niet gekopieerd', async () => {
  await api('zorgprofiel/zet', { allergenen: ['noten', 'penicilline'], dieet: '',
    medisch: 'bloedverdunner', delen: false }, lid);
  await api('noodkaart/zet', { contactNaam: 'Mijn zus', contactTel: '0612345678',
    watNodig: 'Ik gebruik een bloedverdunner', zorgErbij: true, aan: true }, lid);

  const kaart = (await api('noodkaart', {}, lid)).body.kaart;
  assert.equal(kaart.aan, true);
  assert.equal(kaart.contactNaam, 'Mijn zus');
  assert.deepEqual(kaart.allergenen, ['noten', 'penicilline']);
  assert.equal(kaart.medisch, 'bloedverdunner');

  /* De harde bewering: haal er een allergie af, en hij staat ook niet meer op de
     kaart. Bij een kopie zou hij daar blijven staan -- en dat is precies het
     soort fout dat je in een ambulance niet wilt. */
  await api('zorgprofiel/zet', { allergenen: ['noten'], dieet: '', medisch: '', delen: false }, lid);
  const na = (await api('noodkaart', {}, lid)).body.kaart;
  assert.deepEqual(na.allergenen, ['noten'], 'de kaart volgt het profiel');
  assert.equal(na.medisch, '', 'ook als er iets af gaat');
  assert.equal(na.contactNaam, 'Mijn zus', 'en wat WEL van de kaart zelf is, blijft staan');
});

test('het zorgprofiel er af zetten haalt het van de kaart, niet uit het profiel', async () => {
  await api('noodkaart/zet', { zorgErbij: false }, lid);
  const kaart = (await api('noodkaart', {}, lid)).body.kaart;
  assert.deepEqual(kaart.allergenen, [], 'niet meer op de kaart');

  const profiel = (await api('zorgprofiel', {}, lid)).body.zorg;
  assert.deepEqual(profiel.allergenen, ['noten'], 'maar uw profiel staat er nog gewoon');
});

test('niemand kan de kaart van een ander opvragen', async () => {
  /* Er is geen route die dat kan; dat is de opzet. Wat hier wordt vastgezet is
     dat de bestaande routes hem ook niet lekken: een tweede lid krijgt zijn
     eigen (lege) kaart, en een zaak-sessie komt er helemaal niet in. */
  const ander = (await api('noodkaart', {}, lid2)).body.kaart;
  assert.equal(ander.contactNaam, '', 'lid2 ziet zijn eigen lege kaart, niet die van lid');
  assert.equal(ander.aan, false);

  assert.equal((await api('noodkaart', {}, sup)).status, 401,
    'een zaak-sessie opent de noodkaart-deur niet');
  assert.equal((await api('noodkaart', {}, '')).status, 401);
});

test('de deur luistert alleen naar de sessie, niet naar wat de aanvrager meestuurt', async () => {
  /* De vorige toets liet een gat: hij stuurde nooit een sleutel MEE. Een route
     die `body.key` zou accepteren, kwam er ongezien doorheen -- en bij echte
     accounts is die sleutel `user-<id>`, dus raadbaar. Dat wordt hier nagespeeld
     met twee echte accounts: A zet een kaart, B probeert hem op te halen door de
     sleutel van A te raden. */
  const reg = velden => fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(velden) })
    .then(r => r.json());
  const a = await reg({ name: 'Nood A', email: 'nood-a@x.nl', phone: '0612300001',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  const b = await reg({ name: 'Nood B', email: 'nood-b@x.nl', phone: '0612300002',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(a.token && b.token, 'twee echte accounts nodig; sessie-sleutel is dan user-<id>');

  await api('noodkaart/zet', { contactNaam: 'Geheime buurvrouw', aan: true }, a.token);

  for (let i = 1; i <= 6; i++) {
    const r = await api('noodkaart', { key: 'user-' + i }, b.token);
    assert.notEqual(r.body.kaart && r.body.kaart.contactNaam, 'Geheime buurvrouw',
      'B raadt de sleutel van A en krijgt zijn kaart NIET; de deur leest alleen req.session.key');
  }
  /* En andersom: A ziet zijn eigen kaart nog gewoon, dus de toets faalt niet
     omdat de kaart per ongeluk nergens meer staat. */
  assert.equal((await api('noodkaart', {}, a.token)).body.kaart.contactNaam, 'Geheime buurvrouw');
});

test('de kaart is kort te houden en helemaal weg te gooien', async () => {
  const lang = 'x'.repeat(400);
  await api('noodkaart/zet', { watNodig: lang }, lid);
  const kaart = (await api('noodkaart', {}, lid)).body.kaart;
  assert.ok(kaart.watNodig.length <= 200,
    'een kaart met een halve levensloop erop is onleesbaar op het moment dat lezen moeilijk is');

  assert.equal((await api('noodkaart/weg', {}, lid)).status, 200);
  const na = (await api('noodkaart', {}, lid)).body.kaart;
  assert.equal(na.contactNaam, '');
  assert.equal(na.aan, false);
  assert.equal((await api('noodkaart/weg', {}, lid)).status, 404, 'en wat weg is, is weg');
});

test('de noodkaart staat op het toestemmingsscherm bij wat er NIET onder valt', async () => {
  /* Hij hoort daar, en niet in de lijst zelf: er valt niets in te trekken omdat
     er niemand is die hem kan opvragen. Zonder die regel zou een lezer denken
     dat we hem vergeten zijn. */
  const d = (await api('toestemming', {}, lid)).body;
  const rij = d.nietGedekt.find(x => /noodkaart/i.test(x.naam));
  assert.ok(rij, 'de noodkaart staat bij wat dit scherm niet dekt');
  assert.match(rij.reden, /toont u zelf/i);
  assert.ok(!d.toestemmingen.some(t => /nood/i.test(t.laag || '')),
    'en niet als toestemming, want er is er geen');
});

/* No-Lost-Child: de bewaking van opvolging.

   De beloftes die hier hard worden gemaakt:

   - de bewaking ziet de TEKST van een melding niet. Ze bewaakt dat er opvolging
     is; wat er aan de hand is beoordeelt ze nooit;
   - een melding die niemand oppakt verdwijnt niet stil maar escaleert. Acuut na
     twee uur, anders na een schooldag;
   - de escalatie bij de directie draagt geen naam en geen tekst: een
     vertrouwelijke melding is juist bedoeld voor als het thuis niet veilig is,
     en die route mag niet alsnog opengaan omdat er niemand reageerde;
   - de drempel blijft laag: na de knop hooguit twee keuzes, allebei met "maakt
     niet uit" erbij, en allebei een wens en geen opdracht;
   - afronden doet een mens met zijn naam, en kan niet zonder dat iemand keek.
   Draai los: node --experimental-sqlite --test test/opvolging.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const { stand, fase, TERMIJN, VOLGENDE } = require('../server/kern/opvolging');
const { escalatieVan } = require('../server/school/opvolging');

let srv, base, sch, leraar, klas, gezin, kind, kindToken;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-opvolg-'));
const fnd = (pad, body) => fetch(base + '/api/foundation' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const kl = (pad, body) => fnd(pad, Object.assign({ klasCode: klas.code,
  personeelToken: leraar.personeelToken, schoolCode: sch.schoolCode }, body || {}));
const kindje = (pad, body) => fnd(pad, Object.assign({ code: gezin.code, token: kindToken, klasCode: klas.code }, body || {}));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  sch = (await fnd('/school/school/maak', { naam: 'De Ark', plaats: 'Delft' })).body;
  const kantoor = await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'RTG-OFFICE' }) }).then(r => r.json());
  await fetch(base + '/api/office/school/decide', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kantoor.token },
    body: JSON.stringify({ code: sch.schoolCode, action: 'goedkeuren' }) });
  leraar = (await fnd('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Mentor Vera', rol: 'leraar' })).body;
  await fnd('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken,
    personeelId: leraar.personeelId, akkoord: true });
  klas = (await fnd('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken,
    naam: '2B', trap: 'vo', fase: 'havo' })).body;
  gezin = (await fnd('/gezin/maak', { gezinsnaam: 'Familie Ark', naam: 'Ouder Ark', pin: '4321' })).body;
  kind = (await fnd('/gezin/profiel/maak', { code: gezin.code, token: gezin.token, naam: 'Nour', rol: 'kind', groep: 'kind' })).body;
  kindToken = (await fnd('/gezin/profiel/kies', { code: gezin.code, profielId: kind.profiel.id })).body.token;
  await fnd('/school/koppel', { code: gezin.code, token: gezin.token, klasCode: klas.code, profielId: kind.profiel.id });
  await fnd('/school/uitnodiging/antwoord', { code: gezin.code, token: kindToken, klasCode: klas.code, akkoord: true });
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------- de bewaking los: hier zit de grens ---------- */
test('de bewaking kijkt naar de keten en nooit naar de inhoud', () => {
  const nu = '2026-08-19T12:00:00.000Z';
  const uur = (n) => new Date(Date.parse(nu) - n * 3600000).toISOString();

  // acuut: na twee uur zonder dat iemand keek, escaleert het
  assert.equal(stand({ acuut: true, at: uur(1) }, nu).escaleert, false);
  const laat = stand({ acuut: true, at: uur(3) }, nu);
  assert.equal(laat.escaleert, true);
  assert.equal(laat.ernst, 'hoog');
  assert.match(laat.wacht, /nog niemand naar deze melding gekeken/i);

  // gewoon: een schooldag
  assert.equal(stand({ acuut: false, at: uur(20) }, nu).escaleert, false);
  assert.equal(stand({ acuut: false, at: uur(30) }, nu).escaleert, true);

  // zodra iemand keek, stopt de klok -- ook al is er verder nog niets gebeurd
  assert.equal(stand({ acuut: true, at: uur(48), gezienAt: uur(47) }, nu).escaleert, false);
  // maar heel lang open zonder afronden is ook een signaal, en een zachter
  assert.equal(stand({ acuut: false, at: uur(24 * 20), gezienAt: uur(24 * 19) }, nu).ernst, 'midden');
  // afgerond is af
  assert.equal(stand({ acuut: true, at: uur(500), afgerondAt: uur(1) }, nu).escaleert, false);

  /* De grens zelf: de bewaking krijgt vier dingen en de tekst hoort daar niet
     bij. Zou ze die wel wegen, dan gaat ze beoordelen wat er aan de hand is --
     precies wat ze nooit mag.

     Het moment is met zorg gekozen: DRIE UUR en niet acuut. Zonder inhoud is
     dat ruim binnen de schooldag en gebeurt er niets; met een woord als
     "geslagen" erin zou een wegende bewaking het als acuut behandelen en al
     escaleren. Op dertig uur komen beide varianten hetzelfde uit, en dan
     bewijst de vergelijking niets. */
  const zwaar = { acuut: false, at: uur(3), tekst: 'ik word thuis geslagen', naam: 'Nour' };
  const kaal = { acuut: false, at: uur(3) };
  assert.equal(stand(kaal, nu).escaleert, false);
  assert.deepEqual(stand(zwaar, nu), stand(kaal, nu), 'de inhoud verandert het oordeel van de bewaking');
  assert.equal(TERMIJN.acuut < TERMIJN.gewoon, true);
});

test('de keten loopt van gevraagd naar afgerond, en de volgende stap staat erbij', () => {
  assert.equal(fase({}), 'gevraagd');
  assert.equal(fase({ toegewezen: { naam: 'Vera' } }), 'toegewezen');
  assert.equal(fase({ toegewezen: {}, gezienAt: 'x' }), 'gezien');
  assert.equal(fase({ gezienAt: 'x', afspraak: {} }), 'afspraak');
  assert.equal(fase({ gezienAt: 'x', afspraak: {}, afgerondAt: 'y' }), 'afgerond');
  assert.equal(VOLGENDE.afgerond, null, 'na afgerond hoeft er niets meer');
  for (const f of ['gevraagd', 'toegewezen', 'gezien', 'afspraak'])
    assert.ok(VOLGENDE[f].length > 20, 'de stap ' + f + ' zegt niet wat er nu moet');
});

/* ---------- en door de machine heen ---------- */
test('na de knop zijn er hooguit twee keuzes, allebei vrijblijvend', async () => {
  const m = await kindje('/school/hulplijn', { tekst: 'ik wil iemand spreken', acuut: false });
  assert.equal(m.status, 200);
  const id = m.body.melding.id;

  const w = await kindje('/school/hulplijn/wens', { id, wanneer: 'deze-week', vanWie: 'mentor' });
  assert.equal(w.status, 200);
  assert.deepEqual(w.body.wens, { wanneer: 'deze-week', vanWie: 'mentor' });
  assert.match(w.body.uitleg, /hoeft verder niets in te vullen/i);

  // onzin valt terug op "maakt niet uit" in plaats van een foutmelding: een kind
  // dat om hulp vraagt hoort geen formulierfout te krijgen
  const raar = await kindje('/school/hulplijn/wens', { id, wanneer: 'volgend-jaar', vanWie: 'de-koning' });
  assert.equal(raar.status, 200);
  assert.deepEqual(raar.body.wens, { wanneer: 'maakt-niet-uit', vanWie: 'maakt-niet-uit' });
});

test('afronden kan niet zonder dat iemand keek, en niet zonder naam', async () => {
  const id = (await kindje('/school/hulplijn', { tekst: 'even praten' })).body.melding.id;

  assert.equal((await kl('/school/hulplijn/afronden', { id, door: 'Mentor Vera' })).status, 409);
  assert.equal((await kl('/school/hulplijn/afspraak', { id, wanneer: 'morgen', metWie: 'Vera' })).status, 409);

  const toe = await kl('/school/hulplijn/toewijzen', { id, mentor: 'Mentor Vera' });
  assert.equal(toe.status, 200);
  await kl('/school/hulplijn/oppakken', { id, notitie: 'gebeld' });

  assert.equal((await kl('/school/hulplijn/afronden', { id })).status, 400, 'afronden zonder naam');
  const af = await kl('/school/hulplijn/afronden', { id, door: 'Mentor Vera', notitie: 'gesprek geweest' });
  assert.equal(af.status, 200);
  assert.match(af.body.uitleg, /wist niets/i, 'afronden hoort niets weg te gooien');

  const b = (await kl('/school/hulplijn/bewaking')).body;
  const rij = b.meldingen.find(x => x.id === id);
  assert.equal(rij.fase, 'afgerond');
  assert.equal(rij.escaleert, false);
  assert.equal(rij.volgende, null);
});

/* De zwaarste grens van dit deel, en hij wordt op de VORM gemeten. Via de
   machine lukt dat niet: een verse melding escaleert nog niet, dus die lijst is
   leeg en bewijst niets -- precies de valkuil waar een toets in trapt die er
   met een doesNotMatch overheen loopt. */
test('een escalatie draagt geen naam, geen tekst en geen sleutel', () => {
  const klas = { naam: '2B', code: 'K42' };
  const melding = { id: 'm1', acuut: true, vertrouwelijk: true, sleutel: 'G1:p2', naam: 'Nour',
    tekst: 'ik word gepest en durf het thuis niet te zeggen', at: '2026-08-19T06:00:00.000Z' };
  const st = stand(melding, '2026-08-19T12:00:00.000Z');
  assert.equal(st.escaleert, true);

  const rij = escalatieVan(klas, melding, st);
  assert.deepEqual(Object.keys(rij).sort(),
    ['acuut', 'ernst', 'fase', 'klas', 'klasCode', 'urenOpen', 'volgende', 'wacht'],
    'de vorm van een escalatie is veranderd; kijk of er iets bij zit dat naar een kind wijst');
  assert.doesNotMatch(JSON.stringify(rij), /Nour|gepest|G1:p2|m1/, 'de escalatie wijst terug naar het kind');
  assert.equal(rij.klas, '2B', 'de klas moet er wel in: daar moet iemand heen bellen');
  assert.equal(rij.acuut, true);
  assert.ok(rij.urenOpen >= 6);
});

test('de escalatie bij de directie vertelt dat er iets ligt, niet wat', async () => {
  const id = (await kindje('/school/hulplijn', { tekst: 'ik word gepest en durf het thuis niet te zeggen',
    acuut: true, vertrouwelijk: true })).body.melding.id;
  await kindje('/school/hulplijn/wens', { id, wanneer: 'vandaag' });

  // in de KLAS ziet de mentor hem gewoon: dat is de vertrouwenspersoon-route
  const b = (await kl('/school/hulplijn/bewaking')).body;
  const rij = b.meldingen.find(x => x.id === id);
  assert.ok(rij, 'de mentor ziet zijn eigen melding');
  assert.equal(rij.fase, 'gevraagd');
  assert.equal(rij.vertrouwelijk, true);
  assert.deepEqual(rij.wens, { wanneer: 'vandaag', vanWie: 'maakt-niet-uit' });
  assert.match(rij.volgende, /mentor toe/i);

  // en de directie krijgt een lijst die nergens naar een kind wijst
  const d = await fnd('/school/directie/bewaking', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken });
  assert.equal(d.status, 200);
  assert.doesNotMatch(JSON.stringify(d.body), /gepest|Nour/i);
  assert.match(d.body.uitleg, /niet wat of van wie/i);
  assert.match(d.body.uitleg, /ga hem niet openen/i);
});

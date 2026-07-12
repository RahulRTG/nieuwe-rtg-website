/* Integratietests voor RTF School (het schoolkanaal, "slimmer dan Magister"):
   klas maken en koppelen, rooster, huiswerk (afvinken), cijfers (afgeschermd per
   gezin), mededelingen, ziekmelden in één tik en de gezinsbrede berichtendraad
   met de leraar. Draait tegen een echte server in een tijdelijke datamap.
   Draai los: node --experimental-sqlite --test test/school.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 3700 + Math.floor(Math.random() * 80);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-school-'));
let child;

function api(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
const json = r => r.json();

test.before(async () => {
  child = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + '/api/foundation/health'); if (r.ok) return; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server startte niet op tijd');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

// hulp: een klas + een gezin met een gekoppeld kind
async function opzet(naam) {
  const klas = await json(await api('/school/klas/maak', { naam: 'Groep 8', leraar: 'Juf ' + naam, school: 'De Regenboog' }));
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Fam ' + naam, naam: 'Ouder ' + naam, pin: '1234' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kind ' + naam, rol: 'kind', groep: 'kind' }));
  const kindToken = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  const kop = await json(await api('/school/koppel', { code: g.code, token: g.token, klasCode: klas.code, profielId: kind.profiel.id }));
  assert.ok(kop.ok, 'koppelen lukt');
  return { klas, g, kindId: kind.profiel.id, kindToken, sleutel: g.code + ':' + kind.profiel.id };
}
const lr = (klas, pad, body) => api(pad, Object.assign({ klasCode: klas.code, leraarToken: klas.leraarToken }, body || {}));

test('klas maken, koppelen en het mijn-school-overzicht', async () => {
  const { klas, g, kindId, kindToken } = await opzet('Aa');
  // verkeerde token komt er niet in
  assert.equal((await api('/school/klas', { klasCode: klas.code, leraarToken: 'fout' })).status, 403);
  // een kind kan niet zelf (zichzelf of een ander) aan een klas koppelen
  assert.equal((await api('/school/koppel', { code: g.code, token: kindToken, klasCode: klas.code, profielId: kindId })).status, 403);
  // de leraar ziet de leerling
  const kd = await json(await lr(klas, '/school/klas'));
  assert.equal(kd.leerlingen.length, 1);
  // het gezin ziet de klas in het overzicht
  const mijn = await json(await api('/school/mijn', { code: g.code, token: g.token }));
  assert.equal(mijn.school.length, 1);
  assert.equal(mijn.school[0].klas.code, klas.code);
  assert.equal(mijn.school[0].kind.profielId, kindId);
});

test('rooster, huiswerk opgeven en afvinken, en de AI-brugvelden', async () => {
  const { klas, g, kindId, kindToken } = await opzet('Bb');
  await lr(klas, '/school/rooster/zet', { rooster: [
    { dag: 'ma', van: '08:30', tot: '09:15', vak: 'Rekenen', lokaal: 'lokaal 3' },
    { dag: 'zz', van: 'x', tot: 'y', vak: 'Onzin' } // ongeldige dag wordt genegeerd
  ]});
  const hw = await json(await lr(klas, '/school/huiswerk/maak', { titel: 'H4 lezen', vak: 'Taal', deadline: '2026-09-01', omschrijving: 'Blz 40 tot 45' }));
  assert.ok(hw.ok);

  const mijn = await json(await api('/school/mijn', { code: g.code, token: kindToken }));
  const x = mijn.school[0];
  assert.equal(x.rooster.length, 1, 'alleen de geldige roosterregel blijft');
  assert.equal(x.huiswerk.length, 1);
  assert.equal(x.huiswerk[0].af, false);

  // het kind vinkt het huiswerk af; de leraar ziet dat
  await api('/school/huiswerk/af', { code: g.code, token: kindToken, klasCode: klas.code, huiswerkId: x.huiswerk[0].id });
  const kd = await json(await lr(klas, '/school/klas'));
  assert.equal(kd.huiswerk[0].afDoor.length, 1, 'de leraar ziet wie het af heeft');
  const na = await json(await api('/school/mijn', { code: g.code, token: kindToken }));
  assert.equal(na.school[0].huiswerk[0].af, true);
});

test('cijfers: het gezin ziet alleen de cijfers van het eigen kind', async () => {
  const A = await opzet('Cc');
  // een tweede gezin in dezelfde klas
  const g2 = await json(await api('/gezin/maak', { gezinsnaam: 'Fam Cc2', naam: 'Ouder Cc2', pin: '5678' }));
  const kind2 = await json(await api('/gezin/profiel/maak', { code: g2.code, token: g2.token, naam: 'Kind Cc2', rol: 'kind', groep: 'kind' }));
  await api('/school/koppel', { code: g2.code, token: g2.token, klasCode: A.klas.code, profielId: kind2.profiel.id });

  await lr(A.klas, '/school/cijfer/geef', { leerling: A.sleutel, vak: 'Rekenen', cijfer: 8.5, omschrijving: 'Toets H4' });
  await lr(A.klas, '/school/cijfer/geef', { leerling: g2.code + ':' + kind2.profiel.id, vak: 'Rekenen', cijfer: 6, omschrijving: 'Toets H4' });
  // ongeldig cijfer wordt geweigerd
  assert.equal((await lr(A.klas, '/school/cijfer/geef', { leerling: A.sleutel, vak: 'X', cijfer: 12 })).status, 400);

  const mijnA = await json(await api('/school/mijn', { code: A.g.code, token: A.g.token }));
  assert.equal(mijnA.school[0].cijfers.length, 1, 'gezin A ziet precies een cijfer');
  assert.equal(mijnA.school[0].cijfers[0].cijfer, 8.5);
  const mijnB = await json(await api('/school/mijn', { code: g2.code, token: g2.token }));
  assert.equal(mijnB.school[0].cijfers.length, 1, 'gezin B ziet alleen zijn eigen cijfer');
  assert.equal(mijnB.school[0].cijfers[0].cijfer, 6);
});

test('ziekmelden in één tik: alleen een ouder, geen dubbele melding, leraar handelt af', async () => {
  const { klas, g, kindId, kindToken } = await opzet('Dd');
  // het kind zelf mag niet ziekmelden
  assert.equal((await api('/school/ziekmelden', { code: g.code, token: kindToken, klasCode: klas.code, profielId: kindId })).status, 403);
  // de ouder wel
  assert.equal((await api('/school/ziekmelden', { code: g.code, token: g.token, klasCode: klas.code, profielId: kindId, reden: 'koorts' })).status, 200);
  // niet twee keer op dezelfde dag
  assert.equal((await api('/school/ziekmelden', { code: g.code, token: g.token, klasCode: klas.code, profielId: kindId })).status, 409);
  // de leraar ziet hem en handelt af
  const kd = await json(await lr(klas, '/school/klas'));
  assert.equal(kd.absenties.length, 1);
  assert.match(kd.absenties[0].reden, /koorts/);
  await lr(klas, '/school/absentie/afhandelen', { id: kd.absenties[0].id });
  const kd2 = await json(await lr(klas, '/school/klas'));
  assert.equal(kd2.absenties.length, 0, 'na afhandelen is de melding weg uit de open lijst');
});

test('berichten: gezinsbrede draad met de leraar; ouder leest mee met wat het kind schrijft', async () => {
  const { klas, g, kindId, kindToken } = await opzet('Ee');
  // het kind schrijft de leraar
  await api('/school/bericht/gezin', { code: g.code, token: kindToken, klasCode: klas.code, tekst: 'Ik snap som 4 niet' });
  // de leraar ziet de draad en antwoordt
  const kd = await json(await lr(klas, '/school/klas'));
  assert.equal(kd.berichten.length, 1);
  const sleutel = kd.berichten[0].sleutel;
  await lr(klas, '/school/bericht/leraar', { leerling: sleutel, tekst: 'Kom morgen even langs, dan leg ik het uit.' });
  // de OUDER leest dezelfde draad (geen privekanaal leraar-kind)
  const draad = await json(await api('/school/bericht/gezin', { code: g.code, token: g.token, klasCode: klas.code, profielId: kindId }));
  assert.equal(draad.berichten.length, 2, 'de ouder ziet het bericht van het kind EN het antwoord van de leraar');
  assert.ok(draad.berichten.some(b => /som 4/.test(b.tekst)));
  assert.ok(draad.berichten.some(b => b.van === 'leraar'));
});

test('mededeling van de leraar bereikt het gezin', async () => {
  const { klas, g } = await opzet('Ff');
  await lr(klas, '/school/mededeling', { tekst: 'Vrijdag ouderavond om 19:00.' });
  const mijn = await json(await api('/school/mijn', { code: g.code, token: g.token }));
  assert.ok(mijn.school[0].mededelingen.some(m => /ouderavond/.test(m.tekst)));
});

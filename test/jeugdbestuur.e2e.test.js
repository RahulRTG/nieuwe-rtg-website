/* HET JEUGDBESTUUR OVER HTTP -- kan een talent van zestien iemand naast zich
   zetten zonder dat hij iets tekent wat hij niet leest?

   Dit is CARRIERE.md par. 6 nummer 7. De weigering die het vervangt was eerlijk
   maar liep dood: "dat jeugdbestuur is nog niet gebouwd". In de sport en de
   muziek is dat juist de groep waar het misgaat.

   WAT DEZE SUITE VASTLEGT, en waarom elk stuk nodig is:

   1. EEN VOOGD COMPENSEERT LEEFTIJD, NOOIT ONBEKENDE IDENTITEIT. Zolang RTG het
      document niet heeft gezien, staat de geboortedatum zoals het lid hem zelf
      intypte -- dan weten we niet eens DAT hij minderjarig is, en een voogd
      aanwijzen is een gok met een handtekening eraan.
   2. DRIE PARTIJEN, DRIE HANDELINGEN. De jongere wijst aan, de volwassene
      aanvaardt de rol, en pas een MENS van RTG bevestigt. Na stap 2 mag er nog
      steeds niets: anders wijst een zestienjarige zijn negentienjarige vriend
      aan en tekenen er twee kinderen.
   3. DE JONGERE ALLEEN IS NIET GENOEG. Dit is de kern van het hele bestuur: na
      zijn eigen handtekening staat de machtiging nog op `voorgesteld`.
   4. EN DE VOOGD ALLEEN OOK NIET -- hij kan niet vooraf tekenen. Een voogd die
      eerst tekent, zet de jongere voor een voldongen feit (LEVEN.md par. 2:
      nooit sturen maar openen).
   5. DE VOOGD KAN NIET OOK DE VERTEGENWOORDIGER ZIJN. Dan houdt een hand beide
      handtekeningen vast.
   6. DE VOOGD KAN STOPPEN. Een bestuur dat niet kan stoppen is geen bestuur, en
      hij staat niet in het dossier van de jongere en is niet de
      vertegenwoordiger -- zonder eigen weg bestaat de machtiging niet voor hem.

   Draai los: node --test test/jeugdbestuur.e2e.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, kantoorAlsPersoon, keurLidGoed } = require('./helper');

let BASE, child, jongere, voogd, agent, jongereCode, voogdCode, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-jeugd-'));
const jaarGeleden = (n) => {
  const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10);
};
const GEB_JONGERE = jaarGeleden(16);
const TOT = new Date(Date.now() + 90 * 86400000).toISOString();

const post = (pad, body, tok) => fetch(BASE + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const codeVan = async (tok) => (await post('/api/state', {}, tok)).body.state.user.codename;
const standVan = async (tok) => {
  const d = (await post('/api/vertegenwoordiging/mijn', {}, tok)).body;
  return (d.team && d.team[0] && d.team[0].stand) || null;
};

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  jongere = (await post('/api/auth/register', { name: 'Talent Zestien', email: 'jeugd1@x.nl',
    phone: '0612347001', password: 'geheim12345', geboortedatum: GEB_JONGERE, tier: 'rtg' })).body.token;
  voogd = (await post('/api/auth/register', { name: 'Ouder Een', email: 'jeugd2@x.nl',
    phone: '0612347002', password: 'geheim12345', geboortedatum: '1980-02-02', tier: 'rtg' })).body.token;
  agent = (await post('/api/auth/register', { name: 'Waarnemer Drie', email: 'jeugd3@x.nl',
    phone: '0612347003', password: 'geheim12345', geboortedatum: '1986-03-03', tier: 'rtg' })).body.token;
  jongereCode = await codeVan(jongere);
  voogdCode = await codeVan(voogd);
  /* De volwassenen door de keuring; de JONGERE met opzet nog niet, want toets 1
     gaat er juist over dat zijn leeftijd dan nog niet vaststaat. */
  await keurLidGoed(BASE, voogd, voogdCode, '1980-02-02');
  await keurLidGoed(BASE, agent, await codeVan(agent), '1986-03-03');
  office = await kantoorAlsPersoon(BASE, 'RTG-OFFICE');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. zonder gezien document staat de leeftijd nog op wat het lid zelf opgaf, en dan kan er geen voogd worden aangewezen', async () => {
  const r = await post('/api/vertegenwoordiging/voogd/vraag', { voogd: voogdCode }, jongere);
  assert.equal(r.status, 403);
  assert.match(r.body.error, /verificatie\.html/, 'de weigering wijst naar de plek waar je dit oplost');

  const v = await post('/api/vertegenwoordiging/voorstel', { client: jongereCode,
    hoedanigheid: 'zaakwaarnemer', bevoegdheden: ['aanbod.ontvangen'], tot: TOT }, agent);
  assert.equal(v.status, 403, 'en er kan ook niets namens hem');
});

test('2. na de keuring staat vast dat hij minderjarig is, en dan mag hij iemand aanwijzen', async () => {
  await keurLidGoed(BASE, jongere, jongereCode, GEB_JONGERE);
  const d = (await post('/api/vertegenwoordiging/mijn', {}, jongere)).body;
  assert.equal(d.jeugd.minderjarig, true, 'het scherm van de jongere zegt zelf dat hij minderjarig is');
  assert.equal(d.jeugd.leeftijdBron, 'paspoort');
  assert.equal(d.jeugd.nodig, true, 'en dat er nog een voogd nodig is');

  const r = await post('/api/vertegenwoordiging/voogd/vraag', { voogd: voogdCode }, jongere);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
});

test('3. een gevraagde voogd is nog geen bevestigde voogd: er kan nog niets namens de jongere', async () => {
  const v = await post('/api/vertegenwoordiging/voorstel', { client: jongereCode,
    hoedanigheid: 'zaakwaarnemer', bevoegdheden: ['aanbod.ontvangen'], tot: TOT }, agent);
  assert.equal(v.status, 403);
  assert.match(v.body.error, /bevestigd/, 'de reden noemt dat RTG de voogd nog niet heeft bevestigd');
});

test('4. de volwassene aanvaardt de rol -- en ook dat is nog niet genoeg', async () => {
  const r = await post('/api/vertegenwoordiging/voogd/rol', { client: jongereCode }, voogd);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const v = await post('/api/vertegenwoordiging/voorstel', { client: jongereCode,
    hoedanigheid: 'zaakwaarnemer', bevoegdheden: ['aanbod.ontvangen'], tot: TOT }, agent);
  assert.equal(v.status, 403, 'zonder een mens van RTG blijft het dicht');
});

test('5. een voogdijbesluit staat op naam, en de gedeelde kantoorcode is geen naam', async () => {
  const kaal = await fetch(BASE + '/api/office/voogdij/besluit', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client: jongereCode, akkoord: true }) });
  assert.ok(kaal.status === 401 || kaal.status === 403, 'zonder kantoorsessie komt er niemand bij');
});

test('6. na het besluit van een mens van RTG kan er wel worden voorgesteld, met twee handtekeningen', async () => {
  const b = await post('/api/office/voogdij/besluit', { client: jongereCode, akkoord: true }, office);
  assert.equal(b.status, 200, JSON.stringify(b.body).slice(0, 200));

  const v = await post('/api/vertegenwoordiging/voorstel', { client: jongereCode,
    hoedanigheid: 'zaakwaarnemer', bevoegdheden: ['aanbod.ontvangen'], tot: TOT }, agent);
  assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 200));
  assert.match(v.body.let, /allebei tekenen/, 'het antwoord zegt dat er twee handtekeningen nodig zijn');
});

test('7. DE JONGERE ALLEEN IS NIET GENOEG: na zijn eigen handtekening staat hij nog voorgesteld', async () => {
  const mijn = (await post('/api/vertegenwoordiging/mijn', {}, jongere)).body;
  const id = mijn.team[0].id;
  const a = await post('/api/vertegenwoordiging/aanvaard', { id }, jongere);
  assert.equal(a.status, 200, JSON.stringify(a.body).slice(0, 200));
  assert.equal(await standVan(jongere), 'voorgesteld',
    'dit is het hele punt van het jeugdbestuur: een minderjarige tekent zichzelf niet vast');
});

test('8. en dan tekent de voogd, en pas daarna loopt hij', async () => {
  const id = (await post('/api/vertegenwoordiging/mijn', {}, jongere)).body.team[0].id;
  const t = await post('/api/vertegenwoordiging/voogd/tekent', { id }, voogd);
  assert.equal(t.status, 200, JSON.stringify(t.body).slice(0, 200));
  assert.equal(await standVan(jongere), 'actief');
});

test('9. de voogd kan de machtiging ook weer stoppen', async () => {
  const id = (await post('/api/vertegenwoordiging/mijn', {}, jongere)).body.team[0].id;
  const r = await post('/api/vertegenwoordiging/intrek', { id, reden: 'te veel voor school' }, voogd);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.equal(await standVan(jongere), 'ingetrokken');
});

test('10. de voogd kan niet ook de vertegenwoordiger zijn: dan is de tweede handtekening dezelfde hand', async () => {
  const r = await post('/api/vertegenwoordiging/voorstel', { client: jongereCode,
    hoedanigheid: 'zaakwaarnemer', bevoegdheden: ['aanbod.ontvangen'], tot: TOT }, voogd);
  assert.equal(r.status, 409);
  assert.match(r.body.error, /dezelfde hand/);
});

test('11. een voogd kan niet vooraf tekenen: de jongere wordt niet voor een voldongen feit gezet', async () => {
  const v = await post('/api/vertegenwoordiging/voorstel', { client: jongereCode,
    hoedanigheid: 'manager', bevoegdheden: ['aanbod.ontvangen'], tot: TOT }, agent);
  assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 200));
  const id = v.body.machtiging.id;
  const t = await post('/api/vertegenwoordiging/voogd/tekent', { id }, voogd);
  assert.equal(t.status, 409);
  assert.match(t.body.error, /nog niet getekend|voldongen/);
});

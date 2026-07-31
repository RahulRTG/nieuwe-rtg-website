/* ============================================================================
   DE KRING, HET CODEWOORD EN DE RUST -- 6 endpoints van RTG Veilig.

   Deze zes wees de waargenomen dekkingsmeting aan als nooit aangeroepen:
   kring/aanpassen, kring/mail, alarm/afsluiten, codewoord/schakel,
   codewoord/wis en rust. De keten eromheen was wel beproefd (test/veiligheid
   .test.js doet de dodemansknop), maar deze zes stonden erbuiten -- en dat is
   precies waar een rechtencontrole verdwijnt, want die staat in de route.

   WAT ER OP HET SPEL STAAT

   Dit is de app die je opent als het misgaat. Vier dingen moeten daarom vast
   liggen, en dit bestand rekent ze allevier af:

   - EEN ALARM IS VAN DEGENE DIE HET SLOEG. Een ander mag het niet afsluiten,
     ook niet als hij het alarm binnenkreeg. Wie het alarm kan afsluiten kan
     de kring laten denken dat het over is.
   - DE KRING IS JOUW LIJST. Een contact dat er niet in staat kun je niet
     "aanpassen", en dus ook niet stilletjes je locatie laten meelezen.
   - HET CODEWOORD VERRAADT NOOIT DAT HET BESTAAT. /check antwoordt altijd
     hetzelfde, raak of niet. Alleen achter de aparte oefenknop hoor je het --
     want oefenen doe je als je alleen bent.
   - DE VEILIGHEIDSBAAN. "Niet storen" zet alles stil BEHALVE je kring en
     alles wat over veiligheid gaat. Dat is de hele reden dat mensen deze
     stand durven aanzetten; zonder die baan is dit gewoon een vliegtuigstand
     met een mooiere naam.

   Draai los: node --experimental-sqlite --test test/veiligheid-kring-rust.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, ik, maat, vreemde;
let alarmId = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-veilig-kr-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let n = 0;
async function registreer() {
  const u = Date.now().toString(36) + (n++) + Math.random().toString(36).slice(2, 6);
  const r = await api('/api/auth/register', { name: 'Veilig Lid', email: u + '@voorbeeld.test',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'kringgeheim1', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.equal(r.status, 200, 'registreren: ' + JSON.stringify(r.body));
  const con = await api('/api/member/connections', {}, r.body.token);
  return { token: r.body.token, key: con.body.me, codenaam: con.body.codename };
}
/* De kring loopt op ECHTE verbindingen: kring.ontvangers() controleert bij elk
   alarm opnieuw of jullie nog vrienden zijn. Wie alleen is toegevoegd en de
   verbinding daarna verbrak, valt er vanzelf uit. Vandaar het volle verzoek. */
async function verbind(a, b) {
  assert.equal((await api('/api/member/connect', { key: b.key }, a.token)).status, 200);
  assert.equal((await api('/api/member/connect/respond', { key: a.key, action: 'accept' }, b.token)).status, 200);
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '0' } });
  base = srv.base;
  ik = await registreer();
  maat = await registreer();
  vreemde = await registreer();
  await verbind(ik, maat);
  assert.equal((await api('/api/veiligheid/kring/toevoegen', { handle: maat.key }, ik.token)).status, 200,
    'de maat staat in mijn kring');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een contact aanpassen kan alleen als het in je kring staat', async () => {
  /* De schakelaar die hier omgaat is "mag dit contact mijn plek zien". Dat is
     geen detail: bij een alarm bepaalt hij of iemand een kaart krijgt of
     alleen een bericht. */
  const uit = await api('/api/veiligheid/kring/aanpassen', { handle: maat.key, locatie: false }, ik.token);
  assert.equal(uit.status, 200);
  const c = uit.body.kring.contacten.find(x => x.handle === maat.key);
  assert.equal(c.locatie, false, 'de maat ziet mijn plek nu niet meer');

  const aan = await api('/api/veiligheid/kring/aanpassen', { handle: maat.key, locatie: true }, ik.token);
  assert.equal(aan.body.kring.contacten.find(x => x.handle === maat.key).locatie, true, 'en weer wel');

  assert.equal((await api('/api/veiligheid/kring/aanpassen', { handle: vreemde.key, locatie: false }, ik.token)).status, 404,
    'iemand die niet in je kring staat kun je niet aanpassen');
  /* Andersom net zo: de maat staat WEL in mijn kring, maar niet in de zijne.
     Anders zou toegevoegd worden hetzelfde zijn als toegang krijgen. */
  assert.equal((await api('/api/veiligheid/kring/aanpassen', { handle: ik.key, locatie: false }, maat.token)).status, 404,
    'in mijn kring staan geeft geen zeggenschap over die van een ander');
});

test('2. e-mail in de kring: een adres, een keer, en er is een dak op', async () => {
  assert.equal((await api('/api/veiligheid/kring/mail', { adres: 'geen adres' }, ik.token)).status, 400);
  assert.equal((await api('/api/veiligheid/kring/mail', { adres: '' }, ik.token)).status, 400);

  const een = await api('/api/veiligheid/kring/mail', { adres: 'Zus@Voorbeeld.test' }, ik.token);
  assert.equal(een.status, 200);
  assert.ok(een.body.kring.mails.includes('zus@voorbeeld.test'), 'hoofdletters maken geen tweede adres');
  assert.equal((await api('/api/veiligheid/kring/mail', { adres: 'zus@voorbeeld.test' }, ik.token)).status, 409,
    'hetzelfde adres een tweede keer');

  /* Het dak zit op vier. Een kring die eindeloos kan groeien is geen kring
     meer maar een verzendlijst, en dan gaat een alarm naar mensen die het
     niet kunnen plaatsen. */
  for (const a of ['broer@voorbeeld.test', 'buur@voorbeeld.test', 'oom@voorbeeld.test'])
    assert.equal((await api('/api/veiligheid/kring/mail', { adres: a }, ik.token)).status, 200);
  const vol = await api('/api/veiligheid/kring/mail', { adres: 'nog1@voorbeeld.test' }, ik.token);
  assert.equal(vol.status, 400, 'boven het maximum');
  assert.match(vol.body.error, /Maximaal/);

  const weg = await api('/api/veiligheid/kring/mail', { adres: 'oom@voorbeeld.test', weg: true }, ik.token);
  assert.ok(!weg.body.kring.mails.includes('oom@voorbeeld.test'), 'en een adres gaat er weer af');
  assert.equal((await api('/api/veiligheid/kring/mail', { adres: 'nog1@voorbeeld.test' }, ik.token)).status, 200,
    'daarna is er weer plek');
});

test('3. een alarm sluit degene af die het sloeg, en niemand anders', async () => {
  const sla = await api('/api/veiligheid/alarm', { proef: true, notitie: 'Proefalarm voor de toets.' }, ik.token);
  assert.equal(sla.status, 200);
  alarmId = sla.body.alarm ? sla.body.alarm.id : sla.body.id;
  assert.ok(alarmId, 'het alarm heeft een nummer');

  /* De maat KREEG dit alarm binnen -- hij staat in de kring. Toch mag hij het
     niet afsluiten. Wie dat kan, laat de rest van de kring denken dat het
     over is terwijl degene die het sloeg nog in de problemen zit. 404 en niet
     403: buiten je eigen alarmen bestaat een alarmnummer hier niet. */
  assert.equal((await api('/api/veiligheid/alarm/afsluiten', { id: alarmId, hoe: 'niks aan de hand' }, maat.token)).status, 404,
    'het contact dat het alarm kreeg sluit het niet af');
  assert.equal((await api('/api/veiligheid/alarm/afsluiten', { id: alarmId }, vreemde.token)).status, 404);
  assert.equal((await api('/api/veiligheid/alarm/afsluiten', { id: 'bestaatniet' }, ik.token)).status, 404);

  const dicht = await api('/api/veiligheid/alarm/afsluiten', { id: alarmId, hoe: 'Ik ben veilig thuis.' }, ik.token);
  assert.equal(dicht.status, 200);
  /* Twee keer afsluiten is geen fout maar een dubbeltik: dezelfde uitkomst,
     en de kring krijgt geen tweede "het is over"-bericht. */
  assert.equal((await api('/api/veiligheid/alarm/afsluiten', { id: alarmId }, ik.token)).status, 200, 'dubbeltik');

  const beeld = await api('/api/veiligheid', {}, ik.token);
  const mijne = (beeld.body.alarmen || []).find(a => a.id === alarmId);
  assert.ok(!mijne || mijne.afgesloten, 'het alarm staat als afgesloten in mijn eigen beeld');
});

test('4. het codewoord: aan- en uitzetten kan pas als er een is', async () => {
  assert.equal((await api('/api/veiligheid/codewoord/schakel', { aan: false }, ik.token)).status, 404,
    'zonder codewoord valt er niets te schakelen');
  assert.equal((await api('/api/veiligheid/codewoord/proef', { tekst: 'wat dan ook' }, ik.token)).status, 404);

  assert.equal((await api('/api/veiligheid/codewoord/zet', { zin: 'de blauwe paraplu staat klaar' }, ik.token)).status, 200);
  assert.equal((await api('/api/veiligheid/codewoord', {}, ik.token)).body.stand.ingesteld, true);

  const uit = await api('/api/veiligheid/codewoord/schakel', { aan: false }, ik.token);
  assert.equal(uit.status, 200);
  assert.equal(uit.body.stand.aan, false, 'uit staat uit');
  assert.equal((await api('/api/veiligheid/codewoord/schakel', { aan: true }, ik.token)).body.stand.aan, true, 'en weer aan');

  /* De hele reden dat dit ding werkt: /check zegt ALTIJD hetzelfde. Zou het
     antwoord verschillen, dan zou de app het kunnen tonen -- en dan ziet
     degene die over je schouder meekijkt dat er een codewoord bestaat. */
  const raak = await api('/api/veiligheid/codewoord/check', { tekst: 'de blauwe paraplu staat klaar' }, ik.token);
  const mis = await api('/api/veiligheid/codewoord/check', { tekst: 'ik ga zo naar de winkel' }, ik.token);
  assert.deepEqual(raak.body, mis.body, 'raak en mis geven exact hetzelfde antwoord');
  assert.equal(raak.status, mis.status);
  assert.ok(!('raak' in raak.body) && !('geraakt' in raak.body), 'er staat geen uitslag in: ' + JSON.stringify(raak.body));

  // achter de aparte oefenknop hoor je het WEL: oefenen doe je als je alleen bent
  assert.equal((await api('/api/veiligheid/codewoord/proef', { tekst: 'de blauwe paraplu staat klaar' }, ik.token)).body.raak, true);
  assert.equal((await api('/api/veiligheid/codewoord/proef', { tekst: 'ik ga naar de winkel' }, ik.token)).body.raak, false);

  const wis = await api('/api/veiligheid/codewoord/wis', {}, ik.token);
  assert.equal(wis.status, 200);
  assert.equal(wis.body.stand.ingesteld, false, 'gewist is echt weg');
  assert.equal((await api('/api/veiligheid/codewoord/proef', { tekst: 'de blauwe paraplu staat klaar' }, ik.token)).status, 404,
    'en dan valt er ook niets meer te oefenen');
  // wissen zonder codewoord is geen fout: het eindresultaat is hetzelfde
  assert.equal((await api('/api/veiligheid/codewoord/wis', {}, ik.token)).status, 200);
});

test('5. de rust zet de wereld stil, maar nooit je kring', async () => {
  const leeg = await api('/api/veiligheid/rust', {}, ik.token);
  assert.equal(leeg.status, 200);
  assert.equal(leeg.body.rust.aan, false);
  assert.ok(leeg.body.rust.standen.length >= 3, 'de standen staan er ook als er niets aan staat');

  assert.equal((await api('/api/veiligheid/rust/aan', { stand: 'bestaatniet' }, ik.token)).status, 400);

  const aan = await api('/api/veiligheid/rust/aan', { stand: 'slaap' }, ik.token);
  assert.equal(aan.status, 200);
  const st = (await api('/api/veiligheid/rust', {}, ik.token)).body.rust;
  assert.equal(st.aan, true);
  assert.equal(st.stand, 'slaap');
  assert.ok(st.tot, 'elke stand heeft een harde einddatum');
  assert.ok(new Date(st.tot) > new Date(), 'die in de toekomst ligt');

  /* DIT is de vondst van deze module en de reden dat mensen hem aandurven:
     wat over veiligheid gaat komt er altijd doorheen. Zonder die baan is dit
     een vliegtuigstand met een mooiere naam, en dan zet niemand hem aan uit
     angst dat er net iets is met een kind of met zijn moeder. */
  assert.ok(st.doorlaat.includes('veiligheid'), 'de veiligheidsbaan staat open: ' + JSON.stringify(st.doorlaat));

  /* De kring staat met opzet NIET in doorlaat: hij komt er per definitie
     doorheen (magDoor kijkt naar note.uitKring, buiten de lijst om). Zou de
     kring een gewone scope zijn, dan kon iemand hem per stand uitzetten. */
  for (const s of leeg.body.rust.standen) {
    const r = await api('/api/veiligheid/rust/aan', { stand: s.id }, ik.token);
    assert.equal(r.status, 200, 'stand ' + s.id);
    const stand = (await api('/api/veiligheid/rust', {}, ik.token)).body.rust;
    assert.ok(stand.doorlaat.includes('veiligheid'), 'ook bij "' + s.id + '" blijft de veiligheidsbaan open');
    assert.ok(!stand.doorlaat.includes('kring'), 'de kring is geen schakelbare scope bij "' + s.id + '"');
  }

  // de duur wordt geknepen: geen stand van een halve minuut, geen stand van een week
  await api('/api/veiligheid/rust/aan', { stand: 'werk', minuten: 99999 }, ik.token);
  const lang = (await api('/api/veiligheid/rust', {}, ik.token)).body.rust;
  assert.ok((new Date(lang.tot) - Date.now()) / 60000 <= 24 * 60 + 1, 'nooit langer dan een etmaal');

  assert.equal((await api('/api/veiligheid/rust/uit', {}, ik.token)).status, 200);
  assert.equal((await api('/api/veiligheid/rust', {}, ik.token)).body.rust.aan, false, 'en hij gaat weer uit');
});

test('6. uitgelogd is er van dit alles niets te halen', async () => {
  for (const pad of ['/api/veiligheid', '/api/veiligheid/kring/aanpassen', '/api/veiligheid/kring/mail',
    '/api/veiligheid/alarm/afsluiten', '/api/veiligheid/codewoord/schakel', '/api/veiligheid/codewoord/wis',
    '/api/veiligheid/rust', '/api/veiligheid/rust/aan']) {
    const r = await api(pad, {});
    assert.ok(r.status === 401 || r.status === 403, pad + ' hoort dicht te zijn zonder sessie (kreeg ' + r.status + ')');
  }
});

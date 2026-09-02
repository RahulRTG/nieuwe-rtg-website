/* HET ONDERZOEKSNUMMER -- één naam voor één onderzoek, door het hele systeem.

   De meting eronder (scripts/onderzoeksketen.js) wees uit dat zeven van de tien
   stations al aan DEZELFDE studie hangen: het is een ster en geen ketting, en de
   spil bestond al. Wat ontbrak was een naam voor die spil die ook buiten de
   software bestaat, plus de terugweg vanuit het Onderzoekslab.

   Wat deze toets vastlegt:

     1. De vorm: RTF-STA-JAAR-VOLG, en het volgnummer telt per lab en per jaar.
     2. Het nummer wordt bij het ONTSTAAN gezet en verandert daarna niet -- ook
        niet als de titel of het vraagstuk wijzigt.
     3. Twee labs in dezelfde stad tellen apart; twee jaren tellen apart.
     4. Het nummer is geen sleutel: zoeken gaat op de interne id, en een botsing
        mag lelijk zijn maar niet stuk.
     5. De verwijzing gaat ECHT twee kanten op: een project in het Onderzoekslab
        draagt de herkomst als VELD, met het onderzoeksnummer erbij. Een logregel
        is te lezen en niet te volgen.

   Draai los: node --test test/livinglab-nummer.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const nummer = require('../server/kern/livinglab/onderzoeksnummer');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-nummer-'));
let srv, base, office, labId, studieId, studieNr;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test('1. de vorm, en het volgnummer telt per lab en per jaar', () => {
  const lab = { id: 'L1', stad: 'IJmuiden' };
  const een = nummer.nieuw({ lab, studies: [], at: '2026-08-31T00:00:00Z' });
  assert.equal(een, 'RTF-IJM-2026-0001');
  const twee = nummer.nieuw({ lab, studies: [{ labId: 'L1', nummer: een }], at: '2026-09-01T00:00:00Z' });
  assert.equal(twee, 'RTF-IJM-2026-0002');
  /* Een ander jaar begint weer bij een. */
  assert.equal(nummer.nieuw({ lab, studies: [{ labId: 'L1', nummer: twee }], at: '2027-01-02T00:00:00Z' }), 'RTF-IJM-2027-0001');
  /* En een ander lab telt apart, ook in dezelfde stad. */
  assert.equal(nummer.nieuw({ lab: { id: 'L2', stad: 'IJmuiden' }, studies: [{ labId: 'L1', nummer: twee }], at: '2026-09-01' }), 'RTF-IJM-2026-0001');
});

test('2. een lab zonder stad krijgt XXX en geen verzonnen plaats', () => {
  assert.equal(nummer.stadsdeel(''), 'XXX');
  assert.equal(nummer.stadsdeel('Ol'), 'OLX');
  assert.equal(nummer.stadsdeel('Zürich'), 'ZUR', 'diakritieken gaan eraf');
  assert.match(nummer.nieuw({ lab: { id: 'L9' }, studies: [], at: '2026-01-01' }), /^RTF-XXX-2026-/);
});

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  labId = (await api('/api/lab2/lab/maak', { naam: 'Lab IJmuiden', stad: 'IJmuiden' }, office)).body.lab.id;
  const st = await api('/api/lab2/studie/maak', { labId, titel: 'Hittestress in woningen',
    soort: 'leefomgeving', vraagstuk: 'Welke woningen lopen risico bij hitte?', doel: 'inzicht' }, office);
  studieId = st.body.studie.id;
  studieNr = st.body.studie.nummer;
});
test.after(() => stop(srv));

test('3. een nieuwe studie draagt haar nummer meteen, en de tweede krijgt een ander', async () => {
  assert.match(studieNr, nummer.VORM, 'het nummer heeft de vaste vorm');
  assert.match(studieNr, /^RTF-IJM-/);

  /* De tweede studie in hetzelfde lab telt door. Dit is de bewering die zakt
     zodra het volgnummer niet meer uit de BESTAANDE studies wordt geteld -- en
     dan dragen twee onderzoeken hetzelfde nummer, wat er van buiten uitziet als
     een en hetzelfde onderzoek. */
  const tweede = await api('/api/lab2/studie/maak', { labId, titel: 'Geluid rond de haven',
    soort: 'leefomgeving', vraagstuk: 'Hoeveel geluid ervaren bewoners rond de haven?', doel: 'inzicht' }, office);
  assert.equal(tweede.status, 200, JSON.stringify(tweede.body));
  assert.notEqual(tweede.body.studie.nummer, studieNr, 'twee onderzoeken dragen nooit hetzelfde nummer');
  assert.equal(nummer.ontleed(tweede.body.studie.nummer).volg,
    nummer.ontleed(studieNr).volg + 1, 'het volgnummer telt door binnen het lab');
});

test('4. het nummer verandert niet als het onderzoek verandert', async () => {
  await api('/api/lab2/studie/vraagstuk', { id: studieId,
    vraagstuk: 'Welke woningen lopen het grootste risico tijdens hittegolven, en waarom?' }, office);
  const na = await api('/api/lab2/studie', { id: studieId }, office);
  assert.equal(na.body.studie.nummer, studieNr, 'een nummer dat meebeweegt is geen nummer');
});

test('5. het grootboek noemt het onderzoek bij zijn nummer', async () => {
  const r = await api('/api/lab2/ledger/studie', { id: studieId }, office);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.studie.nummer, studieNr, 'dit is het stuk dat een subsidiegever leest');
});

test('6. een project in het Onderzoekslab bewaart zijn herkomst als VELD', async () => {
  /* Rechtstreeks op de deur van het Onderzoekslab, want de weg ernaartoe loopt
     via de hele onderzoekscyclus (een pilot vraagt een conclusie met genoeg
     bewijs, en dat is tien stappen verderop). Wat hier telt is dat het VELD
     bestaat en wordt bewaard -- een logregel is te lezen en niet te volgen. */
  /* Let op het VELD: het Onderzoekslab kent zijn eigen velden (hardware, water,
     zorg...) en niet de soorten van het Living Lab (leefomgeving, cohesie...).
     Twee systemen, twee woordenlijsten -- en dat is geen slordigheid maar het
     bewijs dat het twee systemen zijn. */
  const r = await api('/api/lab/project/maak', { titel: 'Koeling in vier woningen', veld: 'zorg',
    doel: 'Proef met koeling in de zwaarst getroffen woningen.',
    herkomst: { systeem: 'livinglab', studieId, uitgangId: 'U1', nummer: studieNr } }, office);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  /* Het antwoord van het lab zelf, en niet het overzicht: dat overzicht is
     BESLOTEN (alleen je eigen teamprojecten, of de boardroom), en die grens
     hoort deze toets niet te omzeilen. */
  const p = r.body.project;
  assert.equal(p.herkomst.systeem, 'livinglab');
  assert.equal(p.herkomst.studieId, studieId);
  assert.equal(p.herkomst.nummer, studieNr, 'het project wijst terug met hetzelfde onderzoeksnummer');
});

test('7. de doorzetweg geeft die herkomst mee, en weigert met een reden zolang het onderzoek er nog niet is', async () => {
  /* De heenweg zelf: een pilot doorzetten kan pas bij het besluit of het
     vervolg. Zolang dat niet zo is, hoort er een weigering te staan die zegt
     WAAROM -- en niet een lege uitgang. */
  const uit = await api('/api/lab2/uit/maak', { id: studieId, uitgang: 'pilot',
    titel: 'Koeling in vier woningen', omschrijving: 'Een proef met koeling.' }, office);
  assert.equal(uit.status, 409);
  assert.match(uit.body.error, /vraagstuk/, 'de weigering noemt de stap waar het onderzoek staat');

  /* En de doorzetroute zelf noemt de uitgang die er niet is, in plaats van stil
     een project zonder herkomst te maken. */
  const door = await api('/api/lab2/uit/naar-lab', { id: studieId, uitgangId: 'bestaat-niet', veld: 'zorg' }, office);
  assert.equal(door.status, 404);
});

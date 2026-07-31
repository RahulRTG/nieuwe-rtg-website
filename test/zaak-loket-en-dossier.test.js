/* ============================================================================
   HET LOKET EN HET DOSSIER -- 5 endpoints uit de supplier-groep.

   overheid/bekendmakingen, gemeente/bekendmakingen, overheid/kvk/mijn,
   advies/dossier/status en apply/chat/send stonden als nooit aangeroepen in
   de waargenomen dekkingsmeting.

   WAT ER OP HET SPEL STAAT

   - EEN BEKENDMAKING IS OPENBAAR, EN DAT IS EEN KEUZE. Elke zaak leest ze,
     zonder cap en zonder managerrol. Dat hoort zo -- een bekendmaking die je
     alleen ziet als je de goede zaak bent, is geen bekendmaking. Maar het is
     wel het enige paar in dit bestand waar géén afscherming hoort te staan,
     en dat verdient een toets in plaats van stilte.
   - EEN KVK-INSCHRIJVING IS VAN EEN ONDERNEMING. kvk/mijn filtert op de eigen
     zaakcode; wie de route aanroept krijgt zijn eigen inschrijvingen en niet
     die van de buren.
   - EEN DOSSIER SCHAKELT TUSSEN TWEE STANDEN EN NIET MEER. Het begint bij de
     intake en gaat daarna heen en weer tussen lopend en afgerond -- terug naar
     intake kan niet, want de praktijk neemt een zaak een keer aan. Een
     verzonnen status op een juridisch dossier is precies het soort stille
     rommel dat later niemand meer kan uitleggen.
   - EEN SOLLICITATIEGESPREK IS VAN DE WERKGEVER EN DE SOLLICITANT. Een chat
     van een andere zaak bestaat hier niet, en schrijven doet het management.

   Draai los: node --experimental-sqlite --test test/zaak-loket-en-dossier.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, resto, restoWerker, praktijk, praktijkWerker, buurbaas;
let dossierId = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-loket-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function inlog(code, rol) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = (roster.body.staff || []).find(x => x.role === rol);
  return wie ? (await api('/api/supplier/login', { code, staffId: wie.id, pin: rol === 'manager' ? '1234' : '5678' })).body.token : null;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  resto = await inlog('KIKUNOI', 'manager');
  restoWerker = await inlog('KIKUNOI', 'staff');
  praktijk = await inlog('LEXNOVA', 'manager');       // professionele praktijk (cap 'advies')
  praktijkWerker = await inlog('LEXNOVA', 'staff');
  buurbaas = await inlog('HOSHI', 'manager');
  assert.ok(resto && praktijk && buurbaas, 'de zaken staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een bekendmaking is openbaar, en dat hoort zo', async () => {
  for (const pad of ['/api/supplier/overheid/bekendmakingen', '/api/supplier/gemeente/bekendmakingen']) {
    const r = await api(pad, {}, resto);
    assert.equal(r.status, 200, pad);
    assert.ok(Array.isArray(r.body.bekendmakingen), 'er komt een lijst terug');
    /* Geen cap, geen managerrol: elke zaak leest ze, en de bediening ook. Een
       bekendmaking die je alleen ziet als je de goede zaak bent, is geen
       bekendmaking. Dit is het enige paar in dit bestand waar afwezigheid van
       afscherming de bedoeling is, dus dat staat hier zwart op wit. */
    if (restoWerker) assert.equal((await api(pad, {}, restoWerker)).status, 200, pad + ' leest ook de bediening');
    assert.equal((await api(pad, {}, praktijk)).status, 200, pad + ' leest elke soort zaak');
  }

  // maar zonder inlog is het nog steeds een zaak-route
  assert.equal((await api('/api/supplier/overheid/bekendmakingen', {})).status >= 400, true,
    'zonder inlog komt er niets uit een supplier-route');

  // rijk en gemeente zijn twee verschillende loketten, met eigen soorten
  const rijk = (await api('/api/supplier/overheid/bekendmakingen', {}, resto)).body.bekendmakingen;
  const gem = (await api('/api/supplier/gemeente/bekendmakingen', {}, resto)).body.bekendmakingen;
  if (rijk.length && gem.length)
    assert.notDeepEqual(rijk.map(b => b.id).sort(), gem.map(b => b.id).sort(),
      'het rijk en de gemeente publiceren niet hetzelfde lijstje');
});

test('2. de KvK-inschrijving is van de eigen onderneming', async () => {
  const mijn = await api('/api/supplier/overheid/kvk/mijn', {}, resto);
  assert.equal(mijn.status, 200);
  assert.ok(Array.isArray(mijn.body.inschrijvingen), 'er komt een lijst terug, ook als hij leeg is');

  /* De route filtert op de eigen zaakcode en leest niets uit de body. Wat er
     ook meegestuurd wordt -- een andere code, een sleutel van een lid -- het
     antwoord blijft dat van de ingelogde zaak. Dat is het verschil tussen een
     filter dat je kunt sturen en een filter dat vastzit aan wie je bent. */
  const gestuurd = await api('/api/supplier/overheid/kvk/mijn', { supplierCode: 'HOSHI', key: 'iets' }, resto);
  assert.deepEqual(gestuurd.body.inschrijvingen, mijn.body.inschrijvingen,
    'meesturen van een andere code verandert niets aan het antwoord');

  const buur = await api('/api/supplier/overheid/kvk/mijn', {}, buurbaas);
  assert.equal(buur.status, 200);
  for (const k of buur.body.inschrijvingen)
    assert.ok(!mijn.body.inschrijvingen.some(m => m.id === k.id), 'de buurzaak heeft zijn eigen inschrijvingen');
});

test('3. een dossier heeft twee standen en niet meer', async () => {
  assert.equal((await api('/api/supplier/advies/dossier/status', { id: 'x', status: 'lopend' }, resto)).status, 403,
    'een restaurant voert geen dossiers');

  assert.equal((await api('/api/supplier/advies/dossier', { klant: 'Fam. Vidal', omschrijving: 'Overname' }, praktijk)).status, 400,
    'zonder vakgebied: een dossier hoort bij een advocaat, notaris of fiscalist');
  assert.equal((await api('/api/supplier/advies/dossier', { klant: '', omschrijving: 'x', vak: 'notaris' }, praktijk)).status, 400,
    'en zonder klant valt er niets te dossieren');

  const mk = await api('/api/supplier/advies/dossier',
    { klant: 'Fam. Vidal', omschrijving: 'Overname horecapand Sant Antoni', vak: 'notaris' }, praktijk);
  assert.equal(mk.status, 200, JSON.stringify(mk.body).slice(0, 200));
  const dos = mk.body.dossier;
  assert.ok(dos, 'het dossier staat er: ' + JSON.stringify(mk.body).slice(0, 200));
  dossierId = dos.id;
  assert.equal(dos.status, 'intake', 'een nieuw dossier begint bij de intake, nog niet bij het werk');

  assert.equal((await api('/api/supplier/advies/dossier/status', { id: dossierId, status: 'geseponeerd' }, praktijk)).status, 400,
    'een verzonnen status op een juridisch dossier is stille rommel');
  assert.equal((await api('/api/supplier/advies/dossier/status', { id: 'bestaatniet', status: 'afgerond' }, praktijk)).status, 404);
  assert.equal((await api('/api/supplier/advies/dossier/status', { id: dossierId, status: 'afgerond' }, buurbaas)).status, 403,
    'een hotel komt niet bij het dossier van een advocaat');

  const lopend = await api('/api/supplier/advies/dossier/status', { id: dossierId, status: 'lopend' }, praktijk);
  assert.equal(lopend.status, 200);
  assert.equal(lopend.body.dossier.status, 'lopend', 'van intake naar lopend');

  const af = await api('/api/supplier/advies/dossier/status', { id: dossierId, status: 'afgerond' }, praktijk);
  assert.equal(af.body.dossier.status, 'afgerond');
  /* Een afgerond dossier kan weer open: een zaak die terugkomt is geen nieuw
     dossier, en de geschiedenis hoort bij elkaar te blijven. */
  assert.equal((await api('/api/supplier/advies/dossier/status', { id: dossierId, status: 'lopend' }, praktijk)).body.dossier.status, 'lopend');
  /* Maar terug naar INTAKE kan niet. Dat is geen omissie: de intake is het
     moment waarop de praktijk de zaak aanneemt, en dat gebeurt een keer. */
  assert.equal((await api('/api/supplier/advies/dossier/status', { id: dossierId, status: 'intake' }, praktijk)).status, 400,
    'een dossier keert niet terug naar de intake');

  // het dossier lezen mag het hele kantoor: de secretaresse plant de afspraken
  if (praktijkWerker) assert.equal((await api('/api/supplier/advies', {}, praktijkWerker)).status, 200);
});

test('4. een sollicitatiegesprek is van de werkgever en de sollicitant', async () => {
  assert.equal((await api('/api/supplier/apply/chat/send', { id: 'bestaatniet', text: 'Hallo' }, resto)).status, 404,
    'een gesprek dat niet bestaat');
  if (restoWerker) assert.equal((await api('/api/supplier/apply/chat/send', { id: 'bestaatniet', text: 'Hallo' }, restoWerker)).status, 403,
    'en schrijven namens de zaak doet het management');

  /* Er is geen sollicitatie in de seed, dus verder dan de twee deuren komen we
     hier niet -- en dat is precies wat er te zeggen valt. De inhoudelijke kant
     (bericht komt aan, de sollicitant krijgt een seintje) hangt aan een echte
     sollicitatie en hoort in de wervingstoets, niet hier. Dat opschrijven is
     eerlijker dan een bewering doen die op een lege lijst toch wel slaagt. */
  const chat = await api('/api/supplier/apply/chat/send', { id: 'x' }, praktijk);
  assert.equal(chat.status, 404, 'ook bij een andere zaak bestaat een vreemd chat-id niet');
});

/* ============================================================================
   HET BORD VAN DE HULPDIENSTEN -- 5 endpoints uit de supplier-groep.

   def/eenheid/maak, def/materieel/maak, def/gewonde/zet, hulp/eenheid/maak
   en hulp/eenheid/zet stonden als nooit aangeroepen in de waargenomen
   dekkingsmeting. Dit zijn de borden waar tijdens een inzet op gekeken wordt,
   en de enige plek in dit huis waar een verkeerde regel over een gewonde gaat
   in plaats van over een reservering.

   WAT ER OP HET SPEL STAAT

   - EEN BORD DAT LIEGT IS ERGER DAN GEEN BORD. Een eenheid die "vrij" zegt
     terwijl hij rijdt, of een gewonde die "in behandeling" staat terwijl hij
     al in een ziekenhuis ligt: dan stuurt de meldkamer op iets wat er niet
     is. hulp/eenheid/zet doet dat goed en zegt het ook: handmatig kan alleen
     vrij of buiten-dienst, de rest volgt de melding.
   - EEN INZETBORD HOORT BIJ EEN HULPDIENST. Een restaurant dat eenheden
     opvoert is geen korps maar een fout.
   - OPVOEREN IS STAFWERK, MELDEN IS VELDWERK. Een eenheid of een stuk
     materieel op het bord zetten doet de staf; de stand ervan melden doet
     wie erbij staat. Dat verschil staat in de routes en wordt hier
     afgerekend.

   WAT HIER IS RECHTGEZET

   gewondeZet() kon een GEEVACUEERDE gewonde terugzetten op 'in-behandeling'.
   gewondeEvac() weigert een tweede evacuatie netjes met 409, dus het idee
   "geevacueerd is het eindpunt" bestond al -- het stond alleen niet in
   gewondeZet.

   Het gevolg was erger dan het klinkt. Het veldbord toont alleen wie er nog
   is (overzicht() filtert ontslagen en geevacueerde gewonden eruit), dus een
   geevacueerde valt netjes van het bord af. Door de status terug te zetten
   HERREES hij daarop -- terwijl hij in een ziekenhuis lag. Twee borden die
   iets anders zeggen over dezelfde persoon, en de meldkamer stuurt op het
   bord dat ernaast zit.

   Draai los: node --test test/hulpdiensten-bord.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, staf, soldaat, korps, korpsWerker, resto;
let eenheidId = null, materieelId = null, gewondeId = null, hulpEenheidId = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-hulpbord-'));

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
const defBord = t => api('/api/supplier/def/overzicht', {}, t).then(r => r.body);
const hulpBord = t => api('/api/supplier/hulp/overzicht', {}, t).then(r => r.body);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  staf = await inlog('GARNIZOEN', 'manager');
  soldaat = await inlog('GARNIZOEN', 'staff');
  korps = await inlog('BOMBERS', 'manager');
  korpsWerker = await inlog('BOMBERS', 'staff');
  resto = await inlog('KIKUNOI', 'manager');
  assert.ok(staf && korps && resto, 'het garnizoen, de brandweer en het restaurant staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een eenheid opvoeren is stafwerk, en alleen bij een defensie-organisatie', async () => {
  assert.equal((await api('/api/supplier/def/eenheid/maak', { naam: 'Peloton A' }, resto)).status, 409,
    'een restaurant voert geen eenheden op');
  if (soldaat) assert.equal((await api('/api/supplier/def/eenheid/maak', { naam: 'Peloton A' }, soldaat)).status, 403,
    'en binnen het garnizoen doet de staf dat');
  assert.equal((await api('/api/supplier/def/eenheid/maak', { naam: '' }, staf)).status, 400, 'zonder naam');

  const mk = await api('/api/supplier/def/eenheid/maak', { naam: 'Peloton Baleares', soort: 'infanterie', sterkte: 42 }, staf);
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  eenheidId = mk.body.eenheid.id;
  assert.equal(mk.body.eenheid.paraat, 'gevechtsgereed', 'een nieuwe eenheid begint gevechtsgereed');
  assert.equal(mk.body.eenheid.sterkte, 42);

  /* De paraatheid MELDEN mag wie erbij staat: dat is veldwerk en moet niet op
     een staflid wachten. Opvoeren en melden zijn bewust twee deuren. */
  if (soldaat) {
    const p = await api('/api/supplier/def/paraat', { id: eenheidId, paraat: 'beperkt', reden: 'Twee voertuigen in onderhoud.' }, soldaat);
    assert.equal(p.status, 200, 'de stand melden doet wie erbij staat');
    assert.equal(p.body.eenheid.paraat, 'beperkt');
  }
  assert.equal((await api('/api/supplier/def/paraat', { id: eenheidId, paraat: 'halfgereed' }, staf)).status, 400,
    'een paraatheid die we niet kennen');
  assert.equal((await api('/api/supplier/def/paraat', { id: 'bestaatniet', paraat: 'beperkt' }, staf)).status, 404);
});

test('2. materieel: een soort die we niet kennen komt het park niet in', async () => {
  assert.equal((await api('/api/supplier/def/materieel/maak', { naam: 'Iets', soort: 'ruimteschip' }, staf)).status, 400,
    'een soort die niet bestaat');
  assert.equal((await api('/api/supplier/def/materieel/maak', { naam: '' }, staf)).status, 400);
  if (soldaat) assert.equal((await api('/api/supplier/def/materieel/maak', { naam: 'Iets', soort: 'voertuig' }, soldaat)).status, 403);

  const soorten = (await defBord(staf)).matSoorten || (await defBord(staf)).soorten || ['voertuig'];
  const soort = Array.isArray(soorten) ? soorten[0] : 'voertuig';
  const mk = await api('/api/supplier/def/materieel/maak', { naam: 'Terreinwagen 4', soort, kenmerk: 'BAL-04' }, staf);
  assert.equal(mk.status, 200, JSON.stringify(mk.body).slice(0, 200));
  materieelId = mk.body.materieel.id;
  assert.equal(mk.body.materieel.staat, 'inzetbaar', 'nieuw materieel is inzetbaar');

  const z = await api('/api/supplier/def/materieel/zet', { id: materieelId, staat: 'defect', notitie: 'Koppeling.' }, soldaat || staf);
  assert.equal(z.status, 200, 'defect melden doet wie het merkt');
  assert.equal(z.body.materieel.staat, 'defect');
  assert.equal((await api('/api/supplier/def/materieel/zet', { id: materieelId, staat: 'roze' }, staf)).status, 400);
});

test('3. een geevacueerde gewonde staat niet ineens weer in het veld', async () => {
  const mk = await api('/api/supplier/def/gewonde/maak',
    { aanduiding: 'G-14', triage: 'rood', klacht: 'Bloeding bovenbeen na val' }, soldaat || staf);
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  gewondeId = mk.body.gewonde.id;
  assert.equal(mk.body.gewonde.status, 'wacht');

  assert.equal((await api('/api/supplier/def/gewonde/maak', { triage: 'paars', klacht: 'x' }, staf)).status, 400,
    'een triagekleur die niet bestaat');
  assert.equal((await api('/api/supplier/def/gewonde/zet', { id: gewondeId, status: 'genezen' }, staf)).status, 400,
    'een status die we niet kennen');
  assert.equal((await api('/api/supplier/def/gewonde/zet', { id: 'bestaatniet', status: 'stabiel' }, staf)).status, 404);

  const beh = await api('/api/supplier/def/gewonde/zet', { id: gewondeId, status: 'in-behandeling' }, soldaat || staf);
  assert.equal(beh.status, 200, 'de stand van een gewonde melden doet wie erbij staat');
  assert.equal(beh.body.gewonde.status, 'in-behandeling');

  // evacueren naar een echt ziekenhuis; de overdracht komt daar op de SEH binnen
  const ev = await api('/api/supplier/def/gewonde/evacueer', { id: gewondeId, ziekenhuis: 'CANMISSES' }, staf);
  assert.equal(ev.status, 200, JSON.stringify(ev.body));
  assert.equal((await api('/api/supplier/def/gewonde/evacueer', { id: gewondeId, ziekenhuis: 'CANMISSES' }, staf)).status, 409,
    'twee keer evacueren kan niet');
  assert.equal((await api('/api/supplier/def/gewonde/evacueer', { id: gewondeId, ziekenhuis: 'KIKUNOI' }, staf)).status, 404,
    'een restaurant is geen ziekenhuis');

  /* DE RECHTZETTING. Hiervoor kon dit gewoon: een gewonde die al in een
     ziekenhuis ligt terugzetten op 'in-behandeling' in het veld. Dan zeggen
     twee borden iets anders over dezelfde persoon, en gaat de meldkamer af op
     het bord dat ernaast zit. */
  const terug = await api('/api/supplier/def/gewonde/zet', { id: gewondeId, status: 'in-behandeling' }, staf);
  assert.equal(terug.status, 409, 'een geevacueerde gewonde komt niet terug op het veldbord');
  assert.match(terug.body.error, /geevacueerd/i);

  /* Het veldbord toont alleen wie er NOG is: overzicht() filtert ontslagen en
     geevacueerde gewonden eruit. Dat is goed -- een bord dat vol blijft staan
     met mensen die er niet meer zijn is onleesbaar op het moment dat het moet
     werken. Maar het maakt de fout hierboven wel scherper dan hij leek: door
     de status terug te zetten HERREES een gewonde op dat bord, terwijl hij in
     een ziekenhuis lag. Nu blijft hij eraf. */
  assert.ok(!((await defBord(staf)).gewonden || []).some(x => x.id === gewondeId),
    'de geevacueerde staat niet meer op het veldbord, en komt er ook niet op terug');

  const anders = await api('/api/supplier/def/gewonde/zet', { id: gewondeId, status: 'stabiel' }, staf);
  assert.equal(anders.status, 409, 'geen enkele status haalt hem terug');
});

test('4. het korps: eenheden opvoeren doet de leiding, de status volgt de melding', async () => {
  assert.equal((await api('/api/supplier/hulp/eenheid/maak', { naam: 'Tankautospuit 1', soort: 'land' }, resto)).status, 409,
    'een restaurant is geen hulpdienst');
  if (korpsWerker) assert.equal((await api('/api/supplier/hulp/eenheid/maak', { naam: 'TS 1', soort: 'land' }, korpsWerker)).status, 403);
  assert.equal((await api('/api/supplier/hulp/eenheid/maak', { naam: 'TS 1', soort: 'ruimte' }, korps)).status, 400,
    'land, water, lucht of heli -- en verder niets');
  assert.equal((await api('/api/supplier/hulp/eenheid/maak', { naam: '', soort: 'land' }, korps)).status, 400);

  const mk = await api('/api/supplier/hulp/eenheid/maak', { naam: 'Tankautospuit 04-1', soort: 'land' }, korps);
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  hulpEenheidId = mk.body.eenheid.id;
  assert.equal(mk.body.eenheid.status, 'vrij', 'een nieuwe eenheid staat vrij');

  /* HET BORD MAG NIET LIEGEN. Handmatig kun je alleen vrij of buiten-dienst
     zetten; alles daartussen (uitgerukt, ter plaatse) volgt de melding. Zou
     je "ter plaatse" met de hand kunnen zetten, dan staat er een eenheid bij
     een incident waar niemand naartoe is gereden. */
  const fout = await api('/api/supplier/hulp/eenheid/zet', { id: hulpEenheidId, status: 'ter-plaatse' }, korps);
  assert.equal(fout.status, 400, 'een inzetstatus zet je niet met de hand');
  assert.match(fout.body.error, /volgt de melding/i);

  const uit = await api('/api/supplier/hulp/eenheid/zet', { id: hulpEenheidId, status: 'buiten-dienst' }, korpsWerker || korps);
  assert.equal(uit.status, 200, 'buiten dienst melden doet wie het weet');
  assert.equal(uit.body.eenheid.status, 'buiten-dienst');
  assert.equal((await api('/api/supplier/hulp/eenheid/zet', { id: hulpEenheidId, status: 'vrij' }, korps)).body.eenheid.status, 'vrij');
  assert.equal((await api('/api/supplier/hulp/eenheid/zet', { id: 'bestaatniet', status: 'vrij' }, korps)).status, 404);
});

test('5. de borden van twee korpsen staan los van elkaar', async () => {
  const mijne = (await hulpBord(korps)).eenheden || [];
  assert.ok(mijne.some(e => e.id === hulpEenheidId), 'de eigen eenheid staat op het eigen bord');

  const politie = await inlog('GUARDIA', 'manager');
  if (politie) {
    assert.ok(!((await hulpBord(politie)).eenheden || []).some(e => e.id === hulpEenheidId),
      'en niet op dat van de politie');
    assert.equal((await api('/api/supplier/hulp/eenheid/zet', { id: hulpEenheidId, status: 'buiten-dienst' }, politie)).status, 404,
      'een ander korps zet onze eenheid niet buiten dienst');
  }
  assert.ok(!((await defBord(staf)).eenheden || []).some(e => e.id === hulpEenheidId),
    'en het garnizoen ziet hem al helemaal niet');
});

/* Een ziekmelding draagt geen omschrijving -- en de loonrun weet er wel van.

   WAT HIER FOUT WAS. /api/staff/leave/request nam bij een ziekmelding gewoon
   een `reden` over. Dat is een gezondheidsgegeven van een werknemer in een
   personeelssysteem -- precies de lijn die de Autoriteit Persoonsgegevens
   trekt, en precies waar kern/payroll/verzuim.js voor is gebouwd. Die laag
   weigerde het al, maar deze route wist niet dat die laag bestond.

   PRECIES ZIJN OVER HOE VER HET KWAM, want ik heb het nagelopen: geen enkel
   werkgeversscherm TOONT die reden op dit moment bij een ziekmelding (de
   HR-lijst laat hem alleen zien bij een openstaande VERLOFaanvraag). Maar het
   veld ging wel mee in de state die de leverancier-app ophaalt
   (kern/leverancier/state.js stuurt de laatste dertig verlofregels ongefilterd
   mee), dus het gegeven lag in de browser van de werkgever. Het was een regel
   opmaak verwijderd van zichtbaar, en dat is geen geruststelling maar de reden
   om het bij de bron te weigeren.

   WEIGEREN EN NIET OPSCHONEN. Een veld stilzwijgend leegmaken laat de invoerder
   denken dat het is aangekomen; de volgende keer probeert hij het opnieuw of
   belt hij het door. De melding hoort te stuiten, met de reden erbij.

   EN DE ANDERE KANT. Dezelfde melding hoort de PAYROLL te bereiken: die kent de
   doorbetalingspercentages per verlofsoort. Zonder die doorgifte wist de
   loonrun niet dat iemand ziek was en betaalde hij honderd procent door.

   De mutatie die hem hoort te laten zakken: haal de 422 uit
   server/routes/staff/dienst.js, of de payrollOS.verzuim.meld-aanroep eronder.

   Draai los: node --experimental-sqlite --test test/ziekmelding-privacy.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, stopNet } = require('./helper');

async function post(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, data: await r.json() };
}

test('een ziekmelding met een omschrijving wordt geweigerd, niet opgeschoond', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ziek-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const roster = (await post(base, '/api/supplier/roster', { code: 'KIKUNOI' })).data;
    // de manager, want die heeft in de demo een bekende pincode; voor deze
    // toets doet de rol er niet toe -- iedereen meldt zich op dezelfde route
    const wie = roster.staff.find(x => x.role === 'manager');
    const tok = (await post(base, '/api/supplier/login',
      { code: 'KIKUNOI', staffId: wie.id, pin: '1234' })).data.token;
    assert.ok(tok, 'personeelssessie');

    const met = await post(base, '/api/staff/leave/request',
      { soort: 'ziek', reden: 'rugklachten na een val' }, tok);
    assert.equal(met.status, 422, 'de melding stuit: ' + JSON.stringify(met.data));
    assert.match(met.data.error, /arbodienst/,
      'en zegt waarom, zodat niemand het de volgende keer opnieuw probeert');

    /* Geweigerd betekent ook: NIETS vastgelegd. Een melding die is opgeslagen
       en dan pas een fout teruggeeft, heeft het gegeven al binnen. */
    const mijn = (await post(base, '/api/staff/mine', {}, tok)).data;
    const ziek = (mijn.verlof || []).filter(v => v.soort === 'ziek');
    assert.equal(ziek.length, 0, 'er staat geen ziekmelding, ook niet zonder de reden');

    // en zonder omschrijving gaat het gewoon
    const zonder = await post(base, '/api/staff/leave/request', { soort: 'ziek' }, tok);
    assert.equal(zonder.status, 200, JSON.stringify(zonder.data));
    assert.equal(zonder.data.entry.soort, 'ziek');
    assert.ok(!zonder.data.entry.reden, 'en draagt geen omschrijving');

    const inkijk = await post(base, '/api/supplier/state', {}, tok);
    assert.equal(inkijk.status, 200, JSON.stringify(inkijk.data).slice(0, 200));
    assert.ok((inkijk.data.state.verlof || []).some(v => v.soort === 'ziek'),
      'de ziekmelding staat in de state van de werkgever -- DAT hij er niet is, mag hij weten');
  } finally {
    await stop(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

test('de ziekmelding bereikt de verzuimlaag, zodat de loonrun ervan weet', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ziek2-'));
  const env = { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_STORE: 'json' };
  const { child, base } = await startServer({ env });
  let staffId;
  try {
    const roster = (await post(base, '/api/supplier/roster', { code: 'KIKUNOI' })).data;
    const wie = roster.staff.find(x => x.role === 'manager');
    staffId = wie.id;
    const tok = (await post(base, '/api/supplier/login',
      { code: 'KIKUNOI', staffId, pin: '1234' })).data.token;
    assert.equal((await post(base, '/api/staff/leave/request', { soort: 'ziek' }, tok)).status, 200);
  } finally {
    /* stopNet en NIET stop: stop() is SIGKILL, een stroomstoring, en dan spoelt
       de write-behind van de json-opslag zijn laatste staat nooit weg. We lezen
       hieronder van schijf, dus we hebben een NETTE afsluiting nodig -- SIGTERM,
       en wachten tot hij echt weg is. Precies het verschil dat helper.js
       beschrijft, en dat ik hier eerst niet maakte: de toets stond rood terwijl
       de code klopte. */
    await stopNet(child);
  }

  try {
    /* De verzuimlaag heeft geen eigen leesroute (de payroll leest hem intern),
       dus we kijken naar wat er is vastgelegd. Dat is precies de vraag: STAAT
       het er, of stopte de melding bij de goedkeuringsstroom van de zaak-app? */
    const db = JSON.parse(fs.readFileSync(path.join(TMP, 'db.json'), 'utf8'));
    const rij = (db.payrollVerzuim || {})['KIKUNOI:' + staffId];
    assert.ok(Array.isArray(rij) && rij.length, 'de melding staat in de verzuimlaag');
    assert.equal(rij[0].soort, 'ziek');
    assert.equal(rij[0].inzetbaarheid, 'niets', 'met de inzetbaarheid die de planning nodig heeft');
    assert.ok(!('reden' in rij[0]) && !('toelichting' in rij[0]),
      'en zonder enig vrij tekstveld -- er is geen veld om een diagnose in te zetten');
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

test('een OUDE ziekmelding met een omschrijving komt niet meer bij de werkgever', async () => {
  /* De route weigert er nu een, maar dat repareert niets wat er al staat. De
     plek waar het gegeven de werkgever BEREIKT is de state van de
     leverancier-app, en daar wordt hij er ook uit gehaald.

     Deze toets maakt zo'n oude melding NA: eerst een verlofaanvraag met een
     reden (dat mag -- een vakantiereden is geen medisch gegeven), dan zetten we
     zijn soort in de opslag op 'ziek'. Dat is precies hoe een melding eruitziet
     die is opgeslagen toen de route nog geen 422 gaf. Zonder dit planten zou de
     toets groen staan omdat er niets te filteren viel, en dan bewijst hij
     niets. */
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ziek3-'));
  const env = { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_STORE: 'json' };
  const GEHEIM = 'rugklachten na een val';
  let staffId;
  try {
    let s = await startServer({ env });
    const roster = (await post(s.base, '/api/supplier/roster', { code: 'KIKUNOI' })).data;
    staffId = roster.staff.find(x => x.role === 'manager').id;
    let tok = (await post(s.base, '/api/supplier/login',
      { code: 'KIKUNOI', staffId, pin: '1234' })).data.token;
    const aanvraag = await post(s.base, '/api/staff/leave/request',
      { soort: 'verlof', van: '2026-09-01', tot: '2026-09-05', reden: GEHEIM }, tok);
    assert.equal(aanvraag.status, 200, JSON.stringify(aanvraag.data));
    assert.equal(aanvraag.data.entry.reden, GEHEIM, 'bij VERLOF mag een reden gewoon');
    await stopNet(s.child);

    const dbPad = path.join(TMP, 'db.json');
    const db = JSON.parse(fs.readFileSync(dbPad, 'utf8'));
    const rij = (db.verlof || {}).KIKUNOI || [];
    const oud = rij.find(v => v.reden === GEHEIM);
    assert.ok(oud, 'de aanvraag staat in de opslag');
    oud.soort = 'ziek'; oud.status = 'gemeld';   // zoals een oude ziekmelding eruitzag
    /* De melding die bij de VERLOFaanvraag naar de werkgever ging, gaat er ook
       uit. Niet om de toets te laten slagen: die notificatie hoort bij de
       gebeurtenis van toen (een verlofaanvraag, en daar mag een reden bij), en
       een ziekmelding stuurt zo'n bericht helemaal niet -- die meldt alleen
       "heeft zich ziek gemeld". Hem laten staan zou betekenen dat we een
       lekpad toetsen dat in werkelijkheid niet bestaat, en dan gaat de toets
       over mijn eigen opzet in plaats van over de code. */
    db.supplierNotifications = db.supplierNotifications || {};
    db.supplierNotifications.KIKUNOI = [];
    fs.writeFileSync(dbPad, JSON.stringify(db));

    s = await startServer({ env });
    tok = (await post(s.base, '/api/supplier/login',
      { code: 'KIKUNOI', staffId, pin: '1234' })).data.token;
    const state = await post(s.base, '/api/supplier/state', {}, tok);
    assert.equal(state.status, 200);
    const alles = JSON.stringify(state.data);
    assert.ok(!alles.includes(GEHEIM),
      'de omschrijving komt nergens in de state van de werkgever voor');
    const ziek = (state.data.state.verlof || []).find(v => v.soort === 'ziek');
    assert.ok(ziek, 'de melding zelf staat er nog wel -- DAT iemand er niet is, mag de werkgever weten');
    assert.ok(!ziek.reden, 'alleen zonder omschrijving');
    await stopNet(s.child);
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

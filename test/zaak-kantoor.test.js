/* ============================================================================
   HET KANTOOR VAN EEN ZAAK -- 6 endpoints uit de supplier-groep.

   finance, backoffice, wensen/klaar, werkmail/lees, keten/status en
   onboarding/zet stonden als nooit aangeroepen in de waargenomen
   dekkingsmeting. Dit is het papierwerk achter de zaak: de cijfers, de
   wensenlijst, de zakelijke post, de ketenverbindingen en het intakeformulier.

   WAT ER OP HET SPEL STAAT

   - CIJFERS ZIJN VOOR HET MANAGEMENT. finance en backoffice tonen omzet, btw
     en loonkosten. Dat hoort niet op een PDA van de bediening te staan, en
     het is de reden dat deze twee als enige van dit zestal een harde
     managercontrole hebben.
   - EEN MAILADRES VAN DE BUREN IS GEEN POSTVAK. werkmail/lees leest een
     bericht op adres; zonder de controle "is dit adres van deze zaak" leest
     de ene zaak de post van de andere.
   - EEN LIJST DIE JE MET DE VINGER AANWIJST MOET WETEN WELKE VINGER.

   WAT HIER IS RECHTGEZET

   wensen/klaar wees een wens aan met lijst[Number(req.body.index)]. Number(
   null) is 0, en JSON maakt van een ontbrekend veld precies null -- dus een
   aanroep ZONDER index vinkte stilzwijgend de eerste wens van de lijst af.
   Dat is dezelfde familie als Null Island (keuringsregel 24) en als de
   foto-index van photo/remove en pand/foto: JavaScript geeft een bruikbaar
   antwoord op iets wat geen invoer is.

   Draai los: node --test test/zaak-kantoor.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, baas, werker, buurbaas, korps, korpsBaas, office, wensZaak, wensBaas;
const OFFICE_CODE = 'KANTOORTOETS1';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kantoor-'));

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
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  base = srv.base;
  baas = await inlog('KIKUNOI', 'manager');
  werker = await inlog('KIKUNOI', 'staff');
  buurbaas = await inlog('HOSHI', 'manager');
  korpsBaas = await inlog('BOMBERS', 'manager');
  korps = korpsBaas;
  assert.ok(baas && werker && buurbaas, 'de zaken staan klaar');

  /* Een zaak MET wensen. De wensenlijst ontstaat alleen uit de behoeften van
     een bedrijfsaanmelding, en zonder zo'n zaak nam toets 2 hieronder de lege-
     lijst-uitgang -- en bewees dan niets over de index. Dat is precies de vorm
     die ik deze week vaker tegenkwam, dus hier de echte opzet. */
  office = (await api('/api/office/login', { code: OFFICE_CODE })).body.token;
  const aanvraag = await api('/api/aanmelding/aanvraag', {
    pas: 'rtg', naam: 'Marta Vidal', contact: 'marta' + Date.now().toString(36) + '@voorbeeld.test',
    bedrijf: { naam: 'Cafe Vidal', type: 'restaurant', plaats: 'Ibiza',
      behoeften: ['Een kassasysteem', 'Personeelsplanning', 'Een eigen website'] }
  });
  const aanmeldId = aanvraag.body && aanvraag.body.aanmelding && aanvraag.body.aanmelding.id;
  if (office && aanmeldId) {
    await api('/api/aanmelding/beslis', { id: aanmeldId, besluit: 'geaccepteerd', notitie: 'Rahul Imran Ismail' }, office);
    const t = await api('/api/aanmelding/termijn-voldaan', { id: aanmeldId, maand: 1 }, office);
    const gz = (t.body && t.body.zaak) || null;
    wensZaak = gz && gz.code;
    if (wensZaak && gz.pin && gz.staffId)
      wensBaas = (await api('/api/supplier/login', { code: wensZaak, staffId: gz.staffId, pin: gz.pin })).body.token;
  }
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de cijfers zijn voor het management', async () => {
  assert.equal((await api('/api/supplier/finance', {}, werker)).status, 403,
    'omzet, btw en loonkosten horen niet op de PDA van de bediening');
  assert.equal((await api('/api/supplier/backoffice', {}, werker)).status, 403);

  const f = await api('/api/supplier/finance', {}, baas);
  assert.equal(f.status, 200);
  assert.ok(f.body && typeof f.body === 'object', 'er komt een overzicht terug');

  const b = await api('/api/supplier/backoffice', {}, baas);
  assert.equal(b.status, 200, JSON.stringify(b.body).slice(0, 200));
  /* De backoffice liep ooit op 500 omdat niet elke betaalde boeking een genest
     service-object heeft: ticket- en verblijfboekingen dragen alleen een kind.
     Dat staat als waarschuwing boven de route, dus het hoort ook in een toets:
     een 200 op een gevulde zaak is precies wat die regel bewaakt. */
  assert.notEqual(b.status, 500, 'de backoffice valt niet om op een boeking zonder service-object');
});

test('2. een wens afvinken vraagt om een index, en niet om niets', async () => {
  // een lege lijst heeft geen eerste wens; dat geldt voor elke index
  assert.equal((await api('/api/supplier/wensen/klaar', { index: 0 }, baas)).status, 404,
    'de zaak zonder wensen heeft er ook geen eerste');

  assert.ok(wensBaas, 'de zaak met wensen staat klaar (anders bewijst deze toets niets)');
  const eerst = await api('/api/supplier/wensen', {}, wensBaas);
  assert.equal(eerst.status, 200);
  const wensen = eerst.body.wensen || [];
  assert.ok(wensen.length >= 2, 'er staan echte wensen op de lijst (' + wensen.length + ')');
  const beginStatus = wensen[0].status;
  const baas2 = wensBaas;

  /* DE RECHTZETTING. Zonder index kwam Number(undefined) op NaN uit maar
     Number(null) op 0 -- en JSON maakt van een ontbrekend veld null. Een
     aanroep zonder index vinkte dus stilzwijgend de eerste wens af. */
  const zonder = await api('/api/supplier/wensen/klaar', {}, baas2);
  assert.equal(zonder.status, 404, 'zonder index valt er niets af te vinken');
  assert.equal((await api('/api/supplier/wensen', {}, baas2)).body.wensen[0].status, beginStatus,
    'en de eerste wens is niet stilletjes van stand veranderd');

  assert.equal((await api('/api/supplier/wensen/klaar', { index: null }, baas2)).status, 404, 'null is geen index');
  assert.equal((await api('/api/supplier/wensen/klaar', { index: -1 }, baas2)).status, 404, 'en een negatieve ook niet');
  assert.equal((await api('/api/supplier/wensen/klaar', { index: 9999 }, baas2)).status, 404);
  assert.equal((await api('/api/supplier/wensen/klaar', { index: 'twee' }, baas2)).status, 404);

  // met een echte index is het gewoon een schakelaar
  const aan = await api('/api/supplier/wensen/klaar', { index: 0 }, baas2);
  assert.equal(aan.status, 200);
  assert.notEqual(aan.body.wensen[0].status, beginStatus, 'de stand is om');
  const terug = await api('/api/supplier/wensen/klaar', { index: 0 }, baas2);
  assert.equal(terug.body.wensen[0].status, beginStatus, 'en weer terug');
});

test('3. de zakelijke post van de buren is geen postvak van jou', async () => {
  const mijn = await api('/api/supplier/werkmail/adressen', {}, baas);
  const adressen = mijn.body.adressen || mijn.body.lijst || [];
  const eigen = (adressen[0] && (adressen[0].adres || adressen[0])) || null;

  assert.equal((await api('/api/supplier/werkmail/lees', { adres: 'iemand@buurzaak.rtg', id: 'x' }, baas)).status, 403,
    'een adres dat niet van deze zaak is');
  assert.equal((await api('/api/supplier/werkmail/lees', { adres: '', id: 'x' }, baas)).status, 403,
    'en een leeg adres is geen adres van deze zaak');

  if (eigen) {
    /* Het eigen adres mag wel benaderd worden; dat er geen bericht met dit id
       is, is een ander soort nee dan "dit adres is niet van u". Het verschil
       tussen 403 en 404 is hier het verschil tussen "u hoort hier niet" en
       "hier staat niets". */
    const r = await api('/api/supplier/werkmail/lees', { adres: eigen, id: 'bestaatniet' }, baas);
    assert.notEqual(r.status, 403, 'het eigen adres is wel van deze zaak (kreeg ' + r.status + ')');
    assert.equal((await api('/api/supplier/werkmail/lees', { adres: eigen, id: 'x' }, buurbaas)).status, 403,
      'en de buurzaak komt er niet bij');
  }
});

test('4. de keten is voor hulpdiensten en zorg, niet voor een restaurant', async () => {
  const nee = await api('/api/supplier/keten/status', {}, baas);
  assert.equal(nee.status, 403, 'een restaurant zit niet in de hulpverleningsketen');
  assert.match(nee.body.error, /hulpdiensten|zorg/i);

  if (korps) {
    const ja = await api('/api/supplier/keten/status', {}, korps);
    assert.equal(ja.status, 200, JSON.stringify(ja.body).slice(0, 200));
    assert.ok(Array.isArray(ja.body.kanalen), 'een korps ziet zijn kanalen');
  }
});

test('5. het intakeformulier zet de eigenaar, en het blijft van de eigen zaak', async () => {
  assert.equal((await api('/api/supplier/onboarding/zet', { voorstel: { titel: 'Aanmelden' } }, werker)).status, 403,
    'het intakeformulier is geen knop voor de bediening');

  const z = await api('/api/supplier/onboarding/zet',
    { voorstel: { titel: 'Welkom bij Sal de Mar', velden: [{ id: 'allergie', label: 'Allergieën', soort: 'tekst' }] } }, baas);
  assert.equal(z.status, 200, JSON.stringify(z.body).slice(0, 200));

  const mijn = await api('/api/supplier/onboarding/config', {}, baas);
  assert.equal(mijn.status, 200);
  assert.ok(mijn.body.config, 'de eigen zaak heeft een configuratie');

  /* De configuratie hangt aan de zaakcode, dus de buren zien iets anders. Zou
     hij aan een gedeelde sleutel hangen, dan schreef de ene zaak het
     aanmeldformulier van de andere. */
  const buur = await api('/api/supplier/onboarding/config', {}, buurbaas);
  assert.notDeepEqual(buur.body.config, mijn.body.config, 'de buurzaak heeft zijn eigen formulier');
});

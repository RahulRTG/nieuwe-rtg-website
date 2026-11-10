/* ============================================================================
   CIVILIS-OPVANG: de eerste maatschappelijke verticale keten.

   Deze proef bewijst softwaregedrag op een wegwerpserver. Zij bewijst NIET dat
   er in de buitenwereld een opvangorganisatie aangesloten is of een bed staat;
   die externe acceptatie blijft een afzonderlijke vrijgavevoorwaarde.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-civilis-opvang-'));
const OFFICE_CODE = 'CIVILIS-OPVANG-KEURING';
let srv, BASE, LAND, STAD, PARTNER, PARTNERCODE, PARTNERTOKEN, VOORZIENING;

const post = (pad, body, tok) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const kantoor = (pad, body) => post('/api/rtfos/' + pad, body, LAND);
const deur = (pad, body) => post('/api/bescherming/deur/' + pad, body);
const partner = (pad, body) => post('/api/rtfos/portaal/partner/opvang' + pad,
  Object.assign({ code: PARTNERCODE }, body || {}), PARTNERTOKEN);

async function maakPartner(naam, mail) {
  const p = await kantoor('partner/maak', { stad: STAD, naam });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  await kantoor('partner/zet', { id: p.body.partner.id, bevoegdheden: ['opvang'] });
  await kantoor('partner/document', { id: p.body.partner.id, soort: 'overeenkomst', naam: 'Samenwerking opvang' });
  await kantoor('partner/status', { id: p.body.partner.id, status: 'actief' });
  const a = await post('/api/auth/register', { name: naam + ' medewerker', email: mail,
    password: 'geheim123', geboortedatum: '1985-01-01', pasApp: 'rtg' });
  assert.ok(a.body.token, JSON.stringify(a.body));
  return { id: p.body.partner.id, code: p.body.partner.code, token: a.body.token };
}

async function zaakTotStabilisatie() {
  const s = await deur('start', { stad: STAD, aanleiding: 'dakloos', nuVeilig: true,
    kanMeekijken: false, bewaren: 'alleen_dat' });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  const lijst = await post('/api/rtfos/bescherming/zaken', { stad: STAD }, LAND);
  const id = lijst.body.zaken[0].id;
  await post('/api/rtfos/bescherming/stand', { id, naar: 'minimaal' }, LAND);
  await post('/api/rtfos/bescherming/stand', { id, naar: 'toestemming' }, LAND);
  await post('/api/rtfos/bescherming/toestemming', { id, ontvanger: PARTNER,
    tekst: 'De opvangaanbieder mag weten dat ik vannacht een veilige plek nodig heb.' }, LAND);
  const stab = await post('/api/rtfos/bescherming/stand', { id, naar: 'stabilisatie' }, LAND);
  assert.equal(stab.status, 200, JSON.stringify(stab.body));
  return { id, code: s.body.code };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  BASE = srv.base;
  LAND = await kantoorAlsPersoon(BASE);
  const s = await kantoor('stad/maak', { naam: 'Haarlem' });
  STAD = s.body.stad.id;
  await kantoor('stad/status', { id: STAD, status: 'actief' });
  await kantoor('stad/module', { id: STAD, vlag: 'individual_cases', aan: true });
  const p = await maakPartner('Veilige Nacht Haarlem', 'opvang.partner@civilis.test');
  PARTNER = 'Veilige Nacht Haarlem'; PARTNERCODE = p.code; PARTNERTOKEN = p.token;
  const v = await kantoor('opvang/voorziening/maak', { partnerId: p.id,
    naam: 'Nachtopvang Centrum', soort: 'nachtopvang' });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  VOORZIENING = v.body.voorziening.id;
});
test.after(() => { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('alle muterende opvangroutes weigeren een onbevoegde aanroep', async () => {
  const routes = [
    '/api/rtfos/opvang/voorzieningen',
    '/api/rtfos/opvang/voorziening/maak',
    '/api/rtfos/opvang/aanvraag',
    '/api/rtfos/opvang/vervolgplan',
    '/api/rtfos/portaal/partner/opvang/capaciteit',
    '/api/rtfos/portaal/partner/opvang/aankomst'
  ];
  for (const route of routes) {
    const response = await post(route, {});
    assert.ok(response.status === 401 || response.status === 403,
      route + ' liet een onbevoegde aanroep door of bestaat niet: ' + response.status);
  }
});

test('geen schijnbevestiging: aanvraag, actuele capaciteit en aanbiederacceptatie zijn drie stappen', async () => {
  const z = await zaakTotStabilisatie();
  const a = await kantoor('opvang/aanvraag', { zaakId: z.id, voorzieningId: VOORZIENING,
    financiering: 'nood_voor_besluit', noodreden: 'Vannacht geen veilige slaapplek.',
    idempotentie: 'opvang-' + z.id });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.body.reservering.status, 'aangevraagd');
  assert.match(a.body.melding, /nog geen bevestigde plek/i);

  const nogEens = await kantoor('opvang/aanvraag', { zaakId: z.id, voorzieningId: VOORZIENING,
    financiering: 'nood_voor_besluit', noodreden: 'Vannacht geen veilige slaapplek.',
    idempotentie: 'opvang-' + z.id });
  assert.equal(nogEens.status, 200);
  assert.equal(nogEens.body.herhaald, true, 'dezelfde intentie maakte een tweede aanvraag');
  assert.equal(nogEens.body.reservering.id, a.body.reservering.id);

  const teVroeg = await partner('/besluit', { id: a.body.reservering.id, accepteer: true });
  assert.equal(teVroeg.status, 409, 'aanbieder bevestigde zonder actuele capaciteit');

  const geldigTot = new Date(Date.now() + 4 * 3600000).toISOString();
  const cap = await partner('/capaciteit', { voorzieningId: VOORZIENING, beschikbaar: 1, geldigTot });
  assert.equal(cap.status, 200, JSON.stringify(cap.body));
  const akkoord = await partner('/besluit', { id: a.body.reservering.id, accepteer: true });
  assert.equal(akkoord.status, 200, JSON.stringify(akkoord.body));
  assert.equal(akkoord.body.reservering.status, 'geaccepteerd');

  const stand = await deur('stand', { code: z.code });
  assert.equal(stand.body.route.fase, 'plek_bevestigd');
  assert.match(stand.body.route.uitleg, /bevestigd/);
  assert.ok(!JSON.stringify(stand.body).includes(PARTNER), 'de publieke code verklapt de opvangorganisatie');

  const aan = await partner('/aankomst', { id: a.body.reservering.id });
  assert.equal(aan.status, 200, JSON.stringify(aan.body));
  assert.equal(aan.body.reservering.status, 'aangekomen');
  const vervolg = await kantoor('opvang/vervolgplan', { id: a.body.reservering.id,
    doel: 'Een duurzame woonplek en stabiel inkomen.',
    volgendeActie: 'Samen het briefadres en de woonroute bespreken.', op: '2026-11-12' });
  assert.equal(vervolg.status, 200, JSON.stringify(vervolg.body));
  assert.equal(vervolg.body.reservering.status, 'vervolg');
});

test('intrekken stopt een geaccepteerde plek en geeft capaciteit terug', async () => {
  const z = await zaakTotStabilisatie();
  const geldigTot = new Date(Date.now() + 4 * 3600000).toISOString();
  await partner('/capaciteit', { voorzieningId: VOORZIENING, beschikbaar: 1, geldigTot });
  const a = await kantoor('opvang/aanvraag', { zaakId: z.id, voorzieningId: VOORZIENING,
    financiering: 'niet_vereist', idempotentie: 'intrek-' + z.id });
  await partner('/besluit', { id: a.body.reservering.id, accepteer: true });

  const weg = await deur('intrekken', { code: z.code, reden: 'Ik wil dit niet meer.' });
  assert.equal(weg.status, 200);
  const lijst = await kantoor('opvang/voorzieningen', { stad: STAD });
  const r = lijst.body.reserveringen.find(x => x.id === a.body.reservering.id);
  const v = lijst.body.voorzieningen.find(x => x.id === VOORZIENING);
  assert.equal(r.status, 'ingetrokken');
  assert.equal(v.capaciteit.beschikbaar, 1, 'de gereserveerde plaats kwam niet terug');
});

test('weigeren vraagt een reden en zet de burgerroute op een menselijk alternatief', async () => {
  const z = await zaakTotStabilisatie();
  const a = await kantoor('opvang/aanvraag', { zaakId: z.id, voorzieningId: VOORZIENING,
    financiering: 'niet_vereist', idempotentie: 'weigering-' + z.id });
  const zonderReden = await partner('/besluit', { id: a.body.reservering.id, accepteer: false });
  assert.equal(zonderReden.status, 400);
  const nee = await partner('/besluit', { id: a.body.reservering.id, accepteer: false,
    reden: 'Vanavond is deze voorziening niet passend.' });
  assert.equal(nee.status, 200, JSON.stringify(nee.body));
  assert.equal(nee.body.reservering.status, 'geweigerd');
  const stand = await deur('stand', { code: z.code });
  assert.equal(stand.body.route.fase, 'alternatief_nodig');
  assert.match(stand.body.route.uitleg, /alternatief/);
});

test('een verlopen acceptatie kan niet meer als aankomst worden bevestigd', async () => {
  const z = await zaakTotStabilisatie();
  const geldigTot = new Date(Date.now() + 2000).toISOString();
  await partner('/capaciteit', { voorzieningId: VOORZIENING, beschikbaar: 1, geldigTot });
  const a = await kantoor('opvang/aanvraag', { zaakId: z.id, voorzieningId: VOORZIENING,
    financiering: 'niet_vereist', idempotentie: 'verval-' + z.id });
  const akkoord = await partner('/besluit', { id: a.body.reservering.id, accepteer: true });
  assert.equal(akkoord.status, 200, JSON.stringify(akkoord.body));
  await new Promise(resolve => setTimeout(resolve, 2100));
  const teLaat = await partner('/aankomst', { id: a.body.reservering.id });
  assert.equal(teLaat.status, 409);
  const lijst = await kantoor('opvang/voorzieningen', { stad: STAD });
  assert.equal(lijst.body.reserveringen.find(x => x.id === a.body.reservering.id).status, 'vervallen');
});

test('een andere partner ziet en beslist niets van deze opvangaanvragen', async () => {
  const ander = await maakPartner('Andere Opvang', 'andere.partner@civilis.test');
  const lijst = await post('/api/rtfos/portaal/partner/opvang', { code: ander.code }, ander.token);
  assert.equal(lijst.status, 200, JSON.stringify(lijst.body));
  assert.equal(lijst.body.reserveringen.length, 0);
  const eigen = await partner('', {});
  const id = eigen.body.reserveringen[0].id;
  const poging = await post('/api/rtfos/portaal/partner/opvang/besluit',
    { code: ander.code, id, accepteer: false, reden: 'Niet onze aanvraag.' }, ander.token);
  assert.equal(poging.status, 404);
});

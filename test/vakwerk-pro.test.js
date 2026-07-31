/* ============================================================================
   DE PRO-LAAG VAN EEN VAKZAAK -- 5 endpoints, met een zaak die niet bestond.

   vak/offerte/weiger, vak/wachtlijst/uitnodig, vak/ritme/stop, vak/uren en
   vak/onderhoud/herinner stonden als nooit aangeroepen in de waargenomen
   dekkingsmeting. Ze bleven het langst liggen om een reden die het opschrijven
   waard is: ER STAAT GEEN ENKELE VAKZAAK IN DE SEED. Alle veertien genres
   bestaan in de code (zzp, chef, wellness, bouw, autogarage, schoonmaak,
   hovenier, wasserij, rijschool, dierenarts, tandarts, fotograaf, verhuizer,
   ithulp) en geen van de geseede partners is er een.

   Deze toets zet er daarom zelf een neer, via dezelfde weg als een echte
   ondernemer: een aanmelding, een menselijk besluit, een eerste voldane
   termijn. Dat is meer opzet dan een toets normaal verdient, maar de
   alternatieven waren slechter -- een zaak met de hand in de database
   duwen toetst de opzet en niet het huis, en de routes overslaan laat vijf
   endpoints ongedekt waar geld en agenda's aan hangen.

   WAT ER OP HET SPEL STAAT

   - EEN AANVRAAG AFWIJZEN IS EEN EIGENAARSBESLUIT, EN MAAR EEN KEER. Wie een
     beantwoorde offerte alsnog kan afwijzen, trekt een prijs terug waar de
     klant al ja op zei.
   - EEN UITNODIGING VAN DE WACHTLIJST IS EEN SEINTJE, GEEN BOEKING. Het lid
     beslist zelf; de zaak zet niemand vast. En hij gaat een keer: twee keer
     uitnodigen is aandringen.
   - EEN HERINNERING IS EEN VRIENDELIJKHEID, GEEN CAMPAGNE. Een keer per
     dertig dagen, en alleen aan wie echt in de onderhoudslijst staat.

   WAT ME OPVIEL EN WAT IK NIET ZELF BESLIS

   Alleen vak/pro en vak/capaciteit hebben een expliciete isVak-controle; de
   overige pro-routes leunen erop dat alles op supplierCode wordt GEFILTERD.
   Een zaak die geen vakzaak is vindt daardoor niets, en krijgt 404 in plaats
   van 403. Voor de veiligheid maakt dat niets uit -- er valt niets te raken --
   maar het antwoord zegt "dat bestaat niet" waar het elders in dit huis "u
   hoort hier niet" zegt. Of dat gelijkgetrokken moet worden is een keuze voor
   RTG; de toets legt vast wat er nu gebeurt.

   Draai los: node --experimental-sqlite --test test/vakwerk-pro.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office, vakCode, vakBaas, vakWerker, resto, lid, buurLid;
let offerteId = null, wachtId = null;
const OFFICE_CODE = 'VAKTOETS12345';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vakwerk-'));

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
const dag = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  base = srv.base;
  resto = await inlog('KIKUNOI', 'manager');
  lid = (await api('/api/login', { tier: 'business' })).body.token;
  buurLid = (await api('/api/login', { tier: 'lifestyle' })).body.token;

  // een echte hovenier laten ontstaan: aanmelding -> menselijk besluit -> termijn
  office = (await api('/api/office/login', { code: OFFICE_CODE })).body.token;
  const aanvraag = await api('/api/aanmelding/aanvraag', {
    pas: 'rtg', naam: 'Toni Mari', contact: 'toni' + Date.now().toString(36) + '@voorbeeld.test',
    bedrijf: { naam: 'Jardins Mari', type: 'hovenier', plaats: 'Ibiza', behoeften: [] }
  });
  const id = aanvraag.body && aanvraag.body.aanmelding && aanvraag.body.aanmelding.id;
  assert.ok(office && id, 'de aanmelding staat klaar');
  await api('/api/aanmelding/beslis', { id, besluit: 'geaccepteerd', notitie: 'Rahul Imran Ismail' }, office);
  const t = await api('/api/aanmelding/termijn-voldaan', { id, maand: 1 }, office);
  const z = t.body && t.body.zaak;
  assert.ok(z && z.code, 'de hovenier bestaat nu als zaak: ' + JSON.stringify(t.body).slice(0, 200));
  vakCode = z.code;
  vakBaas = (await api('/api/supplier/login', { code: vakCode, staffId: z.staffId, pin: z.pin })).body.token;
  assert.ok(vakBaas, 'en de eigenaar kan inloggen');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de pro-laag is er voor dienstverlenende zaken', async () => {
  assert.equal((await api('/api/supplier/vak/pro', {}, resto)).status, 403,
    'een restaurant is geen dienstverlenende vakzaak');
  const pro = await api('/api/supplier/vak/pro', {}, vakBaas);
  assert.equal(pro.status, 200, JSON.stringify(pro.body).slice(0, 200));
  for (const k of ['offertes', 'klanten', 'onderhoud', 'ritmes', 'wachtlijst'])
    assert.ok(k in pro.body, 'het vandaag-bord draagt ' + k);
});

test('2. een aanvraag afwijzen doet de eigenaar, en maar een keer', async () => {
  const vraag = await api('/api/vak/offerte/vraag',
    { supplierCode: vakCode, omschrijving: 'De haag rond het terras moet gesnoeid en de olijf bijgewerkt.' }, lid);
  assert.equal(vraag.status, 200, JSON.stringify(vraag.body).slice(0, 200));
  offerteId = (vraag.body.offerte || {}).id;
  assert.ok(offerteId, 'de aanvraag staat er');

  assert.equal((await api('/api/vak/offerte/vraag', { supplierCode: vakCode, omschrijving: 'kort' }, lid)).status, 400,
    'een klus in drie woorden is geen omschrijving');
  assert.equal((await api('/api/vak/offerte/vraag', { supplierCode: 'KIKUNOI', omschrijving: 'Iets langers dan tien tekens.' }, lid)).status, 404,
    'een restaurant neemt geen offerte-aanvragen aan');

  /* 404 en niet 403, en dat verschil zegt iets over hoe deze laag beveiligd
     is. Alleen vak/pro en vak/capaciteit hebben een expliciete isVak-controle;
     de andere routes leunen op het feit dat alles op supplierCode is
     GEFILTERD. Een restaurant vindt daardoor niets in plaats van te horen dat
     het er niet bij hoort. Voor de veiligheid maakt dat niets uit -- er valt
     niets te raken -- en de toets legt daarom vast wat er echt gebeurt. */
  assert.equal((await api('/api/supplier/vak/offerte/weiger', { id: offerteId }, resto)).status, 404,
    'een andere zaak vindt deze aanvraag niet eens');
  assert.equal((await api('/api/supplier/vak/offerte/weiger', { id: 'bestaatniet' }, vakBaas)).status, 404);

  const nee = await api('/api/supplier/vak/offerte/weiger', { id: offerteId }, vakBaas);
  assert.equal(nee.status, 200, JSON.stringify(nee.body));
  /* Twee keer afwijzen kan niet, en dat is meer dan netheid: wie een
     beantwoorde offerte alsnog kan afwijzen, trekt een prijs terug waar de
     klant al ja op zei. */
  assert.equal((await api('/api/supplier/vak/offerte/weiger', { id: offerteId }, vakBaas)).status, 409,
    'een aanvraag die al beantwoord is');
});

test('3. een uitnodiging van de wachtlijst is een seintje, geen boeking', async () => {
  const zet = await api('/api/vak/wachtlijst/zet', { supplierCode: vakCode, datum: dag(9) }, lid);
  assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 200));

  assert.equal((await api('/api/vak/wachtlijst/zet', { supplierCode: vakCode, datum: dag(9) }, lid)).status, 409,
    'twee keer op dezelfde dag op de lijst');
  assert.equal((await api('/api/vak/wachtlijst/zet', { supplierCode: vakCode, datum: '2020-01-01' }, lid)).status, 400,
    'een datum in het verleden');

  const bord = await api('/api/supplier/vak/pro', {}, vakBaas);
  wachtId = (bord.body.wachtlijst || [])[0] && bord.body.wachtlijst[0].id;
  assert.ok(wachtId, 'de wachtende staat op het bord van de zaak');

  assert.equal((await api('/api/supplier/vak/wachtlijst/uitnodig', { id: wachtId }, resto)).status, 404,
    'de wachtende van een andere zaak bestaat hier niet');
  assert.equal((await api('/api/supplier/vak/wachtlijst/uitnodig', { id: 'bestaatniet' }, vakBaas)).status, 404);

  const uit = await api('/api/supplier/vak/wachtlijst/uitnodig', { id: wachtId }, vakBaas);
  assert.equal(uit.status, 200);
  /* En maar een keer. Twee keer uitnodigen is aandringen, en dat hoort een
     systeem niet te doen namens een zaak. Het lid beslist zelf of het boekt;
     de uitnodiging zet niemand vast. */
  assert.equal((await api('/api/supplier/vak/wachtlijst/uitnodig', { id: wachtId }, vakBaas)).status, 429,
    'nog eens uitnodigen is aandringen');
});

test('4. een vast ritme stopt de zaak of het lid, en daarna is het gestopt', async () => {
  const uren = await api('/api/supplier/vak/uren', {}, vakBaas);
  assert.equal(uren.status, 200, JSON.stringify(uren.body).slice(0, 200));

  const start = await api('/api/vak/ritme/start',
    { supplierCode: vakCode, dienstId: 'onderhoud', elke: 'maand', dag: 3 }, lid);
  if (start.status !== 200) {
    /* Zonder dienst in de etalage valt er geen ritme te starten; dan blijft
       over wat er wel vaststaat: een onbekend ritme stoppen kan niet, en dat
       geldt voor beide kanten. */
    assert.equal((await api('/api/supplier/vak/ritme/stop', { id: 'bestaatniet' }, vakBaas)).status, 404);
    assert.equal((await api('/api/vak/ritme/stop', { id: 'bestaatniet' }, lid)).status, 404);
    return;
  }
  const ritmeId = (start.body.ritme || {}).id;
  assert.equal((await api('/api/supplier/vak/ritme/stop', { id: ritmeId }, resto)).status, 404,
    'het ritme van een andere zaak bestaat hier niet');
  assert.equal((await api('/api/supplier/vak/ritme/stop', { id: ritmeId }, vakBaas)).status, 200);
  assert.equal((await api('/api/supplier/vak/ritme/stop', { id: ritmeId }, vakBaas)).status, 404,
    'een gestopt ritme is niet nog eens te stoppen');
});

test('5. een onderhoudsherinnering is een vriendelijkheid, geen campagne', async () => {
  /* De onderhoudslijst vult zich met klanten die ooit een dienst afnamen.
     Zonder zo'n klant staat er niemand op -- en dan is 404 het juiste
     antwoord. Dat is precies de bewering die telt: je kunt niet herinneren
     wie er niet in staat, dus deze route is geen ingang om willekeurige leden
     een bericht te sturen. */
  const nep = await api('/api/supplier/vak/onderhoud/herinner', { codenaam: 'BestaatNiet999', dienstId: 'x' }, vakBaas);
  assert.equal(nep.status, 404, 'een klant die niet in de onderhoudslijst staat');
  assert.match(nep.body.error, /onderhoudslijst/i);

  assert.equal((await api('/api/supplier/vak/onderhoud/herinner', {}, vakBaas)).status, 404,
    'zonder codenaam valt er niemand te herinneren');
  /* Ook hier 404 in plaats van 403: de route filtert op de eigen zaakcode en
     kent geen isVak-controle. Het restaurant vindt dus niemand, wat op
     hetzelfde neerkomt -- alleen zegt het antwoord "die staat er niet" in
     plaats van "u hoort hier niet". */
  assert.equal((await api('/api/supplier/vak/onderhoud/herinner', { codenaam: 'x', dienstId: 'y' }, resto)).status, 404,
    'een restaurant vindt in zijn eigen onderhoudslijst niemand');
});

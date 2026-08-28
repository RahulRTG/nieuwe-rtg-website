/* De toegangseis voor nieuwe partners: een partnerplek vraag je aan ALS LID,
   met een ZAKELIJKE pas. Het kantoor geeft ook alleen een code uit bij een
   aanvraag met ledenbewijs.

   HIER STOND "ELKE PAS TELT", EN DAT IS OP 20 AUGUSTUS 2026 VERVANGEN. De
   redenering eronder klopte wel: de poort eiste toen DE Business Pass, en die
   is sinds de ladder vanaf 5.000 euro per maand -- dus sloot hij het restaurant
   met acht man buiten, precies de klant die MARKT.md als ingang aanwijst. Het
   antwoord daarop was eerst "dan telt elke pas", en dat was twee dagen later
   niet meer nodig: COMMERCIE.md 3b maakt RTG Business Lite (150 euro) de
   partnerpoort, en dat is de trede die er speciaal voor is. De poort vraagt
   sindsdien de capability `can_be_partner` en geen pas-id, zodat een volgende
   trede zichzelf niet opnieuw buitensluit.

   Een consumentenpas is dus geen bedrijf. Wie helemaal geen pas heeft, komt er
   nog steeds niet in -- die regel is niet veranderd.
   Draai: node --experimental-sqlite --test test/partnerpas.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pp-'));
let child, businessToken, rtgToken, gastToken, officeToken, eigenaarToken;
let partnerCode, partnerPin;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();
const aanvraag = extra => Object.assign({
  company: 'Bodega Norte', type: 'restaurant', city: 'Ibiza',
  contactName: 'Pep Serra', email: 'pep@bodeganorte.example', akkoord: true,
  bevoegd: true, waarheidsgetrouw: true, kvkNummer: '68750110',
  vestigingsnummer: '000037178598', bewijzen: { nvwa: 'NVWA-IBIZA-2026' }
}, extra);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  businessToken = (await json(await api('/api/login', { username: 'Rahul', password: 'Imran' }))).token;
  rtgToken = (await json(await api('/api/login', { tier: 'rtg' }))).token;
  gastToken = (await json(await api('/api/login', { tier: 'guest' }))).token;
  officeToken = (await json(await api('/api/office/login', { code: 'RTG-OFFICE' }))).token;
  eigenaarToken = (await json(await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('zonder pas geen aanvraag (en dus geen code)', async () => {
  const kaal = await api('/api/partner/apply', aanvraag());
  assert.equal(kaal.status, 403);
  assert.match((await kaal.json()).error, /pas|lid/i);
  // en een verzonnen token opent de deur evenmin
  const nep = await api('/api/partner/apply', aanvraag({ passToken: 'zomaar-wat' }));
  assert.equal(nep.status, 403);
  /* EN DE GRATIS LAAG, met een ECHTE sessie. Dit geval is het enige dat de
     paseis zelf meet: zonder token valt de aanvraag al af op "geen sessie", dus
     een eis die iedereen toelaat zou hierboven niets veranderen. Deze aanvrager
     is wel binnen, alleen zonder pas. */
  assert.ok(gastToken, 'de gratis laag kan inloggen');
  const gast = await api('/api/partner/apply', aanvraag({ company: 'Gast Onderneming', passToken: gastToken }));
  assert.equal(gast.status, 403, 'een ingelogde gast zonder pas komt er niet in');
});

test('een consumentenpas is geen bedrijf: de partnerpoort vraagt een zakelijke trede', async () => {
  const rtg = await api('/api/partner/apply', aanvraag({ company: 'Casa Marisol', passToken: rtgToken }));
  assert.equal(rtg.status, 403, 'een RTG Pass is een persoonlijke pas en geen zaak');
  const uit = await json(rtg);
  assert.match(String(uit.error || ''), /zakelijke pas/,
    'en de weigering zegt WELKE pas het wel doet, anders is 403 een doodlopende weg');
  const st = await json(await api('/api/office/state', {}, officeToken));
  const a = (st.state.partnerApplications || []).find(x => x.company === 'Casa Marisol');
  assert.equal(a, undefined, 'een geweigerde aanvraag hoort ook niet stil op het kantoor te landen');
});

test('met Business Pass: aanvraag met ledenbewijs, en het kantoor geeft de code uit', async () => {
  const ok = await api('/api/partner/apply', aanvraag({ passToken: businessToken }));
  assert.equal(ok.status, 200);
  // het kantoor ziet de aanvraag met het ledenbewijs en keurt goed
  const st = await json(await api('/api/office/state', {}, officeToken));
  const a = (st.state.partnerApplications || []).find(x => x.company === 'Bodega Norte');
  assert.ok(a && a.pas && a.pas.tier === 'business', 'het ledenbewijs zit op de aanvraag');
  assert.equal((await api('/api/office/partner/decide', { id: a.id, action: 'goedkeuren' }, officeToken)).status, 403,
    'de gedeelde kantoordeur mag geen partners toelaten');
  assert.equal((await api('/api/office/partner/decide', { id: a.id, action: 'goedkeuren' }, eigenaarToken)).status, 409,
    'ook de eigenaar kan de officiële controles niet overslaan');
  for (const eis of a.toelating.eisen) {
    const uitkomst = eis.id === 'vergunningenscan' ? 'niet_van_toepassing' : 'geverifieerd';
    const check = await api('/api/office/partner/controle', { id: a.id, onderdeel: eis.id,
      uitkomst, referentie: uitkomst === 'niet_van_toepassing' ? 'Geen extra lokale vergunning nodig' : 'Officieel register ' + eis.id }, eigenaarToken);
    assert.equal(check.status, 200, eis.id + ': ' + await check.text());
  }
  const besluit = await json(await api('/api/office/partner/decide', { id: a.id, action: 'goedkeuren' }, eigenaarToken));
  assert.ok(besluit.code || besluit.ok, 'goedkeuren levert een bedrijfscode op');
  partnerCode = besluit.code; partnerPin = besluit.pin;
});

test('een buitenlands bedrijf met wereldhandel krijgt het volledige internationale dossier', async () => {
  const wereldwijd = aanvraag({ company: 'Belgica Global Trade', type: 'zzp', city: 'Antwerpen',
    email: 'trade@belgica.example', landCode: 'BE', registratieNummer: 'BE 0123.456.789',
    registerBron: 'https://e-justice.europa.eu/topics/registers-business-insolvency-land/business-registers-search-company-eu/general-information-find-company_en',
    internationaleHandel: true, goederen: true, euBtw: true, douane: true,
    bewijzen: { vies: 'BE0123456789', eori: 'BE0123456789', goederencode: 'HS 0901 · BE naar JP' },
    passToken: businessToken });
  const ok = await api('/api/partner/apply', wereldwijd);
  assert.equal(ok.status, 200, await ok.text());
  const st = await json(await api('/api/office/state', {}, officeToken));
  const a = (st.state.partnerApplications || []).find(x => x.company === 'Belgica Global Trade');
  assert.equal(a.registratie.landCode, 'BE');
  assert.equal(a.registratie.sleutel, 'BE:BE0123456789');
  assert.equal(a.registratie.voorcontrole.status, 'handmatig');
  const ids = a.toelating.eisen.map(e => e.id);
  for (const id of ['handelsregister', 'sancties_vn', 'sancties_eu', 'handelsscope',
    'lokale_handelsregels', 'vies', 'eori', 'goederencode']) assert.ok(ids.includes(id), id);
  assert.equal((await api('/api/office/partner/decide', { id: a.id, action: 'goedkeuren' }, eigenaarToken)).status, 409,
    'ook een buitenlandse aanvraag kan de internationale controles niet overslaan');
});

test('het kantoor ziet de automatische officiële handelsbronnen en hun update-interval', async () => {
  assert.equal((await api('/api/office/partner/regels')).status, 401);
  const regels = await json(await api('/api/office/partner/regels', {}, officeToken));
  assert.equal(regels.automatisch, true);
  assert.ok(regels.bronnen.length >= 10);
  assert.ok(regels.bronnen.some(b => b.id === 'sancties_vn'));
  assert.ok(regels.bronnen.some(b => b.id === 'dual_use'));
});

/* NAAST HET LEZEN STAAT HET NAREKENEN, en dat is een zwaardere deur.
   /api/office/partner/regels lezen mag het hele kantoor; hem NU laten ophalen
   (/api/office/partner/regels/check) is boardroomwerk -- die controle kan
   immers bewijzen op hercontrole zetten en lopende toelatingen blokkeren.

   Deze toets noemt ALTIJD een bronId. Een check zonder bronId haalt alle
   officiele bronnen echt van het internet, en dat hoort een toets niet te doen;
   een bron die niet bestaat wordt afgewezen voor er ook maar een verbinding
   opengaat. Dat maakt hem tegelijk de scherpste assertie die hier zonder
   netwerk te maken is: de route moet req.body.bronId doorgeven EN de status uit
   het antwoord van de wacht overnemen. Doet hij dat laatste niet, dan zou een
   verzonnen bron een geruststellende 200 opleveren. */
test('een handelsbron narekenen is boardroomwerk, en een onbekende bron valt dicht', async () => {
  const onbekend = { bronId: 'verzonnen-bron-' + Date.now().toString(36) };

  assert.equal((await api('/api/office/partner/regels/check', onbekend)).status, 401,
    'zonder token komt niemand bij de hercontroleknop');

  const kantoor = await api('/api/office/partner/regels/check', onbekend, officeToken);
  assert.equal(kantoor.status, 403, 'een anonieme kantoorcode is geen boardroom');
  assert.match(String((await json(kantoor)).error || ''), /boardroom/i,
    'en de weigering zegt waarom, anders is 403 een doodlopende weg');

  const r = await api('/api/office/partner/regels/check', onbekend, eigenaarToken);
  assert.equal(r.status, 404,
    'de boardroom komt wel binnen; alleen bestaat deze bron niet -- en dat is geen 200');
  const uit = await json(r);
  assert.equal(uit.ok, false);
  assert.match(String(uit.error || ''), /bron/i, 'de afwijzing noemt de bron');
  assert.equal(uit.resultaten, undefined, 'een onbekende bron levert geen lezing op');

  /* En er is niets stils bijgeschreven: de bronnenlijst is de vaste lijst uit
     kern/handelsregelbronnen en groeit niet met wat een aanvrager verzint. */
  const na = await json(await api('/api/office/partner/regels', {}, officeToken));
  assert.ok(!na.bronnen.some(b => b.id === onbekend.bronId),
    'een verzonnen bron komt het bronregister niet in');
});

/* EN DAARNA HET AFTEKENEN. Een gewijzigde sanctie- of wetsbron zet bewijs op
   `hercontrole_nodig`; /api/office/partner/regels/hercontrole is de enige weg
   om dat er weer af te halen. Die knop was door de hele suite nooit aangeraakt
   (scripts/dekking.js), en dat is precies de verkeerde knop om ongetest te
   laten: hij zet een geblokkeerde toelating weer op `actueel`.

   Wat deze toets meet is de POORT, en dat is hier geen tweede keus maar het
   hele punt. De 200-tak is via HTTP namelijk niet te bereiken -- geen enkele
   zaak in `db.data.suppliers` draagt een `toelating` (partner/decide maakt de
   zaak zonder dossier aan), dus de wacht kan een levende partner nooit raken.
   Dat staat in het verslag als openstaand gat; hier wordt vastgelegd dat de
   drie deuren ervoor dicht zitten en dat de weigering een reden draagt. */
test('bewijs aftekenen na een regelwijziging is boardroomwerk, en alleen voor een dossier dat er echt op wacht', async () => {
  const pad = '/api/office/partner/regels/hercontrole';
  const lijf = { code: partnerCode, onderdeel: 'sancties_vn', referentie: 'VN-lijst opnieuw nagelopen' };
  assert.ok(partnerCode, 'de goedgekeurde zaak van hierboven bestaat');

  assert.equal((await api(pad, lijf)).status, 401,
    'zonder sessie komt niemand aan een toelatingsdossier');

  const kantoor = await api(pad, lijf, officeToken);
  assert.equal(kantoor.status, 403, 'de gedeelde kantoorcode tekent geen bewijs af');
  assert.match(String((await json(kantoor)).error || ''), /boardroom/i,
    'en de weigering zegt welke deur het wel is, anders is 403 een doodlopende weg');

  /* De boardroom komt binnen -- en loopt dan tegen de dossierpoort. Een code die
     niet bestaat is geen dossier, en het antwoord zegt dat met zoveel woorden. */
  const onbekend = await api(pad, { ...lijf, code: 'RTG-BESTAAT-NIET-' + Date.now().toString(36) }, eigenaarToken);
  assert.equal(onbekend.status, 404, 'de eigenaar komt door de deur; alleen is er geen dossier');
  const onbekendUit = await json(onbekend);
  assert.match(String(onbekendUit.error || ''), /Partnerdossier niet gevonden/);
  assert.notEqual(onbekendUit.ok, true, 'een 404 draagt geen ok:true');

  /* En de zaak die wel bestaat: die staat op geen enkele hercontrole-lijst van
     de Handelsregelwacht, dus valt er ook niets af te tekenen. De twee kanten
     horen hetzelfde te zeggen; zeggen ze dat niet, dan is er een scherm dat
     iets afvinkt wat het overzicht niet kent. */
  const regels = await json(await api('/api/office/partner/regels', {}, officeToken));
  assert.equal((regels.getroffenLeveranciers || []).some(g => g.code === partnerCode), false,
    'deze zaak wacht volgens de wacht op geen enkele hercontrole');
  const zonderOpenPunt = await api(pad, lijf, eigenaarToken);
  assert.notEqual(zonderOpenPunt.status, 200,
    'aftekenen zonder een open hercontrole hoort niet te lukken');
  const uit = await json(zonderOpenPunt);
  assert.notEqual(uit.ok, true, 'en het antwoord meldt geen geslaagde controle');
  assert.ok(typeof uit.error === 'string' && uit.error.length > 3,
    'een verhindering draagt altijd een reden (GRAMMATICA.md)');
  assert.equal(zonderOpenPunt.status, 404,
    'vandaag valt hij op de dossierpoort: een goedgekeurde zaak krijgt geen toelatingsdossier mee');
});

/* EN DAN DE LAATSTE KNOP VAN DE REGELWACHT: HET JURIDISCHE OORDEEL ZELF.
   /api/office/partner/regels/bevestig sluit een bronwijziging af met de
   vastlegging van een mens. Die route was door de hele suite nooit aangeraakt
   (scripts/dekking.js), en het is de enige plek waar een openstaande
   bronwijziging van de lijst verdwijnt.

   WAAROM DEZE TOETS ZIJN EIGEN SERVER START, en dat is geen omweg maar het
   verschil met de twee toetsen hierboven. Een gebeurtenis ONTSTAAT alleen als de
   wacht een officiele bron ophaalt en de inhoud gewijzigd ziet; dat is netwerk,
   en dat hoort een toets niet te doen. De 200-tak is met de server van dit
   bestand dus onbereikbaar, precies zoals bij /hercontrole is opgeschreven.
   Daarom krijgt deze ene toets een verse datamap met een db.json die de GEWONE
   seed is (server/seed) plus twee dingen: een openstaande bronwijziging en een
   zaak die erop wacht. Dat is letterlijk de stand waarin het kantoor deze knop
   in het echt gebruikt, en niets eraan is nagemaakt -- alleen voorgezet.

   Beweerd wordt, in de volgorde van de deuren: geen sessie (401), de gedeelde
   kantoorcode (403), de boardroom met een onbekende gebeurtenis (404), de
   boardroom zonder vastlegging (400), en dan de 200. Achter die 200 staat de
   regel die het zwaarst weegt: het oordeel van een jurist sluit de HERCONTROLE
   van de zaak niet. Zou het dat wel doen, dan versoepelt een notitie een
   grendel, en dat is precies wat kern/handelsregelwacht.js belooft te
   voorkomen. */
test('een bronwijziging bevestigen is boardroomwerk, en die notitie sluit geen enkele hercontrole', async () => {
  const MAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-regelbevestig-'));
  let eigenKind = null;
  try {
    const GEB = 'proefwijziging-vn';
    const AT = '2026-08-20T10:00:00.000Z';
    const data = require('../server/seed')();
    data.suppliers = [{
      code: 'RTG-REGELPROEF', name: 'Regelproef Handel', city: 'Antwerpen',
      registratie: { landCode: 'BE' },
      activiteiten: { regelHercontrole: { bron: 'sancties_vn', at: AT } },
      toelating: { status: 'hercontrole_nodig', eisen: [
        { id: 'sancties_vn', label: 'VN-sancties', verplicht: true, status: 'hercontrole_nodig',
          bronWijziging: { id: GEB, bron: 'sancties_vn', at: AT } },
        { id: 'eori', label: 'EORI', verplicht: true, status: 'geverifieerd',
          gecontroleerd: { door: 'user-1', at: '2026-08-01T00:00:00.000Z', referentie: 'BE0123456789' } }
      ] }
    }];
    data.handelsRegelwacht = { bronnen: {}, gebeurtenissen: [{
      id: GEB, bronId: 'sancties_vn', naam: 'VN geconsolideerde sanctielijst',
      url: 'https://main.un.org/securitycouncil/en/rss-updates-unsc-consolidated-list',
      eisen: ['sancties_vn'], at: AT, oud: 'hash-een', nieuw: 'hash-twee',
      status: 'open', aanvragen: 0, leveranciers: 1, foundationAanvragen: 0 }] };
    fs.writeFileSync(path.join(MAP, 'db.json'), JSON.stringify(data, null, 2));

    /* HANDELSREGELS_UIT zet alleen de achtergrondlus uit. Deze toets haalt
       niets op; wat hij meet is wat een mens met een AL binnengehaalde
       wijziging mag doen. */
    const eigen = await startServer({ env: { RTG_DATA_DIR: MAP, SMTP_URL: '', HANDELSREGELS_UIT: '1' } });
    eigenKind = eigen.child;
    const roep = (pad, lijf, token) => fetch(eigen.base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' },
        token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(lijf || {}) });
    const kantoor = (await json(await roep('/api/office/login', { code: 'RTG-OFFICE' }))).token;
    const baas = (await json(await roep('/api/auth/login',
      { login: 'roellie.i@gmail.com', password: 'Imran' }))).token;
    assert.ok(kantoor && baas, 'de opstelling heeft allebei de sessies nodig');

    const pad = '/api/office/partner/regels/bevestig';
    assert.equal((await roep(pad, { id: GEB, toelichting: 'Zomaar iemand.' })).status, 401,
      'zonder sessie komt niemand bij een juridisch oordeel');

    const viaKantoor = await roep(pad, { id: GEB, toelichting: 'De gedeelde kantoorcode probeert het.' }, kantoor);
    assert.equal(viaKantoor.status, 403, 'de gedeelde kantoordeur is geen boardroom');
    assert.match(String((await json(viaKantoor)).error || ''), /boardroom/i,
      'en de weigering zegt welke deur het wel is');

    const onbekend = await roep(pad, { id: 'bestaat-niet', toelichting: 'Beoordeeld.' }, baas);
    assert.equal(onbekend.status, 404, 'de boardroom komt binnen; alleen bestaat deze wijziging niet');
    assert.match(String((await json(onbekend)).error || ''), /niet gevonden/i,
      'en dat antwoord komt van de route zelf, niet van een algemene 404');

    const zonderNotitie = await roep(pad, { id: GEB }, baas);
    assert.equal(zonderNotitie.status, 400, 'een oordeel zonder vastlegging is geen oordeel');
    assert.match(String((await json(zonderNotitie)).error || ''), /vast/i,
      'een verhindering draagt altijd een reden (GRAMMATICA.md)');

    const voor = await json(await roep('/api/office/partner/regels', {}, kantoor));
    assert.equal(voor.openWijzigingen, 1, 'tot hier is er niets afgesloten');

    const ok = await roep(pad, { id: GEB,
      toelichting: 'Nieuwe vermelding gelezen; betrokken zaken opnieuw screenen.' }, baas);
    const ruw = await ok.text();
    assert.equal(ok.status, 200, ruw);
    const uit = JSON.parse(ruw);
    assert.equal(uit.ok, true);
    assert.equal(uit.gebeurtenis.status, 'beoordeeld');
    assert.match(String(uit.gebeurtenis.beoordeeld.door), /^user-\d+$/,
      'het oordeel draagt de MENS die het gaf, niet "het kantoor"');
    assert.match(uit.gebeurtenis.beoordeeld.toelichting, /opnieuw screenen/, 'en zijn eigen woorden');
    assert.ok(uit.gebeurtenis.beoordeeld.at, 'en het moment');

    const na = await json(await roep('/api/office/partner/regels', {}, kantoor));
    assert.equal(na.openWijzigingen, 0, 'de wijziging is afgesloten');
    const zaak = (na.getroffenLeveranciers || []).find(l => l.code === 'RTG-REGELPROEF');
    assert.ok(zaak, 'maar de zaak wacht nog steeds op hercontrole: een notitie versoepelt geen grendel');
    assert.deepEqual(zaak.eisen.map(e => e.id), ['sancties_vn'],
      'en alleen het bewijs dat deze bron raakte, niet het hele dossier');

    const nogmaals = await roep(pad, { id: GEB, toelichting: 'Tweede lezing met een ander verhaal.' }, baas);
    assert.equal(nogmaals.status, 200, 'nogmaals bevestigen is geen fout');
    assert.match((await json(nogmaals)).gebeurtenis.beoordeeld.toelichting, /opnieuw screenen/,
      'maar het eerste oordeel blijft staan; een tweede knopdruk schrijft er niet overheen');
  } finally {
    if (eigenKind) try { eigenKind.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(MAP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('partner schorsen trekt bestaande toegang onmiddellijk in', async () => {
  const roster = await json(await api('/api/supplier/roster', { code: partnerCode }));
  const manager = roster.staff.find(x => x.role === 'manager');
  const login = await json(await api('/api/supplier/login', { code: partnerCode, staffId: manager.id, pin: partnerPin }));
  assert.ok(login.token, 'de nieuwe manager kan voor schorsing naar binnen');
  const stop = await api('/api/office/partner/status', { code: partnerCode, status: 'geschorst', reden: 'Geautomatiseerde toegangstest' }, eigenaarToken);
  assert.equal(stop.status, 200);
  assert.equal((await api('/api/supplier/state', {}, login.token)).status, 401, 'bestaande sessie is ingetrokken');
  assert.equal((await api('/api/supplier/login', { code: partnerCode, staffId: manager.id, pin: partnerPin })).status, 403, 'nieuwe toegang blijft dicht');
  assert.equal((await api('/api/office/partner/status', { code: partnerCode, status: 'actief' }, eigenaarToken)).status, 200, 'boardroom kan een schorsing gecontroleerd opheffen');
});

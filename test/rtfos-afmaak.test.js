/* ============================================================================
   DE LAATSTE TWEE INGANGEN, EN DE ROUTE DIE NOG GEEN TOETS HAD

   1. DE VELD-APP van de medewerker. Het verschil met het kantoorscherm is niet
      het formaat maar de BLIK: hij ziet uitsluitend wat aan hem is toegewezen.
      Een medewerker die alle hulpvragen van de stad kan doorbladeren is een lek
      dat er niet hoeft te zijn -- in een buurthuis kent iedereen elkaar.
      En hij rondt niet af: dat zet de bewaartermijn in gang en sluit de zaak.

   2. HET DONATEURSPORTAAL. Twee vragen: wat gaf ik, en waar ging het heen.
      Nooit wie er nog meer gaf (dat is de adressenlijst van iemand anders), en
      nooit op mensniveau. Het giftbewijs zegt wat het IS: bij sponsoring staat
      er geen bewijs maar de reden, en "periodiek" alleen met een vastgelegde
      overeenkomst van ten minste vijf jaar -- anders kost dit scherm de gever
      geld bij zijn aangifte.

   3. /api/rtfos/publiek/campagnes was de laatste rtfos-route zonder toets.
      Hij staat hier omdat een route die nergens wordt aangeraakt, groen blijft
      bij elke fout die erin komt.

   Draai los: node --test test/rtfos-afmaak.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfosaf-'));
const OFFICE_CODE = 'RTFOSAF-KEURING';

let srv, BASE, LAND, WERKER, STAD, PROJECT, CASUS, ANDERE, KEY_WERKER;

const post = (pad, body, tok) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const os_ = (pad, body, tok) => post('/api/rtfos/' + pad, body, tok || LAND);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  BASE = srv.base;
  LAND = await kantoorAlsPersoon(BASE);
  assert.ok(LAND, 'geen kantoorsessie');

  STAD = (await os_('stad/maak', { naam: 'Zaanstad' })).body.stad.id;
  await os_('stad/status', { id: STAD, status: 'actief' });
  for (const vlag of ['individual_cases', 'donations', 'youth_programs']) {
    await os_('stad/module', { id: STAD, vlag, aan: true });
  }
  // een medewerker: de laagste rol, met opzet -- die heeft geen casus.lezen
  const reg = await post('/api/auth/register', { name: 'Medewerker Fatima', email: 'mf@rtfosaf.test',
    phone: '0612345688', password: 'geheim123', geboortedatum: '1992-01-01', pasApp: 'rtg' });
  await post('/api/account/koppel', { soort: 'kantoor', code: OFFICE_CODE }, reg.body.token);
  WERKER = (await post('/api/account/start', { rol: 'kantoor' }, reg.body.token)).body.token;
  KEY_WERKER = (await os_('ik', {}, WERKER)).body.key;
  await os_('zetel', { stad: STAD, key: KEY_WERKER, naam: 'Fatima', rol: 'medewerker' });

  const p = await os_('project/maak', { stad: STAD, naam: 'Huiswerkklas Zaandam', soort: 'jongeren',
    budget: 700, doelgroep: 'jongeren 12-18' });
  PROJECT = p.body.project.id;
  for (const st of ['aanvraag', 'beoordeling', 'goedgekeurd', 'actief']) {
    await os_('project/status', { id: PROJECT, status: st });
  }
  CASUS = (await os_('casus/maak', { stad: STAD, soort: 'voedsel', urgentie: 'hoog', wijk: 'Poelenburg',
    vraag: 'geen geld voor eten deze week', contact: 'Aisha M., Zonnelaan 4, 0655544433' })).body.casus.id;
  ANDERE = (await os_('casus/maak', { stad: STAD, soort: 'schoolspullen', urgentie: 'middel',
    vraag: 'schoolspullen voor twee kinderen', contact: 'Peter G., 0699988877' })).body.casus.id;
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ------------------------------------------------------------------------- */
test('de veld-app toont alleen wat is toegewezen, en niets van de rest van de stad', async () => {
  const leeg = await os_('veld/lijst', {}, WERKER);
  assert.equal(leeg.status, 200);
  assert.equal(leeg.body.aantal, 0, 'de medewerker zag hulpvragen zonder toewijzing');

  const dicht = await os_('veld/hulpvraag', { id: CASUS }, WERKER);
  assert.equal(dicht.status, 403);
  assert.match(dicht.body.error, /niet aan u toegewezen/);

  // toewijzen aan iemand zonder zetel in deze stad kan niet
  const buiten = await os_('casus/toewijzen', { id: CASUS, key: 'user-bestaatniet' });
  assert.equal(buiten.status, 400);
  assert.match(buiten.body.error, /geen zetel in deze stadsafdeling/);

  const toe = await os_('casus/toewijzen', { id: CASUS, key: KEY_WERKER });
  assert.equal(toe.status, 200);

  const lijst = await os_('veld/lijst', {}, WERKER);
  assert.equal(lijst.body.aantal, 1, 'de toegewezen hulpvraag stond niet in de lijst');
  assert.equal(lijst.body.hulpvragen[0].codenaam.length > 0, true);

  // de andere hulpvraag in dezelfde stad blijft dicht
  const ander = await os_('veld/hulpvraag', { id: ANDERE }, WERKER);
  assert.equal(ander.status, 403, 'een niet-toegewezen hulpvraag in dezelfde stad ging open');

  // en intrekken sluit hem weer
  await os_('casus/toewijzen', { id: CASUS, key: KEY_WERKER, weg: true });
  assert.equal((await os_('veld/hulpvraag', { id: CASUS }, WERKER)).status, 403,
    'na het intrekken van de toewijzing bleef het dossier open');
  await os_('casus/toewijzen', { id: CASUS, key: KEY_WERKER });
});

/* ------------------------------------------------------------------------- */
test('het adres opent apart en komt in het auditspoor, ook vanuit de veld-app', async () => {
  const voor = (await os_('audit', { wat: 'casus.contact-open' })).body.totaal;

  const a = await os_('veld/adres', { id: CASUS }, WERKER);
  assert.equal(a.status, 200);
  assert.match(a.body.contact, /Zonnelaan/, 'het adres kwam niet uit de kluis');

  const na = await os_('audit', { wat: 'casus.contact-open' });
  assert.equal(na.body.totaal, voor + 1, 'het openen van het adres kwam niet in het auditspoor');
  assert.match(na.body.regels[0].extra || '', /veld-app/, 'het spoor zegt niet waar het openen vandaan kwam');

  // een niet-toegewezen dossier geeft ook geen adres
  const dicht = await os_('veld/adres', { id: ANDERE }, WERKER);
  assert.equal(dicht.status, 403);
});

/* ------------------------------------------------------------------------- */
test('een bezoekrapport draagt een vervolg, en de medewerker rondt niet af', async () => {
  const zonder = await os_('veld/rapport', { id: CASUS, soort: 'contact',
    tekst: 'langsgeweest, pakket afgegeven' }, WERKER);
  assert.equal(zonder.status, 400);
  assert.match(zonder.body.error, /Wanneer is het vervolg/);
  assert.match(zonder.body.error, /blijft liggen/);

  // "geen vervolg" mag, maar niet zonder reden
  const kaal = await os_('veld/rapport', { id: CASUS, soort: 'hulpactie',
    tekst: 'pakket afgegeven, het gezin redt het verder', geenVervolg: true }, WERKER);
  assert.equal(kaal.status, 400);
  assert.match(kaal.body.error, /Waarom is er geen vervolg nodig/);

  const morgen = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const goed = await os_('veld/rapport', { id: CASUS, soort: 'contact',
    tekst: 'langsgeweest, pakket afgegeven en de aanvraag bijzondere bijstand samen ingevuld',
    vervolgOp: morgen, vervolgWat: 'nabellen of de aanvraag door is' }, WERKER);
  assert.equal(goed.status, 200);
  assert.equal(goed.body.hulpvraag.vervolg.op, morgen);

  /* AFRONDEN KAN HIER NIET, en de weigering legt uit waarom. Een knop die er
     niet is leest als een gebrek; een medewerker die niet weet waarom hij het
     niet kan, doet het ergens anders. */
  const af = await os_('veld/afronden', { id: CASUS }, WERKER);
  assert.equal(af.status, 403);
  assert.match(af.body.error, /coordinator/i);
  assert.match(af.body.error, /bewaartermijn/);
});

/* ------------------------------------------------------------------------- */
test('de gever ziet zijn eigen giften en waar ze heen gingen, en niets van een ander', async () => {
  const mijn = await os_('bron/maak', { stad: STAD, soort: 'donatie', gever: 'Familie Bakker',
    bedrag: 250, projectId: PROJECT });
  const nogEen = await os_('bron/maak', { stad: STAD, soort: 'donatie', gever: 'Familie Bakker', bedrag: 100 });
  await os_('bron/maak', { stad: STAD, soort: 'donatie', gever: 'Iemand anders', bedrag: 5000 });

  const code = await os_('donateur/code', { bronId: mijn.body.bron.id,
    // Een naam is geen donoridentiteit: het kantoor bevestigt exact welke
    // bronnen bij dezelfde gever horen voordat er één portaalcode ontstaat.
    gift_ids: [mijn.body.bron.id, nogEen.body.bron.id] });
  assert.equal(code.status, 200);
  assert.match(code.body.code, /^RTFS-/);
  assert.equal(code.body.giften, 2, 'niet alle giften van dezelfde gever kwamen op een code');

  const p = await post('/api/rtfos/portaal/donateur', { code: code.body.code });
  assert.equal(p.status, 200);
  assert.equal(p.body.donateur.aantal, 2);
  assert.equal(p.body.donateur.totaal, 350);

  const tekst = JSON.stringify(p.body);
  assert.equal(tekst.includes('Iemand anders'), false, 'de gever zag een andere gever staan');
  assert.equal(tekst.includes('5000'), false, 'de gever zag het bedrag van een ander');
  assert.equal(/"hulpvragen"|"casussen"|"perWijk"/.test(tekst), false,
    'er staan gegevens over hulpvragen in het donateursportaal');
  assert.equal(tekst.includes('Aisha'), false, 'er stond een naam van een hulpvrager in');

  // de geoormerkte gift wijst naar het project, de andere naar de stad
  const geoormerkt = p.body.donateur.giften.find(g => g.geoormerkt);
  assert.equal(geoormerkt.bestemming.naam, 'Huiswerkklas Zaandam');
  const vrij = p.body.donateur.giften.find(g => !g.geoormerkt);
  assert.equal(vrij.bestemming.soort, 'stad', 'een niet-geoormerkte gift kreeg een verzonnen project');

  // een verkeerde code opent niets
  const fout = await post('/api/rtfos/portaal/donateur', { code: 'RTFS-BESTAATNIET' });
  assert.equal(fout.status, 404);

  /* HET GIFTBEWIJS. Zonder vastgelegde overeenkomst is het een gewone gift, en
     dat moet er staan -- "periodiek" op een bewijs zonder overeenkomst kost de
     gever geld bij zijn aangifte. */
  const bewijs = await post('/api/rtfos/portaal/donateur/bewijs', { code: code.body.code, giftId: mijn.body.bron.id });
  assert.equal(bewijs.status, 200);
  assert.equal(bewijs.body.bewijs.periodiek, false);
  assert.match(bewijs.body.bewijs.toelichting, /drempel/);

  // onder de vijf jaar is het geen periodieke gift
  const kort = await os_('donateur/periodiek', { bronId: mijn.body.bron.id, jaren: 3,
    kenmerk: 'RTF-2026-01', tot: '2029-01-01' });
  assert.equal(kort.status, 400);
  assert.match(kort.body.error, /ten minste 5 jaar/);

  // zonder kenmerk ook niet: dan is er niets vastgelegd
  const naamloos = await os_('donateur/periodiek', { bronId: mijn.body.bron.id, jaren: 5, tot: '2031-01-01' });
  assert.equal(naamloos.status, 400);
  assert.match(naamloos.body.error, /kenmerk/);

  const vast = await os_('donateur/periodiek', { bronId: mijn.body.bron.id, jaren: 5,
    kenmerk: 'RTF-2026-01', tot: '2031-01-01' });
  assert.equal(vast.status, 200);
  const nu = await post('/api/rtfos/portaal/donateur/bewijs', { code: code.body.code, giftId: mijn.body.bron.id });
  assert.equal(nu.body.bewijs.periodiek, true);
  assert.match(nu.body.bewijs.toelichting, /zonder drempel/);
});

/* ------------------------------------------------------------------------- */
test('waar het geen gift is, komt er geen giftbewijs maar de reden', async () => {
  const sponsor = await os_('bron/maak', { stad: STAD, soort: 'sponsoring', gever: 'Garage Zaandam', bedrag: 800 });
  const code = (await os_('donateur/code', { bronId: sponsor.body.bron.id })).body.code;
  const p = await post('/api/rtfos/portaal/donateur', { code });
  const g = p.body.donateur.giften[0];
  assert.equal(g.bewijs.kan, false);
  assert.match(g.bewijs.waarom, /sponsoring en geen gift/);

  const nee = await post('/api/rtfos/portaal/donateur/bewijs', { code, giftId: sponsor.body.bron.id });
  assert.equal(nee.status, 400, 'er kwam een giftbewijs voor een sponsorbedrag');

  /* En een grote gift waarvan de herkomst nog open staat, krijgt ook geen
     bewijs -- de stichting weet dan zelf nog niet of ze hem houdt. */
  const groot = await os_('bron/maak', { stad: STAD, soort: 'donatie', gever: 'Onbekende weldoener', bedrag: 30000 });
  const gcode = (await os_('donateur/code', { bronId: groot.body.bron.id })).body.code;
  const gp = await post('/api/rtfos/portaal/donateur', { code: gcode });
  assert.equal(gp.body.donateur.giften[0].bewijs.kan, false);
  assert.match(gp.body.donateur.giften[0].bewijs.waarom, /nog beoordeeld/);
});

/* ------------------------------------------------------------------------- */
test('de publieke campagnelijst toont lopende campagnes zonder een enkel bedrag', async () => {
  const c = await os_('campagne/maak', { naam: 'Winterjassen 2026', doel: 'jassen voor kinderen' });
  assert.equal(c.status, 200, JSON.stringify(c.body).slice(0, 200));
  const sleutel = await os_('campagne/sleutel', { id: c.body.campagne.id,
    delen: [{ stad: STAD, procent: 100, reden: 'enige actieve afdeling' }] });
  assert.equal(sleutel.status, 200, JSON.stringify(sleutel.body).slice(0, 200));
  const live = await os_('campagne/status', { id: c.body.campagne.id, status: 'live' });
  assert.equal(live.status, 200, JSON.stringify(live.body).slice(0, 200));

  const open = await post('/api/rtfos/publiek/campagnes', {});
  assert.equal(open.status, 200);
  assert.equal(open.body.campagnes.length >= 1, true, 'de lopende campagne stond niet op de publieke lijst');
  const tekst = JSON.stringify(open.body);
  assert.match(tekst, /Winterjassen 2026/);
  /* GEEN BEDRAGEN. Een campagne die "nog 3.000 euro te gaan" roept, is precies
     het urgentiepatroon dat dit huis niet bouwt (CLAUDE.md), en een opgehaald
     bedrag zegt de buurt niets over wat er gebeurt. */
  assert.equal(/"opgehaald"|"doelbedrag"|"bedrag"|"centen"/.test(tekst), false,
    'er staan bedragen in de publieke campagnelijst');
  assert.equal(/"sleutel"|"verdeling"/.test(tekst), false, 'de verdeelsleutel tussen steden staat op straat');
});

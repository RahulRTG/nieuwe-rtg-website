/* ============================================================================
   HET FOUNDATION OS: DE DRIE DOELGROEPEN ZONDER RTG-ACCOUNT

   De vrijwilliger, de hulpvrager en de buurt stonden wel IN het systeem maar
   konden er niet IN. Deze toetsen gaan over de grenzen van die drie ingangen,
   en die zijn per doelgroep anders scherp:

     1. DE VRIJWILLIGER opent op zijn eigen code. Hij werkt zijn beschikbaarheid
        bij, geeft uren door -- en zet zijn eigen VOG NIET. Dat laatste is de
        grendel: een VOG die je zelf invult, is geen VOG-controle meer.
     2. ZIJN UREN KOMEN BINNEN ALS MELDING. Ze tellen pas na bevestiging door de
        coordinator; hetzelfde vierogenprincipe als bij geld, want uren dragen
        het jaarverslag en het cijfer "kosten per geholpen persoon".
     3. DE HULPVRAGER ziet zijn eigen vraag in gewone taal, en kan zijn
        toestemming INTREKKEN -- zonder te bellen naar de organisatie die hij
        juist wilde stoppen. Daarna stopt het werk ook echt (dezelfde grendel
        als in casus-keten.js).
     4. HIJ ZIET GEEN INTERNE NOTITIES, geen namen van hulpverleners en geen
        contactgegevens. Een code wordt meegelezen op een balie.
     5. DE BUURT-APP bevat geen enkel getal over hulpvragen, geen namen en geen
        bedragen. De maat is: wat zou je op een poster in het buurthuis hangen?

   MUTATIES (LAT.md regel 2), vijf stuks, elk op hun eigen bewering:
     - de VOG-blokkade in vrijwilligerportaal.js weghalen: RAAK;
     - gemelde uren meteen als geboekt wegschrijven: RAAK;
     - de OPEN_STAPPEN-filter weghalen, zodat interne notities meelekken: RAAK;
     - de publieke stad-route ook niet-actieve steden laten tonen: RAAK;
     - de toestemming-controle bij intrekken weghalen: eerst AFGESLAGEN, en dat
       was een bevinding. Die controle stond TWEE keer -- een keer in het
       portaal en een keer in de gedeelde functie in casus-keten.js -- dus een
       van de twee weghalen veranderde niets. Twee plekken met dezelfde waarheid
       is LAT.md regel 4; de dubbele is eruit en het portaal vertaalt alleen nog
       de zin naar de taal van de hulpvrager. Daarna bijt de mutatie op de
       gedeelde controle wel.

   Draai los: node --experimental-sqlite --test test/rtfos-doelgroepen.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfos5-'));
const OFFICE_CODE = 'RTFOS5-KEURING';

let srv, BASE, LAND, STAD, PROJECT, VRIJW, VCODE, CASUS, DCODE;

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
  assert.ok(LAND, 'geen kantoorsessie voor de eigenaar');

  STAD = (await os_('stad/maak', { naam: 'Zaandam' })).body.stad.id;
  await os_('stad/status', { id: STAD, status: 'actief' });
  for (const vlag of ['youth_programs', 'volunteer_management', 'individual_cases', 'events', 'donations']) {
    await os_('stad/module', { id: STAD, vlag, aan: true });
  }
  // een tweede mens voor de vierogen-stappen
  const reg = await post('/api/auth/register', { name: 'Bestuur Zaandam', email: 'bz@rtfos5.test',
    phone: '0612345690', password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  await post('/api/account/koppel', { soort: 'kantoor', code: OFFICE_CODE }, reg.body.token);
  const bestuur = (await post('/api/account/start', { rol: 'kantoor' }, reg.body.token)).body.token;
  const key = (await os_('ik', {}, bestuur)).body.key;
  await os_('zetel', { stad: STAD, key, naam: 'Bestuur Zaandam', rol: 'stadsbestuur' });

  const p = await os_('project/maak', { stad: STAD, naam: 'Huiswerkklas Poelenburg', soort: 'jongeren',
    budget: 1200, doelgroep: 'jongeren 12-18' }, bestuur);
  PROJECT = p.body.project.id;
  await os_('project/status', { id: PROJECT, status: 'aanvraag' }, bestuur);
  await os_('project/status', { id: PROJECT, status: 'beoordeling' }, bestuur);
  await os_('project/status', { id: PROJECT, status: 'goedgekeurd' });
  await os_('project/status', { id: PROJECT, status: 'actief' });

  const jaar = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const v = await os_('vrijwilliger/maak', { stad: STAD, naam: 'Jamal K.', contact: 'jamal@example.org, 0611122233' });
  VRIJW = v.body.vrijwilliger.id;
  await os_('vrijwilliger/zet', { id: VRIJW, status: 'actief', gedragscode: true, vogGeldigTot: jaar });
  await os_('vrijwilliger/koppel', { id: VRIJW, projectId: PROJECT });
  await os_('vrijwilliger/evaluatie', { id: VRIJW, tekst: 'komt soms te laat, maar is goed met de groep' });
  VCODE = (await os_('vrijwilliger/code', { id: VRIJW })).body.code;

  const c = await os_('casus/maak', { stad: STAD, soort: 'schoolspullen', urgentie: 'middel',
    vraag: 'geen schoolspullen voor twee kinderen', wijk: 'Poelenburg',
    contact: 'Aisha M., 0655544433' });
  CASUS = c.body.casus.id;
  DCODE = (await os_('casus/code', { id: CASUS })).body.code;
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------------------------------------------------------------------------
   1 EN 2. DE VRIJWILLIGER: WEL ZIJN AGENDA, NIET ZIJN VOG
   ------------------------------------------------------------------------- */
test('de vrijwilliger ziet zijn eigen planning, en zet zijn eigen VOG niet', async () => {
  const onzin = await post('/api/rtfos/portaal/vrijwilliger', { code: 'RTFV-ZZZZZZZ' });
  assert.equal(onzin.status, 404, 'een verzonnen code gaf toegang');

  const r = await post('/api/rtfos/portaal/vrijwilliger', { code: VCODE });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const v = r.body.vrijwilliger;
  assert.equal(v.naam, 'Jamal K.');
  assert.equal(v.vogGeldig, true);
  assert.equal(v.projecten.length, 1);

  /* WAT ER NIET IN STAAT. Geen contactgegevens -- ook niet die van hemzelf,
     want een code wordt meegelezen -- en geen evaluatie: dat oordeel hoort
     langs een mens die het kan uitleggen, en het scherm zegt dat ook. */
  const tekst = JSON.stringify(r.body);
  assert.equal(tekst.includes('0611122233'), false, 'zijn telefoonnummer stond in zijn eigen portaal');
  assert.equal(tekst.includes('jamal@example.org'), false, 'zijn e-mailadres stond in zijn eigen portaal');
  assert.equal(tekst.includes('komt soms te laat'), false, 'een evaluatie lekte naar het vrijwilligersportaal');
  assert.ok(v.inzage && v.inzage.length > 40, 'er staat niet uitgelegd hoe hij zijn gegevens wel kan inzien');

  // wat van hem is, mag hij bijwerken
  const bij = await post('/api/rtfos/portaal/vrijwilliger/zet', { code: VCODE,
    beschikbaar: ['di-a', 'do-a'], talen: ['Nederlands', 'Berbers'], rijbewijs: true });
  assert.equal(bij.status, 200, JSON.stringify(bij.body).slice(0, 200));
  assert.deepEqual(bij.body.vrijwilliger.beschikbaar, ['di-a', 'do-a']);

  // een onbekend dagdeel wordt geweigerd en niet stil weggegooid
  const raar = await post('/api/rtfos/portaal/vrijwilliger/zet', { code: VCODE, beschikbaar: ['maandagavond'] });
  assert.equal(raar.status, 400, 'een onzin-dagdeel werd geaccepteerd');

  /* DE GRENDEL: zijn VOG, de gedragscode en zijn status zijn van de
     organisatie. Alle drie apart geprobeerd, want een gedeelde controle die
     er maar een vangt, is geen controle. */
  for (const [veld, waarde] of [['vogGeldigTot', '2099-01-01'], ['gedragscode', true], ['status', 'actief']]) {
    const poging = await post('/api/rtfos/portaal/vrijwilliger/zet', { code: VCODE, [veld]: waarde });
    assert.equal(poging.status, 403, 'een vrijwilliger kon zijn eigen ' + veld + ' zetten');
    assert.match(poging.body.error, /zet de afdeling/);
  }
  // en het is ook echt niet gebeurd
  const na = await post('/api/rtfos/portaal/vrijwilliger', { code: VCODE });
  assert.notEqual(na.body.vrijwilliger.vogGeldigTot, '2099-01-01', 'de VOG-datum is toch gewijzigd');
});

test('uren van de vrijwilliger tellen pas na bevestiging door de coordinator', async () => {
  const voor = await os_('vrijwilligers', { stad: STAD });
  const beginUren = voor.body.vrijwilligers.find(v => v.id === VRIJW).urenTotaal;

  const meld = await post('/api/rtfos/portaal/vrijwilliger/uren', { code: VCODE,
    uren: 3, datum: '2026-09-15', km: 8, projectId: PROJECT });
  assert.equal(meld.status, 200, JSON.stringify(meld.body).slice(0, 200));
  assert.match(meld.body.melding, /bevestigt/);

  const tussen = await os_('vrijwilligers', { stad: STAD });
  assert.equal(tussen.body.vrijwilligers.find(v => v.id === VRIJW).urenTotaal, beginUren,
    'gemelde uren telden meteen mee zonder dat iemand ze had gezien');

  // uren op een project waar hij niet op staat, kan niet
  // soort 'taal' valt onder city_projects, dat in elke stad aanstaat -- anders
  // stuit het decor op de modulegrendel en toetst deze regel iets anders
  const ander = await os_('project/maak', { stad: STAD, naam: 'Taalcafe', soort: 'taal', budget: 100 });
  assert.ok(ander.body.project, 'het tweede project kwam er niet: ' + JSON.stringify(ander.body).slice(0, 150));
  const fout = await post('/api/rtfos/portaal/vrijwilliger/uren', { code: VCODE, uren: 2, projectId: ander.body.project.id });
  assert.equal(fout.status, 400, 'hij boekte uren op een project waar hij niet op staat');

  /* DE COORDINATOR MOET DE MELDING KUNNEN ZIEN. Dat is geen detail: een
     melding die nergens in beeld komt, is hetzelfde als geen melding. Ze
     staan daarom in het kantoorbeeld, met hun id. */
  const bak = await os_('vrijwilligers', { stad: STAD });
  const open = bak.body.vrijwilligers.find(v => v.id === VRIJW).gemeldeUren;
  assert.equal(open.length, 1, 'de coordinator ziet de gemelde uren nergens');
  assert.equal(open[0].uren, 3);

  const kantoor = await os_('vrijwilliger/uren-bevestig', { id: VRIJW, meldingId: open[0].id });
  assert.equal(kantoor.status, 200, JSON.stringify(kantoor.body).slice(0, 200));
  assert.equal(kantoor.body.urenTotaal, beginUren + 3, 'na bevestiging telden de uren nog steeds niet mee');
  assert.equal(kantoor.body.open, 0, 'de melding bleef openstaan na bevestiging');

  // twee keer bevestigen boekt niet twee keer
  const nogmaals = await os_('vrijwilliger/uren-bevestig', { id: VRIJW, meldingId: open[0].id });
  assert.equal(nogmaals.status, 404, 'dezelfde melding liet zich twee keer bevestigen');
});

/* ---------------------------------------------------------------------------
   3 EN 4. DE HULPVRAGER: ZIJN VRAAG, EN ZIJN NEE
   ------------------------------------------------------------------------- */
test('de hulpvrager ziet zijn eigen vraag in gewone taal, zonder interne notities', async () => {
  await os_('casus/stap', { id: CASUS, soort: 'contact', tekst: 'gebeld, afspraak gemaakt voor donderdag' });
  await os_('casus/stap', { id: CASUS, soort: 'notitie', tekst: 'moeder komt gespannen over, mogelijk meer aan de hand' });
  await os_('casus/status', { id: CASUS, status: 'intake' });

  const onzin = await post('/api/rtfos/portaal/deelnemer', { code: 'RTFD-ZZZZZZZ' });
  assert.equal(onzin.status, 404);

  const r = await post('/api/rtfos/portaal/deelnemer', { code: DCODE });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const h = r.body.hulpvraag;
  assert.equal(h.codenaam.startsWith('HV-'), true);
  assert.match(h.uitleg, /gesprek/, 'de status staat er in ketentaal in plaats van in gewone taal');

  const tekst = JSON.stringify(r.body);
  assert.equal(tekst.includes('0655544433'), false, 'het telefoonnummer stond in het deelnemersportaal');
  assert.equal(tekst.includes('Aisha'), false, 'de naam stond in het deelnemersportaal');
  assert.equal(tekst.includes('gespannen over'), false, 'een interne notitie lekte naar de hulpvrager');
  assert.equal(tekst.includes('gebeld, afspraak gemaakt'), true, 'wat er met hem is gedaan, staat er juist NIET in');
  assert.equal(tekst.includes('user-'), false, 'de sleutel van een hulpverlener stond in het portaal');
});

test('de hulpvrager trekt zijn toestemming zelf in, en dan stopt het werk', async () => {
  // eerst toestemming, dan koppelen aan een partner
  const pt = await os_('partner/maak', { stad: STAD, naam: 'Stichting Poelenburg Helpt' });
  const partnerId = pt.body.partner.id;
  await os_('partner/status', { id: partnerId, status: 'in_toetsing' });
  await os_('partner/status', { id: partnerId, status: 'goedgekeurd' });
  await os_('partner/document', { id: partnerId, soort: 'overeenkomst', naam: 'Samenwerking' });
  await os_('partner/status', { id: partnerId, status: 'actief' });

  await os_('casus/status', { id: CASUS, status: 'toestemming',
    toestemming: 'mijn naam en telefoon mogen naar Stichting Poelenburg Helpt voor schoolspullen' });
  const gekoppeld = await os_('casus/status', { id: CASUS, status: 'gekoppeld', partnerId });
  assert.equal(gekoppeld.status, 200, JSON.stringify(gekoppeld.body).slice(0, 200));

  const voor = await post('/api/rtfos/portaal/deelnemer', { code: DCODE });
  assert.ok(voor.body.hulpvraag.toestemming, 'de toestemming staat niet in zijn eigen portaal');
  assert.equal(voor.body.hulpvraag.partner, 'Stichting Poelenburg Helpt',
    'hij mag weten WELKE organisatie hem helpt');

  const intrek = await post('/api/rtfos/portaal/deelnemer/intrekken', { code: DCODE, reden: 'het is opgelost' });
  assert.equal(intrek.status, 200, JSON.stringify(intrek.body).slice(0, 200));
  assert.equal(intrek.body.hulpvraag.toestemming, null);
  assert.ok(intrek.body.hulpvraag.ingetrokken, 'het intrekken staat niet in het dossier');
  assert.match(intrek.body.melding, /blijft in het dossier staan/);

  // en nu stopt het werk ook echt -- dezelfde grendel als in casus-keten.js
  const door = await os_('casus/status', { id: CASUS, status: 'in_uitvoering' });
  assert.equal(door.status, 403, 'na het intrekken liep het werk gewoon door');
  assert.match(door.body.error, /Zonder vastgelegde toestemming/);

  // twee keer intrekken zegt wat er aan de hand is
  const nogmaals = await post('/api/rtfos/portaal/deelnemer/intrekken', { code: DCODE });
  assert.equal(nogmaals.status, 400);
  assert.match(nogmaals.body.error, /geen toestemming/);

  // en het staat in het auditspoor, met 'deelnemer' als degene die het deed
  const spoor = await os_('audit', { wat: 'casus.toestemming-ingetrokken' });
  assert.equal(spoor.body.regels.length, 1, 'het intrekken liet geen spoor na');
  assert.equal(spoor.body.regels[0].wie, 'deelnemer', 'het spoor zegt niet dat de deelnemer het zelf deed');
});

/* ---------------------------------------------------------------------------
   5. DE BUURT-APP: WAT OP EEN POSTER ZOU PASSEN
   ------------------------------------------------------------------------- */
test('de publieke app toont geen enkel getal over hulpvragen en geen namen', async () => {
  const jaar = new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10);
  const vv = await os_('vrijwilliger/maak', { stad: STAD, naam: 'Begeleider Publiek' });
  await os_('vrijwilliger/zet', { id: vv.body.vrijwilliger.id, status: 'actief', gedragscode: true, vogGeldigTot: jaar });
  const a = await os_('activiteit/maak', { stad: STAD, naam: 'Buurtmaaltijd Poelenburg', soort: 'buurtmaaltijd',
    capaciteit: 40, wanneer: '2026-12-05', tijd: '18:00', locatie: 'buurthuis' });
  await os_('activiteit/open', { id: a.body.activiteit.id });

  const steden = await post('/api/rtfos/publiek/steden', {});
  assert.equal(steden.status, 200, JSON.stringify(steden.body).slice(0, 200));
  assert.equal(steden.body.steden.length, 1);
  assert.equal(steden.body.steden[0].naam, 'Zaandam');

  const stad = await post('/api/rtfos/publiek/stad', { id: STAD });
  assert.equal(stad.status, 200, JSON.stringify(stad.body).slice(0, 200));
  assert.equal(stad.body.projecten.length >= 1, true, 'er staat geen enkel lopend project in de buurt-app');
  assert.equal(stad.body.activiteiten.length, 1, 'de open activiteit staat er niet in');
  assert.equal(stad.body.activiteiten[0].plekVrij, 40);

  const tekst = JSON.stringify(stad.body);
  assert.equal(tekst.includes('Jamal'), false, 'een vrijwilligersnaam stond in de publieke app');
  assert.equal(tekst.includes('Aisha'), false, 'een deelnemersnaam stond in de publieke app');
  assert.equal(/HV-[A-Z0-9]/.test(tekst), false, 'een casus-codenaam stond in de publieke app');
  assert.equal(tekst.includes('schoolspullen voor twee kinderen'), false, 'een hulpvraag stond in de publieke app');
  assert.equal(tekst.includes('Poelenburg Helpt'), false, 'een partnernaam stond in de publieke app');
  assert.equal(/"hulpvragen"|"geholpen"|"casussen"/.test(tekst), false,
    'er staat een teller over hulpvragen in de publieke app');
  assert.equal(/"budget"|"besteed"|"binnen"/.test(tekst), false, 'er staan bedragen in de publieke app');

  /* EEN STAD DIE NIET ACTIEF IS, STAAT ER NIET OP -- en het antwoord zegt dat
     ook, in plaats van te doen alsof de stad niet bestaat. */
  const nieuw = await os_('stad/maak', { naam: 'Purmerend' });
  const lijst = await post('/api/rtfos/publiek/steden', {});
  assert.equal(lijst.body.steden.some(s => s.naam === 'Purmerend'), false,
    'een stad die nog niet open is, stond in de publieke app');
  const dicht = await post('/api/rtfos/publiek/stad', { id: nieuw.body.stad.id });
  assert.equal(dicht.status, 404);
  assert.match(dicht.body.error, /nog niet open/);
});

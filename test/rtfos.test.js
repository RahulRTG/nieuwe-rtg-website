/* ============================================================================
   HET FOUNDATION OS: DE GRENDELS DIE DE GOVERNANCE DRAGEN

   Dit toetsbestand gaat NIET over of de schermen vullen. Het gaat over de acht
   dingen die een federatieve stichting stukmaken zodra ze niet in code staan,
   en die alle acht een eigen bewering krijgen met een eigen zin:

     1. geoormerkt geld gaat niet naar een ander project;
     2. wie een uitgave aanvraagt, keurt hem niet zelf goed (vier ogen);
     3. boven de goedkeuringslimiet van de rol beslist het landelijke bestuur;
     4. een module die uit staat, is uit -- ook voor wie hem nodig heeft;
     5. zonder geldige VOG geen koppeling aan werk met kinderen of ouderen;
     6. zonder vastgelegde toestemming gaat een hulpvraag niet naar een partner;
     7. een stad ziet nooit een andere stad;
     8. de gemeente krijgt getelde cijfers, nooit een dossier of een naam.

   WAT ER MET EEN MUTATIE IS NAGETROKKEN (LAT.md regel 2). Elke bewering
   hieronder is een keer gezien terwijl hij zakte, door de grendel eruit te
   halen en de toets opnieuw te draaien:

     - het oormerk uit geld-uitgaven.js (de bron-projectId-controle) weghalen:
       RAAK, alleen "geoormerkt geld blijft bij zijn project" zakt;
     - de vierogen-controle (u.door === w.key) weghalen: RAAK, alleen de
       vierogen-bewering zakt -- en dat is precies waarom hij VOOR de limiet
       staat in de code: anders zakt hij op de verkeerde zin;
     - de landelijke bovengrens op Infinity zetten: RAAK op de limiet-bewering;
     - VOG_VERPLICHT leegmaken: RAAK op de VOG-bewering;
     - bereik() alle steden laten geven: RAAK op de scheiding tussen steden;
     - de toestemming-eis uit casus.js halen: eerst AFGESLAGEN, en dat was de
       nuttigste uitkomst van deze ronde. Zie hieronder.

   DE MUTATIE DIE AFSLOEG, EN WAT ERUIT KWAM. De toestemming-grendel bleek
   onbereikbaar: "gekoppeld" kon alleen vanuit de status "toestemming", en die
   status kon je alleen bereiken door de toestemming vast te leggen. De keten
   deed het werk, de grendel stond er decoratief bij, en mijn toets sloeg aan op
   de KETENFOUT (400) terwijl hij dacht de toestemming te toetsen -- precies de
   val van LAT.md regel 9. Dat wees op een echt gat in het ONTWERP: een
   toestemming die je alleen vooraf afvinkt, kun je niet intrekken. Nu wordt de
   toestemming bij elke stap opnieuw gelezen, is intrekken een eigen handeling
   (casus/toestemming-weg), en bijt dezelfde mutatie wel. De toets hieronder
   toetst dus niet meer of de volgorde klopt maar of de toestemming telt.

   DE ROLLEN IN DEZE TOETS ZIJN ECHT. Er wordt nergens een rol meegestuurd: het
   landelijke bestuur is de eigenaar (die IS de boardroom), en de twee
   stadsmensen zijn gewone accounts die via /api/account/koppel + /start een
   kantoorsessie halen en daarna van het landelijke bestuur een zetel krijgen.
   Dat is de weg die in productie ook gelopen wordt.

   Draai los: node --experimental-sqlite --test test/rtfos.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfos-'));
const OFFICE_CODE = 'RTFOS-KEURING';

let srv, BASE;
let LAND, LEIDER, BESTUUR;      // tokens: landelijk, projectleider, stadsbestuur
let HAARLEM, AMSTERDAM;         // stads-ids
let JONGEREN, VOEDSEL;          // projecten in Haarlem

const post = (pad, body, tok) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const os_ = (pad, body, tok) => post('/api/rtfos/' + pad, body, tok);

// Een gewoon lid dat de kantoordeur opent met de backoffice-code. Dat levert
// een office-sessie MET een sleutel eraan (lidKey), en dat is wat een zetel
// nodig heeft: de gedeelde code alleen wijst niemand aan.
async function kantoorLid(naam, mail) {
  const reg = await post('/api/auth/register', { name: naam, email: mail, phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  const lid = reg.body.token;
  assert.ok(lid, 'registreren van ' + naam + ' lukte niet: ' + JSON.stringify(reg.body).slice(0, 150));
  const kop = await post('/api/account/koppel', { soort: 'kantoor', code: OFFICE_CODE }, lid);
  assert.equal(kop.status, 200, 'kantoor koppelen mislukte: ' + JSON.stringify(kop.body).slice(0, 150));
  const start = await post('/api/account/start', { rol: 'kantoor' }, lid);
  assert.ok(start.body.token, 'kantoorsessie mislukte: ' + JSON.stringify(start.body).slice(0, 150));
  /* De sleutel halen we niet uit de tekst van het token maar uit /api/rtfos/ik:
     dat is dezelfde sleutel die de zetel straks draagt, uit dezelfde bron. Hem
     hier zelf in elkaar zetten zou een tweede waarheid zijn (LAT.md regel 4),
     en dan toetst deze suite haar eigen gok in plaats van de server. */
  const ik = await os_('ik', {}, start.body.token);
  assert.ok(ik.body.key, 'de kantoorsessie draagt geen sleutel: ' + JSON.stringify(ik.body).slice(0, 150));
  return { office: start.body.token, key: ik.body.key };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  BASE = srv.base;

  // het landelijke bestuur: de eigenaar, via zijn eigen account de backoffice in
  LAND = await kantoorAlsPersoon(BASE);
  assert.ok(LAND, 'geen kantoorsessie voor de eigenaar');
  const ik = await os_('ik', {}, LAND);
  assert.equal(ik.body.landelijk, true, 'de eigenaar hoort het landelijke bestuur te zijn');

  // twee steden, allebei actief, met de modules die deze toets gebruikt
  const h = await os_('stad/maak', { naam: 'Haarlem' }, LAND);
  const a = await os_('stad/maak', { naam: 'Amsterdam' }, LAND);
  HAARLEM = h.body.stad.id;
  AMSTERDAM = a.body.stad.id;
  for (const stad of [HAARLEM, AMSTERDAM]) {
    await os_('stad/status', { id: stad, status: 'actief' }, LAND);
    for (const vlag of ['youth_programs', 'donations', 'volunteer_management', 'individual_cases', 'municipal_reporting']) {
      await os_('stad/module', { id: stad, vlag, aan: true }, LAND);
    }
  }

  // twee mensen met een zetel in Haarlem
  const leider = await kantoorLid('Leider Haarlem', 'leider@rtfos.test');
  const bestuur = await kantoorLid('Bestuur Haarlem', 'bestuur@rtfos.test');
  LEIDER = leider.office;
  BESTUUR = bestuur.office;
  const zL = await os_('zetel', { stad: HAARLEM, key: leider.key, naam: 'Leider Haarlem', rol: 'projectleider' }, LAND);
  const zB = await os_('zetel', { stad: HAARLEM, key: bestuur.key, naam: 'Bestuur Haarlem', rol: 'stadsbestuur' }, LAND);
  assert.equal(zL.status, 200, 'zetel projectleider mislukte: ' + JSON.stringify(zL.body).slice(0, 150));
  assert.equal(zB.status, 200, 'zetel stadsbestuur mislukte: ' + JSON.stringify(zB.body).slice(0, 150));

  // twee projecten in Haarlem, allebei tot en met "actief"
  for (const [naam, soort] of [['Jongerenwerk Schalkwijk', 'jongeren'], ['Maaltijden Oost', 'maaltijden']]) {
    if (soort === 'maaltijden') await os_('stad/module', { id: HAARLEM, vlag: 'food_distribution', aan: true }, LAND);
    // budget bewust onder de 2.500 van het stadsbestuur: deze twee projecten
    // zijn het decor, en het decor hoort niet op een grendel te stuiten.
    const p = await os_('project/maak', { stad: HAARLEM, naam, soort, budget: 2000, doelgroep: 'buurt' }, BESTUUR);
    assert.ok(p.body.project, naam + ' aanmaken mislukte: ' + JSON.stringify(p.body).slice(0, 150));
    const id = p.body.project.id;
    await os_('project/status', { id, status: 'aanvraag' }, LEIDER);
    await os_('project/status', { id, status: 'beoordeling' }, LEIDER);
    const goed = await os_('project/status', { id, status: 'goedgekeurd' }, BESTUUR);
    assert.equal(goed.status, 200, 'goedkeuren mislukte: ' + JSON.stringify(goed.body).slice(0, 150));
    await os_('project/status', { id, status: 'actief' }, BESTUUR);
    if (soort === 'jongeren') JONGEREN = id; else VOEDSEL = id;
  }
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------------------------------------------------------------------------
   1. GEOORMERKT GELD BLIJFT BIJ ZIJN PROJECT
   Het scenario uit de opdracht: twintigduizend euro voor het jongerenwerk mag
   niet stilletjes naar de voedselhulp. De zin moet BEIDE projecten noemen,
   anders staat de lezer met een verbod zonder uitleg.
   ------------------------------------------------------------------------- */
test('geoormerkt geld gaat niet naar een ander project', async () => {
  const bron = await os_('bron/maak', { stad: HAARLEM, soort: 'donatie', gever: 'Fonds Kennemerland',
    bedrag: 20000, projectId: JONGEREN, herbestemming: 'nooit' }, BESTUUR);
  assert.equal(bron.status, 200, JSON.stringify(bron.body).slice(0, 150));
  const bronId = bron.body.bron.id;
  assert.equal(bron.body.bron.geoormerkt, true);

  const fout = await os_('uitgave/aanvraag', { projectId: VOEDSEL, bronId,
    omschrijving: 'inkoop maaltijden', bedrag: 100 }, LEIDER);
  assert.equal(fout.status, 403, 'het oormerk hield niet: ' + JSON.stringify(fout.body).slice(0, 200));
  assert.match(fout.body.error, /Jongerenwerk Schalkwijk/, 'de zin noemt niet waar het geld wel voor is');
  assert.match(fout.body.error, /Maaltijden Oost/, 'de zin noemt niet waar het geld heen zou gaan');

  // en op het eigen project kan het wel: anders bewijst het verbod niets
  const goed = await os_('uitgave/aanvraag', { projectId: JONGEREN, bronId,
    omschrijving: 'trainer jongerenavond', bedrag: 100 }, LEIDER);
  assert.equal(goed.status, 200, JSON.stringify(goed.body).slice(0, 200));

  // herbestemmen is uitgesloten door de gever, en dat geldt ook landelijk
  const verplaats = await os_('bron/verplaats', { id: bronId, projectId: VOEDSEL,
    reden: 'het jongerenproject stopt', toestemming: true }, LAND);
  assert.equal(verplaats.status, 403, 'een uitgesloten herbestemming kwam er toch doorheen');
  assert.match(verplaats.body.error, /uitgesloten|terug naar de gever/i);
});

/* ---------------------------------------------------------------------------
   2. VIER OGEN
   Wie aanvraagt, besluit niet -- ook niet als hij de bevoegdheid heeft. De
   controle staat VOOR de limiet, zodat de zin over vier ogen gaat en niet over
   het bedrag.
   ------------------------------------------------------------------------- */
test('wie een uitgave aanvraagt, keurt hem niet zelf goed', async () => {
  const bron = await os_('bron/maak', { stad: HAARLEM, soort: 'donatie', gever: 'Anonieme gever',
    bedrag: 1000, anoniem: true }, BESTUUR);
  const bronId = bron.body.bron.id;
  const aanvraag = await os_('uitgave/aanvraag', { projectId: JONGEREN, bronId,
    omschrijving: 'materiaal', bedrag: 40 }, LEIDER);
  assert.equal(aanvraag.status, 200, JSON.stringify(aanvraag.body).slice(0, 200));
  const id = aanvraag.body.uitgave.id;

  const zelf = await os_('uitgave/besluit', { id, akkoord: true }, LEIDER);
  assert.equal(zelf.status, 403, 'de aanvrager kon zijn eigen uitgave goedkeuren');
  assert.match(zelf.body.error, /vierogen|zelf aangevraagd/i);

  const ander = await os_('uitgave/besluit', { id, akkoord: true }, BESTUUR);
  assert.equal(ander.status, 200, 'een ander kon hem niet goedkeuren: ' + JSON.stringify(ander.body).slice(0, 200));
  assert.equal(ander.body.uitgave.status, 'goedgekeurd');
});

/* ---------------------------------------------------------------------------
   3. DE LIMIET VAN DE ROL
   Een projectleider tot 250 euro, een stadsbestuur tot 2.500, daarboven
   landelijk. De limiet hangt aan wie BESLUIT, niet aan wie aanvraagt.
   ------------------------------------------------------------------------- */
test('boven de limiet van de rol beslist een hogere trede', async () => {
  const bron = await os_('bron/maak', { stad: HAARLEM, soort: 'subsidie', gever: 'Gemeente Haarlem',
    bedrag: 50000 }, BESTUUR);
  const bronId = bron.body.bron.id;

  // 400 euro: te groot voor de projectleider, binnen bereik van het stadsbestuur
  const a1 = await os_('uitgave/aanvraag', { projectId: JONGEREN, bronId, omschrijving: 'zaalhuur', bedrag: 400 }, BESTUUR);
  const teGroot = await os_('uitgave/besluit', { id: a1.body.uitgave.id, akkoord: true }, LEIDER);
  assert.equal(teGroot.status, 403, 'de projectleider mocht 400 euro goedkeuren');
  assert.match(teGroot.body.error, /grens|stadsbestuur/i);

  // 9.000 euro: te groot voor het stadsbestuur; hier moet landelijk aan te pas komen
  const a2 = await os_('uitgave/aanvraag', { projectId: JONGEREN, bronId, omschrijving: 'busvervoer jaar', bedrag: 9000 }, LEIDER);
  assert.equal(a2.body.nodig, 'landelijk', 'de aanvraag wijst niet naar het landelijke bestuur');
  const stadTeGroot = await os_('uitgave/besluit', { id: a2.body.uitgave.id, akkoord: true }, BESTUUR);
  assert.equal(stadTeGroot.status, 403, 'het stadsbestuur mocht 9.000 euro goedkeuren');
  assert.match(stadTeGroot.body.error, /landelijke RTF-bestuur/i);

  const landelijk = await os_('uitgave/besluit', { id: a2.body.uitgave.id, akkoord: true }, LAND);
  assert.equal(landelijk.status, 200, 'het landelijke bestuur kon niet besluiten: ' + JSON.stringify(landelijk.body).slice(0, 200));

  // en de stad kan zijn eigen limiet niet omhoog schroeven
  const omhoog = await os_('stad/limiet', { id: HAARLEM, rol: 'stadsbestuur', bedrag: 100000 }, LAND);
  assert.equal(omhoog.status, 400, 'de landelijke bovengrens liet zich verhogen');
  assert.match(omhoog.body.error, /verlagen, niet verhogen/i);
});

/* ---------------------------------------------------------------------------
   4. EEN MODULE DIE UIT STAAT, IS UIT
   Anders is "modules per stad" een lijstje vinkjes zonder gevolg.
   ------------------------------------------------------------------------- */
test('een uitgezette module blokkeert het werk in die stad', async () => {
  const uit = await os_('stad/module', { id: AMSTERDAM, vlag: 'youth_programs', aan: false }, LAND);
  assert.equal(uit.status, 200);
  const p = await os_('project/maak', { stad: AMSTERDAM, naam: 'Jongerenhuis Noord', soort: 'jongeren', budget: 1000 }, LAND);
  assert.equal(p.status, 403, 'een project kwam er doorheen terwijl de module uit stond');
  assert.match(p.body.error, /youth_programs.*uit|uit voor/i);

  // weer aan, en dan kan het wel -- anders bewijst de blokkade niets
  await os_('stad/module', { id: AMSTERDAM, vlag: 'youth_programs', aan: true }, LAND);
  const weer = await os_('project/maak', { stad: AMSTERDAM, naam: 'Jongerenhuis Noord', soort: 'jongeren', budget: 1000 }, LAND);
  assert.equal(weer.status, 200, JSON.stringify(weer.body).slice(0, 200));
});

/* ---------------------------------------------------------------------------
   5. DE VOG-GRENDEL
   Bij werk met kinderen en ouderen wordt de koppeling GEWEIGERD, niet
   gemarkeerd. Een waarschuwing klik je weg op de avond dat je mensen tekort
   komt, en dat is precies de avond waarop het misgaat.
   ------------------------------------------------------------------------- */
test('zonder geldige VOG geen vrijwilliger op werk met kinderen', async () => {
  const v = await os_('vrijwilliger/maak', { stad: HAARLEM, naam: 'Nieuwe Vrijwilliger' }, BESTUUR);
  const id = v.body.vrijwilliger.id;
  await os_('vrijwilliger/zet', { id, status: 'actief', gedragscode: true }, BESTUUR);

  const zonder = await os_('vrijwilliger/koppel', { id, projectId: JONGEREN }, BESTUUR);
  assert.equal(zonder.status, 403, 'iemand zonder VOG kwam op het jongerenproject');
  assert.match(zonder.body.error, /VOG/);

  // een VERLOPEN VOG is geen VOG: dat is de val waar een boolean in trapt
  await os_('vrijwilliger/zet', { id, vogGeldigTot: '2020-01-01' }, BESTUUR);
  const verlopen = await os_('vrijwilliger/koppel', { id, projectId: JONGEREN }, BESTUUR);
  assert.equal(verlopen.status, 403, 'een verlopen VOG telde als geldig');
  assert.match(verlopen.body.error, /verlopen op 2020-01-01/);

  // met een geldige VOG kan het wel
  const jaar = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  await os_('vrijwilliger/zet', { id, vogGeldigTot: jaar }, BESTUUR);
  const met = await os_('vrijwilliger/koppel', { id, projectId: JONGEREN }, BESTUUR);
  assert.equal(met.status, 200, JSON.stringify(met.body).slice(0, 200));
});

/* ---------------------------------------------------------------------------
   6. TOESTEMMING GAAT VOORAF AAN KOPPELEN
   En de contactgegevens zijn een aparte handeling met een eigen spoor.
   ------------------------------------------------------------------------- */
test('een hulpvraag gaat niet naar een partner zonder vastgelegde toestemming', async () => {
  const p = await os_('partner/maak', { stad: HAARLEM, naam: 'Stichting Buurtkracht', kvk: '12345678' }, BESTUUR);
  const partnerId = p.body.partner.id;
  await os_('partner/status', { id: partnerId, status: 'in_toetsing' }, BESTUUR);
  await os_('partner/status', { id: partnerId, status: 'goedgekeurd' }, LAND);
  await os_('partner/document', { id: partnerId, soort: 'overeenkomst', naam: 'Samenwerking 2026' }, LAND);
  const actief = await os_('partner/status', { id: partnerId, status: 'actief' }, LAND);
  assert.equal(actief.status, 200, JSON.stringify(actief.body).slice(0, 200));

  const c = await os_('casus/maak', { stad: HAARLEM, soort: 'voedsel', urgentie: 'hoog',
    vraag: 'geen eten in huis deze week', wijk: 'Schalkwijk', contact: 'A. de Vries, 0612345678' }, LEIDER);
  assert.equal(c.status, 200, JSON.stringify(c.body).slice(0, 200));
  const id = c.body.casus.id;
  // de lijst draait op een codenaam; het contact staat er niet in
  assert.match(c.body.casus.codenaam, /^HV-/);
  assert.equal(JSON.stringify(c.body).includes('0612345678'), false, 'het telefoonnummer stond in het gewone antwoord');

  await os_('casus/status', { id, status: 'intake' }, LEIDER);
  const zonder = await os_('casus/status', { id, status: 'gekoppeld', partnerId }, LEIDER);
  assert.equal(zonder.status, 400, 'koppelen kon zonder toestemming');

  const leeg = await os_('casus/status', { id, status: 'toestemming', toestemming: 'ja' }, LEIDER);
  assert.equal(leeg.status, 400, 'een loze toestemming werd geaccepteerd');
  await os_('casus/status', { id, status: 'toestemming',
    toestemming: 'naam en telefoon mogen naar Stichting Buurtkracht voor een voedselpakket' }, LEIDER);
  const met = await os_('casus/status', { id, status: 'gekoppeld', partnerId }, LEIDER);
  assert.equal(met.status, 200, JSON.stringify(met.body).slice(0, 200));

  /* EN DE TOESTEMMING WORDT BIJ ELKE STAP OPNIEUW GELEZEN.
     Deze twee beweringen staan hier omdat de eerste versie van deze toets iets
     anders bewees dan ze dacht: "gekoppeld" vanaf "intake" werd al door de
     KETEN geweigerd, dus de toestemming-grendel werd nooit bereikt en een
     mutatie die hem weghaalde sloeg af (LAT.md regel 2, uitkomst AFGESLAGEN).
     Dat was geen fout in de mutatie maar in de toets -- en in het ontwerp:
     toestemming die je een keer afvinkt, is geen toestemming die je kunt
     intrekken. Nu kan dat, en nu bijt de grendel ook echt. */
  const intrek = await os_('casus/toestemming-weg', { id, reden: 'hulpvrager wil het niet meer' }, LEIDER);
  assert.equal(intrek.status, 200, JSON.stringify(intrek.body).slice(0, 200));
  const naIntrek = await os_('casus/status', { id, status: 'gekoppeld', partnerId }, LEIDER);
  assert.equal(naIntrek.status, 403, 'na intrekken kon de hulpvraag toch naar een partner');
  assert.match(naIntrek.body.error, /Zonder vastgelegde toestemming/);
  const doorwerken = await os_('casus/status', { id, status: 'in_uitvoering' }, LEIDER);
  assert.equal(doorwerken.status, 403, 'na intrekken liep het werk gewoon door');

  // Meesturen in dezelfde stap helpt niet: opnieuw toestemmen is een eigen
  // handeling en geen veld in een ander verzoek.
  const sluip = await os_('casus/status', { id, status: 'gekoppeld', partnerId,
    toestemming: 'opnieuw toegestemd' }, LEIDER);
  assert.equal(sluip.status, 403, 'toestemming liet zich in dezelfde stap meesmokkelen');

  // de weg terug bestaat wel, en die loopt via de toestemming zelf
  const terug = await os_('casus/status', { id, status: 'toestemming',
    toestemming: 'na een gesprek opnieuw akkoord met doorgifte aan Stichting Buurtkracht' }, LEIDER);
  assert.equal(terug.status, 200, JSON.stringify(terug.body).slice(0, 200));
  const opnieuw = await os_('casus/status', { id, status: 'gekoppeld', partnerId }, LEIDER);
  assert.equal(opnieuw.status, 200, JSON.stringify(opnieuw.body).slice(0, 200));

  // het contact is apart op te vragen, en dat komt in het auditspoor
  const contact = await os_('casus/contact', { id }, LEIDER);
  assert.equal(contact.status, 200);
  assert.match(contact.body.contact, /0612345678/);
  const audit = await os_('audit', { wat: 'casus.contact-open' }, LAND);
  assert.equal(audit.status, 200);
  assert.ok(audit.body.regels.length >= 1, 'het openen van contactgegevens liet geen spoor na');

  // afronden kan niet zolang er geen hulpactie in het dossier staat
  await os_('casus/status', { id, status: 'in_uitvoering' }, LEIDER);
  const teVroeg = await os_('casus/status', { id, status: 'afgerond' }, LEIDER);
  assert.equal(teVroeg.status, 400, 'afronden kon zonder dat er iets was gedaan');
  await os_('casus/stap', { id, soort: 'hulpactie', tekst: 'voedselpakket bezorgd' }, LEIDER);
  const af = await os_('casus/status', { id, status: 'afgerond' }, LEIDER);
  assert.equal(af.status, 200, JSON.stringify(af.body).slice(0, 200));
  assert.ok(af.body.casus.bewaarTot, 'er is geen bewaartermijn gezet bij afronding');
});

/* ---------------------------------------------------------------------------
   7. EEN STAD ZIET NOOIT EEN ANDERE STAD
   Vier verschillende wegen naar dezelfde vraag, want een scheiding die maar op
   een plek staat, staat maar op een plek.
   ------------------------------------------------------------------------- */
test('een zetel in de ene stad komt niet bij de andere', async () => {
  for (const pad of ['stad', 'projecten', 'vrijwilligers', 'geld']) {
    const body = pad === 'stad' ? { id: AMSTERDAM } : { stad: AMSTERDAM };
    const r = await os_(pad, body, BESTUUR);
    assert.equal(r.status, 403, pad + ' liet Haarlem in Amsterdam kijken');
  }
  const boom = await os_('boom', {}, BESTUUR);
  assert.equal(boom.body.steden.length, 1, 'de boom toonde meer steden dan de eigen');
  assert.equal(boom.body.steden[0].id, HAARLEM);

  // en het auditspoor is landelijk
  const audit = await os_('audit', {}, BESTUUR);
  assert.equal(audit.status, 403, 'een stadsbestuur kon het auditspoor lezen');
});

/* ---------------------------------------------------------------------------
   8. DE GEMEENTE KRIJGT CIJFERS, GEEN DOSSIER
   Plus de k-drempel op buurten: onder de vijf hulpvragen wordt een buurt niet
   apart genoemd, want dat is in een paar straten geen statistiek meer.
   ------------------------------------------------------------------------- */
test('het gemeentenportaal toont getelde cijfers en nooit een persoon', async () => {
  const g = await os_('gemeente/maak', { stad: HAARLEM, naam: 'Gemeente Haarlem', contact: 'S. Jansen' }, BESTUUR);
  assert.equal(g.status, 200, JSON.stringify(g.body).slice(0, 200));
  const code = g.body.gemeente.code;
  await os_('gemeente/opdracht', { id: g.body.gemeente.id, omschrijving: 'Jongerenwerk Schalkwijk 2026',
    kpi: '100 jongeren begeleiden', bedrag: 20000, deadline: '2027-01-31' }, BESTUUR);
  await os_('project/deelnemers', { id: JONGEREN, uniek: 87, herhaald: 31 }, BESTUUR);
  await os_('project/indicator', { id: JONGEREN, naam: 'jongeren begeleid', doel: 100, bereikt: 87,
    doorgestroomd: 31, uitgevallen: 12 }, BESTUUR);

  const portaal = await post('/api/rtfos/portaal/gemeente', { code });
  assert.equal(portaal.status, 200, JSON.stringify(portaal.body).slice(0, 200));
  const tekst = JSON.stringify(portaal.body);
  assert.equal(tekst.includes('0612345678'), false, 'er stond een telefoonnummer in het gemeentebeeld');
  assert.equal(tekst.includes('geen eten in huis'), false, 'er stond een hulpvraag-tekst in het gemeentebeeld');
  assert.equal(tekst.includes('HV-'), false, 'er stond een casus-codenaam in het gemeentebeeld');
  assert.equal(portaal.body.bereik.uniekGeholpen, 87);
  assert.equal(portaal.body.doelen.doorgestroomd, 31);
  assert.equal(portaal.body.opdrachten.length, 1);

  // de buurt met een enkele hulpvraag wordt niet apart genoemd
  const buurten = portaal.body.bereik.buurten;
  assert.equal(buurten.some(b => b.wijk === 'Schalkwijk'), false, 'een buurt met een enkele hulpvraag werd apart genoemd');
  assert.ok(buurten.some(b => b.samengevoegd), 'de samengevoegde buurten staan er niet bij');

  // een onbekende code geeft niets, en zeker geen andere stad
  const onzin = await post('/api/rtfos/portaal/gemeente', { code: 'RTFG-ZZZZZZZ' });
  assert.equal(onzin.status, 404);
});

/* ---------------------------------------------------------------------------
   9. EEN MELDING IS NIET TE WISSEN, EN KRITIEK GAAT OMHOOG
   ------------------------------------------------------------------------- */
test('kritieke meldingen gaan landelijk en niemand kan ze verwijderen', async () => {
  const m = await os_('melding/maak', { stad: HAARLEM, soort: 'incident', zwaarte: 'kritiek',
    tekst: 'een vrijwilliger is alleen met een kind achtergebleven' }, LEIDER);
  assert.equal(m.status, 200, JSON.stringify(m.body).slice(0, 200));
  assert.equal(m.body.landelijk, true, 'een kritieke melding werd niet naar landelijk getild');

  // de stad kan hem niet afhandelen: kritiek is landelijk werk
  const stad = await os_('melding/sluit', { id: m.body.melding.id, uitkomst: 'met de vrijwilliger gesproken, klaar' }, BESTUUR);
  assert.equal(stad.status, 403, 'de stad sloot een kritieke melding');

  // sluiten zonder uitkomst is stil wegwerken
  const leeg = await os_('melding/sluit', { id: m.body.melding.id, uitkomst: 'ok' }, LAND);
  assert.equal(leeg.status, 400, 'een melding werd zonder uitkomst afgehandeld');

  const dicht = await os_('melding/sluit', { id: m.body.melding.id,
    uitkomst: 'onderzocht met de vertrouwenspersoon; vrijwilliger is geschorst en de ouders zijn ingelicht' }, LAND);
  assert.equal(dicht.status, 200, JSON.stringify(dicht.body).slice(0, 200));

  // er BESTAAT geen verwijderroute; dat is de grendel
  const weg = await post('/api/rtfos/melding/weg', { id: m.body.melding.id }, LAND);
  assert.equal(weg.status, 404, 'er is een weg om een melding te verwijderen');

  // een anonieme melding bewaart geen sleutel
  const anon = await os_('melding/maak', { stad: HAARLEM, soort: 'klokkenluider', zwaarte: 'hoog',
    tekst: 'het stadsbestuur gunt opdrachten aan een eigen bedrijf', anoniem: true }, LEIDER);
  assert.equal(anon.body.melding.melder, 'anoniem');
  // en een klokkenluidersmelding gaat buiten de stad om
  const stadsblik = await os_('meldingen', { stad: HAARLEM }, BESTUUR);
  assert.equal(stadsblik.body.meldingen.some(x => x.soort === 'klokkenluider'), false,
    'het stadsbestuur zag de klokkenluidersmelding over zichzelf');
  const landblik = await os_('meldingen', {}, LAND);
  assert.equal(landblik.body.meldingen.some(x => x.soort === 'klokkenluider'), true,
    'het landelijke bestuur zag de klokkenluidersmelding niet');
});

/* ---------------------------------------------------------------------------
   10. DE PROJECTKETEN EN DE PARTNERKETEN
   Springen mag niet, en goedkeuren doet een ander dan aanvragen.
   ------------------------------------------------------------------------- */
test('een project springt niet door de keten heen', async () => {
  const p = await os_('project/maak', { stad: HAARLEM, naam: 'Taalcafe', soort: 'taal', budget: 800 }, LEIDER);
  const id = p.body.project.id;
  const sprong = await os_('project/status', { id, status: 'actief' }, BESTUUR);
  assert.equal(sprong.status, 400, 'een project sprong van idee naar actief');
  assert.match(sprong.body.error, /Van "idee"/);

  /* De indiener is hier het STADSBESTUUR: dat is de enige manier om de
     vierogen-bewering apart te toetsen. Een projectleider stuit al op het
     recht om te besluiten, en dan zou deze toets op de verkeerde zin slagen --
     precies de val van LAT.md regel 9 (een status die een hele klasse
     toelaat). Daarom staan de twee weigeringen hier als twee beweringen. */
  await os_('project/status', { id, status: 'aanvraag' }, BESTUUR);
  await os_('project/status', { id, status: 'beoordeling' }, BESTUUR);

  const leider = await os_('project/status', { id, status: 'goedgekeurd' }, LEIDER);
  assert.equal(leider.status, 403, 'een projectleider keurde een project goed');
  assert.match(leider.body.error, /stadsbestuur|landelijke/i);

  const zelf = await os_('project/status', { id, status: 'goedgekeurd' }, BESTUUR);
  assert.equal(zelf.status, 403, 'de indiener keurde zijn eigen project goed');
  assert.match(zelf.body.error, /zelf goed/i);

  const ander = await os_('project/status', { id, status: 'goedgekeurd' }, LAND);
  assert.equal(ander.status, 200, JSON.stringify(ander.body).slice(0, 200));

  // een indicator die zichzelf tegenspreekt komt er niet in
  const onzin = await os_('project/indicator', { id, naam: 'deelnemers', doel: 20, bereikt: 12,
    doorgestroomd: 31, uitgevallen: 0 }, BESTUUR);
  assert.equal(onzin.status, 400, '31 doorgestroomd van 12 bereikt werd geaccepteerd');
});

test('een partner gaat niet actief zonder overeenkomst, en niet zonder landelijk besluit', async () => {
  const p = await os_('partner/maak', { stad: HAARLEM, naam: 'Stichting Zonder Papieren' }, BESTUUR);
  const id = p.body.partner.id;
  await os_('partner/status', { id, status: 'in_toetsing' }, BESTUUR);
  const stad = await os_('partner/status', { id, status: 'goedgekeurd' }, BESTUUR);
  assert.equal(stad.status, 403, 'de stad keurde zijn eigen partner goed');
  assert.match(stad.body.error, /landelijk/i);

  await os_('partner/status', { id, status: 'goedgekeurd' }, LAND);
  const zonderPapier = await os_('partner/status', { id, status: 'actief' }, LAND);
  assert.equal(zonderPapier.status, 400, 'een partner werd actief zonder samenwerkingsovereenkomst');
  assert.match(zonderPapier.body.error, /overeenkomst/i);
});

/* ---------------------------------------------------------------------------
   11. EEN GEBLOKKEERDE STAD IS LEESBAAR EN NIET SCHRIJFBAAR
   Toezicht stopt de uitvoering; het wist de geschiedenis niet.
   ------------------------------------------------------------------------- */
test('een geblokkeerde stad blijft leesbaar maar niet schrijfbaar', async () => {
  await os_('stad/status', { id: HAARLEM, status: 'geblokkeerd' }, LAND);
  const lezen = await os_('projecten', { stad: HAARLEM }, BESTUUR);
  assert.equal(lezen.status, 200, 'een geblokkeerde stad werd ook onleesbaar');
  assert.ok(lezen.body.projecten.length >= 2, 'de geschiedenis is verdwenen');

  const schrijven = await os_('project/maak', { stad: HAARLEM, naam: 'Nog een project', soort: 'taal', budget: 100 }, BESTUUR);
  assert.equal(schrijven.status, 403, 'er kon in een geblokkeerde stad geschreven worden');
  assert.match(schrijven.body.error, /geblokkeerd/);

  await os_('stad/status', { id: HAARLEM, status: 'actief' }, LAND);
  const weer = await os_('project/maak', { stad: HAARLEM, naam: 'Nog een project', soort: 'taal', budget: 100 }, BESTUUR);
  assert.equal(weer.status, 200, 'na deblokkeren kon er nog steeds niets: ' + JSON.stringify(weer.body).slice(0, 200));
});

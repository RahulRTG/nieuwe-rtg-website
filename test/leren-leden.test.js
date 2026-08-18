/* ============================================================================
   DE LEERLAAG VANAF DE LEDEN-APP -- 28 endpoints, en een uitnodiging als spil.

   Deze achtentwintig wees de waargenomen dekkingsmeting aan als nooit
   aangeroepen. Er BESTAAT een test voor de leerlaag, maar die gaat door de
   RTF-ingang (gezinscode + profieltoken). Dezelfde motor heeft een tweede deur
   -- /api/member/leren/*, op het ledentoken -- en die deur was nooit beproefd.

   Twee deuren naar een motor is precies waar een rechtencontrole wegvalt: hij
   staat bij de ene ingang en niet bij de andere. Hier staat hij op de goede
   plek, in de motor zelf, en dit bestand legt dat vast.

   WAT ER OP HET SPEL STAAT

   De leerlaag is de plek waar leden SAMEN dingen doen: een overhoorduel, een
   werkstuk met taken en notities, feedback op elkaars tekst. Alles wat gedeeld
   kan worden, kan ook per ongeluk gedeeld worden met wie er niet bij hoort. De
   regel van dit huis is dat samen leren je NIET automatisch tot vrienden maakt
   en dat meedoen begint bij een uitnodiging die je zelf hebt aangenomen.

   De rode draad hieronder is die uitnodiging. Voordat B ja zegt, bestaat het
   project voor hem niet (404 op alles). Zodra hij ja zegt, mag hij meedoen --
   maar nog steeds niet alles: opruimen blijft van wie het startte.

   Draai los: node --test test/leren-leden.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leren-'));
let srv, base, A, B, gast;

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const leer = (pad, body, token) => api('member/leren/' + pad, body, token);

/* Twee ECHTE leden, want de codenaam is hier het adres waarop je iemand
   uitnodigt. Een demo-inlog deelt zijn sleutel met elke andere demo-inlog van
   dezelfde pas; dan zijn A en B hetzelfde account en toetst de grens niets. */
let teller = 0;
async function lid(naam) {
  const u = (Date.now() + (++teller) * 7919).toString().slice(-9);
  const r = await api('auth/register', { name: naam, email: 'lr' + u + '@x.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim12345', geboortedatum: '1994-04-04', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.body.token, 'lid ' + naam + ' geregistreerd');
  const st = (r.body.state && r.body.state.user) || {};
  assert.ok(st.codename, naam + ' heeft een codenaam');
  return { token: r.body.token, naam, codenaam: st.codename };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  A = await lid('Leerling A');
  B = await lid('Leerling B');
  assert.notEqual(A.codenaam, B.codenaam, 'twee leden, twee codenamen');
  gast = (await api('login', { tier: 'guest' })).body;
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ================= 1. overhoorlijsten: van jou, en van niemand anders ================= */

test('1. een lijst maken, ophalen, een score bewaren en weer opruimen', async () => {
  const maak = await leer('lijst-maak', { naam: 'Franse werkwoorden',
    paren: [{ v: 'avoir', a: 'hebben' }, { v: 'etre', a: 'zijn' }, { v: 'aller', a: 'gaan' }] }, A.token);
  assert.equal(maak.status, 200, JSON.stringify(maak.body));
  const id = maak.body.id;

  const lijsten = await leer('lijsten', {}, A.token);
  assert.equal(lijsten.status, 200);
  assert.ok((lijsten.body.lijsten || []).some(l => l.id === id), 'de lijst staat in het overzicht');

  const haal = await leer('lijst-haal', { id }, A.token);
  assert.equal(haal.status, 200);
  assert.equal(haal.body.lijst.paren.length, 3);

  const klaar = await leer('overhoor-klaar', { id, goed: 2, totaal: 3 }, A.token);
  assert.equal(klaar.status, 200);
  assert.ok((await leer('lijst-haal', { id }, A.token)).body.lijst.beste, 'de beste score is bewaard');

  // een lege lijst wordt geweigerd, niet stil aangemaakt
  assert.equal((await leer('lijst-maak', { naam: '', paren: [] }, A.token)).status, 400);
  /* En een lijst met EEN paar ook: overhoren van een enkel woordje is geen
     overhoren. Deze regel kostte me twee valse testfouten voordat ik hem zag --
     mijn opzet maakte een lijst van een paar aan, kreeg netjes 400, en las
     daarna een id dat niet bestond. Vandaar dat elke opzetstap hieronder zijn
     status controleert: een stille 400 in de voorbereiding maakt elke assertie
     erna betekenisloos. */
  assert.equal((await leer('lijst-maak', { naam: 'Te kort', paren: [{ v: 'een', a: 'one' }] }, A.token)).status, 400,
    'een lijst met een enkel paar wordt geweigerd');
});

/* Een lijst aanmaken en meteen controleren dat het gelukt is. */
async function nieuweLijst(naam, paren, token) {
  const r = await leer('lijst-maak', { naam, paren }, token);
  assert.equal(r.status, 200, 'lijst "' + naam + '" aanmaken: ' + JSON.stringify(r.body));
  assert.ok(r.body.id, 'en er komt een id terug');
  return r.body.id;
}
/* Een lopend duel tussen A en B: starten, laten aannemen, en controleren dat
   hij daarna echt draait. */
async function nieuwDuel(lijstId) {
  const start = await leer('sessie-start', { lijstId, codenamen: [B.codenaam] }, A.token);
  assert.equal(start.status, 200, 'duel starten: ' + JSON.stringify(start.body));
  const ja = await leer('sessie-antwoord', { id: start.body.id, akkoord: true }, B.token);
  assert.equal(ja.status, 200, 'B neemt aan: ' + JSON.stringify(ja.body));
  return start.body.id;
}

test('2. de lijst van A bestaat voor B niet -- ook niet om weg te gooien', async () => {
  const id = await nieuweLijst('Topografie',
    [{ v: 'Hoofdstad van Peru', a: 'Lima' }, { v: 'Hoofdstad van Chili', a: 'Santiago' }], A.token);

  const kijken = await leer('lijst-haal', { id }, B.token);
  assert.equal(kijken.status, 404, 'B kan de lijst niet inzien');
  assert.equal(JSON.stringify(kijken.body).includes('Lima'), false, 'en de inhoud lekt niet via de fout');

  assert.equal((await leer('lijst-weg', { id }, B.token)).status, 404, 'en niet weggooien');
  assert.equal((await leer('overhoor-klaar', { id, goed: 1, totaal: 1 }, B.token)).status, 404,
    'en er ook geen score op zetten');

  // bij A staat hij er gewoon nog
  assert.equal((await leer('lijst-haal', { id }, A.token)).status, 200, 'de lijst van A is ongemoeid');
  assert.equal((await leer('lijst-weg', { id }, A.token)).status, 200, 'de eigenaar ruimt hem zelf op');
  assert.equal((await leer('lijst-haal', { id }, A.token)).status, 404, 'en daarna is hij echt weg');
});

test('3. de dagstapel van de vergeetcurve is persoonlijk', async () => {
  const id = await nieuweLijst('Duitse naamvallen',
    [{ v: 'der', a: 'mannelijk' }, { v: 'die', a: 'vrouwelijk' }], A.token);

  const stapel = await leer('herhaal', {}, A.token);
  assert.equal(stapel.status, 200);
  const antwoord = await leer('herhaal-antwoord', { lijstId: id, idx: 0, goed: true }, A.token);
  assert.equal(antwoord.status, 200, JSON.stringify(antwoord.body));

  const stand = await leer('herhaal-stand', {}, A.token);
  assert.equal(stand.status, 200);
  assert.ok(stand.body, 'de bakjes komen terug');

  /* B antwoordt op de lijst van A. Dat mag zijn eigen bakjes niet vullen met
     iets wat hij nooit gezien heeft, en zeker niet die van A verschuiven. */
  const vreemd = await leer('herhaal-antwoord', { lijstId: id, idx: 0, goed: true }, B.token);
  assert.notEqual(vreemd.status, 500, 'een vreemde lijstId hoort niet om te vallen');
  const standB = await leer('herhaal-stand', {}, B.token);
  assert.equal(JSON.stringify(standB.body).includes('naamvallen'), false,
    'de lijst van A duikt niet op in de stand van B');
});

/* ================= 2. het overhoorduel: meedoen begint bij ja zeggen ================= */

test('4. een duel loopt pas als de uitgenodigde het aanneemt', async () => {
  const lijstId = await nieuweLijst('Rekenen', [{ v: '7x8', a: '56' }, { v: '9x6', a: '54' }], A.token);

  // op een lijst die niet van jou is kun je geen duel starten
  assert.equal((await leer('sessie-start', { lijstId, codenamen: [A.codenaam] }, B.token)).status, 404);
  // en zonder maatje ook niet
  assert.equal((await leer('sessie-start', { lijstId, codenamen: [] }, A.token)).status, 400);

  const start = await leer('sessie-start', { lijstId, codenamen: [B.codenaam] }, A.token);
  assert.equal(start.status, 200, JSON.stringify(start.body));
  const id = start.body.id;

  const staat = await leer('sessie-staat', { id }, A.token);
  assert.equal(staat.status, 200);
  assert.equal(staat.body.sessie.status, 'wacht', 'hij wacht op het antwoord van B');
  assert.equal(staat.body.sessie.vraag, null, 'zolang er gewacht wordt komt er geen vraag');

  // B ziet de uitnodiging in zijn eigen overzicht
  const sessiesB = await leer('sessies', {}, B.token);
  assert.equal(sessiesB.status, 200);
  assert.ok(JSON.stringify(sessiesB.body).includes(id), 'de uitnodiging staat bij B');

  assert.equal((await leer('sessie-antwoord', { id, akkoord: true }, B.token)).status, 200);
  assert.equal((await leer('sessie-staat', { id }, A.token)).body.sessie.status, 'bezig', 'nu loopt hij');
});

test('5. een derde kan niet meekijken of meespelen in het duel van twee anderen', async () => {
  const lijstId = await nieuweLijst('Jaartallen',
    [{ v: 'Val van de Muur', a: '1989' }, { v: 'Eerste maanlanding', a: '1969' }], A.token);
  const id = await nieuwDuel(lijstId);

  const C = await lid('Leerling C');
  assert.equal((await leer('sessie-staat', { id }, C.token)).status, 404, 'C ziet de sessie niet');
  assert.equal((await leer('sessie-zet', { id, antwoord: '1989' }, C.token)).status, 404, 'en speelt niet mee');
  assert.equal((await leer('sessie-antwoord', { id, akkoord: true }, C.token)).status, 404,
    'en nodigt zichzelf niet uit');

  // en het duel van A en B is niet in de war geraakt
  const na = await leer('sessie-staat', { id }, A.token);
  assert.equal(na.body.sessie.status, 'bezig');
  assert.equal(na.body.sessie.ik.goed, 0, 'de stand van A staat nog op nul');
});

test('6. antwoorden telt bij jou, niet bij de ander -- en het antwoord staat niet in de vraag', async () => {
  const lijstId = await nieuweLijst('Hoofdsteden',
    [{ v: 'Portugal', a: 'Lissabon' }, { v: 'Noorwegen', a: 'Oslo' }], A.token);
  const id = await nieuwDuel(lijstId);

  const vraagA = (await leer('sessie-staat', { id }, A.token)).body.sessie;
  assert.ok(vraagA.vraag, 'A krijgt een vraag');
  assert.equal(JSON.stringify(vraagA).includes('Lissabon') && JSON.stringify(vraagA).includes('Oslo'), false,
    'de antwoorden van beide vragen staan niet allebei in het staatje mee te liften');

  const goed = vraagA.vraag === 'Portugal' ? 'lissabon' : 'oslo';   // hoofdletters horen niet uit te maken
  const zet = await leer('sessie-zet', { id, antwoord: goed }, A.token);
  assert.equal(zet.status, 200, JSON.stringify(zet.body));

  const naA = (await leer('sessie-staat', { id }, A.token)).body.sessie;
  assert.equal(naA.ik.goed, 1, 'A heeft er een goed');
  assert.equal(naA.ander.goed, 0, 'en bij B is niets bijgeschreven');
  const naB = (await leer('sessie-staat', { id }, B.token)).body.sessie;
  assert.equal(naB.ik.goed, 0, 'B ziet zijn eigen stand: nul');
  assert.equal(naB.ander.goed, 1, 'en die van A: een');
});

/* ================= 3. projecten: de uitnodiging is de deur ================= */

test('7. voor wie niet is uitgenodigd bestaat het project niet', async () => {
  const maak = await leer('project-maak', { titel: 'Spreekbeurt dolfijnen', wat: 'Voor biologie' }, A.token);
  assert.equal(maak.status, 200);
  const id = maak.body.id;
  await leer('taak-maak', { id, tekst: 'Bronnen zoeken' }, A.token);
  await leer('notitie', { id, tekst: 'GEHEIME-AANTEKENING' }, A.token);

  /* Alle zeven ingangen op het project, geprobeerd door een buitenstaander.
     Elk hoort 404 te geven -- niet 403, want dat zou bevestigen dat het
     project bestaat, en dat is op zichzelf al informatie. */
  for (const [pad, body] of [
    ['project-staat', { id }], ['taak-maak', { id, tekst: 'ik ook' }],
    ['taak-zet', { id, taakId: 'x', af: true }], ['notitie', { id, tekst: 'hallo' }],
    ['project-ai', { id, groep: '12-14' }], ['project-weg', { id }],
    ['project-uitnodig', { id, codenamen: [B.codenaam] }]
  ]) {
    const r = await leer(pad, body, B.token);
    assert.equal(r.status, 404, pad + ' hoort 404 te geven, kreeg ' + r.status);
    assert.equal(JSON.stringify(r.body).includes('GEHEIME-AANTEKENING'), false, pad + ' lekt geen inhoud');
  }
  assert.equal(JSON.stringify((await leer('projecten', {}, B.token)).body).includes(id), false,
    'en het project staat niet in het overzicht van B');
});

test('8. na de uitnodiging mag B meedoen -- maar opruimen blijft van de starter', async () => {
  const id = (await leer('project-maak', { titel: 'Werkstuk vulkanen', wat: 'Met een maquette' }, A.token)).body.id;

  const uitnodiging = await leer('project-uitnodig', { id, codenamen: [B.codenaam] }, A.token);
  assert.equal(uitnodiging.status, 200, JSON.stringify(uitnodiging.body));

  // zolang B nog niet heeft geantwoord, mag hij nog niets
  assert.equal((await leer('taak-maak', { id, tekst: 'te vroeg' }, B.token)).status, 404,
    'uitgenodigd is nog niet meedoen');

  assert.equal((await leer('project-antwoord', { id, akkoord: true }, B.token)).status, 200);

  const staat = await leer('project-staat', { id }, B.token);
  assert.equal(staat.status, 200, 'nu ziet B het project');
  assert.equal(staat.body.project.ikMaakte, false, 'en weet dat hij het niet startte');
  assert.ok(staat.body.project.leden.includes(B.codenaam), 'B staat als lid op codenaam, niet op naam');
  assert.equal(JSON.stringify(staat.body).includes('Leerling A'), false,
    'de ECHTE naam van A staat er nergens in -- leden zien elkaars codenaam');

  // meedoen: een taak maken, claimen, afvinken, en een notitie achterlaten
  assert.equal((await leer('taak-maak', { id, tekst: 'Lava namaken' }, B.token)).status, 200);
  const taak = (await leer('project-staat', { id }, B.token)).body.project.taken.find(t => t.tekst === 'Lava namaken');
  assert.equal((await leer('taak-zet', { id, taakId: taak.id, claim: true }, B.token)).status, 200);
  let na = (await leer('project-staat', { id }, A.token)).body.project;
  assert.equal(na.taken.find(t => t.id === taak.id).wie, B.codenaam, 'A ziet wie de taak claimde');
  assert.equal((await leer('taak-zet', { id, taakId: taak.id, af: true }, B.token)).status, 200);
  assert.equal((await leer('notitie', { id, tekst: 'Ik neem het zuiveringszout mee' }, B.token)).status, 200);
  na = (await leer('project-staat', { id }, A.token)).body.project;
  assert.equal(na.taken.find(t => t.id === taak.id).af, true);
  assert.ok(na.notities.some(n => n.van === B.codenaam), 'de notitie staat op de codenaam van B');

  // maar het project opruimen blijft van wie het startte
  assert.equal((await leer('project-weg', { id }, B.token)).status, 404, 'een deelnemer ruimt niet op');
  assert.equal((await leer('project-staat', { id }, A.token)).status, 200, 'het project staat er dus nog');
  assert.equal((await leer('project-weg', { id }, A.token)).status, 200, 'de starter wel');
  assert.equal((await leer('project-staat', { id }, B.token)).status, 404, 'en daarna is het voor iedereen weg');
});

test('9. een uitnodiging afwijzen laat je buiten, en een onbekende codenaam is een nette 404', async () => {
  const id = (await leer('project-maak', { titel: 'Museumbezoek' }, A.token)).body.id;
  await leer('project-uitnodig', { id, codenamen: [B.codenaam] }, A.token);
  assert.equal((await leer('project-antwoord', { id, akkoord: false }, B.token)).body.lid, false);
  assert.equal((await leer('project-staat', { id }, B.token)).status, 404, 'nee is nee');
  // en dezelfde uitnodiging kan niet nog eens worden aangenomen
  assert.equal((await leer('project-antwoord', { id, akkoord: true }, B.token)).status, 404);

  const onzin = await leer('project-uitnodig', { id, codenamen: ['Bestaat-Echt-Niet-' + Date.now()] }, A.token);
  assert.equal(onzin.status, 404, 'een onbekende codenaam is een nette 404');
  assert.equal(JSON.stringify(onzin.body).includes(B.codenaam), false,
    'en het antwoord verklapt geen bestaande codenamen');

  const plan = await leer('project-ai', { id, groep: '12-14' }, A.token);
  assert.equal(plan.status, 200, 'de projectplanner werkt (demostand zonder AI-sleutel)');
  assert.ok(Array.isArray(plan.body.taken) || plan.body.plan || plan.body.ok, 'en levert een voorstel');
});

/* ================= 4. schrijven: opdracht, feedback, en je eigen map ================= */

test('10. een schrijfopdracht, feedback die niet herschrijft, en bewaarde stukken blijven privé', async () => {
  const opdracht = await leer('schrijf-opdracht', { groep: '12-14' }, A.token);
  assert.equal(opdracht.status, 200);
  assert.ok(opdracht.body.opdracht, 'er komt een opdracht');

  const tekst = 'De zee was grijs die ochtend en ik wist meteen dat het een lange dag zou worden.';
  const fb = await leer('schrijf-feedback', { tekst, opdracht: opdracht.body.opdracht, groep: '12-14' }, A.token);
  assert.equal(fb.status, 200, JSON.stringify(fb.body));
  /* De belofte van deze functie is "compliment plus tips, nooit een
     herschrijving". Een buddy die je tekst teruggeeft als zijn eigen versie
     leert je niets, dus dat mag er niet uit komen. */
  assert.equal(JSON.stringify(fb.body).includes(tekst), false,
    'de feedback geeft de tekst niet herschreven terug');

  const bewaard = await leer('schrijf-bewaar', { opdracht: opdracht.body.opdracht, tekst, feedback: 'goed begin' }, A.token);
  assert.equal(bewaard.status, 200);

  const mijne = await leer('schrijfsels', {}, A.token);
  assert.equal(mijne.status, 200);
  assert.ok(JSON.stringify(mijne.body).includes('De zee was grijs'), 'A vindt zijn eigen stuk terug');

  const vanB = await leer('schrijfsels', {}, B.token);
  assert.equal(vanB.status, 200);
  assert.equal(JSON.stringify(vanB.body).includes('De zee was grijs'), false,
    'en het stuk van A staat niet in de map van B');
});

/* ================= 5. wie er helemaal niet in mag ================= */

test('11. een gast leert hier niet mee, en zonder inlog komt er niets doorheen', async () => {
  /* De gratis gastlaag heeft geen leerlaag (geenGast in routes/leren.js). Dat
     hoort een poort te zijn en geen lege lijst: anders hangt de grens af van
     wat de functie toevallig teruggeeft. */
  const alle = ['lijsten', 'lijst-maak', 'lijst-haal', 'lijst-weg', 'lijst-ai', 'overhoor-klaar',
    'herhaal', 'herhaal-antwoord', 'herhaal-stand',
    'sessie-start', 'sessie-antwoord', 'sessies', 'sessie-staat', 'sessie-zet',
    'projecten', 'project-maak', 'project-uitnodig', 'project-antwoord', 'project-staat',
    'project-weg', 'taak-maak', 'taak-zet', 'notitie', 'project-ai',
    'schrijf-opdracht', 'schrijf-feedback', 'schrijf-bewaar', 'schrijfsels'];
  assert.equal(alle.length, 28, 'alle achtentwintig acties worden geprobeerd');

  for (const pad of alle) {
    const alsGast = await leer(pad, { id: 'x', naam: 'x' }, gast.token);
    assert.equal(alsGast.status, 403, pad + ' hoort dicht te zitten voor een gast (' + alsGast.status + ')');
    const zonder = await leer(pad, { id: 'x' });
    assert.equal(zonder.status, 401, pad + ' zonder token');
    const vals = await leer(pad, { id: 'x' }, 'geen-echt-token');
    assert.equal(vals.status, 401, pad + ' met een vals token');
  }
});

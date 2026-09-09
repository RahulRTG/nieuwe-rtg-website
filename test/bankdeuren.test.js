/* ============================================================================
   ACHTER WELKE DEUR STAAT RTG BANK?

   De keuring telde 649 endpoints zonder toets. Verreweg de meeste daarvan zijn
   ongevaarlijk, maar achtentwintig raken geld, toegang of identiteit -- en
   zestien daarvan zijn RTG Bank. Rekeningen openen, rood staan, rente boeken,
   krediet toekennen, een salarisrun draaien, incasseren. Geen daarvan had een
   toets.

   Wat hier wordt vastgelegd is NIET het gelukkige pad. Bij een geld-endpoint is
   de vraag die er als eerste toe doet: wie komt er binnen? Dit huis heeft drie
   deuren naar het kantoor, en het verschil is groot:

   - officeAuth    : de GEDEELDE kantoorcode. Dat is geen persoon. Iedereen die
                     de code heeft is voor de server dezelfde.
   - kluisAuth     : dezelfde kamer, maar op NAAM. Geen extra recht -- een
                     identiteit. Wie met zijn eigen RTG-account de kantoorrol
                     draagt komt er door, de naamloze gedeelde sessie niet.
   - boardroomAuth : een eigen RTG-account dat van de eigenaar toegang kreeg,
                     of de eigenaar zelf. Dat is wel een persoon, EN het is een
                     recht dat de eigenaar per persoon verleent.

   De middelste deur is er in september 2026 bij gekomen voor de zes knoppen die
   geld verplaatsen of een recht verlenen. Toen deze toets werd geschreven
   stonden die achter de gedeelde code, en de kop van toets 5 zei erbij: zit er
   ooit een achter een strengere deur, dan is dat een verbetering die hier hoort
   te staan. Dat is precies wat er gebeurd is, en dus staat het hier.

   Een endpoint dat achter de verkeerde deur staat is precies de fout die we
   deze week drie keer hebben gevonden (het uitbetalen van het zaaksaldo, het
   vier-ogen-principe op de bank-opschaling, het personeelspin-slot). De toets
   hieronder pint per endpoint vast welke deur het is. Verschuift er ooit een,
   dan zakt dit, en dan is dat een BESLISSING in plaats van een schuiver.

   Deze toets bewijst niet dat de huidige verdeling de JUISTE is. Hij bewijst
   dat ze niet ongemerkt verandert. Dat onderscheid staat hier expres, zodat
   niemand deze toets voor een goedkeuring aanziet.

   Draai los: node --test test/bankdeuren.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bankdeur-'));
const CODE = 'KANTOOR-BANK-1';
let srv, base, office, opNaam, baas, lid;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

/* DE DEURENLIJST. Met de hand geschreven en niet uit de code afgeleid: een
   toets die zijn verwachting uit hetzelfde bestand haalt dat hij beproeft,
   bewijst niets. Verhuist een endpoint van deur, dan hoort iemand deze regel
   te wijzigen en daarbij na te denken. */
const KANTOOR = [
  '/api/office/bank', '/api/office/bank/gezond', '/api/office/bank/nood',
  '/api/office/bank/herstel', '/api/office/bank/mislukking', '/api/office/bank/leden',
  '/api/office/bank/instellingen',
  '/api/office/bank/afschrift', '/api/office/bank/rente', '/api/office/bank/krediet',
  '/api/office/bank/salaris/voorstel',
  '/api/office/bank/regels', '/api/office/bank/regels/update', '/api/office/bank/regels/check',
  /* De rail-reconciliatie en de bevoegdheidsmatrix. Twee ervan bieden een
     betaalopdracht opnieuw aan de rail aan, en dat is geld in beweging -- ze
     staan daarom ook in de GELD-lijst van toets 6. */
  '/api/office/bank/opdrachten', '/api/office/bank/opdrachten/ronde',
  '/api/office/bank/opdrachten/opnieuw', '/api/office/bank/bevoegdheid',
  '/api/office/bank/partnerrail'
];
/* DE ZES DIE OP NAAM MOESTEN. Elk van deze knoppen verplaatst geld of verleent
   een recht: een rekening openen, rood-staan-ruimte geven, bevriezen, krediet
   toekennen, de salarisrun uitbetalen, incasseren. Wat de lijst hierboven
   ERNAAST laat staan is net zo goed een besluit: het kredietbord, het
   salarisvoorstel, het afschrift en de bevoegdheidsmatrix zijn LEZINGEN, en
   KANTOORMACHT.md zet ENFORCE_EXECUTE bewust voor ENFORCE_READ. Wie een van
   deze zes terugzet naar de gedeelde code, laat toets 5b zakken. */
const KLUIS = [
  '/api/office/bank/rekening/open', '/api/office/bank/rekening/rood',
  '/api/office/bank/rekening/bevries', '/api/office/bank/krediet/besluit',
  '/api/office/bank/salaris/run', '/api/office/bank/incasso'
];
const BOARDROOM = [
  '/api/office/bank/modus', '/api/office/bank/draai', '/api/office/bank/operationeel',
  '/api/office/bank/autoriseer/bevestig', '/api/office/bank/autoriseer/annuleer',
  /* De vergunning staat hier en de matrix ernaast bij het kantoor: LEZEN wat er
     mag hoort bij het werk, VASTLEGGEN wat er is afgegeven hoort bij een
     persoon. Met de gedeelde code zou het huis zichzelf een bankvergunning
     kunnen geven, en daarmee de eigen rails opendraaien. */
  '/api/office/bank/vergunning'
];

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;

  office = (await api('/api/office/login', { code: CODE })).body.token;
  assert.ok(office, 'de gedeelde kantoorinlog werkt');

  const eig = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(eig, 'de eigenaar kan inloggen');
  baas = (await api('/api/account/start', { rol: 'kantoor' }, eig)).body.token;
  assert.ok(baas, 'de eigenaar staat in de backoffice op zijn eigen account');

  const u = Date.now().toString(36);
  lid = (await api('/api/auth/register', { name: 'Bankkijker', email: 'bk' + u + '@voorbeeld.test',
    phone: '06' + String(10000000 + Math.floor(Math.random() * 8e7)), password: 'Geheim123!',
    geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  assert.ok(lid, 'en er is een gewoon lid om mee te vergelijken');

  /* EN EEN GEWONE KANTOORMEDEWERKER OP NAAM -- met opzet niet de eigenaar. De
     eigenaar komt overal door omdat hij de eigenaar is; dan zou toets 5b
     alleen bewijzen dat de baas erlangs kan. Dit is een gewoon lid dat de
     kantoorrol koppelt met dezelfde gedeelde code: hij krijgt er geen recht
     bij, alleen een naam. Precies het verschil dat kluisAuth meet. */
  const w = (Date.now() + 7919).toString(36);
  const werker = (await api('/api/auth/register', { name: 'Bankmedewerker', email: 'bm' + w + '@voorbeeld.test',
    phone: '06' + String(10000000 + Math.floor(Math.random() * 8e7)), password: 'Geheim123!',
    geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  assert.ok(werker, 'de kantoormedewerker heeft een eigen account');
  const kop = await api('/api/account/koppel', { soort: 'kantoor', code: CODE }, werker);
  assert.equal(kop.status, 200, 'en koppelt daarin de kantoorrol: ' + JSON.stringify(kop.body).slice(0, 140));
  opNaam = (await api('/api/account/start', { rol: 'kantoor' }, werker)).body.token;
  assert.ok(opNaam, 'en staat daarmee op naam in de backoffice');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* DEZE TOETS DRAAGT DE REST. Verderop laten we een 404 gelden als "de deur is
   gepasseerd, het lijf klopte alleen niet" -- en dat is alleen waar zolang de
   route ECHT BESTAAT. Zou bank-rekeningen.js niet gemount zijn, dan geeft elk
   pad 404 en zouden toets 5 en 6 leeg slagen: precies de vorm van dekking die
   geen dekking is. Een 401 zonder token kan alleen uit de poortwachter komen,
   dus dit is het bewijs dat de routes er zijn. De lijst mag daarom ook niet
   stilletjes leeglopen; vandaar de telling. */
test('1. geen enkel bank-endpoint staat open zonder inlog (en ze bestaan allemaal)', async () => {
  const alle = KANTOOR.concat(KLUIS, BOARDROOM);
  assert.equal(alle.length, 31, 'de deurenlijst is compleet; loopt hij leeg, dan bewijzen 5 en 6 niets meer');
  for (const pad of alle) {
    const r = await api(pad, {}, null);
    assert.equal(r.status, 401, pad + ' hoort 401 te geven zonder token (kreeg ' + r.status + ')');
    assert.doesNotMatch(String(r.body.error || ''), /onbekend eindpunt/i,
      pad + ' bestaat echt -- een 404 hier zou betekenen dat de route niet gemount is en dat de rest van dit bestand leeg slaagt');
  }
});

/* Een gewoon lid heeft een geldig token -- alleen niet voor deze kamer. Dit is
   het geval dat ertoe doet: niet "geen token" maar "het verkeerde token". */
test('2. een gewoon lid komt nergens bij de bank', async () => {
  for (const pad of KANTOOR.concat(KLUIS, BOARDROOM)) {
    const r = await api(pad, {}, lid);
    assert.equal(r.status, 401, pad + ' hoort een gewoon lid te weigeren (kreeg ' + r.status + ')');
    assert.doesNotMatch(JSON.stringify(r.body), /iban|saldo|rekening|krediet/i,
      pad + ' lekt geen bankgegevens mee in de weigering');
  }
});

/* De zes zwaarste knoppen staan achter de boardroom: de bankmodus omzetten,
   de bank terugdraaien, hem operationeel verklaren, een autorisatie bevestigen
   of annuleren, en de vergunning vastleggen. De gedeelde kantoorcode is daar
   nadrukkelijk niet genoeg -- die is geen persoon, en bij deze knoppen wil je
   weten wie. */
test('3. de gedeelde kantoorcode komt de boardroom niet in', async () => {
  for (const pad of BOARDROOM) {
    const r = await api(pad, {}, office);
    assert.equal(r.status, 403, pad + ' hoort de gedeelde code te weigeren (kreeg ' + r.status + ')');
    assert.match(String(r.body.error || ''), /boardroom/i, pad + ' zegt ook waarom');
  }
});

/* En de tegenproef, want anders bewijst toets 3 alleen dat er iets dichtzit:
   de eigenaar komt er wel door. We kijken uitsluitend naar de DEUR -- een 400
   omdat het lijf niet klopt is prima, een 401 of 403 niet. */
test('4. de eigenaar komt de boardroom wel in', async () => {
  for (const pad of BOARDROOM) {
    const r = await api(pad, {}, baas);
    assert.notEqual(r.status, 401, pad + ' hoort de eigenaar niet te weigeren');
    assert.notEqual(r.status, 403, pad + ' hoort de eigenaar niet te weigeren (kreeg ' +
      r.status + ': ' + JSON.stringify(r.body).slice(0, 120) + ')');
  }
});

/* De kantoorkant. Wat hier overblijft is het dagelijkse werk: kijken naar het
   kredietbord, het afschrift, de tarieven, de reconciliatie. Dat staat achter
   de GEDEELDE code, en dat leggen we zo vast -- niet omdat het goed is, maar
   zodat het zichtbaar is en niet stilletjes kan verschuiven. Zie de kop. */
test('5. de kantoorcode komt bij de kantoor-endpoints door de deur', async () => {
  const doorgelaten = [];
  for (const pad of KANTOOR) {
    const r = await api(pad, {}, office);
    assert.notEqual(r.status, 401, pad + ' hoort de kantoorcode door de deur te laten');
    if (r.status !== 403) doorgelaten.push(pad);
  }
  assert.equal(doorgelaten.length, KANTOOR.length,
    'alle ' + KANTOOR.length + ' kantoor-endpoints laten de gedeelde code toe; ' +
    'zit er ineens een achter een strengere deur, dan is dat een verbetering die hier hoort te staan');
});

/* DE MIDDELSTE DEUR, en dit is de toets die de verbetering vasthoudt. Twee
   beweringen in een, want los is elk de helft: de gedeelde code komt er NIET
   door (anders is de deur decor), en een gewone medewerker op naam WEL (anders
   is het geen deur maar een muur, en dan wordt hij binnen een maand met een
   uitzondering weer opengezet).

   Let op wie er in de tegenproef staat: niet de eigenaar maar een gewoon lid
   met de kantoorrol. De eigenaar komt overal door, dus met hem zou de tweede
   helft niets bewijzen. */
test('5b. de zes geld-knoppen vragen een NAAM, en een medewerker op naam komt er door', async () => {
  for (const pad of KLUIS) {
    const r = await api(pad, {}, office);
    assert.equal(r.status, 403, pad + ' hoort de gedeelde code te weigeren (kreeg ' + r.status + ')');
    assert.equal(r.body.poort, 'kluis', pad + ' zegt welke deur het is');
    assert.equal(r.body.watNu, 'inloggen-op-naam', pad + ' zegt ook hoe het wel kan -- een grens, geen muur');
  }
  for (const pad of KLUIS) {
    const r = await api(pad, {}, opNaam);
    assert.notEqual(r.status, 401, pad + ' hoort een kantoorsessie op naam niet te weigeren');
    assert.notEqual(r.status, 403, pad + ' hoort een kantoorsessie op naam niet te weigeren (kreeg ' +
      r.status + ': ' + JSON.stringify(r.body).slice(0, 120) + ')');
  }
});

/* Drie kantoor-endpoints VERPLAATSEN nog steeds GELD achter de gedeelde code.
   Dat leggen we hier alleen vast; het besluit erover ligt bij de eigenaar. Deze
   aparte toets bestaat zodat dat feit een eigen regel in de uitslag heeft en
   niet wegvalt in een lus over twintig paden. De vier die hier weg zijn staan
   nu in KLUIS -- dat is de richting waarin deze lijst hoort te krimpen. */
test('6. drie geld-verplaatsende knoppen staan nog achter de gedeelde code -- vastgelegd, niet goedgekeurd', async () => {
  const GELD = ['/api/office/bank/rente',
    /* De rail-reconciliatie: allebei bieden ze een reeds geboekte betaalopdracht
       opnieuw aan de rail aan. Geen nieuw besluit, wel geld dat alsnog het huis
       verlaat -- en dus hoort het in deze lijst. */
    '/api/office/bank/opdrachten/ronde', '/api/office/bank/opdrachten/opnieuw'];
  for (const pad of GELD) {
    const r = await api(pad, {}, office);
    assert.notEqual(r.status, 401, pad);
    assert.notEqual(r.status, 403, pad + ' staat vandaag achter de gedeelde kantoorcode');
  }
});

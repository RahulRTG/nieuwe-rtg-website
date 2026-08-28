/* ============================================================================
   ACHTER WELKE DEUR STAAT RTG BANK?

   De keuring telde 649 endpoints zonder toets. Verreweg de meeste daarvan zijn
   ongevaarlijk, maar achtentwintig raken geld, toegang of identiteit -- en
   zestien daarvan zijn RTG Bank. Rekeningen openen, rood staan, rente boeken,
   krediet toekennen, een salarisrun draaien, incasseren. Geen daarvan had een
   toets.

   Wat hier wordt vastgelegd is NIET het gelukkige pad. Bij een geld-endpoint is
   de vraag die er als eerste toe doet: wie komt er binnen? Dit huis heeft twee
   deuren naar het kantoor, en het verschil is groot:

   - officeAuth    : de GEDEELDE kantoorcode. Dat is geen persoon. Iedereen die
                     de code heeft is voor de server dezelfde.
   - boardroomAuth : een eigen RTG-account dat van de eigenaar toegang kreeg,
                     of de eigenaar zelf. Dat is wel een persoon.

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
let srv, base, office, baas, lid;

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
  '/api/office/bank/instellingen', '/api/office/bank/rekening/open',
  '/api/office/bank/rekening/rood', '/api/office/bank/rekening/bevries',
  '/api/office/bank/afschrift', '/api/office/bank/rente', '/api/office/bank/krediet',
  '/api/office/bank/krediet/besluit', '/api/office/bank/salaris/voorstel',
  '/api/office/bank/salaris/run', '/api/office/bank/incasso',
  '/api/office/bank/regels', '/api/office/bank/regels/update', '/api/office/bank/regels/check',
  /* De rail-reconciliatie en de bevoegdheidsmatrix. Twee ervan bieden een
     betaalopdracht opnieuw aan de rail aan, en dat is geld in beweging -- ze
     staan daarom ook in de GELD-lijst van toets 6. */
  '/api/office/bank/opdrachten', '/api/office/bank/opdrachten/ronde',
  '/api/office/bank/opdrachten/opnieuw', '/api/office/bank/bevoegdheid',
  '/api/office/bank/partnerrail'
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
  const alle = KANTOOR.concat(BOARDROOM);
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
  for (const pad of KANTOOR.concat(BOARDROOM)) {
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

/* De kantoorkant. Dit is de bewering die het meest te zeggen heeft en die het
   ongemakkelijkst is: rekening openen, rente boeken, krediet besluiten, een
   salarisrun draaien en incasseren staan achter de GEDEELDE code. Dat is
   vandaag zo, dus dat leggen we zo vast -- niet omdat het goed is, maar zodat
   het zichtbaar is en niet stilletjes kan verschuiven. Zie de kop. */
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

/* Zeven van die kantoor-endpoints VERPLAATSEN GELD of verlenen krediet. Dat ze
   met de gedeelde code bereikbaar zijn is een risico dat we hier alleen
   vastleggen; het besluit erover ligt bij de eigenaar. Deze aparte toets
   bestaat zodat dat feit een eigen regel in de uitslag heeft en niet wegvalt
   in een lus over twintig paden. */
test('6. zeven geld-verplaatsende knoppen staan achter de gedeelde code -- vastgelegd, niet goedgekeurd', async () => {
  const GELD = ['/api/office/bank/rekening/open', '/api/office/bank/rente',
    '/api/office/bank/krediet/besluit', '/api/office/bank/salaris/run', '/api/office/bank/incasso',
    /* Nieuw in de rail-reconciliatie: allebei bieden ze een reeds geboekte
       betaalopdracht opnieuw aan de rail aan. Geen nieuw besluit, wel geld dat
       alsnog het huis verlaat -- en dus hoort het in deze lijst. */
    '/api/office/bank/opdrachten/ronde', '/api/office/bank/opdrachten/opnieuw'];
  for (const pad of GELD) {
    const r = await api(pad, {}, office);
    assert.notEqual(r.status, 401, pad);
    assert.notEqual(r.status, 403, pad + ' staat vandaag achter de gedeelde kantoorcode');
  }
});

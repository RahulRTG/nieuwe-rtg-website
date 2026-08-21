/* DE KANTOORKANT VAN DE CATALOGUS-WENSEN.

   De onboarding vraagt een nieuw lid of het een bedrijf heeft, en met een vinkje
   legt het de wens vast om in de RTG-catalogus te komen
   (kern/onboarding/meebouwen.js). Het lid krijgt te horen dat RTG ernaar kijkt.
   Die wens stond op de onderneming en werd door NIEMAND gelezen: er was geen
   scherm waar iemand keek. Een wens zonder lezer is een belofte die de code niet
   waarmaakt (LAT-regel 6).

   Wat deze toets vastlegt:
   1. de wens komt op het kantoor terecht, en verdwijnt uit "open" zodra een mens
      hem behandelt;
   2. op CODENAAM -- de echte naam ligt in de gescheiden kluis en hoort niet in
      een lijst, ook niet achter de kantoorpoort;
   3. het besluit maakt GEEN zaak. Een partnerplek loopt langs de bestaande weg,
      met ledenbewijs en een besluit van de boardroom. Twee deuren naar dezelfde
      catalogus zou betekenen dat de ene de eis van de andere overslaat;
   4. en die eis is een PAS, niet DE Business Pass. Elk lid met een pas mag een
      bedrijf aanmelden, de gratis laag niet -- één lijst voor beide deuren
      (server/kern/paseis.js).
   Draai: npm test -- --bestanden=catalogus-wensen */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, elevateTier } = require('./helper');

const CODE = 'RTG-CW-TEST';

function post(base) {
  return (pad, body, token, idem) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {},
      idem ? { 'Idempotency-Key': idem } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let teller = 0;
const mailBijToken = new Map();
const leesMail = (token) => mailBijToken.get(token);
async function versLid(P, naam, tier) {
  const u = String(Date.now()).slice(-7) + String(++teller).padStart(3, '0');
  const email = naam.toLowerCase() + u + '@x.nl';
  const r = await P('/api/auth/register', Object.assign({
    name: naam, email, password: 'geheim123', geboortedatum: '1990-01-01'
  }, tier === 'guest' ? { tier: 'guest' } : { tier: 'rtg', pasApp: 'rtg' }));
  assert.ok(r.body.token, naam + ' is aangemeld: ' + JSON.stringify(r.body).slice(0, 140));
  mailBijToken.set(r.body.token, email);
  return r.body.token;
}

test('een wens uit de onboarding komt op het kantoor, op codenaam, en een mens beslist', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cw-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  try {
    const P = post(srv.base);
    const lid = await versLid(P, 'Pieternel');
    const kantoor = (await P('/api/office/login', { code: CODE })).body.token;
    assert.ok(kantoor, 'de kantoorcode werkt');

    // leeg tot er iemand iets vraagt
    const leeg = (await P('/api/office/catalogus-wensen', {}, kantoor)).body;
    assert.equal(leeg.open, 0, 'de lijst begint leeg');

    // 1. het lid geeft zijn bedrijf op EN vraagt om de catalogus
    const gemaakt = await P('/api/onboarding/bedrijf', { naam: 'Atelier Pieternel', catalogus: true }, lid);
    assert.equal(gemaakt.status, 200, JSON.stringify(gemaakt.body).slice(0, 160));

    const na = (await P('/api/office/catalogus-wensen', {}, kantoor)).body;
    assert.equal(na.open, 1, 'de wens staat op het kantoor: ' + JSON.stringify(na).slice(0, 200));
    const w = na.wensen[0];
    assert.equal(w.naam, 'Atelier Pieternel');
    assert.ok(w.gevraagd, 'met een tijdstip erbij');
    /* De pas staat erbij als inlichting, niet als drempel: dit lid heeft een
       gewone RTG Pass en zijn wens hoort gewoon op de lijst te staan. Een veld
       dat "geen Business Pass" roept, is de oude regel die terugkomt. */
    assert.equal(w.pas, 'rtg', 'de pas staat erbij zoals hij is: ' + w.pas);
    assert.ok(!('businessPass' in w), 'en niet als drempelvlag: ' + JSON.stringify(w));

    /* 2. OP CODENAAM. Klantdata draait in dit huis op codenamen; achter de
       kantoorpoort zitten is geen reden om daar een echte naam neer te zetten. */
    const alles = JSON.stringify(na);
    assert.doesNotMatch(alles, /Pieternel@|pieternel[0-9]/i, 'geen e-mailadres in de lijst');
    assert.ok(!/"eigenaar":"user-/.test(alles),
      'en niet de rauwe sleutel maar een codenaam: ' + w.eigenaar);
    assert.ok(w.eigenaar && w.eigenaar.length > 2, 'er staat wel iemand bij: ' + w.eigenaar);

    /* 3. HET BESLUIT MAAKT GEEN ZAAK. Dat blijft de partnerweg, met ledenbewijs.
       Zou dit besluit het ook kunnen, dan sloeg de ene deur de eis van de andere
       over. */
    const zakenVoor = ((await P('/api/suppliers', {}, lid)).body.suppliers || []).length;
    const besluit = await P('/api/office/catalogus-wens/besluit',
      { id: w.id, besluit: 'opgepakt' }, kantoor);
    assert.equal(besluit.status, 200, JSON.stringify(besluit.body).slice(0, 160));
    const zakenNa = ((await P('/api/suppliers', {}, lid)).body.suppliers || []).length;
    assert.equal(zakenNa, zakenVoor, 'er is geen zaak bijgekomen');

    const naBesluit = (await P('/api/office/catalogus-wensen', {}, kantoor)).body;
    assert.equal(naBesluit.open, 0, 'de wens staat niet meer open');
    assert.equal(naBesluit.wensen[0].besluit, 'opgepakt', 'maar hij is wel te zien, met het besluit erbij');
    assert.ok(naBesluit.wensen[0].door, 'en met wie het deed: ' + naBesluit.wensen[0].door);

    /* TWEE KEER BESLISSEN KAN NIET -- maar dan moet het wel een tweede BESLUIT
       zijn en geen dubbelklik. Deze route staat als `zelfdeVerzoek` verklaard
       (lib/idemsleutels-werelden.js), dus een woordelijk gelijk verzoek binnen
       seconden hoort het eerste antwoord terug te krijgen; dat is wat die laag
       moet doen. Een bewust tweede besluit draagt een eigen Idempotency-Key. */
    const nogmaals = await P('/api/office/catalogus-wens/besluit', { id: w.id, besluit: 'opgepakt' },
      kantoor, 'tweede-besluit-wens');
    assert.equal(nogmaals.status, 409, 'een tweede besluit kaatst af');
  } finally { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});

test('afwijzen vraagt een reden, en zonder kantoorinlog beslist niemand iets', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cw2-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  try {
    const P = post(srv.base);
    const lid = await versLid(P, 'Quirijn');
    await P('/api/onboarding/bedrijf', { naam: 'Quirijn Bouw', catalogus: true }, lid);
    const kantoor = (await P('/api/office/login', { code: CODE })).body.token;
    const w = (await P('/api/office/catalogus-wensen', {}, kantoor)).body.wensen[0];

    // zonder kantoorinlog: dicht
    assert.equal((await P('/api/office/catalogus-wensen', {})).status, 401, 'de lijst is dicht');
    assert.equal((await P('/api/office/catalogus-wens/besluit', { id: w.id, besluit: 'opgepakt' })).status, 401,
      'en het besluit ook');

    // afwijzen zonder reden: een deur die dichtgaat krijgt een grond
    const zonder = await P('/api/office/catalogus-wens/besluit', { id: w.id, besluit: 'afgewezen' }, kantoor);
    assert.equal(zonder.status, 400, 'afwijzen zonder reden mag niet: ' + JSON.stringify(zonder.body));
    const met = await P('/api/office/catalogus-wens/besluit',
      { id: w.id, besluit: 'afgewezen', notitie: 'Werkt niet in een genre dat wij bedienen.' }, kantoor);
    assert.equal(met.status, 200, JSON.stringify(met.body).slice(0, 160));
    const lijst = (await P('/api/office/catalogus-wensen', {}, kantoor)).body.wensen[0];
    assert.equal(lijst.besluit, 'afgewezen');
    assert.match(lijst.notitie, /genre/, 'de reden staat erbij: ' + lijst.notitie);

    // een onbekende wens is een nette 404
    assert.equal((await P('/api/office/catalogus-wens/besluit',
      { id: 'ond_bestaatniet', besluit: 'opgepakt' }, kantoor)).status, 404);
  } finally { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});

/* En de tegenproef: wie GEEN vinkje zette, staat niet op de lijst. Het bedrijf
   is dan gewoon van hem en RTG heeft er niets mee te maken. */
test('zonder vinkje komt het bedrijf niet op de kantoorlijst', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cw3-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  try {
    const P = post(srv.base);
    const lid = await versLid(P, 'Rosalie');
    const r = await P('/api/onboarding/bedrijf', { naam: 'Rosalie Studio', catalogus: false }, lid);
    assert.equal(r.status, 200);
    const kantoor = (await P('/api/office/login', { code: CODE })).body.token;
    const lijst = (await P('/api/office/catalogus-wensen', {}, kantoor)).body;
    assert.equal(lijst.aantal, 0, 'zonder vinkje staat er niets op het kantoor: ' + JSON.stringify(lijst));
    // maar het bedrijf is er wel, van hem
    const mijn = (await P('/api/onderneming/mijn', {}, lid)).body.ondernemingen || [];
    assert.ok(mijn.some(o => o.naam === 'Rosalie Studio'), 'het bedrijf staat wel op zijn naam');
  } finally { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});

/* De pas erbij: wie het is, niet of het mag. Aparte toets omdat hij twee extra
   leden aanmaakt en de tellingen van de eerste toets dan niet meer kloppen. */
test('de pas van de aanvrager staat erbij, en de gratis laag meldt niets aan', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cw4-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  try {
    const P = post(srv.base);
    const kantoor = (await P('/api/office/login', { code: CODE })).body.token;

    // een gewone RTG Pass komt gewoon op de lijst: de eis is een pas, niet DE pas
    const gewoon = await versLid(P, 'Renske');
    await P('/api/onboarding/bedrijf', { naam: 'Renske Repareert', catalogus: true }, gewoon);
    const rw = ((await P('/api/office/catalogus-wensen', {}, kantoor)).body.wensen || [])
      .find(x => x.naam === 'Renske Repareert');
    assert.ok(rw, 'de wens van een RTG-lid staat op het kantoor');
    assert.equal(rw.pas, 'rtg', 'met zijn pas erbij: ' + rw.pas);
    assert.ok(!('businessPass' in rw), 'en niet als drempelvlag: ' + JSON.stringify(rw));

    /* EN DE PAS IS ECHT OPGEZOCHT, niet de terugvalwaarde. De opzoeker geeft
       'rtg' terug als hij het lid niet kent, dus een veld dat altijd 'rtg' zegt
       ziet er hierboven precies hetzelfde uit. Een lid dat ECHT naar Business is
       getild moet dus 'business' opleveren. */
    const bazin = await versLid(P, 'Berber');
    await elevateTier(srv.base, bazin, 'business', kantoor);
    const bzk = (await P('/api/auth/login', { login: leesMail(bazin), password: 'geheim123', pasApp: 'business' })).body;
    assert.equal(bzk.state.user.tier, 'business', 'Berber heeft nu echt een Business Pass');
    await P('/api/onboarding/bedrijf', { naam: 'Berber Beheer', catalogus: true }, bzk.token);
    const bw = ((await P('/api/office/catalogus-wensen', {}, kantoor)).body.wensen || [])
      .find(x => x.naam === 'Berber Beheer');
    assert.ok(bw, 'de wens van Berber staat er ook');
    assert.equal(bw.pas, 'business', 'en zijn pas wordt echt opgezocht: ' + bw.pas);

    /* DE GRATIS LAAG MELDT GEEN BEDRIJF AAN. Dat is de enige grens die overblijft
       nu de Business Pass-eis weg is: er hoort een LID achter een aanvraag. Zijn
       eigen bedrijf op eigen naam zetten mag wel -- dat verlaat het huis niet. */
    const gast = await versLid(P, 'Gratisje', 'guest');
    const gastR = await P('/api/onboarding/bedrijf', { naam: 'Klus Gratisje', catalogus: true }, gast);
    assert.equal(gastR.status, 200, 'zijn eigen bedrijf mag hij wel aanmaken');
    assert.equal(gastR.body.catalogusWens, false, 'maar de wens wordt niet vastgelegd');
    assert.ok(((await P('/api/onderneming/mijn', {}, gast)).body.ondernemingen || [])
      .some(o => o.naam === 'Klus Gratisje'), 'en zijn bedrijf staat gewoon op zijn naam');
    assert.ok(!((await P('/api/office/catalogus-wensen', {}, kantoor)).body.wensen || [])
      .some(x => x.naam === 'Klus Gratisje'), 'hij komt niet op de kantoorlijst');

  } finally { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});

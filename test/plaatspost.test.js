/* ============================================================================
   DE BEWAKER OP ZIJN POST -- de kring die bij fase 2a openging, gesloten.

   Bij fase 2a ging er iets weg: kern/beveiliging/pda/patrouille.js bewaarde bij
   het inklokken de rauwe positie van de bewaker op zijn dienst, en NIEMAND las
   hem ooit -- dienstPubliek() gaf hem niet terug, geen scherm toonde hem, geen
   rapportage rekende ermee. Een coördinaat die niemand leest is geen functie
   maar alleen een risico, en juist bij een bewaker: dat is een mens wiens
   werkgever daarmee precies wist waar hij op welk moment stond.

   Wat ervoor terugkomt is BINNEN OF BUITEN DE POST, met een tijd. Meer gebruikt
   en minder bewaard. Dat is de belofte van deze toets.

   EN HET BEWIJST DE TWEEDE BRON. Fase 2b maakte van "waar komen hekken vandaan"
   een register waar een domein zijn eigen plaatsen in levert (PLAATS.md par. 3).
   De eerste bron zijn je werkplekken; dit is de tweede, en dat is precies waar
   zo'n register voor bestaat: een bewaker werkt niet op het kantooradres van
   zijn werkgever maar op een post, en die staat in geen enkele algemene
   plekkenlijst.

   DE POSTEN VAN EEN TEAM ZIJN NIET OPENBAAR. Welke objecten een
   beveiligingsbedrijf bewaakt, is bedrijfsgevoelig. De hekkenlijst gaat naar het
   toestel, dus een bron die niet filtert zet die lijst op de telefoon van elk
   lid dat de route aanroept. Toets 3 hieronder is daarvoor.

   Draai los: node --experimental-sqlite --test test/plaatspost.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, mgr, guardTok, lidToken, post, buitenstaander, gezaaid, gezaaidTok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-plaatspost-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'AEGIS' } });
  base = srv.base;
  const login = await api('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  mgr = login.body.token;
  /* Een GEZAAIDE bewaker voor de PDA-kant. Een verse kan hier niet: beveiliging
     is een genre met een persoonseis (identiteit + beveiligingspas, zie
     CLAUDE.md), dus een nieuw aangemaakte bewaker kan niet eens inloggen. Dat is
     terecht en het is precies de deur waar een fraudeur op mikt -- maar het
     betekent wel dat een bewaker MET een gekoppeld ledenaccount in een toets
     niet te maken is zonder die eis te vervalsen. Vandaar de tweedeling
     hieronder: de hek-kant meten we met een gekoppeld LID (toets 1 en 3), de
     PDA-kant met een gezaaide bewaker zonder account (toets 2). */
  gezaaid = (login.body.state.staff || []).find(x => x.role === 'staff');
  gezaaidTok = (await api('/api/supplier/login', { code: 'AEGIS', staffId: gezaaid.id, pin: '5678' })).body.token;
  assert.ok(gezaaidTok, 'de gezaaide bewaker kan inloggen');

  // een verse bewaker die OOK een RTG-account heeft: pas dan is er een codenaam
  const nieuw = await api('/api/supplier/staff/add', { name: 'Wil Wacht', role: 'staff', func: 'Bewaker' }, mgr);
  assert.equal(nieuw.status, 200, 'de manager maakt een bewakersplek');
  const st = nieuw.body.staff, staffPin = nieuw.body.pin;

  const u = String(Date.now()).slice(-8);
  const reg = await api('/api/auth/register', { name: 'Wil Wacht', email: 'ww' + u + '@voorbeeld.test',
    password: 'wachtgeheim123', geboortedatum: '1990-05-05', tier: 'rtg', pasApp: 'rtg' });
  lidToken = reg.body.token;
  const koppel = await api('/api/account/koppel', { soort: 'personeel', code: 'AEGIS', staffId: st.id, pin: staffPin }, lidToken);
  assert.equal(koppel.status, 200, 'de bewaker is aan zijn RTG-account gekoppeld');
  guardTok = (await api('/api/supplier/login', { code: 'AEGIS', staffId: st.id, pin: staffPin })).body.token;

  // een lid dat NIET bij dit team werkt
  const b = await api('/api/auth/register', { name: 'Bea Buiten', email: 'bb' + u + '@voorbeeld.test',
    password: 'buitengeheim123', geboortedatum: '1991-06-06', tier: 'rtg', pasApp: 'rtg' });
  buitenstaander = b.body.token;

  // een post met een echte plek
  const zet = await api('/api/supplier/beveiliging/post', { naam: 'Proefobject', klant: 'Toets',
    lat: 38.912, lng: 1.441, minMan: 1 }, mgr);
  assert.equal(zet.status, 200, 'de manager zet een post met coördinaten');
  const cmd = await api('/api/supplier/beveiliging/command', {}, mgr);
  post = (cmd.body.postenLijst || []).find(p => p.naam === 'Proefobject') ||
         ((await api('/api/supplier/beveiliging/posten', {}, mgr)).body.posten || []).find(p => p.naam === 'Proefobject');
  assert.ok(post && post.id, 'de post staat in de lijst van het team');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de post van mijn team is een hek, geleverd door zijn eigen domein', async () => {
  const h = await api('/api/plaats/hekken', { doel: 'dienst' }, lidToken);
  assert.equal(h.body.status, 200);
  const hek = (h.body.hekken || []).find(x => x.id === 'bevpost:AEGIS:' + post.id);
  assert.ok(hek, 'de post staat als hek in mijn lijst');
  assert.equal(hek.bron, 'bevpost', 'en hij noemt het domein dat hem levert');
  assert.equal(hek.doel, 'dienst');
  assert.equal(hek.punten[0].lat, 38.912, 'met de plek van de post zelf, niet met een kopie ervan');
});

test('2. inklokken op de post legt AANWEZIGHEID vast, en geen coordinaat', async () => {
  const dag = new Date().toISOString().slice(0, 10);
  const zet = await api('/api/supplier/beveiliging/dienst',
    { postId: post.id, shiftId: 'nacht', datum: dag, guardId: gezaaid.id }, mgr);
  assert.equal(zet.status, 200, 'de manager plant een dienst op de proefpost');

  const inklok = await api('/api/supplier/beveiliging/pda/inklok',
    { id: zet.body.dienst.id, lat: 38.912, lng: 1.441 }, gezaaidTok);
  assert.equal(inklok.status, 200, 'de bewaker klokt in');
  const d = inklok.body.dienst;

  /* DE UITSPRAAK STAAT ER, en hij zegt "niet gemeten" -- want deze bewaker heeft
     geen gekoppeld RTG-account en dus geen codenaam, dus er heeft niemand
     gekeken. Dat is iets anders dan "niet aanwezig", en dat verschil is het hele
     punt: zonder die derde stand wordt elke ongemeten inklok een verdachte. */
  assert.ok(d.plekIn, 'de dienst draagt een plaats-uitspraak');
  assert.equal(d.plekIn.gemeten, false);
  assert.equal(d.plekIn.bevestigd, false);
  /* De reden mag hier 'geen ledenaccount' of 'niets waargenomen' zijn -- de
     gezaaide bewaker draagt een demo-identiteit, dus de codenaam lost wél op en
     dan is het tweede het eerlijke antwoord. Wat NIET mag, is dat een van beide
     als 'niet bevestigd' uitkomt: dan is een bewaker over wie niemand iets
     gemeten heeft, ineens een bewaker die er niet was. */
  assert.ok(['geen ledenaccount', 'niets waargenomen', 'geen venster'].includes(d.plekIn.reden),
    'de reden zegt dat er niemand keek, en welke: ' + d.plekIn.reden);

  /* EN DE COORDINAAT IS WEG. De client stuurde er hierboven bewust nog een mee;
     hij hoort genegeerd te worden. Hier stond `d.lat = Number(lat)` en niemand
     las het ooit -- een coordinaat die niemand leest is geen functie maar alleen
     een risico, en juist bij een bewaker. */
  assert.equal(d.lat, undefined, 'de dienst draagt geen breedtegraad meer');
  assert.equal(d.lng, undefined, 'en geen lengtegraad');
  const tekst = JSON.stringify(d);
  for (const veld of ['lat', 'lng']) {
    assert.ok(!tekst.includes('"' + veld + '"'), 'de dienstregel draagt geen ' + veld);
  }
});

test('3. een lid dat hier niet werkt, krijgt de posten NIET te zien', async () => {
  const h = await api('/api/plaats/hekken', { doel: 'dienst' }, buitenstaander);
  assert.equal(h.body.status, 200);
  const posten = (h.body.hekken || []).filter(x => String(x.id).startsWith('bevpost:'));
  /* Welke objecten een beveiligingsbedrijf bewaakt is bedrijfsgevoelig, en deze
     lijst gaat naar het TOESTEL. Een bron die niet filtert zet hem op de telefoon
     van elk lid dat de route aanroept -- dat is de reden dat een bron de codenaam
     en de sleutel krijgt, en niet zomaar alles teruggeeft. */
  assert.equal(posten.length, 0, 'een buitenstaander ziet geen enkele post van dit team');
  assert.equal((h.body.hekken || []).length, 0, 'en hij heeft hier ook geen werkplek');
});

/* DE TERUGSTORTING -- saldo terug naar de eigen rekening.

   WAAROM DEZE TOETS ER IS

   Dit is de zwaarste handeling van de hele betaallaag, en de enige waarbij geld
   het huis verlaat richting het lid. Precies die weg maakte dat het besluit
   WALLET_SALDO van soort moest wisselen: saldo dat inwisselbaar is tegen de
   nominale waarde is elektronisch geld, geen beperkt netwerk meer.

   Er zijn hier drie manieren om het stil fout te doen, en alle drie kosten ze
   iemand echt geld.

   1. UITBETALEN WAT ER NIET IS. Wie het saldo leest in plaats van het
      beschikbare deel, betaalt geld uit dat al gereserveerd of geoormerkt was.
   2. UITBETALEN AAN DE VERKEERDE. Een tikfout in een IBAN dat toevallig
      bestaat, of -- veel erger -- een overgenomen account waar de aanvaller zijn
      eigen rekening in heeft gezet.
   3. TWEE KEER UITBETALEN. Een dubbeltik of een haperend netwerk, en het geld is
      twee keer weg terwijl het saldo maar een keer daalde.

   WAT HIER WORDT NAGETROKKEN

   1. HET LID WEET WAT ER KAN EN WAT ER MIST, met een reden per blokkade.
   2. EEN ONGELDIG IBAN KOMT ER NIET IN -- met de echte mod-97-toets, niet
      alleen een vormcontrole.
   3. DE EERSTE REKENING KAN METEEN, EEN WIJZIGING WACHT. Dat verschil is het
      hele beveiligingsontwerp; zonder het tweede deel is een overname gratis,
      met het eerste deel erbij is een eerlijke gebruiker onnodig een dag kwijt.
   4. HET GELD GAAT ER ECHT AF, EN PRECIES EEN KEER.
   5. ALLEEN HET BESCHIKBARE DEEL, dus niet wat vastgezet staat.
   6. HET VOLLEDIGE IBAN KOMT NOOIT TERUG UIT DE API. Het staat in de
      identiteitskluis en hoort ook niet op een scherm waar iemand overheen kijkt.
   7. HET GROOTBOEK BLIJFT SLUITEN.

   Draai los: node --experimental-sqlite --test test/payterug.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { ibanGeldig } = require('../server/kern/pay/uitbetaalrekening');

let srv, base, lid, sup;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-terug-'));
const IBAN = 'NL91ABNA0417164300';
const IBAN2 = 'DE89370400440532013000';

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const stand = () => api('pay/terugstand', {}, lid.token).then(r => r.body);
const wallet = () => api('pay/overzicht', {}, lid.token).then(r => r.body);
const sluit = async () => (await (await fetch(base + '/api/pay/gezond')).json()).klopt;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  /* EEN ECHT, GEVERIFIEERD ACCOUNT en geen demo-sessie, en dat is geen
     ongemak van de toets maar precies het ontwerp. Twee poorten staan ervoor:

     - Het IBAN woont in de identiteitskluis (member_state) en die hangt aan een
       gebruikersrij. Een demo-inlog heeft er geen, en er is bewust nergens een
       plek waar het rekeningnummer van iemand zonder dossier terecht kan.
     - De paspoortpoort (kern/onboarding, `payGate`) houdt een vers RTG-account
       tegen tot de identiteit is bevestigd. Geld dat het huis verlaat naar een
       persoon toe, gaat niet naar iemand die we niet kennen.

     Vandaar de eigenaar: het enige geverifieerde account in de seed. Dezelfde
     inlog die test/geldregie.test.js gebruikt. */
  const d = (await api('auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body;
  assert.ok(d.token, 'een echt, geverifieerd account is ingelogd');
  lid = { token: d.token, codenaam: (await api('pay/overzicht', {}, d.token)).body.codenaam };
  assert.ok(lid.codenaam, 'met een wallet op een codenaam');
  const s = await (await fetch(base + '/api/supplier/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'rahul', password: 'Imran' }) })).json();
  sup = { token: s.token, code: s.state.supplier.code };
  await api('pay/oplaad', { centen: 20000, idem: 't-start' }, lid.token);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('de mod-97-toets vangt een tikfout die een vormcontrole doorlaat', () => {
  /* Het verschil tussen deze twee is één cijfer, en allebei zien ze eruit als
     een IBAN. Zonder de controlecijfers staat het geld bij een vreemde. */
  assert.equal(ibanGeldig('NL91ABNA0417164300'), 'NL91ABNA0417164300');
  assert.equal(ibanGeldig('NL91ABNA0417164301'), null, 'een cijfer verkeerd is geen geldig IBAN');
  assert.equal(ibanGeldig('NL91 ABNA 0417 1643 00'), 'NL91ABNA0417164300', 'spaties horen erdoorheen');
  assert.equal(ibanGeldig('DE89370400440532013000'), 'DE89370400440532013000');
  assert.equal(ibanGeldig('niet eens een iban'), null);
});

test('zonder rekening kan het niet, en het lid leest waarom', async () => {
  const s = await stand();
  assert.equal(s.kan, false);
  assert.equal(s.rekening, null);
  const b = s.blokkades.find(x => x.wat === 'rekening');
  assert.ok(b, 'de ontbrekende rekening staat als blokkade genoemd');
  assert.match(b.uitleg, /rekening/, 'met een uitleg die een mens begrijpt');
  assert.ok(s.beschikbaar > 0, 'er staat wel geld: dat is niet waar het op vastloopt');

  const poging = await api('pay/terug', { centen: 1000, idem: 'x0' }, lid.token);
  assert.equal(poging.status, 409);
  assert.equal(poging.body.reden, 'rekening');
});

test('een ongeldig IBAN komt er niet in', async () => {
  const r = await api('pay/rekening', { iban: 'NL91ABNA0417164301', naam: 'A. Vos' }, lid.token);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /geldig IBAN/);
  assert.equal((await stand()).rekening, null, 'en er is niets opgeslagen');

  const zonderNaam = await api('pay/rekening', { iban: IBAN }, lid.token);
  assert.equal(zonderNaam.status, 400, 'een rekening zonder tenaamstelling kan ook niet');
});

test('de eerste rekening kan meteen ontvangen', async () => {
  /* Een wachttijd op de EERSTE registratie zou alleen eerlijke mensen hinderen:
     het account heeft net de paspoortpoort gehaald, en de aanval is het
     veranderen van een bestemming op een account met saldo -- niet dit. */
  const r = await api('pay/rekening', { iban: IBAN, naam: 'A. Vos' }, lid.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.wijziging, false);
  assert.equal(r.body.rekening.bruikbaar, true, 'meteen bruikbaar');
  assert.match(r.body.uitleg, /wijzigt u hem later/i, 'en het lid hoort wat er bij een wijziging gebeurt');

  const s = await stand();
  assert.equal(s.kan, true, 'nu kan het');
  assert.deepEqual(s.blokkades, []);
});

test('het volledige IBAN komt nooit terug uit de API', async () => {
  const s = await stand();
  assert.notEqual(s.rekening.iban, IBAN, 'niet voluit');
  assert.match(s.rekening.iban, /^NL •••/, 'wel herkenbaar');
  assert.ok(!JSON.stringify(s).includes('0417164300'), 'het rekeningnummer staat nergens in het antwoord');
});

test('het geld gaat er echt af, en precies een keer', async () => {
  const voor = await wallet();
  const r1 = await api('pay/terug', { centen: 5000, idem: 'terug-1' }, lid.token);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.teruggestort, 5000);
  assert.ok(r1.body.opdrachtId, 'er staat een betaalopdracht klaar');
  /* "Staat klaar" en niet "gelukt": bij een timeout van de rail weten we juist
     niet of hij is aangekomen. */
  assert.match(r1.body.uitleg, /klaar om verstuurd/);

  const na = await wallet();
  assert.equal(na.saldo, voor.saldo - 5000, 'het saldo is meteen gedaald');

  const r2 = await api('pay/terug', { centen: 5000, idem: 'terug-1' }, lid.token);
  assert.equal(r2.body.herhaald, true, 'dezelfde sleutel is hetzelfde antwoord');
  assert.equal((await wallet()).saldo, na.saldo, 'en boekt niet nog een keer af');
  assert.equal(await sluit(), true);
});

test('alleen het beschikbare deel -- vastgezet geld gaat niet mee', async () => {
  const voor = await stand();
  // een zaak zet een borg vast op de code van dit lid
  const code = (await api('pay/kascode', { maxCenten: 100000 }, lid.token)).body.code;
  const vast = await api('supplier/pay/vooraf', { code, maxCenten: voor.beschikbaar - 1000,
    oms: 'Borg', idem: 'tv' }, sup.token);
  assert.equal(vast.status, 200);

  const tijdens = await stand();
  assert.equal(tijdens.beschikbaar, 1000, 'er is nog duizend cent vrij');
  assert.ok(tijdens.gereserveerd > 0);

  const teveel = await api('pay/terug', { centen: voor.beschikbaar, idem: 'terug-2' }, lid.token);
  assert.equal(teveel.status, 402, 'het vastgezette deel gaat niet mee de deur uit');
  assert.equal(teveel.body.reden, 'beschikbaar');

  const goed = await api('pay/terug', { centen: 1000, idem: 'terug-3' }, lid.token);
  assert.equal(goed.status, 200, 'het vrije deel wel');
  assert.equal(await sluit(), true);
  await api('supplier/pay/vrijgeef', { reservering: vast.body.reservering }, sup.token);
});

test('een WIJZIGING van de rekening wacht -- dat is de hele beveiliging', async () => {
  /* Dit is de aanval waar het om gaat: wie een account overneemt, zet zijn eigen
     IBAN erin en haalt de wallet leeg voordat de eigenaar iets doorheeft. Zijn
     plan hangt volledig op snelheid. */
  const r = await api('pay/rekening', { iban: IBAN2, naam: 'Iemand Anders' }, lid.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.wijziging, true);
  assert.equal(r.body.rekening.bruikbaar, false, 'de gewijzigde rekening kan nog niet ontvangen');
  assert.ok(r.body.rekening.bruikbaarVanaf > Date.now());

  const s = await stand();
  assert.equal(s.kan, false);
  assert.equal(s.blokkades.find(x => x.wat === 'wachttijd') !== undefined, true);

  const poging = await api('pay/terug', { centen: 1000, idem: 'terug-4' }, lid.token);
  assert.equal(poging.status, 409);
  assert.equal(poging.body.reden, 'wachttijd');
  assert.ok(poging.body.bruikbaarVanaf > Date.now());
});

test('terugzetten naar het oude IBAN versnelt niets', async () => {
  /* Zonder deze regel is de wachttijd te omzeilen: zet er iets anders in, zet
     hem daarna terug, en het oude IBAN zou meteen weer bruikbaar zijn. */
  const r = await api('pay/rekening', { iban: IBAN, naam: 'A. Vos' }, lid.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.wijziging, true, 'terugzetten is ook een wijziging');
  assert.equal(r.body.rekening.bruikbaar, false, 'en start de klok opnieuw');
  assert.equal((await api('pay/terug', { centen: 1000, idem: 'terug-5' }, lid.token)).body.reden, 'wachttijd');
});

test('dezelfde rekening nog een keer instellen is geen wijziging', async () => {
  const r = await api('pay/rekening', { iban: 'NL91 ABNA 0417 1643 00', naam: 'A. Vos' }, lid.token);
  assert.equal(r.body.ongewijzigd, true, 'niets veranderd is geen handeling en start de klok niet');
});

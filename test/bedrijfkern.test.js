/* RTG Werk OS, deel 1: de werkruimte, de leden, de rollen en het startscherm.

   Wat hier bewezen wordt, zijn beloftes en geen functies:

   - AANMELDEN IS NIET BINNEN ZIJN. Een lid-token werkt nergens voor tot iemand
     met het beheer-token het lidmaatschap toelaat.
   - EEN ROL IS EEN BUNDEL RECHTEN. Een programmeur komt niet in het
     personeelsdossier en een HR-medewerker niet in de bouwlaag; een externe
     draagt geen enkel recht.
   - DE ZWAARSTE INZAGE VRAAGT EEN REDEN, en die reden staat daarna in het
     journaal -- de inhoud niet.
   - EEN ROLVENSTER TELT ALLEEN BINNEN ZIJN GRENZEN. Wie voor volgende week is
     klaargezet mag vandaag niets, en een rol die is beeindigd geeft vandaag
     niets meer.
   - HET STARTSCHERM LIEGT NIET. Blokken zonder bron staan als niet gemeten en
     niet als nul, en de snelle acties volgen de rechten.
   Draai los: node --test test/bedrijfkern.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bedrijf-'));
const api = (pad, body) => fetch(BASE + '/api/bedrijf' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const dag = (verschuif) => new Date(Date.now() + verschuif * 86400000).toISOString().slice(0, 10);
let W, B, mensen = {};

// een toegelaten lid met rollen; geeft zijn sleutelbos terug
async function lid(naam, functie, rollen, tot) {
  const a = (await api('/lid/aanmeld', { werkruimte: W, naam, functie, extern: rollen.includes('extern') })).body;
  assert.ok(a.lidToken, 'de aanmelding levert een token: ' + JSON.stringify(a).slice(0, 120));
  await api('/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });
  if (rollen.length) await api('/lid/rollen', { werkruimte: W, beheerToken: B, lidId: a.lidId, rollen, tot: tot || null });
  const s = { werkruimte: W, lidToken: a.lidToken, id: a.lidId, naam };
  mensen[naam] = s;
  return s;
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = (await api('/werkruimte/maak', { naam: 'RTG Nederland', land: 'NL', valuta: 'EUR', kvk: '12345678' })).body;
  assert.ok(w.beheerToken, 'de werkruimte is gemaakt: ' + JSON.stringify(w).slice(0, 140));
  W = w.werkruimte; B = w.beheerToken;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('aanmelden is niet binnen zijn: pas na toelating doet het lid-token iets', async () => {
  const a = (await api('/lid/aanmeld', { werkruimte: W, naam: 'Wachtende Wim', functie: 'analist' })).body;
  assert.equal(a.status, 'wacht');

  const dicht = await api('/mijn-rechten', { werkruimte: W, lidToken: a.lidToken });
  assert.equal(dicht.status, 403, 'een wachtend lid komt nergens binnen');
  assert.match(dicht.body.error, /wacht/i);

  await api('/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });
  const open = await api('/mijn-rechten', { werkruimte: W, lidToken: a.lidToken });
  assert.equal(open.status, 200);
  assert.deepEqual(open.body.rollen, [], 'toegelaten, maar nog zonder rol dus zonder rechten');

  // afwijzen trekt de sleutel in
  const b = (await api('/lid/aanmeld', { werkruimte: W, naam: 'Afgewezen Aad' })).body;
  await api('/lid/besluit', { werkruimte: W, beheerToken: B, lidId: b.lidId, akkoord: false });
  assert.equal((await api('/mijn-rechten', { werkruimte: W, lidToken: b.lidToken })).status, 403);

  const onbekend = await api('/lid/besluit', { werkruimte: W, beheerToken: 'fout', lidId: b.lidId, akkoord: true });
  assert.equal(onbekend.status, 403, 'zonder het beheer-token laat niemand zichzelf toe');
});

test('een rol is een bundel rechten, en een externe draagt er geen', async () => {
  const dev = await lid('Dana', 'software engineer', ['engineering']);
  const hr = await lid('Hilde', 'HR-adviseur', ['hr']);
  const ext = await lid('Accountant Arie', 'accountant', ['extern']);

  const rDev = (await api('/mijn-rechten', dev)).body;
  assert.ok(rDev.rechten.includes('bouw') && rDev.rechten.includes('project'));
  assert.ok(!rDev.rechten.includes('mens'), 'een programmeur komt niet in het personeelsdossier');

  const rHr = (await api('/mijn-rechten', hr)).body;
  assert.ok(rHr.rechten.includes('mens') && rHr.rechten.includes('mens.gevoelig'));
  assert.ok(!rHr.rechten.includes('bouw'), 'en HR niet in de bouwlaag');

  const rExt = (await api('/mijn-rechten', ext)).body;
  assert.deepEqual(rExt.rechten, [], 'een externe ziet niets tenzij het expliciet gedeeld is');
  assert.equal(rExt.extern, true);

  const onbekend = await api('/lid/rollen', { werkruimte: W, beheerToken: B, lidId: dev.id, rollen: ['tovenaar'] });
  assert.equal(onbekend.status, 400, 'een rol die niet bestaat wordt niet stilletjes genegeerd');
  assert.match(onbekend.body.error, /tovenaar/);
});

test('de zwaarste inzage vraagt een reden, en die reden staat in het journaal', async () => {
  const hr = mensen['Hilde'];
  const zonder = await api('/journaal', { werkruimte: W, lidToken: hr.lidToken });
  assert.equal(zonder.status, 403, 'HR leest het journaal niet');

  // het recht met een punt erin (mens.gevoelig) vraagt een reden via de poort
  const kaart = (await api('/rollen', hr)).body;
  assert.ok(kaart.mijn.rechten.includes('mens.gevoelig'));

  const audit = await lid('Auditor Ada', 'intern auditor', ['auditor']);
  const zonderReden = await api('/journaal', audit);
  assert.equal(zonderReden.status, 400, 'het journaal lezen zonder te zeggen waarom, kan niet');
  assert.equal(zonderReden.body.redenNodig, true);

  const gelezen = (await api('/journaal', Object.assign({ reden: 'kwartaalcontrole toegang' }, audit))).body;
  assert.ok(gelezen.aantal >= 1, 'er staat iets in het journaal');
  assert.ok(gelezen.regels.some(r => r.wat === 'rollen-gezet'), 'het toekennen van rollen staat erin');

  // wie het journaal leest, staat er zelf in
  const nogmaals = (await api('/journaal', Object.assign({ reden: 'tweede blik' }, audit))).body;
  const eigen = nogmaals.regels.filter(r => r.wat === 'inzage:journaal');
  assert.ok(eigen.length >= 1, 'de lezer van het journaal staat er zelf in');
  assert.equal(eigen[0].wie, 'Auditor Ada');
  assert.match(eigen[0].reden, /kwartaalcontrole|tweede blik/);

  const auditRechten = (await api('/mijn-rechten', audit)).body;
  assert.ok(!auditRechten.rechten.includes('project'), 'een auditor leest, hij werkt niet mee');
});

test('een rolvenster telt alleen binnen zijn grenzen', async () => {
  // vooruit klaarzetten: de nieuwe collega van volgende week mag vandaag niets
  const straks = await lid('Nieuwe Noor', 'controller', []);
  await api('/lid/rollen', { werkruimte: W, beheerToken: B, lidId: straks.id,
    rollen: ['financieel'], van: dag(7) });
  const nog = (await api('/mijn-rechten', straks)).body;
  assert.deepEqual(nog.rollen, [], 'een rol die volgende week ingaat, geeft vandaag niets');
  assert.deepEqual(nog.rechten, []);
  assert.equal(nog.nogNiet[0].van, dag(7), 'maar hij staat er wel klaar, met de ingangsdatum');

  // tijdelijk: vandaag geldig, met de einddatum erbij
  const tijdelijk = await lid('Interim Ingrid', 'interim controller', ['financieel'], dag(30));
  assert.ok((await api('/mijn-rechten', tijdelijk)).body.rechten.includes('geld'));

  // met terugwerkende kracht beeindigen mag wel, en dan is het per direct uit
  const stop = await api('/lid/rollen', { werkruimte: W, beheerToken: B,
    lidId: tijdelijk.id, rollen: ['financieel'], tot: dag(-1) });
  assert.equal(stop.status, 200, 'een bestaande rol beeindigen met terugwerkende kracht is een gewone HR-handeling');
  const na = (await api('/mijn-rechten', tijdelijk)).body;
  assert.deepEqual(na.rollen, [], 'de rol van gisteren telt vandaag niet meer');
  assert.deepEqual(na.rechten, []);
  assert.equal(na.verlopen[0].id, 'financieel', 'en staat er als verlopen bij, met de datum');

  // een NIEUWE rol die al verlopen is, is een typefout en geen toegang
  const vers = await lid('Typefout Ties', 'stagiair', []);
  const raar = await api('/lid/rollen', { werkruimte: W, beheerToken: B,
    lidId: vers.id, rollen: ['medewerker'], tot: dag(-5) });
  assert.equal(raar.status, 400);
  assert.match(raar.body.error, /verlopen zijn voordat hij ingaat/);

  const omgekeerd = await api('/lid/rollen', { werkruimte: W, beheerToken: B,
    lidId: vers.id, rollen: ['medewerker'], van: dag(10), tot: dag(3) });
  assert.equal(omgekeerd.status, 400, 'een venster dat eindigt voor het begint bestaat niet');
});

test('het startscherm volgt de rollen en noemt wat het niet meet', async () => {
  const dev = mensen['Dana'];
  const s = (await api('/start', dev)).body;
  assert.equal(s.wie.naam, 'Dana');
  assert.deepEqual(s.wie.rollen, ['engineering']);

  const acties = s.snelleActies.map(a => a.naam);
  assert.ok(acties.includes('Incident melden'), 'een programmeur kan een incident melden');
  assert.ok(!acties.includes('Verlof beoordelen'), 'en geen verlof beoordelen');

  const blokken = s.nietGemeten.map(x => x.blok);
  assert.ok(blokken.includes('kpi') && blokken.includes('goedkeuringen'),
    'blokken zonder bron staan als niet gemeten: ' + JSON.stringify(s.nietGemeten).slice(0, 200));
  assert.ok(Object.prototype.hasOwnProperty.call(s.blokken, 'projecten'),
    'en een blok dat WEL een bron heeft, staat er gewoon');
  assert.ok(s.nietGemeten.every(x => x.reden), 'elk met een reden erbij');
  assert.ok(!Object.prototype.hasOwnProperty.call(s.blokken, 'kpi'),
    'en een blok zonder bron is er niet als lege doos');

  const audit = mensen['Auditor Ada'];
  const sa = (await api('/start', audit)).body;
  assert.deepEqual(sa.snelleActies, [], 'wie alleen leest, krijgt geen knoppen die iets veranderen');
  assert.equal(sa.wie.alleenLezen, true);
});

test('uit dienst trekt de sleutel per direct in, met een reden en zonder het werk te wissen', async () => {
  const weg = await lid('Vertrekker Vera', 'consultant', ['projectleider']);
  assert.equal((await api('/mijn-rechten', weg)).status, 200);

  const zonderReden = await api('/lid/uit-dienst', { werkruimte: W, beheerToken: B, lidId: weg.id });
  assert.equal(zonderReden.status, 400, 'een lege uitstroom is later niet te reconstrueren');

  const uit = (await api('/lid/uit-dienst', { werkruimte: W, beheerToken: B, lidId: weg.id,
    reden: 'einde opdracht', laatsteDag: dag(0) })).body;
  assert.equal(uit.lid.status, 'uit dienst');
  assert.equal((await api('/mijn-rechten', weg)).status, 403, 'de sleutel werkt per direct niet meer');

  const nogmaals = await api('/lid/uit-dienst', { werkruimte: W, beheerToken: B, lidId: weg.id, reden: 'nogmaals' });
  assert.equal(nogmaals.status, 409, 'twee keer uit dienst is een fout en geen stille ok');

  const lijst = (await api('/leden', { werkruimte: W, beheerToken: B })).body;
  const rij = lijst.leden.find(l => l.id === weg.id);
  assert.ok(rij, 'de persoon blijft in de lijst staan; werk uitwissen maakt een dossier onleesbaar');
  assert.equal(rij.status, 'uit dienst');
});

test('een holding draagt dochters, maar geconsolideerd kijken rolt er niet vanzelf uit', async () => {
  const dochter = (await api('/werkruimte/maak', { naam: 'RTG Belgie', land: 'BE', moeder: W })).body;
  assert.ok(dochter.beheerToken);

  const beeld = (await api('/werkruimte', { werkruimte: W, beheerToken: B })).body;
  assert.equal(beeld.dochters.length, 1);
  assert.equal(beeld.dochters[0].naam, 'RTG Belgie');
  assert.ok(!('beheerToken' in beeld.dochters[0]), 'de sleutel van een dochter reist niet mee met de moeder');
  assert.match(beeld.let, /eigen handeling/i);

  // en andersom: het beheer-token van de moeder opent de dochter niet
  const dwars = await api('/leden', { werkruimte: dochter.werkruimte, beheerToken: B });
  assert.equal(dwars.status, 403, 'de werkruimte is de grens, ook binnen een holding');

  const onzin = await api('/werkruimte/maak', { naam: 'Weeswerkruimte', moeder: 'WBESTAATNIET' });
  assert.equal(onzin.status, 404);
});

/* RTG Werk OS, deel 4: de bouwlaag en het IT-beheer.

   Zes beweringen, en ze gaan allemaal over een systeem dat weigert:

   - NAAR PRODUCTIE MET GROENE TOETSEN EN EEN MENS. Nul gedraaide toetsen is
     geen groene suite, en zonder naam gaat er niets uit.
   - EEN TERUGGEDRAAIDE RELEASE BLIJFT STAAN met zijn reden.
   - EEN FEATURE FLAG ZONDER OPRUIMDATUM BESTAAT NIET, en een vlag die nog
     ergens aanstaat kun je niet weggooien.
   - EEN BUG UIT EEN KLANTMELDING draagt die melding mee, beide kanten op.
   - EEN APPARAAT DAT NIET TERUG IS blokkeert de stap "apparaten terug"; het
     systeem weet het, dus het hoort het te weigeren.
   - HET UITDIENSTPROCES SLUIT NIET VANZELF: zes stappen, elk met een naam.
   Draai los: node --experimental-sqlite --test test/bedrijfbouw.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bedrijfbouw-'));
const api = (pad, body) => fetch(BASE + '/api/bedrijf' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const dag = (v) => new Date(Date.now() + v * 86400000).toISOString().slice(0, 10);

let W, B, DEV, IT, SV, weg;
async function lid(naam, rollen) {
  const a = (await api('/lid/aanmeld', { werkruimte: W, naam })).body;
  await api('/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });
  await api('/lid/rollen', { werkruimte: W, beheerToken: B, lidId: a.lidId, rollen });
  // let op: GEEN naam in de sleutelbos -- die zou via Object.assign het
  // naam-veld van een verzoek overschrijven (dat ging hier een keer mis)
  return { werkruimte: W, lidToken: a.lidToken, id: a.lidId, wie: naam };
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = (await api('/werkruimte/maak', { naam: 'RTG Bouw', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;
  DEV = await lid('Dirk', ['engineering']);
  IT = await lid('Ilse', ['it']);
  SV = await lid('Suze', ['service']);
  weg = await lid('Vertrekker Victor', ['medewerker']);
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('naar productie gaat alleen wat groen is, met een mens die tekent', async () => {
  const repo = (await api('/repo/zet', Object.assign({ naam: 'rtg-platform', taal: 'JavaScript',
    url: 'https://git.rtg.example/rtg-platform' }, DEV))).body;
  assert.match(repo.let, /geen eigen Git/i);

  const naarTest = await api('/release/maak', Object.assign({ versie: '1.4.0', omgeving: 'test' }, DEV));
  assert.equal(naarTest.status, 200, 'naar test mag zonder ceremonie');

  const blind = await api('/release/maak', Object.assign({ versie: '1.4.0', omgeving: 'productie',
    goedgekeurdDoor: 'Dirk' }, DEV));
  assert.equal(blind.status, 400);
  assert.match(blind.body.error, /Nul gedraaide toetsen/i);

  const rood = await api('/release/maak', Object.assign({ versie: '1.4.0', omgeving: 'productie',
    toetsen: { gedraaid: 3130, gezakt: 2 }, goedgekeurdDoor: 'Dirk' }, DEV));
  assert.equal(rood.status, 409);
  assert.match(rood.body.error, /2 toets\(en\) zakten/);

  const naamloos = await api('/release/maak', Object.assign({ versie: '1.4.0', omgeving: 'productie',
    toetsen: { gedraaid: 3130, gezakt: 0 } }, DEV));
  assert.equal(naamloos.status, 400);
  assert.match(naamloos.body.error, /een mens met een naam/i);

  const goed = (await api('/release/maak', Object.assign({ versie: '1.4.0', omgeving: 'productie',
    toetsen: { gedraaid: 3130, gezakt: 0 }, goedgekeurdDoor: 'Rahul' }, DEV))).body;
  assert.equal(goed.release.goedgekeurdDoor, 'Rahul');

  const terug = (await api('/release/terug', Object.assign({ releaseId: goed.release.id,
    reden: 'geheugenlek onder last' }, DEV))).body;
  assert.equal(terug.release.teruggedraaid, true);
  const lijst = (await api('/releases', Object.assign({ omgeving: 'productie' }, DEV))).body;
  assert.equal(lijst.aantal, 1, 'de teruggedraaide release blijft in de lijst staan');
  assert.equal(lijst.teruggedraaid, 1);
});

test('een bug uit een klantmelding draagt die melding mee, beide kanten op', async () => {
  const t = (await api('/ticket/maak', Object.assign({ onderwerp: 'Rekening splitst verkeerd',
    prioriteit: 'hoog' }, SV))).body.ticket;
  const i = (await api('/issue/maak', Object.assign({ titel: 'Restcenten bij splitsen',
    soort: 'bug', ticketId: t.id }, DEV))).body;
  assert.equal(i.issue.ticketId, t.id);
  assert.match(i.let, /ticket van de klant weet nu/i);

  const op = (await api('/issue/stand', Object.assign({ issueId: i.issue.id, status: 'opgelost' }, DEV))).body;
  assert.match(op.let, /Meld dit terug op ticket/i, 'het systeem meldt niet zelf terug; de klant hoort een mens');

  const stil = await api('/issue/stand', Object.assign({ issueId: i.issue.id, status: 'vervalt' }, DEV));
  assert.equal(stil.status, 400, 'een gemeld probleem verdwijnt niet zonder reden');

  const raar = await api('/issue/maak', Object.assign({ titel: 'x', soort: 'bug', ticketId: 'bestaatniet' }, DEV));
  assert.equal(raar.status, 404);
});

test('een feature flag zonder opruimdatum bestaat niet', async () => {
  const zonder = await api('/vlag/zet', Object.assign({ naam: 'nieuwe-kassa' }, DEV));
  assert.equal(zonder.status, 400);
  assert.match(zonder.body.error, /eeuwig staan/i);

  const v = (await api('/vlag/zet', Object.assign({ naam: 'nieuwe-kassa', opruimen: dag(-3),
    standen: { test: true, productie: true } }, DEV))).body;
  assert.equal(v.vlag.dagenTeGaan, -3);

  const lijst = (await api('/vlaggen', DEV)).body;
  assert.equal(lijst.over, 1, 'wat over de opruimdatum is, wordt geteld');
  assert.equal(lijst.vlaggen[0].naam, 'nieuwe-kassa', 'en staat bovenaan');
  assert.match(lijst.let, /niet automatisch uitgezet/i);

  const nogAan = await api('/vlag/weg', Object.assign({ naam: 'nieuwe-kassa' }, DEV));
  assert.equal(nogAan.status, 409, 'een vlag die nog aanstaat, kun je niet weggooien');

  await api('/vlag/zet', Object.assign({ naam: 'nieuwe-kassa', opruimen: dag(-3),
    standen: { test: false, productie: false } }, DEV));
  assert.equal((await api('/vlag/weg', Object.assign({ naam: 'nieuwe-kassa' }, DEV))).status, 200);

  // de opruimdatum verzetten mag, maar niet stilletjes
  await api('/vlag/zet', Object.assign({ naam: 'donker-thema', opruimen: dag(10) }, DEV));
  const schuif = await api('/vlag/zet', Object.assign({ naam: 'donker-thema', opruimen: dag(40) }, DEV));
  assert.equal(schuif.status, 400);
  assert.match(schuif.body.error, /elke maand een maand op/i);
});

test('een apparaat op naam blokkeert de uitdienststap, en het proces sluit niet vanzelf', async () => {
  const a = (await api('/apparaat/zet', Object.assign({ soort: 'laptop', nummer: 'C02XY1',
    model: 'MacBook Pro', versleuteld: true }, IT))).body.apparaat;
  const pas = (await api('/apparaat/zet', Object.assign({ soort: 'toegangspas', nummer: 'P-118' }, IT))).body;
  assert.match(pas.let, /NIET versleuteld/i, 'een onversleuteld apparaat zegt dat zelf');

  await api('/apparaat/uitgeven', Object.assign({ apparaatId: a.id, lidId: weg.id }, IT));
  const dubbel = await api('/apparaat/uitgeven', Object.assign({ apparaatId: a.id, lidId: IT.id }, IT));
  assert.equal(dubbel.status, 409, 'een apparaat staat op een naam tegelijk');

  await api('/licentie/zet', Object.assign({ product: 'Ontwerppakket', aantal: 1, kostenPerJaar: 600 }, IT));
  await api('/licentie/toewijzen', Object.assign({ product: 'Ontwerppakket', lidId: weg.id }, IT));
  const over = (await api('/licentie/toewijzen', Object.assign({ product: 'Ontwerppakket', lidId: IT.id }, IT))).body;
  assert.equal(over.overschrijding, 1, 'meer in gebruik dan gekocht is een getal');
  assert.match(over.let, /rekening die iemand moet betalen/i);

  // nu uit dienst
  await api('/lid/uit-dienst', { werkruimte: W, beheerToken: B, lidId: weg.id, reden: 'nieuwe baan' });
  const beeld = (await api('/uitdienst', Object.assign({ lidId: weg.id }, IT))).body;
  assert.equal(beeld.uitdienst[0].klaar, false);
  assert.equal(beeld.uitdienst[0].openstaand.apparaten.length, 1, 'de laptop staat nog op naam');
  assert.equal(beeld.uitdienst[0].stappen.length, 6);

  const tevroeg = await api('/uitdienst/stap', Object.assign({ lidId: weg.id, stap: 'apparaten terug' }, IT));
  assert.equal(tevroeg.status, 409);
  assert.match(tevroeg.body.error, /C02XY1/, 'de weigering noemt welk apparaat');

  const sleutels = await api('/uitdienst/stap', Object.assign({ lidId: weg.id, stap: 'sleutels ingetrokken' }, IT));
  assert.equal(sleutels.status, 409, 'er staat nog een licentie op naam');

  await api('/apparaat/innemen', Object.assign({ apparaatId: a.id }, IT));
  await api('/licentie/toewijzen', Object.assign({ product: 'Ontwerppakket', lidId: weg.id, weg: true }, IT));
  const nu = (await api('/uitdienst/stap', Object.assign({ lidId: weg.id, stap: 'apparaten terug' }, IT))).body;
  assert.equal(nu.gedaan, 1);
  assert.equal(nu.van, 6);
  assert.equal(nu.klaar, false, 'een van de zes is geen afgerond proces');
  assert.equal(nu.resterend.length, 5);

  for (const s of nu.resterend) await api('/uitdienst/stap', Object.assign({ lidId: weg.id, stap: s }, IT));
  const klaar = (await api('/uitdienst', Object.assign({ lidId: weg.id }, IT))).body;
  assert.equal(klaar.uitdienst[0].klaar, true);
  assert.ok(klaar.uitdienst[0].stappen.every(s => s.door === 'Ilse'), 'elke stap draagt de naam van wie hem deed');

  const geenUitdienst = await api('/uitdienst/stap', Object.assign({ lidId: IT.id, stap: 'apparaten terug' }, IT));
  assert.equal(geenUitdienst.status, 409, 'bij iemand die gewoon werkt valt er niets af te ronden');
});

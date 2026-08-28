/* ============================================================================
   DE BANK VANUIT DE BOARDROOM -- de zwaarste knoppen die er zijn.

   Tien endpoints die de waargenomen dekkingsmeting als nooit aangeroepen
   aanwees. Zes daarvan zitten in RTG Bank, en het zijn niet de minste:

     /api/office/bank/rekening/bevries   het geld van een lid stilzetten
     /api/office/bank/rekening/rood      een lid onder nul laten gaan
     /api/office/bank/afschrift          de volledige transactiegeschiedenis
     /api/office/bank/instellingen       spaarrente en tarieven
     /api/office/bank/operationeel       de bank als uitgevende partij aan/uit
     /api/office/bank/autoriseer/annuleer een vier-ogen-aanvraag intrekken

   plus /api/office/trust, /api/office/trust/reply, /api/office/payroll/runs en
   /api/office/ledenregister.

   WAAROM DIT ANDERS LIGT DAN DE VORIGE RONDES

   Tot nu toe was de vraag steeds "kan gebruiker B bij de gegevens van A". Hier
   is het antwoord op die vraag met opzet JA: dit is de backoffice van de bank,
   en een bankmedewerker moet een rekening kunnen bevriezen. De vraag verschuift
   dus naar twee andere:

     1. STAAT DE DEUR DICHT voor iedereen die geen kantoor is? Een ledentoken
        of een zaaktoken mag hier nooit langs. Dat is de enige grens die er is,
        en er is geen tweede laag onder.
     2. DOET DE KNOP WAT HIJ BELOOFT? Een bevriesknop die alleen een vlaggetje
        zet en verder niets tegenhoudt, is erger dan geen knop: dan denkt de
        bank dat het geld stilstaat terwijl het gewoon wegloopt.

   Draai los: node --test test/office-bank.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-officebank-'));
const CODE = 'KANTOOR-OFFICEBANK';
let srv, base, office, lid, ander, zaak;

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let teller = 0;
async function nieuwLid(naam) {
  const u = (Date.now() + (++teller) * 7919).toString().slice(-9);
  const r = await api('auth/register', { name: naam, email: 'ob' + u + '@x.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.body.token, 'lid ' + naam + ' geregistreerd');
  return { token: r.body.token, naam };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;
  office = (await api('office/login', { code: CODE })).body.token;
  assert.ok(office, 'het kantoor is binnen');

  const live = await api('office/bank/leden', { aan: true, naam: 'RTG' }, office);
  assert.equal(live.status, 200, 'de leden-bank staat live: ' + JSON.stringify(live.body));

  lid = await nieuwLid('Rekeninghouder');
  const akk = await api('bank/akkoord', {}, lid.token);
  assert.equal(akk.status, 200, 'het lid opent een rekening');
  lid.iban = akk.body.rekening.iban;
  const stort = await api('bank/storten', { iban: lid.iban, centen: 500000, idem: 'ob-start' }, lid.token);
  assert.equal(stort.status, 200, 'er staat geld op');

  ander = await nieuwLid('Tweede Lid');
  const akk2 = await api('bank/akkoord', {}, ander.token);
  ander.iban = akk2.body.rekening.iban;
  assert.notEqual(ander.iban, lid.iban, 'twee leden, twee rekeningen');

  // een zaaksessie, om te toetsen dat ook die de kantoordeur niet opent
  const rooster = await api('supplier/roster', { code: 'KIKUNOI' });
  const man = (rooster.body.staff || []).find(x => x.role === 'manager');
  zaak = (await api('supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  assert.ok(zaak, 'de zaak is ingelogd');
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const ALLE_TIEN = [
  'office/bank/rekening/bevries', 'office/bank/rekening/rood', 'office/bank/afschrift',
  'office/bank/instellingen', 'office/bank/operationeel', 'office/bank/autoriseer/annuleer',
  'office/trust', 'office/trust/reply', 'office/payroll/runs', 'office/ledenregister'
];

/* ================= 1. de deur ================= */

test('1. geen van de tien gaat open zonder kantoorsessie', async () => {
  /* Dit is de enige grens die deze endpoints hebben. Er zit geen tweede laag
     onder: wie hier binnen is, kan bij het geld van elk lid. Dus toetsen we
     hem met alles wat er in de buurt komt -- niets, onzin, een ledentoken en
     een zaaktoken. Vooral die laatste twee: een echte, geldige sessie van een
     ANDER soort is de fout die je in de praktijk maakt. */
  for (const pad of ALLE_TIEN) {
    for (const [wat, token] of [['zonder token', undefined], ['een vals token', 'niet-echt'],
      ['een LEDENtoken', lid.token], ['een ZAAKtoken', zaak]]) {
      const r = await api(pad, { iban: lid.iban, aan: true, euro: 100 }, token);
      assert.ok(r.status === 401 || r.status === 403,
        pad + ' met ' + wat + ' hoort dicht: kreeg ' + r.status);
      assert.equal(JSON.stringify(r.body).includes(lid.iban), false,
        pad + ' met ' + wat + ' mag geen rekeningnummer terugkaatsen');
    }
  }
});

/* ================= 2. bevriezen moet ook echt bevriezen ================= */

test('2. het kantoor bevriest een rekening en er gaat daarna niets meer af', async () => {
  const voor = (await api('bank/rekening', { iban: lid.iban }, lid.token)).body.rekening.saldoCenten;
  assert.ok(voor > 0, 'er staat geld op om te kunnen bevriezen');

  const bevries = await api('office/bank/rekening/bevries', { iban: lid.iban, aan: true }, office);
  assert.equal(bevries.status, 200, JSON.stringify(bevries.body));
  assert.equal(bevries.body.bevroren, true);

  /* De echte toets. Een vlaggetje is geen bevriezing; het lid moet er ook echt
     niets meer af krijgen. Twee wegen proberen: een SEPA-opdracht en een
     overboeking naar een ander lid. */
  const sepa = await api('bank/sepa', { iban: lid.iban, centen: 1000, naarIban: 'NL91ABNA0417164300',
    begunstigde: 'Iemand', oms: 'na bevriezen', idem: 'ob-sepa-1' }, lid.token);
  assert.notEqual(sepa.status, 200, 'op een bevroren rekening gaat er niets meer af');
  const over = await api('bank/overboek', { vanIban: lid.iban, naarIban: ander.iban, centen: 1000,
    oms: 'na bevriezen', idem: 'ob-over-1' }, lid.token);
  assert.notEqual(over.status, 200, 'ook niet naar een ander lid');

  const na = (await api('bank/rekening', { iban: lid.iban }, lid.token)).body.rekening.saldoCenten;
  assert.equal(na, voor, 'het saldo is na twee pogingen onveranderd');

  // en het lid kan zichzelf niet ontdooien: dit is een kantoorknop
  const zelf = await api('office/bank/rekening/bevries', { iban: lid.iban, aan: false }, lid.token);
  assert.ok(zelf.status === 401 || zelf.status === 403, 'het lid draait de knop niet zelf terug');

  const terug = await api('office/bank/rekening/bevries', { iban: lid.iban, aan: false }, office);
  assert.equal(terug.status, 200);
  assert.equal(terug.body.bevroren, false, 'het kantoor ontdooit hem wel');
  const werkt = await api('bank/overboek', { vanIban: lid.iban, naarIban: ander.iban, centen: 1000,
    oms: 'na ontdooien', idem: 'ob-over-2' }, lid.token);
  assert.equal(werkt.status, 200, 'en daarna werkt de rekening weer');
});

test('3. een rekening die niet bestaat wordt niet stilletjes aangemaakt of bevestigd', async () => {
  const r = await api('office/bank/rekening/bevries', { iban: 'NL00RTGB0000000000', aan: true }, office);
  assert.equal(r.status, 404, 'een onbekend IBAN geeft 404');
  assert.equal((await api('office/bank/afschrift', { iban: 'NL00RTGB0000000000' }, office)).status, 404);
  assert.equal((await api('office/bank/rekening/rood', { iban: 'NL00RTGB0000000000', euro: 500 }, office)).status, 404);
});

/* ================= 3. rood staan heeft een plafond ================= */

test('4. de rood-staan-ruimte is begrensd, en niet met een truc te omzeilen', async () => {
  const ok = await api('office/bank/rekening/rood', { iban: lid.iban, euro: 250 }, office);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.roodLimiet, 25000, 'euro gaat als centen de administratie in');

  /* Een ongeremde rood-staan-ruimte is een geldpers met een extra stap. De
     grenzen horen aan de serverkant te staan, niet in het invoerveld. */
  /* Wat een aanvaller echt kan versturen. Infinity en NaN staan hier NIET
     tussen: JSON kent ze niet, ze arriveren als null, en null is hier een
     geldige waarde (limiet nul). Ze opnemen zou een test opleveren die iets
     anders toetst dan hij beweert. true en [] staan er ook niet tussen: die
     rekenen in JavaScript netjes om naar 1 en 0, dus dat ZIJN geldige
     bedragen -- geen truc, gewoon een getal met een omweg. */
  for (const euro of [-1, -100000, 50001, 1e9, 'veel', '50001', {}])
    assert.equal((await api('office/bank/rekening/rood', { iban: lid.iban, euro }, office)).status, 400,
      'euro=' + JSON.stringify(euro) + ' hoort geweigerd te worden');
  // en null betekent "nul euro ruimte", niet "geen grens"
  const nul = await api('office/bank/rekening/rood', { iban: lid.iban, euro: null }, office);
  assert.equal(nul.status, 200);
  assert.equal(nul.body.roodLimiet, 0, 'null is nul ruimte, geen ongelimiteerde ruimte');

  // en de limiet van zonet staat er nog precies zo
  assert.equal((await api('office/bank/rekening/rood', { iban: lid.iban, euro: 250 }, office)).body.roodLimiet, 25000);

  // een spaarrekening kan niet rood staan
  const spaar = await api('bank/rekening/open', { soort: 'spaar', naam: 'Voor later' }, lid.token);
  if (spaar.status === 200) {
    const fout = await api('office/bank/rekening/rood', { iban: spaar.body.rekening.iban, euro: 100 }, office);
    assert.equal(fout.status, 400, 'rood staan kan alleen op een betaalrekening');
  }
});

/* ================= 4. het afschrift ================= */

test('5. het afschrift toont de boekingen van precies een rekening, gepagineerd', async () => {
  for (let i = 0; i < 4; i++)
    await api('bank/overboek', { vanIban: lid.iban, naarIban: ander.iban, centen: 100 + i,
      oms: 'afschrifttest ' + i, idem: 'ob-af-' + i }, lid.token);

  const a = await api('office/bank/afschrift', { iban: lid.iban, limit: 3 }, office);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.body.iban, lid.iban);
  assert.ok(a.body.regels.length <= 3, 'de limiet wordt gerespecteerd');
  assert.ok(a.body.aantal >= 4, 'het totaal telt alles, niet alleen de pagina');
  for (const r of a.body.regels)
    assert.ok(r.tegen !== lid.iban, 'de tegenrekening is de ANDER, nooit jezelf');

  const p2 = await api('office/bank/afschrift', { iban: lid.iban, limit: 3, offset: 3 }, office);
  assert.equal(p2.status, 200);
  const eersteIds = new Set(a.body.regels.map(r => r.id));
  assert.equal(p2.body.regels.some(r => eersteIds.has(r.id)), false,
    'de tweede pagina herhaalt de eerste niet');

  /* Het afschrift van het ENE lid bevat geen boekingen die alleen het andere
     lid aangaan. Dat lijkt vanzelfsprekend, maar het filter staat op
     "van === iban || naar === iban" en een fout daarin geeft je stilletjes de
     hele bank. */
  await api('bank/storten', { iban: ander.iban, centen: 4242, idem: 'ob-alleen-ander' }, ander.token);
  const na = await api('office/bank/afschrift', { iban: lid.iban, limit: 200 }, office);
  assert.equal(na.body.regels.some(r => r.centen === 4242 && r.soort === 'storting'), false,
    'een storting die alleen de ander aangaat staat niet op het afschrift van dit lid');
});

/* ================= 5. de instellingen en de vier-ogen-knop ================= */

test('6. spaarrente en tarieven kennen grenzen', async () => {
  const goed = await api('office/bank/instellingen', { spaarrenteBp: 150 }, office);
  assert.equal(goed.status, 200, JSON.stringify(goed.body));
  assert.equal(goed.body.spaarrenteBp, 150, '1,5 procent');

  for (const bp of [-1, 2001, 1e9, 'veel', {}])
    assert.equal((await api('office/bank/instellingen', { spaarrenteBp: bp }, office)).status, 400,
      'spaarrente ' + JSON.stringify(bp) + ' basispunten hoort geweigerd te worden');
  assert.equal((await api('office/bank/instellingen', { roodLimietEuro: 50001 }, office)).status, 400);
  assert.equal((await api('office/bank/instellingen', { tarieven: { sepaUitCenten: 100001 } }, office)).status, 400);

  // na alle weigeringen staat de goede waarde er nog
  assert.equal((await api('office/bank/instellingen', { spaarrenteBp: 150 }, office)).body.spaarrenteBp, 150);
});

test('7. opschalen is ECHT vier-ogen: twee ingelogde accounts, niet twee tekstvelden', async () => {
  /* HIER STOND EEN TOETS DIE HET THEATER BEVESTIGDE. Hij vroeg de opschaling aan
     met de gedeelde kantoorcode en `naam: 'Eerste'`, en concludeerde uit
     needsAuth dat het vier-ogen-principe werkte. Dat deed het niet: aanvrager en
     bevestiger kwamen allebei uit req.body.naam, dus een sessie kon beide rollen
     spelen -- en zonder naamveld viel hij terug op 'boardroom', wat ook ongelijk
     is aan 'Eerste'. Twee HTTP-calls, en de clearing van het hele huis lag om.

     De oorzaak zat in de BRON: officeAuth hangt aan een gedeelde code, niet aan
     een persoon. Opschalen staat daarom nu achter de boardroom-poort, en de
     identiteit komt uit de sessie. Deze toets meet alle vier de kanten. */

  // 1. met alleen de gedeelde kantoorcode kan er helemaal niet meer opgeschaald worden
  const metCode = await api('office/bank/operationeel', { aan: true, naam: 'Eerste' }, office);
  assert.equal(metCode.status, 403, 'de gedeelde code is geen persoon: ' + JSON.stringify(metCode.body));

  // 2. de eigenaar logt in op zijn EIGEN account en komt wel door de boardroomdeur
  const baas = (await api('auth/login', { login: process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com',
    password: process.env.DEMO_PASS || 'Imran', pasApp: 'business' })).body.token;
  assert.ok(baas, 'de eigenaar is ingelogd');
  const kantoor1 = (await api('account/start', { rol: 'kantoor' }, baas)).body.token;
  assert.ok(kantoor1, 'en staat in de backoffice met zijn eigen account');

  const aan = await api('office/bank/operationeel', { aan: true }, kantoor1);
  assert.equal(aan.status, 200, JSON.stringify(aan.body));
  if (!aan.body.needsAuth) {
    // al operationeel: dan is er niets op te schalen en meet de rest niets
    assert.ok(aan.body.ok || aan.body.ongewijzigd, JSON.stringify(aan.body));
    return;
  }

  // 3. DEZELFDE persoon mag zijn eigen aanvraag niet bevestigen
  const zelf = await api('office/bank/autoriseer/bevestig', { id: aan.body.autorisatie.id }, kantoor1);
  assert.equal(zelf.status, 403, 'je bent je eigen tweede persoon niet: ' + JSON.stringify(zelf.body));

  // 4. en zonder naamveld ook niet -- dat was juist de makkelijke weg eromheen
  const zonderNaam = await api('office/bank/autoriseer/bevestig', { id: aan.body.autorisatie.id, naam: '' }, kantoor1);
  assert.equal(zonderNaam.status, 403, 'de terugval op "boardroom" is weg');

  // en intrekken kan gewoon, ook twee keer achter elkaar
  const annuleer = await api('office/bank/autoriseer/annuleer', {}, kantoor1);
  assert.equal(annuleer.status, 200, JSON.stringify(annuleer.body));
  assert.notEqual((await api('office/bank/autoriseer/annuleer', {}, kantoor1)).status, 500, 'twee keer intrekken valt niet om');
});

/* ================= 6. de overige kantoorschermen ================= */

test('8. ledenregister, payroll-runs en de vertrouwenslijn openen alleen voor het kantoor', async () => {
  /* Het ledenregister staat NIET achter de gewone kantoorinlog maar achter de
     boardroomdeur: alleen de eigenaar, of wie hij toegang gaf. Dat is strenger
     dan de andere negen hier, en terecht -- een register van alle leden bij
     elkaar is iets anders dan een scherm over een enkele zaak. Deze test legt
     dat verschil vast, zodat het niet ooit stilletjes gelijkgetrokken wordt. */
  const reg = await api('office/ledenregister', { limit: 5 }, office);
  assert.equal(reg.status, 403, 'een gewone kantoorinlog komt het ledenregister niet in');
  assert.equal(JSON.stringify(reg.body).includes('Rekeninghouder'), false,
    'en er komt geen enkele naam mee in de weigering');

  const runs = await api('office/payroll/runs', {}, office);
  assert.equal(runs.status, 200, JSON.stringify(runs.body));

  const trust = await api('office/trust', {}, office);
  assert.equal(trust.status, 200, JSON.stringify(trust.body));

  /* De vertrouwenslijn: een antwoord op een melding die niet bestaat hoort een
     nette fout te zijn, geen 500 en geen stil succes op niets. */
  const reply = await api('office/trust/reply', { id: 'bestaat-niet', tekst: 'we kijken ernaar' }, office);
  assert.ok(reply.status >= 400 && reply.status < 500,
    'antwoorden op een onbekende melding geeft een nette 4xx: ' + reply.status);
});

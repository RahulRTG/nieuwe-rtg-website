/* ============================================================================
   HET CONTRACT DAT EEN ZAAK OPSTELT -- /api/supplier/contract/maak.

   Deze ene deur uit server/routes/supplier/contract.js werd door de hele suite
   nooit geopend. scripts/dekking.js wees hem aan als NOOIT AANGEROEPEN: het
   BUURMANNETJE /api/supplier/contracten staat wel in het routejournaal (de
   schermtoetsen openen het tabblad), maar het maken zelf niet. Een lijst die
   je leest zonder ooit iets te maken, bewijst alleen dat de lijst leeg mag zijn.

   WAAROM DIT DE SCHERPE HOEK IS

   Een contract is bewijs. Wie het mag opstellen, aan wie het gericht mag zijn
   en wat er van de ontvanger in beeld komt, zijn hier drie aparte vragen:

     - opstellen is werk van de LEIDING (managerOnly), want een contract legt de
       zaak vast en niet de persoon die het typt;
     - de ontvanger is een lid op CODENAAM of een eigen personeelslid, en een
       personeelslid van de buurzaak is geen van beide;
     - wat er teruggaat is contractPubliek(), en die geeft van een lid alleen de
       codenaam terug -- de sleutel waarmee dat lid in de kluis staat, blijft
       binnen. Dat is de codenaamregel uit CLAUDE.md, en hij is hier extra
       gevoelig omdat het antwoord regelrecht op het scherm van de zaak komt.

   MUTATIES die zijn gedraaid en welke bewering erop zakte (LAT.md regel 2):
   - `if (!managerOnly(req, res)) return;` uit de route gehaald
     -> toets 1 "opstellen is werk van de leiding" ZAKT (RAAK)
   - de lengte-eis op de tekst (>= 20) eruit gehaald
     -> toets 2 "een leeg contract is geen contract" ZAKT (RAAK)
   - de supplier_code-controle bij staffId eruit gehaald
     -> toets 3 "een personeelslid van de buurzaak kennen we niet" ZAKT (RAAK)
   - `codename: c.partij.codename` in contractPubliek vervangen door de hele
     partij -> toets 4 "de sleutel van het lid blijft binnen" ZAKT (RAAK)
   - `status: 'wacht'` vervangen door 'getekend'
     -> toets 4 "een vers contract is nog door niemand getekend" ZAKT (RAAK)

   Draai los: node --test test/supplier-contract.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-supcontract-'));
const ZAAK = 'KIKUNOI';    // Sal de Mar, het restaurant
const BUUR = 'PONTO';      // Sunset Ibiza, de bar ernaast
let srv, base, baas, vloer, buur, VLOER_ID, BUUR_ID, LID_CODE, REF;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function moet(pad, body, token, wat) {
  const r = await api(pad, body, token);
  assert.equal(r.status, 200, wat + ' -- ' + (r.body.error || r.status));
  return r.body;
}

/* De rooster-route is publiek (dat is het scherm waarop je jezelf aanwijst), de
   pincode niet: de seed geeft de leiding 1234 en de vloer 5678. */
async function bemensing(code) {
  const rooster = await moet('/api/supplier/roster', { code }, null, 'het rooster van ' + code);
  const lijst = rooster.staff || [];
  const mg = lijst.find(x => x.role === 'manager');
  const st = lijst.find(x => x.role !== 'manager');
  assert.ok(mg, 'de demozaak ' + code + ' heeft leiding');
  return { mg, st };
}

/* Een echt RTG-lid, want de ontvanger wordt op codenaam opgezocht. Net als de
   echte app roepen we daarna een keer /api/state aan: dat zet het lid via
   dirTouch in de codenaamgids, en zonder die stap vindt keyVanCodenaam niets. */
async function nieuwLid() {
  const u = String(Date.now()).slice(-8);
  const reg = await moet('/api/auth/register', {
    name: 'Contractlid', email: 'con' + u + '@voorbeeld.test', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg'
  }, null, 'een lid aanmelden');
  const st = await moet('/api/state', {}, reg.token, 'de app openen');
  const codenaam = st.state.user.codename;
  assert.ok(codenaam, 'het lid draait op een codenaam');
  return codenaam;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;

  const eigen = await bemensing(ZAAK);
  assert.ok(eigen.st, 'en vloer');
  VLOER_ID = eigen.st.id;
  baas = (await api('/api/supplier/login', { code: ZAAK, staffId: eigen.mg.id, pin: '1234' })).body.token;
  vloer = (await api('/api/supplier/login', { code: ZAAK, staffId: VLOER_ID, pin: '5678' })).body.token;

  const ander = await bemensing(BUUR);
  BUUR_ID = ander.mg.id;
  buur = (await api('/api/supplier/login', { code: BUUR, staffId: BUUR_ID, pin: '1234' })).body.token;

  assert.ok(baas && vloer && buur, 'twee zaken, drie sessies');
  LID_CODE = await nieuwLid();
});

test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { if (e && e.code !== 'ENOTEMPTY') throw e; }
});

const GOED = {
  soort: 'algemeen',
  titel: 'Samenwerking zomerseizoen',
  tekst: 'De zaak levert de bediening voor het terras gedurende het zomerseizoen, ' +
         'tegen de tarieven die in de bijlage staan en met een opzegtermijn van een maand.'
};

test('1. opstellen is werk van de leiding, en van niemand zonder sessie', async () => {
  /* De poort staat voor de inhoud, dus een geldig lijf hoort hier niet te
     helpen: alle drie de weigeringen gaan over WIE er vraagt. */
  const anoniem = await api('/api/supplier/contract/maak', { ...GOED, codenaam: LID_CODE }, null);
  assert.equal(anoniem.status, 401, 'zonder sessie komt er geen contract uit: ' + JSON.stringify(anoniem.body));

  const rommel = await api('/api/supplier/contract/maak', { ...GOED, codenaam: LID_CODE }, 'niet-een-token');
  assert.equal(rommel.status, 401, 'een verzonnen token opent de zaak niet');

  const bediening = await api('/api/supplier/contract/maak', { ...GOED, codenaam: LID_CODE }, vloer);
  assert.equal(bediening.status, 403, 'de vloer stelt geen contracten op namens de zaak');
  assert.match(String(bediening.body.error || ''), /manager/i, bediening.body.error);
  assert.equal(bediening.body.contract, undefined, 'en er komt ook geen half contract mee terug');
});

test('2. een contract zonder titel of zonder voorwaarden is geen contract', async () => {
  const zonderTitel = await api('/api/supplier/contract/maak',
    { ...GOED, titel: '   ', codenaam: LID_CODE }, baas);
  assert.equal(zonderTitel.status, 400, 'een lege titel wordt geweigerd');
  assert.match(String(zonderTitel.body.error || ''), /titel/i, zonderTitel.body.error);

  const kaal = await api('/api/supplier/contract/maak',
    { ...GOED, tekst: 'Zie bijlage.', codenaam: LID_CODE }, baas);
  assert.equal(kaal.status, 400, 'drie woorden zijn geen voorwaarden');
  assert.match(String(kaal.body.error || ''), /voorwaarden/i, kaal.body.error);

  const geenTekst = await api('/api/supplier/contract/maak',
    { ...GOED, tekst: undefined, codenaam: LID_CODE }, baas);
  assert.equal(geenTekst.status, 400, 'en helemaal geen tekst ook niet');
});

test('3. de ontvanger bestaat, of er komt geen contract', async () => {
  const onbekend = await api('/api/supplier/contract/maak',
    { ...GOED, codenaam: 'bestaat-echt-niet-' + Date.now() }, baas);
  assert.equal(onbekend.status, 404, 'een codenaam die niemand draagt');
  assert.match(String(onbekend.body.error || ''), /codenaam/i, onbekend.body.error);

  /* De scherpe: het personeelsnummer van de BUURZAAK. Nummers zijn kort en
     oplopend, dus wie hier alleen op "bestaat dit nummer" zou toetsen, schrijft
     een contract op naam van iemand die bij een ander bedrijf werkt. */
  const vanDeBuren = await api('/api/supplier/contract/maak',
    { ...GOED, soort: 'personeel', staffId: BUUR_ID }, baas);
  assert.equal(vanDeBuren.status, 404, 'een personeelslid van de buurzaak kennen we hier niet');
  assert.match(String(vanDeBuren.body.error || ''), /personeelslid/i, vanDeBuren.body.error);

  const nietBestaand = await api('/api/supplier/contract/maak',
    { ...GOED, soort: 'personeel', staffId: 999999 }, baas);
  assert.equal(nietBestaand.status, 404, 'een personeelsnummer dat niet bestaat, tekent niets');
});

test('4. een lid krijgt een contract op codenaam, ongetekend, en zonder zijn sleutel', async () => {
  const uit = await moet('/api/supplier/contract/maak', {
    soort: 'verhuur', titel: GOED.titel, tekst: GOED.tekst, codenaam: LID_CODE,
    velden: [{ label: 'Maandbedrag', waarde: '1.250,00' }, { label: '', waarde: 'zonder label' }]
  }, baas, 'de leiding stelt een contract op');

  const c = uit.contract;
  assert.ok(c, 'er komt een contract terug');
  assert.match(String(c.ref), /^RTG-C-[0-9A-F]{6}$/, 'de referentie heeft de huisvorm: ' + c.ref);
  assert.equal(c.soort, 'verhuur', 'de soort blijft staan zoals gevraagd');
  assert.equal(c.supplierCode, ZAAK, 'het contract staat op naam van de eigen zaak');
  assert.equal(c.titel, GOED.titel);
  assert.equal(c.tekst, GOED.tekst, 'de tekst is het bewijs en gaat ongewijzigd mee');

  /* Een vers contract is door NIEMAND getekend. Zou hij als getekend geboren
     worden, dan is de handtekening geen bewijs meer maar een vinkje. */
  assert.equal(c.status, 'wacht', 'de status is "wacht"');
  assert.equal(c.tekenZaak, null, 'de zaak heeft nog niet getekend');
  assert.equal(c.tekenPartij, null, 'het lid heeft nog niet getekend');
  assert.ok(Date.parse(c.at) > 0, 'er staat een tijdstempel op');

  assert.equal(c.partij.kind, 'lid');
  assert.equal(c.partij.codename, LID_CODE, 'de ontvanger staat er op codenaam in');
  assert.equal('key' in c.partij, false,
    'en zijn sleutel gaat NIET mee naar het scherm van de zaak: ' + JSON.stringify(c.partij));
  assert.equal('naam' in c.partij, false, 'de echte naam blijft in de kluis');

  const labels = (c.velden || []).map(v => v.label);
  assert.deepEqual(labels, ['Maandbedrag'], 'een veld zonder label valt weg in plaats van leeg mee te reizen');

  /* En hij is er ECHT: de lijst van de zaak toont hem, die van de buurzaak niet.
     Zonder deze twee zou een route die alleen een antwoord verzint ook slagen. */
  REF = c.ref;
  const mijn = await moet('/api/supplier/contracten', {}, baas, 'de contracten van de zaak');
  const staat = (mijn.contracten || []).find(x => x.ref === REF);
  assert.ok(staat, 'het contract staat in de lijst van de eigen zaak');
  assert.equal(staat.status, 'wacht', 'en ook daar nog ongetekend');

  const bijDeBuren = await moet('/api/supplier/contracten', {}, buur, 'de contracten van de buurzaak');
  assert.equal((bijDeBuren.contracten || []).some(x => x.ref === REF), false,
    'de buurzaak ziet het contract van een ander bedrijf niet');
});

test('5. een eigen personeelslid kan wel, een onbekende soort valt terug op "algemeen"', async () => {
  const lange = 'Proefperiode ' + 'x'.repeat(200);
  const uit = await moet('/api/supplier/contract/maak', {
    soort: 'iets-verzonnens', titel: lange, tekst: GOED.tekst, staffId: VLOER_ID
  }, baas, 'een contract voor de eigen vloer');

  const c = uit.contract;
  assert.equal(c.soort, 'algemeen', 'een soort die niet bestaat wordt niet overgenomen maar wordt "algemeen"');
  assert.equal(c.partij.kind, 'staff', 'de ontvanger is een personeelslid');
  assert.ok(c.partij.naam, 'en die staat met zijn naam in zijn eigen arbeidscontract');
  assert.equal('staffId' in c.partij, false, 'het interne personeelsnummer gaat niet mee naar buiten');
  assert.equal(c.titel.length, 80, 'de titel wordt op 80 tekens afgekapt en niet ongelimiteerd opgeslagen');
  assert.notEqual(c.ref, REF, 'elk contract krijgt zijn eigen referentie');
});

/* MN-02-AI: BESMET EEN HANDELING IN HOEDANIGHEID A DE CONTEXT VAN RAHUL IN B?

   MENSNETWERK.md par. 4a bewees MN-02 over de ROUTES: dezelfde mens met twee
   hoedanigheden neemt geen kennis van de ene mee naar de andere. Par. 4b noemde
   hardop wat die ronde NIET kon beproeven, en dit bestand is dat gat:

     Rahul krijgt bij elke vraag een context mee die het lid niet opvraagt, niet
     ziet, en nergens kan controleren. Lekt daar iets in, dan merkt niemand het.

   DE ENE VRAAG: kan dezelfde actor door een eerdere handeling in hoedanigheid A
   (ledenbalie, kantoor) informatie veroorzaken die Rahul later in hoedanigheid B
   (lid) ziet of gebruikt?

   DE WAARNEMING IS DE PROMPT ZELF, EN DAT IS HET HELE PUNT. De samengestelde
   context staat op geen enkel scherm en komt in geen enkel antwoord terug; de
   enige plek waar hij te zien is, is waar hij het huis verlaat. Dus draait hier
   een NEP-MODELSERVER op 127.0.0.1 met LOCAL_AI_URL ernaartoe, en vangt die de
   system prompt op zoals het model hem krijgt. Dat is geen fixture van wat de
   code zou doen, maar wat er werkelijk uitgaat -- precies het onderscheid dat
   test/vertegenwoordiging.e2e.test.js afdwong toen de unittoetsen groen stonden
   op een verzonnen vorm.

   HET EXPERIMENT, en waarom het zo staat:

     1. R registreert zich als lid EN koppelt de kantoorrol op hetzelfde account.
        Een mens, twee hoedanigheden -- geen twee mensen. Dat is MN-02.
     2. S is een ander lid. Wat R over S te weten komt, komt UITSLUITEND uit de
        balie-inzage; R en S delen verder niets.
     3. Momentopname 1: R vraagt Rahul iets als lid. De prompt wordt gevangen.
     4. R doet als KANTOOR een rechtmatige inzage op S, met een reden. Dat mag,
        en het hoort te lukken -- zie de tegenproef hieronder.
     5. En er wordt van kantoorzijde iets OP HET ACCOUNT VAN R ZELF geschreven:
        een bewaarverzoek. Twee richtingen dus, want de vraag heeft er twee:
        bereikt kennis die R in A opdeed zijn eigen context (inzage op S), en
        bereikt wat het kantoor over R vastlegde die context (schrijven op R)?
        Die tweede is de scherpste van de twee: `bewaarVerzoek.door` draagt de
        ECHTE NAAM van de medewerker uit de identiteitskluis, en hij ligt in
        precies hetzelfde object als de reis en de facturen die Rahul wel leest.
     6. Momentopname 2: dezelfde vraag, dezelfde sessie.
     7. En daarna een BESTURINGSPROEF: R zet zijn eigen omgangsvorm om, iets dat
        de context WEL hoort te veranderen, en er volgt momentopname 3.

   DE DRAGENDE TOETS IS DE GELIJKHEID, en niet de woordenlijst. Een lek dat de
   waarde van S letterlijk meeneemt is de makkelijke vorm; de gevaarlijke is een
   AFGELEIDE ("dit lid woont in dezelfde regio als het laatst geopende dossier").
   Daar komt geen enkele waarde van S in voor, en een zoek-op-waarde ziet hem
   niet. Verandert de context na een kantoorhandeling ook maar een teken, dan is
   er iets overgestoken -- ongeacht in welke vorm.

   WAT ER GENORMALISEERD WORDT, EN WAAROM DAT GEEN GAT IS. Twee regels van de
   prompt zijn tijdgebonden en voor het HELE HUIS gelijk: de dagcontext (weekdag,
   dagdeel, seizoen, temperatuur) en de bui van Rahul. Ze hangen aan de klok en
   niet aan een mens, dus ze kunnen per definitie geen kennis over S dragen.
   Zonder normalisatie zou deze toets op een uurgrens flakkeren. Toets 5 bewaakt
   de normalisatie zelf: hij eist dat er precies EEN dagcontextregel gevonden is,
   zodat een stille no-op (of een normalisator die te veel opeet) zakt in plaats
   van gerust te stellen.

   DE TEGENPROEF STAAT ERNAAST, want zonder tegenproef haalt de luie oplossing
   het: geef Rahul helemaal geen ledencontext, en er lekt niets. Toets 1 eist
   daarom dat de context WEL over dit lid gaat (zijn eigen codenaam), en toets 4
   dat de kantoorweg zelf gewoon 200 blijft geven met het dossier erin. Alleen
   samen zeggen ze iets.

   WAAROM ER EEN BESTURINGSPROEF IS, en dat is de leerzaamste van deze ronde.
   De gelijkheid van toets 3 heeft een blinde vlek: een CACHE. Wie de prompt
   bewaart op `key` -- zonder de hoedanigheid in de sleutel, precies de vorm waar
   MENSNETWERK.md par. 4a voor waarschuwt -- krijgt twee identieke momentopnamen
   ongeacht wat er tussenin gebeurde, en dan staat deze hele toets groen terwijl
   hij niets meer meet. Gemeten: met zo'n cache erin slagen alle zes de zaken.
   Toets 6 sluit dat: hij verandert iets dat de context WEL hoort te raken (de
   eigen omgangsvorm van R) en eist dat de context meebeweegt. Een instrument dat
   niet kan uitslaan, is geen instrument -- zelfde gedachte als toets 5 over de
   normalisatie.

   GEMETEN MET DE MUTATIE (13 september 2026), vijf stuks, elk apart gedraaid op
   een verder schone boom:
     a. `md.bewaarVerzoek` met veldnaam aan de prompt toevoegen -> 2b en 3 zakken
     b. dezelfde waarde onder een neutrale naam                 -> 2b en 3 zakken
     c. een AFGELEIDE regel, zonder enige waarde erin           -> alleen 3 zakt
     d. de prompt cachen op `key` zonder hoedanigheid           -> alleen 6 zakt
     e. de identiteitsreparatie terugdraaien (PERSONAS[tier])   -> alleen 1 zakt
   Mutatie c is waarom de gelijkheid de dragende toets is: daar komt geen enkele
   waarde in voor, dus een zoek-op-waarde ziet hem niet. Mutatie d is waarom de
   besturingsproef er staat: zonder toets 6 slaagde hij volledig.

   WAT HIER NIET WORDT BEWEERD: dit gaat over de LEDENcontext van Rahul
   (kern/ai/prompt.js). De werkcontexten (zaak, personeel, kantoor) hebben hun
   eigen samenstellers en zijn hier niet gemeten.

   Draai los: node --test test/mn02ai-contextbesmetting.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { startServer, stop, kantoorKoppelBody } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mn02ai-'));
const REDEN = 'Controle van het abonnement na een vraag van het lid zelf';
const VRAAG = 'waar moet ik op letten voor mijn volgende reis?';

/* De nep-modelserver: hij antwoordt in de OpenAI-vorm (daar praat server/
   local-ai.js mee) en bewaart elke system prompt die langskomt. */
function nepModel() {
  return new Promise((resolve) => {
    const prompts = [];
    const srv = http.createServer((req, res) => {
      const brok = [];
      req.on('data', c => brok.push(c));
      req.on('end', () => {
        let body = {}; try { body = JSON.parse(Buffer.concat(brok).toString()); } catch (e) {}
        const sys = (body.messages || []).filter(m => m.role === 'system').map(m => m.content).join('\n');
        if (sys) prompts.push(sys);
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ choices: [{ message: { content: 'Genoteerd.' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 2 } }));
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, prompts, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}

let model, srv, base;
let rLid, rKantoor, rCodenaam, rId, sId, sDossier, rBewaar;
let voor, na, daarna;

const api = (pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Een momentopname: stel Rahul dezelfde vraag en geef terug wat het model zag.
   `/api/ai` is met opzet de sonde en niet `/api/chat/send`: die tweede SCHRIJFT
   in de ledenstaat (het gesprek), en dan meet je je eigen vorige vraag terug. */
async function momentopname() {
  const voorAf = model.prompts.length;
  const r = await api('/api/ai', { messages: [{ role: 'user', content: VRAAG }] }, rLid);
  assert.equal(r.status, 200, 'de ledenvraag komt door');
  assert.equal(r.body.source, 'ai', 'het verzoek ging ECHT naar het model; anders meet deze toets niets');
  assert.ok(model.prompts.length > voorAf, 'het model heeft een system prompt gekregen');
  return model.prompts[model.prompts.length - 1];
}

/* De twee tijdgebonden, huisbrede regels eruit. Zie de kop: ze hangen aan de
   klok en niet aan een mens. De teller gaat mee naar buiten zodat toets 5 kan
   vaststellen dat er werkelijk iets genormaliseerd is. */
const DAGREGEL = /^Het is .*graden\./;
const BUIREGEL = /^(Je stemming vandaag:|Je bent vandaag )/;
function normaliseer(prompt) {
  let dag = 0, bui = 0;
  const regels = String(prompt).split('\n').map(r => {
    if (DAGREGEL.test(r)) { dag++; return '<DAGCONTEXT>'; }
    if (BUIREGEL.test(r)) { bui++; return '<BUI>'; }
    return r;
  });
  return { tekst: regels.join('\n'), dag, bui };
}

/* ONDERSCHEIDENDE MARKERS, en waarom dat geen versoepeling is.

   Een marker die OOK in de vaste tekst voorkomt, is geen marker. Deze toets
   vond dat zelf: `bewaarVerzoek.door` draagt de echte naam van de medewerker,
   en de eigenaar van dit huis heet net zo als het karakterportret van Rahul --
   "Rahul Imran Ismail" staat woordelijk in kern/ai/karakter.js. De eerste vorm
   van toets 2b zakte daarop en wees een lek aan dat er niet was. Dezelfde
   klasse als de veldinventaris van scripts/aicontext.js, die op de naam `st`
   het halve huis meetelde: een nette uitslag uit het verkeerde experiment.

   Onderscheidend = het staat NIET al in de momentopname van vóór de handeling.
   Dat kan alleen markers weggooien, nooit een lek: iets dat er voor de
   handeling al stond, is er niet door de handeling gekomen. De aanroeper eist
   dat er minstens een overblijft, zodat een lege lijst niet als groen leest. */
function onderscheidend(obj, basis) {
  return Object.entries(obj || {})
    .filter(([, v]) => v != null && typeof v !== 'object' && String(v).length >= 4)
    .filter(([, v]) => !basis.includes(String(v)));
}

test.before(async () => {
  model = await nepModel();
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP,
    /* Alleen de eigen modelserver: RTG_EXTERNE_AI_UIT sluit de rest hard af, en
       dan is elke prompt die dit bestand ziet ook werkelijk elke prompt die het
       huis verlaat. */
    LOCAL_AI_URL: model.base, LOCAL_AI_MODEL: 'proefmodel', RTG_EXTERNE_AI_UIT: '1' } });
  base = srv.base;

  const eig = await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  const boardroom = eig.body.token;
  assert.ok(boardroom, 'de eigenaar opent de boardroom (die deelt de baliezetels uit)');

  /* R: EEN mens, twee hoedanigheden. Eerst het lid, dan dezelfde persoon de
     kantoorrol erbij -- niet een tweede account dat toevallig ook kantoor is. */
  const u = Date.now().toString().slice(-8) + Math.random().toString(36).slice(2, 6);
  const regR = await api('/api/auth/register', { name: 'Roos Mn02', email: 'mn02ai-r' + u + '@voorbeeld.test',
    password: 'geheim123', geboortedatum: '1988-04-04', pasApp: 'rtg' });
  rLid = regR.body.token;
  const rUser = ((regR.body || {}).state || {}).user || {};
  rCodenaam = rUser.codename;
  rId = rUser.id;
  assert.ok(rLid && rCodenaam, 'R is lid, met een eigen codenaam');

  const koppel = await api('/api/account/koppel', await kantoorKoppelBody(base, rLid), rLid);
  assert.equal(koppel.status, 200, 'dezelfde mens koppelt de kantoorrol: ' + JSON.stringify(koppel.body).slice(0, 160));
  rKantoor = (await api('/api/account/start', { rol: 'kantoor' }, rLid)).body.token;
  assert.ok(rKantoor, 'R heeft nu een kantoorsessie NAAST zijn ledensessie');
  const zetel = await api('/api/office/balie/zetel', { key: 'user-' + rUser.id }, boardroom);
  assert.equal(zetel.status, 200, 'R krijgt een baliezetel op naam');

  /* S: het lid over wie R straks in hoedanigheid A iets te weten komt. */
  const regS = await api('/api/auth/register', { name: 'Sam Mn02', email: 'mn02ai-s' + u + '@voorbeeld.test',
    password: 'geheim123', geboortedatum: '1979-11-11', pasApp: 'rtg' });
  sId = (((regS.body || {}).state || {}).user || {}).id;
  assert.ok(sId, 'S bestaat');

  voor = await momentopname();

  const dossier = await api('/api/office/balie/dossier', { id: sId, reden: REDEN }, rKantoor);
  assert.equal(dossier.status, 200, 'de inzage is RECHTMATIG en lukt: ' + JSON.stringify(dossier.body).slice(0, 200));
  sDossier = dossier.body.lid;
  assert.ok(sDossier && sDossier.steuncode, 'R heeft nu kantoorkennis over S in handen');

  /* De andere richting: het kantoor legt iets vast OP het account van R. Dat
     gaat langs de eigenaar en niet langs R -- /api/office/bewaarverzoek eist
     `req.eigenaar`, want dit verlengt de bewaring van het zwaarste wat we van
     iemand hebben. De schrijver doet er voor deze toets niet toe; wat telt is
     dat er kantoorwerk in de LEDENSTAAT van R belandt, in hetzelfde object
     waaruit Rahul zijn reis en facturen leest. */
  const bewaar = await api('/api/office/bewaarverzoek',
    { userId: rId, reden: 'Lopend geschil over een boeking; dossier nog een jaar bewaren' }, boardroom);
  assert.equal(bewaar.status, 200, 'het bewaarverzoek is vastgelegd: ' + JSON.stringify(bewaar.body).slice(0, 200));
  rBewaar = bewaar.body.bewaarVerzoek;
  assert.ok(rBewaar && rBewaar.reden && rBewaar.door,
    'het verzoek draagt een reden en de naam van wie het vroeg -- allebei kantoortaal');

  na = await momentopname();

  /* DE BESTURINGSPROEF. Een verandering die de context WEL hoort te raken: de
     omgangsvorm van R, die hij zelf zet (kern/rahul-omgang.js). Beweegt de
     context hier niet mee, dan meet toets 3 niets -- zie de kop. */
  const zet = await api('/api/ik/zet', { omgang: 'zakelijk' }, rLid);
  assert.equal(zet.status, 200, 'R zet zijn eigen omgangsvorm om: ' + JSON.stringify(zet.body).slice(0, 160));
  daarna = await momentopname();
});

test.after(() => {
  stop(srv && srv.child);
  try { model && model.srv.close(); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* ---------- 1. de tegenproef: de context gaat WEL over dit lid ---------- */
test('1. tegenproef: Rahul weet met wie hij praat -- de eigen codenaam, niet de demo-persona', () => {
  assert.match(voor, /Het lid: /, 'de context stelt het lid voor');
  assert.ok(voor.includes(rCodenaam),
    'de context draagt de codenaam van R zelf (' + rCodenaam + '), en niet die van de demo-rij. ' +
    'Zonder deze eis haalt de luie MN-02-AI het: geef Rahul geen ledencontext en er lekt niets.');
  assert.ok(!/Amberen Vos/.test(voor),
    'de demo-persona hoort niet in de context van een echt lid (PERSONAS is op de PAS gesleuteld)');
});

/* ---------- 2. geen veldnaam en geen waarde van S ---------- */
test('2. wat R als KANTOOR over S zag, staat niet in de ledencontext van R', () => {
  /* De markers komen uit het ECHTE antwoord van de balie en niet uit een lijst
     in deze toets: wint het dossier er morgen een veld bij, dan wordt dat veld
     hier vanzelf meegewogen. Alleen waarden die ONDERSCHEIDEND zijn tellen --
     "RTG Pass" staat terecht in de context van R zelf, en dat is geen lek. */
  const markers = onderscheidend(sDossier, voor);
  assert.ok(markers.length, 'er is minstens een onderscheidende waarde om op te toetsen');
  for (const [veld, waarde] of markers) {
    assert.ok(!na.includes(String(waarde)),
      'de waarde van S.' + veld + ' (' + String(waarde) + ') staat in de ledencontext van R');
  }
  assert.ok(!na.includes('steuncode') && !na.includes(sDossier.steuncode),
    'ook de veldnaam steuncode hoort er niet in: die bestaat alleen aan de balie');
});

/* ---------- 2b. de andere richting: kantoorwerk OP R ---------- */
test('2b. wat het kantoor op het account van R vastlegde, bereikt zijn eigen ledencontext niet', () => {
  const markers = onderscheidend(rBewaar, voor);
  assert.ok(markers.some(([veld]) => veld === 'reden'),
    'de reden is onderscheidend; zonder die marker toetst deze zaak niets');
  for (const [veld, waarde] of markers) {
    assert.ok(!na.includes(String(waarde)),
      'bewaarVerzoek.' + veld + ' (' + String(waarde).slice(0, 60) + ') staat in de ledencontext van R. ' +
      'Dat is kantoortaal over een lid, geschreven door een medewerker, en het lid heeft hem nooit gezien.');
  }
  assert.ok(!/bewaarVerzoek|bewaarverzoek/i.test(na), 'ook de veldnaam zelf hoort er niet in');
});

/* ---------- 3. de dragende toets: de context is niet veranderd ---------- */
test('3. de ledencontext is na de kantoorinzage teken voor teken dezelfde', () => {
  const a = normaliseer(voor), b = normaliseer(na);
  if (a.tekst !== b.tekst) {
    const ra = a.tekst.split('\n'), rb = b.tekst.split('\n');
    const anders = rb.filter(r => !ra.includes(r)).concat(ra.filter(r => !rb.includes(r)));
    assert.fail('de context van R veranderde door een handeling in zijn ANDERE hoedanigheid. ' +
      'Verschil:\n  ' + anders.slice(0, 6).map(r => r.slice(0, 200)).join('\n  '));
  }
  assert.equal(a.tekst, b.tekst);
});

/* ---------- 4. de tweede tegenproef: de kantoorweg werkt gewoon ---------- */
test('4. tegenproef: de rechtmatige inzage levert het dossier WEL -- dichtdraaien telt niet als scheiding', () => {
  assert.ok(sDossier.codename, 'het dossier draagt de codenaam van S');
  assert.ok(sDossier.steuncode, 'en de steuncode, waarmee S zich aan de balie meldt');
  assert.ok(Object.prototype.hasOwnProperty.call(sDossier, 'abo'), 'en de abonnementsstand');
});

/* ---------- 6. de besturingsproef: het instrument kan uitslaan ---------- */
test('6. besturingsproef: een verandering die WEL hoort door te komen, komt door', () => {
  const b = normaliseer(na), c = normaliseer(daarna);
  assert.notEqual(c.tekst, b.tekst,
    'de context bewoog niet mee toen R zijn eigen omgangsvorm omzette. Dan bewijst de ' +
    'gelijkheid van toets 3 niets: een cache op de sleutel levert twee identieke ' +
    'momentopnamen ongeacht wat ertussen gebeurde, en die vorm is met de mutatie gemeten.');
  assert.ok(/zakelijk: efficient|geen geintjes/i.test(daarna),
    'en de nieuwe omgangsvorm staat er ook werkelijk in, zodat dit geen willekeurig verschil is');
});

/* ---------- 5. de normalisatie bewijst zichzelf ---------- */
test('5. de normalisatie heeft echt iets genormaliseerd (geen stille no-op)', () => {
  const a = normaliseer(voor);
  assert.equal(a.dag, 1, 'precies EEN dagcontextregel: nul betekent dat de normalisatie niets doet ' +
    'en dat toets 3 op een uurgrens gaat flakkeren; meer dan een betekent dat hij te veel opeet');
  assert.ok(a.bui <= 1, 'hoogstens een buiregel');
  assert.ok(a.tekst.includes('<DAGCONTEXT>'), 'de plaatshouder staat er');
});

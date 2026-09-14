/* MN-02 -- SCHEIDING VAN HOEDANIGHEDEN, als contaminatieproef.

   > Kennis die actor X rechtmatig verkrijgt in hoedanigheid A, mag niet zonder
   > afzonderlijke grond beschikbaar worden in hoedanigheid B.

   DIT IS EEN ANDER SOORT PROEF DAN MN-01, en ze mogen niet op een hoop.
   `test/mn01-bevoegdheidsvoordeel.test.js` gaat over BEVOEGDHEID en is
   structureel te meten: er is een deur, en die gaat niet open. MN-02 gaat over
   KENNIS, en daar is de verkeerde formulering verleidelijk:

     FOUT:  "een RTG-medewerker mag niet meer weten dan een externe manager"
     GOED:  "wat hij in hoedanigheid A weet, is in hoedanigheid B niet
             beschikbaar zonder eigen grond"

   De eerste is aantoonbaar onwaar EN soms gewenst: `kern/ledenbalie.js` is een
   legitieme kennisweg, met een reden, een journaalregel en bericht aan de
   betrokkene (MENSNETWERK.md par. 0.5). Een toets die die weg dichtzet, meet
   niet MN-02 maar breekt de balie.

   DAAROM TWEE HELFTEN DIE DE ANDERE KANT OP TREKKEN, en alleen samen bewijzen
   ze iets:

     1. legitieme extra kennis BLIJFT mogelijk  (de kantoorweg geeft 200)
     2. en die kennis DRAAGT NIET OVER          (de managerweg blijft schoon)

   Zonder (1) is de goedkoopste implementatie "blokkeer alle kantoorinzage voor
   managers", en dan is de toets groen terwijl het product stuk is.

   EEN MENS, TWEE SESSIES. R is tegelijk benoemd kantoormedewerker MET een
   baliezetel, en manager van Mila via een aanvaarde machtiging. Dat is met opzet
   dezelfde persoon: bij twee verschillende mensen meet je toegangsscheiding en
   niet hoedanigheidsscheiding.

   DE VOLGORDE IS HET BEWIJS. De managercontext wordt VOOR en NA de kantoorinzage
   opgehaald, en moet byte voor byte gelijk zijn. Zo valt ook een gedeelde cache
   of een verrijkte projectie door de mand -- je kunt perfect afgeschermde routes
   hebben terwijl een contextbouwer twee bronnen alsnog samenvoegt.

   Draai los: node --test test/mn02-hoedanigheidsscheiding.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mn02-'));
const CODE = 'RTG-OFFICE-MN02';
const REDEN = 'Controle van het abonnement na een vraag van het lid zelf';

let BASE, kind;
let mila = {}, R = {}, eigenaarKantoor, machtigingId;

const post = (pad, lijf, tok) => fetch(BASE + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
  body: JSON.stringify(lijf || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function maakLid(naam, mail, tel) {
  const r = await post('/api/auth/register', { name: naam, email: mail, phone: tel,
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  const st = (await post('/api/state', {}, r.body.token)).body.state.user;
  return { token: r.body.token, id: st.id, codenaam: st.codename, key: 'user-' + st.id };
}

test.before(async () => {
  ({ child: kind, base: BASE } = await startServer({
    env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_DEMO: '1', OFFICE_CODE: CODE } }));

  mila = await maakLid('Mila Test', 'mn02mila@x.nl', '0612340001');
  R = await maakLid('R Dubbelrol', 'mn02r@x.nl', '0612340002');

  /* De eigenaar deelt de zetels uit en keurt de identiteit goed; hij is hier
     niet het onderwerp maar het gereedschap. */
  const eig = await post('/api/auth/login', { login: 'Rahul', password: 'Imran' });
  eigenaarKantoor = (await post('/api/account/start', { rol: 'kantoor' }, eig.body.token)).body.token;

  /* R KRIJGT ZIJN TWEEDE HOEDANIGHEID OP HETZELFDE ACCOUNT. Niet via
     test/helper.js kantoorAlsPersoon(): die registreert een VERS account, en dan
     zijn het twee mensen en meet deze proef het verkeerde. */
  await post('/api/account/koppel', { soort: 'kantoor', code: CODE }, R.token);
  R.kantoor = (await post('/api/account/start', { rol: 'kantoor' }, R.token)).body.token;
  await post('/api/office/balie/zetel', { key: R.key }, eigenaarKantoor);

  /* Mila moet door volwassen() voordat er een machtiging op haar kan bestaan. */
  await post('/api/office/verify', { userId: mila.id, decision: 'approve',
    faceMatch: true, nationaliteit: 'NL', geboortedatum: '1990-01-01' }, eigenaarKantoor);

  const voorstel = await post('/api/vertegenwoordiging/voorstel', { client: mila.codenaam,
    hoedanigheid: 'manager', bevoegdheden: ['aanbod.ontvangen'],
    tot: new Date(Date.now() + 100 * 86400000).toISOString() }, R.token);
  const mid = voorstel.body && voorstel.body.machtiging && voorstel.body.machtiging.id;
  if (mid && (await post('/api/vertegenwoordiging/aanvaard', { id: mid }, mila.token)).status === 200) {
    machtigingId = mid;
  }
});
test.after(() => {
  stop(kind);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* De velden die ALLEEN de kantoorweg kent (kern/ledenbalie-inzage.js).
   `codename` staat er met opzet NIET bij: de managercontext noemt de codenaam
   van zijn client gewoon, want daar is de machtiging voor. */
const KANTOORVELDEN = ['steuncode', 'land', 'stad', 'sinds', 'abo', 'klachten'];

const diep = (o) => JSON.stringify(o == null ? null : o);

test('1. de opstelling klopt: R is ECHT beide, en op hetzelfde account', async () => {
  assert.ok(R.kantoor, 'R heeft geen kantoorsessie; dan meet deze proef niets');
  assert.ok(machtigingId, 'R is geen manager van Mila; dan meet deze proef niets');
  const mijn = await post('/api/vertegenwoordiging/mijn', {}, R.token);
  assert.equal(mijn.status, 200);
  const staat = JSON.stringify(mijn.body.ikSta || []);
  assert.ok(staat.includes(mila.codenaam),
    'Mila staat niet in het team van R; de machtiging is niet aangekomen');
});

test('2. TEGENPROEF: de legitieme kantoorweg blijft open (anders is de toets een muur)', async () => {
  /* Dit is de helft die de andere kant op trekt. Zou deze zakken, dan is de
     makkelijkste implementatie van MN-02 gekozen -- alle kantoorinzage voor
     managers blokkeren -- en dan is de grens een storing geworden. */
  const d = await post('/api/office/balie/dossier', { id: mila.id, reden: REDEN }, R.kantoor);
  assert.equal(d.status, 200,
    'R komt met een geldige reden niet meer bij het dossier (status ' + d.status + '). MN-02 verbiedt ' +
    'OVERDRACHT van kennis, niet het VERKRIJGEN ervan: ' + JSON.stringify(d.body).slice(0, 160));
  assert.ok(d.body.lid && d.body.lid.steuncode,
    'de kantoorweg geeft geen kantoorvelden meer terug; dan bewijst toets 3 niets');
});

test('3. de kern: kantoorkennis draagt NIET over naar de managercontext', async () => {
  /* De volgorde IS het bewijs: eerst een momentopname van de managercontext,
     dan de kantoorinzage (die in toets 2 aantoonbaar slaagde), dan opnieuw. */
  const voor = await post('/api/vertegenwoordiging/mijn', {}, R.token);
  assert.equal(voor.status, 200);

  const dossier = await post('/api/office/balie/dossier', { id: mila.id, reden: REDEN }, R.kantoor);
  assert.equal(dossier.status, 200, 'de kantoorinzage moet slagen, anders is er niets om over te dragen');
  const geheim = dossier.body.lid || {};

  const na = await post('/api/vertegenwoordiging/mijn', {}, R.token);
  assert.equal(na.status, 200);

  /* (a) GEEN VELDNAAM uit de kantoorweg, op welke diepte dan ook. */
  const tekst = diep(na.body);
  for (const veld of KANTOORVELDEN) {
    assert.ok(!new RegExp('"' + veld + '"').test(tekst),
      'de managercontext draagt het kantoorveld "' + veld + '" -- kennis uit hoedanigheid A is ' +
      'beschikbaar geworden in hoedanigheid B zonder eigen grond');
  }

  /* (b) EN GEEN WAARDE, want een veld is te hernoemen. De steuncode van Mila is
     het scherpst: die bestaat alleen achter de kantoorweg en is nergens anders
     af te leiden. */
  if (geheim.steuncode) {
    assert.ok(!tekst.includes(geheim.steuncode),
      'de steuncode van de client staat in de managercontext; een hernoemd veld is nog steeds overdracht');
  }

  /* (c) EN NIETS VERANDERDE. Dit vangt de gedeelde cache en de verrijkte
     projectie: je kunt perfect afgeschermde routes hebben terwijl een
     contextbouwer beide bronnen alsnog samenvoegt -- zonder dat er een
     veldnaam of een waarde uit (a) of (b) te zien is.

     WAT HIERVAN BEWEZEN IS EN WAT NIET, want dat is niet hetzelfde. Deze
     assertie is aantoonbaar LEVEND: een mutatie die de managercontext
     niet-deterministisch maakt (`bekeken: Date.now()` in publiek()) laat
     uitsluitend deze regel zakken, terwijl (a) en (b) groen blijven. Wat
     daarmee is aangetoond is dat hij een VERSCHIL tussen de twee oproepen
     ziet.

     Wat NIET is aangetoond is dat hij een echte cache-verrijking ziet die
     door de kantoorinzage wordt veroorzaakt -- daarvoor zou zo'n cache eerst
     moeten bestaan, en die is er vandaag niet. Deze regel is dus een
     vooruitgeschoven post en geen bewezen eigenschap. Wie er ooit een
     gedeelde projectie tussen deze twee wegen bij bouwt, hoort hier langs te
     komen. */
  assert.equal(diep(na.body), diep(voor.body),
    'de managercontext van R veranderde DOOR de kantoorinzage. Er lekt geen veldnaam en geen waarde, ' +
    'maar er is wel iets doorgegeven -- kijk naar een gedeelde cache of een projectie die beide bronnen leest');
});

test('4. het spoor van de kantoorinzage staat bij de CLIENT en niet in het team van R', async () => {
  /* De vierde overdrachtsweg: verantwoording. Mila hoort te kunnen zien dat er
     in haar dossier is gekeken; R's managementoverzicht hoort dat NIET als
     eigen kennis te dragen. Twee kanten van dezelfde regel. */
  const mijnR = await post('/api/vertegenwoordiging/mijn', {}, R.token);
  const log = JSON.stringify((mijnR.body && mijnR.body.log) || []);
  for (const veld of KANTOORVELDEN) {
    assert.ok(!new RegExp('"' + veld + '"').test(log),
      'het handelingenlog van de manager draagt het kantoorveld "' + veld + '"');
  }
});

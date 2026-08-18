/* ============================================================================
   DE OVERIGE ROUTES VAN HET LIVING LAB -- werkplaats, apparatuur, deelnemers,
   themas, de pijplijn, de coach en de bewonerskant.

   test/livinglab.test.js loopt de ONDERZOEKSCYCLUS af: de poorten, de ethiek,
   de bewijsmotor. Wat daar niet langskomt is het dagelijkse werk eromheen, en
   dat waren vierendertig routes die tijdens de hele suite geen enkele keer zijn
   aangeroepen. Dit bestand loopt die kant af, met per stap een bewering die
   over gedrag gaat en niet over bereikbaarheid:

     - een taak voor iemand die niet op het onderzoek staat wordt geweigerd;
     - een document met dezelfde naam wordt een nieuwe VERSIE en geen tweede rij;
     - een apparaat is niet uit te geven aan wie er niet bevoegd op is;
     - een open storing haalt een apparaat uit de roulatie;
     - de bewonersdeuren staan met opzet open en tonen alleen het openbare deel.

   MUTATIES die zijn gedraaid en welke bewering erop zakte (LAT.md regel 2):
   - de deelnemerscontrole uit werkplaats.taakBij() gehaald
     -> "een taak voor een vreemde wordt geweigerd" ZAKT (RAAK)
   - documentBij() altijd laten toevoegen in plaats van de versie ophogen
     -> "hetzelfde document wordt een versie" ZAKT (RAAK)
   - de magBedienen-controle uit apparatuurgebruik.uitgifte() gehaald
     -> "een onbevoegde krijgt het apparaat niet mee" ZAKT (RAAK)
   - het bestuurlijke deel niet strippen in bewoner/labs
     -> "de bewoner ziet de binnenkant niet" ZAKT (RAAK)

   Draai los: node --test test/livinglab-routes.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lab2routes-'));
const CODE = 'KANTOOR-LAB2ROUTES-1';
const TOEZICHT = 'M. de Wit';
let srv, base, office, LAB, STUDIE, DEEL, APP, KLACHT;

const api = (pad, body) => fetch(base + '/api/lab2/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + office },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const pub = (pad, body) => fetch(base + '/api/lab2/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function moet(pad, body, wat) {
  const r = await api(pad, body);
  assert.equal(r.status, 200, wat + ' -- ' + (r.body.error || r.status));
  return r.body;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;
  office = (await (await fetch(base + '/api/office/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: CODE })
  })).json()).token;
  assert.ok(office, 'het kantoor logt in');

  /* Een eigen stad: er is per stad precies een lab, en de startdata zet er zelf
     al een paar neer. */
  LAB = (await moet('lab/maak', { stad: 'Routestad', naam: 'Living Lab Routestad' }, 'een lab')).lab.id;
  await moet('lab/tekenaar', { id: LAB, naam: TOEZICHT, rol: 'toezichthouder' }, 'een toezichthouder');
  STUDIE = (await moet('studie/maak', { labId: LAB, titel: 'Routes en rust', soort: 'welzijn',
    vraagstuk: 'Helpt een stillere straat de nachtrust van de bewoners van de Kerkstraat?',
    doel: 'Weten of minder verkeer beter slapen oplevert' }, 'een studie')).studie.id;
  /* De deelnemerspoort gaat pas open als een MENS de risicoklasse heeft
     vastgesteld. Naar beneden bijstellen kan alleen door een tekenbevoegde en
     alleen met een reden -- vandaar dat het hier de toezichthouder is die het
     doet. Bij klasse laag vraagt de poort daarna niets meer. */
  await moet('ethiek/klasse', { id: STUDIE, klasse: 'laag', door: TOEZICHT,
    reden: 'Er worden geen persoonsgegevens verzameld, alleen geluidsniveaus op straat.' },
  'de risicoklasse');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. het bestuur van een lab: budget, partner en het overzicht', async () => {
  const scheef = await api('lab/budget', { id: LAB, toegekend: 1000, besteed: 5000 });
  assert.equal(scheef.status, 400, 'meer besteed dan toegekend wordt niet stil geboekt');

  await moet('lab/budget', { id: LAB, toegekend: 25000, besteed: 1200, bron: 'gemeente' }, 'een budget');
  await moet('lab/partner', { id: LAB, naam: 'Hogeschool Routestad', soort: 'kennisinstelling',
    bijdrage: 'methodologische begeleiding' }, 'een partner erbij');

  const o = await moet('overzicht', { id: LAB }, 'het overzicht van het lab');
  assert.ok(o && typeof o === 'object', 'het overzicht komt terug');
  assert.equal((await api('overzicht', { id: 'bestaat-niet' })).status, 404,
    'een lab dat er niet is, is 404');
});

test('2. deelnemers: een alias krijg je toegewezen, en een rol geldt alleen voor wie meedoet', async () => {
  const bij = await moet('mens/bij', { id: STUDIE, rol: 'buurtonderzoeker' }, 'een deelnemer erbij');
  DEEL = bij.deelnemer;
  assert.ok(DEEL.alias && DEEL.pas, 'de deelnemer krijgt een pseudoniem en een pas');
  assert.equal(/[A-Z]/.test(DEEL.pas.slice(0, 6)), true, 'de pas is een code en geen naam');

  const tweede = (await moet('mens/bij', { id: STUDIE, rol: 'ervaringsdeskundige' }, 'nog een deelnemer')).deelnemer;
  await moet('mens/rol', { id: STUDIE, alias: tweede.alias, rol: 'buurtonderzoeker' }, 'een rol wijzigen');

  const vreemd = await api('mens/rol', { id: STUDIE, alias: 'Wie-Dan-Ook', rol: 'onderzoeker' });
  assert.equal(vreemd.status, 404, 'een rol voor een vreemde wordt geweigerd');

  await moet('mens/weg', { id: STUDIE, alias: tweede.alias }, 'iemand trekt zich terug');
  assert.equal((await api('mens/weg', { id: STUDIE, alias: tweede.alias })).status, 404,
    'en is daarna echt weg');
});

test('3. de werkplaats: taken, documenten, logboek, besluiten en de agenda', async () => {
  const vreemd = await api('werk/taak', { id: STUDIE, tekst: 'Meetronde lopen', voor: 'Wie-Dan-Ook' });
  assert.equal(vreemd.status, 400, 'een taak voor een vreemde wordt geweigerd');
  assert.match(String(vreemd.body.error || ''), /deelnemer|team/i, vreemd.body.error);

  const morgen = new Date(Date.now() + 86400e3).toISOString().slice(0, 10);
  const taak = await moet('werk/taak', { id: STUDIE, tekst: 'Geluidsmeting ronde 1',
    voor: DEEL.alias, deadline: morgen }, 'een taak');
  const tid = taak.taak.id;

  const agenda = await moet('werk/agenda', { id: LAB }, 'de agenda');
  assert.ok(JSON.stringify(agenda).includes('Geluidsmeting ronde 1'),
    'de openstaande taak met deadline staat op de agenda');

  await moet('werk/taak-zet', { id: STUDIE, taakId: tid, af: true }, 'de taak afvinken');
  const na = await moet('werk/agenda', { id: LAB }, 'de agenda daarna');
  assert.equal(JSON.stringify(na).includes('Geluidsmeting ronde 1'), false,
    'een afgevinkte taak staat niet meer op de agenda');

  const d1 = await moet('werk/document', { id: STUDIE, naam: 'Meetprotocol',
    samenvatting: 'Hoe we meten' }, 'een document');
  const d2 = await moet('werk/document', { id: STUDIE, naam: 'Meetprotocol',
    samenvatting: 'Hoe we meten, herzien' }, 'hetzelfde document opnieuw');
  assert.equal(d2.document.versie, d1.document.versie + 1,
    'hetzelfde document wordt een versie en geen tweede rij');
  assert.equal(d2.document.id, d1.document.id, 'en houdt zijn eigen id');

  await moet('werk/log', { id: STUDIE, tekst: 'Eerste meetronde gelopen, twee straten' }, 'een logregel');
  assert.equal((await api('werk/log', { id: STUDIE, tekst: '' })).status, 400,
    'een lege logregel is geen logregel');

  await moet('werk/besluit', { id: STUDIE, tekst: 'We meten drie weken door',
    waarom: 'Te weinig meetmomenten voor een uitspraak' }, 'een besluit');
});

test('4. apparatuur: bevoegdheid gaat voor uitgifte, en een storing haalt hem uit de roulatie', async () => {
  APP = (await moet('app/maak', { labId: LAB, naam: 'Geluidsmeter A', soort: 'sensor',
    plek: 'Kast 3' }, 'een apparaat')).apparaat.id;

  const lijst = await moet('app/lijst', { id: LAB }, 'de apparatuurlijst');
  assert.ok(JSON.stringify(lijst).includes('Geluidsmeter A'), 'het apparaat staat in de lijst');

  const onbevoegd = await api('app/uitgifte', { id: APP, aan: DEEL.alias });
  assert.equal(onbevoegd.status, 403, 'een onbevoegde krijgt het apparaat niet mee');

  const overEenJaar = new Date(Date.now() + 365 * 86400e3).toISOString().slice(0, 10);
  await moet('app/bevoegd', { id: APP, wie: DEEL.alias, tot: overEenJaar }, 'bevoegd maken');
  await moet('app/uitgifte', { id: APP, aan: DEEL.alias }, 'uitgeven');
  assert.equal((await api('app/uitgifte', { id: APP, aan: DEEL.alias })).status, 409,
    'twee keer uitgeven kan niet');
  await moet('app/uitgifte', { id: APP, terug: true }, 'weer innemen');

  const vandaag = new Date().toISOString().slice(0, 10);
  const res1 = await moet('app/reserveer', { id: APP, studieId: STUDIE, van: vandaag,
    tot: new Date(Date.now() + 2 * 86400e3).toISOString().slice(0, 10), door: DEEL.alias }, 'reserveren');
  const rid = res1.reservering.id;

  const storing = await moet('app/onderhoud', { id: APP, wat: 'Kalibratie liep weg na de regen',
    soort: 'storing' }, 'een storing melden');
  assert.equal(storing.apparaat.actief, false, 'een open storing haalt het apparaat uit de roulatie');
  const mid = (storing.apparaat.onderhoud || []).find(x => x.open).id;

  const dicht = await moet('app/storing-op', { id: APP, meldingId: mid,
    hoe: 'Opnieuw geijkt en droog opgeborgen' }, 'de storing sluiten');
  assert.equal(dicht.apparaat.actief, true, 'zonder open storing mag hij weer mee');

  /* Weghalen is geen wissen: de reservering blijft als spoor staan met een
     weg-stempel. Wat telt is dat de PLEK weer vrij is, en dat toetsen we door
     dezelfde dagen opnieuw te reserveren -- eerder botste dat. */
  const nogEens = await api('app/reserveer', { id: APP, studieId: STUDIE, van: vandaag,
    tot: new Date(Date.now() + 2 * 86400e3).toISOString().slice(0, 10), door: DEEL.alias });
  assert.equal(nogEens.status, 409, 'zolang de reservering staat, botst een tweede');
  await moet('app/reservering-weg', { id: APP, reserveringId: rid }, 'de reservering weghalen');
  await moet('app/reserveer', { id: APP, studieId: STUDIE, van: vandaag,
    tot: new Date(Date.now() + 2 * 86400e3).toISOString().slice(0, 10), door: DEEL.alias },
  'daarna is de plek weer vrij');
});

test('5. themas, de pijplijn en de opbrengst van een lab', async () => {
  const t = await moet('themas', { id: LAB }, 'de themas van het lab');
  assert.ok(t && typeof t === 'object', 'de themalijst komt terug');

  const pijp = await moet('uit/pijplijn', { id: LAB }, 'de pijplijn');
  assert.ok(pijp && typeof pijp === 'object', 'de pijplijn komt terug');

  const opbrengst = await moet('opbrengst', { id: LAB }, 'de opbrengst');
  assert.ok(opbrengst && typeof opbrengst === 'object', 'de opbrengst komt terug');

  /* Een vervolgstudie hoort bij het EIND van de cyclus. Deze studie staat nog
     bij het vraagstuk, dus dit hoort een nette weigering te zijn. */
  const v = await api('uit/vervolg', { id: STUDIE, titel: 'Vervolgmeting venstertijden' });
  assert.notEqual(v.status, 200, 'een vervolg midden in de cyclus wordt geweigerd');
  assert.ok(v.body.error, 'en legt uit waarom: ' + v.body.error);
});

test('6. de coach stelt voor en beslist niet', async () => {
  const c = await api('coach/conclusie', { id: STUDIE, vraag: 'Wat zegt dit tot nu toe?' });
  assert.ok([200, 400, 409].includes(c.status),
    'de coach antwoordt of legt uit waarom het nog niet kan: ' + c.status + ' ' + (c.body.error || ''));
  if (c.status === 200) assert.ok(!c.body.definitief, 'een voorstel is geen besluit');
});

test('7. de bewonersdeuren staan met opzet open, en tonen alleen het openbare', async () => {
  assert.equal((await pub('bewoner/kader')).status, 200,
    'het kader is openbaar: een bewoner moet de spelregels kunnen lezen');

  const labs = await pub('bewoner/labs');
  assert.equal(labs.status, 200, 'de labs zijn openbaar');
  const tekst = JSON.stringify(labs.body);
  assert.equal(/budget|tekenaars|partners|bewaarMaanden/.test(tekst), false,
    'maar zonder de bestuurlijke binnenkant: ' + tekst.slice(0, 200));

  assert.equal((await pub('bewoner/overzicht', { labId: LAB })).status, 200,
    'het bewonersoverzicht van een bestaand lab');
  assert.equal((await pub('bewoner/themas', { labId: LAB })).status, 200, 'de themas zijn openbaar');
  assert.equal((await pub('bewoner/overzicht', { labId: 'bestaat-niet' })).status, 404,
    'een lab dat er niet is, is ook voor een bewoner 404');
});

test('8. een bewoner brengt zelf een thema in, stemt en klaagt', async () => {
  const thema = await pub('bewoner/thema', { labId: LAB,
    vraag: 'Kan het sluipverkeer in de Kerkstraat omlaag zonder de wijk af te sluiten?' });
  assert.equal(thema.status, 200, 'een bewoner mag een thema aandragen: ' + (thema.body.error || ''));
  const tid = thema.body.thema.id;

  const stem = await pub('bewoner/stem', { id: tid, alias: 'Buurvrouw' });
  assert.equal(stem.status, 200, 'stemmen kan: ' + (stem.body.error || ''));
  assert.equal((await pub('bewoner/stem', { id: tid, alias: 'Buurvrouw' })).status, 409,
    'twee keer stemmen kan niet');

  await moet('thema/koppel', { themaId: tid, studieId: STUDIE }, 'het thema aan een studie koppelen');

  const klacht = await pub('bewoner/klacht', { id: STUDIE,
    tekst: 'Ik wil niet dat mijn straatnaam in het rapport staat.' });
  assert.equal(klacht.status, 200, 'een klacht kan zonder account: ' + (klacht.body.error || ''));
  KLACHT = klacht.body.klacht.id;
  assert.equal(klacht.body.klacht.status, 'open', 'en staat open tot iemand hem afhandelt');
});

test('9. alleen de toezichthouder legt stil, en een klacht wordt met een antwoord afgedaan', async () => {
  const vreemd = await api('ethiek/stilleggen', { id: STUDIE, door: 'Iemand Anders',
    reden: 'Ik vind er iets van en wil het stoppen.' });
  assert.equal(vreemd.status, 403, 'wie geen toezichthouder is, legt niets stil');

  await moet('ethiek/stilleggen', { id: STUDIE, door: TOEZICHT,
    reden: 'Een bewoner meldt dat er zonder toestemming is gemeten.' }, 'stilleggen');
  const dicht = await api('mens/bij', { id: STUDIE, rol: 'onderzoeker' });
  assert.equal(dicht.status, 409, 'een stilgelegd onderzoek neemt geen deelnemers meer aan');

  const leeg = await api('ethiek/klacht-af', { id: STUDIE, klachtId: KLACHT, door: TOEZICHT, antwoord: '' });
  assert.equal(leeg.status, 400, 'een klacht zonder antwoord afsluiten is hem wegklikken');
  const vreemdeHand = await api('ethiek/klacht-af', { id: STUDIE, klachtId: KLACHT,
    door: 'Iemand Anders', antwoord: 'Het is geregeld, geloof mij maar.' });
  assert.equal(vreemdeHand.status, 403, 'een klacht wordt door een tekenbevoegde afgehandeld');

  await moet('ethiek/klacht-af', { id: STUDIE, klachtId: KLACHT, door: TOEZICHT,
    antwoord: 'De straatnaam is uit het rapport gehaald en het protocol is aangepast.' },
  'de klacht afdoen');
  await moet('ethiek/stilleggen', { id: STUDIE, door: TOEZICHT, hervat: true,
    reden: 'De klacht is afgehandeld en het protocol is aangepast.' }, 'hervatten');
});

test('10. het vraagstuk en "wat nu" horen bij de studie zelf', async () => {
  await moet('studie/vraagstuk', { id: STUDIE,
    vraagstuk: 'Helpt een stillere straat de nachtrust, gemeten over drie weken?' },
  'het vraagstuk aanscherpen');

  const nu = await moet('studie/watnu', { id: STUDIE }, 'wat nu');
  assert.ok(nu && typeof nu === 'object', 'de volgende stap komt terug');
  assert.equal((await api('studie/watnu', { id: 'bestaat-niet' })).status, 404,
    'een onderzoek dat er niet is, is 404');
});

test('11. een labpaspoort leest, en een reflectie vraagt een pas die we kennen', async () => {
  const maak = await pub('bewoner/paspoort-maak', { labId: LAB, naam: 'Sam Routetoets' });
  assert.equal(maak.status, 200, 'een labpaspoort maken: ' + (maak.body.error || ''));
  const code = maak.body.paspoort.code;

  const lezen = await pub('bewoner/paspoort', { code });
  assert.equal(lezen.status, 200, 'het paspoort is met die code te lezen');
  assert.equal((await pub('bewoner/paspoort', { code: 'LABPASBESTAATNIET' })).status, 404,
    'een code die niet bestaat, is 404');

  /* Een LABPASPOORT is geen deelnemerspas: reflecteren doe je vanuit een
     onderzoek waar je op staat. Dat onderscheid is het punt van deze deur. */
  const metPaspoort = await pub('mijn/reflectie', { code, soort: 'onverwacht',
    tekst: 'Ik merk sinds de meting zelf ook meer verkeer.' });
  assert.equal(metPaspoort.status, 404, 'een labpaspoort is geen deelnemerspas');

  const echt = await pub('mijn/reflectie', { code: DEEL.pas, soort: 'onverwacht',
    tekst: 'Het was in de avond veel drukker dan we hadden aangenomen.' });
  assert.equal(echt.status, 200, 'met de deelnemerspas kan het wel: ' + (echt.body.error || ''));
});

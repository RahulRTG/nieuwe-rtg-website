/* De achttien schoolroutes die na de enterprise-ronde nooit door een toets
   werden aangeraakt.

   WAAROM DIT BESTAND ER IS. `scripts/dekking.js` vraagt niet aan de tekst van
   de tests welke routes gedekt zijn maar aan het routejournaal van de server:
   wat er tijdens de suite echt is aangeroepen. Die meter stond op nul
   nooit-aangeraakte endpoints en liep na de enterprise-ronde op naar 27 -- de
   prijs van een laag die sneller groeide dan zijn toetsen. Dit bestand haalt er
   achttien van weg; de andere negen staan in schoolkoppel.test.js en de
   horeca-toetsen.

   Ze zijn NIET geschreven als aanraking maar als bewering. Een toets die een
   route alleen aanroept om een teller te plezieren, is precies wat LAT-regel 9
   verbiedt (een toets die niet kan zakken is erger dan geen toets). Elke
   bewering hieronder gaat over een belofte die dit huis doet:

   - een herinnering gaat HOOGUIT EEN KEER PER DAG per onderwerp, en geld- en
     verlofherinneringen komen nooit in een klasmededeling terecht;
   - over een ziekmelding wordt niet BESLOTEN;
   - uren vult iemand voor zichzelf in, niet een ander voor hem;
   - een vestiging krijgt een accentkleur binnen de merkregels, geen eigen
     vormtaal;
   - het zorgdeel gaat pas open voor een externe na een EXPLICIETE deelactie.

   Draai los: node --experimental-sqlite --test test/schoolrest.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schoolrest-'));
const api = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const office = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const vandaag = () => new Date().toISOString().slice(0, 10);
let D, leraar, klas, gezin, kindId, kindToken, sleutel, leerling;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const sch = (await api('/school/school/maak', { naam: 'De Wissel', plaats: 'Zwolle' })).body;
  const kantoor = (await office('/office/login', { code: 'RTG-OFFICE' })).body.token;
  await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, kantoor);
  D = { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken };

  leraar = (await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Juf Wieke', rol: 'leraar' })).body;
  await api('/school/personeel/besluit', Object.assign({ personeelId: leraar.personeelId, akkoord: true }, D));
  klas = (await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken, naam: '5A' })).body;

  gezin = (await api('/gezin/maak', { gezinsnaam: 'Fam Wissel', naam: 'Ouder Wissel', pin: '1234' })).body;
  const kind = (await api('/gezin/profiel/maak', { code: gezin.code, token: gezin.token, naam: 'Kind Wissel', rol: 'kind', groep: 'kind' })).body;
  kindId = kind.profiel.id;
  kindToken = (await api('/gezin/profiel/kies', { code: gezin.code, profielId: kindId })).body.token;
  await api('/school/koppel', { code: gezin.code, token: gezin.token, klasCode: klas.code, profielId: kindId });
  await api('/school/uitnodiging/antwoord', { code: gezin.code, token: kindToken, klasCode: klas.code, akkoord: true });
  sleutel = gezin.code + ':' + kindId;

  leerling = (await api('/school/leerling/aanmeld', Object.assign({ naam: 'Kind Wissel', gezinCode: gezin.code, profielId: kindId }, D))).body.leerling;
  await api('/school/leerling/besluit', Object.assign({ leerlingId: leerling.id, besluit: 'plaatsen', klasCode: klas.code }, D));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('vestigingen: een accentkleur blijft binnen de merkregels, en een klas hangt alleen aan een bestaande vestiging', async () => {
  const scheef = await api('/school/vestiging/zet', Object.assign({ id: 'NOORD', naam: 'Locatie Noord', accent: 'donkerrood' }, D));
  assert.equal(scheef.status, 400, 'een kleurnaam is geen accentkleur');
  assert.match(scheef.body.error, /hexwaarde/);

  const v = (await api('/school/vestiging/zet', Object.assign({ id: 'NOORD', naam: 'Locatie Noord',
    plaats: 'Zwolle', accent: '#7F1634', lestijden: '08:30-15:00' }, D))).body;
  assert.equal(v.vestiging.id, 'NOORD');
  assert.equal(v.vestiging.accent, '#7F1634');

  const onbekend = await api('/school/klas/vestiging', Object.assign({ klasCode: klas.code, vestiging: 'ZUID' }, D));
  assert.equal(onbekend.status, 404, 'een klas kan niet aan een vestiging die niet bestaat');

  const goed = (await api('/school/klas/vestiging', Object.assign({ klasCode: klas.code, vestiging: 'NOORD' }, D))).body;
  assert.equal(goed.vestiging, 'NOORD');
});

test('dossier: contactgegevens met verzorgers, en een document is een registratie en geen bestandskluis', async () => {
  const c = (await api('/school/dossier/contact', Object.assign({ leerlingId: leerling.id, contact: {
    adres: 'Dijkstraat 4', postcode: '8011AA', plaats: 'Zwolle', telefoon: '0384000000',
    verzorgers: [{ naam: 'Ouder Wissel', relatie: 'moeder', telefoon: '0612345678', noodnummer: true },
      { relatie: 'buurman' }] } }, D))).body;
  assert.equal(c.contact.verzorgers.length, 1, 'een verzorger zonder naam is geen verzorger');
  assert.equal(c.contact.verzorgers[0].noodnummer, true);

  const raar = await api('/school/document/voeg', Object.assign({ leerlingId: leerling.id, soort: 'paspoort', titel: 'Scan' }, D));
  assert.equal(raar.status, 400, 'de soorten liggen vast');

  const leeg = await api('/school/document/voeg', Object.assign({ leerlingId: leerling.id, soort: 'diploma' }, D));
  assert.equal(leeg.status, 400, 'een document zonder titel zegt niets');

  const d = (await api('/school/document/voeg', Object.assign({ leerlingId: leerling.id, soort: 'diploma',
    titel: 'Diploma zwemmen A', nummer: 'ZW-2026-114', instelling: 'Zwembad De Vijver' }, D))).body;
  assert.equal(d.document.soort, 'diploma');
  assert.equal(d.document.titel, 'Diploma zwemmen A');
  const plat = JSON.stringify(d);
  assert.ok(plat.indexOf('base64') < 0 && plat.indexOf('bestand') < 0, 'er wordt geen bestand opgeslagen, alleen wat er is afgegeven');
});

test('zorg: een sessie is kort en feitelijk, en een externe ziet pas iets na een expliciete deelactie', async () => {
  const zonder = await api('/school/zorg/sessie', Object.assign({ leerlingId: leerling.id }, D));
  assert.equal(zonder.status, 400, 'zonder te noteren wat er is gedaan, is het geen sessie');

  const s = (await api('/school/zorg/sessie', Object.assign({ leerlingId: leerling.id,
    wat: 'Extra instructie breuken, een op een.', vak: 'rekenen', minuten: 999, vervolg: 'Volgende week herhalen.' }, D))).body;
  assert.equal(s.sessies[0].minuten, 240, 'de duur wordt geklemd; een sessie van 999 minuten bestaat niet');
  assert.equal(s.sessies[0].vak, 'rekenen');

  const extern = (await api('/school/personeel/aanmeld', { schoolCode: D.schoolCode, naam: 'Ambulant begeleider Ria', rol: 'extern' })).body;
  await api('/school/personeel/besluit', Object.assign({ personeelId: extern.personeelId, akkoord: true }, D));

  const onbekend = await api('/school/zorg/deel', Object.assign({ leerlingId: leerling.id, personeelId: 'bestaat-niet' }, D));
  assert.equal(onbekend.status, 404);

  const aan = (await api('/school/zorg/deel', Object.assign({ leerlingId: leerling.id, personeelId: extern.personeelId }, D))).body;
  assert.deepEqual(aan.gedeeldMet, [extern.personeelId]);

  const uit = (await api('/school/zorg/deel', Object.assign({ leerlingId: leerling.id, personeelId: extern.personeelId, aan: false }, D))).body;
  assert.deepEqual(uit.gedeeldMet, [], 'delen is terug te draaien');
});

test('verzuimbeeld: dezelfde cijfers voor de mentor als voor het gezin, uit dezelfde bron', async () => {
  const zet = (datum, uur, stand) => api('/school/aanwezigheid/zet', { schoolCode: D.schoolCode,
    personeelToken: leraar.personeelToken, klasCode: klas.code, datum, uur, vak: 'rekenen',
    regels: [{ leerling: sleutel, stand }] });
  await zet('2026-03-02', 1, 'aanwezig');
  await zet('2026-03-03', 1, 'ziek');
  await zet('2026-03-04', 1, 'telaat');

  const beeld = (await api('/school/aanwezigheid/leerling', Object.assign({ leerlingId: leerling.id }, D))).body;
  assert.equal(beeld.lessen, 3);
  assert.equal(beeld.telling.ziek, 1);
  assert.equal(beeld.telling.telaat, 1);
  assert.equal(beeld.telling.aanwezig, 1);
  assert.equal(beeld.sleutel, sleutel);

  const zonder = await api('/school/aanwezigheid/leerling', Object.assign({}, D));
  assert.equal(zonder.status, 404, 'zonder leerling is er geen verzuimbeeld');
});

test('verlof en HR: de lijst telt de openstaande aanvragen, en over een ziekmelding wordt niet besloten', async () => {
  const aanvraag = (await api('/school/verlof/aanvraag', { code: gezin.code, token: gezin.token, klasCode: klas.code,
    profielId: kindId, van: '2026-06-01', tot: '2026-06-02', reden: 'Bruiloft van een tante' })).body;
  assert.ok(aanvraag.verlof.id);

  const lijst = (await api('/school/verlof/lijst', D)).body;
  assert.equal(lijst.open, 1);
  assert.ok(lijst.aanvragen.some(v => v.id === aanvraag.verlof.id));

  const gefilterd = (await api('/school/verlof/lijst', Object.assign({ status: 'toegekend' }, D))).body;
  assert.equal(gefilterd.aanvragen.length, 0, 'er is nog niets toegekend');

  // personeel: een ziekmelding is geen aanvraag waarover iemand beslist
  const ziek = (await api('/school/hr/afwezig', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken,
    soort: 'ziek' })).body;
  const overZiek = await api('/school/hr/verlof/besluit', Object.assign({ personeelId: leraar.personeelId,
    verlofId: ziek.verlof.id, besluit: 'toegekend' }, D));
  assert.equal(overZiek.status, 400);
  assert.match(overZiek.body.error, /ziekmelding/);

  const vrij = (await api('/school/hr/afwezig', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken,
    soort: 'verlof', van: '2026-07-01', tot: '2026-07-03', toelichting: 'Verhuizing' })).body;
  const raar = await api('/school/hr/verlof/besluit', Object.assign({ personeelId: leraar.personeelId,
    verlofId: vrij.verlof.id, besluit: 'misschien' }, D));
  assert.equal(raar.status, 400, 'toegekend of afgewezen, meer smaken zijn er niet');

  const besluit = (await api('/school/hr/verlof/besluit', Object.assign({ personeelId: leraar.personeelId,
    verlofId: vrij.verlof.id, besluit: 'toegekend', reden: 'Past in het rooster' }, D))).body;
  assert.equal(besluit.verlof.status, 'toegekend');
  assert.match(besluit.verlof.besluitDoor, /directie/i);
});

test('urenregistratie: iemand vult zijn eigen uren in, en de maand telt op', async () => {
  const uren = (pad) => api('/school/hr/uren', Object.assign({ schoolCode: D.schoolCode,
    personeelToken: leraar.personeelToken }, pad));

  const leeg = await uren({ uren: 0, datum: '2026-04-01' });
  assert.equal(leeg.status, 400, 'nul uren is geen registratie');

  await uren({ uren: 6, datum: '2026-04-01', wat: 'lesgeven' });
  await uren({ uren: 2.5, datum: '2026-04-02', wat: 'oudergesprekken' });
  await uren({ uren: 8, datum: '2026-05-01', wat: 'lesgeven' });

  const april = (await uren({ maand: '2026-04' })).body;
  assert.equal(april.totaal, 8.5, 'april telt 6 + 2,5 en niet de acht uur van mei');
  assert.equal(april.regels.length, 2);

  // zonder eigen personeelstoken komt er niemand bij de urenstaat
  const vreemd = await api('/school/hr/uren', Object.assign({ uren: 40, datum: '2026-04-03' }, D));
  assert.ok(vreemd.status >= 400, 'de directie vult geen uren in voor een ander: ' + JSON.stringify(vreemd.body).slice(0, 120));
});

test('incidenten: afhandelen vraagt om wat er is gedaan', async () => {
  const i = (await api('/school/incident/meld', Object.assign({ wat: 'Fietsenstalling opengebroken.', ernst: 'licht' }, D))).body;
  const inc = i.incident || i;
  const zonder = await api('/school/incident/handel-af', Object.assign({ incidentId: inc.id }, D));
  assert.equal(zonder.status, 400, 'afvinken zonder afhandeling bestaat niet');

  const weg = await api('/school/incident/handel-af', Object.assign({ incidentId: 'bestaat-niet', afhandeling: 'x' }, D));
  assert.equal(weg.status, 404);

  const af = (await api('/school/incident/handel-af', Object.assign({ incidentId: inc.id,
    afhandeling: 'Slot vervangen, melding bij de wijkagent.' }, D))).body;
  assert.equal(af.incident.afgehandeld, true);
});

test('nieuwsbrief en vakgroep: de brief landt in de klas, het vakgroepdraadje niet', async () => {
  const leeg = await api('/school/nieuwsbrief', Object.assign({ titel: 'Zonder tekst' }, D));
  assert.equal(leeg.status, 400);

  const brief = (await api('/school/nieuwsbrief', Object.assign({ titel: 'Schoolreis',
    tekst: 'Op 12 juni gaan we naar het openluchtmuseum.' }, D))).body;
  assert.equal(brief.nieuwsbrief.klassen, 1);

  const lijst = (await api('/school/nieuwsbrief/lijst', D)).body;
  assert.ok(lijst.nieuwsbrieven.some(b => b.titel === 'Schoolreis'));

  // het gezin ziet hem als mededeling in de klas
  const meds = JSON.stringify((await api('/school/mijn', { code: gezin.code, token: gezin.token })).body);
  assert.ok(meds.indexOf('openluchtmuseum') >= 0, 'de nieuwsbrief staat bij het gezin in de klas');

  // het vakgroepdraadje is voor het personeel onderling
  const zonderVak = await api('/school/vakgroep', Object.assign({ tekst: 'hoi' }, D));
  assert.equal(zonderVak.status, 400);

  const vg = (await api('/school/vakgroep', Object.assign({ vak: 'rekenen',
    tekst: 'Wie heeft er nog materiaal voor breuken?' }, D))).body;
  assert.equal(vg.berichten[0].tekst, 'Wie heeft er nog materiaal voor breuken?');
  assert.deepEqual(vg.vakken, ['rekenen']);

  const naVak = (await api('/school/mijn', { code: gezin.code, token: gezin.token })).body;
  assert.ok(JSON.stringify(naVak).indexOf('materiaal voor breuken') < 0,
    'wat het personeel onderling bespreekt, komt niet in de lijn met de ouders');
});

test('herinneringen: hooguit een keer per dag per onderwerp, en geld gaat nooit naar de klas', async () => {
  await api('/school/huiswerk/maak', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken,
    klasCode: klas.code, titel: 'Breuken oefenen', vak: 'rekenen', deadline: vandaag() });
  const f = (await api('/school/factuur/maak', Object.assign({ leerlingId: leerling.id, soort: 'schoolgeld',
    bedrag: 40, omschrijving: 'Schoolgeld', vervalt: '2020-01-01' }, D))).body;
  assert.ok(f.factuur.nummer);

  const beeld = (await api('/school/herinneringen', D)).body;
  const soorten = beeld.herinneringen.map(r => r.soort);
  assert.ok(soorten.includes('huiswerk'), 'het huiswerk van vandaag levert een herinnering');
  assert.ok(soorten.includes('factuur'), 'een vervallen factuur ook');
  assert.ok(beeld.herinneringen.every(r => r.alGestuurdVandaag === false));

  const eerste = (await api('/school/herinnering/verstuur', D)).body;
  assert.ok(eerste.verstuurd >= 2);
  assert.ok(eerste.intern.some(t => /Factuur/.test(t)), 'de factuurherinnering gaat naar de administratie');

  const tweede = (await api('/school/herinnering/verstuur', D)).body;
  assert.equal(tweede.verstuurd, 0, 'de tweede ronde stuurt niets');
  assert.ok(tweede.overgeslagen >= 2, 'hooguit een keer per dag per onderwerp');

  const klasbeeld = JSON.stringify((await api('/school/mijn', { code: gezin.code, token: gezin.token })).body);
  assert.ok(klasbeeld.indexOf('Breuken oefenen') >= 0, 'de huiswerkherinnering staat wel in de klas');
  assert.ok(klasbeeld.indexOf(f.factuur.nummer) < 0,
    'het factuurnummer van een gezin komt nooit in een klasmededeling');
});

test('rapport en peiling: een concept is geen rapport, en een gesloten peiling neemt geen antwoorden meer aan', async () => {
  const rap = (await api('/school/rapport/maak', Object.assign({ klasCode: klas.code, periode: 'Periode 2' }, D))).body;
  const lijst = (await api('/school/rapport/lijst', D)).body;
  const rij = lijst.rapporten.find(r => r.id === rap.rapport.id);
  assert.ok(rij, 'het rapport staat in de lijst');
  assert.equal(rij.vastgesteld, false, 'en het is een concept tot de school het vaststelt');

  const een = (await api('/school/rapport/lijst', Object.assign({ rapportId: rap.rapport.id }, D))).body;
  assert.equal(een.rapport.periode, 'Periode 2');
  const weg = await api('/school/rapport/lijst', Object.assign({ rapportId: 'bestaat-niet' }, D));
  assert.equal(weg.status, 404);

  const p = (await api('/school/peiling/maak', Object.assign({ titel: 'Hoe gaat het op school?',
    stellingen: ['Mijn kind gaat met plezier naar school'], doelgroep: 'ouders' }, D))).body;
  const dicht = (await api('/school/peiling/sluit', Object.assign({ peilingId: p.peiling.id }, D))).body;
  assert.equal(dicht.peiling.open, false);
  assert.equal(dicht.uitslag.genoeg, false, 'onder het minimum komt er geen uitslag');

  const weer = await api('/school/peiling/sluit', Object.assign({ peilingId: 'bestaat-niet' }, D));
  assert.equal(weer.status, 404);
});

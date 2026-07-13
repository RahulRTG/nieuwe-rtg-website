/* Integratietests voor RTF School (het schoolkanaal, "slimmer dan Magister"):
   klas maken en koppelen, rooster, huiswerk (afvinken), cijfers (afgeschermd per
   gezin), mededelingen, ziekmelden in één tik en de gezinsbrede berichtendraad
   met de leraar. Draait tegen een echte server in een tijdelijke datamap.
   Draai los: node --experimental-sqlite --test test/school.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-school-'));
let child;

function api(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
// losse helper voor de RTG-backoffice (buiten /api/foundation): schoolgoedkeuring.
// officeAuth verwacht de sessietoken als Bearer-header, niet in de body.
function office(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + '/api' + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

// log in bij de backoffice met de demo-code en keur een schoolaanmelding goed
async function keurSchoolGoed(schoolCode) {
  const login = await json(await office('/office/login', { code: 'RTG-OFFICE' }));
  const d = await json(await office('/office/school/decide', { code: schoolCode, action: 'goedkeuren' }, login.token));
  assert.ok(d.ok && d.status === 'actief', 'RTG keurt de school goed');
  return login.token;
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* hulp: de volledige keten school -> leraar (goedgekeurd) -> klas -> gezin met
   gekoppeld kind. Dit is de verplichte volgorde: eerst de school, dan het
   personeel, dan pas de kinderen. */
async function opzet(naam) {
  const sch = await json(await api('/school/school/maak', { naam: 'De Regenboog ' + naam, plaats: 'Utrecht' }));
  await keurSchoolGoed(sch.schoolCode); // RTG activeert de school eerst
  const p = await json(await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Juf ' + naam, rol: 'leraar' }));
  await api('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: p.personeelId, akkoord: true });
  const kl = await json(await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Groep 8' }));
  // het personeel-token van de leraar opent zijn klas (klasVan accepteert het)
  const klas = { code: kl.code, leraarToken: p.personeelToken };
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Fam ' + naam, naam: 'Ouder ' + naam, pin: '1234' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kind ' + naam, rol: 'kind', groep: 'kind' }));
  const kindToken = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  const kop = await json(await api('/school/koppel', { code: g.code, token: g.token, klasCode: klas.code, profielId: kind.profiel.id }));
  assert.ok(kop.ok, 'koppelen lukt');
  return { sch, klas, g, kindId: kind.profiel.id, kindToken, sleutel: g.code + ':' + kind.profiel.id };
}
const lr = (klas, pad, body) => api(pad, Object.assign({ klasCode: klas.code, leraarToken: klas.leraarToken }, body || {}));

test('klas maken, koppelen en het mijn-school-overzicht', async () => {
  const { klas, g, kindId, kindToken } = await opzet('Aa');
  // verkeerde token komt er niet in
  assert.equal((await api('/school/klas', { klasCode: klas.code, leraarToken: 'fout' })).status, 403);
  // een kind kan niet zelf (zichzelf of een ander) aan een klas koppelen
  assert.equal((await api('/school/koppel', { code: g.code, token: kindToken, klasCode: klas.code, profielId: kindId })).status, 403);
  // de leraar ziet de leerling
  const kd = await json(await lr(klas, '/school/klas'));
  assert.equal(kd.leerlingen.length, 1);
  // het gezin ziet de klas in het overzicht
  const mijn = await json(await api('/school/mijn', { code: g.code, token: g.token }));
  assert.equal(mijn.school.length, 1);
  assert.equal(mijn.school[0].klas.code, klas.code);
  assert.equal(mijn.school[0].kind.profielId, kindId);
});

test('rooster, huiswerk opgeven en afvinken, en de AI-brugvelden', async () => {
  const { klas, g, kindId, kindToken } = await opzet('Bb');
  await lr(klas, '/school/rooster/zet', { rooster: [
    { dag: 'ma', van: '08:30', tot: '09:15', vak: 'Rekenen', lokaal: 'lokaal 3' },
    { dag: 'zz', van: 'x', tot: 'y', vak: 'Onzin' } // ongeldige dag wordt genegeerd
  ]});
  const hw = await json(await lr(klas, '/school/huiswerk/maak', { titel: 'H4 lezen', vak: 'Taal', deadline: '2026-09-01', omschrijving: 'Blz 40 tot 45' }));
  assert.ok(hw.ok);

  const mijn = await json(await api('/school/mijn', { code: g.code, token: kindToken }));
  const x = mijn.school[0];
  assert.equal(x.rooster.length, 1, 'alleen de geldige roosterregel blijft');
  assert.equal(x.huiswerk.length, 1);
  assert.equal(x.huiswerk[0].af, false);

  // het kind vinkt het huiswerk af; de leraar ziet dat
  await api('/school/huiswerk/af', { code: g.code, token: kindToken, klasCode: klas.code, huiswerkId: x.huiswerk[0].id });
  const kd = await json(await lr(klas, '/school/klas'));
  assert.equal(kd.huiswerk[0].afDoor.length, 1, 'de leraar ziet wie het af heeft');
  const na = await json(await api('/school/mijn', { code: g.code, token: kindToken }));
  assert.equal(na.school[0].huiswerk[0].af, true);
});

test('cijfers: het gezin ziet alleen de cijfers van het eigen kind', async () => {
  const A = await opzet('Cc');
  // een tweede gezin in dezelfde klas
  const g2 = await json(await api('/gezin/maak', { gezinsnaam: 'Fam Cc2', naam: 'Ouder Cc2', pin: '5678' }));
  const kind2 = await json(await api('/gezin/profiel/maak', { code: g2.code, token: g2.token, naam: 'Kind Cc2', rol: 'kind', groep: 'kind' }));
  await api('/school/koppel', { code: g2.code, token: g2.token, klasCode: A.klas.code, profielId: kind2.profiel.id });

  await lr(A.klas, '/school/cijfer/geef', { leerling: A.sleutel, vak: 'Rekenen', cijfer: 8.5, omschrijving: 'Toets H4' });
  await lr(A.klas, '/school/cijfer/geef', { leerling: g2.code + ':' + kind2.profiel.id, vak: 'Rekenen', cijfer: 6, omschrijving: 'Toets H4' });
  // ongeldig cijfer wordt geweigerd
  assert.equal((await lr(A.klas, '/school/cijfer/geef', { leerling: A.sleutel, vak: 'X', cijfer: 12 })).status, 400);

  const mijnA = await json(await api('/school/mijn', { code: A.g.code, token: A.g.token }));
  assert.equal(mijnA.school[0].cijfers.length, 1, 'gezin A ziet precies een cijfer');
  assert.equal(mijnA.school[0].cijfers[0].cijfer, 8.5);
  const mijnB = await json(await api('/school/mijn', { code: g2.code, token: g2.token }));
  assert.equal(mijnB.school[0].cijfers.length, 1, 'gezin B ziet alleen zijn eigen cijfer');
  assert.equal(mijnB.school[0].cijfers[0].cijfer, 6);
});

test('ziekmelden in één tik: alleen een ouder, geen dubbele melding, leraar handelt af', async () => {
  const { klas, g, kindId, kindToken } = await opzet('Dd');
  // het kind zelf mag niet ziekmelden
  assert.equal((await api('/school/ziekmelden', { code: g.code, token: kindToken, klasCode: klas.code, profielId: kindId })).status, 403);
  // de ouder wel
  assert.equal((await api('/school/ziekmelden', { code: g.code, token: g.token, klasCode: klas.code, profielId: kindId, reden: 'koorts' })).status, 200);
  // niet twee keer op dezelfde dag
  assert.equal((await api('/school/ziekmelden', { code: g.code, token: g.token, klasCode: klas.code, profielId: kindId })).status, 409);
  // de leraar ziet hem en handelt af
  const kd = await json(await lr(klas, '/school/klas'));
  assert.equal(kd.absenties.length, 1);
  assert.match(kd.absenties[0].reden, /koorts/);
  await lr(klas, '/school/absentie/afhandelen', { id: kd.absenties[0].id });
  const kd2 = await json(await lr(klas, '/school/klas'));
  assert.equal(kd2.absenties.length, 0, 'na afhandelen is de melding weg uit de open lijst');
});

test('berichten: gezinsbrede draad met de leraar; ouder leest mee met wat het kind schrijft', async () => {
  const { klas, g, kindId, kindToken } = await opzet('Ee');
  // het kind schrijft de leraar
  await api('/school/bericht/gezin', { code: g.code, token: kindToken, klasCode: klas.code, tekst: 'Ik snap som 4 niet' });
  // de leraar ziet de draad en antwoordt
  const kd = await json(await lr(klas, '/school/klas'));
  assert.equal(kd.berichten.length, 1);
  const sleutel = kd.berichten[0].sleutel;
  await lr(klas, '/school/bericht/leraar', { leerling: sleutel, tekst: 'Kom morgen even langs, dan leg ik het uit.' });
  // de OUDER leest dezelfde draad (geen privekanaal leraar-kind)
  const draad = await json(await api('/school/bericht/gezin', { code: g.code, token: g.token, klasCode: klas.code, profielId: kindId }));
  assert.equal(draad.berichten.length, 2, 'de ouder ziet het bericht van het kind EN het antwoord van de leraar');
  assert.ok(draad.berichten.some(b => /som 4/.test(b.tekst)));
  assert.ok(draad.berichten.some(b => b.van === 'leraar'));
});

test('mededeling van de leraar bereikt het gezin', async () => {
  const { klas, g } = await opzet('Ff');
  await lr(klas, '/school/mededeling', { tekst: 'Vrijdag ouderavond om 19:00.' });
  const mijn = await json(await api('/school/mijn', { code: g.code, token: g.token }));
  assert.ok(mijn.school[0].mededelingen.some(m => /ouderavond/.test(m.tekst)));
});

test('RTG keurt de school goed: zonder goedkeuring geen personeel toelaten of klassen maken', async () => {
  const sch = await json(await api('/school/school/maak', { naam: 'De Wachtkamer', plaats: 'Almere' }));
  assert.equal(sch.status, 'wacht', 'een nieuwe school staat op wacht');
  const p = await json(await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Juf Nog', rol: 'leraar' }));
  // zolang RTG de school niet activeert: directie kan personeel niet toelaten, en er komen geen klassen
  assert.equal((await api('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: p.personeelId, akkoord: true })).status, 403);
  assert.equal((await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Groep 5' })).status, 403);
  // de school verschijnt in het backoffice-actiecentrum en in de wachtlijst
  const login = await json(await office('/office/login', { code: 'RTG-OFFICE' }));
  assert.ok(login.state.alerts.some(a => a.kind === 'school'), 'de wachtende school staat in het actiecentrum');
  assert.ok((login.state.pendingSchools || []).some(s => s.code === sch.schoolCode));
  const lijst = await json(await office('/office/schools', {}, login.token));
  assert.ok(lijst.schools.some(s => s.code === sch.schoolCode && s.status === 'wacht'));
  // een niet-ingelogde beoordeling wordt geweigerd
  assert.equal((await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' })).status, 401);
  // RTG keurt goed
  await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, login.token);
  // dubbele beoordeling kan niet meer
  assert.equal((await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, login.token)).status, 409);
  // NU kan de directie het personeel toelaten en de leraar een klas maken
  assert.equal((await api('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: p.personeelId, akkoord: true })).status, 200);
  const kl = await json(await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Groep 5' }));
  assert.ok(kl.ok && kl.code);
});

test('school eerst: personeel wacht op goedkeuring; pas daarna klassen maken', async () => {
  const sch = await json(await api('/school/school/maak', { naam: 'Het Kompas', plaats: 'Rotterdam' }));
  assert.ok(sch.schoolCode && sch.beheerToken);
  await keurSchoolGoed(sch.schoolCode); // RTG activeert de school; dan pas telt de personeelsgoedkeuring
  // een leraar meldt zich aan: status wacht
  const p = await json(await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Meester Bram', rol: 'leraar' }));
  assert.equal(p.status, 'wacht');
  // VOOR goedkeuring: geen klas kunnen maken en geen overzicht
  assert.equal((await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Groep 7' })).status, 403);
  assert.equal((await api('/school/leraar/overzicht', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken })).status, 403);
  // de directie ziet de aanmelding en keurt goed
  const ov0 = await json(await api('/school/school/overzicht', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken }));
  assert.equal(ov0.personeel.length, 1);
  assert.equal(ov0.personeel[0].status, 'wacht');
  await api('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: p.personeelId, akkoord: true });
  // NA goedkeuring: twee klassen onder een personeel-token, met overzicht
  const k1 = await json(await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Groep 7' }));
  const k2 = await json(await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Groep 8' }));
  assert.equal((await api('/school/klas', { klasCode: k1.code, leraarToken: p.personeelToken })).status, 200);
  assert.equal((await api('/school/klas', { klasCode: k2.code, leraarToken: p.personeelToken })).status, 200);
  assert.equal((await api('/school/klas', { klasCode: k1.code, leraarToken: 'fout' })).status, 403);
  const ov = await json(await api('/school/leraar/overzicht', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken }));
  assert.equal(ov.klassen.length, 2);
  // de DIRECTIE kan met het beheer-token bij elke klas van de school
  assert.equal((await api('/school/klas', { klasCode: k1.code, beheerToken: sch.beheerToken })).status, 200);
});

test('personeel: afwijzen verwijdert de aanmelding; ondersteuning maakt geen klassen; leraar van school A niet bij school B', async () => {
  const sch = await json(await api('/school/school/maak', { naam: 'De Klimop', plaats: 'Den Haag' }));
  await keurSchoolGoed(sch.schoolCode);
  // afgewezen personeelslid is weg
  const afw = await json(await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Onbekende', rol: 'leraar' }));
  await api('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: afw.personeelId, akkoord: false });
  assert.equal((await api('/school/personeel/status', { schoolCode: sch.schoolCode, personeelToken: afw.personeelToken })).status, 403);
  // ondersteuning wordt goedgekeurd maar maakt geen klassen
  const ond = await json(await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Conciërge Piet', rol: 'ondersteuning' }));
  await api('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: ond.personeelId, akkoord: true });
  assert.equal((await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: ond.personeelToken, naam: 'X' })).status, 403);
  // een leraar van een ANDERE school komt niet in de klassen van deze school
  const B = await opzet('Grens2');
  assert.equal((await api('/school/klas', { klasCode: B.klas.code, beheerToken: sch.beheerToken })).status, 403, 'beheer-token van school A opent geen klas van school B');
});

test('privekanaal ouders <-> leraar: het kind kan er niet bij, de gezinsdraad wel', async () => {
  const { klas, g, kindId, kindToken } = await opzet('Gg');
  // de ouder schrijft prive; de leraar antwoordt prive
  await api('/school/bericht/gezin', { code: g.code, token: g.token, klasCode: klas.code, profielId: kindId, kanaal: 'ouders', tekst: 'Ik maak me zorgen om de thuissituatie.' });
  const kd = await json(await lr(klas, '/school/klas'));
  const sleutel = g.code + ':' + kindId;
  await lr(klas, '/school/bericht/leraar', { leerling: sleutel, kanaal: 'ouders', tekst: 'Laten we bellen. Dit blijft tussen ons.' });
  // het KIND wordt geweigerd op het privekanaal (lezen en schrijven)
  assert.equal((await api('/school/bericht/gezin', { code: g.code, token: kindToken, klasCode: klas.code, kanaal: 'ouders' })).status, 403);
  assert.equal((await api('/school/bericht/gezin', { code: g.code, token: kindToken, klasCode: klas.code, kanaal: 'ouders', tekst: 'mag ik meelezen?' })).status, 403);
  // de ouder ziet de prive-draad wel volledig
  const prive = await json(await api('/school/bericht/gezin', { code: g.code, token: g.token, klasCode: klas.code, profielId: kindId, kanaal: 'ouders' }));
  assert.equal(prive.berichten.length, 2);
  // en de gezinsdraad blijft gescheiden en voor het kind toegankelijk
  const gezinsDraad = await json(await api('/school/bericht/gezin', { code: g.code, token: kindToken, klasCode: klas.code }));
  assert.equal(gezinsDraad.berichten.length, 0, 'de prive-berichten lekken niet naar de gezinsdraad');
});

test('leraar meldt te laat/afwezig; de ouder ziet het meteen', async () => {
  const { klas, g, sleutel } = await opzet('Hh');
  await lr(klas, '/school/absentie/meld', { leerling: sleutel, soort: 'te-laat', notitie: '10 minuten' });
  const mijn = await json(await api('/school/mijn', { code: g.code, token: g.token }));
  const a = mijn.school[0].absenties.find(x => x.soort === 'te-laat');
  assert.ok(a, 'de ouder ziet de te-laat-melding');
  assert.equal(a.bron, 'leraar');
  assert.match(a.reden, /10 minuten/);
});

test('analytics: gemiddelden per leerling en klas, en huiswerk-namen', async () => {
  const { klas, g, sleutel } = await opzet('Ii');
  await lr(klas, '/school/cijfer/geef', { leerling: sleutel, vak: 'Rekenen', cijfer: 8, weging: 1 });
  await lr(klas, '/school/cijfer/geef', { leerling: sleutel, vak: 'Taal', cijfer: 6, weging: 3 });
  const kd = await json(await lr(klas, '/school/klas'));
  // gewogen: (8*1 + 6*3) / 4 = 6.5
  assert.equal(kd.leerlingen[0].gemiddelde, 6.5);
  assert.equal(kd.klasGemiddelde, 6.5);
  // huiswerk-namen: wie het af heeft, met naam
  await lr(klas, '/school/huiswerk/maak', { titel: 'Sommen', vak: 'Rekenen' });
  const hw = (await json(await lr(klas, '/school/klas'))).huiswerk[0];
  await api('/school/huiswerk/af', { code: g.code, token: g.token, klasCode: klas.code, profielId: sleutel.split(':')[1], huiswerkId: hw.id });
  const na = await json(await lr(klas, '/school/klas'));
  assert.ok(na.huiswerk[0].afNamen.some(n => /Kind Ii/.test(n)), 'de leraar ziet de naam van wie het af heeft');
});

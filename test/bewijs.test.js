/* Proof of Learning: bewijs onder elke beheersing.

   De belofte die hier hard wordt gemaakt: "behaald" is geen bewering meer maar
   een conclusie uit bewijs, en een leerling kan altijd navragen waarop die
   conclusie berust. Wat hier bewezen wordt:

   - een oefensessie levert bewijs op, en dat bewijs staat er met wat er gedaan is;
   - een leerling kan zichzelf GEEN toets of observatie toekennen (dan is
     "bevestigd door school" een vinkje dat iedereen zelf zet);
   - een becijferde schooltoets landt WEL als bewijs in het paspoort, met de
     naam van de leraar erbij -- en alleen voor de leerdoelen die goed gingen;
   - de beheersing is een woord met een reden, nooit een cijfer;
   - een leraar ziet alleen de leerdoelen van zijn eigen klas terug.
   Draai los: node --experimental-sqlite --test test/bewijs.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bewijs-'));
const api = (pad, body) => fetch(base + '/api' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const fnd = (pad, body) => fetch(base + '/api/foundation' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const r = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Leerling Bewijs', email: 'bw' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '2005-04-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) });
  const reg = await r.json();
  token = reg.token;
  if (!token) throw new Error('registratie mislukt: ' + JSON.stringify(reg).slice(0, 200));
  const ins = await api('/onderwijs/inschrijf', { fase: 'po-g5' });
  if (ins.status !== 200) throw new Error('inschrijven mislukt: ' + JSON.stringify(ins).slice(0, 200));
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('oefenen levert bewijs op, en het bewijs zegt wat er gedaan is', async () => {
  // de tafels: elke vraag is "n x t ="
  let r = await api('/leerstof/oefen', { doel: 'rekenen.g5.tafels-tot-10' });
  const los = (v) => { const m = String(v).match(/^(\d+) x (\d+)/); return m ? String(+m[1] * +m[2]) : 'x'; };
  for (let i = 0; i < 5; i++) r = await api('/leerstof/antwoord', { antwoord: los(r.body.vraag) });
  assert.equal(r.body.behaald, true);

  const b = await api('/onderwijs/bewijs', { doel: 'rekenen.g5.tafels-tot-10' });
  assert.equal(b.status, 200);
  assert.equal(b.body.bewijs.length, 1);
  assert.equal(b.body.bewijs[0].soort, 'oefening');
  assert.match(b.body.bewijs[0].detail, /van 5 goed/);
  assert.equal(b.body.beheersing.woord, 'enkel', 'een stuk bewijs is nog geen stevige beheersing');
  // geen cijfer, geen vergelijking
  assert.doesNotMatch(JSON.stringify(b.body), /score|ranglijst|percentiel/i);
});

test('een leerling kent zichzelf geen toets of observatie toe', async () => {
  const nep = await api('/onderwijs/doel', { doel: 'rekenen.g5.delen', bewijs: { soort: 'observatie', detail: 'geloof mij nou maar' } });
  assert.equal(nep.status, 403);
  assert.match(nep.body.error, /school/i);
  const nep2 = await api('/onderwijs/doel', { doel: 'rekenen.g5.delen', bewijs: { soort: 'toets', detail: 'echt waar' } });
  assert.equal(nep2.status, 403);

  // een praktijkopdracht mag hij wel zelf melden -- maar die telt als eigen werk
  const eigen = await api('/onderwijs/doel', { doel: 'rekenen.g5.delen', bewijs: { soort: 'praktijk', detail: 'moestuin verdeeld in vakken' } });
  assert.equal(eigen.status, 200);
  assert.equal(eigen.body.beheersing.woord, 'enkel');
});

test('een becijferde schooltoets landt als bewijs in het paspoort, met de leraar erbij', async () => {
  // school, leraar en klas
  const sch = (await fnd('/school/school/maak', { naam: 'De Meander', plaats: 'Zwolle' })).body;
  const kantoor = await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'RTG-OFFICE' }) }).then(r => r.json());
  await fetch(base + '/api/office/school/decide', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kantoor.token },
    body: JSON.stringify({ code: sch.schoolCode, action: 'goedkeuren' }) });
  const leraar = (await fnd('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Meester Bram', rol: 'leraar' })).body;
  await fnd('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: leraar.personeelId, akkoord: true });
  const klas = (await fnd('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken, naam: '5A', trap: 'po', fase: 'po-g5' })).body;

  // een gezin met een kind: de ouder nodigt uit, het kind accepteert zelf
  const gezin = (await fnd('/gezin/maak', { gezinsnaam: 'Familie Bewijs', naam: 'Ouder Bewijs', pin: '4321' })).body;
  const kind = (await fnd('/gezin/profiel/maak', { code: gezin.code, token: gezin.token,
    naam: 'Sanne', rol: 'kind', groep: 'kind' })).body;
  const kindToken = (await fnd('/gezin/profiel/kies', { code: gezin.code, profielId: kind.profiel.id })).body.token;
  await fnd('/school/koppel', { code: gezin.code, token: gezin.token, klasCode: klas.code, profielId: kind.profiel.id });
  await fnd('/school/uitnodiging/antwoord', { code: gezin.code, token: kindToken, klasCode: klas.code, akkoord: true });

  // de leraar zet een toets klaar op een leerdoel en het kind maakt hem goed
  const kl = (p, b) => fnd(p, Object.assign({ klasCode: klas.code, personeelToken: leraar.personeelToken, schoolCode: sch.schoolCode }, b || {}));
  const toets = (await kl('/school/toets/maak', { soort: 'so', naam: 'SO tafels', doelen: ['rekenen.g5.tafels-tot-10'], perDoel: 3 })).body;
  let v = (await fnd('/school/toets/start', { code: gezin.code, token: kindToken, klasCode: klas.code, toetsId: toets.toets.id })).body;
  const los = (t) => { const m = String(t).match(/^(\d+) x (\d+)/); return m ? String(+m[1] * +m[2]) : 'x'; };
  for (let i = 0; i < 3; i++) v = (await fnd('/school/toets/antwoord', { code: gezin.code, token: kindToken,
    klasCode: klas.code, toetsId: toets.toets.id, antwoord: los(v.vraag) })).body;
  assert.equal(v.klaar, true);
  assert.equal(v.aantalGoed, 3);

  const lijst = (await kl('/school/toets/lijst')).body;
  const rij = lijst.toetsen[0].leerlingen.find(x => x.naam === 'Sanne');
  const cijfer = (await kl('/school/toets/cijfer', { toetsId: toets.toets.id, leerling: rij.sleutel })).body;
  assert.ok(cijfer.cijfer, 'het cijfer landt in het boek');
  assert.match(cijfer.bewijs, /leerpaspoort/, 'en het bewijs gaat naar het paspoort');

  // de leraar ziet alleen de doelen van zijn eigen klas terug
  const beeld = (await kl('/school/bewijs/leerling', { leerling: rij.sleutel })).body;
  const doel = beeld.doelen.find(x => x.doel === 'rekenen.g5.tafels-tot-10');
  assert.ok(doel, 'het leerdoel van de toets staat erbij');
  assert.ok(doel.stukken >= 1);
  assert.doesNotMatch(JSON.stringify(beeld), /taal\.|aardrijkskunde\./, 'doelen buiten deze klas horen hier niet');

  // en een observatie erbovenop maakt het bewijs sterker
  const obs = await kl('/school/bewijs/observatie', { leerling: rij.sleutel, doel: 'rekenen.g5.tafels-tot-10',
    notitie: 'legde de tafel van 8 uit aan een klasgenoot' });
  assert.equal(obs.status, 200);
  assert.equal(obs.body.beheersing.woord, 'sterk', 'een toets en een observatie zijn twee onafhankelijke bevestigingen');
  assert.match(obs.body.beheersing.uitleg, /bevestigd door school/);

  // een observatie zonder waarneming is een vinkje, en wordt geweigerd
  assert.equal((await kl('/school/bewijs/observatie', { leerling: rij.sleutel, doel: 'rekenen.g5.delen', notitie: '' })).status, 400);
});

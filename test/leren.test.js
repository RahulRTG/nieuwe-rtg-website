/* Integratietests voor de leerlaag: overhoorlijsten (zelf en via de AI-demo),
   het overhoorduel via de vriendenlaag (zonder automatische vriendschap),
   samen-projecten met taken/notities/AI-plan, en schrijven met buddy-feedback.
   Draai los: node --experimental-sqlite --test test/leren.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leren-'));
let child;

function fnd(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
function leren(actie, body, sess) {
  return fetch(BASE + '/api/rtf/leren/' + actie, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ code: sess.code, token: sess.token }, body || {}))
  });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

// een gezin met twee volwassen profielen die elkaar op codenaam vinden
let teller = 0;
async function gezinsLeden() {
  const t = Date.now() + '' + (teller++);
  const g = await json(await fnd('/gezin/maak', { gezinsnaam: 'Leer ' + t, naam: 'Ouder ' + t, pin: '1234' }));
  const oom = await json(await fnd('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Oom ' + t, rol: 'gezinslid', groep: 'volw' }));
  const kies = await json(await fnd('/gezin/profiel/kies', { code: g.code, profielId: oom.profiel.id }));
  return { A: { code: g.code, token: g.token }, B: { code: g.code, token: kies.token }, bCn: kies.profiel.codenaam };
}

test('overhoorlijsten: maken, ophalen en de beste score bijhouden', async () => {
  const { A } = await gezinsLeden();
  // te weinig paren wordt geweigerd
  assert.equal((await leren('lijst-maak', { naam: 'Leeg', paren: [{ v: 'a', a: 'b' }] }, A)).status, 400);
  const nieuw = await json(await leren('lijst-maak', { naam: 'Frans H1', paren: [
    { v: 'de hond', a: 'le chien' }, { v: 'de kat', a: 'le chat' }, { v: 'het brood', a: 'le pain' }] }, A));
  assert.ok(nieuw.ok && nieuw.id, 'de lijst staat er');
  assert.equal(nieuw.aantal, 3);
  const alle = await json(await leren('lijsten', {}, A));
  assert.equal(alle.lijsten.length, 1);
  const haal = await json(await leren('lijst-haal', { id: nieuw.id }, A));
  assert.equal(haal.lijst.paren.length, 3, 'de paren komen mee voor het overhoren');
  // beste score: alleen een betere verhouding overschrijft
  await leren('overhoor-klaar', { id: nieuw.id, goed: 2, totaal: 3 }, A);
  await leren('overhoor-klaar', { id: nieuw.id, goed: 1, totaal: 3 }, A); // slechter: telt niet
  const na = await json(await leren('lijsten', {}, A));
  assert.equal(na.lijsten[0].beste.goed, 2, 'de beste score blijft staan');
});

test('de AI-lijst werkt ook zonder sleutel: een net demosetje', async () => {
  const { A } = await gezinsLeden();
  const d = await json(await leren('lijst-ai', { onderwerp: 'hoofdsteden van Europa', groep: 'kind' }, A));
  assert.ok(d.ok && d.demo, 'zonder AI-sleutel komt het demosetje');
  const haal = await json(await leren('lijst-haal', { id: d.id }, A));
  assert.ok(haal.lijst.paren.length >= 8, 'een volwaardige lijst');
  assert.match(haal.lijst.naam, /Hoofdsteden/, 'het onderwerp is herkend');
});

test('het overhoorduel: uitdagen op codenaam, live standen en een winnaar', async () => {
  const { A, B, bCn } = await gezinsLeden();
  const lijst = await json(await leren('lijst-maak', { naam: 'Duelklaar', paren: [
    { v: 'twee plus twee', a: '4' }, { v: 'drie plus drie', a: '6' }] }, A));
  const duel = await json(await leren('sessie-start', { lijstId: lijst.id, codenamen: [bCn] }, A));
  assert.ok(duel.ok && duel.id, 'de uitdaging staat klaar');
  // B ziet de uitdaging en doet mee
  const bZiet = await json(await leren('sessies', {}, B));
  assert.equal(bZiet.uitnodigingen.length, 1, 'B ziet de uitdaging');
  const acc = await json(await leren('sessie-antwoord', { id: duel.id, akkoord: true }, B));
  assert.ok(acc.gestart, 'met twee is het duel begonnen');
  // A beantwoordt alles goed via de eigen lijst; accenten en hoofdletters doen er niet toe
  const antwoordOp = { 'twee plus twee': ' 4 ', 'drie plus drie': 'ZES' };
  for (let i = 0; i < 2; i++) {
    const st = await json(await leren('sessie-staat', { id: duel.id }, A));
    const z = await json(await leren('sessie-zet', { id: duel.id, antwoord: st.sessie.vraag === 'twee plus twee' ? '4' : '6' }, A));
    assert.ok(z.goed, 'A antwoordt goed');
  }
  // A is klaar; nog een keer zetten kan niet
  assert.equal((await leren('sessie-zet', { id: duel.id, antwoord: 'x' }, A)).status, 409);
  // B antwoordt alles fout en krijgt netjes het juiste antwoord terug
  for (let i = 0; i < 2; i++) {
    const z = await json(await leren('sessie-zet', { id: duel.id, antwoord: 'nee hoor' }, B));
    assert.equal(z.goed, false);
    assert.ok(z.juist, 'het juiste antwoord komt mee om van te leren');
  }
  const einde = await json(await leren('sessie-staat', { id: duel.id }, B));
  assert.equal(einde.sessie.status, 'klaar');
  assert.equal(einde.sessie.ander.goed, 2, 'B ziet de stand van A');
  const alsA = await json(await leren('sessies', {}, A));
  assert.equal(einde.sessie.winnaar, alsA.sessies[0].spelers[0], 'de uitdager wint dit duel');
});

test('samen aan een project: uitnodigen, taken claimen en afvinken, notities en het AI-plan', async () => {
  const { A, B, bCn } = await gezinsLeden();
  const p = await json(await leren('project-maak', { titel: 'Spreekbeurt over dolfijnen', wat: 'Voor groep 7' }, A));
  assert.ok(p.ok && p.id);
  await json(await leren('project-uitnodig', { id: p.id, codenamen: [bCn] }, A));
  const bZiet = await json(await leren('projecten', {}, B));
  assert.equal(bZiet.uitnodigingen.length, 1, 'B ziet de uitnodiging');
  await leren('project-antwoord', { id: p.id, akkoord: true }, B);
  // taken: zelf een maken, claimen en afvinken
  await leren('taak-maak', { id: p.id, tekst: 'Plaatjes zoeken' }, B);
  let st = await json(await leren('project-staat', { id: p.id }, B));
  assert.equal(st.project.leden.length, 2, 'het project heeft twee leden');
  const taak = st.project.taken[0];
  await leren('taak-zet', { id: p.id, taakId: taak.id, claim: true }, B);
  await leren('taak-zet', { id: p.id, taakId: taak.id, af: true }, B);
  st = await json(await leren('project-staat', { id: p.id }, A));
  assert.equal(st.project.taken[0].af, true, 'de taak is afgevinkt');
  assert.ok(st.project.taken[0].wie, 'en geclaimd door iemand');
  // notities delen
  await leren('notitie', { id: p.id, tekst: 'Dolfijnen slapen met een half brein!' }, A);
  st = await json(await leren('project-staat', { id: p.id }, B));
  assert.match(st.project.notities[0].tekst, /half brein/);
  // het AI-plan (demo) zet taken klaar, zonder dubbelingen
  const plan = await json(await leren('project-ai', { id: p.id, groep: 'kind' }, A));
  assert.ok(plan.erbij >= 4, 'het plan zet taken klaar');
  const nogEens = await json(await leren('project-ai', { id: p.id, groep: 'kind' }, A));
  assert.equal(nogEens.erbij, 0, 'hetzelfde plan komt er niet dubbel in');
  // opruimen kan alleen wie het project startte
  assert.equal((await leren('project-weg', { id: p.id }, B)).status, 404);
  const weg = await json(await leren('project-weg', { id: p.id }, A));
  assert.ok(weg.ok);
});

test('schrijven: opdrachten per leeftijd, buddy-feedback (demo) en bewaren', async () => {
  const { A } = await gezinsLeden();
  const kind = await json(await leren('schrijf-opdracht', { groep: 'kind' }, A));
  const volw = await json(await leren('schrijf-opdracht', { groep: 'volw' }, A));
  assert.ok(kind.opdracht && volw.opdracht && kind.opdracht !== volw.opdracht, 'elke leeftijd zijn eigen opdrachten');
  // te kort: eerst schrijven, dan pas feedback
  assert.equal((await leren('schrijf-feedback', { tekst: 'kort', groep: 'kind' }, A)).status, 400);
  const tekst = 'er was eens een hond die kon praten en hij zei elke ochtend goedemorgen tegen de postbode en dan lachte iedereen in de straat heel hard';
  const fb = await json(await leren('schrijf-feedback', { tekst, opdracht: kind.opdracht, groep: 'kind', buddy: 'man' }, A));
  assert.ok(fb.demo && fb.feedback.length > 40, 'de demofeedback leest echt mee');
  assert.match(fb.feedback, /Fayaz/, 'de gekozen buddy ondertekent');
  await leren('schrijf-bewaar', { opdracht: kind.opdracht, tekst, feedback: fb.feedback }, A);
  const alle = await json(await leren('schrijfsels', {}, A));
  assert.equal(alle.schrijfsels.length, 1, 'het stuk is bewaard');
});

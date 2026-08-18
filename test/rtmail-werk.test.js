/* RTG Mail x RTG Werk OS: het gedeelde postvak met een dossier, en de brug van
   een BERICHT naar een taak, ticket of kans.

   Dit is de bewering die het hele idee draagt -- "e-mail is geen los eiland" --
   en dus wordt hij hier van beide kanten dichtgezet:

   1. Omzetten vraagt TWEE sleutels (de RTG-sessie en het werkruimte-lidtoken)
      en die moeten van DEZELFDE persoon zijn. Zonder koppeling weigert de
      brug, met een uitleg hoe het wel moet.
   2. Een bericht dat niet in uw postvak ligt, is niet om te zetten. Ook niet
      als u het id kent.
   3. Wat er gemaakt wordt, VERWIJST naar de post (bericht-id en draad) en
      neemt hem niet over. Het bericht blijft waar het staat.
   4. De klok op een gedeeld postvak stopt bij een MENS. Een afwezigheids- of
      systeembericht zet hem niet stil -- dezelfde regel als bij de tickets.
   5. Een interne notitie draagt altijd wie hem schreef.
   Draai: node --test test/rtmail-werk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mailwerk-'));

const rauw = (pad, body, tok) => {
  const h = { 'Content-Type': 'application/json' };
  if (tok) h.Authorization = 'Bearer ' + tok;
  return fetch(BASE + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
};
const post = async (pad, body, tok) => (await rauw(pad, body, tok)).body;

let W, B, VK, SV, aTok, bTok, aAdres, bAdres, teamId, teamAdres;

async function werkLid(naam, rollen) {
  const a = await post('/api/bedrijf/lid/aanmeld', { werkruimte: W, naam });
  await post('/api/bedrijf/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });
  await post('/api/bedrijf/lid/rollen', { werkruimte: W, beheerToken: B, lidId: a.lidId, rollen });
  return { werkruimte: W, lidToken: a.lidToken, id: a.lidId, wie: naam };
}
async function meldAan(naam, mail, tel) {
  const r = await post('/api/auth/register', { name: naam, email: mail, phone: tel,
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.token, 'aangemeld: ' + naam);
  return r.token;
}
async function schrijf(tok, naar, onderwerp, tekst) {
  const c = await post('/api/member/rtmail/concept/bewaar', { naar, onderwerp, tekst }, tok);
  const v = await post('/api/member/rtmail/concept/verstuur', { id: c.concept.id }, tok);
  assert.ok(v.ok, JSON.stringify(v));
  return v.bericht;
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = await post('/api/bedrijf/werkruimte/maak', { naam: 'RTG Service', land: 'NL' });
  W = w.werkruimte; B = w.beheerToken;
  VK = await werkLid('Vera', ['verkoop', 'service', 'projectleider']);
  SV = await werkLid('Sam', ['service']);
  aTok = await meldAan('Post Klant', 'mailwerk1@x.nl', '0612345641');
  bTok = await meldAan('Post Balie', 'mailwerk2@x.nl', '0612345642');
  aAdres = (await post('/api/member/rtmail/adres', {}, aTok)).adres;
  bAdres = (await post('/api/member/rtmail/adres', {}, bTok)).adres;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('zonder gekoppeld RTG-account weigert de brug, met uitleg hoe het wel moet', async () => {
  const m = await schrijf(aTok, bAdres, 'Offerteaanvraag', 'Wij zoeken 40 kamers in oktober.');
  const r = await rauw('/api/bedrijf/post/omzetten',
    Object.assign({ soort: 'taak', berichtId: m.id }, VK), bTok);
  assert.equal(r.status, 403);
  assert.match(r.body.error, /koppel eerst/i);
  assert.match(r.body.error, /lid\/koppel/);
});

test('na koppelen wordt een bericht een taak die naar de post VERWIJST', async () => {
  const k = await post('/api/bedrijf/lid/koppel', { werkruimte: W, lidToken: VK.lidToken }, bTok);
  assert.equal(k.ok, true, JSON.stringify(k));
  const m = await schrijf(aTok, bAdres, 'Storing betaalterminal', 'De terminal doet niets sinds vanmorgen.');
  const r = await post('/api/bedrijf/post/omzetten',
    Object.assign({ soort: 'taak', berichtId: m.id }, VK), bTok);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.gemaakt.titel, 'Storing betaalterminal');
  assert.equal(r.gemaakt.herkomst.berichtId, m.id, 'de taak verwijst naar het bericht');
  assert.equal(r.gemaakt.herkomst.draad, m.draad);
  assert.equal(r.gemaakt.herkomst.uit, 'rtmail');
  assert.match(r.let, /verwijst naar het bericht/);
  // het bericht blijft gewoon in het postvak staan
  const vak = await post('/api/member/rtmail/vak', {}, bTok);
  assert.ok(vak.berichten.some(x => x.id === m.id), 'het bericht is niet verplaatst of opgegeten');
  // en de herkomst is terug te vragen
  const h = await post('/api/bedrijf/post/herkomst', Object.assign({ berichtId: m.id }, VK), bTok);
  assert.equal(h.werk.length, 1);
  assert.equal(h.werk[0].soort, 'taak');
});

test('een tweede omzetting mag, maar wordt gemeld in plaats van stil te gebeuren', async () => {
  const m = await schrijf(aTok, bAdres, 'Twee keer', 'zowel ticket als taak');
  await post('/api/bedrijf/post/omzetten', Object.assign({ soort: 'taak', berichtId: m.id }, VK), bTok);
  const tweede = await post('/api/bedrijf/post/omzetten',
    Object.assign({ soort: 'ticket', berichtId: m.id }, VK), bTok);
  assert.equal(tweede.ok, true);
  assert.equal(tweede.eerderGemaakt, 1);
  assert.match(tweede.let, /al 1 keer eerder/);
  assert.equal(tweede.gemaakt.melder, m.van, 'de melder van het ticket is de afzender van de mail');
});

test('een bericht uit andermans postvak is niet om te zetten, ook niet met het id', async () => {
  /* Post die A aan ZICHZELF schrijft: B is er afzender noch ontvanger van.
     (Post die B zelf verstuurde ligt wel in zijn postvak -- in zijn verzonden
     map -- en die mag hij dus wel omzetten.) */
  const m = await schrijf(aTok, aAdres, 'Prive', 'niet voor de werkruimte');
  const r = await rauw('/api/bedrijf/post/omzetten',
    Object.assign({ soort: 'taak', berichtId: m.id }, VK), bTok);
  assert.equal(r.status, 404);
  assert.match(r.body.error, /niet in uw postvak/);
});

test('een kans zonder klant is een notitie, en wordt geweigerd', async () => {
  const m = await schrijf(aTok, bAdres, 'Interesse', 'wij willen graag een voorstel');
  const zonder = await rauw('/api/bedrijf/post/omzetten',
    Object.assign({ soort: 'kans', berichtId: m.id }, VK), bTok);
  assert.equal(zonder.status, 404);
  assert.match(zonder.body.error, /zonder klant is een notitie/);

  const klant = (await post('/api/bedrijf/klant/zet', Object.assign({ naam: 'Hotel X B.V.',
    contacten: [{ naam: 'R. Ismail', email: aAdres }] }, VK))).klant;
  const met = await post('/api/bedrijf/post/omzetten',
    Object.assign({ soort: 'kans', berichtId: m.id, klantId: klant.id }, VK), bTok);
  assert.equal(met.ok, true, JSON.stringify(met));
  assert.equal(met.gemaakt.klant, 'Hotel X B.V.');
  assert.equal(met.gemaakt.fase, 'lead');
});

test('de zakelijke context naast een bericht raadt niets', async () => {
  const m = await schrijf(aTok, bAdres, 'Nog een vraag', 'over de kamers');
  const c = await post('/api/bedrijf/post/context', Object.assign({ berichtId: m.id }, VK), bTok);
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.ok(c.klant, 'deze afzender staat als contactpersoon bij Hotel X');
  assert.equal(c.klant.naam, 'Hotel X B.V.');
  assert.ok(c.openKansen.length >= 1, 'de kans van de vorige toets staat er nog open');

  // een afzender die bij niemand staat, levert een LEEG antwoord met de reden
  const onbekend = await schrijf(bTok, bAdres, 'Aan mezelf', 'test');
  const leeg = await post('/api/bedrijf/post/context', Object.assign({ berichtId: onbekend.id }, VK), bTok);
  assert.equal(leeg.klant, null);
  assert.match(leeg.let, /Er wordt niets geraden/);
});

test('een gedeeld postvak draagt status, prioriteit, notities en een klok', async () => {
  const t = await post('/api/member/rtmail/team/maak', { naam: 'Balie', adres: 'balie-mailwerk' }, bTok);
  assert.ok(t.ok, JSON.stringify(t));
  teamId = t.team.id; teamAdres = t.team.adres;
  const m = await schrijf(aTok, teamAdres, 'Klacht over de kamer', 'de douche lekt');

  const d = await post('/api/member/rtmail/team/dossier', { id: teamId, bericht: m.id }, bTok);
  assert.equal(d.ok, true, JSON.stringify(d));
  assert.equal(d.dossier.status, 'nieuw');
  assert.equal(d.dossier.prioriteit, 'normaal');
  assert.equal(d.klok.beantwoord, false);
  assert.equal(d.klok.normMinuten, 480);

  const p = await post('/api/member/rtmail/team/prioriteit', { id: teamId, bericht: m.id, prioriteit: 'urgent' }, bTok);
  assert.equal(p.klok.normMinuten, 30, 'urgent verandert de afspraak');
  const raar = await post('/api/member/rtmail/team/prioriteit', { id: teamId, bericht: m.id, prioriteit: 'brandend' }, bTok);
  assert.match(raar.error, /Kies een prioriteit/);

  const n = await post('/api/member/rtmail/team/notitie', { id: teamId, bericht: m.id, tekst: 'loodgieter gebeld' }, bTok);
  assert.equal(n.ok, true);
  assert.match(n.let, /intern/);
  const d2 = await post('/api/member/rtmail/team/dossier', { id: teamId, bericht: m.id }, bTok);
  assert.equal(d2.dossier.notities.length, 1);
  assert.ok(d2.dossier.notities[0].door, 'de notitie draagt wie hem schreef');
  assert.equal(d2.dossier.notities[0].tekst, 'loodgieter gebeld');
  // de notitie staat NOOIT in de tekst van het bericht zelf
  const vak = await post('/api/member/rtmail/team/postvak', { id: teamId }, bTok);
  assert.ok(!JSON.stringify(vak.berichten).includes('loodgieter gebeld'), 'intern is intern');
});

test('de ontvangstbevestiging is GEEN antwoord: de klok blijft lopen', async () => {
  /* Dit is de toets die de regel echt op de proef stelt. Zonder een automatisch
     bericht in de draad kon "de klok stopt bij een mens" nooit misgaan -- en
     een bewering die niet kan zakken bewijst niets. */
  const b = await post('/api/member/rtmail/team/bevestiging',
    { id: teamId, tekst: 'Dank, wij hebben uw bericht ontvangen en pakken het op.' }, bTok);
  assert.equal(b.ok, true, JSON.stringify(b));
  assert.match(b.let, /telt NIET als antwoord/);

  const m = await schrijf(aTok, teamAdres, 'Derde klacht', 'de wifi valt weg');
  // de vrager heeft zijn bevestiging gekregen
  const bijA = await post('/api/member/rtmail/vak', {}, aTok);
  const bev = bijA.berichten.find(x => x.draad === m.draad && x.soort === 'bevestiging');
  assert.ok(bev, 'de bevestiging is bezorgd');
  assert.match(bev.tekst, /hebben uw bericht ontvangen/);
  // maar de klok loopt gewoon door
  const d = await post('/api/member/rtmail/team/dossier', { id: teamId, bericht: m.id }, bTok);
  assert.equal(d.dossier.antwoorden.length, 1, 'er staat wel degelijk een antwoord in de draad');
  assert.equal(d.dossier.antwoorden[0].automatisch, true);
  assert.equal(d.klok.beantwoord, false, 'en toch is er nog niet geantwoord');

  // een tweede bericht in dezelfde draad levert GEEN tweede bevestiging op
  await post('/api/member/rtmail/antwoord', { id: bev.id, tekst: 'en nu?' }, aTok);
  const bijA2 = await post('/api/member/rtmail/vak', {}, aTok);
  assert.equal(bijA2.berichten.filter(x => x.draad === m.draad && x.soort === 'bevestiging').length, 1,
    'een bevestiging per gesprek -- anders praten twee postvakken eindeloos tegen elkaar');

  // en een mens sluit hem alsnog af
  await post('/api/member/rtmail/team/stuur', { id: teamId, antwoordOp: m.id, tekst: 'wij kijken ernaar' }, bTok);
  const na = await post('/api/member/rtmail/team/dossier', { id: teamId, bericht: m.id }, bTok);
  assert.equal(na.klok.beantwoord, true);
});

test('de klok stopt pas bij een MENSELIJK antwoord uit het team', async () => {
  await post('/api/member/rtmail/team/bevestiging', { id: teamId, tekst: '' }, bTok);
  const m = await schrijf(aTok, teamAdres, 'Tweede klacht', 'de lift doet het niet');
  const voor = await post('/api/member/rtmail/team/dossier', { id: teamId, bericht: m.id }, bTok);
  assert.equal(voor.klok.beantwoord, false);
  /* Een LOS bericht vanuit het team begint een eigen draad en stopt de klok
     van deze vraag dus NIET -- dat is geen tekortkoming maar het punt: pas een
     antwoord IN de draad is een antwoord op deze vraag. */
  const los = await post('/api/member/rtmail/team/stuur',
    { id: teamId, naar: aAdres, onderwerp: 'Even iets anders', tekst: 'ter info' }, bTok);
  assert.ok(los.ok, JSON.stringify(los));
  const tussen = await post('/api/member/rtmail/team/dossier', { id: teamId, bericht: m.id }, bTok);
  assert.equal(tussen.klok.beantwoord, false, 'een los bericht is geen antwoord op deze vraag');

  const inDraad = await post('/api/member/rtmail/team/stuur',
    { id: teamId, antwoordOp: m.id, tekst: 'wij komen kijken' }, bTok);
  assert.ok(inDraad.ok, JSON.stringify(inDraad));
  assert.equal(inDraad.bericht.naar, m.van, 'het antwoord gaat terug naar de vrager');
  assert.match(inDraad.bericht.onderwerp, /^Re: /);
  assert.match(inDraad.bericht.tekst, /namens Balie$/, 'het adres is gedeeld, de hand niet');
  const na = await post('/api/member/rtmail/team/dossier', { id: teamId, bericht: m.id }, bTok);
  assert.equal(na.klok.beantwoord, true, 'een antwoord in dezelfde draad vanaf het teamadres stopt de klok');
  assert.ok(na.klok.beantwoordAt);

  // een antwoordOp uit een ANDER postvak wordt geweigerd
  const vreemd = await post('/api/member/rtmail/team/stuur',
    { id: teamId, antwoordOp: 'bestaatniet', tekst: 'x' }, bTok);
  assert.match(vreemd.error, /niet in het postvak van dit team/);
});

test('status "afgehandeld" en de afgehandeld-lijst van het team blijven gelijk', async () => {
  const o = await post('/api/member/rtmail/team/overzicht', { id: teamId }, bTok);
  assert.equal(o.ok, true, JSON.stringify(o));
  const rij = o.berichten[0];
  await post('/api/member/rtmail/team/status', { id: teamId, bericht: rij.id, status: 'afgehandeld' }, bTok);
  const postvak = await post('/api/member/rtmail/team/postvak', { id: teamId }, bTok);
  assert.ok(!postvak.berichten.some(x => x.id === rij.id), 'weg uit de openstaande lijst van het team');
  const o2 = await post('/api/member/rtmail/team/overzicht', { id: teamId }, bTok);
  assert.equal(o2.berichten.find(x => x.id === rij.id).status, 'afgehandeld');
  // en terugdraaien houdt de twee ook gelijk
  await post('/api/member/rtmail/team/status', { id: teamId, bericht: rij.id, status: 'in behandeling' }, bTok);
  const postvak2 = await post('/api/member/rtmail/team/postvak', { id: teamId }, bTok);
  assert.ok(postvak2.berichten.some(x => x.id === rij.id), 'weer open');
});

test('wie niet in het team zit, komt niet bij het dossier', async () => {
  const o = await post('/api/member/rtmail/team/overzicht', { id: teamId }, aTok);
  assert.match(o.error, /niet in dit team/);
});

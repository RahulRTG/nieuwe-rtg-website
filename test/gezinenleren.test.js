/* HET GEZIN EN HET LEREN -- zakgeld, sterren, en de eerlijke vergeetcurve.

   WAAROM DEZE TWEE SAMEN

   Ze zijn allebei van de RTFoundation-kant en ze raken allebei kinderen, maar
   op een verschillende manier gevoelig:

   HET GEZIN gaat over GELD EN KINDEREN. Wie het weekgeld zet en wie sterren
   verzilvert is geen instelling maar een bevoegdheid: een kind hoort zijn
   eigen zakgeld niet te kunnen ophogen, en er horen nooit meer sterren
   verzilverd te worden dan er verdiend zijn. Dat is niet alleen boekhouding
   maar ook opvoeding -- het hele idee van sparen valt weg als de teller vanzelf
   meegroeit.

   HET LEREN gaat over een ALGORITME dat een kind vormt. De vergeetcurve hier
   is een Leitner-systeem: goed beantwoord schuift een kaartje verder weg, fout
   haalt hem terug naar vandaag -- en uitdrukkelijk ZONDER STRAF, staat er in
   de code. Die pedagogische keuze hoort een toets te hebben, want ze is met
   een half regeltje om te draaien in iets dat kinderen afstraft. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezin-'));
let child, BASE;

const api = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
});
const rtfApi = (pad, body) => fetch(BASE + '/api/rtf' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
});
const json = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });

test.before(async () => {
  ({ child, base: BASE } = await startServer({
    env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health'
  }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* Een gezin met een ouder en een kind. De ouder maakt het gezin en is
   daarmee beheerder; het kind krijgt een eigen profiel met een eigen token. */
async function gezinMetKind(naam) {
  const g = (await json(await api('/gezin/maak',
    { gezinsnaam: 'Fam ' + naam, naam: 'Ouder ' + naam, pin: '1234' }))).body;
  assert.ok(g.code && g.token, 'het gezin bestaat: ' + JSON.stringify(g).slice(0, 160));
  const kind = (await json(await api('/gezin/profiel/maak',
    { code: g.code, token: g.token, naam: 'Kind ' + naam, rol: 'kind', groep: 'kind' }))).body;
  assert.ok(kind.profiel && kind.profiel.id, 'het kind heeft een profiel: ' + JSON.stringify(kind).slice(0, 160));
  const kindToken = (await json(await api('/gezin/profiel/kies',
    { code: g.code, profielId: kind.profiel.id }))).body.token;
  assert.ok(kindToken, 'en een eigen token');
  return { g, kindId: kind.profiel.id, kindToken };
}

test('de geldschool: een kind zet zijn eigen zakgeld niet', async () => {
  const o = await gezinMetKind('Geld');

  /* ---- 1. HET KIND MAG HET NIET. Dit is de bewering waar het om gaat: zonder
     die grens is zakgeld een veld dat je zelf invult. ---- */
  const doorKind = await json(await api('/gezin/geldschool/weekgeld',
    { code: o.g.code, token: o.kindToken, pid: o.kindId, centenPerWeek: 5000 }));
  assert.equal(doorKind.status, 403, 'een kind zet zijn eigen weekgeld niet: ' +
    JSON.stringify(doorKind.body).slice(0, 180));
  assert.match(String(doorKind.body.error), /ouder|beheerder/i, 'en het zegt wie dat wel mag');

  /* ---- 2. DE OUDER WEL, en binnen een grens. ---- */
  const teHoog = await json(await api('/gezin/geldschool/weekgeld',
    { code: o.g.code, token: o.g.token, pid: o.kindId, centenPerWeek: 999999 }));
  assert.equal(teHoog.status, 400, 'ook een ouder kan geen duizend euro per week zetten');

  const gezet = await json(await api('/gezin/geldschool/weekgeld',
    { code: o.g.code, token: o.g.token, pid: o.kindId, centenPerWeek: 500 }));
  assert.equal(gezet.status, 200, 'vijf euro per week staat: ' + JSON.stringify(gezet.body).slice(0, 160));
  assert.equal(gezet.body.weekgeldCenten, 500, 'op het bedrag dat is opgegeven');

  /* ---- 3. STERREN VERZILVEREN KAN NIET UIT HET NIETS. Het kind heeft nog
     niets verdiend, dus er valt niets te verzilveren -- en dat is precies wat
     sparen betekenisvol houdt. ---- */
  const uitNiets = await json(await api('/gezin/geldschool/verzilver',
    { code: o.g.code, token: o.g.token, pid: o.kindId, sterren: 5, centen: 500 }));
  assert.equal(uitNiets.status, 400, 'sterren die niet verdiend zijn kun je niet verzilveren: ' +
    JSON.stringify(uitNiets.body).slice(0, 180));
  assert.match(String(uitNiets.body.error), /staa[tn] er nog/i, 'en het zegt hoeveel er wel openstaan');

  const doorHetKind = await json(await api('/gezin/geldschool/verzilver',
    { code: o.g.code, token: o.kindToken, pid: o.kindId, sterren: 1, centen: 500 }));
  assert.equal(doorHetKind.status, 403, 'en het kind verzilvert sowieso niet zelf');
});

test('de vergeetcurve: goed schuift vooruit, fout komt vandaag terug -- zonder straf', async () => {
  const o = await gezinMetKind('Leren');
  const leer = (actie, body) => rtfApi('/leren/' + actie,
    Object.assign({ code: o.g.code, token: o.kindToken }, body || {}));

  const lijst = (await json(await leer('lijst-maak', {
    naam: 'Franse woordjes',
    paren: [{ v: 'la maison', a: 'het huis' }, { v: 'le chien', a: 'de hond' }]
  }))).body;
  const lid = (lijst.lijst && lijst.lijst.id) || lijst.id;
  assert.ok(lid, 'de lijst is gemaakt: ' + JSON.stringify(lijst).slice(0, 200));

  /* Beide kaartjes staan vandaag klaar: een nieuwe lijst is meteen te leren. */
  const stapel = (await json(await leer('herhaal', {}))).body;
  assert.equal(stapel.aantal, 2, 'twee kaartjes staan vandaag klaar: ' + JSON.stringify(stapel).slice(0, 200));

  /* ---- GOED: het kaartje schuift een bak omhoog en komt LATER terug. ---- */
  const goed = (await json(await leer('herhaal-antwoord', { lijstId: lid, idx: 0, goed: true }))).body;
  assert.equal(goed.bak, 2, 'een goed antwoord schuift naar bak 2: ' + JSON.stringify(goed));
  assert.ok(goed.weer > stapel.vandaag,
    'en het kaartje komt pas later terug (' + stapel.vandaag + ' -> ' + goed.weer + ')');

  /* ---- FOUT: terug naar bak 1 en VANDAAG nog een keer. Uitdrukkelijk zonder
     straf: het kaartje mag niet verder weg geschoven worden, en de bak mag
     niet onder 1 zakken. Een leersysteem dat fouten bestraft, leert kinderen
     vooral niet meer te proberen. ---- */
  const fout = (await json(await leer('herhaal-antwoord', { lijstId: lid, idx: 0, goed: false }))).body;
  assert.equal(fout.bak, 1, 'een fout antwoord zet het kaartje terug op bak 1: ' + JSON.stringify(fout));
  assert.equal(fout.weer, stapel.vandaag, 'en het komt vandaag nog een keer terug, niet later');

  /* ---- HERHAALD GOED SCHUIFT VERDER WEG, en nooit voorbij bak 5. ---- */
  let vorige = 0;
  for (let i = 0; i < 6; i++) {
    const r = (await json(await leer('herhaal-antwoord', { lijstId: lid, idx: 1, goed: true }))).body;
    assert.ok(r.bak >= vorige, 'de bak loopt op of blijft staan (' + vorige + ' -> ' + r.bak + ')');
    vorige = r.bak;
  }
  assert.equal(vorige, 5, 'en stopt bij bak 5 in plaats van door te tellen (' + vorige + ')');

  /* ---- HET OVERZICHT klopt met wat er gebeurd is. ---- */
  const stand = (await json(await leer('herhaal-stand', {}))).body;
  const mijn = (stand.lijsten || []).find(l => l.id === lid);
  assert.ok(mijn, 'de lijst staat in het overzicht: ' + JSON.stringify(stand).slice(0, 220));
  const totaalInBakken = (mijn.bakken || []).reduce((s, n) => s + n, 0);
  assert.equal(totaalInBakken, 2, 'beide kaartjes zitten in precies een bak: ' + JSON.stringify(mijn.bakken));
  assert.equal(mijn.vandaag, 1, 'en er staat er vandaag nog een klaar (de foute)');
});

test('de lijst is van het kind: een ander gezin komt er niet bij', async () => {
  const a = await gezinMetKind('Eigen');
  const b = await gezinMetKind('Ander');

  /* Een lijst van een enkel paar is geen lijst -- overhoren met een vraag is
     geen overhoren. Die grens staat er, dus die toetsen we meteen mee. */
  const teKlein = await json(await rtfApi('/leren/lijst-maak', {
    code: a.g.code, token: a.kindToken, naam: 'Te klein', paren: [{ v: 'Madrid', a: 'Spanje' }]
  }));
  assert.notEqual(teKlein.status, 200, 'een lijst met een enkel paar wordt geweigerd: ' +
    JSON.stringify(teKlein.body).slice(0, 160));

  const lijst = (await json(await rtfApi('/leren/lijst-maak', {
    code: a.g.code, token: a.kindToken, naam: 'Topografie',
    paren: [{ v: 'Madrid', a: 'Spanje' }, { v: 'Lissabon', a: 'Portugal' }]
  }))).body;
  const lid = (lijst.lijst && lijst.lijst.id) || lijst.id;
  assert.ok(lid, 'kind A heeft een lijst: ' + JSON.stringify(lijst).slice(0, 240));

  /* Een kind uit een ander gezin mag er niet in -- niet lezen en niet
     beantwoorden. Zonder deze grens is een leerlijst een gedeeld prikbord. */
  const lezen = await json(await rtfApi('/leren/lijst-haal',
    { code: b.g.code, token: b.kindToken, id: lid }));
  assert.notEqual(lezen.status, 200, 'kind B kan de lijst niet openen: ' +
    lezen.status + ' ' + JSON.stringify(lezen.body).slice(0, 160));

  const antwoorden = await json(await rtfApi('/leren/herhaal-antwoord',
    { code: b.g.code, token: b.kindToken, lijstId: lid, idx: 0, goed: true }));
  assert.notEqual(antwoorden.status, 200, 'en kan er ook niet in antwoorden: ' +
    antwoorden.status + ' ' + JSON.stringify(antwoorden.body).slice(0, 160));

  // en de eigenaar wel
  const eigen = await json(await rtfApi('/leren/lijst-haal',
    { code: a.g.code, token: a.kindToken, id: lid }));
  assert.equal(eigen.status, 200, 'de eigenaar komt er gewoon bij');
});

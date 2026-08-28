/* De enterprise-laag van RTG School, deel 4: het directiebeeld, de rapporten,
   de koppelingen en het ouderportaal.

   De beloftes die hier hard worden gemaakt:
   - een verzuimwaarschuwing NOEMT ZIJN EIGEN REKENSOM (hoeveel nu, hoeveel
     eerder, over hoeveel lessen) en verschijnt niet op vier lessen ruis;
   - de signalen rond een leerling zijn FACTOREN, geen score en geen ranglijst;
   - een rapport bereikt het gezin pas als een MENS het heeft vastgesteld -- de
     AI-tekst is altijd een concept;
   - een koppeling deelt alleen de velden die zijn aangevinkt, en zorg,
     incidenten en het journaal staan niet eens in de lijst;
   - toestemming is intrekbaar, en geen antwoord telt nooit als ja.
   Draai los: node --test test/schoolbeeld.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-beeld-'));
const api = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const office = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const dag = (terug) => new Date(Date.now() - terug * 86400000).toISOString().slice(0, 10);
let D, leraar, klas, gezin, kindId, kindToken, sleutel;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const sch = (await api('/school/school/maak', { naam: 'Het Kompas', plaats: 'Breda' })).body;
  const kantoor = (await office('/office/login', { code: 'RTG-OFFICE' })).body.token;
  await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, kantoor);
  D = { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken };
  leraar = (await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Juf Nadia', rol: 'leraar' })).body;
  await api('/school/personeel/besluit', Object.assign({ personeelId: leraar.personeelId, akkoord: true }, D));
  klas = (await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken, naam: '3B' })).body;

  gezin = (await api('/gezin/maak', { gezinsnaam: 'Fam Kompas', naam: 'Ouder Kompas', pin: '1234' })).body;
  const kind = (await api('/gezin/profiel/maak', { code: gezin.code, token: gezin.token, naam: 'Kind Kompas', rol: 'kind', groep: 'kind' })).body;
  kindId = kind.profiel.id;
  kindToken = (await api('/gezin/profiel/kies', { code: gezin.code, profielId: kindId })).body.token;
  await api('/school/koppel', { code: gezin.code, token: gezin.token, klasCode: klas.code, profielId: kindId });
  await api('/school/uitnodiging/antwoord', { code: gezin.code, token: kindToken, klasCode: klas.code, akkoord: true });
  sleutel = gezin.code + ':' + kindId;
  // de leerling ook in de administratie, zodat facturen en dossier erbij horen
  const l = (await api('/school/leerling/aanmeld', Object.assign({ naam: 'Kind Kompas', gezinCode: gezin.code, profielId: kindId }, D))).body.leerling;
  await api('/school/leerling/besluit', Object.assign({ leerlingId: l.id, besluit: 'plaatsen', klasCode: klas.code }, D));
  D.leerlingId = l.id;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const zetLes = (datum, uur, stand) => api('/school/aanwezigheid/zet', {
  schoolCode: D.schoolCode, personeelToken: leraar.personeelToken, klasCode: klas.code,
  datum, uur, vak: 'geschiedenis', regels: [{ leerling: sleutel, stand }]
});

test('de verzuimwaarschuwing noemt zijn eigen rekensom, en zwijgt bij te weinig lessen', async () => {
  /* Eerst de vergelijkingsperiode (30-120 dagen terug): twaalf lessen, een
     gemist. Die moet er zijn, anders zwijgt de meter sowieso en bewijst de
     volgende bewering niets. */
  for (let i = 0; i < 12; i++) await zetLes(dag(60), i + 1, i === 0 ? 'ziek' : 'aanwezig');

  // deze maand eerst maar vier lessen, alle vier gemist: 100% tegen 8%, en
  // toch geen signaal -- vier lessen is ruis, geen meting
  for (let i = 0; i < 4; i++) await zetLes(dag(2), i + 1, 'afwezig');
  let d = (await api('/school/dashboard', D)).body;
  assert.ok(!d.waarschuwingen.some(w => w.soort === 'verzuim'), 'vier lessen is ruis, geen signaal');

  // en dan de rest van de maand erbij: twaalf lessen, zes gemist
  for (let i = 0; i < 12; i++) await zetLes(dag(5), i + 1, i < 6 ? 'afwezig' : 'aanwezig');

  d = (await api('/school/dashboard', D)).body;
  const w = d.waarschuwingen.find(x => x.soort === 'verzuim');
  assert.ok(w, 'nu is er wel een signaal');
  assert.match(w.tekst, /hoger dan normaal/);
  assert.ok(w.meting.lessen >= 10, 'de meting noemt hoeveel lessen eronder liggen');
  assert.ok(w.meting.nu > w.meting.eerder);
  // en zonder peiling met genoeg antwoorden verzint het dashboard geen
  // tevredenheidscijfer (de peiling zelf staat in test/schoolkoppel.test.js)
  assert.equal(d.tevredenheid, null);
  assert.match(d.tevredenheidUitleg, /nog geen peiling met genoeg antwoorden/);
});

test('signalen rond een leerling zijn factoren, geen score en geen ranglijst', async () => {
  const s = (await api('/school/signalen', Object.assign({ klasCode: klas.code, reden: 'mentoroverleg' }, D))).body;
  assert.equal(s.advies, true);
  assert.equal(s.besluitDoorMens, true);
  const rij = s.leerlingen.find(x => x.sleutel === sleutel);
  assert.ok(rij, 'het kind met veel verzuim staat erin');
  assert.ok(rij.factoren.some(f => f.wat === 'verzuim' && /gemist/.test(f.uitleg)), 'met een natrekbare uitleg');
  assert.ok(!('score' in rij) && !('risico' in rij), 'geen score en geen risicolabel');

  // een docent zonder zorgrol komt hier niet bij
  assert.equal((await api('/school/signalen', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken })).status, 403);
});

test('een rapport bereikt het gezin pas als een mens het vaststelt', async () => {
  await api('/school/cijfer/geef', { klasCode: klas.code, personeelToken: leraar.personeelToken,
    leerling: sleutel, vak: 'geschiedenis', cijfer: 7.5, weging: 2 });
  const rap = (await api('/school/rapport/maak', Object.assign({ klasCode: klas.code, periode: 'Periode 1' }, D))).body.rapport;

  const tekst = (await api('/school/rapport/tekst', Object.assign({ rapportId: rap.id, sleutel }, D))).body;
  assert.equal(tekst.concept, true);
  assert.ok(tekst.bron, 'de bron van de tekst staat erbij');

  // zolang het niet is vastgesteld, ziet het gezin niets
  let mijn = (await api('/school/rapport/mijn', { code: gezin.code, token: gezin.token })).body;
  assert.equal(mijn.rapporten.length, 0, 'een concept gaat niet naar het gezin');

  // vaststellen kan niet zonder de bevestiging dat de teksten gelezen zijn
  assert.equal((await api('/school/rapport/stel-vast', Object.assign({ rapportId: rap.id }, D))).status, 400);
  const vast = (await api('/school/rapport/stel-vast', Object.assign({ rapportId: rap.id, gelezen: true }, D))).body;
  assert.equal(vast.rapport.vastgesteld, true);

  mijn = (await api('/school/rapport/mijn', { code: gezin.code, token: gezin.token })).body;
  assert.equal(mijn.rapporten.length, 1);
  assert.equal(mijn.rapporten[0].gemiddelde, 7.5);
  // en daarna is de tekst niet meer stilletjes te wijzigen
  assert.equal((await api('/school/rapport/tekst/zet', Object.assign({ rapportId: rap.id, sleutel, tekst: 'anders' }, D))).status, 409);
});

test('studievoortgang komt uit dezelfde bron als het rapport', async () => {
  const v = (await api('/school/voortgang', Object.assign({ klasCode: klas.code, sleutel }, D))).body;
  assert.equal(v.gemiddelde, 7.5);
  assert.ok(v.vakken.some(x => x.vak === 'geschiedenis'));
  assert.ok(v.rapporten.some(r => r.periode === 'Periode 1'));
});

test('een koppeling deelt alleen de aangevinkte velden; zorg staat niet eens in de lijst', async () => {
  const fout = await api('/school/koppeling/zet', Object.assign({ soort: 'leermiddelen', velden: ['naam', 'zorgdossier'] }, D));
  assert.equal(fout.status, 400);

  const leeg = await api('/school/koppeling/zet', Object.assign({ soort: 'leermiddelen', velden: [] }, D));
  assert.equal(leeg.status, 400, 'zonder velden gaat een koppeling niet aan');

  await api('/school/koppeling/zet', Object.assign({ soort: 'leermiddelen', velden: ['naam', 'klas'] }, D));
  const lijst = (await api('/school/koppelingen', D)).body;
  const k = lijst.koppelingen.find(x => x.soort === 'leermiddelen');
  assert.deepEqual(k.velden, ['naam', 'klas']);
  assert.ok(lijst.nooit.includes('zorgdossier') && lijst.nooit.includes('inzagejournaal'));
  assert.ok(!lijst.velden.some(v => /zorg|incident|journaal/.test(v.id)), 'gevoelige velden staan niet op de keuzelijst');

  // de export laat het zorgdeel standaard weg
  const zonderZorg = (await api('/school/export', D)).body;
  assert.equal(zonderZorg.zorgMee, false);
  assert.ok(zonderZorg.leerlingen.every(l => !('zorg' in l)));
});

test('toestemming: geen antwoord is geen toestemming, en intrekken kan altijd', async () => {
  const t = (await api('/school/toestemming/vraag', Object.assign({ titel: 'Foto op de schoolsite',
    uitleg: 'Mogen wij een foto van uw kind op de website plaatsen?', klasCode: klas.code }, D))).body.toestemming;

  let ov = (await api('/school/toestemming/overzicht', D)).body.toestemmingen.find(x => x.id === t.id);
  assert.equal(ov.toestemming.length, 0);
  assert.equal(ov.geenAntwoord, 1, 'geen antwoord telt als geen toestemming');

  await api('/school/toestemming/antwoord', { code: gezin.code, token: gezin.token, toestemmingId: t.id, profielId: kindId, antwoord: true });
  ov = (await api('/school/toestemming/overzicht', D)).body.toestemmingen.find(x => x.id === t.id);
  assert.equal(ov.toestemming.length, 1);

  const intrek = (await api('/school/toestemming/antwoord', { code: gezin.code, token: gezin.token, toestemmingId: t.id, profielId: kindId, antwoord: null })).body;
  assert.match(intrek.uitleg, /ingetrokken/);
  ov = (await api('/school/toestemming/overzicht', D)).body.toestemmingen.find(x => x.id === t.id);
  assert.equal(ov.toestemming.length, 0);
  assert.equal(ov.ingetrokken, 1);
});

test('het portaal van het gezin: facturen, aanwezigheid, rapport en afspraak op een plek', async () => {
  await api('/school/factuur/maak', Object.assign({ leerlingId: D.leerlingId, soort: 'materiaal', bedrag: 20, omschrijving: 'Werkboek' }, D));
  const mom = (await api('/school/afspraak/momenten', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken,
    klasCode: klas.code, momenten: [{ datum: '2026-09-10', tijd: '18:20', minuten: 10 }] })).body.momenten[0];
  await api('/school/afspraak/boek', { code: gezin.code, token: gezin.token, momentId: mom.id });

  const p = (await api('/school/portaal', { code: gezin.code, token: gezin.token })).body;
  assert.equal(p.openTotaal, 2000);
  assert.equal(p.blokkeertOnderwijs, false);
  assert.ok(p.aanwezigheid.length > 0, 'het gezin ziet dezelfde registraties als de school');
  assert.ok(p.rapporten.some(r => r.periode === 'Periode 1'));
  assert.ok(p.afspraken.some(a => a.tijd === '18:20'));
  assert.ok(p.toestemmingen.length >= 1);

  /* De vrije momenten. Zonder deze lijst kon een ouder wel boeken maar geen
     moment vinden: /afspraak/boek wil een momentId en dat stond nergens waar
     een gezin bij kon. Wat er NIET in hoort: de momenten die een ander gezin
     al heeft geboekt. */
  const tweede = (await api('/school/afspraak/momenten', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken,
    klasCode: klas.code, momenten: [{ datum: '2026-09-10', tijd: '18:40', minuten: 10 }] })).body;
  assert.equal(tweede.klaargezet, 1);

  const na = (await api('/school/portaal', { code: gezin.code, token: gezin.token })).body;
  assert.ok(na.vrijeMomenten.some(m => m.tijd === '18:40'), 'het vrije moment staat in het portaal');
  assert.ok(!na.vrijeMomenten.some(m => m.tijd === '18:20'), 'een geboekt moment staat niet meer als vrij');
  assert.ok(na.vrijeMomenten.every(m => !('bezet' in m)), 'wie er geboekt heeft gaat een ander gezin niets aan');

  // en boeken op dat gevonden moment werkt
  const boek = await api('/school/afspraak/boek', { code: gezin.code, token: gezin.token,
    momentId: na.vrijeMomenten.find(m => m.tijd === '18:40').id });
  assert.equal(boek.status, 200);
});

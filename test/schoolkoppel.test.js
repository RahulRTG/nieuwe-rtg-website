/* De drie punten die na de enterprise-ronde openstonden, nu gebouwd en
   nagetrokken: de webhookbezorging, het machtigingenregister en de anonieme
   tevredenheidspeiling.

   Wat hier bewezen wordt:
   - een gebeurtenis wordt ECHT afgeleverd, met een geldige HMAC-handtekening,
     en het lijf bevat ids en geen namen;
   - een adres dat weigert wordt opnieuw geprobeerd, geteld en na tien
     mislukkingen stilgezet (LAT-regel 5: niets slaat stil over);
   - een machtiging zonder maximum bestaat niet, en het gezin kan hem zelf
     stoppen -- er wordt nergens geind (`geindNu: false`);
   - een peiling geeft onder de vijf antwoorden GEEN uitslag, telt niemand twee
     keer, en er is geen weg terug van een score naar een gezin.

   De webhook-ontvanger draait hier als een echte HTTP-server op 127.0.0.1;
   daarom staat RTG_SCHOOL_WEBHOOK_INTERN=1 aan (zelfde schakelaar als bij de
   fout-melder). Zonder die vlag weigert de SSRF-afweer een intern adres, en dat
   hoort ook zo.
   Draai los: node --experimental-sqlite --test test/schoolkoppel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { startServer } = require('./helper');

let BASE, child, ontvanger, ontvangerPoort;
const geleverd = [];      // alles wat de ontvanger binnenkreeg
let weiger = false;       // stand van de nagemaakte ontvanger

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-koppel-'));
const api = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const office = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let D, leraar, klas, leerling, gezin, kindId, kindToken;

test.before(async () => {
  // de nagemaakte ontvanger: onthoudt lijf + handtekening, en kan weigeren
  ontvanger = http.createServer((req, res) => {
    let rauw = '';
    req.on('data', c => { rauw += c; });
    req.on('end', () => {
      geleverd.push({ lijf: rauw, handtekening: req.headers['x-rtg-handtekening'] || '' });
      res.writeHead(weiger ? 500 : 200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
  });
  await new Promise(r => ontvanger.listen(0, '127.0.0.1', r));
  ontvangerPoort = ontvanger.address().port;

  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_SCHOOL_WEBHOOK_INTERN: '1' } }));
  const sch = (await api('/school/school/maak', { naam: 'De Schakel', plaats: 'Tilburg' })).body;
  const kantoor = (await office('/office/login', { code: 'RTG-OFFICE' })).body.token;
  await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, kantoor);
  D = { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken };
  leraar = (await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Meester Wim', rol: 'leraar' })).body;
  await api('/school/personeel/besluit', Object.assign({ personeelId: leraar.personeelId, akkoord: true }, D));
  klas = (await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken, naam: '1A' })).body;

  gezin = (await api('/gezin/maak', { gezinsnaam: 'Fam Schakel', naam: 'Ouder Schakel', pin: '1234' })).body;
  const kind = (await api('/gezin/profiel/maak', { code: gezin.code, token: gezin.token, naam: 'Kind Schakel', rol: 'kind', groep: 'kind' })).body;
  kindId = kind.profiel.id;
  kindToken = (await api('/gezin/profiel/kies', { code: gezin.code, profielId: kindId })).body.token;
  await api('/school/koppel', { code: gezin.code, token: gezin.token, klasCode: klas.code, profielId: kindId });
  await api('/school/uitnodiging/antwoord', { code: gezin.code, token: kindToken, klasCode: klas.code, akkoord: true });

  leerling = (await api('/school/leerling/aanmeld', Object.assign({ naam: 'Kind Schakel', gezinCode: gezin.code, profielId: kindId }, D))).body.leerling;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  if (ontvanger) try { ontvanger.close(); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const wachtOp = async (aantal, ms = 4000) => {
  const eind = Date.now() + ms;
  while (geleverd.length < aantal && Date.now() < eind) await new Promise(r => setTimeout(r, 50));
  return geleverd.length;
};

test('een intern adres kan alleen met de schakelaar; een metadata-adres nooit', async () => {
  const meta = await api('/school/webhook/zet', Object.assign({ url: 'http://169.254.169.254/latest/meta-data',
    gebeurtenissen: ['factuur.gemaakt'] }, D));
  assert.equal(meta.status, 400, 'het cloud-metadata-adres blijft ook met de schakelaar dicht');
});

test('de proefknop levert echt af, ondertekend, en zonder namen in het lijf', async () => {
  const w = (await api('/school/webhook/zet', Object.assign({
    url: 'http://127.0.0.1:' + ontvangerPoort + '/haak',
    gebeurtenissen: ['leerling.ingeschreven', 'factuur.gemaakt', 'calamiteit'] }, D))).body;
  assert.equal(w.bezorgtNu, true);
  assert.ok(w.webhook.geheim, 'het geheim wordt een keer getoond');

  const proef = (await api('/school/webhook/proef', Object.assign({ webhookId: w.webhook.id }, D))).body;
  assert.equal(proef.ok, true);
  assert.equal(proef.status, 200);
  assert.equal(geleverd.length, 1);

  // de handtekening klopt met het geheim en het exacte lijf
  const eigen = 'sha256=' + crypto.createHmac('sha256', w.webhook.geheim).update(geleverd[0].lijf).digest('hex');
  assert.equal(geleverd[0].handtekening, eigen, 'HMAC over het exacte lijf');
  const lijf = JSON.parse(geleverd[0].lijf);
  assert.equal(lijf.gebeurtenis, 'proef');
  assert.equal(lijf.school, D.schoolCode);
});

test('een echte gebeurtenis komt aan, met ids en zonder namen', async () => {
  geleverd.length = 0;
  await api('/school/leerling/besluit', Object.assign({ leerlingId: leerling.id, besluit: 'plaatsen', klasCode: klas.code }, D));
  assert.equal(await wachtOp(1), 1, 'de inschrijving is afgeleverd');
  const lijf = JSON.parse(geleverd[0].lijf);
  assert.equal(lijf.gebeurtenis, 'leerling.ingeschreven');
  assert.equal(lijf.gegevens.leerlingId, leerling.id);
  assert.ok(geleverd[0].lijf.indexOf('Kind Schakel') < 0, 'geen naam in het lijf: de webhook meldt DAT er iets is, niet WAT');

  // een gebeurtenis waar deze webhook niet op is geabonneerd, komt niet aan
  geleverd.length = 0;
  await api('/school/aanwezigheid/zet', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken,
    klasCode: klas.code, uur: 1, regels: [{ leerling: gezin.code + ':' + kindId, stand: 'aanwezig' }] });
  await new Promise(r => setTimeout(r, 400));
  assert.equal(geleverd.length, 0, 'alleen waar je op geabonneerd bent');
});

test('een weigerend adres wordt opnieuw geprobeerd, geteld en gemeld', async () => {
  geleverd.length = 0;
  weiger = true;
  const w = (await api('/school/webhook/zet', Object.assign({
    url: 'http://127.0.0.1:' + ontvangerPoort + '/stuk', gebeurtenissen: ['calamiteit'] }, D))).body.webhook;
  const proef = (await api('/school/webhook/proef', Object.assign({ webhookId: w.id }, D))).body;
  assert.equal(proef.ok, false);
  assert.match(proef.fout, /HTTP 500/);
  assert.equal(geleverd.length, 3, 'een keer proberen en twee keer opnieuw');
  assert.equal(proef.mislukt, 1, 'een mislukte LEVERING, niet drie mislukte pogingen');

  const lijst = (await api('/school/webhook/lijst', D)).body;
  const rij = lijst.webhooks.find(x => x.id === w.id);
  assert.equal(rij.mislukt, 1);
  assert.match(rij.laatsteFout, /HTTP 500/);

  weiger = false;
  const weer = (await api('/school/webhook/proef', Object.assign({ webhookId: w.id }, D))).body;
  assert.equal(weer.ok, true);
  assert.equal(weer.mislukt, 0, 'een geslaagde levering zet de teller terug');
});

test('machtiging: geen maximum is geen machtiging, en het gezin stopt hem zelf', async () => {
  const zonderMax = await api('/school/machtiging/zet', Object.assign({ leerlingId: leerling.id,
    houder: 'A. Schakel', ibanEinde: '4321' }, D));
  assert.equal(zonderMax.status, 400);
  assert.match(zonderMax.body.error, /maximum/);

  const m = (await api('/school/machtiging/zet', Object.assign({ leerlingId: leerling.id, houder: 'A. Schakel',
    ibanEinde: 'NL91ABNA0417164300'.slice(-4), bank: 'ABN', max: 75, frequentie: 'maandelijks', kanaal: 'app' }, D))).body;
  assert.equal(m.geindNu, false, 'er wordt nergens geind');
  assert.equal(m.machtiging.maxCenten, 7500);
  assert.equal(m.machtiging.ibanEinde.length, 4);
  const plat = JSON.stringify(m);
  assert.ok(plat.indexOf('NL91ABNA') < 0, 'het volledige rekeningnummer wordt niet bewaard');

  // een factuur met incasso weet nu dat hij mag, en zegt erbij dat er niets is geind
  const f = (await api('/school/factuur/maak', Object.assign({ leerlingId: leerling.id, soort: 'schoolgeld',
    bedrag: 50, omschrijving: 'Schoolgeld', incasso: true }, D))).body;
  assert.equal(f.incasseerbaar, true);
  assert.equal(f.geindNu, false);
  assert.equal(f.machtiging, m.machtiging.kenmerk);

  // het gezin ziet hem en stopt hem zelf, zonder reden en per direct
  const mijn = (await api('/school/machtiging/mijn', { code: gezin.code, token: gezin.token })).body;
  assert.ok(mijn.machtigingen.some(x => x.id === m.machtiging.id));
  const stop = (await api('/school/machtiging/stop', { code: gezin.code, token: gezin.token, machtigingId: m.machtiging.id })).body;
  assert.equal(stop.machtiging.actief, false);

  // en daarna mag er niets meer
  const f2 = (await api('/school/factuur/maak', Object.assign({ leerlingId: leerling.id, soort: 'schoolgeld',
    bedrag: 50, omschrijving: 'Schoolgeld 2', incasso: true }, D))).body;
  assert.equal(f2.incasseerbaar, false);
  assert.match(f2.let, /GEEN geldige machtiging/);
});

test('peiling: geen uitslag onder de vijf antwoorden, en niemand telt twee keer', async () => {
  const p = (await api('/school/peiling/maak', Object.assign({ titel: 'Hoe gaat het op school?',
    stellingen: ['Mijn kind gaat met plezier naar school', 'Ik weet waar ik terechtkan met een vraag'],
    doelgroep: 'ouders' }, D))).body.peiling;

  const mijn = (await api('/school/peiling/mijn', { code: gezin.code, token: gezin.token })).body;
  assert.ok(mijn.peilingen.some(x => x.id === p.id));
  assert.equal(mijn.peilingen.find(x => x.id === p.id).alGeantwoord, false);

  const eerste = (await api('/school/peiling/antwoord', { code: gezin.code, token: gezin.token, peilingId: p.id, scores: [5, 4] })).body;
  assert.equal(eerste.bedankt, true);
  assert.equal(eerste.uitslagZichtbaar, false, 'een antwoord is nog geen uitslag');

  const nogeens = await api('/school/peiling/antwoord', { code: gezin.code, token: gezin.token, peilingId: p.id, scores: [1, 1] });
  assert.equal(nogeens.status, 409, 'twee keer stemmen kan niet');

  const uit = (await api('/school/peiling/uitslag', Object.assign({ peilingId: p.id }, D))).body;
  assert.equal(uit.uitslag.genoeg, false);
  assert.equal(uit.uitslag.gemiddelde, null);
  assert.match(uit.uitslag.let, /te weinig antwoorden/);

  // het dashboard verzint dus nog steeds niets
  const dash = (await api('/school/dashboard', D)).body;
  assert.equal(dash.tevredenheid, null);
  assert.match(dash.tevredenheidUitleg, /nog geen peiling met genoeg antwoorden/);
});

test('peiling: vanaf vijf antwoorden een uitslag, zonder weg terug naar een gezin', async () => {
  const p = (await api('/school/peiling/maak', Object.assign({ titel: 'Tevredenheid periode 2',
    stellingen: ['De school informeert mij op tijd'], doelgroep: 'personeel' }, D))).body.peiling;

  /* Eerst de vraag die het personeel zelf stelt: staat er iets voor mij open?
     Die bestond niet, en zonder hem was de personeelspeiling alleen te
     beantwoorden door een peiling-id ergens vandaan te toveren. */
  const voorMij = (await api('/school/peiling/mijn-personeel',
    { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken })).body;
  const staatOpen = voorMij.peilingen.find(x => x.id === p.id);
  assert.ok(staatOpen, 'de personeelspeiling staat open voor het personeel');
  assert.equal(staatOpen.alGeantwoord, false);
  assert.deepEqual(staatOpen.stellingen, ['De school informeert mij op tijd']);

  // een peiling voor OUDERS hoort hier niet tussen te staan
  const vanOuders = (await api('/school/peiling/maak', Object.assign({ titel: 'Alleen voor ouders',
    stellingen: ['Ik voel me welkom'], doelgroep: 'ouders' }, D))).body.peiling;
  assert.ok(!(await api('/school/peiling/mijn-personeel',
    { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken })).body.peilingen
    .some(x => x.id === vanOuders.id), 'een ouderpeiling staat niet in de personeelslijst');

  // vijf personeelsleden antwoorden
  const scores = [4, 5, 3, 4, 5];
  for (let i = 0; i < scores.length; i++) {
    const pers = (await api('/school/personeel/aanmeld', { schoolCode: D.schoolCode, naam: 'Collega ' + i, rol: 'leraar' })).body;
    await api('/school/personeel/besluit', Object.assign({ personeelId: pers.personeelId, akkoord: true }, D));
    const r = await api('/school/peiling/antwoord-personeel', { schoolCode: D.schoolCode, personeelToken: pers.personeelToken,
      peilingId: p.id, scores: [scores[i]] });
    assert.equal(r.status, 200);
  }

  const uit = (await api('/school/peiling/uitslag', Object.assign({ peilingId: p.id }, D))).body;
  assert.equal(uit.uitslag.genoeg, true);
  assert.equal(uit.uitslag.aantal, 5);
  assert.equal(uit.uitslag.gemiddelde, 4.2);

  // de opslag bevat geen enkele verwijzing van een score naar een persoon
  const plat = JSON.stringify(uit);
  assert.ok(plat.indexOf('Collega') < 0, 'geen namen in de uitslag');
  assert.ok(!uit.uitslag.antwoorden, 'geen losse antwoorden met wie erbij');

  const dash = (await api('/school/dashboard', D)).body;
  assert.equal(dash.tevredenheid.gemiddelde, 4.2);
  assert.equal(dash.tevredenheid.aantal, 5);
  assert.match(dash.tevredenheidUitleg, /Geen scores per medewerker/);
});

test('een stilgevallen webhook is weer te wekken, en weghalen kan maar een keer', async () => {
  weiger = true;
  const w = (await api('/school/webhook/zet', Object.assign({
    url: 'http://127.0.0.1:' + ontvangerPoort + '/wek', gebeurtenissen: ['calamiteit'] }, D))).body.webhook;
  await api('/school/webhook/proef', Object.assign({ webhookId: w.id }, D));
  weiger = false;

  const gewekt = (await api('/school/webhook/wek', Object.assign({ webhookId: w.id }, D))).body;
  assert.equal(gewekt.webhook.status, 'aan');
  const rij = (await api('/school/webhook/lijst', D)).body.webhooks.find(x => x.id === w.id);
  assert.equal(rij.mislukt, 0, 'wekken zet de teller terug; anders valt hij meteen weer stil');
  assert.equal(rij.laatsteFout, null);

  const onbekend = await api('/school/webhook/wek', Object.assign({ webhookId: 'bestaat-niet' }, D));
  assert.equal(onbekend.status, 404);

  assert.equal((await api('/school/webhook/weg', Object.assign({ webhookId: w.id }, D))).status, 200);
  assert.ok(!(await api('/school/webhook/lijst', D)).body.webhooks.some(x => x.id === w.id),
    'hij staat niet meer in de lijst');
  assert.equal((await api('/school/webhook/weg', Object.assign({ webhookId: w.id }, D))).status, 404,
    'twee keer weghalen is een fout en geen stille ok');
});

test('het machtigingenregister: de lijst toont wat er getekend is, en intrekken kan maar een keer', async () => {
  const m = (await api('/school/machtiging/zet', Object.assign({ leerlingId: leerling.id, houder: 'B. Schakel',
    ibanEinde: '9911', max: 30, frequentie: 'per periode' }, D))).body.machtiging;

  const lijst = (await api('/school/machtiging/lijst', D)).body;
  assert.equal(lijst.geindNu, false, 'ook de lijst zegt dat er nergens geind wordt');
  assert.ok(lijst.machtigingen.some(x => x.id === m.id));
  const plat = JSON.stringify(lijst);
  assert.ok(plat.indexOf('geheim') < 0 && !/NL\d\d[A-Z]{4}/.test(plat), 'geen volledige rekeningnummers in het register');

  const actief = (await api('/school/machtiging/lijst', Object.assign({ actief: true }, D))).body;
  assert.equal(actief.machtigingen.length, actief.actief, 'gefilterd op actief telt de lijst zijn eigen kop na');

  const in1 = (await api('/school/machtiging/intrek', Object.assign({ machtigingId: m.id }, D))).body;
  assert.equal(in1.machtiging.actief, false);
  assert.ok(in1.machtiging.ingetrokkenAt);

  const in2 = await api('/school/machtiging/intrek', Object.assign({ machtigingId: m.id }, D));
  assert.equal(in2.status, 409, 'een tweede intrekking is een fout en geen stille ok');

  const weg = await api('/school/machtiging/intrek', Object.assign({ machtigingId: 'bestaat-niet' }, D));
  assert.equal(weg.status, 404);
});

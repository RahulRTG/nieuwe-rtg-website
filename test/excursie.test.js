/* DE EXCURSIE -- waar kinderen zijn, en wie dat mag weten.

   WAAROM DIT DE ZWAARSTE VAN DE SCHOOL IS

   Van alle 199 school- en RTF-routes zonder toets is dit de enige waar het
   over de LOCATIE VAN EEN KIND gaat. Als hier iets niet klopt is het gevolg
   niet een verkeerd cijfer maar een kind dat gevolgd wordt terwijl zijn
   ouders daar nooit ja op hebben gezegd.

   Het ontwerp eromheen is zorgvuldig, en juist daarom hoort elke schakel
   ervan met een toets vast te liggen:

   1. GEEN LOCATIE ZONDER TOESTEMMING van een ouder of verzorger. Niet van de
      school, niet van het kind zelf.
   2. TOESTEMMING INTREKKEN WIST DE PLEK METEEN. Niet "vanaf nu niet meer",
      maar weg.
   3. DE LERAARLIJST DRAAGT GEEN LOCATIES. Plekken zien kan alleen via de
      kaart -- en die logt elke blik.
   4. HET GEZIN ZIET WIE ER KEEK. Toezicht op het toezicht, en dat is precies
      wat het verschil maakt tussen zorg en surveillance.
   5. DE EXCURSIE STOPPEN WIST ALLE LOCATIES. Ze bestaan precies zo lang als
      de excursie duurt, geen minuut langer. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-excursie-'));
let child, BASE;

const api = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
});
const json = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });

/* De RTG-backoffice zit buiten /api/foundation en verwacht de sessietoken als
   Bearer-header. Een school bestaat pas als RTG hem heeft goedgekeurd -- en dat
   is een MENS in de backoffice, net als bij de passen. */
function office(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + '/api' + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
async function keurSchoolGoed(schoolCode) {
  const login = (await json(await office('/office/login', { code: 'RTG-OFFICE' }))).body;
  const d = (await json(await office('/office/school/decide',
    { code: schoolCode, action: 'goedkeuren' }, login.token))).body;
  assert.ok(d.ok && d.status === 'actief', 'RTG keurt de school goed: ' + JSON.stringify(d).slice(0, 160));
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({
    env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health'
  }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* De verplichte volgorde: eerst de school (en RTG keurt hem goed), dan het
   personeel, dan pas de kinderen. Zelfde keten als test/school.test.js. */
async function opzet(naam) {
  const sch = (await json(await api('/school/school/maak', { naam: 'De Regenboog ' + naam, plaats: 'Utrecht' }))).body;
  await keurSchoolGoed(sch.schoolCode);   // zonder die stap kan er geen klas bestaan
  const p = (await json(await api('/school/personeel/aanmeld',
    { schoolCode: sch.schoolCode, naam: 'Juf ' + naam, rol: 'leraar' }))).body;
  await api('/school/personeel/besluit',
    { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: p.personeelId, akkoord: true });
  const kl = (await json(await api('/school/leraar/klas/maak',
    { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Groep 8' }))).body;
  assert.ok(kl.code, 'de klas bestaat: ' + JSON.stringify(kl).slice(0, 200));
  const klas = { code: kl.code, leraarToken: p.personeelToken };

  const g = (await json(await api('/gezin/maak', { gezinsnaam: 'Fam ' + naam, naam: 'Ouder ' + naam, pin: '1234' }))).body;
  const kind = (await json(await api('/gezin/profiel/maak',
    { code: g.code, token: g.token, naam: 'Kind ' + naam, rol: 'kind', groep: 'kind' }))).body;
  const kindToken = (await json(await api('/gezin/profiel/kies',
    { code: g.code, profielId: kind.profiel.id }))).body.token;
  const kop = (await json(await api('/school/koppel',
    { code: g.code, token: g.token, klasCode: klas.code, profielId: kind.profiel.id }))).body;
  assert.ok(kop.uitgenodigd, 'de ouder nodigt uit: ' + JSON.stringify(kop).slice(0, 160));
  const acc = (await json(await api('/school/uitnodiging/antwoord',
    { code: g.code, token: kindToken, klasCode: klas.code, akkoord: true }))).body;
  assert.ok(acc.geaccepteerd, 'het kind accepteert: ' + JSON.stringify(acc).slice(0, 160));
  return { klas, g, kindId: kind.profiel.id, kindToken };
}

const lr = (klas, pad, body) =>
  api(pad, Object.assign({ klasCode: klas.code, leraarToken: klas.leraarToken }, body || {}));

test('de excursie: geen plek van een kind zonder toestemming van thuis', async () => {
  const o = await opzet('A');

  const gemaakt = (await json(await lr(o.klas, '/school/excursie/maak',
    { titel: 'Naar het museum', bestemming: 'Rijksmuseum', van: '2026-09-15', tot: '2026-09-15' }))).body;
  assert.ok(gemaakt.ok, 'de excursie is aangemaakt: ' + JSON.stringify(gemaakt).slice(0, 200));
  const eid = (gemaakt.excursie && gemaakt.excursie.id) || gemaakt.id;
  assert.ok(eid, 'met een kenmerk');

  await lr(o.klas, '/school/excursie/start', { excursieId: eid });

  /* ---- 1. ZONDER TOESTEMMING GEEN PLEK. Het kind mag het zelf niet
     regelen; dat is precies waar de grens ligt. ---- */
  const zonder = await json(await api('/school/excursie/gps', {
    code: o.g.code, token: o.kindToken, klasCode: o.klas.code, excursieId: eid,
    lat: 52.3600, lng: 4.8852
  }));
  assert.equal(zonder.status, 403, 'zonder toestemming wordt de locatie geweigerd: ' +
    JSON.stringify(zonder.body).slice(0, 180));
  assert.match(String(zonder.body.error), /toestemming/i, 'en het zegt waarom');

  /* ---- 2. HET KIND MAG NIET VOOR ZICHZELF TEKENEN. ---- */
  const zelf = await json(await api('/school/excursie/toestemming', {
    code: o.g.code, token: o.kindToken, klasCode: o.klas.code, excursieId: eid,
    profielId: o.kindId, akkoord: true
  }));
  assert.equal(zelf.status, 403, 'een kind geeft zichzelf geen toestemming: ' +
    JSON.stringify(zelf.body).slice(0, 180));

  /* ---- 3. DE OUDER WEL, en dan mag de plek er zijn. ---- */
  const ouder = await json(await api('/school/excursie/toestemming', {
    code: o.g.code, token: o.g.token, klasCode: o.klas.code, excursieId: eid,
    profielId: o.kindId, akkoord: true
  }));
  assert.equal(ouder.status, 200, 'de ouder geeft toestemming: ' + JSON.stringify(ouder.body).slice(0, 180));
  assert.equal(ouder.body.akkoord, true, 'en dat staat genoteerd');

  const met = await json(await api('/school/excursie/gps', {
    code: o.g.code, token: o.kindToken, klasCode: o.klas.code, excursieId: eid,
    lat: 52.3600, lng: 4.8852
  }));
  assert.equal(met.status, 200, 'nu komt de locatie wel binnen: ' + JSON.stringify(met.body).slice(0, 180));

  /* ---- 4. DE LERAARLIJST DRAAGT GEEN LOCATIES. Wie plekken wil zien moet
     de kaart openen, en dat wordt gelogd. ---- */
  const lijst = (await json(await lr(o.klas, '/school/excursie/lijst', {}))).body;
  const alsTekst = JSON.stringify(lijst);
  assert.ok(!/52\.36|4\.885/.test(alsTekst), 'de lijst bevat geen coordinaten: ' + alsTekst.slice(0, 240));
  const regel = (lijst.excursies || []).find(e => e.id === eid);
  assert.ok(regel, 'de excursie staat er wel op');
  assert.equal(regel.toestemmingen, 1, 'met het aantal toestemmingen');
  assert.equal(regel.kijkbeurten, 0, 'en nog nul kijkbeurten');

  /* ---- 5. DE KAART LOGT ELKE BLIK. ---- */
  const kaart = (await json(await lr(o.klas, '/school/excursie/kaart', { excursieId: eid }))).body;
  assert.ok(kaart.ok, 'de kaart opent: ' + JSON.stringify(kaart).slice(0, 200));
  assert.equal((kaart.plekken || []).length, 1, 'met de plek van het kind erop');

  const naKijk = (await json(await lr(o.klas, '/school/excursie/lijst', {}))).body;
  const regel2 = (naKijk.excursies || []).find(e => e.id === eid);
  assert.equal(regel2.kijkbeurten, 1, 'en de kijkbeurt is geteld');

  /* ---- 6. HET GEZIN ZIET WIE ER KEEK. Toezicht op het toezicht. ---- */
  const mijn = (await json(await api('/school/excursie/mijn',
    { code: o.g.code, token: o.g.token, klasCode: o.klas.code }))).body;
  const mijnE = (mijn.excursies || []).find(e => e.id === eid);
  assert.ok(mijnE, 'het gezin ziet de excursie: ' + JSON.stringify(mijn).slice(0, 200));
  assert.ok((mijnE.kijklog || []).length >= 1,
    'en wie er op de kaart keek: ' + JSON.stringify(mijnE.kijklog).slice(0, 200));
  assert.ok(mijnE.kinderen[0].plek, 'de eigen ouder ziet de plek van het eigen kind wel');
});

test('toestemming intrekken wist de plek meteen, en stoppen wist alles', async () => {
  const o = await opzet('B');

  const gemaakt = (await json(await lr(o.klas, '/school/excursie/maak',
    { titel: 'Naar de duinen', bestemming: 'Zandvoort', van: '2026-09-20', tot: '2026-09-20' }))).body;
  const eid = (gemaakt.excursie && gemaakt.excursie.id) || gemaakt.id;
  await lr(o.klas, '/school/excursie/start', { excursieId: eid });

  await api('/school/excursie/toestemming', {
    code: o.g.code, token: o.g.token, klasCode: o.klas.code, excursieId: eid,
    profielId: o.kindId, akkoord: true
  });
  await api('/school/excursie/gps', {
    code: o.g.code, token: o.kindToken, klasCode: o.klas.code, excursieId: eid,
    lat: 52.3730, lng: 4.5320
  });

  const voor = (await json(await lr(o.klas, '/school/excursie/kaart', { excursieId: eid }))).body;
  assert.equal((voor.plekken || []).length, 1, 'de plek staat op de kaart');

  /* INTREKKEN IS NIET "VANAF NU NIET MEER" MAAR WEG. Dat verschil is de hele
     belofte: een ouder die zich bedenkt, wist daarmee ook wat er al lag. */
  const ingetrokken = await json(await api('/school/excursie/toestemming', {
    code: o.g.code, token: o.g.token, klasCode: o.klas.code, excursieId: eid,
    profielId: o.kindId, akkoord: false
  }));
  assert.equal(ingetrokken.status, 200, 'de toestemming is ingetrokken');

  const na = (await json(await lr(o.klas, '/school/excursie/kaart', { excursieId: eid }))).body;
  assert.equal((na.plekken || []).length, 0, 'en de plek is meteen weg: ' + JSON.stringify(na.plekken));
  assert.ok((na.zonderToestemming || []).length >= 1,
    'het kind staat nu bij "zonder toestemming": ' + JSON.stringify(na.zonderToestemming));

  /* En met toestemming terug en een nieuwe plek: stoppen wist alles. */
  await api('/school/excursie/toestemming', {
    code: o.g.code, token: o.g.token, klasCode: o.klas.code, excursieId: eid,
    profielId: o.kindId, akkoord: true
  });
  await api('/school/excursie/gps', {
    code: o.g.code, token: o.kindToken, klasCode: o.klas.code, excursieId: eid,
    lat: 52.3731, lng: 4.5321
  });
  const weer = (await json(await lr(o.klas, '/school/excursie/kaart', { excursieId: eid }))).body;
  assert.equal((weer.plekken || []).length, 1, 'de plek is er weer');

  const gestopt = await json(await lr(o.klas, '/school/excursie/stop', { excursieId: eid }));
  assert.equal(gestopt.status, 200, 'de excursie wordt gestopt: ' + JSON.stringify(gestopt.body).slice(0, 160));

  /* De locaties bestaan precies zo lang als de excursie duurt. Daarna is de
     kaart niet leeg maar DICHT -- er valt niets meer te zien. */
  const dicht = await json(await lr(o.klas, '/school/excursie/kaart', { excursieId: eid }));
  assert.equal(dicht.status, 400, 'de kaart is daarna dicht: ' + JSON.stringify(dicht.body).slice(0, 160));

  const gezin = (await json(await api('/school/excursie/mijn',
    { code: o.g.code, token: o.g.token, klasCode: o.klas.code }))).body;
  const e = (gezin.excursies || []).find(x => x.id === eid);
  assert.equal(e.kinderen[0].plek, null, 'en het gezin ziet ook geen plek meer');
});

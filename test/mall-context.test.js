/* De laatste twee van de lijst: TIJD ALS CONTEXT en de ZAKELIJKE PRIJS.

   Waar EN wanneer: een zaak die pas na jouw vertrek weer plek heeft, hoort niet
   als beschikbaar te gelden. En een Business Pass koopt op inkoopprijs waar die
   bestaat -- uit de prijstabel die de groothandel al heeft, niet uit een tweede.

   Over personalisatie: die zit hier als CONTEXT die het lid zelf zet (een
   gekozen plek, een periode, de reismand waar hij in werkt) en niet als
   gedragsprofiel. Toets 6 houdt dat vast.

   Draai los: node --experimental-sqlite --test test/mall-context.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ctx-'));
let srv, base, lid, zakelijkLid, tokSerena;
const VANDAAG = new Date().toISOString().slice(0, 10);
const overEenJaar = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
const nogEenDag = new Date(Date.now() + 366 * 86400000).toISOString().slice(0, 10);

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = (await api('/api/auth/register', { name: 'Context Lid', email: 'ctx@x.nl', phone: '0612345671',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'lifestyle', pasApp: 'lifestyle' })).body.token;
  zakelijkLid = (await api('/api/auth/register', { name: 'Zaak Lid', email: 'zak@x.nl', phone: '0612345670',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
  const roster = await api('/api/supplier/roster', { code: 'SERENA' });
  const chef = (roster.body.staff || []).find(m => m.role === 'manager');
  tokSerena = (await api('/api/supplier/login', { code: 'SERENA', staffId: chef.id, pin: '1234' })).body.token;
  // de zaak is elke dag open, zodat de periode het enige is wat verschilt
  await api('/api/supplier/vak/uren-zet', { dagen: [true, true, true, true, true, true, true], van: '09:00', tot: '18:00' }, tokSerena);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const mijnSerena = async (body, token) =>
  (await api('/api/mall/zoek', { per: 60, ...(body || {}) }, token || lid)).body.items.filter(a => a.aanbieder.code === 'SERENA');

/* ---------------------------------------------------------------------------
   1. Tijd als context.
   --------------------------------------------------------------------------- */

test('1. zonder periode kijkt de Mall gewoon vooruit', async () => {
  const zonder = await mijnSerena({});
  assert.ok(zonder.length >= 1, 'de zaak staat in de Mall');
  const met = zonder.find(a => a.beschikbaar && /Eerste plek/.test(a.beschikbaar.tekst));
  assert.ok(met, 'en toont wanneer je terecht kunt');
});

test('2. binnen een periode telt alleen wat in die periode kan', async () => {
  const d = await api('/api/mall/zoek', { per: 60, van: VANDAAG, tot: VANDAAG }, lid);
  assert.equal(d.status, 200);
  assert.deepEqual(d.body.periode, { van: VANDAAG, tot: VANDAAG }, 'de periode komt terug in het antwoord');
  const mijn = d.body.items.filter(a => a.aanbieder.code === 'SERENA');
  for (const a of mijn) {
    if (a.beschikbaar && a.beschikbaar.datum) {
      assert.equal(a.beschikbaar.datum, VANDAAG, a.titel + ': een tijdvak binnen de gevraagde periode');
    }
  }
});

test('3. niets vrij in de periode is een antwoord, geen leegte', async () => {
  /* Een periode ver in de toekomst valt buiten het venster dat de agenda
     bekijkt. Dat hoort te leiden tot "niets vrij in deze periode" en niet tot
     een lege plek die er net zo uitziet als "deze zaak houdt geen agenda bij". */
  const mijn = await mijnSerena({ van: overEenJaar, tot: nogEenDag });
  assert.ok(mijn.length >= 1, 'de zaak staat er nog steeds; er wordt niets weggefilterd');
  const dienst = mijn.find(a => a.type === 'dienst' || a.type === 'offerte');
  assert.ok(dienst, 'er is een dienst om over te oordelen');
  assert.ok(dienst.beschikbaar, 'en die draagt een antwoord');
  assert.equal(dienst.beschikbaar.buitenPeriode, true);
  assert.equal(dienst.beschikbaar.tekst, 'Niets vrij in deze periode');
});

test('4. een reismand geeft haar plek en periode door aan de zoekopdracht', async () => {
  const reis = await api('/api/mall/lijst/nieuw', {
    naam: 'Ibiza-week', soort: 'reis', plek: 'Ibiza', van: overEenJaar, tot: nogEenDag
  }, lid);
  assert.equal(reis.status, 200);
  const d = await api('/api/mall/zoek', { lijst: reis.body.lijst.id }, lid);
  assert.equal(d.status, 200);
  assert.ok(d.body.plek && d.body.plek.slug === 'ibiza', 'de plek komt uit de reismand');
  assert.deepEqual(d.body.periode, { van: overEenJaar, tot: nogEenDag }, 'en de periode ook');

  // wat het lid zelf meestuurt wint van de reismand
  const eigen = await api('/api/mall/zoek', { lijst: reis.body.lijst.id, van: VANDAAG }, lid);
  assert.equal(eigen.body.periode.van, VANDAAG, 'een eigen datum gaat voor');
});

test('5. de reismand van een ander geeft geen context', async () => {
  const mijn = await api('/api/mall/lijsten', {}, lid);
  const id = mijn.body.lijsten[0].id;
  const d = await api('/api/mall/zoek', { lijst: id }, zakelijkLid);
  assert.equal(d.status, 200);
  assert.equal(d.body.periode, null, 'een lijst-id van iemand anders levert geen periode op');
  assert.equal(d.body.plek, null, 'en geen plek');
});

test('6. context komt uit wat het lid zelf zet, niet uit een profiel', () => {
  /* De personalisatie van deze Mall is expliciet: een gekozen plek, een
     gekozen periode, de reismand waarin je werkt. Er wordt niets onthouden om
     later mee te raden. Deze toets leest de route, want de belofte zit in wat
     er NIET staat. */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'member', 'mall-vindlaag.js'), 'utf8');
  const zoekroute = bron.slice(bron.indexOf("app.post('/api/mall/zoek'"), bron.indexOf("/* ---- bewaren"));
  assert.ok(zoekroute.length > 200, 'de zoekroute is gevonden, anders meet deze toets niets');
  for (const term of ['profiel', 'historie', 'geschiedenis', 'gedrag', 'voorkeur']) {
    assert.ok(!new RegExp(term, 'i').test(zoekroute), 'de zoekroute leest geen ' + term);
  }
  assert.match(zoekroute, /req\.body\.van/, 'de periode komt uit het verzoek');
  assert.match(zoekroute, /req\.body\.lijst/, 'en anders uit een lijst die het lid zelf aanwees');
});

/* ---------------------------------------------------------------------------
   2. De zakelijke prijs.
   --------------------------------------------------------------------------- */

test('7. de zakelijke prijs komt uit de prijstabel van de groothandel zelf', () => {
  /* Niet uit een tweede tabel en niet uit een opslagpercentage in de Mall: de
     Mall KIEST welke van de twee prijzen hij toont en rekent er geen. */
  const gh = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'groothandel.js'), 'utf8');
  assert.match(gh, /ghPrijsVoor: prijsVoor/, 'de groothandel deelt zijn prijsfunctie');
  const rtg = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'mall', 'aanbodrtg.js'), 'utf8');
  assert.match(rtg, /gh\.prijsVoor\(p, 'lid'\)/, 'de Mall vraagt de consumentprijs op');
  assert.match(rtg, /gh\.prijsVoor\(p, 'partner'\)/, 'en de inkoopprijs');
  const zoek = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'mall', 'zoek.js'), 'utf8');
  const keuze = zoek.slice(zoek.indexOf('const metPrijs'), zoek.indexOf('const bladzijde'));
  assert.ok(!/[*/]\s*1\.|opslag|marge|\* 1\d/.test(keuze), 'er wordt in de keuze niets gerekend');
});

test('8. een Business Pass ziet de inkoopprijs, een lid de consumentprijs', async () => {
  const { maakMall } = require('../server/kern/mall');
  const db = { data: {
    suppliers: [{ code: 'GH', name: 'De Groothandel', type: 'groothandel', city: 'Haarlem',
      groothandel: { producten: [{ id: 'p1', naam: 'Champagneglazen', inkoopPrijs: 3, consumentPrijs: 5, voorraad: 500, eenheid: 'per stuk' }] } }],
    supplierTypes: { groothandel: { label: 'Groothandel', caps: [] } },
    partnerTrips: [], markt: { ads: [] }
  } };
  require('../server/kern/werkvormen').haakAan(db);
  const mall = maakMall({ db, save() {}, crypto: require('crypto'), isRetail: () => false,
    haalThuis: () => null, haalLandVind: () => null,
    haalGroothandel: () => ({ ghIsGroothandel: (s) => s.type === 'groothandel',
      prijsVoor: (p, soort) => soort === 'lid' ? p.consumentPrijs : p.inkoopPrijs }) }).mall;

  const alsLid = mall.mallZoek({ q: 'champagneglazen' }).items[0];
  assert.ok(alsLid, 'het product staat in de Mall');
  assert.equal(alsLid.prijs.bedrag, 5, 'een lid ziet de consumentprijs');
  assert.ok(!alsLid.zakelijk, 'en is geen zakelijke weergave');

  const alsZaak = mall.mallZoek({ q: 'champagneglazen', zakelijk: true }).items[0];
  assert.equal(alsZaak.prijs.bedrag, 3, 'een zakelijke koper ziet de inkoopprijs');
  assert.equal(alsZaak.prijs.btw, 'ex', 'met de btw-vermelding erbij, anders is het een verkeerd getal');
  assert.equal(alsZaak.consumentPrijs.bedrag, 5, 'en de consumentprijs blijft zichtbaar');
  assert.equal(alsZaak.zakelijk, true);
});

test('9. zonder zakelijke prijs verandert er niets voor een zakelijke koper', async () => {
  /* Een boutique heeft geen inkoopprijs. Dan hoort de zakelijke weergave hem
     gewoon met zijn gewone prijs te tonen, en niet met een leeg of gehalveerd
     bedrag. */
  const lidPrijzen = (await api('/api/mall/zoek', { per: 60, type: 'product' }, lid)).body.items;
  const zaakPrijzen = (await api('/api/mall/zoek', { per: 60, type: 'product' }, zakelijkLid)).body.items;
  assert.ok(lidPrijzen.length >= 1, 'er zijn producten');
  for (const a of lidPrijzen) {
    const zelfde = zaakPrijzen.find(x => x.id === a.id);
    if (!zelfde || zelfde.zakelijk) continue;
    assert.deepEqual(zelfde.prijs, a.prijs, a.titel + ': zonder inkoopprijs blijft de prijs gelijk');
  }
});

test('10. je geeft jezelf geen zakelijke prijzen', async () => {
  /* Deze toets verwachtte eerst dat een registratie met tier "business" ook
     zakelijk zou inkopen. Dat is precies wat de registratieroute met opzet NIET
     doet: geen enkele registratie geeft zichzelf een betaalde pas
     (server/routes/auth/account.js). De inkoopprijs hangt daarmee aan een pas
     die een mens toekent, en dat is de goede kant op. */
  const alsLid = await api('/api/mall/zoek', { per: 5 }, lid);
  assert.equal(alsLid.body.zakelijk, false, 'een gewoon lid koopt als consument');

  const zelfbenoemd = await api('/api/mall/zoek', { per: 5 }, zakelijkLid);
  assert.equal(zelfbenoemd.body.zakelijk, false,
    'wie zich met tier "business" registreert krijgt geen inkoopprijzen; de pas komt van een mens');

  // en de stand staat in het antwoord, zodat een scherm hem kan tonen
  assert.equal(typeof alsLid.body.zakelijk, 'boolean', 'de zakelijke stand is een expliciet veld');
});

/* MAGNAAT: OVERNAMES -- een zaak rechtstreeks van een ander kopen.

   ZEVEN BEWERINGEN, en ze zijn alle zeven stil terug te draaien:

   1. EEN BOD KOMT VAN DE KOPER, EEN VEILING VAN DE VERKOPER. Twee kanten van
      dezelfde markt, en allebei verhuizen ze langs EEN weg.
   2. EEN PRIJS HEEFT EEN BAND, ook op een tegenbod.
   3. WIE KOOPT, KOOPT DE ZAAK MET ALLES ERAAN: contracten, hypotheek, belangen.
   4. EEN HYPOTHEEK REIST MEE MET HET PAND. Dit was een gat.
   5. ER IS GEEN VIJANDIGE OVERNAME. De eigenaar hoeft niet te verkopen.
   6. HET IS EEN OVERDRACHT EN GEEN SCHEPPING.
   7. DE KOPER ZIET VOORAF WAT HIJ ERBIJ KRIJGT.

   Draai los: node --experimental-sqlite --test test/spelovername.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const O = require('../server/kern/spellen/magnaat/overname');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');
const { waarde } = require('../server/kern/spellen/magnaat/waardering');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const kavelIn = (zone, n = 0) => kaart('ijmuiden').kavels.filter(k => k.zone === zone)[n];

function opstelling(id = 'p1') {
  const m = maakMagnaat();
  const p = { id, soort: 'magnaat', spelers: ['anna', 'boris', 'cem'], teams: [0, 1, 2], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of p.spelers) p.staat.geld[h] = 4000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 40, naam: 'Zeezicht' });
  const maand = (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } };
  maand(4);
  return { m, p, st: p.staat, V: p.staat.vestigingen.anna[0], maand };
}
const bied = (m, p, V, factor = 0.9, wie = 'boris') =>
  m.eco.zet(p, wie, { actie: 'overname-bod', vestiging: V.id, prijs: Math.round(waarde(V) * factor) });
/* Een hypotheek op het pand nemen, zo groot als de bank toestaat. */
function hypotheek(m, p, st, V, h = 'anna') {
  const o = m.eco.zicht(p, st, h).financiering.onderpandOffertes
    .find(x => x.soort === 'vastgoed' && x.vestiging === V.id);
  if (!o || o.max < 1000) return 0;
  const bedrag = Math.min(o.max, 200000);
  return m.eco.zet(p, h, { actie: 'krediet-opnemen', soort: 'vastgoed',
    bedrag, looptijd: 96, vestiging: V.id }).ok ? bedrag : 0;
}

/* ================= 1. twee kanten, een weg ================= */

test('een bod komt van de koper en de eigenaar antwoordt', () => {
  const { m, p, st, V } = opstelling();
  const eigen = m.eco.zet(p, 'anna', { actie: 'overname-bod', vestiging: V.id, prijs: 1000000 });
  assert.equal(eigen.status, 409, 'op je eigen zaak bied je niet');
  const r = bied(m, p, V);
  assert.ok(r.ok, r.error);
  assert.equal(r.wek, 'anna', 'de eigenaar wordt gewekt');
  assert.equal(m.eco.zicht(p, st, 'anna').overnames[0].aanZet, true, 'en staat aan zet');
  assert.equal(m.eco.zicht(p, st, 'boris').overnames[0].aanZet, false, 'de bieder niet');
  const zelf = m.eco.zet(p, 'boris', { actie: 'overname-antwoord', id: r.id, antwoord: 'ja' });
  assert.equal(zelf.status, 409, 'je tekent je eigen bod niet');
});

test('de verhuizing loopt langs dezelfde weg als een veiling', () => {
  /* Twee wegen om een vestiging van eigenaar te laten wisselen zijn twee sets
     randgevallen -- de hypotheek, de contracten, het contract-met-jezelf -- en
     die gaan uiteen lopen. Ze delen `verhuis` in ./afscheid.js. */
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/magnaat/overname.js'), 'utf8');
  assert.ok(!/st\.vestigingen\[[^\]]+\]\s*=/.test(bron), 'de overname verplaatst zelf een vestiging');
  assert.ok(!/kavelBezet/.test(bron), 'en zet zelf een kavel op naam');
  const veiling = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/magnaat/veiling.js'), 'utf8');
  assert.ok(/verhuis\(/.test(veiling), 'de veiling gebruikt dezelfde weg');
});

/* ================= 2. een prijs heeft een band ================= */

test('een bod buiten de band is geen bod, ook niet als tegenbod', () => {
  const { m, p, st, V } = opstelling();
  const laag = m.eco.zet(p, 'boris', { actie: 'overname-bod', vestiging: V.id, prijs: 1000 });
  assert.equal(laag.status, 409);
  assert.match(laag.error, /staat op/);
  assert.equal(m.eco.zet(p, 'boris', { actie: 'overname-bod', vestiging: V.id,
    prijs: Math.round(waarde(V) * 10) }).status, 409, 'ook naar boven');

  const r = bied(m, p, V);
  const wild = m.eco.zet(p, 'anna', { actie: 'overname-antwoord', id: r.id, antwoord: 'tegen',
    prijs: Math.round(waarde(V) * 9) });
  assert.equal(wild.status, 409, 'een tegenbod staat onder dezelfde band');
  assert.ok(m.eco.zet(p, 'anna', { actie: 'overname-antwoord', id: r.id, antwoord: 'tegen',
    prijs: Math.round(waarde(V) * 1.3) }).ok);
});

test('na een aantal rondes is het ja of nee', () => {
  const { m, p, st, V } = opstelling();
  const r = bied(m, p, V);
  let beurt = 'anna';
  for (let i = 0; i < O.MAX_RONDEN + 2; i++) {
    const uit = m.eco.zet(p, beurt, { actie: 'overname-antwoord', id: r.id, antwoord: 'tegen',
      prijs: Math.round(waarde(V) * (1 + (i % 3) * 0.1)) });
    if (!uit.ok) { assert.match(uit.error, /ja of nee/); return; }
    beurt = beurt === 'anna' ? 'boris' : 'anna';
  }
  assert.fail('het onderhandelen liep door zonder grens');
});

/* ================= 3 & 4. met alles eraan, inclusief de hypotheek ========= */

test('een hypotheek reist mee met het pand', () => {
  /* DIT WAS EEN GAT. Een speler kon een verhypothekeerd pand verkopen, de
     opbrengst houden en de lening laten staan -- met zekerheid op een gebouw dat
     vanaf dat moment van een ander was. De bank hield dus onderpand bij iemand
     die nergens getekend had. */
  const { m, p, st, V } = opstelling();
  const geleend = hypotheek(m, p, st, V);
  assert.ok(geleend > 0, 'er staat een hypotheek op');
  const schuldVoor = st.leningen.filter(l => l.status === 'loopt').reduce((n, l) => n + l.restant, 0);
  assert.ok(schuldVoor > 0);

  const r = bied(m, p, V, 1.2);
  assert.ok(r.ok, r.error);
  const kasVoor = st.geld.anna;
  // de EIGENAAR antwoordt op een bod; de bieder is zelf aan zet en tekent niet
  const ja = m.eco.zet(p, 'anna', { actie: 'overname-antwoord', id: r.id, antwoord: 'ja' });
  assert.ok(ja.ok, ja.error);

  assert.ok(ja.afgelost > 0, 'de hypotheek is uit de opbrengst afgelost: ' + ja.afgelost);
  assert.equal(st.leningen.filter(l => l.status === 'loopt' && l.onderpand === V.id).length, 0,
    'er rust geen lening meer op een pand van een ander');
  assert.equal(Math.round(st.geld.anna - kasVoor), r.prijs - ja.afgelost,
    'en de verkoper krijgt wat er na de bank overblijft');
});

test('de geldpompkeuring op de hypotheekverkoop klopt', () => {
  const { meet } = require('../scripts/magnaat-pomp');
  const r = meet('hypotheekvlucht', 12);
  assert.equal(r.klacht, null, r.klacht);
});

test('de contracten verhuizen mee', () => {
  const { m, p, st, V, maand } = opstelling();
  m.eco.zet(p, 'cem', { actie: 'open', kavel: kavelIn('terrein').id, sector: 'logistiek', omvang: 12, naam: 'Atlas' });
  maand(1);
  const C = st.vestigingen.cem[0];
  const c = m.eco.zet(p, 'cem', { actie: 'contract-voorstel', mijn: C.id, hun: V.id, soort: 'vervoer',
    eenheden: 60, bedrag: 3200, looptijd: 20, eis: 0, boete: 400, vooraf: 0, exclusief: false });
  assert.ok(c.ok, c.error);
  assert.ok(m.eco.zet(p, 'anna', { actie: 'contract-antwoord', id: c.id, antwoord: 'ja' }).ok);

  const r = bied(m, p, V, 1.1);
  const ja = m.eco.zet(p, 'anna', { actie: 'overname-antwoord', id: r.id, antwoord: 'ja' });
  assert.ok(ja.ok, ja.error);
  assert.ok(ja.contracten >= 1, 'er ging een contract mee');
  const na = st.contracten.find(x => x.id === c.id);
  assert.equal(na.afnemer, 'boris', 'de koper staat nu aan de afnemerskant');
  assert.equal(na.status, 'loopt', 'en het contract loopt door');
});

test('de koper ziet vooraf wat hij erbij krijgt', () => {
  const { m, p, st, V } = opstelling();
  hypotheek(m, p, st, V);
  const r = bied(m, p, V, 1.2);
  const beeld = m.eco.zicht(p, st, 'boris').overnames[0];
  assert.ok(beeld.bagage, 'er staat bagage bij');
  assert.ok(beeld.bagage.hypotheek > 0, 'met de hypotheek erop');
  assert.equal(typeof beeld.bagage.contracten, 'number');
  assert.equal(typeof beeld.bagage.vergeven, 'number');
  assert.ok(beeld.bagage.nettoVoorVerkoper < r.prijs,
    'en wat de verkoper er netto aan overhoudt, want de bank gaat voor');
  assert.equal(beeld.rekenwaarde, Math.round(waarde(V)));
});

/* ================= 5. geen vijandige overname ================= */

test('de eigenaar hoeft niet te verkopen', () => {
  const { m, p, st, V } = opstelling();
  const r = bied(m, p, V, 2.4);
  assert.ok(r.ok, 'zelfs een hoog bod');
  assert.ok(m.eco.zet(p, 'anna', { actie: 'overname-antwoord', id: r.id, antwoord: 'nee' }).ok);
  assert.equal(st.vestigingen.anna.length, 1, 'de zaak blijft van anna');
  assert.equal(m.eco.zicht(p, st, 'anna').overnames.length, 0, 'en het bod is van tafel');
});

test('een bod op een zaak die inmiddels verkocht is, vervalt', () => {
  const { m, p, st, V } = opstelling();
  const vanBoris = bied(m, p, V, 0.9, 'boris');
  const vanCem = bied(m, p, V, 1.4, 'cem');
  assert.ok(vanBoris.ok && vanCem.ok, 'twee bieders');
  assert.ok(m.eco.zet(p, 'anna', { actie: 'overname-antwoord', id: vanCem.id, antwoord: 'ja' }).ok);
  assert.equal(st.vestigingen.cem.length, 1);
  /* EERST KIJKEN, DAN PROBEREN. Andersom ruimt de toets zelf op: een late
     poging om te tekenen loopt op "die zaak is inmiddels van een ander" en zet
     het bod daarbij op vervallen -- en dan lijkt de opruiming te werken terwijl
     hij weggehaald is. Precies daarop overleefde een mutatie deze toets. */
  assert.equal(m.eco.zicht(p, st, 'boris').overnames.length, 0,
    'het andere bod staat niet meer op het scherm');
  const laat = m.eco.zet(p, 'anna', { actie: 'overname-antwoord', id: vanBoris.id, antwoord: 'ja' });
  assert.equal(laat.status, 409, 'en kan ook niet alsnog');
});

/* ================= 6. overdracht, geen schepping ================= */

test('een overname verplaatst geld en maakt er geen', () => {
  const { m, p, st, V } = opstelling();
  const r = bied(m, p, V, 1.1);
  const samenVoor = st.geld.anna + st.geld.boris + st.geld.cem;
  assert.ok(m.eco.zet(p, 'anna', { actie: 'overname-antwoord', id: r.id, antwoord: 'ja' }).ok);
  const samenNa = st.geld.anna + st.geld.boris + st.geld.cem;
  assert.equal(Math.round(samenNa), Math.round(samenVoor), 'de som blijft gelijk');
});

test('je kunt niet bieden met geld dat je niet hebt', () => {
  const { m, p, st, V } = opstelling();
  st.geld.boris = 1000;
  const r = m.eco.zet(p, 'boris', { actie: 'overname-bod', vestiging: V.id,
    prijs: Math.round(waarde(V)) });
  assert.equal(r.status, 409);
  assert.match(r.error, /niet op de rekening/);
});

test('overnemen is een vrije actie', () => {
  const d = maakMagnaat().spel;
  for (const naam of ['overname-bod', 'overname-antwoord', 'overname-intrekken'])
    assert.ok(d.buitenBeurt.includes(naam), naam + ' hoort buiten je beurt te mogen');
});

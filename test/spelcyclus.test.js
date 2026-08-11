/* MAGNAAT: DE ECONOMISCHE CYCLUS -- de wind die over de hele stad waait.

   ZEVEN BEWERINGEN, en ze zijn alle zeven stil terug te draaien:

   1. DE LOSSE DRAAD IS AANGESLOTEN. `st.cyclus` stond al in de renteformule van
      de bank en werd door niets gevoed; hij bleef nul.
   2. HET IS EEN GOLF EN GEEN RUIS. Vier fasen, in volgorde, die zich herhalen.
   3. HIJ IS DETERMINISTISCH, maar niet voor elke partij hetzelfde.
   4. JE ZIET HEM AANKOMEN. Zonder vooruitblik is een cyclus geen mechaniek maar
      pech.
   5. HIJ IS PUBLIEK. Er is geen versie van dit spel waarin de ene ondernemer wel
      weet dat het slecht gaat en de andere niet.
   6. HIJ RAAKT DE VRAAG EN DE PRIJS VAN GELD, en verder niets.
   7. HIJ BEPAALT NIET WIE ER WINT. De band is smal genoeg dat spelen zwaarder
      weegt dan timing.

   Draai los: node --experimental-sqlite --test test/spelcyclus.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const C = require('../server/kern/spellen/magnaat/cyclus');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const kavelIn = (zone, n = 0) => kaart('ijmuiden').kavels.filter(k => k.zone === zone)[n];

function opstelling(id = 'p1') {
  const m = maakMagnaat();
  const p = { id, soort: 'magnaat', spelers: ['anna', 'boris'], teams: [0, 1], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of p.spelers) p.staat.geld[h] = 2000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 40 });
  return { m, p, st: p.staat, A: p.staat.vestigingen.anna[0] };
}
const maand = (m, p, n = 1) => {
  for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); }
};

/* ================= 1. de losse draad is aangesloten ================= */

test('st.cyclus wordt werkelijk gevoed', () => {
  /* DIT IS DE HELE AANLEIDING. `st.cyclus` stond maanden in `renteVoor` van
     ./bank.js en werd nergens gezet -- hij bleef nul, dus de bank rekende altijd
     met een neutrale conjunctuur. De formule zag er compleet uit en meette
     niets. */
  const { m, p, st } = opstelling();
  assert.equal(st.cyclus, undefined, 'aan het begin staat er nog niets');
  maand(m, p, 1);
  assert.equal(typeof st.cyclus, 'number', 'na een maand staat de stand op de staat');
  const standen = new Set();
  for (let i = 0; i < 48; i++) { maand(m, p, 1); standen.add(st.cyclus); }
  assert.ok(standen.size >= 3, 'en hij beweegt: ' + [...standen].join(', '));
});

test('de bank rekent de conjunctuur werkelijk mee', () => {
  /* Langs de OFFERTE en niet langs de formule: dat is het getal dat een speler
     werkelijk te zien krijgt, en het is de enige plek waar `st.cyclus` gelezen
     wordt. Twee standen op dezelfde staat, zodat alleen de conjunctuur
     verschilt. */
  const { m, p, st } = opstelling();
  maand(m, p, 2);
  const offerte = () => m.eco.zicht(p, st, 'anna').financiering.offertes
    .find(o => o.soort === 'investering');
  st.cyclus = -0.6;
  const ruim = offerte();
  st.cyclus = 1.2;
  const krap = offerte();
  assert.ok(krap.rente > ruim.rente, 'in een recessie is geld duurder: ' +
    ruim.rente.toFixed(4) + ' -> ' + krap.rente.toFixed(4));
  assert.ok(krap.stap.cyclus > ruim.stap.cyclus, 'en het staat als eigen post in de opbouw');
});

/* ================= 2. het is een golf en geen ruis ================= */

test('de vier fasen volgen elkaar in volgorde op en herhalen zich', () => {
  const rij = [];
  for (let mnd = 0; mnd < 120; mnd++) rij.push(C.faseVan('p1', mnd).fase.sleutel);
  const wissels = rij.filter((f, i) => i === 0 || f !== rij[i - 1]);
  assert.ok(wissels.length >= 4, 'er gebeurt iets: ' + wissels.join(' '));
  for (let i = 1; i < wissels.length; i++) {
    const vorige = C.FASELIJST.indexOf(wissels[i - 1]);
    assert.equal(wissels[i], C.FASELIJST[(vorige + 1) % C.FASELIJST.length],
      'na ' + wissels[i - 1] + ' hoort ' + C.FASELIJST[(vorige + 1) % C.FASELIJST.length] +
      ' te komen, niet ' + wissels[i]);
  }
  assert.ok(new Set(rij).size === C.FASELIJST.length, 'en alle vier komen langs');
});

test('een fase duurt maanden en geen enkele maand', () => {
  /* Anders is het geen conjunctuur maar geflikker. */
  for (const id of ['p1', 'p2', 'p3']) {
    const per = C.faseVan(id, 0).per;
    assert.ok(per >= 5, id + ' wisselt elke ' + per.toFixed(1) + ' maanden van fase');
  }
});

/* ================= 3. deterministisch, maar niet overal hetzelfde ========= */

test('dezelfde partij geeft altijd dezelfde conjunctuur', () => {
  const rij = (id) => Array.from({ length: 60 }, (_, m) => C.faseVan(id, m).fase.sleutel).join(',');
  assert.equal(rij('p1'), rij('p1'));
  assert.notEqual(rij('p1'), rij('p2'), 'twee campagnes horen niet dezelfde golf te krijgen');
  /* EN NIET ALLEMAAL IN DEZELFDE FASE BEGINNEN. Een campagne die in een recessie
     opent is een andere campagne, en dat hoort te kunnen. De vorige regel dekte
     dit niet: de LENGTE verschilt per partij, dus twee reeksen lopen sowieso
     uiteen -- ook als iedereen in bloei begint. Die mutatie kwam er langs. */
  const starts = new Set(Array.from({ length: 30 }, (_, i) => C.start('p' + i)));
  assert.ok(starts.size >= 3, 'campagnes beginnen in verschillende fasen: ' + [...starts].join(','));
  const lengtes = new Set(Array.from({ length: 30 }, (_, i) => C.ronde('p' + i)));
  assert.ok(lengtes.size >= 5, 'en hun golven duren niet allemaal even lang');
});

test('tien maanden in een keer geeft dezelfde stand als tien maanden los', () => {
  const draai = (stappen) => {
    const { m, p, st, A } = opstelling('zelfde');
    for (const n of stappen) maand(m, p, n);
    return { cyclus: st.cyclus, geld: Math.round(st.geld.anna),
      omzet: Math.round(A.omzetTotaal || 0), reputatie: Math.round(A.reputatie) };
  };
  assert.deepEqual(draai([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]), draai([10]),
    'de klok rekent bij; hij tikt niet');
});

/* ================= 4. je ziet hem aankomen ================= */

test('het beeld zegt waar je staat, hoe lang nog, en wat er hierna komt', () => {
  const b = C.beeld('p1', 5);
  assert.ok(C.FASELIJST.includes(b.fase));
  assert.ok(b.nog >= 1, 'hoeveel maanden deze fase nog duurt');
  assert.ok(b.hierna && C.FASELIJST.includes(b.hierna.fase), 'en wat er hierna komt');
  const i = C.FASELIJST.indexOf(b.fase);
  assert.equal(b.hierna.fase, C.FASELIJST[(i + 1) % C.FASELIJST.length]);
  assert.equal(b.fasen.length, C.FASEN.length, 'plus de hele reeks, zodat je kunt plannen');
});

test('de vooruitblik klopt met wat er werkelijk gebeurt', () => {
  /* Zonder deze toets kan `nog` een getal zijn dat nergens op slaat -- en dan is
     de vooruitblik erger dan geen vooruitblik. */
  for (const id of ['p1', 'p2']) {
    for (const mnd of [0, 7, 19, 33]) {
      const b = C.beeld(id, mnd);
      assert.equal(C.faseVan(id, mnd + b.nog - 1).fase.sleutel, b.fase,
        id + '@' + mnd + ': de laatste maand van de fase hoort er nog bij te horen');
      assert.equal(C.faseVan(id, mnd + b.nog).fase.sleutel, b.hierna.fase,
        id + '@' + mnd + ': daarna hoort ' + b.hierna.fase + ' te beginnen');
    }
  }
});

/* ================= 5. hij is publiek ================= */

test('iedereen ziet dezelfde conjunctuur, ook een gedeeld scherm', () => {
  const { m, p, st } = opstelling();
  maand(m, p, 3);
  const anna = m.eco.zicht(p, st, 'anna').cyclus;
  const boris = m.eco.zicht(p, st, 'boris').cyclus;
  assert.deepEqual(anna, boris, 'een conjunctuur is van de stad en niet van jou');
  assert.deepEqual(m.eco.publiek(p, st).cyclus, anna, 'en hij staat ook op het gedeelde scherm');
});

/* ================= 6. hij raakt de vraag en de prijs van geld ============= */

test('de vraag beweegt met de conjunctuur mee', () => {
  /* TWEE CORRECTIES OP DEZE TOETS, en allebei omdat hij iets anders mat dan hij
     beweerde. De eerste versie middelde de verkopen per fase over vijf jaar --
     maar een fase duurt zeven tot elf maanden, dus elke fase dekt andere
     SEIZOENEN, en dan meet je het seizoen. De tweede vergeleek per kalendermaand,
     en dat hielp maar half: over honderdtwintig maanden bewegen reputatie,
     bezetting en de buren ook, dus zes van de twaalf maanden kwamen er andersom
     uit. Beide keren overleefde het wegnemen van de hele conjunctuur de toets.

     Wat wel te isoleren is, is de bedrading zelf. De cyclus komt de maandloop
     binnen langs `C.vraagFactor`, en die functie is hier te vervangen -- dan
     staat alles gelijk behalve de golf. */
  const C2 = require('../server/kern/spellen/magnaat/cyclus');
  const echt = C2.vraagFactor;
  const meet = (factor) => {
    C2.vraagFactor = () => factor;
    try {
      const { m, p, st } = opstelling('gelijk');
      maand(m, p, 6);
      /* GEVRAAGD EN NIET VERKOCHT. Een zaak die op maat gebouwd is zit tegen zijn
         capaciteit aan, dus extra vraag komt er als `gemist` uit en niet als
         omzet -- en dan meet je de omvang van het pand in plaats van de golf.
         Verkocht plus gemist is wat er aan de deur stond. */
      const r = st.laatste.anna.regels[0];
      return r.eenheden + r.gemist;
    } finally { C2.vraagFactor = echt; }
  };
  const bloei = meet(1.08), recessie = meet(0.93);
  assert.ok(bloei > recessie, 'in bloei staat er meer aan de deur: ' + bloei + ' tegen ' + recessie);
  assert.equal(meet(1.08), bloei, 'en dezelfde golf geeft dezelfde uitkomst');
  /* En de maandloop pakt de ECHTE functie, niet een vaste een: zonder deze regel
     zou een hard ingetypte 1 deze toets overleven. */
  assert.ok(Math.abs(bloei / recessie - 1.08 / 0.93) < 0.08,
    'en het verschil is precies de golf: ' + (bloei / recessie).toFixed(3));
  /* En de ECHTE functie beweegt ook. Deze toets vervangt hem om te isoleren, dus
     zonder deze regel overleeft een `vraagFactor` die altijd 1 teruggeeft hem
     gewoon -- de mutatie raakt dan alleen de vervangen versie. */
  const echteWaarden = new Set(Array.from({ length: 48 }, (_, mnd) => echt('p1', mnd)));
  assert.ok(echteWaarden.size >= 3, 'de golf staat niet stil: ' + [...echteWaarden].join(', '));
});

test('hij raakt de kosten, de capaciteit en de risicos niet', () => {
  /* Elke post die een cyclus er nog bij pakt maakt hem een tweede economie in
     plaats van een golf eroverheen. */
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/magnaat/cyclus.js'), 'utf8');
  for (const veld of ['inkoop', 'lonen', 'personeel', 'onderhoud', 'capaciteit', 'risico'])
    assert.ok(!new RegExp('\\b' + veld + '\\s*[:=]').test(bron),
      'de cyclus raakt ' + veld + ' aan, en dat hoort hij niet te doen');
  for (const f of C.FASEN)
    assert.deepEqual(Object.keys(f).sort(), ['geld', 'naam', 'sleutel', 'uitleg', 'vraag'],
      f.sleutel + ' heeft een uitgang die er niet hoort te zijn');
});

/* ================= 7. hij bepaalt niet wie er wint ================= */

test('de band is smal genoeg dat spelen zwaarder weegt dan timing', () => {
  /* DE BALANSEIS. Een cyclus die het verschil maakt tussen winnen en verliezen
     is geen economie maar een dobbelsteen met vier zijden. Het verschil tussen
     de beste en de slechtste fase hoort kleiner te zijn dan het verschil tussen
     goed en slecht spelen. */
  const vraag = C.FASEN.map(f => f.vraag);
  const spreiding = Math.max(...vraag) / Math.min(...vraag);
  assert.ok(spreiding < 1.25, 'van bloei tot recessie scheelt ' +
    Math.round((spreiding - 1) * 100) + '% vraag; dat is te veel om te overleven');
  assert.ok(spreiding > 1.08, 'en het moet wel te merken zijn');
});

test('niets doen verliest ook in een bloeiperiode', () => {
  const S = require('../scripts/magnaat-strateeg');
  let gewonnen = 0;
  for (let o = 0; o < 6; o++) {
    const stand = S.campagne('niets', 'onderhoud', o);
    if (stand.find(x => x.codenaam === 'a').vermogen > stand.find(x => x.codenaam === 'b').vermogen) gewonnen++;
  }
  assert.equal(gewonnen, 0, 'geen enkele conjunctuur maakt niets doen de beste zet');
});

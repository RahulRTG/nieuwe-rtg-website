/* MAGNAAT: SUPPLY NETWORK v1 -- niets wordt verbruikt zonder bron.

   ECONOMIE.md, de eerste wet. Tot nu toe kocht een zaak geen goederen maar had
   hij een INKOOPPOST: een percentage van zijn eigen omzet dat nergens vandaan
   kwam en nergens heen ging. scripts/magnaat-oorsprong.js mat dat op 0%.

   ZEVEN BEWERINGEN, en de zesde is de eigenlijke:

   1. WAT ER GEKOCHT WORDT KOMT ERGENS VANDAAN, of het heet import.
   2. CAPACITEIT IS EINDIG. Een leverancier die vol zit, levert niet meer.
   3. BIJ SCHAARSTE WORDT PRO RATA VERDEELD -- niet wie het eerst komt.
   4. EEN CONTRACT IS VOORRANG EN GEEN KORTING.
   5. DE POST WORDT VERPLAATST EN NIET VERGROOT.
   6. UITVAL REIST. Valt een leverancier weg, dan verandert er iets bij zijn
      afnemers -- en zonder die uitval zijn twee werelden exact gelijk.
   7. ER KOMT GEEN EURO EN GEEN EENHEID UIT HET NIETS.

   Draai los: node --experimental-sqlite --test test/spelketennetwerk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const KETEN = require('../server/kern/spellen/magnaat/keten');
const HG = require('../server/kern/spellen/magnaat/handelsgoed');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');
const { capaciteit } = require('../server/kern/spellen/magnaat/maat');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const kavelIn = (zone, n = 0) => kaart('ijmuiden').kavels.filter(k => k.zone === zone)[n];

/* Een stad met een restaurant en een of twee groothandels. Goederen is de
   krappe soort in IJmuiden (scripts/magnaat-oorsprong.js), dus daar is de
   schaarste te zien. */
function stad(id, { leveranciers = 1, omvang = 40 } = {}) {
  const m = maakMagnaat();
  const spelers = ['anna', 'boris', 'chris'];
  const p = { id, soort: 'magnaat', spelers, teams: [0, 1, 2], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of spelers) p.staat.geld[h] = 8000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id,
    sector: 'horeca', omvang: 60, naam: 'Zeezicht' });
  if (leveranciers > 0)
    m.eco.zet(p, 'boris', { actie: 'open', kavel: kavelIn('centrum').id,
      sector: 'retail', omvang, naam: 'Noordzee Groothandel' });
  if (leveranciers > 1)
    m.eco.zet(p, 'chris', { actie: 'open', kavel: kavelIn('centrum', 1).id,
      sector: 'retail', omvang, naam: 'Tweede Bron' });
  return { m, p, st: p.staat,
    zaak: (h) => (p.staat.vestigingen[h] || [])[0],
    maand: (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } } };
}
const spoorVan = (o, h) => ((o.st.keten || {}).perAfnemer || {})[o.zaak(h).id] || {};

/* ============ 1. alles heeft een bron, of het heet import ============ */

test('wat een zaak koopt komt van een leverancier of van buiten -- nooit uit het niets', () => {
  const o = stad('k-1');
  o.maand(4);
  const g = spoorVan(o, 'anna').goederen;
  assert.ok(g, 'er hoort een spoor te zijn voor goederen: ' + JSON.stringify(o.st.keten));
  assert.ok(g.nodig > 0);
  /* DE SOM MOET KLOPPEN: wat je nodig had is wat je lokaal kreeg plus wat er
     is ingevoerd. Er is geen derde bron. */
  assert.ok(Math.abs((g.lokaal + g.ingevoerd) - g.nodig) < 0.001,
    'lokaal + import hoort de behoefte te zijn: ' + JSON.stringify(g));
  assert.ok(g.lokaal > 0, 'en met een groothandel in de stad komt er echt iets vandaan');
});

test('en zonder leverancier is alles import -- met zoveel woorden', () => {
  const o = stad('k-2', { leveranciers: 0 });
  o.maand(4);
  const g = spoorVan(o, 'anna').goederen;
  assert.ok(g, JSON.stringify(o.st.keten));
  assert.equal(Math.round(g.lokaal), 0, 'niemand levert goederen in deze stad');
  assert.ok(g.ingevoerd > 0, 'dus komt het van buiten, en dat staat er');
});

/* ============ 2 en 3. capaciteit is eindig, en wordt pro rata verdeeld ============ */

test('een kleine leverancier dekt niet de hele stad', () => {
  const klein = stad('k-3', { omvang: 8 });
  const groot = stad('k-3', { omvang: 90 });
  klein.maand(4); groot.maand(4);
  const a = spoorVan(klein, 'anna').goederen, b = spoorVan(groot, 'anna').goederen;
  assert.ok(a.ingevoerd > b.ingevoerd,
    'een kleine groothandel laat meer over voor de import: '
    + JSON.stringify(a) + ' tegen ' + JSON.stringify(b));
  assert.ok((klein.st.keten.krapte.goederen || 0) > (groot.st.keten.krapte.goederen || 0),
    'en de stad is krapper');
});

test('bij schaarste krijgt iedereen hetzelfde DEEL, niet wie het eerst komt', () => {
  /* Anders bepaalt de volgorde in een object wie er omvalt -- precies de
     redenering waarmee maand.js de contracten al pro rata verdeelt. */
  const o = stad('k-4', { omvang: 6 });
  o.m.eco.zet(o.p, 'chris', { actie: 'open', kavel: kavelIn('boulevard', 1).id,
    sector: 'horeca', omvang: 60, naam: 'Tweede Zaak' });
  o.maand(4);
  const a = spoorVan(o, 'anna').goederen, c = spoorVan(o, 'chris').goederen;
  assert.ok(a && c, JSON.stringify(o.st.keten.perAfnemer));
  assert.ok((o.st.keten.krapte.goederen || 0) > 0, 'deze stad hoort krap te zijn');
  const deelA = a.lokaal / a.nodig, deelC = c.lokaal / c.nodig;
  assert.ok(Math.abs(deelA - deelC) < 0.001,
    'beide afnemers krijgen hetzelfde deel: ' + deelA.toFixed(3) + ' tegen ' + deelC.toFixed(3));
});

/* ============ 5. de post wordt verplaatst en niet vergroot ============ */

test('de leverancier krijgt precies wat de afnemer betaalt', () => {
  /* Zonder deze gelijkheid maakt de laag geld. */
  const o = stad('k-5');
  o.maand(4);
  const betaald = Object.values(o.st.keten.perAfnemer)
    .reduce((n, per) => n + Object.values(per).reduce((x, y) => x + (y.bedrag || 0), 0), 0);
  const ontvangen = Object.values(o.st.keten.perLeverancier)
    .reduce((n, x) => n + (x.bedrag || 0), 0);
  assert.ok(betaald > 0, 'er hoort iets betaald te zijn');
  assert.ok(Math.abs(betaald - ontvangen) < 0.01,
    'wat de afnemers betalen is wat de leveranciers ontvangen: '
    + Math.round(betaald) + ' tegen ' + Math.round(ontvangen));
});

test('en die betaling gaat ECHT van de kas af', () => {
  /* DEZE TOETS ONTBRAK, en een mutatie liet dat zien: `st.geld[h] -= bedrag`
     weghalen brak niets. De toets hierboven vergelijkt namelijk het SPOOR met
     zichzelf -- twee getallen die allebei uit dezelfde berekening komen. Dan
     meet je de boekhouding en niet de kas.

     De leverancier wordt vanzelf betaald (`leverOmzet` in stap.js); zou de
     afnemer NIET betalen, dan verschijnt er elke maand geld uit het niets. */
  const st = { geld: { anna: 1000, boris: 500 } };
  const spoor = { perAfnemer: {
    v1: { goederen: { bedrag: 120 }, vervoer: { bedrag: 30 } },
    v2: { goederen: { bedrag: 200 } }
  } };
  const totaal = KETEN.betaal(st, spoor, (vid) => (vid === 'v1' ? 'anna' : 'boris'));
  assert.equal(totaal, 350);
  assert.equal(st.geld.anna, 850, 'anna betaalde 150');
  assert.equal(st.geld.boris, 300, 'boris betaalde 200');
});

test('en de maandloop roept die betaling ook echt aan', () => {
  /* DE TOETS HIERBOVEN IS EEN EENHEIDSTOETS: hij roept `betaal` zelf aan. Een
     mutatie liet zien wat daar dan nog onder zat -- haal de aanroep uit
     magnaat/maand-bevoorrading.js weg en alle elf toetsen bleven groen, terwijl
     de afnemers niets meer betaalden en de leveranciers wel omzet kregen. Een
     laag die alleen buiten het spel om klopt, klopt niet.

     DE IDENTITEIT: wat er van de kas van een speler af gaat is precies wat zijn
     maandregels zeggen, MINUS wat hij lokaal heeft ingekocht -- want die
     betaling loopt niet via een regel maar rechtstreeks (./keten.js `betaal`),
     en ./stap.js heeft dat deel al van zijn inkooppost afgetrokken. Blijft er
     iets over, dan komt er geld ergens vandaan waar het niet hoort. */
  const o = stad('k-5b');
  o.maand(4);
  const voor = o.st.geld.anna;
  o.st.gerekendTot -= o.st.maandMs;
  const verslagen = o.m.eco.bijrekenen(o.p);
  const regels = verslagen[verslagen.length - 1].perSpeler.anna;
  const som = regels.reduce((n, r) => n + (r.resultaat || 0), 0);
  const betaald = Object.values(spoorVan(o, 'anna'))
    .reduce((n, x) => n + (x.bedrag || 0), 0);
  assert.ok(betaald > 0, 'er hoort deze maand lokaal ingekocht te zijn');
  assert.ok(Math.abs((o.st.geld.anna - voor) - (som - betaald)) < 0.5,
    'kasverschil hoort de maandregels min de lokale inkoop te zijn: '
    + Math.round(o.st.geld.anna - voor) + ' tegen ' + Math.round(som - betaald));
});

/* ============ 6. uitval reist ============ */

test('een leverancier die wegvalt verandert de wereld van zijn afnemer', () => {
  /* DE EIGENLIJKE TOETS VAN DEZE LAAG, en hij heeft twee helften die allebei
     moeten kloppen:

       ZONDER de uitval zijn twee werelden EXACT gelijk -- anders meet je ruis;
       MET de uitval verandert er iets bij iemand die er niet bij was.

     Pas als allebei waar is, is er causaliteit bewezen in plaats van
     waargenomen. */
  const rustig = stad('k-6');
  const ramp = stad('k-6');
  rustig.maand(4); ramp.maand(4);

  const a = rustig.st.laatste.anna.regels[0], b = ramp.st.laatste.anna.regels[0];
  for (const veld of ['omzet', 'inkoop', 'derving', 'resultaat'])
    assert.equal(a[veld], b[veld], veld + ' hoort gelijk te zijn zolang er niets gebeurt');
  const voor = spoorVan(ramp, 'anna').goederen.lokaal;
  assert.ok(voor > 0, 'er liep een keten');

  /* De groothandel gaat dicht. Geen event, geen vlag: de zaak is er niet meer. */
  ramp.m.eco.zet(ramp.p, 'boris', { actie: 'sluiten', id: ramp.zaak('boris').id });
  rustig.maand(2); ramp.maand(2);

  const na = spoorVan(ramp, 'anna').goederen;
  assert.equal(Math.round(na.lokaal), 0, 'zijn leverancier is weg');
  assert.ok(na.ingevoerd > 0, 'dus komt het nu van buiten: ' + JSON.stringify(na));
  /* EN HET KOST IETS. Invoeren is duurder dan om de hoek kopen, dus het
     restaurant dat er niets aan kon doen betaalt de rekening van andermans
     faillissement. Dat is wat "uitval reist" betekent. */
  const rr = rustig.st.laatste.anna.regels[0], nr = ramp.st.laatste.anna.regels[0];
  assert.ok(nr.inkoop >= rr.inkoop,
    'zonder lokale dekking valt de inkooppost hoger uit: ' + nr.inkoop + ' tegen ' + rr.inkoop);
  assert.ok(spoorVan(rustig, 'anna').goederen.lokaal > 0,
    'en in de wereld zonder ramp loopt de keten gewoon door');
});

/* ============ 7. geen eenheid uit het niets ============ */

test('er wordt nooit meer geleverd dan er capaciteit is', () => {
  /* DEZE TOETS WAS EERST WAARDELOOS: hij vergeleek met `omvang * 1000`, en dat
     haalt geen enkele levering ooit. Een mutatie die de capaciteitsgrens
     helemaal weghaalde bleef daardoor onopgemerkt -- precies wat LAT.md regel 9
     bedoelt met een toets die niet kan zakken.

     Nu staat er de echte grens: wat een leverancier kwijt kan is zijn
     CAPACITEIT (magnaat/maat.js), en geen eenheid meer. */
  const o = stad('k-7', { omvang: 10 });
  o.maand(4);
  const zaken = Object.values(o.st.vestigingen).flat();
  let gemeten = 0;
  for (const [vid, x] of Object.entries(o.st.keten.perLeverancier)) {
    const v = zaken.find(z => z.id === vid);
    assert.ok(v, 'de leverancier bestaat');
    assert.ok(x.eenheden > 0);
    assert.ok(x.eenheden <= capaciteit(v, 0) + 0.001,
      'geleverd boven de capaciteit: ' + Math.round(x.eenheden)
      + ' tegen ' + Math.round(capaciteit(v, 0)));
    gemeten++;
  }
  assert.ok(gemeten > 0, 'er hoort een leverancier gemeten te zijn');
});

test('een klant meer maakt de leveringen niet groter, alleen dunner', () => {
  /* De keerzijde: capaciteit is EINDIG. Verdubbelt de vraag, dan verdubbelt het
     aanbod niet mee -- er wordt alleen minder per afnemer. */
  const een = stad('k-7b', { omvang: 10 });
  const twee = stad('k-7b', { omvang: 10 });
  twee.m.eco.zet(twee.p, 'chris', { actie: 'open', kavel: kavelIn('boulevard', 1).id,
    sector: 'horeca', omvang: 60, naam: 'Tweede Zaak' });
  een.maand(4); twee.maand(4);
  const som = (o) => Object.values(o.st.keten.perLeverancier)
    .reduce((n, x) => n + x.eenheden, 0);
  assert.ok(som(twee) <= som(een) + 0.001,
    'de groothandel kan niet ineens meer: ' + Math.round(som(twee)) + ' tegen ' + Math.round(som(een)));
  assert.ok(spoorVan(twee, 'anna').goederen.lokaal < spoorVan(een, 'anna').goederen.lokaal,
    'en de eerste afnemer krijgt er minder van');
});

test('de prijs komt uit de krapte en niet uit een tabel', () => {
  const ruim = stad('k-8', { omvang: 120 });
  const krap = stad('k-9', { omvang: 6 });
  ruim.maand(4); krap.maand(4);
  const pr = ruim.st.keten.prijs.goederen, pk = krap.st.keten.prijs.goederen;
  assert.ok(pk > pr, 'krapper hoort duurder: ' + pk + ' tegen ' + pr);
  /* EN NOOIT BOVEN DE WERELDPRIJS, want invoeren is je alternatief en niemand
     betaalt lokaal meer dan dat. Dat is de bovengrens die betekenis heeft --
     geen `scarcityBonus` maar een structuur. */
  assert.ok(pk <= HG.MARKTPRIJS.goederen + 0.001,
    'de wereldprijs is het plafond: ' + pk + ' tegen ' + HG.MARKTPRIJS.goederen);
  assert.ok(pr >= HG.MARKTPRIJS.goederen * (1 - KETEN.LOKAAL_VOORDEEL) - 0.001);
});

/* ============ 4. een contract is voorrang, geen korting ============ */

test('een contract legt beslag op capaciteit -- en dat merkt de spotkoper', () => {
  /* DE BELOFTE WAAR DE HELE CONTRACTLAAG OP STAAT, en die was niet getoetst: een
     mutatie die de contracten NIET liet voorgaan brak niets. Dat is de
     gevaarlijkste soort gat -- de regel stond in drie koppen uitgeschreven en
     nergens gemeten.

     TWEE WERELDEN DIE ALLEEN IN HET CONTRACT VERSCHILLEN. In de ene tekent Anna
     bij de groothandel; in de andere niet. Chris doet in allebei precies
     hetzelfde: hij koopt op de vrije markt. Krijgt hij in de wereld MET dat
     contract minder, dan is voorrang echt -- en dan is een contract geen
     prijsafspraak maar toegang.

     DE EERSTE OPZET VAN DEZE TOETS DEUGDE NIET. Hij keek of Anna zelf nog op de
     spotmarkt stond, en dat doet ze: haar groothandel is te klein om haar
     contract vol te leveren, dus haar restbehoefte blijft groot. Dat is juist
     gedrag en het zei niets over voorrang. */
  const maak = (id, metContract) => {
    /* EEN GROOTHANDEL DIE NIET IEDEREEN AANKAN, want zonder schaarste heeft
       voorrang niets te betekenen: capaciteit ~300 tegen een gezamenlijke vraag
       van bijna 500. Bij omvang 30 was er 900 en gaf deze toets in beide
       werelden hetzelfde antwoord -- een toets die niet kon zakken. */
    const o = stad(id, { omvang: 10 });
    o.m.eco.zet(o.p, 'chris', { actie: 'open', kavel: kavelIn('boulevard', 1).id,
      sector: 'horeca', omvang: 60, naam: 'Tweede Zaak' });
    o.maand(3);
    if (metContract) {
      const nodig = KETEN.behoefteVan(o.zaak('anna')).goederen;
      /* `mijn` en `hun`, en niet leverancier/afnemer: wie er levert volgt uit de
         SECTOREN en niet uit het verzoek (magnaat/handel-acties.js). */
      const vs = o.m.eco.zet(o.p, 'boris', { actie: 'contract-voorstel',
        mijn: o.zaak('boris').id, hun: o.zaak('anna').id, soort: 'goederen',
        eenheden: Math.round(nodig), bedrag: Math.round(nodig * HG.MARKTPRIJS.goederen),
        looptijd: 12 });
      assert.equal(vs.ok, true, JSON.stringify(vs));
      const ja = o.m.eco.zet(o.p, 'anna', { actie: 'contract-antwoord', id: vs.id, antwoord: 'ja' });
      assert.equal(ja.ok, true, JSON.stringify(ja));
    }
    o.maand(3);
    return o;
  };
  const zonder = maak('k-c1', false), met = maak('k-c1', true);
  const cz = spoorVan(zonder, 'chris').goederen, cm = spoorVan(met, 'chris').goederen;
  assert.ok(cz && cm, JSON.stringify({ cz, cm }));
  assert.ok(cz.lokaal > 0, 'zonder contract krijgt Chris gewoon zijn deel');
  assert.ok(cm.lokaal < cz.lokaal,
    'met andermans contract blijft er minder voor hem over: '
    + Math.round(cm.lokaal) + ' tegen ' + Math.round(cz.lokaal));
  assert.ok(cm.ingevoerd > cz.ingevoerd, 'en hij moet meer invoeren');
  /* EN DAT IS GEEN KORTING MAAR TOEGANG. Chris betaalt per eenheid nog steeds
     de spotprijs; wat hij mist is niet geld maar levering. */
  assert.ok(met.st.keten.prijs.goederen <= HG.MARKTPRIJS.goederen + 0.001);
});

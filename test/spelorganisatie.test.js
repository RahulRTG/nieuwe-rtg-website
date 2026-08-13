/* MAGNAAT: WAT EEN ORGANISATIE OVER ZICHZELF WEET.

   De eerste steen van ORGANISATIE.md, en hij bestaat uit twee LEZINGEN van het
   besluitenlog dat er al staat (magnaat/storing-keten.js). Er wordt niets voor
   bewaard.

   1. HERHALING -- de schakel `leren`. Een koeling die voor de derde keer
      stukgaat is niet zwaarder kapot dan de eerste keer; het is een ander
      VERHAAL, en dat stond nergens.
   2. ER VOLGT GEEN STRAF UIT. Dit is de scherpste bewering van de zes: twee
      identieke werelden, een met een geschiedenis van herhalingen en een
      zonder, horen tot op de cent hetzelfde te rekenen. Zou een herhaling
      duurder zijn, dan is het geen inzicht maar een mechaniek dat je vermijdt.
   3. WIE HET FEITELIJK DOET, naast wie er formeel over gaat.
   4. EN GEEN ENKEL CIJFER DAT "HOE ERG IS DIT" HEET. Geen bus factor, geen
      kennisschuld-percentage: een aantal en een naam.
   5. DE LEZING BELOOFT NIET MEER DAN ZIJN BRON KAN DRAGEN.
   6. EEN ZAAK ZONDER GESCHIEDENIS ZEGT NIETS.

   Draai los: node --experimental-sqlite --test test/spelorganisatie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const ORG = require('../server/kern/spellen/magnaat/organisatie');
const KETEN = require('../server/kern/spellen/magnaat/storing-keten');
const STORING = require('../server/kern/spellen/magnaat/storing');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };

function opstelling(id) {
  const m = maakMagnaat();
  const p = { id, soort: 'magnaat', spelers: ['anna', 'boris'], teams: [0, 1], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of p.spelers) p.staat.geld[h] = 2000000;
  m.eco.zet(p, 'anna', { actie: 'open',
    kavel: kaart('ijmuiden').kavels.filter(k => k.zone === 'boulevard')[0].id,
    sector: 'horeca', omvang: 30 });
  const zaak = p.staat.vestigingen.anna[0];
  return { m, p, st: p.staat, zaak,
    maand: (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } },
    verhelp: (hoe) => m.eco.zet(p, 'anna', { actie: 'storing-verhelpen',
      vestiging: zaak.id, storing: 'koeling', hoe }),
    zicht: () => m.spel.zicht.speler(p, p.staat, 'anna').vestigingen[0] };
}

/* Een storing die stukgaat, gerepareerd wordt en later terugkomt. Dat is de
   hele opstelling: de herhaling moet uit de FEITEN komen en niet uit een
   teller die iemand ophoogt. */
function rondes(o, n) {
  for (let i = 0; i < n; i++) {
    STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
    o.verhelp('repareren');
    o.maand(1);
  }
}

/* ============ 1. herhaling ============ */

test('een storing die terugkomt telt zichzelf', () => {
  const o = opstelling('o-a');
  rondes(o, 2);                                  // twee keer stuk en gemaakt
  STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
  const h = ORG.herhaling(o.zaak, STORING.vind(o.zaak, 'koeling'));
  assert.equal(h.keer, 3, 'dit is de derde keer: ' + JSON.stringify(h));
  assert.equal(h.eerder.length, 2);
  assert.deepEqual(h.eerder.map(f => f.optie), ['repareren', 'repareren']);
});

test('"eerder" betekent voor DEZE keer, en niet alles wat er ooit was', () => {
  /* DEZE TOETS ZAT ER EERST NIET, en de mutatie liet dat zien: het filter op
     `maand < sinds` weghalen brak niets, want in elke opstelling was er nog geen
     besluit over de HUIDIGE ronde genomen. Dan meet je het filter niet.

     Hier wel: de koeling is voor de tweede keer stuk en er ligt al een
     noodoplossing op. Die hoort bij NU en niet bij de vorige keer -- anders
     leest een zaak zijn eigen lopende avond terug als geschiedenis. */
  const o = opstelling('o-a2');
  rondes(o, 1);
  STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
  o.verhelp('workaround');
  const h = ORG.herhaling(o.zaak, STORING.vind(o.zaak, 'koeling'));
  assert.equal(h.keer, 2);
  assert.deepEqual(h.eerder.map(f => f.optie), ['repareren'],
    'de noodoplossing van nu hoort niet bij de vorige keer: ' + JSON.stringify(h.eerder));
});

test('en hij telt de tijdelijke oplossingen apart', () => {
  /* Drie keer een noodkoeling is een ander verhaal dan drie keer een monteur --
     dat is de vorm van kennisschuld die uit deze bron af te lezen is. */
  const o = opstelling('o-b');
  STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
  o.verhelp('workaround'); o.maand(1);
  o.verhelp('repareren'); o.maand(1);
  STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
  const z = o.zicht().organisatie;
  const r = z.herhaald.find(x => x.soort === 'koeling');
  assert.ok(r, 'de herhaling hoort op het scherm te staan: ' + JSON.stringify(z));
  assert.equal(r.keer, 2);
  assert.equal(r.tijdelijk, 1, 'een van de twee rondes ging met een noodoplossing');
});

/* ============ 2. er volgt geen straf uit ============ */

test('een herhaling kost geen cent extra -- het is een lezing en geen mechaniek', () => {
  /* DE SCHERPSTE BEWERING. Twee identieke werelden: in de ene is de koeling al
     twee keer eerder stuk geweest, in de andere niet. De maand hoort tot op de
     cent hetzelfde te rekenen.

     Zou een herhaling duurder zijn, dan is het geen inzicht meer maar iets wat
     je moet vermijden -- en dan gaat een speler zijn geschiedenis wegpoetsen in
     plaats van eruit leren. */
  const met = opstelling('o-c'), zonder = opstelling('o-c');
  rondes(met, 2);
  /* de andere wereld draait dezelfde maanden zonder die geschiedenis */
  zonder.maand(2);
  for (const o of [met, zonder]) {
    STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
    o.verhelp('workaround');
    o.maand(1);
  }
  const a = met.st.laatste.anna.regels.find(x => x.id === met.zaak.id);
  const b = zonder.st.laatste.anna.regels.find(x => x.id === zonder.zaak.id);
  for (const veld of ['omzet', 'derving', 'vast', 'kosten', 'resultaat'])
    assert.equal(a[veld], b[veld],
      veld + ' hoort niet te bewegen van een geschiedenis die alleen gelezen wordt');
  /* en de lezing ZIET het verschil wel -- anders meet deze toets niets */
  assert.equal(ORG.herhaling(met.zaak, STORING.vind(met.zaak, 'koeling')).keer, 3);
  assert.equal(ORG.herhaling(zonder.zaak, STORING.vind(zonder.zaak, 'koeling')).keer, 1);
});

/* ============ 3. wie het feitelijk doet ============ */

test('het besluitenlog zegt wie er feitelijk beslist', () => {
  const o = opstelling('o-d');
  STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
  /* Anna beslist een keer, Boris drie keer -- dat laatste zoals het op de vloer
     gaat: via het besluitenlog van de zaak. */
  o.verhelp('workaround'); o.maand(1);
  for (let i = 0; i < 3; i++)
    KETEN.noteer(o.zaak, { maand: o.st.maand, soort: 'koeling', wie: 'boris',
      rol: 'vakkracht', optie: 'overzetten', deed: 'de waar overgezet' });
  const handen = ORG.besluitvormers(o.zaak, (h) => 'CN-' + h);
  assert.equal(handen[0].wie, 'CN-boris', 'Boris nam de meeste besluiten');
  assert.equal(handen[0].aantal, 3);
  assert.equal(handen[0].rol, 'vakkracht');
  assert.ok(handen.some(x => x.wie === 'CN-anna'), 'en Anna staat er ook: ' + JSON.stringify(handen));
});

test('een enkel besluit van een vakkracht is nog geen tweede organisatie', () => {
  /* GEEN DREMPELGETAL maar het punt waar het organigram stopt met kloppen. Anna
     besliste twee keer, Boris een keer -- dan is er niets te melden, en een
     regel die er toch staat leert de speler de strook te negeren. */
  const o = opstelling('o-d2');
  STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
  o.verhelp('workaround'); o.maand(1);
  o.verhelp('repareren'); o.maand(1);
  KETEN.noteer(o.zaak, { maand: o.st.maand, soort: 'koeling', wie: 'boris',
    rol: 'vakkracht', optie: 'overzetten', deed: 'de waar overgezet' });
  assert.deepEqual(o.zicht().organisatie.handen, [],
    'de eigenaar besliste vaker; dan zegt het organigram gewoon de waarheid');
});

test('maar zodra iemand anders het even vaak doet, staat het er', () => {
  const o = opstelling('o-d3');
  STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
  o.verhelp('workaround'); o.maand(1);
  for (let i = 0; i < 2; i++)
    KETEN.noteer(o.zaak, { maand: o.st.maand, soort: 'koeling', wie: 'boris',
      rol: 'vakkracht', optie: 'overzetten', deed: 'de waar overgezet' });
  const handen = o.zicht().organisatie.handen;
  assert.ok(handen.length, 'nu klopt het organigram niet meer: ' + JSON.stringify(handen));
  assert.equal(handen[0].wie, 'CN-boris');
});

test('naast wie er formeel over gaat', () => {
  /* Zonder de formele kant is "negen besluiten van Boris" een weetje; met de
     formele kant ernaast is het een vraag over hoe dit bedrijf werkelijk in
     elkaar zit. */
  const o = opstelling('o-e');
  STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
  o.verhelp('workaround');
  const z = o.zicht().organisatie;
  assert.equal(z.formeel, 'CN-anna', 'de eigenaar staat erbij');
  assert.ok(Array.isArray(z.rollen), 'en wie er formeel een rol op deze zaak heeft');
});

/* ============ 4. geen enkel cijfer dat "hoe erg is dit" heet ============ */

test('er staat geen score in, en geen bus factor', () => {
  /* Wat hier NIET mag ontstaan is een getal dat "hoe afhankelijk ben ik van
     deze mens" heet, want dan is het een balk om te optimaliseren in plaats van
     iets om te ontdekken. Er staat een AANTAL en een NAAM. */
  const o = opstelling('o-f');
  STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
  o.verhelp('workaround'); o.maand(1);
  KETEN.noteer(o.zaak, { maand: o.st.maand, soort: 'koeling', wie: 'boris',
    rol: 'vakkracht', optie: 'overzetten', deed: 'de waar overgezet' });
  const z = o.zicht().organisatie;
  assert.ok(z.handen.length, 'deze zaak hoort handen te tonen');
  assert.deepEqual(Object.keys(z).sort(), ['formeel', 'handen', 'herhaald', 'laatste', 'rollen']);
  for (const h of z.handen)
    assert.deepEqual(Object.keys(h).sort(), ['aantal', 'rol', 'wie'],
      'een hand draagt een naam, een rol en een aantal -- verder niets');
  const tekst = JSON.stringify(z).toLowerCase();
  for (const woord of ['score', 'factor', 'niveau', 'risico', 'schuld', 'kwaliteit', 'cultuur'])
    assert.equal(tekst.includes(woord), false,
      'het woord "' + woord + '" hoort hier niet te staan: ' + tekst);
});

/* ============ 5. de lezing belooft niet meer dan zijn bron ============ */

test('de lezing zegt zelf hoe ver hij terugkijkt', () => {
  /* De bron is afgekapt (storing-keten.js LENGTE), dus deze lezing gaat over de
     LAATSTE besluiten en niet over de hele campagne. Een lezing die meer
     belooft dan haar bron kan dragen, is een verzinsel met een tabel eromheen. */
  const o = opstelling('o-g');
  STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
  o.verhelp('workaround');
  assert.equal(o.zicht().organisatie.laatste, KETEN.LENGTE);
  assert.ok(KETEN.LENGTE > 0 && KETEN.LENGTE < 100);
});

/* ============ 6. een zaak zonder geschiedenis zegt niets ============ */

test('een zaak waar niets gebeurd is, meldt niets', () => {
  const o = opstelling('o-h');
  o.maand(2);
  const z = o.zicht().organisatie;
  assert.deepEqual(z.herhaald, []);
  assert.deepEqual(z.handen, []);
});

test('en een storing die voor het eerst stuk is, is geen herhaling', () => {
  const o = opstelling('o-i');
  STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
  o.verhelp('workaround'); o.maand(1);
  assert.deepEqual(o.zicht().organisatie.herhaald, [],
    'de eerste keer is geen patroon, en dat zeggen is ruis');
});

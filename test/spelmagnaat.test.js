/* MAGNAAT: twee vormen, en de economie die er nieuw bij staat.

   Het bordspel is niet veranderd; wat hier onder toets staat is de ECONOMIE, en
   dan vooral de vier beweringen waar een economische simulatie op valt of
   staat. Ze zijn geen van alle vanzelfsprekend, en ze zijn alle vier stil terug
   te draaien:

   1. HET IS EEN SPEL. Goed spelen wint van slecht spelen: de plek telt, de
      prijs telt, onderhoud telt. In de EERSTE versie was dat niet zo -- toen
      won wie MINDER personeel aannam en GEEN onderhoud deed, omdat `omvang`
      per ongeluk de maandcapaciteit was in plaats van het aantal stoelen.
      Alles draaide verlies en niets doen was de beste zet. Dat stond niet in de
      code te lezen; het bleek uit een uitgespeelde campagne.
   2. DE KLOK IS DETERMINISTISCH. Tien maanden achter elkaar geven hetzelfde als
      tien maanden verspreid over de dag. Zonder die eigenschap hangt "sinds je
      weg was" af van hoe vaak je ververst, en dan is bijrekenen (GAMEHALL.md
      12.4) geen geldige vervanging van een tikkende server.
   3. DE FOUNDATION IS EEN ACTOR EN GEEN SAUS. Ze bouwt binnen een campagne echt
      iets, en dat verandert de economie meetbaar.
   4. DE BOEKEN VAN EEN ANDER ZIJN NIET VAN JOU. Bij het bordspel ligt alles op
      tafel; bij de economie niet, en de kijker- en schermweergave horen dus
      niet iemands kas te tonen.

   Draai los: node --experimental-sqlite --test test/spelmagnaat.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {}
});
const { kaart } = require('../server/kern/spellen/magnaat/kaart');
const { alles: balans } = require('../scripts/magnaat-balans');
const F = require('../server/kern/spellen/magnaat/foundation');

const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'quick' };
function potjeMet(variant, spelers = ['anna', 'boris']) {
  return { id: 'p1', soort: 'magnaat', spelers, teams: [0, 1, 0, 1, 0, 1], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant };
}
// een campagne uitspelen zonder te wachten: de klok terugzetten en laten bijrekenen
function speelUit(m, p, maanden) {
  for (let i = 0; i < maanden; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); }
}
const kavelIn = (zone, n = 0) => kaart('ijmuiden').kavels.filter(k => k.zone === zone)[n];

/* ================= de kaart ================= */

test('de kaart is echt, stabiel, en zegt zelf waar hij vandaan komt', () => {
  const k = kaart('ijmuiden');
  assert.ok(k.kavels.length > 100, 'er is een stad om in te spelen: ' + k.kavels.length);
  assert.ok(k.zones.some(z => /haven/i.test(z.naam)), 'IJmuiden heeft een haven');
  assert.ok(k.kavels.some(x => /Kennemerboulevard/.test(x.naam)), 'en een boulevard');
  /* De bron staat in de data zelf, en zolang hij handmatig is staat er GEEN
     huisnummer in. Dat is de afspraak uit GAMEHALL.md 12.1: een huisnummer is
     een bewering over een specifiek pand en hoort uit een register te komen. */
  assert.ok(['handmatig', 'open-data'].includes(k.bron));
  if (k.bron === 'handmatig')
    for (const kav of k.kavels)
      assert.match(kav.naam, /, kavel \d+$/, 'handmatige data hoort geen adres te suggereren: ' + kav.naam);
  // en hij is stabiel: dezelfde stad geeft dezelfde kavels
  assert.deepEqual(kaart('ijmuiden').kavels[7], k.kavels[7]);
});

test('een zone heeft een eigen karakter, en dat is te zien aan de kavels', () => {
  const k = kaart('ijmuiden');
  const gem = (zone, veld) => {
    const rij = k.kavels.filter(x => x.zone === zone);
    return rij.reduce((n, x) => n + x.eigenschappen[veld], 0) / rij.length;
  };
  assert.ok(gem('boulevard', 'toerisme') > gem('terrein', 'toerisme') * 3, 'de boulevard is toeristischer dan een bedrijventerrein');
  assert.ok(gem('terrein', 'zakelijk') > gem('boulevard', 'zakelijk') * 2, 'en het terrein zakelijker dan de boulevard');
  assert.ok(gem('centrum', 'passanten') > gem('haven', 'passanten') * 2, 'het centrum heeft de passanten');
  assert.ok(gem('station', 'ov') > gem('terrein', 'ov'), 'bij het station kom je met het OV');
});

/* ================= is het een spel? ================= */

test('elke sector is te exploiteren, en geen enkele is gratis geld', () => {
  /* De band is 8 tot 24 maanden terugverdientijd. Eronder is het gratis geld en
     is er geen keuze; erboven speelt niemand die sector ooit. */
  for (const r of balans('ijmuiden')) {
    assert.ok(Number.isFinite(r.terug), r.sleutel + ' verdient zijn bouwsom NOOIT terug');
    assert.ok(r.terug >= 8 && r.terug <= 24,
      r.sleutel + ' verdient zich in ' + r.terug.toFixed(1) + ' maanden terug; buiten de band 8-24');
  }
});

test('de plek is de belangrijkste keuze van het spel', () => {
  const m = maakMagnaat();
  const p = potjeMet(ECO);
  m.spel.init(p);
  m.spel.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 30 });
  m.spel.zet(p, 'boris', { actie: 'open', kavel: kavelIn('terrein').id, sector: 'horeca', omvang: 30 });
  speelUit(m, p, 36);
  const stand = m.eco.eindstand(p);
  const a = stand.find(x => x.codenaam === 'CN-anna'), b = stand.find(x => x.codenaam === 'CN-boris');
  /* Beide vermogens zijn positief -- er staat tenslotte een pand -- dus de maat
     is wat er met het STARTKAPITAAL is gebeurd. Op de boulevard is het
     vermenigvuldigd, op het bedrijventerrein grotendeels verdampt. */
  assert.ok(a.vermogen > 250000 * 3, 'een restaurant op de boulevard vermenigvuldigt je inleg: ' + a.vermogen);
  assert.ok(b.vermogen < 250000, 'hetzelfde restaurant op een bedrijventerrein eet hem op: ' + b.vermogen);
  assert.ok(a.omzet > b.omzet * 4, 'en het verschil is groot, niet kosmetisch');
});

test('onderhoud verwaarlozen bespaart nu en kost later meer', () => {
  const m = maakMagnaat();
  const p = potjeMet(ECO);
  m.spel.init(p);
  for (const h of ['anna', 'boris'])
    m.spel.zet(p, h, { actie: 'open', kavel: kavelIn('boulevard', h === 'anna' ? 0 : 1).id, sector: 'hotel', omvang: 6 });
  m.spel.zet(p, 'boris', { actie: 'beleid', id: 'v2', onderhoud: 0 });
  speelUit(m, p, 36);
  const anna = p.staat.vestigingen.anna[0], boris = p.staat.vestigingen.boris[0];
  assert.ok(anna.onderhoud > 90, 'wie onderhoudt houdt zijn pand op peil: ' + anna.onderhoud);
  assert.ok(boris.onderhoud < 10, 'wie niet onderhoudt ziet het wegzakken: ' + boris.onderhoud);
  assert.ok(anna.reputatie > boris.reputatie + 15, 'en dat is te zien aan de naam: ' + anna.reputatie + ' tegen ' + boris.reputatie);
  const stand = m.eco.eindstand(p);
  assert.ok(stand[0].codenaam === 'CN-anna', 'onderhouden hoort te winnen, niet te verliezen');
});

test('te weinig personeel kost klanten die je wel had kunnen hebben', () => {
  const m = maakMagnaat();
  const p = potjeMet(ECO);
  m.spel.init(p);
  m.spel.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 30 });
  m.spel.zet(p, 'anna', { actie: 'beleid', id: 'v1', personeel: 1 });
  speelUit(m, p, 12);
  const laatste = p.staat.laatste.anna.regels[0];
  assert.ok(laatste.gemist > 0, 'met een man in de bediening loop je omzet mis');
  assert.ok(laatste.bezetting >= 99, 'en zit je bomvol: ' + laatste.bezetting + '%');

  /* En de eigenschap eronder, rechtstreeks: capaciteit HANGT AAN PERSONEEL.
     Zonder deze regel bleef deze toets groen terwijl personeel er niet meer toe
     deed -- de zaak zit in beide gevallen vol, want de vraag is groter dan het
     pand. Precies de fout van de eerste versie, en hij kwam via een mutatie
     terug. */
  const { capaciteit } = require('../server/kern/spellen/magnaat/stap');
  const v = p.staat.vestigingen.anna[0];
  const metEen = capaciteit(Object.assign({}, v, { personeel: 1 }), 0);
  const metVier = capaciteit(Object.assign({}, v, { personeel: 4 }), 0);
  assert.ok(metVier > metEen, 'meer personeel hoort meer aan te kunnen: ' + metEen + ' tegen ' + metVier);
});

test('marketing werkt af: de eerste euro doet meer dan de laatste', () => {
  /* Zonder die afvlakking is "alles in marketing" altijd het goede antwoord, en
     dan is het geen keuze maar een schuifbalk die je helemaal opendraait. */
  const { vraagVoor } = require('../server/kern/spellen/magnaat/vraag');
  const k = kaart('ijmuiden');
  const kav = kavelIn('boulevard');
  const meet = (marketing) => vraagVoor(k, { kavel: kav.id, sector: 'horeca', prijs: 'midden', reputatie: 50 },
    { maand: 6, zoneDruk: 1, marketing }).eenheden;
  const zonder = meet(0), weinig = meet(4000), veel = meet(40000);
  assert.ok(weinig > zonder, 'marketing brengt mensen binnen');
  assert.ok(veel > weinig, 'meer marketing brengt meer binnen');
  const eersteStap = weinig - zonder, tiendeStap = veel - weinig;
  assert.ok(tiendeStap < eersteStap,
    'tien keer zoveel budget hoort minder op te leveren dan de eerste stap: ' + eersteStap + ' tegen ' + tiendeStap);
  assert.ok(veel < zonder * 1.5, 'en er zit een plafond op: ' + veel + ' tegen ' + zonder);
});

test('goedkoper trekt meer mensen, duurder minder -- en dat is de keuze', () => {
  /* Zonder dit is de prijsstand een knop die alleen de omzet omhoog doet, en
     dan zet iedereen hem op 'hoog' en is er niets te kiezen. */
  const { vraagVoor } = require('../server/kern/spellen/magnaat/vraag');
  const { prijsVan } = require('../server/kern/spellen/magnaat/prijsstand');
  const k = kaart('ijmuiden');
  const kav = kavelIn('boulevard');
  const meet = (prijs) => vraagVoor(k, { kavel: kav.id, sector: 'horeca', prijs, reputatie: 50 },
    { maand: 6, zoneDruk: 1, marketing: 0 }).eenheden;
  assert.ok(meet('laag') > meet('midden'), 'goedkoper trekt meer mensen');
  assert.ok(meet('hoog') < meet('midden'), 'duurder trekt er minder');
  // en het valt niet tegen elkaar weg: duur is meer omzet per klant
  assert.ok(prijsVan('horeca', 'hoog') > prijsVan('horeca', 'laag') * 2, 'de prijsband is breed genoeg om iets te kiezen');
});

test('twee dezelfde zaken in dezelfde buurt vechten om dezelfde mensen', () => {
  /* De concurrentiedruk. Zonder deze is een tweede vestiging in dezelfde straat
     gratis geld, en dan is de hele plaatskeuze zinloos: dan zet je ze allemaal
     op het beste kavel. */
  const m = maakMagnaat();
  /* OP MAAT gebouwd, en dat is hier geen detail: een zaak die kleiner is dan de
     vraag zit toch al vol, en dan is een concurrent pas te merken als hij de
     vraag ONDER je capaciteit duwt. Met een te kleine zaak meet deze toets
     niets -- dat is hem ook echt overkomen. */
  const OP_MAAT = 80, SECTOR = 'vrije-tijd';
  const alleen = potjeMet(ECO, ['anna']);
  m.spel.init(alleen);
  m.spel.zet(alleen, 'anna', { actie: 'open', kavel: kavelIn('boulevard', 0).id, sector: SECTOR, omvang: OP_MAAT });
  speelUit(m, alleen, 12);

  const samen = potjeMet(ECO);
  m.spel.init(samen);
  m.spel.zet(samen, 'anna', { actie: 'open', kavel: kavelIn('boulevard', 0).id, sector: SECTOR, omvang: OP_MAAT });
  m.spel.zet(samen, 'boris', { actie: 'open', kavel: kavelIn('boulevard', 1).id, sector: SECTOR, omvang: OP_MAAT });
  speelUit(m, samen, 12);

  const solo = alleen.staat.laatste.anna.regels[0].omzet;
  const gedeeld = samen.staat.laatste.anna.regels[0].omzet;
  assert.ok(gedeeld < solo * 0.85,
    'met een concurrent naast de deur hoort er minder binnen te komen: ' + gedeeld + ' tegen ' + solo);
});

test('een naam bouw je op in maanden, niet in een maand', () => {
  /* Reputatie kruipt naar kwaliteit toe. Zou hij springen, dan is een slechte
     maand meteen een ramp en een goede maand meteen vergeten -- en dan is er
     geen reden om ergens lang aan te bouwen. */
  const m = maakMagnaat();
  const p = potjeMet(ECO, ['anna']);
  m.spel.init(p);
  m.spel.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 30 });
  const start = p.staat.vestigingen.anna[0].reputatie;
  speelUit(m, p, 1);
  const na1 = p.staat.vestigingen.anna[0].reputatie;
  speelUit(m, p, 11);
  const na12 = p.staat.vestigingen.anna[0].reputatie;
  assert.ok(na1 > start, 'een goede maand helpt');
  assert.ok(na1 < start + 20, 'maar hij springt niet in een keer naar de top: ' + start + ' -> ' + na1);
  assert.ok(na12 > na1 + 10, 'en na een jaar sta je er echt: ' + na12);
});

test('er is geen enkelvoudig recept: niets doen verliest en er zijn meerdere stijlen', () => {
  /* DE TOETS DIE DE DUURSTE FOUT VAN DIT SPEL BEWAAKT, en die alleen kan
     bestaan omdat er campagnes worden UITGESPEELD. In de eerste versie van de
     economie won de speler die minder personeel aannam en geen onderhoud deed:
     alles draaide verlies en niets doen was de beste zet. Geen enkele unittoets
     zag dat, en de balansmeter ook niet -- die kijkt naar EEN zaak op EEN
     moment. Een economie toets je door hem te spelen.

     Drie harde regels (zie de kop van scripts/magnaat-strateeg.js): niets doen
     verliest, afwachten verliest van de actieve stijlen, en er zijn er meerdere
     levensvatbaar. Hoe ver een sectorfocus voor mag liggen staat er met opzet
     NIET in: dat is een smaakoordeel dat met fase B verandert, en het script
     meldt het als signaal.

     Twee startposities in plaats van de zes van het script: dit is een
     regressiebewaking en geen ijking, en 110 campagnes duurt lang genoeg. */
  const { toernooi, NAMEN } = require('../scripts/magnaat-strateeg');
  const uit = toernooi(2);
  assert.ok(uit.gespeeld >= 100, 'er zijn genoeg campagnes gespeeld om iets te zien: ' + uit.gespeeld);
  const pct = (n) => Math.round(uit.aandeel[n] * 100);

  /* De sommen staan HIER en niet als aanroep van `keur()` in het script. Dat
     scheelde niets in leesbaarheid en alles in scherpte: met een aanroep bleef
     deze toets groen toen de keuring zelf werd uitgezet, en een toets die zijn
     eigen bewaker niet nameet bewaakt niets. */
  const actief = NAMEN.filter(n => n !== 'niets' && n !== 'passief');
  const besteActief = Math.max(...actief.map(n => uit.aandeel[n]));

  assert.ok(uit.aandeel.niets <= 0.25, 'NIETS DOEN wint ' + pct('niets') + '% -- dan is er geen spel');
  assert.ok(uit.aandeel.passief < besteActief,
    'AFWACHTEN (' + pct('passief') + '%) doet het net zo goed als de beste actieve stijl -- dan is groeien straf');
  const levensvatbaar = actief.filter(n => uit.aandeel[n] >= 0.5);
  assert.ok(levensvatbaar.length >= 4,
    'maar ' + levensvatbaar.length + ' stijlen halen de helft; er is een winnaar maar geen keuze');
  /* En de fout van de eerste versie met naam en toenaam: UITKNIJPEN mag niet
     lonen. `zuinig` neemt overal een man in dienst waar er vier nodig zijn. */
  assert.ok(uit.aandeel.zuinig < 0.5,
    'KNIJPEN op personeel wint ' + pct('zuinig') + '% -- dat was precies de fout van de eerste versie');
});

test('een kavel draagt in elke sector ongeveer evenveel bedrijvigheid', () => {
  /* De vijfde ijking, en hij komt uit een meting die de vorige vier niet konden
     doen. Elke sector verdiende zichzelf even snel terug en TOCH won er een --
     mobility-focus met 96%. De oorzaak zat niet in het rendement maar in hoeveel
     bedrijvigheid EEN KAVEL draagt: een logistiekplek hield 132.000 omzet per
     maand, een horecaplek 28.000. Wie per plek vier keer zoveel omzet kwijt kan,
     heeft voor dezelfde omvang vier keer minder plekken nodig -- en elke extra
     plek in een zone verdunt via `drukFactor` alle andere. Spreiden was dus
     zelfbeschadiging, en een sector die niet hoefde te spreiden won.

     Deze toets bewaakt de EIGENSCHAP en niet de getallen: hij zegt niets over
     welke omzet goed is, alleen dat ze niet ver uiteen mogen lopen. */
  const { alles } = require('../scripts/magnaat-balans');
  const rij = alles('ijmuiden');
  const omzet = rij.map(r => r.omzet);
  const spreiding = Math.max(...omzet) / Math.min(...omzet);
  assert.ok(spreiding < 1.6, 'een kavel draagt in de ene sector ' + spreiding.toFixed(1) +
    ' keer zoveel omzet als in de andere: ' +
    rij.map(r => r.sleutel + ' ' + Math.round(r.omzet)).join(', '));
});

test('er is geen prijsstand die het altijd wint', () => {
  /* De zesde en zevende ijking. De omzetindex (vraag maal prijs) liep netjes op
     van 0,83 via 1,00 naar 1,20, dus DUUR WAS ALTIJD BETER -- en daarmee was
     prijs geen keuze maar een knop met een goed antwoord. Erger nog: bij een
     hoge prijs haalde je dezelfde omzet uit een KLEINER pand, en alles wat met
     de omvang meeschaalt (lonen, vaste lasten, huur, bouwsom) werd dus ruim 40%
     goedkoper voor hetzelfde geld. Duur zijn was gratis. Nu kost duur zijn ook
     wat het in het echt kost: meer handen per gast, een duurder pand per stoel.

     Twee beweringen, en de tweede is de scherpste: de omzet mag per stand niet
     ver uiteenlopen, EN de terugverdientijd van een op maat gebouwde zaak ook
     niet. Dat laatste is wat het eerste pas echt maakt. */
  const { SECTOREN } = require('../server/kern/spellen/magnaat/sectoren');
  const { VRAAGFACTOR } = require('../server/kern/spellen/magnaat/prijsstand');
  const beste = {};
  for (const [naam, s] of Object.entries(SECTOREN)) {
    const index = ['laag', 'midden', 'hoog'].map((stand, i) => s.prijs[i] / s.prijs[1] * VRAAGFACTOR[stand]);
    const spreiding = Math.max(...index) / Math.min(...index);
    assert.ok(spreiding < 1.2, naam + ': de omzetindex loopt van ' + index.map(x => x.toFixed(2)).join(' naar ') +
      ' -- dan is er een stand die het altijd wint');
    const stand = ['laag', 'midden', 'hoog'][index.indexOf(Math.max(...index))];
    beste[stand] = (beste[stand] || 0) + 1;
  }
  /* En de scherpere kant van dezelfde vraag: welke stand het beste uitkomt hoort
     PER SECTOR te verschillen. Een vervoerder wint op volume, een winkel op
     marge. Zou een stand overal bovenaan staan, dan is de spreiding hierboven
     alleen maar klein en de keuze nog steeds gemaakt. */
  assert.ok(Object.keys(beste).length > 1,
    'in elke sector komt dezelfde prijsstand het beste uit: ' + JSON.stringify(beste));
  // en dezelfde vraag aan de motor zelf, want een index is geen winst
  const m = maakMagnaat();
  const terug = {};
  for (const stand of ['laag', 'midden', 'hoog']) {
    const p = potjeMet(ECO);
    m.spel.init(p);
    p.staat.geld.anna = 50000000;
    const kav = kavelIn('boulevard');
    const s = SECTOREN.horeca;
    const { basisvraag } = require('../server/kern/spellen/magnaat/vraag');
    const omvang = Math.max(4, Math.round(basisvraag(kaart('ijmuiden'), kav, 'horeca', 6) * s.markt
      * VRAAGFACTOR[stand] / s.perMaand));
    m.spel.zet(p, 'anna', { actie: 'open', kavel: kav.id, sector: 'horeca', omvang, prijs: stand });
    speelUit(m, p, 6);
    const r = p.staat.laatste.anna.regels[0];
    terug[stand] = p.staat.vestigingen.anna[0].gebouwdVoor / Math.max(1, r.resultaat);
  }
  const w = Object.values(terug);
  assert.ok(Math.max(...w) / Math.min(...w) < 1.25,
    'de terugverdientijd hangt te veel van de prijsstand af: ' +
    Object.entries(terug).map(([k, v]) => k + ' ' + v.toFixed(1)).join(', '));
});

test('aan een volle tafel wint niet dezelfde stijl als in een duel', () => {
  /* DE METING DIE FASE A NIET DEED, en de reden dat zijn verklaring scheef
     stond. Het toernooi speelt duels, en twee spelers op 144 kavels lopen
     elkaar nooit tegen het lijf -- daar is sectorkeuze alles. Fase A schreef
     de dominantie daarom toe aan een ontbrekende laag (contracten, veilingen)
     en verwachtte dat die hem zou oplossen. Dat deed hij niet: het lag aan de
     TAFELGROOTTE waarop gemeten werd.

     Deze toets bewaakt de eigenschap en niet de uitslag: aan een tafel van zes
     hoort de duelwinnaar NIET alles te winnen. Zou dat wel zo zijn, dan is het
     spel met zes hetzelfde als met twee en heeft de tafel geen betekenis. */
  const { veld } = require('../scripts/magnaat-strateeg');
  const zes = ['horeca', 'mobility', 'inkoper', 'toelever', 'keten', 'onderhoud'];
  const winst = {};
  let bezet = 0;
  for (let o = 0; o < 4; o++) {
    const r = veld(zes, o);
    winst[r.stand[0].profiel] = (winst[r.stand[0].profiel] || 0) + 1;
    bezet += r.vol;
    assert.equal(r.stand.length, 6, 'er spelen er zes mee');
  }
  assert.ok((winst.horeca || 0) < 4,
    'horeca-focus wint al zijn duels; aan een volle tafel hoort dat niet te gelden: ' + JSON.stringify(winst));
  assert.ok(Object.keys(winst).length > 1, 'en er hoort meer dan een stijl te kunnen winnen');
  assert.ok(bezet / 4 > 0.25, 'er wordt werkelijk om de kaart gespeeld: ' + Math.round(bezet / 4 * 100) + '% bezet');
});

test('de keuring van de strateeg slaat aan op een economie die scheef staat', () => {
  /* De bewaker zelf nameten. Zonder dit blijft `keur` groen als hij wordt
     uitgezet -- en een keuring die niets kan afkeuren is geen keuring. Dat is
     dezelfde positieve controle als bij de lekbewaking van het zichtmodel. */
  const { keur, NAMEN } = require('../scripts/magnaat-strateeg');
  /* Een gezond veld: de actieve stijlen rond de helft en erboven, en de twee
     ijkpunten (niets doen, afwachten) er duidelijk onder. */
  const verzin = (aandeel) => ({ aandeel: Object.assign(
    Object.fromEntries(NAMEN.map(n => [n, 0.6])), { niets: 0.05, passief: 0.2 }, aandeel) });
  assert.deepEqual(keur(verzin({})), [], 'een gezond veld hoort niets op te leveren');
  assert.match(keur(verzin({ niets: 0.7 }))[0], /NIETS DOEN/);
  assert.match(keur(verzin({ passief: 0.95 }))[0], /AFWACHTEN/);
  const eenwinnaar = Object.fromEntries(NAMEN.map(n => [n, 0.1]));
  eenwinnaar.horeca = 0.9;
  assert.match(keur({ aandeel: eenwinnaar }).join(' '), /geen keuze/);
});

test('een goede naam trekt klanten, en een slechte houdt ze weg', () => {
  /* Reputatie moet de VRAAG raken en niet alleen een getal op het scherm zijn.
     Zonder deze toets bleef alles groen terwijl reputatie nergens meer in
     meetelde: dat de naam oploopt was getoetst, dat hij iets DOET niet. */
  const { vraagVoor } = require('../server/kern/spellen/magnaat/vraag');
  const k = kaart('ijmuiden');
  const kav = kavelIn('boulevard');
  const meet = (reputatie) => vraagVoor(k, { kavel: kav.id, sector: 'horeca', prijs: 'midden', reputatie },
    { maand: 6, zoneDruk: 1, marketing: 0 }).eenheden;
  assert.ok(meet(90) > meet(50) * 1.15, 'een goede naam hoort merkbaar meer mensen te trekken');
  assert.ok(meet(10) < meet(50) * 0.85, 'en een slechte naam hoort ze weg te houden');
});

/* ================= de klok ================= */

test('bijrekenen is deterministisch: tien maanden in een keer of tien los', () => {
  /* Dit draagt de hele keuze uit GAMEHALL.md 12.4 -- de wereld TIKT niet maar
     REKENT BIJ. Zou het antwoord van de stapgrootte afhangen, dan bepaalt hoe
     vaak je ververst hoe rijk je wordt. */
  const opzet = (m) => {
    const p = potjeMet(ECO);
    m.spel.init(p);
    m.spel.zet(p, 'anna', { actie: 'open', kavel: kavelIn('centrum').id, sector: 'retail', omvang: 30 });
    return p;
  };
  const m1 = maakMagnaat(), a = opzet(m1);
  a.staat.gerekendTot -= 10 * a.staat.maandMs;
  m1.eco.bijrekenen(a);

  const m2 = maakMagnaat(), b = opzet(m2);
  for (let i = 0; i < 10; i++) { b.staat.gerekendTot -= b.staat.maandMs; m2.eco.bijrekenen(b); }

  assert.equal(a.staat.maand, 10);
  assert.equal(b.staat.maand, 10);
  assert.equal(Math.round(a.staat.geld.anna), Math.round(b.staat.geld.anna), 'dezelfde tijd hoort hetzelfde geld te geven');
  assert.deepEqual(a.staat.vestigingen.anna[0], b.staat.vestigingen.anna[0]);
});

test('een campagne loopt af en levert meer op dan alleen geld', () => {
  const m = maakMagnaat();
  const p = potjeMet(ECO);
  m.spel.init(p);
  m.spel.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 30 });
  speelUit(m, p, 40);   // ruim over de 36 maanden heen
  assert.equal(p.status, 'klaar');
  assert.equal(p.staat.maand, 36, 'hij stopt op zijn eigen duur en rekent niet door');
  const stand = m.eco.eindstand(p);
  for (const veld of ['vermogen', 'waarde', 'geld', 'banen', 'reputatie', 'omzet'])
    assert.ok(veld in stand[0], 'de eindstand hoort ' + veld + ' te tonen');
  assert.ok(p.winnaar || p.gelijk, 'er is een uitslag');
  assert.equal(m.spel.zet(p, 'anna', { actie: 'beleid', id: 'v1', prijs: 'hoog' }).status, 409,
    'na afloop valt er niets meer te doen');

  /* En ook als de hele campagne in EEN keer wordt bijgerekend. Dat is het geval
     dat in de praktijk voorkomt -- iemand opent een partij die een dag heeft
     stilgelegen -- en het is een ander pad dan maand voor maand: daar stopt de
     klok vanzelf omdat het potje al klaar is, hier moet de lus zelf stoppen. */
  const ineens = potjeMet(ECO);
  m.spel.init(ineens);
  m.spel.zet(ineens, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 30 });
  ineens.staat.gerekendTot -= 50 * ineens.staat.maandMs;
  m.eco.bijrekenen(ineens);
  assert.equal(ineens.staat.maand, 36, 'een campagne die lang stillag rekent niet voorbij zijn eigen duur');
  assert.equal(ineens.status, 'klaar');
});

/* ================= de Foundation ================= */

test('de Foundation bouwt binnen een campagne echt iets, en dat verandert de stad', () => {
  const m = maakMagnaat();
  const p = potjeMet(ECO);
  m.spel.init(p);
  m.spel.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 30 });
  speelUit(m, p, 36);
  const f = p.staat.foundation;
  assert.ok(f.gedaan.length >= 2, 'in drie jaar hoort er iets te staan, niet alleen een spaarpot: ' + f.gedaan.length);
  assert.ok(f.centraal > 0, 'en de centrale pot loopt mee');
  /* MEETBAAR, en niet alleen in het nieuws: een project verschuift de
     eigenschappen van de zone waar het staat. */
  const kavel = kaart('ijmuiden').kavel.get(kavelIn(f.gedaan[0].zone).id);
  const effect = F.effectOp(f, kavel);
  assert.ok(Object.keys(effect).length, 'een gebouwd project hoort de zone te veranderen');
  assert.ok(effect.passanten > 0, 'en meer mensen langs te brengen: ' + JSON.stringify(effect));
});

test('de Foundation put uit de hele stad en niet alleen uit de spelers', () => {
  /* Anders bouwt ze in een partij met twee mensen nooit iets en in een partij
     met zes drie keer zoveel, en hangt een sporthal af van hoeveel vrienden er
     meespeelden. */
  const m = maakMagnaat();
  const leeg = potjeMet(ECO);
  m.spel.init(leeg);
  speelUit(m, leeg, 36);
  assert.ok(leeg.staat.foundation.gedaan.length >= 1,
    'ook zonder spelersomzet gebeurt er iets in de stad');
});

/* ================= wie ziet wat ================= */

test('bij de economie zijn de boeken van een ander niet van jou', () => {
  const m = maakMagnaat();
  const p = potjeMet(ECO);
  m.spel.init(p);
  m.spel.zet(p, 'boris', { actie: 'open', kavel: kavelIn('centrum').id, sector: 'retail', omvang: 30 });
  speelUit(m, p, 6);

  const mijn = m.spel.zicht.speler(p, p.staat, 'anna');
  const platte = JSON.stringify(mijn);
  assert.equal(platte.includes(String(Math.round(p.staat.geld.boris))), false,
    'de kas van boris hoort niet in het zicht van anna te staan');
  assert.ok(mijn.anderen.length === 1 && mijn.anderen[0].vestigingen === 1,
    'wat je WEL ziet is waar hij zit en hoeveel, want dat staat op straat');
  assert.equal('geld' in mijn.anderen[0], false);

  /* Een kijker en een gedeeld scherm krijgen de PUBLIEKE weergave. Bij het
     bordspel ligt alles op tafel en is dat hetzelfde; hier niet, en daarom
     staat er geen ZONDER_SPELER op dit spel. */
  for (const laag of ['kijker', 'publiek']) {
    const z = m.spel.zicht[laag](p, p.staat);
    assert.equal(z.geld, undefined, laag + ' hoort geen kas te tonen');
    assert.equal(z.vestigingen, undefined, laag + ' hoort geen boeken te tonen');
    assert.ok(z.stad && typeof z.maand === 'number', laag + ' toont wel de wereld');
  }
});

/* ================= de twee vormen ================= */

test('het bordspel is er nog, en gedraagt zich als vanouds', () => {
  const m = maakMagnaat();
  const p = potjeMet({ vorm: 'bord', stad: null, duur: null });
  m.spel.init(p);
  assert.equal(p.staat.geld.anna, 1500, 'het bord begint met 1500 en niet met een economie');
  assert.ok(Array.isArray(p.staat.posities ? [] : []) || p.staat.posities.anna === 0);
  const r = m.spel.zet(p, 'anna', { actie: 'gooi' });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(m.spel.statisch(p).velden), 'en het bord reist mee als statische data');
});

test('na een worp zie je nog wat je gooide, ook als je beurt voorbij is', () => {
  /* GEVONDEN TIJDENS DE SPLITSING, en het was er al: `magVolgende` zette
     `st.dobbel` op null bij het doorgeven van de beurt, en de weergave wordt NA
     die aanroep opgebouwd. Wie op een veld landde dat zijn beurt beeindigde --
     belasting, een kanskaart, andermans straat -- kreeg dus een leeg
     dobbelvak en zag nooit wat hij had gegooid. Het viel niet op omdat het bij
     een veld dat te koop staat wel goed ging, en dat is de meerderheid.

     Aan tafel blijven de stenen liggen tot de volgende speler gooit, en dat is
     nu ook wat er gebeurt: de volgende worp overschrijft ze. */
  const m = maakMagnaat();
  let gezien = 0;
  for (let i = 0; i < 40; i++) {
    const p = potjeMet({ vorm: 'bord', stad: null, duur: null });
    m.spel.init(p);
    m.spel.zet(p, 'anna', { actie: 'gooi' });
    const z = m.spel.zicht.speler(p, p.staat, 'anna');
    if (Array.isArray(z.dobbel) && z.dobbel.length === 2) gezien++;
  }
  assert.equal(gezien, 40, 'in ' + (40 - gezien) + ' van de 40 worpen was de worp niet te zien');
});

test('een potje zonder variant is het bordspel, want dat stond er eerst', () => {
  // een potje van voor de economie draagt geen variant en hoort gewoon te werken
  const m = maakMagnaat();
  const p = potjeMet(null);
  m.spel.init(p);
  assert.equal(p.staat.geld.anna, 1500);
});

test('stad en duur horen bij de economie en niet bij het bord', () => {
  const m = maakMagnaat();
  const fout = m.spel.variantFout;
  assert.match(fout({ vorm: 'bord', stad: 'IJmuiden', duur: null }), /horen bij de economie/);
  assert.match(fout({ vorm: 'economie', stad: null, duur: null }), /stad en een speelduur/);
  assert.equal(fout({ vorm: 'bord', stad: null, duur: null }), null);
  assert.equal(fout({ vorm: 'economie', stad: 'IJmuiden', duur: 'quick' }), null);
});

test('de vrije acties mogen buiten de beurt, de grote niet', () => {
  /* Dit is de mechaniek waar Long Play op staat of valt (GAMEHALL.md 12.3):
     zonder vrije acties staat een partij van zes met 24 uur per beurt dagen
     stil tussen twee van jouw handelingen. De platformlaag leest de descriptor,
     dus het enige wat hier telt is dat de lijst klopt. */
  const m = maakMagnaat();
  assert.deepEqual(m.spel.buitenBeurt.slice().sort(),
    ['beleid', 'bouw', 'contract-antwoord', 'contract-opzeggen', 'contract-voorstel',
      'veiling-bod', 'veiling-intrekken', 'veiling-start', 'verkoop']);
  for (const groot of ['open', 'uitbreiden', 'sluiten'])
    assert.equal(m.spel.buitenBeurt.includes(groot), false, groot + ' is een grote zet en hoort bij je beurt');
});

test('rood staan kost rente, zodat overinvesteren een prijs heeft', () => {
  const m = maakMagnaat();
  const p = potjeMet(ECO);
  m.spel.init(p);
  p.staat.geld.anna = -100000;
  speelUit(m, p, 1);
  assert.ok(p.staat.geld.anna < -101000, 'een negatieve kas hoort te groeien, niet stil te blijven staan: ' + p.staat.geld.anna);
  const regel = p.staat.laatste.anna.regels.find(r => r.id === 'rood');
  assert.ok(regel && regel.rente > 0, 'en het staat als regel op je maandoverzicht');
});

test('je kunt niet openen wat je niet kunt betalen, en niet op andermans kavel', () => {
  const m = maakMagnaat();
  const p = potjeMet(ECO);
  m.spel.init(p);
  const kavel = kavelIn('boulevard').id;
  assert.match(m.spel.zet(p, 'anna', { actie: 'open', kavel, sector: 'hotel', omvang: 40 }).error, /kost/);
  assert.equal(m.spel.zet(p, 'anna', { actie: 'open', kavel, sector: 'horeca', omvang: 20 }).status, 200);
  assert.match(m.spel.zet(p, 'boris', { actie: 'open', kavel, sector: 'retail', omvang: 20 }).error, /bezet/);
  assert.match(m.spel.zet(p, 'anna', { actie: 'open', kavel: 'bestaat:niet', sector: 'horeca', omvang: 20 }).error, /er niet/);
  assert.match(m.spel.zet(p, 'boris', { actie: 'beleid', id: 'v1', prijs: 'hoog' }).error, /niet van jou/);
});

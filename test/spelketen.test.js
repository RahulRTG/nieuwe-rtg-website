/* MAGNAAT: DE KETEN -- een incident dat door de rollen heen loopt.

   Tot nu toe was een storing een TOESTAND, en daardoor waren de drie schermen
   drie losse werelden: de vakkracht meldde iets aan niemand, en de eigenaar zag
   een koeling die uit de lucht kwam vallen. Deze laag maakt er een KETEN van:

     constateren -> escaleren -> besluiten -> herstellen -> de maandrekening

   Zonder chat en zonder scene. Wat de een deed staat op het scherm van de ander
   omdat het WAAR is, niet omdat er een melding is verstuurd.

   ACHT BEWERINGEN:

   1. WIE IETS BESLOOT STAAT ERBIJ, met zijn rol.
   2. MITIGEREN IS GEEN BESLUIT. Wie de waar overzet verandert niets aan wat de
      volgende erft, en hoort de keten dus niet vol te schrijven.
   3. DE EIGENAAR ZIET WIE HET MELDDE, op zijn eigen scherm.
   4. DE VOLGENDE DIENST LEEST WAT ER BESLOTEN IS -- en niet zijn eigen besluit
      terug, want dan is een overdracht een echo.
   5. HET BEDRAG STAAT IN DE AUDIT EN NOOIT OP DE KNOP. Anders verraadt de beste
      keuze zichzelf en is bedrijfsvoering een rekensom.
   6. DE KETEN OVERLEEFT DE STORING. Hij is juist AF op het moment dat de
      koeling gerepareerd is; verdween hij dan, dan was er niets te
      reconstrueren.
   7. HIJ IS AFGEKAPT. Een audit die alles bewaart is een bak.
   8. EN DE STORING ZELF BLIJFT EEN STAND. De drie bewaarlagen schuiven niet.

   Draai los: node --experimental-sqlite --test test/spelketen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const KETEN = require('../server/kern/spellen/magnaat/storing-keten');
const STORING = require('../server/kern/spellen/magnaat/storing');
const OVER = require('../server/kern/spellen/magnaat/overdracht');
const { SOORTEN } = require('../server/kern/spellen/magnaat/rush-voorvallen');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const kavelsIn = (zone) => kaart('ijmuiden').kavels.filter(k => k.zone === zone);

/* Anna heeft een restaurant, Boris werkt er als vakkracht. Dezelfde opstelling
   als test/spelrush.test.js -- dit is dezelfde wereld, een rol hoger. */
function opstelling(id = 'k1', rol = 'vakkracht') {
  const m = maakMagnaat();
  const p = { id, soort: 'magnaat', spelers: ['anna', 'boris'], teams: [0, 1], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of p.spelers) p.staat.geld[h] = 2000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelsIn('boulevard')[0].id, sector: 'horeca', omvang: 30 });
  const zaak = p.staat.vestigingen.anna[0];
  const r = m.eco.zet(p, 'anna', { actie: 'functie-openen', vestiging: zaak.id, rol });
  m.eco.zet(p, 'boris', { actie: 'solliciteren', id: r.id });
  m.eco.zet(p, 'anna', { actie: 'aannemen', id: r.id, speler: 'boris' });
  return {
    m, p, st: p.staat, zaak,
    maand: (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } },
    kijk: () => m.eco.zet(p, 'boris', { actie: 'rush' }),
    pak: (wat, optie) => m.eco.zet(p, 'boris', { actie: 'rush-pak', wat, optie }),
    zaakscherm: (wie = 'anna') => m.spel.zicht.speler(p, p.staat, wie),
    verhelp: (hoe, wie = 'anna') => m.eco.zet(p, wie, { actie: 'storing-verhelpen',
      vestiging: zaak.id, storing: 'koeling', hoe })
  };
}

/* De koeling stukmaken, hem op de dienst afhandelen met `hoe`, en de avond
   daarna UITSPELEN.

   Dat afmaken is geen omweg maar de regel: een halve dienst telt als niet
   gespeeld (wet 4, test/spelrush.test.js), dus wordt er ook niets van geboekt.
   Wie hem hier weglaat toetst een keten die per definitie leeg blijft -- en dat
   is precies waar deze toets de eerste keer op zakte. */
function koelstoringMet(o, hoe, geefDoor) {
  STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
  let r = o.kijk(), gedaan = false, over = false;
  for (let i = 0; i < R_SLOTS + 2 && r.dienst && !r.dienst.klaar; i++) {
    /* DOORGEVEN MOET TIJDENS DE DIENST, want daarna is er geen moment meer om
       aan te besteden -- en dat is precies wat het kost. */
    if (geefDoor && !over && (r.dienst.overTeDragen || []).length) {
      over = true;
      r = o.m.eco.zet(o.p, 'boris', { actie: 'rush-overdragen' });
      continue;
    }
    const open = r.dienst.open || [];
    if (!open.length) break;
    const k = open.find(x => x.id === 'koeling');
    if (k && !gedaan) { gedaan = true; r = o.pak('koeling', hoe); continue; }
    r = o.pak(open[0].id);
  }
  return geefDoor ? (gedaan && over) : gedaan;
}
const R_SLOTS = require('../server/kern/spellen/magnaat/rush').SLOTS;

/* ============ 1. wie iets besloot staat erbij ============ */

test('een besluit van de vloer draagt de naam en de rol van wie het nam', () => {
  const o = opstelling('k-a');
  assert.ok(koelstoringMet(o, 'escaleren'), 'de koeling hoort deze avond op de dienst te staan');
  o.maand(1);                                   // de vloer wordt pas op de maand een stand
  const keten = KETEN.lijst(o.zaak);
  assert.equal(keten.length, 1, 'een melding hoort een regel op te leveren');
  assert.equal(keten[0].wie, 'boris');
  assert.equal(keten[0].rol, 'vakkracht');
  assert.equal(keten[0].optie, 'escaleren');
  /* EN HET IS EEN HANDLE EN GEEN NAAM. Vertalen doet het beeld, want daar is
     bekend wie er kijkt -- een tweede kopie van iets dat de kluis beheert
     veroudert. */
  assert.equal(keten[0].wie.startsWith('CN-'), false,
    'de audit hoort de sleutel te dragen; de codenaam valt pas op het scherm');
});

/* ============ 2. mitigeren is geen besluit ============ */

test('de waar overzetten schrijft de keten NIET vol', () => {
  /* Wie de waar overzet redt wat er vanavond ligt; morgen ligt er weer wat in en
     de wereld is geen millimeter verschoven. Zou dit landen, dan staat de keten
     na drie maanden vol met "de waar overgezet" en is de ene regel die ertoe
     doet -- wie het meldde -- niet meer te vinden. */
  const o = opstelling('k-b');
  assert.ok(koelstoringMet(o, 'overzetten'));
  o.maand(1);
  assert.deepEqual(KETEN.lijst(o.zaak), [],
    'mitigeren verandert niets aan wat de volgende erft en hoort dus geen besluit te zijn');
  assert.ok(STORING.heeft(o.zaak, 'koeling'), 'en de koeling is nog steeds stuk');
});

/* ============ 3. de eigenaar ziet wie het meldde ============ */

test('op het zaakscherm staat wie de storing meldde', () => {
  const o = opstelling('k-c');
  assert.ok(koelstoringMet(o, 'escaleren'));
  o.maand(1);
  const zaak = o.zaakscherm().vestigingen[0];
  const st = (zaak.storingen || [])[0];
  assert.ok(st, 'de storing staat op het scherm');
  assert.equal(st.keten.length, 1);
  assert.equal(st.keten[0].wie, 'CN-boris', 'op het scherm staat de codenaam');
  assert.equal(st.keten[0].rol, 'Vakkracht', 'en de rol in mensentaal');
  assert.match(st.keten[0].deed, /gemeld/);
});

/* ============ 4. de vloer leest de audit NIET ============ */

test('de vloer krijgt de auditlog niet te zien', () => {
  /* DIT WAS EEN LEK, en de eerste versie van deze toets bevestigde het nog ook:
     de strook "sinds je vorige dienst" las rechtstreeks uit ./storing-keten.js,
     dus een vakkracht kreeg de codenaam van zijn eigenaar EN het bedrag van de
     maandrekening te zien.

     Twee dingen tegelijk fout. Een werknemer heeft niets te maken met wat zijn
     werkgever uitgaf; en als iedereen de audit kan lezen, verdwijnt alle
     menselijke frictie en is iedereen alwetend -- precies wat ./overdracht.js
     uitsluit. Wat de vloer wel krijgt: wat hij ZIET, en wat aan hem is
     OVERGEDRAGEN. */
  const o = opstelling('k-d');
  assert.ok(koelstoringMet(o, 'escaleren'));
  o.maand(1);
  const r = o.verhelp('repareren');
  assert.equal(r.ok, true, JSON.stringify(r));
  o.maand(1);
  const d = o.kijk().dienst;
  const alles = JSON.stringify(d);
  assert.equal(alles.includes('CN-anna'), false,
    'de naam van de eigenaar hoort niet op de werkvloer te staan: ' + alles);
  assert.equal(/1250|spoed/.test(alles), false,
    'en het bedrag van de maandrekening al helemaal niet: ' + alles);
  /* De eigenaar ziet hem WEL -- de audit blijft waar hij hoort. */
  const zaken = o.zaakscherm().vestigingen[0];
  assert.ok(JSON.stringify(zaken).includes('CN-boris') || !(zaken.storingen || []).length,
    'op het zaakscherm blijft de keten gewoon staan');
});

test('wat de vloer wel ziet is de STAND, zonder naam en zonder bedrag', () => {
  const o = opstelling('k-d2');
  assert.ok(koelstoringMet(o, 'escaleren'));
  o.maand(1);
  /* Anna zet een noodkoeling neer op haar zaakscherm en zegt er niets bij.
     Boris komt de maand daarna terug: de stand is anders dan hij hem achterliet,
     en dat is wat hij met eigen ogen ziet. */
  assert.equal(o.verhelp('workaround').ok, true);
  o.maand(1);
  const w = o.kijk().dienst.weet;
  const gezien = (w.gezien || []).find(x => /Koeling/.test(x.naam));
  assert.ok(gezien, 'de verzette stand hoort waarneembaar te zijn: ' + JSON.stringify(w));
  assert.equal(gezien.staat, 'workaround');
  assert.equal(gezien.uitgelegd, false, 'en niemand heeft verteld waarom');
  assert.deepEqual(Object.keys(gezien).sort(), ['naam', 'staat', 'uitgelegd'],
    'een waarneming draagt geen naam en geen bedrag');
});

test('je eigen ingreep en je eigen overdracht zijn geen nieuws', () => {
  /* Wie zelf de noodkoeling neerzette hoeft de volgende avond niet te lezen dat
     er een noodkoeling staat, en wie zelf heeft doorgegeven al helemaal niet dat
     iemand iets heeft doorgegeven. Zonder die twee regels is de strook een echo
     van je eigen avond.

     DEZE TOETS DEED DAT EERST NIET ECHT. Hij keek naar een ploeg die niets had
     doorgegeven, en dan is `gekregen` per definitie leeg -- een toets die niet
     kan zakken. Nu geeft Boris werkelijk iets door, en de vraag is of hij het
     terugkrijgt. */
  const o = opstelling('k-d3');
  assert.ok(koelstoringMet(o, 'workaround', true), 'de avond hoort met een overdracht af te lopen');
  assert.equal(OVER.lijst(o.zaak).length, 1, 'er is echt iets doorgegeven');
  o.maand(1);
  const w = o.kijk().dienst.weet;
  assert.deepEqual(w.gezien, [], 'je eigen stand terugkrijgen is geen waarneming');
  assert.deepEqual(w.gekregen, [],
    'en je eigen overdracht terugkrijgen is een echo: ' + JSON.stringify(w.gekregen));
  /* MAAR HIJ IS ER WEL, en hij telt: de zaak betaalt geen arbeidstijd meer voor
     een noodkoeling waarvan is doorgegeven waarom hij draait. */
  assert.equal(OVER.onwetend(o.zaak, STORING.vind(o.zaak, 'koeling')), false);
});

/* ============ 5. het bedrag staat in de audit, nooit op de knop ============ */

test('geen enkele uitweg noemt een bedrag op de knop', () => {
  /* "Kost 1.184 en voorkomt 2.722" maakt van bedrijfsvoering een rekensom
     waarin de beste knop zichzelf verraadt. De AARD staat er, de OMVANG hangt
     aan de situatie -- uit bedrijf nemen is in een volle zaak een vermogen en in
     een rustige zaak bijna gratis (scripts/magnaat-storing.js). */
  const opties = SOORTEN.flatMap(s => s.opties || []);
  assert.ok(opties.length >= 4, 'er horen uitwegen te zijn om te keuren');
  for (const o of opties) {
    assert.ok(o.gevolg, o.id + ' hoort te zeggen wat voor gevolg eraan hangt');
    assert.equal(/[0-9]|€|euro|procent|%/i.test(o.gevolg), false,
      o.id + ' noemt een omvang op de knop: ' + o.gevolg);
    assert.ok(o.gevolg.includes('·'),
      o.id + ' hoort twee helften te hebben -- wat het kost en wat het oplevert');
  }
});

/* ============ 6. de keten overleeft de storing ============ */

test('als de koeling gemaakt is, is de keten juist compleet', () => {
  /* Hij staat op de ZAAK en niet op de storing, en dat is de hele reden: een
     opgeloste storing wordt opgeruimd (storing.js `ruim`), en dan zou de keten
     verdwijnen op het moment dat hij iets te vertellen heeft. */
  const o = opstelling('k-e');
  assert.ok(koelstoringMet(o, 'escaleren'));
  o.maand(1);
  o.verhelp('repareren');
  o.maand(2);
  assert.equal(STORING.heeft(o.zaak, 'koeling'), false, 'de koeling is gemaakt en opgeruimd');
  const keten = KETEN.lijst(o.zaak).slice().reverse();
  assert.deepEqual(keten.map(f => f.optie), ['escaleren', 'repareren'],
    'en de keten is er nog: ' + JSON.stringify(keten));
  assert.deepEqual(keten.map(f => f.wie), ['boris', 'anna'],
    'Boris constateerde en escaleerde, Anna besloot -- in die volgorde');
  assert.ok(keten[1].spoed > 0, 'en de rekening is financieel geland');
});

/* ============ 7. hij is afgekapt ============ */

test('de keten is begrensd -- een audit is geen bak', () => {
  const v = { id: 'v1', storingen: [] };
  for (let i = 0; i < KETEN.LENGTE * 3; i++)
    KETEN.noteer(v, { maand: i, soort: 'koeling', optie: 'workaround', wie: 'x', rol: 'vakkracht' });
  assert.equal(KETEN.lijst(v).length, KETEN.LENGTE);
  assert.ok(KETEN.LENGTE > 0 && KETEN.LENGTE < 100);
  /* en de NIEUWSTE blijft staan: een audit die de laatste regel weggooit om de
     eerste te bewaren, vertelt je wat er lang geleden gebeurde */
  assert.equal(KETEN.lijst(v)[0].maand, KETEN.LENGTE * 3 - 1);
});

test('een besluit zonder uitweg landt nergens', () => {
  const v = { id: 'v1' };
  assert.equal(KETEN.noteer(v, { maand: 1, soort: 'koeling' }), null);
  assert.equal(KETEN.noteer(null, { maand: 1, optie: 'uit' }), null);
  assert.deepEqual(KETEN.lijst(v), []);
});

/* ============ 8. de storing zelf blijft een stand ============ */

test('de drie bewaarlagen schuiven niet', () => {
  /* De STORING draagt de stand van nu en geen logboek -- dezelfde eis als in
     test/spelrush.test.js. Wat erbij kwam is een audit NAAST hem, op de zaak, en
     die is afgekapt en gaat weg met de partij. Wat er NIET bij kwam is
     geschiedenis: de drempel daarvoor staat onveranderd in rush-nalaten.js. */
  const o = opstelling('k-f');
  assert.ok(koelstoringMet(o, 'escaleren'));
  o.maand(1);
  for (const s of o.zaak.storingen || [])
    assert.deepEqual(Object.keys(s).sort(), ['sinds', 'sindsStand', 'soort', 'staat'],
      'de storing hoort de stand te dragen en geen keten');
  const f = KETEN.lijst(o.zaak)[0];
  assert.deepEqual(Object.keys(f).sort(), ['deed', 'maand', 'optie', 'rol', 'soort', 'wie'],
    'en de audit draagt geen oordeel, geen score en geen tweede kopie van de stand');
});

/* ============ 9. de overdracht: wat je doorgeeft, en wat het kost ============ */

test('doorgeven kost een moment van je dienst -- en dat is de hele economie', () => {
  /* Geen apart budget en geen gratis knop: dat ene moment is een bestelling die
     blijft staan, en die kost NU geld terwijl de overdracht pas volgende maand
     iets bespaart. Precies waarom er in het echt zo slecht wordt overgedragen.

     TWEE DEZELFDE AVONDEN (zelfde potje-id, dus dezelfde voorvallen op dezelfde
     momenten), een met en een zonder overdracht. De avond met hoort duurder af
     te lopen -- er is een moment minder gewerkt. */
  const avond = (id, geefDoor) => {
    const o = opstelling(id);
    STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
    let r = o.kijk(), over = false;
    for (let i = 0; i < R_SLOTS + 2 && r.dienst && !r.dienst.klaar; i++) {
      if (geefDoor && !over && (r.dienst.overTeDragen || []).length) {
        over = true;
        r = o.m.eco.zet(o.p, 'boris', { actie: 'rush-overdragen' });
        continue;
      }
      const open = r.dienst.open || [];
      if (!open.length) break;
      const k = open.find(x => x.id === 'koeling');
      r = k ? o.pak('koeling', 'workaround') : o.pak(open[0].id);
    }
    return { o, r, over };
  };
  const met = avond('k-g', true), zonder = avond('k-g', false);
  assert.equal(met.over, true, 'er hoorde iets door te geven te zijn');
  assert.equal(zonder.over, false);
  const a = met.r.dienst.uitkomst, b = zonder.r.dienst.uitkomst;
  assert.ok(a && b, 'beide avonden horen af te zijn');
  assert.ok(a.derving > b.derving,
    'een avond waarin je een moment aan de overdracht besteedt, laat meer liggen: '
    + a.derving + ' tegen ' + b.derving);
  /* EN HET IS EEN MOMENT EN NIET MEER. Zonder deze grens is doorgeven een straf
     in plaats van een keuze. */
  assert.ok(a.bleefLiggen.length - b.bleefLiggen.length <= 1,
    'het hoort precies een moment te kosten, niet meer');
});

test('zonder iets om door te geven staat er geen knop', () => {
  /* Een knop die niets doet leert de speler dat knoppen niets doen. */
  const o = opstelling('k-h');
  const d = o.kijk().dienst;
  assert.deepEqual(d.overTeDragen, []);
  assert.equal(o.m.eco.zet(o.p, 'boris', { actie: 'rush-overdragen' }).status, 409);
});

test('een overdracht komt aan bij de volgende ploeg, een ontbrekende niet', () => {
  const maak = (id, geefDoor) => {
    const o = opstelling(id);
    /* Anna zet de noodkoeling neer -- dan is het niet Boris z'n eigen ingreep en
       is er dus echt iets over te dragen aan hem. */
    STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
    o.verhelp('workaround');
    if (geefDoor) OVER.noteer(o.zaak, { maand: o.st.maand, soort: 'koeling',
      wie: 'anna', rol: 'eigenaar', staat: 'workaround',
      deed: 'een noodkoeling geregeld voor koeling B' });
    o.maand(1);
    return o.kijk().dienst.weet;
  };
  const met = maak('k-i1', true), zonder = maak('k-i2', false);
  assert.equal(met.gekregen.length, 1, 'wat is doorgegeven komt aan: ' + JSON.stringify(met));
  assert.equal(met.gekregen[0].wie, 'CN-anna');
  assert.deepEqual(zonder.gekregen, [], 'en wat niet is doorgegeven komt niet aan');
  /* BEIDE PLOEGEN ZIEN WEL DE STAND. Dat is het hele punt: de wereld is voor
     allebei gelijk, wat ze WETEN is dat niet. */
  assert.equal(met.gezien.length, 1);
  assert.equal(zonder.gezien.length, 1);
  assert.equal(met.gezien[0].uitgelegd, true);
  assert.equal(zonder.gezien[0].uitgelegd, false);
});

test('een ongedocumenteerde ingreep kost de zaak arbeidstijd, elke maand', () => {
  /* GEEN SCORE MAAR EEN KOSTENPOST. Het loopt via `vast` -- dezelfde post die de
     noodoplossing zelf al gebruikt ("iemand is er elke dienst mee bezig") -- dus
     er komt geen regel bij, alleen een reden waarom hij hoger staat. */
  const maak = (id, geefDoor) => {
    const o = opstelling(id);
    STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
    o.verhelp('workaround');
    if (geefDoor) OVER.noteer(o.zaak, { maand: o.st.maand, soort: 'koeling',
      wie: 'anna', rol: 'eigenaar', staat: 'workaround', deed: 'noodkoeling' });
    o.maand(1);
    return o.st.laatste.anna.regels.find(x => x.id === o.zaak.id);
  };
  const met = maak('k-j1', true), zonder = maak('k-j2', false);
  assert.ok(zonder.vast > met.vast,
    'zonder uitleg hoort de zaak meer arbeidstijd kwijt te zijn: '
    + zonder.vast + ' tegen ' + met.vast);
  /* EN VERDER NIETS. Geen omzet uit het niets, geen tweede post: alleen `vast`
     beweegt, precies zoals scripts/magnaat-pomp.js het wil zien. */
  assert.equal(zonder.omzet, met.omzet, 'omzet hoort niet te bewegen van een ontbrekende uitleg');
  assert.equal(zonder.derving, met.derving, 'en derving ook niet');
  assert.equal(zonder.resultaat < met.resultaat, true, 'het verschil landt in het resultaat');
});

test('een storing die gewoon open ligt vraagt geen uitleg', () => {
  /* Open is voor iedereen zichtbaar precies wat het is: de koeling doet het
     niet. Daar valt niets uit te leggen, en een zaak die er niets aan heeft
     gedaan hoort geen boete te krijgen voor het niet-documenteren van niets. */
  const o = opstelling('k-k');
  STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
  const s = STORING.vind(o.zaak, 'koeling');
  assert.equal(OVER.onwetend(o.zaak, s), false);
  assert.equal(OVER.effect(o.zaak, [s]).vast, 1);
});

test('een overdracht die niet meer bij de stand hoort, is ruis en verdwijnt', () => {
  const o = opstelling('k-l');
  STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
  o.verhelp('workaround');
  OVER.noteer(o.zaak, { maand: o.st.maand, soort: 'koeling', wie: 'anna',
    rol: 'eigenaar', staat: 'workaround', deed: 'noodkoeling' });
  o.maand(1);
  assert.equal(OVER.lijst(o.zaak).length, 1);
  o.verhelp('repareren');
  o.maand(2);
  assert.deepEqual(OVER.lijst(o.zaak), [],
    'een uitleg over een noodkoeling die gemaakt is, is geen informatie meer');
});

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
function koelstoringMet(o, hoe) {
  STORING.uitVoorval(o.zaak, 'machinebreuk', o.st.maand);
  let r = o.kijk(), gedaan = false;
  for (let i = 0; i < R_SLOTS + 2 && r.dienst && !r.dienst.klaar; i++) {
    const open = r.dienst.open || [];
    if (!open.length) break;
    const k = open.find(x => x.id === 'koeling');
    if (k && !gedaan) { gedaan = true; r = o.pak('koeling', hoe); continue; }
    r = o.pak(open[0].id);
  }
  return gedaan;
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

/* ============ 4. de volgende dienst leest wat er besloten is ============ */

test('de volgende dienst leest wat de zaak besloot -- en niet zijn eigen besluit', () => {
  const o = opstelling('k-d');
  assert.ok(koelstoringMet(o, 'escaleren'));
  o.maand(1);
  /* Anna beslist: een monteur. Dat kost geld en dat is precies waarom het
     besluit bij haar ligt en niet op de vloer. */
  const r = o.verhelp('repareren');
  assert.equal(r.ok, true, JSON.stringify(r));
  o.maand(1);
  const d = o.kijk().dienst;
  const namen = (d.overdracht || []).map(x => x.wie);
  assert.ok(namen.includes('CN-anna'), 'het besluit van de eigenaar hoort in de overdracht: '
    + JSON.stringify(d.overdracht));
  assert.equal(namen.includes('CN-boris'), false,
    'je eigen melding terugkrijgen is geen overdracht maar een echo');
  const mijne = (d.overdracht || []).find(x => x.wie === 'CN-anna');
  assert.match(mijne.deed, /gerepareerd|repareren/);
  assert.equal(mijne.rol, 'eigenaar');
  assert.ok(mijne.spoed > 0, 'en wat het werkelijk kostte staat erbij, achteraf');
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

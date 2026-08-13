/* MAGNAAT: DE AI-MANAGER -- je zaken laten draaien terwijl je er niet bent.

   ACHT BEWERINGEN, en ze zijn alle acht stil terug te draaien:

   1. HIJ DOET NIETS WAT JIJ NIET OOK KUNT. Dezelfde actietabel als het scherm,
      geen eigen ingang. Deze toets bestaat omdat het hier echt is misgegaan.
   2. SAFE MANAGEMENT POLICY. Openen, uitbreiden, lenen, tekenen en onderzoeken
      staan uit tot je ze aanzet.
   3. HIJ KOST GELD, elke maand, en dat geld verlaat de wereld.
   4. DELEGEREN IS NIET STRIKT BETER DAN OPLETTEN.
   5. HIJ REPAREERT WAT ER ECHT MIS IS: onderhoud dat wegzakt, bezetting die
      knelt.
   6. ALLES STAAT IN HET LOG, met de reden erbij.
   7. HIJ IS DETERMINISTISCH (GAMEHALL.md 12.4).
   8. EEN ANDER ZIET NIET DAT JE DELEGEERT.

   Draai los: node --experimental-sqlite --test test/spelbeheer.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const B = require('../server/kern/spellen/magnaat/beheer');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const kavelIn = (zone, n = 0) => kaart('ijmuiden').kavels.filter(k => k.zone === zone)[n];

/* DEZELFDE PARTIJ-ID VOOR ELKE GEPAARDE METING, en dat is geen detail. De
   partij-id voedt de hash waaruit de risico's worden getrokken (./risico.js) en
   sinds de onderzoekslaag ook de uitkomsten. Twee opstellingen met een andere id
   krijgen dus andere branden, en dan meet je het weer en niet de manager. Deze
   toetsen liepen daar meteen op vast: bij een doel van honderd stond de ene zaak
   na vierentwintig maanden op 100 en de andere op 82, met een manager die
   aantoonbaar niets had gedaan. */
function opstelling(id = 'p1') {
  const m = maakMagnaat();
  const p = { id, soort: 'magnaat', spelers: ['anna', 'boris'], teams: [0, 1], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of p.spelers) p.staat.geld[h] = 2000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 40, naam: 'Zeezicht' });
  return { m, p, st: p.staat, A: p.staat.vestigingen.anna[0] };
}
const maand = (m, p, n = 1) => {
  for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); }
};
/* Een verwaarloosde zaak: geen onderhoud, te weinig mensen. Dat is de toestand
   waarin een manager iets te doen heeft; een zaak die al goed staat laat hij met
   rust, en dan meet je niets. */
const verwaarloos = (m, p, id = 'v1') => m.eco.zet(p, 'anna', { actie: 'beleid', id, onderhoud: 0, personeel: 1 });

/* ================= 1. hij doet niets wat jij niet ook kunt ================= */

test('elke actie die de manager gebruikt bestaat ook echt', () => {
  /* DEZE TOETS BESTAAT OM EEN FOUT DIE HIER IS GEMAAKT. De manager werd
     samengesteld met de actietabel van de LAGEN, en die mist juist de
     basisacties -- `beleid` stond er niet in. Elke zet van de manager viel op
     een `undefined`, wat gewoon niets doet en niets meldt: hij draaide, rekende
     zijn tarief, schreef netjes niets in zijn log, en keek acht maanden toe hoe
     het onderhoud van 72 naar 44 zakte. Geen enkele toets zag dat.

     Nu noemt ./beheer.js de acties die hij gebruikt, en deze toets kijkt of ze
     in de echte tabel van de motor zitten. */
  const { m, p } = opstelling();
  const tabel = m.eco.acties();
  assert.ok(B.GEBRUIKT.length, 'de manager hoort te zeggen wat hij gebruikt');
  for (const naam of B.GEBRUIKT)
    assert.equal(typeof tabel[naam], 'function', naam + ' zit niet in de actietabel van de motor');
  assert.ok(p);
});

test('de manager heeft geen eigen ingang naar de staat', () => {
  /* Wet 1 andersom: zijn module krijgt de actietabel INJECTED en raakt de
     staat verder niet aan. Een tweede manier om een vestiging te veranderen is
     een tweede economie, en die lopen uiteen zodra iemand aan een van beide
     sleutelt. */
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/magnaat/beheer.js'), 'utf8');
  const buiten = bron.split('\n').filter(r => /\bv\.(onderhoud|personeel|prijs|omvang|tech)\s*=/.test(r));
  assert.deepEqual(buiten, [], 'de manager schrijft rechtstreeks op een vestiging');
});

/* ================= 2. Safe Management Policy ================= */

test('alles wat je bedrijf groter maakt staat standaard uit', () => {
  for (const k of B.MAGLIJST)
    assert.equal(B.STANDAARD.mag[k], false, k + ' staat standaard aan');
  const { m, p, st } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'beheer-aan' });
  assert.deepEqual(B.regelsVan(st, 'anna').mag, B.STANDAARD.mag);
});

test('een manager zonder toestemming opent, leent en tekent niets', () => {
  const { m, p, st } = opstelling();
  verwaarloos(m, p);
  m.eco.zet(p, 'anna', { actie: 'beheer-aan' });
  /* DIEP IN DE MIN, want dat is de enige toestand waarin lenen uberhaupt in
     beeld komt. Met een positieve kas komt de manager niet eens aan de
     toestemming toe, en dan overleeft het wegnemen van die toestemming deze
     toets gewoon -- wat hij ook deed. */
  st.geld.anna = -80000;
  maand(m, p, 18);
  assert.equal(st.vestigingen.anna.length, 1, 'hij heeft niets geopend');
  assert.equal((st.leningen || []).filter(l => l.speler === 'anna').length, 0, 'en niets geleend');
  assert.equal((st.contracten || []).length, 0, 'en niets getekend');
  assert.equal((st.onderzoek || []).length, 0, 'en niets onderzocht');
  assert.equal((st.polissen || []).length, 0, 'en niets verzekerd');
});

test('met toestemming lost hij rood staan op, en alleen dat', () => {
  const { m, p, st } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'beheer-aan' });
  m.eco.zet(p, 'anna', { actie: 'beheer-regels', mag: { lenen: true }, kasbuffer: 0 });
  st.geld.anna = -40000;
  maand(m, p, 2);
  const leningen = (st.leningen || []).filter(l => l.speler === 'anna');
  assert.equal(leningen.length, 1, 'precies een lening');
  assert.equal(leningen[0].soort, 'werkkapitaal', 'de goedkoopste vorm voor een tekort');
  assert.ok(st.geld.anna > -40000, 'en de kas is uit de diepe min');
});

test('een onbekende toestemming wordt niet stil overgenomen', () => {
  const { m, p, st } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'beheer-regels', mag: { uitbreidenn: true, lenen: true } });
  const r = B.regelsVan(st, 'anna');
  assert.equal(r.mag.lenen, true, 'wat wel bestaat wordt gezet');
  assert.equal(r.mag.uitbreidenn, undefined, 'en een typefout wordt geen toestemming');
  assert.deepEqual(Object.keys(r.mag).sort(), B.MAGLIJST.slice().sort());
});

test('regels bijstellen laat de rest staan', () => {
  const { m, p, st } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'beheer-regels', mag: { lenen: true } });
  m.eco.zet(p, 'anna', { actie: 'beheer-regels', onderhoudsdoel: 90 });
  const r = B.regelsVan(st, 'anna');
  assert.equal(r.onderhoudsdoel, 90);
  assert.equal(r.mag.lenen, true, 'wie zijn doel verzet raakt zijn toestemmingen niet kwijt');
});

/* ================= 3. hij kost geld, en het verlaat de wereld ============== */

test('beheer kost elke maand geld, en dat staat op het maandoverzicht', () => {
  const { m, p, st } = opstelling();
  maand(m, p, 2);
  const zonder = st.geld.anna;
  maand(m, p, 1);
  const gewoon = st.geld.anna - zonder;

  const b = opstelling();
  maand(b.m, b.p, 2);
  b.m.eco.zet(b.p, 'anna', { actie: 'beheer-aan' });
  const voor = b.st.geld.anna;
  maand(b.m, b.p, 1);
  const met = b.st.geld.anna - voor;

  assert.ok(met < gewoon, 'een manager kost geld: ' + Math.round(gewoon) + ' -> ' + Math.round(met));
  const regel = b.st.laatste.anna.regels.find(r => r.soort === 'beheer');
  assert.ok(regel, 'en hij staat als eigen regel op het overzicht');
  assert.ok(regel.resultaat < 0);
  assert.equal(Math.round(gewoon - met), -regel.resultaat, 'precies het bedrag van de regel');
});

test('het beheertarief verlaat de wereld en komt bij niemand terecht', () => {
  /* Dezelfde categorie als rente, premie en onderzoek: een LEK. Zonder dat de
     maandloop hem meetelt, ziet de geldpompmeter geld verdwijnen dat niemand
     heeft opgeteld -- en dat is net zo goed een fout als geld dat erbij komt. */
  const { m, p, st } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'beheer-aan' });
  st.gerekendTot -= st.maandMs;
  const [verslag] = m.eco.bijrekenen(p);
  assert.ok(verslag.beheerlast > 0, 'de maand meldt wat het beheer kostte');
  const som = st.laatste.anna.regels.filter(r => r.soort === 'beheer')
    .reduce((n, r) => n - r.resultaat, 0);
  assert.equal(verslag.beheerlast, Math.round(som));
});

test('de prijs staat op het scherm voordat je aanzet', () => {
  const { m, p, st } = opstelling();
  maand(m, p, 2);
  const beeld = m.eco.zicht(p, st, 'anna').beheer;
  assert.equal(beeld.aan, false);
  assert.ok(beeld.kostenPerMaand > 0, 'wat het gaat kosten staat er voordat je kiest');
  const r = m.eco.zet(p, 'anna', { actie: 'beheer-aan' });
  assert.equal(r.kostenPerMaand, beeld.kostenPerMaand, 'en het antwoord zegt hetzelfde');
});

/* ================= 4. delegeren is niet strikt beter ================= */

test('bij hetzelfde beleid ben je met een manager precies het tarief armer', () => {
  /* DE BALANSEIS, en de eerste versie mat hem verkeerd. Die zette een manager
     naast een speler die zijn onderhoudsbudget EEN KEER zet en nooit meer kijkt
     -- en dan wint de manager, met ruim twee ton over vierentwintig maanden. Dat
     is geen bevoorrechting maar een ANDER BELEID: hij draait de zaak op zijn doel
     van zeventig in plaats van hem op honderd te poetsen, en ruilt zo kwaliteit
     tegen kas. Een speler die datzelfde met de hand doet, krijgt hetzelfde.

     De wet die er werkelijk toe doet is scherper en niet tautologisch: bij
     GELIJK GEDRAG kost delegeren precies het tarief. Daarom een zaak die al op
     zijn doel staat -- dan heeft de manager niets te doen en blijft alleen zijn
     rekening over. Is die rekening er niet, dan is delegeren gratis en is het
     geen keuze meer maar de eerste zet van elke speler. */
  const draai = (metBeheer) => {
    const { m, p, st, A } = opstelling();
    // precies op het doel van de manager, zodat hij niets te repareren heeft
    m.eco.zet(p, 'anna', { actie: 'beheer-regels', onderhoudsdoel: 100 });
    if (metBeheer) m.eco.zet(p, 'anna', { actie: 'beheer-aan' });
    maand(m, p, 24);
    return { vermogen: m.eco.eindstand(p).find(x => x.codenaam === 'CN-anna').vermogen,
      onderhoud: Math.round(A.onderhoud), budget: A.onderhoudBudget, personeel: A.personeel };
  };
  const zonder = draai(false), met = draai(true);
  assert.equal(met.onderhoud, zonder.onderhoud, 'de zaak staat er hetzelfde voor');
  assert.equal(met.budget, zonder.budget, 'en er is niets aan het beleid veranderd');
  assert.equal(met.personeel, zonder.personeel);
  assert.ok(met.vermogen < zonder.vermogen,
    'dus alleen het tarief blijft over: ' + zonder.vermogen + ' -> ' + met.vermogen);
});

test('een manager verdient zichzelf terug op een zaak die wegzakt', () => {
  /* De andere kant, en zonder deze toets is de vorige een verbod: als delegeren
     ALLEEN maar kost, is het nooit de moeite. Waar hij voor is, is de speler die
     er even niet is -- en dan hoort hij meer op te halen dan hij vraagt. */
  const draai = (metBeheer) => {
    const { m, p, st } = opstelling();
    verwaarloos(m, p);
    if (metBeheer) m.eco.zet(p, 'anna', { actie: 'beheer-aan' });
    maand(m, p, 24);
    return m.eco.eindstand(p).find(x => x.codenaam === 'CN-anna').vermogen;
  };
  const zonder = draai(false), met = draai(true);
  assert.ok(met > zonder, 'wie niet kijkt is beter af met een manager: ' + zonder + ' -> ' + met);
});

/* ================= 5. hij repareert wat er echt mis is ================= */

test('hij trekt wegzakkend onderhoud weer op', () => {
  const draai = (metBeheer) => {
    const { m, p, st, A } = opstelling();
    verwaarloos(m, p);
    if (metBeheer) m.eco.zet(p, 'anna', { actie: 'beheer-aan' });
    maand(m, p, 20);
    return A.onderhoud;
  };
  const zonder = draai(false), met = draai(true);
  assert.ok(met > zonder + 20, 'de manager houdt het pand op de been: ' +
    Math.round(zonder) + ' -> ' + Math.round(met));
  assert.ok(met >= 60, 'en in de buurt van zijn doel');
});

test('hij zet er mensen bij als er vraag wegloopt', () => {
  const { m, p, st, A } = opstelling();
  verwaarloos(m, p);
  maand(m, p, 2);
  assert.equal(A.personeel, 1);
  m.eco.zet(p, 'anna', { actie: 'beheer-aan' });
  maand(m, p, 4);
  assert.ok(A.personeel > 1, 'er zijn handen bijgekomen: ' + A.personeel);
  const reden = st.beheer.anna.log.find(x => x.wat === 'mensen erbij');
  assert.ok(reden, 'en er staat waarom');
  assert.match(reden.waarom, /vraag weg|bezetting/);
});

test('hij stuurt mensen weg die er niet nodig zijn', () => {
  const { m, p, st, A } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'beleid', id: A.id, personeel: 12 });
  m.eco.zet(p, 'anna', { actie: 'beheer-aan' });
  maand(m, p, 4);
  assert.ok(A.personeel < 12, 'te veel handen kosten geld: ' + A.personeel);
  assert.ok(st.beheer.anna.log.some(x => x.wat === 'mensen eraf'));
});

test('zonder toestemming raakt hij de prijsstand niet aan', () => {
  const { m, p, st, A } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'beleid', id: A.id, personeel: 1 });
  m.eco.zet(p, 'anna', { actie: 'beheer-aan' });
  maand(m, p, 10);
  assert.equal(A.prijs, 'midden', 'de prijsstand is een merkbeslissing');
  assert.ok(!st.beheer.anna.log.some(x => /prijsstand/.test(x.wat)));
});

/* ================= 6. alles staat in het log ================= */

test('elk besluit heeft een reden en een maand', () => {
  const { m, p, st } = opstelling();
  verwaarloos(m, p);
  m.eco.zet(p, 'anna', { actie: 'beheer-aan' });
  maand(m, p, 12);
  const log = st.beheer.anna.log;
  assert.ok(log.length, 'er is iets gebeurd');
  for (const x of log) {
    assert.ok(typeof x.maand === 'number', 'elk besluit heeft een maand');
    assert.ok(x.wat && x.waarom, 'en een wat en een waarom: ' + JSON.stringify(x));
  }
  assert.ok(log.length <= B.LOGLENGTE, 'het log blijft leesbaar');
  const beeld = m.eco.zicht(p, st, 'anna').beheer;
  assert.ok(beeld.log.length && beeld.log.length <= 20, 'en de speler ziet het');
});

/* ================= 7. deterministisch ================= */

test('tien maanden in een keer geeft dezelfde besluiten als tien maanden los', () => {
  const draai = (stappen) => {
    const { m, p, st, A } = opstelling('zelfde');
    verwaarloos(m, p);
    m.eco.zet(p, 'anna', { actie: 'beheer-aan' });
    for (const n of stappen) maand(m, p, n);
    return { onderhoud: A.onderhoud, budget: A.onderhoudBudget, personeel: A.personeel,
      geld: Math.round(st.geld.anna), log: st.beheer.anna.log.map(x => x.maand + ':' + x.wat) };
  };
  assert.deepEqual(draai([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]), draai([10]),
    'de klok rekent bij; hij tikt niet');
});

/* ================= 8. een ander ziet het niet ================= */

test('of jij delegeert gaat een tegenpartij niet aan', () => {
  const { m, p, st } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'beheer-aan' });
  m.eco.zet(p, 'anna', { actie: 'beheer-regels', kasbuffer: 987654 });
  maand(m, p, 3);
  const bij = JSON.stringify(m.eco.zicht(p, st, 'boris'));
  assert.ok(!/987654/.test(bij), 'boris hoort de regels niet te zien');
  assert.equal(m.eco.zicht(p, st, 'boris').beheer.aan, false, 'en niet dat er een manager draait');
  assert.equal(m.eco.zicht(p, st, 'anna').beheer.aan, true);
});

test('beheer instellen is een vrije actie', () => {
  const d = maakMagnaat().spel;
  for (const naam of ['beheer-aan', 'beheer-uit', 'beheer-regels'])
    assert.ok(d.buitenBeurt.includes(naam), naam + ' hoort buiten je beurt te mogen');
});

/* ================= 9. hij laat een kapotte zaak niet bloeden ================= */

const STORING = require('../server/kern/spellen/magnaat/storing');
const OVER = require('../server/kern/spellen/magnaat/overdracht');

/* Een zaak met een kapotte koeling en een manager die eraan mag zitten.
   `kasbuffer` op nul, want deze toetsen gaan over het MANDAAT en niet over de
   vraag of er geld is. */
function metStoring(id, mandaat) {
  const o = opstelling(id);
  o.m.eco.zet(o.p, 'anna', { actie: 'beheer-aan' });
  /* HET MANDAAT WOONT ONDER `mag`, en niet in een eigen veld: `regelsVan` leest
     dezelfde map twee keer -- als bedrag (`mandaat`) en als ja-of-nee (`mag`).
     Deze toets ging daar de eerste keer op onderuit door een `mandaat`-sleutel
     te sturen die nergens gelezen wordt. */
  o.m.eco.zet(o.p, 'anna', { actie: 'beheer-regels',
    kasbuffer: 0, ...(mandaat ? { mag: mandaat } : {}) });
  STORING.uitVoorval(o.A, 'machinebreuk', o.st.maand);
  return o;
}
const logVan = (st) => ((st.beheer || {}).anna || {}).log || [];

test('een manager laat een kapotte koeling niet staan', () => {
  /* HET GAT DAT DE OVERDRACHTSLAAG DUURDER MAAKTE. Hij kon `beleid` en
     `krediet-opnemen` en verder niets, dus wie op vakantie ging met een kapotte
     koeling liet een manager achter die ernaar keek terwijl de derving doorliep.
     Dat botst met de belofte van hoofdstuk 13: weg zijn mag alleen kosten wat de
     wereld logisch veroorzaakt. */
  const o = metStoring('b-s1');
  assert.ok(STORING.heeft(o.A, 'koeling'), 'de koeling is stuk');
  maand(o.m, o.p, 1);
  assert.equal(STORING.heeft(o.A, 'koeling'), false,
    'een manager zonder grens hoort hem gewoon te laten repareren');
  const regel = logVan(o.st).find(x => /repareren/.test(x.wat));
  assert.ok(regel, 'en het hoort in zijn log te staan: ' + JSON.stringify(logVan(o.st)));
  assert.ok(regel.bedrag > 0, 'met het bedrag erbij');
  assert.match(regel.waarom, /stuk/);
});

test('een krap mandaat maakt er een noodoplossing van, met de reden erbij', () => {
  /* HIER GAAT HET MANDAAT EINDELIJK ERGENS OVER. "Onderhoud tot 7.500" was een
     plafond op een budget; nu beslist het of hij de monteur belt of de zaak op
     een noodkoeling laat draaien tot jij terug bent. En hij laat het NIET
     bloeden: een noodoplossing kost geen geld en stopt het bederf grotendeels. */
  const o = metStoring('b-s2', { onderhoud: 1 });
  maand(o.m, o.p, 1);
  const s = STORING.vind(o.A, 'koeling');
  assert.ok(s, 'de koeling is niet gerepareerd');
  assert.equal(s.staat, 'workaround', 'maar hij staat wel op een noodoplossing');
  const regel = logVan(o.st).find(x => /noodoplossing/.test(x.wat));
  assert.ok(regel, 'en je hoort waarom: ' + JSON.stringify(logVan(o.st)));
  assert.match(regel.waarom, /mandaat/,
    '"hij mocht het niet" hoort met zoveel woorden in het log te staan');
});

test('een manager schrijft zijn noodoplossing op', () => {
  /* Hij is degene die het besloot, en zijn bureau staat niet midden in de
     drukte. Een vakkracht betaalt de overdracht met een moment van zijn dienst;
     een manager niet -- dat is geen voorrecht maar hetzelfde verschil dat in het
     echt bestaat. Wat hij ervoor rekent staat in zijn tarief. */
  const o = metStoring('b-s3', { onderhoud: 1 });
  maand(o.m, o.p, 1);
  const s = STORING.vind(o.A, 'koeling');
  assert.equal(OVER.onwetend(o.A, s), false,
    'een noodkoeling van de manager hoort niet als onverklaard te blijven staan');
  assert.equal(OVER.lijst(o.A).length, 1);
  assert.equal(OVER.lijst(o.A)[0].rol, 'manager');
});

test('hij herhaalt zichzelf niet zolang de noodoplossing staat', () => {
  /* Een besluit dat al genomen is nog een keer nemen is geen besluit maar een
     herhaling, en het log is een VERANTWOORDING en geen archief -- twaalf keer
     "ik mag hem nog steeds niet repareren" maakt hem onleesbaar.

     DEZE TOETS TELDE EERST ALLEEN DE NOODOPLOSSINGSREGELS, en die kon niet
     zakken: `storing-acties.js` weigert dezelfde stand toch al ("zo staat hij
     al"), dus die tweede poging landde als "blijft stuk" en werd niet geteld.
     Nu telt hij ALLES wat er over deze koeling in het log komt. */
  const o = metStoring('b-s4', { onderhoud: 1 });
  maand(o.m, o.p, 3);
  const overKoeling = logVan(o.st).filter(x => /Koeling B/.test(x.wat));
  assert.equal(overKoeling.length, 1,
    'een regel, niet een per maand: ' + JSON.stringify(overKoeling));
  assert.match(overKoeling[0].wat, /noodoplossing/);
});

test('maar als de noodoplossing bezwijkt, probeert hij het opnieuw', () => {
  /* De keerzijde van de regel hierboven, en de reden dat hij op de STAND hangt
     en niet op een vlag: een noodkoeling houdt het een paar maanden
     (magnaat/storing.js) en valt dan terug op `open`. Dan is er weer iets te
     beslissen, en hoort de manager niet stil te blijven omdat hij het ooit al
     eens gemeld heeft. */
  const o = metStoring('b-s6', { onderhoud: 1 });
  maand(o.m, o.p, STORING.WORKAROUND_MAANDEN + 2);
  const overKoeling = logVan(o.st).filter(x => /Koeling B/.test(x.wat));
  assert.ok(overKoeling.length >= 2,
    'na het bezwijken hoort hij opnieuw te handelen: ' + JSON.stringify(overKoeling));
});

test('zonder manager blijft de koeling gewoon stuk', () => {
  /* De positieve controle. Zonder deze meting bewijst het bovenstaande alleen
     dat storingen vanzelf verdwijnen. */
  const o = opstelling('b-s5');
  STORING.uitVoorval(o.A, 'machinebreuk', o.st.maand);
  maand(o.m, o.p, 2);
  assert.ok(STORING.heeft(o.A, 'koeling'), 'niemand die er iets aan doet, dus hij blijft stuk');
});

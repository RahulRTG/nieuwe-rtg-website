/* MAGNAAT: ONDERZOEK -- bedrijven die ANDERS worden in plaats van alleen groter.

   ZEVEN BEWERINGEN, en ze zijn alle zeven stil terug te draaien:

   1. HET IS EEN BOOM EN GEEN LADDER. Een ladder maakt elk bedrijf hetzelfde,
      alleen verder; een boom met vertakkingen maakt bedrijven anders.
   2. EEN EFFECT IS EEN GEMETEN PRODUCTIVITEITSWINST EN GEEN BONUS. Elk
      knooppunt grijpt aan op een getal dat de motor al gebruikt -- er is geen
      "+5% winst"-knop, want die is niet te controleren.
   3. KENNIS IS VAN HET BEDRIJF, TOEPASSING IS PER VESTIGING. Een uitvinding
      hebben is niet hetzelfde als hem gebruiken.
   4. INVESTEREN IS OP KORTE TERMIJN VERNIETIGEND. Het geld is weg en er komt
      pas later iets voor terug -- als je het toepast.
   5. DE SUBSIDIE IS EEN OVERDRACHT EN GEEN SCHEPPING. Wat de pot verlaat komt
      aan bij het onderzoek, en wat er overblijft gaat terug.
   6. DE VOORTGANG IS DETERMINISTISCH. Tien maanden in een keer geeft dezelfde
      uitkomst als tien maanden los (GAMEHALL.md 12.4).
   7. WELKE KANT EEN CONCURRENT OP ONDERZOEKT, IS NIET VAN JOU.

   Draai los: node --experimental-sqlite --test test/spelonderzoek.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const O = require('../server/kern/spellen/magnaat/onderzoek');
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
  for (const h of p.spelers) p.staat.geld[h] = 5000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 40, naam: 'Zeezicht' });
  return { m, p, st: p.staat, A: p.staat.vestigingen.anna[0] };
}
const maand = (m, p, n = 1) => {
  for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); }
};
/* Een onderzoek helemaal afmaken. Ruim budget, want deze toetsen gaan niet over
   hoe lang het duurt. */
function tot(m, p, h, sleutel, maxMaanden = 40) {
  const r = m.eco.zet(p, h, { actie: 'onderzoek-starten', sleutel, budget: O.BOOM[sleutel].kosten * 2 });
  assert.ok(r.ok, sleutel + ': ' + r.error);
  for (let i = 0; i < maxMaanden; i++) {
    maand(m, p, 1);
    const o = p.staat.onderzoek.find(x => x.id === r.id);
    if (o.status === 'klaar') return o;
  }
  throw new Error(sleutel + ' werd niet af in ' + maxMaanden + ' maanden');
}

/* ================= 1. het is een boom ================= */

test('een tak gaat pas open als zijn stam er staat', () => {
  const { m, p, st } = opstelling();
  const diep = m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: 'automatisering' });
  assert.equal(diep.status, 409, 'automatisering hoort achter energie te zitten');
  assert.match(diep.error, /eerst/);
  tot(m, p, 'anna', 'meten');
  assert.ok(m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: 'energie' }).ok,
    'na de stam gaat de tak open');
  assert.equal(m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: 'automatisering' }).status, 409,
    'maar de tak erachter nog niet');
});

test('de boom vertakt werkelijk, en je kunt er niet alles uithalen', () => {
  assert.ok(O.TAKKEN.length >= 3, 'er zijn meerdere richtingen: ' + O.TAKKEN.join(', '));
  // geen enkele tak is een enkele rij: er hangen echt knopen naast elkaar
  const perTak = {};
  for (const k of O.KNOPEN) (perTak[O.BOOM[k].tak] = perTak[O.BOOM[k].tak] || []).push(k);
  const vertakt = Object.values(perTak).filter(rij => rij.length > 1);
  assert.ok(vertakt.length >= 2, 'er horen takken met meerdere knopen te zijn');
  /* En de capaciteit maakt het een KEUZE: wie aan alles tegelijk kon werken,
     loopt de hele boom af en is de vertakking decoratie. */
  assert.ok(O.TEGELIJK < O.KNOPEN.length / 2, 'je kunt niet aan alles tegelijk werken');
  const { m, p } = opstelling();
  tot(m, p, 'anna', 'meten');
  assert.ok(m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: 'energie' }).ok);
  assert.ok(m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: 'bouwmethode' }).ok);
  const derde = m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: 'inkoopkracht' });
  assert.equal(derde.status, 429, 'de derde stuit op de capaciteit');
});

/* ================= 2. een effect is een gemeten winst ================= */

test('elk knooppunt grijpt aan op een getal dat de motor al gebruikt', () => {
  /* GEEN BONUSKNOP. Een effect dat niet op een bestaand veld aangrijpt, is niet
     na te rekenen -- en dan is "waarde uit productiviteit" een bewering in
     plaats van een meting. */
  for (const sleutel of O.KNOPEN) {
    const e = O.BOOM[sleutel].effect;
    assert.ok(e && Object.keys(e).length, sleutel + ' heeft geen effect');
    for (const veld of Object.keys(e))
      assert.ok(O.VELDEN.includes(veld),
        sleutel + ' grijpt aan op "' + veld + '", en dat is geen getal van de motor');
  }
});

/* DEZE TOETS IS HERSCHREVEN NADAT HIJ ZAKTE, en dat is de reden dat hij hier zo
   uitgebreid staat. Hij mat eerst of `automatisering` de capaciteit VERHOOGT.
   Dat doet hij niet: een zaak wordt door de motor precies bezet geopend en zit
   dus tegen zijn OMVANG aan, en een medewerker die meer aankan verandert daar
   niets aan. Wat de uitvinding werkelijk koopt is RUIMTE OM AF TE SLANKEN --
   dezelfde zaak met minder mensen. Dat is een echte productiviteitswinst en
   precies de bedoelde soort (een lagere loonpost per eenheid), maar hij komt er
   alleen uit als de speler er iets mee DOET.

   Daar kwam een gat uit: dat getal stond nergens op het scherm, dus de speler
   kon niet zien dat er iemand af kon. Een uitvinding die je alleen per ongeluk
   verzilvert, is geen keuze. Sindsdien geeft de weergave `personeelNodig` mee. */
test('automatisering koopt ruimte om af te slanken, en die ruimte is zichtbaar', () => {
  const { m, p, st } = opstelling();
  // op volle maat, want bij een kleine zaak eet het naar boven afronden de
  // besparing op: 40 stoelen vragen met en zonder automatisering drie mensen
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard', 1).id,
    sector: 'horeca', omvang: 120, naam: 'De Grote Zaal' });
  const B = st.vestigingen.anna[1];
  const beeld = () => m.eco.zicht(p, st, 'anna').vestigingen.find(x => x.id === B.id);

  const voor = beeld();
  assert.equal(voor.personeel, voor.personeelNodig, 'een nieuwe zaak start precies bezet');
  B.tech = ['automatisering'];
  const na = beeld();
  assert.equal(na.capaciteit, voor.capaciteit, 'de zaak wordt niet groter; hij zit tegen zijn omvang aan');
  assert.ok(na.personeelNodig < voor.personeelNodig,
    'maar er kunnen mensen af: ' + voor.personeelNodig + ' -> ' + na.personeelNodig);
  assert.ok(na.personeelNodig >= Math.floor(voor.personeelNodig / 1.36),
    'en niet meer dan de factor uit de boom toestaat');
});

test('de besparing komt er pas uit als je de mensen ook laat gaan', () => {
  /* HIER ZIT DE WINST, en nergens anders. Zolang de bezetting blijft staan
     betaal je de uitrol en verandert er niets aan je boeken -- dat hoort zo:
     een uitvinding is een mogelijkheid en geen bonus. */
  const meting = (tech, afslanken) => {
    const { m, p, st } = opstelling();
    m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard', 1).id,
      sector: 'horeca', omvang: 120, naam: 'De Grote Zaal' });
    const B = st.vestigingen.anna[1];
    maand(m, p, 2);
    B.tech = tech;
    if (afslanken) {
      const nodig = m.eco.zicht(p, st, 'anna').vestigingen.find(x => x.id === B.id).personeelNodig;
      m.eco.zet(p, 'anna', { actie: 'beleid', id: B.id, personeel: nodig });
    }
    maand(m, p, 1);
    const r = st.laatste.anna.regels.find(x => x.id === B.id);
    return { lonen: r.lonen, eenheden: r.eenheden, perEenheid: r.lonen / Math.max(1, r.eenheden) };
  };
  const niets = meting([], false);
  const stilzitten = meting(['automatisering'], false);
  const doen = meting(['automatisering'], true);

  assert.equal(stilzitten.lonen, niets.lonen, 'uitrollen alleen verandert de loonpost niet');
  assert.ok(doen.lonen < niets.lonen, 'afslanken wel: ' + niets.lonen + ' -> ' + doen.lonen);
  assert.equal(doen.eenheden, niets.eenheden, 'en er gaat geen enkele eenheid verloren');
  assert.ok(doen.perEenheid < niets.perEenheid,
    'dus de loonpost per eenheid daalt: ' + Math.round(niets.perEenheid) + ' -> ' + Math.round(doen.perEenheid));
});

test('energie verlaagt de vaste lasten, en dat is te zien op het maandoverzicht', () => {
  const meting = (tech) => {
    const { m, p, st, A } = opstelling();
    maand(m, p, 2);
    A.tech = tech;
    maand(m, p, 1);
    return st.laatste.anna.regels[0];
  };
  const zonder = meting([]), met = meting(['energie']);
  assert.ok(met.vast < zonder.vast, 'de vaste lasten dalen: ' + zonder.vast + ' -> ' + met.vast);
  assert.ok(Math.abs(met.vast / zonder.vast - O.BOOM.energie.effect.vast) < 0.02,
    'en precies met de factor uit de boom');
  assert.ok(met.resultaat > zonder.resultaat, 'en dat komt in het resultaat terecht');
});

test('twee uitvindingen op hetzelfde veld stapelen door vermenigvuldiging', () => {
  /* Niet door optelling, want dan kan een veld negatief worden en is de motor
     stuk. Met twee kortingen van twintig procent hou je 64% over en geen 60%. */
  assert.equal(O.factor([], 'vast'), 1);
  assert.equal(O.factor(['meten'], 'vast'), O.BOOM.meten.effect.vast);
  const samen = O.factor(['meten', 'energie'], 'vast');
  assert.ok(Math.abs(samen - O.BOOM.meten.effect.vast * O.BOOM.energie.effect.vast) < 1e-9);
  assert.ok(samen > 0, 'en het blijft positief');
});

/* ================= 3. kennis is van het bedrijf, toepassing per pand ================= */

test('uitvinden is niet hetzelfde als gebruiken', () => {
  const { m, p, st, A } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('centrum').id, sector: 'retail', omvang: 30, naam: 'Tweede' });
  const tweede = st.vestigingen.anna[1];
  tot(m, p, 'anna', 'meten');
  // uitgevonden, maar nergens uitgerold
  assert.deepEqual(A.tech || [], [], 'het draait nog nergens');
  const kas = st.geld.anna;
  const r = m.eco.zet(p, 'anna', { actie: 'onderzoek-uitrollen', sleutel: 'meten', vestiging: A.id });
  assert.ok(r.ok, r.error);
  /* DE UITROL IS EEN DEEL VAN DE BOUWSOM en geen vast bedrag, dus hij verschilt
     per pand. Zie ./onderzoek.js: met een vast bedrag hing de terugverdientijd
     aan de MAAT van de zaak, en rolde het toernooi nul keer iets uit. */
  assert.equal(r.kosten, O.uitrolkosten(A, 'meten'));
  assert.ok(r.kosten > 0, 'en dat is een echt bedrag');
  assert.equal(Math.round(kas - st.geld.anna), r.kosten, 'uitrollen kost geld');
  assert.deepEqual(A.tech, ['meten']);
  assert.deepEqual(tweede.tech || [], [], 'en het tweede pand heeft er nog niets aan');
  // elke vestiging kost opnieuw, en een groter pand kost meer
  const kas2 = st.geld.anna;
  const r2 = m.eco.zet(p, 'anna', { actie: 'onderzoek-uitrollen', sleutel: 'meten', vestiging: tweede.id });
  assert.ok(r2.ok, r2.error);
  assert.equal(Math.round(kas2 - st.geld.anna), r2.kosten);
  assert.equal(r2.kosten > r.kosten, tweede.gebouwdVoor > A.gebouwdVoor,
    'duurder pand, duurdere uitrol -- en andersom');
  // en twee keer hetzelfde pand kan niet
  assert.equal(m.eco.zet(p, 'anna', { actie: 'onderzoek-uitrollen', sleutel: 'meten', vestiging: A.id }).status, 409);
});

test('uitrollen wat je niet hebt uitgevonden kan niet', () => {
  const { m, p, st, A } = opstelling();
  const r = m.eco.zet(p, 'anna', { actie: 'onderzoek-uitrollen', sleutel: 'energie', vestiging: A.id });
  assert.equal(r.status, 409);
  assert.match(r.error, /nog niet uitgevonden/);
});

/* ================= 4. investeren is op korte termijn vernietigend ================= */

test('onderzoeken zonder toepassen kost precies wat je erin stopt en levert niets op', () => {
  const { meet, EXACT } = require('../scripts/magnaat-pomp');
  const r = meet('onderzoekZonderUitrol', 12);
  assert.ok(Math.abs(r.verschil) <= EXACT,
    'kennis die je niet toepast verandert geen enkel getal, maar er staat ' + Math.round(r.verschil));
});

test('halverwege stoppen kost je wat je erin hebt gestopt', () => {
  /* KENNIS DIE HALF AF IS, IS GEEN KENNIS. Dat is wat onderzoek tot een gok
     maakt in plaats van een spaarpot: je kunt de stekker eruit trekken, maar je
     krijgt niets terug behalve de geoormerkte subsidie. Zonder deze toets mocht
     een gestaakt onderzoek stilletjes doorlopen. */
  const { m, p, st } = opstelling();
  const r = m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: 'meten', budget: 1200 });
  maand(m, p, 2);
  const o = st.onderzoek.find(x => x.id === r.id);
  const besteed = o.besteed, half = o.voortgang;
  assert.ok(besteed > 0 && half > 0 && half < 1, 'er is echt geld in gegaan: ' + besteed);

  assert.ok(m.eco.zet(p, 'anna', { actie: 'onderzoek-budget', id: r.id, stoppen: true }).ok);
  maand(m, p, 4);
  assert.equal(o.status, 'gestaakt', 'een gestaakt onderzoek loopt niet door');
  assert.equal(o.besteed, besteed, 'en het kost ook niets meer');
  assert.equal(o.voortgang, half, 'en boekt geen voortgang meer');
  assert.equal(st.laatste.anna.regels.filter(x => x.soort === 'onderzoek').length, 0,
    'en staat niet meer op het maandoverzicht');

  // en opnieuw beginnen begint ECHT opnieuw
  const weer = m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: 'meten', budget: 1200 });
  assert.ok(weer.ok, weer.error);
  assert.equal(st.onderzoek.find(x => x.id === weer.id).voortgang, 0, 'van voren af aan');
});

test('een uitvinding betaalt zich pas terug NA de implementatie', () => {
  const meting = (doen) => {
    const { m, p, st, A } = opstelling();
    maand(m, p, 2);
    if (doen) {
      tot(m, p, 'anna', 'meten');
      m.eco.zet(p, 'anna', { actie: 'onderzoek-uitrollen', sleutel: 'meten', vestiging: A.id });
      tot(m, p, 'anna', 'energie');
      m.eco.zet(p, 'anna', { actie: 'onderzoek-uitrollen', sleutel: 'energie', vestiging: A.id });
    }
    maand(m, p, 60);
    return m.eco.eindstand(p).find(x => x.codenaam === 'CN-anna').vermogen;
  };
  const met = meting(true), zonder = meting(false);
  assert.ok(met > zonder,
    'op lange termijn hoort onderzoek zich terug te betalen: ' + met + ' tegen ' + zonder);
});

/* ================= 5. de subsidie is een overdracht ================= */

test('een subsidie komt uit de pot en niet in de kas', () => {
  const { m, p, st } = opstelling();
  maand(m, p, 3);
  const r = m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: 'meten', budget: 4000 });
  const potVoor = st.foundation.lokaal, kasVoor = st.geld.anna;
  const sub = m.eco.zet(p, 'anna', { actie: 'onderzoek-subsidie', id: r.id });
  assert.ok(sub.ok, sub.error);
  assert.equal(Math.round(potVoor - st.foundation.lokaal), sub.subsidie, 'de pot betaalt precies dat');
  assert.equal(Math.round(st.geld.anna), Math.round(kasVoor),
    'en de kas van de speler groeit er geen cent van -- een subsidie is geen uitkering');
  // en een tweede keer gaat niet
  assert.equal(m.eco.zet(p, 'anna', { actie: 'onderzoek-subsidie', id: r.id }).status, 409);
});

test('wat er van een subsidie overblijft gaat terug naar de pot', () => {
  /* Zonder deze regel verdampt geoormerkt geld: het is uit de pot gehaald en
     wordt nooit uitgegeven, dus het bestaat nergens meer. De geldpompmeter zag
     dat als waarde die uit de wereld verdween -- net zo goed een fout als
     waarde die erbij komt. */
  const { m, p, st } = opstelling();
  maand(m, p, 3);
  const r = m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: 'meten', budget: 1000 });
  const sub = m.eco.zet(p, 'anna', { actie: 'onderzoek-subsidie', id: r.id });
  assert.ok(sub.ok, sub.error);
  const potNa = st.foundation.lokaal;
  const stop = m.eco.zet(p, 'anna', { actie: 'onderzoek-budget', id: r.id, stoppen: true });
  assert.ok(stop.ok);
  assert.equal(stop.terugNaarPot, sub.subsidie, 'alles wat nog niet besteed was gaat terug');
  assert.equal(Math.round(st.foundation.lokaal - potNa), sub.subsidie);
});

test('de geldpompkeuring op de subsidie klopt', () => {
  const { meet } = require('../scripts/magnaat-pomp');
  const r = meet('subsidiestroom', 12);
  assert.equal(r.klacht, null, r.klacht);
});

/* ================= 6. de voortgang is deterministisch ================= */

test('deterministisch is niet hetzelfde als voorspelbaar', () => {
  /* ONDERZOEK IS EEN GOK MET EEN BEGROTING, geen bestelling met een leverdatum.
     De maand valt mee of tegen, en dat is precies wat het verschil maakt tussen
     "kans en richting" en een rekensom die je van tevoren kunt uitvoeren.
     Zonder deze toets kan de spreiding stil op nul, en dan is de hele post
     `SPREIDING` decoratie -- die mutatie overleefde hier eerst. */
  const k = O.BOOM.meten;
  const trekkingen = [];
  for (let mnd = 0; mnd < 60; mnd++) trekkingen.push(O.voortgang('p', mnd, 'meten', k.kosten));
  const laag = Math.min(...trekkingen), hoog = Math.max(...trekkingen);
  assert.ok(hoog / laag > 1.3, 'de ene maand loopt harder dan de andere: ' + laag + ' .. ' + hoog);
  /* Maar niet zo hard dat de begroting er niet meer toe doet: rond het normale
     tempo, en nooit achteruit. */
  assert.ok(laag > 0, 'een maand kost nooit voortgang');
  assert.ok(hoog < 2 / k.duur, 'en een meevaller is geen sprong');
  /* EN ELK ONDERZOEK HEEFT ZIJN EIGEN GELUK. Zonder het knooppunt in de
     trekking hebben twee projecten in dezelfde maand exact dezelfde meevaller,
     en dan is aan twee dingen tegelijk werken een enkele worp. */
  const zelfdeMaand = O.KNOPEN.map(s => O.voortgang('p', 7, s, O.BOOM[s].kosten) * O.BOOM[s].duur);
  assert.ok(new Set(zelfdeMaand.map(x => x.toFixed(6))).size > 1,
    'twee onderzoeken in dezelfde maand delen hun geluk niet');
  // en twee partijen ook niet: dezelfde stad speelt niet elke keer hetzelfde
  assert.notEqual(O.voortgang('p1', 7, 'meten', k.kosten), O.voortgang('p2', 7, 'meten', k.kosten));
});

test('tien maanden in een keer geeft dezelfde voortgang als tien maanden los', () => {
  const opzet = () => {
    const o = opstelling();
    maand(o.m, o.p, 2);
    o.m.eco.zet(o.p, 'anna', { actie: 'onderzoek-starten', sleutel: 'meten', budget: 3000 });
    return o;
  };
  const los = opzet();
  for (let i = 0; i < 10; i++) maand(los.m, los.p, 1);
  const bulk = opzet();
  bulk.p.staat.gerekendTot -= bulk.p.staat.maandMs * 10;
  bulk.m.eco.bijrekenen(bulk.p);
  assert.ok(Math.abs(los.st.onderzoek[0].voortgang - bulk.st.onderzoek[0].voortgang) < 1e-9,
    'dezelfde maanden horen dezelfde voortgang te geven');
  assert.equal(Math.round(los.st.geld.anna), Math.round(bulk.st.geld.anna));
});

test('meer budget gaat sneller, maar geld alleen wint niet', () => {
  const k = O.BOOM.meten;
  const zuinig = O.voortgang('p', 5, 'meten', k.kosten * 0.5);
  const normaal = O.voortgang('p', 5, 'meten', k.kosten);
  const kwistig = O.voortgang('p', 5, 'meten', k.kosten * 100);
  assert.ok(normaal > zuinig, 'meer betalen gaat sneller');
  assert.ok(kwistig > normaal);
  /* HET PLAFOND OVER ALLE TREKKINGEN, niet over een. Deze toets mat eerst een
     enkele maand, en juist in die maand viel de meevaller onder de een -- dus
     overleefde het wegnemen van de begrenzing hem gewoon. Een bovengrens is
     een uitspraak over ALLE gevallen, dus hoort hij ook zo gemeten te worden. */
  let hoogste = 0;
  for (let mnd = 0; mnd < 240; mnd++)
    for (const sleutel of O.KNOPEN)
      hoogste = Math.max(hoogste, O.voortgang('p', mnd, sleutel, O.BOOM[sleutel].kosten * 100)
        * O.BOOM[sleutel].duur);
  assert.ok(hoogste <= 2 + 1e-9,
    'hoogstens twee keer het normale tempo, in elke maand: ' + hoogste.toFixed(3));
  assert.ok(hoogste > 1.9, 'en dat plafond wordt ook echt geraakt, anders meet dit niets');
});

/* ================= 7. andermans richting is niet van jou ================= */

test('welke kant een concurrent op onderzoekt, zie je niet', () => {
  const { m, p, st } = opstelling();
  maand(m, p, 2);
  m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: 'meten', budget: 4321 });
  const boris = JSON.stringify(m.eco.zicht(p, st, 'boris'));
  assert.ok(!/4321/.test(boris), 'boris hoort het budget niet te zien');
  const zijn = m.eco.zicht(p, st, 'boris').onderzoek;
  assert.equal(zijn.bezig, 0, 'en niet dat er iets loopt');
  assert.ok(zijn.boom.every(k => k.staat !== 'loopt'), 'de boom toont alleen zijn eigen stand');
  for (const laag of ['kijker', 'publiek'])
    assert.ok(!/4321/.test(JSON.stringify(m.spel.zicht[laag](p, st))), laag + ' evenmin');
  // en aan andermans onderzoek zitten kan niet
  assert.equal(m.eco.zet(p, 'boris', { actie: 'onderzoek-budget', id: st.onderzoek[0].id, budget: 1 }).status, 404);
});

test('onderzoeken is een vrije actie', () => {
  const m = maakMagnaat();
  for (const actie of ['onderzoek-starten', 'onderzoek-budget', 'onderzoek-uitrollen', 'onderzoek-subsidie'])
    assert.ok(m.spel.buitenBeurt.includes(actie), actie + ' hoort buiten de beurt te mogen');
});

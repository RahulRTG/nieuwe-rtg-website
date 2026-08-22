/* ============================================================================
   HET AI-BUDGET PER PERSOON.

   Er stonden al twee grenzen op de modelkraan en allebei misten ze iets: het
   huisplafond gaat pas dicht als iemand anders het al heeft leeggetrokken, en
   de rem per minuut laat een script dat netjes 59 per minuut doet een dag lang
   doorlopen. Dit is de grens die bij de PERSOON hoort.

   Zeven dingen moeten kloppen. Vier ervan zijn techniek; drie zijn een BESLUIT
   uit CLAUDE.md, LEVEN.md en LIFE.md, en die staan hier omdat een besluit dat
   alleen in een document staat bij de eerste verbouwing sneuvelt:

     1. EEN IP IS GEEN PERSOON. Twee leden achter hetzelfde kantoor-IP hebben
        elk hun eigen budget; een lid dat van netwerk wisselt houdt het zijne.
     2. HET VENSTER DOET MEER DAN HET BEDRAG. Gratis telt per dag, een pas per
        maand -- dus een RTG-lid mag zijn maand op een dag opmaken en een
        gratis gebruiker nooit meer dan een halve euro op een dag.
     3. WIE BUITEN EEN VERZOEK WERKT HEEFT GEEN BUDGET. Een achtergrondtaak of
        een script hoort niemands tegoed op te maken.
     4. NA EEN HERSTART STAAT DE STAND ER NOG. Anders is het geen budget maar
        een suggestie.

     5. DE FOUNDATION SLUIT NOOIT, MAAR TELT WEL. Wat een kind te horen krijgt
        is geen kostenpost (LEVEN.md, en de KINDGERICHT-lijst in
        ./modelkeuze.test.js). Een bijlesdocent die halverwege een som stopt is
        precies dat wel.
     6. HET BERICHT IS GEEN VERKOOPTRECHTER. Zodra een grens per pas verschilt,
        is "upgrade voor meer AI" de vanzelfsprekende volgende zin. LIFE.md: een
        relatie is geen trechter.
     7. ER KOMT GEEN AFTELTELLER. "Nog twaalf vragen vandaag" is kunstmatige
        schaarste, en dat is precies wat CLAUDE.md verbiedt.

   Draai los: node --test test/ai-budget.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');

const budget = require('../server/ai-budget');
const beleid = require('../server/ai-budget-beleid');
const ctx = require('../server/ai-context');

/* Een opslag die we zelf vasthouden, zodat dit zonder database draait -- en
   zodat toets 4 een herstart kan naspelen door dezelfde bak opnieuw aan te
   bieden. */
function bak(begin) {
  const data = begin || {};
  let bewaard = 0;
  budget.zetOpslag(() => ({ data, bewaar() { bewaard += 1; } }));
  return { data, tel: () => bewaard };
}

const T = Date.parse('2026-08-19T10:00:00Z');
const LID = (key, tier) => ({ key, tier });

test('1. een IP is geen persoon: twee leden achter een kantoor delen geen budget', () => {
  bak();
  const kantoor = '84.22.9.1';
  const a = { sessie: LID('user-1', 'rtg'), ip: kantoor };
  const b = { sessie: LID('user-2', 'rtg'), ip: kantoor };

  /* A maakt zijn hele maand op: EUR 15 = USD 16,20 bij koers 1,08. */
  budget.boek(20, a, T);
  assert.equal(budget.magNog(a, T).mag, false, 'A zit aan zijn maand');
  assert.equal(budget.magNog(b, T).mag, true, 'en B, achter hetzelfde IP, heeft nog alles');

  /* En andersom: A houdt zijn stand als hij van netwerk wisselt. */
  const aElders = { sessie: LID('user-1', 'rtg'), ip: '10.0.0.9' };
  assert.equal(budget.magNog(aElders, T).mag, false, 'een ander netwerk is geen ander mens');
});

test('2. het venster doet meer dan het bedrag', () => {
  bak();
  /* EUR 0,50 per dag is over een maand ook EUR 15 -- even veel als de RTG Pass.
     Het verschil is dat een RTG-lid zijn maand op EEN dag mag opmaken. */
  const gratis = beleid.BUDGETTEN.gratis, rtg = beleid.BUDGETTEN.rtg;
  assert.equal(gratis.venster, 'dag');
  assert.equal(rtg.venster, 'maand');
  assert.equal(gratis.cent * 30, rtg.cent, 'EUR 0,50 x 30 dagen = EUR 15 = precies de RTG-maand');

  const g = { sessie: null, ip: '1.1.1.1' };
  const r = { sessie: LID('user-3', 'rtg'), ip: '1.1.1.1' };
  /* USD 1 = EUR 0,926: ruim over het gratis dagbudget, ruim binnen de maand. */
  budget.boek(1, g, T);
  budget.boek(1, r, T);
  assert.equal(budget.magNog(g, T).mag, false, 'de gratis dag is op');
  assert.equal(budget.magNog(r, T).mag, true, 'het RTG-lid heeft zijn maand nog bijna helemaal');

  /* En de dag loopt af; de maand nog niet. */
  const morgen = Date.parse('2026-08-20T10:00:00Z');
  assert.equal(budget.magNog(g, morgen).mag, true, 'morgen is een nieuwe dag');
  const volgendeMaand = Date.parse('2026-09-01T10:00:00Z');
  assert.equal(budget.vensterVan('maand', volgendeMaand), '2026-09', 'en september is een nieuwe maand');
});

test('3. wie buiten een verzoek werkt heeft geen budget', () => {
  bak();
  /* Geen sessie EN geen ip: een achtergrondtaak, een script, de opstart. Die
     horen niemands tegoed op te maken en er niet door gestopt te worden. */
  const uit = budget.magNog({ sessie: null, ip: null }, T);
  assert.equal(uit.mag, true);
  assert.equal(uit.buitenVerzoek, true);
  assert.equal(budget.boek(99, { sessie: null, ip: null }, T), null, 'en er wordt niets geboekt');
});

test('4. na een herstart staat de stand er nog', () => {
  const eerste = bak();
  const lid = { sessie: LID('user-9', 'rtg'), ip: '2.2.2.2' };
  budget.boek(20, lid, T);
  assert.ok(eerste.tel() > 0, 'er is echt bewaard, niet alleen onthouden');
  const bewaard = JSON.parse(JSON.stringify(eerste.data));

  /* Herstart: nieuw proces, zelfde opslag. */
  bak(bewaard);
  assert.equal(budget.magNog(lid, T).mag, false, 'het budget is niet teruggezet door de herstart');
});

test('5. de Foundation sluit nooit, maar telt wel', () => {
  bak();
  const kind = { sessie: LID('user-kind', 'guest'), ip: '3.3.3.3' };
  /* Eerst het budget helemaal opmaken op een gewoon oppervlak. */
  budget.boek(5, Object.assign({ vrijgesteld: false }, kind), T);
  assert.equal(budget.magNog(Object.assign({ vrijgesteld: false }, kind), T).mag, false,
    'het gewone budget is op');

  /* En dan de bijles: die gaat gewoon door. */
  const bijles = Object.assign({ vrijgesteld: true }, kind);
  assert.equal(budget.magNog(bijles, T).mag, true, 'een kind valt niet stil omdat het tegoed op is');
  assert.equal(budget.magNog(bijles, T).vrijgesteld, true);

  /* Maar hij wordt WEL geteld -- je wilt zien wat de Foundation kost. */
  const voor = budget.alleTellingen()['lid:user-kind'].cent;
  budget.boek(1, bijles, T);
  const na = budget.alleTellingen()['lid:user-kind'];
  assert.ok(na.cent > voor, 'de vrijgestelde aanroep telt mee in de stand');
  assert.ok(na.vrijCent > 0, 'en is apart terug te vinden als vrijgesteld');
});

test('6. de vrijstelling hangt aan het PAD en niet aan een vlag per aanroeper', () => {
  /* Een vlag die elke aanroeper zelf moet zetten, ben je een keer vergeten --
     en dan valt een kind stil. Daarom een lijst op een plek. */
  for (const pad of ['/api/foundation/schrift', '/api/rtf/leerling/bijles/gesprek',
    '/api/bijles/vraag', '/api/onderwijs/toets', '/api/member/leren/schrijven']) {
    assert.equal(beleid.vrijgesteldPad(pad), true, pad + ' hoort nooit te sluiten');
  }
  for (const pad of ['/api/member/assistent', '/api/salon/post', '/api/geld/advies', '/api/foundationX/y', '']) {
    assert.equal(beleid.vrijgesteldPad(pad), false, pad + ' is geen kindoppervlak');
  }
  /* Elke vrijstelling draagt een reden, zodat de volgende lezer weet waarom. */
  for (const [pad, reden] of Object.entries(beleid.VRIJGESTELD)) {
    assert.ok(String(reden).length > 30, pad + ' hoort een reden te dragen, geen label');
  }
});

test('7. het bericht is geen verkooptrechter en geen aftelteller', () => {
  /* Zodra het budget per pas verschilt is "neem Lifestyle voor meer AI" de
     vanzelfsprekende volgende zin. Die zin hoort er niet te komen. */
  const t = String(budget.BERICHT).toLowerCase();
  for (const woord of ['lifestyle', 'business', 'upgrade', 'pas ', 'abonnement', 'meer ai', 'koop']) {
    assert.equal(t.includes(woord), false, 'het bericht hoort geen "' + woord + '" te bevatten');
  }
  assert.ok(t.includes('handmatig') || t.includes('werkt gewoon door'),
    'het hoort wel te wijzen op wat er nog wel kan');

  /* En de stand telt niet af: hij zegt wat er besteed is, niet wat er nog over
     is. Een "nog X te gaan" is precies de kunstmatige schaarste die CLAUDE.md
     verbiedt, dus dat veld hoort niet te bestaan. */
  bak();
  const s = budget.stand({ sessie: LID('user-4', 'rtg'), ip: '4.4.4.4' }, T);
  assert.ok('besteedEuro' in s, 'wat er is gegaan mag je weten');
  assert.equal('resterendEuro' in s, false, 'wat er nog over is, is een aftelteller');
  assert.equal('nog' in s, false);
});

test('8. de koers en de bedragen zijn te zetten zonder codewijziging', () => {
  bak();
  delete process.env.RTG_AI_KOERS;
  assert.equal(beleid.koers(), 1.08, 'de ingebouwde peildatumkoers');
  process.env.RTG_AI_KOERS = '2';
  assert.equal(beleid.usdNaarEuro(10), 5, 'twee dollar voor een euro');
  process.env.RTG_AI_KOERS = 'onzin';
  assert.equal(beleid.koers(), 1.08, 'onzin valt terug op de ingebouwde koers');
  delete process.env.RTG_AI_KOERS;

  process.env.RTG_AI_BUDGETTEN = JSON.stringify({ gratis: { venster: 'maand', cent: 999 } });
  assert.equal(beleid.budgetten().gratis.cent, 999);
  assert.equal(beleid.budgetten().rtg.cent, 1500, 'wat je niet zet, blijft staan');
  process.env.RTG_AI_BUDGETTEN = 'geen json';
  assert.equal(beleid.budgetten().gratis.cent, 50, 'onzin valt terug op de ingebouwde tabel');
  process.env.RTG_AI_BUDGETTEN = JSON.stringify({ gratis: { venster: 'eeuw', cent: 1 } });
  assert.equal(beleid.budgetten().gratis.venster, 'dag', 'een onbekend venster wordt niet overgenomen');
  delete process.env.RTG_AI_BUDGETTEN;
});

test('9. precies op de grens is op, en niet net niet', () => {
  /* De grens is `besteed < budget`, dus wie er precies op zit mag NIET meer.
     Zonder deze regel is < ongemerkt in <= te veranderen: alle andere toetsen
     schieten er ruim overheen en merken het verschil niet. */
  bak();
  process.env.RTG_AI_KOERS = '1';                 // een dollar is een euro: exact rekenen
  const g = { sessie: null, ip: '7.7.7.7' };
  budget.boek(0.49, g, T);
  assert.equal(budget.magNog(g, T).besteedCent, 49);
  assert.equal(budget.magNog(g, T).mag, true, 'een cent onder de grens mag nog');
  budget.boek(0.01, g, T);
  assert.equal(budget.magNog(g, T).besteedCent, 50, 'nu precies het budget');
  assert.equal(budget.magNog(g, T).mag, false, 'precies op de grens is op');
  delete process.env.RTG_AI_KOERS;
});

test('10. het boeken begint in een nieuw venster ook echt opnieuw', () => {
  /* magNog() leest een oude stand als nul, maar boek() moet de rij ook echt
     vervangen -- anders telt de dag van morgen door op die van vandaag zodra
     er weer geboekt wordt, en dan is de dagwissel alleen zichtbaar zolang er
     niemand iets doet. */
  bak();
  const g = { sessie: null, ip: '8.8.8.8' };
  budget.boek(1, g, T);
  const vandaag = budget.alleTellingen()['ip:8.8.8.8'];
  assert.equal(vandaag.venster, '2026-08-19');
  assert.ok(vandaag.cent > 50);

  const morgen = Date.parse('2026-08-20T09:00:00Z');
  budget.boek(0.10, g, morgen);
  const rij = budget.alleTellingen()['ip:8.8.8.8'];
  assert.equal(rij.venster, '2026-08-20', 'de rij staat in het nieuwe venster');
  assert.ok(rij.cent < 50, 'en telt van nul af, niet door op gisteren: ' + rij.cent);
  assert.equal(rij.aanroepen, 1, 'ook de aanroepen beginnen opnieuw');

  /* DE CASUS DIE DE TWEE LAGEN SCHEIDT. Hierboven doet de opruiming het werk al:
     een rij van gisteren valt buiten zowel de dag van vandaag als de maand, dus
     die wordt sowieso weggegooid. Bij een PASWISSEL binnen dezelfde maand niet:
     dan gaat de venstersoort van 'maand' naar 'dag' terwijl beide vensters
     "van nu" zijn, en alleen de vensterwissel bij het boeken vangt dat.

     Wat er dan gebeurt hoort ook vastgelegd te zijn, want het is een keuze: de
     rij begint opnieuw. Een lid dat terugvalt naar gratis houdt dus niet zijn
     maandverbruik als dagverbruik -- dat zou hem meteen een dag lang stilzetten
     voor iets wat hij als betalend lid uitgaf. Dat het andersom een verse dag
     oplevert, is de prijs daarvan; een pas wisselen kost geld en goedkeuring,
     dus het is geen weg eromheen. */
  const lid = { sessie: LID('user-wissel', 'rtg'), ip: '9.9.9.9' };
  budget.boek(10, lid, T);
  assert.equal(budget.alleTellingen()['lid:user-wissel'].venster, '2026-08');
  const zelfdeMens = { sessie: LID('user-wissel', 'guest'), ip: '9.9.9.9' };
  budget.boek(0.10, zelfdeMens, T);
  const na = budget.alleTellingen()['lid:user-wissel'];
  assert.equal(na.venster, '2026-08-19', 'de venstersoort volgt de nieuwe pas');
  assert.ok(na.cent < 50, 'en telt van nul af in dat nieuwe venster: ' + na.cent);
});

test('11. zonder sessie krijg je het gratis-budget, niet geen budget', () => {
  /* Anders is uitloggen de manier om er onderuit te komen. */
  bak();
  const anoniem = { sessie: null, ip: '5.5.5.5' };
  assert.equal(budget.magNog(anoniem, T).pas, 'gratis');
  budget.boek(1, anoniem, T);
  assert.equal(budget.magNog(anoniem, T).mag, false);
});

test('12. de sessie wordt pas op het moment van de aanroep gelezen', () => {
  /* De context hangt VOOR de routers, waar auth() nog niet heeft gedraaid. Zou
     hij de sessie meteen uitlezen, dan stond er altijd null in en kreeg elk lid
     het gratis-budget op zijn IP. */
  bak();
  const req = { ip: '6.6.6.6', path: '/api/member/assistent' };
  ctx.inContext({ ip: req.ip, req }, () => {
    assert.equal(ctx.sessie(), null, 'op dit moment heeft auth nog niets gezet');
    req.session = LID('user-laat', 'lifestyle');       // auth() draait
    assert.equal(budget.magNog(undefined, T).pas, 'lifestyle', 'en nu wordt hij wel gezien');
  });
});

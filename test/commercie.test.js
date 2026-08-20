/* ============================================================================
   DE COMMERCIELE KERN: twee invarianten die over geld gaan.

   Allebei komen ze uit een gat dat de doorlichting van 20 augustus 2026 vond, en
   allebei zijn ze van de soort "het scherm klopte en het geld niet".

   1. PARTNERVERGOEDING IS NUL. De partnervoorwaarden beloofden 0% commissie
      terwijl de boardroom een knop had (12% standaard, tot 30%), de seed zaken
      op 3 tot 16% zette, en kern/thuis/zakelijk.js als enige plek dat tarief ook
      echt van een uitbetaling aftrok -- met een eigen terugval van 10%. Vier
      antwoorden op een vraag, en drie ervan in strijd met het contract.

   2. HET LEDENVOORDEEL HEEFT VIER BEDRAGEN. "RTG legt bij, dus de zaak houdt het
      volle bedrag" was een zin op een scherm: alleen de korting werd vastgelegd,
      er was geen verplichting van RTG aan de zaak, en in betaalRekeningVoor werd
      als betaald bedrag `subtotaal + fooi` gerapporteerd -- met de kortingen er
      niet af.

   DE OUDE TOETS WAS HET PROBLEEM, niet alleen de code. test/geldregie.test.js 3
   controleerde `order.total` (22) en `regieKorting` (2,20): precies de twee
   velden die ook kloppen als er verder niets gebeurt. Vandaar dat hieronder alle
   VIER de bedragen worden nagerekend, en op een opgeslagen rij en niet op een
   verse berekening.

   Draai los: node --experimental-sqlite --test test/commercie.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const vergoeding = require('../server/kern/commercie/vergoeding');
const subsidie = require('../server/kern/commercie/subsidie');

/* ---------------------------------------------------------------- vergoeding */

test('1. de partnervergoeding over omzet is nul, voor elke zaak', () => {
  assert.equal(vergoeding.PARTNER_COMMISSIE, 0);
  // ook voor een zaak die zelf nog een oud tarief in haar rij draagt
  assert.equal(vergoeding.commissieVoor({ code: 'KIKUNOI', type: 'restaurant', rate: 0.14 }), 0,
    'een opgeslagen rate uit de seed mag nooit meer een tarief worden');
  assert.equal(vergoeding.commissieVoor({ rate: 0.3 }), 0);
});

test('2. de geld-regie kent geen commissie meer, en zegt waarom', () => {
  const db = { data: { suppliers: [{ code: 'A', name: 'A', type: 'restaurant', rate: 0.14 }], supplierTypes: { restaurant: { label: 'Restaurant' } } } };
  const g = require('../server/kern/geldregie').maakGeldregie({ db, save: () => {}, crypto });

  assert.equal(g.commissieVoor(db.data.suppliers[0]), 0, 'de regie geeft nul, wat er ook in de rij staat');

  const zet = g.geldCommissieZet({ genre: 'restaurant', pct: 12 });
  assert.equal(zet.status, 400, 'een commissie zetten hoort niet te kunnen');
  assert.match(zet.error, /geen commissie/, 'met de reden, niet met "ongeldig"');
  assert.match(zet.error, /betaaldienst/, 'en met wat het WEL kan zijn');

  // en de zaak blijft ongemoeid: een geweigerde zet verandert niets
  assert.equal(db.data.suppliers[0].rate, 0.14, 'een weigering schrijft niet stiekem toch');
});

/* De vier benoemde soorten bestaan niet voor de sier: het onderscheid tussen een
   prijs voor een dienst en een aandeel in andermans omzet is het hele punt. Een
   soort die WEL over omzet gaat, is een commissie met een andere naam. */
test('3. geen enkele vergoedingssoort neemt een aandeel in de omzet van de partner', () => {
  const soorten = vergoeding.soorten();
  assert.ok(soorten.length >= 4, 'er zijn benoemde soorten');
  for (const s of soorten) {
    assert.equal(s.overOmzet, false,
      s.id + ' gaat over omzet, en dan is het een commissie met een andere naam');
    assert.ok(s.label && s.wat && s.grondslag, s.id + ' hoort uit te leggen wat het is');
  }
});

test('4. RTG Thuis trekt geen commissie meer af van een partneruitbetaling', () => {
  const bron = require('fs').readFileSync(require.resolve('../server/kern/thuis/zakelijk.js'), 'utf8');
  assert.doesNotMatch(bron, /:\s*10;/,
    'de eigen terugval van 10% hoort weg te zijn; die week af van elke andere plek');
  assert.match(bron, /vergoeding\.PARTNER_COMMISSIE/,
    'en het tarief hoort uit de commerciele kern te komen, niet uit een eigen getal');
});

/* ----------------------------------------------------------------- subsidie */

/* HET VOORBEELD UIT DE OPDRACHT, cent voor cent. */
test('5. een voordeel van 10% op 22 euro: alle vier de bedragen', () => {
  const o = subsidie.opbouwVan(22, 2.20);
  assert.equal(o.brutoCenten, 2200, 'bruto 22,00');
  assert.equal(o.lidBetaaltCenten, 1980, 'het lid betaalt 19,80');
  assert.equal(o.rtgLegtBijCenten, 220, 'RTG legt 2,20 bij');
  assert.equal(o.zaakOntvangtCenten, 2200, 'de zaak ontvangt het volle bedrag');
  assert.equal(o.status, 'te_verrekenen',
    'en dat is een verplichting van RTG, geen boolean die "niet nodig" kan betekenen');
});

/* DE INVARIANT, en dan op een OPGESLAGEN rij. Dit is de toets die de oude niet
   was: hij pakt niet een veld maar de hele opbouw, en telt na. */
test('6. lid plus RTG is het brutobedrag, en de zaak krijgt het volle bedrag', () => {
  for (const [bruto, voordeel] of [[22, 2.2], [0.01, 0], [199.99, 99.995], [1000, 500], [0, 0]]) {
    const o = subsidie.opbouwVan(bruto, voordeel);
    assert.equal(subsidie.keur(o), null,
      'de opbouw van ' + bruto + '/' + voordeel + ' hoort te kloppen: ' + subsidie.keur(o));
    assert.equal(o.lidBetaaltCenten + o.rtgLegtBijCenten, o.brutoCenten);
    assert.equal(o.zaakOntvangtCenten, o.brutoCenten);
  }
});

/* De keuring moet echt iets afkeuren, anders is hij decoratie. Dit zijn de drie
   manieren waarop het eerder mis had kunnen gaan zonder dat iets het merkte. */
test('7. de keuring wijst een opbouw af die niet optelt', () => {
  const goed = subsidie.opbouwVan(22, 2.20);

  const lidTeVeel = { ...goed, lidBetaaltCenten: 2200 };
  assert.ok(subsidie.keur(lidTeVeel), 'het lid betaalt het volle bedrag EN RTG legt bij: dat telt niet op');

  const zaakTeWeinig = { ...goed, zaakOntvangtCenten: 1980 };
  assert.ok(subsidie.keur(zaakTeWeinig), 'de zaak krijgt de korting van haar eigen omzet af: dat is de belofte breken');
  assert.match(subsidie.keur(zaakTeWeinig), /volle bedrag/);

  const geenBijdrage = { ...goed, rtgLegtBijCenten: 0 };
  assert.ok(subsidie.keur(geenBijdrage), 'het lid betaalt minder en niemand legt bij: daar verdwijnt geld');

  assert.ok(subsidie.keur(null), 'geen opbouw is ook geen geldige opbouw');
});

test('8. RTG legt nooit meer bij dan de dienst kost', () => {
  const o = subsidie.opbouwVan(10, 25);
  assert.equal(o.rtgLegtBijCenten, 1000, 'afgekapt op het brutobedrag');
  assert.equal(o.lidBetaaltCenten, 0, 'het lid betaalt niets');
  assert.equal(o.zaakOntvangtCenten, 1000, 'en de zaak krijgt nog steeds het volle bedrag');
  assert.equal(subsidie.keur(o), null);
});

/* De bestelstroom rekent in euro's met twee decimalen; deze laag in centen. Een
   halve cent die zich in een afronding verstopt, laat de invariant wankelen op
   precies de bedragen die in het echt voorkomen. */
test('9. centen in, centen uit: geen halve cent verdwijnt in een afronding', () => {
  for (let bruto = 1; bruto <= 400; bruto++) {
    for (const pct of [5, 7, 10, 12.5, 33, 50]) {
      const voordeel = Math.round(bruto * pct) / 100;
      const o = subsidie.opbouwVan(bruto / 1, voordeel);
      assert.equal(subsidie.keur(o), null,
        'bruto ' + bruto + ' met ' + pct + '% (' + voordeel + ') liep scheef: ' + subsidie.keur(o));
    }
  }
});

/* --------------------------------------------------------------- capabilities */

/* Zevenenzeventig bestanden noemen een pas-id. Zou Business Lite zijn uitgerold
   zoals de vorige passen, dan kwam er in al die bestanden een `if (pas ===
   'business-lite')` bij -- en bij de zesde trede opnieuw. Dan wordt "mag deze
   klant dit" op zeventig plaatsen los beantwoord, en die antwoorden lopen
   uiteen zodra iemand er een vergeet. Precies hoe thuis/zakelijk.js aan een
   eigen commissie van 10% kwam terwijl de rest 12 gebruikte. */
const caps = require('../server/kern/commercie/capaciteiten');

test('10. rechten komen uit een productprofiel, niet uit een pas-id', () => {
  assert.equal(caps.mag('business-lite', 'can_use_pos'), true);
  assert.equal(caps.mag('rtg', 'can_use_pos'), false, 'een consumentenpas draait geen kassa');
  /* Deze toets bewaakte eerst dat Business De Rechterhand NIET had. Dat was mijn
     bewering en niet die van het product: routes/member/lifestyle.js laat de
     Business Pass al sinds het begin meeerven als hoger niveau. Ze afdwingen zou
     elke Business Pass-houder die suite hebben afgenomen -- een migratie die
     rechten intrekt is een storing met een nette naam.

     Wat WEL geldt: de bedrijfsvoering zit niet bij Lifestyle. Dat is de
     asymmetrie die het product echt heeft. */
  assert.equal(caps.mag('lifestyle', 'can_use_lifestyle_service'), true);
  assert.equal(caps.mag('business', 'can_use_lifestyle_service'), true,
    'de Business Pass erft De Rechterhand, zoals routes/member/lifestyle.js dat altijd al deed');
  assert.equal(caps.mag('lifestyle', 'can_manage_staff'), false,
    'maar andersom niet: Lifestyle is een persoonlijke pas, geen zakelijke');
  assert.equal(caps.mag('lifestyle', 'can_be_partner'), false);

  // niet mogen is de veilige uitkomst
  assert.equal(caps.mag('business', 'can_hack_everything'), false, 'een onbekende capability geeft niets');
  assert.equal(caps.mag('bestaat-niet', 'can_use_ai'), false, 'een onbekende pas ook niet');
  assert.equal(caps.mag(null, 'can_use_ai'), false);
});

/* DE POORT DIE DE LADDER ZELF DICHTGOOIDE. partnerkanaal.js eiste
   `tier !== 'business'` -- en Business is sinds de ladder vanaf 5.000 euro. */
test('11. de partnerpoort staat open voor Business Lite, en hangt niet aan een pas-id', () => {
  assert.deepEqual(caps.tredenMet('can_be_partner'), ['business-lite', 'business'],
    'het restaurant met acht man moet erin kunnen, en de enterprise ook');
  assert.equal(caps.mag('rtg', 'can_be_partner'), false, 'een consumentenpas is geen bedrijf');
  assert.equal(caps.mag('gratis', 'can_be_partner'), false);

  /* Het partnerkanaal is bij de 10 kB-knip in twee onderwerpen gesplitst: het
     BOEKEN via een partnerlink en de AANVRAAG van een bedrijf. De poort hoort
     bij de aanvraag. Allebei gelezen, zodat een volgende verhuizing deze toets
     laat zakken in plaats van hem stil te laten slagen op een bestand dat de
     poort niet meer draagt. */
  const bestanden = ['../server/routes/member/partnerkanaal.js', '../server/routes/member/partneraanvraag.js'];
  const bron = bestanden.map((b) => require('fs').readFileSync(require.resolve(b), 'utf8')).join('\n');
  assert.doesNotMatch(bron, /tier\s*!==\s*'business'/,
    'de poort hoort een capability te vragen en geen pas-id: anders sluit elke nieuwe trede zichzelf buiten');
  assert.match(bron, /can_be_partner/,
    'de capability-poort staat in een van de twee helften van het partnerkanaal');
});

test('12. de gratis trede mag niets zakelijks, en dat is geen vergetelheid', () => {
  assert.deepEqual(caps.capsVan('gratis'), [],
    'RTG Community is de maatschappelijke ingang; er hangt geen zakelijke capability aan');
  assert.deepEqual(caps.capsVan('rtg'), ['can_use_ai'],
    'en de consumentenpas draagt alleen de AI-assistent');
});

/* DE ENTREE IS INGETROKKEN. De partnervoorwaarden noemden 10.000 euro entree
   plus 500 per jaar, naast een Business Lite van 150 per maand. Twee
   toegangsprijzen naast elkaar is onuitlegbaar, en 10.000 euro sluit precies de
   kleine zaak buiten voor wie die trede bedoeld is (PRIJZEN.md 4.6). */
test('13. er is geen entree meer, en het document zegt dat ook', () => {
  const claims = require('../server/kern/commercie/claims');
  const c = claims.claims().find(x => x.id === 'claim.partner.entry_fee');
  assert.equal(c.waarde, 'GEEN');
  assert.equal(c.dekking, claims.DEKKING.AFGEDWONGEN);

  const doc = require('fs').readFileSync(
    __dirname + '/../public/apps/juridisch/partnervoorwaarden.html', 'utf8');
  assert.doesNotMatch(doc, /10\.000 entree|10\.000<\/b> entree/,
    'de partnervoorwaarden noemen nog een entree');
  assert.doesNotMatch(doc, /vaste contributie per jaar/,
    'en nog een jaarlijkse contributie');
  assert.doesNotMatch(doc, /zonder maximum/,
    'de open kostenclausule ("doorbelasting zonder maximum") hoort weg te zijn');
  assert.match(doc, /geen entree/, 'er hoort te staan dat er geen entree is');
});

/* De claims-poort hoort ook echt te draaien in de toetsen, en niet alleen als
   endpoint te bestaan. Dit is prioriteit 10: geen financiele claim zonder
   bewijs. */
test('14. de release-poort komt schoon door', () => {
  const claims = require('../server/kern/commercie/claims');
  const p = claims.poort();
  assert.equal(p.ok, true, p.problemen.join('; '));
  assert.ok(p.aantal >= 12, 'er staan claims in');
});

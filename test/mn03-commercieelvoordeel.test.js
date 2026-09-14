/* MN-03: GEEN COMMERCIEEL VOORDEEL -- een VOORUITGESCHOVEN POST, en dat staat
   er liever dan een bewaker die niets bewaakt.

   De regel (MENSNETWERK.md par. 4): *een commercieel belang van RTG verandert het
   onafhankelijke keuzepad van een mens niet, tenzij dat belang expliciet
   zichtbaar is.* Zodra RTG zelf management verkoopt, is elke aanbeveling
   verdacht: de AI mag RTG niet bovenaan zetten, externe managers niet slechter
   presenteren, informatie niet achterhouden en selectiecriteria niet aanpassen
   omdat RTG eraan verdient.

   MN-03 HEEFT VANDAAG GEEN ONDERWERP, en dat is een EIGENSCHAP van het product
   en geen toeval. Twee dingen moeten waar zijn voordat de regel iets te beteugelen
   heeft, en geen van beide is het:

     1. RTG verdient niets aan de omzet van een partner. `PARTNER_COMMISSIE = 0`
        in kern/commercie/vergoeding.js is een INVARIANT en geen instelling --
        de boardroom heeft er geen knop voor, en de weigering legt uit wat RTG
        wel in rekening brengt. Beveelt de AI dus een partner aan, dan is er
        geen belang om te melden.
     2. RTG is zelf geen hoedanigheid. De vertegenwoordigingslaag kent negen
        menselijke rollen (`manager` daaronder), en RTG staat er niet tussen.
        Er is geen RTG Management om bovenaan te zetten.

   WAT DEZE TOETS DUS DOET. Hij bewaakt niet de openbaarmaking -- die valt niets
   te bewaken zolang er niets te openbaren is. Hij bewaakt de TWEE AANNAMES
   waarop dat berust, en hij zakt op de dag dat een ervan verschuift. Dan heeft
   MN-03 een onderwerp, en dan hoort er een keuzepad te komen dat het belang
   noemt:

     "U kunt uzelf blijven managen, uw huidige manager koppelen, een externe
      manager zoeken, of RTG Management spreken. RTG verdient aan die laatste."

   DAT IS DE ENIGE VORM DIE OVERLEEFT naast de bestaande merkregel dat de AI
   nooit zelf toegang belooft of verleent: openheid, en geen zwijgen.

   WAAROM EEN TRIPDRAAD EN GEEN GEBOUWDE OPENBAARMAKING. Een keuzepad bouwen met
   een vierde optie die niet bestaat, is het product verzinnen om de regel te
   kunnen toetsen -- en dan toetst de toets mijn eigen fictie. Zelfde reden als
   AI-CONTEXT-02 in par. 4d, dat ook bewust geen handhaver heeft: er is geen
   contextcache, dus er valt niets te bewaken, en een schijnbewaker is erger dan
   een uitgeschreven gat.

   DE TEGENPROEF STAAT ERNAAST, want zonder haar haalt de luie oplossing het:
   sloop de vertegenwoordigingslaag en er is per definitie geen commercieel
   voordeel. Toets 3 eist dat de laag er werkelijk is.

   GEMETEN MET DE MUTATIE (13 september 2026), vier stuks:
     a. PARTNER_COMMISSIE op 12                     -> toets 1 zakt
     b. 'rtg-management' aan HOEDANIGHEDEN          -> toets 2 zakt
     c. HOEDANIGHEDEN leeggemaakt                   -> toets 3 zakt (tegenproef)
     d. waaromGeenCommissie() tot een kale weigering -> toets 4 zakt

   Draai los: node --test test/mn03-commercieelvoordeel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const vergoeding = require('../server/kern/commercie/vergoeding');
const { HOEDANIGHEDEN, BEVOEGDHEDEN } = require('../server/kern/vertegenwoordiging/bevoegdheden');

/* Namen waaronder RTG zichzelf als partij zou kunnen opvoeren. Geen van deze
   hoort een hoedanigheid te zijn: een hoedanigheid is een MENS die namens een
   mens handelt, en RTG is het huis waarin dat gebeurt. */
const RTG_ALS_PARTIJ = ['rtg', 'rtg-management', 'rtgmanagement', 'platform', 'huis'];

/* ---------- 1. de eerste aanname: RTG verdient niets aan de omzet ---------- */
test('1. RTG verdient niets aan de omzet van een partner -- de grondslag van MN-03', () => {
  assert.equal(vergoeding.PARTNER_COMMISSIE, 0,
    'PARTNER_COMMISSIE staat niet meer op nul. Daarmee HEEFT MN-03 een onderwerp: ' +
    'RTG verdient dan aan wat het aanbeveelt, en elke aanbeveling hoort dat belang te noemen. ' +
    'Deze toets hoort dan niet te worden aangepast maar VERVANGEN door een proef op het keuzepad.');

  /* Ook per zaak, want een invariant die per geval te omzeilen is, is er geen.
     Drie vormen: een gewone zaak, geen zaak, en iets dat er onzin uitziet. */
  for (const zaak of [{ code: 'KIKUNOI' }, null, { code: '', genre: 'hotel' }]) {
    assert.equal(vergoeding.commissieVoor(zaak), 0,
      'commissieVoor() gaf iets anders dan nul voor ' + JSON.stringify(zaak) +
      '. Een commissie die per zaak terugkomt, is dezelfde knop met een andere naam.');
  }
});

/* ---------- 2. de tweede aanname: RTG is zelf geen partij ---------- */
test('2. RTG is zelf geen hoedanigheid -- er is niets om bovenaan te zetten', () => {
  for (const naam of HOEDANIGHEDEN) {
    assert.ok(!RTG_ALS_PARTIJ.includes(String(naam).toLowerCase()),
      'de hoedanigheid "' + naam + '" voert RTG zelf op als partij in een keuzepad. ' +
      'Vanaf dat moment eist MN-03 dat het belang expliciet zichtbaar is: ' +
      '"...of RTG Management spreken. RTG verdient aan die laatste." ' +
      'Zonder die zin verandert een commercieel belang stilzwijgend het keuzepad van een mens.');
  }
});

/* ---------- 3. de tegenproef: de laag bestaat echt ---------- */
test('3. tegenproef: de vertegenwoordigingslaag is er wel -- niets bouwen telt niet', () => {
  assert.ok(HOEDANIGHEDEN.length >= 5,
    'er zijn nauwelijks hoedanigheden. Zonder laag is er per definitie geen commercieel ' +
    'voordeel, en dan staat toets 2 groen zonder iets te bewaken.');
  assert.ok(HOEDANIGHEDEN.includes('manager'),
    '`manager` hoort erbij: dat is de rol waar MN-03 over gaat zodra RTG hem zelf verkoopt');
  assert.ok(Object.keys(BEVOEGDHEDEN).length >= 5,
    'de bevoegdhedenlijst is leeg of bijna leeg; dan is er geen keuzepad om te beschermen');
});

/* ---------- 4. openheid en geen zwijgen ---------- */
test('4. de weigering legt uit wat RTG WEL rekent -- MN-03 lost op met openheid', () => {
  const uitleg = String(vergoeding.waaromGeenCommissie() || '');
  assert.ok(uitleg.length > 80,
    'de uitleg is een kale weigering. MN-03 wordt opgelost met OPENHEID en niet met zwijgen: ' +
    'wie hier komt zoekt iets, en hoort te lezen wat het wel is.');
  assert.match(uitleg, /geen instelling|geen knop|staat in de partnervoorwaarden/i,
    'de uitleg zegt niet dat het GEEN INSTELLING is. Juist dat onderscheid draagt MN-03: ' +
    'een nul die een knop is, is geen nul.');
  const soorten = Object.keys(vergoeding.SOORTEN || {});
  assert.ok(soorten.length >= 2 && soorten.some(s => uitleg.toLowerCase().includes(s.replace(/_/g, ' ')) ||
    uitleg.includes(s)) || /dienst|kosten|rekening/i.test(uitleg),
    'de uitleg noemt niet wat RTG dan wel in rekening brengt; dan is het alsnog zwijgen');
});

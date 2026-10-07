/* HET VRIJGAVEREGISTER: welke capabilities dit huis los aan en uit kan zetten,
   en wat elk van ze nodig heeft voordat hij werkelijk BESCHIKBAAR is.

   WAAROM DIT BESTAAT. Het besluit van de eigenaar: wat juridisch, operationeel,
   bij een provider of qua bewijs nog niet voor productie mag, wordt NIET
   weggehaald. Het wordt volledig gebouwd en getoetst, en staat achter EEN
   centrale, expliciete poort die bij twijfel dicht is. Weghalen kost twee keer
   bouwen; een losse vlag per plek kost een huis vol poorten die elk een eigen
   definitie van "aan" hebben. Vandaar een register in code, op een plek.

   VIJF ASSEN, nooit opgeteld tot een cijfer: geimplementeerd (de code staat
   er; anders `false` met reden), geverifieerd (bewijs gebonden aan DEZE
   release, ./bewijs.js), geautoriseerd (kern/bevoegdheid/ of een vastgelegd
   extern besluit), ingeschakeld (een mens zette hem aan, ./stand.js) en
   beschikbaar (alle vier, plus gezonde afhankelijkheden en een actor met recht).
   Ontbreekt er een of is er een onbekend: dicht.

   WAT ER BEWUST NIET IS: een `MONEY_ENABLED`. Elke geldhandeling die financieel
   iets anders is (geld ontvangen, opwaarderen, terugbetalen, een partner
   afrekenen, saldo terugstorten), staat hier als eigen regel en gaat los aan en
   uit. Een generieke geldschakelaar zou bij de eerste storing in de
   uitbetaalrail ook het ontvangen stilleggen -- of, erger, bij het aanzetten
   van het ontvangen ook het uitbetalen openen.

   WOORDEN. `vrijgave` gaat in dit huis over het VRIJGEVEN van iets voor
   productie (server/config/foundation-vrijgave.js gebruikt het in dezelfde
   betekenis, voor de Foundation als geheel). `capability` heeft hier de
   betekenis uit OS.md: platformvermogen ("mag deze aanroep, en doet hij het?"),
   nooit domeinvermogen. `VERMOGENS` (twee keer bezet) en `mandaat` worden hier
   niet gebruikt; de bevoegdheden heten `bevoegdheid.vermogen` omdat het daar
   letterlijk een sleutel uit kern/bevoegdheid/lijst.js IS. */
'use strict';

/* De standen. Gesloten lijst: een stand die hier niet staat, is een
   CONFIGURATIEFOUT en nooit een variant van uit of aan (./stand.js). */
const STANDEN = Object.freeze(['disabled', 'shadow', 'sandbox', 'enabled', 'suspended', 'emergency_disabled']);

/* Alleen `enabled` en `sandbox` laten iets GEBEUREN (./oordeel.js). `shadow`
   rekent het oordeel uit en telt het, zodat een nieuwe regel eerst meeloopt
   (CONTROLPLANE.md par. 5.3), maar het effect blijft dicht; `sandbox` werkt
   alleen op een rail zonder echt geld en nooit in een openbare installatie.

   ACTIVEREND: uitzetten moet altijd snel kunnen (een noodknop die een passkey
   vraagt is geen noodknop); aanzetten van geld of veiligheid vraagt een verse
   passkey, en schaduw telt daarbij als aanzetten. */
const ACTIVEREND = Object.freeze(['enabled', 'sandbox', 'shadow']);

/* De rails zonder echt geld (NEPRAILS, LOKALE_NEPRAILS) en de echte providers:
   ./rails.js. */
const { NEPRAILS, LOKALE_NEPRAILS, ECHTE_PROVIDERS } = require('./rails');

const r = (id, x) => Object.freeze(Object.assign({ id }, x));

const REGISTER = Object.freeze([
  r('geld.inkomend', {
    naam: 'Betalingen ontvangen via een provider', eigenaar: 'RTG Pay', domein: 'geld',
    geimplementeerd: true, geld: true, beveiliging: false, noodknop: true,
    standen: STANDEN, veiligeStand: 'disabled', afhankelijk: [], provider: 'per-verzoek',
    bewijs: { controles: ['paymentProvider', 'webhookDelivery'] },
    /* Ontvangen als handelaar via een betaalprovider is geen vergunningwerk van
       RTG zelf (de provider is de acquirer), maar wel een contract en een
       KYB-dossier bij die provider. Dat is een BESLUIT dat moet zijn
       vastgelegd, niet iets dat je afleidt uit een API-sleutel. */
    bevoegdheid: { besluit: 'inkomend.handelaar' },
    toetsen: ['test/vrijgave.test.js'] }),

  r('geld.opwaarderen', {
    naam: 'Saldo opwaarderen', eigenaar: 'RTG Pay', domein: 'geld',
    geimplementeerd: true, geld: true, beveiliging: false, noodknop: true,
    standen: STANDEN, veiligeStand: 'disabled',
    afhankelijk: ['geld.intern_saldo', 'geld.inkomend'], provider: 'per-verzoek',
    bewijs: { controles: ['paymentProvider', 'webhookDelivery', 'reconciliation'] },
    bevoegdheid: { vermogen: 'WALLET_SALDO' },
    toetsen: ['test/vrijgave.test.js'] }),

  r('geld.terugbetaling', {
    naam: 'Een betaling terugbetalen naar de oorspronkelijke betaalwijze', eigenaar: 'RTG Pay', domein: 'geld',
    geimplementeerd: true, geld: true, beveiliging: false, noodknop: true,
    standen: STANDEN, veiligeStand: 'disabled', afhankelijk: [], provider: 'per-verzoek',
    bewijs: { controles: ['refundPayoutSettlement', 'reconciliation'] },
    /* Terugbetalen rust op hetzelfde handelaarscontract als ontvangen; een eigen
       besluit zou suggereren dat het los te regelen is. */
    bevoegdheid: { besluit: 'inkomend.handelaar' },
    toetsen: ['test/vrijgave.test.js', 'test/uitbetaalgrendel.test.js'] }),

  r('geld.partnerafrekening', {
    naam: 'Een partner afrekenen naar zijn verbonden account', eigenaar: 'RTG Pay', domein: 'geld',
    geimplementeerd: true, geld: true, beveiliging: false, noodknop: true,
    standen: STANDEN, veiligeStand: 'disabled',
    afhankelijk: ['geld.provider.stripe_connect'], provider: null,
    bewijs: { controles: ['payoutProvider', 'refundPayoutSettlement', 'reconciliation'] },
    bevoegdheid: { vermogen: 'PARTNER_UITBETALING' },
    toetsen: ['test/vrijgave.test.js', 'test/connect-afrekening.test.js'] }),

  r('geld.provider.stripe', {
    naam: 'Stripe als betaalprovider', eigenaar: 'RTG Pay', domein: 'geld',
    geimplementeerd: true, geld: true, beveiliging: false, noodknop: true,
    standen: STANDEN, veiligeStand: 'disabled', afhankelijk: [], provider: 'stripe',
    bewijs: { controles: ['paymentProvider', 'webhookDelivery'], provider: 'stripe' },
    bevoegdheid: { besluit: 'provider.stripe' },
    toetsen: ['test/vrijgave.test.js'] }),

  r('geld.provider.stripe_connect', {
    naam: 'Stripe Connect voor partnerafrekeningen', eigenaar: 'RTG Pay', domein: 'geld',
    geimplementeerd: true, geld: true, beveiliging: false, noodknop: true,
    standen: STANDEN, veiligeStand: 'disabled',
    afhankelijk: ['geld.provider.stripe'], provider: 'stripe_connect',
    bewijs: { controles: ['payoutProvider', 'webhookDelivery', 'reconciliation'], provider: 'stripe' },
    /* Een Connect-platform draagt verantwoordelijkheid voor de onboarding van
       verbonden accounts; dat is een eigen overeenkomst met Stripe. */
    bevoegdheid: { besluit: 'provider.stripe_connect' },
    toetsen: ['test/vrijgave.test.js', 'test/connect-afrekening.test.js'] }),

  r('geld.provider.mollie', {
    naam: 'Mollie als betaalprovider', eigenaar: 'RTG Pay', domein: 'geld',
    geimplementeerd: true, geld: true, beveiliging: false, noodknop: true,
    standen: STANDEN, veiligeStand: 'disabled', afhankelijk: [], provider: 'mollie',
    bewijs: { controles: ['paymentProvider', 'webhookDelivery'], provider: 'mollie' },
    bevoegdheid: { besluit: 'provider.mollie' },
    toetsen: ['test/vrijgave.test.js'] }),

  r('geld.provider.adyen', {
    naam: 'Adyen als betaalprovider', eigenaar: 'RTG Pay', domein: 'geld',
    geimplementeerd: true, geld: true, beveiliging: false, noodknop: true,
    standen: STANDEN, veiligeStand: 'disabled', afhankelijk: [], provider: 'adyen',
    bewijs: { controles: ['paymentProvider', 'webhookDelivery'], provider: 'adyen' },
    bevoegdheid: { besluit: 'provider.adyen' },
    toetsen: ['test/vrijgave.test.js'] }),

  r('geld.intern_saldo', {
    naam: 'Intern saldo en grootboek (gesloten circuit)', eigenaar: 'RTG Pay', domein: 'geld',
    geimplementeerd: true, geld: true, beveiliging: false, noodknop: true,
    standen: STANDEN, veiligeStand: 'disabled', afhankelijk: [], provider: null,
    /* Het grootboek bewijst zich tegen de provider: zonder sluitende
       reconciliatie op deze release is "het saldo klopt" een aanname. */
    bewijs: { controles: ['reconciliation'] },
    bevoegdheid: { vermogen: 'WALLET_SALDO' },
    toetsen: ['test/vrijgave.test.js'] }),

  r('geld.terugstortbaar_saldo', {
    naam: 'Saldo dat het lid kan terugkrijgen (elektronisch geld)', eigenaar: 'RTG Pay', domein: 'geld',
    geimplementeerd: true, geld: true, beveiliging: false, noodknop: true,
    standen: STANDEN, veiligeStand: 'disabled', afhankelijk: ['geld.intern_saldo'], provider: null,
    bewijs: { controles: ['payoutProvider', 'reconciliation'] },
    /* B3. Saldo dat tegen de nominale waarde inwisselbaar is voor de houder IS
       elektronisch geld (CLAUDE.md, de terugstortstand). Dat de bevoegdheid
       WALLET_SALDO op `open` een partnerrail kan vinden, is niet genoeg: er moet
       een EXTERN besluit liggen (juridisch, met bron en hash) dat RTG die
       positie inneemt. Zonder dat besluit staat deze regel op niet
       geautoriseerd, wat de stand ook zegt. */
    bevoegdheid: { vermogen: 'WALLET_SALDO', besluit: 'emoney.b3' },
    toetsen: ['test/vrijgave.test.js'] }),

  r('geld.lid_iban_uitbetaling', {
    naam: 'Saldo van een lid uitbetalen naar zijn IBAN', eigenaar: 'RTG Pay', domein: 'geld',
    geimplementeerd: true, geld: true, beveiliging: false, noodknop: true,
    standen: STANDEN, veiligeStand: 'disabled', afhankelijk: ['geld.terugstortbaar_saldo'], provider: null,
    bewijs: { controles: ['payoutProvider', 'refundPayoutSettlement', 'reconciliation'] },
    bevoegdheid: { vermogen: 'LID_UITBETALING', besluit: 'emoney.b3' },
    toetsen: ['test/vrijgave.test.js'] })
]);

const OP_ID = new Map(REGISTER.map(c => [c.id, c]));
const vind = id => (typeof id === 'string' && OP_ID.get(id)) || null;
const { BESLUITEN } = require('./besluiten');
/* De keuring staat in ./registerkeur.js; hier alleen doorgegeven, met dit
   register als standaard. */
const valideerRegister = (lijst = REGISTER, opties) => require('./registerkeur').valideerRegister(lijst, opties);

module.exports = { STANDEN, ACTIVEREND, NEPRAILS, LOKALE_NEPRAILS, ECHTE_PROVIDERS, REGISTER, BESLUITEN,
  valideerRegister, vind };

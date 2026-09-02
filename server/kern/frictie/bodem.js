/* DE BODEM ONDER DE FRICTIE -- wat nooit soepeler mag worden, hoe vertrouwd de
   omstandigheden ook zijn.

   WAAROM DIT BESTAND BESTAAT. Een risicomotor die context meeweegt, kan frictie
   toevoegen EN weghalen. Het toevoegen is de bedoeling. Het weghalen is de
   plek waar zo'n motor gevaarlijk wordt, want niet elke drempel in dit huis
   staat er vanwege risico: sommige staan er vanwege een GRENS. Een KYC-besluit
   is niet zwaar omdat het duur is maar omdat een mens naar een document hoort
   te kijken. Een pasbesluit is niet zwaar omdat het vaak misgaat maar omdat
   CLAUDE.md zegt dat de AI toegang nooit zelf belooft of verleent.

   Het verschil is niet in een score te vangen. Een score kent maar een as, en
   op die as is "een mens moet dit doen" gewoon een hoog getal -- dus is er
   altijd een combinatie van vertrouwde omstandigheden die eronder duikt. Dat is
   geen bug in de weging maar de vorm zelf.

   FOUNDATION.md par. 2 heeft deze les al een keer geleerd en er een besluit van
   gemaakt: er is bewust geen EXECUTE_LOW_RISK, want "wie bouwt weet niet in
   wiens leven hij staat, en een grens die per geval anders had gemoeten is geen
   grens". Deze lijst is dezelfde regel, nu als code.

   WAT EEN REGEL HIER IS. Geen verbod -- de handeling mag gewoon, door een mens.
   Een regel zegt uitsluitend: onder dit niveau zakt hij nooit. `assist` betekent
   dat de machine mag voorbereiden en een mens aftekent; `hand` betekent dat de
   machine er helemaal niet aan zit.

   ELKE REGEL DRAAGT EEN BRON, en dat is afgedwongen (zie ./index.js, keurBodem).
   Een bodemregel zonder herkomst is over een half jaar niet te beoordelen: dan
   weet niemand meer of hij een wet, een merkregel of iemands voorzichtigheid
   was, en dan sneuvelt hij bij de eerste die hem in de weg vindt zitten. */
'use strict';

/* De treden, van soepel naar streng. De namen komen uit ./index.js (NIVEAUS);
   deze volgorde is wat "strenger" betekent en woont alleen hier. */
const ORDE = Object.freeze({ auto: 0, assist: 1, hand: 2 });

/* De strengste van twee treden. Null telt als "geen eis". */
function strengste(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return ORDE[a] >= ORDE[b] ? a : b;
}

/* DE LIJST. Per regel: waar hij op slaat (een pad-patroon of een actienaam uit
   de GRONDSLAG), het minimum, waarom, waar die reden vandaan komt, en een
   VOORBEELD dat er werkelijk onder valt.

   Dat voorbeeld is er niet ter illustratie. Een patroon toetsen met een pad dat
   je uit het patroon zelf afleidt, toetst niets -- dat is precies de fout die
   test/frictiebodem.test.js in zijn eerste versie maakte: hij las `/api/office`
   uit de KYC-regel, dat pad viel er niet onder, en de toets was groen om de
   verkeerde reden. Nu draagt elke regel een pad dat een mens heeft opgeschreven
   en dat de toets tegen het patroon houdt.

   Hij is met opzet KORT. Een bodemlijst die alles dekt is een tweede
   rechtenmodel, en dat is precies wat CONCERN.md verbiedt. Hier staat alleen
   wat aantoonbaar geen risicoafweging is maar een grens. */
const BODEM = Object.freeze([
  { id: 'pasbesluit', pad: /^\/api\/aanmelding(\/|$)/, minimum: 'hand',
    reden: 'Lifestyle en Business komen uitsluitend na een menselijke beoordeling; de AI mag toegang nooit zelf beloven of verlenen.',
    bron: 'CLAUDE.md, toegangs- en AI-regels; server/kern/stuur.js VERBODEN',
    voorbeeld: '/api/aanmelding/beslis' },

  { id: 'kyc-besluit', pad: /^\/api\/office\/verify(\/|$)/, minimum: 'hand',
    reden: 'Iemand kijkt naar een paspoortscan en een selfie en legt nationaliteit, geslacht en geboortedatum vast. Dat besluit is het kijken zelf.',
    bron: 'server/routes/office/verificaties.js; CLAUDE.md, progressielaag 18+',
    voorbeeld: '/api/office/verify' },

  { id: 'vakbewijs', pad: /^\/api\/office\/vakbewijs(\/|$)/, minimum: 'hand',
    reden: 'Een ingediend stuk is geen bewijs: een mens van RTG tekent af, en nooit de werkgever zelf.',
    bron: 'CLAUDE.md, de zaak wordt gecontroleerd en de mens',
    voorbeeld: '/api/office/vakbewijs/keur' },

  /* DEZE TWEE STAAN OP `assist` EN NIET OP `hand`, en dat is een besluit.

     De eerste versie zette ze op `hand`: geld dat het huis verlaat, daar zit
     de machine niet aan. Dat is een halve regel. FABRIC.md par. 5 zegt niet
     dat de machine er niets mee mag, maar dat het niet VANZELF gaat -- en het
     mechanisme daarvoor bestaat al: een exact servervoorstel dat een mens
     buiten het model bevestigt. Dat is precies wat `assist` betekent.

     Op `hand` zetten zou dus niet strenger zijn maar dommer: het haalt een
     werkende bevestigingsstap weg en levert er niets voor terug. De bodem
     bewaakt hier dat de stap er IS, niet dat de machine wegblijft. */
  { id: 'geld-het-huis-uit', pad: /^\/api\/(bank\/sepa|supplier\/pay\/uitbetaal|pay\/uitbetaal)(\/|$)/, minimum: 'assist',
    reden: 'Geld verlaat het huis nooit vanzelf: een mens bevestigt het concrete bedrag en de ontvanger, buiten het model om.',
    bron: 'FABRIC.md par. 5; GELD.md, de harde grens',
    voorbeeld: '/api/bank/sepa' },

  { id: 'geld-in-bulk', pad: /^\/api\/bank\/(bulk|salaris)(\/|$)/, minimum: 'assist',
    reden: 'Veel kleine betalingen samen zijn geen kleine betaling. De stapel is de handeling.',
    bron: 'GELDLAT.md; kern/frictie/index.js, het stapeloordeel',
    voorbeeld: '/api/bank/salaris' },

  { id: 'sleutelbos', pad: /^\/api\/(auth|account)(\/|$)/, minimum: 'hand',
    reden: 'Accounts, wachtwoorden en het koppelen van rollen zijn mensenwerk; hier ligt de grens tussen wie iemand is en wat hij mag.',
    bron: 'server/kern/stuur.js VERBODEN',
    voorbeeld: '/api/auth/login' },

  { id: 'eigenaarskast', pad: /^\/api\/(techniek|boardroom)(\/|$)/, minimum: 'hand',
    reden: 'Het techniekbord en de boardroom zijn van de eigenaar. Toegang daar is een uitnodiging en geen recht.',
    bron: 'BESTUUR.md, de tweede grens; server/kern/stuur.js VERBODEN',
    voorbeeld: '/api/techniek/stand' },

  /* De vier op ACTIENAAM in plaats van op pad. Ze komen uit de GRONDSLAG van de
     motor en gelden dus ook waar geen HTTP-pad in beeld is -- een interne
     stapelronde bijvoorbeeld. Deze vier stonden al als `vierOgen` in de motor;
     daar waren ze een uitkomst, hier zijn ze een ondergrens. Dat verschil telt:
     vier ogen zegt WIE er kijkt, de bodem zegt DAT er gekeken wordt. */
  { id: 'identiteit', actie: 'identiteit wijzigen', minimum: 'hand',
    reden: 'Een identiteit wijzigen raakt de kluis en daarmee de scheiding tussen codenaam en mens.',
    bron: 'CLAUDE.md, privacy by design' },
  { id: 'toegang', actie: 'toegang verlenen', minimum: 'hand',
    reden: 'Wie toegang verleent, verlegt een grens. Dat is geen uitvoering maar beleid.',
    bron: 'CONTROLPLANE.md, geen bevoegdheid zonder oorsprong' },
  { id: 'noodtoegang', actie: 'noodtoegang', minimum: 'hand',
    reden: 'Noodtoegang bestaat juist voor het geval waarin het systeem het niet meer weet.',
    bron: 'BESTUUR.md, de herstellus' },
  { id: 'massa', actie: 'massamutatie', minimum: 'assist',
    reden: 'Een massamutatie kan klein lijken per geval en groot zijn als geheel.',
    bron: 'kern/frictie/index.js, het stapeloordeel' }
]);

/* De strengste bodem die op dit pad slaat, of null. */
function bodemVoorPad(pad) {
  const p = String(pad || '');
  let uit = null;
  for (const r of BODEM) {
    if (!r.pad || !r.pad.test(p)) continue;
    if (!uit || ORDE[r.minimum] > ORDE[uit.minimum]) uit = r;
  }
  return uit;
}

/* Idem op actienaam. Exact vergelijken en niet met een prefix: 'lezen' mag
   nooit per ongeluk onder 'lezen en wissen' vallen. */
function bodemVoorActie(actie) {
  const a = String(actie || '');
  let uit = null;
  for (const r of BODEM) {
    if (!r.actie || r.actie !== a) continue;
    if (!uit || ORDE[r.minimum] > ORDE[uit.minimum]) uit = r;
  }
  return uit;
}

module.exports = { BODEM, ORDE, strengste, bodemVoorPad, bodemVoorActie };

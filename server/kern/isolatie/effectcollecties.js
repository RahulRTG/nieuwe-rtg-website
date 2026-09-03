/* WELK EFFECT EEN COLLECTIE DRAAGT -- de derde bron onder het effectmodel.

   WAAROM DIT DE JUISTE VORM IS, EN DE VORIGE TWEE NIET GENOEG WAREN.
   ./effectregister.js kent negen VERKLARINGEN (een patroon op een pad, met een
   grond) en een tabel VERMOEDENS per categorie. Samen dekten die 282 paden
   verklaard en 1794 vermoed; 2513 hadden niets. Doorgaan op die weg betekent
   4643 paden een voor een nakijken, en een register dat op die manier volloopt,
   loopt vol met gissingen -- precies wat er in de kop van ./effecten.js staat.

   DE UITWEG IS EEN KLEINERE NOEMER. IDEMPROEF.json heeft per route GEMETEN welke
   COLLECTIES er bewogen. Dat zijn er 236 in totaal, en dat is wel een lijst die
   een mens kan nalopen: `bankSaldi` beweegt geld, `accountRollen` verleent
   rechten, `sessions` raakt identiteit. Een oordeel per collectie geldt daarna
   voor elke route die eraan komt -- gemeten en niet geraden.

   DE AFLEIDING IS DUS: route --(gemeten schrijfactie)--> collectie --(dit
   register)--> effect. Alleen de laatste pijl is mensenwerk, en die staat hier
   met een grond per regel.

   HET PLAFOND STAAT ERBIJ, EN DAT IS DE BELANGRIJKSTE ZIN VAN DIT BESTAND.
   Slechts 599 van de 4643 rol-paden hebben uberhaupt een gemeten collectie: bij
   de rest kwam de proef niet langs (geen wereld, geen object, geen rol). Ook als
   dit register 236 van de 236 collecties zou indelen, blijft de dekking daar
   steken. Het effectmodel komt dus NIET uit de schaduw door dit bestand vol te
   maken; het komt uit de schaduw als IDEMPROEF.json verder reikt. Dat is een
   bevinding met een getal in plaats van een gevoel, en hij hoort hier te staan
   waar iemand hem tegenkomt die denkt dat hij er met nog vijftig regels is.

   WAT ER NIET IN STAAT, MET REDEN. De meeste van de 236 zijn met opzet nog niet
   ingedeeld. Ingedeeld is wat een HOOG BELANG draagt en waarover geen redelijke
   discussie bestaat: geld, identiteit, rechten, blijvende koppelingen en de
   beveiliging zelf. De rest staat op `onbekend`, en `onbekend` is hier nooit
   hetzelfde als "geen effect" -- ./effecten.js weigert een lege lijst terug te
   geven, juist hierom. */
'use strict';

/* Per collectie: welk effect zij draagt, en waarom. De grond is geen sier: hij
   is wat een tweede lezer nodig heeft om de indeling te kunnen betwisten. */
const PER_COLLECTIE = Object.freeze({
  /* ---- geld ---- */
  bankSaldi:        ['GELD_BEWEGEN', 'het saldo van een rekening'],
  bankBoekingen:    ['GELD_BEWEGEN', 'de boekingen waaruit dat saldo volgt'],
  bankRekeningen:   ['GELD_BEWEGEN', 'het bestaan en de eigenaar van een rekening'],
  bankPassen:       ['GELD_BEWEGEN', 'een betaalmiddel: uitgeven, bevriezen, limiet'],
  bankTerugkerend:  ['GELD_BEWEGEN', 'een opdracht die vanzelf blijft betalen'],
  bankregie:        ['GELD_BEWEGEN', 'de bediening van de bankkant'],
  paySaldi:         ['GELD_BEWEGEN', 'het tegoed in RTG Pay'],
  payBoekingen:     ['GELD_BEWEGEN', 'de grootboekregels van RTG Pay'],
  payTegoed:        ['GELD_BEWEGEN', 'tegoed dat besteed kan worden'],
  payVerzoeken:     ['GELD_BEWEGEN', 'een betaalverzoek dat een ander bereikt'],
  payTreasury:      ['GELD_BEWEGEN', 'de treasury van een ondernemer'],
  payCodes:         ['GELD_BEWEGEN', 'codes waarmee betaald wordt'],
  payTikCodes:      ['GELD_BEWEGEN', 'zelfde reden'],
  betaalRegie:      ['GELD_BEWEGEN', 'de bediening van de betaalproviders'],
  betaalVerzoeken:  ['GELD_BEWEGEN', 'een openstaand betaalverzoek'],
  directOntvangsten:['GELD_BEWEGEN', 'geld dat binnenkomt'],
  waardePosities:   ['GELD_BEWEGEN', 'WAARDE.md: een positie IS waarde met een eigenaar'],
  waardeOormerken:  ['GELD_BEWEGEN', 'geld dat apart is gezet, en dat blijft'],
  giftcards:        ['GELD_BEWEGEN', 'inwisselbaar tegoed'],
  wallet:           ['GELD_BEWEGEN', 'de portemonnee zelf'],
  facturen:         ['GELD_BEWEGEN', 'een vordering op iemand'],
  invoices:         ['GELD_BEWEGEN', 'zelfde reden, andere naam'],
  fondsAfdrachten:  ['GELD_BEWEGEN', 'geld dat naar de RTFoundation gaat'],
  socialeAfdrachten:['GELD_BEWEGEN', 'zelfde reden'],
  labFonds:         ['GELD_BEWEGEN', 'bijdragen aan het fonds'],
  posSales:         ['GELD_BEWEGEN', 'een afgerekende verkoop'],
  aiTegoed:         ['GELD_BEWEGEN', 'COMMERCIE.md: verbruik boven het tegoed kost geld'],
  punten:           ['GELD_BEWEGEN', 'een spaarwaarde die iets waard is'],
  economie:         ['GELD_BEWEGEN', 'ECONOMIE.md: de doorbelasting tussen de werelden'],
  geldbeleid:       ['GELD_BEWEGEN', 'de eigen geldgrens die betalingen weigert'],
  gemeenteAanslagen:['GELD_BEWEGEN', 'een aanslag is een vordering'],

  /* ---- identiteit ---- */
  rtgid:            ['IDENTITEIT_WIJZIGEN', 'RTG iD is de identiteit zelf'],
  sessions:         ['IDENTITEIT_WIJZIGEN', 'wie er binnen is en hoe lang'],
  onboarding:       ['IDENTITEIT_WIJZIGEN', 'hier ontstaat een identiteit'],
  aanmeldingen:     ['IDENTITEIT_WIJZIGEN', 'zelfde reden, aan de zaakkant'],
  certificaten:     ['IDENTITEIT_WIJZIGEN', 'een bewijs over een persoon'],
  memberDir:        ['IDENTITEIT_WIJZIGEN', 'de ledenregistratie'],
  stadPaspoort:     ['IDENTITEIT_WIJZIGEN', 'een paspoort is identiteit'],
  rijkBekend:       ['IDENTITEIT_WIJZIGEN', 'wat de overheid van iemand weet'],

  /* ---- rechten ---- */
  accountRollen:    ['RECHT_VERLENEN', 'wie mag wat, per account'],
  boardroomToegang: ['RECHT_VERLENEN', 'toegang tot de boardroom'],
  werkplekToegang:  ['RECHT_VERLENEN', 'toegang binnen een werkruimte'],
  rtmailRecht:      ['RECHT_VERLENEN', 'wie er bij welke postbus mag'],
  staffInvites:     ['RECHT_VERLENEN', 'een uitnodiging die toegang wordt'],
  boardroom:        ['RECHT_VERLENEN', 'de bediening waar besluiten worden vrijgegeven'],

  /* ---- blijvende koppelingen ---- */
  apiPoort:         ['VERTROUWENSRELATIE_AANGAAN', 'een sleutel waarmee iets van buiten binnenkomt'],
  mailSleutels:     ['VERTROUWENSRELATIE_AANGAAN', 'zelfde reden'],
  integratiekamer:  ['VERTROUWENSRELATIE_AANGAAN', 'de koppelingen met derden'],
  appInstallaties:  ['VERTROUWENSRELATIE_AANGAAN', 'APPSTORE.md: een machtiging die het lid verleent'],
  rtfAppInstallaties:['VERTROUWENSRELATIE_AANGAAN', 'zelfde reden'],
  beroepenInstallaties:['VERTROUWENSRELATIE_AANGAAN', 'zelfde reden'],
  geloofInstallaties:['VERTROUWENSRELATIE_AANGAAN', 'zelfde reden'],
  reisInstallaties: ['VERTROUWENSRELATIE_AANGAAN', 'zelfde reden'],
  rijksInstallaties:['VERTROUWENSRELATIE_AANGAAN', 'zelfde reden'],
  schoolInstallaties:['VERTROUWENSRELATIE_AANGAAN', 'zelfde reden'],
  toestellen:       ['VERTROUWENSRELATIE_AANGAAN', 'een toestel met een eigen sleutel'],
  contactPins:      ['VERTROUWENSRELATIE_AANGAAN', 'LINK.md: een adres waarmee een ander je bereikt'],
  homekit:          ['VERTROUWENSRELATIE_AANGAAN', 'een koppeling met apparatuur in huis'],

  /* ---- de beveiliging zelf ---- */
  contactPinSecurity:['BEVEILIGING_VERZWAKKEN', 'de rem op het scannen van pins'],
  commandBeleid:    ['BEVEILIGING_VERZWAKKEN', 'CONTROLPLANE.md: hier verschuiven de grenzen'],
  appstore:         ['DERDENCODE_UITVOEREN', 'APPSTORE.md: hier komt code van buiten binnen']
});



const { VASTLEGGING, GRABBELTON } = require('./collectieuitsluiting');
/* Het tweede deel: de effecten die aan ANDERE MENSEN raken. Zie ./effectcollecties-b.js. */
const { PER_COLLECTIE_B } = require('./effectcollecties-b');

/* De namen worden bij het laden getoetst tegen de effectenlijst: een tikfout in
   een effectnaam zou hier stil een collectie ONgeclassificeerd laten, en dat is
   precies de faalvorm die deze hele laag moet uitsluiten. */
const ALLES = Object.freeze(Object.assign({}, PER_COLLECTIE, PER_COLLECTIE_B));

function keurIn(geldigeEffecten) {
  const grof = GRABBELTON.filter(c => ALLES[c]);
  if (grof.length) {
    throw new Error('effectcollecties: "' + grof.join(', ') + '" is een GRABBELTON. Onverwante ' +
      'padfamilies schrijven erin, dus haar naam draagt geen effect -- zie de uitleg bij GRABBELTON. ' +
      'Hang het effect aan het PAD in ./effectregister.js.');
  }
  const vast = VASTLEGGING.filter(c => ALLES[c]);
  if (vast.length) {
    throw new Error('effectcollecties: "' + vast.join(', ') + '" is VASTLEGGING en geen effect. ' +
      'Een append-only spoor verzwakt niets, en omdat vrijwel elke geauditeerde route erin schrijft, ' +
      'krijgt anders de halve app een effect dat hij niet heeft -- zie de uitleg bij VASTLEGGING.');
  }
  const fout = Object.entries(ALLES)
    .filter(([, [effect]]) => !geldigeEffecten.includes(effect))
    .map(([col, [effect]]) => col + ' -> ' + effect);
  if (fout.length) {
    throw new Error('effectcollecties: onbekend effect bij ' + fout.join(', ') +
      '. De lijst staat in kern/isolatie/effecten.js; een tikfout hier laat een collectie stil ' +
      'ongeclassificeerd, en dat is de faalvorm waar deze laag tegen is gebouwd.');
  }
  return Object.keys(ALLES).length;
}

function effectVan(collectie) {
  const rij = ALLES[String(collectie)];
  return rij ? { effect: rij[0], grond: rij[1] } : null;
}

module.exports = { PER_COLLECTIE: ALLES, VASTLEGGING, GRABBELTON, effectVan, keurIn };

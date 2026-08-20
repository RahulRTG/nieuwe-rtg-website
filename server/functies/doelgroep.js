/* Functieschakelaars (deelmodule): WIE belt er? Afgesplitst van ./toegang.js,
   dat over "mag dit pad" gaat. De twee liepen door elkaar tot WorkOS de relatie
   tot een organisatie liet meetellen (WERELDEN.md); toen werd dit een eigen
   onderwerp met een eigen lijst paden en een eigen les erbij.

   ./toegang.js exporteert alles hieronder door, dus niemand hoeft van deze
   opdeling te weten. */
function prefixLengte(pad, prefix) {
  if (!pad.startsWith(prefix)) return 0;
  const rest = pad.slice(prefix.length);
  return (rest === '' || rest[0] === '/') ? prefix.length : 0;
}

/* De doelgroep van een verzoek. Expliciete app-paden bepalen de doelgroep,
   ongeacht wie er inlogt (leveranciers, personeel, backoffice, foundation). Op
   de gedeelde leden- en Salon-paden volgt de doelgroep de pas van het account. */
function tierNaarDoelgroep(tier) {
  if (tier === 'lifestyle') return 'lifestyle';
  if (tier === 'business') return 'business';
  if (tier === 'rtg') return 'rtg';
  if (tier === 'guest') return 'gast'; // de gratis app is een eigen doelgroep
  return null; // onbekend: alleen de globale schakelaar telt
}
/* DE WERKPADEN VAN WORKOS, en dit blok komt uit een gemeten fout.

   Elf functies -- De werkvloer, De werkplek, Metier, Vakritmes, Verkoop, De
   zaakdoos, Facturen, Kantoorgesprek, Werkmail, RTG Mail en de Wervingslink --
   droegen schakelaars voor `leverancier` en `personeel` die NOOIT verkeer
   zagen. Hun paden beginnen niet met /api/supplier of /api/staff, dus viel de
   doelgroep terug op de PAS van het lid. Een partner of medewerker heeft geen
   ledentoken, dus kwam daar `null` uit: de knop stond op het bord, kleurde
   netjes groen of rood, en stuurde niets. Dat is de stilste storing die er is
   (LAT.md regel 3) -- een meter die geruststelt.

   WAAROM DE PAS HIER HET VERKEERDE ANTWOORD IS. In WorkOS zegt je pas niet wie
   je bent (WERELDEN.md): je RELATIE tot een organisatie doet dat. Een werknemer
   krijgt de werkvloer VIA zijn werkgever, een werkgever KOOPT de werkruimte, en
   RTG zit er als werkgever zelf ook in. Drie relaties, een wereld.

   EN WAAROM `manager` DE LIJN IS. De sessie zegt met opzet NIET uit welke app
   je komt: een medewerker logt een keer in en gebruikt daarmee zowel de
   partner-app als de PDA (routes/supplier/pda/posities.js, "1x aanmelden").
   Er valt op een gedeeld pad dus niet af te lezen welk scherm belt, en dat hoeft
   ook niet -- wat het bord wil sturen is niet het scherm maar de mens: wie de
   zaak bestuurt tegenover wie er werkt. Dat staat wel op de sessie.

   Op de paden MET een prefix verandert er niets: /api/supplier blijft
   leverancier en /api/staff blijft personeel, want daar zegt het pad het al. */
const WERKPADEN = ['/api/werkvloer', '/api/werkplek', '/api/metier', '/api/vak', '/api/verkoop',
  '/api/doos', '/api/facturen', '/api/kantoor', '/api/werkmail', '/api/mail/binnen',
  '/api/werving', '/api/bedrijf'];

function doelgroepVanVerzoek(pad, user, sessie) {
  if (pad.startsWith('/api/supplier') || pad.startsWith('/api/partner')) return 'leverancier';
  if (pad.startsWith('/api/staff')) return 'personeel';
  if (pad.startsWith('/api/office')) return 'intern';
  if (pad.startsWith('/api/foundation')) return 'foundation';
  if (sessie && WERKPADEN.some(w => prefixLengte(pad, w))) {
    if (sessie.role === 'office') return 'intern';
    if (sessie.role === 'supplier') return sessie.manager ? 'leverancier' : 'personeel';
  }
  return user ? tierNaarDoelgroep(user.tier) : null;
}

module.exports = { doelgroepVanVerzoek, tierNaarDoelgroep, WERKPADEN };

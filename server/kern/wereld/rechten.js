/* RTG Wereld -- WAT ELKE PAS MAG. Eén identiteit, één netwerk, één app, jouw
   context: dit bestand is de "jouw context"-helft daarvan.

   WAAROM DIT EEN EIGEN BESTAND IS, EN HET ENIGE.
   De vraag "mag een gratis RTG-pas dit?" werd tot nu toe op elke plek opnieuw
   beantwoord. routes/zakelijk.js heeft zijn eigen `const PRO = ['lifestyle',
   'business']`, kern/lid.js kijkt naar sess.tier, en elk scherm dat een knop
   verbergt doet het nog een keer. Dat is LAT-regel 4: dezelfde waarheid op
   meerdere plekken loopt uiteen, en meestal zonder dat iets klaagt -- hier zou
   dat betekenen dat een knop zichtbaar is die de server weigert, of erger, dat
   een deur openstaat die dicht hoorde.

   Daarom staat het hier één keer, als DATA en niet als code verspreid over
   routes. De server poort ermee (kern/wereld/index.js), en het scherm vraagt
   dezelfde lijst op om te weten wat het mag tonen. Server en scherm kunnen dus
   niet uiteenlopen: ze lezen hetzelfde bestand.

   Bewust NIET aangeraakt: routes/zakelijk.js houdt zijn eigen `pro`-poort. Die
   vervangen is een verbouwing van een werkend domein; wat hier staat is de
   nieuwe laag erboven. Zolang beide bestaan is `zakelijkPro()` hieronder de
   afspraak die ze gelijk houdt -- en test/wereldlaag.test.js trekt na dat ze
   hetzelfde zeggen. Zodra zakelijk.js hierop overstapt, vervalt die toets.

   MERKREGEL DIE HIER IN CODE STAAT (CLAUDE.md): Lifestyle en Business komen er
   uitsluitend na menselijke goedkeuring of op uitnodiging. Dit bestand VERLEENT
   dus nooit een pas -- het leest er alleen een af. Optillen gebeurt in de
   office-akkoordflow en nergens anders. */
'use strict';

/* De vermogens, per pas, cumulatief. Een pas erft alles van de pas eronder;
   wat hier staat is uitsluitend wat die pas ERBIJ krijgt. Cumulatief omdat de
   fout die je anders maakt -- een vermogen dat je bij Business vergeet te
   herhalen en dat daarmee stil verdwijnt -- precies de stille soort is. */
const ERBIJ = {
  /* De gratis pas. Een volwaardig sociaal netwerk, geen uitgeklede demo:
     plaatsen, lezen, reageren, verhalen, genootschappen, chatten. Wat hij niet
     krijgt is de professionele wereld en het gereedschap eromheen. */
  rtg: [
    'feed.lezen', 'feed.plaatsen', 'feed.reageren',
    'verhalen', 'snaps', 'genootschap', 'chat', 'profiel.persoonlijk',
    'zoeken.eenvoudig'
  ],
  /* Lifestyle: de professionele wereld gaat open, plus het gereedschap dat bij
     andere platformen achter een abonnement zit. Inbegrepen, niet verkocht. */
  lifestyle: [
    'modus.business', 'zakelijk.feed', 'zakelijk.gids', 'zakelijk.verbinden',
    'profiel.professioneel', 'profiel.creator',
    'zoeken.geavanceerd', 'inzicht.profielbezoek', 'inzicht.bereik',
    'netwerk.analyse', 'events.zakelijk', 'leren.certificaten',
    'ai.loopbaan', 'ai.netwerk', 'creator.gereedschap'
  ],
  /* Business: de kant van de onderneming. Werven, verkopen, en het bedrijf
     zelf als profiel. */
  business: [
    'profiel.ondernemer', 'werving.suite', 'werving.talentpool',
    'sales.suite', 'sales.leads', 'inzicht.bedrijf',
    'ai.recruiter', 'ai.sales', 'kansenbord.plaatsen'
  ]
};

// De volgorde is de trap; hij staat één keer en de rest rekent ermee.
const TRAP = ['rtg', 'lifestyle', 'business'];

/* Alles wat een pas mag, dus inclusief wat hij erft. Berekend uit ERBIJ en
   TRAP, nooit met de hand overgeschreven -- dat zou regel 4 terugbrengen in
   hetzelfde bestand dat hem oplost. */
function vermogens(tier) {
  const tot = TRAP.indexOf(tier);
  if (tot < 0) return [];                       // gast, leverancier, onbekend
  const uit = [];
  for (let i = 0; i <= tot; i++) uit.push(...ERBIJ[TRAP[i]]);
  return uit;
}

const magVan = (tier, vermogen) => vermogens(tier).includes(vermogen);

/* DE MODI. De schakelaar boven de feed verandert niet van app maar van wereld.
   Welke modi je ziet volgt uit je vermogens, zodat er geen tweede lijst is die
   kan gaan afwijken van de eerste.

   'prive' staat er bewust bij en is voor iedereen: het is geen extra maar de
   uitweg -- alleen jouw kring, niets publieks. Wie een sociaal netwerk bouwt
   hoort de stille stand niet achter een pas te zetten. */
const MODI = [
  { id: 'alles', naam: 'Alles', eist: null },
  { id: 'lifestyle', naam: 'Lifestyle', eist: null },
  { id: 'business', naam: 'Business', eist: 'modus.business' },
  { id: 'genootschap', naam: 'Communities', eist: 'genootschap' },
  { id: 'prive', naam: 'Privé', eist: null }
];

// De modi die deze pas mag zien, met per stuk of hij open is en waarom niet.
function modiVoor(tier) {
  if (!TRAP.includes(tier)) return [];
  return MODI.map(m => ({
    id: m.id, naam: m.naam,
    open: !m.eist || magVan(tier, m.eist),
    reden: !m.eist || magVan(tier, m.eist) ? null
      : 'Onderdeel van de Lifestyle en Business Pass.'
  }));
}

/* Is deze modus echt open voor deze pas? De route poort hiermee, het scherm
   toont hiermee. Eén functie, twee gebruikers, geen ruimte ertussen. */
function modusOpen(tier, modus) {
  const m = modiVoor(tier).find(x => x.id === modus);
  return !!(m && m.open);
}

/* De afspraak met het bestaande zakelijk-domein (zie de kop). Zolang
   routes/zakelijk.js zijn eigen PRO-lijst heeft, moet deze functie hetzelfde
   zeggen; test/wereldlaag.test.js trekt dat na tegen de echte route en niet tegen
   een kopie van de lijst -- een toets tegen een kopie zou altijd slagen. */
const zakelijkPro = (tier) => magVan(tier, 'zakelijk.feed');

/* De profiellagen. Eén profiel met lagen, niet vier accounts. Wie een laag niet
   mag, ziet hem niet -- en kan hem dus ook niet vullen. */
const LAGEN = [
  { id: 'persoonlijk', naam: 'Persoonlijk', eist: 'profiel.persoonlijk' },
  { id: 'professioneel', naam: 'Professioneel', eist: 'profiel.professioneel' },
  { id: 'creator', naam: 'Creator', eist: 'profiel.creator' },
  { id: 'ondernemer', naam: 'Ondernemer', eist: 'profiel.ondernemer' }
];
const lagenVoor = (tier) => LAGEN.filter(l => magVan(tier, l.eist)).map(l => ({ id: l.id, naam: l.naam }));

/* Wie mag dit onderdeel van mijn profiel zien. De gebruiker kiest per VELD; dit
   is de lijst waaruit hij kiest, en meteen de lijst waartegen de server een
   ingestuurde keuze controleert (anders is het een vormcontrole -- regel 8).

   HIER STONDEN ER ZES, met 'vrienden' naast 'contacten'. Dat was een lege
   belofte en hij is weg: dit huis heeft EEN vriendengraaf, dus die twee zouden
   precies dezelfde mensen aanwijzen. Twee knoppen met hetzelfde gevolg is een
   leugen in de interface -- de gebruiker denkt iets af te schermen wat hij niet
   afschermt. Elk van deze vijf wijst aantoonbaar een andere groep aan; wat ze
   betekenen staat in kern/wereld/profiel.js (magZien) en test/wereldprofiel.
   test.js zet ze naast elkaar op dezelfde vier mensen. */
const ZICHTBAARHEDEN = ['iedereen', 'contacten', 'zakelijk', 'genootschap', 'alleenik'];

module.exports = { ERBIJ, TRAP, MODI, LAGEN, ZICHTBAARHEDEN, vermogens, magVan, modiVoor, modusOpen, lagenVoor, zakelijkPro };

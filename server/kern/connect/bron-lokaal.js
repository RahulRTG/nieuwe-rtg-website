/* ============================================================================
   DE TWEEDE BRON -- wat er in de buurt gebeurt, en met opzet maximaal anders.

   WAAROM DEZE EN NIET NOG EEN KENNISBRON. Twee bronnen dragen geen contract als
   ze op elkaar lijken. Dat is dezelfde afweging die kern/knelpunt/aanvoer-
   opleiding.js maakte tegenover de werkbron, en die scripts/ritproef.js maakte
   toen hij de rit nam en niet de bezorging. De vraag die deze bron beantwoordt
   is: past ./ontdekking.js op iets dat structureel anders IS, of hebben we een
   leerstof-adapter gebouwd die toevallig een projectie heet?

   VIER DINGEN WAARIN HIJ VERSCHILT VAN DE LEERSTOFBRON, en geen ervan is
   cosmetisch:

     1. Er IS een lijst. Leerstof rekent 166 doelen uit een tabel; dit zijn
        BEWAARDE rijen die een mens heeft ingevoerd en morgen kan weghalen.
     2. Er IS een aanbieder. Een activiteit heeft een stad, een organisator en
        een plek waar je fysiek naartoe gaat. Leerstof is van niemand.
     3. Er IS schaarste. `plekVrij` kan nul zijn, en dan moet het aanbod dat
        ZEGGEN in plaats van te verdwijnen -- anders staat er iemand voor niets
        voor de deur (kern/rtfos/publiek.js zegt dat met zoveel woorden).
     4. Er IS een datum. Een leerdoel verloopt niet; een buurtmaaltijd van
        vorige week wel.

   DE BRON IS DE POSTERVEILIGE, EN DAT IS GEEN GEMAK MAAR DE GRENS.
   kern/rtfos/publiek.js is de enige RTF-bron zonder inlog, en zijn maat is
   "wat zou je op een poster in het buurthuis hangen". Daardoor kan hier per
   constructie geen hulpvraag, geen deelnemersnaam en geen bedrag uitkomen.
   Wie deze bron ooit vervangt door de kantoorlijst (kern/rtfos/activiteiten.js)
   haalt die grens weg zonder dat er iets aan dit bestand verandert -- en dat is
   precies waarom hij hier genoemd staat en niet alleen in de bedrading.

   DE PLAATS KOMT VAN DE MENS EN WORDT NERGENS UIT AFGELEID. Geen IP, geen
   postcode uit de kluis, geen eerdere reis. Geeft de mens geen plaats op, dan
   levert deze bron NIETS -- met een reden, en niet stil. Dat is dezelfde keuze
   als bij aanvoer-opleiding.js: liever leeg met een grond dan een greep die
   ergens anders over gaat. Een verkeerde stad is hier duurder dan bij leerstof,
   want iemand stapt erop op de fiets.
   ========================================================================== */
'use strict';

const ontdekking = require('./ontdekking');

const INGANG = '/apps/foundation/meedoen-ontdekken.html';
const HERKOMST = 'rtfos-publiek';
const PER_MOTOR = 4;

/* Welke activiteitsoorten hier een LEERkant hebben en welke niet. Dit is geen
   filter op wie mag komen -- alles komt langs -- maar het bepaalt welke
   werkwoorden een ontdekking verklaart. Een workshop biedt `doe`; een
   buurtmaaltijd biedt dat niet en zou met een doe-knop erop een belofte doen
   die er niet is. */
const DOE_SOORTEN = ['workshop', 'cursus', 'les', 'training', 'klus', 'sportdag', 'excursie'];

function maakLokalebron({ rtfos }) {
  /* HET WERKWOORD `verbind` STAAT ER ALTIJD BIJ EN `help` NOOIT. Naar een
     activiteit gaan brengt je bij mensen -- dat is verbinden. Helpen is iets
     wat je DAAR doet en wat hier niet kan worden toegezegd: een aanbod dat
     "help mee" belooft terwijl de organisator van niets weet, is precies de
     automatische handeling richting een derde die LIFE.md verbiedt. */
  const werkwoordenVan = (soort) => DOE_SOORTEN.includes(String(soort || '').toLowerCase())
    ? ['ontdek', 'doe', 'verbind'] : ['ontdek', 'verbind'];

  function lokaal(ctx) {
    const c = ctx || {};
    const plaats = String(c.plaats || '').trim();
    if (!plaats) return [];

    let r;
    try { r = rtfos && rtfos.publiek && rtfos.publiek.stad(plaats); }
    catch (e) { r = null; }
    /* Een stad die niet bestaat of nog niet open is, geeft hier `null` terug en
       geen uitzondering. De mixer meldt dat als een motor die keek en niets
       vond; de REDEN waarom hoort bij de route, want die kent de mens en deze
       laag niet. */
    if (!r || !r.ok || !Array.isArray(r.activiteiten)) return [];

    const rij = r.activiteiten.slice(0, PER_MOTOR).map(a => ({
      /* De sleutel draagt de stad, want twee steden kunnen dezelfde
         activiteitsnaam op dezelfde dag hebben. */
      id: plaats + ':' + String(a.naam || '') + ':' + String(a.wanneer || ''),
      onderwerp: String(a.soort || 'buurt'),
      soort: 'activiteit',
      titel: String(a.naam || '') + (a.wanneer ? ' -- ' + a.wanneer : ''),
      ingang: INGANG,
      herkomst: HERKOMST,
      /* `community` en niet `publiek`: dit gaat over wie het te zien krijgt in
         deze laag, en een buurtactiviteit hoort bij wie dat onderwerp volgt --
         niet op het open internet (./kring.js). */
      kring: 'community',
      werkwoorden: werkwoordenVan(a.soort),
      dektNiet: a.vol
        ? 'Deze activiteit is VOL. Hij staat er toch, want anders staat u er voor niets: vraag ernaar bij de afdeling.'
        : 'Aanmelden gebeurt bij de afdeling zelf; deze laag schrijft u nergens voor in.',
      /* Wat we WEL weten over de plek, en verder niets. Nooit ingevuld als de
         bron zwijgt -- zie ./ontdekking.js: `null` leest als "niet nagegaan". */
      zekerheid: a.plekVrij == null ? null
        : (a.vol ? 'Volgens de afdeling is deze activiteit vol.' : 'Volgens de afdeling is er nog plek (' + a.plekVrij + ').')
    }));
    return ontdekking.projecteerAlle(rij, HERKOMST).ontdekkingen;
  }

  return { lokaal };
}

module.exports = { maakLokalebron, INGANG, HERKOMST, PER_MOTOR, DOE_SOORTEN };

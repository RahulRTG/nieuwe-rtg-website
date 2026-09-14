/* ============================================================================
   DE WINKELKANT -- wat een LID van de App Store ziet, kiest en verleent.

   DE REGEL DIE DIT BESTAND STUURT: VRAGEN EN VERLENEN ZIJN TWEE DINGEN.

   Het manifest van een app VRAAGT machtigingen; het lid VERLEENT ze, stuk voor
   stuk, en kan er later een intrekken zonder de app te verwijderen. Daarom staan
   ze ook apart opgeslagen. Een winkel die installeren en toestemming tot een
   knop maakt, heeft geen toestemming maar een drempel gemaakt.

   TWEE DINGEN DIE HIER MET OPZET NIET GEBEUREN.

   Er staat geen beoordeling, geen sterrensysteem en geen ranglijst. CLAUDE.md
   verbiedt kunstmatige urgentie en ranglijsten buiten het potje; een winkel
   waarin apps elkaar verdringen, is precies zo'n mechaniek. Wat er wel staat is
   wat een app doet, van wie hij is, wat hij vraagt en wanneer hij is gekeurd.

   En er staat geen prijs. Alles in de App Store is voor leden inbegrepen bij de
   pas -- dezelfde regel als de bestaande App-Bibliotheek (kern/appbieb.js). Een
   betaald kanaal voor derden is een besluit van de eigenaar en geen veld dat
   hier vast alvast op nul staat; wat dat besluit inhoudt staat in APPSTORE.md
   onder "de open beslissing".
   ========================================================================== */
'use strict';

const { toonbaar, isMachtiging, ALLE_IDS, GEEN_CONTEXTBEPERKING } = require('./machtigingen');
const { versmalNamens } = require('../namens/versmalling');

const MAX_PER_LID = 60;

function maakWinkel(kern) {
  const { S, app, versie, eigen, nu, geld, noteer } = kern;
  const save = kern.save;
  /* WAT HET LID ZELF MAG (./gevermacht.js) -- de bron `geverEffectief` van de
     doorsnede hieronder. Zie de kop daar voor waarom hij een eigen bestand is. */
  const geverMacht = require('./gevermacht').maakGeverMacht(kern);

  /* ------------------------------------------------------------------------
     DE SNEDE, en hij staat hier één keer omdat `installeer` en `verleen`
     allebei verlenen. Zouden ze elk hun eigen rekensom houden, dan is de tweede
     die iemand later aanpast de plek waar ze uiteenlopen.

     DE WET KOMT UIT kern/namens/versmalling.js EN WORDT HIER NIET NAGEBOUWD:
     effectief = gevraagd ∩ geverEffectief ∩ beleid ∩ context. Wat deze functie
     doet is de VIER BRONNEN vullen met wat de App Store erover weet -- de
     gedeelde laag kent geen machtiging-id's en hoort die ook nooit te leren.

     ALLE VIER WORDEN OPGEGEVEN, ook `context` die hier niets tegenhoudt. Een
     weggelaten bron telt in die laag als LEEG en niet als alles, en het verschil
     tussen "gemeten en er is niets" en "niemand heeft gekeken" is daar het hele
     punt. Weglaten zou hier dus alles dichtzetten; stilzwijgend als "alles"
     lezen zou de wet slopen. Dus staat hij er, uitgesproken.
     ---------------------------------------------------------------------- */
  function snijd(key, getikt, manifestVraagt) {
    const gm = geverMacht.geverEffectief(key);
    const uit = versmalNamens({
      gevraagd: getikt,
      geverEffectief: gm.lijst,
      beleid: (Array.isArray(manifestVraagt) ? manifestVraagt : []).filter(isMachtiging),
      context: ALLE_IDS
    });
    return { uit, gm, contextGrond: GEEN_CONTEXTBEPERKING };
  }
  /* Een onbepaalbare snede is een STORING en geen weigering: er is niets mis met
     dit lid of deze app -- er is een bron niet aangesloten. 503 met de reden, en
     met opzet geen 403, want dat zou de gebruiker laten denken dat hij iets fout
     doet (CONTROLPLANE.md: `ONBEKEND` is geen `WEIGEREN`). */
  const storing = (uit) => ({ status: 503, error: uit.weigering.reden,
    code: uit.weigering.code, onbekend: uit.weigering.onbekend, stuk: uit.weigering.stuk,
    hoe: 'Dit is een gebrek aan onze kant. Probeer het later opnieuw; er is niets verleend en niets ingetrokken.' });
  /* De leeskant (bladeren, de kaart, mijn apps) staat in ./etalage.js; dit
     bestand is de SCHRIJFkant. Die twee uit elkaar houden is hier meer dan
     opruimen: alles wat hieronder staat verandert iets aan wat een lid heeft
     verleend of gekocht, en dat is precies de code die je apart wilt kunnen
     nalezen. */
  const E = require('./etalage')(kern);
  const { celPad, catalogus, mijn, prijsVan, heeftGekocht, rijVan, verleendeVan } = E;

  /* ------------------------------------------------------ verlenen en intrekken */


  /* Installeren MET de keuze erbij. `machtigingen` is wat het lid aanvinkt; alles
     wat de app niet vroeg valt weg, en alles wat het lid niet aanvinkte ook. Een
     lege lijst is een geldige keuze: de app werkt dan zonder. */
  /* TOT WANNEER: zie ./tijdelijk.js. De regel staat daar en niet hier, omdat
     dezelfde vraag ook bij het openen en op de winkelkaart wordt gesteld. */
  const { leesTot, isVerlopen } = require('./tijdelijk');
  const verlopen = (rij) => isVerlopen(rij && rij.tot, nu());

  function installeer(key, sleutel, gekozen, tot) {
    const a = app(sleutel);
    if (!a || !a.live) return { status: 404, error: 'Deze app staat niet in de App Store.' };
    const v = versie(a.live);
    if (!v || v.status !== 'gepubliceerd') return { status: 404, error: 'Deze app staat niet in de App Store.' };
    const rij = rijVan(key);
    const bestond = !!eigen(rij, sleutel);
    if (!bestond && Object.keys(rij).length >= MAX_PER_LID) {
      return { status: 400, error: 'Je hebt het maximum van ' + MAX_PER_LID + ' apps van derden bereikt; haal er eerst een weg.' };
    }
    /* EEN BETAALDE APP GAAT PAS OP HET STARTSCHERM ALS HIJ IS GEKOCHT, en dat
       wordt HIER gecontroleerd en niet in het scherm. Een winkel die op de
       knop vertrouwt, is een winkel waar de knop weg te laten is. 402 is de
       juiste code: dit is geen verbod maar een openstaande betaling, en de
       prijs gaat mee zodat het scherm de bon kan halen. */
    if (prijsVan(v) > 0 && !heeftGekocht(key, sleutel)) {
      return { status: 402, error: 'Deze app kost geld; koop hem eerst in de App Store.',
        prijsCenten: prijsVan(v), moetKopen: true };
    }
    const gevraagd = v.manifest.machtigingen;
    const getikt = [...new Set((Array.isArray(gekozen) ? gekozen : []).map(String).filter(isMachtiging))];
    const { uit: snede, gm } = snijd(key, getikt, gevraagd);
    if (!snede.ok) return storing(snede);
    const uniek = snede.effectief;
    const versmald = geverMacht.versmaldeVan(gm.weg, getikt);
    /* Het DOEL wordt meegeschreven en niet later opgezocht. Zou het bij de
       versie blijven staan, dan verandert waar een lid ja op zei zodra er een
       nieuwe versie komt -- en dat is precies het stille groeien dat de
       vergunningsdiff moet tegenhouden. */
    const gaf = {};
    for (const id of uniek) if ((v.manifest.doelen || {})[id]) gaf[id] = v.manifest.doelen[id];
    const t = leesTot(tot, nu());
    if (t && t.fout) return { status: 400, error: t.fout };
    const nieuw = !bestond;
    /* `versmald` is machtiging -> EISSLEUTEL en niet machtiging -> zin. De zin
       woont in ./machtigingen.js; hem hier meeschrijven zou dezelfde tekst op
       twee plekken zetten, en de opgeslagen kopie loopt achter zodra iemand de
       uitleg verbetert (LAT-regel 4). */
    rij[sleutel] = { machtigingen: uniek, doelen: gaf, at: nu(), versie: v.id, tot: t ? t.tot : null,
      versmald: Object.keys(versmald).length ? versmald : null };
    save();
    /* De tijdlijn schrijft mee en beslist niets (./tijdlijn.js). Wat het lid
       GAF gaat mee, want dat is waar de vraag later over gaat. */
    noteer(key, nieuw ? 'geinstalleerd' : 'verleend', sleutel, { gaf: uniek, doelen: gaf, versie: v.manifest.versie });
    const versmaldUit = geverMacht.toonVersmald(versmald);
    return { status: 200, ok: true, sleutel, verleend: toonbaar(uniek, gaf), vraagt: toonbaar(gevraagd, v.manifest.doelen),
      tot: t ? t.tot : null,
      /* WAT JE PROBEERDE TE GEVEN EN NIET KON. Dit staat er apart en niet als
         stilte: een lid dat een vinkje zet en het daarna niet terugziet, denkt
         dat hij zich vergist heeft. */
      versmald: versmaldUit.length ? versmaldUit : null,
      let: (t && t.tot ? 'Deze app staat er tot en met ' + t.tot + '. Daarna opent hij niet meer; wat hij voor je bewaarde blijft staan tot je de cel vernietigt. ' : '')
        + (versmaldUit.length
        ? 'Eén ding kon je niet geven: ' + versmaldUit.map(x => x.label.toLowerCase()).join(', ') +
          '. ' + versmaldUit.map(x => x.waarom).filter(Boolean).join(' ') + ' '
        : '')
        + (uniek.length < gevraagd.length
        ? 'Je hebt ' + uniek.length + ' van de ' + gevraagd.length + ' gevraagde machtigingen verleend. De app werkt; wat hij niet mag, krijgt hij niet.'
        : 'De app heeft wat hij vroeg. Je kunt elke machtiging later los intrekken zonder de app te verwijderen.') };
  }

  /* De machtigingen bijstellen zonder de app te verwijderen. Dit is de reden dat
     verlenen en installeren apart staan. */
  function verleen(key, sleutel, gekozen) {
    const huidig = verleendeVan(key, sleutel);
    if (!huidig) return { status: 404, error: 'Deze app staat niet op je startscherm.' };
    const a = app(sleutel); const v = a && a.live ? versie(a.live) : null;
    const gevraagd = v ? v.manifest.machtigingen : huidig.machtigingen;
    const getikt = [...new Set((Array.isArray(gekozen) ? gekozen : []).map(String).filter(isMachtiging))];
    /* DEZELFDE SNEDE ALS BIJ `installeer`, en dat is precies waarom hij in één
       functie staat. Hier is hij bovendien de plek waar de groei-lek wordt
       dichtgehouden: dit is de ENIGE weg waarlangs een bestaande verlening
       groter kan worden, en hij gaat opnieuw door de doorsnede. Een gever die
       later meer mag, verbreedt daarmee nooit vanzelf wat er al verleend is --
       er moet een mens op drukken, en dan wordt er opnieuw gesneden. */
    const { uit: snede, gm } = snijd(key, getikt, gevraagd);
    if (!snede.ok) return storing(snede);
    const uniek = snede.effectief;
    const versmald = geverMacht.versmaldeVan(gm.weg, getikt);
    const weg = huidig.machtigingen.filter(m => !uniek.includes(m));
    const oudeDoelen = huidig.doelen || {};
    const gaf = {};
    for (const id of uniek) {
      const d = (v && v.manifest.doelen ? v.manifest.doelen[id] : null) || oudeDoelen[id];
      if (d) gaf[id] = d;
    }
    huidig.machtigingen = uniek; huidig.doelen = gaf; huidig.at = nu();
    huidig.versmald = Object.keys(versmald).length ? versmald : null;
    save();
    noteer(key, weg.length ? 'teruggenomen' : 'verleend', sleutel, { gaf: uniek, weg, doelen: gaf });
    const versmaldUit = geverMacht.toonVersmald(versmald);
    return { status: 200, ok: true, verleend: toonbaar(uniek, gaf), ingetrokken: toonbaar(weg, oudeDoelen),
      versmald: versmaldUit.length ? versmaldUit : null };
  }

  /* Weggooien -- verwijderen, wissen en de cel vernietigen -- staat in
     ./opruim.js. Dat is de naad die hier inhoudelijk al lag: alles hierboven
     gaat over wat een lid GEEFT, alles daar over wat hij terugneemt. */
  const { verwijder, wisOpslag, vernietig } = require('./opruim')({ kern, S, eigen, rijVan, noteer, save });

  /* Wat er NAAR BUITEN gaat -- open() voor het lid en magCel() voor de
     celroute -- staat in ./uitgifte.js. Die twee veranderen niets; alles
     hierboven wel. De etalage gaat daar mee naar binnen in plaats van dat hij er
     opnieuw wordt gemaakt: twee etalages lezen dezelfde toestand en dat is de
     tweede plek met dezelfde waarheid die LAT-regel 4 verbiedt. */
  const { open, magCel } = require('./uitgifte').maakUitgifte(kern, E);

  return { catalogus, installeer, verleen, verwijder, wisOpslag, vernietig, mijn, open, magCel, verleendeVan, celPad, MAX_PER_LID, verlopen };
}

module.exports = { maakWinkel, MAX_PER_LID };

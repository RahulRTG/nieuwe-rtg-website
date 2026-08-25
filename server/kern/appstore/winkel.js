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

const { toonbaar, isMachtiging } = require('./machtigingen');

const MAX_PER_LID = 60;

function maakWinkel(kern) {
  const { S, app, versie, eigen, nu, geld, noteer } = kern;
  const save = kern.save;
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
  function installeer(key, sleutel, gekozen) {
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
    const lijst = (Array.isArray(gekozen) ? gekozen : []).map(String)
      .filter(m => isMachtiging(m) && gevraagd.includes(m));
    const uniek = [...new Set(lijst)];
    /* Het DOEL wordt meegeschreven en niet later opgezocht. Zou het bij de
       versie blijven staan, dan verandert waar een lid ja op zei zodra er een
       nieuwe versie komt -- en dat is precies het stille groeien dat de
       vergunningsdiff moet tegenhouden. */
    const gaf = {};
    for (const id of uniek) if ((v.manifest.doelen || {})[id]) gaf[id] = v.manifest.doelen[id];
    const nieuw = !bestond;
    rij[sleutel] = { machtigingen: uniek, doelen: gaf, at: nu(), versie: v.id };
    save();
    /* De tijdlijn schrijft mee en beslist niets (./tijdlijn.js). Wat het lid
       GAF gaat mee, want dat is waar de vraag later over gaat. */
    noteer(key, nieuw ? 'geinstalleerd' : 'verleend', sleutel, { gaf: uniek, doelen: gaf, versie: v.manifest.versie });
    return { status: 200, ok: true, sleutel, verleend: toonbaar(uniek, gaf), vraagt: toonbaar(gevraagd, v.manifest.doelen),
      let: uniek.length < gevraagd.length
        ? 'Je hebt ' + uniek.length + ' van de ' + gevraagd.length + ' gevraagde machtigingen verleend. De app werkt; wat hij niet mag, krijgt hij niet.'
        : 'De app heeft wat hij vroeg. Je kunt elke machtiging later los intrekken zonder de app te verwijderen.' };
  }

  /* De machtigingen bijstellen zonder de app te verwijderen. Dit is de reden dat
     verlenen en installeren apart staan. */
  function verleen(key, sleutel, gekozen) {
    const huidig = verleendeVan(key, sleutel);
    if (!huidig) return { status: 404, error: 'Deze app staat niet op je startscherm.' };
    const a = app(sleutel); const v = a && a.live ? versie(a.live) : null;
    const gevraagd = v ? v.manifest.machtigingen : huidig.machtigingen;
    const uniek = [...new Set((Array.isArray(gekozen) ? gekozen : []).map(String).filter(m => isMachtiging(m) && gevraagd.includes(m)))];
    const weg = huidig.machtigingen.filter(m => !uniek.includes(m));
    const oudeDoelen = huidig.doelen || {};
    const gaf = {};
    for (const id of uniek) {
      const d = (v && v.manifest.doelen ? v.manifest.doelen[id] : null) || oudeDoelen[id];
      if (d) gaf[id] = d;
    }
    huidig.machtigingen = uniek; huidig.doelen = gaf; huidig.at = nu();
    save();
    noteer(key, weg.length ? 'teruggenomen' : 'verleend', sleutel, { gaf: uniek, weg, doelen: gaf });
    return { status: 200, ok: true, verleend: toonbaar(uniek, gaf), ingetrokken: toonbaar(weg, oudeDoelen) };
  }

  /* Verwijderen haalt de app van je startscherm EN haalt elke machtiging weg. Wat
     de app voor jou had opgeslagen blijft staan -- dat is jouw inhoud, niet die
     van de app -- en is er weer als je hem terugzet. Wie het echt weg wil, gooit
     het weg met wisOpslag; dat staat als eigen handeling in de app-kaart. */
  function verwijder(key, sleutel) {
    const rij = rijVan(key);
    if (!eigen(rij, sleutel)) return { status: 404, error: 'Deze app staat niet op je startscherm.' };
    delete rij[String(sleutel)];
    save();
    noteer(key, 'verwijderd', sleutel, null);
    return { status: 200, ok: true, aantal: Object.keys(rij).length,
      let: 'De app staat niet meer op je startscherm en heeft geen enkele machtiging meer. Wat hij voor jou had opgeslagen staat er nog: dat is jouw inhoud. Wis het als je het echt weg wilt.' };
  }

  function wisOpslag(key, sleutel) {
    const bak = eigen(S().opslag, sleutel);
    if (bak && Object.prototype.hasOwnProperty.call(bak, String(key))) { delete bak[String(key)]; save(); }
    const bakjes = eigen(S().bakjes, String(key));
    const hadBerichten = !!(bakjes && Object.prototype.hasOwnProperty.call(bakjes, String(sleutel)));
    if (hadBerichten) { delete bakjes[String(sleutel)]; save(); }
    /* Dat er is GEWIST komt wel in de tijdlijn; wat er stond niet. De regel dat
       iets verwijderd is, is zelf geen persoonsgegeven -- en zonder die regel is
       "ik heb dat laten wissen" achteraf niet te staven. */
    noteer(key, 'gewist', sleutel, { sleutels: bak ? Object.keys(bak).length : 0, berichten: hadBerichten });
    return { status: 200, ok: true,
      let: 'Weg. Er bestaat geen tweede kopie bij de uitgever: een app in de cel heeft geen netwerk, dus er is nooit iets zijn kant op gegaan.' };
  }

  /* Wat er NAAR BUITEN gaat -- open() voor het lid en magCel() voor de
     celroute -- staat in ./uitgifte.js. Die twee veranderen niets; alles
     hierboven wel. De etalage gaat daar mee naar binnen in plaats van dat hij er
     opnieuw wordt gemaakt: twee etalages lezen dezelfde toestand en dat is de
     tweede plek met dezelfde waarheid die LAT-regel 4 verbiedt. */
  const { open, magCel } = require('./uitgifte').maakUitgifte(kern, E);

  return { catalogus, installeer, verleen, verwijder, wisOpslag, mijn, open, magCel, verleendeVan, celPad, MAX_PER_LID };
}

module.exports = { maakWinkel, MAX_PER_LID };

/* ============================================================================
   DE UITGIFTE -- wat er van een app werkelijk NAAR BUITEN gaat, en wanneer.

   Afgesplitst van ./winkel.js toen die over de 10 KB-keuringsgrens ging, en niet
   langs een willekeurige lijn. Alles in winkel.js VERANDERT iets aan wat een lid
   heeft verleend of gekocht; deze twee functies veranderen niets en beslissen
   alleen of er code uitgeleverd mag worden en welke. Dat is een andere vraag met
   een andere lezer: hier staat de code die je nakijkt als je wilt weten waarom
   een bundel in een browser terechtkwam.

   BEIDE FUNCTIES BEANTWOORDEN DEZELFDE VRAAG VOOR EEN ANDERE POORT.
     open()   de vraag van het LID: mag ik deze app openen, en wat mag hij dan?
     magCel() de vraag van de CELROUTE: mag deze hash van deze app het pand uit?

   Ze staan met opzet naast elkaar in een bestand: ze lezen dezelfde toestand,
   en als ze uit elkaar lopen kan er een bundel uitgeleverd worden die het lid
   niet mag openen -- of andersom. Twee bestanden zouden dat verschil
   makkelijker maken, niet moeilijker.
   ========================================================================== */
'use strict';

const { toonbaar } = require('./machtigingen');

/* Krijgt de ETALAGE mee in plaats van hem zelf te maken. Twee keer
   require('./etalage')(kern) geeft twee objecten die dezelfde toestand lezen, en
   dat is precies de tweede plek met dezelfde waarheid die LAT-regel 4 verbiedt. */
function maakUitgifte(kern, E) {
  const { app, versie, uitgever } = kern;
  const { celPad, prijsVan, heeftGekocht, verleendeVan } = E;

  /* Wat de celpagina nodig heeft om een app te openen. Hier en nergens anders
     wordt bepaald WELKE bundel er draait: de celroute leest dit niet uit de URL
     maar controleert hem hiertegen. */
  function open(key, sleutel) {
    const a = app(sleutel);
    if (!a || !a.live) return { status: 404, error: 'Deze app is niet (meer) beschikbaar.' };
    const v = versie(a.live);
    if (!v || v.status !== 'gepubliceerd') return { status: 404, error: 'Deze app is niet (meer) beschikbaar.' };
    const verleend = verleendeVan(key, sleutel);
    if (!verleend) return { status: 403, error: 'Zet deze app eerst in de App Store op je startscherm; dan kies je ook wat hij mag.' };
    /* En hij blijft dicht als de aanschaf er niet (meer) is. Dat kan: een lid
       dat een app verwijderde en terugzet, komt langs installeer(); een lid dat
       hem hield terwijl de prijs van nul naar iets ging, komt hier. */
    if (prijsVan(v) > 0 && !heeftGekocht(key, sleutel)) {
      return { status: 402, error: 'Deze app kost geld; koop hem in de App Store.', prijsCenten: prijsVan(v), moetKopen: true };
    }
    const u = uitgever(a.org);
    return { status: 200, ok: true, sleutel, hash: v.hash, start: celPad(sleutel, v.hash, v.manifest.start),
      naam: v.manifest.naam, versie: v.manifest.versie, taal: v.manifest.taal,
      uitgever: u ? { org: u.org, naam: u.naam } : null,
      verleend: toonbaar(verleend.machtigingen, verleend.doelen), machtigingen: verleend.machtigingen,
      doelen: verleend.doelen || {}, updateVraagt: E.diff(verleend, v),
      /* Wat de LIVE versie vraagt gaat ook mee, en alleen daarvoor: een
         weigering op de brug kan er dan bij zeggen of de app het niet vroeg of
         het lid het niet gaf. Het bepaalt nooit wat er mag -- dat doet
         `machtigingen` hierboven, en dat is wat het lid verleende. */
      vraagt: toonbaar(v.manifest.machtigingen, v.manifest.doelen) };
  }

  /* De poort van de celroute: mag deze hash van deze app uberhaupt uitgeleverd
     worden? Alleen de LIVE hash van een gepubliceerde app. Een ingetrokken versie
     is daarmee op hetzelfde moment onbereikbaar als hij uit de winkel valt -- dat
     is wat grens 5 in de praktijk betekent. */
  function magCel(sleutel, hash) {
    const a = app(sleutel);
    if (!a || !a.live) return false;
    const v = versie(a.live);
    return !!v && v.status === 'gepubliceerd' && v.hash === String(hash || '');
  }

  return { open, magCel };
}

module.exports = { maakUitgifte };

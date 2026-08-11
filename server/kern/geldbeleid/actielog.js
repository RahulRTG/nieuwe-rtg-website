/* Geldbeleid, deel "actielog": het geheugen dat elke handeling verantwoordt.

   Het log is APPEND-ONLY (GELD.md par. 5): dit bestand heeft met opzet GEEN
   functie die een regel herschrijft, verwijdert of het log leegt. Een log dat
   gewist kan worden verantwoordt niets -- dan is Rahul geen assistent maar een
   orakel, en orakels horen niet in een geldscherm. Wie hier ooit een
   wis-functie wil toevoegen, heeft de verkeerde vraag; de juiste vraag is
   waarom er iets in het log staat dat er niet had moeten staan.

   De ENIGE verwijdering staat in logSchrijf zelf: boven MAX_LOG gaat de
   oudste regel eruit, zodat de opslag per lid begrensd blijft (de grens hangt
   aan het log, het beschermde ding -- LAT.md regel 7).

   TWEE GATEN DIE DE KEURING VOND, en allebei ondermijnden ze precies wat
   hierboven staat:

   1. log() gaf de OPGESLAGEN rijen terug. De array was gekopieerd, de rijen
      niet, dus wie een teruggegeven rij muteerde herschreef het log. Er was
      geen aanroeper die dat deed, maar "niemand doet het nu" is geen grens.
      log() geeft nu kopieen, zoals zichtRegel en zichtPot in index.js.

   2. Het log was LEEG TE SPOELEN met gewone handelingen. Tweehonderdtien
      onschuldige schrijfacties (een pot hernoemen naar dezelfde naam is
      geldig en logt elke keer) duwden elke oudere regel eruit -- ook precies
      die regels die iemand kwijt zou willen. Een log dat je met ruis kunt
      wissen, verantwoordt niets.

      Vandaar twee dingen. Een handeling die NIETS verandert wordt niet meer
      gelogd (zie potZet in ./potten.js): een log hoort veranderingen te
      dragen, geen kliks. En de FIFO ontziet nu de regels van rahul: wat het
      systeem zelf deed is precies wat een mens niet moet kunnen wegdrukken,
      dus de oudste regel van het LID wijkt eerst. Blijven er alleen
      rahul-regels over, dan wijkt de oudste daarvan alsnog -- de opslag moet
      begrensd blijven, en een onbegrensd log is zijn eigen probleem. */

const MAX_LOG = 200;

module.exports = (ctx) => {
  const { save, nu, kijk, pak } = ctx;

  /* Onbekende of ontbrekende 'wie' wordt 'rahul', nooit 'lid': het log mag
     niet beweren dat het lid iets deed dat het lid niet deed. Andersom is
     onschuldiger -- Rahul iets te veel toeschrijven kost hooguit uitleg. */
  function logSchrijf(codenaam, regel) {
    const rec = pak(codenaam);
    if (!rec) return { status: 400, error: 'Geen codenaam.' };
    const r = regel && typeof regel === 'object' ? regel : {};
    const rij = { tijd: nu().toISOString(), wie: r.wie === 'lid' ? 'lid' : 'rahul',
      wat: String(r.wat || '').slice(0, 200), waarom: String(r.waarom || '').slice(0, 300),
      gegevens: (Array.isArray(r.gegevens) ? r.gegevens : []).slice(0, 12).map(g => String(g).slice(0, 200)) };
    rec.log.push(rij);
    snoei(rec.log);
    save();
    /* een KOPIE terug: de aanroeper hoort de opgeslagen rij niet in handen te
       krijgen, want dan is append-only een belofte en geen eigenschap */
    return { status: 200, ok: true, regel: kopie(rij) };
  }

  /* Boven de grens wijkt de oudste regel van het LID; alleen als die er niet
     meer zijn de oudste van rahul. Zo kan iemand het spoor van wat het
     systeem deed niet met eigen ruis wegduwen. */
  function snoei(rijen) {
    while (rijen.length > MAX_LOG) {
      const i = rijen.findIndex(r => r.wie === 'lid');
      rijen.splice(i === -1 ? 0 : i, 1);
    }
  }

  function kopie(r) {
    return { tijd: r.tijd, wie: r.wie, wat: r.wat, waarom: r.waarom, gegevens: r.gegevens.slice() };
  }

  /* Nieuwste eerst voor het scherm; de opslag blijft oudste-eerst zodat
     aanvullen goedkoop is. Kopieen, geen verwijzingen: meekijken is geen
     meeschrijven. */
  function log(codenaam) {
    const rec = kijk(codenaam);
    return rec ? rec.log.map(kopie).reverse() : [];
  }

  return { logSchrijf, log };
};

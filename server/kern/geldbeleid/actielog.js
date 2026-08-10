/* Geldbeleid, deel "actielog": het geheugen dat elke handeling verantwoordt.

   Het log is APPEND-ONLY (GELD.md par. 5): dit bestand heeft met opzet GEEN
   functie die een regel herschrijft, verwijdert of het log leegt. Een log dat
   gewist kan worden verantwoordt niets -- dan is Rahul geen assistent maar een
   orakel, en orakels horen niet in een geldscherm. Wie hier ooit een
   wis-functie wil toevoegen, heeft de verkeerde vraag; de juiste vraag is
   waarom er iets in het log staat dat er niet had moeten staan.

   De ENIGE verwijdering staat in logSchrijf zelf: boven MAX_LOG gaat de
   oudste regel eruit, zodat de opslag per lid begrensd blijft (de grens hangt
   aan het log, het beschermde ding -- LAT.md regel 7). */

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
    while (rec.log.length > MAX_LOG) rec.log.shift();
    save();
    return { status: 200, ok: true, regel: rij };
  }

  // nieuwste eerst voor het scherm; de opslag blijft oudste-eerst zodat aanvullen goedkoop is
  function log(codenaam) { const rec = kijk(codenaam); return rec ? rec.log.slice().reverse() : []; }

  return { logSchrijf, log };
};

/* RTG Link: HET BEHEER VAN JE EIGEN CAPABILITIES -- wat staat er nog van mij
   open, en hoe haal ik het weg (LINK.md par. 4, stap 6: "mijn koppelingen").

   ./cap.js gaat over het bezit en het uitgeven, ./cap-in.js over wie er aan mag
   komen. Dit is de derde kant: die van de mens die de code AFGAF en zich later
   afvraagt wat er nog van hem rondgaat.

   ZONDER TOKEN, EN DAT IS DE HELE OPZET. Een beheerscherm hoort geen tweede
   manier te zijn om aan een werkende code te komen. Elke openstaande capability
   draagt daarom naast zijn verwijzing (die in het ondertekende token zit en
   verzilvert) een eigen ID dat alleen beheert. Een gelekt id kan hooguit iets
   DICHTdoen van iemand die het al mocht -- dat is de goede kant om fout te gaan.

   INTREKKEN IS GEEN GESCHIEDENIS WISSEN (LINK.md par. 3.6). Wat je hier weghaalt
   is een code waar nog NIETS mee is gebeurd; daarom komt er ook geen bon van.
   Wat er wel mee is gebeurd, staat in ./bonnen.js en blijft staan. */
'use strict';

module.exports = ({ lees, bak, kaartVan, idVan, WEG }) => {

/* Wat er nu nog van mij openstaat. Alleen je eigen; de kaart mag mee, want
   zonder te zien WAT er openstaat valt er niets zinnigs in te trekken. */
function capOpenVan(uitgever) {
  const wie = idVan(uitgever);
  if (!wie) return [];
  return bak.openVan(wie).map(r => ({ id: r.id, handeling: r.handeling, kaart: kaartVan(r),
    tot: new Date(r.vervalt).toISOString() })).sort((a, b) => (a.tot < b.tot ? -1 : 1));
}

/* Intrekken zolang er niets is gebeurd. Twee ingangen, een besluit: met het
   TOKEN trek je de code in die op je scherm staat, met het ID die je in "mijn
   koppelingen" ziet staan. Wie hem intrekt moet in beide gevallen de uitgever
   zijn, en dat wordt in de collectietransactie van ./cap-bak.js gecontroleerd
   -- een code die net geclaimd wordt, is niet meer ongebruikt en trekt niet in. */
async function capTrek(uitgever, token, id) {
  let code = null;
  if (!id) {
    const t = lees(token);
    if (t.fout) return { status: 404, error: WEG };
    code = t.code;
  }
  const r = await bak.intrekken({ code, id: id ? String(id) : null, door: idVan(uitgever) });
  if (r.fout === 'niet-van-u') return { status: 403, error: 'Deze code is niet van u.' };
  if (r.fout) return { status: 404, error: WEG };
  return { status: 200, ok: true };
}

return { capOpenVan, capTrek };
};

/* Zuivere afgeleide berekeningen en projecties: geen gedeelde staat, alleen
   invoer -> uitvoer. Los-testbaar buiten de grote server.js. */

// Publieke projectie van een partner: nooit meer velden dan hier naar buiten.
function publicPartner(p) {
  return { code: p.code, name: p.name, type: p.type, handle: p.handle, hasStaff: !!p.staff };
}

// Drukte-factor per weekdag (voor omzetprognoses). 0 = zondag.
function weekdagFactor(d) {
  const wd = d.getDay();
  if (wd === 5 || wd === 6) return [1.25, 'vrijdag/zaterdag, druk'];
  if (wd === 0) return [1.0, 'zondag, gemiddeld'];
  return [0.85, 'doordeweeks, rustiger'];
}

// Een cv is pas bruikbaar om te solliciteren met naam, contact en minstens
// wat ervaring of vaardigheden.
function cvReady(cv) {
  return !!(cv && cv.name && cv.contact && ((cv.experience || []).length || (cv.skills || []).length));
}

/* DE BTW OP EEN BEDRAG, IN HELE CENTEN -- en dit is de enige afrondregel.

   WAAROM HIJ ER IS. Deze som stond op twee plekken met twee granulariteiten: de
   btw-aangifte (kern/fiscaal/btwtelling.js) rondde PER FACTUURREGEL af en telde
   op, de maandboekhouding telde eerst alle omzet van een categorie bij elkaar en
   splitste die som EEN keer. Bij gelijke tarieven valt dat samen; bij het
   Nederlandse 9% niet, en dan telde de aangifte 13251 cent waar de boekhouding
   13250 telde. Een aangifte die een cent van het grootboek afwijkt, laat een
   boekhouder het hele systeem wantrouwen.

   Dat was LAT.md regel 4 -- twee plekken die een waarheid vasthouden -- en de kop
   van `regelBtwCenten` beweerde zelfs dat hij "met opzet de enige plek" was.
   Sindsdien ronden beide kanten hier af, op dezelfde eenheid: de REGEL. Wie
   optelt, telt al afgeronde centen bij elkaar en rondt niet opnieuw.

   Negatieve bedragen (een tegenboeking) lopen door dezelfde som, zodat een
   terugstorting exact de centen terugneemt die de verkoop bijschreef. */
function btwCenten(bedrag, tariefPct) {
  const t = Number(tariefPct) || 0;
  const inclC = Math.round((Number(bedrag) || 0) * 100);
  return inclC - Math.round(inclC / (1 + t / 100));
}

// Splits een bruto (inclusief btw) bedrag in grondslag en btw bij een tarief in
// procenten. Op centen afgerond, net als elders in de boekhouding. Voor een
// optelling over meer dan een regel: tel `btwCenten` per regel op, want anders
// loopt de uitkomst een cent uit de pas met de aangifte (zie hierboven).
function btwSplit(omzet, tariefPct) {
  const t = Number(tariefPct) || 0;
  const cent = n => Math.round(n * 100) / 100;
  const bruto = cent(Number(omzet) || 0);
  const grondslag = cent(bruto / (1 + t / 100));
  return { omzet: bruto, tarief: t, grondslag, btw: cent(bruto - grondslag) };
}

module.exports = { publicPartner, weekdagFactor, cvReady, btwSplit, btwCenten };

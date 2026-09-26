/* RTG Pay, deelbestand "huis": de huisrekening van RTG. Verhuisd uit
   ./verzoeken.js (24 september 2026), dat over de 10 kB-grens van keuringsregel
   13 liep toen verzoekBetaal() een slot kreeg. De snede ligt op een onderwerp:
   daar staat geld tussen LEDEN, hier geld dat het stelsel verlaat of van buiten
   komt. Krijgt zijn gereedschap van ./verzoeken.js, dat het van kern/pay/index.js
   krijgt -- dezelfde vorm als ./tik.js. */
'use strict';
module.exports = ({ schoon, metIdem, zorgSaldo, boekAsync, rekLid, seintje, bestaatLid, MIN_CENTEN, MAX_CENTEN }) => {
  /* ---------- de huisrekening van RTG ----------
     RTG Assets rekent af met "RTG Treasury": servicefees en overnames komen
     binnen, terugkopen en herroepingen gaan eruit. Dat liep via stuur() met de
     codenaam 'RTG Treasury' -- en stuur weigert een onbekende codenaam met een
     404, want de huisrekening staat niet in de ledengids en kan daar ook niet in
     staan (die is voor leden). Alle vijf de aanroepen stonden in een lege catch,
     dus die 404 was onzichtbaar en de fee-ronde meldde toch dat er geind was.

     Een huisrekening hoort rechtstreeks in het grootboek, precies zoals
     'extern:vonk-rtg' (het RTG-deel van een Vonk-date) en 'extern:uitbetaald':
     buiten de gesloten wallet, want geld dat naar RTG gaat verlaat het stelsel
     en geld dat RTG bijlegt komt van buiten. */
  const REK_HUIS = 'extern:treasury';
  async function huisIn({ vanCodenaam, centen, oms, idem }) {
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };
    const van = schoon(vanCodenaam, 40);
    if (!van) return { status: 400, error: 'Van wie komt het?' };
    return metIdem(idem ? 'huisin:' + van + ':' + idem : null, 'huisin|' + van + '|' + c, async () => {
      const z = await zorgSaldo({ codenaam: van, centen: c, idem });
      if (z.error) return z;
      const b = await boekAsync({ van: rekLid(van), naar: REK_HUIS, centen: c, soort: 'huis', oms: oms || 'RTG Treasury' });
      if (b.error) return b;
      seintje(van);
      return { ok: true, centen: c, bijgeladen: z.bijgeladen, boeking: b.boeking.id };
    });
  }
  async function huisUit({ aanCodenaam, centen, oms, idem }) {
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };
    const aan = schoon(aanCodenaam, 40);
    if (!aan) return { status: 400, error: 'Aan wie gaat het?' };
    if (!(await bestaatLid(aan))) return { status: 404, error: 'Die codenaam kennen we niet.' };
    return metIdem(idem ? 'huisuit:' + aan + ':' + idem : null, 'huisuit|' + aan + '|' + c, async () => {
      const b = await boekAsync({ van: REK_HUIS, naar: rekLid(aan), centen: c, soort: 'huis', oms: oms || 'RTG Treasury' });
      if (b.error) return b;
      seintje(aan);
      return { ok: true, centen: c, boeking: b.boeking.id };
    });
  }
  return { huisIn, huisUit };
};

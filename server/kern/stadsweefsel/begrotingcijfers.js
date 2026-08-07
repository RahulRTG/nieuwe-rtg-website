/* RTG Stadsweefsel, deel "begrotingcijfers": wat een project KOSTTE en DEED.

   Afgesplitst uit ./begroting.js op de naad die er al lag: dat bestand gaat
   over de besluiten (een doel stellen, een project starten, werk eraan hangen,
   het afsluiten), dit bestand rekent alleen. Geen van deze vier functies
   schrijft iets weg; ze lezen de werkorders en de indicatorenlaag en zeggen
   wat daar staat.

   Dat is geen ordening om de ordening: de reken-kant is precies waar een
   stadsbegroting begint te liegen als je hem laat schatten. Vandaar dat
   `besteed()` alleen AFGERONDE werkorders meetelt en `effectVan()` zonder twee
   echte metingen "niet gemeten" zegt in plaats van nul.

   Krijgt dezelfde ctx-onderdelen als begroting.js, plus zijn opzoekers. */
module.exports = ({ ctx, nu, geo, ind, werk, doel }) => {
  // een indicator opvragen bij de indicatorenlaag; null als hij niet bestaat,
  // zodat een typefout een leeg veld geeft en geen verzonnen nulmeting
  function meetIndicator(id, gebied) {
    try {
      const r = ind.api.weefselIndicatoren({ dagen: 30, gebied });
      const i = (r.indicatoren || []).find(x => x.id === id);
      return i ? { indicator: id, label: i.label, eenheid: i.eenheid, beterIs: i.beterIs, waarde: i.waarde, at: nu() } : null;
    } catch (e) { ctx.stil('indicator', e); return null; }
  }

  /* Wat is er besteed? Uit de werkorders zelf, en alleen wat AF is: een order
     die nog loopt heeft nog geen kosten, en die alvast meetellen laat een
     project er duurder uitzien dan het is (of, erger, goedkoper als je de
     schatting invult). */
  function besteed(p) {
    let uit = 0, open = 0, klaar = 0, uren = 0;
    for (const id of p.werkorders) {
      const w = werk.order(id);
      if (!w) continue;
      if (w.status === 'klaar') { uit += w.kosten || 0; uren += w.uren || 0; klaar++; }
      else if (w.status !== 'geannuleerd') open++;
    }
    return { uitgegeven: Math.round(uit * 100) / 100, uren: Math.round(uren * 10) / 10, werkKlaar: klaar, werkOpen: open };
  }

  function publiek(p) {
    const b = besteed(p);
    const dl = doel(p.doelId);
    const over = Math.round((p.budget - b.uitgegeven) * 100) / 100;
    return { ...p, doel: dl ? dl.naam : null, plaats: p.gebied ? geo.label(p.gebied) : 'de hele stad',
      ...b, resterend: over,
      overschreden: over < 0,
      let_op: over < 0 ? 'Dit project staat ' + (-over) + ' euro boven zijn budget. Dat wordt gemeld, niet geblokkeerd: werk stilleggen is een besluit van een mens.' : null };
  }

  /* Het effect: nulmeting tegen eindmeting, met de richting van de indicator
     erbij. Zonder een van beide is er geen effect -- en dat staat er dan ook,
     in plaats van een nul die als "geen verbetering" leest. */
  function effectVan(p) {
    if (!p.nulmeting || !p.eindmeting || p.nulmeting.waarde == null || p.eindmeting.waarde == null)
      return { gemeten: false, reden: !p.indicator ? 'dit project koos geen indicator' : 'de indicator gaf in een van beide metingen geen waarde' };
    const van = p.nulmeting.waarde, naar = p.eindmeting.waarde;
    const beter = p.eindmeting.beterIs === 'lager' ? naar <= van : naar >= van;
    return { gemeten: true, indicator: p.indicator, label: p.eindmeting.label, eenheid: p.eindmeting.eenheid,
      van, naar, verschil: Math.round((naar - van) * 10) / 10, beter,
      perEuro: null,
      let_op: 'Dit is een verschil tussen twee metingen, geen bewijs van oorzaak: er gebeurde in dezelfde periode meer in de stad.' };
  }

  return { meetIndicator, besteed, publiek, effectVan };
};

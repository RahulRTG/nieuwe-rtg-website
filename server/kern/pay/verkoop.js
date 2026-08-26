/* RTG Pay, deelbestand "verkoop": een lid koopt iets van een partner, met
   INHOUDINGEN die meteen worden afgesplitst.

   WAAROM DIT IN DE GELDLAAG STAAT EN NIET BIJ DE WINKEL DIE HEM AANROEPT.
   Een winkel weet wat iets kost en wie het verkoopt; hoe geld beweegt weet
   alleen deze laag. De idempotentie, het bijladen van de wallet, de
   boekingsgrenzen en de dubbele boekhouding zitten hier, en een tweede plek die
   dat nadoet loopt er per definitie op achter (LAT-regel 4).

   HET PATROON IS DAT VAN kasInt: het BRUTO bedrag gaat naar de partner, en wat
   er af moet volgt als eigen regel in het grootboek. Zo ziet de ondernemer in
   zijn eigen boekingen precies wat er is binnengekomen en wat eraf ging, in
   plaats van een netto bedrag zonder uitleg.

   ALS EEN INHOUDING MISLUKT, GAAT ALLES TERUG. Dat is strenger dan kasInt doet
   met de betaaldienstkosten (die laat hij dan staan bij de ondernemer), en met
   reden: een inhouding is hier geen kostenpost maar afgedragen btw of een
   afdracht die aan iemand anders toebehoort. Half boeken zou een bedrag op de
   partnerrekening laten staan dat er niet hoort, en dat is precies het soort
   verschil dat pas bij de jaarrekening opvalt. Lukt ook de teruggang niet, dan
   staat het luid in het log met de boekingsreferentie erbij -- stil doorgaan
   mag hier niet (LAT-regel 5). */
module.exports = (ctx) => {
  const { save, rekLid, rekPartner, saldoVan, metIdem, boekAsync, zorgSaldo, seintje,
    MIN_CENTEN, MAX_CENTEN } = ctx;

  /* `inhoudingen` is [{ naar, centen, oms }]. Een inhouding van nul wordt
     overgeslagen en niet geboekt: het grootboek begint bij een cent, en een
     regel van nul zegt niets. */
  async function verkoop({ codenaam, naarPartner, brutoCenten, inhoudingen, soort, oms, ref, idem }) {
    const bruto = Math.round(Number(brutoCenten));
    if (!Number.isFinite(bruto) || bruto < MIN_CENTEN || bruto > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };
    if (!codenaam || !naarPartner) return { status: 400, error: 'Van en naar kloppen niet.' };
    const lijst = (Array.isArray(inhoudingen) ? inhoudingen : [])
      .map(i => ({ naar: String((i && i.naar) || ''), centen: Math.round(Number((i && i.centen) || 0)), oms: String((i && i.oms) || 'Inhouding').slice(0, 120) }))
      .filter(i => i.naar && i.centen > 0);
    const som = lijst.reduce((n, i) => n + i.centen, 0);
    if (som > bruto) return { status: 400, error: 'De inhoudingen zijn samen groter dan het bedrag.' };
    for (const i of lijst) if (!i.naar.startsWith('rtg:')) return { status: 400, error: 'Een inhouding gaat naar een rekening van RTG, nergens anders heen.' };

    return metIdem(idem ? 'verkoop:' + naarPartner + ':' + idem : null,
      'verkoop|' + codenaam + '|' + naarPartner + '|' + bruto + '|' + som, async () => {
        const z = await zorgSaldo({ codenaam, centen: bruto, idem });
        if (z.error) return z;
        const b = await boekAsync({ van: rekLid(codenaam), naar: rekPartner(naarPartner), centen: bruto,
          soort: soort || 'verkoop', oms: oms || 'Verkoop', ref: ref || null });
        if (b.error) return b;

        const gedaan = [];
        for (const i of lijst) {
          const r = await boekAsync({ van: rekPartner(naarPartner), naar: i.naar, centen: i.centen,
            soort: (soort || 'verkoop') + '-inhouding', oms: i.oms, ref: ref || null });
          if (!r.error) { gedaan.push(i); continue; }
          /* Terug met alles wat al is geboekt, en daarna de verkoop zelf. Wat
             hier niet lukt, gaat luid het log in: er staat dan een bedrag op een
             partnerrekening dat er niet hoort, en dat hoort een mens te zien. */
          for (const g of gedaan) {
            const t = await boekAsync({ van: g.naar, naar: rekPartner(naarPartner), centen: g.centen,
              soort: 'terug', oms: 'Inhouding teruggedraaid', ref: ref || null });
            if (t.error) console.warn('[pay] inhouding niet teruggedraaid, boeking ' + b.boeking.id + ': ' + t.error);
          }
          const t2 = await boekAsync({ van: rekPartner(naarPartner), naar: rekLid(codenaam), centen: bruto,
            soort: 'terug', oms: 'Verkoop teruggedraaid', ref: ref || null });
          if (t2.error) console.warn('[pay] verkoop niet teruggedraaid, boeking ' + b.boeking.id + ': ' + t2.error);
          return { status: r.status || 500, error: 'De verkoop is teruggedraaid: ' + r.error };
        }
        save();
        seintje(codenaam);
        return { ok: true, centen: bruto, ingehouden: som, netto: bruto - som,
          boekingId: b.boeking.id, inhoudingen: gedaan };
      });
  }

  /* DE TERUGGAVE, EN WAAROM HIJ UIT MEER DAN EEN POTJE KOMT.

     Dit was de plek waar de eerste opzet omviel, en de fout was leerzaam. Een
     lid betaalt BRUTO; de partner houdt daar maar een deel van over, want de
     btw en een eventuele afdracht zijn er meteen afgegaan. Wie dan het hele
     brutobedrag van de partnerrekening terugboekt, vraagt geld dat daar nooit
     heeft gestaan -- en dat gaat luid stuk met "Onvoldoende saldo", precies
     zoals het hoort.

     Een teruggave loopt daarom exact de weg van de verkoop terug: elk deel komt
     van de rekening waar het destijds heen ging. De optelsom is wat het lid
     krijgt, en die is per definitie het bruto van de bon.

     Kan de partner zijn deel niet missen -- hij heeft het al laten uitbetalen --
     dan gaat de teruggave NIET half door. Half terugbetalen is een tweede
     probleem bovenop het eerste; het kantoor hoort te zien dat er iets te
     verhalen valt en niet dat er iets half is gebeurd. */
  async function terugGave({ codenaam, vanPartner, partnerCenten, uitRtg, oms, ref, idem }) {
    const delen = [];
    const pc = Math.round(Number(partnerCenten) || 0);
    if (vanPartner && pc > 0) delen.push({ van: rekPartner(vanPartner), centen: pc });
    for (const r of (Array.isArray(uitRtg) ? uitRtg : [])) {
      const c = Math.round(Number((r && r.centen) || 0));
      const rek = String((r && r.rekening) || '');
      if (!rek.startsWith('rtg:')) return { status: 400, error: 'Een teruggave komt van een partner of van een rekening van RTG, nergens anders vandaan.' };
      if (c > 0) delen.push({ van: rek, centen: c });
    }
    const totaal = delen.reduce((n, x) => n + x.centen, 0);
    if (totaal < MIN_CENTEN || totaal > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };

    return metIdem(idem ? 'teruggave:' + (vanPartner || 'rtg') + ':' + idem : null,
      'teruggave|' + codenaam + '|' + (vanPartner || '') + '|' + totaal, async () => {
        /* Eerst kijken of ALLE delen er zijn, en pas daarna boeken. Zou de
           eerste boeking slagen en de tweede niet, dan staat er een halve
           teruggave in het grootboek. */
        for (const dl of delen) {
          if (!dl.van.startsWith('extern:') && saldoVan(dl.van) < dl.centen) {
            return { status: 402, error: 'Op ' + dl.van + ' staat niet genoeg om terug te betalen (' + dl.centen + ' cent nodig). Er is niets geboekt.' };
          }
        }
        const gedaan = [];
        for (const dl of delen) {
          const b = await boekAsync({ van: dl.van, naar: rekLid(codenaam), centen: dl.centen,
            soort: 'teruggave', oms: oms || 'Teruggave', ref: ref || null });
          if (b.error) {
            for (const g of gedaan) {
              const t = await boekAsync({ van: rekLid(codenaam), naar: g.van, centen: g.centen,
                soort: 'terug', oms: 'Teruggave teruggedraaid', ref: ref || null });
              if (t.error) console.warn('[pay] teruggave niet teruggedraaid (' + g.van + '): ' + t.error);
            }
            return { status: b.status || 500, error: 'De teruggave is teruggedraaid: ' + b.error };
          }
          gedaan.push(dl);
        }
        save();
        seintje(codenaam);
        return { ok: true, centen: totaal, delen: gedaan };
      });
  }

  return { verkoop, terugGave };
};

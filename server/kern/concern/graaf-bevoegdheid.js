/* CONCERN (deelmodule): BEVOEGDHEID -- wie mag tekenen, en wat raakt een
   verlopende vergunning.

   Afgesplitst van ./graaf.js toen die over de 10 kB ging. De naad loopt langs
   de vraag: daar staat WIE BEZIT (aandelen, belangen, UBO), hier WIE MAG
   (bestuur, volmacht, tekenlimiet). Dat zijn in een B.V. verschillende mensen,
   en dat is precies waarom het twee vragen zijn.

   ER WORDT NIETS TOEGEKEND EN NIETS GEBLOKKEERD. Dit is een leesvraag; de
   handeling zelf loopt langs de poort die haar bewaakt. */
'use strict';

module.exports = (ctx) => {
  const { entiteitVind, vestigingAlleVanEntiteit, tijdOpDatumVan, tijdVandaag,
    tijdVerlooptBinnen } = ctx;

  /* ---- WIE MAG DIT TEKENEN ----

     De vraag waar de graaf voor bestaat. Een bestuurder is bevoegd `alleen` of
     `gezamenlijk`, en kan een tekenlimiet dragen. Boven die limiet is hij niet
     bevoegd -- en dan hoort het antwoord niet "nee" te zijn maar "niet alleen,
     wel samen met", want dat is wat iemand op dat moment moet weten.

     Er wordt NIETS toegekend en niets geblokkeerd. Dit is een leesvraag; de
     handeling zelf loopt langs de poort die hem bewaakt. */
  function magTekenen(entiteitId, bedrag, op) {
    const d = op || tijdVandaag();
    const bestuur = (tijdOpDatumVan(entiteitId, 'bestuurder', d) || []).map(f => ({
      wie: f.sleutel, rol: f.waarde,
      bevoegd: (f.extra || {}).bevoegd || 'alleen',
      limiet: (f.extra || {}).tekenlimiet ?? null, van: f.van, tot: f.tot
    }));
    const volmachten = (tijdOpDatumVan(entiteitId, 'volmacht', d) || []).map(f => ({
      wie: f.sleutel, wat: f.waarde,
      limiet: (f.extra || {}).tekenlimiet ?? null, van: f.van, tot: f.tot
    }));
    const b = Number.isFinite(bedrag) ? bedrag : null;
    const past = (limiet) => b === null || limiet === null || limiet === undefined || b <= limiet;

    const alleen = bestuur.filter(x => x.bevoegd === 'alleen' && past(x.limiet))
      .concat(volmachten.filter(v => past(v.limiet)).map(v => ({ wie: v.wie, rol: 'gevolmachtigde', bevoegd: 'alleen', limiet: v.limiet })));
    const samen = bestuur.filter(x => x.bevoegd !== 'alleen' && past(x.limiet));
    const teLaag = bestuur.concat(volmachten).filter(x => !past(x.limiet));

    return { op: d, bedrag: b,
      alleen, samen,
      /* Gezamenlijk bevoegd met z'n eenen is niemand: dat hoort er te staan en
         niet stilzwijgend als "kan wel" te worden gelezen. */
      samenGenoeg: samen.length >= 2,
      teLaag: teLaag.map(x => ({ wie: x.wie, limiet: x.limiet })),
      uitleg: alleen.length ? 'Deze personen kunnen zelfstandig tekenen.'
        : (samen.length >= 2 ? 'Niemand kan alleen tekenen; twee gezamenlijk bevoegde bestuurders samen wel.'
          : 'Er is voor dit bedrag niemand bevoegd. Kijk naar de tekenlimieten of naar een volmacht.') };
  }

  /* WAT WORDT GERAAKT als een vergunning of registratie afloopt. Loopt van het
     feit naar de vestigingen en de zaken die eraan hangen -- dat is de vraag
     "welke locaties raakt dit", en die is zonder graaf niet te stellen. */
  function geraaktDoorVerloop(entiteitId, dagen) {
    const bijna = tijdVerlooptBinnen(entiteitId, dagen)
      .filter(f => ['vergunning', 'registratie', 'verzekering'].includes(f.soort));
    return bijna.map(f => {
      const ent = entiteitVind(f.entiteit);
      const vest = ent ? vestigingAlleVanEntiteit(ent.id).filter(v => !v.gesloten) : [];
      return { feit: f, entiteit: f.entiteit,
        raakt: { vestigingen: vest.map(v => ({ id: v.id, naam: v.naam })),
          zaken: vest.flatMap(v => v.units || []) } };
    });
  }

  return { concernMagTekenen: magTekenen, concernGeraaktDoorVerloop: geraaktDoorVerloop };
};

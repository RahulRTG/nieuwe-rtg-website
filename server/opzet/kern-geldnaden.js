/* DE GELDNADEN: waar Pay, de eigen bank en het fonds elkaar raken.

   Afgesplitst van ./kernlaag4b.js omdat dat deel over de 10 kB van
   keuringsregel 13 liep. De snede loopt langs een echte grens: in 4b worden de
   onderdelen GEMAAKT (bankregie, bevoegdheid, bank, reis, thuis, concern), hier
   worden ze aan elkaar GEKNOOPT -- de cutover-reconcile en de late binding van
   het fonds aan de bank. Dat werk kan pas als alles er staat, en het leest ook
   zo.

   HIJ HEET GEEN kernlaagX, EN DAT IS MET REDEN. server/server.js somt de lagen
   een voor een op en roept ze aan met (kern, hulp). Een bestand dat kernlaag
   heet maar een derde argument nodig heeft, hoort daar niet thuis -- dat is
   hier misgegaan: de eerste poging heette kernlaag4c.js, en dat bestand BESTOND
   AL (de drie kantoorkamers). Dit deel is geen laag maar een naad, en het wordt
   door 4b zelf aangeroepen. */
'use strict';

module.exports = (kern, hulp, { bankregie }) => {
const { db, save } = kern;
/* Uit dezelfde hulpbundel als 4b. `bankregie` komt apart binnen omdat hij in 4b
   wordt gemaakt en niet in hulp zit; hem hier opnieuw bouwen zou een tweede
   waarheid over de clearingmodus opleveren. */
const { fonds, betaal, log } = hulp;

/* Cutover-reconcile: draait de wallet in motor-modus (RTG_MOTOR_GELD=motor), dan
   is de Rust-motor de autoriteit -- neem bij het opstarten de saldi-spiegel over
   uit de motor-snapshot, zodat we altijd in lockstep starten (ook na een crash of
   nadat de motor los is bijgewerkt). No-op in de standaard schaduw-modus. */
if (kern.pay.geldModus === 'motor') {
  Promise.resolve(kern.pay.reconcileVanMotor())
    .then(r => {
      if (r && r.ok && !r.overgeslagen) log.info('motor-reconcile', { rekeningen: r.rekeningen, som: r.som });
      else if (r && r.error) log.warn('motor-reconcile mislukt', { fout: r.error });
    })
    .catch(e => log.warn('motor-reconcile uitzondering', { fout: e.message }));
}
// Zelfde herstart-reconcile voor het BANK-grootboek (tweede motor-ledger).
if (kern.bank.geldModus === 'motor') {
  Promise.resolve(kern.bank.reconcileVanMotor())
    .then(r => {
      if (r && r.ok && !r.overgeslagen) log.info('motor-reconcile bank', { rekeningen: r.rekeningen, som: r.som });
      else if (r && r.error) log.warn('motor-reconcile bank mislukt', { fout: r.error });
    })
    .catch(e => log.warn('motor-reconcile bank uitzondering', { fout: e.message }));
}
/* De RTFoundation-afdracht over de eigen rails: staat de knop effectief op
   "eigen" (en niet in nood), dan boekt de 30% als grootboekboeking van de
   reserve naar de foundation-tegenrekening. Anders geeft de naad null terug
   en volgt fonds.js gewoon de bestaande betaal-naad. Late binding, want het
   fonds is eerder gemount dan de bank. */
fonds.koppelBank(async ({ centen, referentie, oms }) => {
  const c = bankregie.bankClearing();
  if (c.modus !== 'eigen') return null;
  return kern.bank.boekAsync({ van: 'rtg:reserve', naar: 'extern:foundation', centen, soort: 'afdracht', oms, ref: referentie });
});

  /* DE RETOURSTROOM AAN DE GELDLAAG. kern/commerce wordt in kernlaag2b gebouwd,
     ver voor RTG Pay; de teruggave wordt hier aangereikt. Dit hoort in dit
     bestand en niet in kernlaag3: daar worden onderdelen GEMAAKT, hier worden ze
     GEKNOOPT -- en dit is een knoop.

     Er komt geen tweede geldweg bij. Dit is precies dezelfde terugGave die
     kern/appstore gebruikt, met haar idempotentie en haar alles-of-niets (een
     halve teruggave is een tweede probleem bovenop het eerste). Niet gekoppeld
     betekent dat een uitvoering WEIGERT met de reden; er gebeurt nooit
     stilletjes niets. */
  if (kern.commerce && kern.commerce.koppelPay && kern.pay && kern.pay.terugGave) {
    kern.commerce.koppelPay((o) => kern.pay.terugGave(o));
  }
};

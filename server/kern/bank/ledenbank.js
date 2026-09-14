/* RTG Bank, deel "ledenbank": de opt-in van een LID op de eigen bank.

   Los van ./rekeningen.js langs een naad in het onderwerp. Daar staat de
   mechaniek van een rekening -- IBAN uitgeven, openen, bevriezen, sluiten --
   en die geldt net zo goed voor een zaak als voor een lid. Hier staat de vraag
   die alleen een LID gesteld wordt: gaat de bank voor u open, en heeft u daar
   ja tegen gezegd? Dat is een instemming met voorwaarden, en het is sinds
   13 september 2026 het enige deel van de bank met een eigen duurzaamheidseis.

   Krijgt de gedeelde ctx van kern/bank/index.js, plus `rekeningOpen` en
   `rekeningenVanLid` uit ./rekeningen.js: de opt-in gebruikt ze, hij is er
   geen tweede kopie van. */
'use strict';

module.exports = (ctx, { open, vanLid }) => {
  const { db, save, nu, rekeningen, bankregie, metIdem } = ctx;
  /* ---------- de leden-bank: alleen live als de boardroom hem aan heeft, en
     iedereen krijgt zijn eigen rekening pas NA akkoord (opt-in). Zo geldt hetzelfde
     voor nieuwe leden als voor bestaande leden bij live gaan: bij het eerste bezoek
     een akkoordscherm, en op akkoord meteen een betaalrekening. ---------- */
  /* HET DOMEIN BLIJFT 'kern/bank/rekeningen' EN VERHUIST NIET MEE. De
     eigencollectie hangt de bak aan die naam; hem hernoemen naar dit bestand
     zou een NIEUWE, lege bak opleveren en elk bestaand akkoord onzichtbaar
     maken. Een bestandsnaam is geen datanaam. */
  const eigenBank = require('../eigencollectie')({ db, domein: 'kern/bank/rekeningen', bezit: { bankAkkoord: 'kaart' } });
  function akkoordStore() { return eigenBank.bak('bankAkkoord'); }
  function ledenOverzicht(codenaam) {
    const c = String(codenaam || '').trim();
    const mijn = vanLid(c);
    return { ok: true, online: bankregie.bankLedenAan(), akkoord: !!akkoordStore()[c],
      modus: bankregie.bankModus(), spaarrentePct: bankregie.bankSpaarrenteBp() / 100,
      rekeningen: mijn.rekeningen, totaalCenten: mijn.totaalCenten };
  }
  async function ledenAkkoord(codenaam, tier) {
    if (!bankregie.bankLedenAan()) return { status: 403, error: 'De RTG Bank is nog niet live voor leden.' };
    const c = String(codenaam || '').trim();
    if (!c) return { status: 400, error: 'Onbekend lid.' };
    const alHad = Object.values(rekeningen()).some(m => m.codenaam === c);
    /* HET AKKOORD ZELF WAS NIET DUURZAAM, de rekening eronder wel.

       Hier stond `store[c] = ...; save();` -- write-behind, buiten elke bundel.
       De reparatie van augustus zette het OPENEN duurzaam en liet de instemming
       staan, terwijl juist die juridisch iets betekent. Gemeten: onder
       `schrijf-verloren` gaf /api/bank/akkoord 200 terwijl er niets veranderde
       -- bij een lid dat AL een rekening had is open() niet eens aan de beurt,
       en dan was deze save() de enige schrijfactie.

       EIGEN SLEUTEL en geen gedeelde bundel met open(): twee idem-sleutels in
       elkaar schuiven laat een herhaling op de verkeerde grond dedupliceren.
       Twee commits, in de juiste volgorde -- eerst de instemming, dan de
       rekening; andersom krijgt een lid een rekening waar hij nooit ja tegen
       zei. */
    const vast = await metIdem('bankakkoord:' + c, 'bankakkoord|' + c, () => {
      const store = akkoordStore();
      store[c] = store[c] || nu();
      save();
      return { ok: true };
    });
    if (vast && vast.error) return vast;
    /* MET SLEUTEL: zonder loopt het werk buiten de duurzame commit (idem.js 94). */
    let rekening = null;
    if (!alHad) { const r = await open({ codenaam: c, soort: 'betaal', naam: 'RTG Betaalrekening', wie: 'lid', idem: 'akkoord-betaal' }); if (r.error) return r; rekening = r.rekening; }
    // de Business Pass krijgt er AUTOMATISCH een zakelijke rekening bij (gratis)
    let zakelijk = null;
    if (tier === 'business' && !Object.values(rekeningen()).some(m => m.codenaam === c && m.soort === 'zakelijk')) {
      const z = await open({ codenaam: c, soort: 'zakelijk', naam: 'RTG Zakelijke rekening', wie: 'lid', idem: 'akkoord-zakelijk' });
      if (!z.error) zakelijk = z.rekening;
    }
    return { ok: true, akkoord: true, rekening, zakelijk };
  }

  return { bankLedenOverzicht: ledenOverzicht, bankLedenAkkoord: ledenAkkoord };
};

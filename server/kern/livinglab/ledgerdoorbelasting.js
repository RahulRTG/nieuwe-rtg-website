/* ============================================================================
   MAG DE STICHTING DEZE REKENING KRIJGEN?

   Afgesplitst van ./ledger.js langs een echte naad: daar staat WAT er verbruikt
   is (de meter telt), hier of dat verbruik van de ene economische wereld naar de
   andere mag worden doorbelast (de firewall beslist). Twee vragen, twee bronnen,
   en wie ze in een functie houdt, laat op een dag een meetfout als een
   bevoegdheidsfout klinken of andersom.
   ========================================================================== */
'use strict';

module.exports = (economie) => {
  /* Twee vragen, en ze zijn niet dezelfde: mag de infrastructuurwereld deze
     wereld belasten (firewall), en past dit bedrag onder het plafond van die
     relatie. `magBelasten` doet ze allebei wanneer het bedrag meekomt. */
  function doorbelasting(centen) {
    const eco = economie();
    if (!eco) {
      return { van: null, naar: 'rtfoundation', bedragCenten: centen, toegestaan: false,
        besluit: { ok: false, code: 'geen-firewall', uitleg: 'De economielaag draait niet op deze server, dus is niet vast te stellen of deze kosten doorbelast mogen worden.' },
        staatBij: null,
        let: 'Niet vast te stellen. Zolang de firewall niet meedraait, staat hier geen doorbelasting -- ook geen nul.' };
    }
    const van = eco.INFRA_WERELD;
    const naar = 'rtfoundation';
    const besluit = eco.magBelasten({ van, naar, centen });
    return {
      van, naar, bedragCenten: centen,
      toegestaan: !!besluit.ok, besluit,
      /* WAT ER GEBEURT ALS HET NIET MAG, en dat hoort in het grootboek te staan
         en niet in een foutmelding: de kosten blijven dan bij RTG. Dat is een
         ANDER feit dan "de stichting betaalde het", en het verschil is precies
         waar een accountant naar kijkt. */
      staatBij: besluit.ok ? 'rtfoundation' : van,
      let: besluit.ok
        ? 'De stichting draagt deze kosten, op grond van: ' + (besluit.uitleg || 'een vastgelegde relatie') + '.'
        : 'Deze kosten staan bij RTG en zijn NIET doorbelast. ' + besluit.uitleg
          + (besluit.hoeWel ? ' ' + besluit.hoeWel : '')
    };
  }
  return doorbelasting;
};

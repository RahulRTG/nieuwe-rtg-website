/* Command, deel "beleidregister": de OPSLAGVORM van de beleidsregels.

   LEZEN MAG NIET SCHRIJVEN, en daar ging het mis. reg() zette de startregels in
   het vak zodra iemand ook maar een waarde OPVROEG. Op een leespad is dat een
   stille mutatie, en PostgreSQL weigert die terecht met PG_SAVE_ONTBREEKT (500)
   -- goed voor alle serverfouten op /api/supplier/backoffice in de 100M-ronde van
   9 september 2026. In sqlite bewaakt niets die grens, dus daar stond het jaren
   groen.

   Twee wegen met hetzelfde antwoord:
     regLees() / voorstellenLees()  leveren de regels ZONDER ze vast te leggen.
     reg()     / voorstellen()      leggen ze vast, en horen daarom alleen op een
                                    schrijfpad te staan -- elk daarvan eindigt
                                    met save().

   De startwaarden zijn geen gegevens maar een OPZET: ze staan in REGELS en zijn
   daaruit altijd opnieuw af te leiden. Ze hoeven dus niet te worden opgeslagen om
   te bestaan. */
'use strict';

module.exports = function maakBeleidRegister(V, REGELS) {
  const startRegel = (b) => ({ id: b.id, wat: b.wat, eenheid: b.eenheid, vierOgen: b.vierOgen, bereik: 'globaal',
    versies: [{ v: 1, waarde: b.waarde, at: null, door: 'startwaarde', reden: 'de regel zoals hij is opgezet' }] });

  /* Een KOPIE van de buitenste laag: wie hierin schrijft, schrijft in het niets,
     en dat is op een leespad precies de bedoeling. */
  function regLees() {
    const opgeslagen = V().commandBeleid || {};
    const r = Object.assign({}, opgeslagen);
    for (const b of REGELS) if (!r[b.id]) r[b.id] = startRegel(b);
    return r;
  }
  function voorstellenLees() {
    const v = V().commandVoorstellen;
    return Array.isArray(v) ? v : [];
  }
  function reg() {
    const v = V();
    if (!v.commandBeleid) v.commandBeleid = {};
    const r = v.commandBeleid;
    for (const b of REGELS) if (!r[b.id]) r[b.id] = startRegel(b);
    return r;
  }
  function voorstellen() {
    const v = V();
    if (!Array.isArray(v.commandVoorstellen)) v.commandVoorstellen = [];
    return v.commandVoorstellen;
  }
  return { startRegel, regLees, voorstellenLees, reg, voorstellen };
};

/* Métier (deelmodule): het beroepsregister doorzoeken.

   Apart gehouden omdat het een ander soort werk is dan het profiel zelf: dit
   leest over ALLE profielen heen, en dat is de plek waar een grens hoort. De
   lijst is begrensd (PAGINA), er komen nooit sleutels uit, en een leeg profiel
   is niemands zoekresultaat -- wie niets invulde, staat niet in de etalage. */
module.exports = ({ codenaamVan, metier, PAGINA }) => {
  /* Zoeken in het beroepsregister. Op vak, plaats of vaardigheid, en met
     "alleen wie open staat voor werk". Alleen profielen die iets ingevuld
     hebben: een leeg profiel is niemands zoekresultaat. */
  function zoek(opties, kijkerKey) {
    const m = metier.S();
    const o = opties || {};
    const vraag = String(o.zoek || '').trim().toLowerCase().slice(0, 60);
    const plaats = String(o.plaats || '').trim().toLowerCase().slice(0, 60);
    const treffers = [];
    for (const key of Object.keys(m.profiel)) {
      const p = m.profiel[key];
      if (!p || (!p.kop && !(p.rollen || []).length && !(p.vaardigheden || []).length)) continue;
      if (o.open && !p.open) continue;
      if (plaats && !String(p.plaats || '').toLowerCase().includes(plaats)) continue;
      if (vraag) {
        const hooi = [p.kop, p.over, ...(p.vaardigheden || []), ...(p.talen || []),
          ...(p.rollen || []).map(r => r.wat + ' ' + r.waar),
          ...metier.bewezenRollen(key).map(r => r.wat + ' ' + r.waar)].join(' ').toLowerCase();
        if (!hooi.includes(vraag)) continue;
      }
      treffers.push({ codenaam: codenaamVan(key), kop: p.kop || '', plaats: p.plaats || '',
        open: !!p.open, vaardigheden: (p.vaardigheden || []).slice(0, 6),
        bewezen: metier.bewezenRollen(key).length, ikZelf: key === kijkerKey });
    }
    const limiet = Math.min(PAGINA, Math.max(1, Number(o.limiet) || PAGINA));
    return { totaal: treffers.length, leden: treffers.slice(0, limiet) };
  }


  return { zoek };
};

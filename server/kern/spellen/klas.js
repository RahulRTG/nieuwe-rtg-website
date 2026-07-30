/* Spellen (deelmodule): klasgenoten als uitnodigingspad. Tieners (15 of
   jonger) zijn beschermd en dus onvindbaar via de codenaam-zoeker; hun
   klas is wel een echte, door school en ouders bevestigde kring. De server
   controleert hier zelf het klasgenootschap (zelfde klas in de schooldata),
   dus er valt niets te zoeken of te raden -- en er reizen alleen codenamen,
   nooit echte namen. Krijgt de gedeelde context een keer bij het opstarten
   vanuit kern/spellen.js. */
module.exports = (ctx) => {
  const { db, codenaamVan, isGeblokkeerd } = ctx;
  const HANDLE = /^rtf:([^:]+):(.+)$/;
  // alle klasgenoten van dit RTF-profiel, over al zijn klassen heen
  function klasgenotenVan(mij) {
    const m = HANDLE.exec(String(mij || ''));
    if (!m) return []; // alleen RTF-profielen zitten in een klas
    const klassen = (db.data.foundation || {}).klassen || {};
    const uit = new Map();
    for (const k of Object.values(klassen)) {
      const lln = k.leerlingen || [];
      if (!lln.some(l => l.gezinCode === m[1] && String(l.profielId) === m[2])) continue;
      for (const l of lln) {
        const handle = 'rtf:' + l.gezinCode + ':' + l.profielId;
        if (handle === mij || uit.has(handle)) continue;
        uit.set(handle, { key: handle, codenaam: codenaamVan(handle), klas: k.naam });
      }
    }
    return [...uit.values()];
  }
  // de kieslijst voor het uitnodigen (blokkades gelden gewoon)
  function spelKlasgenoten(mij) {
    return { status: 200, klasgenoten: klasgenotenVan(mij).filter(kg => !isGeblokkeerd(mij, kg.key)).slice(0, 60) };
  }
  return { klasgenotenVan, spelKlasgenoten };
};

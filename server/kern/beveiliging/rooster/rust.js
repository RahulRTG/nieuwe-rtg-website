/* Beveiliging-rooster (deelmodule): de rustregel tussen twee diensten van
   dezelfde bewaker. Apart gezet omdat planning.js tegen de 10 kB-grens liep;
   planning (zetDienst) en aanvragen (planAuto) lezen hem allebei. */
module.exports = ({ shiftVan, diensten, guardNaam }) => {
  /* RUST OVER DE DATUMGRENS. De rustregel keek alleen binnen dezelfde
     kalenderdatum, dus een bewaker die de nacht draaide (23:00-07:00) kon om
     07:00 op de dagdienst worden gezet (ARBEID.md par. 4 punt 5). Nu rekent hij
     met de echte tijden: tussen twee diensten van dezelfde bewaker zit minstens
     MIN_RUST_UUR, of ze nu op dezelfde datum staan of op de dag ervoor of erna.
     Elf uur is de dagelijkse rust uit de Arbeidstijdenwet, en binnen een dag
     geeft hij exact de oude regel (geen twee diensten op een dag). */
  const MIN_RUST_UUR = 11;
  const DAG_MIN = 24 * 60;
  const dagIndex = (datum) => Math.round(Date.parse(datum + 'T00:00:00Z') / 86400000);
  function interval(datum, shiftId) {
    const sh = shiftVan(shiftId);
    if (!sh || !Number.isFinite(sh.van) || !Number.isFinite(sh.tot)) return null;
    const basis = dagIndex(datum) * DAG_MIN;
    return { van: basis + sh.van, tot: basis + sh.tot };
  }
  function rustBotsing(s, gid, datum, shiftId) {
    const nieuw = interval(datum, shiftId);
    if (!nieuw) return null;
    const dag = dagIndex(datum);
    for (const d of diensten()) {
      if (d.supplierCode !== s.code || d.guardId !== gid || d.status === 'geannuleerd') continue;
      if (Math.abs(dagIndex(d.datum) - dag) > 1) continue;
      const oud = interval(d.datum, d.shiftId);
      if (!oud) continue;
      const tussen = nieuw.van >= oud.tot ? nieuw.van - oud.tot : oud.van >= nieuw.tot ? oud.van - nieuw.tot : -1;
      if (tussen < MIN_RUST_UUR * 60) {
        const sh = shiftVan(d.shiftId);
        return guardNaam(s, gid) + ' heeft dan geen ' + MIN_RUST_UUR + ' uur rust: ' +
          (sh ? sh.naam.split(' ')[0].toLowerCase() : d.shiftId) + 'dienst op ' + d.datum + '.';
      }
    }
    return null;
  }
  return { rustBotsing, MIN_RUST_UUR };
};

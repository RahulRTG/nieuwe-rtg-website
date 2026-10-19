/* RTG Office: VERWIJDEREN MET BEWAARTERMIJN EN SPOOR.

   Tot 19 oktober 2026 wiste `weg` hard. De bewaartermijn uit het beheer
   (standaard zeven jaar, art. 52 AWR) telde niet, en het auditspoor, dat in
   het document zelf woont, verdween mee.

   Nu verdwijnt een document uit de drive, maar niet uit het bewaarde:
   - binnen de termijn blijft het met inhoud in `officeBewaard` staan;
   - daarna, of bij termijn "geen", blijft alleen de kop en het spoor over.

   Niemand leest `officeBewaard` via de gewone drive. Het is een bewaarplicht,
   geen prullenbak die iets terugzet. */
'use strict';

const JAREN = { geen: 0, '1jaar': 1, '3jaar': 3, '7jaar': 7, permanent: Infinity };

function bewaarTot(d) {
  const termijn = (d.beheer && d.beheer.bewaartermijn) || '7jaar';
  const jaren = Object.prototype.hasOwnProperty.call(JAREN, termijn) ? JAREN[termijn] : 7;
  if (jaren === Infinity) return 'permanent';
  if (!jaren) return null;
  const t = new Date(Date.parse(d.gewijzigd || d.gemaakt) || Date.now());
  t.setUTCFullYear(t.getUTCFullYear() + jaren);
  return t.toISOString();
}

module.exports = function maakWeg(state, basis) {
  const { save } = state;
  const { lijsten, docMet, schrijfAudit, nu, eigen } = basis;

  function weg(key, did) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (d.key !== key) return { status: 403, error: 'Alleen de eigenaar kan verwijderen.' };
    schrijfAudit(d, key, 'verwijderd');
    const tot = bewaarTot(d);
    const binnen = tot === 'permanent' || (tot && Date.parse(tot) > Date.now());
    const antwoorden = eigen.kijk('officeAntwoorden')[d.id];
    const bak = eigen.bak('officeBewaard');
    bak[d.id] = binnen
      ? { id: d.id, verwijderd: nu(), bewaarTot: tot, doc: d, antwoorden: antwoorden || undefined }
      : { id: d.id, verwijderd: nu(), titel: d.titel, soort: d.soort, key: d.key, audit: d.audit };
    delete lijsten()[d.id];
    delete eigen.kijk('officeAntwoorden')[d.id];
    save();
    return { status: 200, ok: true, bewaard: !!binnen, bewaarTot: binnen ? tot : null };
  }

  return { officeWeg: weg };
};

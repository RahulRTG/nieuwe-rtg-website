/* Foundation OS, deel "vrijwilligerportaal-kantoor": de andere kant van de deur.

   TWEE HANDELINGEN VAN DE COORDINATOR, en ze zijn allebei bewust een eigen
   besluit met een eigen auditregel:

   1. DE CODE UITGEVEN. Daarmee kan iemand van buiten in het systeem kijken --
      alleen naar zijn eigen planning en uren, maar toch. Dat hoort een moment
      te zijn waarop iemand ja zegt, en geen bijvangst van het aanmaken van een
      rij in het register. De code wordt persoonlijk overhandigd; er staan geen
      contactgegevens achter, juist omdat een code wordt meegelezen.

   2. DE GEMELDE UREN BEVESTIGEN. Uren die een vrijwilliger zelf opgeeft, komen
      binnen als MELDING en tellen pas mee als de coordinator ze bevestigt. Dat
      is geen wantrouwen maar hetzelfde vierogenprincipe als bij geld: uren
      dragen het jaarverslag, de subsidieverantwoording en het cijfer "kosten
      per geholpen persoon". Een getal dat niemand heeft gezien, draagt niets.

   Afgesplitst uit vrijwilligerportaal.js op de 10 KB van keuringsregel 13. */

module.exports = (ctx, eigen) => {
  const { code, S, audit, wie, poort, save } = ctx;
  const { vindCode, urenVan } = eigen;

  /* ---------- de kantoorkant: de code uitgeven en de gemelde uren ---------- */
  function codeVoor(req, id) {
    const v = S().vrijwilligers.find(x => x.id === String(id || ''));
    if (!v) return { status: 404, error: 'Deze vrijwilliger staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, v.stad, 'vrijwilliger.beheren', 'volunteer_management');
    if (!g.ok) return g;
    if (!v.code) { v.code = code('RTFV'); save(); }
    audit(w.key, 'vrijwilliger.code', v.naam, 'code getoond');
    return { ok: true, code: v.code,
      melding: 'Geef deze code persoonlijk aan ' + v.naam + '. Er staan geen contactgegevens achter, wel zijn planning en uren.' };
  }

  function bevestigUren(req, id, meldingId) {
    const v = S().vrijwilligers.find(x => x.id === String(id || ''));
    if (!v) return { status: 404, error: 'Deze vrijwilliger staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, v.stad, 'vrijwilliger.beheren', 'volunteer_management');
    if (!g.ok) return g;
    const m = (v.gemeldeUren || []).find(x => x.id === String(meldingId || ''));
    if (!m) return { status: 404, error: 'Deze urenmelding bestaat niet (meer).' };
    if (!Array.isArray(v.uren)) v.uren = [];
    v.uren.push({ id: m.id, projectId: m.projectId, uren: m.uren, datum: m.datum, km: m.km });
    v.gemeldeUren = v.gemeldeUren.filter(x => x.id !== m.id);
    audit(w.key, 'vrijwilliger.uren-bevestigd', v.naam, m.uren + ' uur op ' + m.datum);
    save();
    return { ok: true, urenTotaal: Math.round(urenVan(v) * 10) / 10, open: v.gemeldeUren.length };
  }

  return { codeVoor, bevestigUren };
};

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
  const { S, audit, wie, poort, wieIn, poortIn, save, codelevenscyclus } = ctx;
  const { urenVan, DOEL, SOORT, SCOPE } = eigen;

  const opties = b => ({
    geldig_dagen: b && (b.geldig_dagen || b.geldigDagen),
    max_gebruik: b && (b.max_gebruik || b.maxGebruik)
  });
  const invoer = (w, v, b) => Object.assign({
    prefix: 'RTFV', issuer: w.key, doel: DOEL, scope: Object.values(SCOPE),
    onderwerp: { soort: SOORT, id: v.id }
  }, opties(b));

  function deur(req, id) {
    const v = S().vrijwilligers.find(x => x.id === String(id || ''));
    if (!v) return { fout: { status: 404, error: 'Deze vrijwilliger staat niet in het register.' } };
    const w = wie(req);
    const g = poort(w, v.stad, 'vrijwilliger.beheren', 'volunteer_management');
    return g.ok ? { v, w } : { fout: g };
  }
  function deurIn(req, id, staat) {
    const v = ((staat && staat.vrijwilligers) || []).find(x => x.id === String(id || ''));
    if (!v) return { fout: { status: 404, error: 'Deze vrijwilliger staat niet in het register.' } };
    const w = wieIn(req, staat);
    const g = poortIn(w, v.stad, 'vrijwilliger.beheren', 'volunteer_management', staat);
    return g.ok ? { v, w } : { fout: g };
  }

  /* ---------- de kantoorkant: de code uitgeven en de gemelde uren ---------- */
  function codeVoor(req, id, b) {
    const vooraf = deur(req, id);
    if (vooraf.fout) return vooraf.fout;
    if (vooraf.v.persoonscode_id) {
      return { status: 409, error: 'Er is al een uitgegeven code. Gebruik roteren om een nieuwe code uit te geven en de oude direct te sluiten.' };
    }
    return codelevenscyclus.transactie(tx => {
      const staat = tx.staat || S();
      const d = deurIn(req, id, staat);
      if (d.fout) return d.fout;
      const v = d.v;
      if (v.persoonscode_id) return { status: 409, error: 'Er is intussen al een code uitgegeven. Roteer die code.' };
      delete v.code;
      const r = tx.uitgeven(invoer(d.w, v, b));
      if (!r.ok) return r;
      v.persoonscode_id = r.toegang.id;
      audit(d.w.key, 'vrijwilliger.code-uitgegeven', v.naam,
        'rotatie 1; vervalt ' + r.toegang.expires_at, staat);
      return { ok: true, code: r.code, toegang: r.toegang,
        melding: 'Geef deze code persoonlijk aan ' + v.naam + '. Er staan geen contactgegevens achter, wel zijn planning en uren.' };
    });
  }

  function codeIntrekken(req, id, reden) {
    const vooraf = deur(req, id);
    if (vooraf.fout) return vooraf.fout;
    return codelevenscyclus.transactie(tx => {
      const staat = tx.staat || S();
      const d = deurIn(req, id, staat);
      if (d.fout) return d.fout;
      const v = d.v;
      let toegang = null;
      if (v.persoonscode_id) {
        const r = tx.intrekken(v.persoonscode_id, d.w.key, reden);
        if (!r.ok) return r;
        toegang = r.toegang;
      }
      delete v.code;
      audit(d.w.key, 'vrijwilliger.code-ingetrokken', v.naam, String(reden || 'geen reden'), staat);
      return { ok: true, ingetrokken: true, toegang };
    });
  }

  function codeRoteren(req, id, b) {
    const vooraf = deur(req, id);
    if (vooraf.fout) return vooraf.fout;
    return codelevenscyclus.transactie(tx => {
      const staat = tx.staat || S();
      const d = deurIn(req, id, staat);
      if (d.fout) return d.fout;
      const v = d.v;
      const r = v.persoonscode_id
        ? tx.roteer(v.persoonscode_id, Object.assign({ prefix: 'RTFV', issuer: d.w.key,
          reden: b && b.reden }, opties(b)))
        : tx.uitgeven(invoer(d.w, v, b));
      if (!r.ok) return r;
      delete v.code;
      v.persoonscode_id = r.toegang.id;
      audit(d.w.key, 'vrijwilliger.code-geroteerd', v.naam, 'rotatie ' + r.toegang.rotatie, staat);
      return { ok: true, code: r.code, toegang: r.toegang,
        melding: 'De vorige code is direct gesloten. Geef deze nieuwe code persoonlijk aan ' + v.naam + '.' };
    });
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

  return { codeVoor, codeIntrekken, codeRoteren, bevestigUren };
};

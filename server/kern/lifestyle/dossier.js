/* Lifestyle, deelbestand "dossier": het Bezittingenregister (family-office
   light, met attentiepunten voor verzekering, taxatie en onderhoud) en
   Gezondheid & welzijn (afspraken + prive-dossier). Krijgt de gedeelde ctx
   van ./index.js. */
module.exports = (ctx) => {
  const { save, nu, rid, schoon, vandaag, isDatum, L } = ctx;

  /* ================= Bezittingenregister ================= */
  const SOORTEN = ['vastgoed', 'voertuig', 'vaartuig', 'kunst', 'horloge', 'sieraad', 'overig'];
  function bezitZet(key, body) {
    const naam = schoon(body.naam, 100);
    if (!naam) return { status: 400, error: 'Geef het object een naam.' };
    const l = L(key);
    const rec = {
      soort: SOORTEN.includes(body.soort) ? body.soort : 'overig', naam,
      waarde: Math.max(0, Math.min(1e11, Math.round(Number(body.waarde) || 0))),
      verzekeraar: schoon(body.verzekeraar, 80), polis: schoon(body.polis, 60),
      verzekerdTot: isDatum(body.verzekerdTot) ? body.verzekerdTot : '',
      taxatieOp: isDatum(body.taxatieOp) ? body.taxatieOp : '',
      onderhoudOp: isDatum(body.onderhoudOp) ? body.onderhoudOp : '',
      notitie: schoon(body.notitie, 300)
    };
    if (body.id) {
      const b = l.bezittingen.find(x => x.id === body.id);
      if (!b) return { status: 404, error: 'Dit object staat niet in uw register.' };
      Object.assign(b, rec); save();
      return { status: 200, ok: true, bezit: b };
    }
    if (l.bezittingen.length >= 300) return { status: 400, error: 'Uw register is vol.' };
    const b = Object.assign({ id: rid(), at: nu() }, rec);
    l.bezittingen.push(b); save();
    return { status: 200, ok: true, bezit: b };
  }
  function bezitWeg(key, id) {
    const l = L(key);
    l.bezittingen = l.bezittingen.filter(x => x.id !== id); save();
    return { status: 200, ok: true };
  }
  // attentiepunten: wat verloopt of nadert (verzekering, taxatie, onderhoud)
  function attenties(l) {
    const t = vandaag(), grens = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const uit = [];
    for (const b of l.bezittingen) {
      if (b.verzekerdTot && b.verzekerdTot <= grens) uit.push({ id: b.id, naam: b.naam, soort: 'verzekering', datum: b.verzekerdTot, verlopen: b.verzekerdTot < t });
      if (b.taxatieOp && b.taxatieOp <= grens) uit.push({ id: b.id, naam: b.naam, soort: 'taxatie', datum: b.taxatieOp, verlopen: b.taxatieOp < t });
      if (b.onderhoudOp && b.onderhoudOp <= grens) uit.push({ id: b.id, naam: b.naam, soort: 'onderhoud', datum: b.onderhoudOp, verlopen: b.onderhoudOp < t });
    }
    return uit.sort((a, b) => a.datum.localeCompare(b.datum));
  }
  function bezittingen(key) {
    const l = L(key);
    const lijst = l.bezittingen.slice().sort((a, b) => b.waarde - a.waarde);
    return { status: 200, bezittingen: lijst, totaalWaarde: lijst.reduce((s, b) => s + b.waarde, 0), attenties: attenties(l) };
  }

  /* ================= Gezondheid & welzijn (prive) ================= */
  function gzAfspraak(key, body) {
    const wat = schoon(body.wat, 100);
    if (!wat) return { status: 400, error: 'Wat voor afspraak betreft het?' };
    if (!isDatum(body.datum)) return { status: 400, error: 'Kies een datum.' };
    const l = L(key);
    if (l.afspraken.length >= 200) return { status: 400, error: 'Er staan al veel afspraken.' };
    const a = { id: rid(), wat, datum: body.datum, tijd: /^\d{2}:\d{2}$/.test(body.tijd || '') ? body.tijd : '',
      specialist: schoon(body.specialist, 80), waar: schoon(body.waar, 100), at: nu() };
    l.afspraken.push(a); save();
    return { status: 200, ok: true, afspraak: a };
  }
  function gzAfspraakWeg(key, id) { const l = L(key); l.afspraken = l.afspraken.filter(a => a.id !== id); save(); return { status: 200, ok: true }; }
  function gzDossier(key, body) {
    const titel = schoon(body.titel, 100);
    if (!titel) return { status: 400, error: 'Geef de notitie een titel.' };
    const l = L(key);
    if (l.dossier.length >= 200) l.dossier.shift();
    const n = { id: rid(), titel, tekst: schoon(body.tekst, 2000), at: nu() };
    l.dossier.unshift(n); save();
    return { status: 200, ok: true, notitie: n };
  }
  function gzDossierWeg(key, id) { const l = L(key); l.dossier = l.dossier.filter(n => n.id !== id); save(); return { status: 200, ok: true }; }
  function gezondheid(key) {
    const l = L(key), t = vandaag();
    const afspraken = l.afspraken.map(a => ({ ...a, voorbij: a.datum < t,
      dagenTot: Math.round((new Date(a.datum + 'T12:00') - new Date(t + 'T12:00')) / 86400000) }))
      .sort((a, b) => (a.datum + (a.tijd || '99:99')).localeCompare(b.datum + (b.tijd || '99:99')));
    return { status: 200, afspraken, volgende: afspraken.find(a => !a.voorbij) || null, dossier: l.dossier };
  }

  return { bezitZet, bezitWeg, bezittingen, BEZIT_SOORTEN: SOORTEN,
    gzAfspraak, gzAfspraakWeg, gzDossier, gzDossierWeg, gezondheid };
};

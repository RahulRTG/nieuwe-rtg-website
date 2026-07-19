/* Overheid-domein "regio": de regionale laag naast het rijk. Provincie levert
   subsidieregelingen (aanvragen gecapt op het maximum, met een besluit van de
   ambtenaar). Waterschap kent de jaarlijkse waterschapsbelasting (verschijnt
   automatisch, betalen loopt via de geld-drempel omdat het pad "betaal" bevat) en
   de meldingen aan het waterschap met hun afhandeling. Krijgt de gedeelde ctx van
   kern/overheid/index.js. */
module.exports = (ctx) => {
  const { db, save, nu, jaar, id, ref, schoon, hash, eur, seed, bericht, SUBSIDIES, WATERHEFFINGEN, WATERMELD, WATER_STATUS } = ctx;

  /* ---- provincie: subsidies ---- */
  function provincieSubsidies() {
    seed();
    return { ok: true, regelingen: Object.entries(SUBSIDIES).map(([k, v]) => ({ id: k, label: v.label, max: v.max })) };
  }
  function subsidieAanvraag(houder, data) {
    seed();
    data = data || {};
    const regeling = SUBSIDIES[data.regeling] ? data.regeling : null;
    if (!regeling) return { status: 400, error: 'Kies een geldige subsidieregeling.' };
    const project = schoon(data.project, 300);
    if (project.length < 6) return { status: 400, error: 'Omschrijf je project.' };
    const gevraagd = Math.min(SUBSIDIES[regeling].max, Math.max(0, eur(data.bedrag)));
    const s = { id: id(), ref: ref('SB'), key: houder.key || null, supplierCode: houder.supplierCode || null,
      aanvrager: houder.codenaam || houder.bedrijf || null, regeling, regelingLabel: SUBSIDIES[regeling].label,
      project, gevraagd, status: 'aangevraagd', at: nu() };
    db.data.rijkSubsidies.unshift(s);
    db.data.rijkSubsidies = db.data.rijkSubsidies.slice(0, 40000);
    if (houder.key) bericht(houder.key, 'Provincie', 'Subsidieaanvraag ' + s.regelingLabel, 'Je aanvraag (€ ' + gevraagd + ') is ontvangen en wordt beoordeeld.', 'subsidie');
    save();
    return { ok: true, subsidie: publiekeSubsidie(s) };
  }
  function publiekeSubsidie(s) { return { ref: s.ref, regeling: s.regeling, regelingLabel: s.regelingLabel, project: s.project, gevraagd: s.gevraagd, toegekend: s.toegekend || 0, status: s.status, at: s.at }; }
  function mijnSubsidies(houder) {
    seed();
    const list = (db.data.rijkSubsidies || []).filter(s => (houder.key && s.key === houder.key) || (houder.supplierCode && s.supplierCode === houder.supplierCode));
    return { ok: true, subsidies: list.slice(0, 30).map(publiekeSubsidie) };
  }
  function subsidiesLijst(filter) {
    seed(); filter = filter || {};
    let list = (db.data.rijkSubsidies || []);
    list = filter.status ? list.filter(s => s.status === filter.status) : list.filter(s => s.status === 'aangevraagd');
    return { ok: true, subsidies: list.slice(0, 200).map(s => ({ ...publiekeSubsidie(s), aanvrager: s.aanvrager })) };
  }
  function subsidieBeslis(actor, r, data) {
    data = data || {};
    const s = (db.data.rijkSubsidies || []).find(x => x.ref === String(r || ''));
    if (!s) return { status: 404, error: 'Aanvraag niet gevonden.' };
    const besluit = ['toegekend', 'afgewezen', 'in behandeling'].includes(data.besluit) ? data.besluit : null;
    if (!besluit) return { status: 400, error: 'Kies een geldig besluit.' };
    s.status = besluit;
    if (besluit === 'toegekend') s.toegekend = Math.min(s.gevraagd, data.bedrag == null ? s.gevraagd : Math.max(0, eur(data.bedrag)));
    s.besluit = { door: actor || 'rijk', at: nu() };
    if (s.key) bericht(s.key, 'Provincie', 'Besluit ' + s.regelingLabel,
      besluit === 'toegekend' ? 'Je subsidie van € ' + s.toegekend + ' is toegekend.' : besluit === 'afgewezen' ? 'Je aanvraag is afgewezen.' : 'Je aanvraag is in behandeling.', 'subsidie');
    save();
    return { ok: true, subsidie: publiekeSubsidie(s) };
  }

  /* ---- waterschap: belasting + meldingen ---- */
  function ensureWaterAanslagen(key) {
    if (!key) return;
    const j = jaar();
    if ((db.data.waterAanslagen || []).some(a => a.key === key && a.jaar === j)) return;
    const h = hash('water' + String(key) + j);
    WATERHEFFINGEN.forEach((w, i) => {
      const bedrag = w.basis + ((h >>> (i * 5)) % (w.spreiding + 1));
      db.data.waterAanslagen.unshift({ id: id(), ref: ref('WB'), key, soort: w.soort, jaar: j, bedrag, betaald: false, at: nu() });
    });
    db.data.waterAanslagen = db.data.waterAanslagen.slice(0, 40000);
    save();
  }
  function waterschapMijn(key) {
    seed(); ensureWaterAanslagen(key);
    return { ok: true, aanslagen: (db.data.waterAanslagen || []).filter(a => a.key === key)
      .map(a => ({ ref: a.ref, soort: a.soort, jaar: a.jaar, bedrag: a.bedrag, betaald: !!a.betaald })) };
  }
  function waterschapBetaal(key, r) {
    const a = (db.data.waterAanslagen || []).find(x => x.ref === String(r || '') && x.key === key);
    if (!a) return { status: 404, error: 'Aanslag niet gevonden.' };
    if (a.betaald) return { status: 409, error: 'Deze aanslag is al betaald.' };
    a.betaald = true; a.betaaldAt = nu();
    bericht(key, 'Waterschap', 'Betaling ontvangen', 'Je betaling van € ' + a.bedrag + ' (' + a.soort + ') is ontvangen.', 'water');
    save();
    return { ok: true, aanslag: { ref: a.ref, soort: a.soort, jaar: a.jaar, bedrag: a.bedrag, betaald: true } };
  }
  function waterMeld(sess, codenaam, data) {
    seed();
    data = data || {};
    const soort = WATERMELD[data.soort] ? data.soort : 'wateroverlast';
    const tekst = schoon(data.tekst, 500);
    if (tekst.length < 4) return { status: 400, error: 'Omschrijf kort wat er aan de hand is.' };
    const m = { id: id(), ref: ref('WM'), soort, soortLabel: WATERMELD[soort], tekst, locatie: schoon(data.locatie, 120) || null,
      melderKey: sess.key, melder: codenaam, status: 'nieuw', updates: [], at: nu() };
    db.data.waterMeldingen.unshift(m);
    db.data.waterMeldingen = db.data.waterMeldingen.slice(0, 40000);
    save();
    return { ok: true, melding: publiekeWaterMelding(m) };
  }
  function publiekeWaterMelding(m) {
    return { ref: m.ref, soort: m.soort, soortLabel: m.soortLabel, tekst: m.tekst, locatie: m.locatie, status: m.status,
      updates: (m.updates || []).map(u => ({ tekst: u.tekst, at: u.at })), at: m.at };
  }
  function mijnWaterMeldingen(key) {
    return { ok: true, meldingen: (db.data.waterMeldingen || []).filter(m => m.melderKey === key).slice(0, 40).map(publiekeWaterMelding) };
  }
  function waterMeldingenLijst(filter) {
    seed(); filter = filter || {};
    let list = (db.data.waterMeldingen || []);
    list = filter.status ? list.filter(m => m.status === filter.status) : list.filter(m => !['opgelost', 'afgewezen'].includes(m.status));
    return { ok: true, meldingen: list.slice(0, 200).map(m => ({ ...publiekeWaterMelding(m), melder: m.melder })) };
  }
  function waterMeldingZet(actor, r, data) {
    data = data || {};
    const m = (db.data.waterMeldingen || []).find(x => x.ref === String(r || ''));
    if (!m) return { status: 404, error: 'Melding niet gevonden.' };
    if (typeof data.status === 'string' && WATER_STATUS.includes(data.status)) m.status = data.status;
    const note = schoon(data.update, 300);
    if (note) m.updates.unshift({ tekst: note, at: nu(), door: actor || 'waterschap' });
    m.updates = (m.updates || []).slice(0, 40);
    save();
    return { ok: true, melding: publiekeWaterMelding(m) };
  }

  return { provincieSubsidies, subsidieAanvraag, mijnSubsidies, subsidiesLijst, subsidieBeslis,
    waterschapMijn, waterschapBetaal, waterMeld, mijnWaterMeldingen, waterMeldingenLijst, waterMeldingZet };
};

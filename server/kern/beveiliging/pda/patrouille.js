/* Beveiliging-PDA, deel "patrouille" (kern/beveiliging): de dienst en de ronde
   van de bewaker op straat - zijn diensten zien, in- en uitklokken (met GPS),
   en de patrouillerondes (starten, checkpoint zetten, afronden). Verbatim
   afgesplitst uit pda.js; rondePubliek reist mee zodat het commandocentrum
   (index.js) er ook op kan tonen. */
module.exports = (ctx) => {
  const { db, save, findSupplier, sseToSupplier, logActivity,
    id, nu, vandaag, schoon, isBeveiliging, functieAan,
    diensten, rondes, guardNaam, postVan, dienstPubliek } = ctx;

  function mijnDiensten(supplierCode, gid) {
    const s = findSupplier(supplierCode); if (!isBeveiliging(s)) return { diensten: [], ronde: null };
    const van = vandaag();
    const lijst = diensten()
      .filter(d => d.supplierCode === s.code && d.guardId === gid && d.status !== 'geannuleerd' && d.datum >= van)
      .sort((a, b) => (a.datum + a.shiftId).localeCompare(b.datum + b.shiftId))
      .slice(0, 30).map(d => dienstPubliek(s, d));
    const ronde = rondes().find(r => r.supplierCode === s.code && r.guardId === gid && !r.klaar) || null;
    return { diensten: lijst, ronde: ronde ? rondePubliek(s, ronde) : null, walkie: functieAan(s, 'walkie') };
  }
  function inklok(supplierCode, gid, dienstId, lat, lng) {
    const s = findSupplier(supplierCode); if (!isBeveiliging(s)) return { status: 404, error: 'Team niet gevonden.' };
    const d = diensten().find(x => x.id === dienstId && x.supplierCode === s.code && x.guardId === gid);
    if (!d) return { status: 404, error: 'Dienst niet gevonden.' };
    if (d.status === 'afgerond') return { status: 409, error: 'Deze dienst is al afgerond.' };
    d.status = 'ingeklokt'; d.inklokAt = nu();
    if (Number.isFinite(Number(lat))) { d.lat = Number(lat); d.lng = Number(lng); }
    save();
    logActivity(s.code, { name: d.guardNaam || 'Bewaker' }, 'klokte in op ' + ((postVan(s, d.postId) || {}).naam || 'post'));
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, dienst: dienstPubliek(s, d) };
  }
  function uitklok(supplierCode, gid, dienstId) {
    const s = findSupplier(supplierCode); if (!isBeveiliging(s)) return { status: 404, error: 'Team niet gevonden.' };
    const d = diensten().find(x => x.id === dienstId && x.supplierCode === s.code && x.guardId === gid);
    if (!d) return { status: 404, error: 'Dienst niet gevonden.' };
    d.status = 'afgerond'; d.uitklokAt = nu();
    save();
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, dienst: dienstPubliek(s, d) };
  }

  function rondePubliek(s, r) {
    const p = postVan(s, r.postId);
    return { id: r.id, postId: r.postId, post: p ? p.naam : 'Post', gestart: r.gestart, klaar: r.klaar || null,
      checkpoints: r.checkpoints || [] };
  }
  function rondeStart(supplierCode, gid, postId) {
    const s = findSupplier(supplierCode); if (!isBeveiliging(s)) return { status: 404, error: 'Team niet gevonden.' };
    if (!functieAan(s, 'patrouille')) return { status: 409, error: 'Patrouillerondes staan uit.' };
    if (rondes().some(r => r.supplierCode === s.code && r.guardId === gid && !r.klaar)) return { status: 409, error: 'U heeft al een lopende ronde. Rond die eerst af.' };
    const p = postVan(s, postId); if (!p) return { status: 404, error: 'Post niet gevonden.' };
    const r = { id: id('r'), supplierCode: s.code, postId: p.id, guardId: gid, guardNaam: guardNaam(s, gid), gestart: nu(), klaar: null, checkpoints: [] };
    rondes().unshift(r);
    db.data.bevRondes = rondes().slice(0, 50000);
    save();
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, ronde: rondePubliek(s, r) };
  }
  function rondeCheckpoint(supplierCode, gid, rondeId, naam, lat, lng) {
    const s = findSupplier(supplierCode); if (!isBeveiliging(s)) return { status: 404, error: 'Team niet gevonden.' };
    const r = rondes().find(x => x.id === rondeId && x.supplierCode === s.code && x.guardId === gid && !x.klaar);
    if (!r) return { status: 404, error: 'Lopende ronde niet gevonden.' };
    r.checkpoints.push({ naam: schoon(naam, 60) || ('Checkpoint ' + (r.checkpoints.length + 1)), at: nu(),
      lat: Number.isFinite(Number(lat)) ? Number(lat) : null, lng: Number.isFinite(Number(lng)) ? Number(lng) : null });
    save();
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, ronde: rondePubliek(s, r) };
  }
  function rondeKlaar(supplierCode, gid, rondeId) {
    const s = findSupplier(supplierCode); if (!isBeveiliging(s)) return { status: 404, error: 'Team niet gevonden.' };
    const r = rondes().find(x => x.id === rondeId && x.supplierCode === s.code && x.guardId === gid && !x.klaar);
    if (!r) return { status: 404, error: 'Lopende ronde niet gevonden.' };
    r.klaar = nu();
    save();
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, ronde: rondePubliek(s, r) };
  }

  return { mijnDiensten, inklok, uitklok, rondePubliek, rondeStart, rondeCheckpoint, rondeKlaar };
};

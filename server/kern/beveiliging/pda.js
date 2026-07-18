/* Beveiliging-PDA: de bewaker op straat (diensten, in/uitklokken met GPS,
   patrouillerondes, incidenten, SOS) en het commandocentrum. De rooster-
   functies (budget, rooster, dienstPubliek, aanvraagLijst) komen via de
   context binnen nadat kern/beveiliging.js het roosterdeel heeft gemount. */
module.exports = (ctx) => {
  const { db, save, accounts, findSupplier, notify, notifySupplier, sseToSupplier, sseToOffice, logActivity, haversine,
    BEV_FUNCTIES, BEV_SHIFTS, BEV_ERNST, AANVR_KLAAR,
    id, nu, vandaag, schoon, getal, shiftVan, isBeveiliging, defaults, functieAan,
    diensten, aanvragen, incidenten, rondes, guards, guardNaam, postVan, functieLijst, zetPost } = ctx;
  const { budget, rooster, dienstPubliek, aanvraagLijst } = ctx;
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

  function incidentPubliek(x) {
    return { id: x.id, postId: x.postId, post: x.postNaam, guardNaam: x.guardNaam, soort: x.soort, ernst: x.ernst,
      tekst: x.tekst, foto: x.foto || null, sos: !!x.sos, status: x.status, lat: x.lat != null ? x.lat : null,
      lng: x.lng != null ? x.lng : null, at: x.at };
  }
  function meldIncident(supplierCode, gid, data) {
    const s = findSupplier(supplierCode); if (!isBeveiliging(s)) return { status: 404, error: 'Team niet gevonden.' };
    if (!functieAan(s, 'incidenten')) return { status: 409, error: 'Incidenten melden staat uit.' };
    const tekst = schoon(data.tekst, 400);
    if (!tekst) return { status: 400, error: 'Beschrijf het incident.' };
    const p = data.postId ? postVan(s, data.postId) : null;
    let foto = null;
    if (typeof data.foto === 'string' && /^data:image\//.test(data.foto) && data.foto.length <= 2 * 1024 * 1024 && functieAan(s, 'bodycam')) foto = data.foto;
    const x = {
      id: id('i'), supplierCode: s.code, postId: p ? p.id : null, postNaam: p ? p.naam : (schoon(data.post, 60) || 'Onbekend'),
      guardId: gid, guardNaam: guardNaam(s, gid), soort: schoon(data.soort, 40) || 'melding',
      ernst: BEV_ERNST.includes(data.ernst) ? data.ernst : 'midden', tekst, foto,
      lat: Number.isFinite(Number(data.lat)) ? Number(data.lat) : null, lng: Number.isFinite(Number(data.lng)) ? Number(data.lng) : null,
      sos: false, status: 'open', at: nu()
    };
    incidenten().unshift(x);
    db.data.bevIncidenten = incidenten().slice(0, 50000);
    save();
    notifySupplier(s.code, { icon: x.ernst === 'kritiek' || x.ernst === 'hoog' ? '🚨' : '📋', title: 'Incident · ' + x.ernst, body: x.guardNaam + ' @ ' + x.postNaam + ': ' + tekst.slice(0, 80) });
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    if (x.ernst === 'kritiek' || x.ernst === 'hoog') sseToOffice('sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, incident: incidentPubliek(x) };
  }
  function beslisIncident(s, incidentId) {
    const x = incidenten().find(i => i.id === incidentId && i.supplierCode === s.code);
    if (!x) return { status: 404, error: 'Incident niet gevonden.' };
    x.status = x.status === 'open' ? 'afgehandeld' : 'open';
    save();
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, status2: x.status };
  }
  /* SOS: de noodknop van de bewaker. Meteen een kritiek incident, melding aan
     het team EN aan RTG-kantoor met de live locatie. */
  function sos(supplierCode, gid, lat, lng) {
    const s = findSupplier(supplierCode); if (!isBeveiliging(s)) return { status: 404, error: 'Team niet gevonden.' };
    if (!functieAan(s, 'sos')) return { status: 409, error: 'De SOS-knop staat uit.' };
    const naam = guardNaam(s, gid) || 'Bewaker';
    const x = {
      id: id('i'), supplierCode: s.code, postId: null, postNaam: 'SOS', guardId: gid, guardNaam: naam,
      soort: 'sos', ernst: 'kritiek', tekst: 'SOS-noodknop ingedrukt door ' + naam, foto: null,
      lat: Number.isFinite(Number(lat)) ? Number(lat) : null, lng: Number.isFinite(Number(lng)) ? Number(lng) : null,
      sos: true, status: 'open', at: nu()
    };
    incidenten().unshift(x);
    db.data.bevIncidenten = incidenten().slice(0, 50000);
    save();
    notifySupplier(s.code, { icon: '🆘', title: 'SOS · ' + naam, body: 'Noodknop ingedrukt. Bekijk de live locatie en stuur bijstand.' });
    logActivity(s.code, { name: naam }, 'drukte de SOS-noodknop in');
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    sseToOffice('sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, incident: incidentPubliek(x) };
  }

  /* ---- het commandocentrum: alles in een oogopslag ---- */
  function command(s) {
    const b = defaults(s);
    const dag = vandaag();
    const rst = rooster(s, dag, 1).dagen[0];
    const opDienst = diensten().filter(d => d.supplierCode === s.code && d.status === 'ingeklokt')
      .map(d => dienstPubliek(s, d));
    const openVandaag = rst ? rst.open : 0;
    const postenStatus = rst ? rst.posten.map(p => ({ post: p.post, klant: p.klant, open: p.open,
      gedekt: p.shifts.reduce((t, x) => t + x.bezet.length, 0), nodig: p.shifts.reduce((t, x) => t + x.minMan, 0) })) : [];
    const av = aanvraagLijst(s);
    const inc = incidenten().filter(i => i.supplierCode === s.code);
    return {
      team: guards(s).length,
      posten: b.posten.filter(p => p.actief !== false).length,
      postenLijst: b.posten.map(p => ({ id: p.id, naam: p.naam, klant: p.klant || '', minMan: p.minMan || 1, orders: p.orders || '', actief: p.actief !== false })),
      opDienst, openVandaag, postenStatus,
      budget: functieAan(s, 'budget') ? budget(s) : null,
      openAanvragen: av.open.length,
      sosActief: inc.some(i => i.sos && i.status === 'open'),
      incidentenOpen: inc.filter(i => i.status === 'open').length,
      incidenten: inc.slice(0, 12).map(incidentPubliek),
      rondesActief: rondes().filter(r => r.supplierCode === s.code && !r.klaar).map(r => rondePubliek(s, r)),
      functies: functieLijst(s)
    };
  }
  return { mijnDiensten, inklok, uitklok, rondeStart, rondeCheckpoint, rondeKlaar, meldIncident, beslisIncident, sos, command };
};

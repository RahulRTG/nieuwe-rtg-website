/* Beveiliging-PDA (kern/beveiliging): de bewaker op straat en het
   commandocentrum. De rooster-functies (budget, rooster, dienstPubliek,
   aanvraagLijst) komen via de context binnen nadat kern/beveiliging.js het
   roosterdeel heeft gemount.

   Dit is de orkestrator: de incidenten en de SOS-noodknop en het
   commandocentrum wonen hier; de dienst en de patrouilleronde staan in
   ./patrouille, die rondePubliek meelevert zodat het commandocentrum de lopende
   rondes kan tonen. */
module.exports = (ctx) => {
  const { db, save, findSupplier, notifySupplier, sseToSupplier, sseToOffice, logActivity,
    BEV_ERNST, id, nu, vandaag, schoon, isBeveiliging, defaults, functieAan,
    diensten, incidenten, rondes, guards, guardNaam, postVan, functieLijst, dienstPubliek,
    budget, rooster, aanvraagLijst } = ctx;
  // rondePubliek blijft intern (het commandocentrum gebruikt het); de rest van
  // de patrouille-laag gaat wel naar buiten, net als in de oorspronkelijke pda.js
  const { rondePubliek, ...patrouille } = require('./patrouille')(ctx);

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

  return Object.assign(
    { meldIncident, beslisIncident, sos, command },
    patrouille);
};

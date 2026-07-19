/* RTG OV, deelbestand "dienst": de PDA-kant en de zaak. Het personeel start een
   dienst op een lijn, deelt onderweg de live positie, tikt de oplichtende code van
   het lid in (snelle check-in), en ziet wie er aan boord is. De zaak tekent zelf
   lijnen en haltes op de kaart (routetekenaar) en heeft een live vloot-/omzetoverzicht.
   Krijgt de gedeelde ctx van kern/ov/index.js. */
module.exports = (ctx) => {
  const { db, save, schoon, id, nu, ensureOv, lijnVan, versVoertuig, ritStart, codes, SOORTEN } = ctx;

  /* ---- de PDA-kant: dienst, live positie en de code-check-in ---- */
  function dienst(s, actor, data) {
    ensureOv();
    const vid = 'v-' + s.code + '-' + (actor && actor.staffId || 'pda');
    db.data.ovVoertuigen = db.data.ovVoertuigen.filter(v => v.id !== vid);
    if (data.aan === false) { save(); return { status: 200, ok: true, aan: false }; }
    const lijn = lijnVan(s, String(data.lijnId || ''));
    if (!lijn) return { status: 400, error: 'Kies een lijn.' };
    const start = lijn.haltes[0];
    db.data.ovVoertuigen.push({ id: vid, code: s.code, lijnId: lijn.id, soort: lijn.soort,
      naam: schoon(data.voertuigNaam, 40) || (lijn.naam + ' ' + (actor && actor.name || '')),
      lat: start.lat, lng: start.lng, at: nu(), door: actor && actor.name || 'PDA' });
    save();
    return { status: 200, ok: true, aan: true, voertuigId: vid, lijn: { id: lijn.id, naam: lijn.naam, soort: lijn.soort } };
  }
  function pos(s, actor, data) {
    const vid = 'v-' + s.code + '-' + (actor && actor.staffId || 'pda');
    const v = db.data.ovVoertuigen.find(x => x.id === vid);
    if (!v) return { status: 409, error: 'Start eerst een dienst.' };
    const lat = Number(data.lat), lng = Number(data.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) { v.lat = lat; v.lng = lng; }
    v.at = nu(); save();
    return { status: 200, ok: true };
  }
  // snelle optie 1: het personeel tikt de oplichtende code van het lid in
  function codeIn(s, actor, codeTekst) {
    const vid = 'v-' + s.code + '-' + (actor && actor.staffId || 'pda');
    const v = db.data.ovVoertuigen.find(x => x.id === vid);
    if (!v) return { status: 409, error: 'Start eerst een dienst.' };
    const c = codes.get(String(codeTekst || '').trim().toUpperCase());
    if (!c || c.tot < Date.now()) return { status: 404, error: 'Onbekende of verlopen code.' };
    codes.delete(String(codeTekst || '').trim().toUpperCase());
    return ritStart(c.key, v);
  }
  function stand(s, actor) {
    const vid = 'v-' + s.code + '-' + (actor && actor.staffId || 'pda');
    const vandaag = nu().slice(0, 10);
    const ritten = db.data.ovRitten.filter(r => r.voertuigId === vid && String(r.in.at).slice(0, 10) === vandaag);
    return { status: 200, aanBoord: ritten.filter(r => r.status === 'in').length, vandaag: ritten.length };
  }

  /* ---- de routetekenaar: de zaak zet zelf lijnen en haltes op de kaart ----
     De kaart in de app is een eigen SVG die zich ijkt op de echte plekken van
     de stad (partnerlocaties als herkenningspunten); hier landen alleen de
     lijnen zelf: naam, soort, frequentie, tarief en de haltes in volgorde. */
  function ijkpunten(s) {
    return db.data.suppliers
      .filter(x => x.city === s.city && x.loc && Number.isFinite(x.loc.lat))
      .map(x => ({ naam: x.name, lat: x.loc.lat, lng: x.loc.lng }))
      .slice(0, 40);
  }
  function lijnenBeheer(s) {
    ensureOv();
    return { status: 200, soorten: Object.keys(SOORTEN),
      lijnen: (s.lijnen || []).map(l => ({ id: l.id, naam: l.naam, soort: l.soort, icoon: SOORTEN[l.soort],
        frequentieMin: l.frequentieMin, tarief: l.tarief, haltes: l.haltes })),
      ijkpunten: ijkpunten(s) };
  }
  function lijnZet(s, data) {
    ensureOv();
    s.lijnen = s.lijnen || [];
    if (data.weg) {
      const l = lijnVan(s, String(data.id || ''));
      if (!l) return { status: 404, error: 'Lijn niet gevonden.' };
      s.lijnen = s.lijnen.filter(x => x.id !== l.id);
      db.data.ovVoertuigen = db.data.ovVoertuigen.filter(v => !(v.code === s.code && v.lijnId === l.id));
      save();
      return { status: 200, ok: true };
    }
    const naam = schoon(data.naam, 40); if (!naam) return { status: 400, error: 'Geef de lijn een naam.' };
    const soort = SOORTEN[data.soort] ? data.soort : null;
    if (!soort) return { status: 400, error: 'Kies bus, trein, metro, veerboot of tram.' };
    const haltes = (Array.isArray(data.haltes) ? data.haltes : []).slice(0, 20).map((h, i) => ({
      id: 'h' + (i + 1), naam: schoon(h.naam, 40) || ('Halte ' + (i + 1)),
      lat: Number(h.lat), lng: Number(h.lng) }));
    if (haltes.length < 2) return { status: 400, error: 'Een lijn heeft minstens twee haltes.' };
    if (haltes.some(h => !Number.isFinite(h.lat) || !Number.isFinite(h.lng) || Math.abs(h.lat) > 90 || Math.abs(h.lng) > 180))
      return { status: 400, error: 'Een halte staat buiten de kaart.' };
    const frequentieMin = Math.min(Math.max(Math.round(Number(data.frequentieMin) || 15), 1), 240);
    const basis = Math.min(Math.max(Math.round(Number(data.tarief && data.tarief.basis) || 180), 0), 10000);
    const perKm = Math.min(Math.max(Math.round(Number(data.tarief && data.tarief.perKm) || 20), 0), 2000);
    let l = data.id ? lijnVan(s, String(data.id)) : null;
    if (!l) { l = { id: id('L') }; s.lijnen.push(l); }
    Object.assign(l, { naam, soort, frequentieMin, tarief: { basis, perKm }, haltes });
    save();
    return { status: 200, ok: true, lijn: { id: l.id, naam: l.naam, soort: l.soort, haltes: l.haltes } };
  }

  /* ---- het zaakoverzicht: live vloot, reizigers en omzet vandaag ---- */
  function overzicht(s) {
    ensureOv();
    const vandaag = nu().slice(0, 10);
    const ritten = db.data.ovRitten.filter(r => r.code === s.code && String(r.in.at).slice(0, 10) === vandaag);
    return { status: 200,
      voertuigen: db.data.ovVoertuigen.filter(v => v.code === s.code && versVoertuig(v))
        .map(v => ({ id: v.id, naam: v.naam, lijnId: v.lijnId, soort: v.soort, lat: v.lat, lng: v.lng, door: v.door })),
      reizigersVandaag: ritten.length, aanBoord: ritten.filter(r => r.status === 'in').length,
      omzetVandaag: ritten.reduce((n, r) => n + (r.prijs || 0), 0),
      lijnen: (s.lijnen || []).map(l => ({ id: l.id, naam: l.naam, soort: l.soort, icoon: SOORTEN[l.soort],
        reizigers: ritten.filter(r => r.lijnId === l.id).length })) };
  }

  return { ovDienst: dienst, ovPos: pos, ovCodeIn: codeIn, ovStand: stand,
    ovLijnenBeheer: lijnenBeheer, ovLijnZet: lijnZet, ovOverzicht: overzicht };
};

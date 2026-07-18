/* Kern-module "ov": RTG OV, al het vervoer in een app. Bus, trein, metro en
   veerboot rijden als lijnen met haltes; de chauffeur/machinist/schipper deelt
   onderweg de positie via de PDA, dus het lid ziet live waar zijn vervoer is.
   De taxi (het bestaande ritten-genre) woont in dezelfde app als
   privechauffeur.

   Inchecken, bewust met twee snelle opties:
   1. De oplichtende code: het lid toont een korte code, het personeel tikt
      hem in: klaar. (Zelfde vertrouwde mechaniek als de entree- en kassacode.)
   2. Een tik op GPS: het lid staat aantoonbaar bij het voertuig (binnen 150
      meter van de live positie) en checkt in zonder iets te laten zien.
   Uitchecken is een tik: de prijs is eerlijk basis + kilometers (hemelsbreed
   tussen in- en uitstap), betaald uit de RTG Pay-wallet met autolaad.

   maakOv(state) volgt het vaste kern-patroon. */

const SOORTEN = { bus: '\u{1F68C}', trein: '\u{1F686}', metro: '\u{1F687}', veerboot: '\u{26F4}\u{FE0F}', tram: '\u{1F68A}' };
const VOERTUIG_TTL_MS = 120 * 1000;   // een positie is zo lang vers
const CODE_TTL_MS = 5 * 60 * 1000;    // de oplichtende code
const GPS_CHECKIN_M = 150;            // zo dichtbij is 'bij het voertuig'
const RITTEN_MAX = 4000;

function maakOv({ db, save, crypto, schoon, codenaamVan, haversine, etaMinutes, pay, notify }) {
  const id = p => (p || 'ov') + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const codes = new Map();              // code -> { key, tot }

  /* ---- de demo-zaak: Ibiza Transit met vier lijnsoorten ---- */
  function ensureOv() {
    if (!db.data.supplierTypes.ov)
      db.data.supplierTypes.ov = { label: 'Openbaar vervoer', icon: '\u{1F68C}', caps: ['ov', 'location', 'pricing'] };
    if (!db.data.suppliers.find(s => s.code === 'TRANSIT')) {
      db.data.suppliers.push({
        code: 'TRANSIT', name: 'Ibiza Transit', type: 'ov', city: 'Ibiza',
        loc: { lat: 38.908, lng: 1.432, label: 'Ibiza-stad, busstation' }, rate: 0.08,
        menu: [], photos: [],
        lijnen: [
          { id: 'L1', soort: 'bus', naam: 'Kustlijn 1', frequentieMin: 12, tarief: { basis: 180, perKm: 22 },
            haltes: [
              { id: 'h-air', naam: 'Aeroport', lat: 38.873, lng: 1.373 },
              { id: 'h-stad', naam: 'Ibiza-stad', lat: 38.908, lng: 1.432 },
              { id: 'h-mar', naam: 'Marina Botafoch', lat: 38.918, lng: 1.449 },
              { id: 'h-tal', naam: 'Talamanca', lat: 38.915, lng: 1.455 }
            ] },
          { id: 'M1', soort: 'metro', naam: 'Stadslijn', frequentieMin: 6, tarief: { basis: 160, perKm: 15 },
            haltes: [
              { id: 'm-dalt', naam: 'Dalt Vila', lat: 38.906, lng: 1.436 },
              { id: 'm-cent', naam: 'Vara de Rey', lat: 38.909, lng: 1.431 },
              { id: 'm-haven', naam: 'Haven', lat: 38.911, lng: 1.437 }
            ] },
          { id: 'T1', soort: 'trein', naam: 'Eilandexpres', frequentieMin: 20, tarief: { basis: 250, perKm: 12 },
            haltes: [
              { id: 't-stad', naam: 'Ibiza-stad', lat: 38.908, lng: 1.432 },
              { id: 't-anto', naam: 'Sant Antoni', lat: 38.980, lng: 1.303 },
              { id: 't-eula', naam: 'Santa Eularia', lat: 38.985, lng: 1.535 }
            ] },
          { id: 'F1', soort: 'veerboot', naam: 'Formentera-ferry', frequentieMin: 30, tarief: { basis: 950, perKm: 8 },
            haltes: [
              { id: 'f-ibz', naam: 'Ibiza-haven', lat: 38.909, lng: 1.437 },
              { id: 'f-sav', naam: 'La Savina (Formentera)', lat: 38.732, lng: 1.417 }
            ] }
        ]
      });
    }
    if (!Array.isArray(db.data.ovVoertuigen)) db.data.ovVoertuigen = [];
    if (!Array.isArray(db.data.ovRitten)) db.data.ovRitten = [];
  }

  const ovZaak = code => db.data.suppliers.find(s => s.code === code && s.type === 'ov') || null;
  const lijnVan = (s, lijnId) => (s.lijnen || []).find(l => l.id === lijnId) || null;
  const versVoertuig = v => Date.now() - new Date(v.at).getTime() < VOERTUIG_TTL_MS;
  const actieveRit = key => db.data.ovRitten.find(r => r.key === key && r.status === 'in') || null;

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

  /* ---- de ledenkant: kaart, twee snelle check-ins, en uitchecken ---- */
  function kaart(key, hier) {
    ensureOv();
    const lat = Number(hier && hier.lat), lng = Number(hier && hier.lng);
    const geldig = Number.isFinite(lat) && Number.isFinite(lng);
    const uit = [];
    for (const s of db.data.suppliers) {
      if (s.type !== 'ov') continue;
      for (const l of s.lijnen || []) {
        const voertuigen = db.data.ovVoertuigen.filter(v => v.code === s.code && v.lijnId === l.id && versVoertuig(v));
        const haltes = l.haltes.map(h => ({ ...h,
          afstandM: geldig ? haversine({ lat, lng }, h) : null }));
        const dichtsteHalte = geldig ? [...haltes].sort((a, b) => a.afstandM - b.afstandM)[0] : haltes[0];
        // live: de echte aanrijtijd van het dichtstbijzijnde voertuig; anders het boekje
        let over = Math.round(l.frequentieMin / 2), live = false;
        if (voertuigen.length && dichtsteHalte) {
          const m = Math.min(...voertuigen.map(v => haversine(v, dichtsteHalte)));
          over = etaMinutes(m, 'driving'); live = true;
        }
        uit.push({ zaak: s.name, code: s.code, lijnId: l.id, naam: l.naam, soort: l.soort,
          icoon: SOORTEN[l.soort] || '\u{1F68C}', frequentieMin: l.frequentieMin,
          tarief: l.tarief, haltes, halte: dichtsteHalte, overMin: over, live,
          voertuigen: voertuigen.map(v => ({ id: v.id, naam: v.naam, lat: v.lat, lng: v.lng })) });
      }
    }
    uit.sort((a, b) => ((a.halte && a.halte.afstandM) ?? 9e9) - ((b.halte && b.halte.afstandM) ?? 9e9));
    const rit = actieveRit(key);
    return { status: 200, lijnen: uit, rit: rit ? ritBeeld(rit) : null };
  }
  function codeMaak(key) {
    if (actieveRit(key)) return { status: 409, error: 'U bent al ingecheckt; check eerst uit.' };
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    codes.set(code, { key, tot: Date.now() + CODE_TTL_MS });
    if (codes.size > 5000) for (const [k, v] of codes) if (v.tot < Date.now()) codes.delete(k);
    return { status: 200, code, geldigS: CODE_TTL_MS / 1000 };
  }
  // snelle optie 2: aantoonbaar bij het voertuig, dus een tik is genoeg
  function hierIn(key, hier) {
    ensureOv();
    if (actieveRit(key)) return { status: 409, error: 'U bent al ingecheckt; check eerst uit.' };
    const lat = Number(hier && hier.lat), lng = Number(hier && hier.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { status: 400, error: 'Geen geldige plek.' };
    const v = db.data.ovVoertuigen.filter(versVoertuig)
      .map(x => ({ x, m: haversine({ lat, lng }, x) }))
      .sort((a, b) => a.m - b.m)[0];
    if (!v || v.m > GPS_CHECKIN_M)
      return { status: 409, error: 'Geen voertuig binnen ' + GPS_CHECKIN_M + ' meter; gebruik anders de oplichtende code.' };
    return ritStart(key, v.x);
  }
  function ritStart(key, voertuig) {
    if (actieveRit(key)) return { status: 409, error: 'Al ingecheckt.' };
    const s = ovZaak(voertuig.code);
    const lijn = s ? lijnVan(s, voertuig.lijnId) : null;
    if (!lijn) return { status: 404, error: 'Lijn niet gevonden.' };
    const rit = { id: id('rt'), key, code: voertuig.code, lijnId: lijn.id, soort: lijn.soort,
      voertuigId: voertuig.id, status: 'in',
      in: { lat: voertuig.lat, lng: voertuig.lng, at: nu() }, uit: null, prijs: null };
    db.data.ovRitten.push(rit);
    if (db.data.ovRitten.length > RITTEN_MAX) db.data.ovRitten = db.data.ovRitten.slice(-RITTEN_MAX);
    save();
    notify(key, { title: 'RTG OV', body: 'Ingecheckt op ' + lijn.naam + '. Goede reis.', scope: 'ov' });
    return { status: 200, ok: true, rit: ritBeeld(rit) };
  }
  async function checkUit(key, hier, idem) {
    const rit = actieveRit(key);
    if (!rit) return { status: 409, error: 'U bent niet ingecheckt.' };
    const s = ovZaak(rit.code);
    const lijn = s ? lijnVan(s, rit.lijnId) : null;
    const lat = Number(hier && hier.lat), lng = Number(hier && hier.lng);
    const uitPunt = Number.isFinite(lat) ? { lat, lng } :
      (db.data.ovVoertuigen.find(v => v.id === rit.voertuigId) || rit.in);
    const km = Math.max(0, (haversine(rit.in, uitPunt) || 0) / 1000);
    const prijs = Math.max(100, Math.round((lijn ? lijn.tarief.basis : 180) + km * (lijn ? lijn.tarief.perKm : 20)));
    // betalen met autolaad: de wallet laadt zelf bij als het saldo tekortschiet
    const codenaam = codenaamVan(key);
    const rek = 'lid:' + codenaam;
    const tekort = prijs - pay.saldoVan(rek);
    if (tekort > 0) {
      const l = await pay.laadOp({ codenaam, centen: Math.max(tekort, 1000), idem: idem ? 'ovlaad:' + idem : undefined });
      if (l.error) return { status: l.status || 402, error: l.error };
    }
    const b = pay.boek({ van: rek, naar: 'partner:' + rit.code, centen: prijs, soort: 'ov',
      oms: 'OV · ' + (lijn ? lijn.naam : rit.lijnId) + ' · ' + (Math.round(km * 10) / 10) + ' km' });
    if (b.error) return { status: b.status || 400, error: b.error };
    rit.status = 'uit'; rit.uit = { ...uitPunt, at: nu() }; rit.prijs = prijs; rit.km = Math.round(km * 10) / 10;
    save();
    return { status: 200, ok: true, prijs, km: rit.km, saldo: pay.saldoVan(rek), rit: ritBeeld(rit) };
  }
  function ritBeeld(r) {
    return { id: r.id, lijnId: r.lijnId, soort: r.soort, icoon: SOORTEN[r.soort] || '\u{1F68C}',
      status: r.status, inAt: r.in.at, uitAt: r.uit ? r.uit.at : null, prijs: r.prijs, km: r.km || null };
  }
  function mijn(key) {
    ensureOv();
    const rijen = db.data.ovRitten.filter(r => r.key === key).slice(-15).reverse();
    return { status: 200, rit: actieveRit(key) ? ritBeeld(actieveRit(key)) : null, ritten: rijen.map(ritBeeld) };
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

  ensureOv();
  return { ovKaart: kaart, ovCodeMaak: codeMaak, ovHierIn: hierIn, ovCheckUit: checkUit, ovMijn: mijn,
    ovDienst: dienst, ovPos: pos, ovCodeIn: codeIn, ovStand: stand, ovOverzicht: overzicht };
}

module.exports = { maakOv };

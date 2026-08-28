/* Partneringang voor RTG Navigatie.

   Leveranciers leveren gebeurtenissen, geen routes. RTG normaliseert hun bron,
   geldigheid, betrouwbaarheid en geometrie en blijft zelf bepalen wat een route
   ermee doet. Daardoor kan een hotel een geblokkeerde oprijlaan melden en een
   luchthaven een drukke pickup-zone, zonder dat een partner de router bestuurt. */
'use strict';

const { coord } = require('../util');
const SOORTEN = new Set(['afsluiting', 'file', 'ongeval', 'object', 'wegwerk', 'wachtrij', 'weer', 'ophaalzone']);
const MAX_EVENTS = 5000;
const MAX_DUUR_MS = 31 * 24 * 60 * 60 * 1000;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

module.exports = function maakPartnerEvents({ db, save, crypto, haversine }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/navigatie/partner-events', bezit: { navPartnerEvents: 'lijst' } });
  const bak = () => eigen.bak('navPartnerEvents');
  const nuMs = () => Date.now();
  const beeld = e => ({
    id: e.id, soort: e.soort, naam: e.naam, lat: e.lat, lng: e.lng,
    straalM: e.straalM, ernst: e.ernst, betrouwbaarheid: e.betrouwbaarheid,
    geldigVan: e.geldigVan, geldigTot: e.geldigTot, bron: 'partner', bronCode: e.bronCode
  });

  function actief() {
    const nu = nuMs();
    const rij = bak().filter(e => new Date(e.geldigVan).getTime() <= nu && new Date(e.geldigTot).getTime() > nu);
    if (rij.length !== bak().length) eigen.zetBak('navPartnerEvents', rij);
    return rij;
  }

  function zet(supplier, data = {}) {
    if (!supplier || !supplier.code) return { status: 403, error: 'Geen partnercontext.' };
    const soort = String(data.soort || '').toLowerCase();
    if (!SOORTEN.has(soort)) return { status: 400, error: 'Onbekend mobiliteitssignaal.' };
    const lat = coord(data.lat, 90), lng = coord(data.lng, 180);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { status: 400, error: 'Geen geldige plek.' };
    const begin = data.geldigVan ? new Date(data.geldigVan) : new Date();
    const einde = data.geldigTot ? new Date(data.geldigTot) : new Date(begin.getTime() + 4 * 60 * 60 * 1000);
    if (!Number.isFinite(begin.getTime()) || !Number.isFinite(einde.getTime()) || einde <= begin)
      return { status: 400, error: 'De geldigheidsperiode klopt niet.' };
    if (einde.getTime() - begin.getTime() > MAX_DUUR_MS)
      return { status: 400, error: 'Een mobiliteitssignaal mag maximaal 31 dagen vooruit gelden.' };
    const rij = actief();
    const dubbel = rij.find(e => e.bronCode === supplier.code && e.soort === soort && haversine(e, { lat, lng }) <= 100);
    if (dubbel) {
      dubbel.geldigTot = einde.toISOString();
      dubbel.ernst = clamp(Math.round(Number(data.ernst) || dubbel.ernst), 1, 5);
      dubbel.betrouwbaarheid = clamp(Math.round(Number(data.betrouwbaarheid) || dubbel.betrouwbaarheid), 50, 100);
      dubbel.bijgewerktAt = new Date().toISOString();
      save();
      return { status: 200, ok: true, bijgewerkt: true, gebeurtenis: beeld(dubbel) };
    }
    const gebeurtenis = {
      id: 'npe-' + crypto.randomBytes(6).toString('hex'), soort,
      naam: String(data.naam || soort).trim().slice(0, 100), lat, lng,
      straalM: clamp(Math.round(Number(data.straalM) || 450), 80, 3000),
      ernst: clamp(Math.round(Number(data.ernst) || 2), 1, 5),
      betrouwbaarheid: clamp(Math.round(Number(data.betrouwbaarheid) || 85), 50, 100),
      geldigVan: begin.toISOString(), geldigTot: einde.toISOString(),
      bronCode: supplier.code, at: new Date().toISOString()
    };
    rij.push(gebeurtenis);
    if (rij.length > MAX_EVENTS) rij.splice(0, rij.length - MAX_EVENTS);
    eigen.zetBak('navPartnerEvents', rij); save();
    return { status: 200, ok: true, gebeurtenis: beeld(gebeurtenis) };
  }

  function lijst(code) {
    return { status: 200, gebeurtenissen: actief().filter(e => e.bronCode === code).map(beeld) };
  }

  function rond(hier, radiusKm = 40) {
    if (!hier || !Number.isFinite(Number(hier.lat)) || !Number.isFinite(Number(hier.lng))) return actief().map(beeld);
    return actief().filter(e => haversine(e, { lat: Number(hier.lat), lng: Number(hier.lng) }) <= radiusKm * 1000).map(beeld);
  }

  return { navPartnerEvent: zet, navPartnerEvents: lijst, partnerEventsRond: rond };
};

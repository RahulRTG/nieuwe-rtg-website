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

   maakOv(state) volgt het vaste kern-patroon. Dit is de orkestrator: de
   demo-zaak, de gedeelde state-helpers, de rit-start en het rit-beeld wonen
   hier; de ledenkant in ./reizen, de PDA/zaak-kant in ./dienst. */

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
  function ritBeeld(r) {
    return { id: r.id, lijnId: r.lijnId, soort: r.soort, icoon: SOORTEN[r.soort] || '\u{1F68C}',
      status: r.status, inAt: r.in.at, uitAt: r.uit ? r.uit.at : null, prijs: r.prijs, km: r.km || null };
  }

  // de gedeelde ctx voor de deelbestanden
  const ctx = {
    db, save, crypto, schoon, nu, id, codenaamVan, haversine, etaMinutes, pay, notify, codes,
    ensureOv, ovZaak, lijnVan, versVoertuig, actieveRit, ritStart, ritBeeld,
    SOORTEN, VOERTUIG_TTL_MS, CODE_TTL_MS, GPS_CHECKIN_M, RITTEN_MAX
  };

  ensureOv();
  return Object.assign({}, require('./reizen')(ctx), require('./dienst')(ctx));
}

module.exports = { maakOv };

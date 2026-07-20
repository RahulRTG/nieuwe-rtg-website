/* Boot-datalaag, deel 2/7 (kern): een aaneengesloten blok
   db.data-standaarden/demo-seed uit initRealtime. Afgesplitst uit server.js; de
   context levert db, save en de seed-helpers. Draait in vaste volgorde via ./index. */
module.exports = (ctx) => {
  const { db, save, crypto, sessions, tokenHash, ensureSupplierDefaults, webpush, DEMO, PERSONAS, GIDS_SEED_TIERS } = ctx;
  if (!db.data.suppliers.find(s => s.code === 'MACE')) {
    db.data.suppliers.push({
      code: 'MACE', name: 'MACE Museum Eivissa', type: 'activiteit', city: 'Ibiza',
      loc: { lat: 38.907, lng: 1.436, label: 'Dalt Vila, Ibiza' }, rate: 0.12,
      menu: [], photos: [],
      activiteiten: [
        { id: 'a1', name: 'Entree museum', desc: 'Hedendaagse kunst in het hart van Dalt Vila.', prijs: 12, capaciteit: 80, duur: 'vrij bezoek', tijden: ['10:00', '12:00', '14:00', '16:00'] },
        { id: 'a2', name: 'Rondleiding met gids', desc: 'Een uur langs de hoogtepunten, kleine groep.', prijs: 24, capaciteit: 15, duur: '1 uur', tijden: ['11:00', '15:00'] }
      ]
    });
  }
  // het autoverhuur-genre: eerlijk huren tegenover de schimmige verhuurders.
  // De staat van de auto wordt VOOR en NA de huur met foto's vastgelegd (door
  // beide partijen, onveranderbaar), er is een SOS-knop tijdens de huur, en de
  // huurder kan vrijwillig zijn live locatie delen. Vaste dagprijs, geen
  // verrassingen aan de balie.
  if (!db.data.supplierTypes.verhuur)
    db.data.supplierTypes.verhuur = { label: 'Autoverhuur', icon: '\u{1F697}', caps: ['huur', 'location', 'pricing'] };
  if (!db.data.suppliers.find(s => s.code === 'ISLAREN')) {
    db.data.suppliers.push({
      code: 'ISLAREN', name: 'Isla Rent Ibiza', type: 'verhuur', city: 'Ibiza',
      loc: { lat: 38.912, lng: 1.442, label: 'Ibiza-stad, haven' }, rate: 0.12,
      menu: [], photos: [],
      autos: [
        { id: 'c1', name: 'Fiat 500 Cabrio', plate: 'IB-501-C', dagprijs: 49, actief: true,
          categorie: 'Compact cabrio', transmissie: 'handgeschakeld', brandstof: 'benzine', stoelen: 4, deuren: 2,
          airco: true, bagage: 1, kmPerDag: 200, meerKm: 0.25, borg: 300, minLeeftijd: 21, icoon: '\uD83D\uDE97' },
        { id: 'c2', name: 'Mini Cooper Cabrio', plate: 'IB-207-M', dagprijs: 69, actief: true,
          categorie: 'Premium cabrio', transmissie: 'automaat', brandstof: 'benzine', stoelen: 4, deuren: 2,
          airco: true, bagage: 2, kmPerDag: 250, meerKm: 0.30, borg: 500, minLeeftijd: 23, icoon: '\uD83D\uDE99' },
        { id: 'c3', name: 'Jeep Wrangler', plate: 'IB-330-J', dagprijs: 95, actief: true,
          categorie: 'SUV 4x4', transmissie: 'automaat', brandstof: 'diesel', stoelen: 5, deuren: 4,
          airco: true, bagage: 3, kmPerDag: 0, meerKm: 0, borg: 800, minLeeftijd: 25, icoon: '\uD83D\uDE99' }
      ],
      // 5-sterren autoverkoop: een exclusieve showroom naast de verhuur
      verkoop: { aan: true, showroom: [
        { id: 'v1', merk: 'Porsche', model: '911 Carrera S', jaar: 2023, km: 12400, prijs: 149500, brandstof: 'Benzine',
          transmissie: 'PDK automaat', kleur: 'GT-zilver', vermogenPk: 450, opties: ['Sport Chrono', 'Panoramadak', 'Bose'],
          garantieMnd: 24, historie: 'Volledige Porsche-onderhoudshistorie, eerste eigenaar, ongevalvrij.', fotos: [], vip: true, status: 'te koop' },
        { id: 'v2', merk: 'Mercedes-Benz', model: 'G 400d AMG Line', jaar: 2022, km: 28900, prijs: 138000, brandstof: 'Diesel',
          transmissie: 'Automaat', kleur: 'Obsidiaanzwart', vermogenPk: 330, opties: ['Burmester', 'Nachtpakket', 'Trekhaak'],
          garantieMnd: 24, historie: 'Dealeronderhouden, tweede eigenaar.', fotos: [], vip: true, status: 'te koop' },
        { id: 'v3', merk: 'Tesla', model: 'Model 3 Long Range', jaar: 2024, km: 8600, prijs: 46900, brandstof: 'Elektrisch',
          transmissie: 'Automaat', kleur: 'Parelwit', vermogenPk: 498, opties: ['Autopilot', 'Trekhaak'],
          garantieMnd: 36, historie: 'Fabrieksgarantie, als nieuw.', fotos: [], vip: false, status: 'te koop' },
        { id: 'v4', merk: 'Volkswagen', model: 'Golf GTI', jaar: 2021, km: 41200, prijs: 32750, brandstof: 'Benzine',
          transmissie: 'DSG', kleur: 'Tornado-rood', vermogenPk: 245, opties: ['Digital Cockpit', 'Trekhaak'],
          garantieMnd: 12, historie: 'Nette staat, dealeronderhouden.', fotos: [], vip: false, status: 'te koop' }
      ] }
    });
  }
  if (!Array.isArray(db.data.verkoopDeals)) db.data.verkoopDeals = [];
  // het helikopter-genre: premium transfers en scenic vluchten met eigen
  // helikopters en piloten. Verloopt via dezelfde ritketen (aanvraag, toewijzen,
  // onderweg, gearriveerd) met slimme toewijzing van piloot en toestel; 18+ zoals
  // de privejet, en de piloot bevestigt weer en helipad voor het opstijgen.
  if (!db.data.supplierTypes.helikopter)
    db.data.supplierTypes.helikopter = { label: 'Helikopter transfers', icon: '\u{1F681}', caps: ['rides', 'fleet', 'location', 'pricing'] };
  if (!db.data.suppliers.find(s => s.code === 'IBIZAIR')) {
    db.data.suppliers.push({
      code: 'IBIZAIR', name: 'Ibiza Sky Charter', type: 'helikopter', city: 'Ibiza',
      loc: { lat: 38.872, lng: 1.373, label: 'Aeropuerto de Ibiza, helipad' }, rate: 0.1,
      menu: [], photos: [],
      settings: { tarief: { start: 900, perKm: 28, minimum: 1200 }, ritten: true, betaalVooraf: true },
      fleet: [
        { id: 'h1', name: 'Airbus H125 Ecureuil', model: 'H125', plate: 'EC-IBZ', seats: 5, active: true, thuisbasis: 'Ibiza Airport', bereikKm: 600, icoon: '\u{1F681}' },
        { id: 'h2', name: 'Bell 429', model: 'B429', plate: 'EC-SKY', seats: 6, active: true, thuisbasis: 'Marina Botafoch', bereikKm: 720, icoon: '\u{1F681}' }
      ],
      helipads: [
        { id: 'p-air', naam: 'Ibiza Airport helipad', plaats: 'Sant Josep' },
        { id: 'p-mar', naam: 'Marina Botafoch', plaats: 'Ibiza-stad' },
        { id: 'p-form', naam: 'Formentera (La Savina)', plaats: 'Formentera' }
      ]
    });
  }
  if (!db.data.huurFotos) db.data.huurFotos = {};       // ref -> { voor: [], na: [] } (los van de boeking: fotodata blijft uit de staat)
  if (!db.data.huurLocaties) db.data.huurLocaties = {}; // ref -> { aan, lat, lng, at } (vrijwillig gedeeld door de huurder)
  // het charter-genre: boten en jachten verhuren, met of zonder schipper. Zelfde
  // eerlijke mechaniek als autoverhuur (vaste prijs vooraf, staat met foto's voor
  // en na, borg, SOS en live positie op het water), aangevuld met vaartuig-specifieke
  // zaken: motoruren, brandstof, ligplaats, en bemand (crewed) of bareboat varen.
  if (!db.data.supplierTypes.charter)
    db.data.supplierTypes.charter = { label: 'Boten & jachten', icon: '\u{26F5}', caps: ['charter', 'location', 'pricing'] };
  if (!db.data.suppliers.find(s => s.code === 'AZUL')) {
    const vaartuig = (id, o) => Object.assign({ id, actief: true, type: 'Motorjacht', lengte: 12, bouwjaar: 2022,
      gasten: 8, hutten: 2, slaapplaatsen: 4, brandstof: 'diesel', snelheidKn: 25, ligplaats: 'Marina Botafoch',
      dagprijs: 900, borg: 2000, skipperVerplicht: false, skipperPrijsPerDag: 300, vaarbewijsVereist: true,
      icoon: '\u{1F6E5}️', foto: null }, o);
    db.data.suppliers.push({
      code: 'AZUL', name: 'Azul Yacht Charter', type: 'charter', city: 'Ibiza',
      loc: { lat: 38.918, lng: 1.449, label: 'Marina Botafoch, Ibiza' }, rate: 0.12,
      menu: [], photos: [],
      boten: [
        vaartuig('b1', { naam: 'Serenidad', type: 'Motorjacht', lengte: 16, gasten: 12, hutten: 3, slaapplaatsen: 6,
          snelheidKn: 32, dagprijs: 1850, borg: 3500, skipperVerplicht: true, skipperPrijsPerDag: 380 }),
        vaartuig('b2', { naam: 'Tramontana', type: 'Zeiljacht', lengte: 13, gasten: 8, hutten: 3, slaapplaatsen: 6,
          snelheidKn: 9, dagprijs: 680, borg: 1500, skipperVerplicht: false, skipperPrijsPerDag: 260 }),
        vaartuig('b3', { naam: 'Levante', type: 'RIB', lengte: 9, gasten: 10, hutten: 0, slaapplaatsen: 0,
          brandstof: 'benzine', snelheidKn: 42, dagprijs: 520, borg: 1200, skipperVerplicht: false, skipperPrijsPerDag: 240 }),
        vaartuig('b4', { naam: 'Aura', type: 'Catamaran', lengte: 14, gasten: 12, hutten: 4, slaapplaatsen: 8,
          snelheidKn: 12, dagprijs: 1300, borg: 2800, skipperVerplicht: true, skipperPrijsPerDag: 320 })
      ]
    });
  }
  if (!db.data.charterFotos) db.data.charterFotos = {};   // ref -> { voor: [], na: [] }
};

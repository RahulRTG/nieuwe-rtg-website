/* Standaardwaarden voor elk partnerbedrijf: lege collecties, sector-specifieke
   velden (kamers/deuren/minibar, tafels, events, vloot+tarief), de ledenprijs-
   garantie op de menukaart en het verplichte Salon-profiel. Draait bij het
   opstarten (migratie van bestaande zaken) en voor elke nieuw goedgekeurde
   partner. Afgesplitst uit server.js; db en ledenPrijs komen via de context. */
module.exports = ({ db, ledenPrijs }) => {
function ensureSupplierDefaults(s) {
  if (!Array.isArray(s.menu)) s.menu = [];
  // De ophaal/bezorgdienst: horeca en zelfstandigen kunnen een eigen
  // bezorg-assortiment voeren, los van de menukaart ter plaatse.
  if (!s.bezorg || typeof s.bezorg !== 'object') s.bezorg = { aan: false, ophalen: true, bezorgen: true, producten: [] };
  if (s.type === 'activiteit' && !Array.isArray(s.activiteiten)) s.activiteiten = [];
  // de eigen transferdienst: prijs 0 = inclusief bij het ticket, anders het
  // afgesproken vaste bedrag per rit
  if (s.type === 'activiteit' && (!s.transfer || typeof s.transfer !== 'object')) s.transfer = { aan: false, prijs: 0 };
  if (s.type === 'verhuur' && !Array.isArray(s.autos)) s.autos = [];
  if (s.type === 'charter' && !Array.isArray(s.boten)) s.boten = [];
  if (s.type === 'vastgoed' && !Array.isArray(s.panden)) s.panden = [];
  if (s.type === 'groothandel' && (!s.groothandel || typeof s.groothandel !== 'object')) s.groothandel = { functies: {}, producten: [] };
  if (!Array.isArray(s.bezorg.producten)) s.bezorg.producten = [];
  if (!Array.isArray(s.photos)) s.photos = [];
  if ((s.type === 'hotel' || s.type === 'apartment') && !Array.isArray(s.rooms)) s.rooms = [];
  if (s.type === 'apartment' && !Array.isArray(s.doors)) s.doors = [];
  if ((s.type === 'hotel' || s.type === 'apartment') && !Array.isArray(s.minibar))
    s.minibar = [
      { id: 'mb1', name: 'Mineraalwater', price: 5 },
      { id: 'mb2', name: 'Frisdrank', price: 6 },
      { id: 'mb3', name: 'Mini-drank', price: 12 },
      { id: 'mb4', name: 'Snack', price: 7 }
    ];
  for (const r of (s.rooms || [])) if (!r.hk) r.hk = { status: 'schoon' };
  if (!s.settings) s.settings = { ordersOpen: true, reservationsOpen: true };
  // land van het bedrijf (voor btw, alcoholgrens en het zoeken op land in de
  // RTFoundation-vacatures). RTG is internationaal; onze demopartners staan op
  // Ibiza en horen dus bij Spanje.
  if (!s.settings.land) s.settings.land = /ibiza|spanje|spain|españa/i.test(s.city || '') ? 'ES' : 'NL';
  const caps = ((db.data.supplierTypes || {})[s.type] || {}).caps || [];
  if (caps.includes('menu') && !Array.isArray(s.tables))
    s.tables = [1, 2, 3, 4, 5, 6].map(n => ({ id: 't' + n, name: 'Tafel ' + n, seats: n % 3 === 0 ? 6 : n % 2 === 0 ? 4 : 2, status: 'vrij' }));
  // horecazaken kunnen events organiseren (het Kantoor maakt ze, leden melden zich aan)
  if (['restaurant', 'bar', 'club'].includes(s.type) && !Array.isArray(s.events)) s.events = [];
  if (['restaurant', 'bar', 'club'].includes(s.type) && !s.dailyMeps) s.dailyMeps = {}; // dagelijkse mise en place (a la carte)
  for (const e of (s.events || [])) {
    if (!Array.isArray(e.runsheet)) e.runsheet = [];
    for (const it of e.runsheet) if (typeof it.daysBefore !== 'number') it.daysBefore = 0;
    if (!e.catering) e.catering = { mode: 'geen', itemIds: [], note: '' };
    if (!Array.isArray(e.allergies)) e.allergies = [];
  }
  // elk gerecht hoort bij een werkplek: de keuken of de bar; de manager kan
  // dit per item omzetten onder Menu. Bars/clubs bereiden standaard aan de bar.
  for (const m of (s.menu || [])) {
    // ledenprijsgarantie: publieke prijs als referentie, ledenprijs nooit hoger
    if (typeof m.publiekePrijs !== 'number' || m.publiekePrijs < 0) m.publiekePrijs = Math.max(0, Number(m.price) || 0);
    m.price = ledenPrijs(m.publiekePrijs, m.price);
    if (m.station !== 'keuken' && m.station !== 'bar')
      m.station = (s.type === 'bar' || s.type === 'club') ? 'bar' : 'keuken';
    // binnen de keuken: de sectie (warme kant, koude kant, snacks, dessert)
    if (m.station === 'keuken' && !['warm', 'koud', 'snack', 'dessert'].includes(m.sectie)) {
      const t = ((m.cat || '') + ' ' + (m.name || '') + ' ' + (m.desc || '')).toLowerCase();
      m.sectie = /dessert|zoet|wagashi|matcha|ijs|patisserie|sweet|taart/.test(t) ? 'dessert'
        : /sashimi|salade|koud|tartaar|carpaccio|oester|ceviche/.test(t) ? 'koud'
        : /snack|bites|friet|fries|nacho|bitterbal|kroket/.test(t) ? 'snack' : 'warm';
    }
  }
  if (typeof s.rate !== 'number') s.rate = 0.12;
  // vervoerders: een vloot en een tarief, zodat elke rit direct een vaste
  // nettoprijs krijgt en het kantoor voertuigen aan chauffeurs kan koppelen
  const caps2 = (db.data.supplierTypes[s.type] || {}).caps || [];
  if (caps2.includes('rides')) {
    if (!Array.isArray(s.fleet)) s.fleet = s.type === 'jet'
      ? [{ id: 'v1', name: 'Cessna Citation XLS', plate: 'PH-RTG', seats: 8, active: true },
         { id: 'v2', name: 'Embraer Phenom 300', plate: 'PH-RTE', seats: 9, active: true }]
      : [{ id: 'v1', name: 'Mercedes S-klasse', plate: 'RT-01-GX', seats: 3, active: true },
         { id: 'v2', name: 'Mercedes V-klasse', plate: 'RT-02-GX', seats: 6, active: true }];
    s.settings = s.settings || {};
    if (!s.settings.tarief) s.settings.tarief = s.type === 'jet'
      ? { start: 0, perKm: 9, minimum: 7500 }
      : { start: 15, perKm: 2.4, minimum: 25 };
  }
  // verplicht onderdeel van elk RTG-partnerschap: een bedrijfsaccount op De
  // Salon, met volgers en marketinggereedschap (folders, aanbiedingen, polls)
  if (!s.salon) s.salon = { bio: '', foto: null, volgers: [], sinds: new Date().toISOString() };
  if (!Array.isArray(s.salon.volgers)) s.salon.volgers = [];
  // De ondernemer-poort: bestaande zaken zijn online (undefined telt als aan);
  // alleen een nieuw goedgekeurde partner krijgt online === false meegegeven en
  // moet eerst door de poort (Salon-pagina + rondleidingen). De rondleiding-
  // stempels leven hier zodat de app ze kan aftikken.
  if (s.online === undefined) s.online = true;
  if (!s.rondleiding || typeof s.rondleiding !== 'object') s.rondleiding = {};
}
  return ensureSupplierDefaults;
};

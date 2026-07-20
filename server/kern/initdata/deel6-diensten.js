/* Boot-datalaag, deel 6/7 (diensten): een aaneengesloten blok
   db.data-standaarden/demo-seed uit initRealtime. Afgesplitst uit server.js; de
   context levert db, save en de seed-helpers. Draait in vaste volgorde via ./index. */
module.exports = (ctx) => {
  const { db, save, crypto, sessions, tokenHash, ensureSupplierDefaults, webpush, DEMO, PERSONAS, GIDS_SEED_TIERS } = ctx;

  /* ---- de hulpdiensten: zes korpsen op dezelfde motor (kern/hulpdienst.js),
     met de meldkamer als klantenservice-room. Special forces zijn besloten:
     alleen de politie kan ze om bijstand vragen. Per korps een demokorps met
     eenheden over land, water en door de lucht. ---- */
  const HULP_TYPES = require('../hulpdienst').HULP_TYPES;
  for (const [t, def] of Object.entries(HULP_TYPES)) if (!db.data.supplierTypes[t]) db.data.supplierTypes[t] = def;
  const ZORG_TYPES = require('../zorgketen').ZORG_TYPES;
  for (const [t, def] of Object.entries(ZORG_TYPES)) if (!db.data.supplierTypes[t]) db.data.supplierTypes[t] = def;
  const DEF_TYPES = require('../defensie').DEF_TYPES;
  for (const [t, def] of Object.entries(DEF_TYPES)) if (!db.data.supplierTypes[t]) db.data.supplierTypes[t] = def;
  const HULP_KORPSEN = [
    { code: 'GUARDIA', name: 'Politie Ibiza', type: 'politie', city: 'Ibiza', loc: { lat: 38.912, lng: 1.438, label: 'Ibiza-stad' }, rate: 0, menu: [],
      hulpEenheden: [['Noodhulp 11', 'land'], ['Noodhulp 12', 'land'], ['Politieheli PH-1', 'heli'], ['Vliegdienst PV-2', 'lucht'], ['Patrouillevaartuig P-9', 'water']] },
    { code: 'BOMBERS', name: 'Brandweer Ibiza', type: 'brandweer', city: 'Ibiza', loc: { lat: 38.906, lng: 1.42, label: 'Kazerne Eivissa' }, rate: 0, menu: [],
      hulpEenheden: [['Autospuit TS-1', 'land'], ['Ladderwagen AL-2', 'land'], ['Blusboot B-1', 'water'], ['Blusvliegtuig BV-1', 'lucht']] },
    { code: 'URGENCIA', name: 'Ambulance Ibiza', type: 'ambulance', city: 'Ibiza', loc: { lat: 38.917, lng: 1.443, label: 'Post Can Misses' }, rate: 0, menu: [],
      hulpEenheden: [['Ambulance A-1', 'land'], ['Ambulance A-2', 'land'], ['Traumaheli LF-1', 'heli']] },
    { code: 'CANMISSES', name: 'Ziekenhuis Can Misses', type: 'ziekenhuis', city: 'Ibiza', loc: { lat: 38.916, lng: 1.425, label: 'Can Misses' }, rate: 0, menu: [] },
    { code: 'CONSULTA', name: 'Huisartsen Es Vive', type: 'huisarts', city: 'Ibiza', loc: { lat: 38.9, lng: 1.44, label: 'Es Vive' }, rate: 0, menu: [] },
    { code: 'FALCO', name: 'Eenheid Falco', type: 'specials', city: 'Ibiza', loc: { lat: 38.88, lng: 1.4, label: 'besloten locatie' }, rate: 0, menu: [],
      hulpEenheden: [['Team Alfa', 'land'], ['Team Bravo', 'land'], ['Heli Falco-1', 'heli'], ['Interventievaartuig F-3', 'water']] },
    { code: 'FARMACIA', name: 'Farmacia del Port', type: 'apotheek', city: 'Ibiza', loc: { lat: 38.91, lng: 1.433, label: 'de haven, Ibiza-stad' }, rate: 0, menu: [] },
    { code: 'CARDIO', name: 'Specialisten Ibiza', type: 'specialist', city: 'Ibiza', loc: { lat: 38.915, lng: 1.427, label: 'bij Can Misses' }, rate: 0, menu: [] },
    { code: 'ESTETICA', name: 'Clinica Estetica', type: 'beautymedical', city: 'Ibiza', loc: { lat: 38.909, lng: 1.44, label: 'Marina Botafoch' }, rate: 0, menu: [] },
    { code: 'GARNIZOEN', name: 'Garnizoen Baleares (demo)', type: 'defensie', city: 'Ibiza', loc: { lat: 38.87, lng: 1.32, label: 'kazerne (besloten)' }, rate: 0, menu: [],
      defEenheden: [['1e Genie-compagnie', 'genie', 'gevechtsgereed', 120], ['Logistiek peloton', 'logistiek', 'beperkt', 40], ['Geneeskundig detachement', 'geneeskundig', 'gevechtsgereed', 25]],
      defMaterieel: [['Bergingsvoertuig', 'voertuig', 'inzetbaar'], ['Transportvaartuig', 'vaartuig', 'in-onderhoud'], ['Veldhospitaal-set', 'medisch', 'inzetbaar'], ['Verbindingswagen', 'verbinding', 'inzetbaar']] }
  ];
  for (const p of HULP_KORPSEN) {
    const { hulpEenheden, defEenheden, defMaterieel, ...zaak } = p;
    if (!db.data.suppliers.find(s => s.code === zaak.code)) { db.data.suppliers.push(zaak); ensureSupplierDefaults(zaak); }
    if (hulpEenheden) {
      if (!db.data.hulp) db.data.hulp = {};
      if (!db.data.hulp.eenheden) db.data.hulp.eenheden = {};
      if (!Array.isArray(db.data.hulp.eenheden[zaak.code]) || !db.data.hulp.eenheden[zaak.code].length) {
        db.data.hulp.eenheden[zaak.code] = hulpEenheden.map(([naam, soort], i) => ({ id: 'he' + i + zaak.code.toLowerCase(), naam, soort, status: 'vrij' }));
      }
    }
    // de defensie-demozaak krijgt eenheden en materieel om mee te oefenen
    if (defEenheden || defMaterieel) {
      if (!db.data.defensie) db.data.defensie = {};
      if (!db.data.defensie[zaak.code]) {
        db.data.defensie[zaak.code] = {
          eenheden: (defEenheden || []).map(([naam, soort, paraat, sterkte], i) => ({ id: 'de' + i + zaak.code.toLowerCase(), naam, soort, paraat, reden: '', sterkte, at: Date.now() })),
          materieel: (defMaterieel || []).map(([naam, soort, staat], i) => ({ id: 'dm' + i + zaak.code.toLowerCase(), naam, soort, kenmerk: '', staat, notitie: '', at: Date.now() })),
          bevoorrading: [], oefeningen: []
        };
      }
    }
  }
  if (!db.data.hulp) db.data.hulp = {};
  if (!db.data.hulp.bedden) db.data.hulp.bedden = {};
  if (!db.data.hulp.bedden.CANMISSES) db.data.hulp.bedden.CANMISSES = { totaal: 24, bezet: 0 };

  // De Salon is verplicht: geef elke geseede partner een compleet profiel (bio +
  // foto), zodat ze aan leden worden getoond. Dit draait NA alle genre-seeds,
  // zodat ook vastgoed, retail en charter meelopen. Een echte partner vult dit
  // zelf in via de leverancier-app.
};

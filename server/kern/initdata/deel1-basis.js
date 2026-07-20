/* Boot-datalaag, deel 1/7 (basis): een aaneengesloten blok
   db.data-standaarden/demo-seed uit initRealtime. Afgesplitst uit server.js; de
   context levert db, save en de seed-helpers. Draait in vaste volgorde via ./index. */
module.exports = (ctx) => {
  const { db, save, crypto, sessions, tokenHash, ensureSupplierDefaults, webpush, DEMO, PERSONAS, GIDS_SEED_TIERS } = ctx;
  if (!db.data.sessions) db.data.sessions = {};
  // migratie: sessies van voor de token-hashing (ruwe tokens, 48 tekens)
  // worden eenmalig omgezet naar hun sha256-sleutel, zodat niemand uitlogt
  let migrated = false;
  for (const [t, s] of Object.entries(db.data.sessions)) {
    if (t.length !== 64) { db.data.sessions[tokenHash(t)] = s; delete db.data.sessions[t]; migrated = true; }
  }
  if (migrated) save();
  for (const [t, s] of Object.entries(db.data.sessions)) if (!sessions.has(t)) sessions.set(t, s);
  if (!db.data.notifications) db.data.notifications = { rtg: [], lifestyle: [], business: [] };
  if (!db.data.pushSubs) db.data.pushSubs = { rtg: [], lifestyle: [], business: [] };
  if (!db.data.pushSubsUser) db.data.pushSubsUser = {}; // per account: userId -> [subscriptions]
  if (!db.data.supplierNotifications) db.data.supplierNotifications = {};
  if (!db.data.supplierActivity) db.data.supplierActivity = {};   // wie deed wat, per bedrijf
  if (!db.data.supplierTeam) db.data.supplierTeam = {};           // interne teamchat, per bedrijf
  if (!db.data.collegaChats) db.data.collegaChats = {};           // 1-op-1 berichten tussen collega's, per bedrijf
  if (!db.data.live) db.data.live = {};                           // live "onderweg"-toestand per lid (customerKey)
  if (!db.data.partnerApplications) db.data.partnerApplications = []; // bedrijven die partner willen worden
  // sector-features: elke partner een fotopagina, hotels/appartementen kamers
  for (const s of db.data.suppliers) ensureSupplierDefaults(s);
  if (!db.data.minibarCounts) db.data.minibarCounts = {};          // minibartellingen per bedrijf
  if (!db.data.tickets) db.data.tickets = {};                      // klussen/onderhoud per bedrijf
  if (!db.data.lostfound) db.data.lostfound = {};                  // gevonden voorwerpen per bedrijf
  // de ervaring-laag (kern/ervaring.js): reserveringen, reviews, favorieten,
  // punten, splitsen, wachtlijsten en meldingsvoorkeuren
  if (!db.data.reserveringen) db.data.reserveringen = [];          // tafelreserveringen
  if (!db.data.reviews) db.data.reviews = [];                      // beoordelingen (1-5)
  if (!db.data.reviewStats) db.data.reviewStats = {};              // code -> { som, aantal } (O(1)-gemiddelde)
  if (!db.data.favorieten) db.data.favorieten = {};                // sleutel -> [leverancierscodes]
  if (!db.data.punten) db.data.punten = {};                        // sleutel -> { saldo, tegoed, historie }
  if (!db.data.splitsen) db.data.splitsen = [];                    // gesplitste rekeningen (betaalverzoeken)
  if (!db.data.wachtlijsten) db.data.wachtlijsten = [];            // wachtlijsten voor volle events/tijdsloten
  if (!db.data.meldingVoorkeur) db.data.meldingVoorkeur = {};      // sleutel/tier -> { scope: bool }
  // de retail-/mode-laag (kern/retail.js): apart gelegde artikelen, paskamer-
  // verzoeken en stylingvoorstellen (collecties, artikelen en clienteling staan
  // op de leverancier zelf: s.collecties/s.artikelen/s.klanten)
  if (!db.data.retailApart) db.data.retailApart = [];             // apart gelegde varianten per klant
  if (!db.data.paskamerVerzoeken) db.data.paskamerVerzoeken = []; // maat naar een paskamer brengen
  if (!db.data.stylingVoorstellen) db.data.stylingVoorstellen = []; // stylist -> app van de klant
  if (!db.data.paspoortVerzoeken) db.data.paspoortVerzoeken = [];   // identiteitsverzoeken van partners
  if (!db.data.paspoortIncidenten) db.data.paspoortIncidenten = []; // opgeeiste inzage bij incidenten (RTG beoordeelt)
  if (!db.data.paspoortLog) db.data.paspoortLog = [];               // volledig audit-log van alle inzages
  // (kamers, instellingen en tafels zitten in ensureSupplierDefaults)
  // oudere databases: appartement-partner en doors-cap toevoegen
  if (db.data.supplierTypes.apartment && !db.data.supplierTypes.apartment.caps.includes('doors'))
    db.data.supplierTypes.apartment.caps.splice(1, 0, 'doors');
  // oudere databases: horeca en nachtzaken verkopen nu ook tickets (pre-order via de app, deurverkoop via de PDA)
  for (const t of ['restaurant', 'bar', 'club', 'beachclub']) {
    const def = db.data.supplierTypes[t];
    if (def && !def.caps.includes('tickets')) def.caps.push('tickets');
  }
  if (!db.data.suppliers.find(s => s.code === 'SAKURA')) {
    db.data.suppliers.push({
      code: 'SAKURA', name: 'Villa Bahia Ibiza', type: 'apartment', city: 'Ibiza',
      loc: { lat: 38.876, lng: 1.325, label: 'Cala Jondal, Ibiza' }, rate: 0.12,
      menu: [], photos: [],
      rooms: [
        { id: 'a1', name: 'Casa Mar, zeezijde', desc: '65 m², eigen entree, plunge pool', price: 430, available: true },
        { id: 'a2', name: 'Casa Jardin, tuinzijde', desc: '90 m², twee slaapkamers, terras', price: 560, available: true }
      ],
      doors: [
        { id: 'd1', name: 'Voordeur (oprit)', locked: true },
        { id: 'd2', name: 'Casa Mar', locked: true },
        { id: 'd3', name: 'Casa Jardin', locked: true },
        { id: 'd4', name: 'Poolhouse', locked: true }
      ]
    });
  }
  if (!db.data.posSales) db.data.posSales = {};                   // kassaverkopen per bedrijf
  // het zzp-genre: zelfstandige professionals (mode, health, fotografie...)
  // bieden diensten en producten aan; leden boeken met datum en tijd
  if (!db.data.supplierTypes.zzp)
    db.data.supplierTypes.zzp = { label: 'Zelfstandig professional', icon: '🧑‍🎨', caps: ['services', 'location', 'pricing'] };
  if (!db.data.boekingen) db.data.boekingen = [];
  if (!db.data.suppliers.find(s => s.code === 'AYAKA')) {
    db.data.suppliers.push({
      code: 'AYAKA', name: 'Atelier Marfil', type: 'zzp', city: 'Ibiza', vak: 'Sieraden & goudsmid',
      loc: { lat: 38.909, lng: 1.435, label: 'Dalt Vila, Ibiza' }, rate: 0.1,
      menu: [], photos: [],
      services: [
        { id: 's1', name: 'Sieraad op maat, ontwerpsessie', desc: 'Twee uur in het atelier of op de suite, incl. schetsontwerp', price: 240, duurMin: 120, soort: 'dienst' },
        { id: 's2', name: 'Gouden ring, handgesmeed', desc: 'Op maat gesmeed, binnen de vakantie geleverd', price: 520, duurMin: 360, soort: 'dienst' },
        { id: 's3', name: 'Zilveren hanger, uit voorraad', desc: 'Uit eigen atelier, geleverd op de suite', price: 85, soort: 'product' }
      ]
    });
  }
  if (!db.data.suppliers.find(s => s.code === 'KAITO')) {
    db.data.suppliers.push({
      code: 'KAITO', name: 'Studio Milan', type: 'zzp', city: 'Ibiza', vak: 'Health & wellness',
      loc: { lat: 38.972, lng: 1.416, label: 'Ibiza-stad, haven' }, rate: 0.1,
      menu: [], photos: [],
      services: [
        { id: 's1', name: 'Personal training, privesessie', desc: 'In de hotelgym of buiten, incl. programma op maat', price: 110, duurMin: 60, soort: 'dienst' },
        { id: 's2', name: 'Sportmassage, 60 minuten', desc: 'Op de kamer; tafel en olien inbegrepen', price: 95, duurMin: 60, soort: 'dienst' },
        { id: 's3', name: 'Voedingsplan op maat, per week', desc: 'Afgestemd op reisschema en de keukens onderweg', price: 150, soort: 'product' }
      ]
    });
  }
  // het activiteiten-genre: tours, musea en experiences verkopen tickets met
  // tijdsloten en capaciteit; personeel (gids/security/balie) checkt de
  // entreecode af aan de deur, op eigen naam
  if (!db.data.supplierTypes.activiteit)
    db.data.supplierTypes.activiteit = { label: 'Activiteiten & musea', icon: '\u{1F39F}\uFE0F', caps: ['tickets', 'rides', 'location', 'pricing'] };
  // eigen transferdienst: activiteitenzaken rijden ook (migratie voor bestaande kasten)
  if (db.data.supplierTypes.activiteit && !db.data.supplierTypes.activiteit.caps.includes('rides'))
    db.data.supplierTypes.activiteit.caps.push('rides');
  if (!db.data.suppliers.find(s => s.code === 'ESVEDRA')) {
    db.data.suppliers.push({
      code: 'ESVEDRA', name: 'Es Vedra Cruises', type: 'activiteit', city: 'Ibiza',
      loc: { lat: 38.867, lng: 1.196, label: 'Cala d\'Hort, Ibiza' }, rate: 0.14,
      menu: [], photos: [],
      activiteiten: [
        { id: 'a1', name: 'Sunset cruise met cava', desc: 'Twee uur varen langs Es Vedra, cava en tapas aan boord.', prijs: 79, capaciteit: 24, duur: '2 uur', tijden: ['17:30', '19:30'] },
        { id: 'a2', name: 'Snorkeltocht drie baaien', desc: 'Kleine boot, maximaal tien gasten, materiaal inbegrepen.', prijs: 55, capaciteit: 10, duur: '3 uur', tijden: ['10:00', '14:00'] }
      ]
    });
  }
};

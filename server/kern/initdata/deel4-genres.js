/* Boot-datalaag, deel 4/7 (genres): een aaneengesloten blok
   db.data-standaarden/demo-seed uit initRealtime. Afgesplitst uit server.js; de
   context levert db, save en de seed-helpers. Draait in vaste volgorde via ./index. */
module.exports = (ctx) => {
  const { db, save, crypto, sessions, tokenHash, ensureSupplierDefaults, webpush, DEMO, PERSONAS, GIDS_SEED_TIERS } = ctx;
  if (!db.data.suppliers.find(s => s.code === 'AEGIS')) {
    db.data.suppliers.push({
      code: 'AEGIS', name: 'Aegis Elite Security', type: 'beveiliging', city: 'Ibiza',
      loc: { lat: 38.909, lng: 1.432, label: 'Passeig de Vara de Rey, Ibiza' }, rate: 0.10,
      menu: [], photos: [],
      beveiliging: {
        functies: {},   // wordt met de standaard (alles aan) door de kern gevuld
        budget: { periodeUren: 720, tariefUur: 55 },
        posten: [
          { id: crypto.randomBytes(4).toString('hex'), naam: 'Villa Cala Jondal', adres: 'Cala Jondal, Ibiza', klant: 'Privé-residentie', lat: 38.876, lng: 1.383, minMan: 2, shifts: ['dag', 'avond', 'nacht'], orders: 'Toegang alleen op gastenlijst. Ronde elk uur langs het strandhek.', actief: true },
          { id: crypto.randomBytes(4).toString('hex'), naam: 'Marina Botafoch VIP', adres: 'Marina Botafoch, Ibiza', klant: 'Jachthaven', lat: 38.918, lng: 1.451, minMan: 1, shifts: ['avond', 'nacht'], orders: 'Steiger 3 t/m 7. Let op onbevoegden bij de jachten.', actief: true },
          { id: crypto.randomBytes(4).toString('hex'), naam: 'Event Ushuaïa', adres: 'Platja d\'en Bossa, Ibiza', klant: 'Evenement', lat: 38.884, lng: 1.408, minMan: 3, shifts: ['avond', 'nacht'], orders: 'Fouilleren bij de hoofdingang. Backstage streng afgeschermd.', actief: true }
        ]
      }
    });
  }
  // --- boerderij: boeren en tuinders met een slim bedrijfssysteem + AI-adviseur ---
  if (!db.data.supplierTypes.boerderij)
    db.data.supplierTypes.boerderij = { label: 'Boerderij & landbouw', icon: '\u{1F69C}', caps: ['boerderij', 'location', 'pricing'] };
  if (!db.data.suppliers.find(s => s.code === 'CANFERRER')) {
    const dag = n => new Date(Date.now() - n * 86400000).toISOString();
    db.data.suppliers.push({
      code: 'CANFERRER', name: 'Finca Can Ferrer', type: 'boerderij', city: 'Ibiza',
      loc: { lat: 39.033, lng: 1.435, label: 'Santa Agnes de Corona, Ibiza' }, rate: 0.05,
      menu: [], photos: [],
      boerderij: {
        type: 'gemengd', opgezet: true, instel: {},
        percelen: [
          { id: 'pc-tarwe', naam: 'Bovenveld', ha: 6.5, gewas: 'tarwe', gezaaidOp: dag(200), oogstVerwacht: new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10), geoogstOp: null, opbrengst: 0 },
          { id: 'pc-mais', naam: 'Rivierakker', ha: 4, gewas: 'mais', gezaaidOp: dag(155), oogstVerwacht: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), geoogstOp: null, opbrengst: 0 },
          { id: 'pc-kas', naam: 'Kasblok 1', ha: 0.8, gewas: 'tomaat', gezaaidOp: dag(40), oogstVerwacht: new Date(Date.now() + 50 * 86400000).toISOString().slice(0, 10), geoogstOp: null, opbrengst: 0, laatsteWater: dag(3) },
          { id: 'pc-braak', naam: 'Onderveld', ha: 3.2, gewas: null, gezaaidOp: null, oogstVerwacht: null, geoogstOp: null, opbrengst: 0 }
        ],
        dieren: [
          { id: 'dr-koe', soort: 'melkkoe', aantal: 42, stal: 'Stal A', gezondheid: 'goed', laatsteVoer: dag(1) },
          { id: 'dr-kip', soort: 'legkip', aantal: 180, stal: 'Kippenren', gezondheid: 'goed' },
          { id: 'dr-schaap', soort: 'schaap', aantal: 25, stal: 'Weide zuid', gezondheid: 'aandacht' }
        ],
        taken: [
          { id: 'tk-1', wat: 'Rivierakker maisoogst starten', waar: 'Rivierakker', voor: new Date().toISOString().slice(0, 10), klaar: false, at: dag(2) },
          { id: 'tk-2', wat: 'Dierenarts bellen voor de schapen', waar: 'Weide zuid', voor: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), klaar: false, at: dag(1) }
        ]
      }
    });
  }
  // --- content creators: influencers/videomakers met een carriere-app ---
  if (!db.data.supplierTypes.creator)
    db.data.supplierTypes.creator = { label: 'Content creator', icon: '\u{1F3AC}', caps: ['creator', 'location', 'pricing'] };
  if (!db.data.suppliers.find(s => s.code === 'LUMINA')) {
    db.data.suppliers.push({
      code: 'LUMINA', name: 'Lumina Media', type: 'creator', city: 'Ibiza',
      loc: { lat: 38.909, lng: 1.434, label: 'Ibiza' }, rate: 0.10, menu: [], photos: [],
      creator: {
        opgezet: true, niche: 'Reizen & lifestyle', bio: 'Ik maak cinematische reiscontent over Ibiza en het eiland-leven.',
        platforms: [
          { id: 'pf1', platform: 'instagram', handle: '@lumina.travels', volgers: 84000 },
          { id: 'pf2', platform: 'tiktok', handle: '@luminatravels', volgers: 152000 },
          { id: 'pf3', platform: 'youtube', handle: 'Lumina Media', volgers: 41000 }
        ],
        tarieven: [
          { id: 'tr1', soort: 'reel', prijs: 850 },
          { id: 'tr2', soort: 'video', prijs: 2400 },
          { id: 'tr3', soort: 'story', prijs: 300 }
        ],
        portfolio: [
          { id: 'po1', titel: 'Sunset sailing Ibiza', link: null, soort: 'video' },
          { id: 'po2', titel: 'Beach club reel', link: null, soort: 'reel' }
        ],
        ideeen: [
          { id: 'id1', tekst: 'Verborgen strandjes van Ibiza', status: 'productie', voor: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), script: null, at: new Date().toISOString() },
          { id: 'id2', tekst: 'Een dag met een lokale visser', status: 'idee', voor: null, script: null, at: new Date().toISOString() }
        ]
      }
    });
  }
  if (!db.data.vastgoedAanbod) db.data.vastgoedAanbod = [];   // { ref, supplierCode, pandId, aanKeys:[], publiek, at }
  if (!db.data.bezichtigingen) db.data.bezichtigingen = [];   // { ref, supplierCode, pandId, key, codename, wens, status, moment, keyless, at }
  if (!db.data.biedingen) db.data.biedingen = [];             // { ref, supplierCode, pandId, key, codename, bedrag, status, tegenbod, at }

  // Salon-connecties: leden vinden elkaar op codenaam, chatten en bellen 1-op-1
  if (!db.data.connections) db.data.connections = [];              // { a, b, requestedBy, status, at }
  if (!db.data.memberChats) db.data.memberChats = {};              // 'sleutelA|sleutelB' -> { messages, read }
  if (!db.data.memberDir) db.data.memberDir = {};                  // sleutel -> { codename, tier }
  for (const t of GIDS_SEED_TIERS)
    if (!db.data.memberDir[t]) db.data.memberDir[t] = { codename: PERSONAS[t].codename, tier: t };
  if (!db.data.guestChats) db.data.guestChats = {};               // gastchats: lid <-> partner (roomservice, eigenaar)
  if (!db.data.trustLine) db.data.trustLine = [];                  // vertrouwenslijn: staflid <-> RTG-vertrouwenspersoon (werkgever ziet niets)
  if (!db.data.giftcards) db.data.giftcards = [];                  // cadeaukaarten per zaak (btw pas bij inwisseling)
  if (!db.data.verlof) db.data.verlof = {};                        // verlofaanvragen en ziekmeldingen per bedrijf
  if (!db.data.klok) db.data.klok = {};                            // in- en uitkloktijden per bedrijf
  if (!db.data.applications) db.data.applications = {};            // sollicitaties per bedrijf
  if (!db.data.vacatures) db.data.vacatures = {};                  // openstaande vacatures per bedrijf (ook zichtbaar in de RTFoundation)
  if (!db.data.applyChats) db.data.applyChats = {};                // chat tussen sollicitant en werkgever (na uitnodigen/aannemen)
  if (!db.data.onboarding) db.data.onboarding = { scopes: {}, profielen: {} }; // verplichte intake + contract per scope (platform 'rtg' of leverancier-code)
  if (!db.data.snaps) db.data.snaps = [];                          // Snapchat-achtige snaps: foto die na bekijken verdwijnt
  if (!db.data.stories) db.data.stories = [];                      // 24-uurs verhalen, zichtbaar voor vrienden
  if (!db.data.blocks) db.data.blocks = [];                        // { door, doel, at } geblokkeerde codenamen (beide kanten dicht)
  if (!db.data.reports) db.data.reports = [];                      // { door, doel, reden, at } meldingen van misbruik voor de backoffice
  if (!db.data.cvs) db.data.cvs = {};                               // cv per lid (cv-builder in de leden-app)
  if (webpush) {
    if (!db.data.vapid) {
      db.data.vapid = webpush.generateVAPIDKeys();
      save();
    }
    webpush.setVapidDetails('mailto:leden@rahultravelgroup.example', db.data.vapid.publicKey, db.data.vapid.privateKey);
  }
};

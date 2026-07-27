/* Boot-datalaag, deel 9 (data): de demo-zaken van de vakmannen-golf, elk op
   de vakwerk-motor (services + boekingen). Pure data; deel9-vakken.js zaait
   ze met het ensure-patroon. Prijzen in euro; duurMin stuurt de tijdvakken. */
module.exports = [
  { code: 'TALLER', name: 'Taller Ibiza Motors', type: 'autogarage', city: 'Ibiza',
    vak: 'Onderhoud, APK & banden',
    loc: { lat: 38.912, lng: 1.425, label: 'Poligono Can Bufi, Ibiza' }, rate: 0.1, menu: [], photos: [],
    services: [
      { id: 'g1', name: 'APK-keuring', desc: 'Keuring met rapport; kleine reparaties direct in overleg.', price: 45, duurMin: 45, soort: 'dienst' },
      { id: 'g2', name: 'Kleine onderhoudsbeurt', desc: 'Olie, filters en controlepunten volgens het boekje.', price: 189, duurMin: 120, soort: 'dienst' },
      { id: 'g3', name: 'Banden wisselen, per set', desc: 'Inclusief balanceren; banden in overleg besteld.', price: 60, duurMin: 60, soort: 'dienst' },
      { id: 'g4', name: 'Storing uitlezen & diagnose', desc: 'Uitlezen, proefrit en een eerlijk advies vooraf.', price: 75, duurMin: 60, soort: 'dienst' },
      { id: 'g5', name: 'Haal- en brengservice', desc: 'Wij halen de auto op en brengen hem klaar terug.', price: 25, duurMin: 30, soort: 'dienst' }
    ] },
  { code: 'BRILLA', name: 'Brilla Schoonmaak', type: 'schoonmaak', city: 'Ibiza',
    vak: 'Huis- en villaschoonmaak',
    loc: { lat: 38.905, lng: 1.43, label: 'Ibiza-stad en omgeving' }, rate: 0.1, menu: [], photos: [],
    services: [
      { id: 'sc1', name: 'Schoonmaak aan huis, per uur', desc: 'Vast team, eigen middelen, altijd dezelfde gezichten.', price: 32, duurMin: 60, soort: 'dienst' },
      { id: 'sc2', name: 'Eindschoonmaak verhuurvilla', desc: 'Wisseldag-klaar: linnengoed, keuken, terras en zwembadrand.', price: 140, duurMin: 180, soort: 'dienst' },
      { id: 'sc3', name: 'Dieptereiniging keuken', desc: 'Apparatuur, kasten en afzuiging grondig onder handen.', price: 95, duurMin: 120, soort: 'dienst' },
      { id: 'sc4', name: 'Ramen binnen en buiten', desc: 'Streeploos, ook op hoogte met eigen materiaal.', price: 55, duurMin: 90, soort: 'dienst' }
    ] },
  { code: 'VERDIA', name: 'Verdia Tuinen', type: 'hovenier', city: 'Ibiza',
    vak: 'Hovenier & tuinonderhoud',
    loc: { lat: 38.96, lng: 1.41, label: 'Sant Rafel, Ibiza' }, rate: 0.1, menu: [], photos: [],
    services: [
      { id: 'h1', name: 'Tuinonderhoud, per uur', desc: 'Snoeien, borders en gazon; groenafval nemen we mee.', price: 48, duurMin: 60, soort: 'dienst' },
      { id: 'h2', name: 'Snoeidag met ploeg', desc: 'Een hele dag met twee hoveniers voor het grote werk.', price: 340, duurMin: 480, soort: 'dienst' },
      { id: 'h3', name: 'Irrigatie-check & afstelling', desc: 'Druppelsysteem nalopen, lekken en klok afstellen.', price: 85, duurMin: 60, soort: 'dienst' },
      { id: 'h4', name: 'Tuinontwerp-advies aan huis', desc: 'Rondgang met schetsvoorstel en beplantingsplan.', price: 120, duurMin: 90, soort: 'dienst' }
    ] },
  { code: 'LAVANDA', name: 'Lavanda Wasserij', type: 'wasserij', city: 'Ibiza',
    vak: 'Wasserij & stomerij met bezorging',
    loc: { lat: 38.907, lng: 1.428, label: 'Ibiza-stad' }, rate: 0.1, menu: [], photos: [],
    services: [
      { id: 'w1', name: 'Waszak 8 kg, halen en bezorgen', desc: 'Vandaag gehaald, morgen gevouwen terug.', price: 24, duurMin: 15, soort: 'dienst' },
      { id: 'w2', name: 'Overhemden strijken, per 10', desc: 'Op hanger of gevouwen, zoals u wilt.', price: 22, soort: 'product' },
      { id: 'w3', name: 'Stomen: kostuum of jurk', desc: 'Chemisch reinigen met oog voor stof en afwerking.', price: 19, soort: 'product' },
      { id: 'w4', name: 'Linnengoedset villa', desc: 'Wassen, mangelen en per kamer verpakt retour.', price: 35, soort: 'product' }
    ] },
  { code: 'ESCOLA', name: 'Autoescola Illa', type: 'rijschool', city: 'Ibiza',
    vak: 'Rijlessen & examentraining',
    loc: { lat: 38.91, lng: 1.435, label: 'Vara de Rey, Ibiza-stad' }, rate: 0.1, menu: [], photos: [],
    services: [
      { id: 'r1', name: 'Proefles', desc: 'Kennismaken met de instructeur en een eerlijk startadvies.', price: 39, duurMin: 60, soort: 'dienst' },
      { id: 'r2', name: 'Rijles, 60 minuten', desc: 'Een-op-een met vaste instructeur en lesverslag.', price: 49, duurMin: 60, soort: 'dienst' },
      { id: 'r3', name: 'Pakket 10 lessen', desc: 'Tien lessen met korting; samen plannen we het blok.', price: 459, soort: 'product' },
      { id: 'r4', name: 'Examenbegeleiding', desc: 'Voorrit, zenuwenplan en begeleiding op de examendag.', price: 150, duurMin: 120, soort: 'dienst' }
    ] },
  { code: 'FAUNA', name: 'Clinica Fauna', type: 'dierenarts', city: 'Ibiza',
    vak: 'Dierenartspraktijk',
    loc: { lat: 38.9, lng: 1.42, label: 'Sant Jordi, Ibiza' }, rate: 0.1, menu: [], photos: [],
    services: [
      { id: 'd1', name: 'Consult dierenarts', desc: 'Onderzoek en behandelplan; u beslist altijd mee.', price: 48, duurMin: 30, soort: 'dienst' },
      { id: 'd2', name: 'Vaccinatie', desc: 'Volgens het schema van uw dier, met paspoort-aantekening.', price: 35, duurMin: 20, soort: 'dienst' },
      { id: 'd3', name: 'Gebitsbehandeling huisdier', desc: 'Reiniging onder begeleiding; vooraf altijd een intake.', price: 140, duurMin: 60, soort: 'dienst' },
      { id: 'd4', name: 'Spoedconsult', desc: 'Vandaag terecht; bel bij levensgevaar altijd direct.', price: 95, duurMin: 45, soort: 'dienst' }
    ] },
  { code: 'DENTAL', name: 'Clinica Dental Blanca', type: 'tandarts', city: 'Ibiza',
    vak: 'Tandarts & mondhygiene',
    loc: { lat: 38.909, lng: 1.431, label: 'Ibiza-stad' }, rate: 0.1, menu: [], photos: [],
    services: [
      { id: 't1', name: 'Periodieke controle', desc: 'Controle bij de tandarts met persoonlijk advies.', price: 45, duurMin: 20, soort: 'dienst' },
      { id: 't2', name: 'Gebitsreiniging door de mondhygienist', desc: 'Professionele reiniging en poetsinstructie op maat.', price: 89, duurMin: 45, soort: 'dienst' },
      { id: 't3', name: 'Vulling', desc: 'In de kleur van uw eigen tand, in een bezoek.', price: 120, duurMin: 45, soort: 'dienst' },
      { id: 't4', name: 'Spoedconsult kiespijn', desc: 'Vandaag gezien worden bij acute pijn.', price: 95, duurMin: 30, soort: 'dienst' }
    ] },
  { code: 'LUZ', name: 'Studio Luz', type: 'fotograaf', city: 'Ibiza',
    vak: 'Fotografie & film',
    loc: { lat: 38.92, lng: 1.44, label: 'heel het eiland, op locatie' }, rate: 0.1, menu: [], photos: [],
    services: [
      { id: 'f1', name: 'Fotoshoot, 1 uur', desc: 'Op locatie naar keuze; 20 bewerkte beelden.', price: 180, duurMin: 60, soort: 'dienst' },
      { id: 'f2', name: 'Wedding-reportage, hele dag', desc: 'Twee camera’s, van voorbereiding tot openingsdans.', price: 1450, duurMin: 480, soort: 'dienst' },
      { id: 'f3', name: 'Dronebeelden villa of zaak', desc: 'Lucht- en interieurbeeld voor verhuur of verkoop.', price: 240, duurMin: 90, soort: 'dienst' },
      { id: 'f4', name: 'Contentpakket voor uw zaak', desc: 'Maandelijkse beeldset voor site en De Salon.', price: 390, duurMin: 180, soort: 'dienst' }
    ] },
  { code: 'MUDANZA', name: 'Mudanza Isla', type: 'verhuizer', city: 'Ibiza',
    vak: 'Verhuis- & tilservice',
    loc: { lat: 38.915, lng: 1.44, label: 'Haven van Ibiza' }, rate: 0.1, menu: [], photos: [],
    services: [
      { id: 'm1', name: 'Verhuisploeg 2 man, per uur', desc: 'Wagen, dekens en spanbanden inbegrepen.', price: 95, duurMin: 60, soort: 'dienst' },
      { id: 'm2', name: 'Villa-verhuizing, hele dag', desc: 'Complete verhuizing met vaste ploeg en planning.', price: 890, duurMin: 480, soort: 'dienst' },
      { id: 'm3', name: 'Bijzonder stuk: piano of kluis', desc: 'Specialistisch tillen, verzekerd en voorbereid.', price: 240, duurMin: 120, soort: 'dienst' },
      { id: 'm4', name: 'Inpakservice, per uur', desc: 'Zorgvuldig inpakken met eigen dozen en papier.', price: 65, duurMin: 60, soort: 'dienst' }
    ] },
  { code: 'DIGITAL', name: 'Casa Digital', type: 'ithulp', city: 'Ibiza',
    vak: 'IT-hulp aan huis',
    loc: { lat: 38.906, lng: 1.427, label: 'Ibiza-stad en omgeving' }, rate: 0.1, menu: [], photos: [],
    services: [
      { id: 'i1', name: 'IT-hulp aan huis, per uur', desc: 'Computer, telefoon, printer of tv: rustig uitgelegd.', price: 75, duurMin: 60, soort: 'dienst' },
      { id: 'i2', name: 'Wifi-optimalisatie villa', desc: 'Meting per kamer en dekking tot aan het zwembad.', price: 140, duurMin: 90, soort: 'dienst' },
      { id: 'i3', name: 'Smart home installeren', desc: 'Verlichting, gordijnen en scenes, veilig ingericht.', price: 190, duurMin: 120, soort: 'dienst' },
      { id: 'i4', name: 'Fotoback-up & data-redding', desc: 'Alles veilig gesteld, met een heldere back-uproutine.', price: 95, duurMin: 60, soort: 'dienst' }
    ] }
];

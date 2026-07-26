/* De ECHTE RTG App-Bibliotheek: geen verzonnen namen meer, maar de apps die
   werkelijk in het RTG-ecosysteem draaien. Elke tegel opent een bestaande,
   werkende pagina. De categorie-glyphen komen uit de huisstijl-set (RTGGlyf).

   Dit is pure data; de motor (kern/appbieb.js) toont, doorzoekt en installeert
   ze, en voegt er de door de RTG Werkplaats gepubliceerde apps aan toe. Alles is
   voor leden inbegrepen bij de pas; de RTFoundation-apps zijn voor iedereen
   gratis. Nieuwe app-pagina's krijgen hier gewoon een regel. */

const CATEGORIEEN = [
  { id: 'sociaal', label: 'Sociaal & contact', icon: 'megafoon' },
  { id: 'reizen', label: 'Reizen & verblijf', icon: 'maison' },
  { id: 'eten', label: 'Eten & uitgaan', icon: 'horeca' },
  { id: 'media', label: 'Media & creatie', icon: 'film' },
  { id: 'geld', label: 'Geld & werk', icon: 'rekening' },
  { id: 'spelen', label: 'Spelen & sport', icon: 'ster' },
  { id: 'veiligheid', label: 'Veiligheid & identiteit', icon: 'schild' },
  { id: 'foundation', label: 'RTFoundation (gratis)', icon: 'diploma' }
];

/* [id, naam, categorie, url, uitleg]. wereld volgt uit de url (foundation = rtf). */
const R = [
  // ---- sociaal & contact ----
  ['berichten', 'Berichten', 'sociaal', '/apps/berichten.html', 'Chatten, bellen en videobellen op codenaam; berichten worden automatisch voor je vertaald.'],
  ['pulse', 'Pulse', 'sociaal', '/apps/pulse.html', 'De hoogtepunten van vandaag in jouw RTG-wereld, rustig gebundeld, geen eindeloze feed.'],
  ['cercle', 'Cercle', 'sociaal', '/apps/cercle.html', 'Je besloten kring: de mensen die dichtbij staan, op één plek.'],
  ['entourage', 'Entourage', 'sociaal', '/apps/entourage.html', 'Je vaste mensen en hun rol om je heen, overzichtelijk bij elkaar.'],
  ['rendezvous', 'Rendez-vous', 'sociaal', '/apps/rendezvous.html', 'Afspraken en ontmoetingen plannen met je kring.'],
  ['vonk', 'Vonk', 'sociaal', '/apps/vonk.html', 'RTG Vonk: kennismaken op wens; bij een wederzijdse match reserveert RTG een tafel in het midden.'],
  ['attenties', 'Attenties', 'sociaal', '/apps/attenties.html', 'Attenties en cadeaus regelen voor wie je waardeert.'],

  // ---- reizen & verblijf ----
  ['rtg', 'Het Huis', 'reizen', '/apps/rtg.html', 'Reserveren, boeken en bestellen bij alle partners, alles op codenaam.'],
  ['hotels', 'Verblijven', 'reizen', '/apps/hotels.html', 'Hotels, appartementen en villa\'s met ledenprijzen en keyless toegang.'],
  ['reisbureau', 'Reisbureau', 'reizen', '/apps/reisbureau.html', 'Samengestelde reizen tegen de nettoprijs, met AI-reisadvies in gewone woorden.'],
  ['reisboek', 'Reisboek', 'reizen', '/apps/reisboek.html', 'Je reisdagboek: boekingen en momenten worden vanzelf een mooi verslag.'],
  ['vluchten', 'Vluchten', 'reizen', '/apps/vluchten.html', 'Vluchten zoeken, boeken en volgen.'],
  ['hangar', 'Hangar', 'reizen', '/apps/hangar.html', 'De Hangar: privéjets en charters vanaf Business Aviation.'],
  ['ov', 'RTG OV', 'reizen', '/apps/ov.html', 'Bus, trein, metro, veerboot en taxi in één reisapp, met live GPS en snelle check-in.'],
  ['navigatie', 'Navigatie', 'reizen', '/apps/navigatie.html', 'Navigeren met de RTG-kaart.'],
  ['flits', 'Flits', 'reizen', '/apps/flits.html', 'Een ingetogen rijscherm met community-meldingen (flitser, file, ongeval) en spraak.'],
  ['stad', 'Mijn Stad', 'reizen', '/apps/stad.html', 'Alles om je heen in het RTG-web, op de kaart van je stad.'],
  ['maison', 'Maison', 'reizen', '/apps/maison.html', 'Je vaste verblijven en tweede huizen bij elkaar.'],

  // ---- eten & uitgaan ----
  ['foodcourt', 'Food Court', 'eten', '/apps/foodcourt.html', 'Alle restaurants op een rij; reserveren met tijdsloten in een paar tikken.'],
  ['table', 'Table', 'eten', '/apps/table.html', 'Je tafelreserveringen en gastenlijsten.'],
  ['cellier', 'Cellier', 'eten', '/apps/cellier.html', 'Je wijnkelder en proefnotities.'],
  ['uitgaan', 'Uitgaan', 'eten', '/apps/uitgaan.html', 'Bars, clubs en beachclubs met hun avonden en gastenlijsten.'],

  // ---- media & creatie ----
  ['camera', 'Camera', 'media', '/apps/camera.html', 'Fotograferen, plus RTG Eye: voertuigschouw en hands-free werkvloerlog.'],
  ['muziek', 'RTG Sound', 'media', '/apps/muziek.html', 'Je muziek, rustig en zonder reclame.'],
  ['theater', 'Theater', 'media', '/apps/theater.html', 'Videobibliotheek op bioscoopniveau, tot 4K, met kanalen en reacties.'],
  ['clips', 'Clips', 'media', '/apps/clips.html', 'Korte video\'s die lokaal bij de maker blijven; een eindige dagselectie.'],
  ['podium', 'Podium', 'media', '/apps/podium.html', 'Je eigen live-kanaal (18+), met chat, RTG Pay-cadeaus en abonnementen.'],
  ['sitemaker', 'Website-maker', 'media', '/apps/sitemaker.html', 'Bouw met blokken je eigen RTG-site, met eigen foto\'s en beeld uit De Salon.'],
  ['browser', 'RTG Browser', 'media', '/apps/browser.html', 'Blader door de sites die leden in het RTG-web publiceren.'],
  ['office', 'RTG Office', 'media', '/apps/office.html', 'Tekst en rekenblad met autosave, delen op codenaam en export.'],
  ['krant', 'RTG Krant', 'media', '/apps/krant.html', 'De redactie bundelt wat voor leden telt: kwaliteit boven snelheid.'],
  ['nieuws', 'Nieuws', 'media', '/apps/nieuws.html', 'RTG Nieuws per rubriek, met wat je later wilt lezen bewaard.'],
  ['garderobe', 'Garde-robe', 'media', '/apps/garderobe.html', 'Je kledingkast en looks bij elkaar.'],

  // ---- geld & werk ----
  ['wbw', 'Wie betaalt wat', 'geld', '/apps/wbw.html', 'Groepsuitgaven met live balans en verrekenen via RTG Pay.'],
  ['balans', 'Balans', 'geld', '/apps/balans.html', 'Je saldo en tikgeschiedenis in één overzicht.'],
  ['rtgcode', 'RTG-code', 'geld', '/apps/rtgcode.html', 'Je betaal- en toegangscodes veilig op één plek.'],
  ['logboek', 'Logboek', 'geld', '/apps/logboek.html', 'Je acties en bevestigingen, netjes vastgelegd.'],
  ['mecenaat', 'Mecenaat', 'geld', '/apps/mecenaat.html', 'Steun projecten en goede doelen als mecenas.'],
  ['labfonds', 'Lab-fonds', 'geld', '/apps/labfonds.html', 'Steun het RTG-onderzoekslab en volg waar je bijdrage heen gaat.'],
  ['nalatenschap', 'Nalatenschap', 'geld', '/apps/nalatenschap.html', 'Regel wat er later met je account en bezittingen gebeurt.'],

  // ---- spelen & sport ----
  ['spelen', 'Spelen', 'spelen', '/apps/spelen.html', 'Dammen, rummikub, Magnaat, partyspellen, sudoku en meer, samen of alleen.'],
  ['sport', 'Sport', 'spelen', '/apps/sport.html', 'Je sportactiviteiten en clubs.'],

  // ---- veiligheid & identiteit ----
  // De vier veiligheidsapps draaien op een gedeelde kern (kern/veiligheid/):
  // een kring van codenamen, je laatst bekende plek, en een dodemansknop die
  // op de SERVER tikt, zodat hij ook afgaat als je telefoon uitvalt.
  ['thuiswacht', 'Thuiswacht', 'veiligheid', '/apps/thuiswacht.html', 'Zeg hoe lang je onderweg bent; meld je je niet, dan krijgt je kring bericht met je laatst bekende plek.'],
  ['codewoord', 'Codewoord', 'veiligheid', '/apps/codewoord.html', 'Een gewone zin die je kring stil waarschuwt met je plek; op je scherm gebeurt er niets zichtbaars.'],
  ['vitaal', 'Vitaal', 'veiligheid', '/apps/vitaal.html', 'Een knop per dag: het gaat goed. Voor medicijnen, en voor wie alleen woont.'],
  ['thuisrust', 'Thuisrust', 'veiligheid', '/apps/thuisrust.html', 'Niet storen tot je thuis bent; je eigen kring komt er altijd doorheen.'],
  ['ik', 'Wie ben ik', 'veiligheid', '/apps/ik.html', 'Wat Rahul over je mag weten: hoe hij tegen je doet, je voornaamwoorden en je eigen geloofskeuze. Alles optioneel.'],
  ['passkeys', 'Passkeys', 'veiligheid', '/apps/passkeys.html', 'Inloggen met vingerafdruk, gezicht of een fysieke sleutel.'],
  ['juridisch', 'Juridisch', 'veiligheid', '/apps/juridisch.html', 'Voorwaarden, contracten en je eigen akkoorden.'],

  // ---- RTFoundation (gratis) ----
  ['rtf-index', 'RTFoundation', 'foundation', '/apps/foundation/index.html', 'Gratis hulp voor je gezin: alles wat de RTFoundation biedt op één plek.'],
  ['rtf-vrienden', 'Vrienden', 'foundation', '/apps/foundation/vrienden.html', 'Vrienden, snaps en 24-uursverhalen, veilig en op codenaam.'],
  ['rtf-leren', 'Leren', 'foundation', '/apps/foundation/leren.html', 'Oefenen, overhoren en samen leren.'],
  ['rtf-school', 'School', 'foundation', '/apps/foundation/school.html', 'Klas, rooster, huiswerk en cijfers voor het hele gezin.'],
  ['rtf-toetsen', 'Toetsen', 'foundation', '/apps/foundation/toetsen.html', 'De toetsplanner voor tieners.'],
  ['rtf-zakgeld', 'Zakgeld', 'foundation', '/apps/foundation/zakgeld.html', 'Het zakgeldpotje, samen bijgehouden.'],
  ['rtf-babyboek', 'Babyboek', 'foundation', '/apps/foundation/babyboek.html', 'Het fotoboekje en de eerste momenten, met AI die de mooie zinnen schrijft.'],
  ['rtf-gezondheid', 'Gezondheid', 'foundation', '/apps/foundation/gezondheid.html', 'Het gezinsgezondheidsboekje.'],
  ['rtf-veilig', 'Veilig', 'foundation', '/apps/foundation/veilig.html', 'Hulp bij online veiligheid voor kinderen en ouders.'],
  ['rtf-pesten', 'Pesten', 'foundation', '/apps/foundation/pesten.html', 'Steun en een luisterend oor bij pesten.'],
  ['rtf-kompas', 'Kompas', 'foundation', '/apps/foundation/kompas.html', 'Het tienerkompas: koers houden in een druk hoofd.'],
  ['rtf-schrijven', 'Schrijven', 'foundation', '/apps/foundation/schrijven.html', 'Samen verhalen maken en schrijven.'],
  ['rtf-projecten', 'Projecten', 'foundation', '/apps/foundation/projecten.html', 'Werkstukken en groepswerk begeleiden.'],
  ['rtf-markt', 'Markt', 'foundation', '/apps/foundation/markt.html', 'Ruilen en delen in de buurt.'],
  ['rtf-rust', 'Rust', 'foundation', '/apps/foundation/rust.html', 'Even tot jezelf komen; een rustige plek in de app.'],
  ['rtf-bieb', 'RTF-Bibliotheek', 'foundation', '/apps/foundation/bieb.html', 'Gratis kind- en gezinsapps van de RTFoundation.'],
  ['rtf-geloof', 'Geloof & Wijsheid', 'foundation', '/apps/foundation/geloofbieb.html', 'De Geloof & Wijsheid-Bibliotheek: alle tradities als gelijken, met echte leesbare teksten.']
];

const APPS = R.map(([id, naam, categorie, url, uitleg]) => ({
  id: 'rtgapp-' + id, sleutel: id, naam, categorie,
  categorieLabel: (CATEGORIEEN.find(c => c.id === categorie) || {}).label || categorie,
  icon: (CATEGORIEEN.find(c => c.id === categorie) || {}).icon || 'ster',
  url, uitleg,
  wereld: url.startsWith('/apps/foundation/') ? 'rtf' : 'rtg',
  ledenprijsCenten: 0
}));

module.exports = { CATEGORIEEN, APPS };

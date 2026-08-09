/* RTG App-Bibliotheek, de rijen deel 2. Vorm per app:
   [id, naam, categorie, url, uitleg]
   De uitleg over wat dit is staat in ../appcatalogus-data.js. */
module.exports = [
  ['wbw', 'Wie betaalt wat', 'geld', '/apps/wbw.html', 'Groepsuitgaven met live balans en verrekenen via RTG Pay.'],
  ['rtgcode', 'RTG-code', 'geld', '/apps/rtgcode.html', 'Je betaal- en toegangscodes veilig op één plek.'],
  ['logboek', 'Logboek', 'geld', '/apps/logboek.html', 'Je acties en bevestigingen, netjes vastgelegd.'],
  ['mecenaat', 'Mecenaat', 'geld', '/apps/mecenaat.html', 'Steun projecten en goede doelen als mecenas.'],
  ['labfonds', 'Lab-fonds', 'geld', '/apps/labfonds.html', 'Steun het RTG-onderzoekslab en volg waar je bijdrage heen gaat.'],
  ['nalatenschap', 'Nalatenschap', 'geld', '/apps/nalatenschap.html', 'Regel wat er later met je account en bezittingen gebeurt.'],

  // ---- spelen & sport ----
  ['spelen', 'Spelen', 'spelen', '/apps/spelen.html', 'Dammen, rummikub, Magnaat, partyspellen, sudoku en meer, samen of alleen.'],

  // ---- leven & gezondheid ----
  // Waar iemand zoekt, niet waar de code woont: Vitaal draait op de gedeelde
  // veiligheidskern en Balans op de agenda, maar je zoekt ze allebei hier.
  ['doelen', 'Doelen', 'leven', '/apps/doelen.html', 'Waar je begon, waar je heen wilt en waarom; de stappen ertussen rekent RTG opnieuw uit vanaf waar je nu staat.'],
  ['sport', 'Sport', 'leven', '/apps/sport.html', 'Je sportactiviteiten en clubs.'],
  ['balans', 'Balans', 'leven', '/apps/balans.html', 'Je week op rust en ritme: Rahul adviseert ook eens niks, zonder streaks of schuldgevoel.'],
  ['vitaal', 'Vitaal', 'leven', '/apps/vitaal.html', 'Een knop per dag: het gaat goed. Voor medicijnen, en voor wie alleen woont.'],

  // ---- veiligheid & identiteit ----
  // Thuiswacht, Codewoord, Vitaal en Thuisrust draaien op een gedeelde kern
  // (kern/veiligheid/): een kring van codenamen, je laatst bekende plek, en een
  // dodemansknop die op de SERVER tikt, zodat hij ook afgaat als je telefoon
  // uitvalt. Vitaal staat hierboven onder leven, want daar wordt hij gezocht.
  ['thuiswacht', 'Thuiswacht', 'veiligheid', '/apps/thuiswacht.html', 'Zeg hoe lang je onderweg bent; meld je je niet, dan krijgt je kring bericht met je laatst bekende plek.'],
  ['codewoord', 'Codewoord', 'veiligheid', '/apps/codewoord.html', 'Een gewone zin die je kring stil waarschuwt met je plek; op je scherm gebeurt er niets zichtbaars.'],
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

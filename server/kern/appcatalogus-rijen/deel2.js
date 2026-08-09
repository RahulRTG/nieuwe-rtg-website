/* RTG App-Bibliotheek, de rijen deel 2. Vorm per app:
   [id, naam, categorie, url, uitleg]
   De uitleg over wat dit is staat in ../appcatalogus-data.js. */
module.exports = [
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
  // De vier veiligheidsapps draaiden altijd al op een gedeelde kern
  // (kern/veiligheid/): een kring van codenamen, je laatst bekende plek, en een
  // dodemansknop die op de SERVER tikt, zodat hij ook afgaat als je telefoon
  // uitvalt. Ze deelden ook de clientlaag (shared/veiligheid.js) en verschilden
  // alleen in de vraag die ze stelden -- maar ze stonden hier als vier tegels,
  // en dat betekende in de praktijk dat iemand de Thuiswacht kende en het
  // Codewoord nooit had gezien. Ze zijn nu vier standen van een app; de oude
  // paden leiden er met een hash naartoe, dus geen enkele link is dood.
  ['veilig', 'RTG Veilig', 'veiligheid', '/apps/veilig.html', 'Thuiswacht, Codewoord, Vitaal en Thuisrust in een app: zeggen hoe lang je onderweg bent, je kring stil waarschuwen, dagelijks laten weten dat het goed gaat, en stil zijn zonder onbereikbaar te worden. De klok tikt op de server, dus het werkt ook als je telefoon uitvalt.'],
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

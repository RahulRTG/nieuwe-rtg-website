/* RTG App-Bibliotheek, de rijen deel 2. Vorm per app:
   [id, naam, categorie, url, uitleg]
   De uitleg over wat dit is staat in ../appcatalogus-data.js. */
module.exports = [
  ['wbw', 'Wie betaalt wat', 'geld', '/apps/geld.html#wbw', 'Groepsuitgaven met live balans en verrekenen via RTG Pay.'],
  ['balans', 'Balans', 'geld', '/apps/geld.html#balans', 'Je saldo en tikgeschiedenis in één overzicht.'],
  ['rtgcode', 'RTG-code', 'geld', '/apps/geld.html#rtgcode', 'Je betaal- en toegangscodes veilig op één plek.'],
  ['logboek', 'Logboek', 'geld', '/apps/geld.html#logboek', 'Het onderhoudsboek van uw jacht, jet, oldtimer of ander kostbaar bezit: keuringen, servicebeurten, reparaties en verzekeringen met datum, kosten en wanneer het weer aan de beurt is.'],
  ['mecenaat', 'Mecenaat', 'geld', '/apps/geld.html#mecenaat', 'Uw filantropie op orde: per gift het doel, het thema, het bedrag, en of het een toezegging is of al betaald. Het overzicht toont wat er via de RTFoundation loopt.'],
  ['labfonds', 'Lab-fonds', 'geld', '/apps/geld.html#labfonds', 'Steun het RTG-onderzoekslab en volg waar je bijdrage heen gaat.'],
  ['nalatenschap', 'Nalatenschap', 'geld', '/apps/geld.html#nalatenschap', 'Een discreet, versleuteld dossier voor later: welke documenten er zijn en waar ze liggen, uw vertrouwenspersonen, en uw persoonlijke wensen.'],

  // ---- spelen & sport ----
  ['spelen', 'Spelen', 'spelen', '/apps/spelen.html', 'Dammen, rummikub, Magnaat, partyspellen, sudoku en meer, samen of alleen.'],

  // ---- leven & gezondheid ----
  // Waar iemand zoekt, niet waar de code woont: Vitaal draait op de gedeelde
  // veiligheidskern en Balans op de agenda, maar je zoekt ze allebei hier.
  ['life', 'RTG Life', 'leven', '/apps/life.html', 'Een scherm voor je hele leven bij RTG: ritme, doelen, afspraken, check-in en je noodkaart bij elkaar. Wat niet gemeten wordt, staat er als niet gemeten.'],
  ['doelen', 'Doelen', 'leven', '/apps/doelen.html', 'Waar je begon, waar je heen wilt en waarom; de stappen ertussen rekent RTG opnieuw uit vanaf waar je nu staat.'],
  ['sport', 'Sport', 'leven', '/apps/sport.html', 'Je sportactiviteiten en clubs.'],
  ['training', 'Training', 'leven', '/apps/training.html', 'Je eigen trainingsschema en wat je er echt van deed. RTG schrijft geen training voor en rekent geen belasting uit.'],
  ['balans', 'Balans', 'leven', '/apps/balans.html', 'Je week op rust en ritme: Rahul adviseert ook eens niks, zonder streaks of schuldgevoel.'],
  ['vitaal', 'Vitaal', 'leven', '/apps/vitaal.html', 'Een knop per dag: het gaat goed. Voor medicijnen, en voor wie alleen woont.'],
  ['tijdlijn', 'Tijdlijn', 'leven', '/apps/tijdlijn.html', 'Wat er in de tijd met je gebeurd is, op een rij. Geen verbanden en geen score: naast elkaar zetten is iets anders dan zeggen wat het betekent.'],
  ['voeding', 'Voeding', 'leven', '/apps/voeding.html', 'Je weekplan voor wat je wilt eten. Een plan, geen telling: RTG telt geen calorieen en beoordeelt niet wat je eet.'],
  ['gedachten', 'Gedachtenboek', 'leven', '/apps/gedachten.html', 'Een plek om iets op te schrijven, voor jezelf. Er leest geen model mee en er wordt niets samengevat.'],
  ['medicijnen', 'Medicijnen', 'leven', '/apps/medicijnen.html', 'Je eigen medicatieschema: wat je gebruikt, op welke tijden, en hoeveel er nog in huis is. RTG bepaalt nooit een dosering.'],

  // ---- veiligheid & identiteit ----
  // De vier veiligheidsapps draaiden altijd al op een gedeelde kern
  // (kern/veiligheid/): een kring van codenamen, je laatst bekende plek, en een
  // dodemansknop die op de SERVER tikt, zodat hij ook afgaat als je telefoon
  // uitvalt. Ze deelden ook de clientlaag (shared/veiligheid.js) en verschilden
  // alleen in de vraag die ze stelden -- maar ze stonden hier als vier tegels,
  // en dat betekende in de praktijk dat iemand de Thuiswacht kende en het
  // Codewoord nooit had gezien. Ze zijn nu vier standen van een app; de oude
  // paden leiden er met een hash naartoe, dus geen enkele link is dood.
  ['veilig', 'RTG Veilig', 'veiligheid', '/apps/veilig.html', 'Thuiswacht, Codewoord, Vitaal en Thuisrust in een app: zeggen hoe lang je onderweg bent, je kring stil waarschuwen, dagelijks laten weten dat het goed gaat, en stil zijn zonder onbereikbaar te worden. De klok tikt op de server, dus het werkt ook als je telefoon uitvalt.'],  /* Uit de tak die de toestemmingslaag bracht. Hij staat NAAST RTG Veilig en
     niet erin: dit gaat over welk toestel en welke partij iets van u wegschrijft,
     de levenspas in RTFoundation over wat een MENS van u mag zien. Twee ingangen
     naar dezelfde vraag zou verkeerd zijn; twee verschillende vragen niet. */
  ['toestemming', 'Toestemming', 'veiligheid', '/apps/toestemming.html', 'Wie mag iets van je zien en welk toestel schrijft iets weg; intrekken gaat naar de plek waar de toestemming leeft.'],
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


  /* Afgesplitst van app-main-24.js, dat over de 10 KB ging. De snede loopt
     langs een echte grens: hierboven staat de registry van alle apps en de
     vaste functierij, hieronder de MAPPEN waarin die apps vallen en de vraag
     welke ervan bij welke pas horen. */
  /* ---------- de hoofdwerelden ----------
     VIER MENSELIJKE CONTEXTEN, en dat is het enige criterium. WERELDEN.md stelt
     de vraag waar een onderdeel bij hoort niet als "van wie is dit" maar als:
     in welke context denkt de mens dat hij zich bevindt terwijl hij dit
     gebruikt? Dezelfde persoon opent zijn rooster in WorkOS, bestelt eten in
     LivingOS, vliegt naar Ibiza in TravelOS en doet vrijwilligerswerk in
     FoundationOS. De pas bepaalt wat binnen zo'n huis beschikbaar is, nooit of
     de voordeur er armer uitziet.

     Een wereld hoeft niet even groot te zijn als de andere. TravelOS draagt elf
     onderdelen en LivingOS tweeenveertig; dat is geen scheefheid maar het
     verschil tussen een reis en een dagelijks leven. Wat wel voor alle vier
     geldt: alle apps blijven in precies één wereld ingedeeld en premiumrechten
     worden pas op onderdeelniveau toegepast. Zo blijft RTG voor elke pas
     compleet ogen, terwijl Lifestyle en Business aantoonbaar meer ontsluiten.

     WAT HIER NIET STAAT is RTG Core: RTG iD, inloggen, de gegevenspoort,
     meldingen, taal, Rahul, betalen. Vierentwintig functies zitten in ELKE
     doelgroep (server/functies/register, zie GROEPEN.md) en reizen met de mens
     mee van wereld naar wereld. Een laag die overal geldt is geen tegel op een
     beginscherm; wie hem hier als vijfde wereld ziet verschijnen, heeft de fout
     te pakken waar WERELDEN.md over gaat.

     Een map heeft een vaste sleutel (waar je eigen naam onder bewaard wordt),
     een standaardnaam en zijn apps. Apps die voor jouw pas niet bestaan
     vallen er vanzelf uit (itemZichtbaar). Een app staat in precies EEN map:
     twee plekken voor hetzelfde is precies waarom je hem nergens meer vindt. */
  const MAPPEN = [
    /* --- één gecentreerde rij --- */
    /* LIVINGOS EN NIET RTG, EN OOK NIET LIFEOS. Twee besluiten in een naam.
       `rtg` is de naam van de INSTAPPAS (naast lifestyle en business), en pas en
       wereld zijn twee loodrechte assen: de pas zegt wie je bent, de wereld waar
       je bent. Vielen die woorden samen, dan las een lid een plek als een prijs.
       Maar `LifeOS` -- de eerste kandidaat -- haalde de toets alleen op een
       technische woordvergelijking: `life` is niet `lifestyle`, terwijl een lid
       wel degelijk "Life" naast een pas ziet staan die "Lifestyle" heet. Een
       regel die je op de letter volgt en niet op de bedoeling, is geen regel.
       Vandaar LivingOS: het dagelijks leven, en geen stam die tegen een pasnaam
       aanschurkt. test/wereldregister.test.js toetst nu ook op de stam.
       Het huis (/apps/rtg.html) en de glyf houden hun naam: een huis is een merk
       en een wereld is een context. */
    { sleutel: 'map-rtg', naam: 'LivingOS', wereld: '/apps/rtg.html', glyf: 'rtg', items: [
      'tab:betalen', 'link:wallet', 'link:bank', 'link:wbw', 'link:rtgcode',
      'link:balans', 'tab:assets', 'link:labfonds', 'link:mecenaat',
      'link:nalatenschap', 'link:logboek',
    /* De Salon is weer De Salon: mensen en wat je met ze deelt. Wat je in je
       eentje kijkt of luistert staat bij Media. */
      'tab:salon', 'link:pulse', 'link:vrienden', 'os:snaps', 'link:camera',
      'link:vonk', 'link:cercle', 'link:entourage', 'link:rendezvous', 'link:attenties',
    /* Het Huis is het huishouden in de brede zin: waar je woont, wat er op
       tafel komt, wat er in de kast hangt -- en hoe het met de mensen erin
       gaat. Die laatste helft (zorg, gezin, vitaal, rust) stond even in een
       eigen map Zorg; die is hier terug, want zonder haar was Het Huis op een
       RTG-pas een map met drie tegels. De kantoorkant zit bij Werk. */
    /* os:rtf stond hier, en staat nu in zijn eigen wereld hieronder. Regel 44
       in scripts/check.js ving dat meteen: een app in twee werelden is precies
       waarom je hem nergens meer vindt. */
      'link:ontdek', 'tab:bestellen', 'tab:zorg', 'tab:gezin',
      'link:rechterhand',
      'link:maison', 'link:table', 'link:cellier', 'link:garderobe',

      'link:muziek', 'link:podium', 'link:theater', 'link:clips', 'link:spelen',
      'link:nieuws', 'link:krant', 'link:sport',
      'link:ik', 'link:veilig', 'link:passkeys', 'link:juridisch'] },
    /* WORKOS IS EEN CONTEXT EN GEEN PRODUCT MET EEN PRIJS. De naam ging van
       "RTG Kantoor" naar WorkOS omdat er twee verschillende toegangsmodellen in
       dezelfde wereld wonen, en die verschillen mogen de wereld niet splitsen:
       een werknemer krijgt de werkvloer VIA zijn werkgever, een werkgever KOOPT
       de werkruimte. In het functieregister staat dat vandaag nog als twee
       losse dingen ('Werk OS (werkruimtes)' draagt intern+business, 'De
       werkvloer' draagt leverancier+personeel). Een wereld eroverheen ontkent
       dat verschil niet -- de commerciele verpakking zit BINNEN de wereld.
       Het huis houdt zijn eigen naam: RTG Kantoor is een merk in WorkOS. */
    { sleutel: 'map-werk', naam: 'WorkOS', wereld: '/apps/kantoor.html', glyf: 'office', items: [
      'link:rtgone', 'link:rtmail', 'link:magnaat', 'link:office', 'os:werk', 'link:onderneming', 'link:loonstrook', 'link:school',
      'link:browser', 'link:sitemaker'] },
    /* TRAVELOS IS DE KLEINSTE WERELD EN DAT IS GEEN ARGUMENT TEGEN HEM.
       Elf onderdelen naast de tweeenveertig van LivingOS -- geteld in het
       functieregister zijn het er veertien van de 190. Een wereld is geen
       categorie in een spreadsheet maar een bestemming in het hoofd van een
       mens, en deze bezit een hele reeks van vertrekken tot thuiskomen:
       bedenken, vervoer, verblijf, onderweg, aankomst, lokaal vervoer, terug.
       Luchtvaart, OV, Hospitality, Invisible Arrival en destination services
       kunnen hier later onder groeien zonder dat de kaart hoeft te wijzigen.

       DEZE ELF STONDEN IN LIVINGOS, als eerste blok. Ze zijn er letterlijk uit
       geknipt; geen enkel item is nieuw en geen enkel item is verdwenen.
       scripts/check.js regel 44 en test/wereldregister.test.js bewaken dat ze
       nu in precies EEN wereld staan.

       Het huis bestond al en was alleen nergens aan opgehangen:
       /apps/reizen.html, "uw reiswereld op een plek -- alles wat eraan komt,
       uit alle reisapps tegelijk" (server/kern/appgids-data/deel11.js), met een
       eigen webmanifest. Precies wat een wereldhuis is. */
    { sleutel: 'map-reizen', naam: 'TravelOS', wereld: '/apps/reizen.html', glyf: 'reizen', items: [
      'tab:reizen', 'link:reizen', 'tab:terplaatse', 'link:vluchten', 'link:ov', 'link:navigatie',
      'link:flits', 'link:stad', 'link:reisboek', 'link:hangar', 'link:residentie'] },
    /* Veilig: wie je bent en wie er over je waakt. De vier apps op dezelfde
       kern zijn een app met vier standen geworden (zie de opmerking bij LINKS),
       plus de sleutels waarmee je binnenkomt. Drie is hier geen tekort maar de
       hele set -- dit is de enige map die op elke pas even groot is.

       Vitaal en Thuisrust stonden bij Het Huis en niet hier, omdat ze over zorg
       en huishouden gingen. Nu ze standen zijn van een app, kan die app maar in
       een map staan (geen enkel item staat in twee mappen) en dat is deze:
       waar de andere twee standen ook al woonden. Het Huis houdt zorg en gezin
       als eigen tabbladen, dus daar verdwijnt het onderwerp niet.

       Juridisch komt hier vandaan uit de map Werk. Vier tegels werden een, en
       daarmee zakte deze map naar drie -- onder de ondergrens die
       test/appmenu.e2e.js bewaakt, en die ondergrens is er niet voor niets: een
       bijna lege map op de instappas is precies waar de merkregel over gaat.
       Juridisch is geen noodgreep om een gat te vullen maar hoort hier: de
       app-bibliotheek zet hem zelf al in de categorie "Veiligheid & identiteit"
       naast Wie ben ik en Passkeys, en het gaat over jouw voorwaarden en jouw
       akkoorden -- wie je bent, niet waar je werkt. Werk houdt zes tegels. */
    /* De zelfstandige Foundation-wereld. De stichting stond als EEN tegel binnen Het Huis
       ('os:rtf'), terwijl ze zeventien onderdelen, een eigen service worker en
       een eigen huis heeft. Een wereld die als tegel in een andere wereld
       hangt, is geen wereld. */
    /* De wereldtegel NAVIGEERT naar het huis; een tweede item in deze lijst zou
       nooit in beeld komen (openMap navigeert, zie 26.js). Het
       levens-command-center staat daarom als tegel OP de hub zelf, in de
       oudersectie -- zie de opmerking daar over de twee sessiewerelden. */
    /* FOUNDATIONOS IS DE WERELD, RTFOUNDATION IS HET MERK ERIN. Dezelfde regel
       als bij WorkOS en RTG Kantoor, en hier doet hij het meeste werk: onder
       /apps/foundation/ staan 71 schermen, waarvan er ACHT over de stichting
       als organisatie gaan (os-bestuur, os-donateur, os-vrijwilliger, os-veld,
       os-deelnemer, os-publiek, os-portaal, os). De rest -- babyboek, dromen,
       gevoel, gezondheid, ochtend, rust, opvoeden, campus, bieb, club,
       speeltuin -- is het leven van een kind, en dat hoort in LivingOS.

       WERELDEN.md maakt daar een principe van: de bouwer van een capability
       bepaalt niet in welke wereld hij thuishoort, de gebruikerscontext doet
       dat. RTFoundation mag dus eigenaar zijn van iets dat aan de voorkant in
       LivingOS verschijnt. Die verhuizing is nog niet gedaan; hij staat in
       WERELDEN.md als genoemde stap met zijn telling erbij. */
    { sleutel: 'map-rtf', naam: 'FoundationOS', wereld: '/apps/foundation/index.html', glyf: 'rtf', items: ['os:rtf'] }
  ];

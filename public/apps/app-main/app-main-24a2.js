
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
       `rtg` is de naam van de INSTAPPAS, en pas en wereld zijn twee loodrechte
       assen: vielen die woorden samen, dan las een lid een plek als een prijs.
       En `LifeOS` -- de eerste kandidaat -- haalde de toets alleen op een
       technische woordvergelijking: `life` is niet `lifestyle`, terwijl een lid
       wel "Life" ziet staan naast een pas die "Lifestyle" heet. Een regel die je
       op de letter volgt en niet op de bedoeling, is geen regel; de toets kijkt
       nu ook naar de stam. Het huis (/apps/rtg.html) en de glyf houden hun naam:
       een huis is een merk, een wereld is een context. */
    { sleutel: 'map-rtg', naam: 'LivingOS', wereld: '/apps/rtg.html', glyf: 'rtg', items: [
      'link:vooruitzicht',
    /* HET GEZIN KOMT UIT FOUNDATIONOS HIERHEEN, en dat is het eigendomsprincipe
       van WERELDEN.md in de praktijk: de bouwer van een capability bepaalt niet
       in welke wereld hij hoort, de gebruikerscontext doet dat. RTF Mini, Kids,
       Tiener, Jong en Volwassen gaan over babyboek, dromen, gevoel, gezondheid,
       ochtend, rust, opvoeden, school en club -- dat is iemands dagelijks leven
       en geen stichtingswerk. Gemeten: 62 van de 71 schermen onder
       /apps/foundation/ zijn zo. De stichting houdt de andere negen.
       Er verhuist geen bestand: alleen de deur staat nu in de juiste wereld. */
      'os:rtf',
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
      'link:nieuws', 'link:krant', 'link:sport'] },
    /* INSTELLINGEN, EN MET OPZET ZONDER `wereld`. Een wereld is een context waar
       je in leeft; deze vier gaan niet over een dag maar over het systeem. Ze
       zijn RTG Core, en Core heeft in de bank een gezicht: het bedieningspaneel
       in de voet. Vandaar `paneel`: geen vijfde wereldtegel, geen tweede
       instellingenscherm. wereldBij() in 29c filtert deze map er vanzelf uit. */
    { sleutel: 'map-instellingen', naam: 'Instellingen', paneel: '#osCcBtn', items: [
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
    /* TRAVELOS IS DE KLEINSTE WERELD EN DAT IS GEEN ARGUMENT TEGEN HEM: een
       wereld is geen categorie in een spreadsheet maar een bestemming in het
       hoofd van een mens, en deze bezit de hele keten van vertrekken tot
       thuiskomen (WERELDEN.md). Deze elf stonden in LivingOS en zijn er
       letterlijk uit geknipt; geen item is nieuw, geen item is verdwenen.
       Het huis bestond al en hing nergens aan: /apps/reizen.html. */
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
    /* FOUNDATIONOS IS DE WERELD, RTFOUNDATION IS HET MERK ERIN. Van de 71
       schermen onder /apps/foundation/ gaan er acht over de stichting; de rest
       is het leven van een kind en hoort in LivingOS. Want de bouwer van een
       capability bepaalt niet in welke wereld hij hoort, de gebruikerscontext
       doet dat (WERELDEN.md). Die verhuizing staat daar als genoemde stap. */
    /* HET HUIS IS os-publiek EN NIET os-portaal, en dat scheelde een deur die naar
       het verkeerde publiek leidt. os.html is een kantoorconsole achter een
       kantoortoken ("KANTOORCODE"), os-portaal.html heet met zoveel woorden
       "Portaal voor partners, gemeenten en ondernemers", en os-publiek.html zegt
       "Wat wij doen, bij u in de buurt". Alleen dat laatste is een voordeur voor
       een lid; de andere twee zijn deuren BINNEN de wereld. */
    { sleutel: 'map-rtf', naam: 'FoundationOS', wereld: '/apps/foundation/os-publiek.html', glyf: 'rtf', items: [
      'link:rtfbuurt', 'link:rtfportaal'] }
  ];

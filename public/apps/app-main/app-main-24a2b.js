  /* Afgesplitst van app-main-24a2.js, dat over de 10 KB ging (keuringsregel 13).
     De MAPPEN-array loopt door over de snede heen; dat is geen uitzondering maar
     hoe deze bundel werkt (scripts/bundel.js plakt de delen eerst aaneen, en
     scripts/lib/wereldregister.js leest ze zo ook).

     DE SNEDE IS OP 11 SEPTEMBER 2026 EEN WERELD OPGESCHOVEN, en de oude
     beschrijving stond hier nog: 'hierboven de drie werelden waarin een lid
     leeft, werkt en reist'. Dat klopte niet meer toen 24a2 opnieuw over de
     grens ging. Nu staat hierboven waar een lid LEEFT en WERKT (plus zijn
     instellingen, die geen wereld is) en hier waar hij HEEN GAAT en wat hij
     BIJDRAAGT.

     De volgorde van de array is met opzet niet aangeraakt: dit deel wordt
     direct achter 24a2 geplakt, dus TravelOS staat nog steeds tussen WorkOS en
     FoundationOS. Een snede mag de bundel niet herschikken -- dat zou de
     volgorde van de werelden in de bank veranderen zonder dat iemand daarom
     vroeg. */
    /* TRAVELOS IS DE KLEINSTE WERELD EN DAT IS GEEN ARGUMENT TEGEN HEM: een
       wereld is geen categorie in een spreadsheet maar een bestemming in het
       hoofd van een mens, en deze bezit de hele keten van vertrekken tot
       thuiskomen (WERELDEN.md). Deze elf stonden in LivingOS en zijn er
       letterlijk uit geknipt; geen item is nieuw, geen item is verdwenen.
       Het huis bestond al en hing nergens aan: /apps/reizen.html. */
    { sleutel: 'map-reizen', naam: 'TravelOS', wereld: '/apps/reizen.html', glyf: 'reizen', items: [
      'tab:reizen', 'link:reizen', 'tab:terplaatse', 'link:vluchten', 'link:ov', 'link:navigatie', 'link:move',
      'link:flits', 'link:stad', 'link:reisboek', 'link:hangar', 'link:residentie',
    /* Drie uit de tikkenmeting: aankomst, routedossier en OV-routes hingen
       nergens aan. Ze horen hier, want wie ze opent is onderweg. */
      'link:aankomst', 'link:routedossier', 'link:ovroutes'] },
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
    /* Zorg woont hier als eigen rustige voordeur en als direct zorgaanbod. De
       eerste maakt afspraken en privacy begrijpelijk; de tweede houdt de al
       bestaande boekingsstroom bereikbaar zonder functies te verdubbelen. */
      'link:rtfbuurt', 'link:foundationzorg', 'tab:zorg', 'link:rtfportaal',
    /* Twee uit de tikkenmeting (scripts/tikken.js): het bord en het schrift
       bestonden en hingen nergens aan. */
    /* Het Klimaatfonds is een VENSTER op het Living Lab en geen tweede lab:
       klimaat is daar de soort 'duurzaam' (kern/livinglab/kader.js). */
    /* `link:vrienden` is hier vandaan LivingOS gekomen: de contactenlaag van
       een gezin hoort in de wereld waar haar deur staat (zie de reden in
       app-main-24a2.js). */
      'link:rtfbord', 'link:rtfschrift', 'link:klimaat', 'link:buurtruil', 'link:geven',
      'link:vrienden'] }
  ];

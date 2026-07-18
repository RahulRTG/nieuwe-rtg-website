/* Boekhoudkennis (deelmodule): de genreprofielen. Per branche de
   kostenstructuur, kengetallen, btw-aandachtspunten, het seizoen en de
   valkuilen. Pure data, geen logica. */
const PROFIELEN = {
  horeca: {
    label: 'Horeca',
    kosten: 'Inkoop (foodcost 25-35% van de eten-omzet, drank 18-25%), personeel (meestal de grootste post), huur, energie en afschrijving van de keuken.',
    kpis: 'Foodcost %, drankmarge, omzet per couvert, personeelskosten als % van de omzet (onder 30% is gezond) en de zaalbezetting.',
    btwlet: 'Eten valt meestal in het lage tarief, alcohol en frisdrank vaak in het hoge tarief. Splits de kassa per productgroep, anders draagt u te veel of te weinig btw af.',
    seizoen: 'Terras en toerisme pieken in de zomer; leg in de drukke maanden een buffer aan voor de rustige.',
    valkuilen: 'Bederf en verspilling, te dure of te losse inkoop, en personeel dat niet meebeweegt met de drukte.',
    vragen: ['Hoe hoog mag mijn foodcost zijn?', 'Wat kost mijn personeel als percentage van de omzet?', 'Welk btw-tarief geldt voor eten en voor drank?']
  },
  hotel: {
    label: 'Verblijf',
    kosten: 'Personeel (schoonmaak en receptie), energie, linnen en onderhoud, online-boekingskosten en afschrijving van het pand en het interieur.',
    kpis: 'Bezettingsgraad, gemiddelde kamerprijs (ADR), opbrengst per beschikbare kamer (RevPAR) en de schoonmaakkosten per kamer.',
    btwlet: 'Overnachtingen vallen vaak in het lage tarief; ontbijt, minibar en extra diensten kunnen anders belast zijn. Toeristenbelasting is geen omzet, u int die voor de gemeente.',
    seizoen: 'Sterk seizoensgebonden; stuur de prijs met de vraag mee en houd rekening met leegstandsmaanden.',
    valkuilen: 'Lage bezetting niet opvangen met prijs, hoge afhankelijkheid van boekingsplatforms, uitgesteld onderhoud dat later duur uitpakt.',
    vragen: ['Wat is mijn opbrengst per kamer deze maand?', 'Hoe boek ik toeristenbelasting?', 'Welk btw-tarief geldt voor overnachting en ontbijt?']
  },
  retail: {
    label: 'Retail',
    kosten: 'Inkoop (de grootste post; let op de brutomarge), personeel, huur van een A-locatie, voorraad die geld vastlegt en afprijzingen.',
    kpis: 'Brutomarge %, voorraadrotatie, omzet per m2, afprijzingspercentage en de doorverkoop van een collectie (sell-through).',
    btwlet: 'De meeste artikelen vallen in het hoge tarief; sommige (boeken, bepaalde levensmiddelen) laag. Retouren corrigeren zowel omzet als btw.',
    seizoen: 'Collecties en feestdagen bepalen de pieken; oude voorraad kost marge, dus plan de uitverkoop bewust.',
    valkuilen: 'Te veel voorraad die kapitaal vastlegt, te laat afprijzen, en inkoop die niet aansluit op wat verkoopt.',
    vragen: ['Wat is mijn brutomarge deze maand?', 'Hoeveel voorraad legt kapitaal vast?', 'Hoe verwerk ik retouren in de btw?']
  },
  vervoer: {
    label: 'Vervoer',
    kosten: 'Brandstof/energie, afschrijving en onderhoud van het voertuig, verzekering, de chauffeur en (bij jets/charter) landings- en havengelden.',
    kpis: 'Omzet per rit en per uur, bezette versus lege kilometers, brandstof per rit en de kostprijs per kilometer.',
    btwlet: 'Personenvervoer valt vaak in het lage tarief; internationale ritten kunnen anders of niet belast zijn. Houd de ritten per soort uit elkaar.',
    seizoen: 'Pieken rond evenementen, vakanties en weekenden; plan chauffeurs op de vraag.',
    valkuilen: 'Lege kilometers, uitgesteld onderhoud, en een tarief dat de brandstof- en afschrijvingskosten niet dekt.',
    vragen: ['Wat is mijn kostprijs per kilometer?', 'Welk btw-tarief geldt voor mijn ritten?', 'Hoeveel houd ik over per rit na brandstof?']
  },
  verhuur: {
    label: 'Verhuur',
    kosten: 'Afschrijving van het verhuurobject, onderhoud en reiniging, verzekering, en het geld dat in de vloot vastzit.',
    kpis: 'Bezettingsgraad van de vloot, opbrengst per object per dag, onderhoudskosten per object en de schade-/borgverliezen.',
    btwlet: 'Verhuur valt meestal in het hoge tarief. Een borg is geen omzet zolang die terugbetaald wordt; pas bij inhouding wordt het omzet met btw.',
    seizoen: 'Vraag piekt in vakanties en rond evenementen; stem de vlootgrootte af op het gemiddelde, niet op de piek.',
    valkuilen: 'Stilstaande objecten die toch afschrijven, schade die niet op de borg verhaald wordt, en te grote vloot.',
    vragen: ['Wat verdient een object gemiddeld per dag?', 'Hoe boek ik een ingehouden borg?', 'Wat kost stilstand mij per object?']
  },
  vastgoed: {
    label: 'Vastgoed',
    kosten: 'Overwegend eigen tijd en marketing; bij verhuurbeheer ook onderhoud. De omzet is courtage of beheervergoeding.',
    kpis: 'Courtage per transactie, doorlooptijd van aanbod tot verkoop, conversie van bezichtiging naar bod en de pijplijnwaarde.',
    btwlet: 'Bemiddeling/courtage valt in het hoge tarief. De verkoop van bestaand vastgoed zelf is meestal vrijgesteld (overdrachtsbelasting speelt daar, niet btw).',
    seizoen: 'De markt beweegt met rente en seizoen; voorjaar is traditioneel actiever.',
    valkuilen: 'Pijplijn die opdroogt, te veel tijd in kansloze objecten, en courtage die de doorlooptijd niet dekt.',
    vragen: ['Wat is mijn gemiddelde courtage per deal?', 'Valt courtage onder btw?', 'Hoe groot is mijn pijplijn nu?']
  },
  activiteiten: {
    label: 'Activiteiten',
    kosten: 'Personeel/gidsen, materiaal en locatie, verzekering en marketing. Veel omzet komt vooraf binnen via tickets.',
    kpis: 'Bezetting per tijdslot, opbrengst per deelnemer, no-show-percentage en de kosten per sessie.',
    btwlet: 'Toegang tot activiteiten valt vaak in het lage tarief; horeca of verkoop eromheen kan hoog zijn. Vooruitbetaalde tickets zijn pas omzet bij deelname.',
    seizoen: 'Sterk weer- en vakantieafhankelijk; overboek verstandig tegen no-shows.',
    valkuilen: 'Lege tijdsloten, no-shows, en materiaal dat niet wordt terugverdiend.',
    vragen: ['Wat is mijn bezetting per tijdslot?', 'Wanneer wordt een vooruitbetaald ticket omzet?', 'Welk btw-tarief geldt voor de entree?']
  },
  groothandel: {
    label: 'Groothandel',
    kosten: 'Inkoop (grootste post, dunne marges), logistiek en opslag, en debiteuren (klanten die op rekening kopen).',
    kpis: 'Brutomarge per productgroep, voorraadrotatie, gemiddelde betaaltermijn van klanten en de orderomvang.',
    btwlet: 'Binnenlandse leveringen belast; leveringen aan zakelijke afnemers in het buitenland kunnen 0% of verlegd zijn. Leg de btw-nummers vast.',
    seizoen: 'Afhankelijk van de afnemende sectoren; let op klanten die traag betalen.',
    valkuilen: 'Te lange betaaltermijnen die je liquiditeit opeten, dode voorraad, en marges die verdampen op inkoop.',
    vragen: ['Wat is mijn brutomarge per productgroep?', 'Hoe zit het met btw bij buitenlandse afnemers?', 'Hoe lang doen klanten over betalen?']
  },
  beveiliging: {
    label: 'Beveiliging',
    kosten: 'Vrijwel alles is personeel (uren, toeslagen, opleiding en certificering), plus uitrusting en verzekering.',
    kpis: 'Marge per ingezet uur, verhouding declarabele versus niet-declarabele uren, verzuim en de dekking van de posten.',
    btwlet: 'Beveiligingsdiensten vallen in het hoge tarief. Houd toeslaguren en onregelmatigheid goed bij voor de loonkosten.',
    seizoen: 'Evenementen en feestdagen geven pieken; plan personeel en toeslagen daarop.',
    valkuilen: 'Niet-declarabele uren, te dun geplande posten, en toeslagen die het tarief niet dekt.',
    vragen: ['Wat is mijn marge per ingezet uur?', 'Hoeveel van mijn uren zijn declarabel?', 'Hoe reken ik toeslaguren door?']
  },
  zzp: {
    label: 'Zelfstandige',
    kosten: 'Vooral eigen tijd; daarnaast gereedschap/materiaal, verzekering, en reserveringen voor belasting en pensioen.',
    kpis: 'Declarabele uren, uurtarief versus kostprijs, en de reservering voor inkomstenbelasting en btw.',
    btwlet: 'Reserveer elke maand de btw en een deel voor de inkomstenbelasting; die zijn niet van u. Let op de kleineondernemersregeling als u daaronder valt.',
    seizoen: 'Inkomsten schommelen; houd een buffer voor rustige maanden en vakantie.',
    valkuilen: 'De belasting-reservering opmaken, te laag uurtarief, en te weinig declarabele uren.',
    vragen: ['Hoeveel moet ik opzij zetten voor de belasting?', 'Wat is mijn kostprijs per uur?', 'Val ik onder de kleineondernemersregeling?']
  },
  default: {
    label: 'Onderneming',
    kosten: 'Inkoop of directe kosten, personeel, huisvesting en overhead.',
    kpis: 'Brutomarge, personeelskosten als % van de omzet, en wat er netto overblijft.',
    btwlet: 'Houd de omzet per btw-tarief uit elkaar en reserveer de af te dragen btw; die is niet van u.',
    seizoen: 'Ken uw drukke en rustige maanden en leg in de drukke een buffer aan.',
    valkuilen: 'Kosten die ongemerkt oplopen, btw die niet gereserveerd is, en te dunne marges.',
    vragen: ['Wat houd ik deze maand netto over?', 'Hoeveel btw moet ik afdragen?', 'Zijn mijn personeelskosten gezond?']
  }
};

module.exports = { PROFIELEN };

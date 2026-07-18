/* Vertaallaag (deelmodule): de woordenboeken. NL2EN dekt de vaste
   seed-inhoud, WORDS_NL_EN/WORDS_EN_NL de woord-voor-woord terugval,
   EN2NL is de afgeleide omkering. Pure data, geen logica. */
/* Vaste seed-inhoud: Nederlands -> Engels. Deterministisch, dekt de hele
   demo-inhoud (facturen, reis, posts, reacties, menukaarten, partnerreizen). */
const NL2EN = {
  // facturen
  'Ibiza, Aguamarina, 3 nachten': 'Ibiza, Aguamarina, 3 nights',
  'Villa Bahia Ibiza, Cala Jondal, 4 nachten': 'Villa Bahia Ibiza, Cala Jondal, 4 nights',
  'Privejet Schiphol - Ibiza (retour, gedeeld)': 'Private jet Schiphol - Ibiza (return, shared)',
  'Jaarbijdrage lidmaatschap 2026': 'Annual membership contribution 2026',
  'Vervalt 28 juli 2026': 'Due 28 July 2026',
  'Vervalt 15 augustus 2026': 'Due 15 August 2026',
  'Betaald op 2 mei 2026': 'Paid on 2 May 2026',
  'Betaald op 4 januari 2026': 'Paid on 4 January 2026',
  'Zojuist betaald': 'Just paid',
  // reis
  '18 - 25 juli 2026': '18 - 25 July 2026',
  '18 jul': '18 Jul', '18-21 jul': '18-21 Jul', '19 jul': '19 Jul', '20 jul': '20 Jul', '21-25 jul': '21-25 Jul',
  'KLM KL1263, Amsterdam Schiphol \u2192 Ibiza': 'KLM KL1263, Amsterdam Schiphol \u2192 Ibiza',
  'Economy comfort, 2 personen \u00b7 de rest van de groep vloog priv\u00e9': 'Economy comfort, 2 people \u00b7 the rest of the group flew private',
  'Economy comfort, 2 personen': 'Economy comfort, 2 people',
  'Priv\u00e9transfer luchthaven \u2192 Aguamarina': 'Private transfer airport \u2192 Aguamarina',
  'Chauffeur wacht bij aankomsthal, naambord RTG': 'Driver waits in the arrivals hall, RTG name board',
  'Chauffeur bij aankomsthal': 'Driver in the arrivals hall',
  'Aguamarina Ibiza, Sea-view suite': 'Aguamarina Ibiza, Sea-view suite',
  '3 nachten, ontbijt, late check-out': '3 nights, breakfast, late check-out',
  '3 nachten, late check-out': '3 nights, late check-out',
  'Diner, Sal de Mar': 'Dinner, Sal de Mar',
  'Chef-menu \u00b7 tafel 21:00 uur': 'Chef menu \u00b7 table 21:00',
  'Chef-menu \u00b7 21:00 uur': 'Chef menu \u00b7 21:00',
  'Priv\u00e9boot naar Formentera': 'Private boat to Formentera',
  'Met de hele groep \u00b7 10:00 uur': 'With the whole group \u00b7 10:00',
  'Met de groep \u00b7 10:00 uur': 'With the group \u00b7 10:00',
  'Villa Bahia Ibiza, Cala Jondal': 'Villa Bahia Ibiza, Cala Jondal',
  '4 nachten, eigen zwembad': '4 nights, private pool',
  // post-teksten (seed)
  'Met de hele vriendengroep neergestreken: de helft in het hotel aan zee, wij met z\'n vieren in de villa boven Cala Jondal. Rahul kwam met de priv\u00e9jet vanaf Schiphol, wij pakten gewoon de ochtendvlucht, en toch checken we samen in. Dit is reizen zonder gedoe.':
    'The whole group of friends has landed: half in the seaside hotel, the four of us in the villa above Cala Jondal. Rahul came by private jet from Schiphol, we just took the morning flight, and still we check in together. This is travel without hassle.',
  'Ochtend: twee calls vanaf het terras. Middag: boot naar Formentera met de groep. De Business Pass plant mijn dag strakker dan welke assistent ook, en de jet stond klaar op Schiphol Business Aviation.':
    'Morning: two calls from the terrace. Afternoon: boat to Formentera with the group. The Business Pass plans my day tighter than any assistant, and the jet was ready at Schiphol Business Aviation.',
  'Wij oude rotten trekken de bergen in terwijl de jeugd op Ibiza ligt. Chalet in Gstaad, open haard, en morgen een priv\u00e9lift de piste op. Op je 69e mag dat.':
    'We old hands head into the mountains while the youngsters lie on Ibiza. A chalet in Gstaad, an open fire, and tomorrow a private lift up the slopes. At 69 you are allowed.',
  'Na mijn voetbaljaren dacht ik alles gezien te hebben in Monaco, maar aankomen op codenaam en toch als vanouds ontvangen worden, dat is nieuw. Eerst de jachthaven, dan het casino.':
    'After my football years I thought I had seen everything in Monaco, but arriving on a codename and still being received as ever, that is new. First the marina, then the casino.',
  'Een week Dubai met vrienden: de een in de wolkenkrabber-suite, de ander in een strandappartement aan de Palm. Ik werk voor de Nederlandse staat, maar deze dagen tel ik even niet mee.':
    'A week in Dubai with friends: one in the skyscraper suite, the other in a beach apartment on the Palm. I work for the Dutch state, but these days I am simply off the clock.',
  'Een ring gesmeed voor de tweeling van Ashley, hier op het terras afgemaakt. Goudsmid zijn op vakantie, omdat het niet als werk voelt tussen deze mensen. 30% van mijn bijdrage ging bovendien naar de RTFoundation.':
    'Forged a ring for Ashley\'s twins, finished right here on the terrace. Being a goldsmith on holiday, because it does not feel like work among these people. And 30% of my contribution went to the RTFoundation.',
  // reacties (seed)
  'Tussen twee tentamens door even bijkomen, precies wat ik nodig had.': 'Recovering between two exams, exactly what I needed.',
  '22, tussen twee tentamens door even bijkomen, precies wat ik nodig had.': '22, recovering between two exams, exactly what I needed.',
  'Snackbar dicht, telefoon uit, ik ben even niemands baas.': 'Snack bar closed, phone off, for once I am nobody\'s boss.',
  'De strandtent hier kan nog wat leren van ons, maar de zonsondergang niet.': 'The beach bar here could learn a thing from us, but the sunset could not.',
  'En vanavond koken we samen in de villa, jij snijdt.': 'And tonight we cook together in the villa, you chop.',
  'Als schooldirectrice tel ik de dagen af tot de vakantie; deze is het waard.': 'As a head teacher I count down the days to the holiday; this one is worth it.',
  'Vanuit Monaco groeten wij Gstaad. De boekhouding klopt, de ros\u00e9 ook.': 'From Monaco we greet Gstaad. The books add up, and so does the ros\u00e9.',
  'Wij zitten in Dubai, andere warmte, dezelfde club. Tot in september.': 'We are in Dubai, different heat, same club. See you in September.',
  'Als arts weet ik: rust is ook zorg. Deze zonsondergang is op doktersvoorschrift.': 'As a doctor I know: rest is care too. This sunset is on doctor\'s orders.',
  'En als jullie advocaat zeg ik: de contracten kunnen wachten tot maandag.': 'And as your lawyer I say: the contracts can wait until Monday.',
  'Twee kleine mannetjes thuis bij oma, ik hier even mama-af. Dank Summer.': 'Two little ones at home with grandma, me here off mum-duty for a moment. Thanks Summer.',
  'Shoot afgezegd, vriendinnen gekozen. Beste besluit van het jaar.': 'Shoot cancelled, friends chosen. Best decision of the year.',
  'Model zijn is 90% wachten; hier wacht ik met een cocktail.': 'Modelling is 90% waiting; here I wait with a cocktail.',
  // menu, Sal de Mar
  'Gazpacho de sandia': 'Gazpacho de sandia', 'Koude tomaten-watermeloensoep met basilicum.': 'Chilled tomato-watermelon soup with basil.',
  'Pulpo a la brasa': 'Pulpo a la brasa', 'Gegrilde octopus, aardappelcreme, pimenton.': 'Grilled octopus, potato cream, pimenton.',
  'Ibicenca lamsrack': 'Ibicenca lamb rack', 'Van het eiland, kruidenkorst, seizoensgroenten.': 'From the island, herb crust, seasonal vegetables.',
  'Flao, Ibizaanse kaastaart': 'Flao, Ibizan cheesecake', 'Met munt en honing, huisrecept.': 'With mint and honey, house recipe.',
  'Cava brut, per glas': 'Cava brut, by the glass', 'Huisselectie, koud geserveerd.': 'House selection, served cold.',
  'Voorgerechten': 'Starters', 'Hoofdgerechten': 'Mains', 'Zoet': 'Sweet',
  // menu, Sunset Ibiza
  'Hierbas Sunset': 'Hierbas Sunset', 'Ibizaanse kruidenlikeur, citroen, bruisend.': 'Ibizan herb liqueur, lemon, sparkling.',
  'Sangria blanca': 'Sangria blanca', 'Cava, perzik, munt.': 'Cava, peach, mint.',
  'Virgin Colada (0%)': 'Virgin Colada (0%)', 'Kokos, ananas, geen alcohol.': 'Coconut, pineapple, no alcohol.',
  'Patatas bravas': 'Patatas bravas', 'Met pittige saus en aioli.': 'With spicy sauce and aioli.',
  'Signatuur': 'Signature', 'Alcoholvrij': 'Non-alcoholic', 'Hapjes': 'Bites', 'Dranken': 'Drinks',
  // partnerreizen
  'Ibiza, jetset-week': 'Ibiza, jetset week', '7 dagen \u00b7 zomer 2026': '7 days \u00b7 summer 2026',
  'Vanaf Schiphol naar het eiland: deels hotel aan zee, deels een villa met eigen zwembad, boot naar Formentera en diners bij de beste adressen.':
    'From Schiphol to the island: part seaside hotel, part villa with its own pool, a boat to Formentera and dinners at the finest addresses.',
  'Gstaad, alpien weekend': 'Gstaad, alpine weekend', '4 dagen \u00b7 doorlopend': '4 days \u00b7 year-round',
  'Een chalet met open haard, priv\u00e9lift de piste op en diners in de bergen, hetzelfde adres waar onze leden over posten in De Salon.':
    'A chalet with an open fire, a private lift up the slopes and dinners in the mountains, the same address our members post about in The Salon.',
  'Monaco, haven & glamour': 'Monaco, harbour & glamour',
  'Suite met zicht op de jachthaven, een avond in het casino en een tafel langs het circuit, ingekocht zoals wij dat voor leden doen.':
    'A suite overlooking the marina, an evening at the casino and a table along the circuit, bought the way we do for members.',
  'Vlucht of priv\u00e9jet vanaf Schiphol': 'Flight or private jet from Schiphol', 'Aguamarina Ibiza, 3 nachten': 'Aguamarina Ibiza, 3 nights',
  'Villa Bahia Ibiza, 4 nachten': 'Villa Bahia Ibiza, 4 nights', 'Priv\u00e9boot & transfers': 'Private boat & transfers',
  'Vlucht & transfers': 'Flight & transfers', 'Chalet, 3 nachten': 'Chalet, 3 nights',
  'Skipas & priv\u00e9lift': 'Ski pass & private lift', 'Diner in de bergen': 'Dinner in the mountains',
  'Vlucht & priv\u00e9transfers': 'Flight & private transfers', 'Suite met havenzicht, 3 nachten': 'Suite with harbour view, 3 nights',
  'Avond in het casino': 'Evening at the casino', 'Tafel langs het circuit': 'Table along the circuit',
  // locatielabels
  'Santa Eularia, Ibiza': 'Santa Eularia, Ibiza', 'Marina Botafoch, Ibiza': 'Marina Botafoch, Ibiza',
  'Cala Jondal, Ibiza': 'Cala Jondal, Ibiza', 'Sant Antoni, Ibiza': 'Sant Antoni, Ibiza',
  'Aeroport dEivissa': 'Eivissa Airport', 'Dalt Vila, Ibiza': 'Dalt Vila, Ibiza', 'Ibiza-stad, haven': 'Ibiza town, harbour',
  'Schiphol Business Aviation': 'Schiphol Business Aviation', 'Live positie': 'Live position'
};

/* Veelgebruikte woorden voor de woord-voor-woord terugval (demo zonder API).
   Niet perfect, maar geeft de ontvanger een leesbaar idee in zijn eigen taal. */
const WORDS_NL_EN = {
  'hallo':'hello','hoi':'hi','dank':'thanks','dankjewel':'thank you','bedankt':'thanks','alsjeblieft':'please',
  'ja':'yes','nee':'no','graag':'gladly','mooi':'beautiful','prachtig':'gorgeous','geweldig':'great',
  'reis':'trip','reizen':'travel','hotel':'hotel','kamer':'room','diner':'dinner','lunch':'lunch','ontbijt':'breakfast',
  'wanneer':'when','waar':'where','hoe':'how','welk':'which','welke':'which','wat':'what','wie':'who',
  'boeken':'to book','geboekt':'booked','prijs':'price','korting':'discount','betalen':'to pay','betaald':'paid',
  'ik':'I','je':'you','jij':'you','u':'you','wij':'we','met':'with','voor':'for','naar':'to','van':'from','in':'in','op':'on',
  'en':'and','of':'or','niet':'not','ook':'also','heel':'very','erg':'very','goed':'good','leuk':'nice','stad':'city',
  'strand':'beach','zon':'sun','weer':'weather','vraag':'question','antwoord':'answer','bericht':'message','groeten':'regards',
  'zie':'see','ik zie':'I see','morgen':'tomorrow','vandaag':'today','avond':'evening','ochtend':'morning',
  'restaurant':'restaurant','tafel':'table','fles':'bottle','wijn':'wine','koffie':'coffee','thee':'tea',
  'is':'is','ben':'am','was':'was','zijn':'are','heb':'have','heeft':'has','kan':'can','kunnen':'can','wil':'want','willen':'want'
};
const WORDS_EN_NL = Object.fromEntries(Object.entries(WORDS_NL_EN).map(([k, v]) => [v, k]));

const EN2NL = {};
for (const [nl, en] of Object.entries(NL2EN)) if (!(en in EN2NL)) EN2NL[en] = nl;

module.exports = { NL2EN, WORDS_NL_EN, WORDS_EN_NL, EN2NL };

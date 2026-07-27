/* RTG School, leerlijn VO verbreed (deel 3): de betavakken en Frans voor
   havo/vwo, informatica, en de extra vakken voor mbo, hbo en wo. */
const MBO = ['mbo-1', 'mbo-2', 'mbo-3', 'mbo-4'];
const HBO = ['hbo-ad', 'hbo-b', 'hbo-m'];
const WO = ['wo-b', 'wo-m', 'wo-phd'];

module.exports.VO3 = [
  { vak: 'natuurkunde', fasen: ['havo', 'vwo'], doelen: [
    { id: 'natuurkunde.havo.eenheden', naam: 'Grootheden en eenheden', ref: '3F',
      les: 'Meten is weten, maar alleen met de juiste eenheid: lengte in meters, massa in kilogrammen, tijd in seconden. Omrekenen gaat altijd via machten van tien.',
      gen: { soort: 'metriek' } },
    { id: 'natuurkunde.havo.formules', naam: 'Snelheid, kracht en energie', ref: '3F',
      les: 'Snelheid is afstand gedeeld door tijd (v = s/t). Wie 100 kilometer in 2 uur aflegt, gaat gemiddeld 50 km/u. Formules zijn geen toverspreuken: elke letter is een meting.',
      gen: { soort: 'mc', vragen: [
        ['Je fietst 30 kilometer in 2 uur. Wat is je gemiddelde snelheid?', '15 km/u', '60 km/u', '32 km/u'],
        ['Wat is de formule voor snelheid?', 'v = s / t', 'v = s x t', 'v = t / s'],
        ['In welke eenheid meet je kracht?', 'newton', 'kilogram', 'volt'],
        ['Wat gebeurt er met de remweg als je twee keer zo snel rijdt?', 'die wordt veel langer', 'die blijft gelijk', 'die wordt korter']
      ] } }
  ]},
  { vak: 'scheikunde', fasen: ['havo', 'vwo'], doelen: [
    { id: 'scheikunde.havo.symbolen', naam: 'Elementen en symbolen', ref: '3F',
      les: 'Elk element heeft een symbool uit het periodiek systeem: H is waterstof, O zuurstof, Fe ijzer. Water is H2O: twee waterstof, een zuurstof.',
      gen: { soort: 'mc', vragen: [
        ['Wat is het symbool voor zuurstof?', 'O', 'Z', 'S'],
        ['Waar staat H voor?', 'waterstof', 'helium', 'houtstof'],
        ['Wat is de formule van water?', 'H2O', 'CO2', 'O2'],
        ['Fe is het symbool voor:', 'ijzer', 'fosfor', 'fluor'],
        ['Wat is CO2?', 'koolstofdioxide', 'zuurstof', 'keukenzout']
      ] } }
  ]},
  { vak: 'frans', fasen: ['havo', 'vwo'], doelen: [
    { id: 'frans.havo.woordenschat', naam: 'Franse basiswoordenschat', ref: '3F',
      les: 'Frans begint bij de begroeting: bonjour, merci, s’il vous plait. Lees de woorden hardop; de uitspraak is het halve werk.',
      gen: { soort: 'mc', vragen: [
        ['Wat betekent "bonjour"?', 'goedendag', 'tot ziens', 'goedenacht'],
        ['Wat is Frans voor "dank u wel"?', 'merci', 'pardon', 'bonsoir'],
        ['Wat betekent "l’ecole"?', 'de school', 'de kerk', 'de winkel'],
        ['Wat is Frans voor "boek"?', 'le livre', 'le lit', 'la lettre'],
        ['Wat betekent "la semaine"?', 'de week', 'de zon', 'het seizoen']
      ] } }
  ]},
  { vak: 'informatica', fasen: ['havo', 'vwo'], doelen: [
    { id: 'informatica.havo.begrippen', naam: 'Hoe computers denken', ref: '3F',
      les: 'Een computer voert stap voor stap instructies uit: een algoritme. Alles is uiteindelijk binair (nullen en enen), en een goed wachtwoord is lang en uniek.',
      gen: { soort: 'mc', vragen: [
        ['Wat is een algoritme?', 'een stappenplan dat een computer uitvoert', 'een computervirus', 'een merk laptop'],
        ['Waaruit bestaat binaire code?', 'nullen en enen', 'letters en cijfers', 'plussen en minnen'],
        ['Wat maakt een wachtwoord sterk?', 'lang en uniek', 'je eigen naam', 'overal hetzelfde'],
        ['Wat is phishing?', 'iemand lokt je gegevens met een nepbericht', 'een sport', 'een zoekmachine']
      ] } }
  ]},
  { vak: 'nederlands', fasen: MBO, doelen: [
    { id: 'nederlands.mbo.zakelijk', naam: 'Zakelijk schrijven', ref: '2F',
      les: 'Een zakelijke mail heeft een duidelijke onderwerpregel, een nette aanhef, een kernboodschap in de eerste zin en een vriendelijke afsluiting.',
      gen: { soort: 'mc', vragen: [
        ['Wat is een goede aanhef voor een zakelijke mail?', 'Geachte heer/mevrouw,', 'Yo!', 'Hee jij daar,'],
        ['Waar zet je de kernboodschap?', 'in de eerste zinnen', 'helemaal onderaan', 'nergens'],
        ['Wat hoort in de onderwerpregel?', 'kort waar de mail over gaat', 'je hele verhaal', 'niets'],
        ['Hoe sluit je netjes af?', 'Met vriendelijke groet,', 'Doei!', 'Later,']
      ] } }
  ]},
  { vak: 'digitaal', fasen: MBO, doelen: [
    { id: 'digitaal.mbo.vaardig', naam: 'Digitaal vaardig op het werk', ref: '2F',
      les: 'Op het werk ga je zorgvuldig om met gegevens: sterke wachtwoorden, geen klantdata delen, en bij een verdacht bericht eerst checken voordat je klikt.',
      gen: { soort: 'mc', vragen: [
        ['Je krijgt een verdachte mail met een link. Wat doe je?', 'niet klikken en het melden', 'meteen klikken', 'doorsturen naar iedereen'],
        ['Mag je klantgegevens delen in een groepsapp?', 'nee, nooit', 'ja, altijd', 'alleen op vrijdag'],
        ['Wat is twee-staps-verificatie?', 'inloggen met wachtwoord plus een extra code', 'twee keer hetzelfde wachtwoord', 'twee accounts'],
        ['Wat doe je met een werk-laptop in de trein?', 'vergrendelen als je wegloopt', 'open laten staan', 'uitlenen']
      ] } }
  ]},
  { vak: 'communicatie', fasen: HBO, doelen: [
    { id: 'communicatie.hbo.zakelijk', naam: 'Professioneel communiceren', ref: '4F',
      les: 'Professionele communicatie is afgestemd op de ontvanger: eerst luisteren en samenvatten, dan reageren. Feedback geef je concreet, over gedrag en niet over de persoon.',
      gen: { soort: 'mc', vragen: [
        ['Goede feedback gaat over:', 'concreet gedrag', 'de persoon zelf', 'oude koeien'],
        ['Wat doe je eerst in een lastig gesprek?', 'luisteren en samenvatten', 'je gelijk halen', 'harder praten'],
        ['Een goede presentatie begint met:', 'de kernboodschap voor dit publiek', 'veertig dia’s tekst', 'een uur geschiedenis'],
        ['Wat is actief luisteren?', 'doorvragen en samenvatten wat je hoort', 'knikken en aan iets anders denken', 'onderbreken']
      ] } }
  ]},
  { vak: 'academisch', fasen: WO, doelen: [
    { id: 'academisch.wo.schrijven', naam: 'Academisch schrijven', ref: '4F',
      les: 'Een academische tekst maakt elke bewering controleerbaar: bronvermelding, een heldere onderzoeksvraag, en een conclusie die niet verder gaat dan de data draagt.',
      gen: { soort: 'mc', vragen: [
        ['Waarom vermeld je bronnen?', 'zodat elke bewering controleerbaar is', 'om langer te lijken', 'omdat het mooi staat'],
        ['Een goede onderzoeksvraag is:', 'afgebakend en te onderzoeken', 'zo breed mogelijk', 'al beantwoord'],
        ['De conclusie mag:', 'niet verder gaan dan de data draagt', 'alles beweren', 'nieuwe data introduceren'],
        ['Wat is plagiaat?', 'andermans werk als het jouwe presenteren', 'een citaat met bronvermelding', 'samenwerken']
      ] } }
  ]}
];

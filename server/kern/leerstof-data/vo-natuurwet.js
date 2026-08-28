/* RTG School, leerlijn voortgezet onderwijs: natuurkunde, scheikunde en biologie. Per FASE uit de niveauladder in plaats
   van per groep; vmbo is de gedeelde basis, havo bouwt erop voort en vwo weer
   op havo.

   Waarom hier het meeste te winnen viel: van de vierendertig vo-doelen
   draaiden er eenentwintig op 'mc' met vier handgeschreven vragen. Juist bij
   de exacte vakken is elke opgave uit te rekenen -- en dus te genereren. De
   `formule`-generator draagt hier snelheid, dichtheid, de wet van Ohm, arbeid,
   dichtheid en concentratie: een sjabloon met twee getallen en de som die
   daaruit volgt.

   De ids van bestaande doelen zijn ongewijzigd: het leerpaspoort verwijst
   ernaar, ook als de vorm van de opgave verandert. */
const VMBO = ['vmbo-bb', 'vmbo-kb', 'vmbo-gl', 'vmbo-tl'];
const ALLE_VO = VMBO.concat(['havo', 'vwo']);

module.exports.VO_NATUURWET = [
  { vak: 'natuurkunde', fasen: ['havo', 'vwo'], doelen: [
    { id: 'natuurkunde.havo.eenheden', naam: 'Grootheden en eenheden',
      les: 'Elke grootheid heeft een eenheid: lengte in meter, massa in kilogram, tijd in seconde. Reken altijd eerst om naar deze basiseenheden.',
      vereist: ['rekenen.g8.meten-metriek'],
      uitleg: [
        { soort: 'stap', tekst: 'Zet voordat je rekent alles om: kilometers naar meters, minuten naar seconden, grammen naar kilogrammen. Daarna klopt de uitkomst vanzelf.' },
        { soort: 'praktijk', tekst: 'De meeste fouten bij natuurkunde zijn geen rekenfouten maar eenheidsfouten. Een antwoord zonder eenheid is geen antwoord.' }],
      gen: { soort: 'metriek' } },
    { id: 'natuurkunde.havo.formules', naam: 'Snelheid, kracht en energie',
      les: 'Snelheid is afstand gedeeld door tijd (v = s/t), kracht is massa maal versnelling (F = m x a), arbeid is kracht maal weg (W = F x s).',
      vereist: ['natuurkunde.havo.eenheden'],
      uitleg: [
        { soort: 'stap', tekst: 'Schrijf de formule op, zet de gegevens erbij met hun eenheid, en reken pas dan. Die volgorde scheelt de helft van de fouten.' },
        { soort: 'analogie', tekst: 'Een formule is een recept: v = s/t zegt letterlijk "deel de afgelegde weg door de tijd die je erover deed".' }],
      gen: { soort: 'formule', vraag: 'Een fietser legt %a meter af in %b seconden. Wat is zijn snelheid in m/s?',
        a: [100, 900, 10], b: [10, 60, 5], antwoord: 'a/b' } },
    { id: 'natuurkunde.havo.ohm', naam: 'De wet van Ohm',
      les: 'Spanning is stroom maal weerstand: U = I x R. Twee gegevens leveren altijd de derde op.',
      vereist: ['natuurkunde.havo.formules'],
      uitleg: [
        { soort: 'stap', tekst: 'Dek in de formule af wat je zoekt. Staat U bovenaan, dan blijft I x R over; zoek je I, dan blijft U / R over.' },
        { soort: 'praktijk', tekst: 'Een lamp die minder fel brandt op een lange kabel: die kabel heeft weerstand, dus valt er spanning over die niet meer bij de lamp aankomt.' }],
      gen: { soort: 'formule', vraag: 'Door een weerstand van %b ohm loopt een stroom van %a ampere. Hoe groot is de spanning in volt?',
        a: [1, 10, 1], b: [2, 40, 2], antwoord: 'a*b' } },
    { id: 'natuurkunde.vwo.dichtheid', naam: 'Dichtheid en massa', fasen: ['vwo'],
      les: 'Dichtheid is massa per volume: rho = m / V. Daarmee weet je of iets drijft of zinkt, zonder het in het water te leggen.',
      vereist: ['natuurkunde.havo.formules'],
      uitleg: [
        { soort: 'stap', tekst: 'Massa in kilogram, volume in kubieke meter, dichtheid in kg per kubieke meter. Water heeft 1000; alles wat minder heeft, drijft.' },
        { soort: 'praktijk', tekst: 'Een blok ijzer zinkt, een ijzeren schip drijft. Het gaat niet om het materiaal maar om massa gedeeld door volume.' }],
      gen: { soort: 'formule', vraag: 'Een blok heeft een massa van %a gram en een volume van %b kubieke centimeter. Wat is de dichtheid in g/cm3?',
        a: [100, 2000, 50], b: [2, 20, 1], antwoord: 'a/b' } }
  ]},

  { vak: 'scheikunde', fasen: ['havo', 'vwo'], doelen: [
    { id: 'scheikunde.havo.symbolen', naam: 'Elementen en symbolen',
      les: 'Elk element heeft een symbool van een of twee letters: H is waterstof, O zuurstof, Fe ijzer. Water is H2O: twee waterstof en een zuurstof.',
      uitleg: [
        { soort: 'stap', tekst: 'De eerste letter is altijd een hoofdletter, de tweede altijd klein. CO is koolstofmonoxide, Co is kobalt -- dat verschil is geen slordigheid.' },
        { soort: 'praktijk', tekst: 'Veel symbolen komen uit het Latijn: Fe van ferrum (ijzer), Na van natrium, Au van aurum (goud).' }],
      gen: { soort: 'koppel', vraag: 'Welk element is %s?', terug: 'Wat is het symbool van %s?',
        paren: [['H', 'waterstof'], ['O', 'zuurstof'], ['C', 'koolstof'], ['N', 'stikstof'],
          ['Fe', 'ijzer'], ['Cu', 'koper'], ['Na', 'natrium'], ['Cl', 'chloor'],
          ['Ca', 'calcium'], ['Au', 'goud'], ['Ag', 'zilver'], ['Zn', 'zink']] } },
    { id: 'scheikunde.havo.stoffen', naam: 'Zuivere stoffen en mengsels',
      les: 'Een zuivere stof bestaat uit een soort deeltjes, een mengsel uit meer. Zout in water is een oplossing; olie en water is een emulsie.',
      vereist: ['scheikunde.havo.symbolen'],
      uitleg: [
        { soort: 'stap', tekst: 'Kun je het scheiden zonder de stof zelf te veranderen (filtreren, indampen, destilleren)? Dan was het een mengsel.' },
        { soort: 'praktijk', tekst: 'Kraanwater is een mengsel, gedestilleerd water is (bijna) zuiver. Lucht is ook een mengsel: stikstof, zuurstof en een beetje van de rest.' }],
      gen: { soort: 'indeling', vraag: 'Wat is %s?',
        groepen: { 'zuivere stof': ['gedestilleerd water', 'zuurstof', 'ijzer', 'suiker'],
          'mengsel': ['kraanwater', 'lucht', 'melk', 'brons'],
          'scheidingsmethode': ['filtreren', 'indampen', 'destilleren', 'centrifugeren'] } } },
    { id: 'scheikunde.havo.concentratie', naam: 'Concentratie berekenen',
      les: 'Concentratie is hoeveelheid stof per volume: c = m / V. Een oplossing van 20 gram zout in 2 liter water heeft 10 gram per liter.',
      vereist: ['scheikunde.havo.stoffen', 'wiskunde.vo.verhoudingen'],
      uitleg: [
        { soort: 'stap', tekst: 'Deel de massa door het volume. Let op de eenheden: gram per liter is iets anders dan gram per milliliter.' },
        { soort: 'praktijk', tekst: 'Op elk etiket van een schoonmaakmiddel of medicijn staat een concentratie. Verdunnen betekent hetzelfde spul in meer vloeistof: de concentratie daalt.' }],
      gen: { soort: 'formule', vraag: 'Er wordt %a gram zout opgelost in %b liter water. Wat is de concentratie in gram per liter?',
        a: [20, 400, 20], b: [2, 10, 1], antwoord: 'a/b' } }
  ]},

  { vak: 'biologie', fasen: ALLE_VO, doelen: [
    { id: 'biologie.vo.cellen', naam: 'Cellen: de bouwstenen van het leven',
      les: 'Alles wat leeft bestaat uit cellen. Een plantencel heeft een celwand en bladgroenkorrels; een dierlijke cel niet.',
      vereist: ['natuur.g6.lichaam'],
      uitleg: [
        { soort: 'stap', tekst: 'Onthoud het verschil aan de buitenkant: een celwand maakt de plantencel stevig en hoekig, een dierlijke cel is rond en soepel.' },
        { soort: 'analogie', tekst: 'De kern is het kantoor met de bouwtekeningen, de mitochondrien zijn de energiecentrales en het celmembraan is de portier.' }],
      gen: { soort: 'koppel', vraag: 'Wat doet %s in de cel?',
        paren: [['de celkern', 'het erfelijk materiaal bewaren'], ['het mitochondrion', 'energie leveren'],
          ['het celmembraan', 'bepalen wat er in en uit gaat'], ['de celwand', 'de plantencel stevigheid geven'],
          ['de bladgroenkorrel', 'fotosynthese uitvoeren'], ['het cytoplasma', 'de ruimte waarin alles ligt']] } },
    { id: 'biologie.vo.lichaam', naam: 'Organen en orgaanstelsels',
      les: 'Organen werken samen in stelsels: het bloedvatenstelsel vervoert, het ademhalingsstelsel haalt zuurstof, het verteringsstelsel breekt voedsel af.',
      vereist: ['biologie.vo.cellen'],
      uitleg: [
        { soort: 'stap', tekst: 'Werk van klein naar groot: cel, weefsel, orgaan, orgaanstelsel, organisme. Elk niveau doet iets wat het niveau eronder niet kan.' },
        { soort: 'praktijk', tekst: 'Buiten adem na het rennen: je ademhalingsstelsel en je bloedsomloop werken samen om je spieren zuurstof te geven.' }],
      gen: { soort: 'indeling', vraag: 'Bij welk orgaanstelsel hoort %s?',
        groepen: { 'bloedsomloop': ['het hart', 'de slagader', 'de ader'],
          'ademhaling': ['de longen', 'de luchtpijp', 'het middenrif'],
          'vertering': ['de maag', 'de dunne darm', 'de lever'],
          'zenuwstelsel': ['de hersenen', 'het ruggenmerg', 'een zenuw'] } } },
    { id: 'biologie.vo.erfelijkheid', naam: 'Erfelijkheid en DNA', fasen: ['havo', 'vwo'],
      les: 'DNA is de code voor hoe een organisme wordt gebouwd. Je krijgt de helft van elke ouder; dominante eigenschappen overheersen recessieve.',
      vereist: ['biologie.vo.cellen'],
      uitleg: [
        { soort: 'analogie', tekst: 'DNA is een receptenboek in elke cel. Een gen is een recept, en een chromosoom is een hoofdstuk met veel recepten.' },
        { soort: 'stap', tekst: 'Bij twee ouders met elk een dominant en een recessief allel is een op de vier kinderen recessief. Dat is de kruisingstabel.' }],
      gen: { soort: 'koppel', vraag: 'Wat is %s?',
        paren: [['DNA', 'het erfelijk materiaal'], ['een gen', 'een stukje DNA voor een eigenschap'],
          ['een chromosoom', 'een pakketje DNA in de celkern'], ['dominant', 'de eigenschap die overheerst'],
          ['recessief', 'de eigenschap die pas zichtbaar is zonder dominante'], ['een mutatie', 'een verandering in het DNA']] } }
  ]}
];

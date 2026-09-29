#!/usr/bin/env node
/* DE LEVENDE GETALLEN IN DE DOCUMENTEN -- een meetgetal in proza dat niet kan
   verouderen.

   HET PROBLEEM, en het is hier echt gebeurd. CLAUDE.md en CREATE.md par. 10
   noemden "van 3074 routes met een rol zijn er 115 beproefd en 2959 ongemeten".
   Dat klopte op de dag dat iemand het opschreef. Toen de idempotentieproef
   opnieuw draaide werd het 3092 / 845 / 2247, en stonden er twee documenten met
   een getal dat niemand meer nakeek. Een verkeerd getal in een document is erger
   dan geen getal: er wordt op besloten.

   ARCHITECTUUR.md en BEWIJS.md hebben dit al opgelost door HELEMAAL gegenereerd
   te zijn. Dat kan niet met CLAUDE.md: dat is proza met een redenering eromheen,
   en een generator die de redenering herschrijft maakt er onzin van. Vandaar
   deze tussenvorm: het VERHAAL blijft handwerk, het GETAL komt uit het register.

     ...zijn er <!--getal:idem.beoordeeld-->845<!--/getal--> beproefd...

   `npm run getallen` schrijft de verse waarde tussen de merktekens.
   `npm run getallen:controle` (en test/getallen.test.js) zakt zodra een document
   iets anders beweert dan het register. Zo is een verouderd getal geen kwestie
   van oplettendheid meer.

   WAT DIT NIET DOET, en dat hoort erbij: een getal ZONDER merktekens ziet dit
   script niet. Het lost dus niet op dat iemand morgen een nieuw cijfer intypt --
   het lost op dat de cijfers die we KENNEN vanzelf meelopen. De uitslag zegt
   daarom altijd hoeveel merktekens er zijn gevonden, zodat "nul" niet als "in
   orde" leest.

   EN DE BRON IS ALTIJD EEN REGISTER, nooit een berekening in dit bestand. Een
   tweede plek die zelf telt, zegt op een dag iets anders dan de meter waar hij
   over gaat (dezelfde reden als kern/command/vermogens.js). */
'use strict';
const fs = require('fs');
const path = require('path');
const WORTEL = path.join(__dirname, '..');

/* Per levend getal: uit welk register, welk veld, en wat het BETEKENT -- die
   laatste staat erbij zodat iemand die een merkteken tegenkomt weet wat hij
   leest zonder het register te openen. */
const GETALLEN = {
  'idem.routesMetRol': { bron: 'IDEMPROEF.json', veld: 'gemeten.routesMetRol',
    wat: 'routes met een rol die de idempotentieproef kon zien' },
  'idem.beoordeeld': { bron: 'IDEMPROEF.json', veld: 'gemeten.beoordeeld',
    wat: 'routes waarover de proef een uitspraak deed' },
  'idem.beschermd': { bron: 'IDEMPROEF.json', veld: 'gemeten.beschermd',
    wat: 'beoordeelde routes die een herhaling zelf opmerken' },
  'idem.onbeschermd': { bron: 'IDEMPROEF.json', veld: 'gemeten.onbeschermd',
    wat: 'beoordeelde routes die een herhaling niet opmerken' },
  'idem.ongemeten': { bron: 'IDEMPROEF.json', veld: 'gemeten.ongemeten',
    wat: 'routes waar de proef niet bij kon' },
  'vertrouwen.routes': { bron: 'VERTROUWEN.json', veld: 'telling.verzwakt',
    wat: 'routes met de vervalstaat verzwakt' },
  'vertrouwen.bewezen': { bron: 'VERTROUWEN.json', veld: 'telling.bewezen',
    wat: 'routes met de vervalstaat bewezen' },
  'vertrouwen.geschorst': { bron: 'VERTROUWEN.json', veld: 'telling.geschorst',
    wat: 'routes met de vervalstaat geschorst' },
  /* DE GEVOLGDEKKING (EXECUTIE.md blok 4). Deze getallen stonden in het document
     overgetypt en waren daardoor verouderd: er stond 96 van 176 terwijl de verse
     meting 87 van 173 zegt. Vandaar levend. */
  'gevolg.bereikbaar': { bron: 'GEVOLGDEKKING.json', veld: 'tellers.bereikbaarPerRol',
    wat: 'handelingen die het AI-stuur mag bedienen (live uit beleid.js)' },
  'gevolg.onbekend': { bron: 'GEVOLGDEKKING.json', veld: 'tellers.onbekendeEffectpaden',
    wat: 'AI-bereikbare handelingen waarvan NIET is gemeten wat zij veroorzaken (moet dalen)' },
  'gevolg.gemeten': { bron: 'GEVOLGDEKKING.json', veld: 'tellers.effectGemeten',
    wat: 'AI-bereikbare handelingen waarvan de proef zag welke collecties veranderen' },
  'gevolg.geenEffect': { bron: 'GEVOLGDEKKING.json', veld: 'tellers.effectGeenEffectGemeten',
    wat: 'AI-bereikbare handelingen waarbij de proef draaide en niets zag veranderen' },
  'gevolg.contractVolledig': { bron: 'GEVOLGDEKKING.json', veld: 'tellers.contractVolledig',
    wat: 'handelingen met een VOLLEDIG gevolgcontract (mag alleen stijgen)' },
  'gevolg.contractOnbekend': { bron: 'GEVOLGDEKKING.json', veld: 'tellers.contractOnbekend',
    wat: 'AI-bereikbare handelingen zonder enig gevolgcontract' },
  'machine.volledigeKetens': { bron: 'MACHINEDEKKING.json', veld: 'gemeten.volledigeKetens',
    wat: 'handelingen die de hele baan van de machine lopen (deze teller mag alleen stijgen)' },
  'machine.muterend': { bron: 'MACHINEDEKKING.json', veld: 'gemeten.muterend',
    wat: 'muterende routes (methode x pad) die de machinedekking heeft gewogen' },
  'machine.zonderAs': { bron: 'MACHINEDEKKING.json', veld: 'gemeten.mutatiesZonderEnigeAs',
    wat: 'muterende routes die geen enkele as van de eigen machinerie raken' },
  'machine.motorenZonderRoute': { bron: 'MACHINEDEKKING.json', veld: 'gemeten.motorenZonderRouteBereik',
    wat: 'motoren die geen enkele route bereiken' },
  'machine.hubRoutes': { bron: 'MACHINEDEKKING.json', veld: 'gemeten.bestandsasOnbruikbaar',
    wat: 'routes waarvoor de bestandsas onbruikbaar is omdat ze zelf in een hub wonen' },
  'machine.bewijsDraagt': { bron: 'MACHINEDEKKING.json', veld: 'gemeten.perAs.bewijsDraagt.bestand',
    wat: 'routes die het bewijstoken raken (proof-carrying authorization)' },
  'machine.mandaat': { bron: 'MACHINEDEKKING.json', veld: 'gemeten.perAs.mandaat.bestand',
    wat: 'routes die de mandaatgrammatica raken' },
  'machine.envelop': { bron: 'MACHINEDEKKING.json', veld: 'gemeten.perAs.envelop.bestand',
    wat: 'routes die de gebeurtenisenvelop raken' },
  'machine.mensAanDeDeur': { bron: 'MACHINEDEKKING.json', veld: 'gemeten.perAs.mensAanDeDeur.bestand',
    wat: 'routes waar de deur een bewezen mens eist' },
  'capabiliteit.lijsten': { bron: 'CAPABILITEIT.json', veld: 'woordenlijsten',
    wat: 'losse capability-woordenlijsten in de code' },
  'capabiliteit.leden': { bron: 'CAPABILITEIT.json', veld: 'leden',
    wat: 'leden over al die lijsten samen' },
  /* De kantoormacht: staat er een MENS achter de handeling (KANTOOR.md par. 1,
     KANTOORMACHT.md blok 0). De harde assen komen uit de router; `anoniem` is
     lexicaal en dus een ONDERgrens -- die graad hoort in het proza te staan. */
  'overleving.ja': { bron: 'OVERLEVING.json', veld: 'telling.ja',
    wat: 'compromis-scenario\'s die RTG aantoonbaar overleeft' },
  'overleving.deels': { bron: 'OVERLEVING.json', veld: 'telling.deels',
    wat: 'compromis-scenario\'s waar iets tussen staat, maar niet over de volle breedte' },
  'overleving.nee': { bron: 'OVERLEVING.json', veld: 'telling.nee',
    wat: 'compromis-scenario\'s die RTG gemeten NIET overleeft' },
  'overleving.onbekend': { bron: 'OVERLEVING.json', veld: 'telling.onbekend',
    wat: 'compromis-scenario\'s waarover niemand heeft gemeten' },
  'overleving.rijen': { bron: 'OVERLEVING.json', veld: 'telling.rijen',
    wat: 'compromis-scenario\'s in de overlevingsmeter' },
  /* De lus van Foundation Connect (CONNECT.md par. 0). Drie van de vier zijn
     een NUL of een bijna-nul, en dat is precies waarom ze hier staan: een nul
     ziet er vers en verouderd hetzelfde uit, dus een getal dat met de hand in
     een document is overgetypt blijft kloppen lang nadat hij dat niet meer doet.
     Zelfde reden als bij de stagevorm hieronder. */
  'connectlus.domeinen': { bron: 'CONNECTLUS.json', veld: 'werkwoorden.domeinen',
    wat: 'ontdekkingsdomeinen waarover de lus is gemeten' },
  'connectlus.combinaties': { bron: 'CONNECTLUS.json', veld: 'werkwoorden.combinaties',
    wat: 'verschillende combinaties van werkwoorden over die domeinen' },
  'connectlus.begrijp': { bron: 'CONNECTLUS.json', veld: 'werkwoorden.zeldzaamste.domeinen',
    wat: 'domeinen die het zeldzaamste werkwoord (begrijp) uitvoeren' },
  'connectlus.domeineigenPct': { bron: 'CONNECTLUS.json', veld: 'vorm.domeineigenPct',
    wat: 'percentage velden dat in precies EEN ontdekkingsdomein staat' },
  'connectlus.inAlle': { bron: 'CONNECTLUS.json', veld: 'vorm.inAlleDomeinen',
    wat: 'velden die in ALLE ontdekkingsdomeinen staan' },
  /* De planvorm (PLANNING.md par. 0). Zes van de tien zijn een NUL of een
     bijna-nul, en dat is precies waarom ze hier staan -- zelfde reden als bij de
     connectlus hierboven: een nul ziet er vers en verouderd hetzelfde uit, en op
     deze nullen rust het besluit dat er geen `resources`-tabel komt. Er is een
     valkuil bij die de andere vormmeters niet hebben: als de meter stil minder
     plandomeinen ziet, blijft dezelfde nul staan terwijl hij van "deze domeinen
     delen niets" verandert in "we hebben minder gekeken". Daarom staat
     `planvorm.domeinen` hier als eerste: het BEREIK reist mee met de uitslag in
     het proza, en niet alleen in de ratel. */
  'planvorm.domeinen': { bron: 'PLANVORM.json', veld: 'rondes.ruim.vorm.domeinen.length',
    wat: 'plandomeinen waarover de vorm is gemeten' },
  'planvorm.velden': { bron: 'PLANVORM.json', veld: 'rondes.ruim.vorm.velden',
    wat: 'velden over de plandomeinen (ruime lijst), envelop eruit' },
  'planvorm.inAlle': { bron: 'PLANVORM.json', veld: 'rondes.ruim.vorm.inAlleDomeinen.length',
    wat: 'velden die in ALLE plandomeinen staan' },
  'planvorm.domeineigenPct': { bron: 'PLANVORM.json', veld: 'rondes.ruim.vorm.inEenDomeinPct',
    wat: 'percentage velden dat in precies EEN plandomein staat (ruime lijst)' },
  'planvorm.smalVelden': { bron: 'PLANVORM.json', veld: 'rondes.smal.vorm.velden',
    wat: 'velden over de plandomeinen (smalle lijst: alleen de roostermodule zelf)' },
  'planvorm.smalDomeineigenPct': { bron: 'PLANVORM.json', veld: 'rondes.smal.vorm.inEenDomeinPct',
    wat: 'percentage velden dat in precies EEN plandomein staat (smalle lijst)' },
  'planvorm.lusRond': { bron: 'PLANVORM.json', veld: 'rondes.ruim.lus.rondeLus.length',
    wat: 'plandomeinen die alle negen stations van de planketen uitvoeren' },
  'planvorm.stationsInAlle': { bron: 'PLANVORM.json', veld: 'rondes.ruim.lus.inAlleDomeinen.length',
    wat: 'stations die in ALLE plandomeinen staan' },
  'planvorm.combinaties': { bron: 'PLANVORM.json', veld: 'rondes.ruim.lus.combinaties',
    wat: 'verschillende combinaties van stations over de plandomeinen' },
  'planvorm.reistijd': { bron: 'PLANVORM.json', veld: 'rondes.ruim.lus.zeldzaamste.domeinen',
    wat: 'plandomeinen die het zeldzaamste station (reistijd) uitvoeren' },
  /* De officevorm (OFFICE.md par. 0). Zelfde reden als de planvorm hierboven:
     het BEREIK staat eerst, omdat een nul over minder domeinen er vers en
     verouderd hetzelfde uitziet. */
  'officevorm.domeinen': { bron: 'OFFICEVORM.json', veld: 'rondes.ruim.vorm.domeinen.length',
    wat: 'objectdomeinen onder het voorgestelde RTGObject waarover de vorm is gemeten' },
  'officevorm.velden': { bron: 'OFFICEVORM.json', veld: 'rondes.ruim.vorm.velden',
    wat: 'velden over de objectdomeinen (ruime lijst), envelop eruit' },
  'officevorm.inAlle': { bron: 'OFFICEVORM.json', veld: 'rondes.ruim.vorm.inAlleDomeinen.length',
    wat: 'velden die in ALLE objectdomeinen staan' },
  'officevorm.domeineigenPct': { bron: 'OFFICEVORM.json', veld: 'rondes.ruim.vorm.inEenDomeinPct',
    wat: 'percentage velden dat in precies EEN objectdomein staat (ruime lijst)' },
  'kantoor.routes': { bron: 'KANTOORMACHT.json', veld: 'gemeten.routes',
    wat: 'kantoorroutes achter /api/office en /api/boardroom' },
  'kantoor.deurEistMens': { bron: 'KANTOORMACHT.json', veld: 'gemeten.deurEistMens',
    wat: 'kantoorroutes waar de bewaker een bewezen mens eist' },
  'kantoor.deurGedeeld': { bron: 'KANTOORMACHT.json', veld: 'gemeten.deurGedeeld',
    wat: 'kantoorroutes achter de gedeelde kantoorcode' },
  'kantoor.anoniem': { bron: 'KANTOORMACHT.json', veld: 'gemeten.anoniemUitvoerbaar',
    wat: 'kantoorroutes zonder mens-eisende deur en zonder mens in de handler' },
  'kantoor.handlerKentMens': { bron: 'KANTOORMACHT.json', veld: 'gemeten.handlerKentMens',
    wat: 'kantoorroutes waarvan de handler de handelende mens noemt' },
  'kantoor.bestanden': { bron: 'KANTOORMACHT.json', veld: 'gemeten.bestanden',
    wat: 'bestanden die een kantoorroute registreren' },
  /* De namensvorm (REPRESENTATIE.md par. 0). Twee nullen dragen daar een
     architectuurbesluit, en juist een NUL in proza veroudert onzichtbaar: hij
     ziet er vers en achterhaald identiek uit. Vandaar dat ook de noemers een
     merkteken krijgen -- "0 van de 50" wordt onwaar zodra die 50 beweegt, en
     dan klopt de zin nog steeds half. */
  'namens.mechanismen': { bron: 'NAMENSVORM.json', veld: 'gemeten.werkwoord.mechanismen',
    wat: 'mechanismen waarmee iemand in dit huis namens een ander handelt' },
  'namens.velden': { bron: 'NAMENSVORM.json', veld: 'gemeten.smal.velden',
    wat: 'velden die die mechanismen samen dragen, envelop eraf' },
  'namens.inAlle': { bron: 'NAMENSVORM.json', veld: 'gemeten.smal.inAlleMechanismen',
    wat: 'velden die in ALLE opslaande mechanismen staan' },
  'namens.eigenPct': { bron: 'NAMENSVORM.json', veld: 'gemeten.smal.eigenPct',
    wat: 'aandeel velden dat in precies EEN mechanisme staat (%)' },
  'namens.werkwoordenInAlle': { bron: 'NAMENSVORM.json', veld: 'gemeten.werkwoord.inAlleMechanismenOpNaam.length',
    wat: 'werkwoorden die onder dezelfde naam in alle mechanismen staan' },
  'namens.gemiddeldOpNaam': { bron: 'NAMENSVORM.json', veld: 'gemeten.werkwoord.gemiddeldOpNaam',
    wat: 'werkwoorden per mechanisme, onder de naam van kern/vertegenwoordiging' },
  'namens.gemiddeldOpSynoniem': { bron: 'NAMENSVORM.json', veld: 'gemeten.werkwoord.gemiddeldOpSynoniem',
    wat: 'werkwoorden per mechanisme, onder een van de namen die dit huis ervoor gebruikt' },
  /* De spoorvorm (REPRESENTATIE.md par. 8.1), en om dezelfde reden als de
     namensvorm hierboven -- alleen scherper. Deze matrix bestaat bijna helemaal
     uit streepjes, en drie van de vier getallen staan op EEN. Een EEN in proza
     veroudert net zo onzichtbaar als een nul: "1 haalt alle vier" blijft er
     precies zo uitzien nadat er een tweede bij is gekomen. De noemer krijgt
     daarom ook een merkteken -- "2 van 7" wordt half onwaar zodra die 7 beweegt. */
  'spoor.mechanismen': { bron: 'SPOORVORM.json', veld: 'gemeten.mechanismen',
    wat: 'mechanismen die langs de vier spoor-eigenschappen zijn gelegd' },
  'spoor.metSpoor': { bron: 'SPOORVORM.json', veld: 'gemeten.metSpoor',
    wat: 'mechanismen die een handeling ergens vastleggen' },
  'spoor.kanTegenhouden': { bron: 'SPOORVORM.json', veld: 'gemeten.kanTegenhouden',
    wat: 'mechanismen waar een spoor dat niet vaststaat de handeling tegenhoudt' },
  'spoor.volledigConvergent': { bron: 'SPOORVORM.json', veld: 'gemeten.volledigConvergent',
    wat: 'mechanismen die alle vier de eigenschappen van de referentie halen' },
  'semantiek.namen': { bron: 'SEMANTIEK.json', veld: 'namenInMeerDomeinen',
    wat: 'namen die in meer dan een domein voorkomen' },
  'semantiek.betekenissen': { bron: 'SEMANTIEK.json', veld: 'woordenMetMeerBetekenissen',
    wat: 'namen die meer dan een betekenis dragen' },
  'semantiek.betekenissenTotaal': { bron: 'SEMANTIEK.json', veld: 'betekenissenTotaal',
    wat: 'betekenissen die die namen samen dragen' },
  /* De meetleer: mag de lezer dit geloven, en hoeveel (MODULAIR.md par. 7). */
  'meetleer.registers': { bron: 'MEETLEER.json', veld: 'registers',
    wat: 'registers in de wortel die de meetleer keurt' },
  'meetleer.blind': { bron: 'MEETLEER.json', veld: 'blind',
    wat: 'registers die NERGENS zeggen wat ze niet aantonen' },
  'meetleer.onleesbaar': { bron: 'MEETLEER.json', veld: 'onleesbaar',
    wat: 'slots waar een machine niet bij kan (proza of leeg)' },
  /* De vijf registers van de binnenpoort (MODULAIR.md). */
  'verstrengeling.randen': { bron: 'VERSTRENGELING.json', veld: 'randen',
    wat: 'randen tussen twee knopen van RTG' },
  'verstrengeling.onverklaard': { bron: 'VERSTRENGELING.json', veld: 'onbekend',
    wat: 'randen die niemand heeft verklaard' },
  'verstrengeling.domeinen': { bron: 'VERSTRENGELING.json', veld: 'domeinknopen',
    wat: 'domeinen in de graaf' },
  'verstrengeling.uitneembaar': { bron: 'VERSTRENGELING.json', veld: 'volledigUitneembaar',
    wat: 'domeinen die geen ander domein meeslepen' },
  'activering.functies': { bron: 'ACTIVERING.json', veld: 'functiesMetEnvelop',
    wat: 'functies met een activeringsenvelop' },
  'activering.gemeten': { bron: 'ACTIVERING.json', veld: 'perGraad.gemeten',
    wat: 'functies waarvan de envelop volledig gemeten is' },
  'activering.ondergrens': { bron: 'ACTIVERING.json', veld: 'perGraad.ondergrens',
    wat: 'functies waarvan de envelop een ondergrens is' },
  'activering.onbepaald': { bron: 'ACTIVERING.json', veld: 'onbepaald',
    wat: 'functies waarvan de envelop onbepaald is: bronnen spreken elkaar tegen' },
  'activering.mediaan': { bron: 'ACTIVERING.json', veld: 'mediaanKnopen',
    wat: 'knopen die een doorsnee functie raakt' },
  'trede.routes': { bron: 'TREDEPROEF.json', veld: 'routes',
    wat: 'API-routes die de tredeproef telde' },
  'trede.inTrede': { bron: 'TREDEPROEF.json', veld: 'routesInTrede',
    wat: 'routes die op trede 0 openstaan' },
  'trede.lekken': { bron: 'TREDEPROEF.json', veld: 'zuiverLekken',
    wat: 'routes buiten trede 0 die de schakelkast niet dichtzet' },
  'trede.ingangLekken': { bron: 'TREDEPROEF.json', veld: 'ingangLekken',
    wat: 'ingangen buiten HTTP die op trede 0 antwoorden terwijl hun functie uit staat' },
  'wekkers.totaal': { bron: 'WEKKERS.json', veld: 'wekkers',
    wat: 'plekken die werk kunnen beginnen zonder dat iemand een pad opvraagt' },
  'wekkers.onverklaard': { bron: 'WEKKERS.json', veld: 'ongeschakeld',
    wat: 'wekkers die geen functie raken en niet verklaard zijn' },
  'wekkers.functieUitToch': { bron: 'WEKKERS.json', veld: 'functieUitMaarUitvoerbaar',
    wat: 'ingangen buiten HTTP die het werk van een functie doen zonder haar schakelaar' },
  'zaakwig.gezakt': { bron: 'ZAAKWIG.json', veld: 'gezakt',
    wat: 'stappen en invarianten van de verticale zaakketen die zakken' },
  /* De isolatielaag. Deze vier stonden als los getal in ISOLATIE.md en verouderden
     op de dag dat de meter opnieuw draaide -- precies waarvoor dit register er is. */
  'isolatie.verhalen': { bron: 'ISOLATIEPROEF.json', veld: 'noemers.bruikbaarheid.gevonden',
    wat: 'kritieke gebruikersverhalen die de bruikbaarheidsmeter naloopt' },
  'isolatie.werktOnderIsolatie': { bron: 'ISOLATIEPROEF.json',
    veld: 'noemers.bruikbaarheid.perStand.isolatie.werkt',
    wat: 'verhalen die onder `isolatie` HEEL blijven' },
  'isolatie.dragersMetSleutel': { bron: 'ISOLATIEPROEF.json', veld: 'noemers.dragers.metSleutelbron',
    wat: 'dragers die bij een lopend verzoek een sleutel hebben' },
  'isolatie.achtergrondsites': { bron: 'ISOLATIEPROEF.json', veld: 'noemers.workload.gevonden',
    wat: 'plekken waar achtergrondwerk start zonder drager' },
  'isolatie.kanalen': { bron: 'ISOLATIEPROEF.json', veld: 'noemers.herkomst.gevonden',
    wat: 'kanalen waarlangs invoer een gesprek in kan komen, elk met een vertrouwensklasse' },
  'isolatie.herkomstprijsLid': { bron: 'ISOLATIEPROEF.json', veld: 'noemers.herkomst.prijsPerRol.member.na',
    wat: 'AI-paden die een lid overhoudt nadat onvertrouwde invoer het gesprek raakte' },
  'doodspoor.bronroutes': { bron: 'DOODSPOOR.json', veld: 'telling.bronroutes',
    wat: 'routes die in de proef werk deden en een collectie aanraakten' },
  'doodspoor.gesloten': { bron: 'DOODSPOOR.json', veld: 'telling.gesloten',
    wat: 'bronroutes waarvan een andere actorgroep gemeten een stand zet op dezelfde collectie' },
  'doodspoor.gezien': { bron: 'DOODSPOOR.json', veld: 'telling.gezien',
    wat: 'bronroutes waarvan een andere groep de collectie alleen leest (vermoed of aangewezen)' },
  'doodspoor.tussen': { bron: 'DOODSPOOR.json', veld: 'telling.tussen',
    wat: 'bronroutes waarvan de ontvanger een ander lid is -- dezelfde actorgroep, dus onzichtbaar voor het groepenmodel' },
  'doodspoor.terminaal': { bron: 'DOODSPOOR.json', veld: 'telling.terminaal',
    wat: 'bronroutes op een collectie die op niemand wacht: van een mens, van het huis, of een boeking' },
  'doodspoor.open': { bron: 'DOODSPOOR.json', veld: 'telling.open',
    wat: 'bronroutes zonder gemeten ontvanger, zonder gevonden lezer en zonder verklaring' },
  'doodspoor.openCollecties': { bron: 'DOODSPOOR.json', veld: 'telling.openCollecties',
    wat: 'collecties waarop minstens een bronroute open staat' },
  'tafel.schakels': { bron: 'TAFELPROEF.json', veld: 'telling.gesloten',
    wat: 'schakels van de horecaketen waar de ontvangende actor de verandering aantoonbaar ziet' },
  'tafel.storingen': { bron: 'TAFELPROEF.json', veld: 'telling.gehouden',
    wat: 'storingen in die keten waarbij het systeem zich aan zijn uitgeschreven belofte hield' },
  'rit.schakels': { bron: 'RITPROEF.json', veld: 'telling.gesloten',
    wat: 'schakels van de ritketen waar de ontvangende actor de verandering aantoonbaar ziet' },
  'rit.storingen': { bron: 'RITPROEF.json', veld: 'telling.gehouden',
    wat: 'storingen in de ritketen waarbij het systeem zich aan zijn uitgeschreven belofte hield' },
  'rit.bevindingen': { bron: 'RITPROEF.json', veld: 'telling.openBekend',
    wat: 'schakels in de ritketen die aantoonbaar niet sluiten, met een uitgeschreven reden' },
  /* AUTONOMIE.md: het bedrijfsmaatregister (scripts/bedrijfsmaat.js). */
  'bedrijfsmaat.maten': { bron: 'BEDRIJFSMAAT.json', veld: 'telling.maten',
    wat: 'bedrijfsmaten in de catalogus over de domeinen van de eigenaar' },
  'bedrijfsmaat.bestaat': { bron: 'BEDRIJFSMAAT.json', veld: 'telling.perStatus.bestaat',
    wat: 'maten waarvan bron, definitie, projectie en bewijs alle vier aantoonbaar zijn' },
  'bedrijfsmaat.half': { bron: 'BEDRIJFSMAAT.json', veld: 'telling.perStatus.half',
    wat: 'maten met een bron maar zonder een of meer van de andere drie elementen' },
  'bedrijfsmaat.ontbreekt': { bron: 'BEDRIJFSMAAT.json', veld: 'telling.perStatus.ontbreekt',
    wat: 'maten waarvan de werkelijkheid nergens wordt geregistreerd' },
  'bedrijfsmaat.gedeeltelijk': { bron: 'BEDRIJFSMAAT.json', veld: 'telling.bestaatGedeeltelijk',
    wat: 'bestaande maten die een deel van de werkelijkheid niet zien' },
  'bedrijfsmaat.ketensGegrond': { bron: 'BEDRIJFSMAAT.json', veld: 'telling.ketensGegrond',
    wat: 'ketens waarvan elke schakel bestaat' },
  'bedrijfsmaat.privacyGaten': { bron: 'BEDRIJFSMAAT.json', veld: 'telling.privacyGaten',
    wat: 'projecties over mensen zonder afgedwongen groepsgrens' },
  'ketenvorm.actorenGedeeld': { bron: 'KETENVORM.json', veld: 'telling.actorenGedeeld',
    wat: 'actornamen die in beide gouden ketens voorkomen' },
  'ketenvorm.actorenTotaal': { bron: 'KETENVORM.json', veld: 'telling.actorenTotaal',
    wat: 'actornamen over de twee ketens samen' },
  'ketenvorm.themasGedeeld': { bron: 'KETENVORM.json', veld: 'telling.themasGedeeld',
    wat: 'soorten belofte die beide ketens afvangen' },
  'ketenvorm.themasTotaal': { bron: 'KETENVORM.json', veld: 'telling.themasTotaal',
    wat: 'soorten belofte over de twee ketens samen' },
  'ritmigratie.bestanden': { bron: 'RITMIGRATIE.json', veld: 'telling.bestanden',
    wat: 'bestanden die db.data.rides noemen' },
  'ritmigratie.stand': { bron: 'RITMIGRATIE.json', veld: 'telling.stand',
    wat: 'lezers van db.data.rides die de LOPENDE rit tonen' },
  'ritmigratie.historie': { bron: 'RITMIGRATIE.json', veld: 'telling.historie',
    wat: 'lezers die historie aftellen (omzet, fooi, fiscale grondslag)' },
  'ritmigratie.kanNu': { bron: 'RITMIGRATIE.json', veld: 'telling.kanNu',
    wat: 'lezers die vandaag naar de opdrachtwereld kunnen zonder dat er een rit uit beeld valt' },
  'ritmigratie.daarna': { bron: 'RITMIGRATIE.json', veld: 'telling.daarna',
    wat: 'lezers die na de stand-lezers volgen: eerst historie, dan de schrijvers' },
  'doodspoor.nietGemeten': { bron: 'DOODSPOOR.json', veld: 'nietGezien.nietGemeten',
    wat: 'routes die in de idempotentieproef geen werk deden en dus buiten deze meting vallen' },
  'codewereld.registers': { bron: 'CODEWERELD.json', veld: 'registers.geteld',
    wat: 'registers in de wortel die iets over deze code beweren' },
  'codewereld.paden': { bron: 'CODEWERELD.json', veld: 'ruggengraat.paden',
    wat: 'losse paden die de registers samen kennen' },
  'codewereld.ruggengraat': { bron: 'CODEWERELD.json', veld: 'ruggengraat.inMeerDanEenRegister',
    wat: 'paden die in meer dan een register staan -- de ruggengraat van een Codewereld' },
  'codewereld.ruggengraatPct': { bron: 'CODEWERELD.json', veld: 'ruggengraat.pct',
    wat: 'diezelfde ruggengraat als percentage' },
  'codewereld.brugPaden': { bron: 'CODEWERELD.json', veld: 'brug.paden',
    wat: 'paden waarvoor een register een bestand noemt' },
  'codewereld.brugToetsbaar': { bron: 'CODEWERELD.json', veld: 'brug.verschilToetsbaar',
    wat: 'paden waar TWEE registers een bestand noemen -- alleen daar valt een verschil vast te stellen' },
  'codewereld.brugDekkingPct': { bron: 'CODEWERELD.json', veld: 'brug.verschilDekkingPct',
    wat: 'die toetsbare paden als percentage van de brug' },
  'routebron.vergeleken': { bron: 'ROUTEBRON.json', veld: 'gemeten.beideKennen',
    wat: 'routes die de router-afleiding en de bronwandeling allebei kennen' },
  'routebron.gelijk': { bron: 'ROUTEBRON.json', veld: 'gemeten.gelijk',
    wat: 'daarvan met hetzelfde bestand' },
  'routebron.verouderd': { bron: 'ROUTEBRON.json', veld: 'gemeten.waarvanVerouderd',
    wat: 'verschillen die een leeftijdsverschil zijn en geen meningsverschil' },
  'routebron.tegenspraak': { bron: 'ROUTEBRON.json', veld: 'gemeten.waarvanTegenspraak',
    wat: 'echte tegenspraken: beide bestanden staan stil en toch verschillen de wegen' },
  'routebron.routerRoutes': { bron: 'ROUTEBRON.json', veld: 'gemeten.routerRoutes',
    wat: 'routes die de router werkelijk aanbiedt' },
  'routebron.zonderBestand': { bron: 'ROUTEBRON.json', veld: 'gemeten.routerRoutesZonderBestand',
    wat: 'daarvan zonder vindbare plek in de bron -- bestaan is iets anders dan vindbaar zijn' },
  'schermroutes.schermen': { bron: 'SCHERMROUTES.json', veld: 'gemeten.schermenMetPad',
    wat: 'bestanden in public/ die minstens een API-pad noemen' },
  'schermroutes.paden': { bron: 'SCHERMROUTES.json', veld: 'gemeten.exactePaden',
    wat: 'exacte API-paden die de schermen noemen' },
  'schermroutes.verwijzingen': { bron: 'SCHERMROUTES.json', veld: 'gemeten.verwijzingen',
    wat: 'verwijzingen naar die paden, over alle schermen' },
  'schermroutes.voorvoegsels': { bron: 'SCHERMROUTES.json', veld: 'gemeten.voorvoegsels',
    wat: 'paden die verdergaan (sjabloon, optelling of vraagteken) en dus geen route zijn' },
  'schermroutes.dood': { bron: 'SCHERMROUTES.json', veld: 'gemeten.doodPad',
    wat: 'exacte paden die geen bestaande route zijn en ook geen stam ervan' },
  'codewereld.relatie': { bron: 'CODEWERELD.json', veld: 'bronbereik.relatie',
    wat: 'bronbestanden waarover een RELATIEregister iets zegt (waar woont het, wat roept het aan, welk scherm gebruikt het)' },
  'graaf.kanten': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.kanten',
    wat: 'afgeleide aanroepkanten tussen symbolen' },
  'graaf.aanroepen': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.aanroepen',
    wat: 'aanroepen die de parser in server/ zag' },
  'graaf.opgelostPct': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.opgelostPct',
    wat: 'deel daarvan dat naar een symbool te herleiden was' },
  'graaf.contextobject': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.onopgelostNaarSoort.contextobject',
    wat: 'aanroepen die via het contextobject lopen en daarom structureel niet te herleiden zijn' },
  'graaf.overig': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.onopgelostNaarSoort.overig',
    wat: 'onopgeloste aanroepen die GEEN van de verklaarde soorten zijn -- de echte restbak' },
  'graaf.doelOnbekend': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.doelOnbekend',
    wat: 'ingevoerde namen die het doelbestand niet kent -- elke andere waarde dan nul is een bevinding' },
  'graaf.bewaakteVooruitwijzing': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.bewaakteVooruitwijzing',
    wat: 'aanroepen naar een integratie die met opzet nog niet gebouwd is, waar het bestand zelf afbreekt als de andere kant ontbreekt -- een gedeclareerd gat, geen vergissing' },
  'graaf.aanroepers': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.symbolenMetAanroeper',
    wat: 'symbolen waarvan bekend is wie ze aanroept' },
  'graaf.routesMetSymbool': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.routesMetSymbool',
    wat: 'routes waarvan minstens een afgehandeld symbool bekend is' },
  'schermgedrag.schermen': { bron: 'SCHERMGEDRAG.json', veld: 'gemeten.schermen',
    wat: 'schermen waarover een gedragsuitspraak is samengesteld of geprobeerd' },
  'schermgedrag.metGrond': { bron: 'SCHERMGEDRAG.json', veld: 'gemeten.metGrond',
    wat: 'daarvan met een echte uitspraak, want ze raken een bestaande route' },
  'schermgedrag.zonderGrond': { bron: 'SCHERMGEDRAG.json', veld: 'gemeten.zonderGrond',
    wat: 'daarvan zonder uitspraak, elk met een reden -- tellen niet als dekking' },
  'schermgedrag.schrijftJa': { bron: 'SCHERMGEDRAG.json', veld: 'gemeten.schrijftJa',
    wat: 'schermen die via de API iets kunnen veranderen' },
  'schermgedrag.bewezen': { bron: 'SCHERMGEDRAG.json', veld: 'gemeten.bewijsBewezen',
    wat: 'schermen waarvan de zwakste geraakte route bewezen is' },
  'schermgedrag.verzwakt': { bron: 'SCHERMGEDRAG.json', veld: 'gemeten.bewijsVerzwakt',
    wat: 'schermen waarvan de zwakste geraakte route verzwakt bewijs draagt' },
  'context.gereden': { bron: 'CONTEXTPROEF.json', veld: 'gemeten.routesGereden',
    wat: 'routes die de runtime-contextproef heeft aangeroepen' },
  'context.aanHetWerk': { bron: 'CONTEXTPROEF.json', veld: 'gemeten.routesAanHetWerk',
    wat: 'daarvan die werkelijk werk deden (geen 401/404/405)' },
  'context.metSpoor': { bron: 'CONTEXTPROEF.json', veld: 'gemeten.routesMetSpoor',
    wat: 'routes die TIJDENS het verzoek naar het contextobject reiken' },
  'context.zonderSpoor': { bron: 'CONTEXTPROEF.json', veld: 'gemeten.routesZonderSpoorMaarWelAanHetWerk',
    wat: 'routes die werk deden zonder tijdens het verzoek naar de kern te reiken' },
  'context.namen': { bron: 'CONTEXTPROEF.json', veld: 'gemeten.losseNamen',
    wat: 'losse kernnamen die tijdens een verzoek zijn opgehaald' },
  'context.bedrading': { bron: 'CONTEXTPROEF.json', veld: 'gemeten.buitenEenVerzoek',
    wat: 'kernnamen die bij het BEDRADEN worden opgehaald, buiten elk verzoek om' },
  'kern.namen': { bron: 'KERNHERKOMST.json', veld: 'gemeten.namen',
    wat: 'namen op het contextobject waarvan bekend is wie ze erin heeft gezet' },
  'kern.vulplekken': { bron: 'KERNHERKOMST.json', veld: 'gemeten.vulplekken',
    wat: 'plekken in de code die de zak vullen' },
  'kern.onopgelost': { bron: 'KERNHERKOMST.json', veld: 'gemeten.onopgelost',
    wat: 'vulplekken die niet te volgen zijn -- elk met een reden, nooit geraden' },
  'graaf.viaKern': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.kantenViaKern',
    wat: 'aanroepkanten die dankzij de herkomst van de zak konden ontstaan' },
  'graaf.viaKernZonderSymbool': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.kantenViaKernZonderSymbool',
    wat: 'daarvan die alleen het BESTAND aanwijzen, omdat de zaknaam niet de symboolnaam is' },
  'graaf.uitgepaktObject': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.onopgelostNaarSoort.uitgepaktObject',
    wat: 'aanroepen op een naam die uit een eigen zak van een domein komt -- dezelfde vorm als het contextobject, maar niet de kern' },
  'graaf.externeModule': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.onopgelostNaarSoort.externeModule',
    wat: 'aanroepen op een module van buiten dit huis (path, fs, crypto)' },
  'graaf.uitFabriek': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.kantenUitFabriek',
    wat: 'kanten uit een naam die uit een fabriek-aanroep is uitgepakt' },
  'graaf.moduleAlsFunctie': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.kantenModuleAlsFunctie',
    wat: 'kanten naar een module die zelf een functie is (require(...)() )' },
  'graaf.lidOpInvoer': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.kantenLidOpInvoer',
    wat: 'kanten van een methode op iets dat uit ons eigen bestand is ingevoerd -- bestand bekend, functie niet' },
  'codewereld.bronBestanden': { bron: 'CODEWERELD.json', veld: 'bronbereik.bestanden',
    wat: 'bronbestanden die er echt staan' },
  'codewereld.bronGenoemd': { bron: 'CODEWERELD.json', veld: 'bronbereik.genoemd',
    wat: 'daarvan genoemd door enig register' },
  'codewereld.bronPct': { bron: 'CODEWERELD.json', veld: 'bronbereik.pct',
    wat: 'bronbereik STRUCTUUR: bestanden die enig register noemt (de symboolindex noemt alles)' },
  'codewereld.bronGedragPct': { bron: 'CODEWERELD.json', veld: 'bronbereik.gedragPct',
    wat: 'bronbereik GEDRAG: bestanden waarover een register buiten de symboolindex iets zegt -- de bovengrens voor een vraag over gedrag' },
  'codewereld.bronGedrag': { bron: 'CODEWERELD.json', veld: 'bronbereik.gedrag',
    wat: 'datzelfde als aantal' },
  'codewereld.symboolSleutels': { bron: 'CODEWERELD.json', veld: 'assen.symbool.sleutels',
    wat: 'symbolen met een plaats die de registers samen kennen' },
  'symbolen.gelezen': { bron: 'SYMBOLEN.json', veld: 'gemeten.gelezen',
    wat: 'bronbestanden die de symboolas heeft kunnen lezen' },
  'symbolen.nietGelezen': { bron: 'SYMBOLEN.json', veld: 'gemeten.nietGelezen',
    wat: 'bronbestanden die hij niet kon lezen -- allemaal met een reden' },
  'symbolen.bundeldeel': { bron: 'SYMBOLEN.json', veld: 'gemeten.waarvanBundeldeel',
    wat: 'daarvan bundeldelen: fragmenten die pas samengevoegd een programma vormen' },
  'symbolen.parsefout': { bron: 'SYMBOLEN.json', veld: 'gemeten.waarvanParsefout',
    wat: 'daarvan echte parsefouten -- elke andere dan nul is een bevinding' },
  'symbolen.totaal': { bron: 'SYMBOLEN.json', veld: 'gemeten.symbolen',
    wat: 'benoemde functies, klassen en methoden met een regelnummer' },
  'symbolen.kanten': { bron: 'SYMBOLEN.json', veld: 'gemeten.requireKanten',
    wat: 'require-kanten tussen bestanden -- de graaf heen en terug' },
  'symbolen.uitvoerZonderNamen': { bron: 'SYMBOLEN.json', veld: 'gemeten.uitvoerZonderNamen',
    wat: 'bestanden die iets exporteren zonder afleidbare namen (module.exports = functie)' },
  'codewereld.symbolen': { bron: 'CODEWERELD.json', veld: 'assen.symbool.proef.symbolen',
    wat: 'benoemde symbolen die de eigen parser in server/ vindt' },
  'codewereld.geparsed': { bron: 'CODEWERELD.json', veld: 'assen.symbool.proef.geparsed',
    wat: 'serverbestanden die de eigen parser aankon' },
  'codewereld.parseFout': { bron: 'CODEWERELD.json', veld: 'assen.symbool.proef.gefaald',
    wat: 'serverbestanden waarop die parser stukliep' },
  'codewereld.bronServerPct': { bron: 'CODEWERELD.json', veld: 'bronbereik.serverPct',
    wat: 'bronbereik binnen server/ -- daar kijken de meters' },
  'codewereld.bronPublicPct': { bron: 'CODEWERELD.json', veld: 'bronbereik.publicPct',
    wat: 'bronbereik binnen public/ -- daar hebben de meters vrijwel niets' },
  /* DE TIEN MUTATIES (MENSMUTATIE.json). Twee getallen en met opzet geen derde:
     hoeveel garanties je uit de menselijke uitvoeringsketen kunt HALEN terwijl
     een wacht afgaat, en hoeveel je eruit kunt halen zonder dat iemand het
     merkt. Dat tweede getal is het enige dat naar nul moet. */
  /* DE NOEMER OOK, en om precies dezelfde reden als bij menselijk.scenarios: hij
     stond als WOORD in de kop en in de tekst ("de twaalf mutaties", "van de
     twaalf") terwijl de teller ernaast automatisch meegroeide. Toen er vier
     mutaties bij kwamen las er "15 van de twaalf". Een noemer die stilstaat
     terwijl de teller beweegt, maakt van twee kloppende getallen een verkeerde
     verhouding -- en daar kijkt geen enkele controle naar zolang hij geen
     merkteken draagt. */
  'mensmutatie.totaal': { bron: 'MENSMUTATIE.json', veld: 'telling.mutaties',
    wat: 'semantische mutaties in de batterij van scripts/mensmutatie.js' },
  'mensmutatie.gezakt': { bron: 'MENSMUTATIE.json', veld: 'telling.gezakt',
    wat: 'mutaties die een wacht lieten zakken' },
  'mensmutatie.zonderWacht': { bron: 'MENSMUTATIE.json', veld: 'telling.geenWacht',
    wat: 'garanties die je kunt weghalen zonder dat een wacht afgaat' },
  /* DE MENSELIJKE UITVOERING (MENSELIJKE_UITVOERING.json). Drie getallen over
     EEN vraag, en ze mogen nooit tot een percentage worden samengetrokken:
     context die AANKOMT, context die de resolver GEBRUIKT, en gevallen waarin de
     resolver niet eens draaide -- dan heeft NIEMAND GEKEKEN, en dat is iets
     anders dan "de context deed niets". */
  /* De noemer hoort ook een levend getal te zijn. Hij stond als woord in de
     tekst ("van de 31 zinnen", "een van de vierendertig") terwijl het corpus
     doorgroeide, en dan drijft de noemer weg van de teller die er in dezelfde
     zin naast staat -- precies wat deze merktekens moeten uitsluiten. */
  'menselijk.scenarios': { bron: 'MENSELIJKE_UITVOERING.json', veld: 'telling.scenarios',
    wat: 'gedragsgevallen in de menselijke-uitvoeringsprojectie' },
  'menselijk.contextAangeboden': { bron: 'MENSELIJKE_UITVOERING.json', veld: 'telling.contextAangeboden',
    wat: 'scenario\'s waarin context is aangeboden en gesaneerd' },
  'menselijk.contextGebruikt': { bron: 'MENSELIJKE_UITVOERING.json', veld: 'telling.contextGebruikt',
    wat: 'scenario\'s waarin de resolver de context aantoonbaar gebruikte' },
  'menselijk.niemandKeek': { bron: 'MENSELIJKE_UITVOERING.json', veld: 'telling.contextNiemandKeek',
    wat: 'scenario\'s waarin de resolver niet draaide, dus niemand naar de context keek' },
  'land.landen': { bron: 'LANDDEKKING.json', veld: 'telling.landen',
    wat: 'landen waarvan kern/fiscaal/landen.js de tarieven en loonkennis draagt' },
  'land.volledig': { bron: 'LANDDEKKING.json', veld: 'telling.landenVolledig',
    wat: 'landen die alle onderscheidende uitvoeringsassen halen' },
  'land.assen': { bron: 'LANDDEKKING.json', veld: 'telling.onderscheidendeAssen',
    wat: 'assen die onderscheidend zijn (niet voor elk land aanstaan)' },
  'land.rechtsvorm': { bron: 'LANDDEKKING.json', veld: 'telling.perAs.rechtsvorm',
    wat: 'landen waarvan RTG de rechtsvormen kent' },
  'land.loonuitvoering': { bron: 'LANDDEKKING.json', veld: 'telling.perAs.loonuitvoering',
    wat: 'landen waar werkelijk loon gedraaid kan worden' },
  'land.fiscaalJaargang': { bron: 'LANDDEKKING.json', veld: 'telling.perAs.fiscaalJaargang',
    wat: 'landen met een meegeleverde fiscale jaargang' },
  'land.register': { bron: 'LANDDEKKING.json', veld: 'telling.perAs.bedrijfsregister',
    wat: 'landen met een aanwijsbaar ondernemingsregister' },
  'land.zonderEnige': { bron: 'LANDDEKKING.json', veld: 'telling.landenZonderEnige',
    wat: 'landen waar RTG alleen kennis heeft en geen enkele uitvoeringsas' },
  /* DE DOORBELASTINGSMETER, en let op WELKE helft welk getal levert. `vorm.*`
     komt uit deel A (de structurele vraag: kan een geldvorm herkomst dragen),
     `norm.*` uit deel B1 (de gezaaide wereld). Die twee worden nooit opgeteld en
     staan daarom ook hier als aparte sleutels -- een enkel merkteken dat ze zou
     samenvatten, bestaat met opzet niet. Deel B2 (de werkelijke opslag) levert
     hier GEEN getal: zijn noemer is vandaag nul, en een levend getal over een
     lege noemer leest als een meting terwijl er niemand heeft geteld. */
  'doorbelasting.geldvormen': { bron: 'DOORBELASTING.json', veld: 'vorm.geldvormen',
    wat: 'objectvormen in server/ die een bedrag dragen' },
  'doorbelasting.volgbaar': { bron: 'DOORBELASTING.json', veld: 'vorm.volgbaar',
    wat: 'geldvormen die naast het bedrag ook een herkomst dragen' },
  'doorbelasting.nietVolgbaar': { bron: 'DOORBELASTING.json', veld: 'vorm.nietVolgbaar',
    wat: 'geldvormen met een bedrag en geen herkomst ernaast' },
  'doorbelasting.normRijen': { bron: 'DOORBELASTING.json', veld: 'norm.rijen',
    wat: 'rijen in de gezaaide wereld die als norm dient' },
  'doorbelasting.normNietVolgbaar': { bron: 'DOORBELASTING.json', veld: 'norm.nietVolgbaar',
    wat: 'rijen in die wereld die met opzet niet te volgen zijn' },
  'soeverein.dragers': { bron: 'SOEVEREIN.json', veld: 'ladder.telling.dragers',
    wat: 'dragers in de isolatieladder (kern/isolatie/dragers.js)' },
  'soeverein.metSleutel': { bron: 'SOEVEREIN.json', veld: 'ladder.telling.metSleutelBijVerzoek',
    wat: 'dragers die bij een lopend verzoek werkelijk een sleutel dragen' },
  'soeverein.stenen': { bron: 'SOEVEREIN.json', veld: 'bouwstenen.telling.aanwezig',
    wat: 'bouwstenen uit het soevereiniteitsvoorstel die als bestand al bestaan' },
  'soeverein.stenenGenoemd': { bron: 'SOEVEREIN.json', veld: 'bouwstenen.telling.genoemd',
    wat: 'bouwstenen die het voorstel noemt en die de meter nagaat' },
  /* DE ONDERNEMERSLUS (ONDERNEMEN.md par. 1). Vier getallen, en ze staan hier
     omdat juist deze in een document verouderen: het zijn de getallen waarop de
     volgorde in par. 14 rust, en een verouderde volgorde stuurt werk verkeerd.

     `zaakZietOnderneming` is de scherpste van de vier. Hij staat vandaag op nul
     en hoort te STIJGEN; wie hem in het document overtypt, schrijft over een
     half jaar een gat op dat misschien allang gedicht is -- of erger, een brug
     die weer is afgebroken. */
  'lus.stations': { bron: 'ONDERNEMERSLUS.json', veld: 'telling.stations',
    wat: 'stations van de ondernemerslus' },
  'lus.stationsMetRoute': { bron: 'ONDERNEMERSLUS.json', veld: 'telling.stationsMetRoute',
    wat: 'stations waarvoor werkelijk een route bestaat' },
  'lus.deurwissels': { bron: 'ONDERNEMERSLUS.json', veld: 'telling.deurwissels',
    wat: 'keren dat de lus van sessie wisselt' },
  'lus.zaakZietOnderneming': { bron: 'ONDERNEMERSLUS.json', veld: 'telling.zaakZietOnderneming',
    wat: 'bestanden aan de zaakkant die het ondernemingsobject kennen' },
  'lus.ketensZonderProef': { bron: 'ONDERNEMERSLUS.json', veld: 'telling.ketensZonderProef',
    wat: 'ketens van de lus die nooit als keten zijn gelopen' },
  'lus.kennersTotaal': { bron: 'ONDERNEMERSLUS.json', veld: 'telling.kennersTotaal',
    wat: 'bestanden buiten kern/onderneming die het ondernemingsobject kennen' },
  /* De duur van die parseronde staat MET OPZET niet in deze lijst. Een levend
     getal moet uit een register komen dat bij gelijke code hetzelfde zegt; een
     tijdmeting doet dat niet (4,6 of 4,8 op dezelfde commit), en een controle
     die willekeurig zakt leert mensen hem te negeren. Hij staat in
     CODEWERELD.json en in CODE.md als orde van grootte. */
  /* TWEE BRONNEN, EN DAT IS HET HELE PUNT. Wat uit de code alleen volgt
     (hoeveel toetsbestanden er zijn, wat de require-graaf ziet) komt uit
     VERANDERBEREIK-KENNIS.json en geldt tot de code verandert. Wat bij EEN
     uitvoering is waargenomen komt uit VERANDERBEREIK-RONDE.json en geldt
     alleen voor die ronde. Een getal uit de tweede bak dat in een document
     als duurzame waarheid wordt gelezen, is precies de fout waarvoor de
     splitsing bestaat -- zet een waarnemingsgetal dus nooit om naar KENNIS
     omdat het daar "stabieler" oogt. */
  'veranderbereik.toetsen': { bron: 'VERANDERBEREIK-KENNIS.json', veld: 'gemeten.toetsbestanden',
    wat: 'toetsbestanden die er zijn -- de noemer komt uit de map, niet uit een journaal' },
  'veranderbereik.statisch': { bron: 'VERANDERBEREIK-KENNIS.json', veld: 'gemeten.statischBereik',
    wat: 'toetsen waarvan de require-graaf het bronbestandbereik bepaalt' },
  'veranderbereik.blind': { bron: 'VERANDERBEREIK-KENNIS.json', veld: 'gemeten.blindeVlekStatisch',
    wat: 'toetsen die de statische graaf NIET ziet -- de blinde vlek van KEURING.md par. 1' },
  'veranderbereik.waargenomen': { bron: 'VERANDERBEREIK-RONDE.json', veld: 'gemeten.waargenomenBereik',
    wat: 'toetsen waarvan het journaal routes kent die naar een bronbestand oplossen' },
  'veranderbereik.gedicht': { bron: 'VERANDERBEREIK-RONDE.json', veld: 'gemeten.gedichtDoorWaarneming',
    wat: 'toetsen die de waargenomen as uit de statische blinde vlek haalt' },
  'veranderbereik.zonder': { bron: 'VERANDERBEREIK-RONDE.json', veld: 'gemeten.zonderBereik',
    wat: 'toetsen zonder enig vastgesteld bereik -- de schuld, en de volle ring' },
  /* DE EDGE (EDGE.md par. 0). De kaart en de dekking; per veld een eigen getal,
     want een som over de velden verbergt welk veld bewoog. */
  'edgekaart.bestanden': { bron: 'EDGEKAART.json', veld: 'telling.bestanden',
    wat: 'bestanden in de Edge-lagen met een verklaring op de kaart' },
  'edgekaart.rollen': { bron: 'EDGEKAART.json', veld: 'telling.rollen',
    wat: 'verklaarde rollen, elk met een citaat dat letterlijk in de bron staat' },
  'edgekaart.dubbeleEigenaars': { bron: 'EDGEKAART.json', veld: 'telling.dubbeleEigenaars',
    wat: 'verantwoordelijkheden met meer dan een schrijver of beslisser (mag alleen dalen)' },
  'edgekaart.dodeKanalen': { bron: 'EDGEKAART.json', veld: 'telling.dodeKanalen',
    wat: 'rtg-gebeurtenissen in public/ met een luisteraar zonder zender of andersom (mag alleen dalen)' },
  'edgekaart.levendeKanalen': { bron: 'EDGEKAART.json', veld: 'telling.levendeKanalen',
    wat: 'rtg-gebeurtenissen met zender EN luisteraar; houdt "nul dood" eerlijk (een wandeling die niets ziet, geeft ook nul)' },
  'edgedekking.schermen': { bron: 'EDGEDEKKING.json', veld: 'telling.schermen',
    wat: 'schermen onder public/apps die de dekkingsmeter in een browser opende' },
  'edgedekking.metBlikveld': { bron: 'EDGEDEKKING.json', veld: 'telling.metBlikveld',
    wat: 'schermen waar het Edge Blikveld laadde' },
  'edgedekking.identiteit': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.identiteit.ja',
    wat: 'schermen die identiteit aan de Edge publiceren (mag alleen stijgen)' },
  'edgedekking.wereld': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.wereld.ja',
    wat: 'schermen die wereld aan de Edge publiceren (mag alleen stijgen)' },
  'edgedekking.context': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.context.ja',
    wat: 'schermen die context aan de Edge publiceren (mag alleen stijgen)' },
  'edgedekking.object': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.object.ja',
    wat: 'schermen die object aan de Edge publiceren (mag alleen stijgen)' },
  'edgedekking.activiteit': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.activiteit.ja',
    wat: 'schermen die activiteit aan de Edge publiceren (mag alleen stijgen)' },
  'edgedekking.presence': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.presence.ja',
    wat: 'schermen die presence aan de Edge publiceren (mag alleen stijgen)' },
  'edgedekking.voortzetting': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.voortzetting.ja',
    wat: 'schermen die voortzetting aan de Edge publiceren (mag alleen stijgen)' },
  'edgedekking.hoofdactie': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.hoofdactie.ja',
    wat: 'schermen die hoofdactie aan de Edge publiceren (mag alleen stijgen)' },
  'edgedekking.trust': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.trust.ja',
    wat: 'schermen die trust aan de Edge publiceren (mag alleen stijgen)' },
  'edgedekking.identiteitZelf': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.identiteit.zelf',
    wat: 'schermen waar het scherm identiteit ZELF publiceert, niet via casco, route of padtabel' },
  'edgedekking.wereldZelf': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.wereld.zelf',
    wat: 'schermen waar het scherm wereld ZELF publiceert, niet via casco, route of padtabel' },
  'edgedekking.contextZelf': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.context.zelf',
    wat: 'schermen waar het scherm context ZELF publiceert, niet via casco, route of padtabel' },
  'edgedekking.objectZelf': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.object.zelf',
    wat: 'schermen waar het scherm object ZELF publiceert, niet via casco, route of padtabel' },
  'edgedekking.activiteitZelf': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.activiteit.zelf',
    wat: 'schermen waar het scherm activiteit ZELF publiceert, niet via casco, route of padtabel' },
  'edgedekking.presenceZelf': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.presence.zelf',
    wat: 'schermen waar het scherm presence ZELF publiceert, niet via casco, route of padtabel' },
  'edgedekking.voortzettingZelf': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.voortzetting.zelf',
    wat: 'schermen waar het scherm voortzetting ZELF publiceert, niet via casco, route of padtabel' },
  'edgedekking.hoofdactieZelf': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.hoofdactie.zelf',
    wat: 'schermen waar het scherm hoofdactie ZELF publiceert, niet via casco, route of padtabel' },
  'edgedekking.trustZelf': { bron: 'EDGEDEKKING.json', veld: 'telling.perVeld.trust.zelf',
    wat: 'schermen waar het scherm trust ZELF publiceert, niet via casco, route of padtabel' },
  'veranderbereik.ronde': { bron: 'VERANDERBEREIK-RONDE.json', veld: 'gemeten.toetsenInDezeRonde',
    wat: 'toetsbestanden die in de gelezen ronde werkelijk hebben gedraaid' },
  'veranderbereik.routesZonderBestand': { bron: 'VERANDERBEREIK-RONDE.json', veld: 'gemeten.routesZonderBronbestand',
    wat: 'waargenomen routes die ROUTEBRON.json niet naar een bestand brengt' },
};

/* De documenten die merktekens mogen dragen. Bewust een lijst en geen glob over
   alles: een generator die elk .md-bestand mag herschrijven, herschrijft op een
   dag ook iets dat niemand had bedoeld. */
const DOCUMENTEN = ['CLAUDE.md', 'CREATE.md', 'EXECUTIE.md', 'OS.md', 'BEWIJSMACHINE.md', 'MODULAIR.md', 'HDI.md',
  'ISOLATIE.md', 'MAATSTAF.md', 'CODE.md', 'KANTOOR.md', 'WEERBAARHEID.md',
  'TRAVELCOMMERCE.md', 'MENS.md', 'MACHINE.md', 'REPRESENTATIE.md', 'FRANCHISE.md', 'SOEVEREIN.md', 'ONDERNEMEN.md',
  'KEURING.md', 'VERANDERING.md', 'PLANNING.md', 'OFFICE.md', 'EDGE.md', 'AUTONOMIE.md'];

const MERK = /<!--getal:([a-zA-Z0-9._-]+)-->([\s\S]*?)<!--\/getal-->/g;

function leesVeld(bron, veld) {
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(WORTEL, bron), 'utf8')); }
  catch (e) { return { fout: 'register ' + bron + ' niet leesbaar' }; }
  let v = data;
  for (const stuk of veld.split('.')) {
    if (v == null || typeof v !== 'object') return { fout: 'veld ' + veld + ' ontbreekt in ' + bron };
    v = v[stuk];
  }
  if (v == null) return { fout: 'veld ' + veld + ' is leeg in ' + bron };
  return { waarde: String(v) };
}

function ronde({ schrijf }) {
  const bevindingen = [];
  let merktekens = 0, bijgewerkt = 0;
  for (const doc of DOCUMENTEN) {
    const pad = path.join(WORTEL, doc);
    let tekst;
    try { tekst = fs.readFileSync(pad, 'utf8'); } catch (e) { continue; }
    /* EERST TELLEN OF DE MERKTEKENS IN BALANS ZIJN. Zonder deze controle is een
       sluittag met een typefout (`<!--/getal>` in plaats van `<!--/getal-->`)
       onzichtbaar: de reguliere uitdrukking loopt dan door tot de VOLGENDE
       sluittag en slikt het getal ertussen op. Dat is hier twee keer gebeurd,
       en beide keren viel het alleen op omdat de opgeslokte waarde toevallig
       verschilde van zijn register. Een merkteken dat zijn sluittag mist, hoort
       de controle te laten zakken en niet af te hangen van toeval. */
    const openers = (tekst.match(/<!--getal:[a-zA-Z0-9._-]+-->/g) || []).length;
    const sluiters = (tekst.match(/<!--\/getal-->/g) || []).length;
    if (openers !== sluiters) {
      bevindingen.push({ doc, id: '(document)', soort: 'onbalans',
        wat: openers + ' openende merktekens tegenover ' + sluiters + ' sluitende. Een sluittag ontbreekt of is verkeerd geschreven; ' +
          'de eerstvolgende waarde wordt dan opgeslokt.' });
    }
    let nieuw = tekst;
    nieuw = tekst.replace(MERK, (heel, id, staat) => {
      merktekens++;
      const reg = GETALLEN[id];
      if (!reg) { bevindingen.push({ doc, id, soort: 'onbekend', wat: 'geen register-ingang voor dit merkteken' }); return heel; }
      const uit = leesVeld(reg.bron, reg.veld);
      if (uit.fout) { bevindingen.push({ doc, id, soort: 'bronstuk', wat: uit.fout }); return heel; }
      if (staat !== uit.waarde) {
        bevindingen.push({ doc, id, soort: 'verouderd', wat: 'document zegt ' + staat + ', register zegt ' + uit.waarde });
        bijgewerkt++;
        return '<!--getal:' + id + '-->' + uit.waarde + '<!--/getal-->';
      }
      return heel;
    });
    if (schrijf && nieuw !== tekst) fs.writeFileSync(pad, nieuw);
  }
  const ongebruikt = Object.keys(GETALLEN).filter(id =>
    !DOCUMENTEN.some(doc => {
      try { return fs.readFileSync(path.join(WORTEL, doc), 'utf8').includes('<!--getal:' + id + '-->'); }
      catch (e) { return false; }
    }));
  return { merktekens, bijgewerkt, bevindingen, ongebruikt };
}

function main() {
  const controle = process.argv.includes('--controle');
  const r = ronde({ schrijf: !controle });
  console.log('LEVENDE GETALLEN IN DE DOCUMENTEN\n');
  console.log('  ' + r.merktekens + ' merkteken(s) in ' + DOCUMENTEN.length + ' document(en)');
  if (!r.merktekens) console.log('  LET OP: nul merktekens is niet "in orde" -- dan bewaakt dit script niets.');
  for (const b of r.bevindingen) console.log('  [' + b.soort + '] ' + b.doc + ' :: ' + b.id + ' -- ' + b.wat);
  if (r.ongebruikt.length) console.log('\n  register-ingangen die nergens staan: ' + r.ongebruikt.join(', '));
  const stuk = r.bevindingen.filter(b => b.soort !== 'verouderd');
  if (controle) {
    if (r.bevindingen.length) { console.error('\nNIET OK: ' + r.bevindingen.length + ' getal(len) lopen achter of zijn stuk. Draai: npm run getallen'); process.exit(1); }
    console.log('\nAlle getallen zijn gelijk aan hun register.');
  } else {
    console.log('\n' + r.bijgewerkt + ' getal(len) bijgewerkt.');
    if (stuk.length) { console.error('NIET OK: ' + stuk.length + ' merkteken(s) hebben geen bruikbare bron.'); process.exit(1); }
  }
}

if (require.main === module) main();
module.exports = { ronde, GETALLEN, DOCUMENTEN, MERK };

#!/usr/bin/env node
/* ============================================================================
   DE BEWIJSSCHULD -- WAT ER NOG NIET GEMETEN IS, EN WAAROM NIET.

   WAAROM DIT ER IS. De bewijslaag van dit huis is 36% bewezen. De overige 64%
   is geen homogene berg werk: er zitten posten in die je met een middag meten
   dicht, posten die een NIEUW INSTRUMENT vragen, en posten waar meten domweg de
   verkeerde vraag is. Die drie door elkaar heen als "ongemeten" tellen maakt het
   getal onbruikbaar -- je weet niet of je naar achterstand kijkt of naar een
   grens van de methode.

   Tot nu toe leefde die kennis in committeksten en in NORM.json-notities. Dat is
   geen register: je kunt er niet op ratelen, en niemand ziet het als een post
   stilletjes groeit. Dit bestand geeft de bewijsschuld dezelfde vorm als
   BEREIK.json al had -- een lijst die ALLEEN MAG KRIMPEN, met een toets eronder.

   DE DRIE SOORTEN, en het onderscheid is het hele punt:

     meetwerk      het instrument bestaat en werkt; er is alleen nog niet
                   overal mee gemeten. Dit is echte achterstand.
     instrument    de vraag is goed maar er is niets dat hem beantwoordt. Dit
                   is geen achterstand maar ontbrekend gereedschap, en het
                   sluiten ervan is een project.
     grens         meten is hier de verkeerde vraag. Deze post SLUIT NOOIT, en
                   dat is geen falen -- het is de eerlijke rand van de methode.
                   Wie hem als achterstand telt, jaagt op een getal dat niet
                   bestaat.

   ELKE POST DRAAGT EEN AANTAL, EEN SOORT, EEN REDEN EN WAT HEM ZOU SLUITEN.
   Zonder dat laatste is een schuldpost een klaagzang.

   Draai:  node scripts/bewijsschuld.js
           node scripts/bewijsschuld.js --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'BEWIJSSCHULD.json');
const VASTLEGGEN = process.argv.includes('--vastleggen');

const lees = (naam) => { try { return JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8')); } catch (e) { return null; } };

/* De posten. Elke telling komt UIT EEN REGISTER en staat hier niet als getal:
   een schuldenlijst met overgeschreven cijfers loopt binnen een maand uit de
   pas met wat er werkelijk is (LAT.md regel 4). */
const POSTEN = [
  /* DEZE POST TELDE 294 ROUTES DIE HIERONDER AL STONDEN, en dat kwam pas uit
     door een NEGATIEF RESULTAAT. De reparatie stond er letterlijk bij ("een
     sonde die een PLAUSIBEL lichaam stuurt"); die is gebouwd (de tweede klop van
     de poortwacht) en bracht op 297 stille routes exact NUL nieuwe sloten aan
     het licht -- 276 bleven 404, 19 bleven 400, 2 bleven 503. De sonde was dus
     niet te zwak: er valt daar niets aan te kloppen. 179 van die routes hebben
     geen bewakerslaag (staat hieronder als capability-in-handler), 78 zijn een
     objectpoort (staat hieronder), 37 hebben alleen een snelheidsrem. Drie
     blijven er echt over.

     Een schuldpost die dezelfde routes een tweede keer telt, maakt de
     achterstand groter dan hij is -- en een te grote achterstand is net zo
     onbruikbaar als een te kleine. Daarom telt deze post nu alleen wat GEEN
     andere post dekt, uit het veld `stilOmdat` dat de poortwacht zelf
     bijhoudt. */
  { id: 'auth-onbeslist', soort: 'meetwerk',
    wat: 'stille routes die onder geen enkele andere post op deze lijst vallen',
    uit: (r) => {
      const om = (r.poortwacht || {}).stilOmdat;
      if (!om) return null;
      const totaal = Object.values(om).reduce((a, b) => a + b, 0);
      const elders = (om['capability in de handler'] || 0) +
        (om['objectpoort: eerst een bestaand object'] || 0) +
        (om['geen autorisatielaag, alleen een rem'] || 0) +
        /* Benoemd sinds de laatste drie zijn nagelopen: twee routes waar de
           schakelkast (functie uit) voor de poort antwoordt, en de meetpoort
           waar de opstelling beslist. Besluiten van het huis, geen open slot. */
        (om['functie staat uit: de schakelkast antwoordt voor de poort'] || 0) +
        (om['omgeving beslist (meetpoort)'] || 0);
      return totaal - elders;
    },
    waarom: 'de klop gaat zonder token. Een 400 of 404 betekent dat de validatie of een ' +
      'opzoeking eerder aan de beurt was dan de autorisatie, en zegt niets over een slot. ' +
      'Na een tweede klop met een plausibel lijf bleven deze routes hetzelfde antwoord geven.',
    sluit: 'per route nakijken wat er precies wordt gevraagd. Dit is geen instrumentvraag ' +
      'meer maar handwerk op een handvol routes, en dat is precies wat een schuldpost hoort ' +
      'te zijn als het gereedschap er is.' },

  { id: 'capability-in-handler', soort: 'grens',
    wat: 'routes zonder bewakerslaag: de controle zit IN de handler (een capability-token)',
    uit: (r) => reden(r.rolproef, 'geen bewakerslaag'),
    waarom: 'de rolproef kruist ROLLEN. Deze routes kennen geen rol -- ze eisen een token dat ' +
      'je alleen hebt als je het hebt gekregen (de schoolborden van foundation, rtf/social). ' +
      'Rollen kruisen is hier niet moeilijk maar zinloos.',
    sluit: 'niets in deze proef. Een eigen proef op capability-tokens zou de goede vraag ' +
      'stellen; die bestaat niet en is een project, geen achterstand.' },

  /* VAN 'instrument' NAAR 'meetwerk': het gereedschap bestaat sinds de
     IDOR-proef. Wat rest is meten, geen bouwen -- en dat is precies het
     verschil dat deze lijst bewaakt. Het aantal blijft 106 omdat de ROLPROEF
     deze routes nog steeds niet kan wegen; de vraag is alleen verhuisd naar
     een instrument dat hem wel stelt. */
  { id: 'objectpoort', soort: 'meetwerk',
    wat: 'routes die eigenaarschap toetsen van een object uit het lichaam, en die nog geen enkel ' +
      'instrument heeft beslist',
    /* De aftrek: de rolproef kan deze routes niet beproeven, maar de IDOR-proef
       heeft er inmiddels een deel van bewezen-gescheiden verklaard. Dat aftrekken
       kan pas sinds de rolproef de NAMEN wegschrijft en niet alleen het aantal;
       zonder namen viel er niets te vergelijken en bleef de post op zijn oude
       getal staan terwijl het werk allang was gedaan. Zijn de namen er niet
       (een ouder register), dan valt hij terug op het kale aantal -- liever te
       hoog dan stilletjes te laag. */
    uit: (r) => {
      const namen = redenRoutes(r.rolproef, 'objectpoort');
      if (!namen) return reden(r.rolproef, 'objectpoort');
      const beslist = idorGescheiden(r.idor);
      return [...namen].filter(x => !beslist.has(x)).length;
    },
    waarom: 'huisAuth en huisPoort doen werkplek.kent(req.body.bedrijf) VOORDAT ze naar de ' +
      'identiteit kijken. Met een leeg of verzonnen bedrijf is 404 het enige antwoord en is ' +
      'de identiteit nooit aan de beurt geweest. Dit zijn 78 /api/werkplek/*-routes met een ' +
      'bedrijfscode in het lijf.',
    sluit: 'GEMETEN met de IDOR-proef (scripts/idorproef.js, IDOR.json). Member-laag: 117 routes ' +
      'bewezen-gescheiden, 0 lekken (de eigenaar komt uit req.session, nooit uit het lijf, wat de ' +
      'klasse uitsluit). Werkplek-poort, geijkt op de eigenaar zodat een weigering iets bewijst: 56 ' +
      'routes bewezen-gescheiden, 0 doorbraken, 26 onbereikbaar. Die 56 waren er eerst 20: de ijking ' +
      'ging over op twee gangen met de objectpool, zodat de eigenaar met een lijf vol ECHTE id\'s uit ' +
      'zijn eigen huis naar binnen gaat en lid B daarna met precies hetzelfde lijf. De 26 die ' +
      'overblijven vragen een keten die deze proef niet kan lopen (een goedgekeurd document, een ' +
      'toegewezen klus) en zijn hetzelfde werk als object-vooraf hieronder: geen ontbrekend ' +
      'instrument, maar werk per domein.' },

  /* De deuren van het huis: elke lie-run spaart ze (RTG_LIEG_NIET), want een
     toets die niet meer kan inloggen zakt overal tegelijk en dan meet je de
     voorbereiding en niet de inhoud. De OUTPUT-cel van een deur is daarom per
     constructie niet met de liegpoort te meten. */
  { id: 'output-deuren', soort: 'grens',
    wat: 'deuren (login, register, webauthn) waarvan het antwoord niet met de liegpoort te meten is',
    uit: (r) => {
      const per = (r.output && r.output.perRoute) || {};
      return Object.values(per).filter(c => c.staat === 'ongemeten' && /deur/.test(c.reden || '')).length || undefined;
    },
    waarom: 'RTG_LIEG_NIET spaart de deuren in elke lie-run; over een deur is dus per constructie ' +
      'nooit gelogen, en een oordeel van een instrument dat er niet kan komen is geen oordeel.',
    sluit: 'niets in deze proef; een inhoudseis op een deur hoort in een gewone toets op het echte ' +
      'antwoord (token-vorm, foutmelding), niet in een leugenmeting die de deur zou breken.' },

  { id: 'lichaamssleutel', soort: 'grens',
    wat: 'routes waarvan de sleutel een VELD IN HET VERZOEK is, geen token in de kop',
    uit: (r) => reden(r.rolproef, 'lichaamssleutel'),
    waarom: 'gastAuth leest req.body.sleutel, gezinsPoort en rtfPoort lezen code+token uit het ' +
      'lichaam. Een member-, supplier- of officetoken is voor zo n deur niet fout maar ' +
      'IRRELEVANT: hij kijkt er niet naar. Alle drie krijgen dezelfde 401.',
    sluit: 'niets in deze proef; die 401 als bewijs tellen zou dezelfde fout zijn die de ' +
      'AUTH-as al 294 cellen kostte. Een proef op sessiesleutels is een andere vraag.' },

  /* STOND HIER ALS 'grens', EN DAT KLOPT NIET MEER. Zolang de liegpoort alleen
     per toetsbestand kon, viel er over deze routes niets af te leiden en was dat
     de rand van de methode. Sinds scripts/outputproef.js --meet bestaat, is het
     gewoon traag werk: lieg over EEN route, draai de toetsen die hem raken, en
     kijk wie het merkt. Een post die meetbaar is geworden hoort niet als grens
     te blijven staan -- dan verbergt het woord "grens" achterstand. */
  { id: 'output-niet-toerekenbaar', soort: 'meetwerk',
    wat: 'routes waar inhoudgevoelige toetsen op zitten, maar die toetsen raken er meer',
    uit: (r) => (r.output && r.output.gemeten || {}).onbeslist,
    waarom: 'een toets die op de lege inhoud zakt en tien routes raakt, kan op de inhoud van ' +
      'een van die tien zijn gezakt. Aan DEZE route valt dan niets toe te rekenen.',
    sluit: 'node scripts/outputproef.js --meet=<n>. Die liegt over EEN route en draait alleen ' +
      'de toetsen die hem raken; de uitslagen stapelen in OUTPUTPROEF.json. Een paar honderd ' +
      'per ronde, dus dit sluit met werk en niet met een doorbraak.' },

  /* NIEUW SINDS DE BAND KLAAR IS. Blind is een uitslag en geen gat in de meting:
     er is over deze route gelogen en geen enkele toets zag het. Maar voor de
     100%-richting is het wel degelijk schuld -- niet van de meting maar van de
     toetsen. Elke blinde route is een toets die nog niet bestaat. */
  { id: 'output-blind', soort: 'meetwerk',
    wat: 'routes waarover gelogen is zonder dat een toets het merkte',
    uit: (r) => (r.output && r.output.gemeten || {}).blind,
    waarom: 'de liegpoort heeft het antwoord van precies deze route vervalst en de toetsen die ' +
      'hem raken bleven groen. Er kijkt dus niets naar deze inhoud; wat hier terugkomt kan ' +
      'stilletjes leeg of fout zijn zonder dat iets zakt.',
    sluit: 'per route een toets die het ANTWOORD leest en er iets van vindt. Geen statusregel ' +
      '(die was er al en bleef groen) maar een inhoudseis. Daarna meet de band hem vanzelf om. ' +
      'De laatste vijf zijn zo nagelopen: de boekhoud-export kreeg een echte inhoudseis in ' +
      'test/eigenaar.test.js (acht kolommen, de BOM, nooit JSON) en merkt de leugen nu; de andere ' +
      'vier bleken onmeetbaar en staan onder output-onwaarneembaar.' },

  { id: 'output-onwaarneembaar', soort: 'grens',
    wat: 'routes waarvan het ware antwoord zelf 200 {ok:true} is, precies wat de liegpoort ervan maakt',
    uit: (r) => (r.output && r.output.gemeten || {}).onwaarneembaar,
    waarom: 'over deze routes IS gelogen en geen toets zakte -- maar dat zegt niets over de toetsen, ' +
      'want er viel niets te merken. De inhoudskaart heeft het ware antwoord opgehaald van een ' +
      'eerlijke wegwerpserver en vastgesteld dat het niet van de leugen te onderscheiden is ' +
      '(grond: gelijk-aan-leugen). Sommige daarvan zijn zo BEDOELD: het codewoord-alarm antwoordt ' +
      'met opzet altijd hetzelfde, want een verschil zou aan degene die over je schouder meekijkt ' +
      'verraden dat er een codewoord bestaat.',
    sluit: 'niets op deze as, en dat is de eerlijke rand: wat deze routes waard zijn zit in hun ' +
      'UITWERKING en hoort op STATE en SIDE_EFFECT thuis. Voor drm/report en fluister/focus staat ' +
      'die daar ook bewezen; site/verwijder en codewoord/check staan er ongemeten, en DAT is de ' +
      'echte openstaande vraag over deze twee -- niet of iemand naar hun antwoord kijkt. Let op de ' +
      'grond: een CSV-export die de sonde niet kan lezen (grond geen-json) hoort hier NIET in en ' +
      'krijgt gewoon een inhoudstoets.' },

  { id: 'audit-wisselend', soort: 'meetwerk',
    wat: 'routes die soms wel en soms geen spoor nalaten, en waarvan nog niemand weet waarom',
    uit: (r) => (r.audit && r.audit.gemeten || {}).wisselend,
    waarom: 'het hangt ergens van af -- geslaagd of geweigerd, welke rol, welke invoer. Dan is ' +
      '"laat een spoor na" geen eigenschap van de route.',
    sluit: 'uitzoeken WAARVAN het afhangt. Per route na te lopen met het journaal erbij; ' +
      'echte achterstand, geen ontbrekend gereedschap. De veertien van de vorige ronde zijn zo ' +
      'nagelopen: drie bleken een echt defect (auth/login, supplier/login, office/verify) en zijn ' +
      'gerepareerd, elf hadden een reden en staan nu onder audit-verklaard.' },

  { id: 'audit-verklaard', soort: 'grens',
    wat: 'routes die wisselen, en waarvan met de hand is opgeschreven waarvan het afhangt',
    uit: (r) => (r.audit && r.audit.gemeten || {}).verklaard,
    waarom: 'de kaart in scripts/auditproef.js zegt per route wat het verschil maakt. Er loopt een ' +
      'regel doorheen: een journaal schrijft GEBEURTENISSEN op en geen aanroepen. Een knop die niets ' +
      'omzette, een ronde die niets boekte, een wachtrij die leeg was -- dan is er niets gebeurd, en ' +
      'een regel die zegt van wel maakt het boek juist minder waard.',
    sluit: 'niets, en daarom is dit een GRENS en geen achterstand: voor deze routes is "laat hij ' +
      'altijd een spoor na" de verkeerde vraag, want het juiste antwoord is nee. De post is wel ' +
      'begrensd gehouden: verklaard telt NOOIT als bewijs (de ' +
      'bewijsmatrix zet er ongemeten neer, niet bewezen), de kaart raakt "geen spoor" niet aan, en ' +
      'een verklaring die nergens meer op slaat wordt gemeld. Deze post staat er dus om zichtbaar ' +
      'te blijven, niet om weggewerkt te worden.' },

  { id: 'rollback-gezakt', soort: 'meetwerk',
    wat: 'routes die weigeren en toch de toestand veranderen',
    uit: (r) => ((r.staatproef || {}).gemeten || {}).rollbackGezakt,
    waarom: 'de meeste zijn /api/rtfos/* met securityLog en sessions -- vermoedelijk de ' +
      'auth-laag die een geweigerde poging vastlegt, en dus mogelijk ruis in de meting en ' +
      'geen lek. Maar EEN ervan verspringt per ronde van plek, en een bevinding die verhuist ' +
      'is zelf een bevinding over de meting.',
    sluit: 'per route nalopen wat er beweegt en waarom. Dit is de oudste post op deze lijst ' +
      'en de enige die naar een mogelijk defect wijst.' },

  /* NIEUW, EN HET IS GEEN NIEUWE SCHULD MAAR OUDE SCHULD MET EEN NAAM. 3112
     routes stonden als "ongemeten" in de staatproef zonder dat iemand kon zeggen
     WAT eraan ontbrak. scripts/waarom.js deelt ze in naar de ontbrekende
     voorwaarde; deze post telt de grootste groep, en die vraagt om ketens van
     twee stappen (eerst aanmaken, dan bedienen). */
  { id: 'object-vooraf', soort: 'instrument',
    wat: 'routes die een bestaand object willen bedienen dat de proef niet heeft aangemaakt',
    uit: (r) => {
      const s = ((r.waarom || {}).soorten || []).find(x => x.id === 'object-ontbreekt');
      return s ? s.aantal : null;
    },
    waarom: 'de proef stuurt een plausibel lijf met een verzonnen identiteit. De route zoekt ' +
      'het object op, vindt het niet, en antwoordt 404 -- juist gedrag, en de handler heeft ' +
      'nooit gedraaid. Gemeten op 507 member-routes: 166 verschillende boodschappen die alle ' +
      '166 hetzelfde zeggen.',
    sluit: 'de objectpool (scripts/lib/objectpool.js) oogst echte id\'s uit antwoorden die de ' +
      'ronde zelf zag en verrijkt er de lijven mee; de eerste ronde herwon zo 393 van de 1014. ' +
      'Wat rest zijn objecten die alleen via een eigen keten ontstaan (vier ogen, goedkeuring); ' +
      'daarvoor blijft de tweestapsketen per domein het antwoord.' },

  { id: 'proefruis', soort: 'meetwerk',
    wat: 'de vier proeven meten op dezelfde code niet twee keer hetzelfde',
    uit: () => 1,
    waarom: 'twee rondes op dezelfde commit gaven vijf cellen verschil (INPUT vier omlaag, ' +
      'AUTH en ACL twee omhoog). Op 46.035 cellen is dat 0,01%, maar een ratel op een ruisende ' +
      'meter weigert op ruis, en dat leert mensen om met de hand vast te leggen. Zo verslapt ' +
      'een ratel.',
    sluit: 'de ruis meten: tien rondes op dezelfde commit, en per as de spreiding vastleggen. ' +
      'Dan weet de ratel wat een echte verslechtering is en wat niet.' },


  /* ------------------------------------------------------------------------
     DE UITVOERINGSLAAG (EXECUTIE.md). Vier posten, alle vier uit een register
     dat deze ronde zelf is gaan meten. Ze staan hier omdat een schuldenlijst
     die alleen de OUDE laag kent, precies daar blind wordt waar het huis
     nieuw is -- en een nieuwe laag zonder schuldpost ziet er per ongeluk
     schuldenvrij uit.
     ---------------------------------------------------------------------- */

  { id: 'gevolg-onbekend', soort: 'meetwerk',
    wat: 'bereikbare capabilities waarvan niemand heeft gemeten WAT ze veranderen',
    /* De bereikbare paden staan in EXECUTION_MAP.json; of er ooit gemeten is
       WAT ze veranderen, weet gevolg.js -- en die vraag stellen we aan gevolg.js
       zelf en niet aan een tweede lezing van IDEMPROEF.json. Een schuldpost die
       zijn eigen kopie van de meetlogica meebrengt, gaat op een dag iets anders
       zeggen dan de laag die hij beweert te tellen. */
    uit: (r) => {
      const caps = (r.executionmap || {}).capabilities;
      if (!caps) return null;
      let gevolgVan;
      try { ({ gevolgVan } = require('../server/kern/stuur/gevolg')); } catch (e) { return null; }
      const paden = new Set();
      for (const c of Object.values(caps))
        if (c && c.pad && c.bereik && c.bereik !== 'verboden') paden.add(c.pad);
      if (!paden.size) return null;
      let n = 0;
      for (const pad of paden) if (gevolgVan(pad).graad === 'onbekend') n++;
      return n;
    },
    waarom: 'server/kern/stuur/gevolg.js projecteert een EERDERE proefronde op de stappen van ' +
      'een plan. Staat een pad niet in die ronde, dan is de eerlijke uitslag `onbekend` -- en ' +
      'een plan dat voor het merendeel uit onbekende gevolgen bestaat, is geen voorspelling.',
    sluit: 'de idempotentieproef over deze paden halen, of ze in de droogloop opnemen. Het ' +
      'gereedschap staat er (scripts/droogloop.js meet per stap welke collectie werkelijk bewoog); ' +
      'wat rest is meten.' },

  { id: 'droogloop-onbeoordeeld', soort: 'meetwerk',
    wat: 'stappen in de laatste droogloop waarvan de voorspelling niet te beoordelen was',
    uit: (r) => {
      const t = (r.droogloop || {}).telling;
      return t && typeof t.voorspellingOnbekend === 'number' ? t.voorspellingOnbekend : null;
    },
    waarom: 'een voorspelling die `onbekend` zegt kan niet fout zijn, dus meetellen als "klopte" ' +
      'zou de uitslag opkloppen. Deze stappen zijn wel UITGEVOERD en wel waargenomen; wat ' +
      'ontbreekt is iets om de waarneming tegen af te zetten.',
    sluit: 'dezelfde weg als gevolg-onbekend: het pad in een proefronde krijgen. Deze post is ' +
      'daarvan de kleine, zichtbare kant -- hij staat er apart omdat een droogloop met vijf ' +
      'onbeoordeelde stappen er groen uitziet en niets bewijst.' },

  { id: 'herstel-onbevestigd', soort: 'instrument',
    wat: 'vermoede tegenhangers (annuleren, terugdraaien) die nooit zijn beproefd',
    uit: (r) => {
      const g = (r.herstel || {}).gemeten;
      return g && typeof g.vermoed === 'number' ? g.vermoed : null;
    },
    waarom: 'HERSTEL.json leidt tegenhangers af uit NAMEN, en de hoogste graad die dat kan ' +
      'opleveren is `vermoed`. Dat /api/x/annuleer bestaat naast /api/x/boek zegt niet dat de ' +
      'eerste de tweede werkelijk ongedaan maakt.',
    sluit: 'een proef die het paar echt uitvoert en de opslag ervoor en erna vergelijkt. Dat ' +
      'gereedschap bestaat niet: de droogloop meet EEN stap, niet een paar met een tussenstand. ' +
      'Instrument dus, geen achterstand -- en tot dan blijft compenserend handelen onbewezen.' },

  { id: 'idem-ongeclassificeerd', soort: 'meetwerk',
    wat: 'muterende routes zonder uitspraak over herhalen: wat gebeurt er bij een tweede keer',
    uit: (r) => {
      /* De routes MET een besluit staan in IDEMBESLUIT.json; hoeveel er in
         totaal beproefd zijn, weet IDEMPROEF.json. Het verschil is de
         achterstand. Beide moeten er zijn -- anders een vraagteken. */
      const besluiten = (r.idembesluit || {}).routes;
      const rijen = r.idemproef && Array.isArray(r.idemproef.perRoute) ? r.idemproef.perRoute : null;
      if (!besluiten || !rijen) return null;
      /* Alleen routes die WERK deden tellen mee. Een route waar de proef niet
         binnenkwam (404, geen geldig lijf) heeft geen tweede keer om over te
         beslissen; die als achterstand tellen maakt de post twee keer zo groot
         als hij is, en dat is dezelfde fout als bij auth-onbeslist. Zij staan
         al onder object-vooraf en proefruis. */
      const werk = rijen.filter(x => !/geen werk/.test(x.reden || ''));
      const beslist = new Set(Object.keys(besluiten));
      return werk.filter(x => !beslist.has(x.pad)).length;
    },
    waarom: 'autonomie zonder herhaalsemantiek is niet te doen: een keten die halverwege ' +
      'afbreekt moet weten of opnieuw beginnen veilig is. Het doel is niet dat alles ' +
      'idempotent IS -- het is dat van elke route vastligt wat een tweede keer betekent.',
    sluit: 'per route beslissen en vastleggen. Het instrument staat (scripts/idemproef-route.js ' +
      'plus IDEMBESLUIT.json met zijn klassen); dit is meetwerk en handwerk.' },

  { id: 'wegwerpserver-kopieen', soort: 'meetwerk',
    wat: 'scripts met een eigen kopie van "start een wegwerpserver"',
    uit: () => {
      /* HET KENMERK IS DE SPAWN, NIET HET PAD. De eerste teller zocht op
         "'server', 'server.js'" en telde daarmee twee in-procesladers mee
         (grensmeld laadt de servermodule in een -e script, kernbron require't
         hem om de moduleboom te traceren -- geen van beide is een wegwerpserver)
         EN miste drie echte kopieen die 'server/server.js' als EEN string
         spawnen (beproeving, tot-crash, hersteltijd). Een schuldpost die zowel
         te veel als te weinig telt, stuurt twee kanten op verkeerd -- dezelfde
         fout als auth-onbeslist, dezelfde dag gevonden. Het echte kenmerk:
         een spawn-aanroep met server.js erin, over regelgrenzen heen. */
      let n = 0;
      try {
        for (const f of fs.readdirSync(path.join(WORTEL, 'scripts'))) {
          if (!f.endsWith('.js')) continue;
          const t = fs.readFileSync(path.join(WORTEL, 'scripts', f), 'utf8');
          if (t.includes('lib/wegwerpserver')) continue;
          if (/spawn(?:Sync)?\(process\.execPath[\s\S]{0,200}?server\.js/.test(t)) n++;
        }
      } catch (e) { return null; }
      return n;
    },
    waarom: 'scripts/lib/wegwerpserver.js bestaat sinds de meetronde, maar de bestaande ' +
      'instrumenten zijn er nog niet op omgezet. Verandert er iets aan hoe je hier een server ' +
      'start, dan verandert dat op tien plekken of -- waarschijnlijker -- op een.',
    sluit: 'GEDAAN: alle instrumenten delen nu scripts/lib/wegwerpserver.js. De lib kreeg de ' +
      'opties die de laatste vier nodig hadden -- magSterven (keten/verraad saboteren de start), ' +
      'een eigen/hergebruikte datamap (hersteltijd herstart erop), nodeArgs (--expose-gc + gc-hook ' +
      'voor de geheugen-beproevingen), een vaste poort en readiness (ladder, beproeving, tot-crash). ' +
      'Een tiende kopie kan er niet meer bij zonder dat de teller het ziet.' }
];

function reden(register, voorvoegsel) {
  if (!register || !Array.isArray(register.redenenNietBeproefbaar)) return null;
  return register.redenenNietBeproefbaar
    .filter(x => String(x.reden).startsWith(voorvoegsel))
    .reduce((a, x) => a + x.aantal, 0);
}

/* Dezelfde groepen, maar bij NAAM. De rolproef schrijft sinds kort niet alleen
   het aantal maar ook de routes per reden weg, en dat maakt een aftrek mogelijk
   die eerst niet te doen was: welke van deze routes heeft een ANDER instrument
   inmiddels beslist? Geeft null als de namen er nog niet zijn (een register van
   voor die verandering), zodat de post terugvalt op het kale aantal in plaats
   van stilletjes nul te melden. */
function redenRoutes(register, voorvoegsel) {
  if (!register || !Array.isArray(register.redenenNietBeproefbaar)) return null;
  const groepen = register.redenenNietBeproefbaar.filter(x => String(x.reden).startsWith(voorvoegsel));
  if (!groepen.length || groepen.some(g => !Array.isArray(g.routes))) return null;
  return new Set(groepen.flatMap(g => g.routes));
}

/* Wat de IDOR-proef bewezen-gescheiden heeft verklaard, uit beide gangen: de
   member-laag en de werkplek-poort. Alleen 'gescheiden' telt -- 'onbereikbaar'
   is geen uitspraak en 'doorbraak' is het tegendeel van een. */
function idorGescheiden(register) {
  if (!register) return new Set();
  const uit = new Set();
  for (const bak of [register.perRoute, register.werkplekPerRoute]) {
    for (const [route, v] of Object.entries(bak || {})) if (v && v.staat === 'gescheiden') uit.add(route);
  }
  return uit;
}

function meet() {
  const r = {
    poortwacht: lees('POORTWACHT.json'), rolproef: lees('ROLPROEF.json'),
    staatproef: lees('STAATPROEF.json'), output: lees('OUTPUTPROEF.json'),
    audit: lees('AUDITPROEF.json'), waarom: lees('WAAROM.json'), idor: lees('IDOR.json'),
    /* De registers van de uitvoeringslaag. Ontbreekt er een, dan geeft de post
       `null` en staat er een vraagteken -- nooit een nul, want niet gemeten is
       iets anders dan niets te melden. */
    resolverbereik: lees('RESOLVERBEREIK.json'), idemproef: lees('IDEMPROEF.json'),
    droogloop: lees('DROOGLOOP.json'), herstel: lees('HERSTEL.json'),
    idembesluit: lees('IDEMBESLUIT.json'), executionmap: lees('EXECUTION_MAP.json')
  };
  const posten = POSTEN.map(p => {
    let aantal = null;
    try { aantal = p.uit(r); } catch (e) { aantal = null; }
    return { id: p.id, soort: p.soort, wat: p.wat, aantal: (aantal === undefined ? null : aantal),
      waarom: p.waarom, sluit: p.sluit };
  });
  const som = (s) => posten.filter(p => p.soort === s && typeof p.aantal === 'number')
    .reduce((a, p) => a + p.aantal, 0);
  return { stempel: stempel(),
    uitleg: 'Wat er nog niet gemeten is, en waarom niet. MAG ALLEEN KRIMPEN -- zie ' +
      'test/bewijsschuld.test.js. Een post van soort "grens" sluit nooit; die telt niet als ' +
      'achterstand maar als de rand van de methode.',
    grens: 'Dit is een lijst van wat we WETEN dat we niet hebben gemeten. Wat niemand heeft ' +
      'bedacht staat er per definitie niet in, en dat is de gevaarlijkste categorie -- een ' +
      'schuldenlijst is geen dekkingsbewijs. De aantallen komen uit de registers en zijn dus ' +
      'zo vers als de laatste ronde; zie scripts/versheid.js.',
    telling: { posten: posten.length, meetwerk: som('meetwerk'),
      instrument: som('instrument'), grens: som('grens') },
    posten };
}

module.exports = { meet, POSTEN };

if (require.main !== module) return;

const uit = meet();
if (process.argv.includes('--json')) { console.log(JSON.stringify(uit, null, 1)); process.exitCode = 0; return; }

console.log('\n=== DE BEWIJSSCHULD ===\n');
for (const soort of ['meetwerk', 'instrument', 'grens']) {
  const eigen = uit.posten.filter(p => p.soort === soort);
  if (!eigen.length) continue;
  console.log('  ' + soort.toUpperCase());
  for (const p of eigen) {
    console.log('    ' + String(p.aantal === null ? '?' : p.aantal).padStart(5) + '  ' + p.id.padEnd(26) + p.wat);
  }
  console.log('');
}
console.log('  achterstand (meetwerk + instrument): ' + (uit.telling.meetwerk + uit.telling.instrument));
console.log('  rand van de methode (grens)        : ' + uit.telling.grens + '  -- sluit nooit, en dat is geen falen');

if (VASTLEGGEN) {
  /* ---- GROEI MAG, MAAR NOOIT ZWIJGEND ----

     De ratel in test/bewijsschuld.test.js weigert een groeiende achterstand, en
     dat is goed: anders wordt deze lijst een plek om werk op te stapelen. Maar
     hij MOET soms groeien, en dan om de beste reden die er is -- er is iets in
     beeld gekomen dat er altijd al was. Toen scripts/waarom.js 1025 routes een
     naam gaf ("wil een bestaand object"), stonden die daarvoor helemaal niet op
     deze lijst: ze zaten anoniem in de 3112 "ongemeten" van de staatproef.

     Zo'n sprong met de hand in het bestand plakken laat de reden in een
     committekst achter, en daar leest niemand hem. Hij hoort in het register,
     bij het getal dat hij verklaart. --groei="..." schrijft hem erbij; zonder
     reden weigert dit script te groeien. */
  const groeiArg = (process.argv.find(a => a.startsWith('--groei=')) || '').slice(8);
  const oud = (() => { try { return JSON.parse(fs.readFileSync(UITSLAG, 'utf8')); } catch (e) { return null; } })();
  const som = (t) => t.meetwerk + t.instrument;
  if (oud && som(uit.telling) > som(oud.telling) && !groeiArg) {
    console.error('\n  Weiger vast te leggen: de achterstand groeit van ' + som(oud.telling) +
      ' naar ' + som(uit.telling) + ' en er staat geen reden bij.');
    console.error('  Groeien mag -- meestal omdat er iets in beeld komt dat er al was -- maar');
    console.error('  dan hoort de reden IN het register: --groei="wat er zichtbaar werd".');
    process.exitCode = 1;
    return;
  }
  if (oud && groeiArg && som(uit.telling) > som(oud.telling)) {
    uit.groei = (oud.groei || []).concat([{ op: new Date().toISOString().slice(0, 10),
      van: som(oud.telling), naar: som(uit.telling), reden: groeiArg }]);
  } else if (oud && oud.groei) {
    uit.groei = oud.groei;
  }
  fs.writeFileSync(UITSLAG, JSON.stringify(uit, null, 1) + '\n');
  console.log('\n  vastgelegd in BEWIJSSCHULD.json');
}
console.log('');
process.exitCode = 0;

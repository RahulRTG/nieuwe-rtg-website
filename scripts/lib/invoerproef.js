/* ============================================================================
   DE INVOERPROEF -- wordt rommel geweigerd zonder te breken en zonder te praten?

   DE KOLOM DIE DIT VULT. In de bewijsmatrix staat INPUT op ongemeten voor alle
   3985 routes, met als reden: "een rommelronde met een levend token per rol;
   anoniem meet je alleen de voordeur". Dat laatste is de hele truc. De gauntlet
   in de Beproeving beukt met rommel op elk endpoint, maar zonder token: dan
   antwoordt de POORT en niet de validatie, en een 401 op rommel bewijst niets
   over invoerafhandeling.

   Deze proef stuurt daarom rommel MET DE JUISTE ROL. Pas dan sta je voor de
   validatie waar je iets over wilt weten. Het is precies het spiegelbeeld van
   scripts/lib/rolproef.js, die plausibele invoer met de VERKEERDE rol stuurt --
   samen dekken ze de twee helften: mag je erin, en overleeft hij wat je meebrengt.

   TWEE FOUTKLASSEN, EN ZE ZIJN NIET HETZELFDE.

     BREKEN   een 500, 502 of 504, of helemaal geen antwoord. Rommel hoort een
              400 op te leveren: een handler die op invoer omvalt is een handler
              die met een verzoek te dwingen is.
     PRATEN   een antwoord dat interne details meegeeft -- een stack trace, een
              pad op de schijf, een databasefoutcode. De statuscode kan dan
              kloppen terwijl het antwoord de binnenkant van het huis toont.

   WAT EEN ROUTE HIER VERDIENT, en wat niet:

     dicht      er is rommel heen gestuurd MET de juiste rol, en er kwam geen
                breuk en geen intern spoor uit.
     GEZAKT     wel. Met de rommel erbij, zodat het na te spelen is.
     poort      elk antwoord was een grendel (401, 403 of 503): we stonden nog
                voor de deur -- KYC, onboarding, een uitgeschakelde functie.
                Dat is ONGEMETEN en geen groen, dezelfde regel als bij de
                ketenronde, waar een keten achter een poort met reden als blind
                wordt genoteerd.

   Een route die niet is geprobeerd komt er niet in te staan. "Geen bevinding"
   mag nooit als dekking gelezen worden.
   ========================================================================== */
'use strict';

/* WAT ER NOOIT IN EEN ANTWOORD HOORT, hoe netjes de statuscode ook is. Bewust
   krap gehouden en niet ruim: dit draait over duizenden routes, en een merker
   die op gewone Nederlandse foutteksten aanslaat levert honderden valse
   bevindingen -- en een lijst die je moet wegstrepen wordt binnen een week
   genegeerd. Elke regel hieronder wijst iets aan dat uit de MACHINE komt en
   nooit uit een tekst die voor een lid is geschreven. */
const SPOORMERKERS = [
  // een stackframe: "at Object.doeIets (/pad/naar/bestand.js:12:9)"
  { naam: 'stack trace', re: /\bat\s+[A-Za-z_$][\w$.<>]*\s*\(?[^\s)]*:\d+:\d+/ },
  { naam: 'node-intern pad', re: /node:internal[\w/]*/ },
  { naam: 'pad op de schijf', re: /(\/(home|Users|var|opt|root)\/[\w./-]+\.js|[A-Z]:\\[\w\\.-]+\.js)/ },
  { naam: 'databasefoutcode', re: /\b(SQLITE_[A-Z]+|ER_[A-Z_]+|ECONNREFUSED|ENOENT|EADDRINUSE)\b/ },
  { naam: 'stack-veld in de JSON', re: /"stack"\s*:\s*"/ }
];

/* WELKE 5XX EEN GRENDEL IS EN WELKE EEN BREUK -- en dit koste de eerste ronde.

   De eerste versie las elke 5xx als "omgevallen". De proef meldde meteen drie
   bevindingen op /api/bank/krediet*, en die waren alle drie loos: 503 is in dit
   huis een ONTWORPEN antwoord. Er zijn vier plekken die hem bewust geven --
   de API-poort staat uit, een functie is geschakeld, er is een vergunning nodig
   (middleware/functieschakelaars.js), de opslag laadt nog of de app is in
   onderhoud (middleware/remmen.js). Dat is een handler die WERKT en netjes nee
   zegt, precies zoals een 403.

   Een loos alarm is hier geen kleinigheid: na drie keer wegstrepen zet iemand de
   proef uit, en dan meet er niets meer. Dus telt 503 als GRENDEL -- dezelfde
   stand als 401 en 403: ongemeten, met reden, en nooit stilzwijgend groen.

   Wat er overblijft als BREUK is wat niemand als antwoord ontwerpt: 500 (de
   generieke afhandelaar, dus een worp die niemand opving), 502 en 504 (een
   naad die wegviel), en helemaal geen antwoord. Plus elke 5xx die alsnog een
   intern spoor meegeeft -- want dan ontwerp je hem misschien wel, maar praat hij. */
const GRENDELS = new Set([401, 403, 503]);
const BREUKSTATUS = new Set([500, 502, 504]);

/* HET OORDEEL OVER EEN ANTWOORD, apart en puur.

   Los toetsbaar (test/invoerproef.test.js), want in een proef die een echte
   server nodig heeft komt niemand hier ooit met een mutatie bij. Dat is dezelfde
   opzet als weegAntwoord() in lib/rolproef.js, en om dezelfde reden. */
function weegInvoer(status, lijf) {
  const tekst = String(lijf == null ? '' : lijf);
  const spoor = sporenIn(tekst);
  /* GEEN ANTWOORD TELT ALS BREKEN. status 0 betekent hier: de verbinding viel
     weg of er kwam niets terug. Voor wie het verzoek deed is dat geen nettere
     uitkomst dan een 500 -- het is een slechtere. */
  if (status === 0 || status == null) return { poort: false, breekt: true, spoor: null, reden: 'geen antwoord' };
  if (BREUKSTATUS.has(status)) return { poort: false, breekt: true, spoor, reden: 'status ' + status };
  /* Een grendel die tegelijk zijn binnenkant laat zien is geen nette weigering
     meer; die telt gewoon mee als bevinding. */
  if (GRENDELS.has(status) && !spoor) return { poort: true, breekt: false, spoor: null, reden: null };
  return { poort: false, breekt: false, spoor, reden: spoor ? 'intern spoor in het antwoord' : null };
}

function sporenIn(tekst) {
  for (const m of SPOORMERKERS) if (m.re.test(tekst)) return m.naam;
  return null;
}

/* De proef zelf. `routes` zijn de routes met een herkenbare rol; `tokenVoor(rol)`
   levert een levend token; `rommelVoor()` geeft een nieuw rommellijf.
   `hernieuw(rol)` mag een token opnieuw halen -- zie hieronder waarom dat er is. */
async function draaiInvoerproef({ post, routes, tokenVoor, rommelVoor, hernieuw, perRoute: rondes, maxPogingen }) {
  const N = rondes || 2;
  const perRoute = {};
  const bevindingen = { breuken: [], sporen: [] };
  let gedaan = 0, poortAntwoorden = 0, bereikt = 0, hernieuwd = 0;

  for (const r of routes) {
    if (maxPogingen && gedaan >= maxPogingen) break;
    const sleutel = r.methode + ' ' + r.pad;
    const bij = perRoute[sleutel] = { methode: r.methode, pad: r.pad, rol: r.rol,
      pogingen: 0, invoer: 'dicht', statussen: [] };

    for (let i = 0; i < N; i++) {
      if (maxPogingen && gedaan >= maxPogingen) break;
      const lijf = rommelVoor(r);
      let st = await post(r.pad, lijf, tokenVoor(r.rol));
      gedaan++; bij.pogingen++;

      /* EEN DOOD TOKEN IS EEN MEETFOUT, GEEN BEVINDING. Rommel met de juiste rol
         raakt onderweg echte handlers, en een daarvan kan de sessie beeindigen
         (uitloggen, een sleutel roteren). Vanaf dat moment antwoordt op ELKE
         volgende route de poort, en dan meldt de ronde "niets gevonden" over
         duizend routes die nooit voorbij de deur zijn geweest. Dus: bij een 401
         een keer opnieuw halen en de poging overdoen. */
      if (st.status === 401 && hernieuw) {
        const vers = await hernieuw(r.rol);
        if (vers) { hernieuwd++; st = await post(r.pad, lijf, tokenVoor(r.rol)); gedaan++; bij.pogingen++; }
      }

      const lijfTekst = typeof st.data === 'string' ? st.data : JSON.stringify(st.data || {});
      const o = weegInvoer(st.status, lijfTekst);
      bij.statussen.push(st.status);
      if (o.poort) { poortAntwoorden++; continue; }
      bereikt++;
      if (o.breekt) {
        bij.invoer = 'GEZAKT'; bij.reden = o.reden;
        bij.rommel = JSON.stringify(lijf).slice(0, 300);
        bevindingen.breuken.push(sleutel + ' [' + st.status + '] ' + o.reden);
        break;
      }
      if (o.spoor) {
        bij.invoer = 'GEZAKT'; bij.reden = o.spoor;
        bij.rommel = JSON.stringify(lijf).slice(0, 300);
        bevindingen.sporen.push(sleutel + ' [' + st.status + '] ' + o.spoor + ': ' +
          lijfTekst.slice(0, 140).replace(/\s+/g, ' '));
        break;
      }
    }

    /* ELK ANTWOORD WAS DE POORT: dan is er over deze route niets geleerd. Niet
       'dicht' laten staan -- dat zou een grendel als invoercontrole tellen. */
    if (bij.invoer === 'dicht' && bij.pogingen && bij.statussen.every(s => GRENDELS.has(s))) {
      bij.invoer = 'poort';
      bij.reden = 'elk antwoord was een grendel (401/403/503) -- de validatie is niet bereikt';
    }
  }

  /* DE BLINDHEIDSCONTROLE. Kwam de rommel nergens voorbij een poort, dan heeft
     deze ronde de voordeur gemeten en niet de invoer -- precies de fout waar
     deze proef voor is gebouwd. Dan oordeelt hij niet (LAT.md, regel 10). */
  const meterStuk = bereikt === 0
    ? 'geen enkel rommelverzoek kwam voorbij een poort (' + poortAntwoorden + ' keer 401/403); ' +
      'deze ronde heeft de voordeur gemeten en niet de invoerafhandeling'
    : null;

  return { perRoute, bevindingen, pogingen: gedaan, bereikt, poortAntwoorden, hernieuwd, meterStuk };
}

const CONTROL = {
  control: 'INVOER-ROBUUSTHEID',
  wat: 'rommel met de JUISTE rol levert geen serverfout op en geen antwoord dat de binnenkant toont',
  eigenaar: 'Techniek',
  bewijs: ['test/invoerproef.test.js'],
  bewijsstuk: 'INVOERPROEF.json -- per route hoeveel rommel erheen ging en wat eruit kwam',
  dekking: { register: 'INVOERPROEF.json', beproefd: 'gemeten.bereikt',
    totaal: 'gemeten.routesMetRol', eenheid: 'routes waar rommel voorbij de poort kwam',
    tellers: { breuken: 'gemeten.breuken', sporen: 'gemeten.sporen',
      achterEenPoort: 'gemeten.achterEenPoort', blindeRondes: 'gemeten.blindeRondes',
      tokensHernieuwd: 'gemeten.tokensHernieuwd' } },
  grens: 'meet twee foutklassen op routes met een herkenbare rol: omvallen op rommel (5xx of geen ' +
    'antwoord) en een antwoord dat interne details meegeeft. Hij zegt NIETS over of de validatie ' +
    'het juiste heeft geweigerd -- een route die alles slikt en 200 teruggeeft telt hier als dicht. ' +
    'Routes achter een tweede grendel (KYC, onboarding) staan als ongemeten met reden.'
};

module.exports = { draaiInvoerproef, weegInvoer, sporenIn, SPOORMERKERS, CONTROL };

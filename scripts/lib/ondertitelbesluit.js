/* ============================================================================
   HET ONDERTITELBESLUIT -- de meting achter keuringsregel 49.

   scripts/check.js regel 49 eist dat elk <video>- en <audio>-element in dit huis
   een besluit over ondertiteling draagt, met een soort en een reden; de kop van
   die regel legt uit waarom het een REGISTER is en geen "elke video een
   track"-poort. De meting stond inline in check.js, en dat was goed zolang
   alleen check.js haar las.

   WAAROM ZE HIER STAAT. Het aantal OPEN elementen is een ratel (hij mag alleen
   omlaag), en die ratel stond als constante OPEN_MAX in check.js -- buiten
   NORM.json, dus buiten het slot van scripts/normbasis.js. Sinds 6 oktober 2026
   is hij de meter `mediaOndertitelOpen` in NORM.json, en dan moet
   scripts/norm.js hetzelfde getal kunnen tellen als check.js. Een tweede kopie
   van deze telling in norm.js zou de eerste zijn die uit de pas loopt (LAT.md
   regel 4); dus staat de telling hier, EEN keer, en lezen beide haar.

   Wat hier NIET staat: het oordeel. Of het aantal open elementen te hoog is,
   zegt check.js (tegen NORM.json) en norm.js (tegen dezelfde waarde). Deze
   module telt en klaagt alleen over het register zelf.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./bron');
const { bundels: BUNDELLIJST } = require('../bundel');

/* Dezelfde twee hulpjes als bovenin scripts/check.js. Ze staan hier opnieuw en
   niet geimporteerd, omdat check.js geen module is (hij keurt bij het laden).
   De overslaglijst matcht op de HELE mapnaam -- zie de uitleg bij loop() in
   check.js voor waarom een deelstring daar vier mappen productcode miste. */
const kaalBron = (f) => zonderCommentaar(fs.readFileSync(f, 'utf8'),
  { soort: f.endsWith('.html') ? 'html' : f.endsWith('.css') ? 'css' : 'js' });

function loop(dir, filter, fn) {
  for (const naam of fs.readdirSync(dir)) {
    const vol = path.join(dir, naam);
    let st;
    try { st = fs.statSync(vol); }
    catch (e) { if (e && e.code === 'ENOENT') continue; throw e; }
    if (st.isDirectory()) { if (!/^(node_modules|\.git|data|dist)$/.test(naam)) loop(vol, filter, fn); }
    else if (filter.test(naam)) fn(vol);
  }
}

/* De soorten. `open` betekent: hier hoort iets en het is er niet. `stil` en
   `anker` zijn de twee dingen die machinaal na te kijken zijn. */
const SOORTEN = {
  spiegel:     { open: false, stil: true },   // je eigen beeld, zichtbaar, zonder geluid
  werktuig:    { open: false, stil: true },   // beeld als invoer of rekenmiddel
  ondertiteld: { open: false, anker: true },  // opgenomen inhoud MET een weg naar tekst
  muziek:      { open: false },               // muziekspoor, met zichtbare titel; geen gesproken programma
  /* LIVE, TWEERICHTING. Draagt altijd een tekstbaan waarin deelnemers
     meeschrijven (`baan`). Draagt hij DAARNAAST een spraakanker, dan is er ook
     automatische ondertiteling en telt hij niet meer als open -- zie `SPRAAK`
     hieronder voor wat dat anker moet bewijzen. */
  gesprek:     { open: true, baan: true },    // live, tweerichting -- MOET een tekstbaan dragen
  uitzending:  { open: true },                // live, eenrichting
  onbedekt:    { open: true }                 // opgenomen inhoud ZONDER weg naar tekst
};
/* De band woonde als private functie IN de clipdeler; sinds het Theater en de
   Media OS dezelfde cue-lijst tonen staat hij als gedeelde laag in
   shared/ondertitelband.js. Deze regel merkte die verhuizing zelf op: het
   oude anker (toonOndertitels in clipdeler-01.js) viel weg en twee elementen
   zakten. Dat is precies waar een anker voor is. */
const CLIPBAND = ['public/shared/ondertitelband.js', 'RTGOndertitelband'];
/* HET SPRAAKANKER. Een vierde veld op een gespreksregel: het bestand waarin
   DIT scherm de luisteraar aansluit, en de naam die daar moet staan. Een
   gedeelde constante zou hier niet werken -- die zou het bestand tegen
   zichzelf houden en altijd slagen; het punt is juist dat elk SCHERM hem
   aanroept. Haalt iemand die aansluiting weg, dan telt dat gesprek weer als
   open en zakt de ratel.

   Twee dingen worden er BOVENDIEN nagekeken, en die staan er omdat de
   voorziening aan een ingerichte modelserver hangt en dus stil kan wegvallen:
   de gedeelde luisteraar moet bestaan, en de baan moet de UITLEG dragen voor
   het geval hij niet kan. Een ondertitelknop die niets doet is erger dan geen
   knop -- die laat iemand aan een gesprek beginnen in de veronderstelling dat
   hij het kan volgen. */
/* HET ANKER WIJST NAAR DE PAGINA DIE DE MODULE LAADT, en niet naar het
   bestand dat de naam noemt. Dat verschil is hier echt gebleken: het
   meelees-anker keek of de AANROEPER `RTGMeelezen` noemt, en dat deed
   teamcall-01.js keurig -- terwijl personeel.html en leverancier.html
   `/shared/meelezen.js` nergens laadden. `if (w.RTGMeelezen)` was daar dus
   altijd onwaar en de tekstbaan verscheen stil niet, met een register dat hem
   wel claimde. Een anker op een aanroep bewijst een intentie; een anker op de
   scripttag bewijst dat het er staat. */
const SPRAAKMODULE = 'public/shared/meeluister.js';
/* De uitleg-voor-als-het-niet-kan woont bij de KNOP en niet bij de baan, want
   hij zegt iets over deze voorziening. Deze regel merkte die verhuizing zelf
   op toen de knop van meelezen.js naar meeluister.js ging -- precies waarvoor
   een anker bestaat. */
const SPRAAKEERLIJK = ['public/shared/meeluister.js', 'meelees-geenauto'];
const REGISTER = new Map([
  ['public/shared/connection-communication-view.js#1', ['ondertiteld', 'een spraakbericht wordt uitsluitend geplaatst met het zichtbare, door de afzender geschreven transcript er direct naast', ['public/shared/connection-communication-view.js', 'connection-transcript']]],
  ['public/shared/connection-communication-view.js#2', ['gesprek', 'het beeld en geluid van de andere deelnemer in een besloten Connection-gesprek, met dezelfde meelees- en lokale ondertitelbaan', ['public/shared/connection-communication.js', 'RTGMeelezen'], ['public/apps/vonk.html', 'meeluister.js']]],
  ['public/shared/connection-communication-view.js#3', ['spiegel', 'het eigen stille beeld in de hoek van een besloten Connection-gesprek']],
  ['public/apps/app.html#csRemote', ['gesprek', 'het beeld en geluid van de ander in een videogesprek tussen twee leden', ['public/apps/app-main.js', 'RTGMeelezen'], ['public/apps/app.html', 'meeluister.js']]],
  ['public/apps/app.html#csLocal', ['spiegel', 'je eigen beeld in de hoek van dat gesprek; stil, want jezelf terughoren is een echo']],
  ['public/apps/backoffice.html#ontLiveVid', ['uitzending', 'SOS: het kantoor kijkt live mee met de camera van een lid, met geluid erbij. Er loopt WEL een tekstbaan mee (#ontLiveTekst): het toestel van het lid zet zijn eigen stem om naar tekst en stuurt de regels langs hetzelfde seinkanaal, zonder tweede tik -- de toestemming voor beeld en geluid staat al in het veiligheidscontract. Blijft OPEN: het hangt aan een browser die de Web Speech API heeft, en dat is geen ondertiteling waar je op kunt rekenen', ['public/apps/backoffice.js', 'ontLiveTekst']]],
  ['public/apps/camera.html#beeld', ['spiegel', 'de camera-app: je eigen beeld om een foto te maken, zonder geluid']],
  ['public/apps/clips.html#studioDoek', ['spiegel', 'het opnamedoek van de clipstudio: je eigen beeld voordat de opname loopt']],
  ['public/apps/clips.html#js1', ['ondertiteld', 'de clip in de feed; de gedeelde clipdeler zet de ondertitelband van de maker eroverheen', CLIPBAND]],
  ['public/apps/clips.html#js2', ['werktuig', 'een onzichtbaar element dat het eerste frame als affiche uitleest']],
  /* BELLEN MET RTG (SERVICE.md par. 13): binnen de app, dus zonder telefoonnet.
     Beide kanten dragen dezelfde meeleesbaan uit shared/meelezen.js -- een
     live gesprek zonder weg naar tekst sluit een dove deelnemer uit, en dat
     geldt bij een HULPlijn het hardst: wie niet kan bellen, houdt dan geen
     kanaal over waar de anderen er wel een bij kregen. */
  ['public/apps/service-bel.js#vExtern', ['gesprek', 'bellen met RTG Service: het beeld en geluid van de medewerker', ['public/apps/service-bel.js', 'RTGMeelezen'], ['public/apps/service-bel.html', 'meeluister.js']]],
  ['public/apps/service-bel.js#vLokaal', ['spiegel', 'je eigen beeld tijdens dat gesprek; stil, want jezelf terughoren is een echo']],
  ['public/apps/service.html#bExtern', ['gesprek', 'de cockpit neemt op: het beeld en geluid van de beller', ['public/apps/service.html', 'RTGMeelezen'], ['public/apps/service.html', 'meeluister.js']]],
  ['public/apps/service.html#bLokaal', ['spiegel', 'het eigen beeld van de medewerker in dat gesprek']],
  ['public/apps/foundation/gezin-rt/gezin-rt-03.js#grt-remote', ['gesprek', 'het gezinsgesprek van RTFoundation: het beeld van de ander', ['public/apps/foundation/gezin-rt.js', 'RTGMeelezen'], ['public/apps/foundation/contact.html', 'meeluister.js']]],
  ['public/apps/foundation/gezin-rt/gezin-rt-03.js#grt-local', ['spiegel', 'je eigen beeld in dat gezinsgesprek']],
  ['public/apps/foundation/vrienden.html#belRemote', ['gesprek', 'bellen met een vriend: het beeld van de ander', ['public/apps/foundation/vrienden.html', 'RTGMeelezen'], ['public/apps/foundation/vrienden.html', 'meeluister.js']]],
  ['public/apps/foundation/vrienden.html#belLocal', ['spiegel', 'je eigen beeld tijdens dat bellen']],
  ['public/apps/geld/rtgcodeb.js#rcCam', ['werktuig', 'de camera leest een RTG-code; shared/media.js vraagt bij een camera nooit geluid']],
  ['public/apps/media.html#film', ['ondertiteld', 'een opgenomen film uit het Theater; de kaart uit kern/mediaos draagt de cue-lijst mee en de gedeelde band toont hem', ['server/kern/mediaos/catalogus.js', 'ondertitels']]],
  ['public/apps/media.html#clipfilm', ['ondertiteld', 'een clip speelt hier via dezelfde clipdeler, met dezelfde ondertitelband', CLIPBAND]],
  ['public/apps/media.html#proVideo', ['ondertiteld', 'de lokale bronvideo van Studio Pro; handmatige tijdregels of het lokale spraakmodel worden als ondertitel in de gerenderde master ingebakken', ['public/apps/media/studio-pro-engine.js', 'cueOp']]],
  ['public/apps/media.html#proMuziek', ['muziek', 'de optionele lokale muzieklaag van Studio Pro; de maker kiest het bestand en ziet naam, mixsterkte en rechtenwaarschuwing in de werkbank']],
  ['public/apps/muziek.html#eigenAudio', ['muziek', 'een door een lid gedeeld muzieknummer; dit vak accepteert uitsluitend muziekformaten en toont titel, maker, speelstand en voortgang als zichtbare bediening, niet een gesproken programma zonder tekstweg']],
  ['public/apps/meet/kamer.js#1', ['gesprek', 'de vergaderkamer: een tegel per deelnemer, en de eigen tegel krijgt muted', ['public/apps/meet/kamer.js', 'RTGMeelezen'], ['public/apps/meet.html', 'meeluister.js']]],
  ['public/apps/memo/app.js#1', ['ondertiteld', 'een eigen spraakmemo; het toestel maakt er een transcript bij dat in de lijst staat en samen te vatten is', ['public/apps/memo/app.js', 'transcript']]],
  ['public/apps/oog.html#cam', ['werktuig', 'het oog schouwt een voertuig of werkvloer: beeldanalyse, geen geluid']],
  ['public/apps/saloon/kaart.js#js1', ['ondertiteld', 'Saloon speelt dezelfde video met de cue-lijst van de bron en de gedeelde ondertitelband', ['public/apps/saloon/kaart.js', 'RTGOndertitelband.zet']]],
  ['public/apps/salon.html#1', ['ondertiteld', 'een korte video in de Salon-feed; de maker maakt lokale automatische of handmatige tijdregels vóór plaatsing en de speler toont dezelfde cue-lijst', ['public/apps/salon.html', 'zetSalonOndertitels']]],
  ['public/apps/salon.html#2', ['spiegel', 'het stille voorbeeld van de eigen gekozen video voordat het lid de Salon-post plaatst']],
  ['public/apps/salon.html#3', ['werktuig', 'een stille videominiatuur in het profielraster die alleen als ingang naar de volledige post dient']],
  ['public/apps/podium.html#kijkVideo', ['uitzending', 'een live uitzending van het Podium; srcObject is er altijd een stroom, nooit een bestand. Er loopt WEL een tekstbaan mee: de kanaalchat (#chatKijk, aria-live), waarin de uitzender meeschrijft of zijn eigen spraak laat omzetten met de knop Live tekst (#studioSpraak) -- geen ondertiteling waar je op kunt rekenen, wel een weg naar tekst', ['public/apps/podium.html', 'studioSpraak']]],
  ['public/apps/podium.html#studioVideo', ['spiegel', 'het eigen beeld van de uitzender, voor en tijdens het uitzenden']],
  ['public/apps/scanner.html#beeld', ['werktuig', 'de documentscanner leest papier: beeld als invoer']],
  ['public/apps/theater.html#doekVideo', ['ondertiteld', 'de bioscoop van het Theater: de maker schrijft de ondertitels bij zijn eigen video, en de kijker krijgt ze mee met de zaal', ['server/kern/theater/video.js', 'videoOndertitels']]],
  ['public/apps/theater.html#vVoorbeeld', ['spiegel', 'de voorvertoning van je eigen upload, stil, voordat je hem publiceert']],
  ['public/apps/theater.html#js1', ['werktuig', 'een onzichtbaar element dat het eerste frame als affiche uitleest']],
  ['public/shared/paspoortscan.js#pscanVid', ['werktuig', 'de paspoortscan leest de MRZ-regels van een document']],
  ['public/shared/scanknop.js#js1', ['werktuig', 'de gedeelde scanknop: hetzelfde leesinstrument, in een eigen venster']],
  ['public/shared/scanner.js#js1', ['werktuig', 'het reserve-element van de scanner zelf, als de aanroeper er geen meegeeft']],
  ['public/shared/schoolbel.js#sbelAudio', ['gesprek', 'het schoolgesprek is een live audiogesprek: wie opneemt hoort de ander rechtstreeks', ['public/shared/schoolbel.js', 'RTGMeelezen']]],
  ['public/shared/teamcall/teamcall-01.js#1', ['spiegel', 'de teamcall van het personeel: je eigen tegel, stil, want je eigen stem terughoren is een echo']],
  ['public/shared/teamcall/teamcall-01.js#2', ['gesprek', 'de teamcall van het personeel: de tegel van een collega, met diens stem erbij', ['public/shared/teamcall/teamcall-01.js', 'RTGMeelezen']]]
]);


/* De telling. Geeft de gevonden elementen, de klachten over het register zelf,
   en wat er OPEN staat. De ratel op dat laatste getal staat NIET hier. */
function meet(ROOT) {
  const bundelPaden = new Set(Object.keys(BUNDELLIJST).map(k => 'public/' + k));
  const gevonden = new Map();
  loop(path.join(ROOT, 'public'), /\.(html|js)$/, (f) => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (bundelPaden.has(rel)) return;
    const bron = kaalBron(f);
    let m, n = 0, jsN = 0;
    const tag = /<(video|audio)(\s[^>]*)?>/gi;
    while ((m = tag.exec(bron))) {
      n++;
      const id = (String(m[2] || '').match(/\bid=["']?([A-Za-z0-9_-]+)/) || [])[1];
      gevonden.set(rel + '#' + (id || n), { stil: /\bmuted\b/.test(m[0]) });
    }
    /* In JS gemaakte elementen. `muted` staat daar niet in de tag maar in de
       regels eronder, dus kijken we in een venster van 300 tekens erna. */
    const inJs = /(?:createElement\(\s*["'](video|audio)["']\s*\)|new\s+Audio\s*\()/g;
    while ((m = inJs.exec(bron))) {
      jsN++;
      const venster = bron.slice(m.index, m.index + 300);
      gevonden.set(rel + '#js' + jsN, { stil: /\bmuted\b/.test(venster) });
    }
  });

  const klachten = [];
  for (const [sleutel, el] of gevonden) {
    const post = REGISTER.get(sleutel);
    if (!post) {
      klachten.push(sleutel + ' is een media-element zonder besluit -- zet hem in REGISTER in scripts/lib/ondertitelbesluit.js met een soort en een reden (check.js regel 49)');
      continue;
    }
    const soort = SOORTEN[post[0]];
    if (!soort) { klachten.push(sleutel + ' staat als soort "' + post[0] + '", en die soort bestaat niet'); continue; }
    if (!post[1] || post[1].length < 25) klachten.push(sleutel + ' heeft geen reden die iets zegt');
    if (soort.stil && !el.stil) {
      klachten.push(sleutel + ' staat als ' + post[0] + ' (stil) maar is niet meer muted -- of er komt geluid uit, of de reden klopt niet meer');
    }
    if (soort.anker || soort.baan) {
      /* Twee ankers met dezelfde tand. Bij ONDERTITELD wijst hij naar de band
         die de cues toont; bij een GESPREK naar de tekstbaan waarin deelnemers
         meeschrijven (shared/meelezen.js). In allebei de gevallen geldt: wie
         zegt dat er een weg naar tekst is, noemt WAAR -- en haalt iemand die
         weg, dan zakt deze regel ook al is aan het scherm zelf niets veranderd. */
      const wat = soort.baan ? 'draagt een tekstbaan' : 'staat als ondertiteld';
      const [bestand, naam] = post[2] || [];
      if (!bestand || !naam) klachten.push(sleutel + ' ' + wat + ' maar noemt niet waar dat geregeld is');
      else if (!fs.existsSync(path.join(ROOT, bestand))) klachten.push(sleutel + ': het anker ' + bestand + ' bestaat niet meer');
      else if (!fs.readFileSync(path.join(ROOT, bestand), 'utf8').includes(naam)) {
        klachten.push(sleutel + ': ' + bestand + ' draagt "' + naam + '" niet meer -- de weg naar tekst is eruit gehaald');
      }
    }
  }
  /* DE TWEE GEDEELDE DELEN WAAR ELK SPRAAKANKER OP LEUNT. Ze staan hier en niet
     per element: een aansluiting per scherm zonder de gedeelde luisteraar is een
     aanroep in het niets, en zonder de eerlijke uitleg in de baan is de knop bij
     een huis zonder modelserver een lege belofte. Zakt een van beide, dan zakt
     hij voor alle acht tegelijk -- en dat is juist wat je wilt weten. */
  if ([...gevonden.keys()].some(k => (REGISTER.get(k) || [])[3])) {
    if (!fs.existsSync(path.join(ROOT, SPRAAKMODULE))) {
      klachten.push('check.js regel 49: ' + SPRAAKMODULE + ' is weg, maar er zijn gesprekken die zeggen dat zij automatisch ondertitelen');
    }
    const [eb, en] = SPRAAKEERLIJK;
    if (!fs.existsSync(path.join(ROOT, eb)) || !fs.readFileSync(path.join(ROOT, eb), 'utf8').includes(en)) {
      klachten.push('check.js regel 49: ' + eb + ' draagt "' + en + '" niet meer -- een huis zonder spraakmodel krijgt dan een knop zonder uitleg');
    }
  }

  /* Een register dat namen bevat die niet meer bestaan, groeit stil vol en leest
     als dekking die er niet is -- dezelfde controle als bij regel 28 en 47. */
  for (const sleutel of REGISTER.keys()) {
    if (!gevonden.has(sleutel)) klachten.push('check.js regel 49: ' + sleutel + ' staat in het register maar bestaat niet (meer) als media-element');
  }

  /* WAT ER OPEN STAAT. Een `gesprek` met een geldig SPRAAKANKER heeft een
     automatische weg naar tekst en telt niet mee -- dat is precies de schuld die
     de ratelnotitie bij keuringsregel 49 in scripts/check.js beschrijft. Een anker dat NIET klopt telt wel mee,
     en dan gaat het getal omhoog en zakt de ratel: dat is de bedoeling, want dan
     is de weg eruit gehaald zonder dat iemand het zei. */
  const spraakOk = (k) => {
    const a = (REGISTER.get(k) || [])[3];
    if (!a) return false;
    const [bestand, naam] = a;
    if (!bestand || !naam) return false;
    const pad = path.join(ROOT, bestand);
    return fs.existsSync(pad) && fs.readFileSync(pad, 'utf8').includes(naam);
  };
  const open = [...gevonden.keys()].filter(k => REGISTER.has(k) &&
    (SOORTEN[REGISTER.get(k)[0]] || {}).open && !spraakOk(k));

  /* DE TELLING VOLGT DE UITKOMST EN NIET DE TABEL. Zolang een gesprek open
     stond, was "8 gesprek" hetzelfde getal als "8 open". Sinds een gesprek met
     een spraakanker niet meer open telt, zijn dat twee verschillende dingen --
     en een regel die de tabel opsomt naast een getal dat de uitkomst telt,
     leest als onzin ("9 van die 2"). Hier wordt dus geteld wat er werkelijk
     uit `spraakOk` komt. */
  const perUitkomst = {};
  for (const k of gevonden.keys()) {
    /* Een element zonder besluit staat al als klacht hierboven. In check.js
       draaide deze telling alleen als er geen klachten waren; hier draait hij
       altijd, dus slaat hij zo'n element over in plaats van op `undefined[0]`
       om te vallen -- een meting die bij een klacht omvalt, telt niets. */
    if (!REGISTER.has(k)) continue;
    const soort = REGISTER.get(k)[0];
    const s = (SOORTEN[soort] || {}).open && spraakOk(k) ? 'gesprek met ondertiteling' : soort;
    perUitkomst[s] = (perUitkomst[s] || 0) + 1;
  }
  /* Wat er WEL is, telt apart en wordt nooit met "geregeld" op een hoop
     gegooid. Meelezen is GEEN ondertiteling: daar zet niemand spraak om, en
     dat een deelnemer MEETYPT is een andere belofte dan dat het gesprek
     ondertiteld wordt. */
  const metBaan = [...gevonden.keys()].filter(k => REGISTER.has(k) &&
    ((SOORTEN[REGISTER.get(k)[0]] || {}).baan || ((SOORTEN[REGISTER.get(k)[0]] || {}).open && (REGISTER.get(k)[2] || []).length)));
  const metSpraak = [...gevonden.keys()].filter(spraakOk);
  return { gevonden, klachten, open, spraakOk, perUitkomst, metBaan, metSpraak };
}

module.exports = { meet, SOORTEN, REGISTER, SPRAAKMODULE, SPRAAKEERLIJK, CLIPBAND };

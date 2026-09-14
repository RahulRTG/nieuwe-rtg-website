#!/usr/bin/env node
/* ============================================================================
   DE IDEMPOTENTIE, PER ROUTE -- de IDEMPOTENCY-kolom van de bewijsmatrix.

   Het oordeel staat in scripts/lib/idemproef.js (en is daar los te toetsen);
   dit script zet er een echte server omheen en schrijft IDEMPROEF.json.

   Derde in dezelfde familie: rolproef (verkeerde rol, plausibele invoer),
   invoerproef (juiste rol, rommel), idemproef (juiste rol, plausibele invoer,
   drie keer). Ze delen de wegwerpserver, de demo-tokens en het plausibele lijf,
   want drie definities van "plausibel" is drie plekken die uiteenlopen.

   DEZE PROEF MUTEERT ECHT, en meer dan de andere twee: hij voert per route
   twee opdrachten uit die kunnen slagen. Dat is de prijs van meten of een
   herhaling iets doet -- en de reden dat hij nooit ergens anders dan op een
   wegwerpmap draait.

   Draai:  node scripts/idemproef-route.js
           node scripts/idemproef-route.js --max=200
           node scripts/idemproef-route.js --pad=office/bank/rekening   (PEILING: schrijft niets)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');
const { draaiIdemproef } = require('./lib/idemproef');
const { plausibelLijf } = require('./lib/rolproef');
const { alleRoutes, isSchakel, verdeelOpRol, meldZonderRol } = require('./lib/routes');
const { haalSleutels, meldSleutels, BASISROLLEN, PASLADDER } = require('./lib/proefsleutels');
/* Wanneer is dit gemeten, en waartegen. Zonder stempel is een register niet na
   te lopen: verouderd ziet er identiek uit aan vers. Zie scripts/lib/stempel.js. */
const { stempel, eisSchoneBoom } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'IDEMPROEF.json');
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;   // 0 = alles

/* `--pad=<stuk>` MEET EEN HANDVOL ROUTES EN SCHRIJFT NIETS -- een PEILING en
   geen ronde.

   WAAROM DIT ER IS. De effect-as van `npm run kantoormacht` leest de `opslag` van
   dit register en is BLIND voor twaalf van de veertien zware kantoorroutes: de
   proef krijgt ze niet aan het werk omdat ze een wereld vragen (een rekening, een
   kredietaanvraag, een salarisvoorstel). Wie daar een lijf aan toevoegt in
   ./lib/idemwereld.js, wil weten of die ene route nu werk doet -- en het
   instrument kende alleen alles-of-niets. Een volle ronde raakt vijfduizend
   routes, dus dan wordt zo'n verbetering nooit nagetrokken.

   HIJ IS AANWIJSBAAR EN NIET SNEL, en dat verschil hoort erbij. De filter
   versmalt de MEETLUS, niet de opstelling: `zetWereldKlaar` bouwt nog steeds de
   hele wereld (leden, rekeningen, zaken, een school), en dat kostte op 13
   september meer dan negen en een halve minuut -- een peiling op twee routes werd
   door een tijdgrens van 580 seconden afgekapt voordat de lus begon. Wie alleen
   wil weten of een LIJF klopt, is met een eigen opstelling van dertig regels
   sneller klaar; deze vlag is er om de PROEF op een route te kunnen aanwijzen.

   EN WAAROM HIJ WEIGERT TE SCHRIJVEN. Een gefilterde ronde die het register
   overschrijft, zet 4912 gemeten routes terug naar twee -- en dat ziet er daarna
   volkomen normaal uit. Dat is niet theoretisch: de kop hierboven beschrijft
   precies zo'n geval bij ROLPROEF.json (3377 naar 292), en op 13 september is in
   scripts/mutatiecontract.js een register gevonden dat over een oudere
   werkelijkheid rapporteerde. Dezelfde fout, twee instrumenten. Een peiling is
   dus een peiling: hij meet, hij vertelt, en hij laat het register staan. */
const PAD = (argv.find(a => a.startsWith('--pad=')) || '').slice(6);

/* rolVan() woont in ./lib/routes.js, samen met de REDEN waarom een rol soms niet
   te bepalen valt. Hij stond hier woordelijk, en in drie andere proef-scripts nog
   eens -- vier kopieen van dezelfde afleiding (LAT.md regel 4). */


/* ALLEEN DOEN ALS IEMAND DIT BESTAND DRAAIT. Zonder deze wacht start een
   VOLLEDIGE meetronde zodra iets dit bestand require't -- een toets, de keuring,
   of iemand die alleen even wil kijken of het laadt. Dat is hier echt gebeurd:
   een onschuldige laadcontrole draaide de rolproef met de STANDAARDbegrenzing en
   schreef ROLPROEF.json van 3377 beproefde routes terug naar 292. Het register
   zag er daarna volkomen normaal uit.

   scripts/bewijsmatrix.js heeft deze wacht al sinds hij ooit de hele testrunner
   meenam. Dezelfde wacht hoort op elk instrument dat bij het draaien een register
   OVERSCHRIJFT. */
if (require.main !== module) { module.exports = {}; return; }


/* WEIGEREN VOOR HET BEGINT. Deze ronde duurt minuten en levert een register op
   dat NERGENS meetelt zodra er ongecommit werk in de boom staat -- boomVuil
   wordt pas aan het eind vastgesteld. Zelfde poort als de drie andere proeven
   uit deze familie (rolproef, handelingproef, uitvoerproef); hij ontbrak hier,
   en test/schoneboom.test.js vraagt met zoveel woorden om alle zes. */
function wachtOpSchoneBoom() {
  const b = eisSchoneBoom('de idempotentieproef');
  if (b.ok) return;
  console.error('\n  DEZE RONDE ZOU NIET MEETELLEN\n');
  console.error('  ' + b.reden);
  for (const r of (b.bestanden || [])) console.error('    ' + r);
  process.exit(3);
}

(async () => {
  wachtOpSchoneBoom();
  /* DE GEDEELDE WEGWERPSERVER. Hier stond de eigen kopie die de kop al een
     maand ontkende ('ze delen de wegwerpserver') -- de tekst beloofde wat de
     code niet deed, en zo lopen kopieen uiteen zonder dat iemand het ziet
     (LAT.md regel 4 en 6, en de post wegwerpserver-kopieen in
     BEWIJSSCHULD.json). */
  /* RTG_MAGNAAT_TEST=1 EN NIET ALLEEN RTG_DEMO=1.

     server/testomgeving.js: RTG_DEMO telt uitsluitend binnen NODE_ENV=test, en
     die zet dit script niet. De proef hing dus aan een omgevingsvariabele van de
     OPERATOR: wie hem toevallig had, kreeg tokens; wie hem niet had, kreeg
     exit(2) op "geen token voor member, office, supplier". RTG_MAGNAAT_TEST is
     de expliciete, gedocumenteerde vlag voor synthetische data en staat niet in
     productie -- de opstelling zegt nu zelf wat ze nodig heeft. */
  /* RTG_DOOS_SLEUTEL hoort bij de OPSTELLING, net als OFFICE_CODE: zonder die
     variabele bestaat de doosdeur helemaal niet, ook niet in productie
     (server/routes/doos.js). Hem hier zetten opent geen deur die anders dicht
     zou zijn -- het maakt de opstelling compleet. */
  const DOOS_SLEUTEL = 'proef-doos-sleutel-0123456789abcdef';
  const server = await start({ naam: 'idemproef',
    env: { RTG_DEMO: '1', RTG_MAGNAAT_TEST: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF',
      RTG_DOOS_SLEUTEL: DOOS_SLEUTEL,
      /* Het TWEEDE meetpunt (de opslag) hing aan dezelfde toevalligheid: zonder
         RTG_STAATLOG draagt geen antwoord een X-RTG-Staat-kop en meet de proef
         alleen wat de route terugzegt -- stiller, en een stuk zwakker. Stand 2,
         want alleen die ziet ook een wijziging OP ZIJN PLAATS (gelijke lengte,
         andere inhoud). Zie server/staatlog.js. */
      RTG_STAATLOG: '2',
      /* DE TIKKERS STILZETTEN, en dat is een MEETbesluit en geen productiewijziging.

         WAT ER GEBEURT. server/kern/bank/index.js draait elke ZESTIG SECONDEN de
         opdrachtenronde, fire-and-forget: `opdrachten.ronde({}).catch(...)`. Die dient
         betaalopdrachten opnieuw in bij de rail, en `railInzenden` in server/server.js
         meldt daarbij de stand van `money.payout` aan kern/commercie/capgezondheid.js.
         Dat schrijft dus BUITEN elk verzoek om, en deze proef rekent zijn verschil
         tussen twee oproepen -- dus belandt dat werk in de delta van de route die op dat
         moment aan de beurt is. Een uurtik erboven (`BANK_RONDE_MS`: rente en vervallen
         vaste betalingen) doet hetzelfde, minder vaak.

         GEMETEN en niet vermoed: 23 routes droegen `betaalOpdrachten` en 24
         `capGezondheid`, waaronder /api/command/puls, /api/ontmoeten/aan en
         /api/zorgprofiel/zet. Geen daarvan betaalt iets uit. De afstanden tussen die
         routes in de meetvolgorde (108 tot 464 routes bij ~0,4 s per route) passen bij
         een tikker van een minuut en bij niets anders.

         EN HIER STOND EERST DE VERKEERDE TIKKER, wat deze regel zelf illustreert. Ik
         wees de onderhoudsronde van vijf minuten aan (server/opzet/start.js, met
         `betaalWaarheid.ronde()` erin) en zette daar een variabele op. De ronde daarna
         ging van 14 naar 23 routes: de meting sprak de verklaring tegen. `betaalWaarheid`
         is een ANDER register (`terugbetaalOpdrachten`), en de tikker die het wel doet
         had zijn knop al. Een plausibele oorzaak is geen gemeten oorzaak.

         WAAROM NIET IN DE RUISLIJST. Een stille server van 5,5 minuut schrijft
         {"kosten":1,"wacht":6,"techniek":3,"ledenSites":2,"veilig":1,"rtgai":9}. Die zes
         in de ruis zetten zou `ledenSites` wegvangen bij /api/site/bewaar, dat hem ZELF
         schrijft -- een zeef die een echt effect onzichtbaar maakt is erger dan de fout
         die zij opruimt. Vandaar: de bron stilzetten in plaats van het gevolg filteren.
         Diezelfde stille ronde is met en zonder deze variabelen woordelijk gelijk, dus
         die zes komen van andere tikkers en staan hier als `tikkersNogAan`.

         DE COMMERCIERONDE staat er als DERDE bij zonder eigen bewijs: zijn knop bestond
         al en hij tikt op dezelfde manier, maar geen enkele collectie is aan hem
         toegerekend. Dat staat er liever bij dan dat het als gemeten bewijs meelift. */
      BANK_OPDRACHT_RONDE_MS: String(24 * 60 * 60 * 1000),
      BANK_RONDE_MS: String(24 * 60 * 60 * 1000),
      RTG_COMMERCIE_RONDE_MS: String(24 * 60 * 60 * 1000) } });
  const { basis, klaar } = server;

  /* `extraKoppen` is er voor deuren die hun sleutel in een KOP verwachten en niet
     in het lijf -- de zaakdoos is de enige. Zonder dit vierde argument stuurde
     deze proef de doossleutel nooit mee: de bouwer in ./lib/lijfsleutels.js gaf
     hem netjes door, hij viel hier op de grond, de route weigerde, en de familie
     meldde zich als 'geen sleutel gekregen'. Vier routes stonden zo als
     ongemeten terwijl de sleutel klopte. */
  const post = async (pad, lijf, tok, extraKoppen) => {
    try {
      const r = await fetch(basis + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json',
          ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(extraKoppen || {}) },
        body: JSON.stringify(lijf || {}) });
      const tekst = await r.text();
      let data; try { data = JSON.parse(tekst); } catch (e) { data = tekst; }
      /* HET DERDE MEETPUNT (server/effectmeter.js). De opslagmeter kijkt naar de
         COLLECTIES; deze zegt of er uberhaupt iets gebeurde -- een schrijfpoging,
         een mail, een sms. Dat is precies wat NOT_APPLICABLE nodig heeft: "geen
         spoor in de collecties" is uit een meter die alleen collecties ziet een
         gevolgtrekking uit AFWEZIG bewijs. `nietGemeten` gaat mee, want wat deze
         meter niet ziet hoort naast zijn uitslag te staan en niet erbuiten. */
      return { status: r.status, data, staat: r.headers.get('x-rtg-staat'),
        effect: r.headers.get('x-rtg-effect'),
        effectNietGemeten: r.headers.get('x-rtg-effect-niet-gemeten') };
    } catch (e) { return { status: 0, data: String(e.message) }; }
  };

  /* De sleutelbos staat in ./lib/proefsleutels.js -- zeven rollen op een plek.
     Hij stond hier woordelijk, en in vijf andere instrumenten nog eens; die zes
     kopieen kenden alleen member/office/supplier, en daardoor bleven 111 routes
     met een eigenrol (boardroom, techniek, werkplekbaas, scim) ongemeten. */
  const bos = await haalSleutels({ post });
  const { tokens, tokenVoor, hernieuw } = bos;
  const basisMist = BASISROLLEN.filter(r => !tokens[r]);
  if (basisMist.length) {
    console.error('geen token voor: ' + basisMist.join(', ') + ' -- de proef zou dan doen alsof die routes zijn beproefd');
    klaar(); process.exit(2);
  }

  const kandidaten = alleRoutes()
    .filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET')
    .filter(r => !isSchakel(r.pad))
    .filter(r => !r.pad.includes(':'));
  /* De verdeling in plaats van een filter. `.filter(r => r.rol)` liet hier
     honderden routes verdwijnen zonder dat er ergens een getal omhoog ging; nu
     komen ze met hun reden terug en staan ze straks ook in het uitslagbestand. */
  /* ALLEEN ROLLEN WAARVOOR DIT INSTRUMENT EEN TOKEN HEEFT. Sinds de
     bewakerskaart ook eigenrollen kent (boardroom, techniek, scim,
     werkplekbaas) kwamen 123 routes hier binnen als "met rol" terwijl er
     geen sleutel voor bestaat: de idemproef herhaalt een oproep MET de juiste rol; zonder token voor die rol
     wordt elke herhaling even hard geweigerd en zegt de gelijkheid niets.
     Ze komen nu met die reden terug in het uitslagbestand (LAT.md regel 3). */
  const verdeling = verdeelOpRol(kandidaten, bos.rollen);

  /* ============================================================================
     DE IDEMPROEF KRUIST GEEN ROLLEN -- HIJ HEEFT TOEGANG NODIG.

     Hier zat een denkfout die 840 routes buiten elke uitslag hield. De vier
     proeven delen deze verdeling, maar ze vragen er niet hetzelfde van:

       rolproef   klopt aan met de VERKEERDE rol en eist dat de deur dichtblijft.
                  Zonder rol is er niets te kruisen -- daar is 'geen rol' terecht
                  het einde van de meting.
       idemproef  klopt aan met de JUISTE sleutel en herhaalt. Wat hij nodig heeft
                  is dat de oproep WERK DOET; welke rol daarvoor nodig was, doet
                  er alleen toe bij het kiezen van het token.

     Voor een route zonder bewakerslaag is de juiste oproep dus die met een LEGE
     kop -- dat is geen gebrekkige meting maar de enige goede. En voor een
     lichaamssleutel (gastAuth, gezinsPoort) staat het letterlijk in
     scripts/lib/bewakers.js: een token in de kop is daar 'niet fout maar
     IRRELEVANT'. Ook die routes zijn dus correct aan te roepen; ze stranden
     hooguit op een ontbrekende sleutel in het lijf, en dat komt eerlijk terug als
     ONGEMETEN met de status erbij.

     Het kan hier dus niet groen worden van een verkeerde aanname: een route die
     we niet aan het werk krijgen, blijft ongemeten. Wat het wel doet is die
     routes uit de restpost 'niet beproefbaar' halen, waar ze geen enkel getal
     lieten bewegen.

     De twee blijven in het register uit elkaar: `rol` staat er als er een token
     mee ging, en `zonderRol` draagt de reden als de oproep met een lege kop is
     gedaan. Wie het naleest kan die twee nooit voor elkaar aanzien. */
  const zonderKop = verdeling.zonderRol.map(r => ({ methode: r.methode, pad: r.pad, rol: null, zonderRol: r.reden }));
  const alleKandidaten = [...verdeling.metRol, ...zonderKop];
  /* De peiling (--pad) versmalt de lijst; zonder vlag verandert er niets. */
  const routes = PAD ? alleKandidaten.filter(r => r.pad.includes(PAD)) : alleKandidaten;
  if (PAD) {
    console.log('\n  PEILING op "' + PAD + '": ' + routes.length + ' van ' +
      alleKandidaten.length + ' routes. Het register wordt NIET geschreven.');
    if (!routes.length) { console.error('  Geen route bevat dat stuk pad.'); process.exitCode = 1; }
  }

  console.log('\n=== DE IDEMPOTENTIE PER ROUTE ===\n');
  meldSleutels(bos);
  console.log('  routes gevonden                      : ' + kandidaten.length);
  console.log('  routes met een herkenbare rol        : ' + verdeling.metRol.length + '   (aangeroepen MET dat token)');
  console.log('  routes zonder rol, met lege kop      : ' + zonderKop.length + '   (geen kop om te dragen -- zie hieronder)');
  meldZonderRol(verdeling, 'zonder rol, en waarom (allemaal AANGEROEPEN)');
  console.log('  oproepen per route                   : 3  (K1, K1 opnieuw, K2 vers)');

  /* DE WERELD KLAARZETTEN, VOOR ER GEMETEN WORDT -- ./lib/idemwereld.js.

     Het plausibele lijf is voor alle routes hetzelfde en weet niet welke IBAN of
     welke codenaam er in DEZE database bestaan; het gevolg was dat 2.221 routes
     hun eerste oproep zagen stranden op "deed geen werk". Een route die niets
     doet, kun je niet betrappen op een tweede keer doen. Daarom bouwt die module
     eerst een echte wereld (rekening, saldo, pas, vaste betaling, twee klompjes)
     en levert per geldroute het lijf met de veldnamen van DIE route. Waarom per
     route, en waarom de kredietroutes NIET worden opengebroken, staat daar. */
  const { zetWereldKlaar, voorzieningVoor } = require('./lib/idemwereld');
  const { wereld, extra, perRoute: geldLijven, perVoorvoegsel, gemist } = await zetWereldKlaar({ post, tokens, datamap: server.datamap });

  /* De voorvoegselregels: binnen /api/foundation/ betekent `code` de gezinscode
     en nergens anders. Zie de kop van ./lib/idemwereld.js voor waarom dit geen
     gedeeld lijf mag zijn. Een regel mag ook een ROL opleggen -- het
     werkplek-huis laat alleen de eigenaar binnen. */
  const voorvoegselVan = (pad) => (perVoorvoegsel || []).find(v => pad.startsWith(v.voorvoegsel)) || null;
  const schoonLijf = (o) => { const uit = {}; for (const [k, v] of Object.entries(o || {})) if (v !== undefined) uit[k] = v; return uit; };
  console.log('  wereld klaargezet                    : ' +
    (Object.keys(extra).length ? Object.keys(extra).join(', ') : 'NIETS -- de proef meet dan als vanouds'));
  console.log('  geldroutes met een eigen lijf        : ' + Object.keys(geldLijven).length);
  /* WAT ER NIET IS KLAARGEKOMEN, en dat staat BOVEN de voorvoegsels met opzet.

     Een gebroken keten leverde tot vandaag stil `null` op; wat hem verraadde was
     een ontbrekende naam in de regel hieronder, en dan alleen als je die regel
     las. Nu zegt de opbouw het zelf, met de status en de melding van de stap die
     het voorwerp had moeten opleveren. Zie VERWACHT in scripts/lib/idemwereld.js.

     Het is een MELDING en geen fout: een wereld die niet compleet is, mag de
     proef niet tegenhouden -- dan verdwijnt ook het deel dat wel werkt. */
  if (gemist && gemist.length) {
    console.log('  NIET KLAARGEKOMEN                    : ' + gemist.length +
      ' van de ' + (gemist.length + (perVoorvoegsel || []).length) + ' verwachte voorwerpen');
    for (const g of gemist) {
      console.log('      ' + g.wat + ' -- ' + g.via +
        (g.status ? ' gaf ' + g.status : '') + (g.melding ? ': ' + String(g.melding).slice(0, 90) : ''));
    }
  }
  console.log('  voorvoegsels met een eigen sleutel    : ' +
    ((perVoorvoegsel || []).map(v => v.voorvoegsel + ' (' + Object.keys(schoonLijf(v.lijf)).join('+') + (v.rol ? ', als ' + v.rol : '') + ')').join(', ') || 'geen'));

  /* ============================================================================
     HET TWEEDE MEETPUNT IJKEN.

     Elk antwoord draagt de stand per collectie. Maar sommige collecties
     veranderen bij ELK verzoek -- `doorgeefjournaal` schrijft een regel per
     verzoek, ook bij lezen. Zonder die ruis eruit zou elke oproep "werk gedaan"
     lijken en was dit meetpunt meteen blind. In stand 2 weegt dit zwaarder dan
     in stand 1: een inhoudsafdruk ziet ook de tellers en tijdstempels die bij
     elk verzoek een tik krijgen, dus er is MEER te ijken en niet minder.

     Wie de ruis is, staat daarom nergens als lijst: we METEN het. Een handvol
     oproepen die niets doen (een leesroute), kijken wat er dan toch groeit, en
     dat uitsluiten. Een handgeschreven lijst zou stil verouderen zodra er een
     teller bij komt; deze ijking niet. Zelfde gedachte als de per-route ijking
     in de proef zelf: eerst zien dat de meter kan bewegen. */
  const staatlog = require('../server/staatlog');
  let stilBewoog = null;
  const ruis = new Set();
  let ijkStand = null, staatWerkt = false;
  {
    /* OP MEER DAN EEN ROUTE, en dat kostte veertien routes voordat het opviel.

       De ijking liep alleen op /api/pay/overzicht. Wat daar niet groeit, komt
       niet in de ruislijst -- en `kosten` groeide daar niet, want de kostenmeter
       tikt op de poorten die een DRAGER kennen en niet op elke route. Veertien
       leesroutes kwamen daardoor binnen als "er veranderde iets": het enige dat
       veranderde was de boekhouding van het huis over het verzoek zelf.

       Besluit van de eigenaar, 30 augustus 2026: een tik van de kostenmeter is
       RUIS en geen werk. Zou het wel werk zijn, dan wordt elke leesroute
       niet-idempotent zodra de meter hem raakt, en dat is bijna elke leesroute.

       Het blijft een MEETPUNT en geen lijst: `kosten` staat hier nergens met
       naam. Er komt een tweede leesroute bij die wel langs een dragende poort
       gaat, en wat er dan bij ELKE oproep groeit is per definitie ruis. Een
       handgeschreven lijst zou stil verouderen zodra er een teller bij komt. */
    const IJKROUTES = ['/api/pay/overzicht', '/api/geld/beleid'];
    /* EN EEN DIE DE IJKING NIET KAN VINDEN, met naam en met de reden.

       `kosten` is de kostprijsboekhouding (kern/kosten/meter.js). Hij wordt
       NOOIT door een handler geschreven -- alleen door de meter, over het
       verzoek zelf. Voor de vraag "deed deze route werk" is dat per definitie
       ruis: het is de boekhouding van het huis en niet de handeling.

       Waarom hij hier met naam staat terwijl de rest gemeten wordt: de ijking
       zoekt wat bij ELKE oproep groeit, en de kostenmeter tikt niet bij elke
       oproep -- hij hangt aan de poorten die een drager kennen. Twee ijkroutes
       vonden hem daarom evenmin (gemeten: de lijst bleef rtgai, handelingLog,
       apiSpoor). Wat niet altijd groeit, kan een altijd-groeit-ijking niet
       vinden; dat is geen tekortkoming van de ijking maar haar definitie.

       Besluit van de eigenaar, 30 augustus 2026. De prijs staat erbij: zou een
       handler ooit zelf in `kosten` schrijven, dan ziet deze proef dat niet meer.
       Dat mag niet gebeuren en KOSTEN.md zegt dat ook -- de meter is de enige
       schrijver. */
    ruis.add('kosten');
    for (const pad of IJKROUTES) {
      const eerste = await post(pad, {}, tokens.member);
      let stand = eerste.staat || null;
      if (stand == null) continue;
      for (let i = 0; i < 6; i++) {
        const nu = await post(pad, {}, tokens.member);
        if (nu.staat == null) break;
        for (const k of Object.keys(staatlog.verschil(stand, nu.staat))) ruis.add(k);
        stand = nu.staat;
      }
      ijkStand = stand;
    }

    /* ---------------------------------------------------------------------
       DE STILLE RONDE -- wat beweegt er ZONDER dat er iets wordt aangeroepen.

       WAAROM DE IJKING HIERBOVEN DIT NIET VINDT: zij zoekt wat bij ELKE oproep
       groeit, en doet dat in milliseconden. Een collectie die aan een KLOK hangt
       of die een RAM-buffer periodiek uitspoelt, beweegt daar niet in mee -- en
       landt daarna in het verschil van de route die op dat moment gemeten wordt.

       GEVONDEN AAN TWEE ECHTE GEVALLEN, en beide keren was de uitslag een
       verkeerde toerekening:

         `wacht`            De Wacht (kern/wacht/staat.js) houdt een meetring van
                            180 punten op tien seconden. Hij bewoog in het verschil
                            van /api/pay/stuur en van /api/office/bank/handtekening/
                            bevestig -- en dat laatste pad gaf drie keer 404.
         `kantoorMensdeur`  de schaduwmeting van de kantoordeur telt in RAM en
                            SPOELT periodiek (kern/kantoor/mensdeur-spoel.js). Hij
                            sprong met TIEN omhoog in een enkel verschil; dat zijn
                            tien eerdere verzoeken, niet dit ene.

       Dit is dezelfde fout als de toerekening van voorwerk die `herijk` hierboven
       oplost, maar van een derde kant: niet de proef die zelf schrijft en niet een
       buurroute, maar een achtergrondlus in dezelfde server.

       LOS BEPROEFD VOORDAT HIJ IN DE RONDE KWAM, en hij vond er DRIE: `wacht`,
       `kantoorMensdeur` en `techniek` (het beveiligingsbord, server/beveiliging.js --
       ook dat beweegt zonder dat iemand iets vraagt). De snelle ijking vond in
       dezelfde opstelling alleen `kosten`, `handelingLog` en `apiSpoor`; die twee
       lijsten overlappen dus niet, en dat is precies waarom deze ronde bestaat.

       WAT HET KOST, en dat hoort er even groot bij: een route die ZELF in zo'n
       collectie schrijft, wordt daarop niet meer gemeten. Voor `wacht` zijn dat de
       /api/wacht/-routes, voor `techniek` de technische pagina, en zij staan hiermee
       op de lijst van dingen die deze proef niet ziet -- precies zoals `kosten`
       hierboven. Een zeef die te veel wegvangt is erger dan een die niets doet, dus
       de zeef wordt GEMETEN en niet geraden: wat hier in ruis belandt, is wat er
       beweegt terwijl er niets wordt gevraagd. Komt er ooit niets meer uit, dan
       meldt de ronde dat ook -- 'niets bewoog' is een uitslag en geen stilte.

       TWAALF SECONDEN, want de kortste klok die we vonden tikt op tien. Het is
       eenmalig per ronde naast een meetlus van tientallen minuten. */
    if (ijkStand != null) {
      const stil = async (ms) => new Promise(r => setTimeout(r, ms));
      const voor = ijkStand;
      await stil(12000);
      const na = await post(IJKROUTES[0], {}, tokens.member);
      if (na.staat != null) {
        const stilleRuis = Object.keys(staatlog.verschil(voor, na.staat, ruis));
        for (const k of stilleRuis) ruis.add(k);
        ijkStand = na.staat;
        stilBewoog = stilleRuis;
      }
    }
    staatWerkt = ijkStand != null;
  }
  /* DE VASTLEGGING wordt hier NIET geijkt, en dat is een gemeten keuze. Deze
     ijking draait op een LEESroute en vindt daarmee alleen wat bij ELK verzoek
     groeit (`doorgeefjournaal`). Collecties die bij elke HANDELING een regel
     schrijven -- `kantoorAudit`, `commandJournaal`, `securityLog` -- groeien bij
     lezen niet en komen hier dus nooit boven. Twee automatische zeven zijn hier
     op gemeten data gestrand (een steekproefronde, en een verhouding over alle
     deltas: die vond er nul, want een kantoorjournaal groeit alleen bij
     kantoorroutes). Ze staan nu bij naam en met reden in IDEMBESLUIT.json --
     zie de uitleg in scripts/lib/idemproef.js voor waarom een besluit hier
     beter is dan een slimmigheid, en hoe die lijst zelf gecontroleerd wordt. */
  console.log('  tweede meetpunt (de opslag)          : ' + (staatWerkt
    ? 'aan; ruis geijkt op ' + (ruis.size ? [...ruis].join(', ') : 'niets')
    : 'UIT -- geen X-RTG-Staat-kop; de proef meet alleen het antwoord'));
  /* De stille ronde apart melden en niet in het rijtje hierboven verstoppen: wat
     beweegt terwijl er niets wordt gevraagd, is een ander soort bevinding dan wat
     bij elke oproep groeit -- en als het er NUL zijn hoort dat ook te blijken. */
  if (staatWerkt) console.log('  de stille ronde (klok en buffer)     : ' +
    (stilBewoog === null ? 'niet gedraaid' : stilBewoog.length ? stilBewoog.join(', ') : 'niets bewoog'));
  /* Wat er tijdens het meten UIT staat, hoort even zichtbaar te zijn als wat er is
     geijkt: een ronde met andere voorwaarden is een andere ronde. */
  console.log('  tikkers stilgezet                    : bank opdrachtenronde (60s), bank uurtik, commercie (5m)');
  console.log('  tikkers die NOG tikken (gemeten)     : ledenSites, veilig, rtgai');

  /* Het verschil dat DEZE oproep achterliet. De stand loopt door over de hele
     ronde: elk antwoord is het nieuwe ijkpunt voor het volgende. */
  let vorigeStand = ijkStand;
  const staatVan = !staatWerkt ? null : (antwoord) => {
    if (!antwoord || antwoord.staat == null) return {};
    const d = staatlog.verschil(vorigeStand, antwoord.staat, ruis);
    vorigeStand = antwoord.staat;
    return d;
  };

  /* DE HERIJKING, EN WAAROM ZIJ MOEST BESTAAN (13 september 2026).

     `vorigeStand` schuift alleen op wanneer `staatVan` wordt AANGEROEPEN, en dat
     gebeurt uitsluitend voor de drie gewogen oproepen. Alles wat de proef VOOR die
     drie doet -- de pasladder-ijkoproep en de voorziening die het onderwerp
     aanmaakt -- schrijft dus wel, maar schuift het ijkpunt niet op. Het verschil
     dat die schrijfacties achterlieten belandde daardoor in `dA`, het vak waarin
     staat wat de GEMETEN handeling aanraakte.

     De kop van scripts/lib/idemproef.js beweerde het tegenovergestelde: "dat
     vertroebelt de meting niet -- staatVan geeft het verschil PER oproep, en deze
     valt buiten de drie die gewogen worden". Die gerustheid is precies de reden dat
     niemand keek. Hij valt er NIET buiten, want niet-gemeten werk verschuift het
     ijkpunt niet.

     GEVONDEN AAN EEN ECHT GEVAL: /api/pay/verzoek/intrek kreeg payIdem en
     payIdemAfdruk toegerekend, terwijl verzoekIntrek() in kern/pay/verzoeken.js
     geen metIdem aanroept en de route geen sleutel meegeeft. Die twee rijen komen
     van de voorziening, die het klompje eerst langs /api/pay/verzoek aanmaakt --
     en dat pad schrijft ze wel. Het is dus geen afrondingsruis maar een
     toerekening aan de verkeerde handeling, en kern/stuur/gevolg.js leest precies
     dat vak.

     `herijk` schuift het ijkpunt op zonder een verschil te melden. Hij geeft geen
     delta terug en telt nergens mee: hij zegt alleen "wat hiervoor gebeurde, hoort
     niet bij de meting". */
  const herijk = !staatWerkt ? null : (antwoord) => {
    if (antwoord && antwoord.staat != null) vorigeStand = antwoord.staat;
  };

  /* NA EEN VERSE INLOG ONDERWEG -- de vierde toerekeningsweg, en de enige die niet
     uit het voorwerk van een route komt maar uit de OPSTELLING zelf.

     Waarom hij bestaat en waarom het ijkpunt NIET opschuift, staat bij de aanroep in
     scripts/lib/idemproef.js -- met de meting erbij. Hier staat alleen hoe de namen
     worden bepaald: het verschil tussen de stand van voor de inlog (de 401 draagt die
     mee) en de stand die het antwoord van de inlog zelf droeg, met dezelfde geijkte
     ruis eruit als overal.

     De sleutelbos onthoudt die tweede stand, want dat is de enige plek waar dit huis
     inlogt. Ontbreekt er een van de twee, dan geeft hij een LEGE lijst terug: dan is
     er niets bekend om weg te laten, en dan hoort de meting te blijven staan zoals ze
     is in plaats van te worden opgepoetst. */
  const naInlog = !staatWerkt ? null : ({ voor }) => {
    const na = bos.laatsteInlogStaat && bos.laatsteInlogStaat();
    if (voor == null || na == null) return [];
    return Object.keys(staatlog.verschil(voor, na, ruis));
  };

  let register = {};
  try { register = JSON.parse(fs.readFileSync(path.join(WORTEL, 'IDEMBESLUIT.json'), 'utf8')); } catch (e) {}
  const besluiten = register.routes || {};

  /* DE WERELDEN, EN WAAROM ZE HIER STAAN.

     Deze proef roept elke schrijfroute aan, en een deel daarvan leeft BINNEN
     een wereld die zij zelf opzet: een stadsafdeling, een festival-editie, een
     onderzoek. Zonder die wereld antwoordt de route met "bestaat niet" en telt
     hij als ongemeten -- niet omdat er iets mis is, maar omdat er niets stond.

     Ze staan er ook om een tweede reden, en die is scherper: er zitten
     sloopachtige routes BINNEN die werelden. Een wereld die halverwege
     sneuvelt, meldde zich aan het begin gewoon klaar. Vandaar de wacht
     hieronder, die onderweg peilt, en de eindcontrole erna. */
  const werelden = {};
  const wereldExtras = {};
  const zetKlaar = async (naam, mod, fn, args) => {
    try {
      const w = await require(mod)[fn](args);
      werelden[naam] = w;
      if (w && w.extra) wereldExtras[naam] = w.extra;
      console.log('  wereld ' + naam.padEnd(30) + ': ' +
        (w && w.klaar ? 'klaar' : 'NIET klaar -- ' + ((w && w.reden) || 'onbekend')));
    } catch (e) {
      console.log('  wereld ' + naam.padEnd(30) + ': NIET klaar -- ' + e.message);
    }
  };
  /* De genrewereld deelt het zaakbureau van de sleutelbos: EEN teller en EEN
     cache, zodat de roosterrem eerlijk te meten is (test/eindpoort.test.js). */
  await zetKlaar('genre', './lib/wereld-genre', 'zetGenreKlaar', { post, zaakinlog: bos.zaakbureau });
  await zetKlaar('rtfos', './lib/wereld-rtfos', 'zetRtfosKlaar', { post, tokens });
  await zetKlaar('festival', './lib/wereld-festival', 'zetFestivalKlaar', { post, tokens });
  await zetKlaar('lab2', './lib/wereld-lab2', 'zetLab2Klaar', { post, tokens });
  await zetKlaar('weefsel', './lib/wereld-weefsel', 'zetWeefselKlaar', { post, tokens });
  await zetKlaar('rtmail', './lib/wereld-rtmail', 'zetRtmailKlaar', { post, tokens });

  /* DE LIJFSLEUTELS -- een sleutel die in het LICHAAM staat en niet in de kop.

     Een deel van dit huis bewaakt niet met een rol maar met een sleutel in het
     verzoek zelf: gezinsPoort, werkPoort, rtfPoort, gastAuth. Rollen kruisen
     meet daar niets, en zonder gebouwde familie belandt zo'n route in
     GEEN_PROEFSLEUTEL -- terwijl er niets ontbreekt behalve deze opstelling.

     Gemeten op 1 september 2026: 471 routes stonden daar, en scripts/onbewezen.js
     leest de gebouwde families uit `gemeten.lijfsleutelsGebouwd` van DEZE proef.
     Zolang die lijst leeg is, telt elke lichaamssleutel-route als ontbrekende
     sleutel. Zie ./lib/lijfsleutels.js voor waarom dit een tweede begrip is en
     geen rol. */
  const { bouwLijfsleutels } = require('./lib/lijfsleutels');
  let lijfsleutels = { gebouwd: [], mislukt: [], lijfVoor: () => ({}) };
  try {
    lijfsleutels = await bouwLijfsleutels({ post, tokens, datamap: server.datamap, doosSleutel: DOOS_SLEUTEL });
  } catch (e) {
    console.log('  lijfsleutels                         : NIET gebouwd -- ' + e.message);
  }
  console.log('  lijfsleutels gebouwd                 : ' +
    (lijfsleutels.gebouwd.length ? lijfsleutels.gebouwd.map(g => g.naam).join(', ') : 'GEEN') +
    (lijfsleutels.mislukt.length ? '   (mislukt: ' + lijfsleutels.mislukt.map(m => m.naam).join(', ') + ')' : ''));
  for (const m of lijfsleutels.mislukt) console.log('      ' + m.naam + ': ' + m.reden);

  const { maakWereldwacht, controleerWerelden } = require('./lib/wereldcontrole');
  const wacht = maakWereldwacht({ post, tokenVoor, extras: wereldExtras,
    elke: Number(process.env.RTG_WERELDWACHT || 250) });

  const uit = await draaiIdemproef({ post, routes, tokenVoor, hernieuw, naInlog, wacht,
    lijfVoor: (r) => {
      const vv = voorvoegselVan(r.pad);
      return { ...plausibelLijf(r.pad), ...extra, ...(vv ? schoonLijf(vv.lijf) : {}), ...(geldLijven[r.pad] || {}) };
    },
    /* EEN VOORVOEGSEL MAG DE ROL OPLEGGEN -- MAAR NIET ALTIJD AAN IEDEREEN.

       `/api/overheid/` is helemaal van het rijk, dus daar mag de rol onvoorwaardelijk
       over alles heen. `/api/gemeente/` is dat NIET: daar wonen vijftien routes
       voor een BURGER (afval melden, belasting betalen, een afspraak maken) naast
       acht voor de gemeente zelf. Een onvoorwaardelijke rol gaf die vijftien het
       leveranciers-token en dus een 401 "Niet ingelogd als lid" -- en vijf routes
       die eerst gemeten waren, werden ongemeten. Een toevoeging aan de wereld die
       de meting VERSLECHTERT is het ergste wat hier kan gebeuren, want hij ziet er
       van buiten uit als vooruitgang.

       `alleenRol` maakt de overname voorwaardelijk: hij geldt alleen waar de route
       zelf al die soort actor verwachtte. Zonder `alleenRol` blijft het gedrag
       precies zoals het was. */
    rolVoor: (r) => {
      const vv = voorvoegselVan(r.pad);
      if (!vv || !vv.rol) return r.rol;
      if (vv.alleenRol && r.rol !== vv.alleenRol) return r.rol;
      return vv.rol;
    },
    maxRoutes: MAX, staatVan, herijk,
    /* De voorziening maakt een VERS onderwerp vlak voor de meting. Nodig omdat
       de pasladder-ijkoproep echt werk doet en een opmaakbare route zijn eigen
       onderwerp kwijt is voordat A draait -- zie de kop bij VOORZIENINGEN in
       ./lib/idemwereld.js. */
    voorzieningVoor, wereld,
    vastlegging: register.vastlegging, metenZonderSleutel: true, pasladder: PASLADDER });

  if (uit.meterStuk) {
    console.error('\n  DE METER IS BLIND: ' + uit.meterStuk);
    klaar(); process.exit(2);
  }

  const t = uit.telling;
  const beoordeeld = t.beschermd + t.onbeschermd;
  console.log('  oproepen                             : ' + uit.oproepen);
  console.log('  tokens onderweg opnieuw gehaald      : ' + uit.hernieuwd);
  console.log('  routes gemeten met een ANDERE pas    : ' + (uit.pasGewisseld || 0) +
    '   (403 op de instapfas; zie viaPas in het register)');
  console.log('  BEOORDEELD (tweede effect zichtbaar) : ' + beoordeeld + ' / ' + routes.length);
  console.log('      herhaling herkend (beschermd)    : ' + t.beschermd);
  console.log('      deed het opnieuw (onbeschermd)   : ' + t.onbeschermd);
  console.log('      waarvan gezien aan de OPSLAG     : ' + (uit.uitOpslag || 0) +
    '   <- het antwoord zei niets; de opslag wel');
  console.log('  ongemeten                            : ' + t.ongemeten +
    '   <- geen werk gedaan, of het antwoord reageert niet op een nieuwe oproep');
  /* De lijst met vastleggingen uit IDEMBESLUIT.json, met de controle erop: onder
     hoeveel verschillende routefamilies groeide elk van die collecties? Een
     doorlopende vastlegging groeit onder routes die verder niets met elkaar te
     maken hebben; groeit er een onder maar EEN familie, dan is het domeinwerk
     dat in de lijst is gezet -- en dan verdwijnt er een bevinding achter een
     regel in een bestand. Dat hoort hardop te klinken. */
  console.log('  vastlegging (geldt niet als werk)    : ' + ((uit.vastleggingGemeten || []).length
    ? uit.vastleggingGemeten.map(v => v.collectie + ' (' + v.families + ' routefamilies)').join(', ')
    : 'niets in IDEMBESLUIT.json'));
  for (const k of (uit.vastleggingVerdacht || [])) {
    console.log('      LET OP: ' + k + ' groeide maar onder EEN routefamilie -- dat lijkt domeinwerk, ' +
      'geen doorlopende vastlegging. Haal hem uit IDEMBESLUIT.json of onderbouw hem opnieuw.');
  }
  if (uit.tegenspraken && uit.tegenspraken.length) {
    console.log('  TEGENSPRAAK antwoord vs opslag       : ' + uit.tegenspraken.length + '   (elk nagetrokken met een vierde oproep)');
    for (const p of uit.tegenspraken.slice(0, 10)) console.log('      ' + p);
  }
  if (uit.vermoedensVerworpen) {
    console.log('  vermoedens die niet herhaalbaar waren: ' + uit.vermoedensVerworpen +
      '   <- bij B bewoog er iets dat bij een vierde oproep niet terugkwam');
  }

  /* ============================================================================
     ELKE ONBESCHERMDE ROUTE DRAAGT EEN BESLUIT (TAKEN.md 4.30).

     "Onbeschermd" is een telling en geen defect -- twee keer op bewaren drukken
     hoort twee notities op te leveren. Maar dan moet iemand dat wel HEBBEN
     BESLOTEN, en niet: het stond er en niemand keek. Het verschil tussen die
     twee is precies wat deze lijst zonder besluitregister niet kon laten zien.

     IDEMBESLUIT.json draagt per route waarom een herhaling daar mag (of niet).
     Wat hier onbeschermd uitkomt en er NIET in staat, is een route waarover nog
     niemand heeft nagedacht. Die worden bij naam genoemd. Ze maken deze proef
     niet rood -- dat zou een bevinding zijn en geen blindheid -- maar ze staan
     in het register onder `zonderBesluit`, zodat het getal niet stilletjes kan
     groeien. */
  const onbeschermd = Object.values(uit.perRoute).filter(r => r.idempotentie === 'onbeschermd');
  const zonderBesluit = onbeschermd.filter(r => !besluiten[r.pad]).map(r => r.pad);
  for (const r of onbeschermd.slice(0, 20)) console.log('      ' + r.methode + ' ' + r.pad + (besluiten[r.pad] ? '' : '   <- GEEN BESLUIT'));
  if (onbeschermd.length > 20) console.log('      ... en nog ' + (onbeschermd.length - 20));
  /* DE RONDE ZONDER SLEUTEL, apart gemeld en met de reden waarom hij er is.
     De regel erboven telt wat de PLATFORMLAAG ving; deze telt wat er bij een
     echte dubbeltik gebeurt. Ze samenvatten tot een cijfer zou allebei de
     getallen onleesbaar maken. */
  const z = uit.zonderSleutel || {};
  console.log('');
  console.log('  EN ZONDER SLEUTEL (de echte dubbeltik) : ' +
    ((z.beschermd || 0) + (z.onbeschermd || 0)) + ' met een uitspraak');
  console.log('      dubbeltik opgevangen             : ' + (z.beschermd || 0) +
    '   <- de route zelf, of zijn verklaring in idemsleutels.js');
  console.log('      dubbeltik DEED HET WERK OPNIEUW  : ' + (z.onbeschermd || 0));
  console.log('      geen uitspraak                   : ' + (z.ongemeten || 0));
  const dubbel = Object.values(uit.perRoute).filter(r => r.zonderSleutel && r.zonderSleutel.stand === 'onbeschermd');
  for (const r of dubbel.slice(0, 15)) console.log('      ' + r.methode + ' ' + r.pad);
  if (dubbel.length > 15) console.log('      ... en nog ' + (dubbel.length - 15));
  console.log('');
  console.log('  onbeschermd MET een besluit          : ' + (onbeschermd.length - zonderBesluit.length) + ' / ' + onbeschermd.length);
  if (zonderBesluit.length) console.log('      zonder besluit in IDEMBESLUIT.json: ' + zonderBesluit.length);
  /* De eindcontrole en het verslag van de wacht, VOOR de uitslag wordt
     samengesteld: allebei horen ze in het register en niet alleen op het
     scherm. */
  const wereldStand = await controleerWerelden({ post, tokenVoor, hernieuw, extras: wereldExtras });
  const wachtVerslag = wacht.verslag();
  const gesneuveld = wereldStand.filter(w => w.gecontroleerd && !w.ok);
  console.log('\n  de werelden NA afloop                : ' +
    wereldStand.filter(w => w.ok).length + ' overeind, ' + gesneuveld.length + ' gesneuveld, ' +
    wereldStand.filter(w => !w.gecontroleerd).length + ' niet gecontroleerd');
  for (const w of wereldStand) if (!w.ok) console.log('      ' + w.wereld + ': ' + w.waarom);
  console.log('  de wereldwacht onderweg              : ' + wachtVerslag.peilingen +
    ' peilingen (elke ' + wachtVerslag.stap + ' routes), ' + wachtVerslag.gebeurtenissen.length + ' omslag(en)');
  console.log('  roosteropvragingen                   : ' + bos.zaakbureau.verbruikt() + ' / 30');


  /* DE PEILING SCHRIJFT NIET. Zie de kop bij PAD: een gefilterde ronde die het
     register overschrijft, zet duizenden gemeten routes terug naar een handvol en
     ziet er daarna normaal uit. */
  if (PAD) {
    console.log('\n  PEILING: IDEMPROEF.json is NIET geschreven (--pad was actief).');
    for (const [sleutel, rij] of Object.entries(uit.perRoute || {})) {
      const z = rij.zonderSleutel || {};
      console.log('    ' + sleutel + '\n      met sleutel : ' + rij.idempotentie + '  (' + (rij.reden || '') + ')' +
        '\n      zonder      : ' + (z.stand || '-') + '  (' + (z.reden || '') + ')' +
        '\n      opslag      : ' + JSON.stringify(rij.opslag || {}) +
        (z.effect ? '\n      effect      : ' + JSON.stringify(z.effect) : ''));
    }
    await klaar();
    return;
  }

  fs.writeFileSync(UITSLAG, JSON.stringify({
    stempel: stempel(),
    uitleg: 'Per route drie oproepen: twee met dezelfde sleutel en een met een verse. De derde is de ' +
      'IJKING -- verschilt hij van de eerste, dan is het antwoord gevoelig voor een nieuwe oproep en ' +
      'pas dan betekent een gelijke herhaling iets. Een route die hier NIET in staat is niet beproefd. ' +
      '"onbeschermd" is een telling en geen defect-oordeel; zie de grens in scripts/lib/idemproef.js.',
    /* WAT ER NIET IS BEPROEFD, met de reden erbij. Zonder dit veld leest
       routesMetRol als "dit zijn de routes" terwijl het "dit is wat we konden
       bereiken" betekent -- en dat verschil was jarenlang 1257 routes groot. */
    /* NUL, EN DAT IS EEN BESLUIT EN GEEN VERGETEN VELD. Dit veld telde de
       routes die deze proef niet AANRIEP. Sinds hij ook met een lege kop
       aanroept, is die verzameling leeg: er is geen route meer die hij
       overslaat. De redenen blijven staan -- ze zeggen nu WAAROM een route met
       een lege kop is aangeroepen, en dat is precies wat een lezer nodig heeft
       om zo'n regel te wegen. */
    nietBeproefbaar: 0,
    redenenNietBeproefbaar: verdeling.redenen,
    zonderRolAangeroepen: zonderKop.length,
    routesGevonden: kandidaten.length,
    gemeten: { routesAangeroepen: routes.length, routesMetRol: verdeling.metRol.length,
      routesZonderRol: zonderKop.length, beoordeeld,
      beschermd: t.beschermd, onbeschermd: t.onbeschermd, ongemeten: t.ongemeten,
      oproepen: uit.oproepen, tokensHernieuwd: uit.hernieuwd,
      uitOpslag: uit.uitOpslag || 0, ruisGeijkt: [...ruis], vastlegging: uit.vastleggingGemeten || [],
      /* ONDER WELKE VOORWAARDEN DIT IS GEMETEN. Twee rondes die elke vijf minuten
         schrijven staan tijdens deze ronde stil (zie de env hierboven); zonder dat
         belandt hun werk in de delta van de route die op dat moment aan de beurt is.
         Het staat in het REGISTER en niet alleen in de bron, want wie deze getallen
         later leest moet kunnen zien wat er tijdens het meten uit stond -- en wat NIET
         (`tikkersNogAan`, gemeten op een stille server van 5,5 minuut). */
      tikkersStil: ['bank opdrachtenronde 60s (kern/bank/index.js)', 'bank uurtik (kern/bank/index.js)',
        'commercie 5m (kernlaag3c) -- geen eigen bewijs'],
      tikkersNogAan: ['ledenSites', 'veilig', 'rtgai'],
      blindeRondes: uit.meterStuk ? 1 : 0, begrenzing: MAX,
      wereldKlaargezet: Object.keys(extra), geldroutesMetEigenLijf: Object.keys(geldLijven).length,
      onbeschermdMetBesluit: onbeschermd.length - zonderBesluit.length,
      /* STAAT DE WERELD ER NA AFLOOP NOG, en sloeg er onderweg een om.

         Twee getallen die niet hetzelfde zeggen. `werelden` is de eindstand:
         staat hij er nog. `wereldwacht` is het VENSTER: als een wereld tussen
         route 900 en 1150 omsloeg, weet je waar je moet kijken -- een
         eindoordeel zou alleen zeggen DAT hij weg is.

         `gecontroleerd: false` telt met opzet niet als fout. Niet gekeken is
         geen uitslag (LAT.md regel 3), maar het mag ook niet alles zijn: dan
         gaat de poort dicht door weg te kijken, en dat bewaakt
         test/eindpoort.test.js apart. */
      werelden: wereldStand, wereldwacht: wachtVerslag,
      /* EN DE REM DIE NIET MAG SPRINGEN. /api/supplier/roster laat dertig
         opvragingen per kwartier per IP toe -- een echte poort, want zonder hem
         is het personeelsbestand van elke partner in minuten uit te lezen. Wat
         hier staat is wat er GEMETEN is opgevraagd, niet hoe lang een lijst is:
         een tweede plek die alsnog zelf gaat aankloppen, valt daarmee op. */
      roosteropvragingen: bos.zaakbureau.verbruikt(), roosterRem: 30,
      /* WELKE LICHAAMSSLEUTEL-FAMILIES ER STONDEN. scripts/onbewezen.js leest
         deze lijst om te bepalen of een route werkelijk zonder sleutel zat of
         alleen zonder OPSTELLING -- twee heel verschillende reparaties. */
      lijfsleutelsGebouwd: lijfsleutels.gebouwd.map(g => g.naam),
      /* WAT DE PLATFORMLAAG VING, EN WAT DE ROUTE ZELF DOET -- twee getallen,
         want ze gaan niet over hetzelfde. Alle oproepen hierboven dragen `idem`
         in het lijf, en server/middleware/idempotentie.js is precies daarop
         opt-in: 'beschermd' hierboven is dus grotendeels die laag. Een echte
         dubbeltik draagt geen sleutel, en dat is wat hieronder staat. */
      zonderSleutel: uit.zonderSleutel || null, pasGewisseld: uit.pasGewisseld || 0 },
    zonderBesluit, tegenspraken: uit.tegenspraken || [], vastleggingVerdacht: uit.vastleggingVerdacht || [],
    vermoedensVerworpen: uit.vermoedensVerworpen || 0,
    perRoute: Object.values(uit.perRoute)
  }, null, 1) + '\n');
  console.log('\n  weggeschreven in IDEMPROEF.json');

  klaar();
  /* GEEN EXITCODE 1 OP "ONBESCHERMD". Dat is een telling en geen defect: twee
     keer op bewaren drukken hoort twee notities op te leveren. Alleen blindheid
     laat deze proef zakken -- LAT.md: een bevinding maakt CI niet rood,
     blindheid wel. */
  process.exit(0);
})().catch(e => { console.error('de idemproef viel om: ' + (e && e.stack || e)); process.exit(2); });

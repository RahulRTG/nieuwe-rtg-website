/* ============================================================================
   VERZADIGING -- meet ik de server nog, of meet ik mijn eigen client?

   WAAROM DIT BESTAAT. scripts/tot-crash.js voert de druk op door het aantal
   werkers per ronde te verdubbelen, en meldde daarna trots "24 / 24 rondes
   gehaald, geen crash t/m 4.000 werkers". Dat was niet waar. Vanaf ronde 9 zag
   het log er zo uit:

     ronde  1      8 werkers   15.405 req | 503-afworp 93 | heap 30 MB
     ronde  9  2.048 werkers      202 req | 503-afworp  0 | heap 31 MB
     ronde 24  4.000 werkers       10 req | 503-afworp  0 | heap 30 MB

   Tien verzoeken in twaalf seconden is geen storm, dat is een kabbelend beekje.
   De server wierp niets meer af, zijn geheugen bleef vlak, en toch stond er
   "ronde gehaald". De vierduizend werkers landden nooit: het HARNAS liep vast op
   zijn eigen sockets, en bleef intussen rondes tellen alsof er druk stond.

   Dat is precies de fout waar LAT.md regel 10 over gaat -- een meter die je niet
   hebt zien uitslaan meet niets -- met een gemene draai eraan: deze meter sloeg
   WEL uit, alleen op het verkeerde ding. Hij telde rondes in plaats van druk.

   WIE IS DE REM? Van buiten zien "de server komt er niet doorheen" en "de client
   krijgt niets meer weg" er identiek uit: in beide gevallen zakt de doorvoer in.
   Er is precies EEN meting die het onderscheid maakt, en die komt uit het
   serverproces zelf: hoe lang stond zijn event-loop stil (scripts/gc-hook.js,
   veld lusMs). Een server die de rem is, staat stil. Een server die rustig staat
   te wachten terwijl de doorvoer instort, is niet de rem -- dan is het de client.

   ZONDER DIE METING ZEGT DEZE MODULE "ONZEKER" EN NOOIT "GOED". Ontbreekt de
   heap of de loopmeting, dan is er geen oordeel te vellen, en dan telt de ronde
   NIET mee als druk. Een ontbrekende invoer mag nooit als geslaagd doorgaan
   (LAT.md regel 3); dat is hoe deze bug er in de eerste plaats in kwam.
   ========================================================================== */
'use strict';

/* De drie latten. Bewust ruim: dit is geen fijnregeling maar een grofmazige
   scheiding tussen "er stond druk" en "er stond niets". */
const DEEL_VAN_PIEK = 0.10;   // onder een tiende van de piekdoorvoer: ingezakt
const LUS_RUSTIG_MS = 250;    // loop-piek hieronder = de server had het rustig
const HEAP_VLAK = 1.5;        // heap onder 1,5x de startvloer = niets aan de hand

/* Een ronde beoordelen.

   ronde: { werkers, req, shed, fault, heap, lusMs }
     req    verzoeken die de ronde daadwerkelijk heeft afgemaakt
     shed   503-afworpen (De Wacht die zich verdedigt -> de druk KWAM aan)
     fault  echte serverfouten (500/502/504)
     heap   heap-na-GC in MB, of null als hij niet te meten was
     lusMs  piek van de event-loop-stilstand in het serverproces, of null

   context: { piekReq, heapBasis, vorigeWerkers }

   Geeft { oordeel, reden } met oordeel:
     'druk'       er stond echte druk op de server; de ronde telt
     'verzadigd'  de client zat zichzelf in de weg; deze ronde meet de client
     'onzeker'    de doorvoer zakte in en het is NIET vast te stellen waarom */
function beoordeelRonde(ronde, context) {
  const r = ronde || {};
  const c = context || {};
  const req = Number(r.req) || 0;

  if (!c.piekReq) return { oordeel: 'druk', reden: 'eerste ronde: er is nog geen piek om tegen af te zetten' };

  if (req >= c.piekReq * DEEL_VAN_PIEK)
    return { oordeel: 'druk', reden: req + ' verzoeken, ruim boven een tiende van de piek (' + c.piekReq + ')' };

  /* Vanaf hier staat vast DAT de doorvoer is ingezakt. De vraag is van wie. */

  if (Number(r.shed) > 0)
    return { oordeel: 'druk', reden: 'de doorvoer zakte in, maar de server wierp ' + r.shed + ' verzoeken af (503): hij verdedigde zich, dus de druk kwam wel degelijk aan' };
  if (Number(r.fault) > 0)
    return { oordeel: 'druk', reden: 'de doorvoer zakte in, maar de server gaf ' + r.fault + ' serverfouten: de druk kwam aan' };

  if (r.heap == null || r.lusMs == null)
    return { oordeel: 'onzeker', reden: 'de doorvoer zakte in en ' + (r.heap == null ? 'de heap' : 'de event-loop') + ' van de server was niet te meten -- zonder die meting is niet te zeggen of de server of de client de rem was' };

  if (Number(r.lusMs) > LUS_RUSTIG_MS)
    return { oordeel: 'druk', reden: 'de event-loop van de server stond ' + Math.round(r.lusMs) + ' ms stil: de rem zit bij de server, niet bij de client' };

  if (c.heapBasis != null && Number(r.heap) > c.heapBasis * HEAP_VLAK)
    return { oordeel: 'druk', reden: 'de heap liep op naar ' + r.heap + ' MB (start ' + c.heapBasis + ' MB): de server was wel degelijk bezig' };

  if (c.vorigeWerkers != null && Number(r.werkers) < c.vorigeWerkers)
    return { oordeel: 'druk', reden: 'er werd ook minder gevraagd (' + r.werkers + ' werkers, was ' + c.vorigeWerkers + ')' };

  return { oordeel: 'verzadigd', reden: 'met ' + r.werkers + ' werkers kwamen er ' + req + ' verzoeken door (piek ' + c.piekReq +
    '), terwijl de server niets afwierp, zijn heap vlak bleef op ' + r.heap + ' MB en zijn event-loop hoogstens ' + Math.round(r.lusMs) +
    ' ms stilstond. Een rustige server die niets te doen krijgt: de client is de rem, niet de server' };
}

module.exports = { beoordeelRonde, DEEL_VAN_PIEK, LUS_RUSTIG_MS, HEAP_VLAK };

/* DE POORTWACHT VAN HET STUUR -- mag dit pad uberhaupt, en onder welk gezag?

   AFGESPLITST UIT ../stuur.js toen dat door de 10 KB van keuringsregel 13 ging,
   en de naad is echt en niet cosmetisch: dit bestand BESLIST of een handeling
   mag, ../stuur.js DOET de aanroep. Die twee schuiven om verschillende redenen
   -- deze als er een poort bij komt (de mandaatpoort was de derde), die als de
   manier van aanroepen verandert.

   VIER POORTEN OP EEN RIJ, en de volgorde is gedrag:

     1 stuurUit / rol    staat het stuur aan, en heeft deze wereld een rol?
     2 vorm en omvang    is dit JSON, en niet te groot?
     3 beleid            verboden -> 403; voorstel zonder mens -> 428
     4 mandaat           een ZELFSTANDIGE mutatie zonder gezag -> dicht
                         (./mandaatpoort.js; standaard meelopend)

   De frictieschaduw zit ertussen en BESLIST NIETS: hij noteert wat de motor van
   dit geval zou zeggen, zodat afdwingen later een besluit met een getal is. */
'use strict';

const { beleidVoor, NIVEAUS } = require('./beleid');

module.exports = function maakStuurToets({ stuurUit, VERBODEN, MAX_BODY, INTERNE_GOEDKEURING }) {
  /* DE SCHADUW LAADT LUI, en dat is een gemeten keuze: zie de kop van
     ./frictieschaduw.js. Kort: hij wordt alleen binnen stuurToets
     gebruikt, en een require bovenaan dit bestand trok kern/frictie/ het
     bedraden in. */
  let WEGER = null;
  let SCHADUW = null;
  function schaduw() { return (SCHADUW = SCHADUW || require('./frictieschaduw')); }
  /* Lui geladen, net als de frictieschaduw hierboven: de poort trekt ./beleid.js
     en ./mandaat.js mee, en die horen niet in de opstartketen van elk proces. */
  let MANDAATPOORT = null;
  function mandaatpoort() { return (MANDAATPOORT = MANDAATPOORT || require('./mandaatpoort')); }
  function weger() { return (WEGER = WEGER || schaduw().maakSchaduw({})); }

  /* ---- de poortwachter: mag dit pad überhaupt via het stuur? ---- */
  function stuurToets(pad, body, opties) {
    const o = opties || {};
    if (stuurUit())
      return { status: 503, error: 'Het AI-stuur staat tijdelijk uit via de centrale noodrem.' };
    if (typeof pad !== 'string' || !pad.startsWith('/api/') || pad.includes('..') || /[?#\s]/.test(pad))
      return { status: 400, error: 'Geef een geldig API-pad (begint met /api/, zonder query).' };
    if (VERBODEN.some(re => re.test(pad)))
      return { status: 403, error: 'Dit pad bedient het stuur bewust niet (accounts, techniek of het stuur zelf).' };
    let tekst;
    try { tekst = JSON.stringify(body == null ? {} : body); } catch (e) { return { status: 400, error: 'De body moet JSON zijn.' }; }
    if (tekst.length > MAX_BODY) return { status: 413, error: 'De actie-body is te groot.' };
    const beleid = beleidVoor(pad, o.wereld);
    if (beleid.niveau === NIVEAUS.verboden)
      return { status: 403, error: beleid.reden || 'Deze actie is niet beschikbaar voor het AI-stuur.' };
    /* DE FRICTIESCHADUW -- wat zou de motor van dit GEVAL zeggen?

       ./beleid.js antwoordt uit een statische lijst plus de bodem; de
       frictiemotor rekent met bedrag en aantal, en die staan hier in de body.
       CONTROLPLANE.md: eerst meelopen, dan pas afdwingen. Deze regel BESLIST
       DUS NIETS -- `beleid.niveau` hieronder is onaangeraakt.

       Alles achter een vangnet: een schaduw die de aanroeper kan laten klappen
       is erger dan geen schaduw, en de levering gaat voor (kern/envelop.js). */
    try { schaduw().noteer(o.wereld, pad, weger().weeg(beleid.niveau, body)); }
    catch (e) { /* een gemiste tel is geen geweigerde actie */ }

    if (beleid.niveau === NIVEAUS.voorstel && o.goedgekeurd !== INTERNE_GOEDKEURING)
      return { status: 428, bevestigNodig: true, menselijkAkkoord: true, pad,
        vraag: 'Deze actie verandert gegevens of heeft externe gevolgen. Controleer het voorstel en bevestig het zelf.' };

    /* DE MANDAATPOORT -- geen ZELFSTANDIGE mutatie zonder aantoonbaar gezag.

       Hij staat hier en niet in de AI-lus omdat dit het choke point is: vier
       aanroepers (de lus van Rahul, de bevestiging van een voorstel, de
       leveranciersroute en de directe route) passeren stuurRoep, en een
       stem-, agent- of automatiseringsingang die er later bij komt erft deze
       grens zonder dat iemand eraan hoeft te denken.

       HIJ RAAKT PRECIES EEN NIVEAU. `lezen` muteert niet, `verboden` is al
       geweigerd, en `voorstel` vraagt hierboven al een mens. Blijft `klein`
       over: vier paden voor een lid, nul voor zaak en personeel -- en dat is
       exact het gat dat KETENBEREIK.json blootlegde, waar vandaag niets tussen
       de allowlist en het effect staat.

       HET MANDAAT KOMT UIT `opties` EN NOOIT UIT DE MODELINVOER. De aanroeper
       levert het uit servergegevens aan; kon het model zijn eigen mandaat
       meesturen, dan keurt de poort zichzelf goed.

       EN HIJ LOOPT MEE. Zonder RTG_MANDAAT_AFDWINGEN telt hij en houdt hij
       niets tegen (CONTROLPLANE.md: je kunt niet afdwingen wat nooit in de
       schaduw heeft gelopen). Wat hij zou sluiten, staat in mandaatpoort.stand(). */
    const mp = mandaatpoort().beoordeel(pad, o.wereld, {
      mandaat: o.mandaat,
      menselijkBevestigd: o.goedgekeurd === INTERNE_GOEDKEURING,
      mandaatContext: o.mandaatContext
    });
    if (!mp.mag)
      return { status: 403, error: mp.uitleg || 'Deze handeling vraagt een mandaat.',
        geweigerd: 'MANDAAT', pad, reden: mp.reden };

    return null;
  }


  return { stuurToets };
};

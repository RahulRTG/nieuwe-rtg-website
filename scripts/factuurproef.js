/* ============================================================================
   DE VERTICALE GELDPROEF -- een geldpad van begin tot eind, economisch gemeten.

   WAT DEZE PROEF ANDERS DOET DAN ALLE ANDERE. De idempotentieproef vraagt of
   een TWEEDE aanroep een ander ANTWOORD geeft. De faalproef vraagt of een route
   een fout MELDT waar de opslag verloor. Allebei kijken naar het antwoord --
   en precies daar zit de gevaarlijkste faalvorm van een geldlaag niet:

     een route kan keurig 409 weigeren terwijl drie van de vijf geldcollecties
     al tweemaal zijn aangeraakt.

   De maat hier is daarom niet de status maar de TOESTAND: nul nieuwe waarde,
   nul tweede boeking, nul extra saldo, nul gedeeltelijke vervolgmutatie,
   dezelfde economische uitkomst. Wat de route antwoordt is bijvangst.

   WAAROM EEN PAD EN NIET VEERTIG. Zeven geldpaden staan in de mutatiecontracten
   op BLOCKED_BY_TEST_FIXTURE -- ze zijn niet te beproeven omdat er geen wereld
   is waarin ze kunnen draaien. De verleiding is om daar een grote crashwereld
   voor te bouwen. Deze proef doet het omgekeerde: EEN pad helemaal aflopen, en
   daaruit aflezen welke bouwstenen de andere zeven werkelijk nodig hebben. Een
   gedeelde fixture die je verzint voordat je er een keer echt doorheen bent
   gelopen, dekt de gevallen die je je kon voorstellen.

   HET PAD: pay.factuur.saldo (POST /api/pay/saldo). Gekozen omdat het het
   DUNSTE volledige geldpad is dat dit huis heeft -- het raakt vijf collecties
   in drie lagen (wallet, factuur, afdracht), het heeft een deterministische
   idem-sleutel, en het is de derde betaalweg naast de kaart en de munten, dus
   er hangt geen externe aanbieder aan die eerst nagebootst moet worden.

   DIT SLUIT SCENARIO 3 VAN GELDLAT.md. Dat document zet zeven stappen op een
   rij en stap 5 luidt: "Retry van dezelfde opdracht -> exact een financiele
   mutatie". test/saveduurzaam.js bewijst het INJECTIEPUNT (het proces sterft
   werkelijk na de duurzame schrijfactie) en zegt er in zoveel woorden bij dat
   de geldketen zelf nog open staat. Die stond op het moment van schrijven al
   aangesloten (GELDLAT.md, "Wat er inmiddels aan hangt": GELD -> lib/idem ->
   bijeen({duurzaam:true})), dus de vraag was meetbaar en was nooit gemeten.

   DE UITSLAGEN ZIJN DE HUISWOORDEN EN GEEN KALE NOEMER: PROVEN, FAILED,
   BLOCKED, NOT_APPLICABLE, UNKNOWN. Een stap die niet kon draaien meldt BLOCKED
   met de reden; hij telt nooit als gehaald en nooit als gezakt. Een teller die
   alleen "7 van de 9" zegt, laat niet zien of die twee ontbraken of faalden.

   Draaien:  npm run factuurproef            (print, zakt op FAILED)
             npm run factuurproef -- --json  (register op stdout)
   ========================================================================== */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const W = require('./lib/wegwerpserver.js');

/* De factuur uit de zaaiset. Staat hij er niet, dan STOPT de proef met BLOCKED
   in plaats van stil een andere te pakken: een proef die zijn eigen onderwerp
   verzint, meet iets anders dan hij zegt. */
const FACTUUR = 'RTG-2026-0207';
const ROUTE_PAD = '/api/pay/saldo';
const OPLADING = 20000;   // ruim boven het factuurbedrag (EUR 78,65)

/* DE GELDCOLLECTIES VAN DIT PAD. Niet alle tachtig uit effectcollecties.js:
   dit zijn de vijf die pay.factuur.saldo werkelijk raakt, empirisch vastgesteld
   door het pad een keer te draaien en het verschil te lezen. Een ruimere lijst
   zou de assertie zwakker maken (meer bakken die toch niet bewegen), een
   krappere zou een dubbele mutatie kunnen missen. */
const GELDBAKKEN = ['paySaldi', 'payBoekingen', 'invoices', 'fondsAfdrachten', 'socialeAfdrachten'];

/* WAT ER WEL MAG BEWEGEN BIJ EEN GEWEIGERDE HERHALING, en waarom dat hier staat
   in plaats van te worden weggefilterd. Een tweede poging laat een spoor na --
   dat is het audittrail en het HOORT te bewegen. Maar het staat met naam in de
   uitslag, want "we negeren de rest" is precies hoe een echte dubbele mutatie
   ongezien blijft. */
const SPOORBAKKEN = new Set(['apiSpoor', 'handelingLog', 'sessions', 'rtgai', 'doorgeefJournaal']);

async function post(basis, pad, lijf, tok) {
  const h = { 'content-type': 'application/json' };
  if (tok) h.authorization = 'Bearer ' + tok;
  try {
    const r = await fetch(basis + pad, { method: 'POST', headers: h, body: JSON.stringify(lijf || {}) });
    let j = null; try { j = await r.json(); } catch (e) { /* geen json */ }
    return { status: r.status, body: j || {} };
  } catch (e) {
    /* EEN VERBROKEN VERBINDING IS HIER EEN GELDIGE UITKOMST EN GEEN FOUT: het
       crashverraad doodt de server middenin het verzoek, en dat is exact het
       venster dat we willen meten. Status 0 betekent "de klant heeft nooit een
       antwoord gekregen" -- de toestand waarin hij het opnieuw gaat proberen. */
    return { status: 0, body: {}, fout: e.message };
  }
}

/* ---------------------------------------------------------------------------
   HET ECONOMISCH BEELD -- twee getuigen, met opzet.

   1. De VINGERAFDRUK (/api/techniek/vingerafdruk) geeft per collectie een
      aantal en een gezouten hash. Hij draagt met opzet geen bedragen, dus hij
      beantwoordt maar een vraag: BEWOOG er iets. Dat is precies de vraag voor
      "nul tweede boeking".
   2. De DOMEINROUTES van het lid zelf (pay/overzicht, privacy/export) geven de
      bedragen: saldo, boekingen, factuurstand. Dat is de vraag voor "dezelfde
      economische uitkomst".

   Twee bronnen en niet een, omdat ze verschillende faalvormen vangen: de
   vingerafdruk ziet een stille rij die geen enkele route toont, de bedragen
   zien een hash die toevallig gelijk blijft. En het lid leest zijn eigen
   gegevens langs zijn eigen routes -- er komt geen achterdeur bij.

   DE HASHES OVERLEVEN GEEN HERSTART. Het zout wordt per proces getrokken (zie
   server/lib/vingerafdruk.js, met reden). Over een crash heen zijn dus alleen
   de AANTALLEN en de bedragen vergelijkbaar, en dat staat in de uitslag.
   --------------------------------------------------------------------------- */
async function beeld(basis, tokLid, tokEig) {
  const vf = await post(basis, '/api/techniek/vingerafdruk', { detail: GELDBAKKEN }, tokEig);
  const ov = await post(basis, '/api/pay/overzicht', {}, tokLid);
  const ex = await post(basis, '/api/privacy/export', {}, tokLid);
  const facturen = (ex.body && ex.body.invoices) || [];
  const f = facturen.find(i => i && i.id === FACTUUR) || null;
  return {
    bereikbaar: vf.status === 200 && ov.status === 200,
    collecties: (vf.body && vf.body.collecties) || null,
    zoutId: (vf.body && vf.body.zoutId) || null,
    saldoCenten: ov.body && typeof ov.body.saldo === 'number' ? ov.body.saldo : null,
    boekingen: ov.body && Array.isArray(ov.body.geschiedenis) ? ov.body.geschiedenis.length : null,
    /* Alleen de boekingen die BIJ DEZE FACTUUR horen. Het totaal beweegt ook
       door de oplading, en dan meet je de opstelling in plaats van het pad. */
    factuurBoekingen: ov.body && Array.isArray(ov.body.geschiedenis)
      ? ov.body.geschiedenis.filter(b => String(b.oms || '').includes(FACTUUR)).length : null,
    factuurCenten: ov.body && Array.isArray(ov.body.geschiedenis)
      ? ov.body.geschiedenis.filter(b => String(b.oms || '').includes(FACTUUR))
        .reduce((s, b) => s + (Number(b.centen) || 0), 0) : null,
    factuurStand: f ? (f.status || null) : null,
    factuurDeelbetaald: f ? (Number(f.deelbetaald) || 0) : null,
    factuurBewijzen: f && Array.isArray(f.betaalBewijzen) ? f.betaalBewijzen.length : null
  };
}

/* Het verschil tussen twee beelden, gesplitst in GELD en SPOOR. Die splitsing
   is de hele inhoud: bewoog er iets in een geldbak, dan is dat een economische
   mutatie; bewoog er iets in een spoorbak, dan is dat het huis dat opschrijft
   dat er is aangeklopt. Wat in geen van beide lijsten staat komt apart terug
   als `overig` -- ongesorteerde beweging is een bevinding en geen ruis. */
function bakverschil(voor, na) {
  const a = (voor && voor.collecties) || {};
  const b = (na && na.collecties) || {};
  const geld = [], spoor = [], overig = [];
  const hashVergelijkbaar = voor.zoutId && na.zoutId && voor.zoutId === na.zoutId;
  for (const naam of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[naam], y = b[naam];
    const nVoor = x ? x.n : 0, nNa = y ? y.n : 0;
    const anders = nVoor !== nNa || (hashVergelijkbaar && x && y && x.h !== y.h);
    if (!anders) continue;
    const rij = { collectie: naam, nVoor, nNa, hashGewijzigd: hashVergelijkbaar && x && y ? x.h !== y.h : null };
    if (GELDBAKKEN.includes(naam)) geld.push(rij);
    else if (SPOORBAKKEN.has(naam)) spoor.push(rij);
    else overig.push(rij);
  }
  const srt = l => l.sort((p, q) => p.collectie < q.collectie ? -1 : 1);
  return { geld: srt(geld), spoor: srt(spoor), overig: srt(overig), hashVergelijkbaar };
}

/* ---------------------------------------------------------------------------
   DE OPSTELLING -- een wereld met een open factuur en een gevuld saldo.

   Dit is de bouwsteen waar de zeven geblokkeerde paden op wachten, en hij is
   hier met opzet zo KLEIN mogelijk gehouden: een lidsessie, een oplading, en
   een factuur die al in de zaaiset staat. Wat er niet nodig bleek, hoort ook
   niet in een gedeelde fixture terecht te komen.
   --------------------------------------------------------------------------- */
async function opstelling(datamap, extraEnv) {
  const srv = await W.start({ datamap, env: Object.assign({ RTG_DEMO: '1' }, extraEnv || {}) });
  const eig = await post(srv.basis, '/api/auth/login',
    { login: process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com', password: process.env.DEMO_PASS || 'Imran' });
  const lid = await post(srv.basis, '/api/login', { tier: 'rtg' });
  return { srv, tokEig: eig.body && eig.body.token, tokLid: lid.body && lid.body.token };
}

const stap = (nr, wat) => ({ nr, wat });

/* Een uitslag is altijd een van de vijf huiswoorden EN een reden. `PROVEN`
   zonder gemeten grond bestaat hier niet: elke stap draagt wat hij zag. */
function uitslag(s, stand, reden, gemeten) {
  return Object.assign({}, s, { stand, reden: reden || null, gemeten: gemeten || null });
}

/* ---------------------------------------------------------------------------
   FASE 1-3: het geldpad, de tweede aanroep, en de economische idempotentie.
   --------------------------------------------------------------------------- */
async function geldpad(uit) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-factuurproef-a-'));
  const { srv, tokEig, tokLid } = await opstelling(map);
  try {
    if (!tokEig || !tokLid) {
      uit.stappen.push(uitslag(stap(1, 'een wereld met een open factuur en een gevuld saldo'),
        'BLOCKED', 'geen ' + (!tokLid ? 'lidsessie' : 'eigenaarssessie') +
        '; zonder beide is er geen bedrag en geen vingerafdruk te lezen'));
      return;
    }
    /* STAP 1 -- de factuur bestaat en staat open. */
    const b0a = await beeld(srv.basis, tokLid, tokEig);
    if (b0a.factuurStand !== 'open') {
      uit.stappen.push(uitslag(stap(1, 'de factuur ' + FACTUUR + ' bestaat en staat open'),
        'BLOCKED', 'de zaaiset levert hem niet open op (stand: ' + b0a.factuurStand + ')', b0a.factuurStand));
      return;
    }
    const op = await post(srv.basis, '/api/pay/oplaad', { centen: OPLADING, idem: 'factuurproef-oplaad' }, tokLid);
    const b0 = await beeld(srv.basis, tokLid, tokEig);
    uit.stappen.push(uitslag(stap(1, 'de factuur ' + FACTUUR + ' bestaat en staat open, en het saldo dekt hem'),
      op.status === 200 && b0.saldoCenten >= 7865 ? 'PROVEN' : 'BLOCKED',
      op.status === 200 ? null : 'opladen gaf ' + op.status,
      { factuurStand: b0.factuurStand, saldoCenten: b0.saldoCenten }));
    if (op.status !== 200) return;

    /* STAP 2 -- het geldpad uitvoeren. */
    const r1 = await post(srv.basis, '/api/pay/saldo', { invoiceId: FACTUUR }, tokLid);
    const b1 = await beeld(srv.basis, tokLid, tokEig);
    const v1 = bakverschil(b0, b1);
    const heel = b1.factuurStand === 'paid'
      && b1.saldoCenten === b0.saldoCenten - 7865
      && b1.factuurBoekingen === 1 && b1.factuurCenten === -7865;
    uit.stappen.push(uitslag(stap(2, 'het geldpad voert uit: saldo af, factuur dicht, afdracht geboekt'),
      r1.status === 200 && heel ? 'PROVEN' : 'FAILED',
      r1.status === 200 ? (heel ? null : 'de uitkomst is niet heel') : 'de route gaf ' + r1.status,
      { status: r1.status, saldoVoor: b0.saldoCenten, saldoNa: b1.saldoCenten,
        factuurStand: b1.factuurStand, geldbakken: v1.geld }));

    /* STAP 3 -- DE TWEEDE AANROEP, EN HIER ZIT DE HELE PROEF IN.

       De assertie is NIET dat de route 409 geeft. Hij is dat GEEN ENKELE
       geldcollectie beweegt: gelijk aantal en gelijke hash op alle vijf. Een
       weigering die onderweg al twee bakken had aangeraakt, zakt hier -- en
       die faalvorm is met een statuscontrole niet te zien. */
    const r2 = await post(srv.basis, '/api/pay/saldo', { invoiceId: FACTUUR }, tokLid);
    const b2 = await beeld(srv.basis, tokLid, tokEig);
    const v2 = bakverschil(b1, b2);
    const stil = v2.geld.length === 0
      && b2.saldoCenten === b1.saldoCenten
      && b2.factuurBoekingen === b1.factuurBoekingen
      && b2.factuurCenten === b1.factuurCenten
      && b2.factuurDeelbetaald === b1.factuurDeelbetaald
      && b2.factuurBewijzen === b1.factuurBewijzen;
    uit.stappen.push(uitslag(stap(3, 'een identieke tweede aanroep verplaatst nul waarde'),
      stil ? 'PROVEN' : 'FAILED',
      stil ? null : 'er bewoog geld bij een herhaling: ' + v2.geld.map(g => g.collectie).join(', '),
      { status: r2.status, geldbakkenBewogen: v2.geld, spoorBakken: v2.spoor.map(s2 => s2.collectie),
        overigeBakken: v2.overig, saldoCenten: b2.saldoCenten, factuurStand: b2.factuurStand }));
    uit.idempotent = stil;
    uit.economischeUitkomst = { saldoCenten: b1.saldoCenten, factuurStand: b1.factuurStand,
      factuurCenten: b1.factuurCenten, afdrachten: b1.collecties && b1.collecties.fondsAfdrachten
        ? b1.collecties.fondsAfdrachten.n : null };
  } finally {
    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(map, { recursive: true, force: true });
  }
}

/* ---------------------------------------------------------------------------
   FASE 4-6: het crashpunt, de herstart, en de herhaling erna.

   HET CRASHPUNT WORDT NIET VERZONNEN. `sterf-na-commit` staat al in de
   verraadsmotor (server/lib/verraad.js) en is ingebouwd op de enige plek waar
   het eenduidig aan te wijzen is: server/db/duurzaam.js, na de bevestigde
   duurzame schrijfactie en voor het antwoord. Er komt voor deze proef dus GEEN
   testhaak in productiecode -- dat is precies de vorm die dit huis elders
   `een pad om de grens heen` noemt.

   WAAROM DE SERVER OPNIEUW OP DEZELFDE DATAMAP START. De opstelling (inloggen,
   opladen) schrijft zelf duurzaam, dus met het verraad al aan sterft de server
   voordat de proef bij het geldpad is. De opstelling draait daarom schoon, en
   pas de tweede start draagt het verraad. Dezelfde truc gebruikt de ketenronde.
   --------------------------------------------------------------------------- */
async function crashpad(uit) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-factuurproef-b-'));
  let srv = null;
  try {
    const a = await opstelling(map);
    srv = a.srv;
    if (!a.tokLid || !a.tokEig) {
      uit.stappen.push(uitslag(stap(4, 'het proces sterft na de duurzame boeking en voor het antwoord'),
        'BLOCKED', 'geen sessie in de opstelling'));
      return;
    }
    const op = await post(srv.basis, '/api/pay/oplaad', { centen: OPLADING, idem: 'factuurproef-crash-oplaad' }, a.tokLid);
    const voor = await beeld(srv.basis, a.tokLid, a.tokEig);
    if (op.status !== 200 || voor.factuurStand !== 'open') {
      uit.stappen.push(uitslag(stap(4, 'het proces sterft na de duurzame boeking en voor het antwoord'),
        'BLOCKED', 'de wereld kwam niet op de verwachte beginstand'));
      return;
    }
    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    await new Promise(r => setTimeout(r, 800));

    /* STAP 4 -- het crashpunt. */
    srv = (await W.start({ datamap: map, magSterven: true, wachtMs: 30000,
      env: { RTG_DEMO: '1', RTG_VERRAAD: 'sterf-na-commit', RTG_VERRAAD_SEED: '20260912' } }));
    if (srv.dood) {
      uit.stappen.push(uitslag(stap(4, 'het proces sterft na de duurzame boeking en voor het antwoord'),
        'BLOCKED', 'de server stierf al tijdens het opstarten; dan meet de crash de opstart en niet het geldpad'));
      return;
    }
    const tokLid = (await post(srv.basis, '/api/login', { tier: 'rtg' })).body.token;
    const r = await post(srv.basis, '/api/pay/saldo', { invoiceId: FACTUUR }, tokLid);
    await new Promise(res => setTimeout(res, 500));
    const gestorven = srv.kind.exitCode !== null || srv.kind.signalCode !== null;
    uit.stappen.push(uitslag(stap(4, 'het proces sterft na de duurzame boeking en voor het antwoord'),
      r.status === 0 && gestorven ? 'PROVEN' : 'FAILED',
      r.status === 0 ? (gestorven ? null : 'de verbinding brak maar het proces leeft nog')
        : 'de klant kreeg antwoord ' + r.status + '; het crashpunt sloeg niet aan op dit pad',
      { statusBijKlant: r.status, fout: r.fout || null, signaal: srv.kind.signalCode }));
    if (!(r.status === 0 && gestorven)) return;
    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    await new Promise(res => setTimeout(res, 800));

    /* STAP 5 -- de herstart, en de invariant die ertoe doet.

       De vraag is NIET "staat het geld er nog". Allebei de uitkomsten zijn
       geldig zolang ze HEEL zijn:

         de boeking overleefde  -> saldo af   EN factuur dicht EN afdracht
         de boeking overleefde niet -> saldo heel EN factuur open EN geen afdracht

       Wat nooit mag is de helft: geld af met een open factuur zonder
       deelbetaling, of een afdracht zonder boeking. Die uitkomst is de
       duurste die er is, want het grootboek sluit dan met zichzelf terwijl
       een lid betaald heeft voor niets (GELDLAT.md, "Wat er is weerlegd"). */
    srv = await W.start({ datamap: map, env: { RTG_DEMO: '1' } });
    /* EVEN WACHTEN VOOR DE METING, en dat is geen slordigheid maar het
       tegendeel: bestond er een herstelronde die halve betalingen bij de start
       opruimt, dan zou meteen meten hem missen en zou deze stap een defect
       melden dat er niet is. Drie seconden is ruim voor alles wat bij de start
       gepland wordt; blijft de toestand dan half, dan is er geen opruimer. */
    await new Promise(res => setTimeout(res, 3000));
    const t2 = (await post(srv.basis, '/api/login', { tier: 'rtg' })).body.token;
    const e2 = (await post(srv.basis, '/api/auth/login',
      { login: process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com', password: process.env.DEMO_PASS || 'Imran' })).body.token;
    const na = await beeld(srv.basis, t2, e2);
    const afdrachten = na.collecties && na.collecties.fondsAfdrachten ? na.collecties.fondsAfdrachten.n : null;
    const doorgegaan = na.factuurStand === 'paid' && na.saldoCenten === voor.saldoCenten - 7865
      && na.factuurBoekingen === 1 && afdrachten === 1;
    const nietGebeurd = na.factuurStand === 'open' && na.saldoCenten === voor.saldoCenten
      && na.factuurBoekingen === 0 && afdrachten === 0;
    uit.stappen.push(uitslag(stap(5, 'na de herstart is de uitkomst HEEL: helemaal gebeurd of helemaal niet'),
      doorgegaan || nietGebeurd ? 'PROVEN' : 'FAILED',
      doorgegaan ? null : nietGebeurd ? null : 'de crash liet een halve uitkomst achter',
      { uitkomst: doorgegaan ? 'volledig doorgegaan' : nietGebeurd ? 'volledig niet gebeurd' : 'HALF',
        saldoVoor: voor.saldoCenten, saldoNa: na.saldoCenten, factuurStand: na.factuurStand,
        factuurBoekingen: na.factuurBoekingen, afdrachten }));
    uit.crashUitkomst = doorgegaan ? 'doorgegaan' : nietGebeurd ? 'niet-gebeurd' : 'half';

    /* STAP 6 -- de herhaling na de crash: scenario 3 van GELDLAT.md.

       De klant heeft nooit een antwoord gehad en probeert het opnieuw. Over
       crash en herhaling heen mag er exact EEN economische mutatie staan. */
    const naHer = await (async () => {
      const r3 = await post(srv.basis, '/api/pay/saldo', { invoiceId: FACTUUR }, t2);
      const b3 = await beeld(srv.basis, t2, e2);
      return { r3, b3 };
    })();
    const af3 = naHer.b3.collecties && naHer.b3.collecties.fondsAfdrachten ? naHer.b3.collecties.fondsAfdrachten.n : null;
    const eenmaal = naHer.b3.factuurStand === 'paid'
      && naHer.b3.saldoCenten === voor.saldoCenten - 7865
      && naHer.b3.factuurBoekingen === 1 && naHer.b3.factuurCenten === -7865
      && af3 === 1 && naHer.b3.factuurBewijzen === 1;
    uit.stappen.push(uitslag(stap(6, 'de herhaling na de crash levert over alles heen exact EEN mutatie'),
      eenmaal ? 'PROVEN' : 'FAILED',
      eenmaal ? null : 'over crash en herhaling heen staat er niet exact een mutatie',
      { status: naHer.r3.status, saldoCenten: naHer.b3.saldoCenten, factuurStand: naHer.b3.factuurStand,
        factuurBoekingen: naHer.b3.factuurBoekingen, factuurCenten: naHer.b3.factuurCenten,
        betaalBewijzen: naHer.b3.factuurBewijzen, afdrachten: af3 }));
  } finally {
    try { if (srv) srv.kind.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(map, { recursive: true, force: true });
  }
}

/* ---------------------------------------------------------------------------
   FASE 7: de terugweg, en waarom hij hier UNKNOWN mag heten.

   HERSTELBESLUIT.json kent vijf correctiemodellen: REVERSIBLE, COMPENSATABLE,
   FINAL, NOT_APPLICABLE, UNKNOWN. De verleiding is om dit pad FINAL te noemen
   -- er is immers geen knop. Dat zou een BESLUIT zijn dat als meting wordt
   opgeschreven, en het verschil tussen die twee is precies wat dit huis elders
   bewaakt: het bewijs draagt een voorstel, een mens draagt het besluit.

   Deze stap meet daarom alleen wat er IS, en wel twee dingen:

     1. bestaat er een tegenhanger?  HERSTEL.json leidt kandidaten af uit de
        NAAM van een route, en noemt /api/pay/saldo niet -- nul kandidaten.
        Niets komt boven `vermoed` uit een naam, dus zonder kandidaat is er
        ook niets uit te voeren.
     2. bestaat de compenserende BOUWSTEEN?  Ja: pay.huisUit (huis -> lid) is
        de spiegel van de pay.huisIn die dit pad gebruikt, en hij heeft echte
        aanroepers -- terugkoop en herroeping bij Assets, en de puntenkant.
        Geen ervan hangt aan een factuur.

   De bevinding is dus scherper dan "geen terugweg": de bouwsteen ligt er en de
   bedrading ontbreekt. Dat is een ander gesprek dan een onmogelijkheid, en het
   is het gesprek dat de eigenaar hoort te voeren.
   --------------------------------------------------------------------------- */
function terugweg(uit) {
  let kandidaten = null, primitive = null;
  try {
    const h = require('../HERSTEL.json');
    const rijen = (h && h.per) || [];
    kandidaten = (Array.isArray(rijen) ? rijen : Object.values(rijen))
      .filter(r => r && String(r.route || r.heen || '').includes('/api/pay/saldo')).length;
  } catch (e) { kandidaten = null; }
  try {
    primitive = /huisUit/.test(fs.readFileSync(path.join(W.WORTEL, 'server/kern/pay/verzoeken.js'), 'utf8'));
  } catch (e) { primitive = null; }
  /* HET BESLUIT IS GENOMEN, EN DE PROEF LEEST HET IN PLAATS VAN HET TE HERHALEN.

     Tot 12 september stond hier UNKNOWN met als grond dat FINAL een besluit van
     de eigenaar zou zijn en geen meting. Dat besluit is er nu
     (HERSTELBESLUIT.json `beleid`: append-only, compensatie als standaard), en
     deze route is verklaard als COMPENSATABLE.

     Dat maakt de stap niet PROVEN. Een VERKLARING is geen uitgevoerde terugweg,
     en er is nog steeds niets uit te voeren: nul kandidaten in HERSTEL.json, en
     de compenserende bouwsteen pay.huisUit heeft geen aanroeper op een factuur.
     De stand is dus BLOCKED -- met, zoals het register eist, wat er moet komen. */
  let besluit = null;
  try {
    const b = require('../HERSTELBESLUIT.json');
    besluit = (b.routes && (b.routes['POST ' + ROUTE_PAD] || b.routes[ROUTE_PAD])) || null;
  } catch (e) { besluit = null; }
  // Deze stap voert geen compensatie uit. Ook een gewijzigde verklaring kan
  // daarom nooit bewijs uit deze proef opleveren.
  const stand = !besluit ? 'UNKNOWN' : 'BLOCKED';
  uit.stappen.push(uitslag(stap(7, 'de terugweg: is deze betaling terug te draaien of te compenseren'),
    stand,
    !besluit ? 'er is geen verklaring voor dit pad in HERSTELBESLUIT.json'
      : 'verklaard als ' + besluit.stand + ', maar er is niets uit te voeren: ' +
        (besluit.bewijs && besluit.bewijs.watErMoetKomen) +
        ' -- een verklaring is geen uitgevoerde terugweg.',
    { kandidatenInHerstelRegister: kandidaten, compenserendePrimitiveAanwezig: primitive,
      correctiemodel: besluit ? besluit.stand : 'UNKNOWN',
      bewijsVanDeTerugweg: besluit && besluit.bewijs ? besluit.bewijs.stand : null }));
  uit.correctiemodel = besluit ? besluit.stand : 'UNKNOWN';
}

/* ---------------------------------------------------------------------------
   DE RONDE.
   --------------------------------------------------------------------------- */
async function meet() {
  const uit = { instrument: 'factuurproef', pad: 'pay.factuur.saldo', route: 'POST /api/pay/saldo',
    factuur: FACTUUR, geldbakken: GELDBAKKEN, gemetenOp: new Date().toISOString(),
    stappen: [], idempotent: null, crashUitkomst: null, correctiemodel: null };
  await geldpad(uit);
  await crashpad(uit);
  terugweg(uit);
  /* ---------------------------------------------------------------------------
     DE CRASHUITSLAG, TEGEN DE TAXONOMIE EN NIET ALS EEN WOORD.

     "crash-herstel: PROVEN" is een bewering over EEN moment, en welk moment dat
     was is precies wat er niet in past. ./lib/crashtaxonomie.js houdt de drie
     contracten en de gesloten lijst crashgrenzen op EEN plek; hier wordt alleen
     gezegd welke grens deze proef heeft aangeraakt en wat eruit kwam.

     Deze proef raakt er EEN: `na-commit-voor-antwoord`. Dat is wat
     RTG_VERRAAD=sterf-na-commit nabootst, en het is met opzet de gemeenste --
     maar het is er een van zes, en de uitslag heet daarom PROVEN_PARTIAL met
     de open grenzen ernaast.

     ATOMIC en RECOVERABLE komen uit TWEE VERSCHILLENDE stappen, en ze worden
     niet samengevoegd: stap 5 zegt of de uitkomst heel was (atomair), stap 6
     of RTG er daarna deterministisch op verder kon (herstelbaar). Een route kan
     het eerste halen en het tweede niet. EXTERNALLY_RECONCILABLE blijft
     UNKNOWN: er is geen aanbieder in deze opstelling, dus er valt niets te
     verzoenen -- en dat is geen nul maar een ontbrekende meting. */
  const tax = require('./lib/crashtaxonomie.js');
  const stapStand = (nr) => (uit.stappen.find(x => x.nr === nr) || {}).stand || 'UNKNOWN';
  const atomair = stapStand(5), herstel = stapStand(6);
  uit.crash = {
    contracten: {
      ATOMIC: atomair,
      RECOVERABLE: herstel,
      EXTERNALLY_RECONCILABLE: 'UNKNOWN'
    },
    contractReden: {
      ATOMIC: 'stap 5: na de herstart is de uitkomst heel, of hij is het niet',
      RECOVERABLE: 'stap 6: de herhaling na de crash levert over alles heen exact EEN mutatie',
      EXTERNALLY_RECONCILABLE: 'niet gemeten: deze opstelling kent geen aanbieder, dus er is niets te verzoenen. ' +
        'Geen providersleutel gezet betekent hier geen nul maar een ontbrekende meting.'
    },
    /* Alleen de grens die werkelijk is aangeraakt krijgt een uitslag, en die is
       de STRENGSTE van de twee contracten die eraan hangen -- zakt een van
       beide, dan is de grens niet gehaald. */
    grenzen: { 'na-commit-voor-antwoord': (atomair === 'PROVEN' && herstel === 'PROVEN') ? 'PROVEN'
      : (atomair === 'FAILED' || herstel === 'FAILED') ? 'FAILED' : 'UNKNOWN' }
  };
  uit.crash.uitslag = tax.weeg(uit.crash.grenzen);

  const t = { stappen: uit.stappen.length, PROVEN: 0, FAILED: 0, BLOCKED: 0, NOT_APPLICABLE: 0, UNKNOWN: 0 };
  for (const s of uit.stappen) t[s.stand] = (t[s.stand] || 0) + 1;
  uit.telling = t;
  /* ZAKKEN DOET HIJ OP FAILED, EN NIET OP EEN NOEMER. Een stap die niet kon
     draaien (BLOCKED) of die eerlijk onbekend is (UNKNOWN) maakt de ronde niet
     rood -- maar hij maakt hem ook niet groen: `bewezen` en `gehaald` zijn twee
     velden en worden nooit tot een cijfer samengevoegd. */
  uit.gezakt = t.FAILED > 0;
  uit.volledigBewezen = t.FAILED === 0 && t.BLOCKED === 0 && t.UNKNOWN === 0;
  return uit;
}

function druk(u) {
  console.log('factuurproef (' + u.route + '): ' + u.telling.stappen + ' stappen -- ' +
    u.telling.PROVEN + ' PROVEN, ' + u.telling.FAILED + ' FAILED, ' + u.telling.BLOCKED + ' BLOCKED, ' +
    u.telling.UNKNOWN + ' UNKNOWN.');
  for (const s of u.stappen) {
    console.log('  ' + String(s.nr).padStart(2) + '. [' + s.stand.padEnd(14) + '] ' + s.wat);
    if (s.reden) console.log('      ' + s.reden);
  }
  if (u.crash) {
    console.log('\n  crash-herstel: ' + u.crash.uitslag.stand + ' -- ' + u.crash.uitslag.waarom);
    for (const [c, st] of Object.entries(u.crash.contracten)) console.log('     ' + c.padEnd(26) + st);
  }
  console.log(u.gezakt ? '\nEr is een stap GEZAKT: er bewoog geld waar dat niet mocht.'
    : u.volledigBewezen ? '\nHet hele pad is bewezen.'
      : '\nGeen enkele stap zakte; ' + (u.telling.BLOCKED + u.telling.UNKNOWN) +
        ' staan open met een reden en tellen niet als bewijs.');
}

/* HET REGISTER, en waarom hij er een schrijft.

   scripts/gelddekking.js stelt de vijf assen samen uit registers -- GELDKAART,
   MUTATIECONTRACT, IDEMPROEF, HERSTELPROEF. Zonder eigen register zou de meting
   van deze proef alleen in een terminal staan, en dan moest een MENS de uitslag
   overtypen in een `stand`. Precies dat is wat dit huis nergens wil: een
   verklaring die zich op een meting beroept die nergens te lezen is.

   Het stempel komt uit ./lib/stempel.js en is niet zelfgemaakt -- inclusief
   `boomVuil`, want een ronde op een ongecommitte boom hoort niet bij die commit. */
function schrijf(u) {
  const { stempel } = require('./lib/stempel');
  const register = Object.assign({
    soort: 'proef',
    uitleg: 'Een geldpad van begin tot eind, ECONOMISCH gemeten: niet de status van de route ' +
      'maar de toestand van de vijf geldcollecties eromheen. Zeven stappen, waaronder een ' +
      'crashpunt uit de verraadsmotor (sterf-na-commit) en de herhaling erna. ' +
      'Zie GELDLAT.md, "Scenario 3, gemeten op een echt geldpad".',
    grens: 'DIT IS EEN PAD EN GEEN DEKKING. Wat hier bewezen is, geldt voor POST /api/pay/saldo ' +
      'en voor niets anders. De hashes van de vingerafdruk zijn per proces gezouten, dus over ' +
      'de crash heen zijn alleen aantallen en bedragen vergelijkbaar -- dat staat per stap in ' +
      'de meting. En `PROVEN` op stap 3 gaat over de tweede aanroep, nooit over de crashwindow.',
    stempel: stempel()
  }, u);
  fs.writeFileSync(path.join(W.WORTEL, 'FACTUURPROEF.json'), JSON.stringify(register, null, 2) + '\n');
  return register;
}

if (require.main === module) {
  meet().then(u => {
    if (process.argv.includes('--vastleggen')) { schrijf(u); console.log('FACTUURPROEF.json geschreven.'); }
    if (process.argv.includes('--json')) { console.log(JSON.stringify(u, null, 1)); }
    else druk(u);
    process.exit(u.gezakt ? 1 : 0);
  }).catch(e => { console.error('factuurproef: ' + e.message); process.exit(2); });
}

module.exports = { FACTUUR, GELDBAKKEN, SPOORBAKKEN, beeld, bakverschil, post, opstelling,
  geldpad, crashpad, terugweg, meet, schrijf, uitslag, stap };

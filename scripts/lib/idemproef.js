/* ============================================================================
   DE IDEMPOTENTIEPROEF -- doet dezelfde oproep twee keer ook twee keer iets?

   DE KOLOM DIE DIT VULT. In de bewijsmatrix staat IDEMPOTENCY op ongemeten voor
   elke schrijfroute, met als opdracht: "elke schrijfroute twee keer met dezelfde
   sleutel". Dat is de handeling. De moeilijkheid zit niet in het twee keer
   sturen maar in het KIJKEN: waaraan zie je van buitenaf dat er een tweede keer
   iets is gebeurd?

   DRIE OPROEPEN, TWEE SLEUTELS -- en de derde is de ijking.

     A   met sleutel K1          het echte werk
     B   met sleutel K1 opnieuw  de herhaling die niets nieuws mag doen
     C   met sleutel K2 (vers)   een NIEUWE opdracht

   Wat C oplevert is het meetinstrument. Verschilt C van A, dan is het antwoord
   van deze route gevoelig voor een nieuwe oproep -- en pas dan zegt het iets
   dat B gelijk is aan A. Is C gelijk aan A, dan verandert het antwoord sowieso
   niet per oproep, en dan zou een tweede effect hier niet te zien zijn: dat is
   ONGEMETEN en geen groen.

   Dit is LAT.md regel 10 (een meter die je niet hebt zien uitslaan, meet niets)
   toegepast PER ROUTE in plaats van een keer aan het begin van de ronde. Zonder
   die per-route-ijking zou deze proef duizenden routes groen melden waarvan hij
   het antwoord nooit had zien bewegen.

   EN WAAROM TIJDSTEMPELS HIER GEEN PROBLEEM ZIJN. Een route die de tijd in zijn
   antwoord echoot, geeft bij B een ander antwoord dan bij A -- tenzij de
   idempotentielaag het BEWAARDE antwoord teruggeeft, en dat is precies wat
   server/lib/idem.js doet. Een echo van de klok maakt deze proef dus scherper in
   plaats van valser: hij verraadt of het antwoord opnieuw is berekend.

   VIER STANDEN, en alleen de eerste is een bewijs:

     beschermd    B gaf hetzelfde als A terwijl C wel verschilde -- of B kwam
                  terug met `herhaald: true`, het merk van server/lib/idem.js.
     onbeschermd  B deed het gewoon nog een keer. Dat is niet per se een defect
                  (twee notities maken mag), maar het is wel het tegendeel van
                  de belofte in deze kolom, en het hoort geteld te worden.
     ongemeten    A kwam niet door (400/403/503: geen werk, dus geen herhaling
                  te beoordelen), of het antwoord bleek niet gevoelig voor een
                  nieuwe oproep.
     GEZAKT       bestaat hier NIET als aparte stand. Zie de grens onderaan:
                  deze proef meet wat er is, en of "onbeschermd" een defect is,
                  hangt van de route af -- dat oordeel hoort niet in een teller.
   ========================================================================== */
'use strict';

/* De vergelijking. Bewust op de hele JSON-tekst en niet op losse velden: elk
   veld dat je uitzondert is een plek waar een tweede effect zich kan verstoppen.
   De sleutelvolgorde wordt gelijkgetrokken, want die is geen betekenis. */
function normaliseer(waarde) {
  const orden = (v) => {
    if (Array.isArray(v)) return v.map(orden);
    if (v && typeof v === 'object') {
      const uit = {};
      for (const k of Object.keys(v).sort()) uit[k] = orden(v[k]);
      return uit;
    }
    return v;
  };
  try { return JSON.stringify(orden(waarde)); } catch (e) { return String(waarde); }
}

const gelijk = (a, b) => normaliseer(a) === normaliseer(b);
const isOk = (st) => st && st.status >= 200 && st.status < 300;

/* HET TWEEDE MEETPUNT: DE OPSLAG (TAKEN.md 4.30).

   Een route die bij elke oproep hetzelfde antwoord geeft, verraadt van buitenaf
   niet of hij twee keer heeft gewerkt -- en dat gold voor 768 routes. Maar de
   OPSLAG verraadt het wel. Met RTG_STAATLOG=1 draagt elk antwoord een kop met
   de lengte per collectie (server/staatlog.js); `staat` is het VERSCHIL dat elk
   van de drie oproepen achterliet, met de ruis er al uit geijkt.

   Drie uitkomsten, en de derde is een weigering:
     - de eerste oproep veranderde niets -> null. Dan is er geen tweede effect om
       te zien: een leesroute, of een die alleen op zijn plaats bijwerkt. Dit
       meetpunt kan die twee niet uit elkaar houden en doet dus geen uitspraak.
     - de eerste voegde iets toe en de herhaling niets -> beschermd.
     - allebei voegden iets toe -> onbeschermd. */
function beschrijfDelta(d) {
  return Object.entries(d).map(([k, n]) => (n > 0 ? '+' : '') + n + ' in ' + k).join(', ');
}
const TEGENSPRAAK = 'het antwoord meldt een herkende herhaling, maar de opslag groeide: ';
function staatOordeel(staat) {
  if (!staat || !staat.a || !staat.b) return null;
  if (!Object.keys(staat.a).length) return null;
  if (!Object.keys(staat.b).length) {
    return { stand: 'beschermd', bron: 'opslag',
      reden: 'het antwoord reageert niet op een nieuwe oproep, maar de OPSLAG wel: ' +
      'de eerste oproep gaf ' + beschrijfDelta(staat.a) + ' en de herhaling niets' };
  }
  return { stand: 'onbeschermd', bron: 'opslag',
    reden: 'gezien aan de opslag: de eerste oproep gaf ' + beschrijfDelta(staat.a) +
    ' en de herhaling opnieuw ' + beschrijfDelta(staat.b) };
}

/* HET OORDEEL, apart en puur -- los toetsbaar in test/idemproef.test.js.
   `a`, `b` en `c` zijn de drie antwoorden uit de kop; `staat` is optioneel en
   draagt het per-oproep verschil in de opslag (zie hierboven). */
function weegHerhaling(a, b, c, staat) {
  if (!isOk(a)) {
    return { stand: 'ongemeten', reden: 'de eerste oproep deed geen werk (status ' + ((a && a.status) || 0) + ')' };
  }
  /* HET MERK VAN DE IDEMPOTENTIELAAG. server/lib/idem.js zet `herhaald: true` op
     een antwoord dat uit de bewaarde sleutel komt. Dat is geen gevolgtrekking
     maar een mededeling van de server zelf, en dus het sterkste bewijs dat er
     is -- sterker dan welke vergelijking ook. */
  if (b && b.data && b.data.herhaald === true) {
    return { stand: 'beschermd', reden: 'de server merkte de herhaling zelf (herhaald: true)' };
  }
  if (!isOk(b)) {
    /* Een herhaling die wordt GEWEIGERD is ook geen tweede effect. Maar het is
       een ander mechanisme dan herkennen, en dat verschil hoort zichtbaar. */
    return { stand: 'beschermd', reden: 'de herhaling werd geweigerd (status ' + b.status + ')' };
  }
  if (!isOk(c)) {
    return { stand: 'ongemeten', reden: 'de ijkoproep met een verse sleutel kwam niet door; ' +
      'zonder die vergelijking zegt een gelijk antwoord niets' };
  }
  if (gelijk(a.data, c.data)) {
    /* Hier hield deze proef op. Nu kijkt hij eerst naar de opslag -- en pas als
       die ook niets kan zeggen, blijft het ongemeten. */
    const s = staatOordeel(staat);
    if (s) return s;
    return { stand: 'ongemeten', reden: staat
      ? 'het antwoord verandert niet per oproep, en de eerste oproep veranderde de opslag niet: ' +
        'een leesroute, of een die alleen op zijn plaats bijwerkt -- dat verschil ziet dit meetpunt niet'
      : 'het antwoord verandert niet per oproep; een tweede effect zou hier niet te zien zijn' };
  }
  if (gelijk(a.data, b.data)) {
    return { stand: 'beschermd', reden: 'de herhaling gaf hetzelfde antwoord terwijl een verse sleutel ' +
      'een ander gaf' };
  }
  return { stand: 'onbeschermd', reden: 'de herhaling gaf een ander antwoord: hij deed het opnieuw' };
}

async function draaiIdemproef({ post, routes, tokenVoor, lijfVoor, hernieuw, maxRoutes, staatVan, vastlegging }) {
  const perRoute = {};
  let gedaan = 0, hernieuwd = 0, uitOpslag = 0;
  const tel = { beschermd: 0, onbeschermd: 0, ongemeten: 0 };
  const tegenspraken = [];

  for (const r of routes) {
    if (maxRoutes && Object.keys(perRoute).length >= maxRoutes) break;
    const k1 = 'idemproef-' + r.pad.replace(/\W+/g, '') + '-1';
    const k2 = 'idemproef-' + r.pad.replace(/\W+/g, '') + '-2';
    const lijf = lijfVoor(r);

    const doe = async (sleutel) => {
      let st = await post(r.pad, { ...lijf, idem: sleutel, idempotentieSleutel: sleutel }, tokenVoor(r.rol));
      gedaan++;
      /* Een dood token maakt van elke volgende route een 401, en dan meldt de
         ronde "niets gemeten" over honderden routes zonder dat iets klaagt --
         dezelfde meetfout als in de invoerproef, en dezelfde reparatie. */
      if (st.status === 401 && hernieuw) {
        if (await hernieuw(r.rol)) { hernieuwd++; st = await post(r.pad, { ...lijf, idem: sleutel, idempotentieSleutel: sleutel }, tokenVoor(r.rol)); gedaan++; }
      }
      return st;
    };

    /* De opslagstand tussen de oproepen door. `staatVan` geeft het verschil dat
       DIE oproep achterliet, met de geijkte ruis er al uit. Zonder de vlag is
       hij er niet en werkt de proef als vanouds op alleen het antwoord. */
    const a = await doe(k1); const dA = staatVan ? staatVan(a) : null;
    const b = await doe(k1); const dB = staatVan ? staatVan(b) : null;
    const c = await doe(k2); const dC = staatVan ? staatVan(c) : null;
    const staat = staatVan ? { a: dA, b: dB, c: dC } : null;
    const o = weegHerhaling(a, b, c, staat);
    if (o.bron === 'opslag') uitOpslag++;
    tel[o.stand]++;
    const rij = { methode: r.method, pad: r.pad, rol: r.rol,
      idempotentie: o.stand, reden: o.reden, statussen: [a.status, b.status, c.status] };
    if (o.bron) rij.bron = o.bron;
    if (staat) rij.opslag = { a: dA, b: dB, c: dC };

    /* DE TEGENSPRAAK. Het antwoord kan zeggen dat de herhaling is herkend
       terwijl de opslag laat zien dat er tóch iets bij kwam. Dat is een sterker
       signaal dan beide meetpunten apart: een route die "herhaald: true" meldt
       en ondertussen doorwerkt, is precies het geval dat je nooit uit een
       antwoord zou halen. Het maakt de proef niet rood -- het is een bevinding
       en geen blindheid -- maar het staat bij naam in het register. */
    if (staat && o.stand === 'beschermd' && dB && Object.keys(dB).length) {
      rij.tegenspraak = TEGENSPRAAK + beschrijfDelta(dB);
      tegenspraken.push(r.method + ' ' + r.pad);
    }
    perRoute[r.method + ' ' + r.pad] = rij;
  }

  /* ============================================================================
     DE VASTLEGGING IS GEEN WERK -- en dat is een BESLUIT, geen slimmigheid.

     Sommige collecties krijgen een regel bij elke HANDELING: `kantoorAudit`
     (wie deed wat aan het kantoor), `commandJournaal`, `securityLog`. Die
     groeien +1 bij de eerste oproep EN bij de herhaling, en dan meldt het
     opslag-meetpunt "onbeschermd" terwijl het alleen de VASTLEGGING heeft
     gezien en niet het werk. Twee keer een schakelaar op AAN zetten hoort twee
     auditregels te geven; de eindstand is toch dezelfde.

     HIER STOND EERST EEN HEURISTIEK, en die is gemeten en weggegooid: "een
     collectie die meebeweegt bij vier van de vijf oproepen die iets deden".
     Over de echte ronde vond die er NUL. `kantoorAudit` groeide bij elf van de
     zestig werkende oproepen (18%), `commandJournaal` bij zes (10%) -- want een
     auditlog van het kantoor groeit alleen bij kantoorroutes. Een drempel die
     daar wel op past, pakt `payBoekingen` mee, en dan verdwijnt er bewijs over
     GELD achter een slimmigheid. LAT.md: een zeef die te veel wegvangt is erger
     dan een die niets doet, want hij ziet eruit als bescherming.

     Dus staat het in IDEMBESLUIT.json, met per collectie de reden -- naast de
     besluiten per route, waar de rest van dit oordeel ook woont. Een lijst
     veroudert, ja: komt er een journaal bij, dan meldt deze proef die route
     onbeschermd. Dat is de VEILIGE kant van verouderen -- te veel melden, niet
     te weinig.

     EN DE LIJST WORDT GECONTROLEERD, want een handgeschreven lijst kan worden
     opgerekt om een bevinding te laten verdwijnen. Een vastlegging groeit onder
     routes die verder niets met elkaar te maken hebben; domeinwerk groeit onder
     zijn eigen handvol. Gemeten in dezelfde ronde: kantoorAudit onder drie
     routefamilies, commandJournaal onder vier, securityLog onder zes -- en elke
     echte werkcollectie onder een of twee. Staat er een collectie in de lijst
     die maar onder EEN familie groeit, dan is dat geen vastlegging maar
     domeinwerk, en dat zegt deze proef hardop (`vastleggingVerdacht`). */
  const vastNamen = Object.keys(vastlegging || {});
  const familiesVan = {};
  for (const rij of Object.values(perRoute)) {
    const fam = String(rij.pad || '').split('/').slice(2, 4).join('/');
    for (const k of Object.keys((rij.opslag && rij.opslag.a) || {})) (familiesVan[k] = familiesVan[k] || new Set()).add(fam);
  }
  const vastleggingGemeten = vastNamen.map(k => ({ collectie: k, families: (familiesVan[k] || new Set()).size }));
  /* Nul families = deze ronde niet gezien (een korte ronde met --max); dat zegt
     niets. EEN familie is het signaal: dan is dit de eigen collectie van een
     route en geen doorlopende vastlegging. */
  const vastleggingVerdacht = vastleggingGemeten.filter(v => v.families === 1).map(v => v.collectie);
  if (vastNamen.length) {
    const weg = new Set(vastNamen);
    const zonder = (d) => { const u = {}; for (const k of Object.keys(d || {})) if (!weg.has(k)) u[k] = d[k]; return u; };
    for (const rij of Object.values(perRoute)) {
      if (!rij.opslag) continue;
      const opnieuw = { a: zonder(rij.opslag.a), b: zonder(rij.opslag.b), c: zonder(rij.opslag.c) };
      rij.opslag = opnieuw;
      /* De tegenspraak weegt hier mee: een route die "herhaald: true" meldt
         terwijl alleen het auditlog groeide, spreekt zichzelf niet tegen. */
      if (rij.tegenspraak) {
        const i = tegenspraken.indexOf(rij.methode + ' ' + rij.pad);
        if (Object.keys(opnieuw.b).length) rij.tegenspraak = TEGENSPRAAK + beschrijfDelta(opnieuw.b);
        else { delete rij.tegenspraak; if (i >= 0) tegenspraken.splice(i, 1); }
      }
      if (rij.bron !== 'opslag') continue;   // alleen een opslag-oordeel kan kantelen
      tel[rij.idempotentie]--; uitOpslag--;
      const o = staatOordeel(opnieuw) || { stand: 'ongemeten',
        reden: 'het antwoord verandert niet per oproep, en wat er in de opslag bewoog was alleen een ' +
          'vastlegging (' + vastNamen.join(', ') + ') -- de aantekening van de handeling en niet het werk zelf' };
      rij.idempotentie = o.stand; rij.reden = o.reden; rij.bron = o.bron || 'opslag-zonder-vastlegging';
      tel[o.stand]++; if (o.bron === 'opslag') uitOpslag++;
    }
  }

  /* DE BLINDHEIDSCONTROLE VAN DE RONDE. Per route ijkt de derde oproep, maar als
     GEEN ENKELE route een gevoelig antwoord had, heeft deze ronde niets kunnen
     zien en hoort hij dat te zeggen in plaats van een lijst met nullen. */
  const meterStuk = (tel.beschermd + tel.onbeschermd) === 0
    ? 'geen enkele route gaf een antwoord dat op een nieuwe oproep reageerde; ' +
      'deze ronde kon een tweede effect nergens zien'
    : null;

  return { perRoute, telling: tel, oproepen: gedaan, hernieuwd, meterStuk, uitOpslag, tegenspraken,
    vastleggingGemeten, vastleggingVerdacht };
}

const CONTROL = {
  control: 'IDEMPOTENTIE',
  wat: 'dezelfde opdracht twee keer versturen levert niet twee keer een effect op',
  eigenaar: 'Techniek',
  bewijs: ['test/idemproef.test.js'],
  bewijsstuk: 'IDEMPROEF.json -- per route de drie oproepen en wat eruit kwam',
  dekking: { register: 'IDEMPROEF.json', beproefd: 'gemeten.beschermd',
    totaal: 'gemeten.beoordeeld', eenheid: 'routes waar een tweede effect zichtbaar zou zijn',
    tellers: { onbeschermd: 'gemeten.onbeschermd', ongemeten: 'gemeten.ongemeten', uitOpslag: 'gemeten.uitOpslag',
      blindeRondes: 'gemeten.blindeRondes', tokensHernieuwd: 'gemeten.tokensHernieuwd' } },
  grens: 'kijkt van BUITEN, op twee meetpunten: het ANTWOORD, en met RTG_STAATLOG=1 ook de LENGTE ' +
    'per collectie in de opslag (server/staatlog.js). Dat tweede meetpunt ziet een stille toevoeging ' +
    'aan een lijst wel -- daarop hield deze proef eerder op -- maar een WIJZIGING OP ZIJN PLAATS niet: ' +
    'een status van open naar betaald zetten verandert geen enkele lengte. Een route die alleen ' +
    'bijwerkt telt hier dus nog altijd als ongemeten en niet als beschermd. En "onbeschermd" is geen ' +
    'defect-oordeel: twee keer op bewaren drukken hoort twee notities op te leveren. Het is een ' +
    'TELLING van waar de belofte uit deze kolom niet geldt, zodat je weet welke routes hem wel nodig hebben.'
};

module.exports = { draaiIdemproef, weegHerhaling, normaliseer, gelijk, CONTROL };

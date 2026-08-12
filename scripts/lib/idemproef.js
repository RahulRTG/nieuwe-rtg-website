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

/* HET OORDEEL, apart en puur -- los toetsbaar in test/idemproef.test.js.
   `a`, `b` en `c` zijn de drie antwoorden uit de kop. */
function weegHerhaling(a, b, c) {
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
    return { stand: 'ongemeten', reden: 'het antwoord verandert niet per oproep; een tweede effect ' +
      'zou hier niet te zien zijn' };
  }
  if (gelijk(a.data, b.data)) {
    return { stand: 'beschermd', reden: 'de herhaling gaf hetzelfde antwoord terwijl een verse sleutel ' +
      'een ander gaf' };
  }
  return { stand: 'onbeschermd', reden: 'de herhaling gaf een ander antwoord: hij deed het opnieuw' };
}

async function draaiIdemproef({ post, routes, tokenVoor, lijfVoor, hernieuw, maxRoutes }) {
  const perRoute = {};
  let gedaan = 0, hernieuwd = 0;
  const tel = { beschermd: 0, onbeschermd: 0, ongemeten: 0 };

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

    const a = await doe(k1);
    const b = await doe(k1);
    const c = await doe(k2);
    const o = weegHerhaling(a, b, c);
    tel[o.stand]++;
    perRoute[r.method + ' ' + r.pad] = { methode: r.method, pad: r.pad, rol: r.rol,
      idempotentie: o.stand, reden: o.reden, statussen: [a.status, b.status, c.status] };
  }

  /* DE BLINDHEIDSCONTROLE VAN DE RONDE. Per route ijkt de derde oproep, maar als
     GEEN ENKELE route een gevoelig antwoord had, heeft deze ronde niets kunnen
     zien en hoort hij dat te zeggen in plaats van een lijst met nullen. */
  const meterStuk = (tel.beschermd + tel.onbeschermd) === 0
    ? 'geen enkele route gaf een antwoord dat op een nieuwe oproep reageerde; ' +
      'deze ronde kon een tweede effect nergens zien'
    : null;

  return { perRoute, telling: tel, oproepen: gedaan, hernieuwd, meterStuk };
}

const CONTROL = {
  control: 'IDEMPOTENTIE',
  wat: 'dezelfde opdracht twee keer versturen levert niet twee keer een effect op',
  eigenaar: 'Techniek',
  bewijs: ['test/idemproef.test.js'],
  bewijsstuk: 'IDEMPROEF.json -- per route de drie oproepen en wat eruit kwam',
  dekking: { register: 'IDEMPROEF.json', beproefd: 'gemeten.beschermd',
    totaal: 'gemeten.beoordeeld', eenheid: 'routes waar een tweede effect zichtbaar zou zijn',
    tellers: { onbeschermd: 'gemeten.onbeschermd', ongemeten: 'gemeten.ongemeten',
      blindeRondes: 'gemeten.blindeRondes', tokensHernieuwd: 'gemeten.tokensHernieuwd' } },
  grens: 'kijkt van BUITEN naar het antwoord, niet naar de database. Een route die zijn tweede ' +
    'effect niet in het antwoord laat zien (een stille toevoeging aan een lijst die niet wordt ' +
    'teruggegeven) telt hier als ongemeten en niet als beschermd -- daarvoor is de per-route ' +
    'vingerafdruk nodig die er nog niet is. En "onbeschermd" is geen defect-oordeel: twee keer ' +
    'op bewaren drukken hoort twee notities op te leveren. Het is een TELLING van waar de belofte ' +
    'uit deze kolom niet geldt, zodat je weet welke routes hem wel nodig hebben.'
};

module.exports = { draaiIdemproef, weegHerhaling, normaliseer, gelijk, CONTROL };

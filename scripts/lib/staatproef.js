/* ============================================================================
   DE STAATPROEF -- vier matrixkolommen uit één waarneming.

   WAT ER MEETBAAR WORDT. Met een toestandsvingerafdruk vóór en ná een verzoek is
   niet alleen te zien WAT de route antwoordde maar ook wat er in de opslag
   veranderde. Daarmee vallen vier kolommen tegelijk:

     STATE         veranderde er iets, en paste dat bij het antwoord
     SIDE_EFFECT   WELKE collecties bewogen er -- ook buiten de eigen
     ROLLBACK      na een geweigerd verzoek: bleef alles gelijk
     IDEMPOTENCY   beweegt de tweede oproep de toestand nog een keer

   DRIE OPROEPEN, VIER VINGERAFDRUKKEN:

     F0  de toestand vooraf
     A   de oproep, met sleutel K1          -> F1
     B   dezelfde oproep, dezelfde sleutel  -> F2

   DE IJKING ZIT INGEBOUWD EN PER ROUTE. Alleen als F1 van F0 verschilt, weten we
   dat deze meter voor DEZE route iets kan zien; pas dan zegt "F2 is gelijk aan
   F1" iets. Bewoog er niets, dan is het oordeel ONGEMETEN met de reden erbij --
   nooit stilzwijgend groen. Dat is LAT.md regel 10 toegepast per route in plaats
   van één keer aan het begin van de ronde.

   DE ENE UITKOMST DIE ECHT SLECHT IS: een verzoek dat wordt GEWEIGERD terwijl de
   toestand toch veranderde. Dan klopt de statuscode en de database niet -- de
   fout waar lib/rolproef.js in zijn kop al voor waarschuwde maar die hij niet
   kon meten, omdat hij de toestand niet zag.

   OMGEVINGSRUIS, EN WAAROM DIE EERST GEMETEN MOET WORDEN. De eerste ronde
   meldde negentien 'geweigerd en toch veranderd' op rij, en ze waren alle
   negentien loos: `doorgeefjournaal` en `rtgai` bewegen bij ELK verzoek, ook
   bij een 404. Dat is het huis dat opschrijft dat er is aangeklopt -- de
   waarneming zelf, niet het gevolg van de route.

   Die collecties worden daarom EERST gemeten in plaats van geraden: een paar
   verzoeken die niets horen te veranderen, en wat er dan toch beweegt is ruis.
   Empirisch, want een handgeschreven lijst loopt achter zodra er een journaal
   bijkomt -- en dan komen de valse bevindingen terug. De namen staan in de
   uitslag; stil wegfilteren zou hetzelfde zijn als niet meten.

   WAT DEZE PROEF NIET ZIET, en dat hoort erbij:
   - een effect buiten de database (een mail, een push, een betaling bij een
     derde). SIDE_EFFECT is hier "buiten de eigen collectie", niet "buiten het
     huis";
   - een wijziging die zichzelf binnen één verzoek opheft;
   - WELKE rij bewoog, tenzij de vingerafdruk met `detail` is opgevraagd;
   - een effect dat ALLEEN in een ruis-collectie landt: dat is niet te scheiden
     van het journaal van het verzoek zelf.
   ========================================================================== */
'use strict';

const isOk = (st) => !!(st && st.status >= 200 && st.status < 300);

/* HET OORDEEL, apart en puur -- los toetsbaar in test/staatproef.test.js.
   `verschilVan(voor, na)` komt van de server (lib/vingerafdruk), zodat de regel
   voor "wat telt als een wijziging" op één plek staat. */
function weegStaat({ a, b, d01, d12 }) {
  const uit = { state: 'ongemeten', sideEffect: 'ongemeten', rollback: 'ongemeten',
    idempotentie: 'ongemeten', collecties: (d01 && d01.collecties) || [] };

  const bewoog = !!(d01 && d01.aantal > 0);

  if (!isOk(a)) {
    /* GEWEIGERD. Dan hoort er niets te zijn veranderd, en dat is precies wat
       ROLLBACK vraagt. Veranderde er wel iets, dan is dat een bevinding: de
       statuscode klopt en de database niet.

       MAAR EERST DE EERSTE-AANRAKING ERUIT, en dit is de tweede ruisklasse die
       deze proef leerde kennen. Een kern die bij het eerste gebruik zijn eigen
       la inricht (`bankregie` met standaardwaarden, een lege lijst met een
       kop erin) verandert de toestand ook als het verzoek daarna met 403 wordt
       afgewezen. Dat is inrichting en geen gevolg van de opdracht.

       Het onderscheid is meetbaar in plaats van te raden: inrichting gebeurt
       EEN keer. De tweede, identieke, even hard geweigerde oproep laat de
       toestand dan met rust. Blijft hij bij die tweede oproep ook bewegen, dan
       is er wel degelijk iets aan de hand -- en pas dan is het een bevinding. */
    const nogmaals = !!(d12 && d12.aantal > 0);
    if (bewoog && !nogmaals) {
      uit.rollback = 'bewezen';
      uit.reden = 'geweigerd (status ' + a.status + '); de eenmalige wijziging in ' +
        uit.collecties.join(', ') + ' was inrichting -- de herhaling liet alles met rust';
    } else if (bewoog) {
      uit.rollback = 'GEZAKT';
      uit.reden = 'geweigerd (status ' + a.status + ') en de toestand veranderde toch, ook bij de ' +
        'herhaling: ' + uit.collecties.join(', ');
    } else {
      uit.rollback = 'bewezen';
      uit.reden = 'geweigerd (status ' + a.status + ') en er bleef niets staan';
    }
    /* Over STATE en SIDE_EFFECT valt hier niets te zeggen: er is geen werk
       gedaan, dus er is ook geen belofte om aan af te meten. */
    return uit;
  }

  if (!bewoog) {
    uit.reden = 'de route bevestigde zonder dat er iets in de opslag bewoog; ' +
      'een tweede effect zou hier niet te zien zijn';
    return uit;
  }

  /* BEVESTIGD EN ER BEWOOG IETS. Dat is de meting: de route doet wat hij zegt,
     en we weten precies welke collecties hij raakte. */
  uit.state = 'bewezen';
  uit.sideEffect = 'bewezen';
  uit.reden = 'bevestigd, en gemeten welke collecties bewogen (' + uit.collecties.length + ')';

  /* En omdat de meter voor DEZE route aantoonbaar gevoelig is, zegt de tweede
     oproep nu wel iets. */
  if (d12 && d12.aantal > 0) {
    uit.idempotentie = 'GEZAKT';
    uit.idemReden = 'de herhaling met dezelfde sleutel bewoog de toestand opnieuw: ' +
      d12.collecties.join(', ');
  } else if (d12) {
    uit.idempotentie = 'bewezen';
    uit.idemReden = 'de herhaling liet de toestand ongemoeid terwijl de eerste oproep hem wel bewoog';
  }
  return uit;
}

/* WELKE COLLECTIES TELLEN ALS RUIS -- de regel, los van hoe hij geteld is.

   De ijkingen in scripts/staatproef-route.js tellen per collectie in hoeveel
   rondes hij bewoog. Ruis is wat in ELKE ronde bewoog; wat maar soms bewoog is
   geen ruis maar een losse gebeurtenis, en die hoort zichtbaar te blijven. Die
   strengheid is het hele punt: een collectie die af en toe meebeweegt zou anders
   een echt tweede effect kunnen wegpoetsen.

   Hij staat hier en niet in het script omdat een regel die je niet los kunt
   stellen, een regel is die niemand natelt. */
function ruisUit(geteld, rondes) {
  const uit = new Set();
  for (const [collectie, n] of geteld) if (n >= rondes) uit.add(collectie);
  return uit;
}

/* DE TWEEDE, SCHERPERE REGEL: EEN TIK VAN DE KLOK DIE MAAR SOMS VALT.

   De globale ruislijst hierboven is streng met opzet -- alleen wat in ELKE ronde
   beweegt telt mee -- en dat laat een gat open. Een schakelaar die eens per
   MINUUT loopt (kern/command/alarm.js doet dat) haalt die drempel niet, maar kan
   wel net tussen de twee oproepen van een route vallen. Dan leest de proef "de
   herhaling bewoog de toestand opnieuw" over een route die niets deed. Dat
   gebeurde: /api/supplier/magnaat/studio/importeer viel over `commandAlarmen`.

   Het venster oprekken tot boven die minuut zou werken, maar dan sleept de
   globale lijst `commandJournaal` mee -- het auditjournaal van de commandkant --
   en dan ziet niemand het meer als een echte route dat dubbel schrijft. Te duur.

   VANDAAR TWEE VOORWAARDEN TEGELIJK, en alleen samen zijn ze veilig:

     (a) de collectie is OOIT in stilte zien bewegen. Er werd toen niets
         gevraagd, dus wat daar beweegt kan per definitie geen routewerk zijn.
     (b) de collectie bewoog NIET bij de EERSTE oproep van deze route. Een route
         doet twee keer hetzelfde; raakte hij die collectie de eerste keer niet
         aan, dan is de tweede keer niet van hem.

   (a) alleen is te zwak (een naloper van eerder werk haalt hem ook), (b) alleen
   ook (een route kan bij een herhaling een ANDER pad nemen en daar iets loggen).
   Samen blijft er weinig ruimte over om iets echts weg te poetsen -- en dat wat
   overblijft staat in de grens onderaan dit bestand. */
function zonderTijdtik(d12, d01, stilOoit) {
  if (!d12 || !stilOoit || !stilOoit.size) return d12;
  const bewoogAl = new Set((d01 && d01.collecties) || []);
  const gewijzigd = (d12.gewijzigd || []).filter(g => !(stilOoit.has(g.collectie) && !bewoogAl.has(g.collectie)));
  return { ...d12, gewijzigd, aantal: gewijzigd.length, collecties: gewijzigd.map(g => g.collectie) };
}

/* Het verschil ONTDAAN van de ruis. Een aparte functie, zodat de regel op een
   plek staat en de toets hem los kan stellen. */
function zonderRuis(d, ruis) {
  if (!d) return d;
  const negeer = ruis instanceof Set ? ruis : new Set(ruis || []);
  const gewijzigd = (d.gewijzigd || []).filter(g => !negeer.has(g.collectie));
  return { ...d, gewijzigd, aantal: gewijzigd.length, collecties: gewijzigd.map(g => g.collectie) };
}

async function draaiStaatproef({ post, vingerafdruk, routes, tokenVoor, lijfVoor, hernieuw, verschilVan, ruis, stilOoit, maxRoutes }) {
  const perRoute = {};
  const tel = { state: 0, sideEffect: 0, rollback: 0, rollbackGezakt: 0, idemBewezen: 0, idemGezakt: 0, ongemeten: 0 };
  let oproepen = 0, hernieuwd = 0, afdrukken = 0;
  /* DE LAATSTE AFDRUK VAN EEN ROUTE IS DE EERSTE VAN DE VOLGENDE. Tussen F2 van
     route N en F0 van route N+1 gebeurt er niets, dus die twee zijn per definitie
     gelijk -- hem twee keer opvragen is een derde van het werk weggooien. En het
     werk is niet niks: een vingerafdruk hasht de hele opslag (~190 ms op 63.000
     rijen). Dit is de enige besparing die GEEN aanname doet; alles wat slimmer
     wil zijn (alleen hashen wat van lengte veranderde) laat precies de
     wijziging-op-zijn-plaats vallen, en dat is waar geld in zit. */
  let vorige = null;

  for (const r of routes) {
    if (maxRoutes && Object.keys(perRoute).length >= maxRoutes) break;
    const sleutel = 'staatproef-' + r.pad.replace(/\W+/g, '');
    const lijf = { ...lijfVoor(r), idem: sleutel, idempotentieSleutel: sleutel };

    const doe = async () => { const st = await post(r.pad, lijf, tokenVoor(r.rol)); oproepen++; return st; };

    let f0 = vorige || await (async () => { afdrukken++; return vingerafdruk(); })();
    let a = await doe();
    /* OPNIEUW INLOGGEN GEBEURT BUITEN HET MEETVENSTER, en dat is geen nettigheid
       maar een reparatie van zes valse bevindingen.

       De hernieuwing stond hier binnen `doe()`, dus binnen f0..f1. Een route die
       401 geeft OOK met een geldig token -- /api/rtfos/* wil een andere soort
       sessie -- liet deze proef bij ELKE oproep opnieuw inloggen, en een inlog
       schrijft zelf `securityLog` en `sessions` weg. Die twee stonden dus in
       d01 EN in d12, en de uitslag las: "geweigerd (401) en de toestand
       veranderde toch, ook bij de herhaling". Zes routes lang, over iets wat de
       proef zelf deed. Nagemeten en op de kop af gereproduceerd: dezelfde route
       met de hernieuwing ERBUITEN beweegt alleen de journalen.

       Nu wordt er hooguit EEN keer hernieuwd, en daarna begint de meting
       opnieuw met een verse f0 -- de inlog valt zo buiten het venster. De eerste
       oproep die de 401 opleverde telt niet mee; hij deed per definitie geen
       werk. Blijft het na de hernieuwing 401, dan is dat de route en niet het
       token, en die wordt schoon gemeten. */
    if (a.status === 401 && hernieuw) {
      if (await hernieuw(r.rol)) {
        hernieuwd++;
        f0 = await vingerafdruk(); afdrukken++;
        a = await doe();
      }
    }
    const f1 = await vingerafdruk(); afdrukken++;
    const b = await doe();
    const f2 = await vingerafdruk(); afdrukken++;
    vorige = f2;
    /* Zonder vingerafdrukken valt er niets te oordelen -- dan is de MEETOPSTELLING
       stuk en niet de route. Dat verschil hoort in het register te staan. */
    if (!f0 || !f1 || !f2) {
      vorige = null;
      perRoute[r.method + ' ' + r.pad] = { methode: r.method, pad: r.pad, rol: r.rol,
        state: 'ongemeten', sideEffect: 'ongemeten', rollback: 'ongemeten', idempotentie: 'ongemeten',
        reden: 'de vingerafdruk kwam niet terug' };
      tel.ongemeten++;
      continue;
    }

    /* Eerst de globale ruis eruit (die geldt voor beide verschillen), dan pas de
       tweede regel -- die vergelijkt d12 MET d01 en heeft ze dus allebei nodig
       in dezelfde staat. Zie zonderTijdtik hierboven voor waarom er twee zijn. */
    const d01 = zonderRuis(await verschilVan(f0, f1), ruis);
    const d12 = zonderTijdtik(zonderRuis(await verschilVan(f1, f2), ruis), d01, stilOoit);
    const o = weegStaat({ a, b, d01, d12 });
    perRoute[r.method + ' ' + r.pad] = { methode: r.method, pad: r.pad, rol: r.rol,
      statussen: [a.status, b.status], ...o };

    if (o.state === 'bewezen') tel.state++;
    if (o.sideEffect === 'bewezen') tel.sideEffect++;
    if (o.rollback === 'bewezen') tel.rollback++;
    if (o.rollback === 'GEZAKT') tel.rollbackGezakt++;
    if (o.idempotentie === 'bewezen') tel.idemBewezen++;
    if (o.idempotentie === 'GEZAKT') tel.idemGezakt++;
    if (o.state === 'ongemeten' && o.rollback === 'ongemeten') tel.ongemeten++;
  }

  /* DE BLINDHEIDSCONTROLE VAN DE RONDE. Bewoog er bij GEEN ENKELE route iets,
     dan is de vingerafdruk niet aangesloten of ziet hij de verkeerde kant op --
     en dan hoort deze ronde dat te zeggen in plaats van een lijst met nullen. */
  const meterStuk = (tel.state + tel.rollbackGezakt) === 0
    ? 'geen enkele route bewoog de vingerafdruk; deze ronde kan niets over de toestand zeggen'
    : null;

  return { perRoute, telling: tel, oproepen, afdrukken, hernieuwd, meterStuk, ruis: [...(ruis || [])] };
}

const CONTROL = {
  control: 'TOESTAND',
  wat: 'per route is gemeten wat er in de opslag veranderde: bij een bevestiging, bij een weigering, en bij een herhaling',
  eigenaar: 'Techniek',
  bewijs: ['test/staatproef.test.js', 'test/vingerafdruk.test.js'],
  bewijsstuk: 'STAATPROEF.json -- per route welke collecties bewogen, en wat de herhaling deed',
  dekking: { register: 'STAATPROEF.json', beproefd: 'gemeten.beoordeeld',
    totaal: 'gemeten.routesMetRol', eenheid: 'routes waar de toestand is gemeten',
    tellers: { state: 'gemeten.state', sideEffect: 'gemeten.sideEffect',
      rollback: 'gemeten.rollback', rollbackGezakt: 'gemeten.rollbackGezakt',
      idemBewezen: 'gemeten.idemBewezen', idemGezakt: 'gemeten.idemGezakt',
      blindeRondes: 'gemeten.blindeRondes' } },
  grens: 'ziet de DATABASE en niets daarbuiten: een mail, een push of een betaling bij een derde ' +
    'valt er niet onder, dus SIDE_EFFECT betekent hier "buiten de eigen collectie" en niet "buiten ' +
    'het huis". Ziet ook geen wijziging die zichzelf binnen één verzoek opheft. Een route waar de ' +
    'eerste oproep niets bewoog, blijft ONGEMETEN -- daar zou een tweede effect ook niet te zien zijn.'
};

module.exports = { draaiStaatproef, weegStaat, zonderRuis, zonderTijdtik, ruisUit, CONTROL };

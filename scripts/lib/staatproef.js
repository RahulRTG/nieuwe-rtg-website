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

   DE VIERDE KLASSE: BOEKHOUDING VAN DE AANROEP. Ruis is wat vanzelf beweegt;
   boekhouding is wat beweegt OMDAT er is aangeroepen, en dat hoort bij elke
   aanroep opnieuw te gebeuren. De kostenmeter schrijft een regel per verzoek
   (KOSTEN.md: dat is de bedoeling -- een tweede aanroep kost de infrastructuur
   echt iets), en een auditjournaal legt elke handeling vast, ook de tweede.

   Het stille venster vindt die niet: ze bewegen alleen als je belt. Zonder deze
   klasse leest de proef "de herhaling met dezelfde sleutel bewoog de toestand
   opnieuw: kosten" -- en dat werd via de bewijsmatrix en VERTROUWEN.json een
   `geschorst`, waarna server/middleware/schorspoort.js de route met 503
   dichtzette. Op 2 september 2026 stonden er negen routes zo offline, waaronder
   de boardroom-export, terwijl er in geen van de negen iets tweemaal gebeurde.

   DE LEDEN ZIJN AFGELEID EN NIET VERZONNEN, want een handgeschreven lijst is
   precies waar de ruisparagraaf hierboven tegen waarschuwt: de journalen komen
   uit server/kern/auditsporen.js (die lijst is zelf gemeten over een volle
   ronde), en `kosten` uit server/kern/kosten/index.js, dat die collectie bezit.
   Komt er een journaal bij, dan komt het daar bij en hier vanzelf mee.

   EN HET IS GEEN STIL GROEN. Een herhaling die alleen boekhouding raakte krijgt
   zijn eigen woord in de reden, met de collecties erbij -- zodat op het scherm
   te lezen blijft dat een tweede aanroep geld kost. Wat hier NIET gebeurt is
   een oordeel over die kosten zelf; dat is een vraag voor KOSTEN.md en niet
   voor deze proef.

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

/* De boekhoudcollecties, uit de modules die ze bezitten. Zie de paragraaf
   DE VIERDE KLASSE hierboven voor waarom dit een afleiding is en geen lijst. */
function boekhoudcollecties() {
  const uit = new Set();
  try { for (const n of require('../../server/kern/auditsporen').NAMEN) uit.add(n); } catch (e) {}
  /* db.data.kosten -- de kostenmeter, server/kern/kosten/index.js. Hij heeft
     geen register waaruit deze naam te lezen valt; de aanhaling staat in de kop
     van dat bestand ("Opslag: db.data.kosten") en test/staatproef.test.js houdt
     vast dat hij daar nog zo heet. */
  uit.add('kosten');
  return uit;
}
const BOEKHOUDING = boekhoudcollecties();

const isOk = (st) => !!(st && st.status >= 200 && st.status < 300);

/* HET OORDEEL, apart en puur -- los toetsbaar in test/staatproef.test.js.
   `verschilVan(voor, na)` komt van de server (lib/vingerafdruk), zodat de regel
   voor "wat telt als een wijziging" op één plek staat. */
function weegStaat({ a, b, d01, d12, dStil }) {
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
      /* DE DERDE RUISKLASSE: DE DOORLOPENDE OMGEVINGSSCHRIJVER. Zes rtfos-
         routes stonden op GEZAKT met securityLog en sessions, en geen ervan
         was na te spelen: wat daar bewoog waren tijdgebonden schrijvers (een
         sessieverversing op het uur, een wachtlaag) die toevallig onder de
         meetklok vielen -- bij de aanroep EN bij de herhaling, dus de
         eerste-aanrakingsregel hierboven ving ze niet. `dStil` is het antwoord:
         het verschil over een STIL venster zonder enige aanroep, direct na de
         meting. Wat daar ook beweegt, beweegt vanzelf en valt deze route niet
         toe te rekenen. Gemeten, niet geraden -- een vaste negeerlijst zou
         hier de fout van de ruisvloer herhalen. */
      const stil = new Set((dStil && dStil.collecties) || []);
      const alles = [...new Set(uit.collecties.concat((d12 && d12.collecties) || []))];
      const nietStil = alles.filter(c => !stil.has(c));
      /* De boekhouding van de aanroep telt hier net zo min mee als bij de
         idempotentie hieronder: dat een GEWEIGERD verzoek een kostenregel of
         een auditregel achterlaat, is precies wat er hoort te gebeuren -- er is
         aangeklopt, en dat wordt opgeschreven. Zie DE VIERDE KLASSE in de kop. */
      const boek = nietStil.filter(c => BOEKHOUDING.has(c));
      const rest = nietStil.filter(c => !BOEKHOUDING.has(c));
      const boekStaart = boek.length ? ' (boekhouding van de aanroep: ' + boek.join(', ') + ')' : '';
      if (dStil && !rest.length) {
        uit.rollback = 'bewezen';
        /* De twee redenen blijven UIT ELKAAR in de tekst. Ze zeggen iets
           verschillends -- "dat bewoog vanzelf" tegenover "dat hoort bij elke
           aanroep" -- en een lezer die wil weten waarom deze route slaagde,
           heeft aan "of" niets. */
        const delen = [];
        if (stil.size) delen.push('bewoog ook in het stille venster zonder aanroep (' +
          alles.filter(c => stil.has(c)).join(', ') + '): omgevingsruis');
        if (boek.length) delen.push('is boekhouding van de aanroep (' + boek.join(', ') + ')');
        uit.reden = 'geweigerd (status ' + a.status + '); er bleef niets van de OPDRACHT staan -- ' +
          'alles wat bewoog ' + delen.join(', en ');
      } else {
        uit.rollback = 'GEZAKT';
        uit.reden = 'geweigerd (status ' + a.status + ') en de toestand veranderde toch, ook bij de ' +
          'herhaling: ' + (dStil ? rest.join(', ') +
            (stil.size ? ' (omgevingsruis ' + [...stil].join(', ') + ' weggelaten na stille controle)' : '') + boekStaart
            : uit.collecties.join(', '));
      }
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
    /* Dezelfde stille controle als bij de weigering hierboven: een herhaling
       die alleen omgevingsruis raakte, is geen gezakte idempotentie. */
    const stil = new Set((dStil && dStil.collecties) || []);
    const nietStil = d12.collecties.filter(c => !stil.has(c));
    const idemBoek = nietStil.filter(c => BOEKHOUDING.has(c));
    const idemRest = nietStil.filter(c => !BOEKHOUDING.has(c));
    if (dStil && !idemRest.length) {
      uit.idempotentie = 'bewezen';
      /* HET WOORD IS ANDERS ALS ER BOEKHOUDING BIJ ZIT, en dat is met opzet: de
         belofte van deze kolom ("twee keer doet niet twee keer iets") gaat over
         de OPDRACHT, en die is niet herhaald. Dat een tweede aanroep wel een
         kostenregel oplevert blijft in de reden staan -- stil wegfilteren zou
         hetzelfde zijn als niet meten. */
      uit.idemReden = idemBoek.length
        ? 'de herhaling voerde de opdracht niet opnieuw uit; wat bewoog is boekhouding van de ' +
          'aanroep (' + idemBoek.join(', ') + ')' +
          (stil.size ? ' plus omgevingsruis (' + [...stil].join(', ') + ')' : '')
        : 'de herhaling bewoog alleen wat ook in het stille venster zonder aanroep ' +
          'bewoog (' + d12.collecties.join(', ') + '): omgevingsruis, geen tweede uitvoering';
    } else {
      uit.idempotentie = 'GEZAKT';
      uit.idemReden = 'de herhaling met dezelfde sleutel bewoog de toestand opnieuw: ' +
        (dStil ? idemRest.join(', ') : d12.collecties.join(', ')) +
        (idemBoek.length ? ' (boekhouding van de aanroep: ' + idemBoek.join(', ') + ')' : '');
    }
  } else if (d12) {
    uit.idempotentie = 'bewezen';
    uit.idemReden = 'de herhaling liet de toestand ongemoeid terwijl de eerste oproep hem wel bewoog';
  }
  return uit;
}

/* DE STAPELING: rondes vullen elkaar aan in plaats van elkaar te overschrijven.
   Een volle ronde duurt uren en een container haalt dat niet; zonder stapeling
   mat --max=N telkens dezelfde eerste N routes en gooide de rest van het
   register weg -- en dan zakt de normtand bewijsCellenBewezen op een KLEINERE
   meting, niet op slechtere code. Vers wint van oud, elke rij draagt zijn
   op-stempel (oude rijen zonder stempel erven die van het oude register), en
   de telling gaat over de samenvoeging. Puur en los toetsbaar, zelfde reden
   als weegStaat. */
function stapelRijen(oudeRijen, oudOp, versPerRoute, nuOp) {
  const samen = new Map();
  for (const rij of oudeRijen || []) {
    samen.set(rij.methode + ' ' + rij.pad, { ...rij, op: rij.op || oudOp || null });
  }
  let versGemeten = 0;
  for (const [sleutel, rij] of Object.entries(versPerRoute || {})) {
    samen.set(sleutel, { ...rij, op: nuOp });
    versGemeten++;
  }
  const rijen = [...samen.values()];
  const telling = { state: 0, sideEffect: 0, rollback: 0, rollbackGezakt: 0, idemBewezen: 0, idemGezakt: 0, ongemeten: 0 };
  for (const r of rijen) {
    if (r.state === 'bewezen') telling.state++;
    if (r.sideEffect === 'bewezen') telling.sideEffect++;
    if (r.rollback === 'bewezen') telling.rollback++;
    if (r.rollback === 'GEZAKT') telling.rollbackGezakt++;
    if (r.idempotentie === 'bewezen') telling.idemBewezen++;
    if (r.idempotentie === 'GEZAKT') telling.idemGezakt++;
    if (r.state === 'ongemeten' && r.rollback === 'ongemeten') telling.ongemeten++;
  }
  return { rijen, telling, versGemeten };
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

    /* DE HERNIEUWING SCHRIJFT ZELF, EN DAT VERGIFTIGDE HET VENSTER. Een 401
       liet doe() opnieuw inloggen -- en een login schrijft securityLog en
       sessions, BINNEN het venster f0..f1 dat aan deze route wordt
       toegerekend. Voor een route die ook met een vers token 401 blijft geven
       (verkeerde deelrol) vuurde dat bij de aanroep EN de herhaling: zes
       rtfos-routes stonden zo op 'geweigerd en toch veranderd' zonder dat er
       iets van hen bewoog. Daarom: hernieuwen mag alleen bij de EERSTE
       aanroep, en vuurt hij, dan gaat het venster weg en begint de meting
       opnieuw met een verse afdruk NA de login -- zonder tweede hernieuwing,
       zodat er hoogstens een login per routemeting bestaat en die nooit in
       een gemeten venster valt. De herhaling hernieuwt nooit: die hoort
       hetzelfde token te dragen als de eerste aanroep. */
    let hernieuwdNu = false;
    const doe = async (magHernieuwen) => {
      let st = await post(r.pad, lijf, tokenVoor(r.rol));
      oproepen++;
      if (magHernieuwen && st.status === 401 && hernieuw) {
        if (await hernieuw(r.rol)) {
          hernieuwd++; hernieuwdNu = true;
          st = await post(r.pad, lijf, tokenVoor(r.rol)); oproepen++;
        }
      }
      return st;
    };

    let f0 = vorige || await (async () => { afdrukken++; return vingerafdruk(); })();
    let a = await doe(true);
    if (hernieuwdNu && f0) {
      f0 = await vingerafdruk(); afdrukken++;
      a = await doe(false);
    }
    const f1 = await vingerafdruk(); afdrukken++;
    const b = await doe(false);
    const f2 = await vingerafdruk(); afdrukken++;
    vorige = f2;
    /* Zonder vingerafdrukken valt er niets te oordelen -- dan is de MEETOPSTELLING
       stuk en niet de route. Dat verschil hoort in het register te staan. */
    if (!f0 || !f1 || !f2) {
      vorige = null;
      perRoute[r.methode + ' ' + r.pad] = { methode: r.methode, pad: r.pad, rol: r.rol,
        state: 'ongemeten', sideEffect: 'ongemeten', rollback: 'ongemeten', idempotentie: 'ongemeten',
        reden: 'de vingerafdruk kwam niet terug' };
      tel.ongemeten++;
      continue;
    }

    const d01 = zonderRuis(await verschilVan(f0, f1), ruis);
    const d12 = zonderRuis(await verschilVan(f1, f2), ruis);
    /* DE STILLE CONTROLE, alleen als hij iets kan beslissen: bewoog er bij de
       aanroep EN bij de herhaling iets, dan kan dat een doorlopende
       omgevingsschrijver zijn (zie weegStaat). Een kort venster zonder enige
       aanroep laat zien wat er vanzelf beweegt; de wachttijd maakt het venster
       vergelijkbaar met dat van een echte meting. Kost een vierde afdruk,
       maar alleen op de routes waar de uitslag anders op ruis kan staan. */
    let dStil = null;
    if (d01.aantal > 0 && d12.aantal > 0) {
      await new Promise(z => setTimeout(z, 250));
      const f3 = await vingerafdruk(); afdrukken++;
      if (f3) { dStil = zonderRuis(await verschilVan(f2, f3), ruis); vorige = f3; }
    }
    const o = weegStaat({ a, b, d01, d12, dStil });
    perRoute[r.methode + ' ' + r.pad] = { methode: r.methode, pad: r.pad, rol: r.rol,
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


function ruisUit(geteld, rondes) {
  const uit = new Set();
  for (const [collectie, n] of geteld) if (n >= rondes) uit.add(collectie);
  return uit;
}

function zonderTijdtik(d12, d01, stilOoit) {
  if (!d12 || !stilOoit || !stilOoit.size) return d12;
  const bewoogAl = new Set((d01 && d01.collecties) || []);
  const gewijzigd = (d12.gewijzigd || []).filter(g => !(stilOoit.has(g.collectie) && !bewoogAl.has(g.collectie)));
  return { ...d12, gewijzigd, aantal: gewijzigd.length, collecties: gewijzigd.map(g => g.collectie) };
}

module.exports = { draaiStaatproef, weegStaat, zonderRuis, zonderTijdtik, ruisUit, stapelRijen, CONTROL };

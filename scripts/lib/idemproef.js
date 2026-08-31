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
   OPSLAG verraadt het wel. Met RTG_STAATLOG draagt elk antwoord een kop met de
   stand per collectie (server/staatlog.js): stand 1 de lengte, stand 2 ook een
   inhoudsafdruk, zodat ook een wijziging OP ZIJN PLAATS te zien is. `staat` is
   het VERSCHIL dat elk van de drie oproepen achterliet, met de ruis er al uit
   geijkt.

   Drie uitkomsten, en de derde is een weigering:
     - de eerste oproep veranderde niets -> null. Dan is er geen tweede effect om
       te zien: een leesroute, of een die zijn verandering meteen terugdraait.
       Daar doet dit meetpunt geen uitspraak over.
     - de eerste veranderde iets en de herhaling niets -> beschermd.
     - allebei veranderden iets -> onbeschermd. */

/* Een getal is een verandering in de LENGTE; 'gewijzigd' is een verandering in
   de inhoud bij gelijke lengte (server/staatlog.js stand 2). Die twee lezen
   anders en horen anders te klinken -- "+1 in orders" tegenover "een wijziging
   in bankPassen" -- want alleen het eerste is iets dat erbij is gekomen. */
function beschrijfDelta(d) {
  return Object.entries(d).map(([k, n]) => typeof n === 'number'
    ? (n > 0 ? '+' : '') + n + ' in ' + k
    : 'een wijziging in ' + k).join(', ');
}
/* WAAROM DIT PER GROND VERSCHILT, en niet een zin voor alles.

   Hier stond een vaste tekst: "het antwoord meldt een herkende herhaling, maar
   de opslag groeide". Over de eerste echte ronde met inhoudsafdrukken kwamen er
   drie tegenspraken uit, en bij ALLE DRIE was de grond niet dat de server de
   herhaling merkte maar dat hij hem WEIGERDE (409, 404). De melding beweerde dus
   iets wat de proef niet had gemeten -- precies wat deze proef bij anderen komt
   vinden. Vandaar een tekst per grond, uit `o.grond` en niet uit een aanname. */
const TEGENSPRAAK = {
  gemerkt: 'het antwoord meldt een herkende herhaling, maar de opslag veranderde toch: ',
  geweigerd: 'de herhaling werd geweigerd, maar de opslag veranderde toch: ',
  gelijk: 'de herhaling gaf hetzelfde antwoord, maar de opslag veranderde toch: ',
  onbekend: 'de herhaling zou niets gedaan hebben, maar de opslag veranderde toch: '
};
const tegenspraakTekst = (grond, d) => (TEGENSPRAAK[grond] || TEGENSPRAAK.onbekend) + beschrijfDelta(d);
function staatOordeel(staat) {
  if (!staat || !staat.a || !staat.b) return null;
  if (!Object.keys(staat.a).length) return null;
  if (!Object.keys(staat.b).length) {
    return { stand: 'beschermd', bron: 'opslag',
      reden: 'het antwoord reageert niet op een nieuwe oproep, maar de OPSLAG wel: ' +
      'de eerste oproep gaf ' + beschrijfDelta(staat.a) + ' en de herhaling niets' };
  }
  /* DE HERHALING MOET DEZELFDE COLLECTIE RAKEN, anders is het geen herhaling.

     Hier stond alleen "b is niet leeg, dus hij deed het opnieuw". Dat leverde
     precies een bevinding op, en die was VALS: /api/bank/pas/bevries gaf bij de
     eerste oproep een wijziging in `bankPassen` en bij de herhaling +1 in
     `techniek` en +6 in `wacht`. Geisoleerd nagemeten -- drie keer bevriezen op
     een verse server -- raakt de herhaling `bankPassen` helemaal niet. De pas
     wordt gezet op een waarde (`p.bevroren = aan === true`) en dat is per
     constructie idempotent.

     Wat er wel bewoog, kwam van ASYNCHROON werk van andere routes dat in dat
     venster landde: een seintje, een journaalregel, een wachtrij. De ijking aan
     het begin van de ronde vangt alleen wat bij ELKE oproep groeit; wat af en
     toe binnenvalt, komt op het conto van de route die op dat moment toevallig
     aan de beurt is.

     De regel die dat wegneemt en niets echts verbergt: een herhaling die het
     werk OPNIEUW doet, raakt dezelfde collectie als de eerste keer. Beweegt er
     bij B alleen iets wat bij A niet bewoog, dan is dat geen bewijs dat het
     werk is herhaald -- en dan hoort de uitslag ONGEMETEN te zijn, met de
     waarneming erbij, in plaats van een defect dat iemand gaat repareren.

     Wat dit NIET wegpoetst: als B dezelfde collectie raakt als A, blijft het
     onbeschermd. Precies zoals het hoort. */
  const zelfdeCollectie = Object.keys(staat.b).filter(k => k in staat.a);
  if (!zelfdeCollectie.length) {
    return { stand: 'ongemeten',
      reden: 'de eerste oproep gaf ' + beschrijfDelta(staat.a) + ' en bij de herhaling bewoog ' +
        beschrijfDelta(staat.b) + ' -- ANDERE collecties dan de eerste keer. Dat is geen bewijs dat ' +
        'het werk is herhaald; het kan asynchroon werk van een andere route zijn dat in dit venster landde' };
  }
  return { stand: 'onbeschermd', bron: 'opslag',
    reden: 'gezien aan de opslag: de eerste oproep gaf ' + beschrijfDelta(staat.a) +
    ' en de herhaling opnieuw ' + beschrijfDelta(pak(staat.b, zelfdeCollectie)) };
}

/* Alleen de sleutels die er toe doen, voor een reden die precies zegt WAT er
   opnieuw bewoog en niet ook wat er toevallig langskwam. */
function pak(d, sleutels) {
  const uit = {};
  for (const k of sleutels) uit[k] = d[k];
  return uit;
}

/* HET OORDEEL, apart en puur -- los toetsbaar in test/idemproef.test.js.
   `a`, `b` en `c` zijn de drie antwoorden uit de kop; `staat` is optioneel en
   draagt het per-oproep verschil in de opslag (zie hierboven). `diepeStaat`
   zegt of dat verschil met een INHOUDSAFDRUK is gemeten (RTG_STAATLOG=2) of
   alleen met de lengte (=1); dat verandert wat een uitblijvend verschil
   betekent, en dus wat de reden mag beweren. */
function weegHerhaling(a, b, c, staat, diepeStaat) {
  if (!isOk(a)) {
    return { stand: 'ongemeten', reden: 'de eerste oproep deed geen werk (status ' + ((a && a.status) || 0) + ')' };
  }
  /* HET MERK VAN DE IDEMPOTENTIELAAG. server/lib/idem.js zet `herhaald: true` op
     een antwoord dat uit de bewaarde sleutel komt. Dat is geen gevolgtrekking
     maar een mededeling van de server zelf, en dus het sterkste bewijs dat er
     is -- sterker dan welke vergelijking ook. */
  if (b && b.data && b.data.herhaald === true) {
    return { stand: 'beschermd', grond: 'gemerkt', reden: 'de server merkte de herhaling zelf (herhaald: true)' };
  }
  if (!isOk(b)) {
    /* Een herhaling die wordt GEWEIGERD is ook geen tweede effect. Maar het is
       een ander mechanisme dan herkennen, en dat verschil hoort zichtbaar. */
    return { stand: 'beschermd', grond: 'geweigerd', reden: 'de herhaling werd geweigerd (status ' + b.status + ')' };
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
    /* WAT DIT MEETPUNT WEL EN NIET ZIET, EN DAT VERSCHILT PER STAND.

       Stand 1 telt alleen de LENGTE van de arrays. Een leesroute en een route
       die een bestaande rij OP ZIJN PLAATS bijwerkt zien er dan identiek uit, en
       dat hoort de reden te zeggen.

       Stand 2 neemt ook een inhoudsafdruk, en dan ziet hij dat verschil wel. De
       reden mag dan niet meer beweren dat hij blind is -- dat zou een grens
       melden die er niet meer is, en dat is net zo misleidend als een grens
       verzwijgen. Wat er in stand 2 overblijft is een echte waarneming: deze
       oproep slaagde en veranderde niets. Of dat BETEKENT dat de route leest,
       is een besluit en geen waarneming: een route die niets te doen had (een
       lege veegopdracht) ziet er precies zo uit. Vandaar dat het ongemeten
       blijft, met een andere reden. */
    if (!staat) {
      return { stand: 'ongemeten',
        reden: 'het antwoord verandert niet per oproep; een tweede effect zou hier niet te zien zijn' };
    }
    if (!diepeStaat) {
      return { stand: 'ongemeten',
        reden: 'het antwoord verandert niet per oproep, en de eerste oproep veranderde de opslag niet: ' +
          'een leesroute, of een die alleen op zijn plaats bijwerkt -- dat verschil ziet dit meetpunt niet' };
    }
    return { stand: 'ongemeten',
      reden: 'het antwoord verandert niet per oproep, en de eerste oproep veranderde de opslag niet ' +
        '(gemeten met een inhoudsafdruk, dus ook geen wijziging op zijn plaats). Of dit een LEESroute is ' +
        'of een die deze keer niets te doen had, is een besluit en geen waarneming' };
  }
  if (gelijk(a.data, b.data)) {
    return { stand: 'beschermd', grond: 'gelijk', reden: 'de herhaling gaf hetzelfde antwoord terwijl een verse sleutel ' +
      'een ander gaf' };
  }
  return { stand: 'onbeschermd', reden: 'de herhaling gaf een ander antwoord: hij deed het opnieuw' };
}

async function draaiIdemproef({ post, routes, tokenVoor, lijfVoor, koppenVoor, hernieuw, maxRoutes, staatVan, vastlegging, staatDiep, wacht }) {
  const perRoute = {};
  let gedaan = 0, hernieuwd = 0, uitOpslag = 0, verworpen = 0;
  const tel = { beschermd: 0, onbeschermd: 0, ongemeten: 0 };
  const tegenspraken = [];

  for (const r of routes) {
    if (maxRoutes && Object.keys(perRoute).length >= maxRoutes) break;
    const methode = r.methode || r.method;
    const k1 = 'idemproef-' + r.pad.replace(/\W+/g, '') + '-1';
    const k2 = 'idemproef-' + r.pad.replace(/\W+/g, '') + '-2';
    const lijf = lijfVoor(r);

    const doe = async (sleutel) => {
      /* Sommige deuren verwachten hun sleutel in een KOP en niet in het lijf
         (de zaakdoos). Zonder deze doorgifte klopt de proef er zonder sleutel
         aan en leest 403 als een uitslag. */
      const koppen = koppenVoor ? koppenVoor(r) : null;
      let st = await post(r.pad, { ...lijf, idem: sleutel, idempotentieSleutel: sleutel }, tokenVoor(r.rol), koppen);
      gedaan++;
      /* Een dood token maakt van elke volgende route een 401, en dan meldt de
         ronde "niets gemeten" over honderden routes zonder dat iets klaagt --
         dezelfde meetfout als in de invoerproef, en dezelfde reparatie. */
      if (st.status === 401 && hernieuw) {
        if (await hernieuw(r.rol)) { hernieuwd++; st = await post(r.pad, { ...lijf, idem: sleutel, idempotentieSleutel: sleutel }, tokenVoor(r.rol), koppen); gedaan++; }
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
    const o = weegHerhaling(a, b, c, staat, staatDiep);
    if (o.bron === 'opslag') uitOpslag++;
    tel[o.stand]++;
    /* DE WERELDWACHT. Zie ./wereldcontrole.js: zij peilt om de zoveel routes
       of de opgezette werelden er nog staan, zodat een route die er een sloopt
       een VENSTER krijgt in plaats van een sweep achteraf. Faalt de peiling
       zelf, dan mag dat de ronde niet omgooien -- de meting is het doel. */
    if (wacht) { try { await wacht.naRoute(Object.keys(perRoute).length, r.pad); } catch (e) {} }
    const rij = { methode, pad: r.pad, rol: r.rol,
      idempotentie: o.stand, reden: o.reden, statussen: [a.status, b.status, c.status] };
    if (o.bron) rij.bron = o.bron;
    if (staat) rij.opslag = { a: dA, b: dB, c: dC };

    /* DE TEGENSPRAAK, EN WAAROM ER EEN VIERDE OPROEP BIJ HOORT.

       Het antwoord kan zeggen dat de herhaling niets deed terwijl de opslag laat
       zien dat er tóch iets veranderde. Dat is een sterker signaal dan beide
       meetpunten apart: een route die "herhaald: true" meldt en ondertussen
       doorwerkt, haal je nooit uit een antwoord alleen.

       MAAR DE TOEWIJZING PER OPROEP IS EEN AANNAME. Het verschil dat aan B wordt
       toegeschreven is alles wat er tussen het antwoord van A en dat van B is
       veranderd -- en dit huis heeft achtergrondwerk. Gemeten op 24 augustus:
       een route waarvan de herhaling met 404 werd geweigerd en die op dat pad
       aantoonbaar NIETS schrijft, kreeg toch een verschil toegewezen; er landde
       op dat moment een seed-ronde die negenendertig collecties tegelijk vulde.
       De melding klopte niet, en dat is precies het soort onnagetrokken
       bewering waar deze proef bij anderen op jaagt.

       Dus wordt een vermoeden nu NAGETROKKEN in plaats van gemeld: nog een keer
       dezelfde sleutel, en alleen als de opslag dan wéér beweegt is het van deze
       route. Dat kost een oproep per vermoeden en er zijn er een handvol. */
    /* HETZELFDE NATREKKEN, MAAR DAN DE ANDERE KANT OP.

       Hierboven staat het al voor `beschermd`: een verschil dat aan B wordt
       toegeschreven kan van achtergrondwerk komen, dus wordt het nagetrokken
       met een vierde oproep. Voor `onbeschermd` gebeurde dat NIET -- en juist
       daar is de prijs van een vals alarm het hoogst: dat is de bak waaruit
       iemand een reparatie gaat schrijven.

       Deze ronde leverde precies zo'n vals alarm op (/api/bank/pas/bevries,
       zie de kop van staatOordeel). De statische regel daar -- de herhaling
       moet DEZELFDE collectie raken -- vangt het geval waarin er iets heel
       anders bewoog. Dit vangt het geval waarin toevallig dezelfde collectie
       bewoog: dan is een vierde oproep het verschil tussen een vermoeden en
       een bevinding. */
    if (staat && o.stand === 'onbeschermd' && o.bron === 'opslag' && dB && Object.keys(dB).length) {
      const nog = await doe(k1);
      const dD = staatVan(nog);
      const weer = Object.keys(dB).filter(k => dD && dD[k] !== undefined && k in (staat.a || {}));
      if (!weer.length) {
        o.stand = 'ongemeten';
        o.reden = 'bij de herhaling bewoog ' + beschrijfDelta(dB) + ', maar een vierde oproep met ' +
          'dezelfde sleutel deed dat niet opnieuw: niet van deze route';
        rij.idempotentie = o.stand;
        rij.reden = o.reden;
        verworpen++;
      }
    }
    if (staat && o.stand === 'beschermd' && dB && Object.keys(dB).length) {
      const nog = await doe(k1);
      const dD = staatVan(nog);
      const samen = {};
      for (const k of Object.keys(dB)) if (dD && dD[k] !== undefined) samen[k] = dD[k];
      if (Object.keys(samen).length) {
        rij.tegenspraak = tegenspraakTekst(o.grond, samen);
        rij.grond = o.grond || 'onbekend';
        rij.nagetrokken = true;
        tegenspraken.push(methode + ' ' + r.pad);
      } else {
        /* Niet herhaalbaar: wat er bij B bewoog kwam ergens anders vandaan. Dat
           hoort in het register te staan, want een vermoeden dat spoorloos
           verdwijnt is niet hetzelfde als een vermoeden dat er nooit was. */
        rij.vermoedenVerworpen = 'bij B bewoog ' + beschrijfDelta(dB) +
          ', maar een vierde oproep met dezelfde sleutel deed dat niet opnieuw: niet van deze route';
        verworpen++;
      }
    }
    /* DE FOUTMELDING VAN DE EERSTE OPROEP, en waarom die erbij hoort.

       Een route die met 404 wordt geweigerd, staat in de trechter onder
       "het object bestaat niet". Dat is de juiste bak en het zegt niet WELK
       object -- en dat is nu juist het enige dat je nodig hebt om er een
       fixture voor te bouwen. De server zegt het zelf, elke keer, in zijn
       eigen woorden: "Deze lescode kennen we niet", "De rekening bestaat
       niet", "Deze zaak is geen beauty-salon".

       Zonder dit veld moet iemand voor elk van de 1635 geblokkeerde routes de
       bron induiken om te vinden wat er ontbreekt. Met dit veld valt er te
       GROEPEREN op wat de server vraagt, en dan blijkt vermoedelijk dat
       honderden routes om hetzelfde object vragen.

       Alleen bij een geblokkeerde eerste oproep, en afgekapt: dit is een
       aanwijzing voor wie een fixture bouwt, geen logboek. */
    if (!isOk(a) && a && a.data) {
      const tekst = typeof a.data === 'string' ? a.data
        : (a.data.error || a.data.melding || a.data.reden || '');
      if (tekst) rij.blokkade = String(tekst).slice(0, 160);
    }
    perRoute[methode + ' ' + r.pad] = rij;
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
        if (Object.keys(opnieuw.b).length) rij.tegenspraak = tegenspraakTekst(rij.grond, opnieuw.b);
        else { delete rij.tegenspraak; delete rij.grond; if (i >= 0) tegenspraken.splice(i, 1); }
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
    vermoedensVerworpen: verworpen, vastleggingGemeten, vastleggingVerdacht };
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

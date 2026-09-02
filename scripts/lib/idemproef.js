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
    return { stand: 'ongemeten', reden: staat
      ? 'het antwoord verandert niet per oproep, en de eerste oproep veranderde de opslag niet: ' +
        'een leesroute, of een die alleen op zijn plaats bijwerkt -- dat verschil ziet dit meetpunt niet'
      : 'het antwoord verandert niet per oproep; een tweede effect zou hier niet te zien zijn' };
  }
  if (gelijk(a.data, b.data)) {
    return { stand: 'beschermd', grond: 'gelijk', reden: 'de herhaling gaf hetzelfde antwoord terwijl een verse sleutel ' +
      'een ander gaf' };
  }
  return { stand: 'onbeschermd', reden: 'de herhaling gaf een ander antwoord: hij deed het opnieuw' };
}

/* ============================================================================
   HET OORDEEL VOOR DE RONDE ZONDER SLEUTEL.

   Waarom dit NIET weegHerhaling() hierboven mag zijn: die leunt op de IJKING --
   een derde oproep met een VERSE sleutel. Zonder dat ijkpunt betekent "b gaf
   hetzelfde als a" niets, want een antwoord dat sowieso niet varieert ziet er
   precies zo uit als een herkende herhaling. En in een ronde zonder sleutels
   BESTAAT die verse sleutel niet: elk verzoek is woordelijk hetzelfde, dat is
   nu juist het geval dat we meten. Een ander lijf sturen zou geen ijking zijn
   maar een andere vraag.

   Wat er wel is, is de opslag. Die kent het onderscheid dat het antwoord niet
   kan maken:

     D deed werk, E niet      -> de route (of zijn verklaring) ving de dubbeltik
     D en E deden allebei werk -> een dubbeltik doet het werk twee keer
     geen van beide deed werk  -> niets te zien; geen uitspraak

   Plus een tweede, sterkere bron als hij er is: `herhaald: true` in het antwoord
   is geen gevolgtrekking maar een mededeling van de server zelf. Draagt E dat
   merk terwijl er geen sleutel is gestuurd, dan kan het alleen van de idem-poort
   komen -- en die handelt op de verklaring in idemsleutels.js.

   Zonder het tweede meetpunt (RTG_STAATLOG) blijft alleen dat merk over, en dan
   is 'geen merk' eerlijk gezegd geen uitspraak: dat is hier dus ONGEMETEN en
   niet 'onbeschermd'. */
function weegZonderSleutel(d, e, staat) {
  if (!isOk(d)) {
    return { stand: 'ongemeten', reden: 'de eerste kale oproep deed geen werk (status ' + ((d && d.status) || 0) + ')' };
  }
  if (e && e.data && e.data.herhaald === true) {
    return { stand: 'beschermd', grond: 'gemerkt',
      reden: 'de server merkte de herhaling zelf (herhaald: true) terwijl er GEEN sleutel is gestuurd -- ' +
        'dat kan alleen van de idem-poort komen, op grond van de verklaring in idemsleutels.js' };
  }
  if (!isOk(e)) {
    return { stand: 'beschermd', grond: 'geweigerd', reden: 'de kale herhaling werd geweigerd (status ' + e.status + ')' };
  }
  if (!staat || !staat.a) {
    return { stand: 'ongemeten', reden: 'geen tweede meetpunt: zonder de opslagstand is een gelijk antwoord ' +
      'niet te onderscheiden van een antwoord dat sowieso niet varieert' };
  }
  const werkD = Object.keys(staat.a || {}).length > 0;
  const werkE = Object.keys(staat.b || {}).length > 0;
  if (!werkD) {
    return { stand: 'ongemeten', reden: 'de eerste kale oproep liet niets achter in de gemeten collecties; ' +
      'dan is er geen tweede effect om te zien' };
  }
  if (!werkE) {
    return { stand: 'beschermd', grond: 'opslag',
      reden: 'de eerste kale oproep veranderde de opslag en de woordelijk gelijke herhaling niet' };
  }
  return { stand: 'onbeschermd',
    reden: 'een woordelijk gelijke herhaling ZONDER sleutel deed het werk opnieuw -- dit is de dubbeltik' };
}

async function draaiIdemproef({ post, routes, tokenVoor, lijfVoor, rolVoor, hernieuw, maxRoutes, staatVan, vastlegging, metenZonderSleutel, pasladder, wacht }) {
  const perRoute = {};
  let gedaan = 0, hernieuwd = 0, uitOpslag = 0, verworpen = 0, pasGewisseld = 0;
  const tel = { beschermd: 0, onbeschermd: 0, ongemeten: 0 };
  const telZonder = { beschermd: 0, onbeschermd: 0, ongemeten: 0 };
  const tegenspraken = [];

  for (const r of routes) {
    if (maxRoutes && Object.keys(perRoute).length >= maxRoutes) break;
    const methode = r.methode || r.method;
    const k1 = 'idemproef-' + r.pad.replace(/\W+/g, '') + '-1';
    const k2 = 'idemproef-' + r.pad.replace(/\W+/g, '') + '-2';
    const lijf = lijfVoor(r);

    /* WELKE SLEUTEL PAST OP DEZE DEUR.

       De rol bepaalt het token, maar bij een lid is er nog een tweede slot: de
       PAS. Honderden routes weigeren een RTG Pass met een 403 die niets over de
       rol zegt ("Het Privekantoor is onderdeel van de Lifestyle Pass"), en die
       kwamen allemaal terug als ongemeten. Dat is geen uitspraak over de route
       maar over de sleutelbos.

       Dus: strandt de eerste oproep van een LID op een 403, dan proberen we
       dezelfde deur met de andere twee passen. Slaagt er een, dan meten we
       verder met die -- en het register vermeldt met welke, want een meting die
       een andere pas nodig had is een ander feit dan een die het met de
       instapfas deed. Slaagt geen enkele, dan blijft het eerlijk ongemeten met
       de oorspronkelijke hindernis erbij.

       Dit is geen omzeiling van een grens: elke pas is een legitieme sleutel van
       een echt lid, en wat gemeten wordt is de idempotentie en niet de toegang.
       De toegangsvraag is van de rolproef en die kruist juist met opzet.

       WAT HET KOST, EERLIJK: dit is een EXTRA oproep per ledenroute, en die kan
       werk doen. Op een creatieroute staat er dus een item meer in de wereld dan
       zonder deze lus. Dat vertroebelt de meting niet -- `staatVan` geeft het
       verschil PER oproep, en deze valt buiten de drie die gewogen worden -- maar
       het is wel een mutatie die niemand heeft gevraagd, en daarom staat hij hier
       genoemd in plaats van verstopt. Hij kan alleen op een wegwerpmap, en de
       proef draait ook nergens anders. */
    /* De rol die deze route werkelijk nodig heeft. Meestal die van de bewaker,
       maar een voorvoegselregel kan er een opleggen -- het werkplek-huis laat
       alleen de eigenaar binnen en draagt zelf geen bewakersrol. */
    const gevraagdeRol = rolVoor ? rolVoor(r) : r.rol;
    let pas = gevraagdeRol;
    if (gevraagdeRol === 'member' && Array.isArray(pasladder) && pasladder.length > 1) {
      const eerste = await post(r.pad, { ...lijf }, tokenVoor('member'));
      gedaan++;
      if (eerste.status === 403) {
        for (const kandidaat of pasladder.slice(1)) {
          const t = tokenVoor(kandidaat);
          if (!t) continue;
          const proef = await post(r.pad, { ...lijf }, t);
          gedaan++;
          if (proef.status !== 403) { pas = kandidaat; pasGewisseld++; break; }
        }
      }
    }

    const doe = async (sleutel) => {
      let st = await post(r.pad, { ...lijf, idem: sleutel, idempotentieSleutel: sleutel }, tokenVoor(pas));
      gedaan++;
      /* Een dood token maakt van elke volgende route een 401, en dan meldt de
         ronde "niets gemeten" over honderden routes zonder dat iets klaagt --
         dezelfde meetfout als in de invoerproef, en dezelfde reparatie. */
      if (st.status === 401 && hernieuw) {
        if (await hernieuw(pas)) { hernieuwd++; st = await post(r.pad, { ...lijf, idem: sleutel, idempotentieSleutel: sleutel }, tokenVoor(pas)); gedaan++; }
      }
      return st;
    };

    /* De opslagstand tussen de oproepen door. `staatVan` geeft het verschil dat
       DIE oproep achterliet, met de geijkte ruis er al uit. Zonder de vlag is
       hij er niet en werkt de proef als vanouds op alleen het antwoord. */
    const a = await doe(k1); const dA = staatVan ? staatVan(a) : null;
    const b = await doe(k1); const dB = staatVan ? staatVan(b) : null;
    const c = await doe(k2); const dC = staatVan ? staatVan(c) : null;

    /* ========================================================================
       DE RONDE ZONDER SLEUTEL -- en dit is de meting waar het bij een dubbeltik
       werkelijk om gaat.

       Deze proef stuurt in elke oproep hierboven `idem` EN `idempotentieSleutel`
       mee. server/middleware/idempotentie.js is opt-in op precies die velden en
       staat voor ELKE /api-POST: hij vangt de herhaling dus af, ongeacht wat de
       route zelf doet. "beschermd" hierboven betekent daarom niet "deze route is
       idempotent" maar "de platformbrede laag ving hem" -- en dat is iets anders.

       Nagemeten op 29 augustus 2026, met dezelfde lijven en tokens: vier van de
       vijf routes die MET sleutel `herhaald: true` gaven, gaven ZONDER sleutel
       `herhaald: false`. Alleen /api/agenda/toevoegen bleef beschermd, en die
       heeft dan ook een verklaring in server/lib/idemsleutels.js -- precies de
       laag die zonder clientsleutel werkt (lib/idem-poort.js).

       Een echte dubbeltik van een ongeduldige gebruiker draagt geen sleutel. Dus
       meten we die apart: twee woordelijk gelijke oproepen, geen idem-veld,
       geen header. Wat daar uitkomt is een uitspraak over de ROUTE en over zijn
       verklaring -- niet over de kas die de proef zelf vult.

       Het staat in een EIGEN veld en vervangt het oordeel hierboven niet: welke
       van de twee lagen iets tegenhoudt, zijn twee dingen die je allebei wilt
       weten, en samenvatten tot een cijfer maakt ze allebei onleesbaar. */
    let zonder = null;
    if (metenZonderSleutel) {
      const kaal = async () => { const st = await post(r.pad, { ...lijf }, tokenVoor(pas)); gedaan++; return st; };
      const d = await kaal(); const dD = staatVan ? staatVan(d) : null;
      const e = await kaal(); const dE = staatVan ? staatVan(e) : null;
      const oz = weegZonderSleutel(d, e, staatVan ? { a: dD, b: dE } : null);
      /* DE GROND MOET MEE, EN DAT VERGAT DEZE REGEL. Zonder hem staat er alleen
         'beschermd', en dan zijn drie heel verschillende dingen niet meer uit
         elkaar te houden: de route herkende de herhaling (opslag), de server
         merkte hem zelf (gemerkt), of de herhaling werd botweg GEWEIGERD met een
         409. Dat laatste is geen idempotentie maar een toestandscontrole, en wie
         daar `zelfdeVerzoek` op plakt legt het eerste antwoord over een bewuste
         weigering heen. Gemeten: van de 29 'beschermd' in de ronde van 29
         augustus 2026 had er geen ENKELE een spoor in de opslag -- ze kwamen
         allemaal uit de andere twee gronden, en het register liet dat niet zien. */
      zonder = { stand: oz.stand, grond: oz.grond || null, reden: oz.reden, statussen: [d.status, e.status] };
      if (staatVan) zonder.opslag = { d: dD, e: dE };
      /* HET DERDE MEETPUNT, en met opzet ONBEWERKT. De weging hierboven leunt
         nog op de opslag; dit veld staat ernaast zodat het contractregister zelf
         kan zien of er werkelijk niets gebeurde. Ontbreekt de kop, dan staat er
         null en niet 'geen' -- niet gemeten is iets anders dan gemeten nul, en
         dat verschil is het hele bestaansrecht van deze meter. */
      if (d.effect != null || e.effect != null)
        zonder.effect = { d: d.effect || null, e: e.effect || null,
          nietGemeten: d.effectNietGemeten || e.effectNietGemeten || null };
      /* De laag die het deed, voor zover van buiten te zien: `herhaald: true`
         zonder dat de proef een sleutel stuurde, komt van de idem-poort op grond
         van een verklaring -- de enige weg die daar dan nog voor is. */
      const lijk = e && e.data && typeof e.data === 'object' && e.data.herhaald === true;
      if (lijk) zonder.laag = 'idem-poort (verklaring in idemsleutels.js)';
      telZonder[oz.stand] = (telZonder[oz.stand] || 0) + 1;
    }
    const staat = staatVan ? { a: dA, b: dB, c: dC } : null;
    const o = weegHerhaling(a, b, c, staat);
    if (o.bron === 'opslag') uitOpslag++;
    tel[o.stand]++;
    const rij = { methode, pad: r.pad, rol: r.rol,
      idempotentie: o.stand, reden: o.reden, statussen: [a.status, b.status, c.status] };
    /* Met een LEGE kop aangeroepen, en waarom. Zonder dit veld leest zo'n regel
       als een meting met de juiste rol, en dat is iets anders. */
    if (r.zonderRol) rij.zonderRol = r.zonderRol;
    /* Met welke pas gemeten, als het niet de instapfas was. */
    if (pas !== r.rol) rij.viaPas = pas;

    /* WAT HIELD HEM TEGEN. Bij 'ongemeten' zei dit register alleen "de eerste
       oproep deed geen werk (status 403)". Dat is waar en het is niet genoeg:
       3.463 routes droegen dezelfde zin, en daarmee was de grootste post op de
       lijst een hoop zonder handvat. De status verdeelt hem in vijf bakken, maar
       pas de REDEN die de route zelf teruggaf zegt of er een schakelaar uit
       staat, een pas ontbreekt, of het lijf niet past -- en dat zijn drie heel
       verschillende reparaties.

       Alleen de foutzin, kort, en alleen bij een status die iets tegenhield: dit
       register is geen plek voor antwoordinhoud. */
    if (o.stand === 'ongemeten' && a.status >= 400) {
      const d = a.data;
      const zin = d && typeof d === 'object' ? (d.error || d.fout || d.melding || d.reden) : (typeof d === 'string' ? d : null);
      if (zin) rij.hindernis = String(zin).slice(0, 160);
    }
    if (o.bron) rij.bron = o.bron;
    if (staat) rij.opslag = { a: dA, b: dB, c: dC };
    if (zonder) rij.zonderSleutel = zonder;

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
    perRoute[methode + ' ' + r.pad] = rij;

    /* DE WERELDWACHT PEILT ONDERWEG -- zie scripts/lib/wereldcontrole.js.

       Een eindcontrole zegt DAT een wereld weg is; deze zegt WAAR. Er staan
       sloopachtige routes binnen de werelden die deze proef zelf opzet, en
       zonder venster is "de stadsafdeling bestaat niet meer" een mededeling
       zonder aanknopingspunt.

       Een storing in de wacht mag de meting nooit stilzetten: hij is de
       waarnemer en niet het onderwerp. */
    if (wacht) { try { await wacht.naRoute(Object.keys(perRoute).length, r.pad); } catch (e) {} }
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

  return { perRoute, telling: tel, zonderSleutel: telZonder, pasGewisseld, oproepen: gedaan, hernieuwd, meterStuk, uitOpslag, tegenspraken,
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

module.exports = { draaiIdemproef, weegHerhaling, weegZonderSleutel, normaliseer, gelijk, CONTROL };

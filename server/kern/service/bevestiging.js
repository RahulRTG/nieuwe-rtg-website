/* ============================================================================
   DE SUPPORTBEVESTIGING -- en waarom de vaste steuncode het niet werd.

   WAT ER KAPOT WAS. kern/ledenbalie.js leidt per lid een vaste `steuncode` af
   en het baliescherm zegt erbij: "het lid leest die voor uit de app". Alleen:
   `steuncodeVan()` werd buiten dat bestand nergens aangeroepen -- geen enkele
   route liet een lid zijn eigen code zien. Een beveiligde werkstroom die niet
   uitvoerbaar is, is erger dan geen: hij ziet er af uit, en in de praktijk
   vraagt de balie dan maar iets anders.

   WAAROM DE OPLOSSING NIET "TOON DIE CODE DAN" IS. Dan heeft elk lid een VASTE
   geheime supportcode: over een jaar doorverteld, gescreenshot en hergebruikt,
   en hij zegt niets over WAT er mag -- wie hem heeft, heeft hem voor alles en
   voor altijd.

   WAT HET WEL IS. De medewerker vraagt: "kunt u in uw app op Bevestig
   ondersteuning drukken?" Het lid ziet WIE er vraagt, VOOR WELKE ZAAK en WAT
   die persoon daarmee opent, en drukt zelf. Een handeling van het lid, geen
   geheim dat rondgaat.

   DE CODE BLIJFT, MAAR ALS TERUGVAL EN NIET ALS IDENTITEIT: zes cijfers, vijf
   minuten, EEN keer, gebonden aan DEZE zaak en DEZE gevraagde bevoegdheden, pas
   gemaakt als het lid hem opvraagt en alleen als hash bewaard
   (./bevestiging-code.js zegt waarom zes cijfers daar veilig genoeg zijn).

   WAT EEN BEVESTIGING NIET DOET: iemand identificeren. Zij bewijst dat wie de
   app open heeft akkoord gaat, meer niet. Wat echt om identiteit vraagt
   (./machtiging.js ZWAAR) blijft een tweede mens vragen -- een scan, een code
   of een tik is geen mens (LINK.md par. 3).
   ========================================================================== */
'use strict';

const klok = require('../../lib/klok');
const router = require('./router');
/* De stand en de naar-buiten-vorm staan in
   ./bevestiging-vorm.js: geen levensloop, geen opslag, alleen vorm. */
const vorm = require('./bevestiging-vorm');

const MINUTEN = 5;

module.exports = function maakBevestiging({ db, save, crypto, zaken, machtigingen, bewerkCollectie }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/service-bevestiging', bezit: { serviceBevestigingen: 'lijst' } });
  const B = () => eigen.bak('serviceBevestigingen');
  const nu = () => klok.datum().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
  const inhoud = (s) => String(s || '').replace(/[^\p{L}\p{N}]/gu, '').length;

  const stand = vorm.stand;
  const levend = vorm.levend;
  const kortB = (b, o) => vorm.kortB(b, Object.assign({ minuten: MINUTEN }, o));
  const vind = (id) => B().find(b => b.id === String(id || '')) || null;

  /* De medewerker vraagt. De gevraagde capabilities staan er meteen bij: wat het
     lid bevestigt moet hetzelfde zijn als wat er daarna opengaat, anders is de
     bevestiging een blanco cheque. */
  function vraag({ zaakId, mens, doel, capabilities, reden } = {}) {
    const z = zaken.vind(zaakId);
    if (!z) return { status: 404, error: 'Een bevestiging hoort bij een zaak.' };
    const w = schoon(mens, 60);
    if (!w) return { status: 400, error: 'Wie vraagt erom? Een bevestiging zonder naam kan het lid niet beoordelen.' };
    const r = schoon(reden, 300);
    if (inhoud(r) < 10) return { status: 400, error: 'Zeg in een zin waarvoor u dit nodig heeft. Het lid leest die zin.' };

    /* HIER WORDT VERSMALD, EN NIET PAS BIJ HET INDRUKKEN. Wat het lid leest moet
       exact zijn wat er opengaat -- anders is de knop een blanco cheque, of
       erger: hij weigert straks iets dat het lid net goedkeurde. Dat gebeurde
       ook echt: "ik wil een mens" verhuist de zaak naar een ander team, en de
       klaarstaande bevestiging werd daardoor onbruikbaar.

       Het team gaat mee, zodat ./machtiging.js straks tegen DEZELFDE grens
       versmalt als hier getoond. Verruimen kan niet: het blijft
       `router.benodigd()` van een echt team. */
    /* `teVragen` en niet `benodigd`: wat de ZETEL al verleent hoort niet in een
       bevestiging (./teams.js legt uit wat dat kostte). */
    const mag = router.teVragen(z.team);
    const gevraagd = (Array.isArray(capabilities) ? capabilities : []).map(c => schoon(c, 60)).filter(Boolean);
    const gekregen = gevraagd.filter(c => mag.includes(c));
    if (!gekregen.length) {
      /* De weigering noemt WAT er dan wel te vragen valt: "dit mag niet" is een
         raadsel voor wie net op een knop drukte die het scherm hem aanbood. */
      return { status: 403, geweigerd: gevraagd, teVragen: mag,
        error: mag.length
          ? 'Dat heeft team ' + z.team + ' hier niet nodig, of uw zetel verleent het al. ' +
            'Wel te vragen: ' + mag.join(', ') + '.'
          : 'Team ' + z.team + ' vraagt het lid nergens toestemming voor: uw zetel verleent alles ' +
            'wat dit team doet. Zet de zaak door naar het team dat verder kijkt.' };
    }

    /* Een lopende bevestiging voor dezelfde zaak, dezelfde mens EN DEZELFDE
       GEVRAAGDE TOEGANG wordt hergebruikt in plaats van opgestapeld: anders
       staan er bij een tweede poging twee knoppen in de app en weet het lid
       niet welke de zijne is.

       DIE DERDE VOORWAARDE STOND ER EERST NIET. Hergebruik op alleen (zaak,
       mens) gaf een medewerker die om iets ANDERS vroeg stilletjes het oude
       verzoek terug, en het lid keurde dan iets anders goed dan er gevraagd
       was. Gevonden met een kale meetronde: in de toets vroeg niemand twee keer
       iets verschillends. */
    const zelfde = (a, b2) => a.length === b2.length && a.every(x => b2.includes(x));
    const bestaand = B().find(b => b.zaak === z.id && b.mens === w && levend(b) && zelfde(b.capabilities, gekregen));
    /* `hergebruikt` is geen cosmetiek: een aanroeper die er iets NAAST schrijft
       -- een regel op de tijdlijn bijvoorbeeld -- moet dat kunnen laten. Zonder
       deze vlag moest hij de zin in `let` gaan lezen, en een gedragsgrens die aan
       een zin hangt sneuvelt bij de eerste herformulering. */
    if (bestaand) return { ok: true, bevestiging: kortB(bestaand), hergebruikt: true,
      let: 'Er stond al een verzoek open; dat is hergebruikt.' };

    const at = nu();
    const b = {
      id: 'BEV-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      zaak: z.id, melder: z.melder, mens: w,
      doel: schoon(doel, 200) || null, reden: r,
      capabilities: gekregen, team: z.team,
      code_hash: null, codeUitgifte: 0, codePogingen: 0,
      at, tot: new Date(Date.parse(at) + MINUTEN * 60000).toISOString(),
      gebruiktAt: null, geweigerdAt: null, machtiging: null, via: null
    };
    B().unshift(b);
    if (B().length > 5000) B().pop();
    save();
    return { ok: true, bevestiging: kortB(b) };
  }

  /* Wat er in de app van dit lid klaarstaat. Alleen wat leeft: een verlopen
     verzoek in een lijst nodigt uit om alsnog te drukken. */
  function voorLid(melder) {
    return B().filter(b => b.melder === String(melder || '') && levend(b)).slice(0, 10)
      .map(b => kortB(b, { voorLid: true }));
  }

  /* Indrukken, weigeren, de code opvragen en de code gebruiken VERBRUIKEN een
     verzoek; dat staat in ./bevestiging-code.js, in een collectietransactie. */
  const code = require('./bevestiging-code')({ crypto, bewerkCollectie, machtigingen, nu, stand, kortB, MINUTEN, B });

  const lijst = (f) => {
    const o = f || {};
    let a = B();
    if (o.zaak) a = a.filter(b => b.zaak === String(o.zaak).toUpperCase());
    if (o.alleenOpen) a = a.filter(levend);
    return a.slice(0, Number(o.max || 50)).map(b => kortB(b));
  };

  return { vraag, bevestig: code.bevestig, weiger: code.weiger, toon: code.toon, metCode: code.metCode,
    voorLid, lijst, stand, vind, MINUTEN };
};

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
   minuten, EEN keer, gebonden aan DEZE zaak en DEZE gevraagde bevoegdheden.
   Nodig omdat een lid dat niet bij zijn app kan -- bij een toegangsprobleem
   nogal waarschijnlijk -- anders nergens heen kan.

   WAT EEN BEVESTIGING NIET DOET: iemand identificeren. Zij bewijst dat wie de
   app open heeft akkoord gaat, meer niet. Wat echt om identiteit vraagt
   (./machtiging.js ZWAAR) blijft een tweede mens vragen -- een scan, een code
   of een tik is geen mens (LINK.md par. 3).
   ========================================================================== */
'use strict';

const klok = require('../../lib/klok');
const router = require('./router');

const MINUTEN = 5;

module.exports = function maakBevestiging({ db, save, crypto, zaken, machtigingen }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/service-bevestiging', bezit: { serviceBevestigingen: 'lijst' } });
  const B = () => eigen.bak('serviceBevestigingen');
  const nu = () => klok.datum().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
  const inhoud = (s) => String(s || '').replace(/[^\p{L}\p{N}]/gu, '').length;

  /* Zes cijfers uit een CSPRNG. Geen Math.random: dit is een sleutel, hoe kort
     hij ook leeft (keuringsregel over zwakke sleutels). */
  const cijfers = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

  function stand(b) {
    if (b.gebruiktAt) return 'gebruikt';
    if (b.geweigerdAt) return 'geweigerd';
    return Date.parse(b.tot) <= klok.nu() ? 'verlopen' : 'open';
  }
  const vind = (id) => B().find(b => b.id === String(id || '')) || null;
  const levend = (b) => stand(b) === 'open';

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
    const mag = router.benodigd(z.team);
    const gevraagd = (Array.isArray(capabilities) ? capabilities : []).map(c => schoon(c, 60)).filter(Boolean);
    const gekregen = gevraagd.filter(c => mag.includes(c));
    if (!gekregen.length) {
      return { status: 403, geweigerd: gevraagd,
        error: 'Het team ' + z.team + ' heeft dit niet nodig voor deze zaak. Zet de zaak eerst door ' +
          'naar het team dat het wel mag; vraag het lid daarna pas om te bevestigen.' };
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
    if (bestaand) return { ok: true, bevestiging: kortB(bestaand, { voorMens: true }), let: 'Er stond al een verzoek open; dat is hergebruikt.' };

    const at = nu();
    const b = {
      id: 'BEV-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      zaak: z.id, melder: z.melder, mens: w,
      doel: schoon(doel, 200) || null, reden: r,
      capabilities: gekregen, team: z.team,
      code: cijfers(),
      at, tot: new Date(Date.parse(at) + MINUTEN * 60000).toISOString(),
      gebruiktAt: null, geweigerdAt: null, machtiging: null, via: null
    };
    B().unshift(b);
    if (B().length > 5000) B().pop();
    save();
    return { ok: true, bevestiging: kortB(b, { voorMens: true }) };
  }

  /* WAT DE MEDEWERKER ZIET IS NIET WAT HET LID ZIET. De code hoort in de app
     van het LID: een medewerker die hem van zijn eigen scherm kan aflezen,
     bevestigt niets, en dan is de terugval een lege ceremonie. */
  function kortB(b, { voorMens = false, voorLid = false } = {}) {
    const basis = { id: b.id, zaak: b.zaak, mens: b.mens, doel: b.doel, reden: b.reden,
      capabilities: b.capabilities.slice(), stand: stand(b), at: b.at, tot: b.tot,
      machtiging: b.machtiging, via: b.via };
    if (voorLid) return Object.assign(basis, { code: levend(b) ? b.code : null, minuten: MINUTEN });
    if (voorMens) return basis;
    return basis;
  }

  /* Wat er in de app van dit lid klaarstaat. Alleen wat leeft: een verlopen
     verzoek in een lijst nodigt uit om alsnog te drukken. */
  function voorLid(melder) {
    return B().filter(b => b.melder === String(melder || '') && levend(b)).slice(0, 10)
      .map(b => kortB(b, { voorLid: true }));
  }

  /* Het lid drukt. Hier ontstaat de machtiging -- en nergens anders: een
     bevestiging die geen machtiging oplevert, is een knop zonder gevolg, en een
     machtiging zonder bevestiging is precies wat deze laag voorkomt. */
  function bevestig(id, { melder, via } = {}) {
    const b = vind(id);
    if (!b) return { status: 404, error: 'Dit verzoek kennen wij niet.' };
    if (String(melder || '') !== b.melder) return { status: 403, error: 'Dit verzoek staat niet op uw naam.' };
    const s = stand(b);
    if (s !== 'open') return { status: 400, error: 'Dit verzoek is ' + s + '. Vraag de medewerker om een nieuw verzoek.' };

    const m = machtigingen.verleen({ zaakId: b.zaak, mens: b.mens, doel: b.doel,
      capabilities: b.capabilities, binnenTeam: b.team,
      reden: b.reden + ' (bevestigd door het lid zelf)' });
    if (m.error) return m;
    b.gebruiktAt = nu(); b.machtiging = m.machtiging.id; b.via = String(via || 'app');
    save();
    return { ok: true, bevestiging: kortB(b), machtiging: m.machtiging };
  }

  /* Weigeren hoort net zo makkelijk te zijn als bevestigen. Een knop die alleen
     ja kent, is geen keuze. */
  function weiger(id, { melder } = {}) {
    const b = vind(id);
    if (!b) return { status: 404, error: 'Dit verzoek kennen wij niet.' };
    if (String(melder || '') !== b.melder) return { status: 403, error: 'Dit verzoek staat niet op uw naam.' };
    if (stand(b) !== 'open') return { status: 400, error: 'Dit verzoek is ' + stand(b) + '.' };
    b.geweigerdAt = nu();
    save();
    return { ok: true, bevestiging: kortB(b) };
  }

  /* DE TERUGVAL. Het lid leest zijn zes cijfers voor; de medewerker typt ze in.
     Dezelfde uitkomst als drukken, dus dezelfde eenmaligheid en dezelfde
     vervaltijd -- en de code hoort bij DEZE bevestiging, dus hij opent niets
     anders. Vergelijken zonder vroegtijdig af te breken: een code van zes
     cijfers is klein genoeg om te raden als je mag meten hoe ver je kwam. */
  function metCode(code, { mens } = {}) {
    const c = String(code || '').replace(/\D/g, '');
    if (c.length !== 6) return { status: 400, error: 'Een bevestigingscode is zes cijfers.' };
    const w = schoon(mens, 60);
    const kandidaat = B().find(b => levend(b) && b.mens === w && gelijk(b.code, c));
    if (!kandidaat) return { status: 404, error: 'Deze code hoort niet bij een openstaand verzoek van u. Codes gelden ' + MINUTEN + ' minuten en een keer.' };
    return bevestig(kandidaat.id, { melder: kandidaat.melder, via: 'code' });
  }

  function gelijk(a, b) {
    const x = String(a), y = String(b);
    if (x.length !== y.length) return false;
    let v = 0;
    for (let i = 0; i < x.length; i++) v |= x.charCodeAt(i) ^ y.charCodeAt(i);
    return v === 0;
  }

  const lijst = (f) => {
    const o = f || {};
    let a = B();
    if (o.zaak) a = a.filter(b => b.zaak === String(o.zaak).toUpperCase());
    if (o.alleenOpen) a = a.filter(levend);
    return a.slice(0, Number(o.max || 50)).map(b => kortB(b));
  };

  return { vraag, bevestig, weiger, metCode, voorLid, lijst, stand, vind, MINUTEN };
};

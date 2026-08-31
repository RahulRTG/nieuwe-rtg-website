/* ============================================================================
   DE GEGEVENSKAART -- wat weet RTG van mij, en waar komt dat vandaan.

   Het register staat in ./gegevenssoorten.js; dit bestand LEEST. Die scheiding
   is dezelfde als bij sessievelden/sessiecontext, en om dezelfde reden: een
   lijst met besluiten erin verandert zelden, een peiling verandert per lid.

   DE REGEL DIE DEZE LAAG DRAAGT (MIJNRTG.md G6): deze kaart TOONT bewijs en
   MEET het niet. Elke peiling hieronder vraagt het aan de laag die het gegeven
   bezit -- de kluis, het dossier, het sessieregister -- en niemand hier rekent
   iets uit dat elders al bestaat. Waar een peiling ontbreekt of stukloopt,
   staat er `aanwezig: null` met de reden erbij.

   EN DAT IS GEEN NETHEID MAAR HET VERSCHIL DAT DEZE KAART BRUIKBAAR MAAKT.
   BESTUUR.md: `niet vast te stellen` is een eersteklas uitslag naast ja en nee.
   Zou een mislukte peiling als "nee" op het scherm komen, dan leest een lid
   "RTG heeft mijn adres niet" op het moment dat de kluis even niet opengaat --
   en dat is precies het soort geruststelling waar niemand iets aan heeft.

   WAT DEZE KAART NIET ZEGT staat in GRENZEN, en gaat mee naar het scherm. Een
   overzicht dat zijn eigen rand niet noemt, leest als "dit is alles".
   ========================================================================== */
'use strict';

const { SOORTEN, WAAR, HERKOMST, GRONDEN } = require('./gegevenssoorten');
/* DE TERMIJN KOMT UIT HET BELEID EN NIET UIT EEN ZIN. Hij stond eerst als
   "zeven jaar" in het register, en dat is precies hoe een document van de code
   wegdrijft: bij het narekenen bleek het inzagejournaal niet "altijd" te
   blijven maar twee jaar. Wie een bewaartermijn overtypt, heeft hem binnen een
   jaar mis. */
const { BELEID } = require('../../bewaartermijnen');

function termijnVan(tak) {
  if (!tak) return null;
  const r = (BELEID || []).find(x => x.tak === tak);
  /* Een tak die niet meer bestaat levert GEEN stilte op: dan staat er op de
     kaart dat de termijn niet is vast te stellen, en dat is de eerlijke stand.
     Een verdwenen regel als "geen termijn" tonen zou zeggen dat het eeuwig
     blijft staan, en dat is de gevaarlijke kant van de fout. */
  if (!r) return { bekend: false, waarom: 'De bewaarregel voor dit gegeven is niet gevonden; hoe lang het blijft staan is hier niet vast te stellen.' };
  return {
    bekend: true, dagen: r.dagen, grond: r.grond,
    inWoorden: r.dagen >= 365 ? Math.round(r.dagen / 365) + ' jaar' : r.dagen + ' dagen',
    waarom: r.waarom
  };
}

/* De rand van deze kaart, in de woorden van een lid. Alle vier komen ze uit
   hoe dit huis werkelijk in elkaar zit en niet uit voorzichtigheid. */
const GRENZEN = [
  { naam: 'Dit zijn soorten, geen inhoud',
    reden: 'Hier staat DAT RTG uw adres heeft en waarvoor het mag worden gebruikt -- niet wat er staat. De inhoud zelf haalt u op met een uitvoer van uw dossier onder Juridisch.' },
  { naam: 'Wat een zaak zelf bijhoudt, staat hier niet',
    reden: 'Deelde u iets met een restaurant of een kliniek, dan heeft die partij een eigen administratie. Wat er openstaat ziet u bij "Wie heeft toegang tot mij"; wat zij daarna zelf noteren, valt buiten RTG.' },
  { naam: 'Een controle met het Zegel komt hier niet op',
    reden: 'Het Zegel draagt een pseudoniem dat per zaak verschilt, dus RTG kan een controle niet aan uw account terugkoppelen. Dat is hoe het uw privacy bewaart, en het kost deze kaart een regel.' },
  { naam: 'Deze kaart schrijft niets',
    reden: 'Hem openen laat geen spoor achter. Zou dat wel zo zijn, dan zou uw eigen kaart voller worden door ernaar te kijken.' }
];

function maakGegevenskaart({ accounts, sessieregister, toestellen, commercieel, inzagekaart }) {

  /* DE PEILINGEN. Elk geeft true, false of null terug -- en null draagt altijd
     een reden. Er is met opzet geen peiling die bij twijfel "nee" zegt. */
  const peiling = {
    'kluis:naam': (u) => !!(u && accounts.realNameOf(u)),
    'kluis:codenaam': (u) => !!(u && u.codename),
    'kluis:email': (u) => !!(u && accounts.emailOf(u)),
    'kluis:telefoon': (u) => !!(u && accounts.phoneOf(u)),
    'kluis:verificatie': (u) => !!(u && u.verified && u.verified !== 'unverified'),
    'dossier:geboortedatum': (u, md) => !!(md && md.geboren),
    'dossier:adres': (u, md) => !!(md && md.adres),
    'dossier:tweefactor': (u, md) => !!(md && md.tweefactor && md.tweefactor.aan),
    sessies: (u, md, key) => (sessieregister ? sessieregister.vanLid(key).length > 0 : null),
    toestellen: (u, md, key) => (toestellen ? toestellen.lijst(key).length > 0 : null),
    post: (u, md, key) => (commercieel ? commercieel.standVan(key).soorten.some(s => s.aan) : null),
    inzage: (u, md, key) => (inzagekaart ? (inzagekaart(key).kaart || []).length > 0 : null)
  };

  /* Een peiling die stukloopt is GEEN "nee". Hij komt terug als onbekend met de
     storing erbij, want een kaart die een storing als afwezigheid toont, liegt
     precies op het moment dat het ertoe doet. */
  function peil(soort, u, md, key, storing) {
    if (!soort.meet) return { aanwezig: null, waarom: 'Deze kaart peilt dit niet; het staat hier omdat het bestaat en niet omdat het gemeten is.' };
    /* HIER GING HET EEN KEER MIS, EN PRECIES ZOALS DE KOP HET VERBIEDT. Een
       kluis die niet opengaat leverde `md = null`, en dan zeggen de
       dossier-peilingen hieronder keurig `false` -- oftewel "u heeft geen
       adres" op het moment dat we het niet KUNNEN weten. De storing moet dus
       meereizen tot hier; hem opvangen bij de bron en dan doorgaan is precies
       de vorm waarin een laag zijn eigen regel breekt. */
    if (storing && soort.meet.startsWith('dossier:')) {
      return { aanwezig: null, waarom: 'Uw dossier kon niet worden gelezen; dit is dus onbekend en niet afwezig.' };
    }
    const fn = peiling[soort.meet];
    if (!fn) return { aanwezig: null, waarom: 'Er is voor dit gegeven geen peiling gebouwd.' };
    try {
      const uit = fn(u, md, key);
      if (uit === null || uit === undefined) return { aanwezig: null, waarom: 'De laag die dit bezit is hier niet aangesloten.' };
      return { aanwezig: !!uit };
    } catch (e) {
      return { aanwezig: null, waarom: 'De peiling liep stuk; dit is dus onbekend en niet afwezig.' };
    }
  }

  function kaartVan(key, account) {
    const u = account && accounts.getUserById ? accounts.getUserById(account.id) : null;
    let md = null, dossierStoring = false;
    try { md = u && accounts.getMemberState ? accounts.getMemberState(u.id) : null; }
    catch (e) { md = null; dossierStoring = true; }

    const rijen = SOORTEN.map(s => {
      const p = peil(s, u, md, key, dossierStoring);
      return {
        id: s.id, naam: s.naam,
        waar: s.waar, waarUitleg: WAAR[s.waar],
        herkomst: s.herkomst, herkomstUitleg: HERKOMST[s.herkomst],
        doel: s.doel,
        /* De grond reist mee als UITLEG en niet als code: 'wettelijk' zegt een
           jurist iets en een lid niets. */
        weg: Object.assign({}, s.weg, s.weg.grond ? { grondUitleg: GRONDEN[s.weg.grond] } : {}),
        ...(s.bewaartak ? { termijn: termijnVan(s.bewaartak) } : {}),
        aanwezig: p.aanwezig,
        /* De reden reist mee met de rij en niet als losse lijst onderaan: een
           onbekende die je pas drie schermen verder kunt verklaren, wordt
           gelezen als een nee. */
        ...(p.waarom ? { waarom: p.waarom } : {})
      };
    });

    /* GEEN SAMENGESTELD GETAL. LAT-regel 11 verbiedt het en hier zou het ook
       niets betekenen: "9 van de 13 gegevens" telt een telefoonnummer even
       zwaar als een identiteitsbewijs. Wat er wel staat is een telling per
       uitkomst, inclusief de onbekende -- die hoort even zichtbaar te zijn als
       de andere twee. */
    const telling = {
      aanwezig: rijen.filter(r => r.aanwezig === true).length,
      afwezig: rijen.filter(r => r.aanwezig === false).length,
      onbekend: rijen.filter(r => r.aanwezig === null).length
    };

    return {
      rijen, telling, grenzen: GRENZEN,
      uitleg: 'Per soort gegeven: waar het staat, hoe het bij ons kwam, waarvoor het gebruikt mag worden, en of u het weg kunt halen.',
      /* WAT ER OVERBLIJFT ALS U UW ACCOUNT OPHEFT, en dat is een kortere lijst
         dan "wat niet los weg kan". Die twee stonden hier eerst op een hoop, en
         dan komt uw naam naast uw facturen te staan terwijl het ene meegaat en
         het andere zeven jaar blijft. Wie hier komt met de vraag "kan alles
         weg" verdient het eerlijke antwoord, en dat is nee -- maar alleen om
         deze twee. */
      naOpheffen: SOORTEN.filter(s => s.weg && s.weg.grond && s.weg.grond !== 'account-nodig')
        .map(s => ({ naam: s.naam, grond: s.weg.grond, reden: s.weg.reden, termijn: termijnVan(s.bewaartak) })),
      /* EN DE DERDE UITKOMST, die het scherm eerst niet noemde. kern/vergeten.js
         kent vier soorten en de tweede is "de persoon eruit, de rest blijft":
         een reactie in andermans draad, de helft van iemands gesprek, de bel van
         een zaak. Dat is geen wissen en geen bewaren. Wie leest "alles gaat weg"
         en later zijn eigen zin nog ziet staan zonder naam, is verkeerd
         voorgelicht -- ook al is er niets fout gegaan. */
      geanonimiseerd: {
        wat: 'Wat van u in het werk van een ander zit -- een reactie in andermans draad, uw helft van een gesprek, een beoordeling bij een zaak.',
        hoe: 'Daar wordt u uit gehaald in plaats van dat het verdwijnt: de tekst blijft staan, uw naam en uw codenaam gaan eraf.',
        waarom: 'Het is ook het gesprek van iemand anders, en dat kunt u niet namens hem weghalen.',
        bron: 'server/kern/vergeten/anoniem.js'
      },
      /* En los daarvan: wat er niet APART weg kan zolang het account bestaat. */
      accountNodig: SOORTEN.filter(s => s.weg && s.weg.grond === 'account-nodig')
        .map(s => ({ naam: s.naam, reden: s.weg.reden }))
    };
  }

  return { kaartVan, SOORTEN, GRENZEN };
}

module.exports = { maakGegevenskaart, GRENZEN };

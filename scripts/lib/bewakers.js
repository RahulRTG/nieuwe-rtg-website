/* ============================================================================
   WAT VOOR SOORT DEUR IS DIT? -- DE BEWAKERSKAART

   De vier bewijsproeven (rol, invoer, idempotentie, staat) kruisen ROLLEN: ze
   kloppen bij een route aan met het token van een andere rol en eisen dat hij
   dicht blijft. Daarvoor moeten ze weten welke rol bij een route hoort, en dat
   leidden ze af uit de namen van de bewakerslagen.

   Dat werkte voor drie namen (auth, supplierAuth, officeAuth). De 937 routes
   zonder rol vielen daardoor in twee bakken: 578 met aantoonbaar GEEN
   bewakerslaag, en 359 onder een reden die het verkeerde beloofde -- "bewaker
   zonder bekende rol". Die zin leest als "er ontbreekt een token", en dat is bij
   geen van de vijf groepen eronder de juiste diagnose. 138 ervan waren al die
   tijd gewoon te kruisen en werden alleen niet herkend; bij de overige 221 is
   rollen kruisen de VERKEERDE VRAAG, en ze alsnog kruisen zou groen opleveren dat
   niets bewijst -- dezelfde fout die de AUTH-as al een keer 294 cellen dekking
   kostte (zie NORM.json).

   Zo vallen die 359 uiteen (gemeten, niet geschat):
     138  eigenrol         -- kruisbaar, en nu ook gekruist
     106  objectpoort      -- vraagt een IDOR-proef, niet deze
      63  lichaamssleutel  -- de sleutel zit in het lichaam; kruisen meet niets
      51  geenBewaker      -- helemaal geen deur, alleen een rem of cache
       1  omgeving         -- de opstelling beslist, niet de bezoeker

   Die getallen gaan over ALLE 4191 routes die de router kent. De vier proeven
   kijken naar een smallere populatie (niet-GET onder /api/, 4115 routes) en
   komen daarom op andere getallen uit: 861 zonder rol, waarvan 523 zonder
   bewakerslaag en 338 in deze vijf groepen -- 123 eigenrol, en verder dezelfde
   106 / 63 / 45 / 1. Wie een register naleest moet weten welke van de twee hij
   voor zich heeft; ze zijn allebei goed en ze zijn niet hetzelfde.

   DE ZEVEN SOORTEN, en waarom het er zeven zijn en niet een:

     rol             establishes een van de drie gemodelleerde rollen.
                     auth / supplierAuth / officeAuth. Hier werkt kruisen.

     eigenrol        establishes een identiteit MET een rol die buiten het
                     drietal valt, via een token in de kop of de sessie.
                     boardroomAuth, techAuth, baasAuth, scimAuth. Juist hier
                     werkt kruisen HET BEST: alle drie de bestaande tokens zijn
                     dan een verkeerde rol, dus er valt drie keer iets te meten
                     in plaats van twee keer. Ze stonden alleen niet op de kaart.

     verfijner       versmalt binnen een al vastgestelde rol en staat NOOIT
                     alleen. rijk, poort, geenGast, pro, gem, balieAuth,
                     kansPoort, eigenaarAlleen, alleenBaas. Voor de rolvraag
                     doen ze niet mee; de bewaker voor hen bepaalt de rol.

     lichaamssleutel de sleutel is een VELD IN HET VERZOEK, geen token in de kop.
                     gastAuth leest req.body.sleutel, gezinsPoort en rtfPoort
                     lezen req.body.code + req.body.token, arrivalPassAuth leest
                     req.body.pass. Een member-, supplier- of officetoken in de
                     kop is voor zo'n deur niet fout maar IRRELEVANT: hij kijkt
                     er niet naar. Alle drie krijgen dezelfde 401, en die 401
                     zegt niets over rolscheiding. Kruisen is hier zinloos, en
                     het resultaat als bewijs tellen is erger dan zinloos.

     objectpoort     kijkt of je eigenaar bent van het OBJECT dat in het lichaam
                     staat, en antwoordt 404 op een onbekend object VOORDAT hij
                     naar de identiteit kijkt. huisAuth en huisPoort doen eerst
                     werkplek.kent(req.body.bedrijf). Met een leeg of verzonnen
                     bedrijf is het antwoord altijd 404 en is de identiteit nooit
                     aan de beurt geweest. Meetbaar, maar alleen met een BESTAAND
                     object van iemand anders -- en dat is een andere proef (een
                     IDOR-proef), niet deze.

     geenBewaker     geen deur. `mw` is de snelheidsrem (server/rem.js) of de
                     cachelaag (server/lib/cache.js). Een route waarvan de enige
                     voorlaag `mw` heet, heeft GEEN autorisatielaag -- zijn
                     bewaking zit in de handler of nergens. Dat hoort bij de 578
                     routes zonder bewakerslaag te staan en niet bij "onbekende
                     rol", want het vraagt om een heel andere reparatie.

     omgeving        gaat open of dicht door de OPSTELLING en niet door wie er
                     klopt. meetpoort (server/meetpoort.js) eist RTG_METRICS_TOKEN
                     zodra dat gezet is, en laat anders het interne net door. Zie
                     het blok bij PUBLIEK in scripts/poortwacht.js.

   DE KAART IS UITPUTTEND, EN DAT IS HET PUNT. Elke bewakersnaam die de router
   kent staat hieronder. Komt er een nieuwe bij, dan valt hij door naar
   'onbekend' -- en test/bewakers.test.js zakt daarop. Zo dwingt een nieuwe deur
   een BESLISSING af over wat voor deur het is, in plaats van stil in een restpost
   te verdwijnen. Dat is de hele reden dat dit bestand er is.
   ========================================================================== */
'use strict';

/* naam -> [soort, rol, waarom]. `rol` alleen bij rol/eigenrol; bij de rest null.
   De rolnamen van eigenrol staan MET OPZET buiten het drietal member/supplier/
   office: zo herkent draaiRolproef() ze niet als "de juiste rol" en probeert hij
   ze alle drie. */
const KAART = new Map([
  // ---- rol: de drie gemodelleerde rollen ----
  ['auth', ['rol', 'member', 'een ingelogd lid']],
  ['eisAccount', ['rol', 'member', 'een ingelogd lid; andere naam voor dezelfde deur als auth']],
  ['lid', ['rol', 'member', 'een ingelogd lid; andere naam voor dezelfde deur als auth']],
  ['supplierAuth', ['rol', 'supplier', 'een ingelogde leverancier']],
  ['officeAuth', ['rol', 'office', 'een ingelogd kantoormedewerker']],
  ['kantoorAuth', ['rol', 'office', 'een ingelogd kantoormedewerker; Nederlandse naam voor officeAuth']],
  ['adminOnly', ['rol', 'office', 'een kantoormedewerker met beheerrechten; smaller dan officeAuth, zelfde token']],

  // ---- eigenrol: identiteit met een rol buiten het drietal ----
  ['boardroomAuth', ['eigenrol', 'boardroom',
    'draait eerst officeAuth en eist daarna boardroomtoegang; member en supplier stranden op de eerste, office op de tweede']],
  ['techAuth', ['eigenrol', 'techniek',
    'verifieert het token als ECHT account en toetst daarna magInzien(); een geldig lid krijgt 403 en een kritieke melding op het veiligheidsbord']],
  ['baasAuth', ['eigenrol', 'werkplekbaas',
    'alleen de eigenaar van de werkplek; leest de identiteit, niet het lichaam']],
  ['scimAuth', ['eigenrol', 'scim',
    'een eigen bearer-geheim voor de koppeling; geen van de drie gebruikerstokens past erop']],

  // ---- verfijner: versmalt binnen een al vastgestelde rol, nooit alleen ----
  ['rijk', ['verfijner', null, 'rijksdienst binnen supplierAuth']],
  ['poort', ['verfijner', null, 'marechaussee-dienst binnen supplierAuth']],
  ['geenGast', ['verfijner', null, 'sluit meelezende gasten uit binnen auth']],
  ['pro', ['verfijner', null, 'zakelijke laag binnen auth']],
  ['gem', ['verfijner', null, 'gemeentedienst binnen supplierAuth']],
  ['balieAuth', ['verfijner', null, 'ledenbalie binnen officeAuth']],
  ['kansPoort', ['verfijner', null, 'recht kansenbord.plaatsen binnen auth+pro']],
  ['eigenaarAlleen', ['verfijner', null, 'alleen de eigenaar, binnen techAuth']],
  ['alleenBaas', ['verfijner', null, 'alleen de baas, binnen boardroomAuth of werkmail']],
  ['eigenAccount', ['verfijner', null,
    'een eigen RTG-account binnen auth; een anonieme demo-gast heeft er geen']],
  ['nietBeschermd', ['verfijner', null,
    'sluit een beschermd kind uit binnen gezinsPoort; de kern weigert al, dit is het antwoord dat het scherm nodig heeft']],

  // ---- lichaamssleutel: de sleutel staat in het verzoek, niet in de kop ----
  ['gastAuth', ['lichaamssleutel', null, 'herkent req.body.sleutel als tafelsessie']],
  ['gezinsPoort', ['lichaamssleutel', null, 'verifieerProfiel(req.body.code, req.body.token)']],
  ['rtfPoort', ['lichaamssleutel', null, 'verifieerProfiel(req.body.code, req.body.token)']],
  ['arrivalPassAuth', ['lichaamssleutel', null, 'zoekt req.body.pass op als Arrival Pass']],

  // ---- objectpoort: eigenaarschap van een object uit het lichaam, 404 gaat voor ----
  ['huisAuth', ['objectpoort', null, 'werkplek.kent(req.body.bedrijf) geeft 404 voordat de identiteit aan de beurt is']],
  ['huisPoort', ['objectpoort', null, 'zelfde volgorde via huisDrive(): eerst werkplek.kent(), dan pas magIn()']],

  // ---- geenBewaker: helemaal geen deur ----
  ['mw', ['geenBewaker', null, 'de snelheidsrem (server/rem.js) of de cachelaag (server/lib/cache.js)']],

  // ---- omgeving: de opstelling beslist, niet de bezoeker ----
  ['meetpoort', ['omgeving', null, 'RTG_METRICS_TOKEN en het interne net beslissen; zie scripts/poortwacht.js']]
]);

/* De soort van een enkele bewakersnaam. 'onbekend' is een echt antwoord en geen
   fout: het betekent dat er een deur in het huis staat die niemand heeft
   ingedeeld, en dat hoort te worden gemeld en geteld (LAT.md regel 3). */
function soortVan(naam) {
  const r = KAART.get(String(naam || ''));
  return r ? r[0] : 'onbekend';
}

function rolBij(naam) {
  const r = KAART.get(String(naam || ''));
  return r ? r[1] : null;
}

function waaromBij(naam) {
  const r = KAART.get(String(naam || ''));
  return r ? r[2] : '';
}

/* Alle namen van een soort -- voor de toetsen en voor de rapportage. */
function namenVan(soort) {
  return [...KAART].filter(([, v]) => v[0] === soort).map(([k]) => k).sort();
}

/* ---- HET OORDEEL OVER EEN ROUTE ----

   Geeft `{ rol, reden }`. Een rol betekent: deze route is met de andere twee (of
   drie) tokens te kruisen en het antwoord zegt iets. Geen rol betekent: niet
   kruisen, en de reden zegt waarom -- en die redenen vragen om VIJF verschillende
   reparaties, wat precies de informatie is die "bewaker zonder bekende rol"
   weggooide.

   De volgorde is niet willekeurig. rol gaat voor eigenrol (een route met
   officeAuth EN boardroomAuth is voor het kruisen een kantoorroute plus een
   extra slot -- het kantoortoken is dan de juiste rol en member/supplier zijn
   fout, en dat is de scherpere meting). Verfijners doen nooit mee. */
function beoordeel(route) {
  const r = route || {};
  if (!r.bewakersBekend) return { rol: null, reden: 'de router kon geen bewakers noemen' };

  const namen = Array.isArray(r.bewakers) ? r.bewakers : [];
  if (!namen.length) {
    return { rol: null, reden: 'geen bewakerslaag (bewaking zit in de handler, bijv. een capability-token)' };
  }

  const soorten = namen.map(soortVan);

  const onbekend = namen.filter((n, i) => soorten[i] === 'onbekend');
  if (onbekend.length) {
    return { rol: null, reden: 'bewaker van onbekende soort: ' + onbekend.join('+') +
      ' -- deel hem in in scripts/lib/bewakers.js' };
  }

  // een echte rol wint van alles
  for (let i = 0; i < namen.length; i++) if (soorten[i] === 'rol') return { rol: rolBij(namen[i]), reden: null };
  for (let i = 0; i < namen.length; i++) if (soorten[i] === 'eigenrol') return { rol: rolBij(namen[i]), reden: null };

  /* Geen enkele laag stelt een identiteit vast. Welke reden dat is, hangt af van
     wat er dan WEL staat -- en de zwaarste telt, want die bepaalt de reparatie. */
  const dragend = namen.filter((n, i) => soorten[i] !== 'verfijner');
  if (!dragend.length) {
    return { rol: null, reden: 'alleen verfijners (' + namen.join('+') +
      '), geen laag die een identiteit vaststelt' };
  }
  /* WELKE VAN DE DRAGENDE LAGEN BEPAALT DE REDEN: de MEEST ZEGGENDE, niet de
     eerste. Dit ging hier mis en het is precies de fout die dit bestand moet
     wegnemen. `mw+arrivalPassAuth` kwam eruit als "geenBewaker -- alleen een rem
     of cache", omdat mw vooraan staat. Die route heeft wel degelijk een deur (de
     Arrival Pass in het lichaam); alleen staat er een snelheidsrem voor. De
     zwakste bewering mag de sterkste niet overschrijven, want dan leest een route
     mét een slot als een route zonder. */
  const RANG = { lichaamssleutel: 3, objectpoort: 2, omgeving: 1, geenBewaker: 0 };
  const zwaarste = dragend.slice().sort((a, b) =>
    (RANG[soortVan(b)] || 0) - (RANG[soortVan(a)] || 0))[0];
  const soort = soortVan(zwaarste);
  const uitleg = {
    lichaamssleutel: 'de sleutel staat in het lichaam en niet in de kop, dus rollen kruisen meet niets',
    objectpoort: 'eigenaarschap van een object uit het lichaam; zonder bestaand object van een ander is 404 het enige antwoord',
    geenBewaker: 'geen autorisatielaag -- alleen een rem of cache',
    omgeving: 'de opstelling beslist (configuratie), niet de bezoeker'
  }[soort] || 'niet te kruisen';
  return { rol: null, reden: soort + ': ' + dragend.join('+') + ' -- ' + uitleg };
}

module.exports = { KAART, soortVan, rolBij, waaromBij, namenVan, beoordeel };

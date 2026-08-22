'use strict';
/* DE VERBODEN GRAAF -- wat er NOOIT mag gebeuren.

   Een gewone dependency-analyse zegt wat iets gebruikt. Deze zegt wat iets
   nooit mag bereiken, en dat is een andere soort uitspraak: hij houdt stand ook
   als niemand eraan dacht er een toets voor te schrijven.

   WAAROM DIT ER KOMT. Dit huis beweert zulke dingen al -- de gluurronde (mag A
   bij de spullen van B), de rolronde (welke rol komt waar binnen), en het
   gesloten circuit van RTG Pay (TOKEN.md: WALLET_SALDO) -- maar dynamisch,
   achteraf, en alleen op de paden waar iemand een toets voor maakte. Een
   verboden kant die STATISCH staat, geldt overal en altijd.

   FAIL-CLOSED, EN DAAROM EEN TOESTEMMINGSLIJST. Elke regel hieronder noemt wie
   het WEL mag, met een reden; al het andere is verboden. Andersom -- een lijst
   van wie het niet mag -- vergeet zichzelf zodra er een map bijkomt.

   WAT DIT NIET IS. Geen vervanger van de gluurronde of de rolronde: die meten
   gedrag op een draaiende server en vinden dingen die geen scanner ziet. Dit is
   de laag eronder, die zegt dat bepaalde paden er niet eens mogen ZIJN.

   Zie PROOF-INCREMENTAL.md par. 4.
   ========================================================================== */
const { index, codeRegelsUit } = require('./werkelijkheid');

/* ---------------------------------------------------------------- de regels */

const REGELS = [
  {
    id: 'kluis-echte-naam',
    werkwoord: 'MUST_NOT_READ',
    wat: 'de echte naam van een lid, uit de identiteitskluis',
    /* CLAUDE.md, privacy by design: klantdata draait op codenamen en echte
       namen staan in de gescheiden kluis. Wie realNameOf() aanroept, haalt een
       codenaam terug naar een mens -- en dat mag alleen daar waar een mens met
       een reden kijkt, of waar het lid zichzelf bekendmaakt. */
    zoek: /\baccounts\.realNameOf\s*\(|(?:^|[^.\w$])realNameOf\s*\(/,
    mag: [
      [/^server\/routes\/techniek(?:\/|\.js$)/, 'de technische pagina is eigenaarsgereedschap; die kijkt met naam en toenaam'],
      [/^server\/routes\/office\/verificaties\.js$/, 'een keurder ziet het identiteitsbewijs -- dat IS de handeling'],
      [/^server\/routes\/office\/bewaarverzoek\.js$/, 'een bewaarverzoek gaat over een aanwijsbaar mens'],
      [/^server\/routes\/supplier\/werving\//, 'een lid dat medewerker wordt, komt onder zijn eigen naam op de loonlijst (CONCERN.md)'],
      [/^server\/accounts(?:\/|\.js$)/, 'de kluis zelf'],
      [/^server\/kern\//, 'de kern draagt de inzage-, paspoort- en kantoorlagen die er met een reden bij mogen'],
      [/^server\/opzet\//, 'de opzetlaag geeft de functie door; hij leest hem niet'],
      [/^server\/bedrijf\//, 'een zaak kent de naam van zijn eigen personeel'],
      [/^server\/server\.js$/, 'de bedrading zelf'],
      /* ZELF-INZAGE, EN ALLEEN DAT. Deze route bouwt het publieke mailadres van
         het INGELOGDE lid en zet daar zijn eigen naam bij --
         `realNameOf(req.session.account)`, dus de sessie leest zichzelf.
         CLAUDE.md zegt daarover: het kantoor opent een naam met een reden en een
         regel in het inzagejournaal, zelf-inzage gaat vrij.

         DE GRENS ZIT IN HET ARGUMENT en niet in het bestand: zodra hier een
         ANDER account dan req.session.account wordt opgezocht, is dit geen
         zelf-inzage meer en hoort deze uitzondering te vervallen. Dat is met een
         patroon niet te zien, en daarom staat het hier opgeschreven.

         Toegevoegd op 22 augustus 2026: PR #100 bracht deze aanroep mee, en deze
         regel ving hem. Dat is de eerste keer dat de verboden graaf een NIEUWE
         overtreding vond in plaats van bestaande te bevestigen. */
      [/^server\/routes\/rtmail-lid\.js$/, 'zelf-inzage: het ingelogde lid leest zijn eigen naam bij zijn eigen mailadres'],
      /* DEZELFDE DRIE AANROEPEN, EN EEN BEVINDING DIE GROTER IS DAN DEZE REGEL.

         auth/account.js, auth/inlog.js en rtmail-lid.js doen alle drie hetzelfde:
         `mail-publiek.geefLid({ user, naam: realNameOf(user) })`. Technisch is
         het zelf-inzage -- `user` is telkens het eigen account -- en daarom
         staan ze hier.

         MAAR KIJK WAT ER MET DIE NAAM GEBEURT. `naamLokaal()` in
         kern/mail-publiek.js maakt er het LOKALE DEEL van een publiek mailadres
         van: "Jan Jansen" wordt jan.jansen@<pas>.<groepsdomein>. Elk lid krijgt
         dat adres AUTOMATISCH bij aanmelden en inloggen, zonder het te kiezen.
         Daarmee is de echte naam zichtbaar voor iedereen die post van dat adres
         ontvangt -- terwijl CLAUDE.md zegt dat klantdata op codenamen draait en
         echte namen in de gescheiden kluis blijven, en dat dat ontwerp niet
         omzeild wordt.

         Dat is geen overtreding van DEZE regel maar een productbesluit, en het
         staat hier omdat het anders nergens staat. De nette vorm is dat een lid
         zijn publieke adres KIEST (codenaam of eigen naam), en dat het niet
         vanzelf uit de kluis wordt afgeleid. Gevonden op 22 augustus 2026 door
         keuringsregel 60, bij het samenvoegen van PR #100. */
      [/^server\/routes\/auth\/(?:account|inlog)\.js$/, 'zelf-inzage bij het uitgeven van het eigen publieke mailadres -- zie de bevinding hierboven']
    ],
    nooit: [
      [/^server\/routes\/member\//, 'de ledenkant draait op codenamen; hier hoort geen echte naam te komen'],
      [/^server\/routes\/social\//, 'De Salon en de sociale laag draaien op codenamen'],
      [/^public\//, 'de browser krijgt nooit een echte naam die niet van het lid zelf is']
    ]
  },
  {
    id: 'kluis-binnenwerk',
    werkwoord: 'MUST_NOT_REACH',
    wat: 'het binnenwerk van de identiteitskluis (server/accounts/*), langs de gevel heen',
    /* accounts.js IS de gevel. Wie rechtstreeks kluis.js, tokens.js of users.js
       binnenloopt, omzeilt wat die gevel afdwingt -- en dan is de scheiding
       tussen codenaam en echte naam een afspraak in plaats van een muur. */
    zoek: /require\(\s*['"][^'"]*\/accounts\/[a-z-]+['"]\s*\)/,
    mag: [
      [/^server\/accounts(?:\/|\.js$)/, 'binnen de kluis mogen de delen elkaar kennen'],
      [/^test\//, 'een toets mag het binnenwerk beproeven; dat is zijn werk'],
      [/^server\/opzet\//, 'de opzetlaag hangt de kluis op; hij geeft hem door en leest hem niet'],
      /* SSO EN SCIM: NAGETELD, EN SMAL. Beide halen uit accounts/state.js
         uitsluitend `S.db` -- de gedeelde databasehandle -- en raken de
         sleutels niet aan. Eenentwintig aanroepen, allemaal S.db.

         MAAR DAT IS GELUK EN GEEN GRENS, en dat hoort hier te staan. state.js
         draagt de handle EN de twee sleutels in hetzelfde object ("laadt de
         twee sleutels en zet ze hier neer"), dus wie de handle nodig heeft,
         heeft de sleutels binnen handbereik. De nette vorm is een aparte
         handle-uitgifte, zodat deze twee uitzonderingen kunnen vervallen; tot
         die er is, staan ze hier met naam en met deze reden. */
      [/^server\/sso\//, 'leest alleen S.db, de gedeelde databasehandle -- nageteld, 21 aanroepen'],
      [/^server\/scim\//, 'leest alleen S.db, de gedeelde databasehandle -- nageteld']
    ],
    nooit: [
      [/^server\/routes\//, 'elke route gaat via de gevel accounts.js'],
      [/^server\/kern\//, 'ook de kern gaat via de gevel'],
      [/^public\//, 'de browser komt hier sowieso niet']
    ]
  }
];

/* ------------------------------------------------------------ de uitvoering */

/* COMMENTAAR TELT NIET MEE, en die les is duur betaald: bij het bouwen van de
   bedradingsanalyser meldde de eerste versie twee koppen als bevinding, en de
   tweede versie at met een te grove stripper een echte regel op. Het antwoord op
   die vraag staat nu op EEN plek -- codeRegelsUit() in lib/werkelijkheid.js --
   en niet meer in drie scanners met elk hun eigen versie ervan. Dat verschil was
   zelf de bron van drie meetfouten. */

function past(patronen, rel) {
  for (const [p, reden] of patronen) if (p.test(rel)) return reden;
  return null;
}

/* De meting. Per regel: welke bestanden RAKEN wat er verboden is, en mag dat
   daar? Een overtreding draagt de regel, het bestand, het regelnummer en de
   reden waarom het daar niet hoort -- want een melding zonder reden wordt
   weggeklikt. */
function meet(mappen, klaarIndex) {
  const waar = mappen || ['server', 'public'];
  const ix = klaarIndex || index(waar);
  const binnen = (rel) => waar.some((m) => rel === m || rel.startsWith(m + '/'));

  const overtredingen = [];
  const gedekt = {};
  for (const regel of REGELS) gedekt[regel.id] = { mag: 0, geraakt: 0 };
  let gekeken = 0;

  for (const b of ix.bestanden.values()) {
    if (!binnen(b.pad)) continue;
    gekeken++;

    for (const regel of REGELS) {
      if (!regel.zoek.test(b.bron)) continue;                 // raakt dit niet: klaar
      const treffers = b.code.filter(([, r]) => regel.zoek.test(r));
      if (!treffers.length) continue;                          // stond alleen in commentaar
      gedekt[regel.id].geraakt++;

      const toegestaan = past(regel.mag, b.pad);
      if (toegestaan) { gedekt[regel.id].mag++; continue; }

      const verboden = past(regel.nooit, b.pad) ||
        'staat niet op de toestemmingslijst van deze regel';
      overtredingen.push({
        regel: regel.id, werkwoord: regel.werkwoord, wat: regel.wat,
        bestand: b.pad, lijn: treffers[0][0], code: treffers[0][1].trim().slice(0, 90),
        reden: verboden
      });
    }
  }

  return { gekeken, regels: REGELS.length, gedekt, overtredingen };
}

module.exports = { meet, REGELS, codeRegels: codeRegelsUit };

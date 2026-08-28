/* RTG LINK -- de adres- en capabilitylaag. Zie LINK.md.

   EEN CODE ZEGT WIE OF WAT, NOOIT WAT ER MAG. Dit bestand is de weg van LINK.md
   par. 2, in stukken die elk hun eigen bestand hebben:

     SCAN -> ./register.js   welk TYPE ding is dit?
          -> ./rem.js        mag deze deur nu uberhaupt open?
          -> oplossen        wie of wat is het? (bij de bestaande deuren gehaald)
          -> ./intenties.js  wat mag DEZE scanner hier vragen?
          -> mens bevestigt  (in het scherm, niet hier)
          -> uitvoeren       (bij de bestaande routes, nog niet op deze laag)
          -> ./bonnen.js     wat is er gebeurd?

   TWEE DEUREN, EEN WAARHEID. De contactpin heeft zijn eigen loketten
   (/api/member/pin/*) en die blijven bestaan; deze laag is de tweede deur naar
   dezelfde mensen. Dat mag, zolang er van elke STAP maar een uitvoering is:
   de rem staat in ./rem.js (en niet meer in pin-deur.js), pin->handle staat in
   sociaal/pin.js, en wat je van een gevonden mens te zien krijgt staat in
   pin-deur.js (pinKijk). Deze laag SCHIKT die stappen, hij herbouwt ze niet --
   LAT.md regel 4. test/link.test.js legt de twee deuren naast elkaar en zakt
   zodra ze uit elkaar lopen.

   WAT HIER NIET GEBEURT: uitvoeren. `los` kijkt en zegt wat er kan; de handeling
   loopt langs de weg die de intentie noemt, en daar drukt een MENS op (LIFE.md:
   samenstellen en klaarzetten, bevestigen doet de mens). Een resolver die zelf
   iets in gang zet, is een gescande QR die iets deed wat niemand bewust vroeg. */
'use strict';

const rem = require('./rem');
const intenties = require('./intenties');

module.exports = (opties) => {
const { db, save, crypto, dyncodeGeef, pinNormaliseer, pinZoek, liveKijk,
        rate, codenaamVan, bandStand, zaakVan, nu } = opties;
const { duidt, TYPES } = require('./register')({ dyncodeGeef });
const { bonSchrijf, bonnenVan, BON_MAX } = require('./bonnen')({ db, save, nu });
/* De capabilitylaag: codes die een HANDELING dragen in plaats van een ding aan
   te wijzen. Het register van handelingen is leeg tot een domein er een aanmeldt
   (kern/pay/vraagcode.js is de eerste) -- deze laag kent er zelf geen. */
const handelingen = require('./handelingen')();
const cap = require('./cap')({ crypto, dyncodeGeef, codenaamVan, bonSchrijf, handelingen, rate, nu });

/* "Mijn koppelingen": wat er van mij openstaat, wat er gebeurd is, en wat ik er
   nog aan kan doen. Hij leunt op de drie lagen hierboven en beslist zelf niets
   over codes -- alleen over wat een mens er nog mee kan (./koppelingen.js). */
const naamVan = (id) => {
  const s = String(id || '');
  if (s.startsWith('supplier:')) {
    const z = typeof zaakVan === 'function' ? zaakVan(s.slice(9)) : null;
    return (z && (z.name || z.naam)) || s.slice(9);
  }
  return typeof codenaamVan === 'function' ? codenaamVan(s) : s;
};
const { koppelingen } = require('./koppelingen')({
  bonnenVan, capOpenVan: cap.capOpenVan, bandStand, naamVan });

/* Wie mag er een MENS oplossen: alleen een sessie die zelf een mens is. Een zaak
   of een medewerker scant tafels, entrees en betaalcodes; een pin van een lid
   wijst een persoon aan, en daar hoort de vraag "wat is jouw band met hem" bij.
   Zonder zo'n band is er ook geen pinKijk mogelijk -- die rekent met blokkades
   en verbindingen tussen twee MENSEN. */
const isMens = s => s === 'lid' || s === 'gezin';

/* De takken per type, elk met de deur die er al is (zie ./oplossen.js). */
const { onderwerpVan } = require('./oplossen')({ pinZoek, liveKijk, zaakVan, cap, isMens });

async function los(scanner, tekst) {
  const wie = scanner && scanner.soort ? String(scanner.soort) : null;
  const mij = scanner && scanner.key ? scanner.key : null;
  if (!wie) return { status: 401, error: 'Niet ingelogd.' };

  const g = duidt(tekst);
  if (!g.type) {
    if (g.reden === 'nog-geen-laag')
      return { status: 422, error: 'Dit is een RTG-code, maar deze laag doet er nog niets mee.', soort: g.soort };
    if (g.reden === 'verlopen')
      return { status: 410, error: 'Deze code is verlopen. Laat een verse code tonen.' };
    if (g.reden === 'geen-codelaag')
      return { status: 503, error: 'De codelaag draait hier niet.' };
    if (g.mis) rem.misserGeteld();
    return { status: 422, error: 'Dit is geen RTG-code.' };
  }
  /* DE PIN ZOALS EEN MENS HEM DOORGEEFT. Het scherm toont 7K2M-9XPQ, en dat is
     ook wat iemand plakt of voorleest; de QR draagt hem zonder streepje. Dezelfde
     normalisatie als bij de pindeur, uit dezelfde functie (kern/sociaal/pin.js) --
     een tweede lezing hier zou de Crockford-omzetting (O->0, I/L->1, U->V) op
     twee plekken zetten.

     Deze stap stond er eerst NIET, en de linkdeur gaf daardoor "kennen we niet"
     op de vorm die op het scherm staat. Gevonden doordat een mutatie niet beet
     (LAT.md regel 2): de toets keek niet na of het scannen zelf was gelukt, dus
     zag hij het verschil tussen "geen bon" en "niets gevonden" niet. */
  if (g.type === 'persoon' && g.vorm === 'vast') {
    const pin = typeof pinNormaliseer === 'function' ? pinNormaliseer(g.sleutel) : g.sleutel;
    if (!pin) return { status: 400, error: 'Een pin bestaat uit acht tekens, bijvoorbeeld 7K2M-9XPQ.' };
    g.sleutel = pin;
  }
  /* DE EIGEN REM EERST, EN DAT IS EEN GAT DAT DEZE DEUR BIJNA HAD. De contactpin
     telt dertig pogingen per uur per lid (kern/sociaal/pin-deur.js). Een tweede
     deur naar dezelfde pins zonder diezelfde teller is geen tweede deur maar een
     omweg om de eerste heen. Hij hangt daarom aan DEZELFDE teller (dezelfde
     sleutel, hetzelfde lid), zodat dertig pogingen dertig pogingen blijven, hoe
     je ze ook verdeelt over de twee loketten.

     Alleen bij de vaste pin: de levende code brengt zijn eigen rem mee
     (pin-live.js), en een tafel of een entree is geen mens om naar te vissen --
     daar staat alleen de huisrem hieronder omheen. */
  /* De pindeur past voor een vaste persoon zelf de persoons- en bronrem toe;
     alle andere codes komen rechtstreeks langs het huisbudget. */
  if (rem.deurDicht())
    return { status: 429, error: 'Het oplossen van codes ligt even stil. Probeer het zo opnieuw.' };

  const uit = await onderwerpVan(g, wie, mij, scanner && scanner.code);
  if (uit.error) return uit;
  return { status: 200, type: g.type, wat: (TYPES[g.type] || {}).wat, vorm: g.vorm,
    onderwerp: uit.onderwerp,
    bevestiging: uit.bevestiging, bevestigingVervalt: uit.bevestigingVervalt,
    intenties: intenties.voor({ type: g.type, scanner: wie, vorm: g.vorm, band: uit.band, mag: uit.mag }) };
}

return { linkLos: los, linkBon: bonSchrijf, linkBonnen: bonnenVan,
  linkTypes: TYPES, linkIntenties: intenties.CATALOGUS,
  /* Aanmelden doet het domein zelf, bij het opstarten (opzet/aanbouw2.js). */
  linkHandeling: handelingen.registreer, linkHandelingen: handelingen.alle,
  linkCapMaak: cap.capMaak, linkCapKijk: cap.capKijk,
  linkCapAanvaard: cap.capAanvaard, linkCapTrek: cap.capTrek, linkCapOpen: cap.capOpen,
  linkKoppelingen: koppelingen, linkWieId: cap.idVan,
  linkRemReset: rem.remReset, LINK_MIS_PER_MINUUT: rem.MIS_PER_MINUUT, LINK_BON_MAX: BON_MAX };
};

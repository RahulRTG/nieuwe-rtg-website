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
const { db, save, dyncodeGeef, handleVanPin, pinNormaliseer, pinKijk, liveKijk,
        persoonRate, zaakVan, nu } = opties;
const { duidt, TYPES } = require('./register')({ dyncodeGeef });
const { bonSchrijf, bonnenVan, BON_MAX } = require('./bonnen')({ db, save, nu });

/* Het ene antwoord voor alles wat niets oplevert. Vier redenen die met opzet
   niet uit elkaar te houden zijn (LINK.md par. 3.1, en kern/sociaal/pin-deur.js
   op zijn eigen schaal): de code hoort bij niemand, bij een beschermd profiel,
   bij iemand die jou blokkeerde, of bij iemand die zijn pin uit heeft staan.
   Wie hier ooit een preciezere tekst per geval neerzet, bouwt de zoekmachine
   waarmee je kunt vaststellen dat een kind bestaat. */
const NIETS = { status: 404, error: 'Deze code kennen we niet (meer).' };
const niets = () => { rem.misserGeteld(); return { ...NIETS }; };

/* Wie mag er een MENS oplossen: alleen een sessie die zelf een mens is. Een zaak
   of een medewerker scant tafels, entrees en betaalcodes; een pin van een lid
   wijst een persoon aan, en daar hoort de vraag "wat is jouw band met hem" bij.
   Zonder zo'n band is er ook geen pinKijk mogelijk -- die rekent met blokkades
   en verbindingen tussen twee MENSEN. */
const isMens = s => s === 'lid' || s === 'gezin';

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
  const eigen = eigenRem(g, wie, mij);
  if (eigen) return eigen;
  /* En dan pas de huisrem: wie zelf al te snel ging hoort dat te horen, en het
     budget van het huis mag niet opgaan aan een vraag die toch al geweigerd was.
     Dezelfde volgorde als bij de contactpin, en om dezelfde reden. */
  if (rem.deurDicht())
    return { status: 429, error: 'Het oplossen van codes ligt even stil. Probeer het zo opnieuw.' };

  const uit = await onderwerpVan(g, wie, mij);
  if (uit.error) return uit;
  return { status: 200, type: g.type, wat: (TYPES[g.type] || {}).wat, vorm: g.vorm,
    onderwerp: uit.onderwerp,
    intenties: intenties.voor({ type: g.type, scanner: wie, vorm: g.vorm, band: uit.band }) };
}

/* De rem die aan de VRAGER hangt, voor het ene geval waar er een is. Geeft een
   antwoord terug als hij bijt, en anders niets. */
function eigenRem(g, wie, mij) {
  if (!(g.type === 'persoon' && g.vorm === 'vast' && isMens(wie))) return null;
  /* Een sessie zonder sleutel is een demo-pas: die heeft geen handle, en zonder
     handle is er geen band met de ander en dus niets te tonen. Dat is geen
     "niet ingelogd" -- hij is dat wel -- dus zegt het antwoord wat er echt aan
     ontbreekt. */
  if (!mij) return { status: 403, error: 'Hier heb je een eigen ledenaccount voor nodig.' };
  if (typeof persoonRate === 'function' && !persoonRate(mij))
    return { status: 429, error: 'Te veel pins geprobeerd. Probeer het over een uur opnieuw.' };
  return null;
}

/* Het oplossen zelf, per type -- en elke tak leent de bestaande deur in plaats van
   er een te bouwen. */
async function onderwerpVan(g, wie, mij) {
  if (g.type === 'persoon') {
    if (!isMens(wie)) return { status: 403, error: 'Deze code hoort bij een mens; alleen een lid kan daar iets mee.' };
    // zelfde geval en zelfde antwoord als in eigenRem hierboven: een demo-pas
    // heeft geen handle, en zonder handle is er geen band om te tonen
    if (!mij) return { status: 403, error: 'Hier heb je een eigen ledenaccount voor nodig.' };
    if (g.vorm === 'levend') {
      /* De levende code draagt zijn eigen bewijs, dus geeft pin-live met opzet
         GEEN sleutel terug: het scherm hoeft niet te weten hoe iemand in de
         database heet. Zijn eigen rem per lid staat daar al omheen. */
      const r = liveKijk(mij, g.sleutel);
      if (r.error) return { status: r.status, error: r.error };
      return { onderwerp: { codename: r.codename, tier: r.tier, status: r.st }, band: r.st };
    }
    const kaart = pinKijk(mij, handleVanPin(g.sleutel));
    if (!kaart) return niets();
    return { onderwerp: { key: kaart.key, codename: kaart.codename, tier: kaart.tier, status: kaart.st },
      band: kaart.st };
  }
  if (g.type === 'plaats' || g.type === 'zaak') {
    const z = typeof zaakVan === 'function' ? zaakVan(g.sleutel) : null;
    if (!z) return niets();
    /* De naam komt uit ONS register en niet uit de code (LINK.md par. 3.3): wie
       een sticker overplakt met een eigen QR, ziet hier niet zijn eigen naam
       verschijnen maar die van de zaak waar de code echt bij hoort. */
    const onderwerp = { code: z.code || g.sleutel, naam: z.name || z.naam || null };
    if (g.type === 'plaats') onderwerp.plek = g.tafel || '';
    return { onderwerp, band: null };
  }
  if (g.type === 'betaalcode') {
    /* Niet opzoeken, met opzet. Of deze code geldig is en van wie hij is, weet de
       kassadeur (/api/supplier/pay/in) -- die int hem ook. Een tweede plek die
       hetzelfde nakijkt, is een orakel waarmee je codes kunt aftasten zonder ooit
       te innen. */
    return { onderwerp: { code: g.sleutel }, band: null };
  }
  return niets();
}

return { linkLos: los, linkBon: bonSchrijf, linkBonnen: bonnenVan,
  linkTypes: TYPES, linkIntenties: intenties.CATALOGUS,
  linkRemReset: rem.remReset, LINK_MIS_PER_MINUUT: rem.MIS_PER_MINUUT, LINK_BON_MAX: BON_MAX };
};

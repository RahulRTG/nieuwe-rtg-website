/* EEN BEVOEGDHEID DIE JE KUNT MEEDRAGEN -- proof-carrying authorization.

   WAT HET OPLOST. kern/commercie/besluit.js beantwoordt "mag dit" door de
   bevoegdheid op te zoeken en te wegen. Dat is goed en het is duur: elke stap in
   een keten stelt dezelfde vraag opnieuw, en elke stap moet daarvoor bij de
   rechtenbron kunnen. Een agent die vijf leveranciers afgaat, doet vijf keer
   hetzelfde opzoekwerk voor een besluit dat een seconde eerder al genomen was.

   EN ER IS EEN TWEEDE, ZWAARDERE REDEN. Een sessie is vandaag een sleutel tot
   ALLES wat de houder mag. Wie hem steelt, krijgt de hele bevoegdheid mee. Een
   bewijstoken is het omgekeerde: hij draagt precies EEN handeling, op EEN doel,
   tot EEN bedrag, voor EEN paar minuten. Gestolen is dan niet gelijk aan
   onbeperkt.

   WAT ERIN ZIT, EN WAAROM ELK VELD:

     actor        wie mag dit                    zonder: een token voor iedereen
     capability   welke handeling                zonder: een token voor alles
     scope        waarop                         zonder: bij elke zaak bruikbaar
     grenzen      tot hoever                     zonder: een blanco cheque
     vervalt      wanneer het ophoudt            zonder: een permanent recht
     beleid       onder welke regels besloten    zonder: onnavolgbaar achteraf
     nonce        eenmalig                       zonder: herbruikbaar bij afluisteren
     handtekening dat niemand eraan zat          zonder: zelf te schrijven

   DRIE DINGEN DIE HARD ZIJN, EN WAAROM:

   1. EEN TOKEN KAN NOOIT VERRUIMEN. Hij wordt GEMUNT uit een bevoegdheid en
      erft daarvan de grenzen; extra grenzen versmallen alleen (`versmal` uit
      ./bevoegdheid.js doet dat werk, dus er is maar EEN plek waar
      versmallingsregels wonen). Wie een token maakt dat meer mag dan de
      bevoegdheid waaruit hij komt, maakt geen token maar een achterdeur.
   2. EEN TOKEN VERVALT, ALTIJD, EN SNEL. Er is geen "geen vervaltijd" en de
      bovengrens is vijftien minuten. Dit is de prijs van niet-opzoeken: tussen
      munten en gebruiken kan een bevoegdheid worden ingetrokken, en die
      intrekking bereikt een token pas als hij verloopt. Kort is dus geen
      voorzichtigheid maar de hele constructie. Een verzoek om langer wordt
      GEWEIGERD en niet stilzwijgend afgekapt -- wie denkt een uur te hebben en
      er vijftien minuten krijgt, bouwt iets dat op het verkeerde moment stopt.
   3. EEN TOKEN IS EENMALIG BIJ WAARDE. Anders is afluisteren genoeg om dezelfde
      betaling twee keer te doen. `verbruik()` weigert een tweede keer; de
      opslag komt van de aanroeper, want deze laag hoort geen database te kennen.

   DE SLEUTEL IS NIET DE SESSIESLEUTEL. Hij wordt eruit AFGELEID met HKDF onder
   een eigen label. Zo kan iemand die op de een of andere manier een
   handtekening onder een bewijstoken kan krijgen, daarmee geen sessietoken
   maken -- en andersom. Domeinscheiding kost hier een regel en is later niet
   meer in te bouwen.

   WAT DIT NIET IS: een vervanging van het besluit. Een token draagt een besluit
   dat AL genomen is; hij neemt er geen. Zou hij dat wel doen, dan is er een
   tweede plek waar rechten ontstaan, en dat is precies wat ./besluit.js opheft. */
'use strict';

const crypto = require('crypto');
const klok = require('../../lib/klok');
const bev = require('./bevoegdheid');
/* Het ondertekenen zelf staat apart: die laag weet niet wat een claim betekent,
   en een fout in de envelop is een fout in ALLE tokens. Zie
   ./bewijstoken/zegel.js. */
const { maakZegel, afgeleideSleutel, LABEL } = require('./bewijstoken/zegel');

/* Vijftien minuten. Zie punt 2 hierboven: dit is geen ronde-getallen-keuze maar
   het venster waarin een ingetrokken bevoegdheid nog geldig lijkt. */
const MAX_GELDIG_SECONDEN = 900;
const STANDAARD_GELDIG_SECONDEN = 120;

function maakBewijstoken({ sleutel, nu, gezien }) {
  const tijd = nu || klok.nu;
  const zegel = maakZegel(sleutel);

  /* MUNTEN. Alleen uit een bevoegdheid, en het resultaat is nooit ruimer dan
     die bevoegdheid. */
  function munt(bevoegdheid, opties) {
    const o = opties || {};
    if (!zegel.heeftSleutel) return { error: 'Er is geen ondertekensleutel; zonder handtekening is een token een briefje.' };
    if (!bevoegdheid || !bevoegdheid.capability)
      return { error: 'Een bewijstoken komt uit een bevoegdheid; er is er geen meegegeven.' };

    const seconden = Number.isFinite(o.geldigSeconden) ? Math.round(o.geldigSeconden) : STANDAARD_GELDIG_SECONDEN;
    if (seconden <= 0) return { error: 'Een bewijstoken zonder geldigheidsduur bestaat niet.' };
    if (seconden > MAX_GELDIG_SECONDEN)
      return { error: 'Een bewijstoken geldt hoogstens ' + MAX_GELDIG_SECONDEN + ' seconden; gevraagd is ' + seconden +
        '. Vraag er een nieuwe in plaats van een langere.' };

    /* De scope kan alleen SMALLER, net als bij delegatie -- en de controle
       gebeurt met dezelfde functie, zodat er geen tweede lezing van "smaller"
       ontstaat. */
    let scope = bevoegdheid.scope;
    if (o.doel != null && String(o.doel) !== bevoegdheid.scope) {
      if (bevoegdheid.scope !== '*')
        return { error: 'De bevoegdheid geldt voor ' + bevoegdheid.scope + '; ' + o.doel + ' valt daarbuiten.' };
      scope = String(o.doel);
    }

    const claim = {
      v: 1,
      actor: String(o.actor || bevoegdheid.door || ''),
      capability: bevoegdheid.capability,
      scope,
      grenzen: bev.versmal(bevoegdheid.grenzen, o.grenzen),
      waardeCenten: Number.isFinite(o.waardeCenten) ? Math.round(o.waardeCenten) : null,
      vervalt: tijd() + seconden * 1000,
      beleid: String(o.beleid || ''),
      nonce: crypto.randomBytes(12).toString('base64url'),
      eenmalig: o.eenmalig !== false            // bij waarde: altijd; standaard aan
    };
    const gesloten = zegel.sluit(claim);
    return gesloten.ok ? { ok: true, token: gesloten.token, claim } : gesloten;
  }

  /* LEZEN. Geeft de claim terug, of de reden waarom niet. Elke afwijzing zegt
     WAT er mis is: een token dat "ongeldig" heet zonder reden kost een uur
     zoeken bij de eerste storing. */
  function lees(token, opties) {
    const o = opties || {};
    const geopend = zegel.open(token);
    if (!geopend.ok) return geopend;
    const claim = geopend.claim;

    if (claim.vervalt <= tijd())
      return { error: 'Dit bewijstoken is verlopen; vraag een nieuw.', verlopen: true, claim };

    /* DE BELEIDSVERSIE. Een token dat onder v1 is gemunt en onder v2 wordt
       ingeleverd, is niet "bijna goed": de regels waaronder het besluit viel
       bestaan niet meer. Bij vijftien minuten geldigheid is dit zeldzaam, en
       juist daarom hoort het te weigeren in plaats van door te glippen. */
    if (o.beleid && claim.beleid && claim.beleid !== o.beleid)
      return { error: 'Dit token is gemunt onder beleid ' + claim.beleid + ' en het huidige beleid is ' +
        o.beleid + '; vraag een nieuw.', beleidVerouderd: true, claim };

    return { ok: true, claim };
  }

  /* GEBRUIKEN. Leest, kijkt of de gevraagde handeling erin past, en verbruikt
     de nonce als het token eenmalig is. Dit is de enige functie die een
     aanroeper nodig heeft; `lees` staat los omdat een scherm een token wel wil
     TONEN zonder hem op te maken. */
  function verbruik(token, gevraagd, opties) {
    const g = gevraagd || {};
    const r = lees(token, opties);
    if (!r.ok) return r;
    const c = r.claim;

    if (g.capability && g.capability !== c.capability)
      return { error: 'Dit token is voor ' + c.capability + ' en niet voor ' + g.capability + '.' };

    /* De grenzen worden met DEZELFDE functie getoetst als een gewone
       bevoegdheid. Zou hier een eigen lezing staan, dan bestaan er twee
       antwoorden op "past dit erbinnen" en lopen ze een keer uiteen -- precies
       hoe kern/thuis/zakelijk.js aan een eigen commissie van 10 procent kwam. */
    const bezwaar = bev.past({ scope: c.scope, grenzen: c.grenzen },
      { scope: g.doel, waardeCenten: g.waardeCenten, context: g.context });
    if (bezwaar) return { error: bezwaar, claim: c };

    /* De waarde waarvoor het token is gemunt, is een BOVENGRENS en geen
       richtbedrag. Anders muntte je een token voor een euro en betaalde je er
       duizend mee. */
    if (Number.isFinite(c.waardeCenten) && Math.round(Number(g.waardeCenten) || 0) > c.waardeCenten)
      return { error: 'Dit token is gemunt voor ' + bev.euro(c.waardeCenten) + ' en er wordt ' +
        bev.euro(Math.round(Number(g.waardeCenten) || 0)) + ' mee gevraagd.', claim: c };

    if (c.eenmalig) {
      if (!gezien) return { error: 'Een eenmalig token vraagt een plek om gebruikte tokens te onthouden.' };
      if (gezien.zag(c.nonce)) return { error: 'Dit bewijstoken is al gebruikt.', herhaling: true, claim: c };
      gezien.onthoud(c.nonce, c.vervalt);
    }
    return { ok: true, claim: c };
  }

  return { munt, lees, verbruik, MAX_GELDIG_SECONDEN };
}

/* Een eenvoudige nonce-opslag in het geheugen, met opruiming op de vervaltijd.
   Voor een installatie met meerdere instances hoort hier een gedeelde plek te
   staan -- daarom komt hij van de aanroeper en niet uit deze module. */
function geheugenGezien(nu) {
  const tijd = nu || klok.nu;
  const kaart = new Map();
  return {
    zag(nonce) {
      const t = kaart.get(nonce);
      if (t == null) return false;
      if (t <= tijd()) { kaart.delete(nonce); return false; }
      return true;
    },
    onthoud(nonce, vervalt) {
      kaart.set(nonce, vervalt);
      /* Opruimen bij het schrijven en niet met een timer: een Map die alleen
         groeit is een lek, en een timer in een kernmodule is een tweede
         levenscyclus die niemand aanzet of uitzet. */
      if (kaart.size > 5000) for (const [n, t] of kaart) if (t <= tijd()) kaart.delete(n);
    },
    aantal: () => kaart.size
  };
}

module.exports = { maakBewijstoken, geheugenGezien, afgeleideSleutel,
  MAX_GELDIG_SECONDEN, STANDAARD_GELDIG_SECONDEN, LABEL };

/* DE BEVEILIGINGS-AS IN DE HTTP-KETEN -- het huis, en de drager eronder.

   HET GAT DAT HIJ VULT. De isolatiestand per drager werd nergens in de
   verzoekketen afgedwongen: ./functieschakelaars.js leest alleen het HUIS-veld
   (`ic.modus === 'beschermd'`), en `isolatie.besluit()` werd alleen aangeroepen
   door het AI-filter, een proefroute en een meter. Een lid dat zichzelf op
   `isolatie` zette, versmalde dus alleen de lijst waaruit het model kiest -- zijn
   gewone HTTP-paden bleven open, terwijl het scherm zei dat het meteen werkte.

   HIJ BIJT NIET, EN DAT IS EEN BESLUIT MET EEN GETAL ERONDER. CONTROLPLANE.md:
   een nieuwe handhavingsregel loopt eerst mee zonder te blokkeren -- je kunt niet
   afdwingen wat nooit in de schaduw heeft gelopen. Twee dingen maken dat hier
   meer dan een formaliteit:

   1. `besluit()` is op 255 paden LOSSER dan de huidige beschermstand (1148 -> 893
      onder `beschermd`, uitsluitend dicht -> open). Dat is de leesset-redding, en
      inhoudelijk waarschijnlijk gewenst -- maar hem meenemen bij het aanzetten
      zou bestaande handhaving VERZWAKKEN. Vandaar dat het huis-been onaangeroerd
      blijft en alleen het drager-been erbij komt: `dicht = huis || drager`, nooit
      `drager` in plaats van `huis`.
   2. De schaduwnoemer is "verzoeken van accounts die een stand dragen", en dat
      zijn er vandaag nul: deze regel rijpt NIET vanzelf uit productieverkeer.
      stand() in ./isolatiepoort-stand.js zegt dat zelf, en daar staat waarom.

   DE VOLGORDE IS HUIS, DAN UITGANG, DAN DRAGER -- en die middelste plek is een
   correctie op de eerste versie, die de uitgangen VOOR beide benen zette.
   SEC-LOCK-003: een lagere drager neutraliseert een hogere niet, en een
   vrijstellingslijst uit de ledenlaag die het huis-oordeel overrulet is precies
   dat. Zie de uitleg bij stap 3 in weeg().

   TWEE HOOGTES OP EEN AS, EN DAAROM STAAN ZE HIER SAMEN. Het HUIS-been (de
   noodstand uit kern/beschermstand.js) stond in ./functieschakelaars.js en is
   meeverhuisd: dat bestand schuift als iemand in de boardroom een knop omzet,
   deze as als er een incident is. Twee onderwerpen. De PLEK in de keten is
   onveranderd -- boven de snelle uitgang van de schakelkast, want juist op een
   verse installatie hoort een noodstand te werken.

   DIE PLEK IS HET ANTWOORD OP "WIE ZIET ELK VERZOEK": de enige plek die (i) elk
   /api/-verzoek ziet, (ii) vóór ELKE router staat, (iii) de bearer-kop al
   ontleedt en (iv) de 503 van deze as al bezit. `auth` heeft de sessie wél maar
   dekt alleen ledenroutes; leverancier, kantoor en techniek hebben eigen deuren.

   DE VOORPOORT MAG NOOIT VRAGEN "STAAT ER ERGENS EEN STAND". Er is geen goedkope
   leegtetest: bij 50.000 dichtgezette leden kost `Object.keys(kaart).length === 0`
   milliseconden per verzoek, en `for (const k in kaart) return false;` -- de voor
   de hand liggende slimme uitweg -- is even duur, want V8 materialiseert de
   sleutels van een dictionary-object voordat de lus begint. Die tweede staat er
   met naam bij omdat hij eruitziet als de oplossing en het niet is.

   Daarom vraagt deze poort "staat er een stand voor DIT verzoek": een gewone
   opzoeking, en daarmee is weeg() VLAK. Toets 7 in test/isolatiepoort.test.js
   houdt die vlakheid vast, zodat een latere wijziging die er O(n) van maakt de
   bouw laat zakken in plaats van stil traag te worden.

   De vlakke prijs geldt voor elk schrijvend verzoek. Een globale teller
   "hoeveel standen zijn er" lijkt goedkoper maar kan door een vergeten
   schrijfweg op nul blijven staan; die optimalisatie faalt open. */

'use strict';

/* De montage en de schaduwtelling staan ernaast, in ./isolatiepoort-stand.js --
   zie de kop daar voor de naad. `laag` en `bijt` worden dus OPGEVRAAGD en niet
   hier bewaard: twee plekken die weten of de laag er is, is er een te veel. */
const poortstand = require('./isolatiepoort-stand');
const dragerpoort = require('./isolatiepoort-drager');

/* HET OORDEEL. Geeft `null` als er niets aan de hand is, en anders het besluit
   met zijn reden. Hij BLOKKEERT niet: dat doet de aanroeper, en alleen als de
   vlag om is. */
function weeg(req, ctx) {
  const pad = req.path;
  const db = ctx && ctx.db;
  const beschermstand = ctx && ctx.beschermstand;

  /* 1. LEZEN GAAT ALTIJD DOOR. Geen aanname maar de beslissing zelf, herhaald:
        `besluit()` blokkeert onder isolatie nul GET-paden, en beschermstand.js
        geeft per constructie null op een GET. Deze regel scheelt de hele
        opzoeking hieronder op elk leesverzoek. */
  if (/^(GET|HEAD|OPTIONS)$/i.test(String(req.method || ''))) return null;

  /* 2. HET HUIS. Ongewijzigd overgenomen uit ./functieschakelaars.js, inclusief
        de reden: deze stand zet met opzet geen enkele functie om, zodat opheffen
        geen herstelactie is maar het wegnemen van een vlag
        (kern/incidentcontrole-bescherm.js). Hij staat VOOR het drager-been,
        want `dicht = huis || drager` -- het drager-oordeel is op 255 paden
        LOSSER dan dit, en het mag dit dus nooit vervangen. */
  const ic = db && db.data && db.data.techniek && db.data.techniek.incidentcontrole;
  if (!(ctx && ctx.slaHuisOver) && beschermstand && ic && ic.modus === 'beschermd') {
    const houd = beschermstand.houdtTegen(pad, req.method);
    if (houd) {
      return { been: 'huis', antwoord: { error: HUISZIN, functie: houd.functie, naam: houd.naam,
        reden: 'bescherming', categorie: houd.categorie, waarom: houd.waarom } };
    }
  }

  /* 3. Uitgangen, dragers, opslagzekerheid en schaduwtelling vormen samen het
        persoonlijke been in isolatiepoort-drager.js. */
  return dragerpoort.weeg(req);
}

/* WAT DE AANROEPER ERMEE DOET. In de schaduw: niets, behalve tellen. Met de vlag
   om: een 503 met `as: 'isolatie'` erin, zodat een scherm weet dat deze weigering
   bij dezelfde as hoort als de stand die het lid zelf zette. 503 en geen 423,
   want functies/wachter.js slaat 503 met opzet over ("bewust dicht, geen
   storing") -- een 423 zou de storingsautomaat verdunnen.

   De zin van het HUIS-been wordt OPGEHAALD uit ./schakelaar-antwoord.js en niet
   overgetypt: twee teksten voor dezelfde stand vertellen een mens twee
   verschillende dingen over wat er aan de hand is. */
const HUISZIN = require('./schakelaar-antwoord').ZIN.bescherming;

module.exports = { zetLaag: poortstand.zetLaag, stand: poortstand.stand,
  weeg, antwoordVoor: dragerpoort.antwoordVoor, _wisTelling: poortstand._wisTelling };

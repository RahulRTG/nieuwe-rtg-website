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

   DE METINGEN ZELF STAAN IN ISOLATIE.md PAR. 10 EN NIET HIER, en dat is geen
   verwijzing uit gemak: ze stonden op allebei de plekken, en toen de meting werd
   overgedaan liep deze kop achter met een getal dat er twee keer zo hoog naast
   zat. Een getal met een methode hoort op een plek te wonen. Wat hier blijft is
   de REGEL, want die stuurt de code hieronder.

   De vlakke prijs wordt wel door ELK schrijvend verzoek betaald, ook waar niemand
   een stand heeft, en het meeste ervan is crypto. Dat is bewust niet weggehaald
   met een teller "hoeveel standen zijn er": zo'n teller moet bij elke schrijfweg
   worden bijgewerkt, en de faalvorm als iemand er een vergeet is FAIL-OPEN. */

'use strict';

const { dragersVanSessie } = require('../kern/isolatie/sessiedragers');
const handhaving = require('../kern/isolatie/handhaving');
const openpaden = require('../kern/isolatie/openpaden');

/* De montage en de schaduwtelling staan ernaast, in ./isolatiepoort-stand.js --
   zie de kop daar voor de naad. `laag` en `bijt` worden dus OPGEVRAAGD en niet
   hier bewaard: twee plekken die weten of de laag er is, is er een te veel. */
const poortstand = require('./isolatiepoort-stand');
const { telling } = poortstand;

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
  if (beschermstand && ic && ic.modus === 'beschermd') {
    const houd = beschermstand.houdtTegen(pad, req.method);
    if (houd) {
      return { been: 'huis', antwoord: { error: HUISZIN, functie: houd.functie, naam: houd.naam,
        reden: 'bescherming', categorie: houd.categorie, waarom: houd.waarom } };
    }
  }

  const laag = poortstand.huidig();
  if (!laag) return null;

  /* 3. DE VERKLAARDE UITGANGEN -- NA HET HUIS EN VOOR DE DRAGER, en die volgorde
        is een correctie op mijn eigen eerste versie.

        Die zette ze VOOR beide benen, met als argument dat het huis-been anders
        ooit de uitgang van de stand zelf sluit. Dat argument klopt voor de
        DRAGER: een lid dat zichzelf heeft dichtgezet en er niet meer uit kan, zit
        in een val die niemand heeft gekozen. Het klopt NIET voor het huis.

        SEC-LOCK-003: een lagere drager neutraliseert de beperking van een hogere
        niet. Een vrijstellingslijst die in de LEDENlaag woont en het HUIS-oordeel
        overrulet, is precies dat -- de eigenaar zet de noodstop om en een lijst
        van een laag eronder houdt zeven paden open. Vandaag maakt het geen
        verschil (nagemeten: geen van de twintig paden wordt onder `beschermd`
        door houdtTegen gesloten), en juist daarom is dit het moment om de
        volgorde goed te zetten: over een jaar, als iemand `bk-verblijf` in een
        bevroren categorie zet, zou de hotelkamerdeur stil open blijven tegen het
        besluit van de eigenaar in.

        Wat de uitgang tegen het HUIS beschermt is niet deze lijst maar de
        ceremonie van het huis zelf (kern/incidentcontrole.js), en die heeft zijn
        eigen weg terug. */
  const uitgang = openpaden.blijftOpen(pad);
  if (uitgang) return null;

  /* 4. STAAT ER EEN STAND VOOR DIT VERZOEK? Per drager EEN hash-opzoeking, en
        nooit "loop de kaart af" -- zie de kop. Zonder sessie is er geen drager
        en dus niets te wegen. */
  const sess = req.session || null;
  const kop = (typeof req.get === 'function' ? req.get('authorization') : '') || '';
  const token = kop.startsWith('Bearer ') ? kop.slice(7) : null;
  if (!sess && !token) return null;
  const { sleutels } = dragersVanSessie(sess, token);
  const context = laag.context(sleutels);
  const heeftStand = Object.values(context.standen || {})
    .some(v => v && v !== 'normaal');
  if (!heeftStand) return null;

  /* 5. PAS NU HET BESLUIT. */
  const b = laag.besluit({ pad, methode: req.method, context });
  telling.gewogen++;
  if (b.toegestaan) return null;
  telling.zouSluiten++;
  if (telling.paden.length < 20) telling.paden.push(req.method + ' ' + pad);
  for (const d of (b.dragers || [])) telling.dragers[d.drager] = (telling.dragers[d.drager] || 0) + 1;

  /* EN IN DE SCHADUW HOUDT HIJ NIETS TEGEN. Alleen tellen; de aanroeper krijgt
     null en het verzoek loopt gewoon door. Dat is het verschil tussen "de regel
     bestaat" en "de regel doet iets", en dit huis heeft die twee al een keer door
     elkaar gehaald -- toen stond `handhaaft: true` in een register boven een tak
     die nooit draaide. */
  if (!poortstand.bijtHij()) return null;
  return { been: 'drager', besluit: b, antwoord: antwoordVoor(b) };
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

function antwoordVoor(besluit) {
  return {
    error: 'Dit staat nu dicht door een beveiligingsstand op je account.',
    as: 'isolatie', reden: besluit.reden, regel: besluit.regel || null,
    waarom: besluit.uitleg,
    dragers: (besluit.dragers || []).map(d => d.drager),
    uitweg: 'Je kunt de stand opheffen via Mijn bescherming; die weg blijft altijd open.'
  };
}

module.exports = { zetLaag: poortstand.zetLaag, stand: poortstand.stand,
  weeg, antwoordVoor, _wisTelling: poortstand._wisTelling };

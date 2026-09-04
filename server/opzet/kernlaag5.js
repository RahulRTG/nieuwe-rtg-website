/* DE KERN SAMENSTELLEN -- deel 5 van 7.
   Waarom er op positie is geknipt en wat `kern` en `hulp` zijn: zie de kop van
   ./kernlaag1.js. Wat er in dit deel zit, in deze volgorde:
     stad
     aidata
     lidacties
     fluister
     tiener
     podium
     oog
     ghost
     flits */
'use strict';

module.exports = (kern, hulp) => {
  const { PERSONAS, accounts, alcoholGrensVan, annuleerReservering, anthropic, beveilig, crypto, db, entreeCode, facturatie, findSupplier, fooiUit, geborenVan, haversine, idGeverifieerd, keyVanCodenaam, klantProfiel, ledenPrijs, leeftijdVan, legApart, liveCodename, log, logActivity, maakOntmoeting, notify, notifySupplier, optieAan, pasTegoedToe, herstelTegoed, pickupCode, pushLive, reserveerTafel, save, schoon, sseToCustomer, sseToOffice, sseToSupplier, ticketsVoorSlot, verdienPunten, zorgContact } = hulp;

/* RTG Stad (kern/stad): het slimme-stad-platform op EIGEN hardware (de
   Stadsdoos-vloot, dezelfde familie als de Zaakdoos) en eigen software --
   domeinen met regimes, een scenario-knop in de boardroom en een
   AI-stadsregisseur. Privacy by design: de stad meet dingen, geen mensen. */
Object.assign(kern, require('../kern/stad')({ db, save, crypto, schoon, anthropic, sseToOffice, beveilig, keyVanCodenaam, sseToCustomer, weefsel: kern.weefsel }));
/* De stad in het gezamenlijke rampbeeld: tijdens een calamiteit ziet de hele
   keten (korpsen, zorg, defensie, boardroom) ook het stadsscenario, de
   bord-waarschuwingen en de vloot -- operationele toestand, geen
   persoonsgegevens. Late binding, want het rampbeeld is eerder gemount. */
kern.rampbeeld.koppelStad(() => {
  const b = kern.stad.stadBeeld();
  return { scenario: b.scenario, alerts: b.alerts, vloot: b.vloot };
});
/* En andersom kijkt het verkeersdomein van de stad naar de eigen OV-vloot:
   het aantal voertuigen dat NU met een verse positie onderweg is. Alleen een
   telling -- geen routes, geen reizigers, geen personen. */
kern.stad.stadKoppelVerkeer(() => ({
  ovOnderweg: (db.data.ovVoertuigen || []).filter(v => Date.now() - new Date(v.at).getTime() < (kern.VOERTUIG_TTL_MS || 120000)).length
}));
/* De eigen-AI-dataset (kern/aidata.js): een boardroom-knop verzamelt alle logs
   (Rahul-gesprekken, ballotage, audit, transacties, kantoorchat) als JSONL om
   later een eigen model te trainen -- op codenamen, de kluis blijft dicht. */
Object.assign(kern, require('../kern/aidata').maakAidata({ db, accounts }));
/* Lidacties (kern/lidacties.js): de transactiefuncties van het lid, als
   kern-module met expliciete afhankelijkheden. Ze bedienen de app-routes
   EN vullen de acties-registry van Rahul, volgens het contract
   (session, body) -> { ok, ... } | { status, error }. */
Object.assign(kern, require('../kern/lidacties')({
  db, save, crypto, schoon, PERSONAS, findSupplier, ledenPrijs, optieAan,
  leeftijdVan, geborenVan, idGeverifieerd, alcoholGrensVan, pickupCode, entreeCode, ticketsVoorSlot,
  fooiUit, pasTegoedToe, herstelTegoed, verdienPunten, liveCodename, haversine, pushLive,
  notifySupplier, sseToSupplier, sseToOffice,
  /* pay: sinds deze ronde verplaatsen de drie betaalpaden ECHT geld. Ze
     zetten hiervoor alleen `paid = true`; zie kern/pay/zaakbetaling.js. */
  pay: kern.pay,
  // elke betaalde lidtransactie hoort een factuur op te leveren;
  // zie de kop van kern/lidacties/factuur.js
  facturatie,
  zorgVoor: kern.zorgVoor, zorgMee: kern.zorgMee, zorgContact, keuken: kern.keuken,
  ledenvoordeelVoor: kern.ledenvoordeelVoor
}));
kern.rahulActies = {
  plaatsOrder: kern.plaatsOrderVoor, betaalOrder: kern.betaalOrderVoor,
  // de rekening in een keer afrekenen (betalen na het eten)
  betaalRekening: kern.betaalRekeningVoor,
  koopTicket: kern.koopTicketVoor, betaalBoeking: kern.betaalBoekingVoor,
  vraagRit: kern.vraagRitVoor, betaalRit: kern.betaalRitVoor,
  // Toren 4: een behandeling boeken en direct afrekenen, via exact dezelfde
  // functies als de app-knoppen (het zorgprofiel reist mee)
  careOverzicht: kern.careOverzicht, careBoek: kern.careBoek,
  boekBehandeling: (session, body) => kern.boekBehandelingActie(session, body, verdienPunten)
};
/* DE FLUISTERLAAG KRIJGT EEN EIGEN NAAM OP DE KERN in plaats van vijftien losse.
   Drie van die vijftien werden door zowel member als staff aangeraakt, en dan
   staat er in de gedeelde kern niet "deze twee domeinen hangen van de
   fluisterlaag af" maar vijftien namen waar je dat uit moet opmaken. Nu zegt een
   domein het: `= ctx.fluister`.

   De namen zelf blijven fluisterZeg, sparLijst en de rest -- dus kern.fluister
   .fluisterZeg leest dubbelop. Dat is de prijs van een kleine ingreep: alleen de
   BRON van elke destructurering verandert, de lokale namen en de hele body van
   elk bestand blijven zoals ze waren. De vorige keer dat hier honderden
   aanroepplekken mechanisch zijn aangeraakt, brak /api/supplier/menu/get
   (eerlijkheidspunt 6.9). Omdopen naar kern.fluister.zeg kan later, per plek, met
   de toetsen ernaast. */
kern.fluister = require('../kern/fluister')({
  db, save, schoon, anthropic, notify,
  reserveerTafel, annuleerReservering, assetGebruik: kern.assetGebruik, zorgVoor: kern.zorgVoor, zorgMee: kern.zorgMee, pay: kern.pay,
  acties: kern.rahulActies,
  // de reislaag van Rahul: een hele reis op een vraag, kleding apart
  // leggen en voorspellen -- via exact dezelfde functies als de app-knoppen
  verblijfBoek: (session, body) => kern.verblijfBoek(session, liveCodename(session), body),
  retailLegApart: legApart, retailKlantProfiel: klantProfiel,
  /* Het gegevensgesprek komt verderop pas op de kern, dus we pakken het hier
     laat op. Rahul doet zijn acties buiten de routes om -- en zou zonder dit de
     enige zijn die ongemerkt langs de gegevenspoort kan. Hij voert hetzelfde
     gesprek als de app, want de vraag hoort niet af te hangen van het kanaal. */
  gegevensStart: (sessie, soort) => (kern.gegevensStart ? kern.gegevensStart(sessie, soort) : null),
  gegevensZeg: (sessie, id, tekst) => (kern.gegevensZeg ? kern.gegevensZeg(sessie, id, tekst) : { status: 404, error: 'Dat gesprek ken ik niet meer.' })
});
// nieuwe seintjes worden vanzelf een melding op het toestel; de sweep loopt
// elk half uur, bouwt een index (een datapass voor alle gebruikers) en
// fluisterPush zelf zorgt dat niets twee keer piept
setInterval(() => { try { kern.fluister.fluisterPushAlle(); } catch (e) {} try { kern.fluister.sparSweepAlle && kern.fluister.sparSweepAlle(); } catch (e) {} }, 30 * 60 * 1000).unref();
/* De tiener-tools (kern/tiener.js): toetsplanner met leerplan en het
   zakgeldpotje met spaardoelen; eigen spullen van het profiel. */
Object.assign(kern, require('../kern/tiener')({ save, crypto }));
/* Salon-ontmoetingen (kern/ontmoeting.js): wederzijdse connecties die vlakbij
   elkaar zijn kiezen samen een activiteit, tekenen een veiligheidscontract en
   RTG-kantoor kijkt live mee tot de afspraak klaar is. Draait op de sociale
   kern (connecties) en geo, dus na Object.assign(kern, sociaal). */
Object.assign(kern, maakOntmoeting({
  db, save, crypto, accounts, leeftijdVan, notify, sseToCustomer, sseToOffice,
  connectieTussen: kern.connectieTussen, verbActief: kern.verbActief,
  zijnVrienden: kern.zijnVrienden, codenaamVan: kern.codenaamVan, haversine
}));
/* RTG Podium (kern/podium.js): het eigen live-kanaal van De Salon. Strikt 18+
   achter dezelfde paspoortpoort als de ontmoetingen; een kanaal gaat pas open
   na menselijke goedkeuring door kantoor; cadeautjes en abonnementen lopen
   via RTG Pay. Na pay en sociaal gemount (gebruikt beide). */
/* Wie werkt waar (kern/werkplekken.js): het Podium (zone 'zaak'), het Theater
   (de interne bibliotheek) en de Media OS stellen alle drie dezelfde vraag.
   Eén exemplaar op de kern, zodat er ook maar één antwoord is. */
Object.assign(kern, { werkplekken: require('../kern/werkplekken').maakWerkplekken({ accounts, findSupplier }) });
Object.assign(kern, require('../kern/podium').maakPodium({
  db, save, crypto, accounts, leeftijdVan, codenaamVan: kern.codenaamVan, keyVanCodenaam,
  sseToCustomer, sseToOffice, notify, pay: kern.pay, schoon,
  // de zakenwereld hangt aan de personeelsadministratie; findSupplier levert de zaaknaam
  findSupplier,
  // de haak van de Media OS: nieuw werk wekt volgers (zie ./mediaos.js)
  nieuwWerk: (key, soort, titel) => (kern.mediaNieuwWerk ? kern.mediaNieuwWerk(key, soort, titel) : null)
}));
/* RTG Eye (kern/oog.js): de camerabril van de werkvloer. Het kijken gebeurt
   op het toestel; hier landen alleen compacte schouw-/uitgifteregels
   (gecodeerd, geen beeld), die via een Zaakdoos-proxy vanzelf in het
   doos-journaal terechtkomen. */
Object.assign(kern, require('../kern/oog').maakOog({ db, save, crypto, schoon, sseToSupplier, logActivity }));
/* De Ghost Driver (kern/ghost.js): de vooruitkijkende verkeersleider. Rijdt
   per knooppunt de komende twaalf uur alvast (dagritme, evenement-uitloop uit
   verkochte tickets, eigen rittenhistorie, demo-weerbeeld) en adviseert de
   vloot uren van tevoren. Na de boekingslaag gemount (leest tickets). */
Object.assign(kern, require('../kern/ghost').maakGhost({
  db, findSupplier, boekingenVanZaak: kern.boekingenVanZaak, haversine
}));
/* RTG Flits (kern/flits.js): de rijhulp van het netwerk: meldingen op
   codenaam (flitser/file/ongeval/object/wegwerk) met houdbaarheid, dedupe
   als bevestiging, klopt/weg-stemmen en landregels. Bewust zonder
   spelmechaniek. Na ghost gemount (gebruikt de vooruitblik-motor). */
Object.assign(kern, require('../kern/flits').maakFlits({
  db, save, crypto, haversine, ghostSimuleer: kern.ghostSimuleer
}));
};

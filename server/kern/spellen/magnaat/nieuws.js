/* Magnaat: WERELDNIEUWS -- wat er in de stad gebeurt terwijl jij onderneemt.

   DE CYCLUS IS DE WIND, DIT ZIJN DE BUIEN. ./cyclus.js beweegt de hele stad
   tegelijk en langzaam; nieuws raakt EEN zone of EEN sector, kort en scherp. Dat
   onderscheid is de hele reden dat het twee lagen zijn: een golf waar iedereen
   in zit is een economie, een bui die alleen jouw straat raakt is een verhaal.

   VIER EISEN, en ze komen alle vier uit fouten die dit huis eerder maakte:

   1. NIEUWS RAAKT EEN GETAL DAT DE MOTOR AL GEBRUIKT. Er is geen bericht dat
      "de sfeer verbetert"; er is een bericht dat de vraag in de haven een
      kwartaal lang tien procent hoger ligt. Anders is het een krantenkop met een
      onzichtbare uitwerking, en dan kun je er niet op reageren.

   2. HET IS DETERMINISTISCH EN VOORAF AANGEKONDIGD. Hetzelfde als bij de cyclus:
      een gebeurtenis die je pas merkt als je omzet zakt, is pech en geen
      mechaniek. Elk bericht heeft een AANKONDIGING (het staat er een paar
      maanden voordat het begint) en een looptijd. Wie oplet kan verhuizen,
      bijbouwen of juist wachten.

   3. HET IS PUBLIEK. Nieuws staat in de krant. Er is geen versie hiervan waarin
      de ene ondernemer wel weet dat de brug dichtgaat en de andere niet.

   4. HET MAAKT NOOIT GELD. Een gebeurtenis verandert productievoorwaarden --
      vraag, kosten, risico -- en zet nooit een bedrag op een rekening. Dezelfde
      wet als bij onderzoek, en om dezelfde reden: alleen zo blijft geschapen
      waarde te onderscheiden van gedrukte waarde (scripts/magnaat-pomp.js).

   HOEVEEL NIEUWS ER IS, is met opzet weinig: gemiddeld een lopend bericht per
   drie maanden. Een stad waarin elke maand iets bijzonders gebeurt heeft geen
   bijzondere gebeurtenissen meer. */
const { trek } = require('./risico');
const { SECTORLIJST } = require('./sectoren');

const klem = (n, a, b) => Math.max(a, Math.min(b, n));

/* DE SOORTEN. Elk bericht kent een DOEL (een zone of een sector), een
   VRAAGFACTOR op wat het raakt, en een looptijd. `kans` is het gewicht waarmee
   hij getrokken wordt; samen tellen ze niet op tot een -- er wordt uit de lijst
   geloot met deze gewichten.

   De teksten zijn kort en zeggen WAT ER GEBEURT, niet hoe erg het is. Dat laatste
   staat in de getallen ernaast en hoort niet twee keer op het scherm. */
/* HOE EEN DOEL IN DE KRANT HEET. De motor rekent met sleutels; een krant
   schrijft in woorden. Dat onderscheid hoort HIER en niet in de sectortabel: dat
   is een balanstabel en geen woordenboek. */
const TAK = { horeca: 'de horeca', hotel: 'de hotels', retail: 'de winkels',
  logistiek: 'het vervoer', 'vrije-tijd': 'de vrijetijdssector',
  kantoor: 'de kantoren', industrie: 'de industrie' };
const ZONE = { haven: 'de Haven', boulevard: 'de Boulevard', centrum: 'het Centrum',
  sluizen: 'de Sluizen', terrein: 'het Bedrijventerrein', station: 'het Stationsgebied' };
const toon = (doel, soort) => (soort === 'zone' ? ZONE[doel] : TAK[doel]) || doel;

const SOORTEN = {
  festival: { naam: 'Festival', doel: 'zone', vraag: 1.22, duur: [2, 4], kans: 1.4,
    aankondiging: 3, tekst: (w) => 'Een festival strijkt neer in ' + w + '.' },
  wegwerk: { naam: 'Wegwerkzaamheden', doel: 'zone', vraag: 0.82, duur: [3, 7], kans: 1.6,
    aankondiging: 4, tekst: (w) => 'De doorgaande weg door ' + w + ' gaat maandenlang open.' },
  congres: { naam: 'Congres', doel: 'zone', vraag: 1.18, duur: [1, 3], kans: 1.0,
    aankondiging: 2, tekst: (w) => 'Een groot congres kiest ' + w + ' als locatie.' },
  toeloop: { naam: 'Toeristische opleving', doel: 'zone', vraag: 1.12, duur: [4, 9], kans: 0.9,
    aankondiging: 3, tekst: (w) => 'Reisgidsen ontdekken ' + w + '.' },
  bouwput: { naam: 'Grote verbouwing', doel: 'zone', vraag: 0.88, duur: [5, 10], kans: 0.8,
    aankondiging: 5, tekst: (w) => 'Een deel van ' + w + ' gaat op de schop.' },
  hype: { naam: 'Hype', doel: 'sector', vraag: 1.20, duur: [2, 5], kans: 1.2,
    aankondiging: 2, tekst: (w) => 'De vraag naar ' + w + ' schiet omhoog.' },
  schandaal: { naam: 'Branchekwestie', doel: 'sector', vraag: 0.85, duur: [3, 6], kans: 1.0,
    aankondiging: 2, tekst: (w) => 'Een kwestie zet ' + w + ' in een kwaad daglicht.' },
  norm: { naam: 'Nieuwe norm', doel: 'sector', vraag: 0.95, duur: [6, 12], kans: 0.7,
    aankondiging: 6, tekst: (w) => 'Er komt strengere regelgeving voor ' + w + '.' }
};
const SOORTLIJST = Object.keys(SOORTEN);
const GEWICHT = SOORTLIJST.reduce((n, s) => n + SOORTEN[s].kans, 0);

/* Hoe vaak er iets begint. Een op de drie maanden; de rest van de tijd is het
   gewoon een stad. */
const RITME = 3;

/* Uit een lijst kiezen met de hash, deterministisch. */
function kies(rij, sleutel) {
  if (!rij.length) return null;
  return rij[Math.min(rij.length - 1, Math.floor(trek(sleutel) * rij.length))];
}

/* HET BERICHT DAT IN MAAND N BEGINT, of niets. Alles eraan volgt uit (partij,
   maand): welk soort, waar, hoe lang. Zo is de hele krant van een campagne
   vooraf uit te rekenen -- en dat moet ook, want de klok rekent bij. */
function berichtVan(partijId, maand, zones) {
  if (maand % RITME !== 0) return null;
  const zaad = (partijId || '') + '|nieuws|' + maand;
  // welk soort: geloot met de gewichten uit de tabel
  let punt = trek(zaad + '|soort') * GEWICHT, soort = SOORTLIJST[0];
  for (const s of SOORTLIJST) { punt -= SOORTEN[s].kans; if (punt <= 0) { soort = s; break; } }
  const k = SOORTEN[soort];
  const doel = k.doel === 'zone' ? kies(zones || [], zaad + '|waar') : kies(SECTORLIJST, zaad + '|waar');
  if (!doel) return null;
  const duur = Math.round(k.duur[0] + trek(zaad + '|duur') * (k.duur[1] - k.duur[0]));
  return { soort, naam: k.naam, doelSoort: k.doel, doel, vraag: k.vraag,
    /* AANGEKONDIGD VOORDAT HET BEGINT. Dat is eis 2: wie oplet kan reageren, en
       dat is het verschil tussen een mechaniek en pech. */
    aangekondigd: maand - k.aankondiging, begint: maand, eindigt: maand + duur, duur,
    tekst: k.tekst(toon(doel, k.doel)), doelNaam: toon(doel, k.doel) };
}

/* WAT ER IN DEZE MAAND LOOPT. Alle berichten die begonnen zijn en nog niet
   afgelopen; hoogstens een handvol, want er begint er maar een per drie maanden
   en ze duren zelden langer dan een jaar. */
function lopend(partijId, maand, zones) {
  const uit = [];
  for (let m = Math.max(0, maand - 12); m <= maand; m++) {
    const b = berichtVan(partijId, m, zones);
    if (b && b.begint <= maand && maand < b.eindigt) uit.push(b);
  }
  return uit;
}

/* WAT ER ERAAN KOMT: aangekondigd maar nog niet begonnen. Dit is de lijst waar
   een speler zijn plannen op maakt. */
function komend(partijId, maand, zones) {
  const uit = [];
  for (let m = maand; m <= maand + 12; m++) {
    const b = berichtVan(partijId, m, zones);
    if (b && b.aangekondigd <= maand && maand < b.begint) uit.push(b);
  }
  return uit;
}

/* DE VRAAGFACTOR VOOR EEN VESTIGING. Berichten stapelen door vermenigvuldiging,
   net als de onderzoekseffecten -- optellen kan een factor negatief maken. De
   uitkomst wordt begrensd, want drie festivals tegelijk hoort een goede maand te
   zijn en geen andere economie. */
const BAND = [0.7, 1.5];
function factorVoor(partijId, maand, zones, { zone, sector }) {
  let f = 1;
  for (const b of lopend(partijId, maand, zones))
    if ((b.doelSoort === 'zone' && b.doel === zone) || (b.doelSoort === 'sector' && b.doel === sector))
      f *= b.vraag;
  return klem(f, BAND[0], BAND[1]);
}

/* WAT ER IN DE KRANT STAAT. Publiek: nieuws is van de stad. */
function beeld(partijId, maand, zones) {
  return {
    nu: lopend(partijId, maand, zones).map(b => Object.assign({ nog: b.eindigt - maand }, b)),
    komt: komend(partijId, maand, zones).map(b => Object.assign({ over: b.begint - maand }, b))
  };
}

module.exports = { SOORTEN, SOORTLIJST, RITME, BAND, TAK, ZONE, toon, berichtVan, lopend, komend, factorVoor, beeld };

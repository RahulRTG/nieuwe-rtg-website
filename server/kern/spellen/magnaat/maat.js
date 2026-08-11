/* Magnaat: DE MAAT VAN EEN ZAAK -- hoeveel kan hij aan, en hoe goed gaat het.

   Afgesplitst van ./stap.js op een naad die er al lag. Dat bestand rekent EEN
   MAAND: vraag, omzet, kosten, resultaat. Deze drie functies gaan over de zaak
   ZELF en staan los van de kalender -- ze zijn waar over een vestiging die
   deze maand niets doet, en ze worden ook buiten de maandloop gesteld (het
   scherm vraagt de capaciteit, de contractlaag vraagt wat er geleverd kan
   worden, de acties vragen hoeveel mensen er nodig zijn).

   De aanleiding was de 10 kB-grens die scripts/check.js bewaakt en die stap.js
   omging toen `personeelNodig` erbij kwam. Die grens is precies een rem hierop:
   hij dwingt de vraag "waar ligt hier de naad" op het moment dat het antwoord
   nog kort is. */
const { SECTOREN } = require('./sectoren');
const { KOSTENSTAND, prijsVan } = require('./prijsstand');
const O = require('./onderzoek');

const klem = (n, min, max) => Math.max(min, Math.min(max, n));

/* Wat EEN medewerker aankan. Drie dingen bepalen het en ze staan alle drie
   ergens anders beschreven:

     - de sector (./sectoren.js): een kok bedient minder stoelen dan een
       kassamedewerker kassaplekken.
     - KOSTENSTAND: bij een hoge prijsstand kan een medewerker MINDER eenheden
       aan -- witte tafellakens vragen meer handen per gast.
     - ONDERZOEK GRIJPT HIER AAN en niet op de uitkomst. Een uitvinding verhoogt
       hoeveel een medewerker aankan; hij zet geen bonus op de winst. Dat
       verschil is de hele belofte uit ./onderzoek.js: waarde mag alleen
       ontstaan via een MEETBARE productiviteitswinst, en een lagere loonpost
       per eenheid is meetbaar. */
const perMens = (v) => SECTOREN[v.sector].perMedewerker
  * O.factor(v, 'perMedewerker') / (KOSTENSTAND[v.prijs] || 1);

/* De capaciteit van een vestiging: personeel maal wat een medewerker aankan,
   maar nooit meer dan de vestiging groot is. Meer personeel in een klein pand
   levert niets extra's op, en dat hoort te voelen als geld weggooien.

   `arbeid` is de bonus uit de Foundation-projecten: een bibliotheek en een
   leerplek leveren op termijn beter opgeleid personeel, en dat is precies waar
   het in de vision om ging -- een maatschappelijk project dat MEETBAAR
   doorwerkt in de economie in plaats van in het nieuws te staan. */
function capaciteit(v, arbeid) {
  return Math.min(v.omvang, v.personeel * perMens(v) * (1 + (arbeid || 0)))
    * SECTOREN[v.sector].perMaand;
}

/* HOEVEEL MENSEN JE NODIG HEBT om de zaak vol te draaien -- de omgekeerde som,
   en dus dezelfde som. Twee redenen dat hij bestaat:

     1. Het is het getal waar ./acties.js de startbezetting mee zet. Dat stond
        daar als een eigen berekening, en twee berekeningen van hetzelfde lopen
        uiteen zodra er iemand aan een van beide sleutelt -- wat er ook gebeurde:
        de onderzoeksfactor zat wel in de capaciteit en niet in de startbezetting.
     2. Zonder dit getal op het scherm is `automatisering` ONZICHTBAAR. Een
        volledig bezette zaak zit tegen zijn omvang aan; dat een medewerker meer
        aankan levert pas iets op als je er een naar huis stuurt, en dat doe je
        niet als je niet ziet dat het kan. De uitvinding koopt geen capaciteit
        maar RUIMTE OM AF TE SLANKEN, en die ruimte hoort zichtbaar te zijn. */
function personeelNodig(v, arbeid) {
  return Math.max(1, Math.ceil(v.omvang / (perMens(v) * (1 + (arbeid || 0)))));
}

/* VANAF WELKE MAAT EEN ZAAK ZICHZELF KAN DRAGEN, per sector uitgerekend.

   DIT IS DE REPARATIE VAN EEN MAGISCH GETAL. In ./acties.js stond `Math.max(4,
   ...)`: een vestiging is minstens vier eenheden groot. Dat las als EEN regel
   en het waren er zeven, want een eenheid is per sector iets anders -- zie
   ./sectoren.js, waar `eenheid` letterlijk stoelen, kamers of productielijnen
   is. Vier stoelen kosten 23.612 en vier productielijnen 287.324, en dat is
   meer dan het startkapitaal. `industrie` was daarmee niet een zwakke keuze
   maar een DEUR DIE OP SLOT ZAT: in zesendertig maanden opende dat profiel geen
   enkele zaak.

   En de vloer deed precies het omgekeerde van zijn bedoeling. Waar een eenheid
   goedkoop is (horeca, retail, vrije tijd) floort de economie zichzelf al: het
   loon van de ene medewerker die je hoe dan ook moet hebben, is groter dan wat
   een handvol eenheden opbrengt, dus draaien die zaken verlies tot ze groot
   genoeg zijn. Daar hoefde de regel niets te doen. Waar een eenheid duur is
   (hotel, kantoor, industrie) is EEN eenheid al winstgevend, en dwong de regel
   je er vier te kopen.

   Dus: de motor floort nog op een eenheid -- een zaak van nul bestaat niet --
   en dit getal is wat een SPELER hoort te weten. Het staat op een plek omdat
   het er drie had (de motor, de AI-concurrent en de profielen van de strateeg),
   en drie kopieen van een regel lopen uit elkaar.

   HIJ NEGEERT DE HUUR, en dat is met opzet: huur hangt aan het kavel en dit
   getal is een eigenschap van de SECTOR. Het is dus een ondergrens op de
   ondergrens, en dat is precies wat een speler eraan heeft. */
function rendabelVanaf(sector, stand = 'midden') {
  const s = SECTOREN[sector];
  const k = KOSTENSTAND[stand] || 1;
  /* Wat een eenheid per maand overhoudt, voor het loon van de eerste medewerker.

     DE VASTE LASTEN STAAN ERIN EN VERANDEREN VANDAAG NIETS, en dat hoort hier
     te staan in plaats van stil te zijn. Ze zijn per eenheid 3 tot 11 procent
     van de brutomarge, en dat is nergens genoeg om een afronding te verzetten:
     de uitkomst is voor alle zeven sectoren gelijk met en zonder deze term.
     Geen enkele toets kan hem dus vangen -- dat is geprobeerd, de mutatie kwam
     er langs. Hij blijft staan omdat hij bij een andere sectortabel wel bijt
     (logistiek zit met 540 per voertuig al op 11%, en die 400 is er ooit
     bewust in gezet om die sector hefboom te geven), en omdat een formule die
     een echte kostenpost weglaat toevallig goed is in plaats van goed. Wie hier
     komt sleutelen: dit is een van de plekken die op mensen leunt. */
  const marge = s.perMaand * prijsVan(sector, stand) * (1 - s.inkoop) - s.vast * k * 1.35;
  if (marge <= 0) return Math.ceil(s.perMedewerker / k) || 1;
  return Math.max(1, Math.ceil(s.loon / marge));
}

/* WAT ER DEZE MAAND DAADWERKELIJK GELEVERD WORDT op de lopende contracten van
   deze vestiging. Staat hier en niet in ../economie.js omdat die het antwoord
   twee keer nodig heeft -- een keer om de afnemers te bedienen, een keer voor
   de maand van de leverancier zelf -- en twee berekeningen van hetzelfde lopen
   uiteen zodra er iemand aan een van beide sleutelt. */
function levering(v, arbeid, toegezegd) {
  const cap = capaciteit(v, arbeid);
  const geleverd = Math.min(toegezegd || 0, cap);
  return { cap, geleverd, deel: toegezegd > 0 ? geleverd / toegezegd : 1 };
}

/* Kwaliteit: hoe goed het er op dit moment aan toegaat. Twee dingen bepalen
   hem, en allebei zijn ze een keuze van de speler:
     - RUIMTE: personeel ten opzichte van wat er binnenkomt. Wie zijn zaak
       ramvol laat lopen met te weinig mensen levert slechtere service.
     - ONDERHOUD: een pand dat wegzakt trekt de beleving mee omlaag. */
function kwaliteit(v, verkocht, arbeid) {
  const cap = Math.max(1, capaciteit(v, arbeid));
  const bezetting = verkocht / cap;
  const ruimte = bezetting <= 0.85 ? 1 : klem(1 - (bezetting - 0.85) * 1.6, 0.45, 1);
  /* ONDERZOEK GRIJPT OOK HIER AAN, en dat is de derde plek naast capaciteit en
     kosten. De kwaliteitsrichting (productkwaliteit, guest experience,
     belevingsontwerp) verhoogt wat er geleverd wordt; reputatie kruipt daar
     vervolgens naartoe en de vraag volgt de reputatie. Het werkt dus NIET
     rechtstreeks op de omzet maar via twee stappen die de motor al zette --
     precies zoals een effect hoort te werken. */
  return klem(100 * ruimte * (0.55 + (v.onderhoud / 100) * 0.45) * O.factor(v, 'kwaliteit'), 0, 100);
}

module.exports = { capaciteit, personeelNodig, rendabelVanaf, levering, kwaliteit, perMens };

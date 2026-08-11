/* Magnaat: DE ECONOMISCHE STAP -- een spelmaand voor een vestiging.

   Dit is de kern waar alle sectoren op draaien, en de reden dat er niet zeven
   economieen naast elkaar staan. De sectorverschillen zijn GETALLEN
   (./sectoren.js); de redenering is hier, een keer.

   EEN MAAND, IN ZES ZINNEN:

     1. Er komt vraag binnen (./vraag.js).
     2. Je kunt maar zoveel aan: capaciteit = personeel x wat een medewerker
        aankan, begrensd door de omvang van de vestiging.
     3. Wat je aankan verkoop je; wat je misloopt zie je terug als GEMIST, want
        dat is de duurste onzichtbare fout in dit genre.
     4. Kosten: inkoop over de omzet, lonen, vaste lasten, huur, marketing,
        onderhoud.
     5. Kwaliteit volgt uit bezetting en onderhoud; reputatie kruipt naar
        kwaliteit toe.
     6. Onderhoud zakt vanzelf. Wie het laat zakken bespaart nu en betaalt later.

   ALLES IS NAREKENBAAR EN NIETS IS TOEVAL. Dezelfde toestand geeft dezelfde
   maand, elke keer. Dat is geen netheid maar de eis onder §12.4: de wereld
   rekent BIJ wanneer iemand kijkt, dus tien stappen achter elkaar moeten
   hetzelfde opleveren als tien stappen verspreid over een dag. Met een
   dobbelsteen erin zou dat niet zo zijn -- en dan zou "sinds je weg was" van je
   pollgedrag afhangen.

   Toeval hoort in de WERELD (een storm, een evenement) en niet in de boeken;
   die komt dus uit de gebeurtenislaag en gaat als factor mee naar binnen. */
const { SECTOREN, prijsVan, LATFACTOR } = require('./sectoren');
const { vraagVoor } = require('./vraag');

const rond = (n) => Math.round(n);
const klem = (n, min, max) => Math.max(min, Math.min(max, n));

/* De capaciteit van een vestiging: personeel maal wat een medewerker aankan,
   maar nooit meer dan de vestiging groot is. Meer personeel in een klein pand
   levert niets extra's op, en dat hoort te voelen als geld weggooien. */
function capaciteit(v, arbeid) {
  const s = SECTOREN[v.sector];
  /* De omvang in eenheden, begrensd door wat het personeel aankan, maal hoe
     vaak een eenheid per maand verkocht wordt.

     `arbeid` is de bonus uit de Foundation-projecten: een bibliotheek en een
     leerplek leveren op termijn beter opgeleid personeel, en dat is precies
     waar het in de vision om ging -- een maatschappelijk project dat MEETBAAR
     doorwerkt in de economie in plaats van in het nieuws te staan. */
  return Math.min(v.omvang, v.personeel * s.perMedewerker * (1 + (arbeid || 0))) * s.perMaand;
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
  return klem(100 * ruimte * (0.55 + (v.onderhoud / 100) * 0.45), 0, 100);
}

/* Een maand. Verandert de vestiging IN PLAATS en geeft de regels terug waaruit
   het resultaat is opgebouwd -- die regels zijn wat het scherm toont en wat
   Rahul mag navertellen. */
function maand(kaart, v, { maand: m, zoneDruk, wereldFactor, arbeid }) {
  const s = SECTOREN[v.sector];
  const vr = vraagVoor(kaart, v, { maand: m, zoneDruk, marketing: v.marketing });
  const gevraagd = vr.eenheden * (wereldFactor || 1);
  const cap = capaciteit(v, arbeid);
  const verkocht = Math.min(gevraagd, cap);
  const gemist = Math.max(0, gevraagd - cap);

  const prijs = prijsVan(v.sector, v.prijs);
  const omzet = verkocht * prijs;
  const inkoop = omzet * s.inkoop;
  const lonen = v.personeel * s.loon;
  const vast = v.omvang * s.vast;
  const huur = v.huur;
  const marketing = v.marketing || 0;
  /* Onderhoud is een BEDRAG dat de speler kiest, geen vinkje. Wat het oplevert
     staat hieronder: het houdt de staat op peil in plaats van hem te laten
     zakken. */
  const onderhoudKosten = v.onderhoudBudget || 0;
  const kosten = inkoop + lonen + vast + huur + marketing + onderhoudKosten;
  const resultaat = omzet - kosten;

  // de staat van het pand: zakt vanzelf, stijgt met wat je eraan besteedt
  const nodig = v.omvang * s.vast * 0.35;
  const herstel = nodig > 0 ? klem((onderhoudKosten / nodig) * 6, 0, 12) : 0;
  v.onderhoud = klem(v.onderhoud - 4 + herstel, 0, 100);

  /* Reputatie kruipt naar kwaliteit toe en springt nooit. Dat is wat een naam
     opbouwen anders maakt dan een prijs veranderen: het kost maanden, en het
     kost ook maanden om hem kwijt te raken. De lat ligt hoger als je duur bent. */
  const kwal = kwaliteit(v, verkocht, arbeid) / (LATFACTOR[v.prijs] || 1);
  v.reputatie = klem(v.reputatie + (kwal - v.reputatie) * 0.22, 0, 100);

  v.maanden = (v.maanden || 0) + 1;
  v.omzetTotaal = (v.omzetTotaal || 0) + omzet;
  v.resultaatTotaal = (v.resultaatTotaal || 0) + resultaat;

  return {
    eenheden: rond(verkocht), gemist: rond(gemist), capaciteit: rond(cap),
    bezetting: cap > 0 ? Math.round((verkocht / cap) * 100) : 0,
    omzet: rond(omzet), inkoop: rond(inkoop), lonen: rond(lonen), vast: rond(vast),
    huur: rond(huur), marketing: rond(marketing), onderhoud: rond(onderhoudKosten),
    kosten: rond(kosten), resultaat: rond(resultaat),
    staat: Math.round(v.onderhoud), reputatie: Math.round(v.reputatie),
    stappen: vr.stappen
  };
}

/* Wat een vestiging WAARD is. Niet "wat je erin hebt gestopt" maar wat hij
   opbrengt: een jaarwinst maal een factor die met reputatie meebeweegt, met de
   grond eronder als bodem. Zo is een verlieslatende zaak nog steeds iets waard
   en een goedlopende zaak meer dan zijn stenen. */
function waarde(v) {
  const jaar = (v.resultaatTotaal || 0) / Math.max(1, v.maanden || 1) * 12;
  const factor = 3.5 + (v.reputatie / 100) * 3.5;
  return Math.max(rond(v.gebouwdVoor * 0.55), rond(Math.max(0, jaar) * factor + v.gebouwdVoor * 0.35));
}

module.exports = { maand, capaciteit, kwaliteit, waarde };

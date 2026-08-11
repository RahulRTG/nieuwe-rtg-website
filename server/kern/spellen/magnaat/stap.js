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
const { SECTOREN } = require('./sectoren');
const { prijsVan, LATFACTOR, KOSTENSTAND } = require('./prijsstand');
const { vraagVoor } = require('./vraag');
const H = require('./handel');
const O = require('./onderzoek');
/* HOEVEEL EEN ZAAK AANKAN EN HOE GOED HET GAAT staat in ./maat.js -- waar over
   de vestiging zelf, los van de kalender. Dit bestand rekent een MAAND. */
const { capaciteit, personeelNodig, levering, kwaliteit } = require('./maat');

const rond = (n) => Math.round(n);
const klem = (n, min, max) => Math.max(min, Math.min(max, n));

/* Een maand. Verandert de vestiging IN PLAATS en geeft de regels terug waaruit
   het resultaat is opgebouwd -- die regels zijn wat het scherm toont en wat
   Rahul mag navertellen.

   `contract` en `gedekt` zijn de twee kanten van fase B, en ze staan HIER omdat
   een maand op een plek gerekend hoort te worden. `contract` is wat deze
   vestiging heeft toegezegd te LEVEREN (opgeteld over al zijn lopende
   contracten); `gedekt` is wat hij als afnemer geleverd KREEG, per handelssoort.
   Zonder allebei rekent deze functie precies zoals in fase A -- dat is de eis:
   een economie die anders rekent zodra er een laag bijkomt, is twee economieen. */
function maand(kaart, v, { maand: m, zoneDruk, wereldFactor, arbeid, contract, gedekt }) {
  const s = SECTOREN[v.sector];
  const vr = vraagVoor(kaart, v, { maand: m, zoneDruk, marketing: v.marketing });
  const gevraagd = vr.eenheden * (wereldFactor || 1);

  /* LEVERING GAAT VOOR VRIJE VERKOOP. Je hebt getekend: de capaciteit is
     vergeven voordat de eerste klant binnenkomt. Zonder die volgorde is een
     contract gratis geld en tekent iedereen alles. Zie ./handel.js. */
  const toegezegd = (contract && contract.eenheden) || 0;
  const { cap, geleverd, deel: leverDeel } = levering(v, arbeid, toegezegd);
  const leverOmzet = ((contract && contract.bedrag) || 0) * leverDeel;

  const verkocht = Math.min(gevraagd, Math.max(0, cap - geleverd));
  const gemist = Math.max(0, gevraagd - Math.max(0, cap - geleverd));

  const prijs = prijsVan(v.sector, v.prijs);
  const omzet = verkocht * prijs + leverOmzet;
  /* Wat een contract de AFNEMER oplevert is dat een deel van zijn inkooppost
     wegvalt; wat hij ervoor betaalt wordt apart geboekt (../economie.js). Zo
     staat er nooit twee keer een bedrag voor dezelfde zak aardappelen. */
  let korting = 0;
  for (const [soort, ontvangen] of Object.entries(gedekt || {}))
    korting += H.dekking(v, omzet, soort, ontvangen).bedrag;
  const inkoop = Math.max(0, omzet * s.inkoop * O.factor(v, 'inkoop') - korting);
  const lonen = v.personeel * s.loon;
  // en een duurder pand per eenheid; hetzelfde getal, dezelfde reden
  const vast = v.omvang * s.vast * (KOSTENSTAND[v.prijs] || 1) * O.factor(v, 'vast');
  const huur = v.huur;
  const marketing = v.marketing || 0;
  /* Onderhoud is een BEDRAG dat de speler kiest, geen vinkje. Wat het oplevert
     staat hieronder: het houdt de staat op peil in plaats van hem te laten
     zakken. */
  const onderhoudKosten = v.onderhoudBudget || 0;
  const kosten = inkoop + lonen + vast + huur + marketing + onderhoudKosten;
  const resultaat = omzet - kosten;

  // de staat van het pand: zakt vanzelf, stijgt met wat je eraan besteedt
  const nodig = v.omvang * s.vast * (KOSTENSTAND[v.prijs] || 1) * 0.35;
  const herstel = nodig > 0 ? klem((onderhoudKosten / nodig) * 6, 0, 12) : 0;
  v.onderhoud = klem(v.onderhoud - 4 + herstel, 0, 100);
  // wat er in de zaak omgaat, en dus wat de kwaliteit bepaalt: contract en
  // markt samen. Een leverancier die zijn hele capaciteit vergeven heeft, staat
  // net zo hard onder druk als een die vol zit met loop
  const bezet = geleverd + verkocht;

  /* Reputatie kruipt naar kwaliteit toe en springt nooit. Dat is wat een naam
     opbouwen anders maakt dan een prijs veranderen: het kost maanden, en het
     kost ook maanden om hem kwijt te raken. De lat ligt hoger als je duur bent. */
  const kwal = kwaliteit(v, bezet, arbeid) / (LATFACTOR[v.prijs] || 1);
  v.reputatie = klem(v.reputatie + (kwal - v.reputatie) * 0.22, 0, 100);

  v.maanden = (v.maanden || 0) + 1;
  v.omzetTotaal = (v.omzetTotaal || 0) + omzet;
  v.resultaatTotaal = (v.resultaatTotaal || 0) + resultaat;

  return {
    eenheden: rond(verkocht), gemist: rond(gemist), capaciteit: rond(cap),
    bezetting: cap > 0 ? Math.round((bezet / cap) * 100) : 0,
    omzet: rond(omzet), inkoop: rond(inkoop), lonen: rond(lonen), vast: rond(vast),
    huur: rond(huur), marketing: rond(marketing), onderhoud: rond(onderhoudKosten),
    kosten: rond(kosten), resultaat: rond(resultaat),
    staat: Math.round(v.onderhoud), reputatie: Math.round(v.reputatie),
    /* De kwaliteit die deze maand geleverd is, ONGEWOGEN door de prijsstand:
       een kwaliteitseis in een contract gaat over wat er geleverd wordt en niet
       over wat de klanten ervan vonden. Zonder dit getal zou de afwikkeling in
       ../economie.js de kwaliteit opnieuw moeten uitrekenen, en dan staan er
       twee antwoorden op dezelfde vraag. */
    kwaliteit: Math.round(kwaliteit(v, bezet, arbeid)),
    levering: toegezegd > 0
      ? { toegezegd: rond(toegezegd), geleverd: rond(geleverd), deel: leverDeel, omzet: rond(leverOmzet) }
      : null,
    korting: rond(korting),
    stappen: vr.stappen
  };
}

/* `waarde` reist mee vanuit ./waardering.js: hij hoorde hier ooit thuis en de
   rest van de motor haalt hem hier vandaan. Een tweede adres voor dezelfde
   functie zou een tweede antwoord op dezelfde vraag worden. */
const { waarde, WAARDEPLAFOND } = require('./waardering');
module.exports = { maand, capaciteit, personeelNodig, kwaliteit, waarde, levering, WAARDEPLAFOND };

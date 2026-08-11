/* Spellen (deelmodule): DE DAGOPGAVE.

   Een opgave per dag, dezelfde voor iedereen, met een bord dat 's nachts leeg
   is. Dat is iets anders dan het gewone arcadebord: daar staat je BESTE score
   ooit, hier staat wat je vandaag deed. De ene is een record, de andere is een
   wedstrijd van een dag.

   WAT DEZE LAAG NIET WEET. Geen enkel spel wordt hier bij naam genoemd. Wat een
   opgave IS komt uit het spel zelf, via twee haken in zijn descriptor
   (`dagOpgave` en `dagKeur`, zie kern/spellen/sudoku.js); wat hier staat is
   boekhouding: wie meedoet, wanneer de klok begint, wat er wel en niet bewaard
   wordt, en hoe het bord eruitziet. Komt Sneek er ooit bij, dan is dat een
   descriptor met twee haken en geen regel hier.

   DRIE DINGEN DIE ER MET OPZET NIET ZIJN, en dat is de helft van deze module:

   1. GEEN REEKS. Geen "vijf dagen op rij", geen teller, geen veld waar er een
      in zou passen. `prestaties.js` verbiedt reeksen al, en een dagstreak is de
      zuiverste vorm van de ratel die `CLAUDE.md` uit dit huis houdt: hij straft
      je voor de dag dat je niet meedoet.
   2. GEEN MELDING DAT HIJ VERLOOPT. Niet als vergeten optie maar STRUCTUREEL:
      deze module krijgt `nudge` niet eens binnen, dus er is niets om aan te
      zetten. Wie hem vandaag mist, mist hem; morgen staat er een nieuwe.
   3. GEEN SEIZOEN, GEEN HISTORIE. Elke dag die niet vandaag is wordt gewist,
      opgave en al -- geen alletijden-dagbord waar een reeks alsnog uit af te
      leiden valt.

   WIE ER OP HET BORD STAAT, en waarom niet iedereen. Je PLAATS gaat over het
   hele veld, want daar zit de wedstrijd. De namenlijst blijft je eigen kring,
   want een lijst met codenamen van vreemden is een sociale laag die dit huis
   nergens anders heeft en die met een puzzel niet te rechtvaardigen is. Je
   ziet dus: hoeveel mensen hem vandaag oplosten, de hoeveelste je bent, en bij
   naam alleen wie je kent. Een besluit, geen tekortkoming, en omkeerbaar.

   DE PROGRESSIEGRENS geldt hier als overal: onder de grens speel je gewoon en
   hoor je je tijd, er wordt alleen niets bewaard. Geen 403: een fout aan het
   eind van een opgave zou zeggen dat je iets niet mocht, en dat is niet waar.

   DE DAG IS DIE VAN AMSTERDAM en niet die van de server. Een opgave die om
   twee uur 's nachts wisselt hoort bij niemands dag; `kern/tijdzone.js` heeft
   de zonedatabase al aan boord, dus er valt hier niets zelf uit te rekenen. */
const { lokaal } = require('../tijdzone');

module.exports = (ctx) => {
  const { S, save, nu, codenaamVan, ARCADE, DAG, progressieMag, GEEN_PROGRESSIE } = ctx;
  const ZONE = 'Europe/Amsterdam';
  // als parameter zodat een toets een dag verder kan zetten zonder de klok van
  // de machine te verzetten; in productie staat hier niets
  const vandaag = ctx.vandaag || (() => lokaal(ZONE).datum);

  const heeftDag = (spel) => !!(ARCADE[spel] && ARCADE[spel].dagelijks && DAG[spel]);
  const GEEN_OPGAVE = { status: 400, error: 'Dit spel heeft geen dagopgave.' };

  function T(spel) {
    const s = S();
    if (!s.dagopgave) s.dagopgave = {};
    if (!s.dagopgave[spel]) s.dagopgave[spel] = {};
    return s.dagopgave[spel];
  }

  /* De opgave van vandaag, en meteen het einde van die van gisteren. Dat wissen
     staat HIER en niet alleen in de opruiming: de eerste speler van een nieuwe
     dag hoort geen tweede opgave naast de oude te zetten. `maken` is vals bij
     alleen kijken -- anders maakt een blik op het bord de puzzel al aan. */
  function vanVandaag(spel, maken) {
    const alles = T(spel), datum = vandaag();
    let veranderd = false;
    for (const d of Object.keys(alles)) if (d !== datum) { delete alles[d]; veranderd = true; }
    if (!alles[datum] && maken) {
      const gemaakt = DAG[spel].opgave();
      alles[datum] = { geheim: gemaakt.geheim, opgave: gemaakt.opgave, spelers: {} };
      veranderd = true;
    }
    if (veranderd) save();
    return { datum, dag: alles[datum] || null };
  }

  /* De rangschikking van vandaag. Alleen wie hem OPLOSTE en wiens score bewaard
     mocht worden staat erin -- onder de progressiegrens wordt er geen getal
     weggeschreven, dus telt die speler ook niet mee in het veld. Gelijke punten
     worden op de seconden gescheiden; punten lopen in hele seconden terug, dus
     zonder die tweede sleutel zou de volgorde van twee gelijke tijden van de
     invoegvolgorde afhangen. */
  const rangschik = (dag) => Object.entries((dag && dag.spelers) || {})
    .filter(([, v]) => typeof v.punten === 'number')
    .sort((a, b) => b[1].punten - a[1].punten || a[1].seconden - b[1].seconden);

  function bord(mij, dag, vrienden) {
    const rij = rangschik(dag);
    /* `mee` gaat over de DAG en niet over een persoon, en mag daarom ook onder
       de progressiegrens mee: dat is dezelfde redenering waarmee de dagtelling
       buiten de grens valt (zie ./grens.js). */
    const mee = rij.length;
    if (!progressieMag(mij)) return { mee, bord: [], ranglijst: false, reden: GEEN_PROGRESSIE };
    const plaats = new Map(rij.map(([h], i) => [h, i + 1]));
    const kring = new Set([mij, ...(vrienden || [])]);
    return {
      mee, ranglijst: true, plaats: plaats.get(mij) || null,
      bord: rij.filter(([h]) => kring.has(h)).slice(0, 20).map(([h, v]) => ({
        codenaam: codenaamVan(h), ik: h === mij, punten: v.punten, seconden: v.seconden, plaats: plaats.get(h)
      }))
    };
  }

  /* Kijken. Maakt de opgave NIET aan en start geen klok: dit is het scherm dat
     je opent om te zien of je vandaag al meedeed. */
  function dagStand(mij, spel, vrienden) {
    if (!heeftDag(spel)) return GEEN_OPGAVE;
    const { datum, dag } = vanVandaag(spel, false);
    const mijn = (dag && dag.spelers[mij]) || null;
    const uit = { status: 200, ok: true, datum, begonnen: !!mijn, klaar: !!(mijn && mijn.klaar) };
    /* De opgave reist alleen mee als je AL begonnen bent. Zo krijgt niemand hem
       te zien zonder dat de klok loopt, en houdt een speler die zijn pagina
       ververst gewoon dezelfde puzzel voor zich. */
    if (mijn && !mijn.klaar) { uit.opgave = dag.opgave; uit.gestart = mijn.start; }
    if (mijn && mijn.klaar) {
      uit.seconden = mijn.seconden;
      if (typeof mijn.punten === 'number') uit.punten = mijn.punten;
    }
    return Object.assign(uit, bord(mij, dag, vrienden));
  }

  /* Beginnen. Dit is het moment waarop de klok gaat lopen, en daarom is het een
     eigen handeling: wie het scherm opent hoort geen tijd te verliezen aan
     kijken. */
  function dagStart(mij, spel) {
    if (!heeftDag(spel)) return GEEN_OPGAVE;
    const { datum, dag } = vanVandaag(spel, true);
    let mijn = dag.spelers[mij];
    if (mijn && mijn.klaar)
      return { status: 409, error: 'Je hebt de opgave van vandaag al gedaan. Morgen staat er een nieuwe.' };
    /* De klok begint bij de EERSTE start en niet opnieuw. Zou hij hier opnieuw
       gezet worden, dan is "nog een keer starten" een knop die je tijd
       terugzet, en dan meet het bord niets meer. */
    if (!mijn) { mijn = dag.spelers[mij] = { start: Date.now() }; save(); }
    return { status: 200, ok: true, datum, opgave: dag.opgave, gestart: mijn.start };
  }

  /* Inleveren. De tijd is die van de server, van start tot nu; het spel keurt
     de inzending en zegt wat hij waard is. */
  function dagKlaar(mij, spel, inzending) {
    if (!heeftDag(spel)) return GEEN_OPGAVE;
    const { datum, dag } = vanVandaag(spel, false);
    const mijn = dag && dag.spelers[mij];
    if (!mijn) return { status: 409, error: 'Je bent vandaag nog niet begonnen. Start de dagopgave eerst.' };
    if (mijn.klaar) return { status: 409, error: 'Je hebt de opgave van vandaag al gedaan. Morgen staat er een nieuwe.' };

    const seconden = Math.max(0, (Date.now() - mijn.start) / 1000);
    const uitslag = DAG[spel].keur({ geheim: dag.geheim, opgave: dag.opgave, inzending, seconden });
    if (uitslag.error) return { status: uitslag.status || 400, error: uitslag.error };
    /* Fout ingevuld is geen fout van de client: de opgave blijft staan en de
       klok loopt door, dus je kunt gewoon verder. Er is er maar EEN per dag, en
       die halverwege afkappen zou een straf zijn op een tikfout. */
    if (!uitslag.goed) return { status: 200, ok: true, goed: false };

    mijn.klaar = true;
    mijn.seconden = Math.round(seconden);
    // de puntengrens van de descriptor blijft ook hier de bovenkant: een haak
    // die zich vergist hoort geen bord om te kunnen gooien
    const p = Math.max(0, Math.min(ARCADE[spel].maxPunten, Math.floor(Number(uitslag.punten) || 0)));
    const uit = { status: 200, ok: true, goed: true, datum, seconden: mijn.seconden, punten: p };
    if (!progressieMag(mij)) {
      save();
      return Object.assign(uit, { bewaard: false, ranglijst: false, reden: GEEN_PROGRESSIE });
    }
    mijn.punten = p;
    mijn.at = nu();
    save();
    const plaats = new Map(rangschik(dag).map(([h], i) => [h, i + 1]));
    return Object.assign(uit, { bewaard: true, ranglijst: true, mee: plaats.size, plaats: plaats.get(mij) });
  }

  /* Een lid dat zich laat verwijderen. Een dagopgave is van niemand anders dan
     van de speler zelf, dus hij gaat gewoon weg -- geen anonimisering nodig
     zoals bij een uitslag, waar een tweede persoon aan hangt. */
  function dagVergeet(key) {
    for (const perSpel of Object.values(S().dagopgave || {}))
      for (const dag of Object.values(perSpel)) if (dag && dag.spelers) delete dag.spelers[key];
  }

  /* De opruiming. Neemt de tijd van de opruimlaag niet aan: een dag is een
     KALENDERDATUM en geen leeftijd in milliseconden, dus de enige vraag is of
     hij vandaag is. Alles wat dat niet is gaat weg, opgave en al. */
  function dagOpschonen() {
    const datum = vandaag();
    for (const perSpel of Object.values(S().dagopgave || {}))
      for (const d of Object.keys(perSpel)) if (d !== datum) delete perSpel[d];
  }

  return { dagStand, dagStart, dagKlaar, dagVergeet, dagOpschonen };
};

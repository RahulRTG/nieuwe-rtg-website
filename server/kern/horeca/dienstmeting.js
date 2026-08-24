/* Horeca (kern): DE DIENSTMETING -- de meetlat, met wat er werkelijk gemeten is.

   WAAROM DIT ER IS. Onderaan HORECA.md staat een meetlat met twaalf regels, en
   naast elke regel stond een LAT ("0", "structureel kleiner", "meetbaar lager")
   en nergens een getal. De laatste zin van dat document zegt het zelf: "Dit
   document is pas waar wanneer er een meting naast staat, en tot die tijd is
   het een plan."

   Dit bestand maakt de meting mogelijk. Het meet GEEN echte avond -- dat vraagt
   een zaak, een dienst en iemand die meekijkt. Het is het instrument, niet de
   uitkomst.

   EN DE HELE KUNST ZIT IN WAT HET NIET ZEGT. Van de twaalf regels zijn er maar
   een handvol werkelijk te meten uit de data die er is. De verleiding is om de
   rest op nul te zetten -- twaalf groene vinkjes staan mooi. Dat is precies wat
   grens 7 verbiedt: wat niet gemeten is, wordt niet als getal getoond. Elke
   regel draagt daarom een SOORT:

     gemeten      er staat een getal, en de rekensom staat erbij
     constructie  het getal is nul omdat de data het niet anders KAN
                  weergeven -- geen prestatie maar een eigenschap, en dat staat
                  er ook bij. Wie hier een groen vinkje van maakt, meet zijn
                  eigen ontwerp in plaats van zijn dienst.
     niet-gemeten er is geen bron voor. Met de reden erbij, zodat iemand kan
                  besluiten die bron te bouwen in plaats van te vergeten dat
                  hij ontbreekt.

   EEN DIENST ZONDER GEGEVENS GEEFT GEEN NULLEN. Nul gangen compleet is niet
   "spreiding 0" maar "niet gemeten": een lege avond is geen perfecte avond. */
'use strict';

/* De drie meetpunten die minuten uit tijdstempels rekenen, staan in
   ./dienstmeting-tijden.js -- zie de kop daar voor waarom die naad daar ligt. */
const tijden = require('./dienstmeting-tijden');

/* De regels van de meetlat, in dezelfde volgorde als HORECA.md. `lat` is wat er
   in dat document staat; die hoort hier woordelijk hetzelfde te zijn, anders
   meet dit iets anders dan wat beloofd is. */
const REGELS = [
  'verloren orders bij netwerkverlies',
  'dubbele financiële boekingen na herstel',
  'onbevestigde allergiewijzigingen',
  'kritieke AI-acties zonder geldig bewijs',
  'bedieningshandelingen per bestelling',
  'tijd tot eerste drank',
  'spreiding tussen gerechten van dezelfde gang',
  'beloofde versus werkelijke gereedtijd',
  'remakes en misroutes',
  'dubbel geclaimde uitgiftes',
  'herstelproeven offline→online',
  'statische "enterprise"-beloften'
];

module.exports = ({ horeca }) => {
  const { nu } = horeca;

  const gemeten = (naam, waarde, eenheid, rekensom) =>
    ({ naam, soort: 'gemeten', waarde, eenheid, rekensom });
  const constructie = (naam, waarom) =>
    ({ naam, soort: 'constructie', waarde: 0, eenheid: null, rekensom: waarom });
  const nietGemeten = (naam, waarom) =>
    ({ naam, soort: 'niet-gemeten', waarde: null, eenheid: null, rekensom: waarom });

  /* De rekeningen van een dag: alles wat die dag is geopend. Niet "gesloten",
     want een dienst die om 01:30 eindigt hoort bij de avond ervoor -- en de
     opening is het moment waarop de gast binnenkwam. */
  function vanDag(h, dag) {
    return Object.values(h.rekeningen || {})
      .filter((r) => String(r.geopendAt || r.at || '').slice(0, 10) === dag);
  }

  function meet(h, dag) {
    const datum = String(dag || nu().slice(0, 10)).slice(0, 10);
    const reks = vanDag(h, datum);
    const regels = [];
    for (const r of reks) for (const x of (r.regels || [])) regels.push({ rek: r, x });

    /* 1. verloren orders. De server kan dit NIET meten: een order die op een
       toestel is blijven staan, staat per definitie niet in deze data. Wat hier
       wel staat is hoeveel er offline is opgenomen EN aangekomen. */
    const offlineBonnen = reks.filter((r) => r.offline).length;
    const uit = [];
    uit.push(nietGemeten(REGELS[0],
      'Een order die op een toestel is blijven staan, staat niet in de data van de server. ' +
      'Wel aangekomen deze dag: ' + offlineBonnen + ' offline bon(nen). Wie het verlies wil meten, ' +
      'moet de toestellen zelf laten rapporteren.'));

    /* 2. dubbele boekingen. Twee rekeningen met dezelfde clientId zouden het
       bewijs zijn; de opslag maakt dat mogelijk (het is een gewoon veld), dus
       dit is een echte meting en geen constructie. */
    const perClient = {};
    let dubbel = 0;
    for (const r of Object.values(h.rekeningen || {})) {
      if (!r.clientId) continue;
      if (perClient[r.clientId]) dubbel++;
      perClient[r.clientId] = true;
    }
    uit.push(gemeten(REGELS[1], dubbel, 'rekeningen',
      'Rekeningen die dezelfde clientId dragen; offline/sync hoort er per sleutel één te maken.'));

    /* 3. onbevestigde allergiewijzigingen. De ergste vorm is een regel die de
       deur uit ging terwijl hij nog op bevestiging wachtte. */
    const doorgelopen = regels.filter((g) =>
      g.x.bevestiging === 'wacht' && (g.x.stand === 'uitgegeven' || g.x.stand === 'klaar')).length;
    const wachtNu = regels.filter((g) => g.x.bevestiging === 'wacht').length;
    uit.push(gemeten(REGELS[2], doorgelopen, 'regels',
      'Regels die klaar of uitgegeven zijn terwijl ze nog op een menselijke bevestiging wachtten. ' +
      'Op dit moment wachten er ' + wachtNu + '.'));

    /* 4. kritieke AI-acties zonder bewijs. Een bon met laag `mensbevestigt` die
       toch is uitgevoerd zonder naam erbij. */
    const bonnen = (h.rahulBonnen || []).filter((b) => String(b.at || '').slice(0, 10) === datum);
    const zonderBewijs = bonnen.filter((b) =>
      b.stand === 'uitgevoerd' && b.laag === 'mensbevestigt' && !b.bevestigdDoor).length;
    uit.push(gemeten(REGELS[3], zonderBewijs, 'actiebonnen',
      bonnen.length + ' actiebon(nen) vandaag; hiervan uitgevoerd op een laag die een mens vraagt, ' +
      'zonder naam van die mens: ' + zonderBewijs + '.'));

    /* 5. bedieningshandelingen per bestelling. Hiervoor zou geteld moeten worden
       hoe vaak iemand een scherm aanraakt, en dat gebeurt nergens -- met opzet:
       een systeem dat het gedrag van medewerkers telt, is een halve stap van een
       ranglijst (grens 5). */
    uit.push(nietGemeten(REGELS[4],
      'Er wordt nergens geteld hoe vaak iemand een scherm aanraakt, en dat blijft zo: ' +
      'een systeem dat handelingen per medewerker telt, staat een halve stap van een ranglijst.'));

    uit.push(tijden.eersteDrank(reks, REGELS[5]));
    uit.push(tijden.spreiding(reks, REGELS[6]));
    uit.push(tijden.belofte(reks, REGELS[7]));

    /* 9. remakes en misroutes. Er is geen veld dat zegt "dit gerecht is opnieuw
       gemaakt". De kassa kent derving met een soort, de horecalaag niet. */
    uit.push(nietGemeten(REGELS[8],
      'Er is geen veld dat een gerecht als opnieuw-gemaakt of verkeerd-gelopen markeert. ' +
      'De kassa kent derving met een soort; de rekening kent dat niet.'));

    /* 10. dubbel geclaimde uitgiftes. De claim woont per (rekening, gang) in
       een object -- twee claims op dezelfde gang KUNNEN daar niet in staan.
       Nul is hier dus een eigenschap van het model en geen prestatie. */
    uit.push(constructie(REGELS[9],
      'Een claim woont op rek.pas[gang]; twee claims op dezelfde gang passen daar niet in. ' +
      'De nul komt uit het model en niet uit de dienst -- wie hem als resultaat leest, meet zijn eigen ontwerp.'));

    /* 11. herstelproeven offline->online. Elke offline handeling heeft een
       uitkomst; wat telt is hoeveel er GEWEIGERD zijn -- dat is een toestel
       waarvan het beeld het verloor. */
    const hand = Object.values(h.offlineHandelingen || {})
      .filter((x) => String(x.at || '').slice(0, 10) === datum);
    uit.push(hand.length
      ? gemeten(REGELS[10], hand.filter((x) => x.stand === 'geweigerd').length, 'handelingen',
        hand.length + ' offline handeling(en) samengevoegd vandaag: ' +
        hand.filter((x) => x.stand === 'gedaan').length + ' gedaan, ' +
        hand.filter((x) => x.stand === 'al-gedaan').length + ' stond al zo, ' +
        hand.filter((x) => x.stand === 'geweigerd').length + ' geweigerd omdat het beeld verouderd was.')
      : nietGemeten(REGELS[10], 'Er is vandaag niets offline gedaan, dus er valt niets te reconciliëren.'));

    /* 12. statische beloften. Dit is geen runtime-getal maar een leesoordeel
       over dit document; een scherm dat er een nul bij zet, liegt. */
    uit.push(nietGemeten(REGELS[11],
      'Dit is geen meting maar een leesoordeel over de tekst van HORECA.md. Een scherm dat er een getal bij zet, liegt.'));

    return {
      datum, rekeningen: reks.length, regels: regels.length,
      meetpunten: uit,
      gemeten: uit.filter((x) => x.soort === 'gemeten').length,
      nietGemeten: uit.filter((x) => x.soort === 'niet-gemeten').length,
      constructie: uit.filter((x) => x.soort === 'constructie').length
    };
  }

  return { meet, REGELS };
};

/* ============================================================================
   MUTATIECONTRACTEN -- DE VIER CSV-UITVOEREN, EN WAAROM GEEN VAN DRIE METERS
   ZE ZAG.

   Deel van ./mutatiecontracten.js.

   Deze vier stonden op LEGACY met twee keer `ongemeten`, en dat is geen
   toevalligheid maar een VORM: een CSV-uitvoer antwoordt streamend
   (res.setHeader + res.write + res.end). De effectmeter hangt aan res.end en
   heeft dan de koppen al de deur uit -- de kop van server/effectmeter.js schrijft
   die grens met zoveel woorden op, en zegt erbij dat hij niet te repareren is
   zonder de uitvoer zelf te verbouwen. Een streamend antwoord komt dus binnen
   als `ongemeten` en niet als `geen effect`, en dat verschil is met opzet
   bewaard.

   De handlers zijn daarom gelezen, en ze doen alle vier hetzelfde: bezit
   controleren, lezen uit de opslag, en regel voor regel wegschrijven naar de
   verbinding. Geen van vier raakt de opslag aan.

   EEN VALSE TEGENSPRAAK, EXPLICIET WEERSPROKEN. De statische analyse meldde bij
   /api/supplier/rides.csv dat server/routes/supplier/vervoer.js een schrijfvorm
   bevat (een lijst-mutatie). Dat klopt en het is geen schrijfhandeling: de
   handler doet `.filter(...).sort(...)`, en `.filter` geeft een NIEUWE lijst
   terug -- de sortering raakt die kopie en nooit db.data.rides. De melding
   blijft hier staan in plaats van weggelaten te worden: een analyse die
   weggepoetste valse treffers niet meer noemt, is over een half jaar niet meer
   na te rekenen.
   ========================================================================== */
'use strict';

const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van de gelezen handler; de meters konden hier niet meten en de ' +
    'reden daarvoor is een bekende vorm, geen storing; niet door een mens nagelezen',
  op: '2026-08-30'
};

const uitvoer = (route, mutatieId, bestand, wat) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' },
  stand: 'NOT_APPLICABLE',
  bewijs: {
    gemeten: 'kale ronde: twee geslaagde oproepen zonder spoor in de opslag. De effectmeter kwam niet ' +
      'toe aan een uitspraak omdat het antwoord streamt (koppen al verstuurd bij res.end) -- die grens ' +
      'staat in de kop van server/effectmeter.js',
    op: '2026-08-30'
  },
  nagekeken: 'handler gelezen in ' + bestand + ': ' + wat + '. Elke aanroep in de handler is een lezing ' +
    'of een res.write; de opslag wordt niet aangeraakt',
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  uitvoer('POST /api/bank/afschrift.csv', 'bank.afschrift.csv', 'server/routes/bank.js',
    'controleert het bezit van de rekening, haalt het afschrift in blokken van 200 op en schrijft de regels weg'),
  uitvoer('POST /api/office/export.csv', 'office.export.csv', 'server/routes/office/toegang.js',
    'loopt het archief en db.data.orders langs en schrijft ze als CSV weg'),
  uitvoer('POST /api/supplier/dagrapport.csv', 'supplier.dagrapport.csv', 'server/routes/supplier/keuken.js',
    'rekent het dagrapport uit de bestaande cijfers en schrijft btw- en betaalwijzeregels weg'),
  uitvoer('POST /api/supplier/rides.csv', 'supplier.rides.csv', 'server/routes/supplier/vervoer.js',
    'filtert de afgeronde ritten van de zaak, sorteert die KOPIE en schrijft haar weg -- zie de kop van ' +
    'dit bestand voor waarom de gemelde lijst-mutatie een valse treffer is')
]);

module.exports = CONTRACTEN;

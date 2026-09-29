/* Functiecatalogus, deel "democratie" (server/functies/register): DemocratieOS
   (POLITIEK.md). Een eigen bestand omdat ./cat-leden.js op de omvangsgrens
   zit. Hij staat in FUNCTIES direct na de ledenfuncties; de volgorde beslist
   niets, want het langste pad wint (functies/toegangpad.js). */
const { LEDEN_GAST } = require('./doelgroepen');

module.exports = [
  /* DemocratieOS (POLITIEK.md, fase C4). Stond onder `member`, en die kan per
     persoon, plaats, pas en canary dicht: dan kon het bord een burger gericht
     het inbrengen van een kwestie ontzeggen. Een noodstop mag alleen UITZETTEN
     en nooit selecteren wie er nog mag spreken, dus deze functie kent alleen de
     globale schakelaar. functies/toegang.js negeert elke fijne as voor
     `alleenGlobaal`, ook een oude stand die er al lag. */
  { id: 'democratie', categorie: 'Leden (RTG-app)', naam: 'Kwesties inbrengen (DemocratieOS)', standaard: true, doelgroepen: LEDEN_GAST,
    alleenGlobaal: true,
    uitleg: 'Een burger brengt een kwestie in en volgt wat ermee gebeurt. Alleen voor iedereen tegelijk aan of uit: nooit per persoon, plaats, pas of canary.', paden: ['/api/member/democratie'] },
  /* De deur van een partij (POLITIEK.md par. 7.3): een koppeling met een eigen
     sleutel, dus een integratie en geen doelgroep met een sessie. Om dezelfde
     reden als hierboven ALLEEN GLOBAAL: een noodstop zet alle partijen tegelijk
     uit en kan er nooit een uitkiezen (DO-03, EMERGENCY_ONLY_RESTRICTS). */
  { id: 'democratie-partijen', categorie: 'Leden (RTG-app)', naam: 'Partijen plaatsen voorstellen (DemocratieOS)', standaard: true, doelgroepen: ['intern'],
    alleenGlobaal: true,
    uitleg: 'Een partij uit het register plaatst met haar eigen sleutel voorstellen bij openbare kwesties. Alleen voor alle partijen tegelijk aan of uit: nooit per partij.', paden: ['/api/democratie/partij'] },
];

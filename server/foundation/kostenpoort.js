/* DE KOSTENPOORT VAN DE RTFOUNDATION -- wie draagt de kosten van dit verzoek.

   De derde poort, naast die van de leden (opzet/diensten2.js) en die van de
   zaken (opzet/leverancierpoort.js). Alle drie doen ze hetzelfde: één keer aan
   het begin van een verzoek neerzetten wie de kosten draagt, zodat alles wat
   daarna gebeurt -- een AI-bijles, een bericht, een oefening -- bij de juiste
   gebruiker landt zonder dat elke laag hem doorgeeft. Zie kern/kosten/haak.js.

   EEN GEZIN KRIJGT HIERVOOR NOOIT EEN REKENING. De RTFoundation is gratis voor
   elk gezin; kern/kosten/beleidkaart.js zet die stand VAST, zodat er ook geen
   schakelaar bestaat die dat kan veranderen. Wat een gezin wél ziet is wat het
   kost, en wie het betaalt. Dat is het verschil tussen gratis en onzichtbaar.

   DE GEZINSCODE KOMT UIT HET LICHAAM van het verzoek, want dat is waar de
   foundation-routes hem dragen (./gezinshulp.js: gezinVan). Hij wordt getoetst
   op BESTAAN -- anders zou een verzonnen code een rij in de meter aanmaken en
   kon iemand de boekhouding laten groeien met verzinsels.

   WAT HIJ NIET DOET is de sessie controleren. Dat gebeurt in de route zelf, een
   paar regels later, en dat hoort daar ook: een poort die twee dingen bewaakt
   wordt op een dag voor het verkeerde vertrouwd. Een verzoek dat daar wordt
   afgewezen heeft ons dan al rekenkracht gekost, dus het telt. En omdat een
   gezin nooit een rekening krijgt, kan een verkeerd toegeschreven verzoek hier
   hooguit een cijfer op een scherm vertekenen -- nooit een factuur.

   GEEN CODE IN HET VERZOEK: dan het huis, en niet het laatste gezin dat
   langskwam. Verbruik zonder eigenaar is een echte post en geen afrondingsfout. */
'use strict';

const kostenhaak = require('../kern/kosten/haak');

module.exports = ({ db }) => function kostenpoort(req, res, next) {
  const code = String((req.body && req.body.code) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
  const gezinnen = (db.data.foundation && db.data.foundation.gezinnen) || {};
  if (!code || !gezinnen[code]) return next();
  const drager = kostenhaak.drager('gezin', code);
  kostenhaak.meld('verzoek', 1, { drager, pas: 'gezin' });
  kostenhaak.binnen(drager, next, 'gezin');
};

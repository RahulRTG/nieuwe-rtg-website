/* RTG Link: DE BON -- wat er gebeurd is, in de woorden van degene die het deed.

   LINK.md par. 4 stap 1 en par. 3.6. Een handeling via een code verdwijnt anders
   in de lucht: je scant iemand, er gaat een verzoek uit, en drie weken later weet
   je niet meer wie er via je pin binnenkwam of wanneer. De bon is het antwoord op
   "wat heb ik hiermee gedaan" -- en later, als er intrekbare dingen op deze laag
   staan, het aanknopingspunt van "mijn koppelingen".

   DRIE DINGEN DIE EEN BON NIET IS:

   1. Geen logboek van kijken. Er wordt alleen geschreven als er echt IETS is
      gebeurd -- een verzoek de deur uit, een code verzilverd. Een bon per scan
      zou een bewegingsregister zijn van iedereen die je ooit tegenkwam, en dat
      is precies het soort stille verzameling waar LINK.md par. 3.8 en LIFE.md
      par. 4 tegen zijn.
   2. Geen tweede waarheid. De bon zegt DAT er een verzoek uitging; of dat verzoek
      is geaccepteerd blijft in db.data.connections staan, en wordt daar gelezen.
      Een bon die de status meeschrijft, loopt er binnen een week naast.
   3. Niet uitwisbaar. Intrekken sluit een deur; het wist niet dat hij open is
      geweest. Dezelfde afspraak als bij kern/toestellen.js.

   WIE HEM SCHRIJFT: degene die de handeling BEVESTIGT. Vandaag is dat de route
   (server/routes/social/pin.js), want daar wordt het verzoek verstuurd. Zodra
   handelingen op deze laag zelf komen te staan, verhuist de aanroep mee -- de bon
   hoort naast de daad, niet in een tweede boekhouding erlangs.

   DE STAART WORDT GETELD EN NIET STILGEZWEGEN. Per mens bewaren we de laatste
   MAX bonnen; wat eraf valt wordt geteld en meegegeven. Een lijst die stil
   afkapt, leest als "dit is alles" terwijl het dat niet is (LAT.md regel 5). */
'use strict';

const MAX = 200;

module.exports = ({ db, save, nu }) => {

const klok = typeof nu === 'function' ? nu : () => Date.now();

function boek() {
  if (!db.data.linkBonnen || typeof db.data.linkBonnen !== 'object') db.data.linkBonnen = {};
  return db.data.linkBonnen;
}
/* De teller van wat er van de staart af viel staat in een EIGEN kaart en niet als
   `handle + ':weg'` in dezelfde: handles bevatten dubbele punten (rtf:...), dus
   dat is een sleutel die op een dag een echte handle kan zijn. */
function afgevallen() {
  if (!db.data.linkBonnenWeg || typeof db.data.linkBonnenWeg !== 'object') db.data.linkBonnenWeg = {};
  return db.data.linkBonnenWeg;
}

/* Een bon schrijven. `wie` is de handle van degene die het deed -- de bon is van
   HEM, niet van de ander: wie zijn eigen lijst opvraagt, ziet zijn eigen daden.
   `naar` mag leeg blijven (een tafel of een kassa is geen mens). */
function bonSchrijf({ wie, type, intentie, vorm, naar }) {
  if (!wie || !intentie) return null;
  const b = boek();
  const rij = Array.isArray(b[wie]) ? b[wie] : (b[wie] = []);
  const bon = { at: new Date(klok()).toISOString(), type: type || null, intentie,
    vorm: vorm || null, naar: naar || null };
  rij.unshift(bon);
  if (rij.length > MAX) {
    const af = rij.length - MAX;
    rij.length = MAX;
    const w = afgevallen();
    w[wie] = (Number(w[wie]) || 0) + af;
  }
  save();
  return bon;
}

/* De eigen bonnen, nieuwste eerst, met hoeveel er niet meer bewaard zijn. Alleen
   je eigen: er is hier geen weg om in de lijst van een ander te kijken. */
function bonnenVan(wie) {
  const b = boek();
  return { bonnen: (Array.isArray(b[wie]) ? b[wie] : []).slice(0, MAX),
    nietBewaard: Number(afgevallen()[wie]) || 0, max: MAX };
}

return { bonSchrijf, bonnenVan, BON_MAX: MAX };
};

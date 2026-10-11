/* EERST BOEKEN, PAS BIJ EEN TEKORT BIJLADEN -- en dan met DEZELFDE sleutel.

   "EEN knop" laadde de wallet bij (zorgSaldo, ./opladen.js) en boekte daarna.
   Die volgorde breekt bij een herhaling: na een crash tussen de bevestiging
   van de motor en de JS-commit staat het saldo al afgeboekt, de retry ziet
   een tekort, en belast de kaart opnieuw -- terwijl de boeking zelf daarna
   als `herhaald` terugkomt. Een tweede financieel effect op een gebeurtenis
   die er een had. Gevonden in de review; toets: test/geld-motorsleutel.test.js
   (kill -9 en retry, nul nieuwe betalingen bij de aanbieder).

   Hier dus andersom. De sleutel wordt EEN keer gereserveerd (in motorstand
   de volgende stap van de handeling, ../../lib/idem-handeling.js), de boeking
   gaat met die sleutel, en alleen als hij weigert wegens te weinig saldo
   (402) wordt er bijgeladen en nog eens geboekt, met dezelfde sleutel. Bestaat
   de boeking al, dan herkent ./boeking.js dat VOOR de saldotoets (de motor
   kent de sleutel) en komt hij `herhaald` terug: er wordt nooit opgeladen.

   Geeft { z, b }: z zoals zorgSaldo (met `error` als bijladen mislukte), b de
   boeking. De aanroeper houdt zijn eigen volgorde: eerst z.error, dan b.error. */
'use strict';

module.exports = ({ boekAsync, zorgSaldo, reserveerSleutel }) =>
  async function betaalMetDekking({ codenaam, centen, idem, boeking }) {
    const sleutel = boeking.economischeSleutel || reserveerSleutel();
    const metSleutel = sleutel ? Object.assign({}, boeking, { economischeSleutel: sleutel }) : boeking;
    const eerst = await boekAsync(metSleutel);
    if (!eerst || eerst.status !== 402) return { z: { ok: true, bijgeladen: 0 }, b: eerst };
    const z = await zorgSaldo({ codenaam, centen, idem });
    if (z.error) return { z, b: eerst };
    if (!z.bijgeladen) return { z, b: eerst };   // niets bijgeladen: de weigering blijft staan
    return { z, b: await boekAsync(metSleutel) };
  };

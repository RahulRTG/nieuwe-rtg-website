/* Lidacties (deelmodule): AFREKENEN -- de ene plek waar een lidtransactie geld
   wordt.

   Drie paden rekenen af met een zaak: een bestelling (./betalen.js), een
   lopende rekening (./rekening.js) en een rit (./ritten.js). Ze deden alle drie
   hetzelfde: `paid = true` zetten en verder niets. Nu ze echt betalen, doen ze
   ook alle drie dezelfde drie dingen -- euro's naar centen, de driehoek naar
   kern/pay/zaakbetaling.js, en het tegoed teruggeven als het misgaat -- en dat
   hoort op EEN plek te staan en niet drie keer.

   DE OMREKENING GEBEURT HIER EN NERGENS ANDERS. De handelslaag rekent in
   EURO'S (o.total, r.quote en de bonnen zijn euro-getallen met een komma), de
   geldlaag in CENTEN. Dat is een naad waar een factor honderd doorheen kan
   glippen, en die naad hoort er dus maar een te zijn.

   HET TEGOED WORDT HIER TERUGGEGEVEN. pasTegoedToe() trekt het puntentegoed af
   VOORDAT er betaald is -- dat moet, want het bepaalt hoeveel het lid nog zelf
   betaalt. Gaat de betaling daarna niet door, dan is het tegoed weg zonder dat
   er iets voor is gekocht. Twee gevallen doen dat:

   1. de betaling MISLUKT -- dan is er niets gebeurd en hoort het tegoed terug;
   2. de betaling is een HERHALING (dezelfde idem-sleutel, het geld ging al bij
      een eerdere poging over). Dan is het tegoed van DIE poging al verrekend en
      is deze aftrek er een te veel. Dit is het gemene geval: het antwoord is
      `ok`, dus wie alleen op `.error` kijkt, ziet het niet -- en het lid raakt
      stil tegoed kwijt bij precies de retry waar idempotentie voor bestaat.

   Krijgt dezelfde gedeelde context als de drie aanroepers. */
module.exports = (ctx) => {
  const { pay, liveCodename, herstelTegoed } = ctx;

  async function rekenAf({ session, supplierCode, supplierNaam, bedrag, fooi, korting, voordeel, soort, ref, idem }) {
    const eur = x => Number(x) || 0;
    /* De zaak ontvangt het VOLLE bedrag inclusief fooi; wat RTG weggeeft
       (punten-tegoed en ledenvoordeel) legt RTG erbovenop. De fooi loopt bewust
       mee naar de partnerrekening: hij is voor het team, en het team wordt
       betaald door de zaak -- een eigen fooi-rekening zou een begrip toevoegen
       dat dit huis niet kent. Op de FACTUUR staat hij niet, want daar is hij
       geen omzet; zie de kop van ./factuur.js. */
    const bruto = Math.round((eur(bedrag) + eur(fooi)) * 100);
    const bij = Math.round((eur(korting) + eur(voordeel)) * 100);
    const zelf = Math.max(0, bruto - bij);

    const r = await pay.betaalZaak({
      codenaam: liveCodename(session), supplierCode,
      centen: zelf, bijlageCenten: bij, soort,
      oms: (soort === 'rit' ? 'Rit met ' : soort === 'rekening' ? 'Rekening bij ' : 'Bestelling bij ') + (supplierNaam || supplierCode),
      ref, idem
    });
    if (r.error) { herstelTegoed(session.key, korting); return r; }
    if (r.herhaald) herstelTegoed(session.key, korting);
    return r;
  }

  return { rekenAf };
};

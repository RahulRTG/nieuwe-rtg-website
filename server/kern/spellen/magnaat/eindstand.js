/* Magnaat: DE EINDSTAND -- waarop er wordt afgerekend, en waarop niet.

   Afgesplitst van ./weergave.js. Dat bestand gaat over WIE WAT ZIET tijdens de
   partij; dit over hoe de partij AFLOOPT. Twee onderwerpen die alleen een
   bestand deelden, en het tweede is af terwijl het eerste met elke laag meegroeit.

   DE WINNAAR IS HET HOOGSTE VERMOGEN -- geld plus wat je gebouwd hebt, minus wat
   je geleend hebt. Wie alles in zijn zaken heeft zitten hoort niet te verliezen
   van wie niets deed, en wie zijn vermogen bij elkaar geleend heeft evenmin.

   DE ANDERE DIMENSIES -- banen, reputatie, omzet -- staan op de eindstand en
   tellen NIET mee voor de winst. Ze laten zien wat voor ondernemer je was; er een
   tweede ranglijst van maken zou betekenen dat je op zes assen tegelijk aan het
   optimaliseren bent.

   WIE IS UITGESTAPT STAAT EROP EN DINGT NIET MEE (fase C, ./uitstap.js). Dat is
   EEN regel met twee helften, en ze zijn allebei nodig.

     HIJ DINGT NIET MEE, want anders wint iemand die in maand zes vertrok een
     campagne waar vier anderen nog dertig maanden in hebben gestopt.
     HIJ STAAT EROP, want deze lijst is niet alleen de ranglijst maar ook het
     antwoord op "hoeveel is er aan tafel". Zijn kas bestaat nog; hij speelt er
     alleen niet meer mee. Wie hem eruit filtert laat vermogen VERDWIJNEN op het
     moment dat iemand vertrekt -- en dat is een geldpomp, alleen de verkeerde
     kant op. De keuring in scripts/magnaat-pomp.js zag het meteen: een
     overdracht tegen boekwaarde, waarbij aan tafel geen euro van eigenaar
     hoorde te veranderen, mat -31,75%.

   Het onderscheid draagt de RIJ, in `uit`. Wie de winnaar zoekt filtert daarop
   (./economie.js); wie het wereldvermogen optelt niet. Zo is er EEN antwoord op
   "wat is iedereen waard" en niet twee die uiteen kunnen lopen. */
module.exports = ({ codenaamVan, rond, waarde, eigenDeel, belangwaarde }) => {
  return function eindstand(potje) {
    const st = potje.staat;
    return potje.spelers.map(h => {
      const rij = st.vestigingen[h] || [];
      /* ALLEEN JE EIGEN DEEL, want een deelneming verplaatst waarde (./aandeel.js).
         Zou een eigenaar de hele waarde meetellen en de aandeelhouder ook zijn
         deel, dan staat dezelfde euro bij twee mensen op de eindstand en klopt
         de optelsom van de partij niet meer. */
      const ondernemingswaarde = rij.reduce((n, v) => n + waarde(v) * eigenDeel(st, v.id), 0)
        + belangwaarde(st, h);
      /* SCHULD GAAT ERAF, en dat is geen boekhoudkundige nettigheid maar een
         gat dat de geldpomp-keuring vond. Zonder deze regel telt geleend geld
         als vermogen: drie spelers die samen negen ton opnemen zetten negen ton
         op de eindstand, en op de laatste speeldag lenen is dan de goedkoopste
         manier om te winnen. Wat je van de bank hebt, is niet van jou. */
      const schuld = (st.leningen || [])
        .filter(l => l.speler === h && l.status === 'loopt')
        .reduce((n, l) => n + l.restant, 0);
      const banen = rij.reduce((n, v) => n + v.personeel, 0);
      const reputatie = rij.length ? Math.round(rij.reduce((n, v) => n + v.reputatie, 0) / rij.length) : 0;
      const omzet = rij.reduce((n, v) => n + (v.omzetTotaal || 0), 0);
      /* De opvolger onder zijn CODENAAM, want de eindstand gaat naar iedereen
         aan tafel en een handle hoort daar niet in te staan (CLAUDE.md). */
      const weg = (st.uit || {})[h];
      return {
        codenaam: codenaamVan(h),
        geld: rond(st.geld[h]), waarde: rond(ondernemingswaarde), schuld: rond(schuld),
        vermogen: rond(st.geld[h] + ondernemingswaarde - schuld),
        vestigingen: rij.length, banen, reputatie, omzet: rond(omzet),
        uit: weg ? { maand: weg.maand, naar: weg.naar ? codenaamVan(weg.naar) : null } : null
      };
      /* Wie nog meedoet staat boven wie vertrok, en binnen die twee groepen het
         hoogste vermogen eerst. Zonder de eerste sleutel staat een vertrekker
         met een volle kas bovenaan een lijst waar hij niet aan meedeed. */
    }).sort((a, b) => (a.uit ? 1 : 0) - (b.uit ? 1 : 0) || b.vermogen - a.vermogen);
  };
};

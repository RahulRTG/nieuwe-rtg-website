/* Magnaat: DE LASTEN VAN EEN SPELER -- wat er na de zaken nog van de kas afgaat.

   Afgesplitst van ./maand.js op een naad die met elke fase duidelijker werd. Dat
   bestand rekent de maand van de WERELD: de concurrentiedruk, wat de contracten
   vastleggen, en dan iedere vestiging op dezelfde begintoestand. Dit bestand
   gaat over de vier posten die daarna komen en die niet aan een pand hangen maar
   aan de SPELER: rood staan, de leningen, de polissen, het onderzoek en de
   AI-manager.

   ZE HOREN BIJ ELKAAR OM EEN REDEN DIE VERDER GAAT DAN DE MAAT VAN HET BESTAND.
   Het zijn de posten waarbij geld de WERELD verlaat in plaats van naar een
   andere speler te gaan -- rente, premie, schade, onderzoek, beheer. Precies daarvoor
   kent scripts/magnaat-pomp.js een eigen categorie (`lekkend`): bij die posten
   is de eis niet dat het totaal gelijk blijft maar dat het verschil NA aftrek
   van het lek exact nul is. Wie hier een vijfde post bij zet, hoort daar een
   teller voor mee te geven; staat hij er niet in, dan keurt de geldpompmeter de
   wereld af omdat er geld verdwijnt dat niemand heeft opgeteld. Dat is de hele
   reden dat deze vier op EEN plek staan en niet verspreid door de maandloop.

   De volgorde is niet vrij: rood staan gaat voor de leningen, want een negatieve
   kas is de duurste vorm van krediet en hoort niet weggepoetst te worden door
   een aflossing die er in dezelfde maand nog overheen komt. Het beheer sluit de
   rij: die heeft aan het begin van de maand al gehandeld. */
const rond = (n) => Math.round(n);

module.exports = ({ ROOD_RENTE, bank, verzekering, rnd, beheer }) => {
  /* Alle vier de posten voor EEN speler. Duwt zijn regels achter op `regels` --
     dezelfde lijst die het maandoverzicht toont -- en geeft terug wat er van elke
     soort de wereld verlaten heeft. */
  function lasten(potje, h, regels) {
    const st = potje.staat;
    const uit = { rente: 0, premie: 0, schade: 0, onderzoek: 0, onderzoekUitPot: 0, beheer: 0 };

    /* ROOD STAAN KOST GELD, en dit IS de rekening-courant uit ./bank.js: de
       kredietlijn die er altijd is, het duurst en zonder aanvraag. Zonder dit
       is overinvesteren gratis -- je kas gaat onder nul en er gebeurt niets.

       Hij staat hier en niet bij de leningen omdat hij geen lening is die je
       AANGAAT: hij ontstaat doordat je uitgeeft wat je niet hebt. */
    if (st.geld[h] < 0) {
      const rente = -st.geld[h] * ROOD_RENTE;
      st.geld[h] -= rente;
      uit.rente += rente;
      regels.push({ id: 'rood', naam: 'Rood staan', rente: rond(rente), resultaat: -rond(rente) });
    }

    /* DE LENINGEN. Rente over het restant, dan de aflossing, dan de convenanten
       -- in die volgorde, want een aflossing verlaagt het restant en zou anders
       de rente van diezelfde maand drukken. Zie ./bank.js.

       RENTE VERLAAT DE WERELD. Dit was de eerste post in dit spel waar geld niet
       naar een andere speler gaat maar echt weg is. */
    const bankregels = bank ? bank.maandVoorSpeler(st, h) : null;
    if (bankregels && bankregels.regels.length) {
      uit.rente += bankregels.rente;
      for (const r of bankregels.regels) regels.push(r);
    }

    /* DE VERZEKERINGEN. Premie eruit, schade eruit, uitkering erin -- en de
       eerste twee verlaten de wereld terwijl de derde alleen herstelt. Zie
       ./verzekering.js en de categorieen in scripts/magnaat-pomp.js. */
    const verz = verzekering ? verzekering.maandVoorSpeler(potje, h) : null;
    if (verz && verz.regels.length) {
      uit.premie += verz.premie;
      uit.schade += verz.schade - verz.uitgekeerd;
      for (const r of verz.regels) regels.push(r);
    }

    /* HET ONDERZOEK. Wat een speler er zelf in stopt is vernietigend op korte
       termijn -- het is weg, en pas later komt er productiviteit voor terug.
       Wat de Foundation meebetaalt is een OVERDRACHT uit de pot en dus geen
       schepping: die pot telt mee in het totaal. Zie ./onderzoek-acties.js.

       ALLE onderzoeksuitgaven verlaten de wereld, ook het deel dat de Foundation
       meebetaalt: dat geld wordt OPGEMAAKT aan onderzoek en komt bij niemand
       terecht. Het onderscheid tussen eigen zak en pot blijft apart staan, want
       dat is het label dat telt bij de vraag "is dit een bedrijfsprestatie of een
       injectie" -- maar voor de boekhouding van de wereld zijn ze allebei weg. */
    const werk = rnd ? rnd.maandVoorSpeler(potje, h) : null;
    if (werk && werk.regels.length) {
      uit.onderzoek += werk.uitEigenZak + werk.uitPot;
      uit.onderzoekUitPot += werk.uitPot;
      for (const r of werk.regels) regels.push(r);
    }
    /* HET BEHEER. Een AI-manager is een dienst van buiten de tafel: wat hij
       kost gaat de wereld uit, net als rente en premie. Zonder deze post is
       delegeren strikt beter dan opletten en speelt het spel zichzelf.

       HIJ STAAT ACHTERAAN, en dat is geen willekeur: de manager heeft aan het
       begin van deze maand zijn besluiten al genomen (../magnaat/maand.js) en
       zijn rekening hoort daarna. */
    const bh = beheer ? beheer.maandVoorSpeler(potje, h) : null;
    if (bh && bh.regels.length) {
      uit.beheer += bh.kosten;
      for (const r of bh.regels) regels.push(r);
    }
    return uit;
  }

  return { lasten };
};

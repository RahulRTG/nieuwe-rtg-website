/* DE REGELVORM VAN DE REISWERELD (hoort bij kern/reiswereld.js).

   De ene vorm waarin elke bron zijn rij aanlevert. Afgeknipt van reiswereld.js
   op de naad tussen 'hoe ziet een rij eruit' en 'wat doet de wereld ermee'
   (sorteren, oordelen, tellen); die tweede vraag blijft daar. Het WOORDENBOEK
   -- wat een status betekent -- blijft ook daar: welke statussen deze wereld
   kent, weet alleen deze wereld, en test/wereldkern.test.js houdt dat vast. De
   wereld haalt het door de poort (betekenisVan) en geeft de uitkomst hier af. */
'use strict';

module.exports = function maakRegel({ betekenis }) {
  const dag = (d) => String(d || '').slice(0, 10);


  const regel = (soort, o) => {
    const st = String(o.status || '').toLowerCase();
    const b = betekenis(st);
    return {
      soort, titel: o.titel || '', bestemming: o.bestemming || '',
      /* WAAR HET VANDAAN KOMT (REIZEN.md par. 2.2). De bron weet dit en de
         lagen erboven niet, dus wordt het hier meegegeven en nergens geraden:
         een verblijf staat bij een partner, een reis en een vlucht zijn van
         RTG zelf. Wat het WOORD mag zijn, bewaakt kern/reizen.js -- een regel
         zonder geldige herkomst wordt daar niet geplaatst maar losgelegd. */
      herkomst: o.herkomst || '',
      van: dag(o.van), tot: dag(o.tot) || null, status: o.status || '',
      /* HET UUR, en alleen waar het domein er een kent. Een vlucht vertrekt om
         17:30 en een charter ook; een verblijf en een reis van het reisbureau
         hebben een dag en geen tijdstip. Dat verschil is precies wat laag 3 van
         het Command Canvas nodig heeft: op de tijdlijn hoort wat een uur heeft,
         en de rest hoort in het register. Hier een 00:00 verzinnen zou een
         hotelovernachting bovenaan uw dag zetten (CANVAS.md). */
      tijd: o.tijd || null,
      /* De wachttekst: het WOORDENBOEK zegt wat een status betekent, maar WIE
         er wacht verschilt per bron -- op een reisbureau-aanvraag wacht een
         reisadviseur, op een betaald ticket de zaak. De bron mag dat
         preciseren; het signaal en het teken blijven van het woordenboek. */
      sig: b.sig || '', teken: b.teken || '', wacht: o.wacht || b.wacht || '',
      /* Alleen meesturen wat het domein ECHT weet. Een verblijf kent geen
         reizigersaantal en een vlucht kent een stoel en geen gezelschap; daar
         een 1 neerzetten zou een getal verzinnen dat er nooit stond. Het scherm
         laat de regel dan gewoon weg. */
      personen: Number(o.personen) > 0 ? Number(o.personen) : null,
      /* DE PLEK ALS VERWIJZING, en alleen waar de bron er een KENT. `bestemming`
         hierboven is vrije tekst ("Barcelona") en daarop valt geen beweging te
         rekenen; `{ zaak: 'KIKUNOI' }` wordt door kern/mobiliteit/plekken.js
         opgelost tot een punt. Een stadsnaam naar coordinaten benaderen zou een
         marge op een gok bouwen, en daarop wordt straks een reservering verzet.
         Vandaag levert EEN van de zes bronnen hem; de rest geeft null en RTG
         Move meldt dat als onbekend (kern/move/naad.js). En `duurMin`: zonder
         duur is er geen moment waarop u weg kunt, en nul aannemen zou een
         restaurant op hetzelfde moment laten beginnen en eindigen. */
      plek: o.plek || null,
      duurMin: Number(o.duurMin) > 0 ? Number(o.duurMin) : null,
      kenmerk: o.kenmerk || '', app: o.app, link: o.link
    };
  };

  return { regel };
};

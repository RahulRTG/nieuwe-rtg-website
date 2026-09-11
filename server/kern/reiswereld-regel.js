/* DE REGELVORM VAN DE REISWERELD (hoort bij kern/reiswereld.js).

   Het woordenboek -- wat een status BETEKENT -- en de ene vorm waarin elke
   bron zijn rij aanlevert. Afgeknipt van reiswereld.js op de naad tussen
   'hoe ziet een rij eruit' en 'wat doet de wereld ermee' (sorteren, oordelen,
   tellen); die tweede vraag blijft daar. */
'use strict';

module.exports = function maakRegel({ betekenisVan }) {
  const dag = (d) => String(d || '').slice(0, 10);

  /* Elke bron levert zijn eigen vorm; dit maakt er één regel van. `app` en
     `link` wijzen naar de specialist, want daar hoort het echte werk te
     gebeuren. */
  /* Wat een status BETEKENT hoort op één plek te wonen. Zou elk scherm zelf
     beslissen dat "aangevraagd" geel is en "bevestigd" groen, dan lopen Reizen,
     Office en Command binnen een maand uit elkaar op precies de vraag waar een
     gebruiker op stuurt (LAT.md regel 4, en ONTWERP.md par. 3 en 5).

     Drie dingen per regel, en met opzet niet alleen een kleur:
       sig    -- de toestand voor de Signal Rail (gezond/aandacht/incident/actief)
       teken  -- het teken naast het woord, want kleur alleen is niet genoeg
       wacht  -- waarop gewacht wordt, als er op iets gewacht wordt

     Een status die we NIET kennen krijgt geen kleur en geen teken. Raden zou
     hier het ergst mogelijke zijn: een onbekende toestand groen kleuren is
     precies hoe je iemand een vlucht laat missen. */
  const BETEKENIS = {
    bevestigd:   { sig: 'gezond', teken: '✓' },
    geboekt:     { sig: 'gezond', teken: '✓' },
    ingecheckt:  { sig: 'gezond', teken: '✓' },
    aangevraagd: { sig: 'actief', teken: '◷', wacht: 'reisadviseur' },
    afgewezen:   { sig: 'incident', teken: '!' },
    vertraagd:   { sig: 'aandacht', teken: '!' },
    /* De twee standen van de Invoerbalie. `ingelezen` krijgt met opzet GEEN
       vinkje: een vinkje leest als "RTG bevestigt dit", en dat doet RTG hier
       niet -- het document zegt het, en van wie dat document is staat in de
       herkomst (REIZEN.md par. 4.3). En een lezing waarvan een veld onder de
       drempel bleef, is niet "waarschijnlijk goed" maar na te kijken; die vraagt
       dus aandacht in plaats van groen te staan (par. 4.4). */
    ingelezen:     { sig: 'gezond', teken: '\u25c7' },
    tecontroleren: { sig: 'aandacht', teken: '!', wacht: 'uw controle' }
  };
  /* Door de poort: betekenisVan weigert een status die een signaal noemt
     dat niet bestaat. Zonder die controle gaf een onbekend signaal stil NaN
     in de vergelijking en sorteerde de hele rij gewoon niet. */
  const betekenis = betekenisVan(BETEKENIS);

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

  return { BETEKENIS, regel };
};

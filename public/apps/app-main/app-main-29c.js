  /* ---------- de werelden aanreiken aan de bank van RTG Command ----------
     WAAR DIT VANDAAN KOMT. Hier stond de aanreiking aan shared/wereld.js: het
     beginscherm als kring om de klok, met de werelden als merken op een bezel.
     Dat beginscherm is weg -- de werktafel van RTG Command is het geworden -- en
     de klok is met hem meegegaan. De werelden niet. Ze staan nu bovenaan de
     bank, en dit blok is de plek waar ze daarheen gaan.

     De regel eromheen is niet veranderd: shared/command.js weet met opzet NIETS
     over welke werelden er zijn en welke onderdelen bij jouw pas horen. Dat
     staat hier al -- in MAPPEN, itemZichtbaar en mapNaam -- en wordt van hieruit
     doorgegeven. Wie daar ooit een eigen lijst werelden ziet ontstaan, heeft de
     fout te pakken waar LAT.md regel 4 over gaat.

     WAT ER PER WERELD MEEGAAT, en wat bewust niet. Naam, huis en teken: genoeg
     om een deur te zijn. De onderdelen gaan NIET mee. Ze horen bij de wereld en
     staan op het huis zelf (/apps/rtg.html en de andere twee dragen ze alle drie
     compleet); ze een tweede keer in de bank hangen zou een rail van veertig
     regels maken en de vraag oproepen welke van de twee lijsten de echte is.

     Ontbreekt de schil (een pagina zonder shared/command.js, een oude
     service-worker-cache), dan gebeurt er niets. Een beginscherm dat leeg blijft
     omdat een aanreiking niet aankwam is erger dan een bank zonder kopje. */

  /* Wordt aan het eind van bouw() aangeroepen, dus op precies het moment dat
     ook de tegels worden bijgewerkt. De schil vergelijkt zelf niets, maar
     opnieuw vullen kost een rij knoppen -- en het houdt de bank gelijk met een
     pas die intussen veranderd is. */
  function wereldBij() {
    if (!window.RTGCommand || !RTGCommand.werelden) return;
    RTGCommand.werelden(MAPPEN.filter(function (m) {
      return m.wereld && m.items.some(itemZichtbaar);
    }).map(function (m) {
      return {
        sleutel: m.sleutel,
        naam: mapNaam(m),
        url: m.wereld,
        /* De glyf van de wereld: hetzelfde teken als op zijn huis, uit dezelfde
           bron. Een tweede tekenset zou twee werelden geven die anders heten. */
        teken: function () { return (window.RTGGlyf && RTGGlyf.svg(m.glyf)) || null; }
      };
    }));
  }

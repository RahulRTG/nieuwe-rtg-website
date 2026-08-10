    /* Vervolg van app-main-04: de brede-schermregels van de poort. Geknipt
       omdat deel 04 met de compositieregels weer over de 10 KB-grens ging.
       De bundel plakt 04, 04a en 04b weer aaneen tot exact hetzelfde bestand;
       de knip ligt midden in een stringconcatenatie, dus deel 04 eindigt met
       een + en dit deel maakt hem af. */
      '@media (min-width:900px){' +
        '#gate .os-lock{--klokschaal:1.5;}' +
        '#gate{position:fixed;inset:0;width:100vw;max-width:none;height:100vh;' +
          'margin:0;border-radius:0;border:0;display:flex;align-items:center;' +
          'justify-content:center;flex-direction:column;}' +
        '#gate canvas:not(.ag-mond){position:absolute;inset:0;width:100vw;height:100vh;}' +
        '#gate .ag-doos{max-width:34rem;}' +
      '}';
    document.head.appendChild(st);

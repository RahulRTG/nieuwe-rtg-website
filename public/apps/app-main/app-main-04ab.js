    /* Slotstuk van de poortstijl: de brede-schermregels, en daarna pas het
       insluiten van het blad. Dit deel MOET het laatste van de reeks 04.. zijn
       dat aan de stijlstring bijdraagt, want het sluit hem af met een `;` en
       hangt hem in de kop. Alles wat na deze regel nog `'...' +` schrijft,
       staat buiten de string en doet niets.

       De brede-schermregels komen bewust NA de compositie in 04a: bij gelijke
       specificiteit wint de laatste, en op een breed scherm hoort de poort het
       hele venster te vullen in plaats van de kolompadding van 04a te houden. */
      '@media (min-width:900px){' +
        '#gate .os-lock{--klokschaal:1.5;}' +
        '#gate{position:fixed;inset:0;width:100vw;max-width:none;height:100vh;' +
          'margin:0;border-radius:0;border:0;display:flex;align-items:center;' +
          'justify-content:center;flex-direction:column;}' +
        '#gate canvas:not(.ag-mond){position:absolute;inset:0;width:100vw;height:100vh;}' +
        '#gate .ag-doos{max-width:34rem;}' +
      '}';
    document.head.appendChild(st);

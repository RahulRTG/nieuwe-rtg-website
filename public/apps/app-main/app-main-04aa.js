      /* De koekjesmelding hoort niet midden in de kennismaking. Hij zweeft
         onderaan, buiten de kolom, waar hij de compositie niet meer breekt.

         Deze regel stond er als `.rtgcookie`, een klasse die nergens bestaat.
         Het element heet `#rtg-cookie` en ligt anders met z-index 9999 over
         het enige invoerveld. De kolom houdt daarom alleen ruimte vrij zolang
         de melding er werkelijk staat. */
      'body:has(#rtg-cookie) #gate{padding-bottom:calc(6vh + 3rem);}' +

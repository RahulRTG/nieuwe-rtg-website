/* HET BASISADRES VAN DEZE PAGINA -- meer is dit niet, en dat is de bedoeling.

   Een scherm in een spelwereld is HETZELFDE scherm. Er is geen spelversie van
   personeel.html en er komt er ook geen: dat is de hele opdracht uit VERHAAL.md
   ("in het spel gebruik je de echte software"). Maar de pagina roept haar
   server aan met absolute paden -- er staan er 123 in de apps, van de vorm
   fetch('/api/...') -- en die gaan naar de root van de site.

   In een spelwereld hoort dat /spelwereld/<id>/api/... te zijn.

   DRIE WEGEN, EN DIT IS DE DERDE.

   1. De 123 aanroepen herschrijven. Dat is precies het "hele bestanden
      herschrijven" dat de werkafspraak in CLAUDE.md verbiedt, en elke gemiste
      aanroep is een STILLE schrijfactie naar de productiedatabase.
   2. Een sessievlag: de server onthoudt dat je in een wereld zit en kiest per
      verzoek. Dat is de gevaarlijkste, en VERHAAL.md grens 2 sluit hem uit --
      de scheiding moet structureel zijn en niet aan een vlag hangen. Een vlag
      is een toestand die verkeerd kan staan; dan landt een spelhandeling in
      productie, of een echte handeling in een spel.
   3. De URL draagt de wereld, en de pagina krijgt haar basisadres. Er is geen
      toestand die verkeerd kan staan: het pad IS het antwoord.

   EEN <base>-TAG KAN DIT NIET. Die werkt op relatieve URL's; een absoluut pad
   dat met / begint gaat er dwars doorheen. Daarom een omhulsel om fetch en niet
   een regel HTML.

   HIJ DOET NIETS BUITEN EEN WERELD. Staat de pagina niet onder /spelwereld/,
   dan wordt fetch niet aangeraakt -- geen omhulsel, geen kosten, geen risico.
   Dat is te zien aan de eerste regel hieronder en er is geen tweede pad. */
(function () {
  'use strict';
  var m = /^\/spelwereld\/([a-z0-9][a-z0-9-]{0,39})(\/|$)/.exec(location.pathname);
  if (!m) return;                       // gewone pagina: er verandert helemaal niets
  var basis = '/spelwereld/' + m[1];

  /* Wat er verlegd wordt: alleen paden die met /api/ beginnen. Niet alles wat
     met / begint, want dan verleggen we ook /apps/x.js en /fonts/y.woff2 -- die
     horen gewoon van de site te komen; een spelwereld heeft geen eigen
     lettertypen. Alleen de LIJN gaat om, niet de pagina. */
  function verleg(u) {
    if (typeof u !== 'string') return u;
    return u.indexOf('/api/') === 0 ? basis + u : u;
  }

  var echt = window.fetch.bind(window);
  window.fetch = function (invoer, opties) {
    if (typeof invoer === 'string') return echt(verleg(invoer), opties);
    /* Een Request-object: het adres zit erin en is niet te wijzigen, dus wordt
       er een nieuwe gemaakt met hetzelfde erin. Zonder deze tak zou een pagina
       die Request gebruikt stil op productie uitkomen -- en stil is precies wat
       hier niet mag. */
    if (invoer && typeof invoer === 'object' && typeof invoer.url === 'string') {
      var pad = invoer.url.replace(location.origin, '');
      if (pad.indexOf('/api/') === 0) return echt(new Request(basis + pad, invoer), opties);
    }
    return echt(invoer, opties);
  };

  /* Waar je bent, leesbaar voor de pagina zelf. Een scherm dat wil laten zien
     dat dit een oefenruimte is, hoort dat te kunnen weten zonder de URL te
     ontleden -- en het hoort zichtbaar te zijn, want een oefenruimte die eruit
     ziet als het echte werk is een valstrik. */
  window.RTG_SPELWERELD = { id: m[1], basis: basis };
  document.documentElement.setAttribute('data-spelwereld', m[1]);
})();

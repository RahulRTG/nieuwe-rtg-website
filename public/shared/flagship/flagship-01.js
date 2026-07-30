/* RTG Flagship: op een ruim scherm staat een kantoorpagina als een rustig,
   gecentreerd iPad-kader in het midden -- het "middelste scherm". Dat middelste
   scherm is de vaste ankerplek: je kunt het breder/smaller maken, maar niet
   wegklikken. Eromheen zet je widgets die je vrij verplaatst, van formaat
   verandert en desgewenst wegklikt. Sleep een widget met een rand vlak langs
   een andere widget of langs het middelste scherm, dan klikt hij er vanzelf
   tegenaan (magnetisch). Rustig gehouden, niet wild. Plek en maat worden
   onthouden. Op een smal scherm blijft de pagina gewoon zoals hij is.

   Aanzetten: geef <body> het attribuut data-flagship. */
(function (w, d) {
  'use strict';
  if (w.RTGFlagship) return;
  var MIN = 1180, KLEEF = 14;
  function wereld() { return d.body.getAttribute('data-oswereld') || 'kantoor'; }
  function fkey() { return 'rtg_flagship_' + wereld(); }
  function wkey() { return 'rtg_flagwidgets_' + wereld(); }

  function breed() { try { var v = +localStorage.getItem(fkey()); if (v >= 680 && v <= 1400) return v; } catch (e) {} return 940; }
  function zetBreed(v) { v = Math.max(680, Math.min(1400, Math.round(v))); try { localStorage.setItem(fkey(), v); } catch (e) {} d.documentElement.style.setProperty('--flag-breed', v + 'px'); }


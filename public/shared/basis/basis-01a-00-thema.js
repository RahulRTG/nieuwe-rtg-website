
  /* ---- 0. het thema, VOOR al het andere ---------------------------------
     De vier thema's (champagne, onyx, bordeaux, royal) hingen aan een script
     dat maar op één pagina stond. Een themakeuze die niet meereist is geen
     thema maar een instelling van dat ene scherm, dus hij hoort in de laag die
     overal ligt -- net als de bladen die hij aanstuurt (die komen mee via de
     @import bovenaan shared/rtg-ui.css).

     ZO VROEG MOGELIJK. Dit script zet een attribuut op <html> en daar hangt de
     grondkleur aan; gebeurt dat pas na het tekenen, dan zie je de oude grond
     even staan. Vandaar hier, boven de service worker, en niet in de opstart
     onderaan.

     De sleutel is rtg_thema_v2. De oude gedeelde donker/licht-eigenaar is na
     migratie van zijn laatste host verwijderd. Een pagina die nog niet om is,
     merkt niets: zonder attribuut geldt gewoon wat de UI-kit al zei. */
  if (!ds && !document.documentElement.hasAttribute('data-rtg-thema') && !document.getElementById('rtgThemasJs')) {
    var th = document.createElement('script');
    th.id = 'rtgThemasJs';
    th.src = '/shared/rtg-themas.js';
    (document.head || document.documentElement).appendChild(th);
  }

/* De metgezel: Rahul + Samen, op elke app-pagina. Een klein script dat
   zichzelf inricht naar wie er is ingelogd:
   - een RTG-lid krijgt de Rahul-knop (vraagt en doet, via /api/fluister) en
     de Samen-knop: een sessie starten of meedoen met een code, samen door
     het OS lopen ("ga mee"-seintjes via SSE) en een kamer-chat
   - een zaak (leverancier-token) krijgt de Rahul-knop via de zaak-AI
   - is er al een eigen Rahul-knop op de pagina (#rahulFab), dan laten we
     die met rust en voegen we alleen Samen toe
   - zonder inlog doet het script niets (geen knoppen, geen verkeer) */
(function () {
  // Een gastprogramma is een zelfstandige leesweergave zonder accountshell.
  if (document.body && document.body.dataset.publicPlatform === 'travel-guest') return;
  if (window.__metgezel) return; window.__metgezel = true;
  /* De metgezel hoort bij de OMGEVING, niet bij een ingebed vlak. Draait deze
     pagina in een frame -- een surface in de RTG-werkruimte, of het comm-venster
     in de personeels-PDA -- dan staat Rahul al in de omgeving eromheen, en zou
     dit script hem een tweede keer neerzetten. Met drie surfaces open stonden er
     drie chatbalken onder elkaar; dat is precies het soort dubbeling waar een
     gedeelde laag juist voor is (LAT.md regel 4). */
  try { if (window.top !== window.self) return; } catch (e) { /* andere herkomst: dan is het zeker een frame */ return; }
  /* Eén begrensde laadweg voor de vier bestaande gedeelde eigenaren. Iedere
     callsite hieronder geeft een letterlijk intern pad; de helper verzint geen
     modules en vormt dus geen tweede register of loaderarchitectuur. */
  function laadScript(path, klaar, uitgesteld) {
    var script = document.createElement('script');
    if (klaar) script.addEventListener('load', klaar, { once: true });
    script.src = path; if (uitgesteld) script.defer = true;
    document.head.appendChild(script);
  }
  /* De wauw-laag (shared/wauw.js) eerst: zachte overgangen, haptiek,
     delen, badge en wake lock. Voor de inlogcheck, zodat ook de poort
     hem heeft; net als handenvrij is het een script erbij in plaats
     van 120+ pagina's aanpassen, en zonder laag verandert er niets. */
  if (!window.RTGWauw) {
    laadScript('/shared/wauw.js', null, true);
  }
  /* DE STROOM (shared/stroom.js): pas geladen als deze laag een live-stroom
     opent, en dat doet hij op bijna geen scherm. Sindsdien staat de sessie
     nooit meer in het adres van zo'n stroom. Een script erbij, net als de
     wauw-laag hierboven, in plaats van bijna driehonderd pagina's aanpassen. */
  function metStroom(doe) {
    if (window.RTGStroom) return doe(window.RTGStroom);
    var s = document.querySelector('script[src="/shared/stroom.js"]');
    var klaar = function () { if (window.RTGStroom) doe(window.RTGStroom); };
    if (s) s.addEventListener('load', klaar, { once: true });
    else laadScript('/shared/stroom.js', klaar, false);
  }
  var memTok = null, supTok = null;
  try { memTok = localStorage.getItem('rtg_member_token'); } catch (e) {}
  try { supTok = localStorage.getItem('rtg_sup_token'); } catch (e) {}
  if (!memTok && !supTok) return;
  if (!window.__rahulTabStandaard) {
    laadScript('/shared/rahul-tab.js?v=command7', null, true);
  }

  /* De muisvrije laag erbij (shared/handenvrij.js): de stuurbalk waar je in typt
     of tegen praat, met navigatie zonder tik. Hij hangt hier omdat de metgezel
     al op elke app-pagina staat en al weet dat er iemand is ingelogd; zo is het
     een script erbij in plaats van 150+ pagina's aanpassen. Lukt het laden niet,
     dan verandert er niets: alle knoppen blijven gewoon staan. */
  (function () {
    if (window.__handenvrij) return;
    laadScript('/shared/handenvrij.js', null, true);
  })();

  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

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
  /* De wauw-laag (shared/wauw.js) eerst: zachte overgangen, haptiek,
     delen, badge en wake lock. Voor de inlogcheck, zodat ook de poort
     hem heeft; net als handenvrij is het een script erbij in plaats
     van 120+ pagina's aanpassen, en zonder laag verandert er niets. */
  if (!window.RTGWauw) {
    var wauwS = document.createElement('script');
    wauwS.src = '/shared/wauw.js'; wauwS.defer = true;
    document.head.appendChild(wauwS);
  }
  var memTok = null, supTok = null;
  try { memTok = localStorage.getItem('rtg_member_token'); } catch (e) {}
  try { supTok = localStorage.getItem('rtg_sup_token'); } catch (e) {}
  if (!memTok && !supTok) return;
  if (!window.__rahulTabStandaard) {
    var rahulTabScript = document.createElement('script');
    rahulTabScript.src = '/shared/rahul-tab.js?v=command7'; rahulTabScript.defer = true;
    document.head.appendChild(rahulTabScript);
  }

  /* De muisvrije laag erbij (shared/handenvrij.js): de stuurbalk waar je in typt
     of tegen praat, met navigatie zonder tik. Hij hangt hier omdat de metgezel
     al op elke app-pagina staat en al weet dat er iemand is ingelogd; zo is het
     een script erbij in plaats van 150+ pagina's aanpassen. Lukt het laden niet,
     dan verandert er niets: alle knoppen blijven gewoon staan. */
  (function () {
    if (window.__handenvrij) return;
    var s = document.createElement('script');
    s.src = '/shared/handenvrij.js'; s.defer = true;
    document.head.appendChild(s);
  })();

  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };


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
  if (window.__metgezel) return; window.__metgezel = true;
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

  /* DE BALK VAN RAHUL: een vorm, op elk scherm.

     Hiervoor waren er drie manieren om bij Rahul te komen en geen daarvan
     stond er gewoon: een zwevende pil die overal was weggehaald ("te druk in
     beeld"), een veeg vanaf de onderrand die je moest kennen, en op het
     beginscherm een chatbalk die alleen daar stond. Nu is er een balk, overal
     dezelfde, met de lippen als gezicht -- de vorm van het beginscherm, want
     die was de goede.

     Klein of groot bepaal je zelf: ingeklapt is hij alleen de lippen, en een
     tik maakt hem weer een balk. Die keuze blijft bewaard (localStorage), want
     hij hoort bij hoe JIJ werkt en niet bij de pagina waar je toevallig bent.
     Zo is Rahul overal, zonder in de weg te staan. */
  /* GEINTEGREERD, NIET ZWEVEND. Rahul stond hier als een venster over de
     pagina heen: je las iets, hij ging er half overheen, en je moest hem eerst
     wegklikken. Dat is precies wat het beginscherm en de inlogpoort NIET doen
     -- daar hoort hij bij het scherm.

     Daarom staat het blok onderaan vast, maar reserveert de pagina er ruimte
     voor: de hoogte van het blok gaat als --rtg-rahul-h naar de body, en die
     krijgt evenveel padding onderaan. Groeit het blok (er komt een antwoord),
     dan schuift de inhoud mee omhoog in plaats van eronder te verdwijnen. Zo
     staat hij nergens overheen, ook niet onderaan een lange pagina.

     Klap je hem klein, dan krimpt de gereserveerde ruimte mee: de lippen
     alleen kosten bijna niets. */
  var css = '.mgz-blok{position:fixed;left:50%;transform:translateX(-50%);z-index:9980;' +
      'bottom:calc(env(safe-area-inset-bottom,0px) + .9rem);width:min(30rem,calc(100vw - 1.6rem));' +
      'display:flex;flex-direction:column;align-items:center;gap:.5rem;pointer-events:none;}' +
    '.mgz-blok > *{pointer-events:auto;}' +
    /* het tussenstuk dat de pagina onderaan ruimte geeft; zie meetRuimte() */
    '.mgz-ruimte{width:100%;flex-shrink:0;pointer-events:none;}' +
    '.mgz-blok.mgz-klein-blok{width:auto;}' +
    '.mgz-balk{width:100%;' +
      'display:flex;align-items:center;gap:.55rem;padding:.4rem .45rem .4rem .55rem;border-radius:999px;' +
      'background:color-mix(in srgb, var(--card,#151312) 62%, transparent);' +
      'backdrop-filter:blur(26px) saturate(1.5);-webkit-backdrop-filter:blur(26px) saturate(1.5);' +
      'border:1px solid var(--line,#2A2724);box-shadow:0 12px 34px rgba(0,0,0,.42);' +
      'transition:width .22s cubic-bezier(.22,.61,.21,1),padding .22s cubic-bezier(.22,.61,.21,1);}' +
    '.mgz-balk:focus-within{border-color:color-mix(in srgb, var(--gold,#857007) 62%, var(--line,#2A2724));}' +
    /* ingeklapt: alleen de lippen, en de balk krimpt eromheen */
    '.mgz-balk.mgz-klein{width:auto;padding:.3rem;gap:0;}' +
    '.mgz-balk.mgz-klein input,.mgz-balk.mgz-klein .mgz-balkgo{display:none;}' +
    '.mgz-orb{width:2.4rem;height:2.4rem;flex-shrink:0;border-radius:50%;overflow:hidden;border:none;padding:0;' +
      'display:flex;align-items:center;justify-content:center;cursor:pointer;' +
      'background:radial-gradient(80% 80% at 50% 30%, #2A241A, #14110D);' +
      'box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--gold,#857007) 45%, transparent);}' +
    '.mgz-orb canvas{width:170%;height:auto;display:block;pointer-events:none;filter:brightness(1.3) saturate(1.08);}' +
    '.mgz-balk input{flex:1;min-width:0;background:none;border:none;outline:none;color:var(--txt,#F7F5F1);' +
      "font-family:Inter,system-ui,sans-serif;font-size:.86rem;padding:.4rem 0;}" +
    '.mgz-balk input::placeholder{color:var(--soft,#8A8680);}' +
    '.mgz-balkgo{flex-shrink:0;width:2.2rem;height:2.2rem;border-radius:50%;border:none;cursor:pointer;' +
      'background:var(--gold,#857007);color:#1C1608;display:flex;align-items:center;justify-content:center;font-weight:700;}' +
    '.mgz-balkgo:active{opacity:.85;}' +
    '@media print{.mgz-balk{display:none;}}' +
    '@media (prefers-reduced-motion: reduce){.mgz-balk{transition:none;}}' +
    '.mgz-knop{position:fixed;right:1rem;z-index:9980;border:none;border-radius:999px;padding:.65rem 1rem;font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:.83rem;cursor:grab;touch-action:none;box-shadow:0 6px 20px rgba(0,0,0,.4);}' +
    '.mgz-knop.mgz-sleept{cursor:grabbing;opacity:.9;box-shadow:0 12px 34px rgba(0,0,0,.55);}' +
    '.mgz-rahul{bottom:1rem;background:var(--gold,#857007);color:#000;}' +
    '.mgz-samen{bottom:3.6rem;background:#151312;color:#eee;border:1px solid var(--gold,#857007);}' +
    /* het antwoord hoort bij de balk, niet ergens in de hoek: zelfde breedte,
       eronder vastgeplakt, en het scrollt intern als Rahul veel zegt */
    '.mgz-sheet{position:static;width:100%;max-height:min(42vh,22rem);overflow:auto;background:#151312;border:1px solid var(--gold,#857007);border-radius:16px;padding:.9rem;display:flex;flex-direction:column;gap:.6rem;box-shadow:0 10px 30px rgba(0,0,0,.5);color:#eee;font-family:Inter,system-ui,sans-serif;}' +
    '.mgz-sheet[hidden]{display:none;}.mgz-kop{display:flex;align-items:center;justify-content:space-between;font-weight:600;cursor:move;touch-action:none;user-select:none;-webkit-user-select:none;}' +
    '.mgz-sheet.mgz-sleept{opacity:.96;box-shadow:0 16px 44px rgba(0,0,0,.6);}' +
    '.mgz-x{background:transparent;border:1px solid #333;border-radius:8px;color:#eee;padding:.15rem .5rem;cursor:pointer;}' +
    '.mgz-uit{font-size:.84rem;color:#bbb;line-height:1.55;max-height:40vh;overflow-y:auto;white-space:pre-wrap;}' +
    '.mgz-rij{display:flex;gap:.4rem;}.mgz-rij input{flex:1;background:#0C0C0B;border:1px solid #333;border-radius:10px;color:#eee;font:inherit;font-size:.85rem;padding:.5rem .7rem;}' +
    '.mgz-go{background:var(--gold,#857007);color:#000;border:none;border-radius:10px;padding:.5rem .9rem;font-weight:700;cursor:pointer;}' +
    '.mgz-stil{background:transparent;color:#eee;border:1px solid #444;border-radius:10px;padding:.5rem .8rem;font:inherit;font-size:.83rem;cursor:pointer;}' +
    '.mgz-banner{position:fixed;left:50%;transform:translateX(-50%);bottom:6.4rem;z-index:9982;background:#0C0C0B;border:1px solid var(--gold,#857007);border-radius:12px;padding:.6rem .9rem;font-family:Inter,system-ui,sans-serif;font-size:.84rem;color:#eee;display:flex;gap:.6rem;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:92vw;}' +
    '.mgz-code{font-family:ui-monospace,monospace;letter-spacing:.2em;color:var(--gold,#857007);font-weight:700;}' +
    '.mgz-chat{font-size:.82rem;color:#bbb;max-height:26vh;overflow-y:auto;line-height:1.5;}' +
    /* de melding-staat: de lippen verkleuren (gouden gloed die ademt) en er
       komt een klein bordeaux teken met het aantal; tikken opent de melding */
    '.mgz-rahul.mgz-meld{background:#0C0C0B;border:1px solid var(--gold,#857007);animation:mgzPuls 1.8s ease-in-out infinite;}' +
    '@keyframes mgzPuls{0%,100%{box-shadow:0 6px 20px rgba(0,0,0,.4),0 0 0 0 rgba(158,28,64,.55);}50%{box-shadow:0 6px 20px rgba(0,0,0,.4),0 0 14px 5px rgba(158,28,64,.55);}}' +
    '@media (prefers-reduced-motion: reduce){.mgz-rahul.mgz-meld{animation:none;box-shadow:0 6px 20px rgba(0,0,0,.4),0 0 12px 4px rgba(158,28,64,.5);}}' +
    '.mgz-stip{position:absolute;top:-4px;right:-4px;min-width:1.05rem;height:1.05rem;padding:0 .25rem;border-radius:999px;background:#9E1C40;color:#fff;font-size:.66rem;font-weight:700;line-height:1.05rem;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.5);}' +
    '.mgz-seintjes{display:flex;flex-direction:column;gap:.4rem;}' +
    '.mgz-seintje{background:#0C0C0B;border:1px solid var(--gold,#857007);border-radius:12px;padding:.5rem .7rem;font-size:.82rem;color:#eee;line-height:1.45;cursor:pointer;text-align:left;width:100%;}' +
    '.mgz-seintje:hover{border-color:#C23A5E;}.mgz-seintje b{color:var(--gold,#857007);display:block;font-size:.72rem;letter-spacing:.04em;text-transform:uppercase;margin-bottom:.15rem;}' +
    /* de lege-toestand-knop: overal waar nog niets staat, kan Rahul het regelen */
    '.rahul-leeg-knop{display:inline-flex;align-items:center;gap:.4rem;background:transparent;border:1px solid var(--gold,#857007);color:var(--gold,#857007);border-radius:999px;padding:.5rem .9rem;font-family:Inter,system-ui,sans-serif;font-size:.83rem;font-weight:600;cursor:pointer;}' +

  /* De opbouw van het beginscherm: het vangnet, de melding als er iets leeg
     blijft, en de volgorde eerst-beeld-dan-gegevens. Apart deel omdat
     app-main-12.js hiermee op 11,5 KB kwam en keuringsregel 13 op 10 staat --
     en de regel heeft gelijk over de reden: de rest van dat deel is de schil
     van de app (meldingen, tabbladen), dit gaat over hoe het scherm ontstaat. */
  /* WAT ER MISGING, OP HET SCHERM ZELF.

     Een gebruiker met een half leeg beginscherm hoort niet de console te
     hoeven openen om te weten wat er speelt -- en wij horen niet te moeten
     raden. Deze regel verschijnt alleen als er echt iets omviel: een rustige
     mededeling onderaan met de naam van het onderdeel, en verder niets. Geen
     stacktrace, geen alarm; wie het niet interesseert leest er gewoon
     overheen, en wie het meldt kan het letterlijk overtypen. */
  let leegGemeld = false;
  function meldLeegScherm(wat) {
    if (leegGemeld) return;
    leegGemeld = true;
    try {
      const el = document.createElement('div');
      el.id = 'rtgOnderdeelStuk';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);z-index:9970;' +
        'bottom:calc(env(safe-area-inset-bottom,0px) + 8.5rem);width:min(26rem,calc(100vw - 2rem));' +
        'background:var(--card,#151312);border:1px solid var(--line,#2A2724);border-radius:0;' +
        'padding:.7rem .9rem;color:var(--muted,#8A8680);font-family:Inter,system-ui,sans-serif;' +
        'font-size:.76rem;line-height:1.5;text-align:center;';
      el.textContent = 'Een onderdeel van dit scherm laadde niet: ' + wat + '. De rest werkt gewoon.';
      document.body.appendChild(el);
    } catch (e) { /* zelfs de melding mag niets breken */ }
  }
  // de tegelbouw (app-main-26b.js) meldt hier ook, dus hij moet daar bereikbaar zijn
  window.RTGMeldStuk = meldLeegScherm;

  function stap(naam, fn) {
    try { fn(); } catch (e) {
      console.error('[rtg] onderdeel "' + naam + '" van het beginscherm ging mis:', e);
      meldLeegScherm(naam);
    }
  }

  /* EERST BEELD, DAN GEGEVENS.

     renderAll() deed alles in een adem: het beginscherm, en meteen ook de
     vijftien tabbladen erachter. Op deze machine valt dat niet op; op een
     telefoon wel. Gemeten bij een gebruiker die "hij laadt heel lang" meldde:
     203 verzoeken bij het openen, 53 scripts en een bundel van 530 KB, en
     tweeentwintig opbouwstappen voordat er ook maar iets in beeld kwam. Wat je
     dan ziet is een leeg scherm, en lang genoeg leeg voelt als kapot.

     Alleen het beginscherm heeft de gegevens nodig die er al zijn; de andere
     tabbladen kijkt niemand naar voordat hij erop tikt. Die gaan daarom NA het
     eerste beeld, een voor een, met een adempauze ertussen zodat de telefoon
     tussendoor kan tekenen en reageren. Wie meteen op een tabblad tikt vindt
     hem gewoon gevuld of even later; wie op het beginscherm blijft, ziet het
     nu meteen.

     De volgorde is niet willekeurig: wat op het beginscherm zichtbaar is gaat
     voor, daarna de rest. */
  function naBeeld(stappen) {
    let i = 0;
    const volgende = () => {
      if (i >= stappen.length) return;
      const [naam, fn] = stappen[i++];
      stap(naam, fn);
      // een adempauze: de telefoon mag tussendoor tekenen en op een tik reageren
      if (window.requestIdleCallback) requestIdleCallback(volgende, { timeout: 400 });
      else setTimeout(volgende, 16);
    };
    if (window.requestIdleCallback) requestIdleCallback(volgende, { timeout: 400 });
    else setTimeout(volgende, 50);
  }


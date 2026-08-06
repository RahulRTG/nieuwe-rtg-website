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
        'background:var(--card,#151312);border:1px solid var(--line,#2A2724);border-radius:12px;' +
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

  function renderAll(){
    /* Ook deze aanloop liep zonder vangnet, en juist hier staan de regels die
       aannemen dat een element bestaat. Viel er een om, dan kwam de rest van
       renderAll niet eens op gang en hielp het afschermen van de stappen
       hieronder niets. */
    // gratis gebruiker (zonder pas): reizen, betalen en AI zijn voor leden
    const guest = user.tier === 'guest';
    stap('scherm-aanloop', () => {
    $('#codeChipTxt').textContent = user.codename;
    ['reizen','betalen','ai','assets','zorg'].forEach(t => { const b = document.querySelector('.tabbar button[data-tab="'+t+'"]'); if (b) b.style.display = guest ? 'none' : ''; });
    // het OS-beginscherm leest dit: zonder pas geen wallet-tegel en geen balk
    // van Rahul, want allebei zijn ze voor leden
    document.getElementById('app').classList.toggle('os-gast', guest);
    });
    stap('renderHome', renderHome);
    // Rahul opent het gesprek op het beginscherm zelf, met wat hij nu ziet
    stap('rahul-thuis', () => { if (!guest && window.RTGThuisRahul) RTGThuisRahul.opent(); });
    /* Terug waar je was, maar KORT. Dit venster stond op een half uur, en dat
       was te ver doorgeschoten: openTab schrijft de tijd bij elke schermwissel
       bij, dus het venster schoof steeds mee en in gewoon gebruik landde je
       vrijwel altijd weer in de app waar je was. Het beginscherm -- de tegels,
       de klok, het gezicht van het huis -- kreeg je dan nooit meer te zien.

       Waar dit voor bedoeld is, is de app die ONDER je vandaan wordt gedood:
       iOS ruimt een app in de achtergrond op, of je herlaadt per ongeluk, en
       dan hoor je niet je plek kwijt te raken. Dat gebeurt binnen seconden,
       niet binnen een half uur. Twee minuten dekt dat ruim, en alles wat
       later komt is een NIEUWE keer openen -- en die begint thuis. */
    const PLEK_VENSTER = 2 * 60000;
    let beginTab = 'home';
    try {
      const b = JSON.parse(localStorage.getItem('rtg_actieve_tab') || 'null');
      if (b && b.tab && Date.now() - (b.t || 0) < PLEK_VENSTER){
        const knop = document.querySelector('.tabbar button[data-tab="' + b.tab + '"]');
        if (knop && knop.style.display !== 'none') beginTab = b.tab;
      }
    } catch(e){}
    /* De tabbladen achter het beginscherm halen hun gegevens nu pas op als je
       ze opent -- zie LADERS_PER_TAB in ./app-main-12c.js voor waarom, en wat
       er gemeten is. Hier blijven alleen de drie laders staan die aan geen
       enkel tabblad vastzitten; die gaan na het eerste beeld, een voor een. */
    naBeeld([
      ...(guest ? [] : [['laadCare', laadCare]]),
      ['laadBestellen', laadBestellen], ['loadCv', loadCv]
    ]);

    openTab(beginTab);

    /* KIJKT DE APP OF ER IETS TE ZIEN IS. Een zwart scherm meldt zichzelf niet:
       er gooit niets, alle verzoeken slagen, en toch staat er niets. Daarom
       meten we het na het opbouwen gewoon na. Is het beginscherm leeg, dan
       gaan de MATEN naar het logboek (venster, hoogtes, aantal tegels, de
       rekeneenheid) -- genoeg om een layoutstoring te plaatsen zonder dat
       iemand een console hoeft te openen. Staat er wel wat, dan gebeurt er
       niets en weet niemand hiervan. */
    setTimeout(() => {
      try {
        /* WAT STAAT ER WERKELIJK MIDDEN OP HET SCHERM?

           De eerste versie van deze controle keek of er tegels BESTONDEN, en
           dat was te nauw: bij de melder stonden ze er wel en zag hij ze toch
           niet, dus zweeg de controle precies in het geval waarvoor hij bedoeld
           was. Bestaan is niet hetzelfde als zichtbaar zijn -- inhoud kan naast
           het scherm staan, nul hoog zijn, of achter iets anders liggen.

           elementFromPoint op het midden van het venster stelt de enige vraag
           die telt: kijkt de gebruiker naar iets van de app, of naar niets? */
        const thuis = document.querySelector('.os-thuisscherm');
        const tegels = document.querySelectorAll('.os-app').length;
        const hoog = thuis ? thuis.getBoundingClientRect().height : 0;
        const midden = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2));
        const leegMidden = !midden || midden === document.body || midden === document.documentElement;
        const buitenBeeld = thuis && (() => { const b = thuis.getBoundingClientRect();
          return b.bottom <= 0 || b.top >= innerHeight || b.width < 10; })();

        let reden = null;
        if (!tegels) reden = 'geen tegels';
        else if (hoog < 40) reden = 'thuisscherm zonder hoogte';
        else if (buitenBeeld) reden = 'thuisscherm buiten beeld';
        else if (leegMidden) reden = 'niets in het midden van het scherm';

        if (reden && window.RTGFoutmelder && RTGFoutmelder.meetLeeg) RTGFoutmelder.meetLeeg(reden);
      } catch (e) { /* een controle mag nooit de oorzaak van iets worden */ }
    }, 2500);
    if ((rtf.gekoppeld || []).length) ensurePush(false); // stil vernieuwen als het al aan staat
  }

  /* ---------- tickets: activiteiten, tours en musea ---------- */
  let tkPartners = [], tkOpen = null, tkKeuze = null;

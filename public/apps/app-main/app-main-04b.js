    /* Vervolg van app-main-04: de poort-inhoud (mond, zin, invoerveld,
       passkey) en het gesprek erachter. Geknipt omdat deel 04 met de
       schermvullende sterrenhemel over de 10 KB-grens ging die het
       modulebeleid stelt; de bundel plakt 04 en 04b weer aaneen tot exact
       hetzelfde bestand. De cut ligt op een statement-grens binnen dezelfde
       gesloten scope, dus er verandert niets aan het gedrag. */

    // Een dicht maar fluisterzacht starlight-veld over het hele scherm. Meer
    // lichtpunten geeft de indruk van ontelbaar veel vezels; de lagere
    // helderheid voorkomt dat de poort glitterig of onrustig wordt.
    (function sterrenhemel(){
      var hang = function(){ if (window.RTGSterren) window.RTGSterren.hang(gate, { dichtheid: 1.35, helderheid: 0.72 }); };
      if (window.RTGSterren) return hang();
      var s = document.createElement('script'); s.src = '/shared/sterren.js'; s.async = true;
      s.onload = hang; document.head.appendChild(s);
    })();

    const doos = document.createElement('div');
    doos.className = 'ag-doos';
    doos.innerHTML =
      '<div class="ag-kop" id="agKop" aria-hidden="true"></div>' +
      '<canvas class="ag-mond" id="agMond" width="440" height="200" aria-hidden="true"></canvas>' +
      '<div class="ag-rahul-label" aria-hidden="true">' + T('ag.log','Rahul') + '</div>' +
      '<div class="ag-intro"><h1 class="ag-welkom">' + T('ag.welkom.kop','Welkom terug') + '</h1>' +
      '<div class="ag-zin" id="agZin" role="status" aria-live="polite" aria-label="' + T('ag.log','Rahul') + '"></div></div>' +
      '<div class="ag-rij" hidden><input id="agIn" autocomplete="off" data-i18n-ph="ag.plho" aria-label="' + T('ag.in','Je antwoord aan Rahul') + '" placeholder="' + T('ag.plho','Ik wil zeggen dat..') + '">' +
      '<button type="button" id="agGo" aria-label="' + T('ag.stuur','Stuur') + '">&#8594;</button></div>' +
      '<div class="ag-stappen" id="agStappen" aria-hidden="true"></div>' +
      '<div class="ag-kluis" id="agKluis"></div>' +
      '<div class="ag-passkey-kaart"><div class="ag-passkey-embleem" aria-hidden="true">' +
        '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.35"><circle cx="13" cy="10" r="4"/><path d="M5 23c.8-5 3.4-7 8-7 3.4 0 5.8 1.3 7 4"/><circle cx="23" cy="19" r="3"/><path d="M26 19h5m-2 0v3m-2-3v2"/></svg></div>' +
        '<p>' + T('ag.pk.uitleg','Ga verder met je passkey') + '</p>' +
      '<button type="button" class="ag-passkey" id="agPasskey">' +
        '<svg viewBox="0 0 24 24" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 11a2 2 0 0 0-2 2c0 2-.4 3.6-1 5"/><path d="M8 9a4 4 0 0 1 7 2c0 3-.5 5.4-1.5 7.5"/><path d="M12 13c0 3-.6 5.6-1.6 7.7"/><path d="M5.5 8a7 7 0 0 1 12 3c0 3.4-.5 6.4-1.5 9"/></svg>' +
        '<span>' + T('ag.pk.veilig','Veilig openen') + '</span></button></div>' +
      '<button type="button" class="ag-anders" id="agAnders"><span>' + T('ag.anders','Andere manier') + '</span></button>' +
      '<div class="ag-werelden" id="agWerelden" aria-label="' + T('ag.werelden','Beschikbare RTG-werelden') + '"></div>';
    gate.appendChild(doos);
    /* Op telefoon vervangt deze rail de ingeklapte command-bank. De namen
       komen uit dezelfde navigatiebron; dit is dus geen tweede wereldregister
       dat later los van LivingOS, WorkOS, TravelOS of FoundationOS kan raken. */
    let wereldPogingen = 0, wereldWachter = null;
    function vulWerelden(){
      const rail = doos.querySelector('#agWerelden');
      if (!rail || rail.children.length) return;
      const knoppen = document.querySelectorAll('#rtgCommand .cmd-nav button');
      const namen = Array.from(knoppen).slice(0, 4).map(function(knop){
        return knop.textContent.trim();
      }).filter(Boolean);
      if (namen.length < 4){
        if (!wereldWachter && window.MutationObserver){
          wereldWachter = new MutationObserver(vulWerelden);
          wereldWachter.observe(document.body, { childList: true, subtree: true });
        } else if (!window.MutationObserver && wereldPogingen++ < 100) setTimeout(vulWerelden, 100);
        return;
      }
      if (wereldWachter){ wereldWachter.disconnect(); wereldWachter = null; }
      namen.forEach(function(naam){
        const item = document.createElement('span'); item.textContent = naam; rail.appendChild(item);
      });
    }
    vulWerelden();
    // een wachtwoord-herstel-link uit de e-mail (?reset=): Rahul regelt het herstel zelf
    const herstel = new URLSearchParams(location.search).get('reset');

    const zin = doos.querySelector('#agZin');
    const inp = doos.querySelector('#agIn');
    let gesprek = null, bezig = false, loginU = null;

    /* De RTG-signatuur: de mond bestaat uit duizenden bewegende lichtpuntjes
       (eigen canvas, geen extern beeld). Bordeaux als basis, goud erdoorheen
       geweven, een enkel wit puntje als glinstering, en een gouden lichtgolf
       die om de paar seconden door de lippen trekt. De onderlip beweegt mee
       als Rahul praat. Wie minder beweging wil, krijgt een stilstaand beeld. */
    const mond = doos.querySelector('#agMond');
    /* EEN mond voor het hele systeem: shared/mond.js. Hier stond een eigen,
       tweede kopie van dezelfde puntenwolk -- met een eigen tekenlus die na
       het inloggen eeuwig bleef pollen (het canvas en 2820 objecten werden
       nooit vrijgegeven) en met een sinus in plaats van echte spraak. Die
       kopie is weg; de gedeelde motor doet kaak, spreiding en tuit, en stopt
       vanzelf zodra de poort uit beeld is. */
    /* mond.js laadt met defer en is er dus nog NIET wanneer de poort bouwt:
       meteen aanhaken zou een stille mond geven. Vandaar de na-lading op
       DOMContentLoaded (uitgestelde scripts draaien daarvoor al). */
    let mondje = { praat: function(){} };
    function mondStart(){
      if (window.RTGMond && mond && !mond.dataset.rtgMondActief) mondje = RTGMond.maak(mond);
    }
    mondStart();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mondStart);
    const praat = ms => mondje.praat(ms);

       gekozen in de paneelkiezer. De titel en de terugknop gaan daarom uit het
       zicht maar blijven in de toegankelijkheidsboom (zelfde techniek als
       .vis-verborgen). De ACTIEknoppen in de balk (zoeken, uploaden, nieuw)
       blijven gewoon staan: dat is bediening, geen chrome. */
    'html.rtg-in-frame body>header{position:static!important;background:none!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;}' +
    'html.rtg-in-frame .ios-groot,html.rtg-in-frame body>header h1,' +
    'html.rtg-in-frame body>header .ios-terug,html.rtg-in-frame body>header .terug,' +
    'html.rtg-in-frame body>header>a[href^="/apps/app.html"]' +
    '{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:0!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important;}';
  if (ds) document.documentElement.classList.add('ds-basis');
  else {
    var st = document.createElement('style'); st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  /* de gedeelde rustlaag: één ingetogen stijl die overal dezelfde kalmte legt
     (zachte, trage overgangen + een rustige focusrand). Als apart bestand zodat
     het cachet en pagina's het kunnen overschrijven. */
  if (!ds) {
    var rl = document.createElement('link');
    rl.rel = 'stylesheet'; rl.href = '/shared/rust.css';
    (document.head || document.documentElement).appendChild(rl);
  }

  /* de trage helft van de toegankelijkheid: bij de server ophalen wat het lid
     heeft ingesteld, zodat een tweede toestel het ook krijgt. Zonder haast --
     de stand van dit toestel staat hierboven al op het scherm. */
  var tgs = document.createElement('script');
  tgs.src = '/shared/toegankelijk.js'; tgs.async = true;
  (document.head || document.documentElement).appendChild(tgs);

  /* ---- de gebarenlaag: twee laden onder elke regel ----------------------
     Hij ligt op elk appscherm en DOET IN RUST NIETS. Geen element erbij, geen
     stijl erover; hij wordt pas wakker als een scherm zegt welke acties een
     regel draagt (RTGGebaar.zet / RTGGebaar.lijst). Zo staat de bediening op
     EEN plek in plaats van acht keer net anders (LAT.md regel 4), en kost een
     scherm dat hem niet gebruikt precies niets.

     Zonder haast: een veeg is een tweede handeling, nooit de eerste. Het blad
     laadt de laag zelf bij, dus een pagina hoeft er geen <link> voor te kennen. */
  if (!ds && !window.RTGGebaar && !document.querySelector('script[src^="/shared/gebaar.js"]')) {
    var gb = document.createElement('script');
    gb.src = '/shared/gebaar.js'; gb.async = true;
    (document.head || document.documentElement).appendChild(gb);
  }

  function toost(t) {
    var actueleDs = document.documentElement.hasAttribute('data-ds');
    // Verbinding bezit op DS al de blijvende netwerkstatus. Basis blijft een
    // terugval voor schermen die die owner niet laden, zonder dubbele melding.
    if (actueleDs && window.RTGNet) return;
    var m = document.createElement('div'); m.className = actueleDs ? 'ds-melding toon' : 'bss-net'; m.setAttribute('role', 'status'); m.textContent = t;
    document.body.appendChild(m);
    setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 3500);
  }
  window.addEventListener('offline', function () { toost(rtf ? 'Even geen internet; de app werkt gewoon door waar dat kan.' : 'Geen verbinding; de app werkt door waar dat kan.'); });
  window.addEventListener('online', function () { toost('De verbinding is terug.'); });


  /* ---- 9. de overdracht: wat een lid uit zijn mand meenam naar dit scherm
     (shared/overdracht.js). Bevestigen gebeurt in het domein dat er al over
     gaat, en die deuren staan verspreid over tientallen schermen -- dus staat
     de balk op EEN plek en niet in elk van hen. Hij wordt alleen bijgeladen als
     er ook werkelijk een briefje in het adres staat; op elk ander scherm kost
     dit niets. De uitleg staat in kern/commerce/overdracht.js.

     Hij hoort hier en niet bij punt 5 en 6 in basis-02.js, waar de andere twee
     bijladers staan: dat deel zat op 9894 bytes en zou met dit blok over de
     10 kB-leesgrens gaan. Een deelbestand is een GROOTTE-grens en geen
     betekenisgrens -- alle delen draaien in dezelfde functie. ---- */
  if (location.search.indexOf('overdracht=') >= 0) {
    var ovdS = document.createElement('script');
    ovdS.src = '/shared/overdracht.js'; ovdS.async = true;
    (document.head || document.documentElement).appendChild(ovdS);
  }

  /* ---- de toestelsleutel: het bezitsbewijs bij zware handelingen ----
     NIET async: dit script haakt op fetch, en laadt het pas na het eerste
     betaalverzoek, dan gaat dat verzoek zonder bewijs de deur uit. De uitleg
     staat in shared/toestelsleutel.js; hier staat het omdat een regel die op
     elk scherm herhaald moet worden, over een half jaar op een scherm
     ontbreekt -- en dat is dan het scherm waar geld beweegt. */
  var tsl = document.createElement('script');
  tsl.src = '/shared/toestelsleutel.js';
  (document.head || document.documentElement).appendChild(tsl);

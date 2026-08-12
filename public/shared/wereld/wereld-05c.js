
  /* ---------- de momenten van vandaag, op de wijzerplaat ----------

     De klok droeg werelden. Nu draagt hij ook TIJD -- en dat is waar hij als
     enige element goed in is: 09:30, 14:00, 19:00 staan op de plek waar ze
     horen te staan, en je tikt ze aan om te zien wat er dan is.

     ZE DRAAIEN NIET MEE, en dat is de hele reden dat ze een eigen laag hebben.
     De bezel met werelden draait als je reist; een tijdstip dat meedraait is
     geen tijdstip meer maar een versiering. Ze liggen daarom in een laag die
     nooit roteert, tussen de wijzerplaat (straal 31) en de wereldmerken
     (36 tot 46) in -- op straal 34, waar ze allebei niet raken.

     ER WORDT HIER NIETS VERZONNEN. De momenten komen uit /agenda/mijn, dezelfde
     bron als het dagprogramma bij je reis (app-main-45.js). Heeft een lid
     vandaag niets, dan staan er GEEN stipjes -- geen lege ring met streepjes om
     te suggereren dat er een dag is. Dat is dezelfde regel als bij de stand:
     wat niet gemeten kan worden, wordt niet getoond (CANVAS.md). */
  var momenten = [];        // [{tijd:'14:00', uur, min, titel, sub}]
  var momentOpen = null;

  /* Een tijd op de wijzerplaat is een hoek op een twaalfuursverdeling: elk uur
     dertig graden, elke minuut een halve. 14:00 landt dus op twee uur, precies
     waar de wijzer zou staan. */
  function momentHoek(uur, min) { return (uur % 12) * 30 + min * 0.5; }

  function bouwMomenten() {
    if (el.momenten || !el.kring) return;
    var laag = d.createElement('div');
    laag.className = 'os-momenten';
    laag.id = 'osMomenten';
    // tussen de klok en de merken in: de klok mag hem niet afdekken
    el.kring.appendChild(laag);
    el.momenten = laag;

    var kaart = d.createElement('div');
    kaart.className = 'os-moment-kaart';
    kaart.id = 'osMomentKaart';
    kaart.setAttribute('role', 'status');
    kaart.setAttribute('aria-live', 'polite');
    kaart.hidden = true;
    el.kring.appendChild(kaart);
    el.momentKaart = kaart;
  }

  /* De momenten (opnieuw) aanreiken. Zelfde vorm als werelden(): de aanroeper
     haalt ze op en deze laag tekent ze. Verandert er niets, dan gebeurt er
     niets -- anders knippert de ring bij elke ronde. */
  var vorigeMomenten = null;
  function zetMomenten(lijst) {
    lijst = (lijst || []).filter(function (m) { return m && typeof m.uur === 'number'; });
    var vinger = lijst.map(function (m) { return m.uur + ':' + m.min + '~' + m.titel; }).join('|');
    if (vinger === vorigeMomenten) return;
    vorigeMomenten = vinger;
    momenten = lijst;
    if (st.aan) tekenMomenten();
  }

  function tekenMomenten() {
    if (!el.momenten) return;
    el.momenten.textContent = '';
    sluitMoment();
    /* Ingezoomd in een wereld hoort de klok bij DIE wereld; de dag van vandaag
       eroverheen zou twee verhalen door elkaar zijn. */
    if (st.diep || !momenten.length) return;
    momenten.forEach(function (m, i) {
      var b = d.createElement('button');
      b.type = 'button';
      b.className = 'os-moment';
      b.dataset.i = String(i);
      b.setAttribute('aria-label', m.tijd + ' ' + m.titel);
      var a = (momentHoek(m.uur, m.min) - 90) * Math.PI / 180;
      b.style.left = (50 + 34 * Math.cos(a)).toFixed(3) + '%';
      b.style.top = (50 + 34 * Math.sin(a)).toFixed(3) + '%';
      b.innerHTML = '<i></i><span>' + m.tijd + '</span>';
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (st.gesleept) return;
        openMoment(Number(b.dataset.i));
      });
      el.momenten.appendChild(b);
    });
  }

  /* ---------- de klok WORDT dat moment ----------
     Niet een popup ernaast maar de wijzerplaat zelf: de klok zakt weg en het
     moment staat in dezelfde cirkel. Zo blijf je op je plek -- je hebt niets
     geopend, je kijkt naar een ander uur van dezelfde dag. */
  function openMoment(i) {
    var m = momenten[i];
    if (!m || !el.momentKaart) return;
    momentOpen = i;
    el.momentKaart.innerHTML =
      '<b class="os-moment-tijd">' + esc(m.tijd) + '</b>' +
      '<span class="os-moment-titel">' + esc(m.titel) + '</span>' +
      (m.sub ? '<span class="os-moment-sub">' + esc(m.sub) + '</span>' : '');
    el.momentKaart.hidden = false;
    el.kring.setAttribute('data-moment', 'ja');
    for (var j = 0; j < el.momenten.children.length; j++) {
      el.momenten.children[j].dataset.actief = (j === i ? 'ja' : 'nee');
    }
    if (el.kern) el.kern.setAttribute('aria-label', 'Terug naar de klok');
  }

  function sluitMoment() {
    momentOpen = null;
    if (el.momentKaart) el.momentKaart.hidden = true;
    if (el.kring) el.kring.setAttribute('data-moment', 'nee');
    if (el.momenten) {
      for (var j = 0; j < el.momenten.children.length; j++) el.momenten.children[j].dataset.actief = 'nee';
    }
    kernLabel();
  }
  function momentStaatOpen() { return momentOpen != null; }

  // tekst uit de agenda is tekst en geen opmaak: hij komt van buiten
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

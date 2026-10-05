/* RTFoundation · de lescode als DEELLINK en QR (besluit B20, RELEASEKANDIDAAT.md).

   De lescode blijft 128 bits (LES.<32 hex>, server/foundation/onderwijs/
   toegang.js) en hoeft niet meer ingetikt te worden: de begeleider toont op het
   bord een link of een QR, de leerling opent hem op leren.html. Er komt geen
   korte code en geen uitzondering op het 128-bitsbeleid.

   DE CODE REIST ALLEEN IN HET FRAGMENT (#les=...). Een fragment gaat nooit mee
   naar de server: niet in het pad, niet in een query, dus ook niet in een
   serverlog of een Referer. Het ontvangende scherm leest het fragment in een
   inline script bovenaan leren.html, wist het met history.replaceState voor
   enig verzoek van de pagina, en doet de join zelf met POST
   /api/foundation/les/join. Dezelfde vorm als de reisuitnodiging
   (CODECREDENTIALS.json, controls url_fragment_only en
   history_scrub_before_requests).

   Geen tweede QR-codec: de QR komt uit shared/qr.js via shared/qrteken.js, en
   die twee worden pas geladen als iemand op de knop drukt -- het bord heeft ze
   verder niet nodig. De link is van DEZE origin: de begeleider staat op het
   huis, dus de leerling komt bij hetzelfde huis uit. */
(function (root) {
  'use strict';
  var VORM = /^LES\.[A-F0-9]{32}$/;
  var DOEL = '/apps/foundation/leren.html';

  function geldig(code) { return VORM.test(String(code || '')); }
  /* Weigert alles wat geen volledige lescode is: een link met een halve of
     verzonnen code zou de leerling een 404 laten halen en de rem op het raden
     laten tellen. */
  function link(origin, code) {
    if (!geldig(code)) throw new Error('Geen volledige lescode.');
    return String(origin || '').replace(/\/+$/, '') + DOEL + '#les=' + code;
  }

  var api = { VORM: VORM, DOEL: DOEL, geldig: geldig, link: link };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.RTGLesDeel = api;
  var d = root.document;
  if (!d) return;

  function laad(src) {
    return new Promise(function (goed, fout) {
      var s = d.createElement('script');
      s.src = src; s.onload = goed;
      s.onerror = function () { fout(new Error(src + ' laadt niet')); };
      d.head.appendChild(s);
    });
  }
  function qrKlaar() {
    if (root.RTGQRteken && root.RTGQR) return Promise.resolve();
    return (root.RTGQR ? Promise.resolve() : laad('/shared/qr.js')).then(function () {
      return root.RTGQRteken ? null : laad('/shared/qrteken.js');
    });
  }

  function bouw() {
    var codeEl = d.getElementById('lesCode'), naast = d.getElementById('btnKopieer');
    if (!codeEl || !naast) return;
    var knop = d.createElement('button');
    knop.type = 'button'; knop.className = 'knop klein'; knop.id = 'btnDeel';
    knop.textContent = 'Deellink · QR'; knop.hidden = true;
    naast.insertAdjacentElement('afterend', knop);

    var dlg = d.createElement('dialog');
    dlg.id = 'dlgDeel'; dlg.setAttribute('aria-labelledby', 'deelTitel');
    dlg.innerHTML = '<div class="kaart modal">' +
      '<h3 id="deelTitel">Laat de klas meedoen</h3>' +
      '<p class="mini">Scan de QR of open de link. Niemand hoeft de lescode over te tikken.</p>' +
      '<div class="h-mt60" id="deelQr"></div>' +
      '<label class="mini" for="deelLink">Deellink</label>' +
      '<input class="veld" id="deelLink" readonly>' +
      '<p class="mini" id="deelMelding" role="status"></p>' +
      '<button type="button" class="knop klein" id="deelKopieer">Kopieer link</button> ' +
      '<button type="button" class="knop grijs klein" id="deelSluit">Sluiten</button>' +
      '</div>';
    d.body.appendChild(dlg);
    var vak = d.getElementById('deelQr'), veld = d.getElementById('deelLink'), melding = d.getElementById('deelMelding');

    /* De code komt uit wat het bord TOONT, en nergens anders: daar zet het bord
       hem neer na maken of roteren, en daar haalt het hem weg als hij verloopt
       ("vernieuw"). Zo blijft het bord de enige eigenaar van de lescode. */
    function code() { var t = (codeEl.textContent || '').trim(); return geldig(t) ? t : ''; }
    /* hidden EN display: .knop zet zelf een display, en die wint van [hidden]. */
    function pas() { var weg = !code(); knop.hidden = weg; knop.style.display = weg ? 'none' : ''; }
    new MutationObserver(pas).observe(codeEl, { childList: true, characterData: true, subtree: true });
    pas();

    knop.addEventListener('click', function () {
      var c = code(); if (!c) return;
      var l = link(root.location.origin, c);
      veld.value = l; melding.textContent = ''; vak.textContent = '';
      dlg.showModal();
      qrKlaar().then(function () {
        if (veld.value !== l) return; // intussen geroteerd: de nieuwe klik tekent zelf
        var cv = root.RTGQRteken.teken(l, { schaal: 6 });
        cv.id = 'deelQrBeeld';
        cv.setAttribute('role', 'img');
        cv.setAttribute('aria-label', 'QR-code met de deellink van deze les');
        vak.appendChild(cv);
      }).catch(function () { melding.textContent = 'De QR kon niet getekend worden; deel de link.'; });
    });
    d.getElementById('deelKopieer').addEventListener('click', function () {
      var nav = root.navigator;
      if (nav && nav.clipboard) nav.clipboard.writeText(veld.value).then(function () { melding.textContent = 'Gekopieerd.'; }, function () { veld.select(); });
      else veld.select();
    });
    d.getElementById('deelSluit').addEventListener('click', function () { dlg.close(); });
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', bouw); else bouw();
})(typeof self !== 'undefined' ? self : this);

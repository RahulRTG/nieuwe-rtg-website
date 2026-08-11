/* Stand RTG-code, deel 1: het gereedschap. Was /apps/rtgcode.html; de
   bediening en de registratie staan in rtgcodeb.js, want samen passen ze
   niet onder de maat van een standbestand.

   Twee dingen wonen hier, allebei met een reden:

   1. plaats(): de levende code. Zelfde ritme als shared/dyncode.js (vers van
      de server, net voor het verval alvast een nieuwe, een aftelring), maar
      dan door Geld.api heen in plaats van een eigen fetch met een eigen
      tokengreep. Die ene api-laag is waarom RTG Geld bestaat; een tweede weg
      naar de server zou de fout uit LAT.md regel 4 terughalen.
   2. scanKlaar(): de scanstapel bijladen. geld.html laadt qr.js en qrteken.js
      al (meer standen tonen codes), maar de camerastapel (mediapoort,
      beelddecoder, scanner, codeduiding) is alleen voor deze stand. Die hoort
      niet vast in de shell van alle tien de standen; hij komt pas binnen
      zodra iemand hier echt wil scannen. Overtikken kan niet: dan lopen
      scanner en kopie uiteen. */
(function (w, d) {
  'use strict';
  var Deel = w.RTGGeldDeel = w.RTGGeldDeel || {};

  /* De code komt ALTIJD vers van de server: alleen daar staat de sleutel
     (server/kern/dyncode.js). ttl begint op de serverstandaard van 45s en
     volgt daarna wat de server echt teruggeeft, zodat de aftelring klopt. */
  function plaats(el, opts) {
    var Geld = w.Geld;
    var levend = true, huidig = null, timer = null, raf = null, ttl = 45000;

    el.innerHTML = '';
    var doek = d.createElement('div');
    doek.setAttribute('role', 'img');
    doek.setAttribute('aria-label', 'RTG-code, ververst automatisch');
    var ring = d.createElement('canvas');
    ring.width = 120; ring.height = 6;
    ring.style.cssText = 'width:min(15rem,60%);height:4px;margin:.6rem auto 0;display:block;border-radius:2px;';
    el.appendChild(doek); el.appendChild(ring);

    /* bordeaux, net als de code zelf: het merk zit in de kleur (de originele
       pagina was daar expliciet over: bordeaux uit het logo, geen rood) */
    function tekenRing(frac) {
      var c = ring.getContext('2d'), b = ring.width, h = ring.height;
      c.clearRect(0, 0, b, h);
      c.fillStyle = 'rgba(127,22,52,.18)'; c.fillRect(0, 0, b, h);
      c.fillStyle = '#7F1634'; c.fillRect(0, 0, Math.max(0, Math.min(1, frac)) * b, h);
    }

    function toon(token, exp) {
      try {
        var cv = w.RTGQRteken.tekenRTG(token, { merk: opts.merk, schaal: 7 });
        cv.style.cssText = 'width:min(16rem,80vw);height:auto;image-rendering:pixelated;border-radius:12px;';
        doek.innerHTML = ''; doek.appendChild(cv);
      } catch (e) { doek.textContent = 'Kon de code niet tekenen.'; }
      huidig = { token: token, exp: exp };
    }

    /* ruim voor het verval alvast een verse halen: de getoonde code is dan
       nooit al dood terwijl een kassa hem nog aan het lezen is */
    function plan(wanneer) {
      clearTimeout(timer);
      timer = setTimeout(function () { if (levend) ververs(); }, Math.max(1000, wanneer - Date.now() - 1500));
    }

    async function ververs() {
      try {
        var r = await Geld.api('/api/code/dyn', { soort: 'pas', code: 'RTG' });
        if (!levend) return;
        if (r.ttlMs) ttl = r.ttlMs;
        toon(r.token, r.exp);
        plan(r.exp);
      } catch (e) {
        if (!levend) return;
        huidig = null;
        /* bij 401 valt er niets te verversen tot er een inlog is; blijven
           proberen zou elke acht seconden dezelfde afwijzing halen */
        if (e.status === 401) { doek.textContent = e.message + ' Log eerst in via de leden-app.'; return; }
        doek.textContent = e.status ? e.message : 'Even geen verbinding.';
        plan(Date.now() + 8000);
      }
    }

    function lus() {
      if (!levend) return;
      tekenRing(huidig ? (huidig.exp - Date.now()) / ttl : 0);
      raf = w.requestAnimationFrame(lus);
    }

    ververs(); lus();
    return { stop: function () { levend = false; clearTimeout(timer); if (raf) w.cancelAnimationFrame(raf); } };
  }

  /* De scanstapel als scripts bijladen, niet als kopie: de mediapoort stelt
     de cameradiagnose (media.js), qrscan.js decodeert het beeld, scanner.js
     bedient de camera en rtgcode.js duidt wat er gescand is. Elk bestand zet
     zijn eigen globale; wie er al staat (of ooit alsnog vast in geld.html
     komt) wordt overgeslagen, dus dit kan geen tweede kopie opleveren. */
  var SCAN = [
    ['/shared/media.js', 'RTGMedia'],
    ['/shared/qrscan.js', 'RTGQRScan'],
    ['/shared/scanner.js', 'RTGScanner'],
    ['/shared/rtgcode.js', 'RTGCode']
  ];
  function laad(pad) {
    return new Promise(function (ok, nee) {
      var s = d.createElement('script');
      s.src = pad;
      s.onload = function () { ok(); };
      s.onerror = function () { nee(new Error('Kon ' + pad + ' niet laden.')); };
      d.head.appendChild(s);
    });
  }
  function scanKlaar() {
    return Promise.all(SCAN.map(function (p) { return w[p[1]] ? null : laad(p[0]); }));
  }

  Deel.rtgcode = { plaats: plaats, scanKlaar: scanKlaar };
})(window, document);

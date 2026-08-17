/* Stand RTG-code, deel 2: het paneel en de bediening. Was /apps/rtgcode.html;
   het gereedschap (levende code, scanstapel) staat in rtgcode.js.

   Van de pagina vervalt alleen de paginakop; de zin daaruit is de uitleg van
   de stand geworden. Elke knop, elk vak en elke lijst staat er wel. Het
   stijlblok is er voor wat de shell niet kent: het codevak, de video, de
   uitslagkleuren en de puntjeslijst; alles erin hangt aan een rc-id. */
(function (w, d) {
  'use strict';
  var RCCSS = '#rcCode{min-height:16rem;display:flex;flex-direction:column;align-items:center;justify-content:center;}#rcCam{display:none;width:100%;max-width:22rem;border-radius:14px;background:#000;margin-top:1rem;}#rcCam.aan{display:block;}#paneel .rcRij{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-top:.9rem;}#paneel .rcRij input{flex:1;min-width:8rem;width:auto;}#rcMerk .knop[aria-pressed="true"]{border-color:var(--rtg-goud);}#rcUit{margin-top:.6rem;font-size:.88rem;}#rcUit.goed{color:#7CC389;}#rcUit.fout{color:#C23A5E;}#rcInlog{border:1px solid #C23A5E;border-radius:12px;padding:.8rem 1rem;font-size:.88rem;margin-bottom:.8rem;}#rcWaarom{list-style:none;margin:.2rem 0 0;padding:0;display:flex;flex-direction:column;gap:.55rem;}#rcWaarom li{display:flex;gap:.6rem;font-size:.88rem;color:var(--rtg-soft);}#rcWaarom b{color:var(--rtg-txt);}#rcWaarom .punt{flex:0 0 auto;width:.5rem;height:.5rem;border-radius:50%;background:#C23A5E;margin-top:.45rem;}';
  var V = w.RTGGeld = w.RTGGeld || { standen: [] };
  var $ = function (s) { return d.querySelector(s); };
  var merk = 'lippen', dyn = null, scanner = null;

  function uitslag(goed, tekst) {
    var el = $('#rcUit');
    if (!el) return;
    el.className = goed === true ? 'goed' : goed === false ? 'fout' : 'stil';
    el.textContent = tekst;
  }

  async function verifieer(token) {
    var t = String(token || '').trim();
    if (!t) { uitslag(false, 'Plak of scan eerst een code.'); return; }
    uitslag(null, 'Even controleren...');
    try {
      var r = await w.Geld.api('/api/code/scan', { token: t });
      uitslag(true, 'Geldig. Soort: ' + r.soort + ' · code: ' + r.code + '.');
    } catch (e) {
      /* met e.status heeft de SERVER geoordeeld (verlopen, vreemd, niet
         ingelogd) en is zijn tekst de uitslag; zonder status was er geen
         verbinding, en dan is "geen geldige code" een leugen */
      uitslag(false, e.status === 401 ? e.message + ' Log eerst in via de leden-app.'
        : e.status ? e.message : 'Even geen verbinding.');
    }
  }

  function toonCode() {
    if (dyn) { dyn.stop(); dyn = null; }
    var vak = $('#rcCode');
    /* dezelfde drempel als het origineel: zonder lidtoken niet elke 45s een
       401 gaan halen, maar meteen zeggen wat er mist */
    if (!w.Geld.token()) { $('#rcInlog').hidden = false; vak.innerHTML = ''; return; }
    $('#rcInlog').hidden = true;
    dyn = w.RTGGeldDeel.rtgcode.plaats(vak, { merk: merk });
  }

  function kiesMerk(m) {
    merk = m;
    $('#rcLip').setAttribute('aria-pressed', String(m === 'lippen'));
    $('#rcHor').setAttribute('aria-pressed', String(m === 'horloge'));
    toonCode();
  }

  function camUit() {
    if (scanner) { try { scanner.stop(); } catch (e) { /* al gestopt */ } scanner = null; }
    var v = $('#rcCam');
    if (!v) return;
    v.classList.remove('aan');
    $('#rcCamAan').hidden = false;
    $('#rcCamUit').hidden = true;
  }

  function camAan() {
    /* De knoppen wisselen SYNCHROON, voor het wachten op scanKlaar(): zolang
       de scanbibliotheek laadt is de aanknop anders nog klikbaar, en twee
       klikken zouden twee scanners op dezelfde camera zetten. De catch komt
       via camUit() vanzelf weer op de beginstand uit. */
    $('#rcCamAan').hidden = true;
    $('#rcCamUit').hidden = false;
    w.RTGGeldDeel.rtgcode.scanKlaar().then(function () {
      $('#rcCam').classList.add('aan');
      scanner = new w.RTGScanner.Scanner({
        video: $('#rcCam'),
        onCode: function (c) {
          var g = w.RTGCode.lees(c.tekst);
          if (g.soort === 'rtg1') { verifieer(g.token); camUit(); }
          else uitslag(false, 'Geen RTG-code (dit is een gewone code).');
        }
      });
      return scanner.start();
    }).catch(function (e) {
      /* de mediapoort geeft de echte oorzaak mee (geweigerd, bezet, http);
         die tonen we, want "camera niet beschikbaar" laat mensen zoeken
         naar een knop die er niet is */
      uitslag(false, e && e.rtg ? e.rtg.kort : 'Camera niet beschikbaar.');
      camUit();
    });
  }

  function start() {
    stijl();
    $('#rcLip').addEventListener('click', function () { kiesMerk('lippen'); });
    $('#rcHor').addEventListener('click', function () { kiesMerk('horloge'); });
    $('#rcCheck').addEventListener('click', function () { verifieer($('#rcPlak').value); });
    $('#rcPlak').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); verifieer($('#rcPlak').value); }
    });
    $('#rcCamAan').addEventListener('click', camAan);
    $('#rcCamUit').addEventListener('click', camUit);
    toonCode();
  }

  /* de levende code plant altijd een volgende verversing en de camera houdt
     een stream vast; allebei horen ze echt uit bij een standwissel */
  function stop() {
    if (dyn) { dyn.stop(); dyn = null; }
    camUit();
  }

  /* De stijl via createElement en NIET als <style> in de html-string: de
     voordeur (server/middleware/voordeur.js) stempelt elk element dat via
     createElement('style') ontstaat met de CSP-nonce, maar een blok dat via
     innerHTML wordt ontleed krijgt geen stempel en wordt door style-src
     geweigerd. Dat gebeurde hier: de stand zag er ongestyled uit en de console
     meldde een CSP-schending. Een id-guard, want start() draait bij elke
     standwissel opnieuw. */
  function stijl() {
    if (d.getElementById('rcStijl')) return;
    var st = d.createElement('style');
    st.id = 'rcStijl';
    st.textContent = RCCSS;
    d.head.appendChild(st);
  }

  V.standen.push({
    id: 'rtgcode',
    naam: 'RTG-code',
    uitleg: 'Onze code is geen gewone QR: alleen de RTG-app kan hem maken en lezen, en hij vernieuwt zichzelf. Een foto is binnen een halve minuut waardeloos.',
    html:
      '<h2>Jouw levende code</h2>' +
      '<div class="kaart">' +
        '<p class="stil">Ververst automatisch. Laat hem scannen door een RTG-kassa of -entree.</p>' +
        '<div id="rcInlog" hidden>Log eerst in als lid; dan verschijnt je persoonlijke code hier.</div>' +
        '<div id="rcCode" role="status" aria-live="polite"></div>' +
        '<div class="rcRij" id="rcMerk" role="group" aria-label="Merkteken">' +
          '<span class="stil">Merkteken:</span>' +
          '<button class="knop" id="rcLip" type="button" aria-pressed="true">De lippen</button>' +
          '<button class="knop" id="rcHor" type="button" aria-pressed="false">Het horloge</button>' +
        '</div>' +
      '</div>' +
      '<h2>Scannen</h2>' +
      '<div class="kaart">' +
        '<p class="stil">De app leest de code en verifieert hem bij RTG. Een verlopen of vreemde code wordt geweigerd.</p>' +
        '<div class="rcRij">' +
          '<button class="knop hoofd" id="rcCamAan" type="button">Open de camera</button>' +
          '<button class="knop" id="rcCamUit" type="button" hidden>Stop</button>' +
        '</div>' +
        /* muted: dit beeld is een leesinstrument en geen inhoud. shared/media.js
           vraagt bij een camera nooit geluid, dus er is vandaag niets te horen --
           en met dit attribuut blijft dat zo als iemand die wens ooit uitbreidt.
           check.js regel 49 houdt de belofte vast. */
        '<video id="rcCam" playsinline muted></video>' +
        '<div class="rcRij">' +
          '<input id="rcPlak" type="text" placeholder="Of plak hier een RTG-code om te testen" aria-label="RTG-code plakken">' +
          '<button class="knop" id="rcCheck" type="button">Verifieer</button>' +
        '</div>' +
        '<div id="rcUit" class="stil" aria-live="polite"></div>' +
      '</div>' +
      '<h2>Waarom zo</h2>' +
      '<div class="kaart"><ul id="rcWaarom">' +
        '<li><span class="punt"></span><span><b>Alleen onze app.</b> De code is ondertekend met een sleutel die alleen op de RTG-server staat; een gewone QR-lezer ziet enkel "RTG1..." en kan er niets mee.</span></li>' +
        '<li><span class="punt"></span><span><b>Dynamisch.</b> Elke code vervalt na tientallen seconden en ververst vanzelf, dus een schermafdruk veroudert meteen.</span></li>' +
        '<li><span class="punt"></span><span><b>In stijl.</b> Bordeaux van het RTG-logo, met de lippen of het horloge in het hart.</span></li>' +
      '</ul></div>',
    start: start,
    stop: stop
  });
})(window, document);

/* Bediening van de RTG-code-showcase (apps/rtgcode.html): een levende, gesloten
   code tonen (RTGDyn) met keuze lippen/horloge, en een scan-vak dat een RTG-code
   verifieert via de app (RTGDyn.verifieer). Alleen zinvol met een leden-inlog. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function heeftLid() { try { return !!localStorage.getItem('rtg_member_token'); } catch (e) { return false; } }

  var merk = 'lippen', dyn = null;

  function toonCode() {
    if (dyn) dyn.stop();
    if (!heeftLid()) { $('inlogNodig').hidden = false; $('code').innerHTML = ''; return; }
    $('inlogNodig').hidden = true;
    dyn = window.RTGDyn.plaats($('code'), { soort: 'pas', code: 'RTG', merk: merk });
  }

  function kiesMerk(m) {
    merk = m;
    $('mLip').setAttribute('aria-pressed', m === 'lippen' ? 'true' : 'false');
    $('mHor').setAttribute('aria-pressed', m === 'horloge' ? 'true' : 'false');
    toonCode();
  }

  function toonUitslag(r) {
    var el = $('uit');
    if (r.ok) { el.className = 'melding goed'; el.textContent = 'Geldig. Soort: ' + r.soort + ' · code: ' + r.code + '.'; }
    else { el.className = 'melding fout'; el.textContent = r.error || 'Geen geldige RTG-code.'; }
  }

  function verifieer(token) {
    var t = String(token || '').trim();
    if (!t) { toonUitslag({ ok: false, error: 'Plak of scan eerst een code.' }); return; }
    $('uit').className = 'melding'; $('uit').textContent = 'Even controleren...';
    window.RTGDyn.verifieer(t).then(toonUitslag).catch(function () { toonUitslag({ ok: false, error: 'Even geen verbinding.' }); });
  }

  // camera
  var scanner = null;
  function camAan() {
    if (!window.RTGScanner) return;
    $('cam').classList.add('aan'); $('camAan').hidden = true; $('camUit').hidden = false;
    scanner = new window.RTGScanner.Scanner({
      video: $('cam'),
      onCode: function (c) {
        var g = window.RTGCode ? window.RTGCode.lees(c.tekst) : { soort: 'tekst', tekst: c.tekst };
        if (g.soort === 'rtg1') { verifieer(g.token); camUit(); }
        else { toonUitslag({ ok: false, error: 'Geen RTG-code (dit is een gewone code).' }); }
      }
    });
    scanner.start().catch(function () { toonUitslag({ ok: false, error: 'Camera niet beschikbaar.' }); camUit(); });
  }
  function camUit() {
    if (scanner) { scanner.stop(); scanner = null; }
    $('cam').classList.remove('aan'); $('camAan').hidden = false; $('camUit').hidden = true;
  }

  function start() {
    $('mLip').addEventListener('click', function () { kiesMerk('lippen'); });
    $('mHor').addEventListener('click', function () { kiesMerk('horloge'); });
    $('check').addEventListener('click', function () { verifieer($('plak').value); });
    $('plak').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); verifieer($('plak').value); } });
    $('camAan').addEventListener('click', camAan);
    $('camUit').addEventListener('click', camUit);
    toonCode();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

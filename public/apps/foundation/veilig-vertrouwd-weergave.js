/* Er verschijnt alleen een persoon, status of toestemming die een bestaande
   Foundation-bron heeft teruggegeven. Precieze coordinaten worden niet getoond. */
(function (w, d) {
  'use strict';
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]; }); }
  function glyph(n) { return '<i data-glyf="' + n + '"></i>'; }
  function vul(el) { try { if (w.RTGGlyf) w.RTGGlyf.vul(el); } catch (e) {} }
  function geleden(iso) {
    if (!iso) return 'Tijd niet bekend';
    var sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 90) return 'Zojuist';
    if (sec < 3600) return Math.floor(sec / 60) + ' min geleden';
    if (sec < 86400) return Math.floor(sec / 3600) + ' uur geleden';
    return new Intl.DateTimeFormat('nl-NL', { day:'numeric', month:'short' }).format(new Date(iso));
  }
  function initiaal(naam) { return esc(String(naam || '?').trim().slice(0, 1).toUpperCase()); }
  function locaties(staat) {
    var doel = d.getElementById('vvLocaties'), lijst = staat.locaties || [];
    if (!lijst.length) {
      doel.innerHTML = '<div class="vv-leeg"><b>Nog niemand liet een status achter.</b><span>We raden niet waar iemand is. Een gezinslid verschijnt pas nadat die zelf iets deelt.</span></div>'; return;
    }
    doel.innerHTML = lijst.slice(0, 8).map(function (x) {
      return '<article class="vv-persoon"><span class="vv-avatar">' + initiaal(x.naam) + '</span><div><small>' + (x.vanMij ? 'Uw status' : 'Gezinsstatus') + '</small><b>' + esc(x.naam) + '</b><em>' + esc(x.status || 'Status gedeeld') + ' · ' + esc(geleden(x.at)) + '</em></div><span class="vv-check" aria-label="Status gedeeld">&#10003;</span></article>';
    }).join('');
  }
  function woorden(stukken) { return (stukken || []).map(function (x) { return x.wat || x.stuk; }).filter(Boolean); }
  function kring(staat) {
    var doel = d.getElementById('vvKring'), som = d.getElementById('vvKringSamenvatting'), bron = staat.kring;
    if (!bron) {
      som.innerHTML = '<article><small>Verbonden</small><b>Niet bereikbaar</b></article><article><small>Open verzoeken</small><b>Niet bereikbaar</b></article>';
      doel.innerHTML = '<div class="vv-leeg"><b>Uw kring kon nu niet worden opgehaald.</b><span>Probeer het later opnieuw of open Mijn kring beheren.</span></div>'; return;
    }
    var banden = bron.banden || [], actief = banden.filter(function (b) { return b.staat !== 'gevraagd' && b.staat !== 'verlopen'; }), verzoeken = banden.filter(function (b) { return b.staat === 'gevraagd'; });
    som.innerHTML = '<article><small>Verbonden</small><b>' + actief.length + '</b></article><article><small>Open verzoeken</small><b>' + verzoeken.length + '</b></article>';
    if (!banden.length) {
      doel.innerHTML = '<div class="vv-leeg"><b>Uw kring is nog leeg.</b><span>Er komt pas iemand bij nadat de ander de band heeft bevestigd. U deelt daarna nog steeds niets vanzelf.</span></div>'; return;
    }
    doel.innerHTML = banden.map(function (b) {
      var deel = woorden(b.ikDeel), zie = woorden(b.ikZie), status = b.staat === 'gevraagd' ? (b.ikVroeg ? 'Wacht op de ander' : 'Wacht op uw keuze') : (b.staat === 'verlopen' ? 'Verlopen' : 'Verbonden');
      return '<article class="vv-band"><div class="vv-band__kop"><span class="vv-avatar">' + initiaal(b.ander) + '</span><div><small>' + esc(b.soort || 'Vertrouwde band') + '</small><b>' + esc(b.ander) + '</b><em>' + esc(status) + '</em></div></div><div class="vv-delen"><p><small>U deelt</small><span>' + esc(deel.length ? deel.join(', ') : 'Niets') + '</span></p><p><small>U ziet</small><span>' + esc(zie.length ? zie.join(', ') : 'Niets') + '</span></p></div></article>';
    }).join('');
  }
  function alles(staat) { locaties(staat); kring(staat); vul(d.getElementById('vvLocaties')); vul(d.getElementById('vvKring')); }
  w.RTGVeiligVertrouwdWeergave = { alles:alles, locaties:locaties, kring:kring, esc:esc };
})(window, document);

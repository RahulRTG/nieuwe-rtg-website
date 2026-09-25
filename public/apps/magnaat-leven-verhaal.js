/* Magnaat V4: je eerste uur, wat er gebeurde terwijl je weg was, je verhaal,
   en geluid als je dat zelf aanzet. De gegevens komen van ./magnaat-leven.js;
   hier wordt niets gevraagd en niets gerekend.

   GELUID STAAT UIT tot je het aanzet, en de keuze blijft alleen in deze browser
   (localStorage). Er worden geen bestanden geladen: twee korte tonen uit de
   Web Audio API, een omhoog bij iets goeds, een omlaag bij geldnood. De
   nieuwste melding gaat daarnaast altijd naar een aria-live-regio, zodat een
   schermlezer hoort wat een ziende speler ziet verschijnen. */
(function () {
  'use strict';
  var SLEUTEL = 'magnaat_geluid', LAATSTE = null, CTX = null;
  var geluidAan = function () { try { return localStorage.getItem(SLEUTEL) === 'aan'; } catch (e) { return false; } };
  var zetGeluid = function (aan) { try { localStorage.setItem(SLEUTEL, aan ? 'aan' : 'uit'); } catch (e) { /* zonder opslag blijft het uit */ } };

  function toon(hoog) {
    if (!geluidAan()) return;
    try {
      CTX = CTX || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.12].forEach(function (t, i) {
        var o = CTX.createOscillator(), g = CTX.createGain();
        o.frequency.value = hoog ? [523, 784][i] : [330, 220][i];
        g.gain.setValueAtTime(0.06, CTX.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.0001, CTX.currentTime + t + 0.18);
        o.connect(g); g.connect(CTX.destination);
        o.start(CTX.currentTime + t); o.stop(CTX.currentTime + t + 0.2);
      });
    } catch (e) { /* geen geluid in deze browser: het spel gaat gewoon door */ }
  }

  function teken(s, h) {
    var q = h.q, esc = h.esc, euro = h.euro;
    var g = s.gids, gk = q('#vnGids'), einde = s.verhaal && s.verhaal.einde;
    gk.hidden = !g && !einde;
    /* Een leven dat voorbij is, zegt dat eerst, en waar je opnieuw begint. */
    gk.innerHTML = einde ? '<b>Dit leven is voorbij</b><p>' + esc(einde.tekst) + '</p><p class="vn-rust">Onder Wereld kun je opnieuw beginnen, ook op een andere moeilijkheid.</p>'
      : g ? '<b>Je eerste stappen</b> · ' + g.gedaan + ' van ' + g.stappen.length + '<ol>' + g.stappen.map(function (x) {
      return '<li class="' + (x.klaar ? 'klaar' : x.id === g.nu ? 'nu' : '') + '">' + esc(x.tekst) + (x.id === g.nu ? '<small>' + esc(x.uitleg) + '</small>' : '') + '</li>';
    }).join('') + '</ol>' : '';

    var w = s.terwijlWeg, wk = q('#vnWeg');
    /* Alleen bij het binnenkomen: na je eerste handeling ben je weer bij. */
    wk.hidden = !w;
    if (w) {
      wk.innerHTML = '<b>Terwijl je weg was</b> · ' + w.dagen + ' dagen verstreken' + (w.meldingen.length
        ? '<ul>' + w.meldingen.map(function (m) { return '<li>dag ' + esc(m.dag) + ': ' + esc(m.tekst) + '</li>'; }).join('') + '</ul>' : ', en er gebeurde niets bijzonders.');
    }

    var m = s.vandaag.meldingen[0], sleutel = m ? m.dag + '|' + m.tekst : null;
    if (m && sleutel !== LAATSTE) {
      if (LAATSTE !== null) {
        q('#vnLive').textContent = m.tekst;
        if (m.soort === 'goed' || m.soort === 'kans') toon(true);
        if (m.soort === 'nood') toon(false);
      }
      LAATSTE = sleutel;
    }

    var v = s.verhaal, vk = q('#vnVerhaal');
    if (vk && v) {
      vk.innerHTML = (v.einde ? '<div class="vn-gids"><b>Hoe het afliep</b><p>' + esc(v.einde.tekst) + '</p></div>' : '') + (v.slot ? '<div class="vn-gids"><b>Dit heb jij opgebouwd</b><p>' + esc(v.slot.tekst) + '</p><p class="vn-rust">Omzet ' + euro(v.slot.omzet) +
        ' · resultaat ' + euro(v.slot.resultaat) + ' · ' + v.slot.klanten + ' klanten · ' + v.slot.team + ' mensen in je team</p></div>' : '') +
        '<h3>Jouw verhaal</h3>' + (v.mijlpalen.length ? '<ol class="vn-meldingen">' + v.mijlpalen.map(function (x) {
          return '<li class="vn-m vn-s-goed"><small>dag ' + esc(x.dag) + '</small>' + esc(x.tekst) + '</li>';
        }).join('') + '</ol>' : '<p class="vn-rust">Nog niets om te vertellen. Dat komt.</p>') +
        '<p><button type="button" class="btn subtle" data-vn-geluid aria-pressed="' + geluidAan() + '">Geluid: ' + (geluidAan() ? 'aan' : 'uit') + '</button></p>';
    }
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-vn-geluid]');
    if (!b) return;
    zetGeluid(!geluidAan());
    b.setAttribute('aria-pressed', String(geluidAan()));
    b.textContent = 'Geluid: ' + (geluidAan() ? 'aan' : 'uit');
    toon(true);
  });

  window.RTGMagnaatLevenVerhaal = { teken: teken };
}());

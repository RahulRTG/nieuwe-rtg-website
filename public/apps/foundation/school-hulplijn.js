/* RTF School, gezinskant golf 5: de hulplijn-knop van het kind zelf en de
   aankomende toetsen in het gezinsoverzicht.

   De regels (zelfde als de server afdwingt):
   - de knop is van het KIND: een ouder ziet hier geen verzendknop, alleen de
     meldingen die niet vertrouwelijk zijn;
   - het kind kiest zelf: gewoon (mentor + ouders zien het) of vertrouwelijk
     (alleen de mentor -- de vertrouwenspersoon-route, voor als het thuis
     niet veilig is), en de app zegt vooraf eerlijk wie meeleest;
   - geen surveillance: dit deel toont wat het kind zelf deelde, meer niet.
   Zelfde losse-deel-patroon als school-extra.js (gezinApi + globale s). */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var wortel = null;

  function kaart(titel, binnen) {
    return '<div class="sec">' + titel + '</div><div class="kaart blok">' + binnen + '</div>';
  }

  async function laad() {
    if (typeof gezinApi !== 'function' || !wortel) return;
    var d;
    try { d = await gezinApi('/school/mijn'); } catch (e) { return; }
    var ouder = !!(d && d.ouder);
    var uit = '';
    // aankomende toetsen: de leercurve-sync uit golf 4, nu zichtbaar
    ((d && d.school) || []).forEach(function (x) {
      var t = x.aankomendeToetsen || [];
      if (!t.length) return;
      uit += kaart('Aankomende toetsen · ' + esc(x.kind.naam),
        t.map(function (toets) {
          return '<div style="margin:.3rem 0;"><b>' + esc(toets.naam) + '</b> <span class="mini">' + esc(String(toets.soort).toUpperCase()) +
            (toets.vak ? ' · ' + esc(toets.vak) : '') + (toets.bezig ? ' · al begonnen' : '') + '</span>' +
            '<div class="mini">Leerdoelen: ' + (toets.doelen || []).map(esc).join(', ') + '. Oefen ze rustig met Rahul Bijles hieronder.</div></div>';
        }).join(''));
    });
    // de hulplijn, per klas
    var codes = [], gezien = {};
    ((d && d.school) || []).forEach(function (x) { if (!gezien[x.klas.code]) { gezien[x.klas.code] = true; codes.push(x.klas.code); } });
    for (var i = 0; i < codes.length; i++) {
      try { uit += await hulplijnBlok(codes[i], ouder); } catch (e) {}
    }
    wortel.innerHTML = uit;
    bind();
  }

  async function hulplijnBlok(kc, ouder) {
    var m = await gezinApi('/school/hulplijn/mijn', { klasCode: kc }).catch(function () { return null; });
    if (!m || !m.ok) return '';
    var lijst = (m.meldingen || []).map(function (x) {
      return '<div class="mini" style="margin:.25rem 0;">' + esc(String(x.at).slice(0, 10)) + ' · ' + esc(x.naam) + ': ' + esc(x.tekst) +
        (x.vertrouwelijk ? ' <b>(vertrouwelijk: alleen de mentor)</b>' : '') +
        ' · <span style="color:var(--goud,#A98F1C);">' + (x.status === 'opgepakt' ? 'je mentor heeft het gezien' : 'staat klaar voor je mentor') + '</span></div>';
    }).join('') || '<div class="mini">' + (ouder ? 'Geen meldingen die jij mag zien; vertrouwelijke meldingen blijven tussen kind en mentor.' : 'Nog geen meldingen. De knop is er altijd, ook voor iets kleins.') + '</div>';
    var knop = ouder ? '<div class="mini h-mt40">De hulplijn-knop is van het kind zelf; die staat op het scherm van je kind.</div>'
      : '<div class="h-mt50">' +
        '<textarea class="veld" data-hulp-tekst="' + esc(kc) + '" rows="2" maxlength="500" placeholder="Wil je even praten? Schrijf hier wat er is; kort mag ook." style="width:100%;"></textarea>' +
        '<label class="mini" style="display:block;margin:.3rem 0;"><input type="checkbox" data-hulp-vertrouwelijk="' + esc(kc) + '"> Vertrouwelijk: alleen mijn mentor mag dit zien (mijn ouders niet)</label>' +
        '<label class="mini" style="display:block;margin:.3rem 0;"><input type="checkbox" data-hulp-acuut="' + esc(kc) + '"> Ik voel me nu niet veilig</label>' +
        '<button class="knop mini" data-doe="hulplijn" data-klas="' + esc(kc) + '">Stuur naar mijn mentor</button>' +
        '<div class="mini h-mt30" data-hulp-uit="' + esc(kc) + '"></div></div>';
    return kaart('De hulplijn · klas ' + esc(kc),
      '<div class="mini">Even praten met je mentor kan altijd: over school, thuis of iets anders. Jij bepaalt wie het ziet.</div>' +
      lijst + knop);
  }

  function bind() {
    wortel.querySelectorAll('[data-doe="hulplijn"]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var kc = b.dataset.klas;
        var uitEl = wortel.querySelector('[data-hulp-uit="' + kc + '"]');
        try {
          var r = await gezinApi('/school/hulplijn', {
            klasCode: kc,
            tekst: (wortel.querySelector('[data-hulp-tekst="' + kc + '"]') || {}).value,
            vertrouwelijk: !!(wortel.querySelector('[data-hulp-vertrouwelijk="' + kc + '"]') || {}).checked,
            acuut: !!(wortel.querySelector('[data-hulp-acuut="' + kc + '"]') || {}).checked
          });
          if (uitEl) uitEl.textContent = 'Verstuurd. ' + (r.wieZietDit || '');
          setTimeout(laad, 1200);
        } catch (e) { if (uitEl) uitEl.textContent = e.message; }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var lijst = $('#schoolLijst');
    if (!lijst) return;
    wortel = document.createElement('div');
    wortel.id = 'schoolHulplijn';
    lijst.parentNode.insertBefore(wortel, lijst.nextSibling);
    setTimeout(laad, 800); // na de eerste laadGezin en school-extra
  });
})();

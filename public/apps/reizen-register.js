/* HET REISREGISTER VAN TRAVELOS, op het RTG Design System.

   Dit stond als inline script in reizen.html. Het gedrag is hetzelfde: een
   reis met onderdelen (REIZEN.md fase 1) uit /api/reis/reizen, de stand van
   de wereld in hetzelfde antwoord, de lijn van vandaag, en wat RTG niet bij
   een reis kon plaatsen apart en niet bij de verkeerde. De stand en de lijn
   tekent ./reizen-stand.js. */
(function (w, d) {
  'use strict';
  var R = w.RTGReizen; if (!R) return;
  var $ = R.$;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g,
    function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var SOORT = { verblijf: 'Verblijf', reis: 'Reis', vlucht: 'Vlucht', charter: 'Charter' };
  var S = R.stand, tekenStand = S.tekenStand, rust = S.rust, tekenVandaag = S.tekenVandaag, opDeKlok = S.opDeKlok;

  /* De dag van een reisregel, in de taal van het lid. */
  function dagdeel(iso) {
    var x = new Date(iso + 'T00:00:00');
    if (isNaN(x)) return { wd: '', nr: iso || '', mnd: '' };
    var f = function (o) { return new Intl.DateTimeFormat(R.taal(), o).format(x); };
    return { wd: f({ weekday: 'long' }), nr: f({ day: '2-digit' }), mnd: f({ month: 'short' }) };
  }

  /* Een regel: alleen wat het domein weet. Sleepbaar in de werkruimte met
     precies wat er al op het scherm staat (WERKRUIMTE.md par. 6). */
  function reisRegel(x) {
    var dd = dagdeel(x.van), feiten = [];
    if (x.personen) feiten.push(x.personen + ' ' + (x.personen === 1 ? 'reiziger' : 'reizigers'));
    if (x.wacht) feiten.push(x.wacht.charAt(0).toUpperCase() + x.wacht.slice(1));
    var titel = x.titel || SOORT[x.soort] || 'Reis';
    return '<li><a class="ds-lijst__rij reis" href="' + esc(x.link) + '"' + (x.sig ? ' data-sig="' + esc(x.sig) + '"' : '') +
      ' data-sleep="reis" data-sleep-id="' + esc(x.kenmerk || x.titel || '') + '" data-sleep-label="' +
      esc(titel + (x.bestemming ? ' naar ' + x.bestemming : '')) + '" data-sleep-datum="' + esc(x.van || '') + '">' +
      '<span class="ds-lijst__tijd">' + esc(dd.nr) + '<br>' + esc(dd.mnd) + '</span>' +
      '<span><span class="ds-lijst__titel">' + esc(titel) + (x.bestemming ? ' · ' + esc(x.bestemming) : '') + '</span>' +
      '<span class="ds-lijst__tekst">' + [dd.wd, x.status, feiten.join(' · '), x.app].filter(Boolean).map(esc).join(' · ') + '</span>' +
      (x.kenmerk ? '<button class="ds-chip" type="button" data-ref="' + esc(x.kenmerk) + '" title="Kopieer kenmerk">' + esc(x.kenmerk) + '</button>' : '') +
      '</span><span aria-hidden="true">›</span></a></li>';
  }
  function vensterTekst(v) {
    var a = dagdeel(v.van), b = dagdeel(v.tot);
    if (v.van === v.tot) return a.nr + ' ' + a.mnd;
    return a.mnd === b.mnd ? a.nr + '-' + b.nr + ' ' + b.mnd : a.nr + ' ' + a.mnd + ' - ' + b.nr + ' ' + b.mnd;
  }
  /* De kop van een reis, met de knop om een reisgenoot uit te nodigen: je
     nodigt iemand uit VOOR IETS. */
  function reisBlok(r, rij) {
    var n = r.telling.onderdelen;
    return '<section class="ds-taak__kop" data-reis="' + esc(r.id) + '"><div data-reiskop><h3 class="ds-kaart__titel">' + esc(r.bestemming) +
      ' · ' + esc(vensterTekst(r.venster)) + '</h3><p class="ds-meta">' + n + (n === 1 ? ' onderdeel' : ' onderdelen') + '</p></div>' +
      (n > 1 ? '<p class="ds-meta">' + esc(r.grond) + '</p>' : '') +
      '<div><button class="ds-knop ds-knop--stil ds-knop--klein" type="button" data-nodig="' + esc(r.id) + '">Nodig een reisgenoot uit</button></div>' +
      '<div class="ds-meta" data-uitnodiging="' + esc(r.id) + '"></div><ul class="ds-lijst">' + rij.map(reisRegel).join('') + '</ul></section>';
  }

  var REIZEN = [];
  /* De kop is sfeer, geen demo-inhoud: een bestemming verschijnt pas als zij
     uit hetzelfde reisdossier komt dat het register tekent. */
  function zetReisdek(reizen, toestand) {
    var eerste = (reizen || [])[0];
    if (eerste) {
      var bestemming = String(eerste.bestemming || '').trim();
      $('#titelVandaag').textContent = bestemming ? bestemming.toLocaleUpperCase(R.taal()) : 'Uw volgende reis';
      $('#dagzin').textContent = 'Uit uw reisdossier.';
      $('#dagbeeldzin').textContent = bestemming ? 'Bestemming uit uw reisdossier.' : 'Uw volgende reis uit het dossier.';
      return;
    }
    $('#titelVandaag').textContent = 'Uw reizen';
    $('#dagzin').textContent = toestand === 'fout' ? (R.token ? 'Reisgegevens zijn nu niet beschikbaar.'
      : 'Meld u aan om uw eigen reizen hier te zien.') : 'Er staat nog geen reis in uw dossier.';
    $('#dagbeeldzin').textContent = toestand === 'fout' ? 'De bron kon niet worden bevestigd.' : 'Een bestemming verschijnt zodra die in uw dossier staat.';
  }

  function teken(dt) {
    var reizen = REIZEN = dt.reizen || [];
    zetReisdek(reizen, 'geladen');
    var los = (dt.los || []).map(function (x) { return x.onderdeel; });
    var alles = reizen.reduce(function (a, r) { return a.concat(r.onderdelen); }, []).concat(los);
    tekenStand(dt, reizen.length);
    tekenVandaag(alles);
    // wat op de lijn staat, staat niet nog eens in het register
    var blokken = reizen.map(function (r) {
      var rij = r.onderdelen.filter(function (x) { return !opDeKlok(x); });
      return rij.length ? reisBlok(r, rij) : '';
    }).filter(Boolean);
    var losRest = los.filter(function (x) { return !opDeKlok(x); });
    if (losRest.length) blokken.push('<section class="ds-taak__kop" data-reis="los"><div data-reiskop><h3 class="ds-kaart__titel">Nog niet bij een reis geplaatst</h3>' +
      '<p class="ds-meta">' + losRest.length + '</p></div><p class="ds-meta">Van deze onderdelen weet RTG niet zeker bij welke reis ze horen. ' +
      'Ze staan daarom apart, en niet bij de verkeerde.</p><ul class="ds-lijst">' + losRest.map(reisRegel).join('') + '</ul></section>');
    $('#tel').textContent = reizen.length ? reizen.length + (reizen.length === 1 ? ' reis' : ' reizen') : '';
    $('#komend').innerHTML = blokken.length ? blokken.join('') : (alles.length
      ? '<p class="ds-meta">Verder staat er niets gepland; wat er vandaag vertrekt, staat hierboven.</p>'
      : '<p class="ds-meta">Er staat niets gepland. Zodra u ergens boekt, in welke reisapp dan ook, verschijnt het hier vanzelf.</p>');
    R.$$('[data-nodig]', $('#komend')).forEach(function (b) { b.addEventListener('click', function () { nodigUit(b); }); });
    R.$$('[data-ref]', $('#komend')).forEach(function (b) { b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(b.dataset.ref).then(function () { var t = b.textContent;
        b.textContent = 'gekopieerd'; setTimeout(function () { b.textContent = t; }, 1200); }).catch(function () {});
    }); });
  }

  function laad() {
    /* De stand staat er vanaf de eerste seconde, en zegt dan wat hij is:
       onbekend. Een leeg gat leest als 'niets aan de hand'. */
    tekenStand({});
    return R.api('/api/reis/reizen', {}).then(teken).catch(function (e) {
      zetReisdek([], 'fout');
      rust(e.message + ' Log eerst in via de leden-app.');
      $('#komend').innerHTML = '<p class="ds-meta">' + esc(e.message) + ' Log eerst in via de leden-app.</p>';
    });
  }

  /* Een reisgenoot uitnodigen: de regels van deze reis gaan mee, verder
     niets. Versturen doet u zelf; RTG mailt hier niemand. */
  function nodigUit(knop) {
    var reis = REIZEN.find(function (x) { return x.id === knop.dataset.nodig; });
    var vak = $('#komend').querySelector('[data-uitnodiging="' + knop.dataset.nodig + '"]');
    if (!reis || !vak) return;
    knop.disabled = true; vak.textContent = 'Klaarzetten...';
    R.api('/api/reis/uitnodiging/nodig-uit', { onderdelen: reis.onderdelen.map(function (o) {
      return { soort: o.soort, titel: o.titel, bestemming: o.bestemming, van: o.van, tot: o.tot, kenmerk: o.kenmerk }; }) })
      .then(function (dt) {
        var link = location.origin + dt.link;
        vak.innerHTML = '<p>Stuur deze link naar uw reisgenoot. Hij ziet alleen waar en wanneer; ' +
          'de reis komt pas bij hem te staan nadat hij zich heeft gelegitimeerd.</p><div class="ds-veld"><span></span>' +
          '<input class="ds-veld__invoer" readonly value="' + esc(link) + '" aria-label="Uitnodigingslink"><button class="ds-knop ds-knop--stil ds-knop--klein" type="button">Kopieer</button></div>';
        var kb = vak.querySelector('button');
        kb.addEventListener('click', function () { if (navigator.clipboard) navigator.clipboard.writeText(link).then(function () { kb.textContent = 'gekopieerd'; }).catch(function () {}); });
      }).catch(function (e) { vak.textContent = e.message; knop.disabled = false; });
  }

  /* Een regel oppakken en aan de schil aanbieden, alleen binnen een surface.
     Pas bij echte beweging een sleep; een tik blijft een tik. */
  (function sleepbaar() {
    var inSchil = false;
    try { inSchil = w.top !== w.self; } catch (e) { inSchil = false; }
    if (!inSchil) return;
    d.addEventListener('pointerdown', function (e) {
      var a = e.target.closest('[data-sleep]'); if (!a) return;
      var bewogen = false, x0 = e.clientX, y0 = e.clientY;
      function beweeg(m) {
        if (bewogen || Math.abs(m.clientX - x0) + Math.abs(m.clientY - y0) < 8) return;
        bewogen = true;
        w.parent.postMessage({ rtg: 'sleep-start', object: { soort: a.dataset.sleep, id: a.dataset.sleepId,
          label: a.dataset.sleepLabel, velden: { datum: a.dataset.sleepDatum } } }, location.origin);
      }
      function los() {
        d.removeEventListener('pointermove', beweeg); d.removeEventListener('pointerup', los);
        if (bewogen) a.addEventListener('click', function (c) { c.preventDefault(); }, { once: true });
      }
      d.addEventListener('pointermove', beweeg); d.addEventListener('pointerup', los);
    });
  })();

  R.$('[data-ververs-reizen]').addEventListener('click', laad);
  R.register = { laad: laad, tekenStand: tekenStand, opDeKlok: opDeKlok };
  laad();
})(window, document);

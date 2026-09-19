/* RTG Notities & Taken, het scherm: het bord (vastgepind eerst), de editor
   voor notities en lijsten, vinkjes die meteen doorgaan naar de server,
   delen op codenaam (samen bewerken) en de herinnering die een gekoppelde
   afspraak in RTG Agenda wordt. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var token = null;
  try { token = localStorage.getItem('rtg_member_token'); } catch (e) {}
  var api = function (pad, body) {
    return fetch('/api/notities/' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; });
    }).catch(function () { return { status: 0, body: { error: window.RTGDailyCopy.value('failed') } }; });
  };
  var meldT; var meld = function (t) {
    var m = $('#melding'); m.textContent = t; m.classList.add('zie');
    clearTimeout(meldT); meldT = setTimeout(function () { m.classList.remove('zie'); }, 3200);
  };

  var stand = null, open = null, archief = false;

  function laad() {
    return api('mijn').then(function (r) {
      if (r.status !== 200) { window.RTGDaily.render('notities', 'error', { retry: laad }); return meld(r.body.error || window.RTGDailyCopy.value('failed')); }
      stand = r.body;
      teken();
    });
  }

  /* Meenemen: de app kent zijn eigen model, dus geeft hij dat door in plaats
     van de gedeelde laag naar het scherm te laten raden -- een notitie is
     een titel plus tekst of een lijst met vinkjes, en zo hoort hij ook in
     het bestand te staan. */
  if (window.RTGUitvoer) {
    RTGUitvoer.bron(function () {
      if (!stand) return null;
      var alle = (stand.eigen || []).concat(stand.gedeeld || []);
      return {
        naam: 'notities',
        kolommen: ['soort', 'titel', 'inhoud', 'gewijzigd', 'van mij', 'gedeeld met'],
        rijen: alle.map(function (n) {
          var inhoud = n.soort === 'lijst'
            ? (n.items || []).map(function (i) { return (i.af ? '[x] ' : '[ ] ') + (i.tekst || ''); }).join(' / ')
            : (n.tekst || '');
          return [n.soort || 'notitie', n.titel || '', inhoud,
            (n.gewijzigd || '').slice(0, 10), n.vanMij ? 'ja' : 'nee',
            (n.gedeeldMet || []).join(', ')];
        })
      };
    });
  }
  function kaart(n) {
    var lijf = n.soort === 'lijst'
      ? (n.items || []).slice(0, 6).map(function (x, i) {
          return '<span class="taak' + (x.af ? ' af' : '') + '">' +
            '<input type="checkbox" data-vink="' + n.id + ':' + i + '"' + (x.af ? ' checked' : '') +
            ' aria-label="' + esc(x.t) + '"> <span data-user-content>' + esc(x.t) + '</span></span>';
        }).join('') + ((n.items || []).length > 6 ? '<span class="meta">nog ' + (n.items.length - 6) + ' punten</span>' : '')
      : '<p data-user-content>' + esc(n.tekst || '') + '</p>';
    var meta = n.gewijzigd ? ['<span translate="no">' + esc(window.RTGDailyCopy.date(n.gewijzigd)) + '</span>'] : [];
    if (n.vast) meta.push('<span class="goud">vastgepind</span>');
    if (n.herinnerOp) meta.push('<span class="goud">herinnering ' + esc(n.herinnerOp) + (n.herinnerTijd ? ' ' + n.herinnerTijd : '') + '</span>');
    if (n.door) meta.push('van ' + esc(n.door));
    if ((n.gedeeldMet || []).length) meta.push('gedeeld met ' + n.gedeeldMet.length);
    if (n.archief) meta.push('archief');
    return '<div class="nkaart' + (n.vast ? ' vast' : '') + '" data-open="' + n.id + '" role="button" tabindex="0">' +
      '<h3 data-user-content>' + esc(n.titel || '(zonder titel)') + '</h3>' + lijf +
      (meta.length ? '<span class="meta">' + meta.join(' · ') + '</span>' : '') + '</div>';
  }
  function teken() {
    if (!stand) return;
    var q = $('#zoek').value.trim().toLowerCase();
    var zeef = function (n) {
      if (!!n.archief !== archief) return false;
      if (!q) return true;
      return (n.titel + ' ' + (n.tekst || '') + ' ' + (n.items || []).map(function (x) { return x.t; }).join(' '))
        .toLowerCase().indexOf(q) >= 0;
    };
    var eigen = (stand.eigen || []).filter(zeef);
    var first = !archief && !q && !(stand.eigen || []).length && !(stand.gedeeld || []).length;
    window.RTGDaily.render('notities', first ? 'empty' : 'ready', { retry: laad });
    $('#bord').innerHTML = eigen.map(kaart).join('') ||
      '<p class="stil">' + (q ? window.RTGDailyCopy.text('noResults') : archief ? 'Het archief is leeg.' : window.RTGDailyCopy.text('emptyNotes')) + '</p>';
    var gedeeld = archief ? [] : (stand.gedeeld || []).filter(zeef);
    $('#gedeeldKop').style.display = gedeeld.length ? '' : 'none';
    $('#gedeeldBord').innerHTML = gedeeld.map(kaart).join('');
    Array.prototype.forEach.call(document.querySelectorAll('[data-open]'), function (el) {
      el.addEventListener('click', function () { toon(el.dataset.open); });
    });
    // een vinkje op de kaart zelf: direct door, zonder de editor te openen
    Array.prototype.forEach.call(document.querySelectorAll('[data-vink]'), function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var p = el.dataset.vink.split(':');
        api('vink', { id: p[0], index: +p[1], af: el.checked }).then(function (r) { if (r.status !== 200 || r.body.error) { el.checked = !el.checked; return meld(r.body.error || window.RTGDailyCopy.value('failed')); } laad(); });
      });
    });
  }
  window.addEventListener('rtglang', teken);
  $('#zoek').addEventListener('input', teken);
  $('#toonArchief').addEventListener('click', function () {
    archief = !archief;
    this.classList.toggle('aan', archief);
    this.textContent = archief ? 'Terug naar het bord' : 'Archief';
    teken();
  });


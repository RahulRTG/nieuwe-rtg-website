/* RTG Galerij, het bord: de tijdlijn per maand, de terugblik-rij, albums
   en favorieten. Salon-beelden laden direct (/media/); beelden uit RTG
   Bestanden laden lui, pas als ze in beeld komen (IntersectionObserver),
   met een kleine cache. De kijker staat in kijker.js. */
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
    return fetch('/api/' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; });
    });
  };
  var meldT; var meld = function (t) {
    var m = $('#melding'); m.textContent = t; m.classList.add('zie');
    clearTimeout(meldT); meldT = setTimeout(function () { m.classList.remove('zie'); }, 3200);
  };
  var MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

  var stand = null, weergave = 'tijdlijn', openAlbum = null;
  var sleutel = function (b) { return b.bron + ':' + b.id; };

  /* ---- beelden uit Bestanden lui laden, met cache ---- */
  var cache = {};
  var kijkt = new IntersectionObserver(function (waarnemingen) {
    waarnemingen.forEach(function (w) {
      if (!w.isIntersecting) return;
      var el = w.target;
      kijkt.unobserve(el);
      laadThumb(el.dataset.bid, el);
    });
  }, { rootMargin: '200px' });
  function laadThumb(bid, el) {
    if (cache[bid]) return zetBeeld(el, cache[bid]);
    api('bestanden/haal', { id: bid }).then(function (r) {
      if (r.body.error) { el.querySelector('.wacht').textContent = 'niet leesbaar'; return; }
      cache[bid] = r.body.dataUrl;
      zetBeeld(el, r.body.dataUrl);
    });
  }
  function zetBeeld(el, src) {
    var img = el.querySelector('img');
    img.src = src;
    var w = el.querySelector('.wacht'); if (w) w.remove();
  }
  function thumbData(b) { return cache[b.id] || null; }

  function thumb(b) {
    var binnen = b.src
      ? '<img src="' + esc(b.src) + '" alt="' + esc(b.naam || 'Beeld uit De Salon') + '" loading="lazy">'
      : '<img alt="' + esc(b.naam || 'Beeld') + '"><span class="wacht">laden</span>';
    return '<div class="thumb" data-open="' + esc(sleutel(b)) + '"' +
      (b.src ? '' : ' data-bid="' + esc(b.id) + '"') + ' role="button" tabindex="0">' + binnen +
      (b.favoriet ? '<span class="ster" aria-hidden="true">&#9733;</span>' : '') + '</div>';
  }
  function beeldenVan(weergave) {
    var alle = stand.beelden || [];
    if (weergave === 'fav') return alle.filter(function (b) { return b.favoriet; });
    if (openAlbum) {
      var a = (stand.albums || []).find(function (x) { return x.id === openAlbum; });
      if (!a) return [];
      return a.items.map(function (v) {
        return alle.find(function (b) { return b.bron === v.bron && String(b.id) === String(v.id); });
      }).filter(Boolean);
    }
    return alle;
  }
  function teken() {
    if (!stand) return;
    $('#albums').style.display = weergave === 'albums' ? '' : 'none';
    $('#tijdlijn').style.display = weergave === 'albums' ? 'none' : '';
    $('#albumPad').style.display = openAlbum ? '' : 'none';
    $('#toonFav').classList.toggle('aan', weergave === 'fav');
    $('#toonAlbums').classList.toggle('aan', weergave === 'albums');
    // de terugblik alleen op de gewone tijdlijn: een rustige rij, geen pop-up
    var terug = weergave === 'tijdlijn' && !openAlbum ? (stand.terugblik || []) : [];
    $('#terugblikWrap').style.display = terug.length ? '' : 'none';
    $('#terugblik').innerHTML = terug.map(thumb).join('');
    if (weergave === 'albums') {
      $('#albums').innerHTML = (stand.albums || []).map(function (a) {
        return '<div class="albumkaart" data-album="' + a.id + '" role="button" tabindex="0"><b>' + esc(a.naam) + '</b>' +
          '<span>' + a.items.length + (a.items.length === 1 ? ' beeld' : ' beelden') + '</span>' +
          '<button class="knop" data-hernoem="' + a.id + '" type="button">Hernoem</button>' +
          '<button class="knop" data-albumweg="' + a.id + '" type="button">Weg</button></div>';
      }).join('') || '<p class="stil">Nog geen albums. Een album is een verzameling verwijzingen; de beelden blijven gewoon waar ze zijn.</p>';
    } else {
      var lijst = beeldenVan(weergave);
      if (openAlbum) {
        var a = (stand.albums || []).find(function (x) { return x.id === openAlbum; });
        $('#albumPad').innerHTML = 'Album · ' + esc(a ? a.naam : '') +
          ' &nbsp;<button class="knop" id="albumTerug" type="button">Terug</button>';
        $('#tijdlijn').innerHTML = '<div class="raster">' + lijst.map(thumb).join('') + '</div>' ||
          '<p class="stil">Dit album is nog leeg.</p>';
      } else {
        // per maand een kop; de tijdlijn is de kalender, meer niet
        var perMaand = {};
        lijst.forEach(function (b) {
          var k = String(b.op || '').slice(0, 7) || 'zonder datum';
          (perMaand[k] = perMaand[k] || []).push(b);
        });
        $('#tijdlijn').innerHTML = Object.keys(perMaand).sort().reverse().map(function (k) {
          var naam = /^\d{4}-\d{2}$/.test(k) ? MAANDEN[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4) : k;
          return '<div class="kop">' + esc(naam) + '</div><div class="raster">' +
            perMaand[k].map(thumb).join('') + '</div>';
        }).join('') || '<p class="stil">' + (weergave === 'fav'
          ? 'Nog geen favorieten. Open een beeld en druk op Favoriet.'
          : 'Nog geen beelden. Plaats iets in De Salon of zet een foto in RTG Bestanden; hij verschijnt hier vanzelf.') + '</p>';
      }
    }
    Array.prototype.forEach.call(document.querySelectorAll('.thumb[data-bid]'), function (el) { kijkt.observe(el); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-open]'), function (el) {
      el.addEventListener('click', function () { window.RTGGalerijKijker.open(el.dataset.open, beeldenVan(weergave)); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-album]'), function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.dataset.hernoem || e.target.dataset.albumweg) return;
        openAlbum = el.dataset.album; weergave = 'tijdlijn'; teken();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-hernoem]'), function (el) {
      el.addEventListener('click', function () {
        var naam = prompt('Hoe heet dit album voortaan?');
        if (!naam || !naam.trim()) return;
        api('galerij/album', { id: el.dataset.hernoem, naam: naam.trim() }).then(laad);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-albumweg]'), function (el) {
      el.addEventListener('click', function () {
        if (!confirm('Dit album weghalen? De beelden zelf blijven gewoon staan.')) return;
        api('galerij/album', { id: el.dataset.albumweg, weg: true }).then(laad);
      });
    });
    var at = $('#albumTerug');
    if (at) at.addEventListener('click', function () { openAlbum = null; teken(); });
  }
  function laad() {
    return api('galerij/mijn').then(function (r) {
      if (r.status !== 200) return meld(r.body.error || 'Log eerst in op de leden-app.');
      stand = r.body;
      teken();
    });
  }
  $('#toonFav').addEventListener('click', function () {
    weergave = weergave === 'fav' ? 'tijdlijn' : 'fav'; openAlbum = null; teken();
  });
  $('#toonAlbums').addEventListener('click', function () {
    weergave = weergave === 'albums' ? 'tijdlijn' : 'albums'; openAlbum = null; teken();
  });
  $('#nieuwAlbum').addEventListener('click', function () {
    var naam = prompt('Hoe heet het nieuwe album?');
    if (!naam || !naam.trim()) return;
    api('galerij/album', { naam: naam.trim() }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      weergave = 'albums'; laad();
    });
  });

  window.RTGGalerij = { api: api, meld: meld, laad: laad, thumbData: thumbData,
    stand: function () { return stand; } };
  if (!token) meld('Log eerst in op de leden-app.'); else laad();
})();

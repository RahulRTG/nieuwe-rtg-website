/* RTG Bestanden, het paneel: een bestand openen met voorvertoning (beeld en
   tekst meteen zichtbaar), hernoemen en verplaatsen, ster, delen op
   codenaam, downloaden, versies bekijken en terugzetten, en de prullenbak-
   knoppen. Praat via window.RTGBestanden (app.js). */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var B = function () { return window.RTGBestanden; };
  var open = null;

  function vind(id) {
    var s = B().stand();
    return (s.items || []).concat(s.gedeeld || []).find(function (x) { return x.id === id; }) || null;
  }
  function toon(id) {
    open = vind(id);
    if (!open) return;
    $('#bkNaam').value = open.naam;
    $('#bkNaam').readOnly = !open.vanMij;
    $('#bkMeta').textContent = (open.mime || '') + ' · ' + B().maat(open.bytes) +
      (open.gewijzigd ? ' · gewijzigd ' + open.gewijzigd.slice(0, 10) : '') + (open.vanMij ? '' : ' · met u gedeeld');
    var s = B().stand();
    $('#bkMap').innerHTML = '<option value="">Kluis (geen map)</option>' + (s.mappen || []).map(function (m) {
      return '<option value="' + m.id + '"' + (open.map === m.id ? ' selected' : '') + '>' + esc(m.naam) + '</option>';
    }).join('');
    $('#bkMap').parentNode.style.display = '';
    ['bkDeelWrap'].forEach(function (i) { $('#' + i).style.display = open.vanMij ? '' : 'none'; });
    $('#bkMap').style.display = open.vanMij ? '' : 'none';
    $('#bkGedeeld').textContent = (open.gedeeldMet || []).length ? 'Gedeeld met: ' + open.gedeeldMet.join(', ') : '';
    $('#bkSter').textContent = open.ster ? 'Ster eraf' : 'Ster';
    $('#bkSter').style.display = open.vanMij ? '' : 'none';
    $('#bkBewaar').style.display = open.vanMij ? '' : 'none';
    $('#bkWeg').textContent = !open.vanMij ? 'Haal mij eraf' : (open.weg ? 'Voorgoed weg' : 'Verwijder');
    $('#bkHerstel').style.display = open.weg ? '' : 'none';
    $('#bkKijk').style.display = 'none'; $('#bkKijk').innerHTML = '';
    $('#bkVersieWrap').style.display = 'none';
    $('#bkScrim').classList.add('open');
    kijk();
    versies();
  }
  /* ---- de voorvertoning: beeld en tekst meteen, de rest netjes benoemd ---- */
  function kijk() {
    var mime = String(open.mime || '');
    if (!/^image\/|^text\/|json$/.test(mime) || open.bytes > 2 * 1024 * 1024) return;
    var id = open.id;
    B().api('haal', { id: id }).then(function (r) {
      if (!open || open.id !== id || r.body.error) return;
      var k = $('#bkKijk'); k.style.display = '';
      if (/^image\//.test(mime)) {
        var img = new Image(); img.alt = open.naam; img.src = r.body.dataUrl; k.appendChild(img);
      } else {
        var pre = document.createElement('pre');
        try { pre.textContent = atob(r.body.dataUrl.split(',')[1]).slice(0, 4000); } catch (e) { pre.textContent = ''; }
        k.appendChild(pre);
      }
    });
  }
  function versies() {
    var id = open.id;
    B().api('versies', { id: id }).then(function (r) {
      if (!open || open.id !== id || r.body.error || !(r.body.versies || []).length) return;
      $('#bkVersieWrap').style.display = '';
      $('#bkVersies').innerHTML = r.body.versies.map(function (v) {
        return '<div class="versierij"><span style="flex:1;">' + esc(String(v.op || '').slice(0, 16).replace('T', ' ')) +
          ' · ' + B().maat(v.bytes) + (v.door ? ' · door ' + esc(v.door) : '') + '</span>' +
          '<button class="knop" data-vh="' + v.n + '" type="button">Bekijk</button>' +
          '<button class="knop" data-vt="' + v.n + '" type="button">Zet terug</button></div>';
      }).join('');
      Array.prototype.forEach.call($('#bkVersies').querySelectorAll('[data-vh]'), function (el) {
        el.addEventListener('click', function () { haal(+el.dataset.vh); });
      });
      Array.prototype.forEach.call($('#bkVersies').querySelectorAll('[data-vt]'), function (el) {
        el.addEventListener('click', function () {
          B().api('versieterug', { id: open.id, n: +el.dataset.vt }).then(function (r2) {
            if (r2.body.error) return B().meld(r2.body.error);
            B().meld('Teruggezet; de huidige versie is zelf een versie geworden.');
            dicht(); B().laad();
          });
        });
      });
    });
  }
  /* ---- downloaden: als blob, met de eigen naam ---- */
  function haal(n) {
    B().api('haal', n == null ? { id: open.id } : { id: open.id, versie: n }).then(function (r) {
      if (r.body.error) return B().meld(r.body.error);
      var deel = r.body.dataUrl.split(',');
      var bytes = atob(deel[1]), arr = new Uint8Array(bytes.length);
      for (var i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([arr], { type: r.body.mime || 'application/octet-stream' }));
      var a = document.createElement('a');
      a.href = url; a.download = r.body.naam || 'bestand';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    });
  }

  $('#bkBewaar').addEventListener('click', function () {
    B().api('wijzig', { id: open.id, naam: $('#bkNaam').value, map: $('#bkMap').value || null })
      .then(function (r) {
        if (r.body.error) return B().meld(r.body.error);
        B().meld('Bewaard.'); dicht(); B().laad();
      });
  });
  $('#bkSter').addEventListener('click', function () {
    B().api('wijzig', { id: open.id, ster: !open.ster }).then(function () { dicht(); B().laad(); });
  });
  $('#bkHaal').addEventListener('click', function () { haal(null); });
  $('#bkNieuwVersie').addEventListener('click', function () { $('#versiekiezer').click(); });
  $('#versiekiezer').addEventListener('change', function () {
    var f = this.files && this.files[0]; this.value = '';
    if (!f || !open) return;
    B().meld('Bezig met de nieuwe versie.');
    B().stuur(f, open.id).then(function (r) {
      if (r.body.error) return B().meld(r.body.error);
      B().meld('Nieuwe versie geplaatst; de oude staat in de geschiedenis.');
      dicht(); B().laad();
    });
  });
  $('#bkDeel').addEventListener('click', function () {
    var code = $('#bkCode').value.trim();
    if (!code) return;
    B().api('deel', { id: open.id, codenaam: code }).then(function (r) {
      if (r.body.error) return B().meld(r.body.error);
      $('#bkCode').value = '';
      open.gedeeldMet = r.body.gedeeldMet || [];
      $('#bkGedeeld').textContent = 'Gedeeld met: ' + open.gedeeldMet.join(', ');
      B().meld('Gedeeld; de ander kan kijken en nieuwe versies plaatsen.');
    });
  });
  $('#bkWeg').addEventListener('click', function () {
    var vraag = !open.vanMij ? 'Uzelf van dit gedeelde bestand halen?'
      : (open.weg ? 'Dit bestand voorgoed weggooien, met alle versies?' : 'Naar de prullenbak? Herstellen kan 30 dagen.');
    if (!confirm(vraag)) return;
    B().api('weg', { id: open.id }).then(function (r) {
      if (r.body.error) return B().meld(r.body.error);
      B().meld(r.body.prullenbak ? 'In de prullenbak; herstellen kan 30 dagen.' : 'Gebeurd.');
      dicht(); B().laad();
    });
  });
  $('#bkHerstel').addEventListener('click', function () {
    B().api('herstel', { id: open.id }).then(function () {
      B().meld('Terug in de kluis.'); dicht(); B().laad();
    });
  });
  function dicht() { $('#bkScrim').classList.remove('open'); open = null; }
  /* WIE ER OPENSTAAT, LEESBAAR VAN BUITEN. De adaptieve laag (apps/bestanden/
     adaptief.js) heeft het bestand zelf nodig -- niet om er iets mee te doen,
     maar om te weten welk gewicht de handelingen hier hebben: een bestand naar
     de prullenbak is terug te draaien, een bestand dat er al in ligt niet.

     Alleen LEZEN. Wie hier ooit een setter bijzet, geeft twee lagen de
     mogelijkheid te bepalen welk bestand openstaat, en dan is de vraag welke van
     de twee gelijk heeft. */
  window.RTGBestandenPaneel = { open: function () { return open; } };
  $('#bkDicht').addEventListener('click', dicht);

  /* Meenemen: de kluis geeft zijn EIGEN model mee (naam, map, grootte, soort,
     datum, versies) in plaats van de gedeelde laag naar het scherm te laten
     raden. De inhoud van de bestanden gaat niet mee -- daarvoor is de
     Download-knop hierboven. Hij staat in dit tweede script omdat het bord
     (app.js) al tegen de bestandsgrens aan zit; het model is hetzelfde, want
     het komt via RTGBestanden.stand() uit dezelfde plek. */
  if (window.RTGUitvoer) {
    RTGUitvoer.bron(function () {
      var s = B() && B().stand();
      if (!s) return null;
      var map = function (id) {
        var m = (s.mappen || []).find(function (x) { return x.id === id; });
        return m ? m.naam : '';
      };
      return {
        naam: 'bestanden',
        kolommen: ['naam', 'map', 'grootte', 'soort', 'gewijzigd', 'versies', 'ster', 'prullenbak', 'herkomst'],
        rijen: (s.items || []).concat(s.gedeeld || []).map(function (it) {
          return [it.naam || '', map(it.map), it.bytes || 0, it.mime || '',
            String(it.gewijzigd || '').slice(0, 10), it.versies || 0,
            it.ster ? 'ja' : 'nee', it.weg ? 'ja' : 'nee',
            it.vanMij ? 'van mij' : 'gedeeld met mij'];
        })
      };
    });
  }

  window.RTGBestandenPaneel = { open: toon };
})();

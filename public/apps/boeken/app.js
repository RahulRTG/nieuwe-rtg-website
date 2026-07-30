/* RTG Boeken, het scherm: de plank (huisbibliotheek + je eigen
   tekstbestanden uit de Bestanden-kluis) en een rustige lezer met
   instelbare lettergrootte. De leesplek gaat als een getal tussen 0 en 1
   naar je account, zodat je op elk toestel verdergaat waar je was --
   meer dan die plek bewaart de server niet. */
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
    return fetch(pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; });
    });
  };

  var voortgang = {};
  function balk(id) {
    var v = voortgang[id];
    var pct = v ? Math.round(v.plek * 100) : 0;
    return '<span class="vgang" aria-hidden="true"><span style="width:' + pct + '%"></span></span>' +
      (v ? '<span class="stil">' + (pct >= 99 ? 'uitgelezen' : pct + '% gelezen') + '</span>' : '<span class="stil">nog niet begonnen</span>');
  }
  function kaart(b) {
    return '<button class="boek" data-boek="' + esc(b.boek) + '" type="button">' +
      '<b>' + esc(b.titel) + '</b><span class="stil">' + esc(b.sub) + '</span>' + balk(b.boek) + '</button>';
  }

  function tekenPlank(bieb, kluis) {
    $('#plank').innerHTML = bieb.map(function (b) {
      return kaart({ boek: b.id, titel: b.titel, sub: b.auteur + ' · ' + b.over + ' · ' + b.woorden + ' woorden' });
    }).join('');
    $('#eigenKop').style.display = kluis.length ? '' : 'none';
    $('#eigen').innerHTML = kluis.map(function (f) {
      return kaart({ boek: 'kluis:' + f.id, titel: f.naam.replace(/\.txt$/, ''), sub: 'uit je Bestanden-kluis' });
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('[data-boek]'), function (el) {
      el.addEventListener('click', function () { open(el.dataset.boek); });
    });
  }

  /* ---- de lezer ---- */
  var huidig = null, bewaarT = null;
  function open(boek) {
    var laadTekst = boek.indexOf('kluis:') === 0
      ? api('/api/bestanden/haal', { id: boek.slice(6) }).then(function (r) {
          if (r.body.error) throw new Error(r.body.error);
          var b64 = String(r.body.dataUrl || '').split(',')[1] || '';
          var bin = atob(b64), bytes = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          return { titel: r.body.naam.replace(/\.txt$/, ''), auteur: 'uit je kluis',
            tekst: new TextDecoder('utf-8').decode(bytes) };
        })
      : api('/api/boeken/boek', { id: boek }).then(function (r) {
          if (r.body.error) throw new Error(r.body.error);
          return r.body;
        });
    laadTekst.then(function (b) {
      huidig = boek;
      $('#leesTitel').textContent = b.titel;
      $('#leesAuteur').textContent = b.auteur;
      $('#tekst').textContent = b.tekst;
      $('#plankBlok').hidden = true;
      $('#leesBlok').hidden = false;
      var v = voortgang[boek];
      requestAnimationFrame(function () {
        var el = $('#tekst');
        el.scrollTop = v ? v.plek * Math.max(0, el.scrollHeight - el.clientHeight) : 0;
      });
    }).catch(function (e) { $('#melding').textContent = e.message; $('#melding').classList.add('zie'); });
  }
  $('#tekst').addEventListener('scroll', function () {
    if (!huidig) return;
    clearTimeout(bewaarT);
    bewaarT = setTimeout(function () {
      var el = $('#tekst');
      var ruimte = Math.max(1, el.scrollHeight - el.clientHeight);
      var plek = Math.min(1, Math.max(0, el.scrollTop / ruimte));
      api('/api/boeken/lees', { boek: huidig, plek: plek }).then(function (r) {
        if (!r.body.error) voortgang[huidig] = { plek: r.body.plek };
      });
    }, 600);
  });
  $('#terug').addEventListener('click', function () {
    huidig = null;
    $('#leesBlok').hidden = true;
    $('#plankBlok').hidden = false;
    start();
  });
  var MATEN = [1, 1.15, 1.32];
  var maat = 1;
  try { maat = Number(localStorage.getItem('rtg_boeken_maat')) || 1; } catch (e) {}
  function zetMaat() {
    $('#tekst').style.fontSize = MATEN[maat] + 'rem';
    try { localStorage.setItem('rtg_boeken_maat', String(maat)); } catch (e) {}
  }
  $('#kleiner').addEventListener('click', function () { maat = Math.max(0, maat - 1); zetMaat(); });
  $('#groter').addEventListener('click', function () { maat = Math.min(MATEN.length - 1, maat + 1); zetMaat(); });

  function start() {
    Promise.all([api('/api/boeken/bieb'), api('/api/boeken/voortgang'), api('/api/bestanden/mijn')])
      .then(function (rs) {
        if (rs[0].body.error) throw new Error(rs[0].body.error);
        voortgang = (rs[1].body && rs[1].body.voortgang) || {};
        var kluis = ((rs[2].body && rs[2].body.items) || []).filter(function (x) {
          return x.mime === 'text/plain' && !x.weg;
        });
        tekenPlank(rs[0].body.boeken, kluis);
      })
      .catch(function (e) { $('#plank').innerHTML = '<p class="stil">' + esc(e.message) + '</p>'; });
  }

  if (!token) {
    $('#plank').innerHTML = '<p class="stil">Log eerst in op de leden-app.</p>';
    return;
  }
  zetMaat();
  start();
})();

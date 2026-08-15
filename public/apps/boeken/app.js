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
  var huidig = null, bewaarT = null, wachtendeBewaring = null;
  var bewaarBezig = Promise.resolve(true);
  function melding(tekst) {
    $('#melding').textContent = tekst;
    $('#melding').classList.add('zie');
  }
  function plekVan(el) {
    var ruimte = Math.max(1, el.scrollHeight - el.clientHeight);
    return Math.min(1, Math.max(0, el.scrollTop / ruimte));
  }
  /* Leg boek + plek vast op het SCROLLMOMENT. De oude timer keek pas 600 ms
     later naar `huidig`; na een snelle tik op Terug was dat inmiddels null en
     werd de echte leesplek dus niet opgeslagen. Bewaringen lopen bovendien
     achter elkaar, zodat een trage eerdere aanvraag nooit een nieuwere plek
     kan overschrijven. */
  function bewaarNu() {
    clearTimeout(bewaarT);
    bewaarT = null;
    var taak = wachtendeBewaring;
    wachtendeBewaring = null;
    if (!taak) return bewaarBezig;
    bewaarBezig = bewaarBezig.catch(function () { return false; }).then(function () {
      return api('/api/boeken/lees', taak).then(function (r) {
        if (r.body.error) throw new Error(r.body.error);
        voortgang[taak.boek] = { plek: r.body.plek };
        return true;
      });
    }).catch(function () {
      melding('Je leesplek kon nog niet veilig worden bewaard. Probeer het straks opnieuw.');
      return false;
    });
    return bewaarBezig;
  }
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
    var taak = { boek: huidig, plek: plekVan($('#tekst')) };
    /* De plank reageert direct; de serverbevestiging volgt stil op de
       achtergrond. Zo hoeft iemand nooit op een aparte knop te drukken. */
    voortgang[taak.boek] = { plek: taak.plek };
    wachtendeBewaring = taak;
    clearTimeout(bewaarT);
    bewaarT = setTimeout(bewaarNu, 600);
  });
  $('#terug').addEventListener('click', function () {
    var klaar = bewaarNu();
    huidig = null;
    $('#leesBlok').hidden = true;
    $('#plankBlok').hidden = false;
    tekenPlank(bieb, eigen);
    /* Lees pas opnieuw van de server nadat de laatste plek bevestigd is. Een
       trage GET kan de zojuist opgeslagen plek daardoor niet meer inhalen. */
    klaar.then(function (bewaard) { if (bewaard) start(); });
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

  var bieb = [], eigen = [];
  function start() {
    Promise.all([api('/api/boeken/bieb'), api('/api/boeken/voortgang'), api('/api/bestanden/mijn')])
      .then(function (rs) {
        if (rs[0].body.error) throw new Error(rs[0].body.error);
        voortgang = (rs[1].body && rs[1].body.voortgang) || {};
        var kluis = ((rs[2].body && rs[2].body.items) || []).filter(function (x) {
          return x.mime === 'text/plain' && !x.weg;
        });
        bieb = rs[0].body.boeken || [];
        eigen = kluis;
        tekenPlank(bieb, kluis);
      })
      .catch(function (e) { $('#plank').innerHTML = '<p class="stil">' + esc(e.message) + '</p>'; });
  }

  /* Meenemen: de plank zoals hij hier staat -- welk boek, van wie, en hoe ver
     je erin bent. De tekst van de boeken gaat niet mee; die is van de
     huisbibliotheek, je leesplek is van jou. */
  if (window.RTGUitvoer) {
    RTGUitvoer.bron(function () {
      if (!bieb.length && !eigen.length) return null;
      var pct = function (id) { return voortgang[id] ? Math.round(voortgang[id].plek * 100) : 0; };
      return {
        naam: 'boeken',
        kolommen: ['titel', 'auteur', 'uitgave', 'onderwerp', 'woorden', 'gelezen (%)', 'plank'],
        rijen: bieb.map(function (b) {
          return [b.titel || '', b.auteur || '', b.jaar || '', b.over || '', b.woorden || 0,
            pct(b.id), 'huisbibliotheek'];
        }).concat(eigen.map(function (f) {
          return [String(f.naam || '').replace(/\.txt$/, ''), '', '', '', '',
            pct('kluis:' + f.id), 'uit je kluis'];
        }))
      };
    });
  }

  if (!token) {
    $('#plank').innerHTML = '<p class="stil">Log eerst in op de leden-app.</p>';
    return;
  }
  zetMaat();
  start();
})();

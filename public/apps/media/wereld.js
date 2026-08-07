/* RTG Media -- de wereld: één catalogus, drie standen.

   MUZIEK, KIJK en FLOW zijn geen drie apps maar drie standen op dezelfde
   wereld: dezelfde makers, dezelfde bibliotheek, dezelfde regelaars. Wat u in
   FLOW hoort, staat één tik later als heel stuk voor u (zie blad.js).

   Twee dingen die dit scherm bewust NIET doet. Er is geen oneindige scroll: de
   wereld heeft een einde en dat staat eronder. En er staat bij ELK stuk waarom
   het er staat -- die zin komt van de server, uit dezelfde code die de
   volgorde bepaalt, en niet uit een geruststellend tekstje hier. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) { TOKEN = null; }

  function api(pad, body) {
    return fetch('/api/mediaos/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json().catch(function () { return {}; }); });
  }
  var meldT = null;
  function zeg(t) {
    var m = $('#melding'); m.textContent = t; m.classList.add('zien');
    clearTimeout(meldT); meldT = setTimeout(function () { m.classList.remove('zien'); }, 3000);
  }
  function el(soort, klasse, tekst) {
    var e = document.createElement(soort);
    if (klasse) e.className = klasse;
    if (tekst != null) e.textContent = tekst;
    return e;
  }
  function knop(tekst, klasse, doe) {
    var b = el('button', 'knop' + (klasse ? ' ' + klasse : ''), tekst);
    b.type = 'button';
    b.addEventListener('click', doe);
    return b;
  }

  var stand = null, modus = 'alles';

  /* ---- afspelen ----
     Muziek rekent uw eigen toestel uit met de motor van het Klankwerk; een
     video komt met bereik-verzoeken uit het Theater. Wat elders hoort te
     spelen (een clip staat op het toestel van de maker, live gaat van kijker
     naar kijker) zegt dat, en brengt u naar de app waar dat doorgeefluik
     staat. Een knop die doet alsof, is erger dan een knop die verwijst. */
  function stopAlles() {
    if (window.RTGStudioMotor) window.RTGStudioMotor.stop();
    var f = $('#film');
    f.pause(); f.removeAttribute('src'); f.load(); f.classList.remove('zien');
  }
  function speel(s) {
    stopAlles();
    if (s.spelen.soort === 'motor') {
      fetch('/api/muziek/uitgave', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
        body: JSON.stringify({ id: s.spelen.bron }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || d.error || !d.uitgave) return zeg((d && d.error) || 'Dat stuk kon niet geladen worden.');
          var u = d.uitgave;
          window.RTGStudioMotor.speel({ bpm: u.bpm, maten: u.maten, stappen: u.stappen, kanalen: u.kanalen }, { lus: false });
          $('#spTitel').textContent = s.titel;
          $('#spSub').textContent = s.maker.codenaam + ' · uw toestel rekent dit zelf uit; er reist geen bestand';
        });
      return;
    }
    if (s.spelen.soort === 'stream') {
      var f = $('#film');
      f.src = s.spelen.bron + '?token=' + encodeURIComponent(TOKEN);
      f.classList.add('zien');
      f.play().catch(function () {});
      $('#spTitel').textContent = s.titel;
      $('#spSub').textContent = s.maker.codenaam + ' · origineel beeld uit het Theater';
      return;
    }
    zeg(s.spelen.reden || 'Dit speelt in zijn eigen app.');
    window.location.href = s.spelen.bron;
  }

  /* ---- de kaart van één stuk ---- */
  function kaart(s) {
    var k = el('div', 'stuk' + (s.mijn ? ' mijn' : ''));
    k.appendChild(el('div', 'vorm', s.vormNaam));
    k.appendChild(el('div', 't', s.titel));
    var m = el('div', 'm');
    var mk = el('button', 'maker', s.maker.codenaam);
    mk.type = 'button';
    mk.addEventListener('click', function () { window.RTGMediaBlad.maker(s.maker.codenaam); });
    m.appendChild(mk);
    m.appendChild(document.createTextNode(' · ' + s.meta));
    k.appendChild(m);
    if (s.waarom) k.appendChild(el('div', 'waarom', s.waarom));

    var rij = el('div', 'rij');
    rij.appendChild(knop(s.spelen.soort === 'stream' ? '▶ Kijk' : (s.spelen.soort === 'motor' ? '▶ Luister' : '↗ Open'),
      'vol', function () { speel(s); }));
    rij.appendChild(knop('Alles hierover', '', function () { window.RTGMediaBlad.stuk(s.id); }));
    var bew = knop(s.bewaard ? '✓ Bewaard' : '+ Bewaar', s.bewaard ? 'aan' : '', function () {
      api('bewaar', { id: s.id, aan: !s.bewaard }).then(function (d) {
        if (d.error) return zeg(d.error);
        s.bewaard = d.bewaard;
        bew.textContent = s.bewaard ? '✓ Bewaard' : '+ Bewaar';
        bew.className = 'knop' + (s.bewaard ? ' aan' : '');
      });
    });
    rij.appendChild(bew);
    if (!s.mijn) {
      rij.appendChild(knop('Minder', '', function () { stuurSmaak('minder', { maker: s.maker.codenaam }); }));
      rij.appendChild(knop('Meer', '', function () { stuurSmaak('meer', { maker: s.maker.codenaam }); }));
    }
    k.appendChild(rij);
    return k;
  }

  function stuurSmaak(richting, doel) {
    var b = { richting: richting };
    if (doel && doel.maker) b.maker = doel.maker;
    if (doel && doel.onderwerp) b.onderwerp = doel.onderwerp;
    if (doel && doel.aan != null) b.aan = doel.aan;
    api('stuur', b).then(function (d) {
      if (d.error) return zeg(d.error);
      zeg(d.gedaan || 'Bijgewerkt.');
      haal();
    });
  }

  /* ---- de wereld tekenen ---- */
  function tekenStanden(d) {
    var nav = $('#standen'); nav.textContent = '';
    (d.modi || []).forEach(function (m) {
      var b = el('button', null, m.naam);
      b.type = 'button';
      b.setAttribute('aria-current', m.id === d.modus ? 'true' : 'false');
      b.addEventListener('click', function () { modus = m.id; haal(); });
      nav.appendChild(b);
    });
  }
  function tekenRegelaars(d) {
    var doos = $('#regelaars'); doos.hidden = false;
    var rij = $('#regelaarsRij'); rij.textContent = '';
    rij.appendChild(knop(d.smaak.verras ? 'Verras me staat aan' : 'Verras me', d.smaak.verras ? 'aan' : '', function () {
      stuurSmaak('verras', { aan: !d.smaak.verras });
    }));
    rij.appendChild(knop('Wis mijn hele smaakprofiel', 'rood', function () {
      stuurSmaak('reset', {});
    }));
    (d.smaak.nooitMakers || []).forEach(function (n) {
      rij.appendChild(knop('Laat ' + n + ' weer toe', '', function () { stuurSmaak('reset', { maker: n }); }));
    });
    (d.smaak.nooitOnderwerpen || []).forEach(function (n) {
      rij.appendChild(knop('Laat ' + n + ' weer toe', '', function () { stuurSmaak('reset', { onderwerp: n }); }));
    });
    var meer = Object.keys(d.smaak.makers || {}).filter(function (k) { return d.smaak.makers[k] === 1; });
    var minder = Object.keys(d.smaak.makers || {}).filter(function (k) { return d.smaak.makers[k] === -1; });
    $('#smaakStand').textContent = 'Meer: ' + (meer.join(', ') || '--') +
      ' · Minder: ' + (minder.join(', ') || '--') +
      ' · Nooit: ' + ((d.smaak.nooitMakers || []).concat(d.smaak.nooitOnderwerpen || []).join(', ') || '--');
  }
  function teken(d) {
    stand = d;
    if (d.error) { $('#uitleg').textContent = d.error; return; }
    tekenStanden(d);
    $('#uitleg').textContent = d.uitleg;
    var doos = $('#stukken'); doos.textContent = '';
    if (!d.stukken.length) {
      doos.appendChild(el('p', 'stil', 'Hier staat nog niets. Wat er komt, komt van makers die u volgt of van wat er nieuw bij komt.'));
    }
    d.stukken.forEach(function (s) { doos.appendChild(kaart(s)); });
    $('#einde').textContent = d.einde;

    var b = $('#buiten'); b.textContent = '';
    (d.buiten || []).forEach(function (x) {
      var k = el('div', 'kader');
      k.appendChild(el('b', null, x.vormNaam + ' staat nu buiten uw wereld'));
      k.appendChild(el('p', 'stil', x.reden));
      b.appendChild(k);
    });
    var w = $('#weggelaten'); w.textContent = '';
    if ((d.weggelaten || []).length) {
      var k2 = el('div', 'kader');
      k2.appendChild(el('b', null, d.weggelaten.length + ' stukken weggelaten op uw eigen verzoek'));
      d.weggelaten.forEach(function (x) { k2.appendChild(el('p', 'stil', x.id + ' -- ' + x.reden)); });
      w.appendChild(k2);
    }
    tekenRegelaars(d);
  }
  function haal() {
    api('wereld', { modus: modus }).then(teken);
  }

  $('#spStop').addEventListener('click', function () {
    stopAlles();
    $('#spTitel').textContent = 'Nog stil';
    $('#spSub').textContent = 'Kies iets uit uw wereld.';
  });

  /* Wat blad.js (de lade met de hub, de maker en het bord) nodig heeft. Eén
     api-ingang en één speler voor het hele scherm; geen tweede exemplaar. */
  window.RTGMediaOS = { api: api, zeg: zeg, el: el, knop: knop, speel: speel, haal: haal,
    kaart: kaart, stand: function () { return stand; } };

  haal();
  /* Een stuk-id in de hash opent meteen de hub: zo kan een link naar één stuk
     rondgaan (chat, e-mail) en toch in de hele wereld uitkomen. */
  var h = String(window.location.hash || '');
  if (h.indexOf('#stuk=') === 0) {
    setTimeout(function () { window.RTGMediaBlad.stuk(decodeURIComponent(h.slice(6))); }, 250);
  }
})();

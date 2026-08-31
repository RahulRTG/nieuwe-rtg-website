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


  /* Afspelen staat in ./speler.js: drie heel verschillende manieren waarop een
     stuk kan klinken of te zien zijn (de motor op dit toestel, een stroom uit
     het Theater, of rechtstreeks van het toestel van een ander), en dat is een
     eigen onderwerp -- en dit bestand blijft er onder de omvangregel mee. */
  var S = window.RTGMediaSpeler;

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
    var speelNaam = s.spelen.soort === 'stream' ? '▶ Kijk'
      : (s.spelen.soort === 'motor' ? '▶ Luister' : (s.spelen.soort === 'p2p' && S.deler ? '▶ Speel' : '↗ Open'));
    rij.appendChild(knop(speelNaam, 'vol', function () { S.speel(s); }));
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
  /* De lege stand komt uit shared/leeg.js. Hier stond een eigen kopie,
     geschreven voor de gedeelde bestond; twee kopieen van een vorm lopen
     gegarandeerd uit elkaar. */


  function teken(d) {
    stand = d;
    /* Welke clips op DIT toestel staan, zodat de deler ze kan uitdienen en de
       aanwezigheid kan kloppen. Zonder deze regel is een maker die hier zit
       voor iedereen "offline" terwijl zijn toestel gewoon aanstaat. */
    if (S.deler && !d.error) {
      S.deler.zetEigen((d.stukken || []).filter(function (x) { return x.vorm === 'clip' && x.mijn; })
        .map(function (x) { return x.id.slice(x.id.indexOf(':') + 1); }));
    }
    /* EEN UITGELOGD SCHERM IS GEEN FOUTMELDING. Hier stond alleen
       `$('#uitleg').textContent = d.error` en dan `return`: de zin "Niet
       ingelogd." kwam als kale regel bovenaan een leeg vlak van driehonderd
       pixels te staan, terwijl de LEGE stand er twee regels verderop al een
       vorm voor had (d.leeg). Twee wegen naar hetzelfde moment, en maar een
       ervan was ontworpen. Nu gebruiken ze allebei hetzelfde vlak. */
    if (d.error) {
      $('#uitleg').textContent = '';
      var doosF = $('#stukken'); doosF.textContent = '';
      doosF.appendChild(RTGLeeg.vlak({
        ey: 'RTG Media',
        titel: RTGLeeg.aangemeld() ? 'Dit lukte niet.' : 'Meld u aan om verder te gaan.',
        wat: d.error,
        stappen: RTGLeeg.aangemeld() ? [] : [{ tekst: 'Naar de leden-app', pad: '/apps/app.html' }]
      }));
      return;
    }
    tekenStanden(d);
    $('#uitleg').textContent = d.uitleg;
    var doos = $('#stukken'); doos.textContent = '';
    /* Een lege stand is geen leeg raster: de server zegt wat hier komt, waarom
       het er nu niet is, en welke stap dat opheft. Die tekst staat daar en niet
       hier, want de reden hangt van de gegevens af (zie kern/mediaos/leeg.js). */
    if (d.leeg) doos.appendChild(RTGLeeg.vlak({
      ey: 'RTG Media', titel: d.leeg.titel, wat: d.leeg.wat,
      waarom: d.leeg.waarom, stappen: d.leeg.stappen
    }));
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
    /* De regelaars horen bij UW wereld en niet bij die van uw werkgever: in de
       stand Zaak staat wat uw organisatie publiceert, en "minder van deze
       maker" slaat daar nergens op. De server stuurt daar dan ook geen
       smaakprofiel mee, en dit scherm verzint er geen. */
    if (d.smaak) tekenRegelaars(d); else $('#regelaars').hidden = true;
  }
  function haal() {
    api('wereld', { modus: modus }).then(teken);
  }

  /* Wat blad.js (de lade met de hub, de maker en het bord) nodig heeft. Eén
     api-ingang en één speler voor het hele scherm; geen tweede exemplaar. */
  window.RTGMediaOS = { api: api, zeg: zeg, el: el, knop: knop, speel: S.speel, haal: haal,
    kaart: kaart, stand: function () { return stand; },
    /* De lijsten- en deellaag (./lijst.js) praat ook met de GEWONE
       gesprekken-endpoints, want er is maar een berichtenweg in dit huis.
       Daarvoor heeft hij hetzelfde token nodig; een tweede uitlezing van
       localStorage zou een tweede plek zijn die kan gaan afwijken. */
    token: function () { return TOKEN; } };

  haal();
  /* Een stuk-id in de hash opent meteen de hub: zo kan een link naar één stuk
     rondgaan (chat, e-mail) en toch in de hele wereld uitkomen. */
  var h = String(window.location.hash || '');
  if (h.indexOf('#stuk=') === 0) {
    setTimeout(function () { window.RTGMediaBlad.stuk(decodeURIComponent(h.slice(6))); }, 250);
  }
})();

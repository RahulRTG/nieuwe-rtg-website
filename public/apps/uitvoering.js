/* HET SCHERM VAN DE UITVOERENDE MEDIA (UITVOEREND.md).

   Twee standen, en ze horen bij twee verschillende mensen: de MAKER stelt een
   partituur samen uit zijn eigen werk, de KIJKER vraagt om een uitvoering.

   WAT DIT SCHERM ANDERS DOET DAN EEN SPELER. Het toont het BEWIJS even groot als
   de montage zelf: waaruit de uitvoering bestaat, wat er niet in zit en waarom,
   en wat de maker heeft toegestaan. Een uitvoering is een bewering van RTG over
   het werk van iemand anders (par. 2.4); die hoort niet in de kleine lettertjes.

   EN EEN WEIGERING IS HIER EEN UITSLAG EN GEEN FOUTMELDING. Wie om 24 minuten
   vraagt van een werk waarvan de kern er 40 duurt, krijgt te lezen hoe lang die
   kern werkelijk is -- niet een rood kruis. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) { TOKEN = null; }
  var meldT = null;
  function zeg(t) {
    var m = $('#melding'); m.textContent = t; m.classList.add('zien');
    clearTimeout(meldT); meldT = setTimeout(function () { m.classList.remove('zien'); }, 3600);
  }
  function api(pad, lijf) {
    var h = { 'Content-Type': 'application/json' };
    if (TOKEN) h.Authorization = 'Bearer ' + TOKEN;
    return fetch(pad, { method: 'POST', headers: h, body: JSON.stringify(lijf || {}) })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; })
        .catch(function () { return { status: r.status, body: {} }; }); });
  }
  var el = function (tag, klas, tekst) {
    var n = document.createElement(tag);
    if (klas) n.className = klas;
    if (tekst != null) n.textContent = tekst;
    return n;
  };
  var sec = function (n) { return Math.round(Number(n) || 0) + 's'; };

  /* ---- de standen ---- */
  document.querySelectorAll('[data-stand]').forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll('[data-stand]').forEach(function (x) {
        x.setAttribute('aria-current', String(x === b));
      });
      $('#vlakLuister').hidden = b.dataset.stand !== 'luister';
      $('#vlakMaak').hidden = b.dataset.stand !== 'maak';
      $('#vlakStudio').hidden = b.dataset.stand !== 'studio';
      if (b.dataset.stand === 'maak') laadMijn();
      if (b.dataset.stand === 'studio' && window.RTGStudioLaad) window.RTGStudioLaad();
    };
  });

  /* ---- de kant van de kijker ---- */
  var partituren = [];
  function laadKeuze() {
    return api('/api/uitvoering/partituren').then(function (r) {
      partituren = (r.body && r.body.partituren) || [];
      var k = $('#kiesP');
      k.innerHTML = '';
      var klaar = partituren.filter(function (p) { return p.klaar; });
      if (!klaar.length) {
        k.appendChild(new Option(' -- u heeft nog geen partituur klaarstaan -- ', ''));
        return;
      }
      klaar.forEach(function (p) {
        k.appendChild(new Option(p.naam + ' · kern ' + sec(p.kernS) + ' van ' + sec(p.totaalS), p.id));
      });
    });
  }

  function toonWeigering(b) {
    var v = $('#uitslag'); v.hidden = false; v.innerHTML = '';
    v.appendChild(el('h2', null, 'Dat kan niet, en dit is waarom'));
    var w = el('div', 'weiger');
    w.appendChild(el('b', null, b.reden || 'Deze uitvoering kon niet worden samengesteld.'));
    v.appendChild(w);
    var g = b.bewijs || {};
    if (g.kernS != null) {
      var d = el('p', 'stil');
      d.textContent = 'Het onmisbare deel duurt ' + sec(g.kernS) + '; het hele werk ' + sec(g.totaalS) + '.';
      v.appendChild(d);
    }
    if (g.toestemming && !g.toestemming.inkorten) {
      v.appendChild(el('p', 'stil', 'De maker staat inkorten niet toe: dit werk bestaat alleen in zijn geheel.'));
    }
  }

  function toonUitvoering(b) {
    var v = $('#uitslag'); v.hidden = false; v.innerHTML = '';
    v.appendChild(el('h2', null, (b.partituur && b.partituur.naam) || 'Uitvoering'));
    v.appendChild(el('p', 'stil', b.uitleg || ''));

    var ol = el('ol');
    (b.uitvoering || []).forEach(function (r) {
      var li = el('li', 'regel');
      if (r.rol === 'kern') li.appendChild(el('div', 'kern', 'kern'));
      li.appendChild(el('b', null, r.titel || r.stukId));
      li.appendChild(el('div', 'stil', r.vormNaam + ' · ' + sec(r.van) + '-' + sec(r.tot) + ' (' + sec(r.duurS) + ')'));
      li.appendChild(el('div', 'waarom', r.waarom || ''));
      ol.appendChild(li);
    });
    v.appendChild(ol);

    /* HET BEWIJS. Alles hieronder komt uit het antwoord van de server; er wordt
       op dit scherm niets bij elkaar geteld. Zou dat wel gebeuren, dan zeggen
       twee lagen op een dag iets anders over dezelfde montage (BESTUUR.md). */
    var g = b.bewijs || {};
    var bw = el('div', 'bewijs');
    bw.appendChild(el('h3', null, 'Waaruit dit bestaat'));
    var dl = el('dl');
    var voegToe = function (naam, waarde) {
      dl.appendChild(el('dt', null, naam)); dl.appendChild(el('dd', null, waarde));
    };
    voegToe('U vroeg', (g.gevraagd && g.gevraagd.secondenBudget ? sec(g.gevraagd.secondenBudget) : 'het hele werk')
      + ' · diepte ' + ((g.gevraagd && g.gevraagd.diepte) || 3));
    voegToe('U krijgt', sec(g.gekozenS) + ' van ' + sec(g.totaalS));
    voegToe('Onmisbaar', sec(g.kernS));
    if (g.aanspraak) voegToe('Uw recht', g.aanspraak.herkomstNaam || g.aanspraak.herkomst);
    voegToe('De maker staat toe', [g.toestemming && g.toestemming.inkorten ? 'inkorten' : null,
      g.toestemming && g.toestemming.hermonteren ? 'hermonteren' : null]
      .filter(Boolean).join(' en ') || 'niets; alleen het hele werk');
    bw.appendChild(dl);

    (g.weggelaten || []).forEach(function (w) {
      bw.appendChild(el('p', 'weg', '· ' + (w.naam || w.fragmentId) + ' -- ' + w.reden));
    });
    (g.nietBeschikbaar || []).forEach(function (w) {
      bw.appendChild(el('p', 'weg', '· ' + (w.naam || w.fragmentId) + ' -- ' + w.reden));
    });
    if (g.herleidbaar) bw.appendChild(el('p', 'weg', g.herleidbaar));
    v.appendChild(bw);
  }

  $('#voerKnop').onclick = function () {
    var id = $('#kiesP').value;
    if (!id) { zeg('Kies eerst een partituur.'); return; }
    var b = Number($('#budget').value);
    api('/api/uitvoering/voer', { partituurId: id,
      secondenBudget: b > 0 ? b : undefined, diepte: Number($('#diepte').value) })
      .then(function (r) {
        if (r.body && r.body.geweigerd) { toonWeigering(r.body); return; }
        if (r.body && r.body.error) { zeg(r.body.error); return; }
        toonUitvoering(r.body);
      });
  };

  /* ---- de kant van de maker ---- */
  function laadMijn() {
    return api('/api/uitvoering/partituren').then(function (r) {
      partituren = (r.body && r.body.partituren) || [];
      var v = $('#mijnLijst'); v.innerHTML = '';
      v.appendChild(el('h2', null, 'Mijn partituren'));
      if (!partituren.length) {
        v.appendChild(el('p', 'stil', 'U heeft er nog geen. Maak er een hierboven; daarna wijst u er fragmenten uit uw eigen werk aan.'));
        return;
      }
      partituren.forEach(function (p) {
        var k = el('div', 'regel');
        k.appendChild(el('b', null, p.naam));
        k.appendChild(el('div', 'stil', (p.klaar ? 'staat klaar' : 'nog niet klaar') +
          ' · ' + (p.onderdelen || []).length + ' onderdelen · kern ' + sec(p.kernS) + ' van ' + sec(p.totaalS) +
          (p.aanspraakNodig ? ' · vraagt "' + p.aanspraakNodig + '"' : '') +
          (p.prijsCenten ? ' · ' + (p.prijsCenten / 100).toFixed(2) + ' euro' : '')));
        (p.onderdelen || []).forEach(function (o) {
          k.appendChild(el('div', 'stil', '· ' + (o.rol === 'kern' ? 'kern' : 'verdieping') + ' -- ' +
            o.naam + ' (' + sec(o.duurS) + ')'));
        });
        var rij = el('div', 'rij');
        rij.style.marginTop = '0.5rem';
        var kl = el('button', 'knop', p.klaar ? 'Terugtrekken' : 'Klaarzetten');
        kl.type = 'button';
        kl.onclick = function () {
          api('/api/uitvoering/partituur/zet', { id: p.id, klaar: !p.klaar }).then(function (r) {
            if (r.body && r.body.error) { zeg(r.body.error); return; }
            laadMijn(); laadKeuze();
          });
        };
        rij.appendChild(kl);
        var ink = el('button', 'knop', (p.toestemming && p.toestemming.inkorten) ? 'Inkorten staat aan' : 'Inkorten toestaan');
        ink.type = 'button';
        ink.onclick = function () {
          api('/api/uitvoering/partituur/zet', { id: p.id,
            toestemming: { inkorten: !(p.toestemming && p.toestemming.inkorten),
              hermonteren: !!(p.toestemming && p.toestemming.hermonteren) } })
            .then(function () { laadMijn(); });
        };
        rij.appendChild(ink);
        k.appendChild(rij);
        v.appendChild(k);
      });
    });
  }

  $('#maakKnop').onclick = function () {
    var naam = $('#nieuwNaam').value.trim();
    if (!naam) { zeg('Geef de partituur een naam.'); return; }
    api('/api/uitvoering/partituur/maak', { naam: naam }).then(function (r) {
      if (r.body && r.body.error) { zeg(r.body.error); return; }
      $('#nieuwNaam').value = '';
      zeg('Aangemaakt. Wijs er nu fragmenten uit uw eigen werk aan.');
      laadMijn(); laadKeuze();
    });
  };

  /* De studio roept dit aan nadat hij een fragment heeft toegevoegd, zodat de
     lijst en de keuze meteen kloppen. Een haak en geen tweede laadfunctie: twee
     plekken die dezelfde lijst ophalen, lopen uiteen. */
  window.RTGUitvoeringHerlaad = function () { laadMijn(); laadKeuze(); };

  laadKeuze();
})();

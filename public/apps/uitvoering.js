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

  /* Hoe een uitslag ERUITZIET staat in ./uitvoering-toon.js. Die laag krijgt de
     kleine helpers hieronder mee via het venster; twee exemplaren van `el` en
     `api` zouden twee plekken zijn waar hetzelfde misgaat. */
  window.RTGUitvoeringEl = el;
  window.RTGUitvoeringSec = sec;
  window.RTGUitvoeringApi = api;
  window.RTGUitvoeringZeg = zeg;

  $('#voerKnop').onclick = function () {
    /* Een ingevuld vreemd id gaat VOOR: wie dat typt, bedoelt dat. De server
       kent het verschil tussen eigen en andermans werk toch al -- dit scherm
       hoeft er geen tweede oordeel over te vellen. */
    var id = $('#vreemdP').value.trim() || $('#kiesP').value;
    if (!id) { zeg('Kies een partituur, of vul het id van iemand anders in.'); return; }
    var b = Number($('#budget').value);
    api('/api/uitvoering/voer', { partituurId: id,
      secondenBudget: b > 0 ? b : undefined, diepte: Number($('#diepte').value) })
      .then(function (r) {
        if (r.body && r.body.geweigerd) { window.RTGUitvoeringToon.weigering(r.body); return; }
        if (r.body && r.body.error) { zeg(r.body.error); return; }
        window.RTGUitvoeringToon.uitvoering(r.body);
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

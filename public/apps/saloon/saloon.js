/* Saloon bepaalt de presentatie; de bronapps voeren handelingen uit. */
(function (w) {
  'use strict';
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function start(host) {
    var o = {}, bronnen = [], vorige = new Map(), vorigeVraag = '', klaar = false, wachtrij = Promise.resolve();
    var vlak = document.createElement('section'); vlak.id = 'saloon'; vlak.className = 'saloon';
    vlak.setAttribute('aria-label', 'Uw Saloon');
    vlak.innerHTML = w.RTGSaloonOpbouw();
    document.querySelector('.living-intro').appendChild(vlak);
    var aan = false, leest = false, plaatsKiezen = false;
    function keuzes(plaats) {
      lezer.sluit(); vlak.hidden = false; vlak.querySelector('details').open = true;
      var doel = vlak.querySelector(plaats ? '[name="plaats"]' : 'summary'); doel.focus(); doel.scrollIntoView({ block: 'center' });
    }
    var edge = w.RTGSaloonEdge({
      Voorkeuren: { naam: 'Uw Saloon-voorkeuren', doe: function () { keuzes(false); } },
      Maken: { naam: 'Delen in Saloon', doe: function () { w.RTGSaloonActies.maken(host); } },
      Agenda: { naam: 'Uw agenda in Saloon', doe: function () { lezer.sluit(); bewaar({ vorm: 'agenda' }, true).catch(function () {}); } },
      Terug: { naam: 'Terug naar Saloon', lezer: true, doe: function () { lezer.terug(); } },
      Bewaren: { naam: 'Artikel bewaren of verwijderen', lezer: true, doe: function () { lezer.bewaren(); } }
    });
    var lezer = w.RTGSaloonLezer({ veranderd: function (actief) { leest = actief; edge(aan, leest); },
      bewaard: function (id) { return (o.bewaard || []).includes(id); }, bewaar: bewaarItem });
    function bewaarItem(i) {
      return bewaar({ bewaar: { id: i.id, aan: !(o.bewaard || []).includes(i.id) } }, false).then(function () {
        i.bewaard = o.bewaard.includes(i.id);
        document.querySelectorAll('[data-saloon-id]').forEach(function (k) {
          if (k.dataset.saloonId !== i.id) return;
          var b = k.querySelector('[data-bewaar]'); b.textContent = i.bewaard ? 'Bewaard' : 'Bewaren';
          b.setAttribute('aria-pressed', String(i.bewaard));
        });
        if (o.vorm === 'bewaard' && !i.bewaard) host.laad();
        return i.bewaard;
      });
    }
    host.openArtikel = function (i) { lezer.open(i, function () { return bewaarItem(i); }); };
    function teken() {
      var dichtbij = !!o.plaats && o.vorm === 'overzicht';
      vlak.querySelectorAll('[data-vorm]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.vorm === o.vorm && !dichtbij)); });
      vlak.querySelector('[data-dichtbij]').setAttribute('aria-pressed', String(dichtbij));
      var form = vlak.querySelector('#saloonFilters');
      vlak.querySelector('[name="zoek"]').value = o.zoek || ''; form.elements.plaats.value = o.plaats || '';
      vlak.querySelector('#saloonOmgeving').textContent = (o.plaats ? o.plaats + ' · ' : '') + new Date().toLocaleDateString(document.documentElement.lang || undefined, { day: 'numeric', month: 'long' });
      vlak.querySelector('#saloonBronnen').innerHTML = bronnen.map(function (b) {
        return '<label><input type="checkbox" name="bron" value="' + esc(b.id) + '"'
          + ((o.bronnen || []).includes(b.id) ? ' checked' : '') + '> ' + esc(b.naam) + (b.prive ? ' · privé' : '') + '</label>';
      }).join('');
    }
    function bewaar(patch, herlaad) {
      // Volgorde blijft ook bij snel achter elkaar bewaren gelijk aan de klikken.
      wachtrij = wachtrij.catch(function () {}).then(function () {
        return host.api('/modus', { modus: host.modus(), saloon: patch });
      }).then(function (d) {
        o = d.saloon; teken();
        if (herlaad) return host.laad();
      }).catch(function (e) { host.fout(e.message); throw e; });
      return wachtrij;
    }
    vlak.addEventListener('click', function (e) {
      var b = e.target.closest('[data-vorm]');
      if (b) {
        plaatsKiezen = false;
        bewaar(b.dataset.vorm === 'overzicht' ? { vorm: 'overzicht', plaats: '' } : { vorm: b.dataset.vorm }, true).catch(function () {});
      }
      if (e.target.closest('[data-keuzes]')) keuzes(false);
      if (e.target.closest('[data-dichtbij]')) {
        if (!o.plaats) { plaatsKiezen = true; keuzes(true); }
        else bewaar({ vorm: 'overzicht' }, true).catch(function () {});
      }
      if (e.target.closest('[data-ververs]')) host.laad();
      if (e.target.closest('[data-saloon-maken]')) w.RTGSaloonActies.maken(host);
    });
    vlak.querySelector('details').addEventListener('toggle', function () { vlak.querySelector('[data-keuzes]').setAttribute('aria-expanded', String(this.open)); });
    vlak.querySelector('#saloonZoek').addEventListener('submit', function (e) {
      e.preventDefault(); bewaar({ zoek: this.elements.zoek.value }, true).catch(function () {});
    });
    vlak.querySelector('#saloonFilters').addEventListener('submit', function (e) {
      e.preventDefault();
      var vorm = plaatsKiezen ? 'overzicht' : o.vorm; plaatsKiezen = false;
      bewaar({ vorm: vorm, plaats: this.elements.plaats.value,
        bronnen: Array.from(this.querySelectorAll('[name="bron"]:checked')).map(function (b) { return b.value; }) }, true).catch(function () {});
    });
    return {
      init: function (d, ik) {
        o = d.voorkeuren; bronnen = d.bronnen; klaar = true; document.body.classList.add('rtg-saloon-experience');
        document.body.setAttribute('data-rtg-screen', 'world-home');
        vlak.querySelector('#saloonGroet').textContent = 'Welkom' + (ik && ik.codenaam ? ', ' + ik.codenaam : '') + '.'; teken();
        lezer.herstel();
      },
      parameters: function () { return klaar ? { ervaring: 'saloon' } : {}; },
      vorm: function () { return o.vorm; },
      zichtbaar: function (actief) { aan = actief; vlak.hidden = !aan; if (!aan) lezer.sluit(); edge(aan, leest); },
      ontvang: function (d, vraag, aanvullen) {
        if (!d.voorkeuren) return;
        if (!aanvullen && w.RTGAanvraagEdgeWis) w.RTGAanvraagEdgeWis();
        o = d.voorkeuren; document.body.dataset.saloonView = o.vorm; teken();
        var scope = JSON.stringify([vraag.modus, vraag.lens, o.bronnen, o.zoek, o.plaats, o.vorm]);
        var nieuw = 0, veranderd = 0;
        if (!aanvullen && vorigeVraag === scope) d.items.forEach(function (i) {
          if (!vorige.has(i.id)) nieuw++; else if (vorige.get(i.id) !== i.versie) veranderd++;
        });
        if (!aanvullen) vorige = new Map();
        d.items.forEach(function (i) { vorige.set(i.id, i.versie); }); vorigeVraag = scope;
        vlak.querySelector('#saloonStatus').textContent = d.totaal + ' resultaten · ' + d.volgorde
          + (nieuw || veranderd ? ' · ' + nieuw + ' nieuw, ' + veranderd + ' gewijzigd in deze selectie.' : '')
          + (d.totaal ? '' : ' Pas uw bronnen of filters aan, of deel een eerste bericht.');
        vlak.querySelector('#saloonBronstatus').innerHTML = (d.bronstatus || []).filter(function (b) {
          return !b.ok || b.beperkt || b.meldingen.length;
        }).map(function (b) { return '<p class="saloon-uitleg">' + esc(b.naam) + ': '
          + esc(b.ok ? (b.beperkt ? 'Een begrensde selectie. Open de bron voor meer. ' : '') + b.meldingen.join(' ') : b.meldingen.join(' ')) + '</p>'; }).join('');
      },
      kaart: function (k, i) {
        w.RTGSaloonKaart(k, i, esc, function () { return bewaarItem(i); }, host);
      }
    };
  }
  w.RTGSaloon = { start: start, esc: esc };
}(window));

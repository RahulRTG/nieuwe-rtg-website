/* Saloon bepaalt de presentatie; de bronapps voeren handelingen uit. */
(function (w) {
  'use strict';
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function start(host) {
    var o = {}, bronnen = [], vorige = new Map(), vorigeVraag = '', klaar = false, wachtrij = Promise.resolve();
    var vlak = document.createElement('section'); vlak.id = 'saloon'; vlak.className = 'saloon';
    vlak.setAttribute('aria-label', 'Uw Saloon');
    vlak.innerHTML = '<div class="saloon-kop"><div><p class="eyebrow">SALOON</p><h2>Uw wereld komt samen.</h2>'
      + '<p>Mensen, verhalen en mogelijkheden. Met ruimte voor wat u kiest.</p></div>'
      + '<button type="button" data-saloon-maken>Maken</button></div>'
      + '<nav class="saloon-vormen" aria-label="Weergave"><button type="button" data-vorm="overzicht">Overzicht</button>'
      + '<button type="button" data-vorm="agenda">Agenda</button><button type="button" data-vorm="bewaard">Bewaard</button>'
      + '<button type="button" data-ververs>Vernieuwen</button></nav>'
      + '<details class="saloon-keuzes"><summary>Mijn bronnen en omgeving</summary>'
      + '<form id="saloonFilters"><div class="saloon-velden"><label>Zoeken<input name="zoek" type="search" maxlength="100" placeholder="Onderwerp, maker of verhaal"></label>'
      + '<label>Plaats<input name="plaats" type="search" maxlength="60" placeholder="Bijvoorbeeld Amsterdam"></label></div>'
      + '<fieldset><legend>Wat komt samen in uw Saloon?</legend><div id="saloonBronnen"></div></fieldset>'
      + '<p class="saloon-uitleg">Mijn reizen is alleen voor u. Saloon gebruikt uw keuzes; u kunt ze hier altijd wijzigen.</p>'
      + '<button type="submit">Keuzes toepassen</button></form></details>'
      + '<p id="saloonStatus" role="status" aria-live="polite"></p><div id="saloonBronstatus"></div>';
    document.getElementById('feed').before(vlak);
    function teken() {
      vlak.querySelectorAll('[data-vorm]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.vorm === o.vorm)); });
      var form = vlak.querySelector('form');
      form.elements.zoek.value = o.zoek || ''; form.elements.plaats.value = o.plaats || '';
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
      if (b) bewaar({ vorm: b.dataset.vorm }, true).catch(function () {});
      if (e.target.closest('[data-ververs]')) host.laad();
      if (e.target.closest('[data-saloon-maken]')) w.RTGSaloonActies.maken(host);
    });
    vlak.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      bewaar({ zoek: this.elements.zoek.value, plaats: this.elements.plaats.value,
        bronnen: Array.from(this.querySelectorAll('[name="bron"]:checked')).map(function (b) { return b.value; }) }, true).catch(function () {});
    });
    return {
      init: function (d) { o = d.voorkeuren; bronnen = d.bronnen; klaar = true; teken(); },
      parameters: function () { return klaar ? { ervaring: 'saloon' } : {}; },
      vorm: function () { return o.vorm; },
      zichtbaar: function (aan) { vlak.hidden = !aan; },
      ontvang: function (d, vraag, aanvullen) {
        if (!d.voorkeuren) return;
        o = d.voorkeuren; teken();
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
        w.RTGSaloonKaart(k, i, esc, function () {
          return bewaar({ bewaar: { id: i.id, aan: !i.bewaard } }, false).then(function () {
            i.bewaard = o.bewaard.includes(i.id);
            var b = k.querySelector('[data-bewaar]'); b.textContent = i.bewaard ? 'Bewaard' : 'Bewaren';
            b.setAttribute('aria-pressed', String(i.bewaard));
            if (o.vorm === 'bewaard' && !i.bewaard) host.laad();
          });
        }, host);
      }
    };
  }
  w.RTGSaloon = { start: start, esc: esc };
}(window));

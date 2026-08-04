/* RTF School, gezinskant: het ouder- en leerlingportaal -- facturen,
   aanwezigheid, rapporten, toestemmingen, afspraken en verlof op een plek.
   Draait als los deel naast de pagina en gebruikt gezinApi uit school.html
   (zelfde globale scope), net als school-extra.js.

   Drie dingen die hier zichtbaar zijn en dat bij de meeste schoolapps niet
   zijn: bij een openstaand bedrag staat er letterlijk bij dat het geen gevolg
   heeft voor het onderwijs, een gegeven toestemming is met een knop weer IN te
   trekken, en de aanwezigheidsregels tonen wie ze heeft gezet. */
(function () {
  'use strict';
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var wortel = null;
  var euro = function (c) { return '€ ' + ((c || 0) / 100).toFixed(2); };
  function kaart(titel, binnen) {
    return '<div class="sec">' + titel + '</div><div class="kaart blok">' + binnen + '</div>';
  }
  function regel(tekst) { return '<div class="mini" style="margin:.25rem 0;">' + tekst + '</div>'; }

  async function laad() {
    if (typeof gezinApi !== 'function' || !wortel) return;
    var d, mach = null, peil = null;
    try { d = await gezinApi('/school/portaal'); } catch (e) { return; }
    if (!d || !d.ok) return;
    try { mach = await gezinApi('/school/machtiging/mijn'); } catch (e) {}
    try { peil = await gezinApi('/school/peiling/mijn'); } catch (e) {}
    var machtigingen = (mach && mach.machtigingen) || [];
    var peilingen = ((peil && peil.peilingen) || []).filter(function (p) { return !p.alGeantwoord; });
    var leeg = !(d.facturen.length || d.aanwezigheid.length || d.rapporten.length
      || d.toestemmingen.length || d.afspraken.length || d.verlof.length
      || machtigingen.length || peilingen.length);
    if (leeg) { wortel.innerHTML = ''; return; }
    var h = '';

    if (d.facturen.length) {
      h += kaart('Facturen', d.facturen.map(function (f) {
        return regel('<b>' + esc(f.omschrijving) + '</b> · ' + euro(f.centen) +
          (f.open ? ' · nog open: ' + euro(f.open) : ' · voldaan') +
          (f.vrijwillig ? ' · <i>vrijwillig</i>' : '') + (f.vervalt ? ' · vervalt ' + esc(f.vervalt) : ''));
      }).join('') + regel('Openstaand totaal: <b>' + euro(d.openTotaal) + '</b>') +
        regel('Een openstaand bedrag heeft geen enkel gevolg voor de lessen, het rapport of de toegang van uw kind.'));
    }

    if (d.rapporten.length) {
      h += kaart('Rapporten', d.rapporten.map(function (r) {
        return regel('<b>' + esc(r.periode) + '</b> · ' + esc(r.klas) + ' · gemiddelde ' + (r.gemiddelde == null ? '-' : r.gemiddelde) +
          (r.tekst ? '<br>' + esc(r.tekst) : ''));
      }).join(''));
    }

    if (d.aanwezigheid.length) {
      var gemist = d.aanwezigheid.filter(function (a) { return a.stand !== 'aanwezig'; });
      h += kaart('Aanwezigheid', regel(d.aanwezigheid.length + ' geregistreerde lessen, ' + gemist.length + ' niet aanwezig.') +
        gemist.slice(0, 8).map(function (a) {
          return regel(esc(a.datum) + ' · uur ' + a.uur + ' · ' + esc(a.vak || 'les') + ' · <b>' + esc(a.stand) + '</b>' +
            (a.minuten ? ' (' + a.minuten + ' min)' : '') + ' · genoteerd door ' + esc(a.door));
        }).join(''));
    }

    if (d.toestemmingen.length) {
      h += kaart('Toestemming', d.toestemmingen.map(function (t) {
        var stand = t.antwoord === true ? 'gegeven' : t.antwoord === false ? 'geweigerd' : t.beantwoord ? 'ingetrokken' : 'nog geen antwoord';
        return regel('<b>' + esc(t.titel) + '</b> · ' + stand + '<br>' + esc(t.uitleg) +
          '<br><button class="knop mini" data-tst="' + esc(t.id) + '" data-kind="' + esc(t.sleutel) + '" data-ja="1">Ja</button> ' +
          '<button class="knop mini" data-tst="' + esc(t.id) + '" data-kind="' + esc(t.sleutel) + '" data-ja="0">Nee</button> ' +
          '<button class="knop mini" data-tst="' + esc(t.id) + '" data-kind="' + esc(t.sleutel) + '" data-ja="intrek">Intrekken</button>');
      }).join('') + regel('Geen antwoord telt als géén toestemming, en een ja mag u altijd weer intrekken.'));
    }

    if (d.afspraken.length) {
      h += kaart('Afspraken met de leraar', d.afspraken.map(function (a) {
        return regel(esc(a.datum) + ' · ' + esc(a.tijd) + ' · ' + a.minuten + ' min · ' + esc(a.leraar) +
          (a.plek ? ' · ' + esc(a.plek) : '') + ' · voor ' + esc(a.kind));
      }).join(''));
    }

    if (d.verlof.length) {
      h += kaart('Verlof', d.verlof.map(function (v) {
        return regel(esc(v.van) + (v.tot && v.tot !== v.van ? ' t/m ' + esc(v.tot) : '') + ' · ' + esc(v.soort) + ' · <b>' + esc(v.status) + '</b>' +
          (v.besluitReden ? '<br>Reden van het besluit: ' + esc(v.besluitReden) : ''));
      }).join(''));
    }

    if (machtigingen.length) {
      h += kaart('Machtigingen', machtigingen.map(function (m) {
        return regel('<b>' + esc(m.kenmerk) + '</b> · ' + esc(m.houder) + ' · rekening op ...' + esc(m.ibanEinde) +
          ' · max ' + euro(m.maxCenten) + ' · ' + esc(m.frequentie) + ' · ' + (m.actief ? 'actief' : 'gestopt') +
          (m.actief ? ' <button class="knop mini" data-mstop="' + esc(m.id) + '">Stop deze machtiging</button>' : ''));
      }).join('') + regel('Er wordt hier niets geïnd; dit legt vast wat u hebt getekend. Stoppen kan altijd en werkt meteen.'));
    }

    if (peilingen.length) {
      h += kaart('Peiling', peilingen.map(function (p) {
        return regel('<b>' + esc(p.titel) + '</b>') + p.stellingen.map(function (s, i) {
          return regel(esc(s) + ' <select class="veld mini" data-score="' + esc(p.id) + '-' + i + '" aria-label="' + esc(s) + '">' +
            '<option value="">-</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select>');
        }).join('') + regel('<button class="knop mini" data-peil="' + esc(p.id) + '" data-n="' + p.stellingen.length + '">Verstuur anoniem</button>');
      }).join('') + regel('1 = helemaal niet, 5 = helemaal wel. Alleen uw scores worden bewaard, niet wie u bent.'));
    }

    wortel.innerHTML = h;
    bind();
  }

  function bind() {
    Array.prototype.forEach.call(wortel.querySelectorAll('[data-mstop]'), function (b) {
      b.addEventListener('click', async function () {
        try { await gezinApi('/school/machtiging/stop', { machtigingId: b.dataset.mstop }); laad(); }
        catch (e) { b.insertAdjacentHTML('afterend', ' <span class="mini">' + esc(e.message) + '</span>'); }
      });
    });
    Array.prototype.forEach.call(wortel.querySelectorAll('[data-peil]'), function (b) {
      b.addEventListener('click', async function () {
        var scores = [];
        for (var i = 0; i < Number(b.dataset.n); i++) {
          var veld = wortel.querySelector('[data-score="' + b.dataset.peil + '-' + i + '"]');
          scores.push(veld && veld.value ? Number(veld.value) : null);
        }
        try { await gezinApi('/school/peiling/antwoord', { peilingId: b.dataset.peil, scores: scores }); laad(); }
        catch (e) { b.insertAdjacentHTML('afterend', ' <span class="mini">' + esc(e.message) + '</span>'); }
      });
    });
    Array.prototype.forEach.call(wortel.querySelectorAll('[data-tst]'), function (b) {
      b.addEventListener('click', async function () {
        var ja = b.dataset.ja;
        var profielId = String(b.dataset.kind || '').split(':')[1] || '';
        try {
          await gezinApi('/school/toestemming/antwoord', { toestemmingId: b.dataset.tst, profielId: profielId,
            antwoord: ja === '1' ? true : ja === '0' ? false : null });
          laad();
        } catch (e) {
          b.insertAdjacentHTML('afterend', ' <span class="mini">' + esc(e.message) + '</span>');
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var lijst = document.querySelector('#schoolLijst');
    if (!lijst) return;
    wortel = document.createElement('div');
    wortel.id = 'schoolPortaal';
    lijst.parentNode.insertBefore(wortel, lijst.nextSibling);
    setTimeout(laad, 900); // na laadGezin en school-extra
  });
})();

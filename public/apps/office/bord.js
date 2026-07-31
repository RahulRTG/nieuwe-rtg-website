/* RTG Office, het bord: lijsten met kaarten, zoals een goed weekoverzicht
   op de muur -- maar dan gedeeld, met versies en autosave zoals alles in
   het pakket. Een kaart heeft een titel, een notitie, een label in de
   huiskleuren, iemand die hem oppakt en een dag waarop het af wil zijn.
   Verplaatsen gaat met de pijlen (werkt overal, ook met de vingers en het
   toetsenbord); klaar is een vinkje, geen confetti.

   Levert window.RTGOfficeBord. */
(function () {
  'use strict';
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var rid = function () { return RTGId('k'); };   // CSPRNG: id's zijn opzoeksleutels
  var LABELS = [['geen', 'transparent'], ['bordeaux', '#7F1634'], ['goud', '#A98F1C'], ['grijs', '#8A8680']];

  function maak(opts) {
    var wortel = opts.wortel, onWijzig = opts.onWijzig || function () {}, meld = opts.meld || function () {};
    var data = { lijsten: [] };
    var open = null;   // { lijstId, kaartId } van de kaart die open staat
    var mag = true;    // meelezers kijken, bewerken doet de eigenaar of meeschrijver

    var norm = function (inhoud) {
      var l = (inhoud && Array.isArray(inhoud.lijsten)) ? inhoud.lijsten : [];
      return { lijsten: l.map(function (x) {
        return { id: x.id || rid(), titel: String(x.titel || 'Lijst').slice(0, 60),
          kaarten: (Array.isArray(x.kaarten) ? x.kaarten : []).map(function (k) {
            return { id: k.id || rid(), titel: String(k.titel || '').slice(0, 120), notitie: String(k.notitie || '').slice(0, 600),
              label: String(k.label || 'geen'), wie: String(k.wie || '').slice(0, 40), voor: String(k.voor || '').slice(0, 10), klaar: !!k.klaar };
          }) };
      }) };
    };
    var vind = function (lijstId) { return data.lijsten.find(function (l) { return l.id === lijstId; }); };
    var wijzig = function () { teken(); onWijzig(); };

    function kaartHtml(l, k) {
      var kleur = (LABELS.find(function (x) { return x[0] === k.label; }) || LABELS[0])[1];
      var isOpen = open && open.kaartId === k.id;
      var h = '<div class="bordkaart" data-bkaart="' + l.id + ':' + k.id + '" style="border:1px solid var(--line);border-left:3px solid ' + kleur + ';border-radius:10px;padding:0.5rem 0.65rem;margin-top:0.45rem;cursor:pointer;' + (k.klaar ? 'opacity:0.55;' : '') + '">' +
        '<div style="font-size:0.84rem;line-height:1.4;' + (k.klaar ? 'text-decoration:line-through;' : '') + '">' + (k.klaar ? '✓ ' : '') + esc(k.titel || '(zonder titel)') + '</div>' +
        ((k.wie || k.voor) ? '<div style="font-size:0.68rem;color:var(--soft,#8A8680);margin-top:0.2rem;">' + esc(k.wie) + (k.wie && k.voor ? ' · ' : '') + esc(k.voor) + '</div>' : '');
      if (isOpen && window.RTGOfficeBordPaneel) h += RTGOfficeBordPaneel.html(k, LABELS);
      return h + '</div>';
    }

    function teken() {
      wortel.innerHTML = '<div style="display:flex;gap:0.7rem;align-items:flex-start;overflow-x:auto;padding-bottom:0.8rem;">' +
        data.lijsten.map(function (l) {
          return '<div style="flex:0 0 250px;border:1px solid var(--line);border-radius:14px;padding:0.65rem 0.75rem;">' +
            '<div style="display:flex;gap:0.3rem;align-items:center;"><input data-blijstnaam="' + l.id + '" value="' + esc(l.titel) + '" style="flex:1;min-width:0;font:inherit;font-size:0.78rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--gold,#A98F1C);border:none;background:transparent;outline:none;">' +
            '<button data-blschuif="' + l.id + ':-1" title="Naar links" style="border:none;background:transparent;color:var(--soft,#8A8680);cursor:pointer;font:inherit;">←</button>' +
            '<button data-blschuif="' + l.id + ':1" title="Naar rechts" style="border:none;background:transparent;color:var(--soft,#8A8680);cursor:pointer;font:inherit;">→</button>' +
            '<button data-blweg="' + l.id + '" title="Lijst weg" style="border:none;background:transparent;color:var(--soft,#8A8680);cursor:pointer;font:inherit;">✕</button></div>' +
            l.kaarten.map(function (k) { return kaartHtml(l, k); }).join('') +
            '<button data-bnieuw="' + l.id + '" style="width:100%;margin-top:0.5rem;font:inherit;font-size:0.76rem;padding:0.4rem;border:1px dashed var(--line);border-radius:10px;background:transparent;color:var(--soft,#8A8680);cursor:pointer;">+ kaart</button></div>';
        }).join('') +
        '<button data-bnieuwlijst="1" style="flex:0 0 190px;font:inherit;font-size:0.78rem;padding:0.7rem;border:1px dashed var(--line);border-radius:14px;background:transparent;color:var(--soft,#8A8680);cursor:pointer;">+ lijst</button></div>';
    }

    wortel.addEventListener('click', function (e) {
      if (!mag) return;
      var q = function (s) { return e.target.closest(s); };
      var b;
      if (q('[data-bpaneel]') && !q('button')) return;   // typen in het paneel is geen klik
      if ((b = q('[data-bnieuwlijst]'))) { data.lijsten.push({ id: rid(), titel: 'Nieuwe lijst', kaarten: [] }); return wijzig(); }
      if ((b = q('[data-bnieuw]'))) {
        var l0 = vind(b.dataset.bnieuw);
        if (l0) { var nk = { id: rid(), titel: '', notitie: '', label: 'geen', wie: '', voor: '', klaar: false }; l0.kaarten.push(nk); open = { lijstId: l0.id, kaartId: nk.id }; }
        return wijzig();
      }
      if ((b = q('[data-blweg]'))) {
        var li = data.lijsten.findIndex(function (l) { return l.id === b.dataset.blweg; });
        if (li >= 0) { if (data.lijsten[li].kaarten.length && !window.confirm('Deze lijst en alle kaarten erin weghalen?')) return; data.lijsten.splice(li, 1); }
        return wijzig();
      }
      if ((b = q('[data-blschuif]'))) {
        var p = b.dataset.blschuif.split(':'), ix = data.lijsten.findIndex(function (l) { return l.id === p[0]; }), naar = ix + Number(p[1]);
        if (ix >= 0 && naar >= 0 && naar < data.lijsten.length) { var t = data.lijsten.splice(ix, 1)[0]; data.lijsten.splice(naar, 0, t); }
        return wijzig();
      }
      var kd = q('[data-bkaart]');
      if (!kd) return;
      var ids = kd.dataset.bkaart.split(':'), lijst = vind(ids[0]);
      var ki = lijst ? lijst.kaarten.findIndex(function (k) { return k.id === ids[1]; }) : -1;
      if (ki < 0) return;
      var kaart = lijst.kaarten[ki];
      if ((b = q('[data-blabel]'))) { kaart.label = b.dataset.blabel; return wijzig(); }
      if (q('[data-bklaar]')) { kaart.klaar = !kaart.klaar; return wijzig(); }
      if (q('[data-bweg]')) { lijst.kaarten.splice(ki, 1); open = null; return wijzig(); }
      if ((b = q('[data-bop]'))) {
        var nk2 = ki + Number(b.dataset.bop);
        if (nk2 >= 0 && nk2 < lijst.kaarten.length) { lijst.kaarten.splice(ki, 1); lijst.kaarten.splice(nk2, 0, kaart); }
        return wijzig();
      }
      if ((b = q('[data-bschuif]'))) {
        var lix = data.lijsten.indexOf(lijst), doel = data.lijsten[lix + Number(b.dataset.bschuif)];
        if (doel) { lijst.kaarten.splice(ki, 1); doel.kaarten.push(kaart); open = { lijstId: doel.id, kaartId: kaart.id }; }
        return wijzig();
      }
      if (q('[data-bpaneel]')) return;
      // de kaart zelf: open- of dichtklappen
      open = (open && open.kaartId === kaart.id) ? null : { lijstId: lijst.id, kaartId: kaart.id };
      teken();
    });

    // typen in het open paneel en de lijstnamen: direct in de data, autosave volgt
    wortel.addEventListener('input', function (e) {
      if (!mag) return;
      var veld = e.target.closest('[data-bv]');
      if (veld && open) {
        var l = vind(open.lijstId), k = l && l.kaarten.find(function (x) { return x.id === open.kaartId; });
        if (k) { k[veld.dataset.bv] = veld.value; onWijzig(); }
        return;
      }
      var ln = e.target.closest('[data-blijstnaam]');
      if (ln) { var l2 = vind(ln.dataset.blijstnaam); if (l2) { l2.titel = ln.value.slice(0, 60); onWijzig(); } }
    });

    var api = {
      laad: function (inhoud, magBewerken) {
        mag = magBewerken !== false;
        data = norm(inhoud);
        if (!data.lijsten.length) data.lijsten = [
          { id: rid(), titel: 'Te doen', kaarten: [] },
          { id: rid(), titel: 'Bezig', kaarten: [] },
          { id: rid(), titel: 'Klaar', kaarten: [] }
        ];
        open = null;
        teken();
      },
      inhoud: function () { return { lijsten: data.lijsten }; }
    };
    return api;
  }

  window.RTGOfficeBord = { maak: maak, LABELS: LABELS };
})();

/* De Regie van de zaak, deel 2: de werkplekken zelf.

   VIER OP EEN GROOT SCHERM, DRIE OP EEN TELEFOON. Wat er op de telefoon
   ontbreekt (instellingen, spoor) is niet weggelaten omdat het onbelangrijk is
   maar omdat je het niet met een duim doet tussen twee tafels door.

   ELKE LIJST ZEGT WAT HIJ NIET WEET. Nul signalen is "er wacht niets op u" en
   niet een leeg vlak; nul te herstellen gevallen is "er staat niets scheef".
   Een leeg scherm zonder tekst laat je twijfelen of het geladen heeft. */
(function (w, d) {
  'use strict';
  var Z = w.RTGZaakCommand;
  if (!Z || Z.toon) return;
  var esc = Z.esc, tijd = Z.tijd, nv = Z.nv;

  function toon(el, opties) {
    Z.stijl();
    var o = opties || {};
    var api = o.api;                      // (pad, body) -> Promise
    var compact = !!o.compact;
    /* `mag` komt van het huis dat dit scherm ophangt: de zaak-app weet of de
       ingelogde persoon manager is. Verbergen is netheid -- de grendel zit op de
       server (managerOnly), dus een vergissing hier geeft hooguit een knop die
       een nette weigering oplevert, nooit een handeling die niet mocht. */
    var S = { werkplek: 'nu', start: null, zoekterm: '', object: null, plan: null, mag: o.mag !== false };

    var WERKPLEKKEN;
    WERKPLEKKEN = compact
      ? [['nu', 'Nu'], ['lijst', 'Lijst'], ['zoek', 'Zoeken']]
      : [['nu', 'Nu'], ['lijst', 'Uitzonderingen'], ['recht', 'Rechtzetten'], ['zoek', 'Zoeken'], ['regels', 'Instellingen']];

    el.className = 'zc' + (compact ? ' zc-klein' : '');
    el.innerHTML = '<div class="zc-rail"></div><div class="zc-vak"><div class="zc-leeg">Laden…</div></div>';
    var rail = el.querySelector('.zc-rail'), vak = el.querySelector('.zc-vak');

    function melden(t) { if (o.meld) o.meld(t); }
    function railTeken() {
      rail.innerHTML = WERKPLEKKEN.map(function (p) {
        return '<button data-w="' + p[0] + '"' + (S.werkplek === p[0] ? ' aria-current="page"' : '') + '>' + esc(p[1]) + '</button>';
      }).join('');
      rail.querySelectorAll('[data-w]').forEach(function (b) {
        b.onclick = function () { S.werkplek = b.dataset.w; railTeken(); teken(); };
      });
    }

    function ververs() {
      return api('start').then(function (dd) { S.start = dd; return dd; });
    }

    /* EEN TABEL EN GEEN KETEN VAN IFS, en dat is hier geen stijlkwestie: de
       werkplekken staan in twee bestanden (dit deel en deel 3), en die zijn
       twee aparte omhulsels. Een `if (x === 'zoek') return zoek()` zou hier
       verwijzen naar een naam die in dit omhulsel niet bestaat -- een fout die
       pas valt op het moment dat iemand op die knop drukt, en die geen enkele
       servertoets ziet. Deel 3 hangt zijn tekenaars in deze tabel. */
    var TEKENAARS = {};
    function teken() {
      var f = TEKENAARS[S.werkplek];
      if (!f) { vak.innerHTML = '<div class="zc-leeg">Die werkplek bestaat niet.</div>'; return; }
      try { f(); } catch (e) { vak.innerHTML = '<div class="zc-leeg">Dit scherm kon niet worden getekend: ' + esc(e.message) + '</div>'; }
    }

    /* ---- Nu: wat er speelt ---- */
    function nu() {
      var st = S.start;
      if (!st) { vak.innerHTML = '<div class="zc-leeg">Laden…</div>'; return; }
      var p = st.puls;
      var u = '<div class="zc-tegels">' +
        tegel(p.stand, 'stand') + tegel(p.signalen.length, 'wacht op u') +
        tegel(p.herstel.kandidaten, 'recht te zetten') + tegel(p.uitzonderingen.open, 'op de lijst') + '</div>';

      u += '<div class="zc-kaart"><h3>Wat op u wacht</h3>';
      if (!p.signalen.length) u += '<p class="zc-meta">Er wacht niets op u. Dat is een uitslag, geen leeg scherm.</p>';
      for (var i = 0; i < p.signalen.length; i++) {
        var s = p.signalen[i];
        u += '<div class="zc-sig ' + esc(s.niveau) + '"><div>' + esc(s.nl) + '</div>' +
          '<div class="zc-meta">' + esc(s.beslissing) + '</div>' +
          '<div class="zc-rij"><button class="zc-knop" data-sig="' + esc(s.id) + '">Zet op de lijst</button></div></div>';
      }
      u += '</div>';

      if (p.herstel.kandidaten) {
        u += '<div class="zc-kaart"><h3>Recht te zetten</h3>' +
          '<p class="zc-meta">Dit gaat alleen over de administratie: een status die achterloopt op wat er al gebeurd is. ' +
          'Er verandert niets aan uw werk, alleen aan wat het systeem erover zegt.</p>';
        for (var j = 0; j < p.herstel.lijst.length; j++) {
          var rb = p.herstel.lijst[j];
          if (!rb.kandidaten) continue;
          u += '<div class="zc-sig"><div><b>' + rb.kandidaten + '×</b> ' + esc(rb.naam) + ' ' + nv(rb.oordeel.niveau) + '</div>' +
            '<div class="zc-meta">' + esc(rb.wat) + '</div></div>';
        }
        if (!compact && S.mag) u += '<div class="zc-rij"><button class="zc-knop vol" data-alles="1">Zet alles recht wat veilig kan</button></div>';
        u += '</div>';
      }
      vak.innerHTML = u;
      bindNu();
    }
    function tegel(v, l) { return '<div class="zc-tegel"><b>' + esc(v) + '</b><span>' + esc(l) + '</span></div>'; }

    function bindNu() {
      vak.querySelectorAll('[data-sig]').forEach(function (b) {
        b.onclick = function () {
          b.disabled = true;
          api('signaal/oppakken', { id: b.dataset.sig })
            .then(function (r) { melden(r.bestond ? 'Stond al op de lijst.' : 'Op de lijst gezet.'); return ververs(); })
            .then(function () { S.werkplek = 'lijst'; railTeken(); teken(); })
            .catch(function (e) { b.disabled = false; melden(e.message); });
        };
      });
      var alles = vak.querySelector('[data-alles]');
      if (alles) alles.onclick = function () {
        var reden = prompt('Waarom zet u dit recht? (komt in het spoor van de zaak)');
        if (!reden) return;
        alles.disabled = true;
        api('operator/plan', { q: 'wat kan er rechtgezet worden?' })
          .then(function (r) { return api('operator/uitvoeren', { plan: r.plan.id, reden: reden }); })
          .then(function (r) { melden(r.hersteld + ' rechtgezet.'); return ververs(); })
          .then(teken)
          .catch(function (e) { alles.disabled = false; melden(e.message); });
      };
    }

    /* ---- de uitzonderingenrij ---- */
    function lijst() {
      vak.innerHTML = '<div class="zc-leeg">Laden…</div>';
      api('zaken', { max: 40 }).then(function (dd) {
        var u = '';
        if (dd.leerpunten && dd.leerpunten.length && !compact) {
          u += '<div class="zc-kaart"><h3>Wat zich herhaalt</h3>';
          u += dd.leerpunten.map(function (l) {
            return '<div class="zc-sig"><b>' + esc(l.oorzaak) + ' → ' + esc(l.besluit) + '</b> <span class="zc-meta">' + l.aantal + '×</span></div>';
          }).join('');
          u += '</div>';
        }
        if (!dd.zaken.length) u += '<div class="zc-leeg">Niets op de lijst. Alles wat er was, is afgehandeld.</div>';
        u += dd.zaken.map(function (z) {
          return '<div class="zc-kaart"><h3>' + esc(z.titel) + '</h3>' +
            '<p class="zc-meta">' + esc(z.status) + (z.eigenaar ? ' · ' + esc(z.eigenaar) : ' · nog niemand') +
            ' · geopend ' + esc(tijd(z.at)) + ' · termijn ' + esc(tijd(z.termijn)) + '</p>' +
            (z.besluit ? '<p class="zc-meta">Besluit: ' + esc(z.besluit.keuze) + ' -- ' + esc(z.besluit.reden) + '</p>'
              : '<div class="zc-rij">' +
                (z.eigenaar ? '' : '<button class="zc-knop" data-neem="' + esc(z.id) + '">Ik pak hem op</button>') +
                (S.mag ? '<input class="zc-veld" data-k="' + esc(z.id) + '" placeholder="besluit" style="min-width:8rem;">' +
                  '<input class="zc-veld" data-r="' + esc(z.id) + '" placeholder="waarom" style="flex:1;min-width:9rem;">' +
                  '<button class="zc-knop vol" data-bes="' + esc(z.id) + '">Klaar</button>' : '') +
                '</div>') +
            '</div>';
        }).join('');
        vak.innerHTML = u;
        vak.querySelectorAll('[data-neem]').forEach(function (b) {
          b.onclick = function () { api('zaak/neem', { id: b.dataset.neem }).then(function () { melden('Opgepakt.'); lijst(); }).catch(function (e) { melden(e.message); }); };
        });
        vak.querySelectorAll('[data-bes]').forEach(function (b) {
          b.onclick = function () {
            var id = b.dataset.bes;
            api('zaak/besluit', { id: id, keuze: vak.querySelector('[data-k="' + id + '"]').value,
              reden: vak.querySelector('[data-r="' + id + '"]').value })
              .then(function () { melden('Afgehandeld.'); return ververs(); }).then(lijst).catch(function (e) { melden(e.message); });
          };
        });
      }).catch(function (e) { vak.innerHTML = '<div class="zc-leeg">' + esc(e.message) + '</div>'; });
    }

    TEKENAARS.nu = nu;
    TEKENAARS.lijst = lijst;

    /* De rest van de werkplekken (zoeken, dossier, rechtzetten, instellingen)
       staat in deel 3. Ontbreekt dat deel, dan blijven Nu en de lijst gewoon
       werken en verdwijnen de andere knoppen -- beter een kleiner scherm dan
       een scherm dat op de eerste klik omvalt. */
    if (typeof Z.delen.rest === 'function') {
      Z.delen.rest({ el: el, vak: vak, S: S, api: api, compact: compact, TEKENAARS: TEKENAARS,
        teken: teken, railTeken: railTeken, ververs: ververs, melden: melden, tegel: tegel });
    } else {
      WERKPLEKKEN = WERKPLEKKEN.filter(function (p) { return TEKENAARS[p[0]]; });
    }

    railTeken();
    ververs().then(function () { teken(); }).catch(function (e) {
      vak.innerHTML = '<div class="zc-leeg">De regie kon niet laden: ' + esc(e.message) + '</div>';
    });
    return { ververs: function () { return ververs().then(teken); } };
  }

  Z.toon = toon;
})(window, document);

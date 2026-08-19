/* De Regie van de zaak, deel 4: rechtzetten en de regels.

   DIT ZIJN DE TWEE SCHERMEN WAAR IETS VERANDERT, en daarom staan ze apart van
   het kijken (deel 3). Rechtzetten laat eerst zien wat er zou gebeuren en pas
   daarna doen -- de volgorde van de knoppen is de volgorde van het werk. De
   regels zijn die van deze zaak alleen, met een versie per wijziging en één
   knop terug.

   Beide hangen zichzelf in dezelfde tekenaarstabel als deel 3. */
(function (w) {
  'use strict';
  var Z = w.RTGZaakCommand;
  if (!Z) return;
  var esc = Z.esc, tijd = Z.tijd, nv = Z.nv;

  var vorige = Z.delen.rest;
  Z.delen.rest = function (b) {
    if (vorige) vorige(b);
    var vak = b.vak, S = b.S, api = b.api, T = b.TEKENAARS;

    /* ---- rechtzetten: de recepten en de laatste rondes ---- */
    T.recht = function () {
      vak.innerHTML = '<div class="zc-leeg">Laden…</div>';
      Promise.all([api('runbooks'), api('runs', { n: 10 })]).then(function (r) {
        var u = r[0].runbooks.map(function (rb) {
          return '<div class="zc-kaart"><h3>' + esc(rb.naam) + ' ' + nv(rb.oordeel.niveau) + '</h3>' +
            '<p class="zc-meta">' + esc(rb.wat) + '</p>' +
            '<div class="zc-rij"><b>' + rb.kandidaten + '</b><span class="zc-meta">geval(len) nu</span>' +
            (rb.kandidaten ? '<button class="zc-knop" data-droog="' + esc(rb.id) + '">Eerst tonen</button>' +
              (S.mag ? '<button class="zc-knop vol" data-voer="' + esc(rb.id) + '">Rechtzetten</button>' : '') : '') +
            '</div><div class="zc-meta" id="zcD-' + esc(rb.id) + '"></div></div>';
        }).join('');
        u += '<div class="zc-kaart"><h3>Laatste rondes</h3>';
        if (!r[1].runs.length) u += '<p class="zc-meta">Er is nog niets rechtgezet.</p>';
        u += r[1].runs.map(function (x) {
          return '<div class="zc-sig"><div>' + esc(x.naam) + ' <span class="zc-meta">· ' + esc(tijd(x.at)) + ' · ' +
            (x.droog ? 'alleen getoond' : x.geraakt + ' gewijzigd') + ' · ' + esc(x.door) + '</span></div>' +
            (!x.droog && !x.teruggedraaid && S.mag ? '<div class="zc-rij"><button class="zc-knop" data-terug="' + esc(x.id) + '">Terugzetten</button></div>' : '') +
            (x.teruggedraaid ? '<div class="zc-meta">teruggezet door ' + esc(x.terugDoor) + '</div>' : '') + '</div>';
        }).join('') + '</div>';
        vak.innerHTML = u;
        vak.querySelectorAll('[data-droog]').forEach(function (x) {
          x.onclick = function () {
            api('runbook/voer', { id: x.dataset.droog, droog: true }).then(function (rr) {
              vak.querySelector('#zcD-' + x.dataset.droog).innerHTML =
                '<div class="h-mt50">' + rr.run.geraakt + ' van ' + rr.run.totaalKandidaten + ' zouden wijzigen:<br>' +
                rr.run.voorbeelden.map(function (v) { return esc(v.titel) + ': ' + esc(v.van) + ' → ' + esc(v.naar); }).join('<br>') + '</div>';
            }).catch(function (e) { b.melden(e.message); });
          };
        });
        vak.querySelectorAll('[data-voer]').forEach(function (x) {
          x.onclick = function () {
            var reden = prompt('Waarom zet u dit recht?');
            if (!reden) return;
            api('runbook/voer', { id: x.dataset.voer, droog: false, reden: reden, menselijkAkkoord: true })
              .then(function (rr) { b.melden(rr.run.geraakt + ' rechtgezet.'); return b.ververs(); })
              .then(function () { T.recht(); }).catch(function (e) { b.melden(e.message); });
          };
        });
        vak.querySelectorAll('[data-terug]').forEach(function (x) {
          x.onclick = function () {
            var reden = prompt('Waarom zet u deze ronde terug?');
            if (!reden) return;
            api('runbook/terug', { run: x.dataset.terug, reden: reden })
              .then(function (rr) { b.melden(rr.teruggezet + ' teruggezet, ' + rr.overgeslagen + ' overgeslagen.'); return b.ververs(); })
              .then(function () { T.recht(); }).catch(function (e) { b.melden(e.message); });
          };
        });
      }).catch(function (e) { vak.innerHTML = '<div class="zc-leeg">' + esc(e.message) + '</div>'; });
    };

    /* ---- de regels van de zaak ---- */
    T.regels = function () {
      vak.innerHTML = '<div class="zc-leeg">Laden…</div>';
      api('beleid').then(function (d) {
        vak.innerHTML = '<div class="zc-kaart"><h3>De regels van uw zaak</h3>' +
          '<p class="zc-meta">Deze grenzen bepalen wat de assistent zelf mag rechtzetten en wanneer iets een signaal wordt. ' +
          'Ze gelden alleen voor uw zaak. Elke wijziging krijgt een versie en een regel in uw spoor; er is altijd één knop terug.</p></div>' +
          d.regels.map(function (g) {
            return '<div class="zc-kaart"><h3>' + esc(g.wat) + '</h3>' +
              '<p class="zc-meta">' + esc(g.id) + ' · versie ' + g.versie + (g.sinds ? ' · sinds ' + esc(tijd(g.sinds)) + ' door ' + esc(g.door) : ' · startwaarde') + '</p>' +
              '<div class="zc-rij"><b>' + esc(String(g.waarde)) + '</b><span class="zc-meta">' + esc(g.eenheid) + '</span>' +
              '<input class="zc-veld" data-n="' + esc(g.id) + '" placeholder="nieuw" style="width:6rem;">' +
              '<input class="zc-veld" data-w="' + esc(g.id) + '" placeholder="waarom" style="flex:1;min-width:8rem;">' +
              '<button class="zc-knop vol" data-zet="' + esc(g.id) + '">Zetten</button>' +
              (g.versies > 1 ? '<button class="zc-knop" data-terug2="' + esc(g.id) + '">Eén terug</button>' : '') + '</div></div>';
          }).join('');
        vak.querySelectorAll('[data-zet]').forEach(function (x) {
          x.onclick = function () {
            var id = x.dataset.zet, v = vak.querySelector('[data-n="' + id + '"]').value;
            if (v === '') { b.melden('Vul een nieuwe waarde in.'); return; }
            var waarde = v === 'true' ? true : v === 'false' ? false : isNaN(Number(v)) ? v : Number(v);
            api('beleid/zet', { id: id, waarde: waarde, reden: vak.querySelector('[data-w="' + id + '"]').value })
              .then(function () { b.melden('Gezet.'); return b.ververs(); }).then(function () { T.regels(); })
              .catch(function (e) { b.melden(e.message); });
          };
        });
        vak.querySelectorAll('[data-terug2]').forEach(function (x) {
          x.onclick = function () {
            var reden = prompt('Waarom zet u deze regel terug?');
            if (!reden) return;
            api('beleid/terug', { id: x.dataset.terug2, reden: reden })
              .then(function () { b.melden('Teruggezet.'); return b.ververs(); }).then(function () { T.regels(); })
              .catch(function (e) { b.melden(e.message); });
          };
        });
      }).catch(function (e) { vak.innerHTML = '<div class="zc-leeg">' + esc(e.message) + '</div>'; });
    };
  };
})(window);

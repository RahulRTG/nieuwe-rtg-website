/* De Regie van de zaak, deel 3: zoeken en het objectdossier.

   HET DOSSIER IS DE REDEN DAT DIT SCHERM BESTAAT. Een bestelling opzoeken kan
   in de orderlijst ook; wat hier bij komt is de SAMENHANG -- welke andere
   dingen van deze zaak aan dit ene object hangen, en wat er precies mee
   gebeurd is, in volgorde, met wie het deed. Dat stond tot nu toe verspreid
   over zes tabbladen.

   EN HET ZEGT WAT HET NIET WEET. Is de samenhangscan tegen zijn grens gelopen,
   dan staat dat er. Wat hier NIET kan staan is iets van een andere zaak: dit
   scherm vraagt het aan een register dat de buurman niet kent.

   Rechtzetten en de regels staan in deel 4. */
(function (w) {
  'use strict';
  var Z = w.RTGZaakCommand;
  if (!Z) return;
  var esc = Z.esc, tijd = Z.tijd, nv = Z.nv;

  Z.delen.rest = function (b) {
    var vak = b.vak, S = b.S, api = b.api, T = b.TEKENAARS;

    /* ---- zoeken binnen de eigen zaak ---- */
    T.zoek = function () {
      vak.innerHTML = '<div class="zc-kaart"><h3>Zoek in uw zaak</h3>' +
        '<p class="zc-meta">Bestelnummer, tafel, kamer, naam of status. Alleen wat van uw zaak is.</p>' +
        '<div class="zc-rij"><input class="zc-veld" id="zcQ" placeholder="zoeken…" style="flex:1;min-width:10rem;" value="' + esc(S.zoekterm) + '">' +
        '<button class="zc-knop vol" id="zcGa">Zoek</button></div></div><div id="zcUit"></div>';
      var inp = vak.querySelector('#zcQ');
      var doe = function () {
        S.zoekterm = inp.value;
        if (!S.zoekterm.trim()) return;
        vak.querySelector('#zcUit').innerHTML = '<div class="zc-leeg">Zoeken…</div>';
        api('zoek', { q: S.zoekterm }).then(function (d) {
          vak.querySelector('#zcUit').innerHTML = zoekuit(d);
          vak.querySelectorAll('#zcUit [data-t]').forEach(function (x) {
            x.onclick = function () { S.object = { type: x.dataset.t, id: x.dataset.i, data: null }; S.werkplek = 'object'; b.teken(); };
          });
        }).catch(function (e) { vak.querySelector('#zcUit').innerHTML = '<div class="zc-leeg">' + esc(e.message) + '</div>'; });
      };
      vak.querySelector('#zcGa').onclick = doe;
      inp.onkeydown = function (e) { if (e.key === 'Enter') doe(); };
      if (S.zoekterm.trim()) doe();
    };

    function zoekuit(d) {
      if (d.kort) return '<div class="zc-leeg">Een zoekterm van minstens twee tekens, graag.</div>';
      if (!d.groepen.length) {
        return '<div class="zc-kaart"><h3>Niets gevonden</h3><p class="zc-meta">Er is gekeken in: ' +
          esc((d.bereik || []).map(function (x) { return x.meervoud; }).join(', ')) + '.</p></div>';
      }
      return d.groepen.map(function (g) {
        return '<div class="zc-kaart"><h3>' + esc(g.label) + ' <span class="zc-meta">· ' + g.totaal + '</span></h3>' +
          g.rijen.map(function (r) {
            return '<div class="zc-sig"><button class="zc-knop" data-t="' + esc(r.type) + '" data-i="' + esc(r.id) + '" ' +
              'style="border:none;padding:0;text-align:left;"><b>' + esc(r.titel) + '</b></button>' +
              (r.sub ? '<div class="zc-meta">' + esc(r.sub) + '</div>' : '') + '</div>';
          }).join('') + '</div>';
      }).join('');
    }

    /* ---- het objectdossier ---- */
    T.object = function () {
      var o = S.object;
      if (!o) { vak.innerHTML = '<div class="zc-leeg">Geen object gekozen.</div>'; return; }
      if (!o.data) {
        vak.innerHTML = '<div class="zc-leeg">Dossier laden…</div>';
        api('object', { type: o.type, id: o.id }).then(function (d) { o.data = d; b.teken(); })
          .catch(function (e) { vak.innerHTML = '<div class="zc-leeg">' + esc(e.message) + '</div>'; });
        return;
      }
      var d = o.data;
      var u = '<button class="zc-knop" id="zcTerug">← terug</button>' +
        '<div class="zc-kaart" style="margin-top:.7rem;"><h3>' + esc(d.object.titel) + '</h3>' +
        '<p class="zc-meta">' + esc(d.object.label) + ' ' + esc(d.object.id) + (d.object.sub ? ' · ' + esc(d.object.sub) : '') + '</p></div>';

      u += '<div class="zc-kaart"><h3>Wat er kan</h3>';
      u += d.acties.map(function (a) {
        return '<div class="zc-sig"><div><b>' + esc(a.naam) + '</b> ' + nv(a.niveau) + '</div>' +
          '<div class="zc-meta">' + esc(a.waaromNiet || a.wat) + '</div>' +
          (a.soort === 'runbook' && a.past && S.mag ? '<div class="zc-rij">' +
            '<button class="zc-knop" data-rb="' + esc(a.id) + '" data-droog="1">Eerst tonen</button>' +
            '<button class="zc-knop vol" data-rb="' + esc(a.id) + '">Rechtzetten</button></div>' : '') + '</div>';
      }).join('') + '</div>';

      u += '<div class="zc-kaart"><h3>Wat er gebeurd is</h3>';
      if (!d.tijdlijn.length) u += '<p class="zc-meta">Nog niets vastgelegd.</p>';
      u += d.tijdlijn.slice(0, 25).map(function (r) {
        return '<div class="zc-sig"><span class="zc-meta">' + esc(tijd(r.at)) + '</span> · ' + esc(r.wat) +
          (r.door ? ' <span class="zc-meta">door ' + esc(r.door) + '</span>' : '') + '</div>';
      }).join('') + '</div>';

      u += '<div class="zc-kaart"><h3>Hangt hieraan</h3>';
      if (!d.afhankelijkheden.length) u += '<p class="zc-meta">Niets van uw zaak verwijst hiernaar.</p>';
      u += d.afhankelijkheden.map(function (g) {
        return '<div class="zc-sig"><b>' + esc(g.label) + '</b> <span class="zc-meta">' + g.totaal + '</span><div class="zc-meta">' +
          g.rijen.map(function (x) { return '<button class="zc-knop" data-t="' + esc(x.type) + '" data-i="' + esc(x.id) + '" style="border:none;padding:0;font-size:.78rem;">' + esc(x.titel) + '</button>'; }).join(' · ') +
          '</div></div>';
      }).join('');
      if (d.afhankelijkhedenOnvolledig) u += '<p class="zc-meta">Let op: een lijst was groter dan de scangrens; dit overzicht is niet volledig.</p>';
      u += '</div>';

      vak.innerHTML = u;
      vak.querySelector('#zcTerug').onclick = function () { S.werkplek = 'zoek'; b.railTeken(); b.teken(); };
      vak.querySelectorAll('[data-t]').forEach(function (x) {
        x.onclick = function () { S.object = { type: x.dataset.t, id: x.dataset.i, data: null }; b.teken(); };
      });
      vak.querySelectorAll('[data-rb]').forEach(function (x) {
        x.onclick = function () {
          var droog = x.dataset.droog === '1';
          var reden = droog ? '' : prompt('Waarom zet u dit recht?');
          if (!droog && !reden) return;
          api('runbook/voer', { id: x.dataset.rb, droog: droog, reden: reden, alleen: [o.id], menselijkAkkoord: !droog })
            .then(function (r) {
              b.melden(droog ? ('Zou ' + r.run.geraakt + ' geval(len) wijzigen.') : (r.run.geraakt + ' rechtgezet.'));
              if (!droog) { o.data = null; return b.ververs(); }
            }).then(function () { b.teken(); })
            .catch(function (e) { b.melden(e.message); });
        };
      });
    };
  };
})(window);

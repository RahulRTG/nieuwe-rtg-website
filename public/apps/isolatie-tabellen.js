/* De tabellen van de isolatiecockpit -- afgesplitst van isolatie.js, dat over de
   tienduizend bytes ging. De snede loopt langs een echte grens: hierboven staat
   wat het scherm DOET (laden, zetten, proefdraaien) en hier hoe het zijn
   uitkomsten TEKENT. Ze delen de kleine hulpjes via het venster, want dit zijn
   twee losse scripts en geen modules. */
'use strict';
(function () {
  var H = window.RTGIsolatieHulp;
  var maak = H.maak, leeg = H.leeg, stipVoor = H.stipVoor;
  var $ = function (id) { return document.getElementById(id); };
  /* ---------- tabellen ---------- */
  function tabel(kolommen, rijen) {
    var t = maak('table');
    var thead = maak('thead'), tr = maak('tr');
    kolommen.forEach(function (k) { tr.appendChild(maak('th', null, k)); });
    thead.appendChild(tr);
    t.appendChild(thead);
    var tb = maak('tbody');
    rijen.forEach(function (r) {
      var q = maak('tr');
      r.forEach(function (c, i) {
        var td = maak('td', i === 0 ? 'mono' : null);
        if (c && c.nodeType) td.appendChild(c); else td.appendChild(document.createTextNode(String(c == null ? '-' : c)));
        q.appendChild(td);
      });
      tb.appendChild(q);
    });
    t.appendChild(tb);
    return t;
  }

  function tekenDragers(o) {
    var kaart = $('dragerkaart');
    leeg(kaart);
    var rijen = [];
    ['organisatie', 'identiteit', 'sessie', 'apparaat'].forEach(function (d) {
      var p = o.perDrager[d] || { aantal: 0, perStand: {} };
      Object.keys(p.perStand).sort().forEach(function (s) {
        var cel = maak('span');
        cel.appendChild(stipVoor(s));
        cel.appendChild(document.createTextNode(s));
        rijen.push([d, cel, String(p.perStand[s])]);
      });
    });
    if (!rijen.length) {
      kaart.appendChild(maak('p', 'voetnoot', 'Geen enkele drager staat in een stand.'));
      return;
    }
    kaart.appendChild(tabel(['Drager', 'Stand', 'Aantal'], rijen));
  }

  function tekenSpoor(o) {
    var kaart = $('spoorkaart');
    leeg(kaart);
    var s = o.spoor || [];
    if (!s.length) {
      kaart.appendChild(maak('p', 'voetnoot', 'Nog geen enkele zetting. Het spoor groeit aan en wordt nooit herschreven.'));
      return;
    }
    kaart.appendChild(tabel(['Wanneer', 'Drager', 'Van → naar', 'Richting', 'Door'],
      s.slice(0, 25).map(function (r) {
        return [String(r.at).replace('T', ' ').slice(0, 19), r.drager, r.van + ' → ' + r.naar,
          r.richting, r.door];
      })));
  }

  /* WAT ER NOG WERKT. Hij staat BOVEN de gaten en niet eronder: wie besluit een
     klant dicht te zetten, hoort eerst te zien wat die klant dat kost. */
  function tekenBruikbaar(o) {
    var kaart = $('bruikbaar');
    if (!kaart) return;
    leeg(kaart);
    var b = o.bruikbaarheid;
    if (!b) { kaart.appendChild(maak('p', 'voetnoot', 'Niet gemeten.')); return; }
    kaart.appendChild(tabel(['Stand', 'Werkt', 'Beperkt', 'Werkt niet'],
      Object.keys(b).map(function (s) {
        return [s, String(b[s].werkt), String(b[s].beperkt), String(b[s].werktNiet)];
      })));
    var gezakt = [];
    Object.keys(b).forEach(function (s) {
      (b[s].belofteGezakt || []).forEach(function (g) { gezakt.push(s + ': ' + g.id); });
    });
    kaart.appendChild(maak('p', 'voetnoot', gezakt.length
      ? 'BELOFTE GEZAKT: ' + gezakt.join(', ') + '. Een stand die zijn eigen belofte breekt, wordt niet gebruikt.'
      : 'Elke belofte staat heel onder elke stand. Wat er dichtgaat, gaat met opzet dicht.'));
  }

  function tekenGaten(o) {
    var kaart = $('gatenkaart');
    leeg(kaart);
    kaart.appendChild(maak('p', null, 'Het effectmodel ' +
      (o.effectmodel.handhaaft ? 'handhaaft.' : 'handhaaft NIETS.')));
    kaart.appendChild(maak('p', 'voetnoot', o.effectmodel.waarom));
    (o.dragersZonderBron || []).forEach(function (z) {
      kaart.appendChild(maak('p', 'voetnoot', 'Drager "' + z.naam + '": ' + z.waarom));
    });
  }

  window.RTGIsolatieTabellen = { tabel: tabel, tekenDragers: tekenDragers,
    tekenSpoor: tekenSpoor, tekenBruikbaar: tekenBruikbaar, tekenGaten: tekenGaten };
})();

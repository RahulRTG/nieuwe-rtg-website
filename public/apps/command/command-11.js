/* RTG Command, deel 11: de herkomst -- waar komt een gegeven vandaan en wie
   hangt ervan af.

   WAT DIT SCHERM ANDERS DOET DAN EEN GEWOON LINEAGE-BORD: het zet bij elk
   antwoord waar het vandaan komt. Gemeten uit de gegevens, aangegeven in een
   tabel die een mens schreef, of gerekend uit die twee. Zet je die drie door
   elkaar in één plaatje, dan krijgt het geheel de betrouwbaarheid van het
   zwakste deel en kan niemand zien welk deel dat is.

   EN DE BLINDE VLEK STAAT BOVENAAN EN NIET IN EEN VOETNOOT. Het journaal ziet
   alleen wat via Command is gegaan. Een soort zonder schrijver betekent hier
   dus niet "hier schrijft niemand in" -- en juist die verwarring is hoe iemand
   iets weggooit waar wel degelijk aan wordt geschreven. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api, S = C.S;

  var AARD = { gemeten: 'ok', aangegeven: 'onbekend', afgeleid: 'mis' };
  function merk(a) {
    return '<span class="cniveau ' + (AARD[a] || '') + '">' + esc(a) + '</span>';
  }

  C.TEKENAARS.herkomst = function (el) {
    el.innerHTML = '<h2 class="ckop">Herkomst</h2>' +
      '<p class="lead">Waar een gegeven vandaan komt, wie eraan mag schrijven, wie het werkelijk deed, ' +
      'hoe lang het blijft, en wat er wees wordt als het verdwijnt. Bij elk antwoord staat of het ' +
      'gemeten is, aangegeven in een tabel, of daaruit gerekend.</p>' +
      '<div id="hkUit"><div class="leeg">Meten…</div></div>';
    api('herkomst').then(function (d) {
      var u = '<div class="kaart"><h3>De blinde vlek</h3><p>' + esc(d.blindeVlek) + '</p></div>';

      u += '<div class="rooster">' +
        tegel('Soorten', d.soorten.length, '', 'in het register van deze laag') +
        tegel('Zonder termijn', d.zonderTermijn.length, d.zonderTermijn.length ? 'gold' : 'groen',
          'staan niet in het bewaarbeleid') +
        tegel('Zonder schrijver', d.zonderSchrijver.length, '', 'niemand schreef hierin via Command') +
        '</div>';

      u += '<div class="kaart"><h3>Zoek de herkomst van één object</h3>' +
        '<div class="crij"><input class="veld" id="hkT" placeholder="soort (bv. zaak)" style="width:9rem;">' +
        '<input class="veld" id="hkI" placeholder="id" style="width:9rem;">' +
        '<button class="knop vol" id="hkGa">Spoor</button></div><div id="hkSpoor"></div></div>';

      for (var i = 0; i < d.soorten.length; i++) u += soortKaart(d.soorten[i]);
      document.querySelector('#hkUit').innerHTML = u;

      document.querySelector('#hkGa').onclick = function () {
        api('herkomst/spoor', { type: document.querySelector('#hkT').value, id: document.querySelector('#hkI').value })
          .then(teken).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    }).catch(function (e) {
      if (!e.stil) document.querySelector('#hkUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
    });
  };

  function soortKaart(k) {
    var u = '<div class="kaart"><h3>' + esc(k.label) + ' <span class="meta">' + esc(k.collectie) + ' · ' +
      k.aantal + '</span></h3>';

    u += '<div class="lijn"><b>Wijst naar</b> ' + merk('gemeten') + '<div class="meta">' +
      (k.heen.length ? k.heen.map(function (h) {
        return esc(h.veld) + ' → ' + esc(h.naar) + ' (' + Math.round(h.deel * 100) + '%)';
      }).join(' · ') : 'geen enkel veld wijst meetbaar naar een andere soort') + '</div></div>';

    u += '<div class="lijn"><b>Hangt hiervan af</b> ' + merk('afgeleid') + '<div class="meta">' +
      esc(k.afhankelijk.uitleg) + '</div></div>';

    u += '<div class="lijn"><b>Mag schrijven</b> ' + merk('aangegeven') + '<div class="meta">' +
      (k.magSchrijven.length ? k.magSchrijven.map(function (m) {
        return esc(m.naam) + ' (' + esc(m.veld) + ')';
      }).join(' · ') : 'geen runbook raakt deze soort aan') + '</div></div>';

    u += '<div class="lijn"><b>Heeft geschreven</b> ' + merk('gemeten') + '<div class="meta">' +
      (k.heeftGeschreven.length ? k.heeftGeschreven.map(function (h) {
        return esc(h.actie) + ' ' + h.aantal + '× (' + h.niveaus.join('/') + ')';
      }).join(' · ') : 'het journaal heeft hier niets over genoteerd') + '</div></div>';

    u += '<div class="lijn"><b>Blijft</b> ' + merk('aangegeven') + '<div class="meta">' +
      (k.bewaren.termijn ? Math.round(k.bewaren.termijn) + ' dagen, grond ' + esc(k.bewaren.grond) + ' -- ' +
        esc(k.bewaren.uitleg) : esc(k.bewaren.uitleg)) + '</div></div>';

    return u + '</div>';
  }

  function teken(w) {
    var u = '<p class="meta" style="margin-top:.7rem;"><b>' + esc(w.object.titel) + '</b></p>';
    u += rij('Wijst naar', w.wijstNaar.map(function (x) { return x.type + ' ' + x.id + ' (via ' + x.via + ')'; }));
    u += rij('Wordt genoemd door', w.wordtGenoemdDoor.map(function (x) { return x.type + ' ' + x.id; }));
    u += rij('In het journaal', w.journaal.map(function (r) { return r.at + ' ' + r.actie + ' (' + r.actor + ')'; }));
    u += '<div class="lijn"><b>Bewaren</b><div class="meta">' +
      (w.bewaren.vervalt ? 'verloopt op ' + esc(w.bewaren.vervalt) : esc(w.bewaren.uitleg)) +
      (w.bewaren.let ? ' -- ' + esc(w.bewaren.let) : '') + '</div></div>';
    document.querySelector('#hkSpoor').innerHTML = u;
  }

  function rij(kop, lijst) {
    return '<div class="lijn"><b>' + esc(kop) + '</b> <span class="meta">' + lijst.length + '</span>' +
      '<div class="meta">' + (lijst.length ? esc(lijst.slice(0, 12).join(' · ')) : 'niets') + '</div></div>';
  }

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + esc(v) + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  var i = C.WERKPLEKKEN.findIndex(function (w) { return w.id === 'graaf'; });
  C.WERKPLEKKEN.splice(i + 1, 0, { id: 'herkomst', naam: 'Herkomst', sec: 'Zien' });
  void S;
})();

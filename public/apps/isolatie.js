/* De isolatiecockpit. Hij toont wat server/kern/isolatie/ zegt en rekent zelf
   niets uit -- ook niet "even" een stand samenvoegen: dat is precies hoe twee
   schermen op een dag iets anders gaan zeggen over dezelfde stand. */
'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var STANDEN = ['normaal', 'waakzaam', 'beperkt', 'beschermd', 'isolatie'];

  function tekst(el, s) { el.textContent = s == null ? '' : String(s); }
  function leeg(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function maak(tag, klas, inhoud) {
    var e = document.createElement(tag);
    if (klas) e.className = klas;
    if (inhoud != null) e.textContent = String(inhoud);
    return e;
  }
  function stipVoor(stand) {
    var s = maak('span', 'stip' + (STANDEN.indexOf(String(stand)) >= 0 ? ' ' + stand : ''));
    return s;
  }

  /* De kleine hulpjes gaan naar het venster omdat ./isolatie-tabellen.js ze
     nodig heeft; dat zijn twee losse scripts en geen modules. Alleen deze drie,
     en met een eigen naam: een globale `maak` zou vroeg of laat botsen. */
  window.RTGIsolatieHulp = { maak: maak, leeg: leeg, stipVoor: stipVoor };

  function meld(soort, tekstIn) {
    var m = $('melding');
    leeg(m);
    m.className = 'melding' + (soort ? ' ' + soort : '');
    m.appendChild(document.createTextNode(String(tekstIn)));
    m.hidden = false;
  }

  function haal(pad, lijf) {
    var opties = { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' };
    if (lijf) {
      opties.method = 'POST';
      opties.headers['Content-Type'] = 'application/json';
      opties.body = JSON.stringify(lijf);
    }
    return fetch(pad, opties).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var e = new Error(j.error || (r.status === 401 || r.status === 403
            ? 'Geen toegang. Log eerst in op de technische pagina.' : 'Er ging iets mis.'));
          e.status = r.status;
          throw e;
        }
        return j;
      });
    });
  }

  /* ---------- de rail ---------- */
  function tekenRail(o) {
    var rail = $('rail');
    leeg(rail);
    var cellen = [
      { l: 'Huis', n: o.huis, w: 'uit de incidentcontrole; hier niet te zetten', stand: o.huis }
    ];
    ['organisatie', 'identiteit', 'sessie', 'apparaat'].forEach(function (d) {
      var p = o.perDrager[d] || { aantal: 0, perStand: {} };
      var standen = Object.keys(p.perStand).sort();
      cellen.push({
        l: d, n: String(p.aantal), klein: false,
        w: standen.length ? standen.map(function (s) { return s + ': ' + p.perStand[s]; }).join(' · ')
          : 'geen enkele in een stand'
      });
    });
    cellen.forEach(function (c) {
      var cel = maak('div', 'cel');
      cel.appendChild(maak('div', 'l', c.l));
      var n = maak('div', 'n' + (c.klein ? ' klein' : ''));
      if (c.stand) n.appendChild(stipVoor(c.stand));
      n.appendChild(document.createTextNode(String(c.n)));
      cel.appendChild(n);
      cel.appendChild(maak('div', 'w', c.w));
      rail.appendChild(cel);
    });

    var zonder = o.dragersZonderBron || [];
    tekst($('railvoet'), zonder.length
      ? zonder.length + ' drager zonder bron (' + zonder.map(function (z) { return z.naam; }).join(', ') +
        '): hij levert geen stand, en dat is iets anders dan de stand normaal.'
      : 'Alle dragers dragen een stand.');
  }

  /* ---------- ontsluitingen ---------- */
  function tekenOntsluitingen(o) {
    var kaart = $('ontsluitkaart');
    leeg(kaart);
    var open = o.openOntsluitingen || [];
    if (!open.length) {
      kaart.appendChild(maak('p', 'voetnoot', 'Er loopt geen ontsluiting. Een verzoek verlaagt overigens ' +
        'niets: pas de laatste, geautoriseerde stap levert een nieuwe stand op.'));
      return;
    }
    open.forEach(function (v) {
      var blok = maak('div');
      blok.style.paddingBottom = '1rem';
      var kop = maak('div');
      kop.appendChild(maak('strong', null, v.drager + ' · ' + (v.sleutel || '-')));
      kop.appendChild(document.createTextNode('  ' + v.van + ' → ' + v.naar));
      blok.appendChild(kop);
      blok.appendChild(maak('div', 'voetnoot', v.reden));
      (v.vereisten || []).forEach(function (eis) {
        var klaar = eis === 'wachttijd' ? v.wachttijdVerstreken : !!(v.voltooid && v.voltooid[eis]);
        var r = maak('div', 'stap');
        r.appendChild(maak('span', 'vink' + (klaar ? ' klaar' : '')));
        r.appendChild(maak('span', null, eis + (klaar ? '' : ': nog open')));
        blok.appendChild(r);
      });
      var rij = maak('div');
      rij.style.marginTop = '.7rem';
      rij.style.display = 'flex';
      rij.style.gap = '.5rem';
      rij.style.flexWrap = 'wrap';
      var af = maak('button', 'knop grijs klein', 'Afbreken');
      af.addEventListener('click', function () {
        haal('/api/techniek/isolatie/ontsluiting/afbreken', { id: v.id, reden: 'afgebroken vanaf de cockpit' })
          .then(function () { meld('goed', 'Ontsluiting afgebroken.'); laad(); })
          .catch(function (e) { meld('fout', e.message); });
      });
      rij.appendChild(af);
      var klaarKnop = maak('button', 'knop klein', 'Voltooien');
      klaarKnop.disabled = (v.ontbreekt || []).length > 0;
      klaarKnop.addEventListener('click', function () {
        haal('/api/techniek/isolatie/ontsluiting/commit', { id: v.id })
          .then(function (j) { meld('goed', 'Stand verlaagd naar ' + j.uit.nieuweStand + '.'); laad(); })
          .catch(function (e) { meld('fout', e.message); });
      });
      rij.appendChild(klaarKnop);
      blok.appendChild(rij);
      kaart.appendChild(blok);
    });
  }

  /* De tabellen staan in ./isolatie-tabellen.js; zie daar waarom. */
  /* ---------- proef ---------- */
  var PROEFPADEN = ['/api/pay/stuur', '/api/bank/sepa', '/api/bank/afschrift', '/api/pay/overzicht',
    '/api/agenda/mijn', '/api/salon/post'];

  function proef() {
    var drager = $('d-drager').value, sleutel = $('d-sleutel').value.trim();
    if (!sleutel) { meld('fout', 'Vul een sleutel in; een stand hangt aan een sleutel.'); return; }
    var lijf = { paden: PROEFPADEN, wereld: 'member' };
    lijf[drager] = sleutel;
    haal('/api/techniek/isolatie/proef', lijf).then(function (j) {
      var uit = $('proefuit');
      leeg(uit);
      var st = j.stand;
      uit.appendChild(maak('p', 'voetnoot', 'Effectieve stand: trede ' + (st.trede || 'geen') +
        (st.beschermd ? ' + beschermd' : '') + (st.tredeOnbepaald ? ' (trede niet vast te stellen)' : '')));
      uit.appendChild(window.RTGIsolatieTabellen.tabel(['Pad', 'Uitkomst', 'Waarom', 'Schaduw'],
        (j.besluiten || []).map(function (b) {
          return [b.pad, b.toegestaan ? 'loopt door' : 'tegengehouden', b.uitleg,
            b.schaduw.oordeel + (b.onenigheid ? ': oneens (' + b.onenigheid.soort + ')' : '')];
        })));
      if (j.stuur && j.stuur.uitleg) uit.appendChild(maak('p', 'voetnoot', 'Het AI-stuur: ' + j.stuur.uitleg));
      meld('goed', 'Proef gedraaid. Er is niets uitgevoerd en niets veranderd.');
    }).catch(function (e) { meld('fout', e.message); });
  }

  function zet() {
    var lijf = { drager: $('d-drager').value, sleutel: $('d-sleutel').value.trim(),
      naar: $('d-naar').value, reden: $('d-reden').value.trim() };
    if (!lijf.sleutel) { meld('fout', 'Vul een sleutel in; een stand hangt aan een sleutel.'); return; }
    haal('/api/techniek/isolatie/zet', lijf).then(function (j) {
      meld('goed', 'Stand op ' + j.uit.drager + ' verstrengd naar ' + j.uit.stand + '.');
      laad();
    }).catch(function (e) { meld('fout', e.message); });
  }

  function laad() {
    haal('/api/techniek/isolatie').then(function (o) {
      var T = window.RTGIsolatieTabellen;
      tekenRail(o); tekenOntsluitingen(o);
      T.tekenDragers(o); T.tekenBruikbaar(o); T.tekenSpoor(o); T.tekenGaten(o);
    }).catch(function (e) { meld('fout', e.message); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('btn-zet').addEventListener('click', zet);
    $('btn-proef').addEventListener('click', proef);
    laad();
  });
})();

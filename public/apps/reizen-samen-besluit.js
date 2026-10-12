/* DE GEZAMENLIJKE REIS IN HET BLAD SAMEN -- de werkruimte van een deelnemer.

   Dit bestand beslist niets. De server (kern/reisgezelschap-werkruimte.js)
   geeft per deelnemer een projectie terug met `werkruimte.blokken` en
   `werkruimte.handelingen`; hier wordt alleen getekend wat daarin staat. Een
   blok dat niet in de lijst staat, blijft verborgen -- ook als de gegevens er
   toevallig wel zouden zijn.

   ACTUEEL OF NIET. Elke ronde draagt een vingerafdruk (`kenmerk`) en het moment
   waarop de server rekende. Na een eigen wijziging staat er "wordt herberekend"
   tot het nieuwe beeld er is, en lukt het ophalen niet, dan staat er sinds
   wanneer het beeld niet meer is bijgewerkt. Een oud resultaat wordt nooit als
   actueel getoond.

   DE EDGE krijgt de voortgang als Trust Rail en twee handelingen; dat staat in
   ./reizen-samen-voorstel.js, uit dezelfde projectie. */
(function (w, d) {
  'use strict';
  var R = w.RTGReizen; if (!R) return;
  var $ = R.$, maak = R.maak;
  var reis = null, laatste = null, keuzes = [], klok = null, bezig = null;
  var RONDE_MS = 6000;
  var taal = (d.documentElement && d.documentElement.lang) || undefined;   // de taal van de pagina, niet een vaste

  function euro(c) { return '€ ' + Math.round(c / 100).toLocaleString(taal); }
  function tijd(iso) {
    var t = new Date(String(iso || ''));
    return isNaN(t.getTime()) ? '' : t.toLocaleTimeString(taal, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  function stand(tekst, toon) { var s = $('#besluitStand'); if (s) { s.textContent = tekst; s.dataset.toon = toon || ''; } }

  function vinkjes(vak, naam, gekozen) {
    if (!vak) return;
    Array.prototype.slice.call(vak.querySelectorAll('label')).forEach(function (l) { l.remove(); });
    keuzes.forEach(function (k) {
      var l = maak('label', 'besluitkeuze'), i = d.createElement('input');
      i.type = 'checkbox'; i.name = naam; i.value = k; i.checked = (gekozen || []).indexOf(k) >= 0;
      l.appendChild(i); l.appendChild(d.createTextNode(' ' + k)); vak.appendChild(l);
    });
  }
  function gekozen(vak) {
    return vak ? Array.prototype.slice.call(vak.querySelectorAll('input:checked')).map(function (i) { return i.value; }) : [];
  }

  /* Alleen de blokken die de server noemde. */
  function blokken(lijst) {
    Array.prototype.slice.call(d.querySelectorAll('#samenBesluit [data-blok]')).forEach(function (el) {
      el.hidden = lijst.indexOf(el.getAttribute('data-blok')) < 0;
    });
  }

  function tekenOpties(b) {
    var ul = $('#besluitOpties'); if (!ul) return; ul.textContent = '';
    if (!b.groep.opties.length) { ul.appendChild(maak('li', 'leegtekst', 'Er staan nog geen opties klaar.')); return; }
    b.groep.opties.forEach(function (o) {
      var li = maak('li', 'besluitoptie'), mijn = b.jij.opties[o.id];
      li.dataset.optie = o.id;
      li.appendChild(maak('b', '', o.titel));
      li.appendChild(maak('small', '', euro(o.prijsPP) + ' p.p. · ' + o.van + ' t/m ' + o.tot +
        (o.kenmerken && o.kenmerken.length ? ' · ' + o.kenmerken.join(', ') : '')));
      var groep = o.voorIedereen === true ? 'Past voor iedereen' : o.voorIedereen === false ? 'Past niet voor iedereen' : 'Nog niet vast te stellen';
      var g = maak('span', 'besluitgroep', groep); g.dataset.uitkomst = String(o.voorIedereen); li.appendChild(g);
      if (mijn) {
        var j = maak('span', 'besluitjij', mijn.past ? 'Past voor u' : 'Past niet voor u'); j.dataset.past = String(mijn.past);
        li.appendChild(j);
        if (!mijn.past) mijn.redenen.forEach(function (r) { li.appendChild(maak('p', 'rtg-sub besluitreden', r)); });
      }
      if (b.werkruimte.handelingen.indexOf('voorstel.leg') >= 0 && o.voorIedereen === true) {
        var leg = maak('button', 'rtg-knop', 'LEG VOOR AAN DE GROEP'); leg.type = 'button';
        leg.addEventListener('click', function () { doe('/api/reis/gezelschap/voorstel/leg', { reis: reis, optie: o.id }); });
        li.appendChild(leg);
      }
      if (b.werkruimte.handelingen.indexOf('optie.wis') >= 0) {
        var weg = maak('button', 'rtg-knop', 'HAAL WEG'); weg.type = 'button';
        weg.addEventListener('click', function () { doe('/api/reis/gezelschap/opties/wis', { reis: reis, id: o.id }); });
        li.appendChild(weg);
      }
      ul.appendChild(li);
    });
  }

  function teken(b) {
    laatste = b; var vak = $('#samenBesluit'); if (!vak) return;
    vak.hidden = false; vak.dataset.kenmerk = b.kenmerk; vak.dataset.rol = b.rol;
    blokken(b.werkruimte.blokken);
    var uit = $('#besluitUitleg'); uit.textContent = '';
    b.uitleg.forEach(function (z) { uit.appendChild(maak('p', '', z)); });
    var vg = b.groep.voortgang;
    if (vg) $('#besluitVoortgang').textContent = vg.ingevuld + ' van ' + vg.deelnemers + ' deelnemers hebben hun wensen opgegeven.';
    tekenOpties(b);
    if (w.RTGSamenVoorstel) w.RTGSamenVoorstel.teken(b, { reis: reis, doe: doe, euro: euro });
    $('#besluitToetsingen').textContent = b.groep.toetsingen.afgelopenEtmaal + ' van ' + b.groep.toetsingen.max +
      ' toetsingen gebruikt in het afgelopen etmaal. Iedereen in het gezelschap ziet dit getal.';
    $('#besluitGrens').textContent = b.groep.grens;
    stand('Voorlopig · berekend om ' + tijd(b.berekendOp), 'actueel');
    if (w.RTGSamenVoorstel) w.RTGSamenVoorstel.edge(b);
  }

  /* Loopt er al een ronde, dan wacht een poll niet maar een EXPLICIETE vraag
     wel: die sluit achter de lopende aan en haalt daarna opnieuw. Werd hij
     overgeslagen, dan bleef na een eigen handeling het oude beeld staan. */
  function haal(stil) {
    if (!reis) return Promise.resolve();
    if (bezig) return stil ? bezig : bezig.then(function () { return haal(false); });
    bezig = R.api('/api/reis/gezelschap/opties', { reis: reis }).then(function (b) {
      if (!laatste || b.kenmerk !== laatste.kenmerk || !stil || b.rol !== laatste.rol) teken(b);
      else stand('Voorlopig · berekend om ' + tijd(b.berekendOp), 'actueel');
    }).catch(function (e) {
      if (e && e.status === 404) { var vak = $('#samenBesluit'); if (vak) vak.hidden = true; laatste = null; return; }
      if (laatste) stand('Niet bijgewerkt sinds ' + tijd(laatste.berekendOp) + '. Dit beeld is mogelijk verouderd.', 'verouderd');
    }).then(function () { bezig = null; });
    return bezig;
  }

  function opgave() {
    return R.api('/api/reis/gezelschap/opgave', { reis: reis }).then(function (o) {
      keuzes = o.keuzes || []; var i = o.invoer || {};
      $('#besluitWieZiet').textContent = o.wieZiet || '';
      $('#opgavePlafond').value = i.plafond ? Math.round(i.plafond / 100) : '';
      var p = (i.data || [])[0] || {};
      $('#opgaveVan').value = p.van || ''; $('#opgaveTot').value = p.tot || '';
      vinkjes($('#opgaveGraag'), 'graag', i.voorkeuren); vinkjes($('#opgaveNiet'), 'niet', i.nietGraag);
      vinkjes($('#optieKenmerken'), 'kenmerk', []);
    }).catch(function () {});
  }

  /* Na een handeling is het getoonde beeld NIET meer actueel tot de server
     opnieuw rekende; dat staat er zolang. */
  function doe(pad, body) {
    stand('Wordt herberekend…', 'bezig');
    return R.api(pad, body).then(function () { return haal(false); })
      .catch(function (e) { R.toast(e.message); stand('Niet gelukt: ' + e.message, 'verouderd'); });
  }

  function toon(id) {
    if (id !== reis) { reis = id; laatste = null; }
    if (!reis) return;
    opgave().then(function () { return haal(false); });
    if (!klok) klok = w.setInterval(function () {
      var blad = d.querySelector('[data-blad="samen"]');
      if (d.visibilityState === 'visible' && blad && !blad.hidden) haal(true);
    }, RONDE_MS);
  }

  d.addEventListener('DOMContentLoaded', function () {
    var A = w.RTGAdaptief;
    if (A && A.declareer) {
      A.declareer({ id: 'reizen.samen.wensen', naam: 'Uw wensen', label: 'Uw wensen', groep: 'Gezamenlijke reis',
        telefoon: ['balk', 'lade'], tablet: ['balk', 'lade'], bureau: ['werkbalk'],
        doe: function () { var v = $('#opgavePlafond'); if (v) v.focus(); } });
      A.declareer({ id: 'reizen.samen.optie', naam: 'Optie klaarzetten', label: 'Optie klaarzetten', groep: 'Gezamenlijke reis',
        telefoon: ['balk', 'lade'], tablet: ['balk', 'lade'], bureau: ['werkbalk'],
        doe: function () { var v = $('#optieTitel'); if (v) v.focus(); } });
    }
    var vorm = $('#besluitOpgaveVorm');
    if (vorm) vorm.addEventListener('submit', function (e) {
      e.preventDefault(); if (!reis) return;
      var euroIn = $('#opgavePlafond').value, van = $('#opgaveVan').value, tot = $('#opgaveTot').value;
      doe('/api/reis/gezelschap/opgave/zet', { reis: reis, opgave: {
        plafond: euroIn ? Math.round(Number(euroIn) * 100) : null,
        data: van && tot ? [{ van: van, tot: tot }] : [],
        voorkeuren: gekozen($('#opgaveGraag')), nietGraag: gekozen($('#opgaveNiet')) } });
    });
    var wis = $('#opgaveWis');
    if (wis) wis.addEventListener('click', function () {
      if (!reis) return;
      doe('/api/reis/gezelschap/opgave/wis', { reis: reis }).then(opgave);
    });
    var optie = $('#besluitOptieVorm');
    if (optie) optie.addEventListener('submit', function (e) {
      e.preventDefault(); if (!reis) return;
      doe('/api/reis/gezelschap/opties/zet', { reis: reis, optie: {
        titel: $('#optieTitel').value, prijsPP: Math.round(Number($('#optiePrijs').value) * 100),
        van: $('#optieVan').value, tot: $('#optieTot').value, kenmerken: gekozen($('#optieKenmerken')) } });
    });
  });

  w.RTGSamenBesluit = { toon: toon, ververs: function () { return haal(false); } };
})(window, document);

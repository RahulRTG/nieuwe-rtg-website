/* RTG Command, deel 7: het toezicht -- agents en tijdelijke rechten.

   DIT IS ÉÉN SCHERM EN GEEN TWEE, en dat is met opzet. Een agent-budget en een
   tijdelijk mensenrecht zijn dezelfde vraag in twee vormen: wie mag nu hoeveel,
   en tot wanneer? Ze uit elkaar trekken zou betekenen dat je bij een incident op
   twee plekken moet kijken om te weten wie er aan de knoppen zat.

   DE VERVALDATUM IS DE KERN. Er is niets hier dat blijft staan: alles heeft een
   `tot`, ook de nooddeur. Er valt dus ook niets te vergeten in te trekken --
   het verlopen is de standaardtoestand en het geldig zijn de uitzondering.

   De twee spiegels (werkbesparing en journaal) staan in ./command-08.js. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api;

  /* ---- toezicht: agents en tijdelijke rechten ---- */
  C.TEKENAARS.toezicht = function (el) {
    el.innerHTML = '<h2 class="ckop">Toezicht</h2>' +
      '<p class="lead">Wie mag nu wat, en tot wanneer? Agents dragen budgetten per uur en per dag en worden ' +
      'gestopt zodra ze vaker misgaan dan goed gaan. Zware mensenrechten hebben een vervaldatum -- er is niets ' +
      'dat blijft staan, dus er valt ook niets te vergeten in te trekken.</p>' +
      '<div id="tzuit"><div class="leeg">Laden…</div></div>';
    laadToezicht();
  };

  function laadToezicht() {
    Promise.all([api('agents'), api('rechten')]).then(function (r) {
      document.querySelector('#tzuit').innerHTML = tzTeken(r[0].agents, r[1]);
      tzBind();
    }).catch(function (e) { if (!e.stil) document.querySelector('#tzuit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  }

  function tzTeken(agents, rechten) {
    var u = '<h2 class="ckop" style="font-size:1.15rem;margin-bottom:0.75rem;">Agents</h2>';
    if (!agents.length) u += '<div class="kaart"><p>Er heeft nog geen agent gehandeld. Er staan dus geen budgetten open -- dat is een uitslag, geen ontbrekende meting.</p></div>';
    for (var i = 0; i < agents.length; i++) {
      var a = agents[i];
      u += '<div class="kaart"><h3>' + esc(a.naam) + (a.gestopt ? ' <span class="cniveau hand">gestopt</span>' : '') + '</h3>' +
        (a.gestopt ? '<p class="meta">Reden: ' + esc(a.stopReden) + '</p>' : '') +
        '<p class="meta">' + a.actiesDitUur + ' van ' + a.actiesMax + ' handelingen dit uur · ' +
        C.euro(a.centenVandaag) + ' van ' + C.euro(a.centenMax) + ' vandaag · foutkans ' + a.foutkans + '%</p>' +
        '<div class="staaf"><i style="width:' + Math.min(100, Math.round(a.actiesDitUur / a.actiesMax * 100)) + '%"></i></div>' +
        '<div class="crij h-mt70">' +
        (a.gestopt ? '<button class="knop" data-hervat="' + esc(a.naam) + '">Hervatten</button>'
          : '<button class="knop weg" data-stop="' + esc(a.naam) + '">Stoppen</button>') +
        '</div></div>';
    }

    u += '<h2 class="ckop" style="font-size:1.15rem;margin:1.25rem 0 0.75rem;">Zware rechten</h2>';
    u += '<div class="kaart"><h3>Wat er tijdelijk te geven valt</h3>';
    for (var s = 0; s < rechten.soorten.length; s++) {
      var so = rechten.soorten[s];
      u += '<div class="lijn"><b>' + esc(so.id) + '</b> <span class="meta">· hooguit ' + so.maxMinuten + ' minuten · nu ' + so.nuActief + ' actief</span>' +
        '<div class="meta">' + esc(so.wat) + '</div>' +
        '<div class="crij h-mt45">' +
        '<input class="veld" data-aan="' + esc(so.id) + '" placeholder="aan wie" style="width:11rem;">' +
        '<input class="veld" data-rrd="' + esc(so.id) + '" placeholder="reden" style="flex:1;min-width:11rem;">' +
        '<button class="knop" data-geef="' + esc(so.id) + '">Tijdelijk geven</button>' +
        '<button class="knop weg" data-nood="' + esc(so.id) + '">Nooddeur</button></div></div>';
    }
    u += '</div>';

    u += '<div class="kaart"><h3>Nu actief</h3>';
    if (!rechten.actief.length) u += '<p>' + esc(rechten.uitleg || 'Geen actieve rechten.') + '</p>';
    for (var r = 0; r < rechten.actief.length; r++) {
      var x = rechten.actief[r];
      u += '<div class="lijn"><b>' + esc(x.recht) + '</b>' + (x.nood ? ' <span class="cniveau hand">nooddeur</span>' : '') +
        '<div class="meta">' + esc(x.aan) + ' · gegeven door ' + esc(x.door) + ' · tot ' + esc(C.tijd(x.tot)) + '</div>' +
        '<div class="meta">' + esc(x.reden) + '</div>' +
        '<div class="crij h-mt40"><button class="knop weg" data-introk="' + esc(x.id) + '">Nu intrekken</button></div></div>';
    }
    u += '<p class="meta h-mt50">' + rechten.verlopen + ' recht(en) zijn verlopen of ingetrokken; die staan in het journaal.</p></div>';
    return u;
  }

  function tzBind() {
    var doe = function (sel, pad, bouw, tekst) {
      document.querySelectorAll(sel).forEach(function (b) {
        b.onclick = function () {
          var body = bouw(b);
          if (!body) return;
          api(pad, body).then(function () { C.meld(tekst); return C.ververs(); })
            .then(laadToezicht).catch(function (e) { if (!e.stil) C.meld(e.message); });
        };
      });
    };
    doe('[data-stop]', 'agent/stop', function (b) {
      var r = prompt('Waarom stopt u deze agent?'); return r ? { naam: b.dataset.stop, reden: r } : null;
    }, 'Agent gestopt.');
    doe('[data-hervat]', 'agent/hervat', function (b) {
      var r = prompt('Waarom hervat u deze agent?'); return r ? { naam: b.dataset.hervat, reden: r } : null;
    }, 'Agent hervat.');
    doe('[data-geef]', 'recht/geef', function (b) {
      var id = b.dataset.geef;
      return { recht: id, aan: document.querySelector('[data-aan="' + id + '"]').value,
        reden: document.querySelector('[data-rrd="' + id + '"]').value };
    }, 'Tijdelijk recht gegeven.');
    doe('[data-nood]', 'recht/nood', function (b) {
      var id = b.dataset.nood;
      var r = document.querySelector('[data-rrd="' + id + '"]').value ||
        prompt('De nooddeur vraagt een volledige reden; die staat straks in het journaal.');
      return r ? { recht: id, reden: r } : null;
    }, 'Nooddeur open -- dit staat in het journaal en vervalt vanzelf.');
    doe('[data-introk]', 'recht/introk', function (b) {
      var r = prompt('Waarom trekt u dit recht in?'); return r ? { id: b.dataset.introk, reden: r } : null;
    }, 'Ingetrokken.');
  }
})();

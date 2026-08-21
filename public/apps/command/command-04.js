/* RTG Command, deel 4: de operator en de uitzonderingenrij.

   DE OPERATOR IS DE HELE BELOFTE IN ÉÉN SCHERM. U stelt een vraag in gewone
   taal, u krijgt een gemeten antwoord met oorzaken, en daarna één knop: doe de
   veilige gevallen en geef mij de uitzonderingen.

   WAT ER MET OPZET NIET IS: een knop "doe alles". De uitzonderingen zijn er
   niet omdat de machine ze nog niet kan, maar omdat het beleid zegt dat ze een
   mens vragen. Een knop die daaroverheen gaat, maakt het beleid tot decoratie.

   DE UITZONDERINGENRIJ toont wat de automatisering echt niet zelf kon. Elke
   zaak draagt zijn bewijs: wat de machine zag, en waarom hij het niet deed. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, S = C.S, api = C.api;

  var VOORBEELDEN = [
    'waarom loopt mobiliteit achter?',
    'wat staat er open in de handel?',
    'welke boekingen zijn afgebroken?',
    'wat kan er nu veilig hersteld worden?'
  ];

  C.TEKENAARS.operator = function (el) {
    var u = '<h2 class="ckop">Operator</h2>' +
      '<p class="lead">Vraag het in gewone taal. Het antwoord is gerekend uit de gegevens: hoeveel gevallen, ' +
      'welke oorzaken, hoeveel de machine veilig mag doen en wat een mens moet beoordelen. ' +
      'De AI verwoordt hooguit; hij kiest niet wat er gebeurt.</p>' +
      '<div class="kaart">' +
      '<textarea class="veld" id="opq" placeholder="Bijvoorbeeld: waarom loopt mobiliteit in Haarlem achter?"></textarea>' +
      '<div class="crij h-mt60"><button class="knop vol" id="opGa">Vraag het</button>' +
      VOORBEELDEN.map(function (v) { return '<button class="knop" data-vb="' + esc(v) + '">' + esc(v) + '</button>'; }).join('') +
      '</div></div><div id="opuit"></div>';
    el.innerHTML = u;

    document.querySelector('#opGa').onclick = vraag;
    el.querySelectorAll('[data-vb]').forEach(function (b) {
      b.onclick = function () { document.querySelector('#opq').value = b.dataset.vb; vraag(); };
    });
    if (S.plan) toonPlan(S.plan);

    function vraag() {
      var q = document.querySelector('#opq').value.trim();
      if (!q) { C.meld('Stel eerst een vraag.'); return; }
      document.querySelector('#opuit').innerHTML = '<div class="leeg">De operator rekent…</div>';
      api('operator/plan', { q: q }).then(function (d) { S.plan = d.plan; toonPlan(d.plan); })
        .catch(function (e) { if (!e.stil) document.querySelector('#opuit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
    }
  };

  function toonPlan(p) {
    var u = '<div class="kaart"><h3>Het antwoord</h3><p style="color:var(--txt);font-size:.95rem;line-height:1.7;">' +
      esc(p.tekst) + '</p>' +
      '<div class="crij h-mt90">' +
      (p.veilig && !p.uitgevoerd ? '<button class="knop vol" id="opDoe">Doe de veilige ' + p.veilig + ' en geef mij de uitzonderingen</button>' : '') +
      (p.uitgevoerd ? '<span class="meta">Dit plan is uitgevoerd.</span>' : '') +
      '</div></div>';

    for (var i = 0; i < p.delen.length; i++) {
      var d = p.delen[i];
      u += '<div class="kaart"><h3>' + esc(d.naam) + ' <span class="meta">· ' + d.totaal + ' geval(len) in ' + esc(d.domein) + '</span></h3>';
      if (d.oorzaakVeld) {
        u += '<p>Gemeten oorzaak: het veld <b>' + esc(d.oorzaakVeld) + '</b>.</p><div class="meta h-mt35">' +
          d.oorzaken.map(function (o) { return o.aantal + '× ' + esc(o.waarde); }).join(' · ') + '</div>';
      } else {
        u += '<p class="meta">Geen enkel veld verklaart deze gevallen samen; ze hebben geen gedeelde oorzaak.</p>';
      }
      u += '<div class="crij h-mt70">' +
        '<span class="meta">veilig ' + d.veilig + '</span><span class="meta">· met hulp ' + d.hulp + '</span>' +
        '<span class="meta">· mens ' + d.mens + '</span>' +
        (d.overgeslagen ? '<span class="meta">· ' + d.overgeslagen + ' boven de rondegrens</span>' : '') +
        '</div>' +
        '<div class="meta h-mt40">Stapeloordeel: risico ' + d.stapeloordeel.score + ' -- ' + esc(d.stapeloordeel.waarom) + '</div>';
      if (d.uitzonderingen.length) {
        u += '<div class="h-mt70"><b style="font-size:.85rem;">Uitzonderingen</b>';
        for (var j = 0; j < d.uitzonderingen.length; j++) {
          var x = d.uitzonderingen[j];
          u += '<div class="lijn"><button class="knop" data-t="' + esc(d.type) + '" data-i="' + esc(x.id) + '" style="border:none;padding:0;">' +
            esc(x.titel) + '</button> <span class="meta">risico ' + x.score + ' -- ' + esc(x.waarom) + '</span></div>';
        }
        u += '</div>';
      }
      u += '</div>';
    }
    document.querySelector('#opuit').innerHTML = u;

    var doe = document.querySelector('#opDoe');
    if (doe) doe.onclick = function () {
      var reden = prompt('Waarom voert u dit uit? (komt in het journaal)');
      if (!reden) return;
      doe.disabled = true;
      api('operator/uitvoeren', { plan: p.id, reden: reden }).then(function (r) {
        C.meld(r.hersteld + ' hersteld, ' + r.zaken + ' uitzondering(en) als zaak geopend.');
        S.plan.uitgevoerd = true;
        return C.ververs();
      }).then(function () { C.ga('zaken'); })
        .catch(function (e) { doe.disabled = false; if (!e.stil) C.meld(e.message); });
    };
    document.querySelectorAll('#opuit [data-t]').forEach(function (b) {
      b.onclick = function () { C.openObject(b.dataset.t, b.dataset.i); };
    });
  }

  /* ---- de uitzonderingenrij ---- */
  C.TEKENAARS.zaken = function (el) {
    el.innerHTML = '<h2 class="ckop">Uitzonderingen</h2>' +
      '<p class="lead">Alleen wat de automatisering niet zelfstandig kon afhandelen. Elke zaak heeft een eigenaar, ' +
      'een termijn en straks een besluit -- en dat besluit is het lesmateriaal voor de volgende automatiseringsronde.</p>' +
      '<div id="zkuit"><div class="leeg">Laden…</div></div>';
    api('zaken', { max: 60 }).then(function (d) {
      document.querySelector('#zkuit').innerHTML = rij(d);
      bind(d);
    }).catch(function (e) { if (!e.stil) document.querySelector('#zkuit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  };

  function rij(d) {
    var t = d.tellingen;
    var u = '<div class="rooster">' +
      '<div class="tegel"><div class="l">Open</div><div class="v">' + t.open + '</div><div class="u">' + t.zonderEigenaar + ' zonder eigenaar</div></div>' +
      '<div class="tegel"><div class="l">Over de termijn</div><div class="v ' + (t.overTermijn ? 'acc' : 'groen') + '">' + t.overTermijn + '</div><div class="u">van de open zaken</div></div>' +
      '<div class="tegel"><div class="l">Afgehandeld</div><div class="v">' + t.afgehandeld + '</div><div class="u">' + t.opTijdAfgehandeld + ' daarvan op tijd</div></div>' +
      '</div>';
    if (d.leerpunten && d.leerpunten.length) {
      u += '<div class="kaart"><h3>Wat zich herhaalt</h3><p>Deze besluiten vielen meermaals hetzelfde uit. Dat is een runbook dat nog niet bestaat.</p>';
      for (var i = 0; i < d.leerpunten.length; i++) {
        var l = d.leerpunten[i];
        u += '<div class="lijn"><b>' + esc(l.oorzaak) + ' → ' + esc(l.besluit) + '</b> <span class="meta">' + l.aantal + '×</span>' +
          '<div class="meta">' + esc(l.voorstel) + '</div></div>';
      }
      u += '</div>';
    }
    if (!d.zaken.length) return u + '<div class="leeg">Geen uitzonderingen. Alles wat er was, is automatisch afgehandeld.</div>';
    for (var z = 0; z < d.zaken.length; z++) {
      var k = d.zaken[z];
      u += '<div class="kaart" data-zaak="' + esc(k.id) + '"><h3>' + esc(k.titel) + '</h3>' +
        '<p class="meta">' + esc(k.domein) + ' · oorzaak: ' + esc(k.oorzaak) + ' · geopend ' + esc(C.tijd(k.at)) +
        ' · termijn ' + esc(C.tijd(k.termijn)) + (k.risico != null ? ' · risico ' + k.risico : '') + '</p>' +
        '<p class="meta">Status: ' + esc(k.status) + (k.eigenaar ? ' · eigenaar ' + esc(k.eigenaar) : ' · nog geen eigenaar') + '</p>' +
        (k.objectType ? '<p class="meta">Object: <button class="knop" data-t="' + esc(k.objectType) + '" data-i="' + esc(k.objectId) + '" style="border:none;padding:0;font-size:.78rem;">' + esc(k.objectType) + ' ' + esc(k.objectId) + '</button></p>' : '') +
        (k.bewijs ? '<p class="meta">Bewijs: ' + esc(JSON.stringify(k.bewijs).slice(0, 220)) + '</p>' : '') +
        (k.besluit ? '<p class="meta">Besluit: ' + esc(k.besluit.keuze) + ' -- ' + esc(k.besluit.reden) + ' (' + esc(k.besluit.door) + ')</p>'
          : '<div class="crij h-mt60">' +
            (k.eigenaar ? '' : '<button class="knop" data-neem="' + esc(k.id) + '">Ik pak hem op</button>') +
            '<input class="veld" data-keuze="' + esc(k.id) + '" placeholder="besluit (bv. hersteld, afgewezen)" style="min-width:12rem;">' +
            '<input class="veld" data-reden="' + esc(k.id) + '" placeholder="waarom" style="min-width:14rem;flex:1;">' +
            '<button class="knop vol" data-besluit="' + esc(k.id) + '">Besluiten</button></div>') +
        '</div>';
    }
    return u;
  }

  function bind() {
    document.querySelectorAll('#zkuit [data-neem]').forEach(function (b) {
      b.onclick = function () {
        api('zaak/neem', { id: b.dataset.neem }).then(function () { C.meld('Opgepakt.'); return C.ververs(); })
          .then(function () { C.teken(); }).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    document.querySelectorAll('#zkuit [data-besluit]').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.besluit;
        var keuze = document.querySelector('[data-keuze="' + id + '"]').value;
        var reden = document.querySelector('[data-reden="' + id + '"]').value;
        api('zaak/besluit', { id: id, keuze: keuze, reden: reden })
          .then(function () { C.meld('Besloten.'); return C.ververs(); })
          .then(function () { C.teken(); }).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    document.querySelectorAll('#zkuit [data-t]').forEach(function (b) {
      b.onclick = function () { C.openObject(b.dataset.t, b.dataset.i); };
    });
  }
})();

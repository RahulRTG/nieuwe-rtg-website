/* RTG School Partner: personeelszaken. Het HR-deel van de server was compleet
   en had geen enkel scherm; hier staat het, met de twee regels die dit anders
   maken dan een gewoon HR-pakket zichtbaar in het scherm zelf:

   1. EEN GESPREK LEGT AFSPRAKEN VAST, GEEN CIJFER. Er is geen scoreveld, geen
      schaal en geen ranglijst -- en de medewerker kan zijn eigen reactie
      toevoegen, die niemand kan weghalen (dat doet hij in zijn eigen scherm,
      mijnhr.js).
   2. HET DOSSIER GAAT OPEN MET EEN REDEN, net als het zorgdossier van een
      kind. De reden komt in het journaal. Een personeelsdossier is geen
      naslagwerk voor de lerarenkamer.

   Een ziekmelding heeft geen redenveld en krijgt er ook geen: een werkgever
   hoeft niet te weten wat iemand heeft, en mag dat niet vastleggen.
   Gebonden vanuit app.js aan het einde van directie(). */
window.RTGSchoolHR = (function () {
  'use strict';
  var A = null, S = null, esc = null, meld = null, wortel = null, MENSEN = [], KLASSEN = [], OPEN = null;

  var sleutels = function (extra) {
    var o = { schoolCode: S.code, beheerToken: S.token }, k;
    for (k in (extra || {})) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  };
  var opties = function (rijen, waarde, label) {
    return rijen.map(function (x) { return '<option value="' + esc(x[waarde]) + '">' + esc(x[label]) + '</option>'; }).join('');
  };

  function bind(api, sessie, escape, melder) {
    A = api; S = sessie; esc = escape; meld = melder;
    wortel = document.getElementById('dHR');
    if (!wortel) return;
    teken();
  }

  function teken() {
    Promise.all([A('/school/hr/overzicht', sleutels()), A('/school/school/overzicht', sleutels())]).then(function (r) {
      var hr = r[0].body, sch = r[1].body;
      if (hr.error) { wortel.innerHTML = ''; return; }
      MENSEN = (sch.personeel || []).filter(function (p) { return p.status === 'actief'; });
      KLASSEN = sch.klassen || [];

      var uit = (hr.uit || []).map(function (u) {
        return '<div class="item"><span>' + esc(u.naam) + ' <span class="stil">· ' + esc(u.soort) +
          ' · van ' + esc(u.van) + (u.tot ? ' tot ' + esc(u.tot) : '') + '</span></span>' +
          (u.vervangingNodig ? '<span class="tag">vervanging nodig</span>' : '') + '</div>';
      }).join('') || '<p class="stil">Vandaag is iedereen er.</p>';
      var verloopt = (hr.bevoegdhedenLet || []).map(function (b) {
        return '<div class="item"><span>' + esc(b.naam) + ' <span class="stil">· ' + esc(b.wat) + '</span></span>' +
          '<span class="' + (b.verlopen ? 'tag' : 'stil') + '">' + (b.verlopen ? 'verlopen ' : 'tot ') + esc(b.geldigTot) + '</span></div>';
      }).join('') || '<p class="stil">Geen bevoegdheden die binnen 90 dagen verlopen.</p>';

      wortel.innerHTML = '<div class="deel">Personeelszaken</div>' +
        '<div class="kaart"><div class="kop">Bezetting vandaag</div>' +
        '<div class="kpis" style="margin-bottom:.6rem;">' +
        [['Personeel actief', hr.personeel || 0], ['Vandaag uit', hr.vandaagUit || 0],
         ['Zonder contract', (hr.zonderContract || []).length]]
          .map(function (x) { return '<div class="kpi"><b>' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('') + '</div>' +
        uit +
        ((hr.zonderContract || []).length ? '<p class="stil">Nog geen contract vastgelegd voor: ' +
          esc(hr.zonderContract.join(', ')) + '.</p>' : '') +
        '<p class="stil">Er staat hier bewust geen verzuimpercentage per persoon: dat is een cijfer waarop mensen worden afgerekend zonder dat het iets verklaart.</p></div>' +
        '<div class="kaart"><div class="kop">Bevoegdheden die aflopen</div>' + verloopt + '</div>' +
        '<div class="kaart"><div class="kop">Vervanging</div>' +
        '<div class="rij"><select class="veld" id="hrKlas" aria-label="Voor welke klas">' + opties(KLASSEN, 'code', 'naam') + '</select>' +
        '<button class="knop" id="hrVrij" type="button">Wie is er vrij?</button></div>' +
        '<div id="hrVrijUit" style="margin-top:.5rem;"></div>' +
        '<p class="stil">Toewijzen zet de bestaande waarnemer op de klas; het lerarenteam en de online les weten het meteen.</p></div>' +
        '<div class="kaart enterprise-breed"><div class="kop">Personeelsdossier</div>' +
        '<div class="rij"><select class="veld" id="hrWie" aria-label="Welk personeelslid">' + opties(MENSEN, 'id', 'naam') + '</select>' +
        '<input class="veld" id="hrReden" maxlength="120" placeholder="Waarom opent u dit dossier?" aria-label="Reden om het dossier te openen">' +
        '<button class="knop" id="hrOpen" type="button">Open dossier</button></div>' +
        '<p class="stil">De reden komt in het inzagejournaal, met uw naam en het moment.</p>' +
        '<div id="hrDossier"></div></div>';
      knoppen();
      if (OPEN) dossier(OPEN.id, OPEN.reden);
    });
  }

  function knoppen() {
    var q = function (x) { return document.getElementById(x); };
    q('hrOpen').addEventListener('click', function () {
      var reden = q('hrReden').value.trim();
      if (!reden) return meld('Noteer waarom u dit personeelsdossier opent.');
      dossier(q('hrWie').value, reden);
    });
    q('hrVrij').addEventListener('click', function () {
      A('/school/hr/vervanging', sleutels({ klasCode: q('hrKlas').value })).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        q('hrVrijUit').innerHTML = (r.body.beschikbaar || []).map(function (p) {
          return '<div class="item"><span>' + esc(p.naam) + '</span>' +
            '<button class="knop p" data-verv="' + esc(p.id) + '">Zet in voor ' + esc(r.body.klas) + '</button></div>';
        }).join('') || '<p class="stil">Niemand vrij: iedereen staat voor de klas, ziek of met verlof.</p>';
        Array.prototype.forEach.call(document.querySelectorAll('[data-verv]'), function (b) {
          b.addEventListener('click', function () {
            A('/school/hr/vervanging', sleutels({ klasCode: q('hrKlas').value, personeelId: b.dataset.verv }))
              .then(function (r2) { meld(r2.body.error || (r2.body.waarnemer.naam + ' staat op ' + r2.body.klas + '.')); });
          });
        });
      });
    });
  }


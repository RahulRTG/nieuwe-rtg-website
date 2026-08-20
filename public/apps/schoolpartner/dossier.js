/* RTG School Partner: het leerlingdossier. De server kende dossier, contact en
   documenten al; er was alleen geen scherm, en daarmee bestond de gelaagdheid
   van het dossier alleen op papier.

   Het scherm is met opzet gelaagd zoals de server dat is: eerst een lijst met
   namen, dan de basis (wie is dit, waar zit hij), dan contact en documenten --
   en het zorgdeel apart, achter een reden, in dossier-zorg.js. Dat is dezelfde
   knip als op de server (dossier.js/zorg.js): er is EEN plek waar het
   gevoeligste deel woont, en die is ook in de code te zien.

   De zoekregel filtert HIER, in de browser, over de lijst die de server toch
   al stuurt. Dat is eerlijk over wat het is: geen serverzoekopdracht, maar een
   filter op wat u al mag zien.
   Gebonden vanuit app.js aan het einde van directie(). */
window.RTGSchoolDossier = (function () {
  'use strict';
  var A = null, S = null, esc = null, meld = null, wortel = null, LIJST = [], GEKOZEN = null, SLEUTEL = null;

  var sleutels = function (extra) {
    var o = { schoolCode: S.code, beheerToken: S.token }, k;
    for (k in (extra || {})) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  };

  function bind(api, sessie, escape, melder) {
    A = api; S = sessie; esc = escape; meld = melder;
    wortel = document.getElementById('dDossier');
    if (!wortel) return;
    laadLijst();
  }

  function laadLijst() {
    A('/school/leerling/lijst', sleutels()).then(function (r) {
      if (r.body.error) { wortel.innerHTML = ''; return; }
      LIJST = r.body.leerlingen || [];
      wortel.innerHTML = '<div class="deel">Leerlingdossier</div>' +
        '<div class="kaart enterprise-breed" id="doSignalen"><div class="kop">Signalen</div>' +
        '<p class="stil">Laden...</p></div>' +
        '<div class="kaart"><div class="kop">Leerlingen</div>' +
        '<div class="rij"><input class="veld" id="doZoek" type="search" placeholder="Zoek op naam" ' +
        'maxlength="60" aria-label="Zoek een leerling op naam"></div>' +
        '<div id="doLijst" class="h-mt50"></div>' +
        '<p class="stil h-mt50">Filtert in dit scherm, over de lijst die u al mag zien.</p></div>' +
        '<div class="kaart enterprise-breed" id="doDetail" hidden></div>';
      lijstTekenen('');
      signalen();
      document.getElementById('doZoek').addEventListener('input', function () { lijstTekenen(this.value); });
      if (GEKOZEN) toon(GEKOZEN);
    });
  }

  /* De signalen rond leerlingen: FACTOREN, geen score en geen volgorde op
     zwaarte. Het scherm herhaalt dat, want een lijst van kinderen met
     aandachtspunten wordt anders vanzelf gelezen als een ranglijst -- en dan is
     "wie heeft aandacht nodig" veranderd in "wie presteert het slechtst". */
  function signalen() {
    A('/school/signalen', sleutels({ reden: 'signalenoverzicht in de werkbank' })).then(function (r) {
      var vak = document.getElementById('doSignalen');
      if (!vak) return;
      if (r.body.error) { vak.innerHTML = '<div class="kop">Signalen</div><p class="stil">' + esc(r.body.error) + '</p>'; return; }
      vak.innerHTML = '<div class="kop">Signalen (' + (r.body.aantal || 0) + ')</div>' +
        ((r.body.leerlingen || []).slice(0, 25).map(function (l) {
          return '<div class="item h-boven"><span><b>' + esc(l.naam) + '</b> <span class="stil">· ' +
            esc(l.klas) + '</span><br><span class="stil">' +
            l.factoren.map(function (f) { return esc(f.wat) + ': ' + esc(f.uitleg); }).join('<br>') + '</span></span>' +
            '<button class="knop" data-signaal="' + esc(l.sleutel) + '">Dossier</button></div>';
        }).join('') || '<p class="stil">Geen signalen.</p>') +
        '<p class="stil">' + esc(r.body.uitleg || '') + '</p>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-signaal]'), function (b) {
        b.addEventListener('click', function () {
          /* Van een signaal naar het dossier: zoek de leerling op de sleutel.
             Staat hij niet in de administratie (een gezinskoppeling zonder
             inschrijving), dan zegt het scherm dat in plaats van niets te doen. */
          var rij = LIJST.filter(function (x) { return x.naam === b.parentNode.querySelector('b').textContent; })[0];
          if (!rij) return meld('Deze leerling staat wel in een klas, maar niet in de leerlingadministratie.');
          toon(rij.id);
        });
      });
    });
  }

  function lijstTekenen(zoek) {
    var q = String(zoek || '').toLowerCase().trim();
    var rijen = LIJST.filter(function (l) { return !q || String(l.naam).toLowerCase().indexOf(q) >= 0; });
    var lijst = rijen.slice(0, 50).map(function (l) {
      return '<div class="item"><span>' + esc(l.naam) + ' <span class="stil">· ' + esc(l.status) +
        (l.klasCode ? ' · klas ' + esc(l.klasCode) : '') + '</span></span>' +
        '<button class="knop" data-dossier="' + esc(l.id) + '">Dossier</button></div>';
    }).join('');
    /* De regel over afgekapte treffers hoort BIJ de lijst, niet bij de lege
       staat: met `.join('') || leeg + meer` hing hij aan het lege geval en zag
       niemand hem juist wanneer hij nodig was. */
    var meer = rijen.length > 50
      ? '<p class="stil">' + rijen.length + ' treffers; de eerste 50 staan hier. Zoek verder om te verfijnen.</p>' : '';
    document.getElementById('doLijst').innerHTML = lijst
      ? lijst + meer
      : '<p class="stil">' + (q ? 'Geen leerling met die naam.' : 'Nog geen leerlingen in de administratie.') + '</p>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-dossier]'), function (b) {
      b.addEventListener('click', function () { toon(b.dataset.dossier); });
    });
  }

/* het leerlingdossier openen: wie er wordt gekozen en wat er dan wordt geladen */
  function toon(id) {
    GEKOZEN = id;
    A('/school/dossier', sleutels({ leerlingId: id })).then(function (r) {
      var d = r.body;
      if (d.error) return meld(d.error);
      var l = d.leerling, c = d.contact || {}, v = c.verzorgers || [];
      SLEUTEL = d.sleutel || l.sleutel || null;
      var vak = document.getElementById('doDetail');
      vak.hidden = false;
      vak.innerHTML = '<div class="kop">' + esc(l.naam) + '</div>' +
        '<div class="item"><span>Status</span><span class="stil">' + esc(l.status) +
          (l.klasCode ? ' · klas ' + esc(l.klasCode) : '') + (l.opleiding ? ' · ' + esc(l.opleiding) : '') +
          (l.vestiging ? ' · ' + esc(l.vestiging) : '') + '</span></div>' +
        '<div class="item"><span>Geboren</span><span class="stil">' + esc(d.geboren || 'niet genoteerd') + '</span></div>' +
        '<div class="item"><span>Herkomst</span><span class="stil">' + esc(d.herkomst || 'niet genoteerd') + '</span></div>' +
        ((d.overstappen || []).length ? '<div class="item"><span>Overstappen</span><span class="stil">' +
          d.overstappen.map(function (o) { return esc(String(o.at || '').slice(0, 10) + ' ' + (o.naar || o.van || '')); }).join(' · ') +
          '</span></div>' : '') +
        '<div class="kop h-mt90">Contact en verzorgers</div>' +
        '<div class="rij">' +
          veld('doAdres', 'Adres', c.adres, 120) + veld('doPostcode', 'Postcode', c.postcode, 12) +
          veld('doPlaats', 'Plaats', c.plaats, 60) + veld('doTel', 'Telefoon', c.telefoon, 24) +
          veld('doMail', 'E-mail', c.email, 80) +
        '</div>' +
        [0, 1, 2].map(function (i) {
          var x = v[i] || {};
          return '<div class="rij h-mt40">' +
            veld('doVn' + i, 'Naam verzorger ' + (i + 1), x.naam, 60) +
            veld('doVr' + i, 'Relatie', x.relatie, 30) +
            veld('doVt' + i, 'Telefoon', x.telefoon, 24) +
            veld('doVe' + i, 'E-mail', x.email, 80) +
            '<label class="stil" style="display:flex;gap:.3rem;align-items:center;min-height:24px;">' +
            '<input type="checkbox" id="doVnood' + i + '"' + (x.noodnummer ? ' checked' : '') + '> noodnummer</label></div>';
        }).join('') +
        '<div class="rij h-mt50"><button class="knop p" id="doContact" type="button">Bewaar contactgegevens</button></div>' +
        '<p class="stil">Zonder telefoonnummer belt niemand bij een ongeluk. Een kind kan twee huizen hebben; daarom drie regels.</p>' +
        '<div class="kop h-mt90">Documenten</div>' +
        ((d.documenten || []).map(function (x) {
          return '<div class="item"><span>' + esc(x.titel) + ' <span class="stil">· ' + esc(x.soort) + '</span></span>' +
            '<span class="stil">' + esc(String(x.at).slice(0, 10)) + ' · ' + esc(x.door) + '</span></div>';
        }).join('') || '<p class="stil">Nog geen documenten geregistreerd.</p>') +
        '<div class="rij h-mt50">' +
          '<select class="veld h-kolom10" id="doSoort" aria-label="Soort document">' +
          ['diploma', 'certificaat', 'verklaring', 'rapport', 'overig'].map(function (s) {
            return '<option value="' + s + '">' + s + '</option>'; }).join('') + '</select>' +
          veld('doTitel', 'Titel', '', 100) + veld('doNummer', 'Nummer (mag leeg)', '', 40) +
          veld('doInstelling', 'Instelling', '', 80) +
          '<button class="knop" id="doDoc" type="button">Registreer</button>' +
        '</div>' +
        '<p class="stil">RTG School legt vast wat er is afgegeven; het diploma zelf komt van de officiele instelling.</p>' +
        '<div class="kop h-mt90">Verzuim en voortgang</div>' +
        '<div class="rij"><button class="knop" id="doVerzuim" type="button">Toon verzuimbeeld</button>' +
        (l.klasCode ? '<button class="knop" id="doVoortgang" type="button">Toon studievoortgang</button>' : '') +
        '</div><div id="doBeeld" class="stil h-mt50"></div>' +
        '<div class="kop h-mt90">Overstap en uitschrijving</div>' +
        '<div class="rij">' +
        '<input class="veld h-kolom10" id="doNaarKlas" maxlength="8" placeholder="Naar klascode" aria-label="Naar welke klas">' +
        '<input class="veld" id="doOverReden" maxlength="160" placeholder="Reden van de overstap" aria-label="Reden van de overstap">' +
        '<button class="knop" id="doOverstap" type="button">Zet over</button>' +
        '<button class="knop" id="doUit" type="button">Schrijf uit</button></div>' +
        '<p class="stil">Uitschrijven sluit de toegang en haalt de leerling uit de klas. Het dossier blijft staan: een school moet jaren later nog een diploma kunnen bevestigen.</p>' +
        '<div id="doZorg"></div>';
      knoppen(id);
      if (window.RTGSchoolDossierZorg) RTGSchoolDossierZorg.teken(A, sleutels, esc, meld, id, d, function () { toon(id); });
    });
  }

  function veld(id, label, waarde, max) {
    return '<input class="veld" id="' + id + '" placeholder="' + label + '" aria-label="' + label +
      '" maxlength="' + max + '" value="' + esc(waarde || '') + '">';
  }

  function knoppen(id) {
    var q = function (x) { return document.getElementById(x); };
    q('doContact').addEventListener('click', function () {
      var verzorgers = [0, 1, 2].map(function (i) {
        return { naam: q('doVn' + i).value.trim(), relatie: q('doVr' + i).value.trim(),
          telefoon: q('doVt' + i).value.trim(), email: q('doVe' + i).value.trim(),
          noodnummer: q('doVnood' + i).checked };
      }).filter(function (x) { return x.naam; });
      A('/school/dossier/contact', sleutels({ leerlingId: id, contact: {
        adres: q('doAdres').value, postcode: q('doPostcode').value, plaats: q('doPlaats').value,
        telefoon: q('doTel').value, email: q('doMail').value, verzorgers: verzorgers } }))
        .then(function (r) { meld(r.body.error || 'Contactgegevens bijgewerkt; de wijziging staat in het journaal.'); });
    });
    q('doVerzuim').addEventListener('click', function () {
      A('/school/aanwezigheid/leerling', sleutels({ leerlingId: id })).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        var t = r.body.telling || {};
        document.getElementById('doBeeld').innerHTML = '<b>' + r.body.lessen + ' geregistreerde lessen</b> · ' +
          (t.aanwezig || 0) + ' aanwezig · ' + (t.telaat || 0) + ' te laat · ' + (t.afwezig || 0) + ' afwezig · ' +
          (t.ziek || 0) + ' ziek · ' + (t.verlof || 0) + ' verlof' +
          (r.body.regels || []).slice(0, 8).map(function (x) {
            return '<div class="item"><span>' + esc(x.datum) + ' uur ' + x.uur + (x.vak ? ' · ' + esc(x.vak) : '') +
              '</span><span class="stil">' + esc(x.stand) + ' · gezet door ' + esc(x.door) + '</span></div>';
          }).join('');
      });
    });
    var vg = q('doVoortgang');
    if (vg) vg.addEventListener('click', function () {
      var rij = LIJST.filter(function (x) { return x.id === id; })[0] || {};
      A('/school/voortgang', sleutels({ klasCode: rij.klasCode, sleutel: SLEUTEL })).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        document.getElementById('doBeeld').innerHTML = '<b>Gemiddeld ' + (r.body.gemiddelde == null ? '-' : r.body.gemiddelde) + '</b> · ' +
          'huiswerk ' + r.body.huiswerk.afgevinkt + ' van ' + r.body.huiswerk.gegeven + ' af · ' +
          'leerdoelen ' + r.body.leerdoelen.behaald + ' behaald, ' + r.body.leerdoelen.open + ' open' +
          (r.body.vakken || []).map(function (v) {
            return '<div class="item"><span>' + esc(v.vak) + '</span><span class="stil">gemiddeld ' +
              (v.gemiddelde == null ? '-' : v.gemiddelde) + ' uit ' + v.aantal + ' cijfers</span></div>';
          }).join('');
      });
    });
    q('doOverstap').addEventListener('click', function () {
      if (!q('doNaarKlas').value.trim()) return meld('Naar welke klas gaat deze leerling?');
      A('/school/leerling/overstap', sleutels({ leerlingId: id, naarKlas: q('doNaarKlas').value, reden: q('doOverReden').value }))
        .then(function (r) { meld(r.body.error || 'Overstap genoteerd; het spoor staat in het dossier.'); if (!r.body.error) { laadLijst(); toon(id); } });
    });
    q('doUit').addEventListener('click', function () {
      var reden = window.prompt('Waarom wordt deze leerling uitgeschreven? (verhuizing, overstap, einde opleiding)');
      if (reden == null || !reden.trim()) return;
      A('/school/leerling/uitschrijf', sleutels({ leerlingId: id, reden: reden }))
        .then(function (r) { meld(r.body.error || r.body.uitleg); if (!r.body.error) { laadLijst(); toon(id); } });
    });
    q('doDoc').addEventListener('click', function () {
      if (!q('doTitel').value.trim()) return meld('Geef het document een titel.');
      A('/school/document/voeg', sleutels({ leerlingId: id, soort: q('doSoort').value, titel: q('doTitel').value,
        nummer: q('doNummer').value, instelling: q('doInstelling').value }))
        .then(function (r) { meld(r.body.error || 'Document geregistreerd.'); if (!r.body.error) toon(id); });
    });
  }

  return { bind: bind };
})();

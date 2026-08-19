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
  var A = null, S = null, esc = null, meld = null, wortel = null, LIJST = [], GEKOZEN = null;

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
        '<div class="kaart"><div class="kop">Leerlingen</div>' +
        '<div class="rij"><input class="veld" id="doZoek" type="search" placeholder="Zoek op naam" ' +
        'maxlength="60" aria-label="Zoek een leerling op naam"></div>' +
        '<div id="doLijst" style="margin-top:.5rem;"></div>' +
        '<p class="stil" style="margin-top:.5rem;">Filtert in dit scherm, over de lijst die u al mag zien.</p></div>' +
        '<div class="kaart enterprise-breed" id="doDetail" hidden></div>';
      lijstTekenen('');
      document.getElementById('doZoek').addEventListener('input', function () { lijstTekenen(this.value); });
      if (GEKOZEN) toon(GEKOZEN);
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

  function toon(id) {
    GEKOZEN = id;
    A('/school/dossier', sleutels({ leerlingId: id })).then(function (r) {
      var d = r.body;
      if (d.error) return meld(d.error);
      var l = d.leerling, c = d.contact || {}, v = c.verzorgers || [];
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
        '<div class="kop" style="margin-top:.9rem;">Contact en verzorgers</div>' +
        '<div class="rij">' +
          veld('doAdres', 'Adres', c.adres, 120) + veld('doPostcode', 'Postcode', c.postcode, 12) +
          veld('doPlaats', 'Plaats', c.plaats, 60) + veld('doTel', 'Telefoon', c.telefoon, 24) +
          veld('doMail', 'E-mail', c.email, 80) +
        '</div>' +
        [0, 1, 2].map(function (i) {
          var x = v[i] || {};
          return '<div class="rij" style="margin-top:.4rem;">' +
            veld('doVn' + i, 'Naam verzorger ' + (i + 1), x.naam, 60) +
            veld('doVr' + i, 'Relatie', x.relatie, 30) +
            veld('doVt' + i, 'Telefoon', x.telefoon, 24) +
            veld('doVe' + i, 'E-mail', x.email, 80) +
            '<label class="stil" style="display:flex;gap:.3rem;align-items:center;min-height:24px;">' +
            '<input type="checkbox" id="doVnood' + i + '"' + (x.noodnummer ? ' checked' : '') + '> noodnummer</label></div>';
        }).join('') +
        '<div class="rij" style="margin-top:.5rem;"><button class="knop p" id="doContact" type="button">Bewaar contactgegevens</button></div>' +
        '<p class="stil">Zonder telefoonnummer belt niemand bij een ongeluk. Een kind kan twee huizen hebben; daarom drie regels.</p>' +
        '<div class="kop" style="margin-top:.9rem;">Documenten</div>' +
        ((d.documenten || []).map(function (x) {
          return '<div class="item"><span>' + esc(x.titel) + ' <span class="stil">· ' + esc(x.soort) + '</span></span>' +
            '<span class="stil">' + esc(String(x.at).slice(0, 10)) + ' · ' + esc(x.door) + '</span></div>';
        }).join('') || '<p class="stil">Nog geen documenten geregistreerd.</p>') +
        '<div class="rij" style="margin-top:.5rem;">' +
          '<select class="veld" id="doSoort" aria-label="Soort document" style="flex:0 1 10rem;">' +
          ['diploma', 'certificaat', 'verklaring', 'rapport', 'overig'].map(function (s) {
            return '<option value="' + s + '">' + s + '</option>'; }).join('') + '</select>' +
          veld('doTitel', 'Titel', '', 100) + veld('doNummer', 'Nummer (mag leeg)', '', 40) +
          veld('doInstelling', 'Instelling', '', 80) +
          '<button class="knop" id="doDoc" type="button">Registreer</button>' +
        '</div>' +
        '<p class="stil">RTG School legt vast wat er is afgegeven; het diploma zelf komt van de officiele instelling.</p>' +
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
    q('doDoc').addEventListener('click', function () {
      if (!q('doTitel').value.trim()) return meld('Geef het document een titel.');
      A('/school/document/voeg', sleutels({ leerlingId: id, soort: q('doSoort').value, titel: q('doTitel').value,
        nummer: q('doNummer').value, instelling: q('doInstelling').value }))
        .then(function (r) { meld(r.body.error || 'Document geregistreerd.'); if (!r.body.error) toon(id); });
    });
  }

  return { bind: bind };
})();

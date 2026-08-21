/* RTF Living Lab, scherm deel 12: toezicht. Een onderzoek stilleggen, en de
   klachten van deelnemers afhandelen.

   Dit staat los van ./livinglab-ethiek.js, en het onderscheid is echt: dat
   bestand gaat over de waarborgen die je VOORAF invult, dit over ingrijpen
   TERWIJL het loopt. Alleen de ethisch toezichthouder van het lab kan een
   onderzoek stilleggen, en hervatten vraagt dezelfde rol plus een reden.

   DE KLACHT IS GEEN BERICHTJE. Zolang er één openstaat, blokkeert hij de
   deelnemersstap (zie kern/livinglab/ethiek.js: gebreken). Afsluiten kan alleen
   met een antwoord van minstens tien tekens -- een klacht die je kunt wegklikken
   is geen procedure. Dat het scherm het aantal open klachten dus prominent
   toont, is geen versiering maar de reden dat de studie stilstaat. */
(function () {
  'use strict';
  var api, esc, meld, huidigLab;

  function init(o) { api = o.api; esc = o.esc; meld = o.meld; huidigLab = o.huidigLab; }

  function tekenaars(rollen) {
    var lab = huidigLab() || {};
    var lijst = (lab.tekenaars || []).filter(function (t) { return !rollen || rollen.indexOf(t.rol) >= 0; });
    if (!lijst.length) return null;
    return lijst.map(function (t) {
      return '<option value="' + esc(t.naam) + '">' + esc(t.naam) + ' (' + esc(t.rol) + ')</option>';
    }).join('');
  }

  function blok(s) {
    var e = s.ethiek || {};
    var toez = tekenaars(['toezichthouder']);
    var alle = tekenaars();
    // het dossier geeft alleen het AANTAL klachten mee (kern/livinglab/studie.js);
    // de inhoud komt pas als iemand ze opvraagt
    var open = e.klachten || 0;

    return '<div class="kaart"><div class="sec">Toezicht</div>' +
      (e.stilgelegd
        ? '<div class="gebrek">Dit onderzoek is STILGELEGD door ' + esc(e.stilgelegd.door) + ': ' +
            esc(e.stilgelegd.reden) + '</div>'
        : '<div class="leeg">Dit onderzoek loopt.</div>') +
      (toez
        ? '<div class="rij h-mt35">' +
            '<select class="veld" data-tzdoor aria-label="Toezichthouder">' + toez + '</select>' +
            '<input class="veld" data-tzreden placeholder="Reden" maxlength="300">' +
            '<button class="knop stil" data-tzzet type="button">' +
              (e.stilgelegd ? 'Hervat het onderzoek' : 'Leg het onderzoek stil') + '</button></div>'
        : '<div class="leeg">Dit lab heeft nog geen ethisch toezichthouder; alleen die kan een onderzoek stilleggen.</div>') +

      '<div class="sec h-mt90">Klachten' + (open ? ' (' + open + ')' : '') + '</div>' +
      (open
        ? '<div class="gebrek">Er staan ' + open + ' klacht(en) op dit onderzoek. Zolang er één open is, ' +
            'komt de studie niet aan deelnemers toe.</div>' +
          '<button class="knop stil" data-klijst type="button">Toon de klachten</button>' +
          '<div data-klachten></div>'
        : '<div class="leeg">Geen klachten. Een deelnemer dient ze in zonder in te loggen, ' +
            'want een klacht kan juist gaan over hoe dit onderzoek met hem omging.</div>') +
      (alle ? '<div class="rij h-mt35" data-kafhandel hidden>' +
        '<select class="veld" data-kdoor aria-label="Afgehandeld door">' + alle + '</select>' +
        '<input class="veld" data-kantwoord placeholder="Antwoord aan de klager" maxlength="1000">' +
        '<button class="knop stil" data-kzet type="button">Handel af</button></div>' : '') +
      '</div>';
  }

  function bind(el, s, doe) {
    var q = function (x) { return el.querySelector(x); };
    var w = function (x) { return q(x) ? q(x).value : ''; };

    if (q('[data-tzzet]')) q('[data-tzzet]').addEventListener('click', function () {
      doe(api('ethiek/stilleggen', { id: s.id, door: w('[data-tzdoor]'), reden: w('[data-tzreden]'),
        hervat: !!(s.ethiek && s.ethiek.stilgelegd) }));
    });

    /* De klachten worden pas OPGEHAALD als iemand erom vraagt. Ze staan niet in
       het gewone dossierbeeld: de tekst van een klacht kan over een persoon
       gaan, en dan hoort hij niet in elk scherm mee te reizen dat toevallig het
       dossier opent. */
    if (q('[data-klijst]')) q('[data-klijst]').addEventListener('click', function () {
      api('studie', { id: s.id }).then(function (r) {
        // het volledige dossier bevat alleen het aantal; de klachtteksten komen
        // uit dezelfde bron zodra de staf ze opvraagt
        var doelEl = q('[data-klachten]');
        var lijst = (r.studie && r.studie.klachtenLijst) || [];
        doelEl.innerHTML = lijst.length
          ? lijst.map(function (k) {
              return '<div class="log" data-klacht="' + esc(k.id) + '"><b>' + esc(k.tekst) + '</b><br>' +
                'van ' + esc(k.van) + ' &middot; <span class="pil' + (k.status === 'open' ? ' let' : ' ok') + '">' +
                esc(k.status) + '</span>' +
                (k.status === 'open' ? ' <button class="knop stil" data-kkies type="button" style="font-size:.7rem;padding:.15rem .5rem;">afhandelen</button>' : '') +
                (k.antwoord ? '<br>antwoord: ' + esc(k.antwoord) : '') + '</div>';
            }).join('')
          : '<div class="leeg">De klachten zijn niet op te halen in dit beeld.</div>';
        Array.prototype.forEach.call(doelEl.querySelectorAll('[data-kkies]'), function (b) {
          b.addEventListener('click', function () {
            var rij = b.closest('[data-klacht]');
            if (q('[data-kafhandel]')) {
              q('[data-kafhandel]').hidden = false;
              q('[data-kafhandel]').dataset.kafhandel = rij.dataset.klacht;
              q('[data-kantwoord]').focus();
            }
          });
        });
      }).catch(function (e) { meld(e.message); });
    });

    if (q('[data-kzet]')) q('[data-kzet]').addEventListener('click', function () {
      var id = q('[data-kafhandel]').dataset.kafhandel;
      if (!id) { meld('Kies eerst een klacht om af te handelen.'); return; }
      doe(api('ethiek/klacht-af', { id: s.id, klachtId: id, door: w('[data-kdoor]'), antwoord: w('[data-kantwoord]') }));
    });
  }

  window.LivingLabToezicht = { init: init, blok: blok, bind: bind };
})();

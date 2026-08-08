/* RTF Living Lab, scherm deel 11: de werkplaats van een onderzoek. Taken met
   deadlines, documenten met versies, het experimentlogboek en het besluitenlog.

   Dit is het deel dat een project van twintig buurtbewoners en drie
   professionals bij elkaar houdt. Het staat met opzet IN het dossier en niet in
   een aparte tool: een experimentlogboek dat ergens anders leeft, is geen
   onderdeel van het bewijs, en dan weet achteraf niemand meer waarop een
   conclusie rustte.

   Een taak kan aan een DEELNEMER hangen, en dan verschijnt hij bij die persoon
   in de bewonersapp (/apps/labpas.html). Daarom is dat een keuzelijst met de
   aliassen van dit onderzoek en geen vrij tekstveld: een taak voor "Jan" komt
   bij niemand terecht.

   HET RESERVEREN VAN APPARATUUR staat hier ook, en dat is geen verdwaalde code:
   een reservering hangt aan DEZE studie en schrijft de kalibratiestand van dit
   moment mee. Het register zelf (wat er is, wie bevoegd is) staat op labniveau
   in ./livinglab-apparatuur.js. */
(function () {
  'use strict';
  var api, esc, meld;

  function init(o) { api = o.api; esc = o.esc; meld = o.meld; }

  function blok(s) {
    var t = s.taken || [], d = s.documenten || [], bl = s.besluitenlog || [];
    var vandaag = new Date().toISOString().slice(0, 10);
    var aliassen = (s.deelnemers || []).map(function (p) {
      return '<option value="' + esc(p.alias) + '">' + esc(p.alias) + ' (' + esc(p.rol) + ')</option>';
    }).join('');

    return '<div class="kaart"><div class="sec">Werkplaats</div>' +

      // taken
      (t.length
        ? t.slice(0, 25).map(function (x) {
            return '<div class="log" data-taak="' + esc(x.id) + '">' +
              (x.af ? '<s>' + esc(x.tekst) + '</s>' : '<b>' + esc(x.tekst) + '</b>') +
              (x.voor ? ' &middot; voor ' + esc(x.voor) : '') +
              (x.deadline ? ' &middot; <span class="pil' + (!x.af && x.deadline < vandaag ? ' let' : '') + '">' +
                esc(x.deadline) + '</span>' : '') +
              (x.af ? '' : ' <button class="knop stil" data-tafvink type="button" style="font-size:.7rem;padding:.15rem .5rem;">afvinken</button>') +
              '</div>';
          }).join('')
        : '<div class="leeg">Nog geen taken.</div>') +
      '<div class="rij" style="margin-top:.35rem;">' +
        '<input class="veld" data-wtekst placeholder="Wat moet er gebeuren?" maxlength="300">' +
        (aliassen ? '<select class="veld" data-wvoor aria-label="Voor wie" style="max-width:11rem;">' +
          '<option value="">voor het team</option>' + aliassen + '</select>' : '') +
        '<input class="veld" data-wdeadline type="date" aria-label="Deadline" style="max-width:9.5rem;">' +
        '<button class="knop stil" data-wtaak type="button">Zet op de lijst</button></div>' +

      // documenten met versies
      '<div class="sec" style="margin-top:.9rem;">Documenten</div>' +
      (d.length
        ? d.map(function (x) {
            return '<div class="log"><b>' + esc(x.naam) + '</b> &middot; versie ' + x.versie +
              (x.samenvatting ? '<br>' + esc(x.samenvatting) : '') + '</div>';
          }).join('')
        : '<div class="leeg">Nog geen documenten. Dezelfde naam nog eens toevoegen maakt er een nieuwe versie van.</div>') +
      '<div class="rij" style="margin-top:.35rem;">' +
        '<input class="veld" data-dnaam placeholder="Naam van het document" maxlength="120">' +
        '<input class="veld" data-dsam placeholder="Waar gaat het over?" maxlength="500">' +
        '<button class="knop stil" data-ddoc type="button">Leg vast</button></div>' +

      // experimentlogboek en besluitenlog
      '<div class="sec" style="margin-top:.9rem;">Logboek</div>' +
      ((s.logboek || []).slice(0, 8).map(function (l) {
        return '<div class="log">' + esc(l.tekst) + ' &middot; ' + esc(l.wie || 'lab') + '</div>';
      }).join('') || '<div class="leeg">Nog niets.</div>') +
      '<div class="rij" style="margin-top:.35rem;">' +
        '<input class="veld" data-ltekst placeholder="Wat is er gebeurd?" maxlength="600">' +
        '<input class="veld" data-lapp placeholder="apparatuur (komma\'s)" maxlength="200" style="max-width:11rem;">' +
        '<button class="knop stil" data-llog type="button">Noteer</button></div>' +

      '<div class="sec" style="margin-top:.9rem;">Besluitenlog</div>' +
      (bl.length
        ? bl.slice(0, 8).map(function (x) {
            return '<div class="log"><b>' + esc(x.tekst) + '</b> &middot; ' + esc(x.wie) +
              (x.waarom ? '<br>' + esc(x.waarom) : '') + '</div>';
          }).join('')
        : '<div class="leeg">Nog geen besluiten. Kleine keuzes die het onderzoek sturen horen hier; ze zijn niet te wissen.</div>') +
      '<div class="rij" style="margin-top:.35rem;">' +
        '<input class="veld" data-btekst placeholder="Wat is er besloten?" maxlength="500">' +
        '<input class="veld" data-bwaarom placeholder="Waarom?" maxlength="500">' +
        '<input class="veld" data-bdoor placeholder="Door wie" maxlength="80" style="max-width:9rem;">' +
        '<button class="knop stil" data-bbesluit type="button">Leg vast</button></div></div>';
  }

  function bind(el, s, doe) {
    var q = function (x) { return el.querySelector(x); };
    var w = function (x) { return q(x) ? q(x).value : ''; };
    if (!q('[data-wtaak]')) return;

    q('[data-wtaak]').addEventListener('click', function () {
      doe(api('werk/taak', { id: s.id, tekst: w('[data-wtekst]'), voor: w('[data-wvoor]'), deadline: w('[data-wdeadline]') }));
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-tafvink]'), function (b) {
      b.addEventListener('click', function () {
        doe(api('werk/taak-zet', { id: s.id, taakId: b.closest('[data-taak]').dataset.taak, af: true }));
      });
    });
    q('[data-ddoc]').addEventListener('click', function () {
      doe(api('werk/document', { id: s.id, naam: w('[data-dnaam]'), samenvatting: w('[data-dsam]') }));
    });
    q('[data-llog]').addEventListener('click', function () {
      doe(api('werk/log', { id: s.id, tekst: w('[data-ltekst]'),
        apparatuur: w('[data-lapp]').split(',').map(function (x) { return x.trim(); }).filter(Boolean) }));
    });
    q('[data-bbesluit]').addEventListener('click', function () {
      doe(api('werk/besluit', { id: s.id, tekst: w('[data-btekst]'), waarom: w('[data-bwaarom]'), door: w('[data-bdoor]') }));
    });
  }

  /* De reserveringsknop in het dossier van een onderzoek: het apparaat hangt
     aan DEZE studie, en de kalibratiestand van dit moment gaat mee de
     reservering in. */
  function reserveerBlok(s, apparatuur) {
    if (!apparatuur || !apparatuur.length) return '';
    return '<div class="kaart"><div class="sec">Apparatuur voor dit onderzoek</div>' +
      ((s.reserveringen || []).filter(function (r) { return !r.weg; }).length
        ? s.reserveringen.filter(function (r) { return !r.weg; }).map(function (r) {
            return '<div class="log" data-resv="' + esc(r.id) + '|' + esc(r.apparaatId) + '"><b>' + esc(r.apparaat) +
              '</b> &middot; ' + esc(r.van) + ' t/m ' + esc(r.tot) + ' &middot; door ' + esc(r.door) +
              ' <button class="knop stil" data-resvweg type="button" style="font-size:.7rem;padding:.15rem .5rem;">intrekken</button>' +
              '<br>kalibratie bij gebruik: ' + (r.kalibratie && r.kalibratie.op ? esc(r.kalibratie.op) +
                (r.kalibratie.stand ? ' (' + esc(r.kalibratie.stand) + ')' : '') : 'n.v.t.') + '</div>';
          }).join('')
        : '<div class="leeg">Nog niets gereserveerd.</div>') +
      '<div class="rij" style="margin-top:.35rem;">' +
        '<select class="veld" data-resvapp aria-label="Apparaat">' +
          apparatuur.filter(function (a) { return a.actief; }).map(function (a) {
            return '<option value="' + esc(a.id) + '">' + esc(a.naam) + '</option>';
          }).join('') + '</select>' +
        '<input class="veld" data-resvvan type="date" aria-label="van" style="max-width:9.5rem;">' +
        '<input class="veld" data-resvtot type="date" aria-label="tot" style="max-width:9.5rem;">' +
        '<input class="veld" data-resvdoor placeholder="op naam van" style="max-width:9rem;">' +
        '<button class="knop stil" data-resvzet type="button">Reserveer</button></div></div>';
  }

  /* De reserveringsvelden dragen een EIGEN voorvoegsel (resv). Ze heetten eerst
     data-rzet, en dat is in ./livinglab-vormen.js de knop waarmee je een
     REFLECTIE vastlegt. Beide blokken staan in hetzelfde blad, dus bij de stap
     `reflectie` haakte deze bedrading zich aan die knop: één klik op "Leg vast"
     zocht daarna een apparaat dat er niet was. Zelfde naam, twee betekenissen,
     in één document -- regel 4 van de lat, en hij bijt hier meteen. */
  function bindReservering(el, s, doe) {
    var q = function (x) { return el.querySelector(x); };
    if (!q('[data-resvzet]')) return;
    q('[data-resvzet]').addEventListener('click', function () {
      doe(api('app/reserveer', { id: q('[data-resvapp]').value, studieId: s.id,
        van: q('[data-resvvan]').value, tot: q('[data-resvtot]').value, door: q('[data-resvdoor]').value }));
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-resvweg]'), function (b) {
      b.addEventListener('click', function () {
        var stuk = b.closest('[data-resv]').dataset.resv.split('|');
        doe(api('app/reservering-weg', { id: stuk[1], reserveringId: stuk[0] }));
      });
    });
  }

  window.LivingLabWerkplaats = { init: init, blok: blok, bind: bind,
    reserveerBlok: reserveerBlok, bindReservering: bindReservering };
})();

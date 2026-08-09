/* Mijn Living Lab, deel "ontdek": wat er in de buurt onderzocht wordt, het
   labpaspoort, en de klachtenprocedure.

   DRIE DINGEN DIE HIER OPEN STAAN, elk om een eigen reden:

   1. HET ONDERZOEKSOVERZICHT. Een bewoner hoort te kunnen zien waar zijn lab aan
      werkt, ook als hij nergens aan meedoet. Dit is de BUITENSTE ring
      (kern/livinglab/studie.js): titel, vraagstuk, soort en waar het staat in de
      cyclus -- geen deelnemers, geen observaties, geen ruwe data. Bij een
      gescheiden studie zelfs geen vraagstelling, want juist die verraadt wie de
      deelnemers zijn.
   2. HET LABPASPOORT. Punten en badges over onderzoeken heen, op een code die de
      drager zelf houdt. Wie meedoet aan een GESCHEIDEN studie kan hem daar niet
      aan koppelen -- dat zou precies de link maken die het lab niet vastlegt --
      en de punten blijven daar dus binnen dat onderzoek. Dat staat er ook zo bij,
      want een spelelement dat stil minder oplevert voelt als een storing.
   3. DE KLACHT. Zonder pas, met opzet: een klacht kan juist gaan over hoe een
      onderzoek met je omging, en dan is "log eerst in" het verkeerde antwoord.
      Zolang er één openstaat, komt die studie niet aan nieuwe deelnemers toe. */
(function () {
  'use strict';
  var api, esc, meld, KADER, LAB = null;
  var $ = function (s) { return document.querySelector(s); };

  function init(o) { api = o.api; esc = o.esc; meld = o.meld; KADER = o.kader; }
  function zetLab(id) { LAB = id; }

  var stapNaam = function (st) {
    var c = (KADER.cyclus || []).filter(function (x) { return x.stap === st; })[0];
    return c ? c.naam : st;
  };

  /* ---------- wat er in dit lab onderzocht wordt ---------- */
  function laadOnderzoek() {
    if (!LAB) return Promise.resolve();
    return api('bewoner/overzicht', { labId: LAB }).then(function (r) {
      var s = r.studies || [];
      $('#oLijst').innerHTML = s.length
        ? s.slice(0, 20).map(function (x) {
            return '<div class="log" data-studie="' + esc(x.id) + '"><b>' + esc(x.titel) + '</b>' +
              (x.soortNaam ? ' &middot; ' + esc(x.soortNaam) : '') +
              ' &middot; <span class="pil">' + esc(stapNaam(x.stap)) + '</span>' +
              (x.gescheiden
                ? '<br><span class="leeg">Dit onderzoek houdt zijn gegevens gescheiden om de deelnemers te beschermen; ' +
                  'de vraagstelling is daarom niet openbaar.</span>'
                : (x.vraagstuk ? '<br>' + esc(x.vraagstuk) : '')) +
              (x.besluit ? '<br><span class="pil ok">besluit: ' + esc(x.besluit.soort) + '</span> ' + esc(x.besluit.reden || '') : '') +
              ' <button class="knop stil" data-oopen type="button" style="font-size:.7rem;padding:.15rem .5rem;">bekijk</button>' +
              ' <button class="knop stil" data-oklacht type="button" style="font-size:.7rem;padding:.15rem .5rem;">klacht indienen</button>' +
              '<div data-odetail></div></div>';
          }).join('')
        : '<div class="leeg">Dit lab heeft nog geen onderzoek lopen.</div>';
      bindOnderzoek();
    }).catch(function (e) { $('#oLijst').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  }

  function bindOnderzoek() {
    /* Het detail komt PAS als iemand erom vraagt, en het is precies dezelfde
       buitenste ring als de lijst -- alleen met de conclusies erbij zodra het
       onderzoek een besluit heeft. Wat een afgerond onderzoek heeft opgeleverd,
       hoort een bewoner te kunnen lezen zonder ergens lid van te zijn. */
    Array.prototype.forEach.call(document.querySelectorAll('[data-oopen]'), function (b) {
      b.addEventListener('click', function () {
        var rij = b.closest('[data-studie]');
        api('bewoner/studie', { id: rij.dataset.studie }).then(function (r) {
          var x = r.studie, c = x.conclusies || [];
          rij.querySelector('[data-odetail]').innerHTML =
            '<div class="leeg">Stap: ' + esc(stapNaam(x.stap)) + ' &middot; risicoklasse ' + esc(x.klasse) + '</div>' +
            (c.length
              ? '<div class="sec">Wat eruit kwam</div>' + c.map(function (y) {
                  return '<div class="log">' + esc(y.tekst) + ' <span class="pil">' + esc(y.graad) + '</span></div>';
                }).join('')
              : '<div class="leeg">Nog geen conclusies; die komen pas als het onderzoek een besluit heeft.</div>');
        }).catch(function (e) { meld(e.message); });
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-oklacht]'), function (b) {
      b.addEventListener('click', function () {
        var id = b.closest('[data-studie]').dataset.studie;
        var tekst = prompt('Waar gaat uw klacht over? U hoeft niet in te loggen en u mag anoniem blijven.');
        if (!tekst) return;
        api('bewoner/klacht', { id: id, tekst: tekst })
          .then(function () {
            meld('Uw klacht is vastgelegd. Zolang hij openstaat, neemt dit onderzoek geen nieuwe deelnemers aan.');
          })
          .catch(function (e) { meld(e.message); });
      });
    });
  }

  /* ---------- het labpaspoort ---------- */
  function toonPaspoort(code) {
    return api('bewoner/paspoort', { code: code }).then(function (r) {
      var p = r.paspoort;
      try { sessionStorage.setItem('rtg_labpaspoort', code); } catch (e) {}
      $('#pasp').innerHTML = '<div class="sec">Labpaspoort van ' + esc(p.naam) + '</div>' +
        '<div class="pas"><div class="nv">' + p.punten + '</div>' +
          '<div><div style="font-weight:600;">' + esc(p.niveauNaam) + '</div>' +
          '<div class="leeg" style="padding:0;">niveau ' + p.niveau +
            (p.volgende ? ' &middot; nog ' + p.volgende.teGaan + ' punten tot ' + esc(p.volgende.naam) : ' &middot; hoogste niveau') +
          '</div></div></div>' +
        (p.volgende
          ? '<div class="balk"><i style="width:' +
            Math.max(2, Math.min(100, Math.round((p.punten / p.volgende.vanaf) * 100))) + '%"></i></div>'
          : '') +
        (p.badges.length
          ? '<div style="margin-top:.5rem;">' + p.badges.map(function (b) {
              return '<span class="badge" title="' + esc(b.uitleg) + '">' + esc(b.naam) + '</span>';
            }).join('') + '</div>'
          : '<div class="leeg">Nog geen badges.</div>') +
        '<div class="sec" style="margin-top:.9rem;">Missies</div>' +
        (r.missies || []).map(function (m) {
          return '<div class="log"><b>' + esc(m.naam) + '</b><br>' + esc(m.uitleg) + '</div>';
        }).join('');
    }).catch(function (e) { $('#pasp').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  }

  function bind() {
    $('#paspOpen').addEventListener('click', function () {
      var c = $('#paspVeld').value.trim().toUpperCase();
      if (!c) return;
      toonPaspoort(c);
    });
    $('#paspMaak').addEventListener('click', function () {
      var naam = $('#paspNaam').value.trim();
      if (!naam) { meld('Onder welke naam wilt u dit paspoort? Een roepnaam volstaat.'); return; }
      api('bewoner/paspoort-maak', { labId: LAB, naam: naam })
        .then(function (r) {
          $('#pasp').innerHTML = '<div class="uitdaging"><div class="sec">Uw labpaspoort</div>' +
            '<h2 style="font-family:monospace;font-size:1.15rem;">' + esc(r.paspoort.code) + '</h2>' +
            '<div class="leeg">Bewaar deze code. U geeft hem op als u aan een onderzoek meedoet, ' +
            'en dan tellen uw punten over onderzoeken heen mee. Bij een onderzoek dat zijn gegevens ' +
            'gescheiden houdt kan dat niet -- daar blijven de punten binnen dat ene onderzoek.</div></div>';
          $('#paspVeld').value = r.paspoort.code;
        })
        .catch(function (e) { meld(e.message); });
    });
    // wie zijn paspoort deze sessie al opende, hoeft het niet opnieuw te typen
    try {
      var bewaard = sessionStorage.getItem('rtg_labpaspoort');
      if (bewaard) { $('#paspVeld').value = bewaard; toonPaspoort(bewaard); }
    } catch (e) {}
  }

  window.LabpasOntdek = { init: init, zetLab: zetLab, laadOnderzoek: laadOnderzoek, bind: bind };
})();

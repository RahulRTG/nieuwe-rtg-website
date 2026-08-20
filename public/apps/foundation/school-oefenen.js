/* RTF School, gezinskant: het oefen-huiswerk. Een leraar kan een leerdoel uit
   de leerlijn als huiswerk geven; dan zijn er vijf verse opgaven, en bij vier
   goed vinkt het huiswerk zichzelf af.

   Dit staat met opzet NIET in school-toets.js, en dat is geen ordeningskwestie
   maar het verschil zelf: bij OEFENEN krijg je meteen te horen of het goed was
   en wat het juiste antwoord is, want dat is hoe je leert. Bij een TOETS
   gebeurt dat niet -- die kijk je na het inleveren na. Twee bestanden, twee
   gedragingen, en geen enkele kans dat de een per ongeluk de ander wordt.

   Er staat geen score buiten de sessie: geen reeks, geen ranglijst, geen
   badge. Leren is geen wedstrijd.

   Draait als los deel naast de pagina; gebruikt gezinApi uit school.html. */
(function () {
  'use strict';
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var wortel = null, BEZIG = null;

  async function laad() {
    if (typeof gezinApi !== 'function' || !wortel) return;
    var d;
    try { d = await gezinApi('/school/mijn'); } catch (e) { return; }
    if (d && d.ouder) { wortel.innerHTML = ''; return; } // oefenen doet het kind zelf
    var blokken = '';
    ((d && d.school) || []).forEach(function (x) {
      var oefenbaar = (x.huiswerk || []).filter(function (h) { return h.doel && !h.af; });
      if (!oefenbaar.length) return;
      blokken += '<div class="sec">Oefenen · ' + esc(x.klas.naam) + '</div><div class="kaart blok">' +
        oefenbaar.slice(0, 6).map(function (h) {
          return '<div class="mini h-my35"><b>' + esc(h.titel) + '</b>' +
            (h.deadline ? ' · voor ' + esc(h.deadline) : '') +
            ' <button class="knop mini" data-oefen="' + esc(h.id) + '" data-klas="' + esc(x.klas.code) + '">Oefen</button></div>';
        }).join('') +
        '<div class="mini">Vijf verse opgaven. Vier goed en het huiswerk vinkt zichzelf af; er wordt niets bijgehouden buiten deze sessie.</div>' +
        '<div id="oefenLoop-' + esc(x.klas.code) + '"></div></div>';
    });
    wortel.innerHTML = blokken;
    wortel.querySelectorAll('[data-oefen]').forEach(function (b) {
      b.addEventListener('click', async function () {
        BEZIG = { klasCode: b.dataset.klas, huiswerkId: b.dataset.oefen };
        try { vraag(await gezinApi('/school/huiswerk/oefen', BEZIG)); }
        catch (e) { melding(e.message); }
      });
    });
  }

  function vak() { return wortel.querySelector('#oefenLoop-' + (BEZIG ? BEZIG.klasCode : '')); }
  function melding(t) { var v = vak(); if (v) v.innerHTML = '<div class="mini">' + esc(t) + '</div>'; }

  function vraag(r) {
    var v = vak();
    if (!v) return;
    v.innerHTML = '<div class="kaart blok h-mt50">' +
      (r.les ? '<div class="mini h-zacht">' + esc(r.les) + '</div>' : '') +
      '<div class="mini">Vraag ' + r.nr + ' van ' + r.totaal + '</div>' +
      '<div style="margin:.5rem 0;font-size:1.02rem;line-height:1.6;">' + esc(r.vraag) + '</div>' +
      ((r.opties || []).length
        ? '<div class="h-stapel">' + r.opties.map(function (o) {
            return '<button class="knop mini h-links" data-optie="' + esc(o) + '">' + esc(o) + '</button>';
          }).join('') + '</div>'
        : '<div class="h-rij"><input class="veld h-flex1" id="oefenIn" placeholder="Jouw antwoord" ' +
          'autocomplete="off" aria-label="Jouw antwoord">' +
          '<button class="knop mini" id="oefenStuur">Antwoord</button></div>') +
      '<div class="mini h-mt40" id="oefenUit"></div></div>';
    v.querySelectorAll('[data-optie]').forEach(function (b) {
      b.addEventListener('click', function () { antwoord(b.dataset.optie); });
    });
    var stuur = v.querySelector('#oefenStuur');
    if (stuur) {
      stuur.addEventListener('click', function () { antwoord((v.querySelector('#oefenIn') || {}).value || ''); });
      v.querySelector('#oefenIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') stuur.click(); });
    }
  }

  async function antwoord(tekst) {
    if (!BEZIG) return;
    var r;
    try { r = await gezinApi('/school/huiswerk/oefen-antwoord', { klasCode: BEZIG.klasCode, antwoord: tekst }); }
    catch (e) { return melding(e.message); }
    /* Oefenen is leren: hier WEL meteen goed of fout, met het juiste antwoord
       erbij. Bij een toets gebeurt dat niet; zie de kop van dit bestand. */
    var terug = r.goed ? 'Goed.' : 'Niet goed; het juiste antwoord is ' + r.juisteAntwoord + '.';
    /* De Misconception Graph: heeft de server kunnen narekenen WAT er gedacht
       is, dan staat dat erbij, met dezelfde stof anders uitgelegd eronder.
       Kwam hij er niet uit, dan staat er niets extra's -- liever niets dan een
       gok, want een verzonnen duiding stuurt een kind de verkeerde kant op. */
    var extra = (r.denkfout ? '<div class="h-mt35"><b>' + esc(r.denkfout.naam) + '.</b> ' + esc(r.denkfout.uitleg) + '</div>' : '') +
      (r.anders ? '<div style="margin-top:.3rem;opacity:.9;"><i>Anders uitgelegd (' + esc(r.anders.soort) + '):</i> ' + esc(r.anders.tekst) + '</div>' : '');
    if (!r.klaar) {
      vraag(r);
      var u = wortel.querySelector('#oefenUit');
      if (u) u.innerHTML = esc(terug) + extra;
      return;
    }
    var v = vak();
    if (v) v.innerHTML = '<div class="mini">' + esc(terug + ' Je had er ' + r.aantalGoed + ' van de ' + r.totaal + ' goed. ' +
      (r.afgevinkt ? 'Het huiswerk staat afgevinkt.' : (r.advies || ''))) + extra + '</div>';
    BEZIG = null;
    setTimeout(laad, 1600);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var lijst = document.querySelector('#schoolLijst');
    if (!lijst) return;
    wortel = document.createElement('div');
    wortel.id = 'schoolOefenen';
    lijst.parentNode.insertBefore(wortel, lijst.nextSibling);
    setTimeout(laad, 1200);
  });
})();

/* RTF School, gezinskant: de toets die de leerling zelf maakt, en de
   vastgestelde rapporten.

   Dit ontbrak, en het was het gat dat het hardst opviel: de leraar kon een
   toets klaarzetten (verse opgaven per leerling, de motor kijkt na), maar er
   was nergens een scherm waarin een kind hem kon maken. Nu wel.

   Vier dingen die dit scherm van de server overneemt:

   1. EEN TOETS MAAK JE ZELF. Starten en antwoorden lopen op het eigen profiel
      van het kind; een ouder ziet de stand, maar kan de toets niet voor hem
      maken. Dat is geen beperking van het scherm maar van de server, en het
      staat er ook zo bij.
   2. GEEN GOED/FOUT PER VRAAG. Bij het oefenen krijg je dat wel, bij een toets
      niet: die kijk je na het inleveren na. Het scherm verzint dus geen
      tussenstand die er niet is.
   3. HET CIJFER KOMT VAN DE LERAAR. Na het inleveren staat er hoeveel er goed
      waren; het cijfer is een menselijk besluit en verschijnt in het gewone
      cijferoverzicht.
   4. EEN RAPPORT ZIE JE PAS ALS EEN MENS HET HEEFT VASTGESTELD. /rapport/mijn
      stuurt niets anders; hier staat dus nooit een concept.

   Draait als los deel naast de pagina; gebruikt gezinApi uit school.html. */
(function () {
  'use strict';
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var wortel = null, BEZIG = null;

  function kaart(titel, binnen) {
    return '<div class="sec">' + titel + '</div><div class="kaart blok">' + binnen + '</div>';
  }

  async function laad() {
    if (typeof gezinApi !== 'function' || !wortel) return;
    var d;
    try { d = await gezinApi('/school/mijn'); } catch (e) { return; }
    var ouder = !!(d && d.ouder), uit = '';
    for (var i = 0; i < ((d && d.school) || []).length; i++) {
      var x = d.school[i];
      try { uit += await toetsBlok(x, ouder); } catch (e) {}
    }
    try { uit += await rapportBlok(); } catch (e) {}
    wortel.innerHTML = uit;
    bind();
  }

  async function toetsBlok(x, ouder) {
    var body = ouder ? { klasCode: x.klas.code, profielId: x.kind.profielId } : { klasCode: x.klas.code };
    var r = await gezinApi('/school/toets/voor-mij', body).catch(function () { return null; });
    if (!r || !r.ok) return '';
    var lijst = (r.toetsen || []).map(function (t) {
      var stand = t.klaar
        ? '<span class="mini">Ingeleverd · ' + t.uitslag.goed + ' van ' + t.uitslag.totaal + ' goed. Je leraar geeft het cijfer.</span>'
        : t.status !== 'open' ? '<span class="mini">Gesloten.</span>'
        : ouder ? '<span class="mini">' + (t.bezig ? 'Bezig' : 'Nog niet gemaakt') + '. ' + esc(x.kind.naam) + ' maakt de toets zelf, op het eigen profiel.</span>'
        : '<button class="knop mini" data-toets="' + esc(t.id) + '" data-klas="' + esc(x.klas.code) + '">' +
          (t.bezig ? 'Ga verder' : 'Maak de toets') + '</button>';
      return '<div class="mini" style="margin:.35rem 0;"><b>' + esc(t.naam) + '</b> · ' + esc(t.soort) +
        ' · ' + t.vragen + ' vragen<br>' + stand + '</div>';
    }).join('');
    if (!lijst) return '';
    return kaart('Toetsen · ' + esc(x.kind.naam) + ' (' + esc(x.klas.naam) + ')',
      lijst + '<div class="mini" style="margin-top:.4rem;">Elke leerling krijgt eigen opgaven. Je krijgt geen goed of fout per vraag: een toets kijk je na het inleveren na.</div>' +
      '<div id="toetsLoop-' + esc(x.klas.code) + '"></div>');
  }

  async function rapportBlok() {
    var r = await gezinApi('/school/rapport/mijn').catch(function () { return null; });
    if (!r || !r.ok || !(r.rapporten || []).length) return '';
    return kaart('Rapporten', r.rapporten.map(function (x) {
      var vakken = (x.vakken || []).map(function (v) {
        return esc(v.vak) + ' <b>' + (v.gemiddelde == null ? '-' : v.gemiddelde) + '</b>';
      }).join(' · ') || 'nog geen cijfers';
      var a = x.aanwezigheid || {};
      return '<div class="mini" style="margin:.4rem 0;"><b>' + esc(x.naam) + '</b> · ' + esc(x.periode) +
        ' · ' + esc(x.klas) + ' (' + esc(x.school) + ')<br>' + vakken +
        '<br>' + (a.lessen || 0) + ' lessen · ' + (a.gemist || 0) + ' gemist · ' + (a.telaat || 0) + ' keer te laat' +
        (x.tekst ? '<br><span style="opacity:.85;">' + esc(x.tekst) + '</span>' : '') + '</div>';
    }).join('') + '<div class="mini" style="margin-top:.4rem;">Hier staan alleen vastgestelde rapporten: een mens van school heeft ze gelezen voordat ze hier kwamen.</div>');
  }

  function bind() {
    wortel.querySelectorAll('[data-toets]').forEach(function (b) {
      b.addEventListener('click', async function () {
        BEZIG = { toetsId: b.dataset.toets, klasCode: b.dataset.klas };
        try {
          var r = await gezinApi('/school/toets/start', BEZIG);
          vraag(r);
        } catch (e) { melding(e.message); }
      });
    });
  }

  function loopVak() {
    return wortel.querySelector('#toetsLoop-' + (BEZIG ? BEZIG.klasCode : ''));
  }
  function melding(tekst) {
    var vak = loopVak();
    if (vak) vak.innerHTML = '<div class="mini">' + esc(tekst) + '</div>';
  }

  function vraag(r) {
    var vak = loopVak();
    if (!vak) return;
    vak.innerHTML = '<div class="kaart blok" style="margin-top:.5rem;">' +
      '<div class="mini"><b>' + esc(r.naam || 'Toets') + '</b> · vraag ' + r.nr + ' van ' + r.totaal + '</div>' +
      '<div style="margin:.5rem 0;font-size:1.02rem;line-height:1.6;">' + esc(r.vraag) + '</div>' +
      ((r.opties || []).length
        ? '<div style="display:flex;flex-direction:column;gap:.35rem;">' + r.opties.map(function (o) {
            return '<button class="knop mini" data-optie="' + esc(o) + '" style="text-align:left;">' + esc(o) + '</button>';
          }).join('') + '</div>'
        : '<div style="display:flex;gap:.4rem;"><input class="veld" id="toetsIn" placeholder="Jouw antwoord" ' +
          'autocomplete="off" aria-label="Jouw antwoord" style="flex:1;">' +
          '<button class="knop mini" id="toetsStuur">Antwoord</button></div>') +
      '</div>';
    vak.querySelectorAll('[data-optie]').forEach(function (b) {
      b.addEventListener('click', function () { antwoord(b.dataset.optie); });
    });
    var stuur = vak.querySelector('#toetsStuur');
    if (stuur) {
      stuur.addEventListener('click', function () { antwoord((vak.querySelector('#toetsIn') || {}).value || ''); });
      vak.querySelector('#toetsIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') stuur.click(); });
    }
  }

  async function antwoord(tekst) {
    if (!BEZIG) return;
    try {
      var r = await gezinApi('/school/toets/antwoord', Object.assign({ antwoord: tekst }, BEZIG));
      if (!r.klaar) return vraag(Object.assign({ naam: null }, r));
      melding(r.bericht + ' Je had er ' + r.aantalGoed + ' van de ' + r.totaal + ' goed.');
      BEZIG = null;
      setTimeout(laad, 1200);
    } catch (e) { melding(e.message); }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var lijst = document.querySelector('#schoolLijst');
    if (!lijst) return;
    wortel = document.createElement('div');
    wortel.id = 'schoolToetsen';
    lijst.parentNode.insertBefore(wortel, lijst.nextSibling);
    setTimeout(laad, 1000); // na laadGezin en school-extra
  });
})();

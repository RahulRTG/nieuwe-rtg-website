/* HET BLAD SAMEN -- het gezelschap rond één reis, op het scherm.

   De regels staan niet hier maar in server/kern/reisgezelschap.js: wie wat van
   een reis ziet, bepaalt de poort daar en niet dit bestand. Dit scherm toont
   alleen wat de server teruggeeft -- inclusief `nietZichtbaar`, want een
   meekijker die een korte reis ziet hoort te weten dat er meer is dat hij niet
   ziet, en niet te denken dat de reis leeg is.

   WAT HIER MET OPZET NIET STAAT: geen kaartje met een stip, geen teller hoe
   vaak iemand keek, en geen knop die iemand toevoegt zonder dat die ander
   aanvaardt. Alle drie zijn ze grenzen uit LIFE.md par. 4 en geen ontbrekende
   functies; wie ze hier alsnog inbouwt, moet eerst dat document veranderen. */
(function (w, d) {
  'use strict';
  var R = w.RTGReizen; if (!R) return;
  var $ = R.$, maak = R.maak;
  var huidig = null;                       // de reis waar dit blad nu over gaat
  /* De tekenlogica van de gedeelde helft staat in ./reizen-samen-delen.js. Bij
     naam opgehaald en niet bij het laden vastgepakt: de volgorde van twee
     defer-scripts is geen afspraak om op te bouwen. */
  function deel(naam) {
    return function () {
      var mod = (w.RTGSamenDelen && w.RTGSamenDelen[naam]) ? w.RTGSamenDelen
        : (w.RTGSamenMensen && w.RTGSamenMensen[naam]) ? w.RTGSamenMensen : null;
      if (mod) return mod[naam].apply(null, arguments);
      /* Zwijgen zou dezelfde fout herhalen die het opknippen al een keer maakte:
         een ontbrekende functie liet zwijgend de halve kolom weg. */
      if (w.console && w.console.error) w.console.error('[samen] onderdeel ontbreekt:', naam);
    };
  }

  function tijd(iso) {
    var t = new Date(String(iso || ''));
    return isNaN(t.getTime()) ? '' : t.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }
  function leeg(vak, tekst) { vak.textContent = ''; vak.appendChild(maak('p', 'leegtekst', tekst)); }

  /* WELKE REIS. Het gezelschap hoort bij één reis, dus als er meer reizen zijn
     moet de lezer kiezen -- en dat is een keuze en geen aanname.
     De lijst is de OPTELSOM van twee dingen, en dat was eerst niet zo: hier
     stonden alleen de eigen reizen, dus een meekijker las "u heeft nog geen
     reis om te delen" terwijl hij net was toegelaten. Hij reist mee, hij bezit
     niet. Wat hij van zo'n reis ziet, komt door dezelfde poort als de rest. */
  function kiesReis(reizen) {
    var vak = $('#samenReizen'); if (!vak) return;
    vak.textContent = '';
    if (!reizen.length) { leeg(vak, 'U heeft nog geen reis, en u bent nog nergens bij uitgenodigd.'); return; }
    reizen.forEach(function (reis) {
      var knop = maak('button', 'reiskeuze' + (reis.id === huidig ? ' actief' : ''));
      knop.type = 'button';
      knop.appendChild(maak('b', '', reis.bestemming));
      knop.appendChild(maak('small', '', (reis.venster.van + ' t/m ' + reis.venster.tot)
        + (reis.van ? ' · reis van ' + reis.van : '')));
      knop.addEventListener('click', function () { huidig = reis.id; laad(); });
      vak.appendChild(knop);
    });
  }

  function laad() {
    if (!R.token) return;
    var kring = R.api('/api/reis/gezelschap/kring', {})
      .then(function (uit) { deel('tekenKring')(uit); return uit; })
      .catch(function () { return { meereizen: [] }; });
    var eigen = R.api('/api/reis/reizen', {})
      .then(function (d) { return d.reizen || []; }).catch(function () { return []; });

    Promise.all([eigen, kring]).then(function (paar) {
      var lijst = paar[0].slice();
      var mee = (paar[1].meereizen || []).filter(function (m) {
        return !lijst.some(function (r) { return r.id === m.reis; });
      });
      /* Van een reis van iemand anders halen we bestemming en venster door de
         POORT op -- niet uit een kopie in het gezelschapsrecord. Eén bron. */
      return Promise.all(mee.map(function (m) {
        return R.api('/api/reis/gezelschap/reis', { reis: m.reis })
          .then(function (uit) {
            return { id: uit.reis.id, bestemming: uit.reis.bestemming, venster: uit.reis.venster, van: uit.van };
          }).catch(function () { return null; });
      })).then(function (erbij) { return lijst.concat(erbij.filter(Boolean)); });
    }).then(function (lijst) {
      if ((!huidig || !lijst.some(function (r) { return r.id === huidig; })) && lijst.length) huidig = lijst[0].id;
      /* Of dit MIJN reis is, weet het scherm hier al: hij stond in de eigen
         lijst. Het beleid opvragen voor een reis van een ander levert een
         terechte 404 op -- en een 404 op een normale weg is ruis waar een
         lezer van het logboek later op gaat jagen. */
      var vanMij = lijst.some(function (r) { return r.id === huidig && !r.van; });
      kiesReis(lijst);
      if (!huidig) return;
      R.api('/api/reis/gezelschap', { reis: huidig }).then(deel('tekenLeden')).catch(function () {});
      R.api('/api/reis/gezelschap/tijdlijn', { reis: huidig }).then(deel('tekenTijdlijn')).catch(function () {});
      R.api('/api/reis/gezelschap/reis', { reis: huidig }).then(deel('tekenZicht')).catch(function () {});
      deel('vulBeelden')(vanMij);
      if (vanMij) {
        R.api('/api/reis/gezelschap/beleid', { reis: huidig })
          .then(deel('tekenDelen'))
          .catch(function () { deel('tekenDelen')(null); });
      } else deel('tekenDelen')(null);
    }).catch(function (fout) {
      /* GEEN LEGE CATCH MEER. Hier stond `catch(function(){})`, en die heeft een
         echte fout verborgen: na het opknippen riep dit bestand een functie aan
         die naar het andere bestand was verhuisd. De ReferenceError verdween in
         deze catch, en op het scherm ontbrak zwijgend de halve rechterkolom.
         Een scherm dat stil half werkt is erger dan een scherm dat klaagt. */
      if (w.console && w.console.error) w.console.error('[samen] het blad kon niet volledig laden:', fout);
      R.toast('Niet alles van het gezelschap kon worden geladen.');
    });
  }

  d.addEventListener('DOMContentLoaded', function () {
    var nodig = $('#samenNodig');
    if (nodig) nodig.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!huidig) { R.toast('Kies eerst een reis.'); return; }
      R.api('/api/reis/gezelschap/nodig-uit', {
        reis: huidig, codenaam: $('#samenCodenaam').value, rol: $('#samenRol').value
      }).then(function () {
        $('#samenCodenaam').value = '';
        /* De uitnodiging staat KLAAR; er is nog niets gedeeld. Dat hoort er
           met zoveel woorden bij te staan, anders denkt de uitnodiger dat de
           ander al meekijkt. */
        R.toast('Uitnodiging staat klaar. Zij zien pas iets nadat zij hem aanvaarden.');
        laad();
      }).catch(function (fout) { R.toast(fout.message); });
    });

    var schrijf = $('#samenSchrijf');
    if (schrijf) schrijf.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!huidig) { R.toast('Kies eerst een reis.'); return; }
      var veld = $('#samenTekst');
      R.api('/api/reis/gezelschap/schrijf', { reis: huidig, tekst: veld.value })
        .then(function () { veld.value = ''; laad(); })
        .catch(function (fout) { R.toast(fout.message); });
    });

    var aangekomen = $('#samenAangekomen');
    if (aangekomen) aangekomen.addEventListener('click', function () {
      if (!huidig) { R.toast('Kies eerst een reis.'); return; }
      R.api('/api/reis/gezelschap/aangekomen', { reis: huidig })
        .then(function (uit) { R.toast('Gedeeld met ' + uit.gedeeldMet + '.'); laad(); })
        .catch(function (e) { R.toast(e.message); });
    });

    var deelKnop = $('#samenDeelBeeld');
    if (deelKnop) deelKnop.addEventListener('click', function () {
      var keuze = $('#samenBeeld');
      if (!huidig || !keuze || !keuze.value) { R.toast('Kies eerst een beeld.'); return; }
      R.api('/api/reis/gezelschap/beeld', { reis: huidig, bestand: keuze.value, tekst: $('#samenTekst').value })
        .then(function (uit) {
          $('#samenTekst').value = '';
          R.toast('Gedeeld met ' + uit.gedeeldMet + ' ' + (uit.gedeeldMet === 1 ? 'persoon' : 'mensen') + '.');
          laad();
        })
        .catch(function (e) { R.toast(e.message); });
    });

    /* Pas laden als het blad in beeld komt: een gezelschap ophalen dat niemand
       bekijkt is verkeer zonder lezer. */
    R.$$('[data-tab="samen"]').forEach(function (knop) {
      knop.addEventListener('click', function () { laad(); });
    });
    if ((w.location.hash || '').indexOf('samen') === 1) laad();
  });
})(window, document);

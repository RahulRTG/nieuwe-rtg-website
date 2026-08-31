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

  function tekenLeden(uit) {
    var vak = $('#samenLeden'); if (!vak) return;
    /* UITNODIGEN DOET DE EIGENAAR. De server weigert het al voor een ander
       (404), maar een formulier dat zichtbaar is en dan afketst, is een
       verhindering zonder reden -- GRAMMATICA.md par. 4. Wie niet mag, ziet
       hier waarom in plaats van een knop. */
    var vorm = $('#samenNodig');
    if (vorm) {
      var eigenaar = uit.rol === 'eigenaar';
      vorm.hidden = !eigenaar;
      var noot = $('#samenNodigNoot');
      if (noot) noot.hidden = eigenaar;
    }
    vak.textContent = '';
    var rij = uit.leden || [];
    if (!rij.length) { leeg(vak, 'Nog niemand. Nodig uw reisgenoot of familie uit.'); return; }
    rij.forEach(function (l) {
      var regel = maak('div', 'gezellid');
      regel.appendChild(maak('span', 'pionrond klein', (l.codenaam || '?').slice(0, 2).toUpperCase()));
      var midden = maak('span', 'gezelnaam');
      midden.appendChild(maak('b', '', l.codenaam));
      midden.appendChild(maak('small', '', l.stand === 'gevraagd' ? 'uitnodiging staat open' : 'in het gezelschap'));
      regel.appendChild(midden);
      regel.appendChild(maak('em', 'rolpil', l.rol.toUpperCase()));
      if (uit.rol === 'eigenaar') {
        var weg = maak('button', 'tekstknop', 'HAAL WEG');
        weg.type = 'button';
        weg.addEventListener('click', function () {
          R.api('/api/reis/gezelschap/weg', { id: l.id })
            .then(function () { R.toast('Weggehaald. Deze persoon ziet niets meer van deze reis.'); laad(); })
            .catch(function (e) { R.toast(e.message); });
        });
        regel.appendChild(weg);
      }
      vak.appendChild(regel);
    });
  }

  function tekenTijdlijn(uit) {
    var vak = $('#samenTijdlijn'); if (!vak) return;
    vak.textContent = '';
    var rij = uit.posts || [];
    if (!rij.length) { leeg(vak, 'Nog niets gedeeld. Wat u hier schrijft, leest het hele gezelschap.'); return; }
    rij.forEach(function (p) {
      var post = maak('article', 'gezelpost');
      post.appendChild(maak('span', 'pionrond klein', (p.van || '?').slice(0, 2).toUpperCase()));
      var body = maak('div');
      var kop = maak('div', 'gezelkop');
      kop.appendChild(maak('b', '', p.van));
      kop.appendChild(maak('small', '', tijd(p.at) + ' · ' + p.rol));
      body.appendChild(kop);
      body.appendChild(maak('p', '', p.tekst));
      post.appendChild(body);
      vak.appendChild(post);
    });
  }

  /* WAT DEZE LEZER VAN DE REIS ZIET -- rechtstreeks uit de poort, inclusief
     wat er NIET in zit. Dit scherm rekent daar niets bij en niets af. */
  function tekenZicht(uit) {
    var vak = $('#samenZicht'); if (!vak || !uit || !uit.reis) return;
    var reis = uit.reis;
    vak.textContent = '';
    vak.appendChild(maak('b', '', reis.bestemming + ' · ' + reis.venster.van + ' t/m ' + reis.venster.tot));
    vak.appendChild(maak('small', '', 'U kijkt hier als ' + reis.rol + (uit.van ? ', op de reis van ' + uit.van : '') + '.'));
    if ((reis.nietZichtbaar || []).length) {
      vak.appendChild(maak('small', 'nietzicht', 'Niet zichtbaar voor deze rol: ' + reis.nietZichtbaar.join(', ') + '.'));
    }
  }

  /* WAT U DEELT -- alleen voor de reiziger zelf, want alleen hij kan het zetten.
     Wat er NIET bestaat komt van de server mee en staat er even groot bij: een
     ontbrekende schakelaar leest anders als een functie die nog moet komen. */
  function tekenDelen(uit) {
    var kaart = $('#samenDelenKaart'), vak = $('#samenDelen');
    if (!kaart || !vak) return;
    if (!uit || uit.error) { kaart.hidden = true; return; }
    kaart.hidden = false;
    vak.textContent = '';
    var b = uit.beleid || {};
    Object.keys(b).forEach(function (veld) {
      var regel = maak('div', 'deelregel');
      var label = maak('span', 'gezelnaam');
      label.appendChild(maak('b', '', veld === 'aankomst' ? 'Aankomst melden' : veld));
      label.appendChild(maak('small', '', veld === 'aankomst'
        ? 'Meekijkers zien dat u er bent. Wie meereist ziet het altijd.' : ''));
      regel.appendChild(label);
      var knop = maak('button', 'schakel' + (b[veld] ? ' aan' : ''), b[veld] ? 'AAN' : 'UIT');
      knop.type = 'button';
      knop.setAttribute('aria-pressed', b[veld] ? 'true' : 'false');
      knop.addEventListener('click', function () {
        R.api('/api/reis/gezelschap/beleid/zet', { reis: huidig, veld: veld, aan: !b[veld] })
          .then(function () { laad(); })
          .catch(function (e) { R.toast(e.message); });
      });
      regel.appendChild(knop);
      vak.appendChild(regel);
    });
    (uit.bestaatNiet || []).forEach(function (x) {
      var regel = maak('div', 'deelregel');
      var label = maak('span', 'gezelnaam');
      label.appendChild(maak('b', '', x.naam.charAt(0).toUpperCase() + x.naam.slice(1)));
      label.appendChild(maak('small', '', x.reden));
      regel.appendChild(label);
      regel.appendChild(maak('em', 'rolpil', 'BESTAAT NIET'));
      vak.appendChild(regel);
    });
  }

  function tekenKring(uit) {
    var vak = $('#samenKring'); if (!vak) return;
    vak.textContent = '';
    var rij = (uit.gevraagd || []);
    if (!rij.length) { leeg(vak, 'Geen openstaande uitnodigingen.'); return; }
    rij.forEach(function (v) {
      var regel = maak('div', 'gezellid');
      var midden = maak('span', 'gezelnaam');
      midden.appendChild(maak('b', '', v.van || 'Een lid'));
      midden.appendChild(maak('small', '', 'vraagt u mee als ' + v.rol));
      regel.appendChild(midden);
      ['Aanvaarden', 'Nee'].forEach(function (woord, i) {
        var knop = maak('button', i ? 'tekstknop' : 'rtg-knop vol', woord);
        knop.type = 'button';
        knop.addEventListener('click', function () {
          R.api('/api/reis/gezelschap/antwoord', { id: v.id, ja: i === 0 })
            .then(function () { R.toast(i === 0 ? 'U hoort nu bij deze reis.' : 'Afgewezen.'); laad(); })
            .catch(function (e) { R.toast(e.message); });
        });
        regel.appendChild(knop);
      });
      vak.appendChild(regel);
    });
  }

  function laad() {
    if (!R.token) return;
    var kring = R.api('/api/reis/gezelschap/kring', {})
      .then(function (uit) { tekenKring(uit); return uit; })
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
      R.api('/api/reis/gezelschap', { reis: huidig }).then(tekenLeden).catch(function () {});
      R.api('/api/reis/gezelschap/tijdlijn', { reis: huidig }).then(tekenTijdlijn).catch(function () {});
      R.api('/api/reis/gezelschap/reis', { reis: huidig }).then(tekenZicht).catch(function () {});
      if (vanMij) {
        R.api('/api/reis/gezelschap/beleid', { reis: huidig })
          .then(tekenDelen)
          .catch(function () { tekenDelen(null); });
      } else tekenDelen(null);
    }).catch(function () {});
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

    /* Pas laden als het blad in beeld komt: een gezelschap ophalen dat niemand
       bekijkt is verkeer zonder lezer. */
    R.$$('[data-tab="samen"]').forEach(function (knop) {
      knop.addEventListener('click', function () { laad(); });
    });
    if ((w.location.hash || '').indexOf('samen') === 1) laad();
  });
})(window, document);

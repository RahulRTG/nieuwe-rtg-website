/* HET BLAD SAMEN, deel twee: WAT ER GEDEELD WORDT.

   Deel een (./reizen-samen.js) tekent wie er bij de reis hoort en wie er nog
   gevraagd is. Dit bestand tekent wat er gedeeld wordt: de tijdlijn met haar
   berichten en beelden, de kaart "wat u deelt", en de kiezer die een beeld uit
   de kluis haalt. Dezelfde naad als op de server (kern/reisgezelschap-delen.js),
   zodat wie het ene bestand openslaat weet waar hij het andere moet zoeken.

   De regels staan ook hier niet: wat een lezer mag zien bepaalt de poort op de
   server, en dit bestand toont alleen wat zij teruggeeft -- inclusief wat een
   rol NIET ziet. */
(function (w, d) {
  'use strict';
  var R = w.RTGReizen; if (!R) return;
  var $ = R.$, maak = R.maak;

  function tijd(iso) {
    var t = new Date(String(iso || ''));
    return isNaN(t.getTime()) ? '' : t.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }
  function leeg(vak, tekst) { vak.textContent = ''; vak.appendChild(maak('p', 'leegtekst', tekst)); }

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
      if (p.tekst) body.appendChild(maak('p', '', p.tekst));
      if (p.soort === 'beeld') {
        /* De bytes staan in de kluis van de reiziger en komen daar vandaan --
           met de sessie van de LEZER, zodat de kluis zelf beslist of hij ze
           krijgt. Dit scherm bewaart geen kopie en kent geen adres. */
        var beeld = maak('div', 'postbeeld');
        beeld.appendChild(maak('small', '', 'Beeld uit de kluis van ' + p.van));
        body.appendChild(beeld);
        R.api('/api/bestanden/haal', { id: p.bestand }).then(function (uit) {
          if (!uit || !uit.dataUrl) return;
          var img = d.createElement('img');
          img.src = uit.dataUrl; img.alt = p.tekst || 'Gedeeld beeld';
          img.loading = 'lazy';
          beeld.textContent = ''; beeld.appendChild(img);
        }).catch(function () {
          /* Niet zwijgen als het niet lukt: een leeg vlak leest als "er is
             niets", en er is wel iets -- u mag er alleen niet bij. */
          beeld.textContent = 'Dit beeld is niet (meer) met u gedeeld.';
        });
      }
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

  /* DE BEELDKIEZER. Alleen voor de reiziger, en alleen met wat er al IN zijn
     kluis staat: hier komt geen tweede uploadweg bij, want dat zou een tweede
     quotum, een tweede virusscan en een tweede plek zijn waar bytes landen. */
  function vulBeelden(vanMij) {
    var balk = $('#samenBeeldBalk'), keuze = $('#samenBeeld');
    if (!balk || !keuze) return;
    if (!vanMij) { balk.hidden = true; return; }
    R.api('/api/bestanden/mijn', {}).then(function (uit) {
      var beelden = (uit.items || []).filter(function (x) {
        return !x.weg && /^image\//.test(String(x.mime || ''));
      });
      keuze.textContent = '';
      if (!beelden.length) {
        balk.hidden = false;
        keuze.appendChild(maak('option', '', 'Nog geen beeld in uw kluis'));
        keuze.disabled = true; $('#samenDeelBeeld').disabled = true;
        return;
      }
      keuze.disabled = false; $('#samenDeelBeeld').disabled = false;
      beelden.forEach(function (b) {
        var optie = maak('option', '', b.naam);
        optie.value = b.id; keuze.appendChild(optie);
      });
      balk.hidden = false;
    }).catch(function () { balk.hidden = true; });
  }

  /* Deel een roept deze drie aan; ze staan op RTGSamenDelen zodat er geen
     tweede kopie van de tekenlogica ontstaat. */
  w.RTGSamenDelen = { tekenTijdlijn: tekenTijdlijn, tekenZicht: tekenZicht,
    tekenDelen: tekenDelen, vulBeelden: vulBeelden };
})(window, document);

/* De Zaal: waar het te horen is.

   Dit is het sociale deel van RTG Klankwerk, en het is met opzet KLEIN. Wat er
   is: luisteren, "mooi" zeggen, en er iets bij schrijven. Wat er niet is, en
   ook niet komt:

   - een hitlijst of een teller "meest beluisterd van de week". Dezelfde
     ranglijst die Genootschap, De Salon en de RTMAIL-teams al weigerden: zodra
     er een volgorde op populariteit staat, gaan mensen daarvoor maken in plaats
     van voor de muziek;
   - oneindig scrollen. De zaal heeft een BODEM, en die staat er ook;
   - een aanbevolen volgorde. Wie bovenaan staat, staat daar omdat hij de
     laatste was, en dat zegt het scherm er hardop bij.

   Wat er WEL uitgesproken staat: onder wiens naam iets uitkomt. De RTG-naam
   staat er alleen als een mens bij het kantoor dat besloten heeft; in alle
   andere gevallen staat er de codenaam van de maker. En de makers staan er
   allemaal bij, met hun rol -- niemand verdwijnt uit de aftiteling. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) { TOKEN = null; }
  var filter = 'alles', speelt = null, stand = null;

  function api(pad, body) {
    return fetch('/api/muziek/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json().catch(function () { return {}; }); });
  }
  var meldTimer = null;
  function zeg(t) {
    var m = $('#melding'); m.textContent = t; m.classList.add('zie');
    clearTimeout(meldTimer); meldTimer = setTimeout(function () { m.classList.remove('zie'); }, 2600);
  }
  function el(soort, klasse, wat) {
    var e = document.createElement(soort);
    if (klasse) e.className = klasse;
    if (wat != null) e.textContent = wat;
    return e;
  }
  function knop(naam, klasse, doe) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'knop' + (klasse ? ' ' + klasse : '');
    b.textContent = naam;
    b.addEventListener('click', doe);
    return b;
  }

  if (!TOKEN) {
    $('#zaal').innerHTML = '<div class="kaart"><h2>Log eerst in</h2>' +
      '<p class="stil" style="margin-top:0.5rem;">Open de RTG-app en log in; daarna hoort u wat er staat.</p></div>';
    return;
  }

  function haal() {
    api('zaal', { alleenRtg: filter === 'rtg', vanMij: filter === 'mij' }).then(teken);
  }
  function teken(d) {
    stand = d;
    var vlak = $('#zaal');
    vlak.textContent = '';
    if (d.error) { vlak.appendChild(el('p', 'stil', d.error)); return; }
    var rij = d.uitgaven || [];
    if (!rij.length) {
      vlak.appendChild(el('p', 'stil', filter === 'mij'
        ? 'U heeft nog niets uitgegeven. Maak iets in de studio en noem het klaar.'
        : 'Er staat nog niets. Wie het eerst iets uitgeeft, staat hier als eerste.'));
      return;
    }
    rij.forEach(function (u) { vlak.appendChild(kaart(u)); });
    // De bodem hoort er te staan. Een lijst zonder einde is een lijst waarvan je
    // niet weet of je alles gezien hebt.
    vlak.appendChild(el('p', 'bodem', d.einde));
    vlak.appendChild(el('p', 'stil', d.uitleg));
  }

  /* Meenemen (shared/uitvoer.js). De zaal is een lijst, en een lijst hoort mee
     te kunnen: wat hier staat is wat er op het scherm staat, met dezelfde
     filterkeuze. Velden uit het model, niet uit de kaart -- de datum als
     YYYY-MM-DD, en verder alleen wat de kaart zelf al toont. Namen blijven
     codenamen, precies zoals de zaal ze laat zien. */
  if (window.RTGUitvoer) RTGUitvoer.bron(function () {
    if (!stand) return null;
    return {
      naam: 'zaal',
      kolommen: ['naam', 'onder', 'slagen', 'maten', 'mooi', 'reacties', 'makers', 'datum'],
      rijen: (stand.uitgaven || []).map(function (u) {
        return [u.naam, u.naamOnder, u.bpm, u.maten, u.mooi, u.reacties,
          (u.makers || []).map(function (m) { return m.codenaam + ' (' + m.rol + ')'; }).join(', '),
          String(u.at || '').slice(0, 10)];
      })
    };
  });

  function kaart(u) {
    var k = el('div', 'kaart');
    k.appendChild(el('h2', null, u.naam));
    var onder = el('p', 'onder');
    onder.appendChild(document.createTextNode('Onder '));
    onder.appendChild(el('span', u.onder === 'rtg' ? 'rtg' : null, u.naamOnder));
    k.appendChild(onder);
    k.appendChild(el('p', 'meta', u.bpm + ' slagen · ' + u.maten + ' maten · ' +
      new Date(u.at).toLocaleDateString('nl-NL')));
    if (u.toelichting) k.appendChild(el('p', 'stil', u.toelichting));

    // De aftiteling. Wie meewerkte staat erbij, met de rol die hij zelf koos.
    if ((u.makers || []).length) {
      var cr = el('div', 'credits');
      u.makers.forEach(function (m) {
        var c = el('span', 'credit');
        c.appendChild(el('b', null, m.codenaam));
        c.appendChild(document.createTextNode(' ' + m.rol));
        cr.appendChild(c);
      });
      k.appendChild(cr);
    }

    var rij = el('div', 'rij');
    rij.style.marginTop = '.7rem';
    rij.appendChild(knop('Luister', 'vol', function () { luister(u.id); }));
    var mooi = knop((u.ikVindHem ? 'Mooi (u ook)' : 'Mooi') + ' · ' + u.mooi, u.ikVindHem ? 'aan' : null,
      function () {
        api('uitgave/mooi', { id: u.id, aan: !u.ikVindHem }).then(function (d) {
          if (d.error) return zeg(d.error);
          u.ikVindHem = d.ikVindHem; u.mooi = d.mooi;
          mooi.textContent = (u.ikVindHem ? 'Mooi (u ook)' : 'Mooi') + ' · ' + u.mooi;
          mooi.className = 'knop' + (u.ikVindHem ? ' aan' : '');
        });
      });
    rij.appendChild(mooi);
    rij.appendChild(knop('Reacties · ' + u.reacties, null, function () { reacties(k, u); }));
    k.appendChild(rij);
    return k;
  }

  /* Luisteren = de getallen ophalen en ze op dit toestel laten klinken. Er komt
     geen audiobestand over de lijn; wat u hoort rekent uw eigen telefoon uit,
     met dezelfde motor waarmee de maker het hoorde. */
  function luister(id) {
    stop();
    api('uitgave', { id: id }).then(function (d) {
      if (d.error) return zeg(d.error);
      var u = d.uitgave;
      speelt = u.id;
      window.RTGStudioMotor.speel({ bpm: u.bpm, maten: u.maten, stappen: u.stappen,
        kanalen: u.kanalen }, { lus: false });
      zeg('Speelt: ' + u.naam + '.');
    });
  }
  function stop() {
    if (window.RTGStudioMotor) window.RTGStudioMotor.stop();
    speelt = null;
  }
  $('#stopKnop').addEventListener('click', stop);

  function reacties(kaartEl, u) {
    var oud = kaartEl.querySelector('.reacties');
    if (oud) { oud.remove(); return; }
    var doos = el('div', 'reacties');
    doos.style.marginTop = '.7rem';
    api('uitgave/reacties', { id: u.id }).then(function (d) {
      (d.reacties || []).forEach(function (r) {
        var e = el('div', 'reactie');
        e.appendChild(el('div', 'wie', r.codenaam));
        e.appendChild(document.createTextNode(r.tekst));
        doos.appendChild(e);
      });
      var schrijf = el('div', 'rij');
      schrijf.style.marginTop = '.6rem';
      var veld = document.createElement('input');
      veld.className = 'veld'; veld.maxLength = 300; veld.style.flex = '1'; veld.style.minWidth = '9rem';
      veld.setAttribute('aria-label', 'Uw reactie op ' + u.naam);
      veld.placeholder = 'Zeg er iets over';
      schrijf.appendChild(veld);
      schrijf.appendChild(knop('Plaatsen', null, function () {
        if (!veld.value.trim()) return;
        api('uitgave/reageer', { id: u.id, tekst: veld.value }).then(function (r) {
          if (r.error) return zeg(r.error);
          var e = el('div', 'reactie');
          e.appendChild(el('div', 'wie', r.reactie.codenaam));
          e.appendChild(document.createTextNode(r.reactie.tekst));
          doos.insertBefore(e, schrijf);
          veld.value = '';
        });
      }));
      doos.appendChild(schrijf);
    });
    kaartEl.appendChild(doos);
  }

  [['#fAlles', 'alles'], ['#fRtg', 'rtg'], ['#fMij', 'mij']].forEach(function (p) {
    $(p[0]).addEventListener('click', function () {
      filter = p[1];
      ['#fAlles', '#fRtg', '#fMij'].forEach(function (s) { $(s).classList.remove('aan'); });
      $(p[0]).classList.add('aan');
      haal();
    });
  });

  haal();
})();

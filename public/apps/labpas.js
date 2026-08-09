/* Mijn Living Lab: het scherm van de bewoner-medeonderzoeker.

   DE POORT IS EEN LABPAS EN GEEN ACCOUNT. Dat is geen gemak maar het ontwerp:
   een Living Lab waarin je een account moet aanmaken om mee te doen aan
   onderzoek in je eigen straat, verliest precies de mensen om wie het gaat. De
   pas bepaalt bovendien WIE je bent -- deze app stuurt nooit een alias mee, want
   die staat in het teambeeld en bewijst dus niets (server weigert hem ook).

   WAT DIT SCHERM BEWUST NIET DOET: punten tellen voor het insturen van veel.
   Er staat geen teller "aantal observaties" en geen ranglijst op volume. Wat er
   wel staat is het labpaspoort met de badges die je verdient door een bron na te
   trekken, iemand te spreken, een fout vast te leggen of een eerdere conclusie
   te herzien. Zie server/kern/livinglab/spel.js voor waarom dat zo is. */
(function () {
  'use strict';
  var PAS = '', KADER = null, LABS = [], LAB = null;

  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* De bewonersdeuren dragen geen token; ze hebben een rem per bron en (waar er
     een code is) per code. Een 429 hoort daarom een begrijpelijke zin te geven
     en niet "er ging iets mis": dit is de enige app in huis waar een gebruiker
     zonder account tegen een rem kan lopen. */
  function api(pad, body) {
    return fetch('/api/lab2/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || (r.status === 429
          ? 'Even rustig aan: te veel verzoeken achter elkaar. Probeer het over een minuut opnieuw.'
          : 'Er ging iets mis.'));
        return d;
      });
    });
  }
  var meld = function (t) { if (window.RTGWauw && RTGWauw.melding) RTGWauw.melding(t); else alert(t); };

  function route(huidig) {
    var ix = KADER.cyclus.map(function (c) { return c.stap; }).indexOf(huidig);
    return KADER.cyclus.map(function (c, i) {
      var kl = i < ix ? ' af' : (i === ix ? ' nu' : '');
      return '<div class="stap' + kl + '"><span class="bol">' + (i < ix ? '&#10003;' : (i + 1)) + '</span>' +
        '<span class="nm">' + esc(c.naam) + '</span>' +
        (i < KADER.cyclus.length - 1 ? '<span class="lijn"></span>' : '') + '</div>';
    }).join('');
  }

  /* ---------- mijn onderzoek ---------- */
  function openPas(pas) {
    return api('mijn', { pas: pas }).then(function (d) {
      PAS = pas;
      try { sessionStorage.setItem('rtg_labpas', pas); } catch (e) {}
      teken(d);
      $('#poort').hidden = true;
      $('#mijn').hidden = false;
      $('#pasFout').textContent = '';
    }).catch(function (e) { $('#pasFout').textContent = e.message; });
  }

  function teken(d) {
    var s = d.studie, ik = d.ik, nu = d.watNu;
    $('#kop').textContent = s.titel;

    $('#uitdaging').innerHTML = '<div class="sec">De uitdaging</div><h2>' + esc(s.titel) + '</h2>' +
      '<div class="vraag">' + esc(s.vraagstuk || 'Dit onderzoek houdt zijn vraagstelling besloten om de deelnemers te beschermen.') + '</div>' +
      '<div class="leeg" style="margin-top:.5rem;">U doet mee als ' + esc(rolNaam(d.rol)) + ', onder de naam ' + esc(d.alias) + '.</div>';

    $('#route').innerHTML = route(s.stap);

    $('#watnu').innerHTML = '<div class="sec">Waar staan we</div>' +
      (nu.volgende
        ? '<div class="leeg">Volgende stap: <b>' + esc(nu.volgendeNaam || nu.volgende) + '</b>.' +
            (nu.klaar ? ' Alles wat daarvoor nodig is, is er.' : '') + '</div>' +
          (nu.gebreken.length ? '<div class="leeg">Er moet nog: ' + nu.gebreken.map(esc).join(' &middot; ') + '</div>' : '')
        : '<div class="leeg">Dit onderzoek heeft de hele cyclus doorlopen.</div>');

    var nvVolgend = ik.niveau < 5;
    $('#paspoort').innerHTML = '<div class="sec">Uw labpaspoort</div>' +
      '<div class="pas"><div class="nv">' + ik.punten + '</div>' +
        '<div><div style="font-weight:600;">' + esc(ik.niveauNaam) + '</div>' +
        '<div class="leeg" style="padding:0;">niveau ' + ik.niveau + (nvVolgend ? ' van 5' : ' &middot; hoogste niveau') + '</div></div></div>' +
      (ik.badges.length
        ? '<div style="margin-top:.5rem;">' + ik.badges.map(function (b) {
            return '<span class="badge" title="' + esc(b.uitleg) + '">' + esc(b.naam) + '</span>';
          }).join('') + '</div>'
        : '<div class="leeg">Nog geen badges. Ze komen niet van veel insturen, maar van goed werk: een bron natrekken, iemand echt spreken, een fout vastleggen, een conclusie herzien.</div>');

    $('#bijdrage').innerHTML = '<div class="sec">Uw bijdrage</div>' +
      '<div class="leeg">Wat heeft u gezien?</div>' +
      '<div class="rij"><input class="veld" id="obsVeld" placeholder="Bijv. Om 8 uur stond er weer water op de hoek" maxlength="500"></div>' +
      '<div class="rij" style="margin-top:.4rem;"><select class="veld" id="obsM" aria-label="Hoe heeft u dit vastgesteld?">' +
        '<option value="">hoe vastgesteld?</option>' +
        KADER.methoden.map(function (m) { return '<option value="' + esc(m.methode) + '">' + esc(m.naam) + '</option>'; }).join('') +
      '</select><button class="knop" id="obsStuur" type="button">Stuur in</button></div>' +
      '<div class="leeg" style="margin-top:.7rem;">Ging er iets mis, of klopte iets niet wat we eerder dachten? Dat is hier het waardevolst.</div>' +
      '<div class="rij"><select class="veld" id="refS" aria-label="Soort">' +
        KADER.reflectiesoorten.map(function (r) { return '<option value="' + esc(r) + '">' + esc(r) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="rij" style="margin-top:.4rem;"><input class="veld" id="refT" placeholder="Wat viel tegen, ging mis of was onverwacht?" maxlength="600">' +
        '<button class="knop stil" id="refStuur" type="button">Leg vast</button></div>';

    $('#mijnTaken').innerHTML = '<div class="sec">Voor u</div>' +
      (ik.taken.length
        ? ik.taken.map(function (t) {
            return '<div class="log">' + esc(t.tekst) + (t.deadline ? ' &middot; voor ' + esc(t.deadline) : '') + '</div>';
          }).join('')
        : '<div class="leeg">Er staat nu niets voor u open.</div>');

    $('#uitstap').innerHTML = '<div class="sec">Stoppen</div>' +
      '<div class="leeg">U kunt altijd stoppen. Uw observaties worden dan gewist. Dat hoeft u aan niemand uit te leggen.</div>' +
      '<button class="knop stil" id="stopKnop" type="button">Ik trek me terug uit dit onderzoek</button>';

    bind();
  }

  function rolNaam(r) {
    var x = (KADER.rollen || []).filter(function (y) { return y.rol === r; })[0];
    return x ? x.naam : r;
  }

  function ververs() { return api('mijn', { pas: PAS }).then(teken); }

  function bind() {
    $('#obsStuur').addEventListener('click', function () {
      api('mijn/observatie', { pas: PAS, wat: $('#obsVeld').value, methode: $('#obsM').value })
        .then(function () { meld('Vastgelegd. Dank u.'); return ververs(); })
        .catch(function (e) { meld(e.message); });
    });
    $('#refStuur').addEventListener('click', function () {
      api('mijn/reflectie', { pas: PAS, soort: $('#refS').value, tekst: $('#refT').value })
        .then(function () { meld('Vastgelegd. Dit telt hier zwaar mee.'); return ververs(); })
        .catch(function (e) { meld(e.message); });
    });
    $('#stopKnop').addEventListener('click', function () {
      if (!confirm('Weet u het zeker? Uw observaties worden gewist en dit kan niet ongedaan worden gemaakt.')) return;
      api('mijn/terugtrekken', { pas: PAS }).then(function () {
        try { sessionStorage.removeItem('rtg_labpas'); } catch (e) {}
        $('#mijn').hidden = true; $('#poort').hidden = false;
        $('#kop').textContent = 'Mijn onderzoek';
        meld('U bent uit het onderzoek gehaald en uw observaties zijn gewist.');
      }).catch(function (e) { meld(e.message); });
    });
  }

  /* ---------- starten ---------- */
  api('bewoner/kader').then(function (k) {
    KADER = k;
    return api('bewoner/labs');
  }).then(function (d) {
    LABS = d.labs || [];
    LAB = LABS.length ? LABS[0].id : null;
    $('#bLab').innerHTML = LABS.map(function (l) {
      return '<option value="' + esc(l.id) + '">' + esc(l.stad) + '</option>';
    }).join('') || '<option value="">nog geen lab</option>';
    // de buurtkant krijgt hetzelfde gereedschap mee in plaats van een eigen kopie
    window.LabpasBuurt.init({ api: api, esc: esc, meld: meld });
    window.LabpasBuurt.zetLab(LAB);
    window.LabpasOntdek.init({ api: api, esc: esc, meld: meld, kader: KADER });
    window.LabpasOntdek.zetLab(LAB);
    window.LabpasOntdek.bind();
    $('#bLab').addEventListener('change', function () {
      LAB = $('#bLab').value;
      window.LabpasBuurt.zetLab(LAB);
      window.LabpasBuurt.laadThemas();
      window.LabpasOntdek.zetLab(LAB);
      window.LabpasOntdek.laadOnderzoek();
    });
    return Promise.all([window.LabpasBuurt.laadThemas(), window.LabpasOntdek.laadOnderzoek()]);
  }).catch(function (e) { $('#pasFout').textContent = e.message; });

  $('#pasOpen').addEventListener('click', function () { openPas($('#pasVeld').value.trim().toUpperCase()); });
  $('#pasVeld').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#pasOpen').click(); });
  $('#bStuur').addEventListener('click', function () {
    window.LabpasBuurt.stuurVraag($('#bVraag').value)
      .then(function () { $('#bVraag').value = ''; meld('Uw vraag staat er. Buurtgenoten kunnen er nu op stemmen.'); })
      .catch(function (e) { meld(e.message); });
  });

  // wie zijn pas deze sessie al invulde, hoeft hem niet opnieuw te typen
  try {
    var bewaard = sessionStorage.getItem('rtg_labpas');
    if (bewaard) openPas(bewaard);
  } catch (e) {}
})();

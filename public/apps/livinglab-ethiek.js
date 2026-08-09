/* RTF Living Lab, scherm deel 5: de ethieklaag.

   DIT BESTAND BESTAAT OMDAT DE APP ZONDER HEM DOODLIEP. De poort naar de stap
   `deelnemers` noemt vijf dingen die moeten gebeuren -- risicoklasse, review,
   privacytoets, toestemming, stopcriterium -- en er stond geen enkele knop in
   het scherm om ook maar één daarvan te doen. Een poort die vertelt wat er moet
   gebeuren zonder de weg te bieden, is erger dan geen poort: hij ziet eruit als
   zorgvuldigheid en werkt als een muur.

   DE TEKENAAR KOMT UIT EEN LIJST, niet uit een tekstveld: de server toetst de
   naam tegen het tekenaarsregister van het lab. Is dat register leeg, dan zegt
   dit scherm dát -- met de weg ernaartoe.

   De deelnemers staan in ./livinglab-mensen.js, het INGRIJPEN (stilleggen,
   klachten afhandelen) in ./livinglab-toezicht.js: dat gaat over een lopend
   onderzoek en niet over de waarborgen die je vooraf invult. */
(function () {
  'use strict';
  var api, KADER, esc, meld, huidigLab;

  function init(o) {
    api = o.api; KADER = o.kader; esc = o.esc; meld = o.meld; huidigLab = o.huidigLab;
  }

  /* De keuzelijst zet de HUIDIGE waarde als geselecteerd. Zonder dat staat een
     select op zijn eerste optie, en dan is "Klasse vaststellen" zonder de lijst
     aan te raken een poging tot VERLAGEN -- terecht geweigerd, maar de gebruiker
     had niets gevraagd. */
  var opt = function (lijst, waarde, naam, nu) {
    return lijst.map(function (x) {
      return '<option value="' + esc(x[waarde]) + '"' + (x[waarde] === nu ? ' selected' : '') + '>' +
        esc(x[naam]) + '</option>';
    }).join('');
  };

  /* De tekenaars van dit lab, als keuzelijst. Leeg register = een eerlijke
     melding en geen keuzemenu waar niets in staat. */
  function tekenaarKeuze(rollen) {
    var lab = huidigLab() || {};
    var lijst = (lab.tekenaars || []).filter(function (t) { return !rollen || rollen.indexOf(t.rol) >= 0; });
    if (!lijst.length) return null;
    return lijst.map(function (t) {
      return '<option value="' + esc(t.naam) + '">' + esc(t.naam) + ' (' + esc(t.rol) +
        (t.onafhankelijk ? ', onafhankelijk' : '') + ')</option>';
    }).join('');
  }
  var GEEN_TEKENAAR = '<div class="leeg">Dit lab heeft nog geen tekenbevoegden. Zet ze neer bij ' +
    '<b>Labbeheer</b>; zonder tekenaar kan hier niets ondertekend worden, en dat is met opzet.</div>';

  /* Vijf onderdelen, in de volgorde waarin de poort ze vraagt. De klasse staat
     bovenaan, want die bepaalt wat de rest moet zijn. */
  function ethiekBlok(s) {
    var e = s.ethiek || {}, kl = (KADER.risico.filter(function (r) { return r.klasse === e.klasse; })[0]) || {};
    var tek = tekenaarKeuze();
    var review = (e.review || []);
    return '<div class="kaart">' +
      '<div class="sec">Ethiek en waarborgen</div>' +
      '<div class="leeg">Klasse <b>' + esc(kl.naam || e.klasse) + '</b>: ' + esc(kl.uitleg || '') +
        (kl.tekenaars ? ' Deze klasse vraagt ' + kl.tekenaars + ' handtekening(en)' +
          (kl.tekenaars >= 2 ? ', waarvan minstens één onafhankelijk' : '') + '.' : '') + '</div>' +

      // 1. de klasse vaststellen
      '<div class="rij" style="margin-top:.5rem;">' +
        '<select class="veld" data-eklasse aria-label="Risicoklasse">' +
          opt(KADER.risico, 'klasse', 'naam', e.klasse) + '</select>' +
        (tek ? '<select class="veld" data-eklassedoor aria-label="Vastgesteld door">' + tek + '</select>' : '') +
        '<button class="knop stil" data-eklassezet type="button">' +
          (e.vastgesteld ? 'Klasse wijzigen' : 'Klasse vaststellen') + '</button></div>' +
      '<input class="veld" data-eklassereden placeholder="Reden (alleen nodig bij VERLAGEN)" maxlength="300" style="margin-top:.35rem;">' +
      (e.vastgesteld ? '' : '<div class="gebrek">De klasse is nog niet door een mens vastgesteld.</div>') +

      // 2. de ethische review
      (kl.review ? '<div class="sec" style="margin-top:.9rem;">Ethische review</div>' +
        (review.length ? review.map(function (r) {
          return '<div class="log"><b>' + esc(r.oordeel) + '</b> door ' + esc(r.door) +
            (r.onafhankelijk ? ' (onafhankelijk)' : '') + (r.notitie ? '<br>' + esc(r.notitie) : '') + '</div>';
        }).join('') : '<div class="leeg">Nog geen handtekening.</div>') +
        (tek ? '<div class="rij" style="margin-top:.35rem;">' +
          '<select class="veld" data-erdoor aria-label="Tekenaar">' + tek + '</select>' +
          '<select class="veld" data-eroordeel aria-label="Oordeel">' +
            '<option value="akkoord">akkoord</option><option value="voorwaarden">voorwaarden</option>' +
            '<option value="afgewezen">afgewezen</option></select></div>' +
          '<input class="veld" data-ernotitie placeholder="Toelichting (verplicht bij voorwaarden of afwijzing)" maxlength="500" style="margin-top:.35rem;">' +
          '<button class="knop stil" data-erzet type="button">Teken de review</button>'
          : GEEN_TEKENAAR) : '') +

      // 3. de privacytoets
      (kl.privacy ? '<div class="sec" style="margin-top:.9rem;">Privacytoets</div>' +
        (e.privacytoets
          ? '<div class="log">Uitgevoerd door ' + esc(e.privacytoets.door) + ' &middot; ' +
              (e.privacytoets.velden || []).length + ' velden<br>Bewust weggelaten: ' + esc(e.privacytoets.weggelaten) + '</div>'
          : '<div class="gebrek">De privacytoets ontbreekt.</div>') +
        '<input class="veld" data-pvelden placeholder="Welke gegevens verzamelt u? (komma\'s ertussen)" maxlength="600" style="margin-top:.35rem;">' +
        '<input class="veld" data-pgrond placeholder="Op welke grondslag?" maxlength="200" style="margin-top:.35rem;">' +
        '<input class="veld" data-pweg placeholder="Wat laat u bewust WEG? (dit veld is het punt)" maxlength="300" style="margin-top:.35rem;">' +
        (tek ? '<div class="rij" style="margin-top:.35rem;"><select class="veld" data-pdoor aria-label="Uitgevoerd door">' + tek + '</select>' +
          '<button class="knop stil" data-pzet type="button">Leg de privacytoets vast</button></div>' : GEEN_TEKENAAR)
        : '') +

      // 4. toestemming
      '<div class="sec" style="margin-top:.9rem;">Toestemming</div>' +
      '<div class="leeg">Nu: ' + esc((e.toestemming || {}).regime || 'geen') +
        ((e.toestemming || {}).ouderlijk ? ' &middot; met ouderlijke toestemming' : '') + '</div>' +
      '<div class="rij"><select class="veld" data-tregime aria-label="Toestemmingsregime">' +
        ['geen', 'mondeling', 'schriftelijk'].map(function (r) {
          return '<option value="' + r + '"' + ((e.toestemming || {}).regime === r ? ' selected' : '') + '>' + r + '</option>';
        }).join('') + '</select>' +
        '<label class="chip"><input type="checkbox" data-touder' +
          ((e.toestemming || {}).ouderlijk ? ' checked' : '') + '> ouderlijk</label></div>' +
      '<input class="veld" data-ttekst placeholder="Wat vertelt u de deelnemer precies?" maxlength="1000" style="margin-top:.35rem;">' +
      '<button class="knop stil" data-tzet type="button">Leg de toestemming vast</button>' +

      // 5. stopcriteria
      '<div class="sec" style="margin-top:.9rem;">Stopcriteria</div>' +
      ((e.stopcriteria || []).length
        ? (e.stopcriteria).map(function (c) { return '<div class="log">' + esc(c.tekst) + '</div>'; }).join('')
        : '<div class="gebrek">Er is geen enkel stopcriterium beschreven.</div>') +
      '<div class="rij" style="margin-top:.35rem;"><input class="veld" data-sctekst placeholder="Waarbij stopt dit onderzoek direct?" maxlength="300">' +
        '<button class="knop stil" data-sczet type="button">Voeg toe</button></div>' +

      '</div>';
  }

  /* ---------- de bedrading ---------- */
  function bind(el, s, doe) {
    var q = function (sel) { return el.querySelector(sel); };
    var w = function (sel) { return q(sel) ? q(sel).value : ''; };
    var aan = function (sel) { return !!(q(sel) && q(sel).checked); };

    if (q('[data-eklassezet]')) q('[data-eklassezet]').addEventListener('click', function () {
      doe(api('ethiek/klasse', { id: s.id, klasse: w('[data-eklasse]'), door: w('[data-eklassedoor]'), reden: w('[data-eklassereden]') }));
    });
    if (q('[data-erzet]')) q('[data-erzet]').addEventListener('click', function () {
      doe(api('ethiek/review', { id: s.id, door: w('[data-erdoor]'), oordeel: w('[data-eroordeel]'), notitie: w('[data-ernotitie]') }));
    });
    if (q('[data-pzet]')) q('[data-pzet]').addEventListener('click', function () {
      doe(api('ethiek/privacy', { id: s.id, velden: w('[data-pvelden]').split(',').map(function (x) { return x.trim(); }).filter(Boolean),
        grondslag: w('[data-pgrond]'), weggelaten: w('[data-pweg]'), door: w('[data-pdoor]') }));
    });
    if (q('[data-tzet]')) q('[data-tzet]').addEventListener('click', function () {
      doe(api('ethiek/toestemming', { id: s.id, regime: w('[data-tregime]'), ouderlijk: aan('[data-touder]'), tekst: w('[data-ttekst]') }));
    });
    if (q('[data-sczet]')) q('[data-sczet]').addEventListener('click', function () {
      doe(api('ethiek/stopcriterium', { id: s.id, tekst: w('[data-sctekst]') }));
    });

  }

  window.LivingLabEthiek = { init: init, ethiekBlok: ethiekBlok, bind: bind, tekenaarKeuze: tekenaarKeuze, GEEN_TEKENAAR: GEEN_TEKENAAR, opt: opt };
})();

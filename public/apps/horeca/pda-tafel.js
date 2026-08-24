/* RTG Horeca (scherm): DE TAFEL OP DE PDA -- ontvangen, opnemen, gangen sturen
   en afrekenen.

   Dit is de andere helft van PDA SERVICE. De werklijst (pda.js) zegt WAT er
   moet gebeuren; hier gebeurt het. Zonder deze helft was de PDA een slim
   dashboard met twee knoppen eraan; met deze helft is de keten dicht --
   ontvangen, opnemen, sturen, ophalen, oplossen, afrekenen.

   VIJF DINGEN DIE HIER VASTLIGGEN:

   1. DE PRIJS KOMT VAN DE KAART EN NIET VAN DIT SCHERM. Elke bestelling gaat
      als `itemId` naar de server, die naam, prijs en station uit de kaart van de
      zaak haalt (kern/horeca/kaart.js -- dezelfde kaart die de gast leest). Zou
      dit scherm de prijs meesturen, dan bepaalt een telefoon wat een biertje
      kost.
   2. UITVERKOCHT WORDT GETOOND EN NIET VERBORGEN. De gastdeur laat zulke items
      niet kiezen; de bediening hoort te zien dat iets op is en mag na overleg
      met de keuken alsnog aanslaan. Wegfilteren maakt van "op" een geheim.
   3. DE CONTEXT WORDT EEN KEER GEZET EN DAARNA GETIKT. Gang, stoel en allergie
      staan BOVEN de kaart, niet in een dialoog per gerecht. Wie voor elke tik
      drie schermen door moet, typt het straks op een blocnote -- en dan weet het
      systeem niets meer.
   4. EEN ALLERGIE IS EEN EIGEN VELD en gaat ongefilterd mee. Niet in een
      notitieveld, waar hij verdwijnt tussen "zonder ui" en "extra krokant".
   5. GANG VRIJGEVEN IS EEN APARTE HANDELING. De keuken ziet niets van een gang
      die de zaal niet heeft vrijgegeven; zo bepaalt de zaal het tempo van het
      diner en de keuken dat van de bereiding. Er wordt hier dus niets
      automatisch doorgestuurd.

   WAT HIER NIET STAAT: splitsen en verdelen. Dat is een gesprek aan tafel met
   meerdere mensen erbij, en dat hoort op het zaalscherm waar iedereen meekijkt
   -- niet op een telefoon in een broekzak. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  var esc = K.esc, euro = K.euro, api = K.api, meld = K.meld;
  var REK = null, KAART = null, KLAAR = function () {};
  /* DE KAART WORDT BEWAARD OP HET TOESTEL. Zonder lijn is er geen kaart, en
     zonder kaart kan er niets worden opgenomen -- dan is de offline-rij een
     vangnet onder een trapeze die er niet is. Hij wordt ververst zodra er wel
     een lijn is; wat er staat is dus hoogstens de kaart van vanochtend, en dat
     is oneindig veel beter dan niets. */
  var KAARTSLEUTEL = 'rtg_pda_kaart';
  try { KAART = JSON.parse(localStorage.getItem(KAARTSLEUTEL) || 'null'); } catch (e) {}

  function $(id) { return document.getElementById(id); }

  /* ---- de kaart, een keer opgehaald en daarna hertekend ---- */
  function tekenKaart() {
    if (!KAART) return;
    $('tKaart').innerHTML = KAART.map(function (g) {
      return '<div class="pda-cat">' + esc(g.cat) + '</div><div class="pda-items">' +
        g.items.map(function (i) {
          return '<button type="button" data-item="' + esc(i.id) + '"' +
            (i.uitverkocht ? ' class="uit"' : '') + '>' + esc(i.naam) +
            '<em>' + euro(i.centen) + (i.uitverkocht ? ' &middot; op' : '') +
            (i.alcohol ? ' &middot; alcohol' : '') + '</em></button>';
        }).join('') + '</div>';
    }).join('');
    K.bind($('tKaart'), 'item', bestel);
  }

  /* Een tik = een regel. De server bepaalt naam en prijs; dit scherm stuurt
     alleen WELK gerecht, VOOR WIE, in WELKE gang en met WELKE allergie. */
  function bestel(b) {
    var voor = $('tVoor').value;
    api('/rekening/regel', {
      rekeningId: REK.id, itemId: b.getAttribute('data-item'),
      aantal: 1, gang: Number($('tGang').value) || 0,
      gastNr: voor ? Number(voor) : undefined,
      allergie: $('tAllergie').value.trim() || undefined
    }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      meld(r.body.regel.naam + ' erop, ' + euro(r.body.regel.centen) + '.');
      haal();
    });
  }

  /* ---- de stoelen ---- */
  function tekenStoelen(gz) {
    var stoelen = (gz && gz.stoelen) || [];
    $('tStoelen').innerHTML = stoelen.length ? stoelen.map(function (s) {
      return '<div class="pda-stoel"><span>' + esc(s.handle || ('stoel ' + s.nr)) + '</span>' +
        (s.eigenSessie ? '<span class="pda-som">eigen telefoon</span>'
          : '<button class="knop" data-stoelweg="' + esc(s.nr) + '" aria-label="Haal ' +
            esc(s.handle || ('stoel ' + s.nr)) + ' weg">Weg</button>') + '</div>';
    }).join('') : '<p class="pda-som">Nog geen stoelen. Zonder stoel staat alles op de tafel.</p>';
    K.bind($('tStoelen'), 'stoelweg', function (b) {
      api('/gezelschap/stoel/weg', { rekeningId: REK.id, nr: b.getAttribute('data-stoelweg') })
        .then(function (r) { meld(r.body.error || r.body.let || 'Stoel weg.'); haal(); });
    });
    var kies = $('tVoor'), was = kies.value;
    kies.innerHTML = '<option value="">de tafel</option>' + stoelen.map(function (s) {
      return '<option value="' + s.nr + '">' + esc(s.handle || ('stoel ' + s.nr)) + '</option>';
    }).join('');
    kies.value = was;
  }

  /* ---- wat er op de rekening staat, per gang ---- */
  var STANDNAAM = { besteld: 'nog niet naar de keuken', gestart: 'in de keuken',
    bereid: 'in de keuken', klaar: 'klaar bij de pas', uitgegeven: 'uitgeserveerd' };

  function tekenRegels(rek) {
    var perGang = {};
    (rek.regels || []).forEach(function (x) {
      var g = String(x.gang || 0);
      (perGang[g] = perGang[g] || []).push(x);
    });
    var gangen = Object.keys(perGang).sort();
    $('tRegels').innerHTML = gangen.length ? gangen.map(function (g) {
      var rijen = perGang[g];
      var open = rijen.filter(function (x) { return !x.vrijAt; }).length;
      return '<div class="pda-taak"><div class="pda-kop"><span class="pda-tafel">' +
        (g === '0' ? 'Zonder gang' : 'Gang ' + esc(g)) + '</span></div>' +
        '<ul class="pda-borden">' + rijen.map(function (x) {
          return '<li><span>' + esc(x.aantal + 'x ' + x.naam) + '</span><em>' +
            esc(STANDNAAM[x.stand] || x.stand) + (x.allergie ? ' &middot; ' + esc(x.allergie) : '') + '</em>' +
            (x.stand === 'besteld' ? '<button class="knop" data-regelweg="' + esc(x.id) +
              '" aria-label="Haal ' + esc(x.naam) + ' van de rekening">Eraf</button>' : '') + '</li>';
        }).join('') + '</ul>' +
        (open ? '<div class="pda-acties"><button class="knop p" data-vrij="' + esc(g) + '">' +
          'Naar de keuken (' + open + ')</button></div>' : '') + '</div>';
    }).join('') : '<p class="pda-som">Nog niets besteld.</p>';

    K.bind($('tRegels'), 'regelweg', function (b) {
      api('/rekening/regel/weg', { rekeningId: REK.id, regelId: b.getAttribute('data-regelweg') })
        .then(function (r) { if (r.body.error) meld(r.body.error); haal(); });
    });
    K.bind($('tRegels'), 'vrij', function (b) {
      api('/gang/vrij', { rekeningId: REK.id, gang: b.getAttribute('data-vrij') }).then(function (r) {
        meld(r.body.error || (r.body.vrijgegeven + ' regel(s) naar de keuken.'));
        haal();
      });
    });
  }

  /* ---- afrekenen. Alleen het geheel, in een keer; wie moet splitsen doet dat
     op het zaalscherm (zie de kop). ---- */
  function tekenBetaal(rek) {
    var open = rek.openstaand;
    if (open <= 0) {
      $('tBetaal').innerHTML = '<p class="pda-som">Er staat niets meer open.</p>';
      return;
    }
    $('tBetaal').innerHTML = ['pin', 'contant'].map(function (w) {
      return '<button class="knop' + (w === 'pin' ? ' p' : '') + '" data-betaal="' + w + '">' +
        (w === 'pin' ? 'Pin' : 'Contant') + ' ' + euro(open) + '</button>';
    }).join('');
    K.bind($('tBetaal'), 'betaal', function (b) {
      api('/betaal', { rekeningId: REK.id, wijze: b.getAttribute('data-betaal') }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        meld(r.body.gesloten ? 'Betaald en gesloten.' : 'Nog open: ' + euro(r.body.openstaand));
        if (r.body.gesloten) { KLAAR(); return; }
        haal();
      });
    });
  }

  function haal() {
    return api('/rekening', { rekeningId: REK.id }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      var rek = r.body.rekening;
      REK = rek;
      $('tKop').textContent = (rek.tafel || rek.kanaal) + ' · ' + rek.gasten + ' gast(en)';
      $('tSom').textContent = 'Op de rekening ' + euro(rek.totalen.netto) +
        ', openstaand ' + euro(rek.openstaand) + '.';
      tekenRegels(rek);
      tekenBetaal(rek);
      return api('/gezelschap', { rekeningId: rek.id }).then(function (g) {
        tekenStoelen(g.body.gezelschap);
      });
    });
  }

  function bind() {
    $('tStoelBij').addEventListener('click', function () {
      api('/gezelschap/stoel', { rekeningId: REK.id, handle: $('tStoelNaam').value.trim() })
        .then(function (r) {
          if (r.body.error) return meld(r.body.error);
          $('tStoelNaam').value = '';
          meld(r.body.stoel.handle + ' zit aan tafel.');
          haal();
        });
    });
  }

  window.RTGPdaTafel = {
    // de bewaarde kaart, voor het opnemen zonder lijn (pda-lokaal.js)
    kaart: function () { return KAART; },
    /* `klaar` roept de werklijst terug: een betaalde tafel hoort niet als lege
       schil te blijven staan. */
    toon: function (rekeningId, klaar) {
      REK = { id: rekeningId };
      KLAAR = klaar || function () {};
      if (!window.RTGPdaTafel._gebonden) { window.RTGPdaTafel._gebonden = true; bind(); }
      /* Altijd proberen te verversen, ook als er al een kaart in het geheugen
         staat: een gerecht dat vanmiddag van de kaart ging, hoort vanavond niet
         meer aan te slaan. Lukt het niet, dan blijft de bewaarde kaart staan. */
      var eerst = api('/kaart', {}).then(function (r) {
        if (r.body.groepen) {
          KAART = r.body.groepen;
          try { localStorage.setItem(KAARTSLEUTEL, JSON.stringify(KAART)); } catch (e) {}
        }
        tekenKaart();
      }, function () { tekenKaart(); });
      return eerst.then(haal);
    },
    ververs: function () { if (REK) return haal(); }
  };
})();

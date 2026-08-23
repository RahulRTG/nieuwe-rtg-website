/* RTG Horeca (scherm): PDA SERVICE -- wat is mijn eerstvolgende handeling?

   De belangrijkste van de zes werkstanden, en niet de kleinste (HORECA.md). De
   vaste schermen informeren en regisseren; hier wordt de service uitgevoerd.

   WAT DIT SCHERM ANDERS MAAKT DAN DE ANDERE. Alle andere horecaschermen zijn
   per TAFEL of per STATION geordend. Dit is het enige dat per HANDELING is
   geordend, en die volgorde komt niet van hier: kern/horeca/werklijst.js rekent
   hem uit, dit scherm tekent hem. Zou de client zelf sorteren, dan had de zaak
   twee antwoorden op dezelfde vraag (LAT-regel 4).

   DE TWEE LIJSTEN ZIJN GEEN OPMAAK MAAR DE BELOFTE ZELF. "Nu" bevat alleen
   taken die over een grens zijn die het huis zelf heeft opgeschreven -- de
   verzoekgrenzen uit kern/gast/verzoek.js, de pasmarge uit cadans.js, of het
   afgesproken serveermoment. "Ook open" is alles wat wacht zonder dat er ergens
   staat hoe lang dat mag; die staan op minuten en zonder rangorde. Wie die twee
   door elkaar zet, verzint een weging tussen dingen die niet in dezelfde
   eenheid staan (HORECA.md, grens 7).

   DRIE DINGEN DIE HIER ZICHTBAAR BLIJVEN OMDAT ZE ANDERS VERDWIJNEN:

   1. DE MINUTEN, DE GRENS EN DE REKENSOM STAAN OP ELKE KAART. Niet een kleur
      met een uitleg elders: wie het rood niet ziet, leest het getal.
   2. WIE HET AL HEEFT, staat erbij. Twee mensen die naar dezelfde tafel lopen
      is de fout die de claim oplost, en die oplossing werkt alleen als je hem
      ziet.
   3. EEN ALLERGIE REIST MEE MET HET BORD. De runner draagt borden, geen regels.
      Een allergie die de drager niet ziet, is precies de fout die dit huis niet
      mag maken (grens 1).

   HET SCHERM VINKT NIETS ZELF AF (grens 4). Elke knop hier is een bestaande
   deur: verzoeken/zet, pas/pak, pas/los, pas/uit. Er komt geen vijfde deur bij
   waar een taak ook "gedaan" kan worden -- dat is een tweede plek waar hij kan
   blijven hangen.

   TWEE VENSTERS, EEN SCHERM. De werklijst hieronder zegt WAT er moet gebeuren;
   de tafel (pda-tafel.js) is waar het gebeurt -- ontvangen, opnemen, gangen
   sturen en afrekenen. Ze wisselen elkaar af en staan niet naast elkaar: op een
   telefoon in een hand is twee kolommen geen ontwerp maar een compromis. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  if (!K.poort()) return;

  var esc = K.esc, api = K.api, meld = K.meld;
  /* Hoe een taak eruitziet, staat in ./pda-taak.js -- zie de kop daar voor
     waarom die naad daar ligt. Dit bestand gaat over hoe het SCHERM zich
     gedraagt. */
  var kaart = function (t, inNu) { return window.RTGPdaTaak.kaart(t, inNu); };
  var MODUS = 'alles';
  var WIJKLENS = 'alles';
  try {
    MODUS = localStorage.getItem('rtg_pda_modus') || 'alles';
    WIJKLENS = localStorage.getItem('rtg_pda_wijk') || 'alles';
  } catch (e) {}
  var LAATST = null;

  function $(id) { return document.getElementById(id); }

  function teken(d) {
    LAATST = d;
    $('pModi').innerHTML = (d.modi || []).map(function (m) {
      return '<button type="button" data-modus="' + esc(m.id) + '" aria-pressed="' +
        (m.id === d.modus ? 'true' : 'false') + '">' + esc(m.naam) + '</button>';
    }).join('');
    K.bind($('pModi'), 'modus', function (b) {
      MODUS = b.dataset.modus;
      try { localStorage.setItem('rtg_pda_modus', MODUS); } catch (e) {}
      haal();
    });

    /* DE WIJKLENS, en meteen eronder wat hij NIET toont. Een filter dat zwijgt
       over wat het wegliet, is een filter waarin werk verdwijnt -- en op een
       drukke avond is dat precies de tafel waar het misgaat. */
    $('pWijkLens').innerHTML = [['alles', 'Hele zaak'], ['mijn', 'Mijn wijk']].map(function (x) {
      return '<button type="button" data-wijklens="' + x[0] + '" aria-pressed="' +
        (x[0] === d.wijk ? 'true' : 'false') + '">' + x[1] + '</button>';
    }).join('');
    K.bind($('pWijkLens'), 'wijklens', function (b) {
      WIJKLENS = b.dataset.wijklens;
      try { localStorage.setItem('rtg_pda_wijk', WIJKLENS); } catch (e) {}
      haal();
    });
    $('pWijkUit').textContent = d.wijk === 'mijn'
      ? ((d.mijnWijken.length ? 'Uw wijk: ' + d.mijnWijken.join(', ') + '. ' : 'U draagt geen wijk; u ziet alles wat van niemand is. ') +
         (d.verborgen ? d.verborgen + ' taak(en) staan buiten uw wijk en worden hier niet getoond.' : 'Er valt niets buiten.'))
      : '';

    $('pNu').innerHTML = d.nu.length ? d.nu.map(function (t) { return kaart(t, true); }).join('')
      : '<p class="pda-leeg">Niets staat over zijn grens. Dat is geen stilte maar de bedoeling.</p>';
    $('pOpen').innerHTML = d.open.length ? d.open.map(function (t) { return kaart(t, false); }).join('')
      : '<p class="pda-leeg">Niets open.</p>';
    $('pUitleg').textContent = d.let || '';
    window.RTGPdaWijk.teken(d.wijkbeeld || [], d.mijnWijken || [], na);

    K.bind($('main'), 'vz', function (b) {
      api('/verzoeken/zet', { verzoek: b.dataset.vz, stand: b.dataset.stand }).then(na);
    });
    K.bind($('main'), 'pak', function (b) {
      api('/pas/pak', { rekeningId: b.dataset.pak, gang: b.dataset.gang }).then(na);
    });
    K.bind($('main'), 'los', function (b) {
      api('/pas/los', { rekeningId: b.dataset.los, gang: b.dataset.gang }).then(na);
    });
    K.bind($('main'), 'uit', function (b) {
      api('/pas/uit', { rekeningId: b.dataset.uit, gang: b.dataset.gang }).then(na);
    });
    K.bind($('main'), 'tafel', function (b) { open(b.dataset.tafel); });
  }

  /* Na een handeling: de fout van de server LATEN STAAN en niet vertalen. Een
     claim die al van iemand anders is, hoort te zeggen van wie -- dat staat al
     in het antwoord van kern/horeca/pas.js. */
  function na(r) {
    if (r.body && r.body.error) meld(r.body.error);
    else if (r.body && r.body.let) meld(r.body.let);
    haal();
  }

  function haal() {
    return api('/werklijst', { modus: MODUS, wijk: WIJKLENS }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      teken(r.body);
    });
  }

  /* ---- het wisselen tussen de twee vensters ---- */
  function open(rekeningId) {
    $('pLijst').hidden = true;
    $('pTafel').hidden = false;
    window.RTGPdaTafel.toon(rekeningId, terug);
  }
  function terug() {
    $('pTafel').hidden = true;
    $('pLijst').hidden = false;
    haal();
  }
  $('tTerug').addEventListener('click', terug);

  /* ONTVANGEN. Een tafel openen is de eerste handeling van de avond en stond
     alleen op het zaalscherm -- dus liep de bediening met een telefoon in de
     hand naar binnen om een tafel te openen. */
  $('pNieuw').addEventListener('click', function () {
    var tafel = $('pNieuwTafel').value.trim();
    if (!tafel) return meld('Welke tafel of plek?');
    var gasten = parseInt($('pNieuwGasten').value, 10);
    api('/rekening/open', { kanaal: 'tafel', tafel: tafel, gasten: gasten > 0 ? gasten : 1 })
      .then(function (r) {
        if (r.body.error) return meld(r.body.error);
        $('pNieuwTafel').value = '';
        open(r.body.rekening.id);
      });
  });

  /* De open tafels: niet alles wat open staat is een TAAK (een tafel die net
     eten kreeg wacht nergens op), maar je moet er wel bij kunnen. */
  $('pTafels').addEventListener('click', function () {
    api('/rekeningen', { status: 'open' }).then(function (r) {
      var lijst = r.body.rekeningen || [];
      if (!lijst.length) return meld('Er staat geen enkele rekening open.');
      $('pNu').innerHTML = '<p class="pda-som">Open tafels</p>' + lijst.map(function (x) {
        return '<article class="pda-taak"><div class="pda-kop">' +
          '<span class="pda-tafel">' + esc(x.tafel || x.kanaal) + '</span>' +
          '<span class="pda-min">' + K.euro(x.totalen.netto) + '</span></div>' +
          '<div class="pda-acties">' + K.knop('Open', { tafel: x.id }, true) + '</div></article>';
      }).join('');
      $('pOpen').innerHTML = '';
      K.bind($('pNu'), 'tafel', function (b) { open(b.dataset.tafel); });
    });
  });

  $('pVerversNu').addEventListener('click', haal);
  /* De duwstroom: een verzoek of een klaar bord van een collega hoort hier
     binnen te komen zonder dat iemand op "ververs" drukt. Zonder scope, want
     deze lijst leest uit drie bronnen tegelijk. */
  /* De duwstroom raakt allebei de vensters: staat de tafel open, dan wordt DIE
     ververst -- anders zou een collega die een gang vrijgeeft, dit scherm
     terugsturen naar de lijst. */
  K.luister('', function () {
    if ($('pTafel').hidden) haal(); else window.RTGPdaTafel.ververs();
  });
  haal();
})();

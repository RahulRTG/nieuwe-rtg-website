/* RTG Werk OS (scherm): de handelingen.

   Tot deze ronde toonde het werkscherm de modules maar liepen de handelingen
   nog rechtstreeks op de API (TAKEN 5.9b). Dat is hier gesloten, en het is
   bewust EEN bestand: acht modules met elk hun eigen formulier zou acht keer
   dezelfde bedrading opleveren, en dan lopen ze binnen een maand uiteen.

   Daarom staat er hier een BESCHRIJVING per handeling (welke velden, welk
   pad, wat mag er terug) en bouwt een enkele functie daar het formulier van.
   Wie een handeling toevoegt, zet een regel in HANDELINGEN bij; hij hoeft
   niets te bedraden.

   TWEE DINGEN DIE DIT SCHERM EXPRES DOET

   1. EEN WEIGERING VAN DE SERVER KOMT VOLUIT IN BEELD. Niet "er ging iets
      mis", maar de zin die de server geeft: welk apparaat er nog uitstaat, op
      welke taak er wordt gewacht, waarom een besluit niet gesloten kan worden.
      Die zinnen zijn het halve product; ze wegvertalen naar een rood kruisje
      is precies de fout die dit huis niet wil maken.
   2. HET SCHERM VERZINT GEEN VELDEN DIE DE SERVER NIET KENT. Wat hier staat,
      staat ook in de route. Een formulier dat meer vraagt dan de server
      gebruikt, leert mensen dingen invullen die nergens landen. */
(function () {
  'use strict';
  var K = window.RTGWerk;
  function $(id) { return document.getElementById(id); }

  // [naam, pad, velden] -- een veld is [sleutel, label, soort, breedte]
  var HANDELINGEN = {
    projecten: [
      ['Nieuw project', '/project/maak', [['naam', 'Naam', 'tekst'], ['werkvorm', 'Werkvorm', 'keuze:algemeen,software,stadsuitrol,horeca-implementatie,school-implementatie,juridisch,campagne,expansie'], ['budget', 'Budget', 'getal', '7rem'], ['uurtarief', 'Uurtarief', 'getal', '7rem']]],
      ['Nieuwe taak', '/taak/maak', [['titel', 'Wat moet er gebeuren', 'tekst'], ['wie', 'Voor wie', 'tekst', '9rem'], ['deadline', 'Deadline', 'tekst', '8rem'], ['prioriteit', 'Prioriteit', 'keuze:normaal,laag,hoog,kritiek', '8rem']]],
      ['Taak verplaatsen', '/taak/kolom', [['taakId', 'Taak-id', 'tekst', '9rem'], ['kolom', 'Naar kolom', 'keuze:te doen,bezig,review,klaar', '9rem']]],
      ['Uren schrijven', '/taak/uren', [['taakId', 'Taak-id', 'tekst', '9rem'], ['uren', 'Uren', 'getal', '6rem']]]
    ],
    kennis: [
      ['Artikel schrijven', '/kennis/schrijf', [['titel', 'Titel', 'tekst'], ['tekst', 'Tekst', 'lang'], ['soort', 'Soort', 'keuze:procedure,handleiding,beleid,onboarding,architectuurbesluit,verkoop,product,faq,lessons learned,nieuws'], ['geldigTot', 'Geldig tot', 'tekst', '8rem']]],
      ['Nagekeken', '/kennis/nagekeken', [['artikelId', 'Artikel-id', 'tekst', '9rem'], ['geldigTot', 'Nieuwe datum', 'tekst', '8rem']]]
    ],
    klanten: [
      ['Klant vastleggen', '/klant/zet', [['naam', 'Naam', 'tekst'], ['branche', 'Branche', 'tekst', '9rem'], ['land', 'Land', 'tekst', '5rem']]],
      ['Product koppelen', '/klant/product', [['klantId', 'Klant-id', 'tekst', '9rem'], ['product', 'Product', 'keuze:horeca-os,school-os,werk-os,betalingen,communicatie,bezorging,consument'], ['verwijzing', 'Code daar', 'tekst', '9rem']]],
      ['Nieuwe kans', '/kans/maak', [['klantId', 'Klant-id', 'tekst', '9rem'], ['titel', 'Waarover', 'tekst'], ['bedrag', 'Bedrag', 'getal', '7rem']]],
      ['Kans verzetten', '/kans/fase', [['kansId', 'Kans-id', 'tekst', '9rem'], ['fase', 'Fase', 'keuze:gesprek,demo,offerte,gewonnen,verloren', '8rem'], ['bedrag', 'Bedrag', 'getal', '7rem'], ['reden', 'Reden', 'tekst']]]
    ],
    service: [
      ['Ticket aanmaken', '/ticket/maak', [['onderwerp', 'Onderwerp', 'tekst'], ['prioriteit', 'Prioriteit', 'keuze:normaal,kritiek,hoog,laag', '8rem'], ['melder', 'Melder', 'tekst', '9rem']]],
      ['Reageren', '/ticket/reageer', [['ticketId', 'Ticket-id', 'tekst', '9rem'], ['tekst', 'Antwoord', 'lang']]],
      ['Sluiten', '/ticket/sluit', [['ticketId', 'Ticket-id', 'tekst', '9rem'], ['oplossing', 'Hoe opgelost', 'lang']]]
    ],
    bouw: [
      ['Issue melden', '/issue/maak', [['titel', 'Titel', 'tekst'], ['soort', 'Soort', 'keuze:bug,wens,schuld,beveiliging', '8rem'], ['ticketId', 'Uit ticket', 'tekst', '9rem']]],
      ['Release vastleggen', '/release/maak', [['versie', 'Versie', 'tekst', '7rem'], ['omgeving', 'Omgeving', 'keuze:test,ontwikkel,acceptatie,productie', '9rem'], ['toetsenGedraaid', 'Toetsen gedraaid', 'getal', '8rem'], ['toetsenGezakt', 'Gezakt', 'getal', '6rem'], ['goedgekeurdDoor', 'Goedgekeurd door', 'tekst', '10rem']]],
      ['Vlag zetten', '/vlag/zet', [['naam', 'Naam', 'tekst', '9rem'], ['opruimen', 'Opruimen op', 'tekst', '8rem'], ['aanIn', 'Aan in', 'keuze:,ontwikkel,test,acceptatie,productie', '9rem']]]
    ],
    it: [
      ['Apparaat vastleggen', '/apparaat/zet', [['soort', 'Soort', 'keuze:laptop,telefoon,tablet,monitor,toegangspas,sleutel,overig', '9rem'], ['nummer', 'Nummer', 'tekst', '9rem'], ['model', 'Model', 'tekst', '9rem'], ['versleuteld', 'Versleuteld', 'vink']]],
      ['Uitgeven', '/apparaat/uitgeven', [['apparaatId', 'Apparaat-id', 'tekst', '9rem'], ['lidId', 'Lid-id', 'tekst', '9rem']]],
      ['Innemen', '/apparaat/innemen', [['apparaatId', 'Apparaat-id', 'tekst', '9rem']]],
      ['Uitdienststap', '/uitdienst/stap', [['lidId', 'Lid-id', 'tekst', '9rem'], ['stap', 'Stap', 'keuze:accounts geblokkeerd,sessies beeindigd,sleutels ingetrokken,apparaten terug,bestanden overgedragen,toegang bij klanten verwijderd']]]
    ],
    recht: [
      ['Contract vastleggen', '/contract/zet', [['titel', 'Titel', 'tekst'], ['wederpartij', 'Wederpartij', 'tekst', '10rem'], ['soort', 'Soort', 'keuze:klant,leverancier,arbeid,huur,licentie,verwerkers,geheimhouding,verzekering,vergunning,overig', '9rem'], ['eindigt', 'Eindigt', 'tekst', '8rem'], ['opzegtermijnDagen', 'Opzegtermijn (dagen)', 'getal', '8rem']]],
      ['Tekenen', '/contract/teken', [['contractId', 'Contract-id', 'tekst', '9rem'], ['partij', 'Namens', 'keuze:wij,wederpartij', '8rem'], ['naam', 'Naam', 'tekst', '9rem']]],
      ['Opzeggen', '/contract/opzeggen', [['contractId', 'Contract-id', 'tekst', '9rem'], ['reden', 'Reden', 'tekst']]]
    ],
    besluit: [
      ['Voorstel indienen', '/besluit/maak', [['titel', 'Titel', 'tekst'], ['soort', 'Soort', 'keuze:overig,product,investering,prijs,lancering,beveiliging,personeel,contract', '9rem'], ['onderbouwing', 'Onderbouwing', 'lang']]],
      ['Advies of bezwaar', '/besluit/advies', [['besluitId', 'Besluit-id', 'tekst', '9rem'], ['tekst', 'Advies', 'lang'], ['bezwaar', 'Dit is een bezwaar', 'vink']]],
      ['Stemronde openen', '/besluit/stemronde', [['besluitId', 'Besluit-id', 'tekst', '9rem']]],
      ['Stemmen', '/besluit/stem', [['besluitId', 'Besluit-id', 'tekst', '9rem'], ['stem', 'Stem', 'keuze:voor,tegen,onthouding', '8rem']]],
      ['Sluiten', '/besluit/sluit', [['besluitId', 'Besluit-id', 'tekst', '9rem'], ['evalueerOp', 'Evalueren op', 'tekst', '8rem']]]
    ]
  };

  function veld(h, v) {
    var id = 'a_' + h + '_' + v[0];
    var breed = v[3] ? 'flex:0 1 ' + v[3] + ';' : '';
    if (v[2] === 'vink') return '<label class="stil"><input type="checkbox" id="' + id + '"> ' + K.esc(v[1]) + '</label>';
    if (v[2] === 'lang') return '<textarea class="veld" id="' + id + '" rows="2" maxlength="4000" placeholder="' + K.esc(v[1]) + '" aria-label="' + K.esc(v[1]) + '"></textarea>';
    if (v[2].indexOf('keuze:') === 0) {
      return '<select class="veld" id="' + id + '" aria-label="' + K.esc(v[1]) + '" style="' + breed + '">' +
        v[2].slice(6).split(',').map(function (o) {
          return '<option value="' + K.esc(o) + '">' + K.esc(o || v[1]) + '</option>';
        }).join('') + '</select>';
    }
    return '<input class="veld" id="' + id + '"' + (v[2] === 'getal' ? ' type="number" step="0.01"' : ' maxlength="200"') +
      ' placeholder="' + K.esc(v[1]) + '" aria-label="' + K.esc(v[1]) + '" style="' + breed + '">';
  }

  function lees(h, velden) {
    var body = {};
    velden.forEach(function (v) {
      var el = document.getElementById('a_' + h + '_' + v[0]);
      if (!el) return;
      if (v[2] === 'vink') { if (el.checked) body[v[0]] = true; return; }
      var w = String(el.value || '').trim();
      if (!w) return;
      body[v[0]] = v[2] === 'getal' ? Number(w) : w;
    });
    /* Twee velden die op het scherm losser staan dan in de route; hier worden
       ze in de vorm gebracht die de server kent, en niet andersom. */
    if (body.toetsenGedraaid != null || body.toetsenGezakt != null) {
      body.toetsen = { gedraaid: body.toetsenGedraaid || 0, gezakt: body.toetsenGezakt || 0 };
      delete body.toetsenGedraaid; delete body.toetsenGezakt;
    }
    if (body.aanIn) { body.standen = {}; body.standen[body.aanIn] = true; delete body.aanIn; }
    return body;
  }

  function toon(module) {
    var lijst = HANDELINGEN[module] || [];
    var el = $('mActie');
    el.innerHTML = lijst.map(function (h, i) {
      var naam = 'h' + i;
      return '<div class="kaart"><div class="kop">' + K.esc(h[0]) + '</div><div class="rij">' +
        h[2].map(function (v) { return veld(naam, v); }).join('') +
        K.knop(h[0], { doe: i }, i === 0) + '</div></div>';
    }).join('');
    K.bind(el, 'doe', function (b) {
      var h = lijst[Number(b.dataset.doe)];
      K.api(h[1], lees('h' + b.dataset.doe, h[2])).then(function (r) {
        /* De zin van de server, voluit. Die zinnen zijn het halve product. */
        if (r.body.error) return K.meld(r.body.error);
        K.meld(r.body.let || (h[0] + ': gelukt.'));
        window.RTGWerkModules.laad();
      });
    });
  }

  window.RTGWerkActies = { toon: toon, HANDELINGEN: HANDELINGEN };
})();

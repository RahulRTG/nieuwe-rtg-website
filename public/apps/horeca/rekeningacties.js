/* RTG Horeca (scherm): de handelingen OP een rekening -- verplaatsen,
   samenvoegen, korting, fooi, splitsen, afrekenen en oninbaar.

   WAAROM DIT ER PAS NU IS. De server kende deze handelingen allemaal al, met
   hun controles en hun redenen; alleen had de zaal er geen knop voor. Er waren
   achttien endpoints zonder scherm, en dit zijn de vijf die een bediening
   ELK UUR nodig heeft. Het scherpst zichtbaar bij `regel/weg`: je kon iets op
   een rekening zetten en er niets meer af halen. Een systeem waarin een
   vergissing niet terug te draaien is, dwingt mensen om eromheen te werken.

   VIER DINGEN DIE HIER ZICHTBAAR BLIJVEN, omdat de kern ze afdwingt en een
   scherm dat kan verbergen:

   1. KORTING DRAAGT ALTIJD EEN REDEN. De server weigert zonder; dit scherm
      vraagt hem dus vooraf in plaats van een foutmelding op te vangen.
   2. FOOI WORDT NOOIT VOORGEVULD. Er staat geen percentageknop en geen
      voorgeselecteerd bedrag -- wat er niet expliciet in gaat, gaat er niet in.
   3. VERPLAATSEN EN SAMENVOEGEN ZIJN VERPLAATSINGEN. De server rekent de
      waarde voor en na; klopt het niet, dan gebeurt er niets. Dit scherm zegt
      het bedrag hardop terug zodat de bediening het ziet kloppen.
   4. ONINBAAR IS GEEN ADMINISTRATIEVE HANDELING. Het blijft in de dagcijfers
      staan, het vraagt een reden, en het staat daarom apart onderaan en niet
      tussen de betaalknoppen. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  var rekening = null;

  function $(id) { return document.getElementById(id); }
  var esc = function (t) { return K.esc(t); };
  var euro = function (c) { return K.euro(c); };
  var api = function (p, b) { return K.api(p, b); };
  var meld = function (t) { K.meld(t); };

  function eerst() { if (!rekening) { meld('Open eerst een rekening.'); return false; } return true; }

  /* De lijst "samenvoegen met": alle andere open rekeningen. Hij wordt bij elke
     hertekening ververst, want een tafel die net is afgerekend hoort er niet
     meer in te staan. */
  function vulSamen() {
    api('/rekeningen', { status: 'open' }).then(function (r) {
      var lijst = (r.body.rekeningen || []).filter(function (x) { return x.id !== rekening; });
      $('zSamenMet').innerHTML = '<option value="">Samenvoegen met...</option>' + lijst.map(function (x) {
        return '<option value="' + esc(x.id) + '">' + esc(x.tafel || x.kanaal) + ' (' + euro(x.totalen.netto) + ')</option>';
      }).join('');
    });
  }

  function zet(id) { rekening = id; vulSamen(); }

  function klaar(bericht) {
    return function (r) {
      if (r.body.error) return meld(r.body.error);
      meld(typeof bericht === 'function' ? bericht(r.body) : (r.body.let || bericht));
      window.RTGHorecaActies.bijWijziging();
    };
  }

  function bind() {
    /* ---- de tafel zelf ---- */
    $('zVerplaats').addEventListener('click', function () {
      if (!eerst()) return;
      var naar = $('zNaarTafel').value.trim();
      if (!naar) return meld('Naar welke tafel?');
      api('/rekening/verplaats', { rekeningId: rekening, naarTafel: naar }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        $('zNaarTafel').value = '';
        meld('Verplaatst naar ' + naar + '.');
        window.RTGHorecaActies.bijWijziging();
      });
    });

    $('zVoegSamen').addEventListener('click', function () {
      if (!eerst()) return;
      var met = $('zSamenMet').value;
      if (!met) return meld('Met welke rekening?');
      api('/rekening/voeg-samen', { rekeningId: rekening, metId: met }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        /* Het bedrag hardop terug: samenvoegen verplaatst, dus de som hoort
           precies het geheel te zijn. Wie dat op het scherm ziet, hoeft de
           belofte niet te geloven. */
        var rek = r.body.rekening;
        meld('Samengevoegd. Op deze rekening staat nu ' + euro(rek.totalen.netto) + '.');
        window.RTGHorecaActies.bijWijziging();
      });
    });

    /* ---- geld ---- */
    $('zKorting').addEventListener('click', function () {
      if (!eerst()) return;
      var reden = $('zKortReden').value.trim();
      // de server weigert zonder reden; die vraag hoort vooraf en niet als fout
      if (!reden) return meld('Waarom wordt er korting gegeven? Dat hoort bij het bedrag te staan.');
      var procent = Number($('zKortProcent').value) || 0;
      var bedrag = Number($('zKortBedrag').value) || 0;
      if (!procent && !bedrag) return meld('Geef een percentage of een bedrag.');
      api('/korting', { rekeningId: rekening, reden: reden, procent: procent, bedrag: bedrag }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        $('zKortProcent').value = ''; $('zKortBedrag').value = ''; $('zKortReden').value = '';
        meld('Korting: ' + euro(r.body.rekening.totalen.korting) + ' (' + reden + ').');
        window.RTGHorecaActies.bijWijziging();
      });
    });

    $('zFooi').addEventListener('click', function () {
      if (!eerst()) return;
      // geen percentageknop en geen voorvulling: wat er niet in gaat, gaat er niet in
      var bedrag = Number($('zFooiBedrag').value) || 0;
      api('/fooi', { rekeningId: rekening, bedrag: bedrag }).then(klaar(function (b) {
        return 'Fooi staat op ' + euro(b.fooi) + '. ' + b.let;
      }));
    });

    /* ---- afronden ---- */
    $('zSplitsGa').addEventListener('click', function () {
      if (!eerst()) return;
      var n = Number($('zSplits').value) || 0;
      if (n < 2) return meld('In hoeveel delen?');
      api('/rekening/splits', { rekeningId: rekening, perPersoon: n }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        /* De som van de delen naast het geheel: dat is de bewering die de
           server ook doet, en als hij hier niet klopt, klopt er iets niet. */
        var som = (r.body.delen || []).reduce(function (t, d) { return t + d.totalen.netto; }, 0);
        meld('Gesplitst in ' + r.body.delen.length + ' delen, samen ' + euro(som) + '.');
        rekening = null;
        window.RTGHorecaActies.bijWijziging(true);
      });
    });

    $('zBetaal').addEventListener('click', function () {
      if (!eerst()) return;
      api('/betaal', { rekeningId: rekening, wijze: 'pin' }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        meld(r.body.gesloten ? 'Betaald en gesloten.' : 'Nog open: ' + euro(r.body.openstaand));
        if (r.body.gesloten) rekening = null;
        window.RTGHorecaActies.bijWijziging(!!r.body.gesloten);
      });
    });

    /* VERDELEN is iets anders dan splitsen hierboven: splitsen knipt de tafel
       in losse rekeningen, verdelen laat het er een en spreekt alleen af wie
       welk deel betaalt. Dezelfde rekensom die de gast op zijn telefoon
       gebruikt (kern/horeca/verdeling.js). */
    $('zVerdeel').addEventListener('click', function () {
      if (!eerst()) return;
      api('/rekening/verdeel', { rekeningId: rekening, wijze: $('zWijze').value }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        var d = r.body.verdeling.delen;
        meld(d.map(function (x) { return (x.handle || ('stoel ' + x.nr)) + ' ' + euro(x.centen); }).join(' · '));
        window.RTGHorecaActies.bijWijziging();
      });
    });

    $('zOninbaar').addEventListener('click', function () {
      if (!eerst()) return;
      var reden = $('zOninbaarReden').value.trim();
      if (!reden) return meld('Noteer waarom deze rekening oninbaar is (weggelopen, klacht, vergissing).');
      api('/oninbaar', { rekeningId: rekening, reden: reden }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        $('zOninbaarReden').value = '';
        meld(euro(r.body.oninbaar.centen) + ' oninbaar geboekt. ' + r.body.let);
        rekening = null;
        window.RTGHorecaActies.bijWijziging(true);
      });
    });
  }

  window.RTGHorecaActies = {
    bind: bind, zet: zet,
    // zaal.js zet hier zijn eigen hertekening in; standaard doet het niets
    bijWijziging: function () {}
  };
})();

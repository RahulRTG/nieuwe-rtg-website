/* RTG Horeca (scherm): HOE EEN TAAK ERUITZIET op de PDA.

   WAAROM DIT EEN EIGEN BESTAND IS. ./pda.js liep over de 10 kB-grens van
   keuringsregel 13. De snede ligt op dezelfde naad als bij het keukenbord: hier
   staat hoe een taak ERUITZIET, in pda.js staat hoe het scherm zich GEDRAAGT --
   ophalen, wisselen tussen de twee vensters, luisteren naar de duwstroom.

   Alles hieronder is een pure functie van een taak naar HTML, plus de knoppen
   die erbij horen. De knoppen zijn met opzet bestaande deuren
   (verzoeken/zet, pas/pak, pas/los, pas/uit): er komt geen vijfde plek bij waar
   een taak "gedaan" kan raken, want dat is een tweede plek waar hij kan blijven
   hangen (HORECA.md, grens 4). */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  var esc = K.esc;

  /* De knoppen per soort. Alleen bestaande deuren; wat hier niet staat, kan
     hier niet gedaan worden -- en dan zegt de kaart waar het wel kan. */
  function acties(t) {
    if (t.soort === 'verzoek') {
      return (t.door ? '' : K.knop('Ik ga', { vz: t.bronId, stand: 'opgepakt' }, true)) +
        K.knop('Gedaan', { vz: t.bronId, stand: 'klaar' });
    }
    if (t.soort === 'pas') {
      return (t.door
        ? K.knop('Loslaten', { los: t.rekeningId, gang: t.gang })
        : K.knop('Ik draag hem', { pak: t.rekeningId, gang: t.gang }, true)) +
        K.knop('Uitgegeven', { uit: t.rekeningId, gang: t.gang });
    }
    /* DE HOST TEKENT EEN BELOFTE PERSOONLIJK AF. Eén knop per belofte en niet
       één voor alle: "persoonlijk gecontroleerd" betekent dat iemand het
       werkelijk heeft gedaan, en een knop die er vijf tegelijk afvinkt maakt
       van die zin een formaliteit. De deur is de bestaande /arrival/promise. */
    if (t.soort === 'aankomst') {
      return (t.beloften || []).map(function (p) {
        return K.knop(p.label + ' gecontroleerd', { belofte: p.id, arrival: t.bronId }, true);
      }).join('');
    }
    if (t.soort === 'opnemen') return K.knop('Opnemen', { tafel: t.rekeningId }, true);
    /* Een beloftetaak heeft geen knop: dit is werk van de keuken. Wat de
       bediening ermee doet -- de tafel geruststellen, de chef aanspreken -- is
       geen handeling die een systeem afvinkt. Wel een weg naar de tafel, want
       daar staat wat de gast besteld heeft. */
    if (t.soort === 'belofte') return K.knop('Bekijk de tafel', { tafel: t.rekeningId });
    return '';
  }

  /* De open beloften onder de kaart: een host die niet ziet WELKE belofte
     wacht, moet eerst een ander scherm openen -- en dan is dit geen werklijst
     maar een verwijzing. */
  function beloften(t) {
    if (!t.beloften || !t.beloften.length) return '';
    return '<ul class="pda-borden">' + t.beloften.map(function (p) {
      return '<li><span>' + esc(p.label) + '</span><em>' + esc(p.status) +
        (p.bewijs ? ' &middot; ' + esc(p.bewijs) : '') + '</em></li>';
    }).join('') + '</ul>';
  }

  function borden(t) {
    if (!t.borden || !t.borden.length) return '';
    return '<ul class="pda-borden">' + t.borden.map(function (b) {
      return '<li><span>' + esc(b.aantal + 'x ' + b.naam) + '</span><em>' +
        esc(b.stoel || 'gedeeld') + (b.allergie ? ' &middot; ' + esc(b.allergie) : '') + '</em></li>';
    }).join('') + '</ul>';
  }

  /* De kop van een kaart draagt het getal waarop de lijst geordend is, en dat
     is voor "nu" de overschrijding en voor "ook open" de wachttijd. Twee lijsten
     met twee getallen is eerlijker dan een lijst met een getal dat soms iets
     anders betekent. */
  function kaart(t, inNu) {
    var min = inNu ? ('+' + t.over + ' min') : (t.wacht + ' min');
    return '<article class="pda-taak' + (inNu ? ' over' : '') + '">' +
      '<div class="pda-kop"><span class="pda-tafel">' + esc(t.tafel || '-') + '</span>' +
      '<span class="pda-min">' + esc(min) + '</span></div>' +
      '<p class="pda-wat">' + esc(t.wat) + '</p>' +
      borden(t) + beloften(t) +
      ((t.allergieen && t.allergieen.length)
        ? '<span class="pda-allergie">Allergie: ' + esc(t.allergieen.join(', ')) + '</span>' : '') +
      '<p class="pda-som">' + esc(t.rekensom) + '</p>' +
      (t.door ? '<p class="pda-door">' + esc(t.vanMij ? 'U heeft dit opgepakt.' : t.door + ' heeft dit opgepakt.') + '</p>' : '') +
      '<div class="pda-acties">' + acties(t) + '</div>' +
      '</article>';
  }

  window.RTGPdaTaak = { kaart: kaart };
})();

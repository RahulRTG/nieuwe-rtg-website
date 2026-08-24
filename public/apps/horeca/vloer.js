/* RTG Horeca (scherm): VLOER -- wie heeft ons nu nodig, en hoe verdelen we dat?

   De zesde en laatste werkstand, en de enige die een ANDERE vraag stelt dan de
   vijf ernaast. TAFEL, PDA SERVICE, VUUR en BAR vragen allemaal "wat moet ik nu
   doen"; REGIE vraagt "loopt de avond". VLOER vraagt wie er onder water staat en
   hoe je dat herverdeelt -- en dat antwoord is geen takenlijst maar een
   verdeling.

   DE HELFT DIE ER AL WAS, EN DE HELFT DIE ONTBRAK. Wie draagt wat, en hoeveel
   werk hangt daaraan, stond er al: het wijkbeeld op de PDA. Wat niet kon, was
   het HERverdelen -- en dat is precies het moment waarop een maitre iets nodig
   heeft. Iemand gaat pauzeren, iemand raakt achterop, er komt een groep binnen.

   WAAROM OVERDRAGEN EEN AANBOD IS EN GEEN KNOP. Een wijk loslaten en hopen dat
   een collega hem oppakt, is een tafel die tussen twee mensen door valt -- en
   dat merkt niemand tot de gast het zegt. Dus draagt de aanbieder hem nog
   TIJDENS het aanbod, en verhuist er pas iets als de ander aanvaardt. De regels
   staan in kern/horeca/wijk-overdracht.js; dit scherm is er de deur van.

   HET HERVERDELEN ZELF STAAT IN ./vloer-aanbod.js -- aanbieden, aannemen, nee
   zeggen en teruggeven zijn een gesprek tussen twee mensen, en dit bestand gaat
   over de verdeling zoals hij NU is. Twee vragen, twee bestanden.

   VIER DINGEN DIE HIER ZICHTBAAR BLIJVEN:

   1. HET GETAL HOORT BIJ DE WIJK EN NIET BIJ DE MENS. "12 open" staat naast een
      wijk, nooit naast een naam, en er is geen kolom "gedaan". Er komt geen
      ranglijst op medewerkers (HORECA.md, grens 5); de naam staat erbij zodat je
      weet wie je moet aanspreken.
   2. ER STAAT GEEN GRENS OP HOE LANG EEN AANBOD MAG STAAN. Hoeveel minuten het
      er staat is gemeten; wanneer dat te lang is, is dat niet -- dus verzint dit
      scherm daar geen kleur bij (grens 7).
   3. WAT VAN IEDEREEN IS, STAAT ER OOK. Tafels zonder wijk en wijken die niemand
      draagt komen naar voren in plaats van weg te vallen: wat van iedereen is,
      verdwijnt het makkelijkst.
   4. INDELEN VERSCHIJNT BIJ WIE ER IETS MEE KAN, maar het recht zit op de
      server. Het vlaggetje hieronder is opmaak, geen slot. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  if (!K.poort()) return;
  var esc = K.esc, api = K.api, meld = K.meld;

  function $(id) { return document.getElementById(id); }

  var D = null;   // het laatste beeld; het indeelblok leest hier de tafels uit

  function draagt(w) {
    if (w.van) return esc(w.van.naam) + ' draagt deze wijk.';
    return 'Niemand draagt deze wijk, dus hij is van iedereen.';
  }

  /* De uitgeleende tafels van deze wijk, in woorden. Zonder deze zin liegt het
     getal ernaast: "Zaal, twaalf open" terwijl er drie bij Bram staan, is een
     mening die eruitziet als een meting (grens 7). */
  function watUitstaat(w) {
    var uit = w.uitgeleend || [];
    if (!uit.length) return '';
    var wie = [];
    uit.forEach(function (l) { if (wie.indexOf(l.naam) < 0) wie.push(l.naam); });
    return ' ' + esc(uit.map(function (l) { return l.tafel; }).join(', ')) +
      ' ' + (uit.length === 1 ? 'staat' : 'staan') + ' bij ' + esc(wie.join(' en ')) +
      (w.uit ? ' (' + w.uit + ' van die taken).' : '.');
  }

  function wijkKaart(w) {
    var bod = (D.overdrachten || []).filter(function (o) { return o.wijkId === w.id; })[0];
    var acties = '';
    if (w.vanMij) {
      acties = K.knop('Loslaten', { laat: w.id }) + K.knop('Overdragen', { bied: w.id });
    } else if (!w.van) {
      acties = K.knop('Ik neem hem', { neem: w.id }, true);
    }
    return '<article class="v-wijk' + (w.nu ? ' over' : (w.van ? '' : ' los')) + '">' +
      '<div class="v-wijkkop"><span class="v-naam">' + esc(w.naam) + '</span>' +
      '<span class="v-druk">' + w.taken + ' open</span></div>' +
      '<p class="v-som">' + (w.nu ? '<b>' + w.nu + ' daarvan staan over een grens.</b> ' : '') +
      draagt(w) + watUitstaat(w) +
      (bod ? ' ' + (bod.tafels ? esc(bod.tafels.join(', ')) : 'De hele wijk') + ' aangeboden aan ' +
        esc(bod.naarNaam || 'een collega') + '; staat ' + bod.staat + ' min.' : '') +
      '</p>' +
      '<p class="v-tafels">' + (w.tafels.length
        ? w.tafels.length + ' tafel(s): ' + esc(w.tafels.join(', '))
        : 'Nog geen tafels in deze wijk.') + '</p>' +
      (acties ? '<div class="v-acties">' + acties + '</div>' : '') +
      '</article>';
  }

  function zonderKaart(z) {
    if (!z || (!z.tafels.length && !z.taken)) return '';
    return '<article class="v-wijk' + (z.nu ? ' over' : ' los') + '">' +
      '<div class="v-wijkkop"><span class="v-naam">Zonder wijk</span>' +
      '<span class="v-druk">' + z.taken + ' open</span></div>' +
      '<p class="v-som">' + (z.nu ? '<b>' + z.nu + ' daarvan staan over een grens.</b> ' : '') +
      'Deze tafels zitten in geen enkele wijk en zijn dus van iedereen.</p>' +
      '<p class="v-tafels">' + (z.tafels.length ? esc(z.tafels.join(', ')) : 'Geen tafels.') + '</p>' +
      '</article>';
  }

  function teken(d) {
    D = d;
    var wijken = d.wijken || [];
    var totaal = wijken.reduce(function (n, w) { return n + w.taken; }, 0) +
      ((d.zonderWijk && d.zonderWijk.taken) || 0);
    $('vOpen').textContent = totaal;
    $('vLos').textContent = wijken.filter(function (w) { return !w.van; }).length;
    $('vBoden').textContent = (d.overdrachten || []).length;
    $('vUitleg').textContent = d.let || '';

    $('vWijken').innerHTML = (wijken.map(wijkKaart).join('') + zonderKaart(d.zonderWijk)) ||
      '<p class="v-leeg">Er zijn nog geen wijken. Zolang die er niet zijn is elke tafel ' +
      'van iedereen -- dat werkt, maar op een drukke avond weet dan niemand wie waar heen loopt.</p>';

    K.bind($('main'), 'neem', function (b) { doe('/wijk/neem', { wijkId: b.dataset.neem }); });
    K.bind($('main'), 'laat', function (b) { doe('/wijk/laat', { wijkId: b.dataset.laat }); });

    /* De OVERDRACHT (aanbieden, aannemen, weigeren, teruggeven) staat in
       ./vloer-aanbod.js en het INDELEN in ./vloer-indelen.js. Ze tekenen na dit
       blok, want ze hangen hun knoppen aan #main -- en die moet dan al staan. */
    if (window.RTGVloerAanbod) RTGVloerAanbod.teken(d, haal);
    if (window.RTGVloerIndeel) RTGVloerIndeel.teken(d, haal);
  }

  /* Elke handeling meldt wat er gebeurde EN haalt het beeld opnieuw op. Dat
     laatste is geen luxe: een verdeling die u ziet nadat een collega hem heeft
     veranderd, is een verdeling waarop u de verkeerde wijk aanbiedt. */
  function doe(pad, body) {
    return api(pad, body).then(function (r) {
      if (r.body.error) meld(r.body.error);
      else if (r.body.let) meld(r.body.let);
      haal();
    }, function (e) { meld(e.message || 'Er ging iets mis.'); });
  }

  function haal() {
    return api('/wijken', {}).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      teken(r.body);
    });
  }

  $('vVerversNu').addEventListener('click', haal);
  // dezelfde duwstroom als de rest: een overdracht van een collega hoort hier
  // te staan zonder dat iemand op "ververs" drukt
  K.luister('horeca', haal);
  K.luister('keuken', haal);
  haal();

  window.RTGVloer = { haal: haal };
})();

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

  /* De keuze aan wie een wijk wordt aangeboden. Alleen namen -- geen rollen,
     geen telling per mens, en mezelf niet: een wijk aan jezelf aanbieden
     verandert niets. */
  function ploegKeuze(w) {
    var anderen = (D.ploeg || []).filter(function (p) { return !p.ik; });
    if (!anderen.length) return '';
    return '<select data-naar="' + esc(w.id) + '" aria-label="Aan wie biedt u ' + esc(w.naam) + ' aan">' +
      anderen.map(function (p) {
        return '<option value="' + esc(p.id) + '">' + esc(p.naam) + '</option>';
      }).join('') + '</select>' +
      K.knop('Bied aan', { bied: w.id });
  }

  function wijkKaart(w) {
    var bod = (D.overdrachten || []).filter(function (o) { return o.wijkId === w.id; })[0];
    var acties = '';
    if (bod) {
      acties = (bod.vanMij || D.magIndelen) ? K.knop('Trek het aanbod in', { trek: bod.id }) : '';
    } else if (w.vanMij) {
      acties = K.knop('Loslaten', { laat: w.id }) + ploegKeuze(w);
    } else if (!w.van) {
      acties = K.knop('Ik neem hem', { neem: w.id }, true);
    }
    return '<article class="v-wijk' + (w.nu ? ' over' : (w.van ? '' : ' los')) + '">' +
      '<div class="v-wijkkop"><span class="v-naam">' + esc(w.naam) + '</span>' +
      '<span class="v-druk">' + w.taken + ' open</span></div>' +
      '<p class="v-som">' + (w.nu ? '<b>' + w.nu + ' daarvan staan over een grens.</b> ' : '') +
      draagt(w) +
      (bod ? ' Aangeboden aan ' + esc(bod.naarNaam || 'een collega') + '; staat ' + bod.staat + ' min.' : '') +
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

    /* Wat aan MIJ is aangeboden staat bovenaan. Een wijk die op mijn antwoord
       wacht is het enige op dit scherm dat niet kan wachten -- zolang ik niet
       antwoord, draagt een collega hem nog. */
    var voor = (d.overdrachten || []).filter(function (o) { return o.voorMij; });
    $('vVoorMij').innerHTML = voor.map(function (o) {
      return '<article class="v-bod"><p><b>' + esc(o.vanNaam) + '</b> biedt u ' +
        esc(o.wijkNaam) + ' aan; het aanbod staat ' + o.staat + ' min. ' +
        'Tot u hem aanvaardt, draagt ' + esc(o.vanNaam) + ' hem nog.</p>' +
        '<div class="v-acties">' + K.knop('Ik neem hem over', { pak: o.id }, true) + '</div></article>';
    }).join('');

    $('vWijken').innerHTML = (wijken.map(wijkKaart).join('') + zonderKaart(d.zonderWijk)) ||
      '<p class="v-leeg">Er zijn nog geen wijken. Zolang die er niet zijn is elke tafel ' +
      'van iedereen -- dat werkt, maar op een drukke avond weet dan niemand wie waar heen loopt.</p>';

    var open = (d.overdrachten || []);
    $('vAanbod').innerHTML = open.length ? open.map(function (o) {
      return '<article class="v-wijk"><div class="v-wijkkop">' +
        '<span class="v-naam">' + esc(o.wijkNaam) + '</span>' +
        '<span class="v-druk">' + o.staat + ' min</span></div>' +
        '<p class="v-som">' + esc(o.vanNaam) + ' biedt hem aan ' + esc(o.naarNaam || 'een collega') +
        ' en draagt hem tot dan zelf.</p>' +
        ((o.vanMij || d.magIndelen)
          ? '<div class="v-acties">' + K.knop('Trek in', { trek: o.id }) + '</div>' : '') +
        '</article>';
    }).join('') : '<p class="v-leeg">Geen open aanbiedingen. Een wijk overdragen doet u hierboven, ' +
      'bij de wijk die u zelf draagt.</p>';

    K.bind($('main'), 'neem', function (b) { doe('/wijk/neem', { wijkId: b.dataset.neem }); });
    K.bind($('main'), 'laat', function (b) { doe('/wijk/laat', { wijkId: b.dataset.laat }); });
    K.bind($('main'), 'pak', function (b) { doe('/wijk/aanvaard', { overdrachtId: b.dataset.pak }); });
    K.bind($('main'), 'trek', function (b) { doe('/wijk/trek-in', { overdrachtId: b.dataset.trek }); });
    K.bind($('main'), 'bied', function (b) {
      var kies = $('main').querySelector('select[data-naar="' + b.dataset.bied + '"]');
      if (!kies || !kies.value) return meld('Aan wie wordt deze wijk aangeboden?');
      doe('/wijk/bied', { wijkId: b.dataset.bied, naarId: kies.value,
        naarNaam: kies.options[kies.selectedIndex].text });
    });

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

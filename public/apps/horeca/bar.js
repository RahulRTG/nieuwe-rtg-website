/* RTG Horeca (scherm): BAR -- welke drankgolf moet nu gemaakt worden?

   De zesde werkstand, en de laatste die nog geen eigen scherm had. Een drankgang
   was gewoon een gang met station `bar`, dus stond hij tussen de gerechten op
   het keukenbord -- en een barman die soep op zijn bord ziet staan, gaat dat
   bord niet lezen.

   TWEE LIJSTEN, EN DAT IS GEEN OPMAAK. Een bar werkt op twee assen tegelijk die
   met elkaar vechten:

     DE RONDE -- vier mensen proosten samen, dus een ronde moet samen landen.
     DE STAPEL -- drie gin-tonics over twee tafels zijn EEN handeling: een keer
     de gin pakken, drie glazen naast elkaar.

   Het scherm lost die botsing niet op, want dat zou een volgorde verzinnen. Het
   toont ze allebei: bovenaan wat er samen gemaakt kan worden, daaronder de
   ronden op wachttijd. De barman ziet wat er moet en wat er samen kan, en
   beslist zelf. Zelfde grens als de drukterem: het systeem rekent, de mens
   bepaalt.

   DRIE DINGEN DIE HIER ZICHTBAAR BLIJVEN:

   1. ER STAAT GEEN GRENS OP HOE LANG EEN DRANKJE MAG STAAN. IJs smelt en schuim
      zakt, dus die grens is echt -- maar hij is nergens vastgelegd, en hem hier
      verzinnen zou een getal maken dat niemand gemeten heeft (HORECA.md, grens
      7). Wat er wel staat is hoeveel minuten het eerste glas al wacht.
   2. DE STOEL STAAT OP HET GLAS. Een barman zet vier glazen op een blad; wie
      niet weet welk glas waar heen gaat, laat de bediening raden.
   3. HET SCHERM VINKT NIETS AF. "Aangezet" en "klaar" zijn dezelfde deur als
      bij de keuken (/keuken/stand), zodat er nooit twee wegen zijn waarlangs een
      glas op klaar komt te staan. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  if (!K.poort()) return;
  var esc = K.esc, api = K.api, meld = K.meld;

  function $(id) { return document.getElementById(id); }

  var VOLGENDE = { besteld: 'gestart', gestart: 'klaar', bereid: 'klaar' };
  var KNOP = { besteld: 'Aanzetten', gestart: 'Klaar', bereid: 'Klaar' };

  function regel(g, r) {
    var naar = VOLGENDE[r.stand];
    return '<li><span>' + esc(r.aantal + 'x ' + r.naam) + '</span>' +
      '<em>' + esc(r.stoel || 'de tafel') + '</em>' +
      (r.allergie ? '<span class="b-allergie">' + esc(r.allergie) + '</span>' : '') +
      (r.notitie ? '<em>' + esc(r.notitie) + '</em>' : '') +
      '<span class="h-flex1"></span>' +
      (naar ? '<button class="knop' + (r.stand === 'besteld' ? '' : ' p') + '" data-zet="' + esc(r.regelId) +
        '" data-rek="' + esc(g.rekeningId) + '" data-naar="' + naar + '">' + KNOP[r.stand] + '</button>'
        : '<em>staat klaar</em>') + '</li>';
  }

  function teken(d) {
    $('bOpen').textContent = d.open;
    $('bStaat').textContent = d.staat;
    $('bGolven').textContent = d.golven.length;
    $('bUitleg').textContent = d.let || '';

    $('bStapel').innerHTML = d.stapel.length ? d.stapel.map(function (x) {
      return '<div><b>' + x.aantal + 'x ' + esc(x.naam) + '</b><small>' +
        esc(x.tafels.join(', ')) + '</small></div>';
    }).join('') : '<p class="b-leeg">Niets te maken.</p>';

    $('bGolvenLijst').innerHTML = d.golven.length ? d.golven.map(function (g) {
      return '<article class="b-golf' + (g.staat > 0 ? ' wacht' : '') + '">' +
        '<div class="b-golfkop"><span class="b-tafel">' + esc(g.tafel) + '</span>' +
        (g.gang ? '<span>gang ' + g.gang + '</span>' : '') +
        '<span class="b-min">' + g.sinds + ' min</span></div>' +
        (g.staat > 0
          ? '<p class="b-voet" style="margin:.3rem 0 0;">Het eerste glas staat ' + g.staat +
            ' min te wachten op de rest van deze ronde.</p>'
          : (g.compleet ? '<p class="b-voet" style="margin:.3rem 0 0;">Compleet; wacht op een drager (zie de pas).</p>' : '')) +
        '<ul class="b-regels">' + g.regels.map(function (r) { return regel(g, r); }).join('') + '</ul>' +
        '</article>';
    }).join('') : '<p class="b-leeg">Geen open ronden. Wat de zaal niet heeft vrijgegeven, staat hier niet.</p>';

    /* AANZETTEN EN KLAAR MELDEN GAAN VIA DE OFFLINE-LAAG, ook als er gewoon
       verbinding is. Dat is geen omweg maar de enige manier waarop het achter de
       toog betrouwbaar is: een barman kan niet eerst uitzoeken of het netwerk
       het doet, en een glas dat "klaar" is gemeld maar nooit aankwam, is een
       glas dat niemand komt halen.

       De serverkant VOEGT SAMEN in plaats van te herhalen, met één regel: een
       stand gaat nooit achteruit. Wat geweigerd wordt komt met de reden terug --
       en die zetten we hier op het scherm, want het scherm hoort te weten dat
       zijn beeld het heeft verloren (kern/horeca/samenvoegen.js). */
    K.bind($('bGolvenLijst'), 'zet', function (b) {
      window.RTGHorecaEdge.handel({
        clientId: (window.RTGId ? RTGId('bar') : 'bar-' + Date.now()),
        soort: 'stand', rekeningId: b.getAttribute('data-rek'),
        regelId: b.getAttribute('data-zet'), naar: b.getAttribute('data-naar')
      }).then(function (r) {
        if (r && r.gewacht) {
          meld('Geen lijn. Dit staat op de tap en gaat weg zodra de verbinding terug is.');
        } else {
          var u = (r && r.uitkomsten && r.uitkomsten[0]) || {};
          if (u.stand === 'geweigerd') meld(u.reden || 'Dat kon niet meer.');
        }
        haal();
      }, function (e) { meld(e.message || 'Er ging iets mis.'); });
    });
  }

  function haal() {
    return api('/bar', {}).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      teken(r.body);
    });
  }

  /* De strook die zegt hoeveel handelingen er op dit toestel staan. Zonder die
     strook is een wachtrij een geheim, en dan gaat iemand ervan uit dat het
     verstuurd is. */
  function toonEdge(stand) {
    var el = $('bEdgeStrook');
    if (!el) return;
    if (!stand.wacht && !stand.vast) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    var t = [];
    if (stand.wacht) t.push(stand.wacht + ' handeling(en) staan op dit toestel en gaan weg zodra er verbinding is.');
    if (stand.vast) t.push(stand.vast + ' liep vast; de server wilde ze niet.');
    el.textContent = t.join(' ');
  }
  if (window.RTGHorecaEdge) RTGHorecaEdge.zetHandeling(K.token, toonEdge);

  $('bVerversNu').addEventListener('click', haal);
  // dezelfde duwstroom als de keuken: een gang die de zaal vrijgeeft hoort hier
  // meteen te staan, zonder dat iemand op "ververs" drukt
  K.luister('keuken', haal);
  K.luister('horeca', haal);
  haal();
})();

/* RTG Horeca (scherm): de zaal -- open rekeningen, een regel erop, een gang
   vrijgeven, splitsen en afrekenen.

   Wie er aan tafel zit staat in horeca/gezelschap.js: dat is een ander
   onderwerp, en samen paste het niet meer binnen de modulemaat van dit huis.
   Dit bestand vraagt daar de keuzelijst "voor wie" op en laat het zichzelf
   tekenen.

   DRIE DINGEN DIE DIT SCHERM EXPRES LAAT ZIEN en die in de meeste kassa's
   verstopt zitten:

   - DE LIJSTPRIJS naast de kortingsprijs, zodat een gast kan zien wat er van de
     kaart af ging.
   - BIJ HET SPLITSEN de som van de delen naast het totaal. Dat is geen sier:
     het is de bewering die de server ook doet, en als hij hier niet klopt,
     klopt er iets niet.
   - VOOR WIE EEN REGEL IS, naast de regel zelf en niet in een menu eronder.
     Het is de vraag die de bediening aan tafel het vaakst moet corrigeren
     ("nee, de zeebaars was voor mij"). */
(function () {
  'use strict';
  var huidig = null;

  function $(id) { return document.getElementById(id); }
  var esc = function (t) { return window.RTGHoreca.esc(t); };
  var euro = function (c) { return window.RTGHoreca.euro(c); };
  var api = function (p, b) { return window.RTGHoreca.api(p, b); };
  var meld = function (t) { window.RTGHoreca.meld(t); };
  var G = function () { return window.RTGHorecaGezelschap; };
  var A = function () { return window.RTGHorecaActies; };

  function laad() {
    api('/rekeningen', { status: 'open' }).then(function (r) {
      var d = r.body;
      if (d.error) return meld(d.error);
      $('zLijst').innerHTML = (d.rekeningen || []).map(function (x) {
        return '<div class="item"><span><b>' + esc(x.tafel || x.kanaal) + '</b>' +
          ' <span class="stil">· ' + x.regels + ' regel(s) · ' + x.gasten + ' gast(en)</span></span>' +
          '<span class="rij"><span class="stil">' + euro(x.totalen.netto) + '</span>' +
          '<button class="knop" data-open="' + esc(x.id) + '">Openen</button></span></div>';
      }).join('') || '<p class="stil">Er staat niets open.</p>';
      window.RTGHoreca.bind($('zLijst'), 'open', function (b) { toon(b.getAttribute('data-open')); });
      if (huidig) toon(huidig, true);
    });
  }

  function toon(id, stil) {
    api('/rekening', { rekeningId: id }).then(function (r) {
      if (r.body.error) { huidig = null; $('zDetailKaart').hidden = true; if (!stil) meld(r.body.error); return; }
      var rek = r.body.rekening;
      huidig = rek.id;
      $('zDetailKaart').hidden = false;
      $('zDetailKop').textContent = (rek.tafel || rek.kanaal) + ' · ' + rek.gasten + ' gast(en)';
      /* Eerst het gezelschap, dan de regels: de keuzelijst naast een regel komt
         uit het gezelschap, dus die moet geladen zijn voor we regels tekenen. */
      A().zet(rek.id);
      api('/gezelschap', { rekeningId: rek.id }).then(function (g) {
        if (!g.body.error) G().teken(rek.id, g.body.gezelschap, rek.verdeling);
        tekenRegels(rek);
      });
    });
  }

  function tekenRegels(rek) {
    $('zDetail').innerHTML = (rek.regels || []).map(function (x) {
      return '<div class="item"><span>' + x.aantal + '× ' + esc(x.naam) +
        (x.gang ? ' <span class="tag">gang ' + x.gang + '</span>' : '') +
        (x.station ? ' <span class="tag">' + esc(x.station) + '</span>' : '') +
        (x.allergie ? ' <span class="allergie">' + esc(x.allergie) + '</span>' : '') +
        (x.vrijAt ? ' <span class="tag aan">' + esc(x.stand) + '</span>' : ' <span class="tag">niet vrijgegeven</span>') +
        '</span><span class="rij">' +
        '<select class="veld" aria-label="Voor wie is ' + esc(x.naam) + '" data-regelstoel="' + esc(x.id) + '">' +
        G().opties(x.gastNr) + '</select>' +
        /* ERAF KAN ALLEEN ZOLANG DE KEUKEN ER NIET AAN BEGON. Daarna is het
           derving, en dat is een andere knop met een reden -- de server weigert
           het ook. Die grens hoort op het scherm te staan en niet pas in een
           foutmelding. */
        (x.stand === 'besteld'
          ? '<button class="knop" data-regelweg="' + esc(x.id) + '" aria-label="Haal ' + esc(x.naam) + ' van de rekening">Eraf</button>'
          : '') +
        '<span class="stil">' + euro(x.centen * x.aantal) +
        (x.happy ? ' <span class="tag">' + esc(x.happy) + ', van ' + euro(x.lijstprijs) + '</span>' : '') +
        '</span></span></div>';
    }).join('') || '<p class="stil">Nog niets besteld.</p>';

    $('zDetail').insertAdjacentHTML('beforeend',
      '<div class="item"><span><b>Te betalen</b></span><span class="stil"><b>' + euro(rek.totalen.teBetalen) + '</b>' +
      (rek.totalen.korting ? ' (korting ' + euro(rek.totalen.korting) + ')' : '') +
      (rek.totalen.fooi ? ' · fooi ' + euro(rek.totalen.fooi) : '') + '</span></div>');

    window.RTGHoreca.bind($('zDetail'), 'regelweg', function (b) {
      api('/rekening/regel/weg', { rekeningId: huidig, regelId: b.getAttribute('data-regelweg') })
        .then(function (r) {
          if (r.body.error) return meld(r.body.error);
          meld('Van de rekening gehaald.');
          toon(huidig, true);
        });
    });

    Array.prototype.forEach.call($('zDetail').querySelectorAll('[data-regelstoel]'), function (sel) {
      sel.addEventListener('change', function () {
        api('/rekening/regel/stoel', { rekeningId: huidig, regelId: sel.getAttribute('data-regelstoel'), nr: sel.value })
          .then(function (r) {
            if (r.body.error) return meld(r.body.error);
            meld(r.body.handle ? 'Staat nu op ' + r.body.handle + '.' : 'Staat nu op de tafel.');
            toon(huidig, true);
          });
      });
    });
  }

  function bind() {
    G().bind();
    G().bijWijziging = function () { if (huidig) toon(huidig, true); };
    /* De handelingen OP een rekening staan in horeca/rekeningacties.js: dat is
       een ander onderwerp (geld en tafels, niet bestellen), en samen paste het
       niet meer binnen de modulemaat van dit huis. `opnieuw` zegt of de hele
       lijst moet herladen -- na splitsen of afrekenen bestaat deze rekening
       niet meer zoals hij was. */
    A().bind();
    A().bijWijziging = function (opnieuw) {
      if (opnieuw) { huidig = null; laad(); return; }
      laad();
    };

    $('zOpen').addEventListener('click', function () {
      api('/rekening/open', { kanaal: $('zKanaal').value, tafel: $('zTafel').value.trim(),
        gasten: Number($('zGasten').value) || 1 }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        $('zTafel').value = '';
        huidig = r.body.rekening.id;
        laad();
      });
    });
    $('zRegel').addEventListener('click', function () {
      if (!huidig) return meld('Open eerst een rekening.');
      var naam = $('zNaam').value.trim();
      if (!naam) return meld('Wat wordt er besteld?');
      api('/rekening/regel', { rekeningId: huidig, naam: naam, prijs: Number($('zPrijs').value) || 0,
        aantal: Number($('zAantal').value) || 1, gang: Number($('zGang').value) || 0,
        station: $('zStation').value.trim(), allergie: $('zAllergie').value.trim(),
        // leeg = voor de tafel; de server maakt er null van
        gastNr: $('zVoor').value || null }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        $('zNaam').value = ''; $('zPrijs').value = ''; $('zAllergie').value = '';
        /* De stoel blijft staan: wie een gang opneemt, blijft meestal even bij
           dezelfde persoon. Leegmaken zou elke tweede regel weer op de tafel
           zetten. */
        laad();
      });
    });
    /* EEN GANG VRIJGEVEN GAAT VIA DE OFFLINE-LAAG, ook als er gewoon verbinding
       is. Een PDA in een dode hoek van de kelder is geen storing van de zaak:
       de keuken kan online staan terwijl dit toestel dat niet is, en dan hoort
       de gang aan te komen zodra de bediening weer in bereik loopt.

       De serverkant VOEGT SAMEN in plaats van te herhalen: wat al vrij is
       blijft vrij (kern/horeca/samenvoegen.js). Een tweede tik verandert dus
       niets en is geen fout. */
    $('zVrij').addEventListener('click', function () {
      if (!huidig) return meld('Open eerst een rekening.');
      window.RTGHorecaEdge.handel({
        clientId: RTGId('vrij'),
        soort: 'gangvrij', rekeningId: huidig, gang: Number($('zVrijGang').value) || 0,
        serveerOm: $('zServeerOm').value.trim()
      }).then(function (r) {
        if (r && r.gewacht) {
          meld('Geen lijn. De gang staat op dit toestel en gaat naar de keuken zodra er verbinding is.');
          return;
        }
        var u = (r && r.uitkomsten && r.uitkomsten[0]) || {};
        if (u.stand === 'geweigerd') meld(u.reden || 'Dat kon niet.');
        else if (u.stand === 'al-gedaan') meld(u.reden || 'Stond al bij de keuken.');
        else meld((u.vrijgegeven || 0) + ' regel(s) naar de keuken.');
        laad();
      }, function (e) { meld(e.message || 'Er ging iets mis.'); });
    });
    /* De zaal luistert mee op dezelfde stroom als de keuken: schuift er een
       gast aan met de QR, dan staat hij hier zonder dat iemand ververst. */
    window.RTGHoreca.luister('horeca', function () {
      if (!document.hidden && huidig) toon(huidig, true);
    });
  }

  /* De strook die zegt hoeveel gangen er op dit toestel staan. Zonder die strook
     is een wachtrij een geheim, en dan gaat iemand ervan uit dat de keuken het
     heeft. */
  function toonEdge(stand) {
    var el = $('zEdgeStrook');
    if (!el) return;
    if (!stand.wacht && !stand.vast) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    var t = [];
    if (stand.wacht) t.push(stand.wacht + ' handeling(en) staan op dit toestel en gaan weg zodra er verbinding is.');
    if (stand.vast) t.push(stand.vast + ' liep vast; de server wilde ze niet.');
    el.textContent = t.join(' ');
  }
  if (window.RTGHorecaEdge) RTGHorecaEdge.zetHandeling(window.RTGHoreca.token, toonEdge);

  window.RTGHorecaZaal = { bind: bind, laad: laad };
})();

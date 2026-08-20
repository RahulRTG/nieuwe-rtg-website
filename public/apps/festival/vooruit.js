/* RTG Festival, het scherm: HET BLAD "VOORUIT".

   WAT ER HOORT TE STAAN, WAT ER STAAT, EN HOE LANG HET LEEGLOPEN DUURT. Alle
   drie gerekend op getallen die een mens heeft gezet (kern/festival/norm.js) of
   die gemeten zijn (de scans). Er staat op dit blad geen enkel getal dat de
   software zelf heeft bedacht, en dat is de reden dat het er zo kaal uitziet.

   DE NORM WORDT HIER GEZET EN NIET OP INRICHTEN, want dit is het scherm waar je
   ziet wat hij doet. Een norm die je invult op een ander blad dan waar de
   uitkomst staat, wordt een keer ingevuld en daarna nooit meer bijgesteld.

   DE TIJDLIJN STAAT ONDERAAN, bij het geheugen en niet op een eigen blad. Ze
   kijken allebei terug: het geheugen zegt wat een dag heeft opgeleverd, de
   tijdlijn waar dat uit blijkt. Een eigen knop in de bank zou een tiende maken,
   en dan wordt op een telefoon elk raakvlak in die balk weer een stukje kleiner.

   HET AFSLUITEN VAN DE DAG STAAT ERONDER, en dat is met opzet het laatste dat
   je op dit blad tegenkomt: het is het einde van de avond. Wat er dan wordt
   vastgelegd, verandert daarna niet meer mee (kern/festival/geheugen.js). */
(function () {
  'use strict';
  var F = window.RTGFestival;
  if (!F) return;

  var $ = function (s) { return document.querySelector(s); };

  function regel(lijst, sig, kop, rechts) {
    var d = document.createElement('div');
    d.className = 'fp-regel';
    if (sig) d.setAttribute('data-sig', sig);
    var s = document.createElement('span');
    s.textContent = kop;
    d.appendChild(s);
    if (rechts) {
      var r = document.createElement('span');
      r.className = 'rek';
      r.textContent = rechts;
      d.appendChild(r);
    }
    lijst.appendChild(d);
    return d;
  }

  function meld(t) { $('#vuStil').textContent = t; }

  function tekenVraag(b) {
    var lijst = $('#vuVraag');
    lijst.textContent = '';
    var gatOp = {};
    (b.gaten || []).forEach(function (g) { gatOp[g.plek] = g; });
    if (!(b.vraag || []).length) {
      regel(lijst, null, 'Er staat nog geen norm op deze editie.',
        'zonder norm valt er niets te vergelijken');
      return;
    }
    (b.vraag || []).forEach(function (v) {
      var gat = gatOp[v.plek];
      var rechts = v.wat === 'mensen'
        ? (gat ? gat.staat + ' van de ' + v.nodig : v.nodig + ' van de ' + v.nodig)
        : v.nodig + ' ' + v.wat;
      /* WAAROP GEREKEND IS, staat erbij. "Vier man" is een mededeling; "vier
         man, gerekend op 250 in Zone Noord" is na te rekenen. */
      var uitleg = v.plekNaam + ' · ' + v.wat
        + (v.per100 ? ' · ' + v.vast + ' vast plus ' + v.per100 + ' per 100 van '
          + v.aanwezig + ' in ' + v.gemetenOp : ' · vast');
      regel(lijst, gat ? 'hoog' : null, uitleg, rechts);
    });
  }

  function tekenLeeg(b) {
    var el = $('#vuLeeg');
    var l = b.leegloop;
    if (!l) { el.textContent = 'Er loopt nu geen festivaldag.'; return; }
    el.textContent = l.zin;
    el.setAttribute('data-sig', l.bekend && l.past === false ? 'hoog' : '');
  }

  function herlaad() {
    if (!F.staat.fid) return Promise.resolve();
    return F.api('/api/festival/vooruit', { festival: F.staat.fid, editie: F.staat.eid })
      .then(function (r) {
        var b = r.body || {};
        if (b.error) { meld(b.error); return; }
        if (b.geenDag) {
          $('#vuKop').textContent = 'Er loopt nu geen festivaldag.';
          $('#vuVraag').textContent = '';
          tekenLeeg(b);
          meld('Buiten de openingstijden staat hier niets. De normen hieronder blijven wel te zetten.');
        } else {
          var gaten = (b.gaten || []).length;
          $('#vuKop').textContent = gaten
            ? gaten + (gaten === 1 ? ' plek staat te dun' : ' plekken staan te dun')
            : 'Overal staat wat er hoort te staan.';
          tekenVraag(b);
          tekenLeeg(b);
        }
        return F.api('/api/festival/normen', { festival: F.staat.fid, editie: F.staat.eid });
      })
      .then(function (r) {
        if (!r) return;
        var lijst = $('#vuNormen');
        lijst.textContent = '';
        ((r.body || {}).normen || []).forEach(function (n) {
          var d = regel(lijst, null, n.plekNaam + ' · ' + n.wat + ' · ' + n.van + '-' + n.tot,
            n.vast + (n.per100 ? ' + ' + n.per100 + '/100' : ''));
          var weg = document.createElement('button');
          weg.type = 'button';
          weg.className = 'knop';
          weg.textContent = 'Weg';
          weg.addEventListener('click', function () {
            F.api('/api/festival/norm/weg', { festival: F.staat.fid, editie: F.staat.eid, id: n.id })
              .then(herlaad);
          });
          d.appendChild(weg);
        });
      })
      .catch(function () { meld('Geen verbinding.'); });
  }

  $('#vuNormZet').addEventListener('click', function () {
    F.api('/api/festival/norm', { festival: F.staat.fid, editie: F.staat.eid,
      plek: $('#vuPlek').value, wat: $('#vuWat').value.trim() || 'mensen',
      vast: $('#vuVast').value, per100: $('#vuPer100').value,
      van: $('#vuVan').value.trim(), tot: $('#vuTot').value.trim(),
      dag: $('#vuDag').value || null }).then(function (r) {
      var b = r.body || {};
      if (!b.ok) { meld(b.error || 'Dat lukte niet.'); return; }
      meld('Norm gezet.');
      herlaad();
    });
  });

  /* AFSLUITEN VRAAGT EEN TWEEDE DRUK. Niet omdat het gevaarlijk is, maar omdat
     het definitief is: wat er wordt vastgelegd, beweegt daarna niet meer mee. */
  var bevestig = false;
  $('#vuSluit').addEventListener('click', function () {
    var dagId = $('#vuSluitDag').value;
    if (!dagId) { meld('Kies welke dag u afsluit.'); return; }
    if (!bevestig) {
      bevestig = true;
      $('#vuSluit').textContent = 'Zeker weten? Dit legt de dag vast';
      return;
    }
    bevestig = false;
    $('#vuSluit').textContent = 'Sluit de dag af';
    F.api('/api/festival/dag/sluiten', { festival: F.staat.fid, editie: F.staat.eid, dag: dagId })
      .then(function (r) {
        var b = r.body || {};
        if (!b.ok) { meld(b.error || 'Dat lukte niet.'); return; }
        meld('Afgesloten door ' + b.afdruk.door + '. ' + b.afdruk.passenBinnen + ' van de '
          + b.afdruk.passenGeldig + ' geldige passen zijn binnen geweest.');
        return geheugen();
      });
  });

  function geheugen() {
    return F.api('/api/festival/geheugen', { festival: F.staat.fid, editie: F.staat.eid })
      .then(function (r) {
        var b = r.body || {}, lijst = $('#vuGeheugen');
        lijst.textContent = '';
        if (!b.ok) { $('#vuTerug').textContent = b.error || ''; return; }
        $('#vuTerug').textContent = b.zin;
        (b.nu.dagen || []).forEach(function (d) {
          var piek = (d.piek.plekken || [])[0];
          regel(lijst, null, d.datum + ' · ' + d.passenBinnen + ' van de ' + d.passenGeldig
            + ' passen binnen' + (piek ? ' · piek ' + piek.aantal + ' op ' + piek.naam : ''),
            d.opkomst === null ? '' : d.opkomst + '%');
        });
        if (b.nu.nogOpen) {
          regel(lijst, null, b.nu.nogOpen + (b.nu.nogOpen === 1 ? ' dag is nog niet afgesloten'
            : ' dagen zijn nog niet afgesloten'), 'daar staat dus nog niets van vast');
        }
      });
  }

  function tekenLijn() {
    var lijst = $('#vuLijn');
    lijst.textContent = '';
    if (!F.staat.fid) return Promise.resolve();
    var soort = $('#vuLijnSoort').value;
    return F.api('/api/festival/tijdlijn', { festival: F.staat.fid, editie: F.staat.eid,
      dag: $('#vuLijnDag').value || null, soorten: soort ? [soort] : null })
      .then(function (r) {
        var b = r.body || {};
        if (!b.ok) { $('#vuLijnStil').textContent = b.error || ''; return; }
        b.gebeurtenissen.forEach(function (g) {
          regel(lijst, null, g.zin + (g.door ? ' \u00b7 ' + g.door : ''),
            String(g.op).slice(5, 16).replace('T', ' '));
        });
        /* GEEN STILLE AFKAPPING: wat er niet staat, staat er wel bij. */
        $('#vuLijnStil').textContent = b.aantal
          ? b.aantal + ' gebeurtenissen'
            + (b.meer ? ', waarvan ' + b.meer + ' niet getoond -- kies een dag of een soort om te knijpen.' : '.')
          : 'Er is op deze editie nog niets vastgelegd.';
      });
  }

  $('#vuLijnDag').addEventListener('change', tekenLijn);
  $('#vuLijnSoort').addEventListener('change', tekenLijn);

  F.opBlad('vooruit', function () {
    var plekken = F.staat.plekken.map(function (p) { return { value: p.id, tekst: p.naam }; });
    var dagen = (F.staat.dagen || []).map(function (d) { return { value: d.id, tekst: d.datum }; });
    if (F.inr) {
      F.inr.vulKeuze($('#vuPlek'), plekken);
      F.inr.vulKeuze($('#vuDag'), dagen, 'elke dag');
      F.inr.vulKeuze($('#vuSluitDag'), dagen, 'kies een dag');
      F.inr.vulKeuze($('#vuLijnDag'), dagen, 'de hele editie');
    }
    herlaad();
    geheugen();
    tekenLijn();
  });
})();

/* RTG Festival, de gastenkant: DE GROEP.

   Afgesplitst van festival-gast.js op de bestandsgrens, langs de naad die de
   kern ook heeft: daar staat wat u HEEFT en wat er OP is, hier staat wat er
   tussen mensen gebeurt.

   ER GAAT HIER NIETS DE DEUR UIT. Geen uitnodiging, geen herinnering, geen
   melding aan een ander lid (kern/festival/groep.js). Wie meedoet, doet dat
   zelf met een code die hij van een mens heeft gekregen -- en `zonderPas` is een
   getal en geen aansporing: er komt geen knop bij en geen tekst die iemand
   ergens toe aanzet. */
(function () {
  'use strict';
  var G = window.RTGGast;
  if (!G) return;
  var api = G.api, staat = G.staat, regel = G.regel, $ = G.$, start = G.start;

  function tekenGroepen() {
    var lijst = $('fgGroepen');
    lijst.textContent = '';
    return api('/api/festival/groep/mijn', { festival: staat.fid, editie: staat.eid })
      .then(function (res) {
        var groepen = ((res.body || {}).groepen) || [];
        if (!groepen.length) { regel(lijst, 'U zit nog in geen enkele groep.', ''); return; }
        return Promise.all(groepen.map(function (g) {
          return api('/api/festival/groep/stand', { festival: staat.fid, editie: staat.eid, id: g.id })
            .then(function (r) {
              var s = r.body || {};
              if (!s.ok) return;
              var d = regel(lijst, s.naam + ' · ' + s.leden.length
                + (s.leden.length === 1 ? ' lid' : ' leden')
                /* `zonderPas` is een GETAL en geen aansporing: er komt hier geen
                   knop bij en geen tekst die iemand ergens toe aanzet. */
                + (s.zonderPas ? ' · ' + s.zonderPas + ' zonder pas' : ''), 'code ' + s.code);
              var weg = document.createElement('button');
              weg.type = 'button';
              weg.className = 'knop';
              weg.textContent = 'Uit de groep';
              weg.addEventListener('click', function () {
                api('/api/festival/groep/weg', { festival: staat.fid, editie: staat.eid, id: g.id })
                  .then(tekenGroepen);
              });
              d.appendChild(weg);
            });
        }));
      });
  }

  $('fgGroepMaak').addEventListener('click', function () {
    api('/api/festival/groep', { festival: staat.fid, editie: staat.eid,
      naam: $('fgGroepNaam').value.trim() }).then(function (r) {
      var b = r.body || {};
      if (!b.ok) { $('fgGroepStil').textContent = b.error || 'Dat lukte niet.'; return; }
      $('fgGroepNaam').value = '';
      tekenGroepen();
    });
  });

  /* MEEDOEN WERKT OOK ALS U NOG NIETS HEEFT, en dat is geen detail: dit is het
     eerste dat er gebeurt. Iemand regelt de kaarten, de rest krijgt een code.
     Wie nog geen pas heeft, ziet nog geen festival -- dus wordt hier bewust
     GEEN festival meegestuurd als er nog geen gekozen is, en leidt de server de
     editie uit de code af (routes/festival/groep.js).

     Dat het scherm dit gat had, bleek pas in de browser: in de toetsen bestond
     de editie altijd al. */
  $('fgGroepMee').addEventListener('click', function () {
    var lijf = { code: $('fgGroepCode').value.trim() };
    if (staat.fid) { lijf.festival = staat.fid; lijf.editie = staat.eid; }
    api('/api/festival/groep/mee', lijf).then(function (r) {
      var b = r.body || {};
      if (!b.ok) { $('fgGroepStil').textContent = b.error || 'Dat lukte niet.'; return; }
      $('fgGroepCode').value = '';
      /* Was dit de eerste band met een festival, dan verschijnt het nu pas in de
         keuzelijst. Opnieuw ophalen dus, en niet zelf iets bijtekenen. */
      if (!staat.fid) { start(); return; }
      tekenGroepen();
    });
  });


  /* Er wordt hier NIET meteen getekend. Zolang er geen editie gekozen is, valt
     er niets op te halen; festival-gast.js roept dit aan zodra die er is. Een
     ronde met een lege editie levert alleen een 404 op in de console -- en een
     scherm dat bij het openen al iets stuks doet, went. */
  window.RTGGastGroep = { teken: tekenGroepen };
})();

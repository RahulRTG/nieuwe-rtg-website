/* RTG Media -- de luisterkamer: samen luisteren en kijken.

   De kamer deelt de AANWIJZER en niet het geluid. De gastheer zegt: dit stuk,
   op deze seconde, spelend of stil; iedereen speelt dat af met zijn eigen
   middelen (de klankmotor hier, de stroom uit het Theater, het datakanaal van
   Clips). Dat is niet een beperking maar de enige eerlijke vorm -- bij twee van
   de vier vormen is de bron het toestel van de maker en niet RTG.

   WAT DIT SCHERM DAAROM NIET BELOOFT: dat u allemaal precies hetzelfde hoort.
   Wat het wel doet, is bij iedere deelnemer zeggen of het stuk voor HEM opengaat
   -- en zo niet, waarom niet. Die zin komt van de server (kern/mediaos/
   samen.js), die de wereld van de kijker leest en niet die van de gastheer.

   Aparte lijn met de server: de kamer komt over de gewone live-lijn
   (/api/stream), dezelfde die de rest van het huis gebruikt. Er is dus geen
   tweede verbinding voor dit ene ding. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var M = window.RTGMediaOS;
  var B = window.RTGMediaBlad;
  var kamer = null;          // de kamer waar ik nu in zit (het beeld van de server)
  var es = null;

  function open(bouw) { B.vlak(bouw); }

  function lijn() {
    if (es || !window.EventSource || !M.token()) return;
    es = new EventSource('/api/stream?token=' + encodeURIComponent(M.token()));
    es.addEventListener('mediasamen', function (e) {
      var d = JSON.parse(e.data);
      if (d.kind === 'uitnodiging') { M.zeg(d.van + ' nodigt u uit in een luisterkamer.'); return; }
      if (!kamer || d.kamerId !== kamer.id) return;
      if (d.kind === 'einde') { M.zeg('De gastheer heeft de kamer gesloten.'); kamer = null; return; }
      /* Bij elke verandering opnieuw ophalen in plaats van het beeld hier bij
         te werken: wat er voor MIJ speelbaar is, weet alleen de server. Zelf
         een stand bijhouden zou een tweede waarheid zijn. */
      erin(kamer.id, true);
    });
  }

  function teken() {
    open(function (vlak) {
      var k = kamer;
      vlak.appendChild(M.el('h3', null, 'Luisterkamer van ' + k.gastheer));
      vlak.appendChild(M.el('p', 'stil', k.uitleg));
      vlak.appendChild(M.el('p', 'stil', 'In de kamer: ' + (k.mensen.join(', ') || 'alleen u')));

      if (k.stand && k.stuk) {
        var kaart = M.el('div', 'kader');
        kaart.appendChild(M.el('b', null, k.stuk.titel));
        kaart.appendChild(M.el('p', 'stil', k.stuk.maker.codenaam + ' · vanaf seconde ' + k.stand.positieS +
          (k.stand.spelend ? '' : ' (stil)')));
        kaart.appendChild(M.knop('▶ Speel mee', 'vol', function () { M.speel(k.stuk); }));
        vlak.appendChild(kaart);
      } else if (k.stand) {
        /* Niet speelbaar: de reden komt van de server en wordt hier niet
           herschreven. Een zwart vlak zonder uitleg is precies wat dit huis
           niet doet (LAT.md regel 5). */
        var uit = M.el('div', 'kader');
        uit.appendChild(M.el('b', null, 'Dit stuk gaat voor u niet open'));
        uit.appendChild(M.el('p', 'stil', k.reden));
        vlak.appendChild(uit);
      } else {
        vlak.appendChild(M.el('p', 'stil', k.reden));
      }

      if (k.ikGastheer) {
        var beheer = M.el('div', 'kader');
        beheer.appendChild(M.el('b', null, 'U bent de gastheer'));
        beheer.appendChild(M.el('p', 'stil', 'Wat u aanwijst, wijst iedereen aan. Uitnodigen kan alleen wie u kent.'));
        var veld = document.createElement('input');
        veld.id = 'samenNodig'; veld.maxLength = 60; veld.placeholder = 'Codenaam van wie u uitnodigt';
        beheer.appendChild(veld);
        beheer.appendChild(M.knop('Nodig uit', '', function () {
          M.api('samen/nodig', { id: k.id, codenaam: veld.value }).then(function (r) {
            if (r.error) return M.zeg(r.error);
            kamer = r.kamer; M.zeg('Uitgenodigd.'); teken();
          });
        }));
        if (k.genodigd.length) beheer.appendChild(M.el('p', 'stil', 'Uitgenodigd: ' + k.genodigd.join(', ')));
        beheer.appendChild(M.knop('Sluit de kamer', 'rood', function () {
          M.api('samen/uit', { id: k.id }).then(function () { kamer = null; M.zeg('Kamer gesloten.'); B.dicht(); });
        }));
        vlak.appendChild(beheer);
      } else {
        vlak.appendChild(M.knop('Verlaat de kamer', '', function () {
          M.api('samen/uit', { id: k.id }).then(function () { kamer = null; M.zeg('U bent uit de kamer.'); B.dicht(); });
        }));
      }
    });
  }

  function erin(id, stil) {
    return M.api('samen/in', { id: id }).then(function (r) {
      if (r.error) { kamer = null; return M.zeg(r.error); }
      kamer = r.kamer; lijn();
      if (!stil) teken(); else if (!$('#lade').classList.contains('open')) return; else teken();
    });
  }

  /* Een kamer beginnen bij een stuk: de gastheer wijst het meteen aan, zodat er
     iets te horen valt zodra de eerste gast binnenkomt. */
  function start(stukId) {
    M.api('samen/start', {}).then(function (r) {
      if (r.error) return M.zeg(r.error);
      kamer = r.kamer; lijn();
      if (!stukId) return teken();
      M.api('samen/zet', { id: kamer.id, stukId: stukId, positieS: 0 }).then(function (z) {
        if (z.error) return M.zeg(z.error);
        kamer = z.kamer; teken();
      });
    });
  }
  function mijn() {
    M.api('samen/mijn', {}).then(function (d) {
      if (d.error) return M.zeg(d.error);
      open(function (vlak) {
        vlak.appendChild(M.el('h3', null, 'Luisterkamers'));
        vlak.appendChild(M.el('p', 'stil', d.uitleg));
        if (!d.kamers.length) vlak.appendChild(M.el('p', 'stil', 'Er loopt nu geen kamer voor u.'));
        d.kamers.forEach(function (k) {
          var r = M.el('div', 'rij');
          r.appendChild(M.el('span', 'stil', (k.ikGastheer ? 'Uw kamer' : 'Kamer van ' + k.gastheer) +
            ' · ' + k.mensen + ' aanwezig'));
          r.appendChild(M.knop('Ga erin', 'vol', function () { erin(k.id); }));
          vlak.appendChild(r);
        });
        vlak.appendChild(M.knop('Begin een kamer', '', function () { start(null); }));
      });
    });
  }

  var sk = $('#samenKnop');
  if (sk) sk.addEventListener('click', mijn);
  lijn();
  window.RTGMediaSamen = { start: start, mijn: mijn, erin: erin };
})();

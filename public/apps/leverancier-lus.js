/* De ZAAK in de concierge-lus (CONCIERGE.md par. 0a en 2.7): de opdrachten die
   De Rechterhand bij deze zaak heeft uitgezet, op Vandaag in de leverancier-app
   (apps/leverancier.html, eigenaar van zaak.beheer in SCHERMEIGENAAR.json).
   Geen tweede scherm en geen eigen tabblad: een kaart op het overzicht, die
   alleen verschijnt als er iets is.

   Drie dingen die dit scherm niet zelf beslist:

   1. WAT DE ZAAK ZIET. De server geeft per onderdeel een positieve lijst velden
      (kern/bureau/lus-regels.js deelnemerBeeld): geen codenaam, geen hotelkamer,
      geen andere leverancier. Dit scherm toont die velden en vraagt er niets bij.
   2. WAT "DISCREET" BETEKENT. Een verrassing is een privacystand van de case en
      geen notitie (CON-08). De zaak krijgt alleen DAT het discreet is; wie er
      verrast wordt, staat nergens in wat hij krijgt.
   3. OF HET BEVESTIGD MAG. De zaak drukt op Bevestig; de server zoekt het
      onderdeel bij de zaakcode uit de SESSIE en weigert alles wat niet van deze
      zaak is. Een omgevallen onderdeel bevestigt hij niet terug -- dat vervangt
      het kantoor.

   De bundel (apps/leverancier/leverancier-58.js, renderHome) roept teken() aan
   met zijn eigen API-client en helpers; dit bestand heeft geen sessie van zich
   zelf. */
(function () {
  'use strict';
  var bezig = false;
  var STAND = { gepland: 'Gevraagd', bevestigd: 'Bevestigd', kapot: 'Omgevallen' };

  function regel(o, esc) {
    var wanneer = [o.datum, o.van].filter(Boolean).join(' om ');
    var meta = [wanneer, o.duurMin ? o.duurMin + ' min' : '', o.personen ? o.personen + ' personen' : '']
      .filter(Boolean).join(' · ');
    var wensen = (o.wensen || []).length ? '<div class="softline h-mt30">Wensen: ' + esc(o.wensen.join(', ')) + '</div>' : '';
    var gel = o.gelegenheid ? '<div class="softline h-mt30">Gelegenheid: ' + esc(o.gelegenheid) + '</div>' : '';
    var disc = o.discreet ? '<div class="softline h-mt30"><b>Discreet.</b> Dit is een verrassing.</div>' : '';
    var actie = o.stand === 'gepland'
      ? '<button class="obtn primary js-lus-bev" data-case="' + esc(o.caseRef) + '" data-onderdeel="' + esc(o.onderdeel) + '">Bevestig</button>'
      : '<span class="pill ' + (o.stand === 'bevestigd' ? 'klaar' : 'nieuw') + '">' + esc(STAND[o.stand] || o.stand) + '</span>';
    var kapot = o.stand === 'kapot' ? '<div class="softline h-mt30">Het kantoor van De Rechterhand zoekt een alternatief.</div>' : '';
    return '<div class="lus-opdracht h-mt50" data-lus-opdracht="' + esc(o.onderdeel) + '">'
      + '<div class="lus-kop">'
      + '<span><b>' + esc(o.wat) + '</b>' + (meta ? ' · ' + esc(meta) : '') + '</span>' + actie + '</div>'
      + gel + wensen + disc + kapot + '</div>';
  }

  async function teken(ctx) {
    var plek = document.getElementById('lusOpdrachten');
    if (!plek || bezig) return;
    bezig = true;
    var d;
    try { d = await ctx.API.call('/supplier/concierge/opdrachten', {}); }
    catch (e) { plek.innerHTML = '<div class="card"><div class="tt-h">Opdrachten van De Rechterhand</div><div class="softline h-mt30">' + ctx.esc(e.message) + '</div></div>'; bezig = false; return; }
    bezig = false;
    var lijst = (d && d.opdrachten) || [];
    if (!lijst.length) { plek.innerHTML = ''; return; }
    var open = lijst.filter(function (o) { return o.stand === 'gepland'; }).length;
    plek.innerHTML = '<div class="card"><div class="tt-h">Opdrachten van De Rechterhand</div>'
      + '<div class="softline h-mt30">' + (open ? open + ' om te bevestigen. ' : '')
      + 'U ziet alleen wat u nodig hebt voor uw onderdeel; wie de gast is, ziet u hier niet.</div>'
      + lijst.map(function (o) { return regel(o, ctx.esc); }).join('') + '</div>';
    plek.querySelectorAll('.js-lus-bev').forEach(function (b) {
      b.addEventListener('click', async function () {
        b.disabled = true;
        try {
          await ctx.API.call('/supplier/concierge/bevestig', { caseRef: b.dataset.case, onderdeel: b.dataset.onderdeel });
          ctx.toast('Bevestigd. De Rechterhand ziet het in de zaak.');
        } catch (e) { ctx.toast(e.message); b.disabled = false; return; }
        teken(ctx);
      });
    });
  }

  window.RTGZaakLus = { teken: teken };
})();

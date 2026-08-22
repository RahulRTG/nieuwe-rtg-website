/* RTG Social Control Plane view. Gescheiden van de Reality Graph zodat beide
   lagen klein, leesbaar en onafhankelijk toetsbaar blijven. */
(function () {
  'use strict';
  var view = window.RTGRealityEngine;
  if (!view) return;
  view.deck = function () {
    var scrim = document.createElement('div');
    scrim.className = 'rtg-intel-scrim';
    scrim.hidden = true;
    scrim.innerHTML = '<aside class="rtg-intel-deck" id="rtgIntelDeck" role="dialog" aria-modal="true" aria-labelledby="rtgIntelTitle">' +
      '<header><div><span>RTG SOCIAL CONTROL PLANE</span><h2 id="rtgIntelTitle">Van context naar besluit.</h2></div><button type="button" class="rtg-intel-close" aria-label="Sluit commandodeck">SLUIT</button></header>' +
      '<div class="rtg-deck-grid"><section class="rtg-deck-context"><span>ACTIVE CONTEXT</span><strong>' + view.contextName + '</strong><p>Een live doorsnede van uw echte sociale bronnen. Geen profielscore en geen verborgen rangorde.</p>' +
      '<div class="rtg-deck-radar" aria-hidden="true"><i></i><i></i><i></i><b></b></div>' +
      '<dl><div><dt>Momenten</dt><dd id="rtgGraphMoments">--</dd></div><div><dt>Wacht op u</dt><dd id="rtgGraphMine">--</dd></div><div><dt>Bronnen online</dt><dd id="rtgGraphSources">--</dd></div><div><dt>Laatste stap</dt><dd>Menselijk akkoord</dd></div></dl>' +
      '<p class="rtg-deck-source-state" id="rtgGraphState" role="status">Sociale graaf wordt gereedgemaakt…</p></section>' +
      '<section class="rtg-deck-console"><nav class="rtg-deck-tabs" role="tablist" aria-label="Control Plane registers">' +
      '<button type="button" role="tab" aria-selected="true" aria-controls="rtgPanelOverview" id="rtgTabOverview" data-intel-panel="overview">01 / OVERZICHT</button>' +
      '<button type="button" role="tab" aria-selected="false" aria-controls="rtgPanelPolicy" id="rtgTabPolicy" data-intel-panel="policy" tabindex="-1">02 / BELEID</button>' +
      '<button type="button" role="tab" aria-selected="false" aria-controls="rtgPanelRahul" id="rtgTabRahul" data-intel-panel="rahul" tabindex="-1">03 / RAHUL</button>' +
      '<button type="button" role="tab" aria-selected="false" aria-controls="rtgPanelLog" id="rtgTabLog" data-intel-panel="log" tabindex="-1">04 / LOGBOEK</button></nav>' +
      '<div class="rtg-deck-panels"><section class="rtg-deck-panel" id="rtgPanelOverview" role="tabpanel" aria-labelledby="rtgTabOverview">' +
      '<span class="rtg-panel-code">LIVE SOCIAL MODEL</span><h3>Wat speelt er werkelijk?</h3><p>De cijfers hieronder tellen gebeurtenissen, nooit mensen. De bronmotor bepaalt de inhoud; deze interface maakt haar leesbaar.</p>' +
      '<div class="rtg-overview-stats"><article><b id="rtgGraphToday">--</b><span>vandaag</span></article><article><b id="rtgGraphOther">--</b><span>bij een ander</span></article><article><b id="rtgGraphLate">--</b><span>termijnen voorbij</span></article><article><b id="rtgGraphClubs">--</b><span>clubs</span></article></div>' +
      '<div class="rtg-source-list" id="rtgGraphSourceList"><span>Bronnen worden verbonden…</span></div>' +
      '<div class="rtg-deck-links"><a href="/apps/sociaal.html">Open briefing</a><a href="/apps/juridisch/privacy.html">Controleer privacygrenzen</a></div></section>' +
      '<section class="rtg-deck-panel" id="rtgPanelPolicy" role="tabpanel" aria-labelledby="rtgTabPolicy" hidden><div class="rtg-panel-loading">Beleid wordt geladen…</div></section>' +
      '<section class="rtg-deck-panel" id="rtgPanelRahul" role="tabpanel" aria-labelledby="rtgTabRahul" hidden>' +
      '<span class="rtg-panel-code">GROUNDED SOCIAL INTELLIGENCE</span><h3>Vraag Rahul op basis van uw graaf.</h3><p>Rahul leest dezelfde sociale context als u en noemt de gegevens waarop het antwoord rust. Hij verstuurt en bevestigt niets.</p>' +
      '<form class="rtg-rahul-form" id="rtgSocialRahulForm"><label for="rtgSocialRahulQuestion">Uw vraag</label><textarea id="rtgSocialRahulQuestion" maxlength="400" rows="3" placeholder="Wat vraagt vandaag mijn aandacht?"></textarea><button type="submit">ANALYSEER CONTEXT</button></form>' +
      '<div class="rtg-rahul-answer" id="rtgSocialRahulAnswer" role="status" hidden></div></section>' +
      '<section class="rtg-deck-panel" id="rtgPanelLog" role="tabpanel" aria-labelledby="rtgTabLog" hidden><div class="rtg-panel-loading">Logboek wordt geladen…</div></section></div></section></div>' +
      '<footer><span id="rtgIntelSystemState"><i></i>SYSTEM READY</span><b>NO AUTO-SEND · CTRL / CMD + K</b></footer></aside>';
    document.body.appendChild(scrim);
    return scrim;
  };
})();

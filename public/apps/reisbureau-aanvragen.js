(function (w) {
'use strict';
/* MIJN AANVRAGEN op het RTG Design System, en met opzet niet alleen de open
   aanvragen. Zolang alleen "aangevraagd" hier stond, verdween een reis uit
   beeld op het moment dat de reisadviseur hem bevestigde: precies het bericht
   waar je op wacht. Nu blijft elke aanvraag staan met zijn stand erbij, en het
   bericht van de adviseur eronder.

   WAT ER PER STAND KAN (kern/reisbureau-nazorg.js):
     aangevraagd         intrekken; er is nog niets toegezegd
     bevestigd           een wijziging VRAGEN, of afzeggen met een reden
     wijziging-gevraagd  de wens staat er; afzeggen kan nog steeds
     afgewezen/afgezegd  klaar, met de reden erbij

   Een wijziging is een verzoek en geen knop die iets verzet: de reisadviseur
   beslist. Afzeggen vraagt een reden en geen "weet u het zeker": het veld IS
   de rem (GRAMMATICA.md). */
w.RTGReisbureauAanvragen = function (c) {
  const { $, esc, api, meld } = c;
  const STAND_WOORD = { 'wijziging-gevraagd': 'wijziging gevraagd' };
  let openPaneel = null, gekozen = null;

  /* WELKE AANVRAAG HET LID AANWIJST (EDGE.md par. 14.4). Het scherm zegt het
     via RTGAdaptief.context(); het blikveld maakt er een verwijzing van (soort
     en ref), en Rahul krijgt alleen die mee. De server zoekt de rest zelf op. */
  function spreek(a) {
    if (!w.RTGAdaptief) return;
    w.RTGAdaptief.context(a
      ? { bron: 'reisbureau', titel: 'Mijn aanvragen', object: { soort: 'reisaanvraag', id: a.ref, label: a.titel || a.ref } }
      : { bron: 'reisbureau', titel: 'Reisbureau' });
  }
  spreek(null);

  function wijzigingRegel(a) {
    const g = (a.wijziging || {}).gevraagd || {}, d = [];
    if (g.vertrek) d.push('vertrek naar ' + esc(g.vertrek));
    if (g.personen) d.push(esc(g.personen) + ' personen');
    if ((a.wijziging || {}).toelichting) d.push('"' + esc(a.wijziging.toelichting) + '"');
    return d.length ? 'Gevraagd: ' + d.join(', ') + '. De reisadviseur bekijkt het.' : '';
  }
  const veld = (label, invoer) => '<label class="ds-veldlabel">' + label + invoer + '</label>';
  const knop = (tekst, doe, ref, soort) => '<button class="ds-knop ds-knop--' + (soort || 'stil') + ' ds-knop--klein" type="button" data-doe="' + doe + '"' + (ref ? ' data-ref="' + esc(ref) + '"' : '') + '>' + tekst + '</button>';

  function paneelHtml(a) {
    if (openPaneel !== a.ref) return '';
    return '<div class="ds-velden">' +
      (a.status === 'bevestigd'
        ? veld('Andere vertrekdatum', '<input class="ds-invoer" type="date" id="wDatum" value="' + esc(a.vertrek || '') + '">') +
          veld('Aantal personen', '<input class="ds-invoer" type="number" id="wPers" min="1" max="20" value="' + esc(a.personen) + '">') +
          veld('Of vertel wat u anders wilt', '<input class="ds-invoer" type="text" id="wTekst" maxlength="300" placeholder="Bijvoorbeeld: een kamer met uitzicht">') +
          '<div>' + knop('Vraag deze wijziging', 'wijzig', a.ref, 'primair') + '</div>'
        : '') +
      veld('Afzeggen? Vertel kort waarom; de reisadviseur leest het.', '<input class="ds-invoer" type="text" id="aReden" maxlength="300" placeholder="Reden">') +
      '<div class="ds-chips">' + knop('Zeg deze reis af', 'afzeg', a.ref) + knop('Laat maar', 'dicht') + '</div>' +
      '<p class="ds-meta">Een afzegging verplaatst geen geld. Loopt er een betaling, dan handelt een medewerker die met u af.</p></div>';
  }
  function kaart(a) {
    const actie = a.status === 'aangevraagd' ? knop('Intrekken', 'intrek', a.ref)
      : (a.status === 'bevestigd' || a.status === 'wijziging-gevraagd') ? knop('Wijzigen of afzeggen', 'open', a.ref) : '';
    return '<article class="ds-kaart" tabindex="0" data-aanvraag="' + esc(a.ref) + '"' + (gekozen === a.ref ? ' aria-current="true"' : '') + '><div class="ds-kaart__inhoud">' +
      '<h3 class="ds-kaart__titel">' + esc(a.titel) + '</h3>' +
      '<p class="ds-meta">' + esc(a.bestemming) + ' · ' + esc(a.personen) + ' pers' + (a.vertrek ? ' · ' + esc(a.vertrek) : '') + '</p>' +
      '<p class="ds-detail__status">' + esc(STAND_WOORD[a.status] || a.status) + '</p>' +
      (a.besluit && a.besluit.bericht ? '<p class="ds-meta">' + esc(a.besluit.bericht) + '</p>' : '') +
      (a.status === 'aangevraagd' ? '<p class="ds-meta">Een RTG-reisadviseur bevestigt de datum en stelt de reis samen.</p>' : '') +
      (a.status === 'wijziging-gevraagd' ? '<p class="ds-meta">' + wijzigingRegel(a) + '</p>' : '') +
      (a.afzegging ? '<p class="ds-meta">Afgezegd door ' + esc(a.afzegging.door === 'lid' ? 'u' : 'het reisbureau') + ': ' + esc(a.afzegging.reden) + '</p>' : '') +
      (actie ? '<div>' + actie + '</div>' : '') + paneelHtml(a) + '</div></article>';
  }

  async function laadMijn() {
    const vak = $('#mijnWrap');
    let d; try { d = await api('/api/reisbureau/mijn'); } catch (e) {
      vak.innerHTML = '<p class="ds-meta" role="status">Uw aanvragen konden niet worden opgehaald. ' + esc(e.message) + '</p>' + knop('Probeer opnieuw', 'opnieuw');
      vak.querySelector('[data-doe="opnieuw"]').addEventListener('click', laadMijn); return;
    }
    const rijen = (d.aanvragen || []).slice(0, 8);
    if (!rijen.length) { vak.innerHTML = ''; return; }
    vak.innerHTML = '<div class="ds-collectie__kop"><h2 class="ds-titel ds-titel--scherm">Mijn aanvragen</h2></div><div class="ds-velden">' + rijen.map(kaart).join('') + '</div>';

    /* Aanwijzen: een tik op de aanvraag zelf (niet op een knop erin), of Enter. */
    const kies = (ref) => { gekozen = ref; spreek(rijen.find(x => x.ref === ref) || null);
      vak.querySelectorAll('[data-aanvraag]').forEach(r => r.setAttribute('aria-current', String(r.dataset.aanvraag === ref))); };
    vak.querySelectorAll('[data-aanvraag]').forEach(r => {
      r.addEventListener('click', (e) => { if (!e.target.closest('button,input,label')) kies(r.dataset.aanvraag); });
      r.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === r) kies(r.dataset.aanvraag); });
    });
    if (gekozen && !rijen.some(x => x.ref === gekozen)) { gekozen = null; spreek(null); }
    vak.querySelectorAll('button[data-doe]').forEach(b => b.addEventListener('click', async () => {
      const ref = b.dataset.ref, doe = b.dataset.doe;
      if (doe === 'open') { openPaneel = ref; kies(ref); laadMijn(); return; }
      if (doe === 'dicht') { openPaneel = null; laadMijn(); return; }
      try {
        if (doe === 'intrek') { await api('/api/reisbureau/annuleer', { ref }); meld('Aanvraag ingetrokken.'); }
        if (doe === 'wijzig') {
          const lijf = { ref, toelichting: ($('#wTekst') || {}).value || '' };
          if ($('#wDatum') && $('#wDatum').value) lijf.vertrek = $('#wDatum').value;
          if ($('#wPers') && $('#wPers').value) lijf.personen = $('#wPers').value;
          await api('/api/reisbureau/wijzig', lijf);
          meld('Uw verzoek ligt bij de reisadviseur. Er is nog niets veranderd aan de reis.');
        }
        if (doe === 'afzeg') {
          const reden = (($('#aReden') || {}).value || '').trim();
          if (!reden) { meld('Vertel kort waarom, dan weet de reisadviseur wat er speelt.'); return; }
          await api('/api/reisbureau/afzeggen', { ref, reden });
          meld('De reis is afgezegd. Loopt er een betaling, dan neemt een medewerker contact met u op.');
        }
        openPaneel = null;
        laadMijn();
      } catch (e) { meld(e.message); }
    }));
  }
  return { laadMijn };
};
})(window);

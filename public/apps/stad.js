/* Mijn Stad, het scherm (RTG Stad voor de bewoner). Stond als inline script
   in stad.html; bij de overgang naar het RTG Design System (TRAVELOS-MIGRATIE.md,
   stroom G) is alleen de vorm veranderd. Zelfde aanroepen, zelfde teksten,
   zelfde live-seintje; datum en tijd volgen de taal van het lid via Intl. */
(function () {
'use strict';
const $ = s => document.querySelector(s);
const esc = t => String(t==null?'':t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const taal = () => document.documentElement.lang || 'nl';
let TOKEN = null; try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) {}
const api = (pad, body) => fetch('/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
  body: JSON.stringify(body || {})
}).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Er ging iets mis.'); return d; });
function toast(t){ const m = $('#toast'); m.textContent = t; m.classList.add('toon'); clearTimeout(m._t); m._t = setTimeout(() => m.classList.remove('toon'), 2600); }
function leeg(t){ return '<div class="ds-status ds-status--binnen"><p class="ds-status__tekst">' + esc(t) + '</p></div>'; }

/* DE STAND STAAT IN WOORDEN. Op het oude scherm kleurde de waarde mee met de
   stand (rustig groen, druk rood) via een inline style; het Design System kent
   geen stijl uit een script en (nog) geen semantische tokens voor goed en
   waarschuwing. De stand zelf staat er daarom altijd als woord onder de
   waarde, en dat was de betekenis: de kleur was een herhaling ervan. */
/* Relatieve tijd in de taal van het lid. "zojuist" blijft het eigen woord
   van dit scherm voor minder dan een minuut. */
const tijd = ms => { const m = Math.round((Date.now() - ms) / 60000); if (m < 1) return 'zojuist';
  const rt = new Intl.RelativeTimeFormat(taal()); return m < 60 ? rt.format(-m, 'minute') : rt.format(-Math.round(m / 60), 'hour'); };

let B = null;
async function laad(){
  try { B = await api('stad/bewoner'); /* Onvolledig antwoord: de melding, niet een ruwe TypeError in het vlak (LIEGRONDE.json). */ if (!(B && B.scenario && Array.isArray(B.alerts) && Array.isArray(B.domeinen) && Array.isArray(B.mijnMeldingen) && Array.isArray(B.zones))) throw new Error('Het antwoord was onvolledig, dus dit kon niet worden geladen.'); render(); }
  catch (e) { $('#app').innerHTML = leeg(e.message); }
}
/* Meenemen (shared/uitvoer.js): het eigen model van deze app is de lijst
   meldingen die JIJ hebt gedaan -- met de velden los in plaats van de regel
   "lantaarn bij de brug doet het niet · Centrum · 3 u geleden" die op het
   scherm staat. De stadsstanden zijn meters, geen lijst; die blijven hier. */
const dag = ms => { const d = new Date(ms); return isNaN(d) ? '' : d.toISOString().slice(0, 10); };
if (window.RTGUitvoer) RTGUitvoer.bron(() => {
  if (!B || !(B.mijnMeldingen || []).length) return null;
  return { naam: 'mijn-meldingen', kolommen: ['datum', 'zone', 'soort', 'melding', 'status'],
    rijen: B.mijnMeldingen.map(m => [dag(m.at), m.zone || '', (B.soorten && B.soorten[m.soort]) || m.soort || '', m.tekst || '', m.status || '']) };
});
const ICOON = {
  plek: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  soort: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  tekst: '<path d="M4 5h16v11H9l-5 4z"/>'
};
const icoon = (k, klasse) => '<svg class="' + klasse + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4">' + ICOON[k] + '</svg>';
function render(){
  $('#app').innerHTML =
    '<section class="ds-kaart"><div class="ds-kaart__inhoud"><h2 class="ds-kaart__titel">' + esc(B.scenario.label) + '</h2>' +
      '<p class="ds-meta">' + esc(B.scenario.uitleg) + '</p>' +
      B.alerts.map(a => '<p class="ds-detail__status">' + esc(a.tekst) + '</p>').join('') +
    '</div></section>' +
    '<p class="ds-label">Hoe de stad er nu bij staat</p>' +
    '<div class="ds-veldgroep">' + B.domeinen.map(d =>
      '<div class="ds-kaart" data-stand="' + esc(d.stand) + '"><div class="ds-kaart__inhoud"><p class="ds-label">' + esc(d.label) + '</p>' +
      '<p class="ds-kaart__titel">' +
        (d.waarde == null ? 'stil' : esc(String(d.waarde)) + ' <span class="ds-meta">' + esc(d.eenheid) + '</span>') + '</p>' +
      '<p class="ds-meta">' + esc(d.stand) +
        (d.ovOnderweg != null ? ' ·  ' + d.ovOnderweg + ' OV onderweg' : '') + '</p></div></div>').join('') + '</div>' +
    '<p class="ds-label">Iets kapot of vol gezien? Meld het</p>' +
    '<div class="ds-velden">' +
      '<label class="ds-veld">' + icoon('plek', 'ds-veld__icoon') + '<span><span class="ds-veld__label">Waar</span><select class="ds-veld__invoer" id="mZone">' + B.zones.map(z => '<option>' + esc(z) + '</option>').join('') + '</select></span><span></span></label>' +
      '<label class="ds-veld">' + icoon('soort', 'ds-veld__icoon') + '<span><span class="ds-veld__label">Wat</span><select class="ds-veld__invoer" id="mSoort">' + Object.entries(B.soorten).map(([k, v]) => '<option value="' + k + '">' + esc(v) + '</option>').join('') + '</select></span><span></span></label>' +
      '<label class="ds-veld">' + icoon('tekst', 'ds-veld__icoon') + '<span><span class="ds-veld__label">Korte omschrijving</span><input class="ds-veld__invoer" id="mTekst" maxlength="200" placeholder="bijv. lantaarn bij de brug doet het niet"></span><span></span></label>' +
    '</div>' +
    '<button class="ds-knop ds-knop--primair ds-knop--breed" id="mDoe" type="button" data-ds-actie="Meld iets in de stad">Meld</button>' +
    '<p class="ds-meta">' + esc(B.privacy) + '</p>' +
    '<p class="ds-label">Mijn meldingen</p>' +
    (B.mijnMeldingen.length ? '<ul class="ds-lijst" id="mijnM">' + B.mijnMeldingen.map(m =>
      '<li class="ds-lijst__rij">' + icoon('plek', 'ds-lijst__icoon') + '<span><span class="ds-lijst__titel">' + esc(m.tekst) + '</span>' +
      '<span class="ds-lijst__tekst">' + esc(m.zone) + ' · ' + tijd(m.at) + '</span>' +
      '<span class="ds-lijst__tekst" data-status="' + esc(m.status) + '">' + (m.status === 'klaar' ? '✓ opgelost' : 'de veldploeg kijkt ernaar') + '</span></span>' +
      (m.status === 'klaar' ? '<span></span>' : '<span class="ds-lijst__stip" aria-hidden="true"></span>') + '</li>').join('') + '</ul>'
      : '<div id="mijnM">' + leeg('Nog geen meldingen. Zie je iets, dan hoort de stad het graag.') + '</div>');
  $('#mDoe').addEventListener('click', async () => {
    try {
      await api('stad/melding', { zone: $('#mZone').value, soort: $('#mSoort').value, tekst: $('#mTekst').value });
      toast('Dank je. De veldploeg heeft je melding.');
      laad();
    } catch (e) { toast(e.message); }
  });
}

/* Live: wordt je melding buiten klaargemeld, dan geeft de server een seintje
   (scope 'stad') en ziet de bewoner het meteen. */
let ES = null, EST = null;
function live(){
  if (!window.EventSource || ES || !TOKEN) return;
  try { ES = RTGStroom.open('/api/stream', { token: TOKEN }); } catch (e) { return; }
  ES.addEventListener('sync', e => {
    let scope = null; try { scope = JSON.parse(e.data).scope; } catch (x) {}
    if (scope !== 'stad' || !B) return;
    clearTimeout(EST); EST = setTimeout(laad, 400);
  });
}

laad();
live();
})();

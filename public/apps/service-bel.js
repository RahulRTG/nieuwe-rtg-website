/* ============================================================================
   BELLEN MET RTG -- de kant van het lid.

   EEN EIGEN SCHERM EN GEEN LAATJE, en dat is geen smaak: een gesprek moet een
   navigatie overleven. De hulp-la staat op elk scherm en verdwijnt zodra je
   ergens heen gaat; een gesprek dat daarmee wegvalt, is erger dan geen belknop.

   DE WEBRTC-DANS STAAT HIER NIET. Die staat in /shared/servicebel.js en wordt
   door het kantoor net zo gebruikt; twee kopieen van dezelfde onderhandeling
   lopen gegarandeerd uit elkaar. Dit bestand doet het transport (welke route
   stuurt een signaal), het luisteren (de SSE van het lid) en het scherm.

   ER WORDT NIETS BELOOFD WAT NIET GEMETEN IS. Geen wachttijd, geen "u bent
   nummer drie". Wat er staat is wat er GEBEURT: het rinkelt, er is opgenomen,
   of er is opgehangen. En neemt niemand op, dan zegt het scherm waar de melding
   blijft staan -- niemand belt voor niets. */

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let TOKEN = null; try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) {}

const api = (pad, body) => fetch('/api/service/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
  body: JSON.stringify(body || {})
}).then(async (r) => {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error || 'Er ging iets mis.'); e.status = r.status; e.wel = d.wel; throw e; }
  return d;
});

/* De zaak waarover gebeld wordt, als hij is meegegeven. Zonder zaak opent de
   server er een: een gesprek zonder zaak is een half uur werk waar niets van
   terugkomt. */
const ZAAK = new URLSearchParams(location.search).get('zaak') || '';
let MOTOR = null, GESPREK = null, BRON = null, MEE = null;

function toon(html) { $('#main').innerHTML = html; }

/* Wat de melder leest bij elke stand. Geen enkele belofte over tijd -- alleen
   wat er is gebeurd. */
const TEKST = {
  rinkelt: 'Het rinkelt bij RTG.',
  opnemen: 'Verbinden…',
  verbonden: 'U bent verbonden.',
  weggevallen: 'De verbinding hapert.',
  opgehangen: 'Het gesprek is beëindigd.',
  gestopt: 'Het gesprek is beëindigd.',
  geenmedia: 'Wij kunnen uw microfoon niet gebruiken. Geef de app toegang en probeer het opnieuw.',
  mislukt: 'De verbinding kwam niet tot stand.'
};

function tekenGesprek(stand) {
  const video = !!(GESPREK && GESPREK.video);
  toon('<div class="kaart"><h2>Gesprek ' + esc(GESPREK ? GESPREK.id : '') + '</h2>'
    + '<p class="stand" id="stand">' + esc(TEKST[stand] || stand) + '</p>'
    + '<div class="beeld' + (video ? ' video' : '') + '">'
    + '<video id="vLokaal" muted autoplay playsinline' + (video ? '' : ' hidden') + '></video>'
    + '<video id="vExtern" autoplay playsinline' + (video ? '' : ' hidden') + '></video></div>'
    + '<div id="meelees"></div>'
    + '<div class="rij"><button class="knop uit" id="bStop">Ophangen</button></div>'
    + '<p class="stil">Uw melding staat als zaak ' + esc(GESPREK ? GESPREK.zaak || '' : '')
    + ' genoteerd. Wordt er niet opgenomen, dan reageren wij daar.</p></div>');
  $('#bStop').onclick = ophangen;
  /* DE MEELEESBAAN. Een live gesprek zonder weg naar tekst sluit een dove
     deelnemer uit; shared/meelezen.js bestaat daarvoor en wordt hier gedeeld
     met het kantoor. Wat erin staat is getypt door een MENS -- het is geen
     ondertiteling, en dat zegt de baan zelf ook. */
  if (window.RTGMeelezen) {
    MEE = window.RTGMeelezen.maak({ ik: 'U',
      stuur: function (regel) { api('bel/signaal', { gesprek: GESPREK.id, kind: 'tekst', payload: { r: regel } }).catch(function () {}); } });
    $('#meelees').appendChild(MEE.el);
  }
}

function zetStand(stand) {
  const el = $('#stand');
  if (el) el.textContent = TEKST[stand] || stand;
  const v = $('#vExtern');
  if (v && stand === 'verbonden' && GESPREK && !GESPREK.video) v.hidden = true;
}

/* De SSE van het lid. Alleen de gebeurtenissen van DIT gesprek; een signaal met
   een ander nummer hoort bij iemand anders en wordt genegeerd. */
function luister() {
  if (!window.EventSource || BRON) return;
  BRON = new EventSource('/api/stream?token=' + encodeURIComponent(TOKEN));
  BRON.addEventListener('servicebel', (ev) => {
    let d = null; try { d = JSON.parse(ev.data); } catch (e) { return; }
    if (!d || !GESPREK || d.gesprek !== GESPREK.id) return;
    if (MOTOR) MOTOR.ontvang(d.kind, d.payload);
  });
}

async function ophangen() {
  if (MOTOR) MOTOR.stop();
  if (GESPREK) { try { await api('bel/eind', { gesprek: GESPREK.id }); } catch (e) {} }
  if (BRON) { BRON.close(); BRON = null; }
  toon('<div class="kaart"><h2>Klaar</h2><p class="oms">Het gesprek is beëindigd. '
    + 'Uw melding staat als zaak ' + esc(GESPREK ? GESPREK.zaak || '' : '') + ' genoteerd.</p>'
    + '<div class="rij"><a class="terug" href="/apps/app.html">Terug naar de app</a></div></div>');
}

async function bel(video) {
  let r;
  try { r = await api('bel', { id: ZAAK, video: !!video }); }
  catch (e) {
    /* DE WEIGERING WIJST NAAR DE WEG DIE WEL OPENSTAAT. Zonder die tweede zin
       wordt "u mag niet bellen" gelezen als "u krijgt geen hulp", en dat is
       precies wat deze laag niet doet: een MENS is geen premium-dienst, alleen
       de stem is dat. */
    toon('<div class="kaart"><h2>Bellen</h2><p class="oms">' + esc(e.message) + '</p>'
      + (e.wel ? '<p class="oms">' + esc(e.wel) + '</p>' : '')
      + '<div class="rij"><a class="terug" href="/apps/app.html">Terug</a></div></div>');
    return;
  }
  GESPREK = Object.assign({}, r.gesprek, { zaak: r.zaak || r.gesprek.zaak, video: !!video });
  luister();
  tekenGesprek('rinkelt');
  MOTOR = window.RTGServiceBel.maak({
    rol: 'beller', video: !!video,
    elLokaal: $('#vLokaal'), elExtern: $('#vExtern'),
    stuur: (kind, payload) => api('bel/signaal', { gesprek: GESPREK.id, kind, payload }),
    opStand: (stand) => zetStand(stand),
    opTekst: (regel) => { if (MEE && regel) MEE.voed(regel, { wie: 'RTG', bron: 'mens' }); }
  });
  if (!(await MOTOR.start())) { zetStand('geenmedia'); }
}

function kies() {
  toon('<div class="kaart"><h2>Bellen met RTG</h2>'
    + '<p class="oms">U belt binnen de app. Er is geen telefoonnummer nodig, en uw nummer blijft waar het hoort.</p>'
    + '<p class="oms">Wij openen een zaak voor dit gesprek, zodat alles wat u vertelt bewaard blijft -- ook als er niet wordt opgenomen.</p>'
    + '<div class="rij"><button class="knop doe" id="bAudio">Bellen</button>'
    + '<button class="knop" id="bVideo">Videobellen</button>'
    + '<a class="terug" href="/apps/app.html">Terug</a></div></div>');
  $('#bAudio').onclick = () => bel(false);
  $('#bVideo').onclick = () => bel(true);
}

async function start() {
  if (!TOKEN) { toon('<div class="kaart"><p class="oms">Meld u eerst aan in de app.</p></div>'); return; }
  try {
    const d = await api('bel/mijn', {});
    if (d.mag && d.mag.mag === false) {
      toon('<div class="kaart"><h2>Bellen</h2><p class="oms">' + esc(d.mag.waarom) + '</p>'
        + (d.mag.wel ? '<p class="oms">' + esc(d.mag.wel) + '</p>' : '')
        + '<div class="rij"><a class="terug" href="/apps/app.html">Terug</a></div></div>');
      return;
    }
    kies();
  } catch (e) {
    toon('<div class="kaart"><p class="oms">' + esc(e.message) + '</p></div>');
  }
}
window.addEventListener('beforeunload', () => { if (MOTOR) MOTOR.stop(); });
start();

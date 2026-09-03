/* ============================================================================
   DE WERKPLEK VAN EEN ZAAK BIJ RTG SERVICE.

   De routes hiervoor bestonden al (server/routes/service-zaak.js) maar een zaak
   kon er alleen langs de API bij, en dat is geen kanaal maar een belofte. Dit is
   het scherm.

   HET VRAAGT NIET WIE U BENT. Er staat hieronder geen veld voor een klantnummer,
   een zaakcode of een contactpersoon: de sessie weet dat al. Dat is het hele
   verschil met een contactformulier -- een zaak die zijn eigen nummer moet
   opzoeken om hulp te vragen, is een zaak die het niet doet.

   EN HET BELOOFT NIET DAT ALLES WERKT. De stand bovenaan toont alleen een
   storing die uw eigen meldingen RAAKT. Staat er niets, dan staat er ook niets --
   geen groen vinkje: RTG meet beschikbaarheid niet per zaak, en een
   geruststelling zonder meting is precies wat dit huis nergens accepteert
   (SERVICE.md par. 8).

   DE BEVESTIGING STAAT BOVENAAN, en dat is geen opmaak. Als er iemand van RTG
   toegang vraagt, zit die te wachten; alles daaronder kan wachten. Wat u ziet is
   wie het vraagt, waarvoor, en wat er opengaat -- en u drukt zelf. */

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let TOKEN = null; try { TOKEN = localStorage.getItem('rtg_sup_token'); } catch (e) {}

function meld(t) {
  const m = $('#melding'); m.textContent = t; m.style.opacity = '1';
  clearTimeout(m._t); m._t = setTimeout(() => { m.style.opacity = '0'; }, 3000);
}
const api = (pad, body) => fetch('/api/supplier/service/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
  body: JSON.stringify(body || {})
}).then(async (r) => {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error || 'Er ging iets mis.'); e.status = r.status; throw e; }
  return d;
});

/* Elke handeling met een vangnet. Een klik die mislukt en NIETS doet is de
   duurste fout op een werkblad: dan denkt iemand dat het scherm kapot is
   terwijl de server een reden teruggaf. */
async function poging(fn) {
  try { await fn(); } catch (e) { meld(e && e.message ? e.message : 'Er ging iets mis.'); }
}

const MND = ['', 'jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
function tijd(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.getDate() + ' ' + MND[d.getMonth() + 1] + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
}

let KEUZES = null;
let OPEN_ZAAK = null;

async function laad() {
  const [bev, mijn, stand, keuzes] = await Promise.all([
    api('bevestigingen'), api('mijn'), api('stand'), KEUZES ? Promise.resolve(KEUZES) : api('keuzes')
  ]);
  KEUZES = keuzes;
  $('#blad').innerHTML = bevestigingBlok(bev) + standBlok(stand) + meldBlok() + lijstBlok(mijn);
  bindAlles(bev, mijn);
  if (OPEN_ZAAK) await toonZaak(OPEN_ZAAK);
}

/* De bevestigingen, bovenaan. De code staat erbij als terugval: kan de
   medewerker u niet in dit scherm laten drukken, dan leest u zes cijfers voor
   die vijf minuten en een keer gelden. */
function bevestigingBlok(bev) {
  const rijen = (bev.verzoeken || []);
  if (!rijen.length) return '';
  return '<div class="kaart"><h2>Iemand van RTG vraagt toegang</h2>'
    + rijen.map((v) => '<div class="zaakrij let" data-bev="' + esc(v.id) + '">'
      + '<span class="wie">' + esc(v.mens) + ' &middot; zaak ' + esc(v.zaak) + '</span><br>'
      + esc(v.reden) + '<br>'
      + '<span class="stil">Dit gaat open: ' + (v.capabilities || []).map(esc).join(', ') + '</span>'
      + '<div class="rij"><button class="knop doe" data-ja="' + esc(v.id) + '">Bevestigen</button>'
      + '<button class="knop" data-nee="' + esc(v.id) + '">Nee</button></div>'
      + '<div class="stil">Of lees deze code voor: ' + esc(v.code || '?') + ' (' + esc(v.minuten) + ' minuten, een keer).</div>'
      + '</div>').join('')
    + '<p class="stil">' + esc(bev.let || '') + '</p></div>';
}

/* De stand. ALLEEN als er iets te melden is -- zie de kop. */
function standBlok(stand) {
  if (!stand || !(stand.raakt || []).length) return '';
  return '<div class="kaart"><h2>Er speelt een storing</h2>'
    + stand.raakt.map((r) => '<div class="zaakrij let"><span class="wie">Storing ' + esc(r.incident) + '</span><br>'
      + esc(r.zin) + '</div>').join('')
    + '</div>';
}

function meldBlok() {
  const onderwerpen = ((KEUZES && KEUZES.onderwerpen) || []).map((o) =>
    '<option value="' + esc(o.id) + '">' + esc(o.naam) + '</option>').join('');
  return '<div class="kaart"><h2>Iets melden</h2>'
    + '<div class="rij"><select class="veld" id="mOnderwerp" aria-label="Waar gaat het over">' + onderwerpen + '</select>'
    + '<input class="veld breed" id="mTitel" placeholder="In een zin: wat is er aan de hand?" maxlength="200"></div>'
    + '<div class="rij"><textarea class="veld" id="mTekst" placeholder="Wat u er verder over kwijt wilt (optioneel)" maxlength="4000"></textarea></div>'
    /* Wat de zaak aanlevert zijn TERMEN en geen prioriteit: de weging gebeurt op
       de server (kern/service/prioriteit.js). Zou de melder de prioriteit
       kiezen, dan meet de wachtrij binnen een half jaar welbespraaktheid. */
    + '<div class="rij"><label class="stil"><input type="checkbox" id="mStil"> Hierdoor ligt werk stil</label>'
    + '<label class="stil"><input type="checkbox" id="mGeld"> Er staat geld vast</label>'
    + '<button class="knop doe" id="mStuur">Versturen</button></div></div>';
}

function lijstBlok(mijn) {
  const rijen = (mijn.zaken || []);
  if (!rijen.length) return '<div class="kaart"><h2>Uw meldingen</h2><p class="oms">U heeft niets lopen bij RTG.</p></div>';
  return '<div class="kaart"><h2>Uw meldingen</h2>'
    + rijen.map((z) => '<div class="zaakrij"><span class="wie">' + esc(z.id) + ' &middot; ' + esc(z.standNaam)
      + ' &middot; ' + esc(tijd(z.at)) + '</span><br>' + esc(z.titel)
      + '<div class="rij"><button class="knop" data-open="' + esc(z.id) + '">Bekijken</button></div></div>').join('')
    + '</div><div id="dossier"></div>';
}

async function toonZaak(id) {
  const d = await api('zaak', { id });
  const z = d.zaak;
  OPEN_ZAAK = z.id;
  const draad = (z.tijdlijn || []).map((r) => {
    if (r.wat === 'bericht') {
      const van = r.van === 'melder' ? 'u' : (r.van === 'mens' ? 'RTG' : r.van);
      return '<div class="beurt ' + esc(r.van) + '"><span class="wie">' + esc(van) + ' &middot; ' + esc(tijd(r.at)) + '</span><br>' + esc(r.tekst) + '</div>';
    }
    if (r.wat === 'stand') return '<div class="beurt stap">' + esc(tijd(r.at)) + ' &middot; ' + esc(r.naar) + (r.notitie ? ' &mdash; ' + esc(r.notitie) : '') + '</div>';
    if (r.wat === 'koppeling') return '<div class="beurt stap">' + esc(tijd(r.at)) + ' &middot; gekoppeld aan ' + esc(r.soort) + ' ' + esc(r.code) + '</div>';
    if (r.wat === 'mensGevraagd') return '<div class="beurt stap">' + esc(tijd(r.at)) + ' &middot; u vroeg om een mens</div>';
    return '';
  }).join('');
  $('#dossier').innerHTML = '<div class="kaart"><h2>' + esc(z.id) + ' &middot; ' + esc(z.standNaam) + '</h2>'
    + '<p class="oms">' + esc(z.titel) + '</p>' + draad
    + '<div class="rij"><textarea class="veld" id="aTekst" placeholder="Uw antwoord aan RTG" maxlength="4000"></textarea></div>'
    + '<div class="rij"><button class="knop doe" id="aStuur">Versturen</button>'
    + '<button class="knop" id="aMens">Ik wil een mens</button></div></div>';
  $('#aStuur').onclick = () => poging(async () => {
    await api('bericht', { id: z.id, tekst: $('#aTekst').value }); meld('Verstuurd.'); await laad();
  });
  $('#aMens').onclick = () => poging(async () => {
    const r = await api('mens', { id: z.id }); meld(r.let || 'Doorgezet.'); await laad();
  });
}

function bindAlles() {
  document.querySelectorAll('[data-ja]').forEach((b) => { b.onclick = () => poging(async () => {
    await api('bevestig', { id: b.dataset.ja }); meld('Bevestigd.'); await laad();
  }); });
  document.querySelectorAll('[data-nee]').forEach((b) => { b.onclick = () => poging(async () => {
    await api('weiger', { id: b.dataset.nee }); meld('Geweigerd.'); await laad();
  }); });
  document.querySelectorAll('[data-open]').forEach((b) => { b.onclick = () => poging(() => toonZaak(b.dataset.open)); });
  const stuur = $('#mStuur');
  if (stuur) stuur.onclick = () => poging(async () => {
    const titel = String($('#mTitel').value || '').trim();
    if (titel.length < 3) { $('#mTitel').focus(); meld('Schrijf in een zin waar het over gaat.'); return; }
    const r = await api('open', {
      onderwerp: $('#mOnderwerp').value, titel, tekst: $('#mTekst').value,
      impact: $('#mStil').checked ? 'zwaar' : 'geen',
      geld: $('#mGeld').checked ? 'flink' : 'geen'
    });
    meld('Genoteerd als ' + r.zaak.id + '.');
    OPEN_ZAAK = r.zaak.id;
    await laad();
  });
}

function start() {
  if (!TOKEN) {
    $('#blad').innerHTML = '<div class="kaart"><p class="oms">Meld u eerst aan op uw werkplek; dan weten wij wie u bent en hoeft u niets op te zoeken.</p></div>';
    return;
  }
  poging(laad);
}
start();

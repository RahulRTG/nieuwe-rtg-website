(function () {
'use strict';
/* RTG Vluchten op het RTG Design System (TRAVELOS-MIGRATIE.md, batch 4).
   Dezelfde routes als ervoor (/api/member/vluchten/bord, /boek, /mijn,
   /incheck, /pass/roteer, /pass/intrek, /charter); alleen de vorm komt nu uit
   /ds/, en een datum volgt de taal van het lid. Het bord is intern: wat hier
   staat, staat op het bord van RTG Airport en nergens anders. */
const $ = s => document.querySelector(s);
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let TOKEN = null; try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) {}
const taal = () => document.documentElement.lang || 'nl';
function datum(d) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return esc(d); return new Intl.DateTimeFormat(taal(), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d + 'T12:00:00')); }
function meld(t) { const m = $('#melding'); m.textContent = t; m.classList.add('toon'); clearTimeout(m._t); m._t = setTimeout(() => m.classList.remove('toon'), 2800); }
const api = (pad, body, herkans) => fetch(pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN }, body: JSON.stringify(body || {}) })
  .then(async r => { const d = await r.json().catch(() => ({})); const p = herkans ? null : (window.RTGGegevensPoort && window.RTGGegevensPoort.vang(d, r.status, () => api(pad, body, true), api)); if (p) return p; if (!r.ok) { throw new Error(d.error || 'Er ging iets mis.'); } return d; });
const START_VIEW = new URLSearchParams(location.search).get('view');
let TAB = ['mijn', 'charter'].includes(START_VIEW) ? START_VIEW : 'bord';
let BORD = null;   // wat er binnenkwam; waaruit dit scherm tekent
const leeg = t => '<div class="ds-status ds-status--binnen"><p class="ds-status__tekst">' + t + '</p></div>';
const MOMENTEN = window.RTGVluchtMomenten({ $, esc, api, meld, datum, leeg, herlaad: () => laad() });
/* Meenemen (shared/uitvoer.js): u neemt mee wat u aankijkt, het bord of uw
   eigen boekingen, met de velden los zoals de app ze van de server krijgt. */
if (window.RTGUitvoer) RTGUitvoer.bron(() => {
  const MIJN = MOMENTEN.mijn();
  if (TAB === 'charter') {
    const r = (MIJN && MIJN.charters || []).map(x => [x.code, x.soort, x.bestemming, x.datum, x.tijd, x.status]);
    return r.length ? { naam: 'mijn-charteraanvragen', kolommen: ['code', 'soort', 'bestemming', 'datum', 'tijd', 'status'], rijen: r } : null;
  }
  if (TAB === 'mijn') {
    const r = (MIJN && MIJN.boekingen || []).map(b => [b.vlucht.datum, b.vlucht.tijd, b.vlucht.nummer, b.vlucht.bestemming, b.id, b.stoel || '', b.status]);
    return r.length ? { naam: 'mijn-reizen', kolommen: ['datum', 'tijd', 'vluchtnummer', 'bestemming', 'boeking', 'stoel', 'status'], rijen: r } : null;
  }
  const r = (BORD && BORD.vluchten || []).map(v => [v.datum, v.tijd, v.nummer, v.bestemming, v.soort, v.gate, v.geannuleerd ? 'geannuleerd' : v.status]);
  return r.length ? { naam: 'vluchtenbord', kolommen: ['datum', 'tijd', 'vluchtnummer', 'bestemming', 'soort', 'gate', 'status'], rijen: r } : null;
});
function zetTab(tab) {
  TAB = ['bord', 'mijn', 'charter'].includes(tab) ? tab : 'bord';
  document.body.dataset.vluchtTab = TAB;
  document.body.dataset.dsSchermtype = TAB === 'charter' ? 'taak' : 'collectie';
  const kop = {
    bord: ['Vlucht', 'Waar wilt u naartoe?', 'Vind uw vlucht en zie meteen wat u nu moet doen.'],
    mijn: ['Mijn vlucht', 'Alles bij de hand.', 'Uw tijd, gate, stoel, bagage en instapcode op één rustige plek.'],
    charter: ['Persoonlijk vliegen', 'Uw tijd bepaalt het vertrek.', 'Vraag een privévlucht of helikopter aan. Operations bevestigt persoonlijk.']
  }[TAB];
  $('#vluchtEy').textContent = kop[0]; $('#vluchtTitel').textContent = kop[1]; $('#vluchtIntro').textContent = kop[2];
  document.querySelectorAll('[data-t]').forEach(x => x.setAttribute('aria-selected', String(x.dataset.t === TAB)));
  const url = new URL(location.href); if (TAB === 'bord') url.searchParams.delete('view'); else url.searchParams.set('view', TAB);
  history.replaceState(null, '', url.pathname + url.search); laad();
}
document.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => zetTab(b.dataset.t)));
$('#inhoud').addEventListener('click', e => { const n = e.target.closest('[data-naar]'); if (n) zetTab(n.dataset.naar); });

function laad() {
  if (!TOKEN) { $('#inhoud').innerHTML = leeg('Log eerst in via de RTG-app; daarna boekt en checkt u hier in.'); return; }
  if (TAB === 'bord') laadBord(); else if (TAB === 'mijn') MOMENTEN.laadMijn(); else MOMENTEN.laadCharter();
}
function status(v) {
  if (v.geannuleerd) return 'geannuleerd';
  if (v.status === 'inchecken') return 'inchecken open';
  if (v.status === 'boarding') return 'boarding · gate ' + esc(v.gate);
  if (v.status === 'geland' || v.status === 'bagage-op-band') return esc(v.status) + (v.band ? ' · band ' + esc(v.band) : '');
  return esc(v.status);
}
const ICOON_ZOEK = '<svg class="ds-veld__icoon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>';
const ICOON_DATUM = '<svg class="ds-veld__icoon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="1"/><path d="M8 3v4m8-4v4M4 10h16"/></svg>';
const ICOON_RICHTING = '<svg class="ds-veld__icoon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h14l-3-3M20 16H6l3 3"/></svg>';
const rij = (icoon, label, invoer) => '<label class="ds-veld">' + icoon + '<span><span class="ds-veld__label">' + label + '</span>' + invoer + '</span><span></span></label>';
async function laadBord() {
  let d; try {
    d = await api('/api/member/vluchten/bord');
    /* Ontbreekt een veld, dan de eigen foutmelding hieronder: nooit een lege
       lijst (die zou beweren dat er niets is) en nooit een ruwe TypeError (LIEGRONDE.json). */
    if (!(d && Array.isArray(d.security) && Array.isArray(d.vluchten))) throw new Error('Het antwoord was onvolledig, dus dit kon niet worden geladen.');
  } catch (e) { $('#inhoud').innerHTML = leeg(esc(e.message)); return; }
  BORD = d;
  const sec = d.security.filter(f => f.open).map(f => esc(f.naam) + ': ' + esc(f.wachtMinuten) + ' min').join(' · ');
  const eerste = (d.vluchten[0] || {}).datum || new Date().toISOString().slice(0, 10);
  let h = '<section class="ds-velden" role="search" aria-label="Zoek uw vlucht">' +
    rij(ICOON_ZOEK, 'Waarheen', '<input class="ds-veld__invoer" id="vliegNaar" placeholder="Bestemming of vluchtnummer" autocomplete="off">') +
    rij(ICOON_DATUM, 'Datum', '<input class="ds-veld__invoer" id="vliegDatum" type="date" value="' + esc(eerste) + '">') +
    rij(ICOON_RICHTING, 'Richting', '<select class="ds-veld__invoer" id="vliegSoort"><option value="">Alles</option><option value="vertrek">Vertrek</option><option value="aankomst">Aankomst</option></select>') +
    '<p class="ds-meta">U ziet het actuele bord. Een boeking is pas gemaakt nadat de server haar bevestigt.</p></section>' +
    '<p class="ds-meta">Security nu · ' + (sec || 'geen filter open') + '</p>' +
    '<div class="ds-schermkop"><h2 class="ds-kaart__titel">Beschikbare vluchten</h2><span class="ds-meta" id="vluchtAantal">' + d.vluchten.length + ' op het bord</span></div>';
  h += d.vluchten.length ? '<div class="ds-collectie__raster">' + d.vluchten.map(v => {
    const ver = v.vertraging ? '<p class="ds-detail__status">+' + esc(v.vertraging.minuten) + ' min</p>' : '';
    const boek = (v.soort === 'vertrek' && ['gepland', 'inchecken'].includes(v.status)) ? '<div><button class="ds-knop ds-knop--primair ds-knop--klein" type="button" data-boek="' + esc(v.id) + '">Kies deze vlucht</button></div>' : '';
    const zoek = esc([v.nummer, v.bestemming, v.datum, v.soort].join(' ').toLowerCase());
    return '<article class="ds-kaart" data-vlucht-zoek="' + zoek + '" data-datum="' + esc(v.datum) + '" data-soort="' + esc(v.soort) + '"><div class="ds-kaart__inhoud">' +
      '<p class="ds-label">' + esc(v.nummer) + '</p><h3 class="ds-kaart__titel">' + esc(v.tijd) + ' · ' + esc(v.bestemming) + '</h3>' +
      '<p class="ds-meta">' + datum(v.datum) + ' · ' + esc(v.soort) + ' · gate ' + esc(v.gate) + '</p><p class="ds-detail__status">' + status(v) + '</p>' + ver + boek + '</div></article>';
  }).join('') + '</div>' : leeg('Geen vluchten op het bord.');
  h += '<div class="ds-collectie__raster"><button class="ds-kaart ds-kaart--beeld" type="button" data-naar="charter"><img class="ds-kaart__beeld" src="/campagne/jet.jpg" alt="" loading="lazy"><span class="ds-kaart__inhoud"><span class="ds-kaart__titel">Persoonlijk vliegen</span><span class="ds-kaart__sub">Vraag een privévlucht of helikopter aan. Operations bevestigt persoonlijk.</span></span></button></div>';
  $('#inhoud').innerHTML = h;
  function filterBord() {
    const q = $('#vliegNaar').value.trim().toLowerCase(), dag = $('#vliegDatum').value, soort = $('#vliegSoort').value;
    let n = 0; document.querySelectorAll('[data-vlucht-zoek]').forEach(r => { const toon = (!q || r.dataset.vluchtZoek.includes(q)) && (!dag || r.dataset.datum === dag) && (!soort || r.dataset.soort === soort); r.hidden = !toon; if (toon) n++; });
    $('#vluchtAantal').textContent = n + (n === 1 ? ' vlucht' : ' vluchten');
  }
  $('#vliegNaar').addEventListener('input', filterBord); $('#vliegDatum').addEventListener('change', filterBord); $('#vliegSoort').addEventListener('change', filterBord);
  document.querySelectorAll('[data-boek]').forEach(b => b.addEventListener('click', async () => {
    try { const r = await api('/api/member/vluchten/boek', { id: b.dataset.boek }); meld('Geboekt: ' + r.boeking.id + '. Inchecken kan zodra het open staat.'); } catch (e) { meld(e.message); }
  }));
}
zetTab(TAB);
})();

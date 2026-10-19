(function () {
'use strict';
/* RTG Reisbureau op het RTG Design System (TRAVELOS-MIGRATIE.md, batch 4).
   Dezelfde kern als ervoor: /api/reisbureau, /api/reisbureau/advies,
   /api/reis/wijzer en (via de aanvraagcontroller) /api/reisbureau/boek. Alleen
   de vorm komt nu uit /ds/, en bedrag en datum volgen de taal van het lid. */
const $ = s => document.querySelector(s);
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let TOKEN = null; try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) {}
const taal = () => document.documentElement.lang || 'nl';
const euro = n => new Intl.NumberFormat(taal(), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
/* Sfeerbeeld uit eigen huis, geen beeld van de bestemming zelf: er bestaat
   (nog) geen herkomstbeeld per reis, dus het beeld beweert geen plek. */
const BEELD = ['/images/worlds/heritage/travel-heritage-v2.jpg', '/campagne/jet.jpg', '/campagne/palacio.jpg'];
function meld(t) { const m = $('#melding'); m.textContent = t; m.classList.add('toon'); clearTimeout(m._t); m._t = setTimeout(() => m.classList.remove('toon'), 3200); }
const api = (pad, body, herkans) => fetch(pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
  body: JSON.stringify(body || {})
}).then(async r => {
  const d = await r.json().catch(() => ({}));
  /* 428 = de gegevenspoort: Rahul vraagt wat er mist en daarna gaat dit gewoon door */
  const p = herkans ? null : (window.RTGGegevensPoort && window.RTGGegevensPoort.vang(d, r.status, () => api(pad, body, true), api));
  if (p) return p;
  if (!r.ok) { const fout = new Error(d.error || 'Er ging iets mis.'); fout.status = r.status; throw fout; } return d;
});
const eerste = k => window.RTGFirstSteps ? RTGFirstSteps.text(k) : '';

/* De eerste keer: geen boekbaar aanbod, of nog niet ingelogd. Het beeld is
   inspiratie en staat er met die naam bij; de knoppen vullen alleen een wens. */
function welkom(gast) {
  return '<section class="ds-status ds-status--binnen" data-rtg-first-steps><img class="ds-status__beeld" src="' + BEELD[0] + '" alt="">' +
    '<p class="ds-meta">' + eerste('travelAtmosphere') + '</p><p class="ds-label">' + eerste('agency') + '</p><h2 class="ds-status__titel">' + eerste('travelTitle') + '</h2>' +
    '<p class="ds-status__tekst">' + eerste(gast ? 'guest' : 'travelIntro') + '</p>' +
    (gast ? '<a class="ds-knop ds-knop--primair ds-status__actie" href="/apps/app.html">' + eerste('login') + '</a>'
      : '<div class="ds-chips" role="group">' + ['rest', 'company', 'explore'].map(k => '<button class="ds-chip" type="button" aria-pressed="false" data-first-preference="' + k + '">' + eerste(k) + '</button>').join('') + '</div>' +
        '<button class="ds-knop ds-knop--primair ds-status__actie" type="button" data-first-action="wish" data-ds-actie="Bespreek uw reiswens">' + eerste('wish') + '</button>' +
        '<p class="ds-status__tekst">' + eerste('unavailable') + '</p><p class="ds-status__tekst">' + eerste('start') + '</p>') + '</section>';
}

let ALLE = [], HUIDIG = null, travelFlow = null;
const AANVRAGEN = window.RTGReisbureauAanvragen({ $, esc, api, meld });
/* Meenemen (shared/uitvoer.js): de reizen die klaarstaan, met de velden los.
   Eigen aanvragen staan hier niet in; dit is de etalage. */
if (window.RTGUitvoer) RTGUitvoer.bron(function () {
  if (!ALLE.length) return null;
  return { naam: 'reizen', kolommen: ['reis', 'bestemming', 'periode', 'prijs per persoon'],
    rijen: ALLE.map(r => [r.titel || '', r.bestemming || '', r.dates || '', r.prijs || 0]) };
});
function kaart(r, i) {
  return '<button class="ds-kaart ds-kaart--beeld" type="button" data-id="' + esc(r.id) + '" aria-label="Bekijk deze reis: ' + esc(r.titel) + '">' +
    '<img class="ds-kaart__beeld" src="' + BEELD[i % BEELD.length] + '" alt="" loading="lazy"><span class="ds-kaart__inhoud">' +
    '<span class="ds-kaart__titel">' + esc(r.titel) + '</span><span class="ds-kaart__sub">' + esc(r.bestemming) + (r.dates ? ' · ' + esc(r.dates) : '') + '</span>' +
    '<span class="ds-kaart__sub">Vanaf ' + euro(r.prijs) + ' per persoon</span></span></button>';
}
async function laad() {
  let d;
  try { d = await api('/api/reisbureau'); } catch (e) { $('#lijst').innerHTML = '<div class="ds-status ds-status--binnen"><p class="ds-status__tekst">' + esc(e.message) + '</p></div>'; return; }
  ALLE = d.reizen || [];
  $('#lijst').innerHTML = ALLE.length ? '<div class="ds-collectie__raster">' + ALLE.map(kaart).join('') + '</div>' : welkom(false);
  $('#travelAdvice').hidden = !ALLE.length;
  /* Een andere ingang (Reizen & Veilig) mag een wens of een reis MEEGEVEN, nooit
     een advies opvragen of iets versturen: de wens wordt ingevuld en drukken
     doet het lid hier zelf. Een reis-id die niet in de catalogus staat, opent niets. */
  const mee = new URLSearchParams(location.search);
  if (mee.get('wens') && ALLE.length && !$('#adviesIn').value) {
    $('#adviesIn').value = mee.get('wens').slice(0, 200);
    $('#travelAdvice').hidden = false;
  } else if (mee.get('wens') && !ALLE.length) {
    /* Een wens die nergens heen kan, verdwijnt niet stil. */
    meld('Er is nu geen samengestelde reis om uw wens tegen te leggen. Uw wens is niet verstuurd.');
  }
  if (mee.get('reis')) openReis(mee.get('reis'));
  $('#lijst').querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => openReis(b.dataset.id)));
  AANVRAGEN.laadMijn();
}
function bericht(tekst, eigen) { return '<p class="ds-gesprek__bericht' + (eigen ? ' ds-gesprek__bericht--eigen" data-user-content' : '"') + '>' + tekst + '</p>'; }
const GEEN = 'Er is op dit moment geen passende reis beschikbaar. Uw reiswens is niet verstuurd en er is niets geboekt.';
async function advies() {
  const wens = $('#adviesIn').value.trim();
  if (!wens) { meld('Vertel eerst waar je zin in hebt.'); return; }
  const uit = $('#adviesUit'), eigen = bericht(esc(wens), true);
  uit.innerHTML = eigen + bericht('Rahul denkt mee...');
  try {
    const d = await api('/api/reisbureau/advies', { wens });
    if (d.reis) {
      uit.innerHTML = eigen + bericht('<b>' + esc(d.reis.titel) + '</b> · ' + esc(d.reden)) + '<div><button class="ds-knop ds-knop--stil ds-knop--klein" type="button" id="adviesOpen">Bekijk</button></div>';
      $('#adviesOpen').addEventListener('click', () => openReis(d.reis.id));
    } else uit.innerHTML = eigen + bericht(GEEN);
  } catch (e) { uit.innerHTML = eigen + bericht(e.status === 404 ? GEEN : esc(e.message)); }
}
function openReis(id) {
  const next = ALLE.find(r => r.id === id); if (!next) return;
  if (travelFlow.open(next)) {
    HUIDIG = next;
    $('#bladBeeld').src = BEELD[Math.max(0, ALLE.indexOf(next)) % BEELD.length];
    $('#bladNaam').textContent = HUIDIG.titel;
    $('#bladMeta').textContent = HUIDIG.bestemming;
    $('#bladTag').textContent = HUIDIG.omschrijving || '';
    const vink = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>';
    $('#bladInbeg').innerHTML = ((HUIDIG.inbegrepen || []).length ? HUIDIG.inbegrepen : ['Op maat samengesteld']).map(x => '<li class="ds-detail__gegeven">' + vink + esc(x) + '</li>').join('');
    laadRegels(HUIDIG.bestemming);
  }
  document.body.dataset.dsSchermtype = 'detail';
  if (!$('#blad').open) $('#blad').showModal();
}
/* De Reiswijzer: wie ergens naartoe gaat, krijgt ALLE regels van dat land:
   visum, paspoort, verkeer, alarmnummer, water, fooi, alcohol en let-op.
   Automatisch bijgehouden door de Regelwacht. */
async function laadRegels(bestemming) {
  const el = $('#bladRegels');
  el.textContent = 'Laden…';
  try {
    const w = await api('/api/reis/wijzer', { bestemming });
    const rij = (k, v) => '<li class="ds-detail__gegeven"><span><span class="ds-veld__label">' + k + '</span><span class="ds-veld__waarde">' + v + '</span></span></li>';
    el.innerHTML = '<p class="ds-meta"><b>' + esc(w.naam) + '</b> · ' + esc(w.regio) + '</p><ul class="ds-detail__gegevens">' +
      rij('Visum', esc(w.visum.tekst)) + rij('Paspoort', esc(w.paspoort)) + rij('Verkeer', 'Er wordt ' + esc(w.rijden) + ' gereden') +
      rij('Alarmnummer', esc(w.alarm)) + rij('Kraanwater', esc(w.waterTekst)) + rij('Fooi', esc(w.fooi)) +
      rij('Alcohol', 'Vanaf ' + esc(w.alcoholLeeftijd) + ' jaar') + rij('Btw', esc(w.btwStandaard) + '% standaardtarief') +
      (w.letOp ? rij('Let op', '<b>' + esc(w.letOp) + '</b>') : '') + '</ul><p class="ds-meta">' + esc(w.basis) + '</p>';
  } catch (e) { el.textContent = e.message; }
}

if (!TOKEN) { $('#lijst').innerHTML = welkom(true); }
else {
  travelFlow = window.RTGTravelExperience({ token: TOKEN, api, refresh: AANVRAGEN.laadMijn });
  $('#main').addEventListener('click', e => {
    const voorkeur = e.target.closest('[data-first-preference]');
    if (voorkeur) {
      document.querySelectorAll('[data-first-preference]').forEach(b => b.setAttribute('aria-pressed', String(b === voorkeur)));
      const wensen = { rest: 'Ik wil tot rust komen.', company: 'Ik wil samen op reis.', explore: 'Ik wil iets nieuws ontdekken.' };
      $('#adviesIn').value = wensen[voorkeur.dataset.firstPreference];
    }
    if (e.target.closest('[data-first-action="wish"]')) {
      $('#travelAdvice').hidden = false;
      $('#travelAdvice').scrollIntoView({ block: 'center' }); $('#adviesIn').focus();
    }
  });
  $('#adviesGo').addEventListener('click', advies);
  $('#bladTerug').addEventListener('click', () => $('#blad').close());
  /* Escape sluit het blad niet terwijl een aanvraag onderweg is (dan staat Terug uit). */
  $('#blad').addEventListener('cancel', e => { if ($('#bladTerug').disabled) e.preventDefault(); });
  $('#blad').addEventListener('close', () => { document.body.dataset.dsSchermtype = 'collectie'; });
  laad();
}
})();

/* Mijn Mall: de lijsten, de reismanden en de eigen aanvragen van een lid.

   Twee dingen die deze pagina met opzet NIET doet:
   - afrekenen. Een reis met een hotel, een scooter en een tafel is drie
     handelingen bij drie partijen; elke regel wijst naar de plek waar dat
     gebeurt en nergens staat een knop die doet alsof het er een is.
   - aandringen. Geen aftelklok, geen "nog 2 beschikbaar", geen suggesties die
     toevallig het duurst zijn. Een lijst is een geheugensteun.

   Een vervallen regel blijft staan met de reden erbij: stilweg verdwijnen laat
   iemand zoeken naar iets waarvan hij zeker weet dat hij het had bewaard. */

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const euro = (n) => (n == null) ? '' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
let TOKEN = null; try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) {}

function meld(t) {
  const m = $('#melding'); m.textContent = t; m.style.opacity = '1';
  clearTimeout(m._t); m._t = setTimeout(() => { m.style.opacity = '0'; }, 2600);
}
const api = (pad, body) => fetch(pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
  body: JSON.stringify(body || {})
}).then(async (r) => {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Er ging iets mis.');
  return d;
});

/* De verdiepingen komen uit de Mall zelf, zodat er hier geen tweede lijst
   ontstaat die na een wijziging stilletjes achterloopt. */
async function vulVerdiepingen() {
  try {
    const d = await api('/api/mall/home', {});
    const sel = $('#aVerdieping');
    for (const v of d.verdiepingen || []) {
      const o = document.createElement('option');
      o.value = v.id; o.textContent = v.label; sel.appendChild(o);
    }
  } catch (e) { /* de keuzelijst blijft leeg; plaatsen geeft dan een nette fout */ }
}

/* ---------- lijsten en reismanden ---------- */

const OPEN = new Set();

async function tekenLijsten() {
  let d;
  try { d = await api('/api/mall/lijsten', {}); } catch (e) { $('#lijsten').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; return; }
  if (!d.lijsten.length) { $('#lijsten').innerHTML = '<div class="leeg">Nog niets bewaard. Druk in de Mall op Bewaren bij iets dat je wilt onthouden.</div>'; return; }
  $('#lijsten').innerHTML = d.lijsten.map((l) =>
    '<div class="kaart" data-lijst="' + esc(l.id) + '">' +
      '<div class="rij" style="margin-top:0;">' +
        '<h3>' + esc(l.naam) + '</h3>' +
        '<span class="meta">' + (l.soort === 'reis' ? 'reis' : 'lijst') + ' &middot; ' + l.aantal + '</span>' +
        (l.plek ? '<span class="meta">' + esc(l.plek) + (l.van ? ' &middot; ' + esc(l.van) + ' t/m ' + esc(l.tot || '') : '') + '</span>' : '') +
        '<span style="flex:1;"></span>' +
        '<button class="knop stil open" data-id="' + esc(l.id) + '" type="button">' + (OPEN.has(l.id) ? 'Inklappen' : 'Openen') + '</button>' +
        (l.soort === 'reis' ? '<a class="knop stil" href="/apps/mall.html?lijst=' + encodeURIComponent(l.id) + '">Zoeken voor deze reis</a>' : '') +
        '<button class="knop stil weg" data-id="' + esc(l.id) + '" type="button">Verwijder</button>' +
      '</div>' +
      '<div class="inhoud" id="in-' + esc(l.id) + '"></div>' +
    '</div>').join('');

  $('#lijsten').querySelectorAll('.open').forEach((b) => b.addEventListener('click', () => {
    if (OPEN.has(b.dataset.id)) OPEN.delete(b.dataset.id); else OPEN.add(b.dataset.id);
    tekenLijsten();
  }));
  $('#lijsten').querySelectorAll('.weg').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Deze lijst verwijderen?')) return;
    try { await api('/api/mall/lijst/weg', { id: b.dataset.id }); OPEN.delete(b.dataset.id); meld('Verwijderd.'); tekenLijsten(); }
    catch (e) { meld(e.message); }
  }));
  for (const id of OPEN) tekenInhoud(id);
}

async function tekenInhoud(id) {
  const doel = $('#in-' + id);
  if (!doel) return;
  let d;
  try { d = await api('/api/mall/lijst', { id }); } catch (e) { doel.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; return; }
  const l = d.lijst;
  let html = '';
  if (d.reis) {
    html += '<div class="vakjes">' + d.reis.onderdelen.map((o) =>
      '<span class="vak' + (o.heeft ? ' heeft' : '') + '">' + (o.heeft ? '&#10003; ' : '') + esc(o.label) + '</span>').join('') + '</div>' +
      '<p class="meta" style="margin-top:.5rem;">' + esc(d.reis.opmerking) + '</p>';
  }
  html += l.regels.map((r) => {
    if (r.vervallen) {
      return '<div class="regel vervallen"><div><b>' + esc(r.titel) + '</b>' +
        '<div class="waarom">' + esc(r.reden) + '</div></div>' +
        '<div class="op"><button class="knop stil regelweg" data-lijst="' + esc(l.id) + '" data-id="' + esc(r.aanbodId) + '" type="button">Weg</button></div></div>';
    }
    const a = r.aanbod;
    const verschil = r.prijsVerschil;
    return '<div class="regel"><div>' +
      '<b>' + esc(a.titel) + '</b>' +
      '<div class="meta">' + esc(a.typeLabel) + ' &middot; ' + esc(a.aanbieder.naam) + (a.plek.stad ? ' &middot; ' + esc(a.plek.stad) : '') + '</div>' +
      (a.prijs ? '<div class="meta">' + (a.prijs.vanaf ? 'vanaf ' : '') + euro(a.prijs.bedrag) + ' ' + esc(a.prijs.eenheid) + '</div>' : '') +
      (verschil ? '<div class="' + (verschil > 0 ? 'prijsop' : 'prijsaf') + '">' +
        (verschil > 0 ? '+' : '') + euro(verschil) + ' sinds je hem bewaarde</div>' : '') +
      (a.beschikbaar ? '<div class="meta">' + esc(a.beschikbaar.tekst) + '</div>' : '') +
      '</div><div class="op">' +
      '<a class="knop stil" href="' + esc(a.pagina) + '">' + esc(a.cta) + '</a>' +
      '<button class="knop stil regelweg" data-lijst="' + esc(l.id) + '" data-id="' + esc(r.aanbodId) + '" type="button">Weg</button>' +
      '</div></div>';
  }).join('');
  if (!l.regels.length) html += '<div class="leeg">Nog niets in deze lijst.</div>';
  doel.innerHTML = html;
  doel.querySelectorAll('.regelweg').forEach((b) => b.addEventListener('click', async () => {
    try { await api('/api/mall/lijst/regel-weg', { id: b.dataset.lijst, aanbodId: b.dataset.id }); meld('Van de lijst gehaald.'); tekenLijsten(); }
    catch (e) { meld(e.message); }
  }));
}

/* ---------- opstarten ---------- */

function start() {
  $('#nieuwLijst').addEventListener('click', () => maakLijst('lijst'));
  $('#nieuwReis').addEventListener('click', () => maakLijst('reis'));
  $('#aPlaats').addEventListener('click', plaatsAanvraag);
  vulVerdiepingen();
  tekenLijsten();
  tekenAanvragen();
}

async function maakLijst(soort) {
  const naam = $('#nieuwNaam').value.trim();
  if (!naam) { meld('Geef de lijst eerst een naam.'); return; }
  const body = { naam, soort };
  if (soort === 'reis') {
    body.plek = prompt('Naar welke plaats? (mag leeg blijven)') || '';
    body.van = prompt('Van welke datum? (jjjj-mm-dd, mag leeg)') || '';
    body.tot = prompt('Tot welke datum? (jjjj-mm-dd, mag leeg)') || '';
  }
  try { await api('/api/mall/lijst/nieuw', body); $('#nieuwNaam').value = ''; meld('Aangemaakt.'); tekenLijsten(); }
  catch (e) { meld(e.message); }
}

async function plaatsAanvraag() {
  const body = {
    wat: $('#aWat').value.trim(),
    verdieping: $('#aVerdieping').value,
    plek: $('#aPlek').value.trim(),
    wanneer: $('#aWanneer').value || null,
    budget: Number($('#aBudget').value) || null
  };
  try {
    await api('/api/mall/aanvraag', body);
    $('#aWat').value = ''; $('#aBudget').value = '';
    meld('Uw vraag staat uit. Zaken in dit vak en deze plaats zien hem.');
    tekenAanvragen();
  } catch (e) { meld(e.message); }
}

/* Starten pas als ALLE scripts van deze pagina zijn geladen. Deze pagina komt
   in twee delen (de aanvragen staan in ./mijnmall-aanvragen.js, want dit
   bestand liep op de bestandsgrens), en start() roept een functie aan die in
   dat tweede deel staat. Meteen starten gaf een lege pagina met een fout in de
   console -- de stilste vorm van stuk die er is. */
window.addEventListener('DOMContentLoaded', () => {
  if (!TOKEN) {
    $('#main').innerHTML = '<div class="inlog"><h2>Log eerst in</h2>' +
      '<p class="oms" style="margin-top:.6rem;">Mijn Mall is er voor leden. Open de app en log in met je RTG-account.</p>' +
      '<p style="margin-top:1rem;"><a href="/apps/app.html">Naar de app &rarr;</a></p></div>';
    return;
  }
  start();
});

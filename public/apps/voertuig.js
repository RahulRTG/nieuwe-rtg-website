/* RTG Voertuig -- EEN voertuig uit de vloot, met een adres.

   WAAROM DIT SCHERM ER IS. De verwijsvorm van dit huis (rtg://<soort>/<id>) kon
   nergens heen voor een voertuig. Een ticket over een kapotte bus droeg daardoor
   hooguit "bus 28" in de vrije tekst, en dat is geen verwijzing maar een hoop.

   TWEE DINGEN HETEN HIER VOERTUIG, EN DIT IS DE DUURZAME. `db.data.ovVoertuigen`
   is een LIVE positie met een houdbaarheid van twee minuten. Dit scherm toont een
   `mobAsset`: het voertuig zelf, met zijn papieren, en dat bestaat morgen nog.

   DE KERN IS DE FAIL-CLOSED PAPIERENREGEL uit kern/mobiliteit/assets.js: een
   verplicht document zonder geldige einddatum telt als ONGELDIG. Er wordt hier
   niets bijgerekend -- inzetbaar, de redenen en wat bijna afloopt komen van de
   server (LAT-regel 4). Dit bestand tekent ze alleen, in de vorm van /ds/.

   WIE ER BINNENKOMT is de vervoerder zelf: /api/supplier/mob/vloot hangt achter
   supplierAuth. Wie geen sleutel heeft, ziet dat en niet een leeg scherm. */
(() => {
  const $ = s => document.querySelector(s);
  /* TWEE DEUREN KOMEN OP DEZELFDE SESSIE UIT (rol 'supplier'): de PDA-kant van
     het personeel (`rtg_pda_token`) en de leverancier-inlog zelf
     (`rtg_sup_token`). De PDA eerst: wie op de vloer staat opent dit scherm
     vanuit zijn dienst. Allebei UITGESCHREVEN: test/blindevlek.test.js leest
     `getItem('...')` met een letterlijke naam (LAT-regel 9). */
  const token = (() => {
    try { return localStorage.getItem('rtg_pda_token') || localStorage.getItem('rtg_sup_token'); }
    catch (e) { return null; }
  })();
  const gevraagd = new URLSearchParams(location.search).get('voertuig') || '';

  const api = (pad, body) => fetch('/api/supplier/mob/' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  let meldT;
  const zeg = t => { const m = $('#melding'); m.textContent = t; m.classList.add('toon');
    clearTimeout(meldT); meldT = setTimeout(() => m.classList.remove('toon'), 4200); };
  const leeg = el => { while (el.firstChild) el.removeChild(el.firstChild); };
  const maak = (tag, klasse, tekst) => { const e = document.createElement(tag);
    if (klasse) e.className = klasse; if (tekst != null) e.textContent = tekst; return e; };
  /* Een einddatum volgt de taal van de pagina; wat geen datum is, blijft staan. */
  const datum = t => { const d = new Date(t);
    return isNaN(d) ? String(t) : d.toLocaleDateString(document.documentElement.lang || 'nl', { dateStyle: 'medium' }); };
  const STIP = '<svg class="ds-lijst__icoon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="3"/></svg>';

  /* Een rij: naam links, waarde rechts. `let` maakt een afwijking zichtbaar in
     tekst (data-let), nooit alleen in kleur. */
  function rij(naam, waarde, klasse) {
    const li = maak('li', 'ds-lijst__rij'); li.innerHTML = STIP;
    const t = maak('span'); t.appendChild(maak('span', 'ds-lijst__titel', naam)); li.appendChild(t);
    const w = maak('span', 'ds-lijst__tijd', waarde);
    if (klasse) li.dataset.let = klasse;
    li.appendChild(w); return li;
  }

  function toonPapieren(v) {
    const doel = $('#vPapieren'); leeg(doel);
    const verplicht = v.verplichtePapieren || [];
    if (!verplicht.length) {
      doel.appendChild(rij('geen verplichte papieren', 'voor deze categorie'));
      $('#vPapierenLet').textContent = 'Deze voertuigcategorie kent geen verplichte documenten. Dat is een eigenschap van de categorie en geen ontbrekende invoer.';
      return;
    }
    const papieren = v.papieren || {};
    for (const naam of verplicht) {
      const p = papieren[naam];
      /* De kern bewaart een papier als zijn einddatum (kern/mobiliteit/assets.js);
         hier stond alleen de objectvorm, en dan las elk geldig papier als
         "geen einddatum" naast een voertuig dat de server inzetbaar noemde. */
      const tot = typeof p === 'string' ? p : p && (p.tot || p.geldigTot || p.einddatum);
      doel.appendChild(rij(naam, tot ? 'tot ' + datum(tot) : 'geen einddatum', tot ? '' : 'nee'));
    }
    /* De zin die dit scherm draagt. Hij staat er ALTIJD, ook als alles in orde
       is: wie hem alleen bij een probleem leest, denkt bij een leeg scherm dat er
       niets gecontroleerd is. */
    $('#vPapierenLet').textContent = 'Een verplicht document zonder geldige einddatum telt als ONGELDIG, niet als "vast wel in orde" -- daarom staat een voertuig zonder papieren niet op beschikbaar maar op geblokkeerd, met de reden erbij.';
  }

  function toonDit(v) {
    $('#dit').hidden = false; $('#geen').hidden = true;
    document.body.dataset.dsSchermtype = 'detail';
    $('#vNaam').textContent = v.naam || v.id;
    $('#vSub').textContent = [v.categorieNaam, v.registratie, v.laag].filter(Boolean).join(' · ');

    const bijna = (v.bijnaOp || []).length;
    $('#vStand').textContent = (v.inzetbaar ? 'inzetbaar' : 'niet inzetbaar') + (bijna ? ' · ' + bijna + ' loopt bijna af' : '');
    $('#vStand').dataset.inzetbaar = v.inzetbaar ? 'ja' : 'nee';

    const red = $('#vRedenen'); leeg(red);
    for (const r of (v.redenen || [])) red.appendChild(rij(r, 'blokkeert', 'nee'));
    for (const b of (v.bijnaOp || [])) {
      red.appendChild(rij('loopt bijna af: ' + (typeof b === 'string' ? b : (b.naam || b.papier || JSON.stringify(b))), '', 'bijna'));
    }
    if (!red.childNodes.length) red.appendChild(rij('Geen blokkade en niets dat bijna afloopt.', ''));

    const ken = $('#vKenmerken'); leeg(ken);
    ken.appendChild(rij('plaatsen', String(v.plaatsen)));
    ken.appendChild(rij('bagage', String(v.bagage)));
    ken.appendChild(rij('rolstoeltoegankelijk', v.rolstoel ? 'ja' : 'nee'));
    ken.appendChild(rij('bemanning nodig', String(v.bemanningNodig)));
    ken.appendChild(rij('onderhoud', v.onderhoud || 'in orde'));
    if (v.uitDienst) ken.appendChild(rij('uit dienst', 'ja', 'nee'));
  }

  /* De bestuurder: een teamlid of een vrije naam. Afwezig zegt DAT, nooit
     waarom -- de server geeft alleen die vlag (kern/mobiliteit/bestuurder.js). */
  let team = null;
  function toonBestuurder(v) {
    const doel = $('#vBestuurder'); leeg(doel);
    doel.appendChild(rij('bestuurder', (v.bestuurder || 'geen') + (v.bestuurderAfwezig ? ' · afwezig' : ''),
      v.bestuurderAfwezig ? 'nee' : ''));
    $('#vBestuurderKies').hidden = !team;
    if (!team) return;
    const sel = $('#vTeam'); leeg(sel);
    const geen = maak('option', '', 'geen teamlid'); geen.value = '';
    sel.appendChild(geen);
    for (const m of team) {
      const o = maak('option', '', m.name); o.value = String(m.id);
      if (m.id === v.bestuurderStaffId) o.selected = true;
      sel.appendChild(o);
    }
    $('#vTeamZet').onclick = async () => {
      const r = await api('voertuig', { id: v.id, bestuurderStaffId: sel.value || null });
      if (r.status !== 200) { zeg((r.body && r.body.error) || 'Niet bewaard.'); return; }
      zeg('Bestuurder bewaard.'); laad();
    };
  }

  function toonVloot(assets) {
    const doel = $('#vloot'); leeg(doel);
    for (const a of assets) {
      const li = maak('li');
      const b = maak('button', 'ds-keuze'); b.type = 'button'; b.dataset.voertuig = a.id;
      b.setAttribute('aria-pressed', String(a.id === gevraagd));
      b.appendChild(maak('span', 'ds-veld__label', a.naam || a.id));
      b.appendChild(maak('span', 'ds-veld__waarde', a.inzetbaar ? 'inzetbaar' : 'niet inzetbaar'));
      b.addEventListener('click', () => {
        history.replaceState(null, '', '?voertuig=' + encodeURIComponent(a.id));
        for (const x of doel.querySelectorAll('[aria-pressed]')) x.setAttribute('aria-pressed', String(x === b));
        toonDit(a); toonPapieren(a); toonBestuurder(a);
      });
      li.appendChild(b); doel.appendChild(li);
    }
    $('#vlootLet').textContent = assets.length
      ? 'Deze vloot is van de vervoerder waarmee u bent aangemeld; voertuigen van een andere vervoerder staan hier niet.'
      : 'Er staat geen voertuig op naam van deze vervoerder.';
  }

  async function laad() {
    if (!token) {
      $('#geen').hidden = false;
      $('#geenTekst').textContent = 'Dit scherm is van de vervoerder: meld u aan met uw personeelssleutel. Zonder sleutel wordt hier niets getoond -- dat is geen leeg scherm maar een gesloten deur.';
      return;
    }
    const r = await api('vloot');
    if (r.status !== 200) {
      $('#geen').hidden = false;
      $('#geenTekst').textContent = (r.body && r.body.error) || 'De vloot kon niet worden geladen.';
      return;
    }
    const assets = (r.body && r.body.assets) || [];
    team = (r.body && r.body.team) || null;
    toonVloot(assets);
    if (!gevraagd) {
      $('#geen').hidden = false;
      $('#geenTekst').textContent = 'Kies een voertuig uit de vloot hieronder, of open er een met een adres: ?voertuig=<id>.';
      return;
    }
    const v = assets.find(a => a.id === gevraagd);
    if (!v) {
      $('#geen').hidden = false;
      /* Er wordt NIET geraden welk voertuig bedoeld werd: een vreemd id en een
         verdwenen id zeggen we niet uit elkaar, want dat verschil verraadt of
         een voertuig bij een ander bestaat. */
      $('#geenTekst').textContent = 'Voertuig "' + gevraagd + '" staat niet in deze vloot. Dat betekent of dat het niet (meer) bestaat, of dat het bij een andere vervoerder hoort; welke van de twee zegt dit scherm bewust niet.';
      return;
    }
    toonDit(v); toonPapieren(v); toonBestuurder(v);
  }

  $('#ververs').addEventListener('click', () => { laad().then(() => zeg('Bijgewerkt.')); });
  laad();
})();

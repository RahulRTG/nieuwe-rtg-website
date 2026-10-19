(function () {
'use strict';
/* Het routedossier op het RTG Design System (TRAVELOS-MIGRATIE.md par. 1b):
   dezelfde aanroep achter de kantoordeur, dezelfde zinnen en tekens; de vorm
   komt uit /ds/ en getallen volgen de taal. De balkjes per schakel zijn weg:
   hun breedte kon alleen via element.style, de aantallen staan er al naast. */
const $ = s => document.querySelector(s);
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const taal = () => document.documentElement.lang || 'nl';
const getal = n => Number(n || 0).toLocaleString(taal());
/* Een pad breekt na elke schuine streep (<wbr>) en leest ook in het Arabisch links-rechts. */
const pad = p => '<bdi dir="ltr">' + esc(p).replace(/\//g, '/<wbr>') + '</bdi>';

/* De kantoor-inlog woont in de personeels-app (check.js regel 18: EEN kantoordeur). */
const naarInlog = () => location.replace('/apps/personeel.html?kantoor=1&terug=' +
  encodeURIComponent(location.pathname));
let TOKEN = null;
try { TOKEN = localStorage.getItem('rtg_office_token'); } catch (e) { TOKEN = null; }
if (!TOKEN) return naarInlog();

let pagina = 1, schakel = '', schakels = [], routes = 0;

async function haal(lijf) {
  const r = await fetch('/api/office/routedossier', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
    body: JSON.stringify(lijf)
  });
  if (r.status === 401) return naarInlog();
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Het dossier is niet op te halen.');
  return d;
}

/* Vijf staten, vijf tekens: het teken draagt de betekenis, niet een kleur.
   `verklaard` krijgt met opzet GEEN vinkje (niemand heeft het nagevraagd), en
   `nvt` de lege verzameling: em- en en-streepjes mogen niet in de bron. */
const TEKEN = { bewezen: '✓', gezakt: '×', nvt: '∅', verklaard: '?', ongemeten: '·' };
const leeg = t => '<li class="ds-status ds-status--binnen"><p class="ds-status__tekst">' + esc(t) + '</p></li>';

function tekenAssen(d) {
  schakels = d.schakels;
  $('#assen').innerHTML = d.schakels.map(s => {
    const p = d.perSchakel[s.id] || { bewezen: 0, ongemeten: 0, nvt: 0, verklaard: 0, gezakt: 0 };
    return '<button class="ds-keuze" type="button" data-as="' + esc(s.id) + '"' +
      ' data-instrument="' + (s.bron ? 'ja' : 'nee') + '"' +
      ' aria-pressed="' + (schakel === s.id) + '"' +
      ' title="' + esc(s.uitleg) + (s.nodig ? ' -- ' + esc(s.nodig) : '') + '">' +
      '<span class="ds-veld__label">' + esc(s.id) + (s.bron ? '' : ' -- geen instrument') + '</span>' +
      '<span class="ds-veld__waarde">' + getal(p.bewezen) + ' bewezen · ' + getal(p.ongemeten) + ' ongemeten' +
      (p.nvt ? ' · ' + getal(p.nvt) + ' nvt' : '') +
      (p.gezakt ? ' · ' + getal(p.gezakt) + ' GEZAKT' : '') + '</span></button>';
  }).join('');
  for (const b of document.querySelectorAll('#assen [data-as]')) {
    b.addEventListener('click', () => {
      schakel = (schakel === b.dataset.as) ? '' : b.dataset.as;
      pagina = 1; ververs();
    });
  }
}

function tekenSamenvatting(d) {
  const t = d.telling;
  const zonder = d.schakels.filter(s => !s.bron).map(s => s.id);
  $('#samenvatting').innerHTML =
    esc(getal(d.routes)) + ' routes × ' + d.schakels.length + ' schakels = ' +
    esc(getal(d.cellen)) + ' cellen. Daarvan ' +
    '<b>' + esc(getal(t.bewezen)) + ' bewezen</b>, ' +
    esc(getal(t.ongemeten)) + ' ongemeten, ' +
    esc(getal(t.nvt)) + ' niet van toepassing' +
    (t.gezakt ? ', <b>' + esc(getal(t.gezakt)) + ' gezakt</b>' : '') + '. ' +
    /* DE BELANGRIJKSTE ZIN: een as zonder instrument is een ontbrekende meter,
       geen achterstand van duizenden cellen. */
    (zonder.length
      ? '<b>' + esc(zonder.join(' en ')) + '</b> ' + (zonder.length > 1 ? 'staan' : 'staat') +
        ' voor élke route op ongemeten: daar bestaat nog geen instrument voor. ' +
        'Dat is iets anders dan achterstallig meetwerk.'
      : '') +
    ' Herkomst: ' + esc(d.herkomst) + '.';
}

function tekenFilteruitleg(l) {
  const st = $('#staat').value;
  let t;
  if (schakel && st) t = 'Routes waarvan ' + schakel + ' op "' + st + '" staat.';
  else if (schakel) t = 'Het openstaande werk op ' + schakel + ': alles wat daar niet bewezen ' +
    'en niet "niet van toepassing" is. Kies er een staat bij om preciezer te kijken.';
  else if (st) t = 'Routes waar minstens één schakel op "' + st + '" staat.';
  else t = 'Alle routes. Klik een schakel hierboven aan voor het openstaande werk op die schakel.';
  $('#filteruitleg').textContent = t + ' ' + getal(l.totaal) + ' van ' + getal(routes) + ' routes.';
}

/* Een rij per route: methode, pad en de strip van elf tekens in de volgorde
   van de schakels. Gezakt krijgt naast zijn teken het woord en de stip. */
function tekenLijst(l) {
  $('#lijst').innerHTML = l.resultaten.map(r => {
    const strip = schakels.map(s => {
      const c = r.cellen[s.id] || { staat: 'ongemeten' };
      return '<span data-s="' + esc(c.staat) + '" title="' + esc(s.id + ': ' + c.staat) + '">' +
        (TEKEN[c.staat] || '·') + '</span>';
    }).join(' ');
    const gezakt = Object.values(r.cellen).some(c => c.staat === 'gezakt');
    return '<li><a class="ds-lijst__rij" href="#dossier" data-methode="' + esc(r.methode) + '" data-pad="' + esc(r.pad) + '"' +
      (gezakt ? ' data-gezakt="ja"' : '') + '>' +
      '<span class="ds-lijst__tijd">' + esc(r.methode) + '</span>' +
      '<span><span class="ds-lijst__titel">' + pad(r.pad) + '</span>' +
      '<span class="ds-lijst__tekst">' + strip + (gezakt ? ' · gezakt' : '') + '</span></span>' +
      (gezakt ? '<span class="ds-lijst__stip" aria-hidden="true"></span>' : '<span></span>') + '</a></li>';
  }).join('') || leeg('Geen route past bij dit filter.');

  for (const rij of document.querySelectorAll('#lijst [data-pad]')) {
    rij.addEventListener('click', e => { e.preventDefault(); toonDossier(rij.dataset.methode, rij.dataset.pad); });
  }
  $('#paginatel').textContent = l.totaal
    ? 'pagina ' + l.pagina + ' van ' + l.paginas + ' · ' + getal(l.totaal) + ' routes'
    : 'geen resultaten';
  $('#vorige').disabled = l.pagina <= 1;
  $('#volgende').disabled = l.pagina >= l.paginas;
}

const regel = (teken, naam, wat, bronnen) => '<li class="ds-lijst__rij">' +
  '<span class="ds-lijst__tijd" aria-hidden="true">' + (teken || '') + '</span>' +
  '<span><span class="ds-lijst__titel">' + naam + '</span>' +
  (wat ? '<span class="ds-lijst__tekst">' + wat + '</span>' : '') +
  (bronnen || []).filter(Boolean).map(b => '<span class="ds-lijst__tekst">' + b + '</span>').join('') +
  '</span><span></span></li>';

async function toonDossier(methode, padNaam) {
  const d = await haal({ methode, pad: padNaam });
  if (!d || !d.gevonden) return;
  $('#dMethode').textContent = methode;
  $('#dPad').innerHTML = pad(padNaam);
  /* BEWIJSLUS.md par. 7: ook de vervalstaat, de plek in de code en wat NIEMAND
     meet. Een veld dat de server niet levert, laat zijn blok weg. */
  const v = d.vervalstaat, b = d.bron, n = d.nietGemeten;
  const kop = (v ? regel('', 'VERVALSTAAT · ' + esc(v.staat || 'niet vast te stellen') +
      (Number.isFinite(v.ouderdomDagen) ? ' · ' + esc(String(v.ouderdomDagen)) + ' dagen oud' : ''),
      esc(v.reden || ''), [v.heropent ? esc(v.heropent) : '']) : '') +
    (b ? regel('', 'IN DE CODE', b.bestand ? esc(b.bestand + ':' + b.regel) : esc(b.reden || 'onbekend'),
      [b.register ? 'uit ' + esc(b.register) : '']) : '');
  const NIET = { tegenvoorbeeld: 'TEGENVOORBEELD GEZOCHT', mutatiePerRoute: 'MUTATIE OP DEZE ROUTE',
    productie: 'WAARNEMING IN PRODUCTIE' };
  const staart = n ? '<p class="ds-label">WAT DIT DOSSIER NIET WEET</p><ul class="ds-lijst">' +
    Object.keys(NIET).filter(k => n[k]).map(k => regel('', esc(NIET[k]) + ' · ' + esc(n[k].staat),
      esc(n[k].reden || ''), [n[k].nodig ? 'nodig: ' + esc(n[k].nodig) : ''])).join('') + '</ul>' : '';
  const cellen = d.schakels.map(s => {
    const c = d.route.cellen[s.id] || { staat: 'ongemeten' };
    const detail = c.reden /* het waardevolste veld */ || (c.oordeel ? 'oordeel: ' + c.oordeel : '') ||
      (c.rollen ? 'geprobeerd met: ' + c.rollen.join(', ') : '') ||
      (c.pogingen ? c.pogingen + ' poging(en)' : '');
    return regel(TEKEN[c.staat] || '·', esc(s.id) + ' · ' + esc(c.staat), esc(s.uitleg), [
      detail ? esc(detail) : '',
      c.bron ? 'gemeten door ' + esc(c.bron)
        : (s.bron ? 'instrument: ' + esc(s.bron) : 'geen instrument -- ' + esc(s.nodig || 'nog te bouwen'))]);
  }).join('');
  $('#dLijf').innerHTML = (kop ? '<ul class="ds-lijst">' + kop + '</ul>' : '') +
    '<ul class="ds-lijst">' + cellen + '</ul>' + staart;
  document.body.dataset.dsSchermtype = 'detail';
  $('#dossier').showModal();
}

async function ververs() {
  try {
    const d = await haal({ zoek: $('#zoek').value.trim(), schakel,
      staat: $('#staat').value, pagina, limiet: 40 });
    if (!d) return;
    /* Onvolledig antwoord: een melding, geen ruwe TypeError (LIEGRONDE.json). */
    if (!(Array.isArray(d.schakels) && d.perSchakel && typeof d.perSchakel === 'object' && d.lijst && Array.isArray(d.lijst.resultaten))) throw new Error('Het antwoord was onvolledig, dus dit kon niet worden geladen.');
    routes = d.routes;
    tekenAssen(d); tekenSamenvatting(d); tekenFilteruitleg(d.lijst); tekenLijst(d.lijst);
  } catch (e) {
    $('#lijst').innerHTML = leeg(e.message);
  }
}

const opnieuw = () => { pagina = 1; ververs(); };
$('#zoeken').addEventListener('click', opnieuw);
$('#zoek').addEventListener('keydown', e => { if (e.key === 'Enter') opnieuw(); });
$('#staat').addEventListener('change', opnieuw);
$('#wis').addEventListener('click', () => {
  $('#zoek').value = ''; $('#staat').value = ''; schakel = ''; opnieuw();
});
$('#vorige').addEventListener('click', () => { if (pagina > 1) { pagina--; ververs(); } });
$('#volgende').addEventListener('click', () => { pagina++; ververs(); });
$('#dSluit').addEventListener('click', () => $('#dossier').close());
$('#dossier').addEventListener('close', () => { document.body.dataset.dsSchermtype = 'collectie'; });
ververs();
})();

(function () {
'use strict';
/* De routedekking op het RTG Design System (TRAVELOS-MIGRATIE.md par. 1b).
   Dezelfde aanroep als ervoor (/api/office/routedekking, achter de
   kantoordeur) en dezelfde zinnen; de vorm komt uit /ds/, en getal en datum
   volgen de taal van het scherm in plaats van vast nl-NL. De drie tabbladen
   doen wat shared/deelmenu.js vroeger van de drie koppen maakte. */
const $ = s => document.querySelector(s);
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const taal = () => document.documentElement.lang || 'nl';
const getal = n => Number(n || 0).toLocaleString(taal());
/* Een pad breekt na elke schuine streep (<wbr>) en leest ook in het Arabisch links-rechts. */
const pad = p => '<bdi dir="ltr">' + esc(p).replace(/\//g, '/<wbr>') + '</bdi>';
const leeg = t => '<li class="ds-status ds-status--binnen"><p class="ds-status__tekst">' + esc(t) + '</p></li>';

/* De kantoor-inlog woont in de personeels-app; hier staat hij niet nog een
   keer nagebouwd (scripts/check.js regel 18 bewaakt dat er maar EEN kantoordeur is). */
const naarInlog = () => location.replace('/apps/personeel.html?kantoor=1&terug=' +
  encodeURIComponent(location.pathname));
let TOKEN = null;
try { TOKEN = localStorage.getItem('rtg_office_token'); } catch (e) { TOKEN = null; }
if (!TOKEN) return naarInlog();

let pagina = 1;
const vraag = () => ({
  zoek: $('#zoek').value.trim(), domein: $('#domein').value,
  alleenGaten: $('#gaten').checked, pagina: pagina, limiet: 50
});

async function haal() {
  const r = await fetch('/api/office/routedekking', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
    body: JSON.stringify(vraag())
  });
  if (r.status === 401) return naarInlog();
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'De dekking is niet op te halen.');
  return d;
}

/* Drie standen, drie tekens. Het teken staat in de TEKST en niet alleen in
   een kleur of attribuut: wie kleur niet ziet, of het scherm zwart-wit
   afdrukt, hoort hetzelfde te lezen (ONTWERP.md par. 5). */
const TEKENS = {
  'in orde': ['gezond', '✓', 'In orde'],
  'achterhaald': ['incident', '×', 'Niet 100%'],
  'niet gemeten': ['aandacht', '!', 'Niet gemeten']
};

function tekenStand(d) {
  const [sig, teken, woord] = TEKENS[d.stand] || TEKENS['niet gemeten'];
  const s = $('#stand');
  s.dataset.sig = sig; s.dataset.teken = teken; s.textContent = teken + ' ' + woord;
  $('#wanneer').textContent = d.gemeten
    ? 'gemeten op ' + new Intl.DateTimeFormat(taal(), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d.gemeten.op)) +
      (d.gemeten.commit ? ' · commit ' + d.gemeten.commit : '')
    : 'er is nog geen meting vastgelegd';

  $('#cTotaal').textContent = getal(d.totaal);
  $('#cGedekt').textContent = getal(d.gedekt);
  $('#cOngedekt').textContent = getal(d.ongedekt);
  $('#cPct').textContent = d.pct + '%';

  /* EEN STAND ZONDER UITLEG IS EEN CIJFER. Bij elke afwijking staat hier wat
     er aan de hand is EN wat het herstelt. */
  let m = '';
  if (d.stand === 'niet gemeten')
    m = 'Er ligt geen bewijsstuk (DEKKING.json). Zolang dat er niet is, is van geen enkele route bekend ' +
      'of hij beproefd is; dit scherm toont daarom geen dekking en niet 0%. Herstellen: npm run dekking:vast.';
  else if (d.onmeetbaar && d.onmeetbaar.length)
    m = d.onmeetbaar.length + ' route(s) zijn niet te meten: ' + d.onmeetbaar.join(', ') +
      '. Die zijn met app.all() geregistreerd, en dan schrijft de server geen patroon weg -- er is dus niet ' +
      'vast te stellen of een toets ze ooit heeft aangeroepen. Herstellen: registreer ze met een eigen methode.';
  else if (d.ongedekt)
    m = d.ongedekt + ' route(s) zijn sinds de laatste meting bijgekomen of hebben nooit een toets gehad. ' +
      'Ze staan hieronder onder "alleen zonder toets". Herstellen: schrijf er een toets voor en leg de meting ' +
      'opnieuw vast (npm run dekking:vast). Er is geen norm waarmee deze eis te verlagen valt.';
  else if (d.verdwenenSindsMeting && d.verdwenenSindsMeting.length)
    m = 'Alle routes van nu zijn gedekt, maar het bewijsstuk noemt ' + d.verdwenenSindsMeting.length +
      ' route(s) die niet meer bestaan. Het is dus ouder dan de code; leg de meting opnieuw vast.';
  else
    m = 'Alle ' + getal(d.totaal) + ' routes van deze server zijn tijdens de laatste ' +
      'volledige testronde echt aangeroepen. Een route is hier een methode plus een patroon, dus GET en ' +
      'POST op hetzelfde pad tellen apart.';
  $('#melding').textContent = m;
}

const MAP = '<svg class="ds-veld__icoon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h7l2 2h9v11H3z"/></svg>';
function tekenDomeinen(d) {
  $('#domeinen').innerHTML = d.perDomein.map(x =>
    '<div class="ds-veld">' + MAP + '<span class="ds-veld__label">' + esc(x.domein) + '</span>' +
    '<span class="ds-veld__waarde">' + getal(x.gedekt) + '\u00a0/\u00a0' + getal(x.totaal) + '</span></div>').join('') ||
    '<p class="ds-meta">Geen domeinen.</p>';
  const kies = $('#domein');
  if (kies.options.length <= 1) {
    for (const x of d.perDomein) {
      const o = document.createElement('option');
      o.value = x.domein; o.textContent = x.domein;
      kies.appendChild(o);
    }
  }
}

function tekenLijst(l) {
  $('#lijst').innerHTML = l.resultaten.map(r =>
    '<li class="ds-lijst__rij" data-gedekt="' + (r.gedekt ? 'ja' : 'nee') + '">' +
    '<span class="ds-lijst__tijd">' + esc(r.methode) + '</span>' +
    '<span><span class="ds-lijst__titel">' + pad(r.pad) + '</span>' +
    /* BEWAAKT EN BEPROEFD ZIJN TWEE DINGEN, en die staan hier naast elkaar.
       Een route kan door een toets zijn aangeraakt en toch geen bewaker hebben,
       en omgekeerd. Geen bewakerslaag is geen leemte: ruim vijfhonderd routes
       controleren een token in de handler. */
    '<span class="ds-lijst__tekst">' + (r.bewakers === null ? 'bewaker onbekend'
      : r.bewakers.length ? esc(r.bewakers.join(' + ')) : 'in de handler') + '</span></span>' +
    '<span class="ds-lijst__tijd" data-sig="' + (r.gedekt ? 'gezond' : 'incident') + '">' +
    (r.gedekt ? '✓ beproefd' : '× geen toets') + '</span></li>').join('') ||
    leeg('Geen route past bij deze zoekopdracht.');
  $('#paginatel').textContent = l.totaal
    ? 'pagina ' + l.pagina + ' van ' + l.paginas + ' · ' + getal(l.totaal) + ' routes'
    : 'geen resultaten';
  $('#vorige').disabled = l.pagina <= 1;
  $('#volgende').disabled = l.pagina >= l.paginas;
}

async function ververs() {
  try {
    const d = await haal();
    if (!d) return;
    tekenStand(d); tekenDomeinen(d); tekenLijst(d.lijst);
  } catch (e) {
    $('#lijst').innerHTML = leeg(e.message);
    $('#melding').textContent = e.message;
  }
}

function zetTab(tab) {
  for (const b of document.querySelectorAll('[data-tab]')) {
    const aan = b.dataset.tab === tab;
    b.setAttribute('aria-selected', String(aan));
    $('#' + b.getAttribute('aria-controls')).hidden = !aan;
  }
}
for (const b of document.querySelectorAll('[data-tab]')) b.addEventListener('click', () => zetTab(b.dataset.tab));

const opnieuw = () => { pagina = 1; ververs(); };
$('#zoeken').addEventListener('click', opnieuw);
$('#zoek').addEventListener('keydown', e => { if (e.key === 'Enter') opnieuw(); });
$('#domein').addEventListener('change', opnieuw);
$('#gaten').addEventListener('change', opnieuw);
$('#vorige').addEventListener('click', () => { if (pagina > 1) { pagina--; ververs(); } });
$('#volgende').addEventListener('click', () => { pagina++; ververs(); });
ververs();
})();

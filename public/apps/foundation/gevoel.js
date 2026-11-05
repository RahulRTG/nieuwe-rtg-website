(function foundationPage() {
const $ = s => document.querySelector(s);
if (!window.Sessie || !Sessie.eisProfiel()) return;
Sessie.balk($('#balk'), { terug: 'index.html' });

function gezicht(mond, extra) {
  return '<svg viewBox="0 0 100 100" aria-hidden="true">' +
    '<circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="4"/>' +
    '<circle cx="36" cy="42" r="4.5" fill="currentColor"/><circle cx="64" cy="42" r="4.5" fill="currentColor"/>' +
    mond + (extra || '') + '</svg>';
}

const GEVOELENS = [
  { id: 'blij', naam: 'blij',
    svg: gezicht('<path d="M32 62q18 16 36 0" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>'),
    zin: 'Wat fijn dat je blij bent.',
    tips: ['Vertel iemand wat er zo leuk was.', 'Doe het nog een keer, samen.', 'Onthoud dit gevoel voor een dag die minder gaat.'] },
  { id: 'verdrietig', naam: 'verdrietig',
    svg: gezicht('<path d="M32 68q18-16 36 0" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
      '<path d="M36 50v10" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".7"/>'),
    zin: 'Verdrietig zijn mag. Het gaat weer over.',
    tips: ['Zoek iemand op die je lief vindt.', 'Vertel wat er gebeurd is, ook als het klein lijkt.', 'Een knuffel of een deken helpt vaak meer dan praten.'] },
  { id: 'boos', naam: 'boos',
    svg: gezicht('<path d="M34 66h32" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
      '<path d="M28 32l14 6M72 32l-14 6" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>'),
    zin: 'Boos zijn mag. Iets anders kapot maken niet.',
    tips: ['Stamp tien keer heel hard met je voeten.', 'Adem hieronder mee met de bol.', 'Zeg hardop waar je boos om bent.'] },
  { id: 'bang', naam: 'bang',
    svg: gezicht('<ellipse cx="50" cy="66" rx="9" ry="7" fill="none" stroke="currentColor" stroke-width="4"/>',
      '<path d="M26 34q8-6 16-2M74 34q-8-6-16-2" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'),
    zin: 'Bang zijn is niet raar. Je hoeft het niet alleen te doen.',
    tips: ['Pak de hand van iemand die groot is.', 'Zeg wat je bang maakt, hardop.', 'Kijk om je heen en noem vijf dingen die je ziet.'] },
  { id: 'moe', naam: 'moe',
    svg: gezicht('<path d="M40 66h20" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
      '<path d="M28 42h16M56 42h16" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>'),
    zin: 'Je bent moe. Dan mag je even niets.',
    tips: ['Ga ergens zacht zitten of liggen.', 'Drink wat water.', 'Vraag of het licht wat zachter mag.'] },
  { id: 'rustig', naam: 'rustig',
    svg: gezicht('<path d="M38 64q12 8 24 0" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>'),
    zin: 'Lekker rustig. Dat is een fijn gevoel.',
    tips: ['Blijf nog even zo zitten.', 'Kijk uit het raam en zoek iets moois.', 'Adem hieronder een paar keer mee met de bol.'] }
];

function teken() {
  const doos = $('#koppen');
  doos.innerHTML = '';
  for (const g of GEVOELENS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'kop ds-knop ds-foundation-gezicht';
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', g.naam);
    b.innerHTML = g.svg + '<b></b>';
    b.querySelector('b').textContent = g.naam;
    b.addEventListener('click', () => kies(g, b));
    doos.appendChild(b);
  }
}

function kies(g, knop) {
  $('#koppen').querySelectorAll('.kop').forEach(k => { k.classList.toggle('gekozen', k === knop); k.setAttribute('aria-pressed', String(k === knop)); });
  const doos = $('#antwoord');
  doos.innerHTML = '<div class="zin"></div><ul></ul>';
  doos.querySelector('.zin').textContent = g.zin;
  const ul = doos.querySelector('ul');
  for (const t of g.tips) {
    const li = document.createElement('li');
    li.textContent = t;
    ul.appendChild(li);
  }
  gekozen = g; keuzeVersie++;
  $('#bewaarRij').hidden = false;
  $('#bewaarKnop').textContent = 'Bewaar in mijn dagboekje';
  $('#bewaarKnop').disabled = false;
}

/* ---------- het dagboekje: opt-in, prive, een woord per dag ----------
   De app blijft bij zijn belofte: er wordt pas iets bewaard als het kind
   ZELF op de knop tikt, en alleen het kind kan het teruglezen. */
const begin = Sessie.huidig();
const actor = begin && [begin.code, begin.token, begin.profiel && begin.profiel.id];
function actueel() {
  const n = Sessie.huidig();
  return actor && actor.every(v => typeof v === 'string' && v.trim()) && n &&
    n.code === actor[0] && n.token === actor[1] && n.profiel && n.profiel.id === actor[2];
}
const rijGeldig = x => x && /^\d{4}-\d{2}-\d{2}$/.test(x.dag) && GEVOELENS.some(g => g.id === x.gevoel);
let gekozen = null, keuzeVersie = 0, dagboekVersie = 0;
const ZWAAR = ['verdrietig', 'bang', 'boos'];
async function api(actie, body) {
  if (!actueel()) throw new Error('Open je eigen profiel opnieuw.');
  const r = await fetch('/api/rtf/welzijn/' + actie, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({}, body, { code: actor[0], token: actor[1] }))
  });
  const d = await r.json().catch(() => null);
  if (!actueel()) throw new Error('Open je eigen profiel opnieuw.');
  if (!r.ok || !d || d.error || d.ok !== true) {
    const e = new Error(d && d.error || 'Er ging iets mis. Probeer opnieuw.');
    if (!r.ok && d) { e.hoe = d.hoe; e.zelf = d.zelf === true; } throw e;
  }
  const geldig = actie === 'dagboek' ? Array.isArray(d.stemmingen) && d.stemmingen.every(rijGeldig) &&
    typeof d.toestemming === 'boolean' && typeof d.zelfToestemming === 'boolean' &&
    (d.dagVandaag === null || rijGeldig(d.dagVandaag)) :
    actie === 'stemming' ? rijGeldig(d.dag) : d.toestemming === body.aan && (body.aan || d.gewist === true);
  if (!geldig) throw new Error('Het antwoord is onvolledig. Probeer opnieuw.');
  return d;
}

/* Toestemming apart en bij eerste gebruik: wie 16 of ouder is geeft hem hier
   zelf, met een eigen knop; voor een jonger kind zegt de server dat een ouder
   hem geeft. Daarna wordt het gekozen gevoel alsnog bewaard. */
async function bewaar() {
  if (!gekozen) return;
  const keuze = keuzeVersie;
  try {
    await api('stemming', { gevoel: gekozen.id });
    if (!actueel()) return;
    $('#toestemRij').hidden = true;
    laadDagboek(keuze); // een bron van waarheid: het dagboek zet de knoptekst
  } catch (e) {
    if (!actueel()) return;
    if (e.hoe !== 'toestemming') { $('#bewaarKnop').textContent = e.message; return; }
    $('#toestemRij').hidden = false;
    $('#toestemTekst').textContent = e.zelf
      ? 'Een gevoel bewaren is een gegeven over hoe het met je gaat. Dat doen we alleen als je dat apart goedvindt. Je kunt het later intrekken; dan wordt je dagboekje gewist. '
      : e.message;
    $('#toestemKnop').hidden = !e.zelf;
  }
}
$('#bewaarKnop').addEventListener('click', bewaar);
$('#toestemIntrek').addEventListener('click', async () => {
  if (!confirm('Je dagboekje wordt gewist en er wordt niets meer bewaard. Doorgaan?')) return;
  try { await api('toestemming', { aan: false }); if (actueel()) location.reload(); } catch (e) { if (actueel()) alert(e.message); }
});
$('#toestemKnop').addEventListener('click', async () => {
  const keuze = keuzeVersie;
  try { await api('toestemming', { aan: true }); if (actueel() && keuze === keuzeVersie) bewaar(); }
  catch (e) { if (!actueel()) return; $('#toestemTekst').textContent = e.message; }
});

async function laadDagboek(keuze = keuzeVersie) {
  const versie = ++dagboekVersie;
  let d;
  try { d = await api('dagboek'); } catch (e) { return; } // een oppas heeft hier geen dagboekje
  if (!actueel() || versie !== dagboekVersie) return;
  $('#toestemIntrek').hidden = !(d.toestemming && d.zelfToestemming);
  $('#dagboekBlok').hidden = !d.stemmingen.length;
  if (!d.stemmingen.length) return;
  const naam = {};
  GEVOELENS.forEach(g => { naam[g.id] = g; });
  $('#dagboekStrook').innerHTML = d.stemmingen.map(x => {
    const g = naam[x.gevoel];
    return '<span class="kop ds-foundation-gezicht ds-foundation-dagboekdag" title="' + x.dag + '">' +
      (g ? g.svg : '') + '<b class="s-ogvy17 ds-meta">' + x.dag.slice(8) + '-' + x.dag.slice(5, 7) + '</b></span>';
  }).join('');
  // hulp dichtbij: waren 3 van de laatste 5 bewaarde dagen zwaar, wijs dan warm de weg
  const laatste = d.stemmingen.slice(-5);
  $('#hulpRegel').hidden = laatste.filter(x => ZWAAR.includes(x.gevoel)).length < 3;
  if (d.dagVandaag && keuze === keuzeVersie) {
    $('#bewaarRij').hidden = false;
    $('#bewaarKnop').textContent = 'Vandaag bewaard: ' + d.dagVandaag.gevoel + ' (tik een gezichtje om te herzien)';
    $('#bewaarKnop').disabled = true;
  }
}
laadDagboek();

let ademLoop = null, ademUit = false;
$('#ademknop').addEventListener('click', () => {
  const bol = $('#bol');
  if (ademLoop) {
    clearInterval(ademLoop); ademLoop = null;
    bol.classList.remove('uit');
    bol.textContent = 'klaar?';
    $('#ademknop').textContent = 'Begin met ademen';
    return;
  }
  ademUit = false;
  const stap = () => {
    ademUit = !ademUit;
    bol.classList.toggle('uit', ademUit);
    bol.textContent = ademUit ? 'in' : 'uit';
  };
  stap();
  ademLoop = setInterval(stap, 4000);
  $('#ademknop').textContent = 'Stop maar';
});

teken();
Sessie.coach({ kind: 'gevoel', chat: $('#chat'), input: $('#vraag'), knop: $('#stuur') });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}());

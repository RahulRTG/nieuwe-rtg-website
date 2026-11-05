/* Beheert de voortgang en score van de Mediawijs-ervaring. */\nlet volgorde = [], index = 0, gedaan = 0, punten = 0, beantwoord = false;

function start() {
  volgorde = SITUATIES.map((s, i) => i).sort(() => Math.random() - 0.5);
  index = 0;
  toon();
}

function toon() {
  const s = SITUATIES[volgorde[index]];
  beantwoord = false;
  const doos = $('#situatie');
  doos.innerHTML = '<div class="waar ds-label"></div><p></p>';
  doos.querySelector('.waar').textContent = s.waar;
  doos.querySelector('p').textContent = s.tekst;
  const op = $('#opties');
  op.innerHTML = '';
  s.opties.map(o => o).sort(() => Math.random() - 0.5).forEach(o => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'optie ds-knop ds-foundation-keuze';
    b.textContent = o.t;
    b.addEventListener('click', () => kies(s, o, b));
    op.appendChild(b);
  });
  $('#uitleg').hidden = true;
  $('#regel').hidden = true;
  $('#verder').hidden = true;
  tekenStand();
}

function kies(s, o, knop) {
  if (beantwoord) return;
  beantwoord = true;
  gedaan++; punten += o.s;
  $('#opties').querySelectorAll('.optie').forEach(b => { b.disabled = true; });
  knop.classList.add(o.s === 2 ? 'goed' : (o.s === 1 ? 'matig' : 'mis'));
  const kop = o.s === 2 ? 'Verstandige keuze. ' : (o.s === 1 ? 'Kan beter. ' : 'Dit levert problemen op. ');
  const u = $('#uitleg');
  u.innerHTML = '<b></b><span></span>';
  u.querySelector('b').textContent = kop;
  u.querySelector('span').textContent = o.u;
  u.hidden = false;
  const r = $('#regel');
  r.innerHTML = '<b>Onthoud: </b><span></span>';
  r.querySelector('span').textContent = s.regel;
  r.hidden = false;
  $('#verder').hidden = false;
  tekenStand();
}

function tekenStand() {
  $('#stand').textContent = gedaan ? gedaan + ' van de ' + SITUATIES.length + ' gedaan, ' + punten + ' van de ' + (gedaan * 2) + ' punten' : '';
}

$('#verder').addEventListener('click', () => {
  index++;
  if (index >= volgorde.length) { volgorde.sort(() => Math.random() - 0.5); index = 0; }
  toon();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

start();
Sessie.coach({ kind: 'mediawijs', chat: $('#chat'), input: $('#vraag'), knop: $('#stuur') });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}());

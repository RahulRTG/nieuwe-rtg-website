/* Een gepubliceerde site als gewone HTML, voor een bezoeker die van buiten
   komt.

   Binnen het RTG-web tekent de browser-app de blokken zelf uit JSON. Op een
   eigen domein kan dat niet: daar komt iemand langs zonder leden-app en zonder
   inlog. Dus maken we hier echte HTML.

   Drie dingen liggen vast:

   - HET IS DE GEPUBLICEERDE STAND, nooit het concept. Buiten hoort te staan
     wat de maker naar buiten bracht.
   - HET FORMULIER GAAT ER NIET OP. Een formulier landt in dit huis als klus of
     als gesprek, en allebei hangen aan de codenaam van een INGELOGD lid. Een
     voorbijganger heeft die niet. Een invulveld tonen dat daarna nergens heen
     kan, is de knop-die-niets-doet waar dit huis niet aan begint; er staat een
     regel voor in de plaats die naar de leden-app wijst.
   - ALLES WORDT GEESCAPED. Dit is de enige plek in het web-platform waar
     tekst van een maker als HTML de deur uit gaat; overal elders zet de app
     hem met textContent neer. */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ESC[c]);
// alleen eigen beeld; een verwijzing naar buiten hoort hier niet te staan
const veiligBeeld = u => /^\/(media|campagne)\/[A-Za-z0-9._\/-]+$/.test(String(u || ''));

function blokHtml(b) {
  const t = b.type;
  if (t === 'hero') return '<section class="b-hero"><h1>' + esc(b.kop) + '</h1><p class="sub">' + esc(b.sub) + '</p>' +
    (b.knop ? '<span class="b-knop">' + esc(b.knop) + '</span>' : '') + '</section>';
  if (t === 'kop') return '<section class="b-kop"><h2>' + esc(b.tekst) + '</h2></section>';
  if (t === 'tekst') return '<section class="b-tekst"><p>' + esc(b.tekst) + '</p></section>';
  if (t === 'knop') return '<section class="b-knoprij"><span class="b-knop">' + esc(b.tekst) + '</span></section>';
  if (t === 'beeld') return veiligBeeld(b.src)
    ? '<section class="b-beeld"><img src="' + esc(b.src) + '" alt="' + esc(b.bijschrift) + '">' +
      (b.bijschrift ? '<div class="bij">' + esc(b.bijschrift) + '</div>' : '') + '</section>' : '';
  if (t === 'kolommen') return '<section class="b-kol"><div><h3>' + esc(b.lk) + '</h3><p>' + esc(b.lt) + '</p></div>' +
    '<div><h3>' + esc(b.rk) + '</h3><p>' + esc(b.rt) + '</p></div></section>';
  if (t === 'galerij') return '<section class="b-gal">' +
    (b.beelden || []).filter(veiligBeeld).map(s => '<img src="' + esc(s) + '" alt="">').join('') + '</section>';
  if (t === 'citaat') return '<section class="b-citaat"><div class="q">' + esc(b.tekst) + '</div><div class="bron">' + esc(b.bron) + '</div></section>';
  if (t === 'ruimte') return '<section style="height:' + (Number(b.hoogte) || 40) + 'px"></section>';
  if (t === 'voettekst') return '<section class="b-voet">' + esc(b.tekst) + '</section>';
  if (t === 'faq') return '<section class="b-tekst"><h2>' + esc(b.kop) + '</h2>' +
    (b.vragen || []).map(q => '<p><b>' + esc(q.v) + '</b><br>' + esc(q.a) + '</p>').join('') + '</section>';
  if (t === 'prijzen') return '<section class="b-tekst"><h2>' + esc(b.kop) + '</h2>' +
    (b.regels || []).map(r => '<p><b>' + esc(r.naam) + '</b> -- ' + esc(r.prijs) +
      (r.wat ? '<br>' + esc(r.wat) : '') + '</p>').join('') + '</section>';
  /* formulier: met opzet geen invulveld (zie de kop van dit bestand) */
  if (t === 'formulier') return '<section class="b-tekst"><h2>' + esc(b.kop) + '</h2>' +
    '<p>Een bericht sturen kan via de RTG leden-app. Daar komt het binnen op uw codenaam, bij de mensen die het moeten lezen.</p></section>';
  return '';
}

function pagina(site, pad) {
  const paginas = site.paginas || [];
  const p = pad ? paginas.find(x => x.slug === pad) : null;
  if (pad && !p) return null;
  return p ? p.blokken : (site.blokken || []);
}

function render(site, pad) {
  const blokken = pagina(site, pad);
  if (!blokken) return null;
  const k = site.kleuren || {};
  const donker = site.thema !== 'licht';
  const nav = (site.paginas || []).length
    ? '<nav class="nav"><a href="/"' + (pad ? '' : ' class="aan"') + '>Home</a>' +
      (site.paginas || []).map(x => '<a href="/' + esc(x.slug) + '"' + (pad === x.slug ? ' class="aan"' : '') + '>' + esc(x.naam) + '</a>').join('') + '</nav>'
    : '';
  return '<!doctype html><html lang="nl"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + esc(site.titel) + '</title>' +
    '<link rel="icon" href="/icon.svg"><link href="/fonts/fonts.css" rel="stylesheet">' +
    '<link href="/shared/webblok.css" rel="stylesheet">' +
    '<style>:root{--acc:' + esc(site.accent || '#7F1634') + ';' +
    '--dbg:' + esc(k.bg || (donker ? '#0C0C0B' : '#FFFFFF')) + ';' +
    '--dtxt:' + esc(k.txt || (donker ? '#FFFFFF' : '#0C0C0B')) + ';' +
    '--dcard:' + esc(k.card || (donker ? '#141413' : '#F5F4F1')) + ';}' +
    'body{margin:0;background:var(--dbg);color:var(--dtxt);font-family:Inter,system-ui,sans-serif;}' +
    '.nav{display:flex;gap:1rem;padding:1rem;justify-content:center;border-bottom:1px solid rgba(128,128,128,.25);}' +
    '.nav a{color:inherit;text-decoration:none;opacity:.7;font-size:.9rem;}.nav a.aan{opacity:1;color:var(--acc);}' +
    '.voetnoot{padding:2rem 1rem;text-align:center;opacity:.55;font-size:.75rem;}</style>' +
    '</head><body><div class="doek" data-thema="' + (donker ? 'donker' : 'licht') + '">' +
    nav + blokken.map(blokHtml).join('') +
    '<div class="voetnoot">Gemaakt met RTG · ook te vinden op ' + esc(site.adres) + '.rtg</div>' +
    '</div></body></html>';
}

module.exports = { render, esc };

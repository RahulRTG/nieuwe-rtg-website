/* Eigen toegankelijkheids-keuring, i.p.v. axe-core. Draait in de browser (via
   Playwright, in scripts/a11y.js) op de vlaggenschip-pagina's.

   Bewust een NAUWE deelverzameling, en bewust conservatief: we falen alleen op
   ONDUBBELZINNIGE structurele fouten -- een afbeelding zonder alt, een veld
   zonder enig label, een knop/link zonder toegankelijke naam, geen lang op
   <html>, een lege <title> -- precies de dingen die axe ook als serious/critical
   markeert. Omdat we alleen aanslaan als er GEEN enkele naamgevings-/label-manier
   is, blijven de (al schone) pagina's stil: we onder-melden liever dan vals
   alarm. Kleurcontrast melden we ADVISEREND (niet-fataal): de exacte contrast-
   heuristiek van axe (effectieve achtergrond door lagen/gradients heen) is het ene
   stuk dat we niet volledig namaken, dus dat mag de bouw niet rood maken op een
   meetverschil.

   De browsercode wordt als BRON-string geïnjecteerd; de pure helpers zijn apart
   exporteerbaar zodat test/a11ykeuring.test.js ze in Node kan toetsen. */
'use strict';

/* ---------- pure helpers (ook in Node testbaar) ---------- */
function kleur(s) {
  if (!s) return null;
  const m = String(s).match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const d = m[1].split(',').map(x => parseFloat(x.trim()));
  if (d.length < 3 || d.some((n, i) => i < 3 && isNaN(n))) return null;
  return [d[0], d[1], d[2], d.length >= 4 ? d[3] : 1];
}
function luminantie(rgb) {
  const a = rgb.slice(0, 3).map(v => {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function ratio(fg, bg) {
  const l1 = luminantie(fg), l2 = luminantie(bg);
  const licht = Math.max(l1, l2), donker = Math.min(l1, l2);
  return (licht + 0.05) / (donker + 0.05);
}
function grootTekst(px, gewicht) {
  return px >= 24 || (px >= 18.66 && Number(gewicht) >= 700);
}
// Toegankelijke naam (conservatief): niet-lege string als ER EEN naam is.
function naam(el) {
  if (!el || !el.getAttribute) return '';
  const al = (el.getAttribute('aria-label') || '').trim(); if (al) return al;
  const lb = el.getAttribute('aria-labelledby');
  if (lb && typeof document !== 'undefined') {
    let t = '';
    lb.split(/\s+/).forEach(id => { const r = document.getElementById(id); if (r) t += ' ' + (r.textContent || ''); });
    if (t.trim()) return t.trim();
  }
  const txt = (el.textContent || '').trim(); if (txt) return txt;
  const title = (el.getAttribute('title') || '').trim(); if (title) return title;
  if (el.querySelector) {
    const img = el.querySelector('img[alt]'); if (img && (img.getAttribute('alt') || '').trim()) return img.getAttribute('alt').trim();
    if (el.querySelector('svg [aria-label], svg title, [aria-label]')) return 'grafisch';
  }
  if (el.value != null && String(el.value).trim()) return String(el.value).trim();
  return '';
}
function mistAlt(img) {
  const rol = (img.getAttribute('role') || '');
  if (rol === 'presentation' || rol === 'none') return false;
  if (img.getAttribute('aria-hidden') === 'true') return false;
  return !img.hasAttribute('alt');
}
function mistNaam(el) {
  if (el.getAttribute('aria-hidden') === 'true') return false;
  return !naam(el);
}
function mistLabel(veld) {
  const tag = veld.tagName;
  const type = (veld.getAttribute('type') || '').toLowerCase();
  if (tag === 'INPUT' && ['hidden', 'submit', 'button', 'reset', 'image'].indexOf(type) >= 0) return false;
  if (veld.getAttribute('aria-hidden') === 'true') return false;
  if ((veld.getAttribute('aria-label') || '').trim()) return false;
  if (veld.getAttribute('aria-labelledby')) return false;
  if ((veld.getAttribute('title') || '').trim()) return false;
  const id = veld.getAttribute('id');
  if (id && typeof document !== 'undefined') {
    const esc = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(id) : id.replace(/"/g, '\\"');
    if (document.querySelector('label[for="' + esc + '"]')) return false;
  }
  if (veld.closest && veld.closest('label')) return false;
  return true;
}

/* ---------- browser-only helpers ---------- */
function zichtbaar(el) {
  const s = getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
  if (parseFloat(s.opacity) === 0) return false;
  if (!el.getClientRects().length) return false;
  let p = el;
  while (p) { if (p.getAttribute && p.getAttribute('aria-hidden') === 'true') return false; p = p.parentElement; }
  return true;
}
function achtergrond(el) {
  let p = el;
  while (p && p.nodeType === 1) {
    const s = getComputedStyle(p);
    if (s.backgroundImage && s.backgroundImage !== 'none') return null; // gradient/afbeelding: niet te berekenen -> overslaan
    const c = kleur(s.backgroundColor);
    if (c && c[3] === 1) return c;
    p = p.parentElement;
  }
  return null;
}
function keurInPagina() {
  const structureel = {};
  const contrast = {};
  const tel = (bak, id, help) => { bak[id] = bak[id] || { id: id, help: help, aantal: 0 }; bak[id].aantal++; };

  document.querySelectorAll('img').forEach(img => { if (zichtbaar(img) && mistAlt(img)) tel(structureel, 'afbeelding-alt', 'Afbeelding zonder alt-tekst'); });
  document.querySelectorAll('button, [role="button"]').forEach(el => { if (zichtbaar(el) && mistNaam(el)) tel(structureel, 'knop-naam', 'Knop zonder toegankelijke naam'); });
  document.querySelectorAll('a[href]').forEach(el => { if (zichtbaar(el) && mistNaam(el)) tel(structureel, 'link-naam', 'Link zonder toegankelijke naam'); });
  document.querySelectorAll('input, select, textarea').forEach(el => { if (zichtbaar(el) && mistLabel(el)) tel(structureel, 'veld-label', 'Formulierveld zonder label'); });
  const html = document.documentElement;
  if (!html.getAttribute('lang')) tel(structureel, 'html-taal', '<html> zonder lang-attribuut');
  if (!(document.title || '').trim()) tel(structureel, 'titel', 'Document zonder <title>');

  // contrast (adviserend): alleen elementen met eigen zichtbare tekst en een oplosbare, solide achtergrond
  document.querySelectorAll('body *').forEach(el => {
    const eigenTekst = Array.prototype.some.call(el.childNodes, n => n.nodeType === 3 && n.textContent.trim());
    if (!eigenTekst || !zichtbaar(el)) return;
    const s = getComputedStyle(el);
    if (parseFloat(s.opacity) < 1) return;                 // half-transparante intro-tekst: overslaan
    const fg = kleur(s.color); if (!fg || fg[3] < 1) return;
    const bg = achtergrond(el); if (!bg) return;
    const drempel = grootTekst(parseFloat(s.fontSize), s.fontWeight) ? 3 : 4.5;
    if (ratio(fg, bg) < drempel - 0.05) tel(contrast, 'contrast', 'Te laag kleurcontrast (' + Math.round(ratio(fg, bg) * 100) / 100 + ':1)');
  });

  return { overtredingen: Object.values(structureel), contrast: Object.values(contrast) };
}

const BRON = [kleur, luminantie, ratio, grootTekst, naam, mistAlt, mistNaam, mistLabel, zichtbaar, achtergrond, keurInPagina]
  .map(f => f.toString()).join('\n\n') + '\nwindow.__a11yKeur = keurInPagina;\n';

module.exports = { BRON, kleur, luminantie, ratio, grootTekst, naam, mistAlt, mistNaam, mistLabel };

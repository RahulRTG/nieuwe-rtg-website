/* Het CSP- en noncebeleid voor HTML-pagina's.

   De voordeur leest en verstuurt de pagina; deze module bepaalt uitsluitend
   wat die pagina daarna mag uitvoeren. Het gewone scherm mag alleen met RTG
   zelf verbinden. Een Magnaat-trainingsscherm krijgt bovendien geen netwerk
   en geen formulieren naar buiten, en zijn sandbox draait vóór de eigen code.

   style-src-attr blijft tijdelijk 'unsafe-inline': bestaande pagina's dragen
   nog stijl-attributen en CSP kent daarvoor geen nonce. NORM.json ratelt dat
   aantal alleen omlaag. Stijlblokken zelf zijn wél per antwoord gestempeld. */
'use strict';

const CSP = (nonce, magnaat = false) =>
  "default-src 'self'; script-src 'self' 'nonce-" + nonce + "'; " +
  "style-src 'self' 'nonce-" + nonce + "'; style-src-attr 'unsafe-inline'; " +
  "font-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; " +
  "connect-src " + (magnaat ? "'none'" : "'self'") + "; frame-ancestors 'self'; base-uri 'self'; " +
  "form-action " + (magnaat ? "'none'" : "'self'") + "; object-src 'none'";

function magnaatHtml(html, actief) {
  if (!actief) return html;
  const tag = '<script src="/apps/magnaat-sandbox.js"></script>';
  /* Dit is server-eigen, statische HTML: alleen onze exacte bouwtag wordt
     verplaatst. Maak de oude plek even lang onschadelijk in plaats van tekst
     weg te knippen. Wegknippen kan twee losse stukken zoals `<scr` en `ipt>`
     per ongeluk samenvoegen tot een nieuw uitvoerbaar element. */
  const masker = ' '.repeat(tag.length);
  let plek = html.indexOf(tag);
  while (plek !== -1) {
    html = html.slice(0, plek) + masker + html.slice(plek + tag.length);
    plek = html.indexOf(tag, plek + masker.length);
  }
  return /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, m => m + tag)
    : tag + html;
}

/* Scripts maken op enkele plekken zelf een <style>. De eerste inline stap in
   iedere pagina geeft zo'n element dezelfde nonce; wie dit wil misbruiken moet
   al script met een geldige nonce kunnen draaien. Geïnjecteerde HTML loopt
   niet via createElement en krijgt de stempel dus niet. */
const STIJLSTEMPEL = '(function(d){var s=d.currentScript;var n=s&&s.nonce;if(!n)return;' +
  'var maak=d.createElement.bind(d);d.createElement=function(t){var e=maak.apply(null,arguments);' +
  "if(String(t).toLowerCase()==='style'){try{e.setAttribute('nonce',n);e.nonce=n;}catch(x){}}" +
  'return e;};})(document);';

module.exports = { CSP, magnaatHtml, STIJLSTEMPEL };

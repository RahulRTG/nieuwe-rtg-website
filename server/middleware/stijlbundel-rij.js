/* ============================================================================
   DE RIJ STIJLBLADEN VINDEN, EN HEM VERVANGEN DOOR EEN VERWIJZING.

   De helft van ./stijlbundel.js die over de PAGINA gaat. Die andere helft
   levert de bundel uit; deze beslist wat er uberhaupt samen mag -- en dat is de
   helft met de regels erin, dus die hoort op zichzelf te staan.

   test/stijlbundel.test.js loopt die regels na, stuk voor stuk.
   ========================================================================== */
'use strict';

const PAD = '/stijlbundel.css';
/* Alleen gewone paden: geen spaties, geen dubbele punten, geen ..

   En let op die (?!\/) op de tweede plek. Zonder die kwam //cdn.example.com/a.css
   erdoorheen: dat is voor een browser een VOLLEDIG ADRES bij een vreemde server,
   maar het begint met een schuine streep en bestaat verder uit toegestane tekens.
   Die zou hier in de bundel belanden, en dan zoekt de laag ernaast naar een
   bestand dat niet bestaat -- waarna de hele bundel een 404 wordt en de pagina
   AL haar opmaak kwijt is. Gevonden door test/stijlbundel.test.js, niet door te
   kijken. */
const GOED_PAD = /^\/(?!\/)[A-Za-z0-9_\-/.]+\.css$/;

const codeer = (paden) => Buffer.from(paden.join('\n'), 'utf8').toString('base64url');
const decodeer = (s) => {
  try { return Buffer.from(String(s || ''), 'base64url').toString('utf8').split('\n').filter(Boolean); }
  catch (e) { return []; }
};

/* Een rij opeenvolgende <link rel="stylesheet"> wordt EEN verwijzing.

   Bewust streng in wat er meedoet. Alleen een link met precies rel=stylesheet
   en een href die met / begint en op .css eindigt. Alles met een media-, type-,
   of ander attribuut blijft staan zoals het staat -- daar hangt gedrag aan, en
   dat kun je niet samenvoegen zonder het te veranderen. Een rij van een is geen
   winst en wordt overgeslagen. */
const LINK = /<link\b[^>]*>/gi;
/* WAT ER TUSSEN TWEE STIJLBLADEN MAG STAAN zonder dat de rij breekt: witruimte,
   een commentaar, en een uitgesteld script. Meer niet, en daar zit de hele
   redenering in.

   Een <style>-blok mag er NIET tussen staan. Voeg je twee bladen samen over een
   inline blok heen, dan verschuift de cascade: wat eerst won verliest opeens. Dat
   is geen optimalisatie meer maar een andere pagina. /apps/app.html heeft precies
   zo'n geval -- vensters.css staat na een <style> -- en die blijft dus los.

   Een gewoon (niet-uitgesteld) script mag er ook niet tussen: dat draait tijdens
   het ontleden, en zou na het samenvoegen stijl zien die er op dat moment nog
   niet hoorde te zijn. Een uitgesteld script draait pas na het ontleden en kan
   dat verschil niet merken. */
const isWit = (teken) => !!teken && /\s/u.test(teken);
const tagGrens = (teken) => !teken || teken === '>' || teken === '/' || isWit(teken);

function tagEinde(tekst, vanaf) {
  let quote = '';
  for (let i = vanaf; i < tekst.length; i++) {
    const c = tekst[i];
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '>') return i;
  }
  return -1;
}

/* Zelfde begrenzing als de scriptbundel: lineair scannen in plaats van een
   geneste regexp op aanvaller-gestuurde HTML. Alleen witruimte, commentaar en
   een leeg defer/async-script mogen de stijlrij verbinden. */
function tussenOk(tekst) {
  const klein = tekst.toLowerCase();
  let i = 0;
  while (i < tekst.length) {
    if (isWit(tekst[i])) { i++; continue; }
    if (klein.startsWith('<!--', i)) {
      const eindCommentaar = klein.indexOf('-->', i + 4);
      if (eindCommentaar < 0) return false;
      i = eindCommentaar + 3;
      continue;
    }
    if (!klein.startsWith('<script', i) || !tagGrens(klein[i + 7])) return false;
    const openEind = tagEinde(tekst, i + 7);
    if (openEind < 0) return false;
    const openTag = tekst.slice(i, openEind + 1);
    if (!/\b(?:defer|async)\b/i.test(openTag)) return false;
    const sluit = klein.indexOf('</script>', openEind + 1);
    if (sluit < 0) return false;
    for (let p = openEind + 1; p < sluit; p++) if (!isWit(tekst[p])) return false;
    i = sluit + 9;
  }
  return true;
}
function herschrijfHtml(html) {
  /* Eerst alle bruikbare stijlbladen opzoeken en in rijen groeperen. Pas
     daarna herschrijven -- in een keer, van voor naar achter, zodat de
     posities in de brontekst blijven kloppen. */
  const links = [];
  LINK.lastIndex = 0;
  let m;
  while ((m = LINK.exec(html))) {
    const tag = m[0];
    const rel = /\brel=["']?stylesheet["']?/i.test(tag);
    const href = /\bhref=["']([^"']+)["']/i.exec(tag);
    // wat er nog meer aan attributen staat: alleen href en rel mogen mee. Een
    // media=, een onload=, een fetchpriority= hangt gedrag aan die link, en dat
    // kun je niet samenvoegen zonder het te veranderen.
    const kaal = tag.replace(/<link\b/i, '').replace(/\/?>$/, '')
      .replace(/\bhref=["'][^"']*["']/i, '').replace(/\brel=["']?stylesheet["']?/i, '').trim();
    const bruikbaar = rel && !!href && kaal === '' && GOED_PAD.test(href[1]) && href[1].indexOf('..') === -1;
    links.push({ start: m.index, eind: m.index + tag.length, pad: bruikbaar ? href[1] : null, bruikbaar });
  }

  const rijen = [];
  let huidig = null;
  for (const l of links) {
    if (!l.bruikbaar) { huidig = null; continue; }
    if (huidig && tussenOk(html.slice(huidig[huidig.length - 1].eind, l.start))) huidig.push(l);
    else { huidig = [l]; rijen.push(huidig); }
  }

  const bruikbareRijen = rijen.filter(r => r.length >= 2);
  if (!bruikbareRijen.length) return html;

  const uit = [];
  let laatst = 0;
  for (const rij of bruikbareRijen) {
    // de bundel komt op de plek van de EERSTE link te staan; de cascadevolgorde
    // binnen de bundel is de volgorde waarin ze in de pagina stonden
    uit.push(html.slice(laatst, rij[0].start));
    uit.push('<link href="' + PAD + '?f=' + codeer(rij.map(l => l.pad)) + '" rel="stylesheet">');
    /* Wat er TUSSEN de links stond (een uitgesteld script, een commentaar)
       blijft gewoon staan -- alleen de link-tags zelf verdwijnen. Dit is de
       reden dat er hier per stuk wordt geplakt en niet in een klap geknipt:
       een eerdere versie gooide het uitgestelde script tussen twee bladen weg. */
    for (let i = 1; i < rij.length; i++) uit.push(html.slice(rij[i - 1].eind, rij[i].start));
    laatst = rij[rij.length - 1].eind;
  }
  uit.push(html.slice(laatst));
  return uit.join('');
}


module.exports = { herschrijfHtml, codeer, decodeer, GOED_PAD, PAD, tussenOk };

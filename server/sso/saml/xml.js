/* ============================================================================
   Een STRIKTE XML-lezer, en het woord strikt is hier de hele bedoeling.

   Een gewone XML-parser is TOEGEEFLIJK -- hij repareert wat hij kan, want zo
   hoort een parser zich te gedragen. Bij een handtekeningcontrole is dat
   precies de fout: elk verschil tussen "wat de controleur las" en "wat de lezer
   erna leest" is een gat waar XML Signature Wrapping doorheen loopt. (Dat er
   geen bibliotheek staat, komt daarnaast doordat deze repo op nul
   runtime-pakketten draait; zie README.)

   Deze lezer weigert daarom alles wat hij niet nodig heeft:

   - GEEN DOCTYPE en geen entiteitsdeclaraties. Dat sluit XXE en de
     billion-laughs-bom af bij de deur, en niet met een limiet erachter.
   - GEEN verwerkingsinstructies binnen de boom.
   - ALLEEN de vijf voorgedefinieerde entiteiten en numerieke verwijzingen. Een
     onbekende entiteit is een fout en geen lege string.
   - Commentaar wordt WEGGEGOOID, want wij canonicaliseren met de vorm zonder
     commentaar. Een parser die het bewaart en een canonicalisatie die het
     weglaat, geven samen twee verschillende documenten.
   - Elke naamruimte wordt OPGELOST tot een URI. Wie op de PREFIX vergelijkt,
     vergelijkt op iets wat de afzender vrij mag kiezen.

   Elk element draagt een verwijzing naar zijn OUDER. Geen luxe: c14n moet weten
   welke declaraties van bovenaf gelden, en de handtekeningcontrole moet kunnen
   vaststellen dat het ondertekende element werkelijk de ouder van de
   handtekening is -- en niet een naamgenoot elders in het document.
   ========================================================================== */
'use strict';

const XML_NS = 'http://www.w3.org/XML/1998/namespace';

const VAST = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function ontsnap(s, waar) {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&([^;<&]{1,12});|&/g, (m, e) => {
    if (e === undefined) throw new Error('losse & in ' + waar + '; dat is geen geldige XML');
    if (e[0] === '#') {
      const hex = e[1] === 'x' || e[1] === 'X';
      const cp = parseInt(hex ? e.slice(2) : e.slice(1), hex ? 16 : 10);
      if (!Number.isFinite(cp) || cp < 1 || cp > 0x10ffff) throw new Error('onbruikbare tekenverwijzing &' + e + ';');
      return String.fromCodePoint(cp);
    }
    if (!Object.prototype.hasOwnProperty.call(VAST, e))
      throw new Error('onbekende entiteit &' + e + ';. Alleen de vijf voorgedefinieerde zijn toegestaan.');
    return VAST[e];
  });
}

/* Attribuutwaarde-normalisatie zoals de XML-spec hem voorschrijft: tab en
   regelovergang worden een spatie. Dit gebeurt VOOR het ontsnappen, want &#xA;
   hoort juist WEL een echte regelovergang te blijven -- en de canonicalisatie
   schrijft die dan weer als &#xA; terug. Omgekeerd klopt er niets van. */
function normaliseerWaarde(rauw, waar) {
  return ontsnap(rauw.replace(/[\t\n\r]/g, ' '), waar);
}

function isNaamTeken(c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') ||
    c === '_' || c === '-' || c === '.' || c === ':' || c.charCodeAt(0) > 127;
}

function lees(tekst) {
  const s = String(tekst == null ? '' : tekst).replace(/\r\n?/g, '\n');
  if (/<!DOCTYPE/i.test(s))
    throw new Error('dit document draagt een DOCTYPE. Dat wordt hier nooit gelezen: het is de weg naar XXE en naar entiteitsbommen.');

  let i = 0;
  const n = s.length;
  let wortel = null;
  const stapel = [];

  const fout = (m) => { throw new Error(m + ' (op teken ' + i + ')'); };

  while (i < n) {
    if (s[i] !== '<') {
      const eind = s.indexOf('<', i);
      const stuk = s.slice(i, eind < 0 ? n : eind);
      if (stapel.length) stapel[stapel.length - 1].kinderen.push({ soort: 'tekst', tekst: ontsnap(stuk, 'tekst') });
      else if (stuk.trim()) fout('tekst buiten het wortelelement');
      i = eind < 0 ? n : eind;
      continue;
    }
    if (s.startsWith('<!--', i)) {
      const eind = s.indexOf('-->', i + 4);
      if (eind < 0) fout('commentaar zonder einde');
      i = eind + 3;                            // weggegooid, met opzet (zie de kop)
      continue;
    }
    if (s.startsWith('<![CDATA[', i)) {
      const eind = s.indexOf(']]>', i + 9);
      if (eind < 0) fout('CDATA zonder einde');
      if (!stapel.length) fout('CDATA buiten het wortelelement');
      stapel[stapel.length - 1].kinderen.push({ soort: 'tekst', tekst: s.slice(i + 9, eind) });
      i = eind + 3;
      continue;
    }
    if (s.startsWith('<?', i)) {
      const eind = s.indexOf('?>', i + 2);
      if (eind < 0) fout('verwerkingsinstructie zonder einde');
      if (!s.startsWith('<?xml', i) || i !== 0)
        fout('een verwerkingsinstructie hoort hier niet; alleen een XML-declaratie vooraan');
      i = eind + 2;
      continue;
    }
    if (s.startsWith('</', i)) {
      const eind = s.indexOf('>', i);
      if (eind < 0) fout('sluittag zonder >');
      const naam = s.slice(i + 2, eind).trim();
      const el = stapel.pop();
      if (!el) fout('sluittag ' + naam + ' zonder open element');
      if (el.volleNaam !== naam) fout('</' + naam + '> sluit <' + el.volleNaam + '> niet');
      i = eind + 1;
      continue;
    }

    /* een openingstag */
    i++;
    const start = i;
    while (i < n && isNaamTeken(s[i])) i++;
    const volleNaam = s.slice(start, i);
    if (!volleNaam) fout('element zonder naam');
    const attrs = [];
    const nsdecl = Object.create(null);
    let leeg = false;
    for (;;) {
      while (i < n && /\s/.test(s[i])) i++;
      if (i >= n) fout('tag zonder >');
      if (s[i] === '>') { i++; break; }
      if (s.startsWith('/>', i)) { leeg = true; i += 2; break; }
      const an = i;
      while (i < n && isNaamTeken(s[i])) i++;
      const attrNaam = s.slice(an, i);
      if (!attrNaam) fout('onleesbaar attribuut');
      while (i < n && /\s/.test(s[i])) i++;
      if (s[i] !== '=') fout('attribuut ' + attrNaam + ' zonder waarde');
      i++;
      while (i < n && /\s/.test(s[i])) i++;
      const q = s[i];
      if (q !== '"' && q !== "'") fout('waarde van ' + attrNaam + ' staat niet tussen aanhalingstekens');
      const av = ++i;
      while (i < n && s[i] !== q) i++;
      if (i >= n) fout('waarde van ' + attrNaam + ' wordt niet afgesloten');
      const waarde = normaliseerWaarde(s.slice(av, i), attrNaam);
      i++;
      if (attrs.some(a => a.volleNaam === attrNaam)) fout('attribuut ' + attrNaam + ' staat er twee keer');
      if (attrNaam === 'xmlns') nsdecl[''] = waarde;
      else if (attrNaam.startsWith('xmlns:')) nsdecl[attrNaam.slice(6)] = waarde;
      else attrs.push({ volleNaam: attrNaam, waarde });
    }

    const ouder = stapel[stapel.length - 1] || null;
    const dp = volleNaam.indexOf(':');
    const el = {
      soort: 'el', volleNaam, prefix: dp < 0 ? '' : volleNaam.slice(0, dp),
      naam: dp < 0 ? volleNaam : volleNaam.slice(dp + 1),
      nsdecl, attrs, kinderen: [], ouder
    };
    el.ns = zoekNs(el, el.prefix);
    for (const a of el.attrs) {
      const ap = a.volleNaam.indexOf(':');
      a.prefix = ap < 0 ? '' : a.volleNaam.slice(0, ap);
      a.naam = ap < 0 ? a.volleNaam : a.volleNaam.slice(ap + 1);
      /* Een attribuut ZONDER prefix zit in GEEN naamruimte -- ook niet in de
         standaardnaamruimte van zijn element. Die regel gaat vaak verkeerd, en
         hij bepaalt hier de sorteervolgorde. */
      a.ns = a.prefix === '' ? '' : (a.prefix === 'xml' ? XML_NS : zoekNs(el, a.prefix));
      if (a.prefix && a.ns === null) fout('attribuut ' + a.volleNaam + ' gebruikt een onbekende naamruimte');
    }
    if (el.prefix && el.ns === null) fout('element ' + volleNaam + ' gebruikt een onbekende naamruimte');

    if (ouder) ouder.kinderen.push(el);
    else if (wortel) fout('een tweede wortelelement');
    else wortel = el;
    if (!leeg) stapel.push(el);
  }
  if (stapel.length) throw new Error('element <' + stapel[stapel.length - 1].volleNaam + '> wordt nooit gesloten');
  if (!wortel) throw new Error('leeg document');
  return wortel;
}

/* De naamruimte van een prefix: eigen declaraties eerst, dan omhoog. */
function zoekNs(el, prefix) {
  if (prefix === 'xml') return XML_NS;
  for (let k = el; k; k = k.ouder) {
    const v = k.nsdecl[prefix];
    if (v !== undefined) return v === '' ? null : v;
  }
  return prefix === '' ? null : null;
}

/* Zoeken gaat op (naamruimte, naam) en NOOIT op prefix. */
function kinderen(el, ns, naam) {
  return (el.kinderen || []).filter(k => k.soort === 'el' && k.ns === ns && k.naam === naam);
}
function kind(el, ns, naam) { return kinderen(el, ns, naam)[0] || null; }
function attr(el, naam) {
  const a = (el.attrs || []).find(x => x.prefix === '' && x.naam === naam);
  return a ? a.waarde : null;
}
function tekstVan(el) {
  let uit = '';
  for (const k of el.kinderen || []) {
    if (k.soort === 'tekst') uit += k.tekst;
    else uit += tekstVan(k);
  }
  return uit;
}
/* Alles onder dit element, het element zelf erbij. */
function alle(el, uit) {
  const lijst = uit || [];
  lijst.push(el);
  for (const k of el.kinderen || []) if (k.soort === 'el') alle(k, lijst);
  return lijst;
}
function isNazaatVan(el, mogelijkeOuder) {
  for (let k = el; k; k = k.ouder) if (k === mogelijkeOuder) return true;
  return false;
}

module.exports = { lees, kinderen, kind, attr, tekstVan, alle, isNazaatVan, zoekNs, XML_NS };

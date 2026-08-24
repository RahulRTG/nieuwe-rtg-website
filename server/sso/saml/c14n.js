/* ============================================================================
   Canonicalisatie: de bytes waar de handtekening werkelijk over gaat.

   DIT IS DE PLEK WAAR EEN ZELFGEBOUWDE SAML-CONTROLE OMVALT, dus hij staat
   apart en niet verstopt in de controle zelf. Een XML-handtekening dekt niet de
   tekst die binnenkwam maar de CANONIEKE vorm daarvan: dezelfde boom, in een
   voorgeschreven schrijfwijze. Twee documenten die voor een lezer identiek zijn
   -- andere prefix, andere attribuutvolgorde, een lege tag anders geschreven --
   leveren dezelfde canonieke bytes. Dat is precies waarom je niet mag
   controleren op de ruwe tekst.

   De twee algoritmen die SAML-providers in de praktijk gebruiken staan hier
   allebei, en verder niets:

     exclusief  http://www.w3.org/2001/10/xml-exc-c14n#
     inclusief  http://www.w3.org/TR/2001/REC-xml-c14n-20010315

   De WithComments-varianten worden GEWEIGERD, en dat is geen luiheid. Onze
   lezer gooit commentaar weg (xml.js), dus een controle met de commentaarvorm
   zou de verkeerde bytes vergelijken -- en dan zou hij niet stil falen maar
   stil SLAGEN op een document waarvan wij het commentaar nooit hebben gezien.
   Weigeren is het enige eerlijke antwoord.

   DE DRIE REGELS DIE HET VERSCHIL MAKEN, en die alle drie een keer fout gaan:

   1. Een attribuut ZONDER prefix zit in GEEN naamruimte -- ook niet in de
      standaardnaamruimte van zijn element. Dat bepaalt de sorteervolgorde.
   2. Bij EXCLUSIEVE canonicalisatie worden alleen de naamruimten geschreven
      die het element ZICHTBAAR GEBRUIKT (zijn eigen prefix, de prefixen van
      zijn attributen, plus wat in de PrefixList staat). Alle andere blijven
      weg -- dat is nu juist het verschil met inclusief.
   3. Een element zonder prefix in GEEN naamruimte, onder een ouder die wel een
      standaardnaamruimte schreef, moet `xmlns=""` schrijven. Vergeet die en
      een heel document valt om.
   ========================================================================== */
'use strict';

const { XML_NS } = require('./xml');

const EXCLUSIEF = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const INCLUSIEF = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const TOEGESTAAN = [EXCLUSIEF, INCLUSIEF];

function tekstUit(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#xD;');
}
function waardeUit(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
    .replace(/\t/g, '&#x9;').replace(/\n/g, '&#xA;').replace(/\r/g, '&#xD;');
}
const qnaam = (prefix, naam) => (prefix ? prefix + ':' : '') + naam;

/* Alle naamruimtebindingen die op dit element gelden, van boven naar beneden
   opgebouwd zodat de dichtstbijzijnde declaratie wint. */
function inZicht(el) {
  const keten = [];
  for (let k = el; k; k = k.ouder) keten.unshift(k);
  const uit = Object.create(null);
  for (const k of keten) for (const p of Object.keys(k.nsdecl)) uit[p] = k.nsdecl[p];
  return uit;
}

function schrijf(el, gerenderd, exclusief, prefixLijst, isApex, uit) {
  const zicht = inZicht(el);
  const nieuw = Object.assign(Object.create(null), gerenderd);
  const teSchrijven = [];

  let kandidaten;
  if (exclusief) {
    /* Alleen wat zichtbaar wordt gebruikt, plus de PrefixList. */
    const nodig = new Set([el.prefix]);
    for (const a of el.attrs) if (a.prefix) nodig.add(a.prefix);
    for (const p of prefixLijst) nodig.add(p === '#default' ? '' : p);
    kandidaten = [...nodig];
  } else {
    kandidaten = Object.keys(zicht);
    if (!kandidaten.includes('')) kandidaten.push('');
  }

  for (const p of kandidaten) {
    if (p === 'xml') continue;                       // bij afspraak gebonden, nooit geschreven
    const uri = zicht[p] === undefined ? '' : zicht[p];
    const al = gerenderd[p] === undefined ? '' : gerenderd[p];
    if (uri === al) continue;
    /* Een lege standaardnaamruimte hoeft alleen geschreven te worden als een
       voorouder er wel een schreef -- regel 3 uit de kop. */
    if (uri === '' && al === '') continue;
    teSchrijven.push({ p, uri });
    nieuw[p] = uri;
  }
  teSchrijven.sort((a, b) => (a.p < b.p ? -1 : a.p > b.p ? 1 : 0));

  /* Bij INCLUSIEVE canonicalisatie erven de xml:*-attributen van boven mee in
     het buitenste element van het stuk dat we ondertekenen. Bij exclusieve
     juist niet: dat is een van de twee redenen dat exclusief bestaat. */
  let attrs = el.attrs.slice();
  if (!exclusief && isApex) {
    const gezien = new Set(attrs.filter(a => a.ns === XML_NS).map(a => a.naam));
    for (let k = el.ouder; k; k = k.ouder) {
      for (const a of k.attrs) {
        if (a.ns === XML_NS && !gezien.has(a.naam)) { gezien.add(a.naam); attrs.push(a); }
      }
    }
  }
  attrs = attrs.slice().sort((a, b) => {
    const an = a.ns || '', bn = b.ns || '';
    if (an !== bn) return an < bn ? -1 : 1;
    return a.naam < b.naam ? -1 : a.naam > b.naam ? 1 : 0;
  });

  uit.push('<' + qnaam(el.prefix, el.naam));
  for (const d of teSchrijven) uit.push(' ' + (d.p ? 'xmlns:' + d.p : 'xmlns') + '="' + waardeUit(d.uri) + '"');
  for (const a of attrs) uit.push(' ' + qnaam(a.prefix, a.naam) + '="' + waardeUit(a.waarde) + '"');
  uit.push('>');
  for (const k of el.kinderen) {
    if (k.soort === 'tekst') uit.push(tekstUit(k.tekst));
    else schrijf(k, nieuw, exclusief, prefixLijst, false, uit);
  }
  uit.push('</' + qnaam(el.prefix, el.naam) + '>');
}

/* De canonieke bytes van een element en alles eronder.

   `overslaan` is het enveloped-signature-transform: het handtekeningelement
   zelf hoort niet in de bytes die het ondertekent. In plaats van de boom te
   verminken en later terug te zetten, knippen we hem hier weg -- een
   verandering die je moet terugdraaien, is een verandering die je vergeet
   terug te draaien. */
function canoniek(apex, algoritme, prefixLijst, overslaan) {
  if (!TOEGESTAAN.includes(algoritme))
    throw new Error('canonicalisatie "' + algoritme + '" wordt hier niet gedaan. Alleen exclusief en inclusief zonder commentaar.');
  const exclusief = algoritme === EXCLUSIEF;
  const kopie = overslaan ? zonder(apex, overslaan) : apex;
  const uit = [];
  schrijf(kopie, Object.create(null), exclusief, prefixLijst || [], true, uit);
  return Buffer.from(uit.join(''), 'utf8');
}

/* Een ondiepe kopie van de boom waar EEN element uit is geknipt. De ouders
   blijven naar het origineel wijzen, want de naamruimteketen moet intact
   blijven -- alleen de kinderlijsten op het pad worden vervangen. */
function zonder(apex, weg) {
  const pad = new Set();
  for (let k = weg; k; k = k.ouder) pad.add(k);
  if (!pad.has(apex)) return apex;                   // ligt er niet in: niets te knippen
  const bouw = (el) => {
    if (el === weg) return null;
    if (!pad.has(el)) return el;
    const kopie = Object.assign(Object.create(null), el);
    kopie.kinderen = [];
    for (const k of el.kinderen) {
      if (k.soort !== 'el') { kopie.kinderen.push(k); continue; }
      const nk = bouw(k);
      if (nk) kopie.kinderen.push(nk);
    }
    return kopie;
  };
  return bouw(apex);
}

module.exports = { canoniek, EXCLUSIEF, INCLUSIEF, TOEGESTAAN };

/* rtgjson: onze eigen JSON-motor, in huis gecodeerd (zoals het webframework
   en de webpush) in plaats van de ingebouwde JSON. Twee kanten:

   - parse(tekst, opties): een strikte, enkelvoudige-doorloop parser volgens
     de JSON-spec (RFC 8259). Veiliger dan de ingebouwde op precies de
     plekken waar wij hem gebruiken (de HTTP-grens): een sleutel "__proto__"
     wordt bij het bouwen al overgeslagen (prototype-vergiftiging kan dus
     niet eens ontstaan) en een diepte-grens (standaard 64) kapt
     nestings-bommen af voordat er een boom van gebouwd wordt.
   - stringify(waarde): byte-voor-byte hetzelfde resultaat als de ingebouwde
     JSON.stringify zonder replacer/inspringing (zelfde getalvorm, zelfde
     escapes, toJSON gerespecteerd, losse surrogaten netjes ge-escaped),
     zodat sha-vergelijkingen en golden-bestanden identiek blijven.

   Fouten zijn gewone Error's met .rtgjson = true en een korte, nette
   melding; de body-parser vertaalt ze naar een 400. */

const MAX_DIEPTE = 64;

function fout(melding, pos) {
  const e = new Error(melding + (pos != null ? ' (positie ' + pos + ')' : ''));
  e.rtgjson = true;
  return e;
}

/* ---------- parse ---------- */
function parse(tekst, opties) {
  const maxDiepte = (opties && opties.maxDiepte) || MAX_DIEPTE;
  const s = String(tekst);
  let i = 0;
  const n = s.length;

  const wit = () => { while (i < n) { const c = s.charCodeAt(i); if (c === 32 || c === 9 || c === 10 || c === 13) i++; else break; } };

  function waarde(diepte) {
    if (diepte > maxDiepte) throw fout('te diep genest (meer dan ' + maxDiepte + ' niveaus)', i);
    wit();
    if (i >= n) throw fout('onverwacht einde', i);
    const c = s[i];
    if (c === '{') return object(diepte);
    if (c === '[') return lijst(diepte);
    if (c === '"') return tekstwaarde();
    if (c === 't') { eis('true'); return true; }
    if (c === 'f') { eis('false'); return false; }
    if (c === 'n') { eis('null'); return null; }
    if (c === '-' || (c >= '0' && c <= '9')) return getal();
    throw fout('onverwacht teken "' + c + '"', i);
  }
  function eis(woord) {
    if (s.startsWith(woord, i)) { i += woord.length; return; }
    throw fout('verwachtte "' + woord + '"', i);
  }
  function object(diepte) {
    i++; wit();
    const uit = {};
    if (s[i] === '}') { i++; return uit; }
    for (;;) {
      wit();
      if (s[i] !== '"') throw fout('objectsleutel moet een string zijn', i);
      const sleutel = tekstwaarde();
      wit();
      if (s[i] !== ':') throw fout('verwachtte ":" na de sleutel', i);
      i++;
      const w = waarde(diepte + 1);
      // het schild: een __proto__-sleutel bouwen we niet eens; ook een eigen
      // "constructor"-object mag nooit een prototype-veld aan boord hebben
      if (sleutel !== '__proto__' && !(sleutel === 'constructor' && w && typeof w === 'object' && !Array.isArray(w) && ('prototype' in w))) {
        uit[sleutel] = w;
      }
      wit();
      if (s[i] === ',') { i++; continue; }
      if (s[i] === '}') { i++; return uit; }
      throw fout('verwachtte "," of "}" in het object', i);
    }
  }
  function lijst(diepte) {
    i++; wit();
    const uit = [];
    if (s[i] === ']') { i++; return uit; }
    for (;;) {
      uit.push(waarde(diepte + 1));
      wit();
      if (s[i] === ',') { i++; continue; }
      if (s[i] === ']') { i++; return uit; }
      throw fout('verwachtte "," of "]" in de lijst', i);
    }
  }
  function tekstwaarde() {
    // s[i] is '"'; snel pad: geen escapes -> slice
    let j = ++i;
    let uit = '';
    for (;;) {
      if (j >= n) throw fout('string niet afgesloten', i - 1);
      const c = s.charCodeAt(j);
      if (c === 34) { uit += s.slice(i, j); i = j + 1; return uit; } // "
      if (c === 92) { // \
        uit += s.slice(i, j);
        const e = s[j + 1];
        if (e === '"' || e === '\\' || e === '/') { uit += e; j += 2; }
        else if (e === 'n') { uit += '\n'; j += 2; }
        else if (e === 't') { uit += '\t'; j += 2; }
        else if (e === 'r') { uit += '\r'; j += 2; }
        else if (e === 'b') { uit += '\b'; j += 2; }
        else if (e === 'f') { uit += '\f'; j += 2; }
        else if (e === 'u') {
          const hex = s.slice(j + 2, j + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw fout('ongeldige \\u-escape', j);
          uit += String.fromCharCode(parseInt(hex, 16)); j += 6;
        } else throw fout('ongeldige escape "\\' + e + '"', j);
        i = j;
        continue;
      }
      if (c < 0x20) throw fout('onge-escaped stuurteken in string', j);
      j++;
    }
  }
  function getal() {
    const start = i;
    if (s[i] === '-') i++;
    if (s[i] === '0') i++;
    else if (s[i] >= '1' && s[i] <= '9') { while (s[i] >= '0' && s[i] <= '9') i++; }
    else throw fout('ongeldig getal', start);
    if (s[i] === '.') { i++; if (!(s[i] >= '0' && s[i] <= '9')) throw fout('ongeldig getal', start); while (s[i] >= '0' && s[i] <= '9') i++; }
    if (s[i] === 'e' || s[i] === 'E') {
      i++;
      if (s[i] === '+' || s[i] === '-') i++;
      if (!(s[i] >= '0' && s[i] <= '9')) throw fout('ongeldig getal', start);
      while (s[i] >= '0' && s[i] <= '9') i++;
    }
    return Number(s.slice(start, i));
  }

  const uit = waarde(0);
  wit();
  if (i < n) throw fout('onverwachte inhoud na het einde', i);
  return uit;
}

/* ---------- stringify ---------- */
/* Dezelfde escapes als de ingebouwde: ", \\\\, \\b \\t \\n \\f \\r, overige
   stuurtekens en losse surrogaten als \\uXXXX; complete surrogaatparen blijven
   rauw. Bewust een handmatige scan (geen regex): geen escaping-lagen, en het
   snelle pad (geen bijzonder teken) is een enkele doorloop met een slice. */
const KORT = { 8: '\\b', 9: '\\t', 10: '\\n', 12: '\\f', 13: '\\r', 34: '\\"', 92: '\\\\' };
function strEsc(str) {
  let uit = '';
  let start = 0;
  for (let k = 0; k < str.length; k++) {
    const c = str.charCodeAt(k);
    let esc = null;
    if (c === 34 || c === 92 || c < 0x20) esc = KORT[c] || ('\\u' + c.toString(16).padStart(4, '0'));
    else if (c >= 0xd800 && c <= 0xdfff) {
      if (c <= 0xdbff && k + 1 < str.length) {
        const v = str.charCodeAt(k + 1);
        if (v >= 0xdc00 && v <= 0xdfff) { k++; continue; } // compleet paar: rauw laten
      }
      esc = '\\u' + c.toString(16).padStart(4, '0'); // los surrogaat
    }
    if (esc !== null) { uit += str.slice(start, k) + esc; start = k + 1; }
  }
  if (start === 0) return '"' + str + '"';
  return '"' + uit + str.slice(start) + '"';
}
function stringify(waarde) {
  const t = typeof waarde;
  if (t === 'string') return strEsc(waarde);
  if (t === 'number') return Number.isFinite(waarde) ? String(waarde) : 'null';
  if (t === 'boolean') return waarde ? 'true' : 'false';
  if (t === 'bigint') throw fout('BigInt hoort niet in JSON');
  if (waarde === null) return 'null';
  if (t !== 'object') return undefined; // function/symbol/undefined
  if (typeof waarde.toJSON === 'function') return stringify(waarde.toJSON());
  if (Array.isArray(waarde)) {
    let uit = '[';
    for (let k = 0; k < waarde.length; k++) {
      if (k) uit += ',';
      const el = stringify(waarde[k]);
      uit += el === undefined ? 'null' : el;
    }
    return uit + ']';
  }
  let uit = '';
  for (const sleutel of Object.keys(waarde)) {
    const el = stringify(waarde[sleutel]);
    if (el === undefined) continue; // net als de ingebouwde: overslaan
    uit += (uit ? ',' : '') + strEsc(sleutel) + ':' + el;
  }
  return '{' + uit + '}';
}

module.exports = { parse, stringify, MAX_DIEPTE };

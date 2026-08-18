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

/* ---------- stringify ----------

   HIER STOND EEN EIGEN SERIALISEERDER, EN DIE IS WEGGEHAALD. Dat verdient
   uitleg, want de kop van dit bestand zegt dat deze motor bewust in eigen huis
   is gecodeerd.

   Het verschil zit in wat de twee helften OPLEVEREN. De parser hieronder doet
   iets wat de ingebouwde niet doet: hij weert de sleutel `__proto__` al tijdens
   het bouwen (prototype-vergiftiging kan niet eens ontstaan) en hij kapt een
   nestings-bom af op diepte. Dat is echte winst op de HTTP-grens, en die blijft
   dus volledig van ons.

   De stringifier had zo'n verschil niet, en kon het ook niet hebben. Zijn
   opdracht stond letterlijk in zijn eigen kop: "byte-voor-byte hetzelfde
   resultaat als de ingebouwde JSON.stringify". Een functie die per definitie
   hetzelfde MOET opleveren als de ingebouwde, kan alleen nog verschillen in
   prijs -- en dat deed hij:

     53,5 MB datastore serialiseren   eigen 1602 ms   ingebouwd 226 ms   (7,1x)
     13,3 MB datastore serialiseren   eigen  342 ms   ingebouwd  57 ms   (6,0x)

   Dat is geen implementatiedetail: het is de blokkade van de event-loop bij elke
   snapshot (BEPROEVING.json mat eventLoopMaxMs 2968) en het is tijd op ELK
   antwoord dat via res.json de deur uit gaat. De vorige ronde optimalisatie
   (de escape-voorwacht, 3,7x op strEsc) haalde precies daarom niet genoeg: een
   handgeschreven serialiseerder in JS verslaat de C++-implementatie in V8 niet.

   EN DIT KOST GEEN ENKELE DEPENDENCY. `JSON` is onderdeel van de taal, net als
   `Math` en `Array`, en staat in dezelfde categorie als de node-ingebouwden die
   dit huis overal gebruikt (node:http, node:crypto, node:sqlite). De belofte
   "nul dependencies" gaat over npm-pakketten en die staat nog precies overeind:
   package.json heeft nog altijd geen enkele runtime-afhankelijkheid.

   WAT DE TOETSEN NU MOETEN DOEN. test/rtgjson.test.js bewees de gelijkheid met
   `assert.equal(rtgjson.stringify(x), JSON.stringify(x))`. Na deze wijziging is
   dat een toets die niet meer kan zakken (LAT.md regel 9), dus die beweringen
   zijn vervangen door gouden verwachtingen en door eigenschappen die wel bijten:
   de uitvoer bevat geen rauw stuurteken, losse surrogaten staan als \uXXXX, en
   alles komt via ONZE eigen parser identiek terug. */
function stringify(waarde) {
  try {
    return JSON.stringify(waarde);
  } catch (e) {
    /* Een BigInt gaf hier altijd een nette rtgjson-fout (met .rtgjson = true),
       en de body-parser vertaalt die naar een 400. De ingebouwde gooit een
       kale TypeError; die vertalen we terug, zodat aanroepers niets merken. */
    if (e instanceof TypeError && /BigInt/i.test(e.message || '')) throw fout('BigInt hoort niet in JSON');
    throw e;
  }
}
module.exports = { parse, stringify, MAX_DIEPTE };

/* Exacte veranderingsaanwijzer voor de levende JSON-werkkopie.

   SQLite bewaarde voorheen veilig, maar vond een wijziging door bij IEDERE
   save iedere top-level collectie opnieuw te serialiseren. Dat is O(hele
   wereld) werk voor een handeling die gewoonlijk een of twee collecties raakt.
   Deze wikkel observeert de mutatie zelf en onthoudt alleen de naam van de
   top-level collectie. Geen rij, sleutel of waarde komt in de meter terecht.

   Dit is een AANWIJZER en nooit de enige veiligheidsgrens. Een save zonder een
   aanwijzing laat SQLite daarom nog steeds de hele toestand controleren. Geld-
   collecties blijven bovendien op elke save exact gecontroleerd en een
   periodieke naronde controleert de volledige wereld. Een gemiste aanwijzing
   kan zo hooguit de snelle weg missen; hij kan geen succesvolle geldwrite
   verzinnen of een verandering voor altijd laten verdwijnen.

   De generatie per collectie is belangrijk: pas NA een geslaagde commit wordt
   exact de waargenomen generatie bevestigd. Verandert een collectie tussen
   snapshot en bevestiging, dan blijft zij vuil. */
'use strict';

const BEWAAKT = Symbol.for('rtg.db.mutatietracker.bewaakt');
/* Een waarde die met dit merk antwoordt heeft al een eigen schrijfpoort (de
   alleen-leesbare auditprojectie); haar opnieuw wikkelen zou haar identiteit
   breken waarop de auditmotor bezit vaststelt. */
const NIET_VOLGEN = Symbol.for('rtg.db.nietVolgen');
const ontdoe = new WeakMap();
const waarnemers = new Set();
const vuil = new Map();
let generatie = 0;
let actieveWortel = null;

const lengte = v => Array.isArray(v) ? v.length
  : (v && typeof v === 'object' ? Object.keys(v).length : 0);
const volg = v => {
  if (!v || typeof v !== 'object') return false;
  const p = Object.getPrototypeOf(v);
  return Array.isArray(v) || p === Object.prototype || p === null;
};
const ruw = v => ontdoe.get(v) || v;

/* Opslag leest dezelfde actuele waarde, maar hoeft daarbij niet door iedere
   `get`-val van de aanwijzer te lopen. JSON.stringify op een Proxy valt in het
   trage generieke pad en maakte de periodieke veiligheidsronde op een wereld
   van 7,5 MB 43,75 ms per collectiebeeld. De ruwe target is geen tweede staat:
   alle Proxy-writes landen juist op dit object. Alleen de JSON-tekst komt naar
   buiten, zodat geen aanroeper de aanwijzer via een ruwe mutatie kan omzeilen. */
function serialiseerVoorOpslag(waarde) { return JSON.stringify(ruw(waarde)); }

function meld(wortel, naam, voor, na) {
  if (wortel !== actieveWortel || typeof naam !== 'string') return;
  const g = ++generatie;
  vuil.set(naam, g);
  const feit = Object.freeze({ collectie: naam, voorLengte: voor, naLengte: na });
  for (const fn of waarnemers) { try { fn(feit); } catch (e) {} }
}

function voegWaarnemerToe(fn) {
  if (typeof fn !== 'function') return () => {};
  waarnemers.add(fn);
  return () => waarnemers.delete(fn);
}

function bewaak(data) {
  data = ruw(data);
  if (!volg(data)) { actieveWortel = null; vuil.clear(); return data; }
  const wortel = {};
  actieveWortel = wortel;
  vuil.clear();
  const perCollectie = new Map();

  function diep(waarde, naam) {
    waarde = ruw(waarde);
    if (!volg(waarde) || waarde[NIET_VOLGEN] === true) return waarde;
    let kaart = perCollectie.get(naam);
    if (!kaart) { kaart = new WeakMap(); perCollectie.set(naam, kaart); }
    if (kaart.has(waarde)) return kaart.get(waarde);
    const handler = {
      get(doel, sleutel, ontvanger) {
        const v = Reflect.get(doel, sleutel, ontvanger);
        /* Proxy-invariant: een niet-schrijfbare, niet-configureerbare waarde
           moet letterlijk dezelfde waarde teruggeven. Trust-records zijn diep
           bevroren; zo'n kind opnieuw in een Proxy wikkelen laat onder andere
           JSON.stringify terecht met een TypeError stoppen. Bevroren inhoud
           kan niet muteren en hoeft dus ook niet verder te worden bewaakt. */
        const d = Reflect.getOwnPropertyDescriptor(doel, sleutel);
        if (d && Object.prototype.hasOwnProperty.call(d, 'value') &&
          d.configurable === false && d.writable === false) return v;
        return diep(v, naam);
      },
      set(doel, sleutel, waardeNieuw) {
        const voor = lengte(data[naam]);
        const ok = Reflect.set(doel, sleutel, ruw(waardeNieuw), doel);
        if (ok) meld(wortel, naam, voor, lengte(data[naam]));
        return ok;
      },
      deleteProperty(doel, sleutel) {
        const bestond = Object.prototype.hasOwnProperty.call(doel, sleutel);
        const voor = lengte(data[naam]);
        const ok = Reflect.deleteProperty(doel, sleutel);
        if (ok && bestond) meld(wortel, naam, voor, lengte(data[naam]));
        return ok;
      },
      defineProperty(doel, sleutel, omschrijving) {
        const voor = lengte(data[naam]);
        const d = Object.assign({}, omschrijving);
        if (Object.prototype.hasOwnProperty.call(d, 'value')) d.value = ruw(d.value);
        const ok = Reflect.defineProperty(doel, sleutel, d);
        if (ok) meld(wortel, naam, voor, lengte(data[naam]));
        return ok;
      }
    };
    const proxy = new Proxy(waarde, handler);
    kaart.set(waarde, proxy); ontdoe.set(proxy, waarde);
    return proxy;
  }

  const proxy = new Proxy(data, {
    get(doel, sleutel, ontvanger) {
      if (sleutel === BEWAAKT) return true;
      const v = Reflect.get(doel, sleutel, ontvanger);
      return typeof sleutel === 'string' ? diep(v, sleutel) : v;
    },
    set(doel, sleutel, waardeNieuw) {
      if (typeof sleutel !== 'string') return Reflect.set(doel, sleutel, ruw(waardeNieuw), doel);
      const voor = lengte(doel[sleutel]);
      const ok = Reflect.set(doel, sleutel, ruw(waardeNieuw), doel);
      if (ok) meld(wortel, sleutel, voor, lengte(doel[sleutel]));
      return ok;
    },
    deleteProperty(doel, sleutel) {
      if (typeof sleutel !== 'string') return Reflect.deleteProperty(doel, sleutel);
      const bestond = Object.prototype.hasOwnProperty.call(doel, sleutel);
      const voor = lengte(doel[sleutel]);
      const ok = Reflect.deleteProperty(doel, sleutel);
      if (ok && bestond) meld(wortel, sleutel, voor, 0);
      return ok;
    },
    defineProperty(doel, sleutel, omschrijving) {
      if (typeof sleutel !== 'string') return Reflect.defineProperty(doel, sleutel, omschrijving);
      const voor = lengte(doel[sleutel]);
      const d = Object.assign({}, omschrijving);
      if (Object.prototype.hasOwnProperty.call(d, 'value')) d.value = ruw(d.value);
      const ok = Reflect.defineProperty(doel, sleutel, d);
      if (ok) meld(wortel, sleutel, voor, lengte(doel[sleutel]));
      return ok;
    }
  });
  ontdoe.set(proxy, data);
  return proxy;
}

function snapshot() {
  return [...vuil.entries()].map(([collectie, g]) => ({ collectie, generatie: g }));
}
function bevestig(rijen) {
  for (const r of rijen || []) if (vuil.get(r.collectie) === r.generatie) vuil.delete(r.collectie);
}
function vergeet(naam) { vuil.delete(String(naam)); }
function isBewaakt(data) { try { return !!(data && data[BEWAAKT]); } catch (e) { return false; } }

module.exports = { bewaak, snapshot, bevestig, vergeet, isBewaakt, voegWaarnemerToe,
  serialiseerVoorOpslag, BEWAAKT, NIET_VOLGEN, lengte };

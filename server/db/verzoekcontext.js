/* Request-lokale copy-on-write werkkopie. De synchrone save() markeert alleen;
   de responsepoort bevestigt later asynchroon en publiceert pas na COMMIT. */
'use strict';

const { AsyncLocalStorage } = require('async_hooks');
const winkel = new AsyncLocalStorage();
const PROXY_INFO = new WeakMap();
const heeft = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
let achtergrondEffecten = null;

function eisMutatieOpen(ctx) {
  if (!ctx.stroom) return;
  const e = new Error('Na het openen van een antwoordstroom mag geen opslagmutatie meer beginnen.');
  e.code = 'PG_STREAM_MUTATIE'; throw e;
}

function kloonMetKaart(bron) {
  const heen = new WeakMap(), terug = new WeakMap();
  function loop(v) {
    if (!v || typeof v !== 'object') return v;
    if (heen.has(v)) return heen.get(v);
    const uit = Array.isArray(v) ? [] : {};
    heen.set(v, uit); terug.set(uit, v);
    for (const k of Object.keys(v)) uit[k] = loop(v[k]);
    return uit;
  }
  return { waarde: loop(bron), heen, terug };
}

function nieuw(req) {
  return {
    req: req || null, open: true, opslaan: false, stroom: false,
    bron: null, wortel: null, vakken: new Map(), proxies: new Map(),
    voorCommit: [], naCommit: [], commitEigen: new Set()
  };
}

function huidige() { return winkel.getStore() || null; }
function voer(ctx, fn) { return winkel.run(ctx, fn); }
function zonder(fn) { return winkel.exit(fn); }
/* Een bestaande autoritatieve DB-primitive toont bewust de ruwe projecties en
   slikt de save() van zijn synchrone domeinbewerker: diezelfde primitive commit
   ze al. Zo ontstaat geen tweede requestcommit en geen achtergrondalarm. */
function eigenWerk(fn) { return winkel.run({ open: false, eigenOpslag: true }, fn); }

function vakVoor(ctx, sleutel) {
  if (ctx.vakken.has(sleutel)) return ctx.vakken.get(sleutel);
  const bestaat = heeft(ctx.bron, sleutel);
  const origineel = bestaat ? ctx.bron[sleutel] : undefined;
  const gekloond = kloonMetKaart(origineel);
  const vak = {
    sleutel, basisBestaat: bestaat,
    basisJson: bestaat ? JSON.stringify(origineel) : null,
    origineel, waarde: gekloond.waarde, bestaat,
    heen: gekloond.heen, terug: gekloond.terug
  };
  ctx.vakken.set(sleutel, vak);
  return vak;
}

function losWaarde(v) {
  const info = v && typeof v === 'object' ? PROXY_INFO.get(v) : null;
  return info ? info.actueel() : v;
}

function objectProxy(ctx, vak, origineel) {
  let kaart = ctx.proxies.get(vak.sleutel);
  if (!kaart) { kaart = new WeakMap(); ctx.proxies.set(vak.sleutel, kaart); }
  if (kaart.has(origineel)) return kaart.get(origineel);
  const actueel = () => vak.heen.get(origineel) || origineel;
  const pak = (v) => {
    if (!v || typeof v !== 'object') return v;
    const echt = ctx.vakken.get(vak.sleutel);
    /* Voor de eerste schrijfactie komt `v` rechtstreeks uit de gedeelde
       objectgraaf en moet ieder niveau gewikkeld blijven. Na de kopie herkennen
       heen/terug welke clone nog bij zo'n oud object hoort. Een nieuw object
       dat de request zelf invoegde staat niet in die kaarten en is al veilig. */
    if (!echt) return objectProxy(ctx, vak, v);
    const oud = echt.terug.get(v) || v;
    /* Een tijdens dit verzoek nieuw ingevoegd object is al geisoleerd. Alleen
       objecten uit de gedeelde bron hebben nog een wikkel nodig. */
    return echt.heen.has(oud) || oud === echt.origineel ? objectProxy(ctx, vak, oud) : v;
  };
  const handler = {
    get(_t, p, r) { return pak(Reflect.get(actueel(), p, r)); },
    set(_t, p, v) {
      eisMutatieOpen(ctx);
      const f = vakVoor(ctx, vak.sleutel); ctx.vakken.set(vak.sleutel, f);
      return Reflect.set(f.heen.get(origineel) || f.waarde, p, losWaarde(v));
    },
    deleteProperty(_t, p) {
      eisMutatieOpen(ctx);
      const f = vakVoor(ctx, vak.sleutel); return Reflect.deleteProperty(f.heen.get(origineel) || f.waarde, p);
    },
    defineProperty(_t, p, d) {
      eisMutatieOpen(ctx);
      const f = vakVoor(ctx, vak.sleutel), x = Object.assign({}, d);
      if ('value' in x) x.value = losWaarde(x.value);
      return Reflect.defineProperty(f.heen.get(origineel) || f.waarde, p, x);
    },
    ownKeys() { return Reflect.ownKeys(actueel()); },
    has(_t, p) { return Reflect.has(actueel(), p); },
    getOwnPropertyDescriptor(_t, p) { return Reflect.getOwnPropertyDescriptor(actueel(), p); },
    getPrototypeOf() { return Reflect.getPrototypeOf(actueel()); }
  };
  const proxy = new Proxy(origineel, handler);
  kaart.set(origineel, proxy);
  PROXY_INFO.set(proxy, { actueel });
  return proxy;
}

function wortelVoor(ctx, bron) {
  if (ctx.wortel && ctx.bron === bron) return ctx.wortel;
  ctx.bron = bron;
  const handler = {
    get(_t, p) {
      if (typeof p !== 'string') return Reflect.get(bron, p);
      const vak = ctx.vakken.get(p);
      if (vak) {
        if (!vak.bestaat) return undefined;
        if (vak.waarde && typeof vak.waarde === 'object') {
          const oud = vak.terug.get(vak.waarde);
          return oud ? objectProxy(ctx, vak, oud) : vak.waarde;
        }
        return vak.waarde;
      }
      const v = bron[p];
      return v && typeof v === 'object'
        ? objectProxy(ctx, { sleutel: p, origineel: v,
          get heen() { return (ctx.vakken.get(p) || {}).heen || new WeakMap(); },
          get terug() { return (ctx.vakken.get(p) || {}).terug || new WeakMap(); } }, v)
        : v;
    },
    set(_t, p, v) {
      if (typeof p !== 'string') return Reflect.set(bron, p, v);
      eisMutatieOpen(ctx);
      const vak = vakVoor(ctx, p); vak.waarde = losWaarde(v); vak.bestaat = true;
      return true;
    },
    deleteProperty(_t, p) {
      if (typeof p !== 'string') return false;
      eisMutatieOpen(ctx);
      const vak = vakVoor(ctx, p); vak.waarde = undefined; vak.bestaat = false;
      return true;
    },
    ownKeys() {
      const s = new Set(Reflect.ownKeys(bron));
      for (const [k, v] of ctx.vakken) v.bestaat ? s.add(k) : s.delete(k);
      return [...s];
    },
    has(_t, p) {
      const v = typeof p === 'string' && ctx.vakken.get(p);
      return v ? v.bestaat : Reflect.has(bron, p);
    },
    getOwnPropertyDescriptor(_t, p) {
      const v = typeof p === 'string' && ctx.vakken.get(p);
      if (v) return v.bestaat ? { value: v.waarde, writable: true, enumerable: true, configurable: true } : undefined;
      return Reflect.getOwnPropertyDescriptor(bron, p);
    }
  };
  ctx.wortel = new Proxy(bron, handler);
  return ctx.wortel;
}

function dataVoor(bron) {
  const ctx = huidige();
  return ctx && ctx.open && bron && typeof bron === 'object' ? wortelVoor(ctx, bron) : bron;
}

function zetWortel(waarde) {
  const ctx = huidige();
  if (!ctx || !ctx.open || !waarde || typeof waarde !== 'object') return false;
  eisMutatieOpen(ctx);
  const sleutels = new Set([...Object.keys(ctx.bron || {}), ...Object.keys(waarde)]);
  for (const k of sleutels) {
    const vak = vakVoor(ctx, k);
    vak.bestaat = heeft(waarde, k); vak.waarde = vak.bestaat ? waarde[k] : undefined;
  }
  return true;
}

function noteerSave() {
  const ctx = huidige();
  if (ctx && ctx.eigenOpslag) return true;
  if (!ctx || !ctx.open) return false;
  if (ctx.stroom) {
    const e = new Error('Een streaming antwoord mag geen normale opslagmutatie starten.');
    e.code = 'PG_STREAM_MUTATIE'; throw e;
  }
  ctx.opslaan = true;
  return true;
}

function haakVoorCommit(fn) {
  const ctx = huidige();
  if (!ctx || !ctx.open || typeof fn !== 'function') return false;
  ctx.voorCommit.push(fn); return true;
}
function haakNaCommit(fn) {
  const ctx = huidige();
  if (ctx && ctx.open && typeof fn === 'function') { ctx.naCommit.push(fn); return true; }
  if (achtergrondEffecten && typeof fn === 'function') { achtergrondEffecten.push(fn); return true; }
  return false;
}

async function draaiVoorCommit(ctx) {
  for (const fn of ctx.voorCommit.splice(0)) await voer(ctx, fn);
}
function meldEffectFout(e) {
  console.error('[requestcommit] best-effort na-commiteffect mislukt:', String(e && e.message || e));
}
/* Alleen best-effort projecties/berichten horen hier. Een kritisch gevolg moet
   vóór COMMIT deelnemen of als duurzame outbox in dezelfde commit staan. */
function draaiNaCommit(ctx) {
  for (const fn of ctx.naCommit.splice(0)) {
    try {
      const uit = fn();
      if (uit && typeof uit.then === 'function') Promise.resolve(uit).catch(meldEffectFout);
    } catch (e) { meldEffectFout(e); }
  }
}

function verzamelWijzigingen(ctx) {
  if (!ctx) return [];
  const uit = [];
  for (const vak of ctx.vakken.values()) {
    if (ctx.commitEigen.has(vak.sleutel)) continue;
    const na = vak.bestaat ? JSON.stringify(vak.waarde) : null;
    if (vak.basisBestaat === vak.bestaat && vak.basisJson === na) continue;
    uit.push({ sleutel: vak.sleutel, basisBestaat: vak.basisBestaat,
      basisJson: vak.basisJson, waardeBestaat: vak.bestaat, waardeJson: na });
  }
  return uit.sort((a, b) => a.sleutel.localeCompare(b.sleutel));
}
function wijzigingen(ctx) { return ctx && ctx.opslaan ? verzamelWijzigingen(ctx) : []; }
function onbevestigdeWijzigingen(ctx) { return verzamelWijzigingen(ctx); }

function eigenCommit(sleutels) {
  const ctx = huidige(); if (!ctx || !ctx.open) return;
  for (const k of [].concat(sleutels || [])) {
    ctx.commitEigen.add(String(k)); ctx.vakken.delete(String(k));
  }
}

function beginAchtergrond() {
  if (!achtergrondEffecten) achtergrondEffecten = [];
}
function voltooiAchtergrond() {
  const lijst = achtergrondEffecten || [];
  achtergrondEffecten = null;
  for (const fn of lijst) { try { fn(); } catch (e) {} }
}
function annuleerAchtergrond() { achtergrondEffecten = null; }

function sluit(ctx) {
  if (!ctx) return;
  ctx.open = false; ctx.voorCommit.length = 0; ctx.naCommit.length = 0;
}

module.exports = { nieuw, huidige, voer, zonder, eigenWerk, dataVoor, zetWortel, noteerSave,
  haakVoorCommit, haakNaCommit, draaiVoorCommit, draaiNaCommit, wijzigingen,
  onbevestigdeWijzigingen, eigenCommit, beginAchtergrond, voltooiAchtergrond,
  annuleerAchtergrond, sluit };

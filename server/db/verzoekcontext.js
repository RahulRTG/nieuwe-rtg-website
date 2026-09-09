/* Request-lokale copy-on-write werkkopie. De synchrone save() markeert alleen;
   de responsepoort bevestigt later asynchroon en publiceert pas na COMMIT. */
'use strict';

const { AsyncLocalStorage } = require('async_hooks');
/* De leeswikkel staat in ./verzoekwikkel.js: dit bestand gaat over de
   LEVENSLOOP van een verzoek, dat over hoe een object er tijdens dat verzoek
   uitziet. De twee haken gaan als functie mee zodat er geen kring ontstaat. */
const { losWaarde, objectProxy } = require('./verzoekwikkel')({
  vakVoor: (ctx, sleutel) => vakVoor(ctx, sleutel),
  eisMutatieOpen: (ctx) => eisMutatieOpen(ctx)
});
const winkel = new AsyncLocalStorage();
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
    bron: null, wortel: null, vakken: new Map(), proxies: new Map(), handlers: new Map(),
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
          return oud ? objectProxy(ctx, p, oud) : vak.waarde;
        }
        return vak.waarde;
      }
      const v = bron[p];
      /* Het gelegenheidsvak met getters dat hier stond is weg: handlerVoor()
         zoekt het vak per aanroep op zijn sleutel op, en levert vóór de eerste
         schrijfactie dezelfde lege heen/terug op. */
      return v && typeof v === 'object' ? objectProxy(ctx, p, v) : v;
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

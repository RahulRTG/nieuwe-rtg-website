/* DE REGISTERBLIK -- welke registers Rahul mag LEZEN, en hoe oud ze zijn.

   De meters (scripts/) meten de code en schrijven registers. Die registers zijn
   afgeleide, gepubliceerde waarheid, en CODE-AI-001 (test/codegrens.test.js)
   staat de runtime-AI toe ze te lezen -- de bron zelf nooit. Dit bestand is de
   enige plek waar de registerblik iets van schijf haalt, en het leest ALLEEN de
   registers hieronder, bij naam. Er komt nooit een pad van buitenaf binnen: het
   model vraagt een register op met een naam uit deze lijst, of krijgt niets.

   ELK ANTWOORD DRAAGT ZIJN LEEFTIJD. Een register is een meting op een moment.
   Wie "bewezen" doorgeeft zonder te zeggen dat het drie weken oud is, geeft een
   bewering over het verleden door als een bewering over nu -- en vervallen
   bewijs is geen bewijs (BESTUUR.md). Een register zonder stempel zegt dat hij
   er geen heeft, en een register dat ontbreekt zegt dat hij ontbreekt: dat is
   `niet vast te stellen`, en geen leeg antwoord. */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..', '..', '..');

const REGISTERS = Object.freeze({
  uitvoeringskaart: 'EXECUTION_MAP.json',
  vertrouwen: 'VERTROUWEN.json',
  routebron: 'ROUTEBRON.json',
  bewijsschuld: 'BEWIJSSCHULD.json',
  productiestand: '.release/productie-status.json',
  kennisindex: 'KENNISINDEX.json'
});

/* Hoe oud een meting mag zijn voor hij als vervallen geldt, tenzij het register
   het zelf zegt (VERTROUWEN.json draagt een halfwaardetijd). */
const STANDAARD_HOUDBAAR_DAGEN = 30;
const TTL_MS = 60000;
const kas = new Map();

const wortelVan = (opties) => (opties && opties.wortel) || process.env.RTG_REGISTERWORTEL || WORTEL;

function leesRegister(naam, opties) {
  const rel = REGISTERS[naam];
  if (!rel) return { ok: false, register: String(naam), reden: 'dit register staat niet op de lijst die de registerblik mag lezen' };
  const pad = path.join(wortelVan(opties), rel);
  const nu = Date.now();
  const eerder = kas.get(pad);
  if (eerder && nu - eerder.op < TTL_MS) return eerder.uit;
  let uit;
  try { uit = { ok: true, register: rel, inhoud: JSON.parse(fs.readFileSync(pad, 'utf8')) }; }
  catch (e) {
    uit = { ok: false, register: rel, stand: 'niet vast te stellen',
      reden: e && e.code === 'ENOENT' ? rel + ' staat niet in deze omgeving' : rel + ' is niet leesbaar' };
  }
  kas.set(pad, { op: nu, uit });
  return uit;
}

function leeftijd(inhoud, nu) {
  const st = (inhoud && inhoud.stempel) || null;
  const op = (st && st.op) || (inhoud && inhoud.gemaakt) || null;
  if (!op || !Number.isFinite(Date.parse(op))) {
    return { gemetenOp: null, dagenOud: null, vervallen: null, reden: 'dit register draagt geen stempel; hoe oud de meting is, is niet vast te stellen' };
  }
  const houdbaar = Number(inhoud.halfwaardetijdDagen) || STANDAARD_HOUDBAAR_DAGEN;
  const dagen = Math.floor(((nu || Date.now()) - Date.parse(op)) / 86400000);
  return { gemetenOp: op, dagenOud: dagen, houdbaarDagen: houdbaar, vervallen: dagen > houdbaar,
    commit: (st && st.commit) || inhoud.commit || null, vuileBoom: st && typeof st.boomVuil === 'boolean' ? st.boomVuil : null };
}

/* De graad van wat een register zegt: gemeten zolang de meting vers is. Een
   vervallen meting zakt naar vermoed, en een meting zonder datum ook -- van
   geen van beide weet je of het nu nog zo is. */
function graadUitLeeftijd(l) {
  if (!l || l.vervallen === null) return 'vermoed';
  return l.vervallen ? 'vermoed' : 'gemeten';
}

module.exports = { leesRegister, leeftijd, graadUitLeeftijd, REGISTERS };

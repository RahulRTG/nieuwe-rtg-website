#!/usr/bin/env node
/* ============================================================================
   KOMEN DE GEBLOKKEERDE ROUTES DOOR ALS JE EERST HUN OBJECT MAAKT?

   DE VRAAG. 1635 mutatieroutes stranden op 404: het object waar ze over gaan
   bestaat niet. Voor 1496 daarvan staat er een MAAKroute in dezelfde tak. De
   voor de hand liggende gedachte is dan: draai eerst de maakroutes, oogst het
   id dat ze teruggeven, en geef dat mee aan de zusterroutes. Een mechanisme in
   plaats van 1635 keer handwerk.

   Dat is een aanname, en dit script meet hem.

   DE UITSLAG (30 augustus 2026, gemeten en niet geschat):

     250  maakroutes in het huis
      68  daarvan komen zelf door -- de rest heeft ZELF een ouder nodig, of
           struikelt op invoer (400), rechten (403) of een ontbrekend ding (404)
     121  van de 1635 geblokkeerde routes komen daarmee op 2xx
      53  komen op een ANDERE fout dan 404 -- ze zijn dus wel voorbij het
           ontbrekende object en stranden verderop
     546  liggen in een tak waar geen enkele maakroute doorkomt

   Dus: ongeveer een op de tien. Het mechanisme werkt, en het is geen
   vervanging voor domeinwerk.

   TWEE DINGEN DIE ONDERWEG SNEUVELDEN, allebei aannames van mij:

   1. EEN GLOBALE ZAK MET ID'S WERKT NIET. De eerste versie hield een enkele
      `id`-plek bij; elk nieuw object overschreef het vorige, en een `id` uit de
      kluis van een lid is zinloos voor een festival van een zaak. De oogst
      hangt nu per TAK.
   2. HERHALEN WIKKELT DE KETEN NIET AF. Ik verwachtte dat een tweede ronde meer
      maakroutes zou laten slagen, omdat er dan meer ouders bestaan. Gemeten
      wordt het er niet meer maar minder (71 -> 68): wat in ronde een lukte,
      botst in ronde twee op een bestaand ding. De afhankelijkheden zitten dus
      niet in de VOLGORDE maar in de invoer.

   Draai:  node scripts/objectoogst.js
   ========================================================================== */
'use strict';
const { start } = require('./lib/wegwerpserver');
const { maakSleutels, haalSleutels, ROLLEN } = require('./lib/proefsleutels');
const { bouwLijfsleutels } = require('./lib/lijfsleutels');
const { plausibelLijf } = require('./lib/rolproef');
const { alleRoutes, isSchakel, verdeelOpRol } = require('./lib/routes');
const { MAAK, IDVELD } = require('./lib/objectoogst');

const tak = (p, d) => p.split('/').slice(0, d + 1).join('/');

(async () => {
  const DOOS = 'proef-doos-sleutel-0123456789abcdef';
  const s = await start({ naam: 'oogst2', env: { RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF', RTG_DOOS_SLEUTEL: DOOS } });
  const post = async (pad, lijf, tok, kop) => {
    try {
      const r = await fetch(s.basis + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(kop || {}) },
        body: JSON.stringify(lijf || {}) });
      let d; try { d = JSON.parse(await r.text()); } catch (e) { d = null; }
      return { status: r.status, data: d };
    } catch (e) { return { status: 0, data: null }; }
  };
  const bos = maakSleutels({ post, officeCode: 'RTG-OFFICE-PROEF' });
  const { tokens } = await haalSleutels(bos);
  const lij = await bouwLijfsleutels({ post, tokens, datamap: s.datamap, doosSleutel: DOOS });
  await post('/api/office/bank/leden', { aan: true }, tokens.office);

  const alle = alleRoutes().filter(r => r.pad.startsWith('/api/') && r.methode === 'POST' && !isSchakel(r.pad) && !r.pad.includes(':'));
  const rolVan = new Map(verdeelOpRol(alle, ROLLEN).metRol.map(r => [r.pad, r.rol]));
  const tokVoor = (pad) => {
    const rol = lij.rolVoor(pad) || rolVan.get(pad) || (lij.dekt(pad) ? 'lijfsleutel' : null);
    return (rol && !['lijfsleutel', 'openbaar', 'omgeving', 'eigen-poort'].includes(rol)) ? tokens[rol] : '';
  };
  /* PER TAK, en niet in een globale zak. Een `id` uit /api/member/kluis is
     zinloos voor /api/supplier/festival; de vorige poging had een enkele
     `id`-plek en daar won steeds het laatst gemaakte ding. */
  const oogst = {};      // tak -> { veld: waarde }
  const zet = (pad, data) => {
    const pluk = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      for (const [k, v] of Object.entries(obj)) {
        const w = typeof v === 'number' ? String(v) : v;
        if (typeof w === 'string' && w.length >= 3 && w.length <= 64 && IDVELD.test(k)) {
          for (const d of [2, 3]) { const t = tak(pad, d); (oogst[t] = oogst[t] || {})[k] = w; }
        }
      }
    };
    pluk(data);
    for (const v of Object.values(data || {})) if (v && typeof v === 'object' && !Array.isArray(v)) pluk(v);
  };
  const uitOogst = (pad) => Object.assign({}, oogst[tak(pad, 2)] || {}, oogst[tak(pad, 3)] || {});

  const maakRoutes = alle.filter(r => MAAK.test(r.pad));
  for (let ronde = 1; ronde <= 3; ronde++) {
    let door = 0;
    for (const r of maakRoutes) {
      const a = await post(r.pad, { ...plausibelLijf(r.pad), ...uitOogst(r.pad), ...(lij.lijfVoor(r.pad) || {}) },
        tokVoor(r.pad), lij.koppenVoor(r.pad));
      if (a.status >= 200 && a.status < 300 && a.data) { door++; zet(r.pad, a.data); }
    }
    console.log('ronde ' + ronde + ': ' + door + ' maakroutes door, ' + Object.keys(oogst).length + ' takken met een oogst');
  }

  // en nu: hoeveel van de geblokkeerde routes komen door?
  const o = require('../ONBEWEZEN.json');
  const bak = (o.perRoute.FIXTURE_404 || []).map(x => x.split(' ')[1]);
  let voor = 0, na = 0, geenOogst = 0;
  for (const pad of bak) {
    const extra = uitOogst(pad);
    if (!Object.keys(extra).length) { geenOogst++; continue; }
    const a = await post(pad, { ...plausibelLijf(pad), ...extra, ...(lij.lijfVoor(pad) || {}) }, tokVoor(pad), lij.koppenVoor(pad));
    if (a.status >= 200 && a.status < 300) na++;
    else if (a.status !== 404) voor++;
  }
  console.log('\nGEBLOKKEERDE ROUTES (' + bak.length + ')');
  console.log('  geen oogst in hun tak      :', geenOogst);
  console.log('  nu 2xx                     :', na);
  console.log('  nu een ANDERE fout dan 404 :', voor);
  s.klaar(); process.exit(0);
})();

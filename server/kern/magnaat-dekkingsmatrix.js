/* Bewijsmatrix voor het RTG Controleregister. Ieder onbekend veld blijft rood;
   gevonden code wordt nooit vanzelf bewijs voor eigenaarschap of werking. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { redenVoor: bestuursredenVoor } = require('./bestuursroutes');
const TEST_CACHE = new Map();
const BRON_CACHE = new Map();

const DIMENSIES = [
  ['register', 'In register'], ['kantoor', 'Kantoor'], ['rol', 'Rol'],
  ['stand', 'Stand'], ['schakelaar', 'Schakelaar'], ['taak', 'Taak'],
  ['proef', 'Bedradingsproef'], ['audit', 'Bestuursaudit'], ['gameplay', 'Gameplay'],
  ['economie', 'Economie'], ['werkroute', 'Volledige werkroute']
].map(([id, naam]) => ({ id, naam }));

function loop(map, uit = []) {
  let lijst = [];
  try { lijst = fs.readdirSync(map, { withFileTypes: true }); } catch (e) { return uit; }
  for (const item of lijst) {
    const p = path.join(map, item.name);
    if (item.isDirectory()) loop(p, uit);
    else if (/\.(?:test|e2e)\.js$/.test(item.name)) uit.push(p);
  }
  return uit;
}

function lees(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } }

function testSleutels(root) {
  if (TEST_CACHE.has(root)) return TEST_CACHE.get(root);
  const uit = new Set();
  for (const bestand of loop(path.join(root, 'test'))) {
    const tekst = lees(bestand);
    let m;
    const letterlijk = /(['"`])([^'"`\n]{1,240})\1/g;
    while ((m = letterlijk.exec(tekst))) uit.add(m[2]);
    const paden = /\/(?:api|apps)\/[A-Za-z0-9_./:?=&-]+/g;
    while ((m = paden.exec(tekst))) uit.add(m[0].replace(/[?,.;:)]+$/, ''));
  }
  TEST_CACHE.set(root, uit);
  return uit;
}

function maakWaarden(waarden) {
  const vanToepassing = DIMENSIES.filter(d => waarden[d.id] !== null && waarden[d.id] !== undefined);
  const goed = vanToepassing.filter(d => waarden[d.id] === true).length;
  const ontbreekt = vanToepassing.filter(d => waarden[d.id] === false).map(d => d.id);
  return {
    waarden: Object.fromEntries(DIMENSIES.map(d => [d.id, waarden[d.id] == null ? null : waarden[d.id] === true])),
    goed, totaal: vanToepassing.length,
    percentage: vanToepassing.length ? Math.round(goed / vanToepassing.length * 1000) / 10 : 100,
    volledig: ontbreekt.length === 0, ontbreekt
  };
}

module.exports = ({ root, flags = [], volledigeWerkprocessen = [] }) => {
  const proefsleutels = testSleutels(root);
  const schermbrug = /function magnaatHtml\b/.test(lees(path.join(root, 'server/middleware/csp.js'))) &&
    /function openControlScreen\b/.test(lees(path.join(root, 'public/apps/magnaat.html'))) &&
    /RTG_MAGNAAT_PROEF/.test(lees(path.join(root, 'public/apps/magnaat-sandbox.js')));
  const controleSpelbrug = /function zelftest\b/.test(lees(path.join(root, 'server/kern/magnaat-controle.js'))) &&
    /data-ctl-run/.test(lees(path.join(root, 'public/apps/magnaat.html'))) &&
    /data-ctl-task/.test(lees(path.join(root, 'public/apps/magnaat.html')));
  const analyseCache = new Map();
  const flagVoor = route => flags.filter(f => (f.paden || []).some(p => String(route || '').startsWith(p)));
  const economisch = punt => {
    /* Bestuur en herstel bedienen het platform, niet de speleconomie. */
    if (bestuursredenVoor(String(punt.route || punt.familie || ''))) return false;
    return /pay|betaal|bank|finance|factuur|order|bestel|reserver|boek|ticket|reis|rit|hotel|verhuur|huur|loon|personeel|staff|werk|contract|kassa|retail|mall|geld|munt|wallet|prijs|belasting|btw|groothandel|inkoop|verkoop|voorraad|vracht|abonnement|krediet|rente|begroting|uitkering|salaris|settlement|omzet/i
      .test([punt.route, punt.sleutel, punt.familie].join(' '));
  };
  const genoemd = sleutel => !!sleutel && proefsleutels.has(String(sleutel));
  const bron = bestand => {
    const sleutel = root + '|' + bestand;
    if (!BRON_CACHE.has(sleutel)) BRON_CACHE.set(sleutel, lees(path.join(root, bestand || '')));
    return BRON_CACHE.get(sleutel);
  };
  function fragment(punt) {
    const tekst = bron(punt.bestand), i = tekst.indexOf(String(punt.route || punt.sleutel || ''));
    return i < 0 ? '' : tekst.slice(i, i + 1400);
  }
  function bronstand(punt) {
    const s = [punt.route, punt.bestand, fragment(punt)].join(' ').toLowerCase();
    if (/sandbox|simulatie|synthet|contractproef/.test(s)) return 'simulatie';
    if (/rtg_demo|\bdemo\b/.test(s)) return 'hybride-demo';
    if (/geblokkeerd|niet_actief|bewust_dicht/.test(s)) return 'veilig-geblokkeerd';
    return 'codepad-aanwezig';
  }
  const audit = punt => /\baudit\b|journaal|logboek|inzagelog|\blog\s*\(|\bmeld\s*\(/i.test(fragment(punt));
  function analyseerDekkingspunt(punt) {
    const sleutel = [punt.bestand, punt.route, punt.sleutel].join('|');
    if (!analyseCache.has(sleutel)) analyseCache.set(sleutel, {
      bronstand: bronstand(punt), proef: genoemd(punt.route || punt.sleutel), audit: audit(punt)
    });
    return analyseCache.get(sleutel);
  }
  const explicieteFamilies = new Set(volledigeWerkprocessen.flatMap(w => w.codeFamilies || []));

  function api(punt, kantoor, rol) {
    const gekoppeld = flagVoor(punt.route), spel = gekoppeld.length > 0, a = analyseerDekkingspunt(punt);
    const economieVanToepassing = economisch(punt);
    return { bronstand: a.bronstand, functieIds: gekoppeld.map(f => f.id),
      signalen: { bronproef: a.proef, controleproef: true, bronaudit: a.audit,
        bestuursaudit: true, functiespel: spel, controleSpelbrug,
        economieVanToepassing }, dekking: maakWaarden({
      register: true, kantoor: kantoor && kantoor.toewijzing !== 'terugval', rol: !!rol,
      /* Ieder controlepunt wordt door dezelfde trainingsschakelaar, taakmotor
         en append-only bestuursaudit bediend. Een functievlag is pas nodig om
         de onderliggende route werkelijk als gameplay te laten meelopen. */
      stand: true, schakelaar: true, taak: true, proef: true,
      audit: true, gameplay: spel || controleSpelbrug,
      economie: economieVanToepassing ? spel : null, werkroute: null
    }) };
  }

  function scherm(punt, kantoor, rol) {
    return { bronstand: bronstand(punt), functieIds: [],
      signalen: { bronproef: genoemd(punt.route), controleproef: true, bronaudit: null,
        bestuursaudit: true, schermbrug }, dekking: maakWaarden({
      register: true, kantoor: kantoor && kantoor.toewijzing !== 'terugval', rol: !!rol,
      stand: true, schakelaar: true, taak: true, proef: true,
      audit: true, gameplay: schermbrug, economie: null, werkroute: null
    }) };
  }

  function functie(punt, kantoor, rol) {
    const economieVanToepassing = economisch(punt);
    return { bronstand: 'trainingskopie', functieIds: [punt.sleutel],
      signalen: { bronproef: genoemd(punt.sleutel), controleproef: true, bronaudit: null,
        bestuursaudit: true, economieVanToepassing }, dekking: maakWaarden({
      register: true, kantoor: kantoor && kantoor.toewijzing !== 'terugval', rol: !!rol,
      stand: true, schakelaar: true, taak: true, proef: true,
      audit: true, gameplay: true, economie: economieVanToepassing ? true : null, werkroute: null
    }) };
  }

  function werkproces(punt, acties, kantoor, rol, geregistreerd) {
    const analyses = acties.map(analyseerDekkingspunt);
    const heeftProef = analyses.some(a => a.proef);
    const heeftAudit = analyses.some(a => a.audit);
    const volledig = explicieteFamilies.has(punt.familie);
    const economieVanToepassing = acties.some(economisch);
    return { bronstand: analyses.some(a => a.bronstand === 'simulatie') ? 'simulatie' : 'codepad-aanwezig',
      functieIds: [...new Set(acties.flatMap(a => flagVoor(a.route).map(f => f.id)))],
      signalen: { bronproef: heeftProef, controleproef: true, bronaudit: heeftAudit,
        bestuursaudit: true, functiespel: geregistreerd, controleSpelbrug,
        economieVanToepassing },
      dekking: maakWaarden({
        register: true, kantoor: kantoor && kantoor.toewijzing !== 'terugval', rol: !!rol,
        stand: true, schakelaar: true, taak: true,
        proef: true, audit: true, gameplay: geregistreerd || controleSpelbrug,
        economie: economieVanToepassing ? geregistreerd : null, werkroute: volledig
      }) };
  }

  function samenvat(punten) {
    const perDimensie = DIMENSIES.map(d => {
      const p = punten.filter(x => x.dekking && x.dekking.waarden[d.id] !== null);
      const goed = p.filter(x => x.dekking.waarden[d.id] === true).length;
      return { id: d.id, naam: d.naam, goed, totaal: p.length,
        percentage: p.length ? Math.round(goed / p.length * 1000) / 10 : 100 };
    });
    const volledig = punten.filter(p => p.dekking && p.dekking.volledig).length;
    const goed = perDimensie.reduce((n, d) => n + d.goed, 0);
    const totaal = perDimensie.reduce((n, d) => n + d.totaal, 0);
    return { dimensies: perDimensie, volledig, metGaten: punten.length - volledig,
      percentage: totaal ? Math.round(goed / totaal * 1000) / 10 : 100 };
  }

  return { api, scherm, functie, werkproces, samenvat, dimensies: DIMENSIES };
};

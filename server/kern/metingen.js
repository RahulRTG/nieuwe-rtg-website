/* De dagmetingen: slaap, beweging en water, door het lid zelf ingevuld.

   Dit is de bron die RTG Life miste. Drie rijen stonden daar als "niet gemeten",
   en dat was eerlijk maar leeg. Nu kan een lid ze zelf vullen -- en de herkomst
   blijft zichtbaar: dit is wat u zei, niet wat een apparaat mat.

   WAAROM DIT NAAST DE DOELENMOTOR STAAT en er niet in. Een doelmeting hoort bij
   een doel: hij loopt naar een streefpunt en heeft alleen betekenis binnen die
   ene reis. Een dagmeting hoort bij een dag en gaat nergens heen. Ze in een bak
   duwen zou betekenen dat het stoppen van een doel je slaapgeschiedenis
   meeneemt, en dat een dag zonder doel niet te noteren valt.

   WAT ER NIET IN ZIT: voeding. Er is geen manier waarop een lid zijn voeding in
   een getal zet zonder dat dat getal verzonnen is, en een cijfer dat eruitziet
   als een meting is precies wat dit huis niet doet. RTG Life leidt daarvoor iets
   af uit wat er al gemeten wordt (hoe vaak er buiten de deur gegeten is), met
   herkomst 'afgeleid'. Dat is minder, maar het is waar.

   EEN DAG HEEFT EEN WAARDE PER HERKOMST, geen stapel. Twee keer zelf invullen
   overschrijft; anders telt een correctie als een tweede nacht en klopt het
   gemiddelde niet meer. Maar een apparaatmeting overschrijft NIET wat u zelf
   zei, en andersom ook niet: dat zijn twee verschillende beweringen over
   dezelfde nacht, en ze door elkaar laten lopen is precies wat de herkomst moet
   voorkomen. Het beeld kiest per dag welke het gebruikt, en zegt welke. */

const { magHerkomst, rangVan } = require('./herkomst');
const klok = require('../lib/klok');

const DAG = 86400000;
const VENSTER = 7;          // waarover we een gemiddelde tonen
const MAX_DAGEN = 400;      // per onderwerp per lid

/* De onderwerpen. Dit is de enige plek waar staat welke er zijn; het scherm
   rendert de invoervelden hieruit, dus een onderwerp erbij is een regel hier. */
const ONDERWERPEN = {
  slaap: { label: 'Slaap', eenheid: 'uur', stap: 0.5, max: 24,
    vraag: 'Hoeveel uur heeft u geslapen?', per: 'nacht' },
  beweging: { label: 'Beweging', eenheid: 'minuten', stap: 5, max: 1440,
    vraag: 'Hoeveel minuten heeft u bewogen?', per: 'dag' },
  water: { label: 'Water', eenheid: 'glazen', stap: 1, max: 40,
    vraag: 'Hoeveel glazen water heeft u gedronken?', per: 'dag' },
  /* Gewicht is het enige onderwerp waar alle drie de herkomsten samenkomen: u
     stapt zelf op de weegschaal, een slimme weegschaal meldt het, en een kliniek
     weegt u bij een consult. Precies daarom staat het erbij. */
  gewicht: { label: 'Gewicht', eenheid: 'kg', stap: 0.1, max: 500,
    vraag: 'Hoeveel weegt u?', per: 'dag' }
};

const dagVan = d => new Date(d).toISOString().slice(0, 10);

/* Het beeld over het venster. Het aantal dagen dat ECHT is ingevuld gaat mee
   naar buiten: een gemiddelde over een enkele nacht is geen weekbeeld, en een
   scherm dat dat verschil niet krijgt, kan het ook niet tonen. */
function beeldVan(rijen, onderwerp, nu = klok.datum()) {
  const vanaf = dagVan(new Date(nu.getTime() - (VENSTER - 1) * DAG));
  const vandaag = dagVan(nu);
  const inVenster = rijen.filter(r => r.op >= vanaf && r.op <= vandaag);
  if (!inVenster.length) return { gemeten: false, dagen: 0, vandaag: null, herkomsten: [], naast: [] };

  /* Per dag een waarde, gekozen op de rangorde uit kern/herkomst.js: een
     behandelaar gaat voor een apparaat, en een apparaat voor uw eigen schatting.
     Wie heeft gemeten gaat voor wie heeft geschat. Wat er niet gebeurt, is de ander weggooien: hij staat er nog en de
     herkomst blijft zichtbaar, zodat "het apparaat zegt 6 en ik zei 8" een
     verschil is dat je kunt zien in plaats van een getal dat is verdwenen. */
  const perDag = new Map();
  for (const r of inVenster) {
    const staand = perDag.get(r.op);
    if (!staand || rangVan(r.bron) > rangVan(staand.bron)) perDag.set(r.op, r);
  }
  const gekozen = [...perDag.values()];
  const som = gekozen.reduce((t, r) => t + r.waarde, 0);
  const vanVandaag = perDag.get(vandaag);
  /* Twee lijstjes, en het onderscheid is de reden dat ze er allebei zijn.
     'herkomsten' hoort bij het GETAL: waar komt dit gemiddelde vandaan. 'naast'
     is wat er nog meer staat maar niet is meegeteld -- uw eigen 8 uur naast de
     6,5 van het horloge. Ze samenvoegen zou het gemiddelde een herkomst geven
     die er niet in zit; het tweede weglaten zou uw invulling laten verdwijnen. */
  const gebruikt = new Set(gekozen.map(r => r.bron));
  return {
    gemeten: true,
    dagen: gekozen.length,
    gemiddelde: Math.round((som / gekozen.length) * 10) / 10,
    vandaag: vanVandaag ? vanVandaag.waarde : null,
    vandaagDoor: (vanVandaag && vanVandaag.door) || null,
    herkomsten: [...gebruikt].sort(),
    naast: [...new Set(inVenster.map(r => r.bron))].filter(b => !gebruikt.has(b)).sort(),
    eenheid: ONDERWERPEN[onderwerp].eenheid
  };
}

module.exports = ({ db, save }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/metingen', bezit: { dagmetingen: 'kaart' } });
  const bak = () => eigen.bak('dagmetingen');
  const vanLid = key => { const b = bak(); if (!b[key]) b[key] = {}; return b[key]; };
  const rijenVan = (key, onderwerp) => { const l = vanLid(key); if (!l[onderwerp]) l[onderwerp] = []; return l[onderwerp]; };

  function metingenVan(key, nu = klok.datum()) {
    const uit = {};
    for (const naam of Object.keys(ONDERWERPEN)) uit[naam] = beeldVan(rijenVan(key, naam), naam, nu);
    return { ok: true, onderwerpen: ONDERWERPEN, beeld: uit, vandaag: dagVan(nu) };
  }

  /* De schrijver, gedeeld door de twee deuren: het lid dat zelf invult en het
     gekoppelde apparaat. De herkomst komt van de DEUR en nooit uit de body --
     anders kan wie zelf invult zijn eigen schatting als apparaatmeting boeken,
     en dan is het hele onderscheid weg. */
  function metingSchrijf(key, body, bron, nu = klok.datum(), door = null) {
    const onderwerp = String(body.onderwerp || '');
    const def = ONDERWERPEN[onderwerp];
    if (!def) return { status: 404, error: 'Dit meet RTG niet.' };
    if (!magHerkomst(bron)) return { status: 400, error: 'Onbekende herkomst voor deze meting.' };

    const waarde = Number(body.waarde);
    if (!Number.isFinite(waarde) || waarde < 0) return { status: 400, error: 'Vul een getal in.' };
    if (waarde > def.max) return { status: 400, error: 'Dat is meer dan een ' + def.per + ' lang is.' };

    const op = /^\d{4}-\d{2}-\d{2}$/.test(String(body.op || '')) ? String(body.op) : dagVan(nu);
    if (op > dagVan(nu)) return { status: 400, error: 'Een ' + def.per + ' die nog moet komen, valt niet in te vullen.' };

    /* De sleutel is dag EN herkomst. Alleen op de dag zou betekenen dat een
       apparaat uw eigen invulling overschrijft (of andersom), en dat is geen
       correctie maar het wissen van een andere bewering. */
    const rijen = rijenVan(key, onderwerp);
    const bestaat = rijen.find(r => r.op === op && r.bron === bron);
    if (bestaat) { bestaat.waarde = Math.round(waarde * 10) / 10; bestaat.at = nu.toISOString(); bestaat.door = door; }
    else {
      rijen.push({ op, waarde: Math.round(waarde * 10) / 10, bron, door, at: nu.toISOString() });
      rijen.sort((a, b) => (a.op + a.bron).localeCompare(b.op + b.bron));
      if (rijen.length > MAX_DAGEN) rijen.splice(0, rijen.length - MAX_DAGEN);
    }
    save();
    return { ok: true, onderwerp, bron, beeld: beeldVan(rijen, onderwerp, nu) };
  }

  // de twee deuren; de herkomst zit in de deur en niet in het verzoek
  const metingZet = (key, body, nu = klok.datum()) => metingSchrijf(key, body, 'zelf', nu);
  const metingVanToestel = (key, body, nu = klok.datum()) => metingSchrijf(key, body, 'apparaat', nu);
  const metingVanBehandelaar = (key, body, door, nu = klok.datum()) => metingSchrijf(key, body, 'behandelaar', nu, door);

  /* Weghalen hoort erbij: wie een verkeerde nacht invult, moet hem kunnen
     wissen en niet alleen kunnen overschrijven met een leugen. */
  function metingWeg(key, body, nu = klok.datum()) {
    const onderwerp = String(body.onderwerp || '');
    if (!ONDERWERPEN[onderwerp]) return { status: 404, error: 'Dit meet RTG niet.' };
    const op = String(body.op || dagVan(nu));
    const rijen = rijenVan(key, onderwerp);
    const i = rijen.findIndex(r => r.op === op);
    if (i < 0) return { status: 404, error: 'Voor die dag staat er niets.' };
    rijen.splice(i, 1); save();
    return { ok: true, onderwerp, beeld: beeldVan(rijen, onderwerp, nu) };
  }

  /* De HISTORIE, voor wie verder terugkijkt dan het venster van beeldVan (dat
     geeft een gemiddelde over veertien dagen). Hij woont hier en niet bij de
     lezer, want deze laag bezit de metingen (LAT.md regel 4); het bron-filter is
     een filter en geen tweede opslag. */
  function metingenHistorie(key, opties = {}) {
    const bron = opties.bron ? String(opties.bron) : null;
    const uit = [];
    for (const onderwerp of Object.keys(ONDERWERPEN)) {
      for (const r of rijenVan(key, onderwerp)) {
        if (bron && r.bron !== bron) continue;
        uit.push({ onderwerp, op: r.op, waarde: r.waarde, bron: r.bron, door: r.door || null, at: r.at });
      }
    }
    return uit.sort((a, b) => (b.op || '').localeCompare(a.op || ''));
  }

  return { metingenVan, metingenHistorie, metingZet, metingVanToestel, metingVanBehandelaar, metingWeg };
};

module.exports.ONDERWERPEN = ONDERWERPEN;
module.exports.beeldVan = beeldVan;
module.exports.VENSTER = VENSTER;

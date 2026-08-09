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

   EEN DAG HEEFT EEN WAARDE, geen stapel. Twee keer invullen overschrijft; anders
   telt een correctie als een tweede nacht en klopt het gemiddelde niet meer. */

const { magHerkomst } = require('./herkomst');

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
    vraag: 'Hoeveel glazen water heeft u gedronken?', per: 'dag' }
};

const dagVan = d => new Date(d).toISOString().slice(0, 10);

/* Het beeld over het venster. Het aantal dagen dat ECHT is ingevuld gaat mee
   naar buiten: een gemiddelde over een enkele nacht is geen weekbeeld, en een
   scherm dat dat verschil niet krijgt, kan het ook niet tonen. */
function beeldVan(rijen, onderwerp, nu = new Date()) {
  const vanaf = dagVan(new Date(nu.getTime() - (VENSTER - 1) * DAG));
  const vandaag = dagVan(nu);
  const inVenster = rijen.filter(r => r.op >= vanaf && r.op <= vandaag);
  if (!inVenster.length) return { gemeten: false, dagen: 0, vandaag: null };
  const som = inVenster.reduce((t, r) => t + r.waarde, 0);
  const vanVandaag = inVenster.find(r => r.op === vandaag);
  return {
    gemeten: true,
    dagen: inVenster.length,
    gemiddelde: Math.round((som / inVenster.length) * 10) / 10,
    vandaag: vanVandaag ? vanVandaag.waarde : null,
    eenheid: ONDERWERPEN[onderwerp].eenheid
  };
}

module.exports = ({ db, save }) => {
  const bak = () => { if (!db.data.dagmetingen) db.data.dagmetingen = {}; return db.data.dagmetingen; };
  const vanLid = key => { const b = bak(); if (!b[key]) b[key] = {}; return b[key]; };
  const rijenVan = (key, onderwerp) => { const l = vanLid(key); if (!l[onderwerp]) l[onderwerp] = []; return l[onderwerp]; };

  function metingenVan(key, nu = new Date()) {
    const uit = {};
    for (const naam of Object.keys(ONDERWERPEN)) uit[naam] = beeldVan(rijenVan(key, naam), naam, nu);
    return { ok: true, onderwerpen: ONDERWERPEN, beeld: uit, vandaag: dagVan(nu) };
  }

  function metingZet(key, body, nu = new Date()) {
    const onderwerp = String(body.onderwerp || '');
    const def = ONDERWERPEN[onderwerp];
    if (!def) return { status: 404, error: 'Dit meet RTG niet.' };

    const bron = String(body.bron || 'zelf');
    if (!magHerkomst(bron)) return { status: 400, error: 'Onbekende herkomst voor deze meting.' };
    if (bron !== 'zelf') return { status: 400, error: 'Deze meting vult u zelf in.' };

    const waarde = Number(body.waarde);
    if (!Number.isFinite(waarde) || waarde < 0) return { status: 400, error: 'Vul een getal in.' };
    if (waarde > def.max) return { status: 400, error: 'Dat is meer dan een ' + def.per + ' lang is.' };

    const op = /^\d{4}-\d{2}-\d{2}$/.test(String(body.op || '')) ? String(body.op) : dagVan(nu);
    if (op > dagVan(nu)) return { status: 400, error: 'Een ' + def.per + ' die nog moet komen, valt niet in te vullen.' };

    const rijen = rijenVan(key, onderwerp);
    const bestaat = rijen.find(r => r.op === op);
    if (bestaat) { bestaat.waarde = Math.round(waarde * 10) / 10; bestaat.bron = bron; bestaat.at = nu.toISOString(); }
    else {
      rijen.push({ op, waarde: Math.round(waarde * 10) / 10, bron, at: nu.toISOString() });
      rijen.sort((a, b) => a.op.localeCompare(b.op));
      if (rijen.length > MAX_DAGEN) rijen.splice(0, rijen.length - MAX_DAGEN);
    }
    save();
    return { ok: true, onderwerp, beeld: beeldVan(rijen, onderwerp, nu) };
  }

  /* Weghalen hoort erbij: wie een verkeerde nacht invult, moet hem kunnen
     wissen en niet alleen kunnen overschrijven met een leugen. */
  function metingWeg(key, body, nu = new Date()) {
    const onderwerp = String(body.onderwerp || '');
    if (!ONDERWERPEN[onderwerp]) return { status: 404, error: 'Dit meet RTG niet.' };
    const op = String(body.op || dagVan(nu));
    const rijen = rijenVan(key, onderwerp);
    const i = rijen.findIndex(r => r.op === op);
    if (i < 0) return { status: 404, error: 'Voor die dag staat er niets.' };
    rijen.splice(i, 1); save();
    return { ok: true, onderwerp, beeld: beeldVan(rijen, onderwerp, nu) };
  }

  return { metingenVan, metingZet, metingWeg };
};

module.exports.ONDERWERPEN = ONDERWERPEN;
module.exports.beeldVan = beeldVan;
module.exports.VENSTER = VENSTER;

/* De doelenmotor. Een doel is hier vier dingen: waar je begon, waar je heen
   wilt, wanneer, en waarom. De rest wordt UITGEREKEND en niet opgeslagen.

   Dat laatste is de hele truc. Mijlpalen die als lijstje vastliggen, lopen uit
   de pas zodra het leven anders loopt -- en dan moet er een "programma
   aanpassen"-knop bij, die iemand vergeet in te drukken, waarna het lijstje
   liegt. Hier worden de mijlpalen elke keer opnieuw afgeleid uit waar je NU
   staat en hoeveel tijd er nog is. Een gemiste week is dan geen mislukking en
   ook geen ingreep: het pad dat overblijft is gewoon een ander pad.

   Wat deze motor NIET doet, en dat is met opzet: hij geeft geen trainings- of
   voedingsadvies. Hij rekent een pad uit tussen twee getallen die het lid zelf
   heeft gekozen. Wat je moet DOEN om er te komen is werk voor een mens of voor
   een laag die er nog niet is (zie docs/life.md, de drie niveaus).

   Elke meting draagt haar herkomst; welke er bestaan en welke er beschikbaar
   zijn staat in ./herkomst.js, en daar alleen. Een meting zonder herkomst is
   later niet meer te onderscheiden van een gemeten of afgeleide waarde, en dan
   is het te laat. */

const { magHerkomst, BESCHIKBAAR } = require('./herkomst');

const DAG = 86400000;
const MAX_DOELEN = 12;                // per lid; een doelenlijst die niet past, wordt genegeerd
const MAX_METINGEN = 400;

const dagVan = d => new Date(d).toISOString().slice(0, 10);
const dagenTussen = (a, b) => Math.round((new Date(b) - new Date(a)) / DAG);

/* De stand: waar staat het lid nu. Zonder meting is dat NIET nul maar
   "nog niets gemeten" -- het verschil tussen geen gegevens en slecht is bij
   een doel geen detail (LAT regel 3). */
function standVan(doel) {
  const m = (doel.metingen || []);
  if (!m.length) return { gemeten: false, waarde: doel.nulmeting.waarde, op: doel.nulmeting.op };
  const laatste = m[m.length - 1];
  return { gemeten: true, waarde: laatste.waarde, op: laatste.op, bron: laatste.bron };
}

/* Hoe ver ben je, tussen nul en streef. Levert null als beide gelijk zijn --
   dan is er geen afstand om een breuk van te maken. */
function aandeel(doel, waarde) {
  const spanne = doel.streef.waarde - doel.nulmeting.waarde;
  if (!spanne) return null;
  const deel = (waarde - doel.nulmeting.waarde) / spanne;
  return Math.max(0, Math.min(1, deel));
}

/* De mijlpalen: van waar je NU staat naar de streefdatum, in stappen van een
   week. Ze worden afgeleid en niet bewaard, dus ze kloppen altijd met de dag
   waarop je kijkt. Is de streefdatum voorbij, dan komt er geen lege lijst maar
   een eerlijk antwoord (zie planVan). */
function mijlpalenVoor(doel, nu = new Date()) {
  const vandaag = dagVan(nu);
  const stand = standVan(doel);
  const vanaf = stand.op > vandaag ? stand.op : vandaag;
  const resterend = dagenTussen(vanaf, doel.streef.op);
  if (resterend <= 0) return [];
  const weken = Math.max(1, Math.ceil(resterend / 7));
  const teGaan = doel.streef.waarde - stand.waarde;
  const uit = [];
  for (let w = 1; w <= weken; w++) {
    const deel = w / weken;
    uit.push({
      op: dagVan(new Date(new Date(vanaf).getTime() + Math.round(resterend * deel) * DAG)),
      waarde: Math.round((stand.waarde + teGaan * deel) * 100) / 100
    });
  }
  return uit;
}

/* Het plan in gewone taal. Geen streak, geen score, geen opgeheven vinger: wat
   er staat is wat er is, en als het niet meer haalbaar is zegt hij dat gewoon
   in plaats van een pad te verzinnen dat niemand loopt. */
function planVan(doel, nu = new Date()) {
  const vandaag = dagVan(nu);
  const stand = standVan(doel);
  const gehaald = doel.streef.waarde >= doel.nulmeting.waarde
    ? stand.waarde >= doel.streef.waarde
    : stand.waarde <= doel.streef.waarde;
  const mijlpalen = mijlpalenVoor(doel, nu);
  const dagenOver = dagenTussen(vandaag, doel.streef.op);

  let bericht;
  if (gehaald) bericht = 'Gehaald. ' + doel.titel + '.';
  else if (!stand.gemeten) bericht = 'Nog niets gemeten. Zet uw eerste meting erin, dan rekent RTG het pad uit.';
  else if (dagenOver < 0) bericht = 'De streefdatum is voorbij. U staat op ' + stand.waarde + ' ' + doel.eenheid +
    '; zet een nieuwe datum en het pad wordt opnieuw uitgerekend vanaf hier.';
  else if (!mijlpalen.length) bericht = 'De streefdatum is vandaag.';
  else bericht = 'Volgende stap: ' + mijlpalen[0].waarde + ' ' + doel.eenheid + ' rond ' + mijlpalen[0].op + '.';

  return {
    ...doel,
    stand,
    gehaald,
    dagenOver,
    aandeel: stand.gemeten ? aandeel(doel, stand.waarde) : null,
    mijlpalen: mijlpalen.slice(0, 16),
    bericht
  };
}

module.exports = ({ db, save, crypto, schoon }) => {
  const lijst = () => { if (!Array.isArray(db.data.doelen)) db.data.doelen = []; return db.data.doelen; };
  const mijne = key => lijst().filter(d => d.key === key && d.status !== 'weg');
  const getal = v => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };
  const datum = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null;

  function doelenVan(key, nu = new Date()) {
    return { ok: true, doelen: mijne(key).map(d => planVan(d, nu)), bronnen: BESCHIKBAAR };
  }

  function doelMaak(key, body, nu = new Date()) {
    if (mijne(key).length >= MAX_DOELEN) {
      return { status: 409, error: 'U heeft al ' + MAX_DOELEN + ' doelen lopen. Rond er een af of stop er een.' };
    }
    const titel = schoon(body.titel, 90);
    const reden = schoon(body.reden, 300);
    const eenheid = schoon(body.eenheid, 20);
    const van = getal(body.nulmeting), naar = getal(body.streef);
    const op = datum(body.streefOp);
    if (!titel) return { status: 400, error: 'Waar gaat dit doel over?' };
    /* De reden is verplicht, en dat is een keuze. Een doel zonder waarom is
       het eerste dat sneuvelt in een drukke week; het staat er dus voor uzelf,
       niet voor ons. */
    if (!reden) return { status: 400, error: 'Waarom wilt u dit? Dat helpt u meer dan het getal.' };
    if (van === null || naar === null) return { status: 400, error: 'Vul in waar u nu staat en waar u heen wilt.' };
    if (van === naar) return { status: 400, error: 'Uw beginpunt en uw doel zijn hetzelfde; dan valt er niets te lopen.' };
    if (!eenheid) return { status: 400, error: 'Waarin meet u dit? (km, kilo, uur, keer per week...)' };
    if (!op) return { status: 400, error: 'Wanneer wilt u er zijn?' };
    if (op <= dagVan(nu)) return { status: 400, error: 'Kies een streefdatum in de toekomst.' };

    const doel = {
      id: crypto.randomBytes(4).toString('hex'), key, titel, reden, eenheid,
      nulmeting: { waarde: van, op: dagVan(nu) },
      streef: { waarde: naar, op },
      metingen: [], status: 'loopt', gemaakt: new Date(nu).toISOString()
    };
    lijst().push(doel); save();
    return { ok: true, doel: planVan(doel, nu) };
  }

  function doelMeet(key, body, nu = new Date()) {
    const doel = mijne(key).find(d => d.id === String(body.id || ''));
    if (!doel) return { status: 404, error: 'Dit doel staat niet op uw naam.' };
    const waarde = getal(body.waarde);
    if (waarde === null) return { status: 400, error: 'Wat is de meting?' };
    const bron = String(body.bron || 'zelf');
    if (!magHerkomst(bron)) return { status: 400, error: 'Onbekende herkomst voor deze meting.' };
    const op = datum(body.op) || dagVan(nu);
    if (op > dagVan(nu)) return { status: 400, error: 'Een meting van morgen bestaat nog niet.' };
    doel.metingen.push({ waarde, op, bron, at: new Date(nu).toISOString() });
    doel.metingen.sort((a, b) => a.op.localeCompare(b.op));
    if (doel.metingen.length > MAX_METINGEN) doel.metingen = doel.metingen.slice(-MAX_METINGEN);
    save();
    return { ok: true, doel: planVan(doel, nu) };
  }

  /* De streefdatum verzetten. Dit is de nette uitweg als het leven anders liep,
     en er hoort geen oordeel bij: het pad wordt opnieuw uitgerekend vanaf waar
     u nu staat, niet vanaf het begin. */
  function doelVerzet(key, body, nu = new Date()) {
    const doel = mijne(key).find(d => d.id === String(body.id || ''));
    if (!doel) return { status: 404, error: 'Dit doel staat niet op uw naam.' };
    const op = datum(body.streefOp);
    if (!op) return { status: 400, error: 'Naar welke datum?' };
    if (op <= dagVan(nu)) return { status: 400, error: 'Kies een datum in de toekomst.' };
    doel.streef.op = op; save();
    return { ok: true, doel: planVan(doel, nu) };
  }

  function doelStop(key, body) {
    const doel = mijne(key).find(d => d.id === String(body.id || ''));
    if (!doel) return { status: 404, error: 'Dit doel staat niet op uw naam.' };
    doel.status = 'weg'; save();
    return { ok: true, gestopt: doel.titel };
  }

  return { doelenVan, doelMaak, doelMeet, doelVerzet, doelStop };
};

module.exports.planVan = planVan;
module.exports.mijlpalenVoor = mijlpalenVoor;
module.exports.standVan = standVan;

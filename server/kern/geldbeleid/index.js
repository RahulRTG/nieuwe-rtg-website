/* Kern-module "geldbeleid": het beleid van het LID over zijn eigen geld.

   Geldregie (kern/geldregie.js) is wat RTG vanuit de boardroom bepaalt; dit is
   de tegenhanger op lidniveau (GELD.md par. 3-5): regels zoals een bedrijf ze
   stelt, potten (oormerken over het eigen tegoed) en een append-only actielog.
   Rahul handelt binnen deze regels, nooit naar eigen inzicht: wat evalueer()
   niet teruggeeft, gebeurt ook niet.

   De harde grens staat in code, niet in tekst: 'automatisch' bestaat alleen
   voor 'reserveer-maandelijks', want dat is een oormerk BINNEN het eigen
   tegoed. Al het andere raakt (mogelijk) een derde, en geld verlaat het huis
   nooit autonoom -- dat blijft maximaal 'klaarzetten' (zie ./regels.js).

   Potten zijn oormerken, geen tweede boekhouding (GELD.md par. 1 en 7): er
   beweegt geen geld, dus ook geen saldocontrole tegen wallet of bank -- twee
   totalen zouden uiteenlopen (LAT.md regel 4). Bedragen zijn rauwe hele
   centen; alleen het scherm maakt er een keer euro's van.

   Opslag: db.data.geldbeleid.perLid[codenaam]. De sleutel is de CODENAAM die
   de aanroeper meegeeft; echte namen wonen in de kluis en komen hier nooit.
   Lezers (regels, potten, log, evalueer) geven kale lijsten zodat de route ze
   samenstelt; schrijvers geven { status, ... } zoals het huispatroon. De
   optionele klok bestaat alleen zodat de maandgrens van de automatische
   reservering toetsbaar is zonder een echte maandwisseling (LAT.md regel 2).

   Een map en geen bestand, omdat de delen samen boven de modulegrens van
   check.js kwamen; de grenzen liggen op de onderwerpen: ./actielog.js,
   ./potten.js, ./regels.js, ./evalueer.js. */

const MAX_CENTEN = 100000000; // 1 miljoen euro: grens op het doel (LAT.md regel 7), tegen tikfouten en overloop

function maakGeldbeleid({ db, save, klok }) {
  const nu = typeof klok === 'function' ? klok : () => new Date();
  function d() {
    if (!db.data.geldbeleid || typeof db.data.geldbeleid !== 'object') db.data.geldbeleid = { perLid: {} };
    const g = db.data.geldbeleid;
    if (!g.perLid || typeof g.perLid !== 'object') g.perLid = {};
    return g;
  }
  const naamVan = c => String(c == null ? '' : c).trim();
  // lezen zonder aan te maken: anders groeit perLid met een rij per lid dat een keer keek (zie kern/levensgraaf)
  function kijk(codenaam) { const c = naamVan(codenaam); return (c && d().perLid[c]) || null; }
  function pak(codenaam) {
    const c = naamVan(codenaam);
    if (!c) return null;
    const per = d().perLid;
    const r = per[c] || (per[c] = { regels: [], potten: [], log: [] });
    for (const v of ['regels', 'potten', 'log']) if (!Array.isArray(r[v])) r[v] = [];
    return r;
  }
  const maakId = v => v + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  /* Alles wat geen eindig heel getal binnen de grens is, is geen bedrag.
     Ontbreken is uitdrukkelijk GEEN nul: Number(null) is 0, en een vergeten
     drempel die stil 0 wordt is een regel die stil iets anders doet dan het
     lid vroeg (LAT.md regel 5). Wie 0 wil, stuurt 0. */
  const bedragVan = x => {
    if (x == null || x === '' || (typeof x !== 'number' && typeof x !== 'string')) return null;
    const n = Math.round(Number(x));
    return Number.isFinite(n) && n >= 0 && n <= MAX_CENTEN ? n : null;
  };
  const zichtRegel = r => ({ id: r.id, soort: r.soort, drempelCenten: r.drempelCenten, niveau: r.niveau, aan: !!r.aan, potId: r.potId || null, laatst: r.laatst || null });
  const zichtPot = p => ({ id: p.id, naam: p.naam, doelCenten: p.doelCenten, standCenten: p.standCenten });

  const ctx = { save, nu, kijk, pak, maakId, bedragVan, zichtRegel, zichtPot, MAX_CENTEN };
  const { logSchrijf, log } = require('./actielog')(ctx);
  ctx.logSchrijf = logSchrijf;
  const { potten, potZet, potReserveer, potWeg } = require('./potten')(ctx);
  const { regels, regelZet, regelWeg } = require('./regels')(ctx);
  ctx.potReserveer = potReserveer;
  const evalueer = require('./evalueer')(ctx);
  const grens = require('./grens')(ctx);

  /* De eigen geldgrens (./grens.js) is de enige regelsoort die WEIGERT in
     plaats van waarschuwt; hij wordt afgedwongen in de waardepoort. Zie de kop
     van dat bestand voor waarom de bedenktijd opt-in is. */
  return { geldbeleid: { regels, regelZet, regelWeg, potten, potZet, potReserveer, potWeg, log, logSchrijf, evalueer,
    grenzen: grens.grenzen, grensZet: grens.grensZet, grensWeg: grens.grensWeg, grensVoor: grens.grensVoor } };
}

// beide aanroepvormen uit de kernlagen werken: require(..)({db,save}) en require(..).maakGeldbeleid({db,save})
module.exports = maakGeldbeleid;
module.exports.maakGeldbeleid = maakGeldbeleid;

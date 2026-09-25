/* ============================================================================
   DE ZOEKENDE TEGENSTANDER -- de motor (BEWIJSLUS.md par. 3).

   Elke andere proef in dit huis voert een VASTE reeks uit: sabotage overtreedt
   elke wet een keer met opzet, de invoerproef stuurt vaste rommel, de geldpomp
   van Magnaat speelt vijf perverse volgordes die iemand heeft bedacht. Geen van
   allen ZOEKT. Deze motor wel: hij stelt reeksen handelingen samen over vier
   assen, voert ze uit tegen een echte kern/pay, en als een wet breekt maakt hij
   het tegenvoorbeeld zo klein mogelijk.

     waarden           gewone bedragen, maar ook 0, negatief, een halve cent,
                       net boven het maximum en tekst
     volgorde          welke handeling na welke, en herhalingen van eerdere
     gelijktijdigheid  een stap kan twee of drie handelingen TEGELIJK starten
                       (Promise.all), zodat ze elkaar op een await tegenkomen
     storing           de simulatiebank kiest uit de idem-sleutel of een
                       oplading slaagt, geweigerd wordt, blijft hangen of wordt
                       teruggeboekt. Staat die bank niet aan, dan is er in deze
                       opstelling helemaal geen geldbron -- en dan zegt de zoeker
                       welke soorten handelingen daardoor nooit slaagden.

   DE MOTOR OORDEELT NOOIT ZELF. Wat een schending is, komt uit regels die er
   al staan, elk met de plek waar ze beloofd worden (oordeel() hieronder). Een
   regel bedenken omdat hij makkelijk te toetsen is, zou de uitslag verzinnen.

   GEZOCHT EN NIETS GEVONDEN IS GEEN BEWEZEN. De uitslag zegt dan hoeveel
   reeksen, welke assen en welk zaad -- dat is wat er werkelijk is gedaan.

   Geen taalmodel: generatoren, een geseede teller en krimpen zijn na te spelen,
   een model niet. Wie een uitslag wil nalopen, draait hetzelfde zaad opnieuw.
   ========================================================================== */
'use strict';

const { maakTeller } = require('./rommel');

const ONBEKEND = 'Onbekende Uil 99';     // een codenaam die de kluis niet kent

/* ------------------------------------------------------------------ de wereld
   Een verse kern/pay per reeks, op de opstelling van de Magnaat-geldpomp
   (server/kern/spellen/magnaat/rtg-keten.js): echte poort, echt grootboek, echte
   idempotentie, en stubs voor wat er niet toe doet. Een tweede opstelling met
   eigen stubs zou uit de eerste lopen. `sabotage` is voor de zelfijking. */
/* `wortel` wijst naar een andere checkout (de herhaalmatrix, ./herhaalpakket.js):
   dan komt het systeem onder toets daarvandaan en blijft de proef van hier. */
function maakWereld({ betaal, sabotage, wortel } = {}) {
  const uit = (p) => require(wortel ? require('path').join(wortel, p) : '../../' + p);
  const b = betaal || uit('server/betaal');
  const keten = uit('server/kern/spellen/magnaat/rtg-keten')({ betaal: b });
  /* Elk seintje naar een lid, zodat de ijkpunten (./ijkpunten.js, E5) kunnen
     zien of wie iets ontving daarvan hoorde. */
  const seintjes = [];
  const { db, pay } = keten.opstelling({ sseToCustomer: (key) => seintjes.push(key) });
  if (sabotage) sabotage(pay, db);
  return { db, pay, spelers: keten.SPELERS, seintjes };
}

function storingsas(betaal) {
  const b = betaal || require('../../server/betaal');
  return b.SIMULATIE_AAN
    ? { aan: true }
    : { aan: false, reden: 'de simulatiebank staat niet aan (' + b.simulatieBelet() + '); dan heeft deze opstelling ' +
        'geen geldbron, faalt elke oplading en wordt wat saldo nodig heeft niet beproefd' };
}

/* ------------------------------------------------------------------ genereren */
const BEDRAGEN_GEWOON = [1, 50, 999, 2500, 10000, 40000];
const OPLADEN_GEWOON = [1000, 5000, 20000, 100000];        // opladen kan pas vanaf een euro
const BEDRAGEN_RAND = [0, -100, 100.5, 500001, 'tien'];

function genereer(rng, lengte, spelers) {
  const kies = (lijst) => lijst[Math.floor(rng() * lijst.length)];
  const wie = () => (rng() < 0.08 ? ONBEKEND : kies(spelers));
  const bedrag = (gewoon) => (rng() < 0.15 ? kies(BEDRAGEN_RAND) : kies(gewoon || BEDRAGEN_GEWOON));
  const ander = (van) => (rng() < 0.1 ? van : kies(spelers.filter(x => x !== van)));   // soms naar jezelf
  const gebruikt = [];
  let n = 0;
  const idem = () => {
    const r = rng();
    if (r < 0.15 && gebruikt.length) return kies(gebruikt);   // een sleutel opnieuw, misschien met ander verzoek
    if (r < 0.25) return undefined;                           // geen sleutel
    const s = 'i' + (n++);
    gebruikt.push(s);
    return s;
  };
  const alle = [];
  const stappen = [];
  for (let s = 0; s < lengte; s++) {
    const breed = rng() < 0.7 ? 1 : (rng() < 0.66 ? 2 : 3);
    const ops = [];
    for (let k = 0; k < breed; k++) {
      const r = rng();
      let op;
      /* DE DUBBELE KLIK: in een gelijktijdige stap is de volgende handeling vaak
         dezelfde als de vorige, met een EIGEN sleutel. Dat is wat een mens doet
         die twee keer tikt, en precies waar een race tussen een controle en een
         await zit. Met dezelfde sleutel is het de idem-laag die beproefd wordt. */
      if (k > 0 && rng() < 0.45) op = Object.assign({}, ops[k - 1], { idem: rng() < 0.5 ? idem() : ops[k - 1].idem });
      else if (r < 0.12 && alle.length) op = Object.assign({}, kies(alle));            // herhaal een eerdere, met dezelfde sleutel
      else if (r < 0.32) op = { soort: 'laad', wie: wie(), centen: bedrag(OPLADEN_GEWOON), idem: idem() };
      else if (r < 0.62) { const van = kies(spelers); op = { soort: 'stuur', van, aan: rng() < 0.08 ? ONBEKEND : ander(van), centen: bedrag(), idem: idem() }; }
      else if (r < 0.80) { const van = kies(spelers); op = { soort: 'verzoek', van, aan: rng() < 0.08 ? ONBEKEND : ander(van), centen: bedrag(), idem: idem() }; }
      /* `wie: null` is de ontvanger van het verzoek zelf; soms betaalt een ander. */
      else op = { soort: 'betaal', wie: rng() < 0.8 ? null : kies(spelers), verzoek: Math.floor(rng() * 4), idem: idem() };
      alle.push(op);
      ops.push(op);
    }
    stappen.push({ ops });
  }
  return stappen;
}

/* ------------------------------------------------------------------ uitvoeren */
async function doe(w, op, spoor) {
  const { pay } = w;
  if (op.soort === 'laad') return pay.laadOp({ codenaam: op.wie, centen: op.centen, idem: op.idem });
  if (op.soort === 'stuur') {
    const r = await pay.stuur({ van: op.van, aanCodenaam: op.aan, centen: op.centen, idem: op.idem, oms: 'zoeker' });
    if (r && r.ok && r.boeking) spoor.stuurBoekingen.add(r.boeking);
    return r;
  }
  if (op.soort === 'verzoek') {
    const r = await pay.verzoekMaak({ van: op.van, aan: [op.aan], totaalCenten: op.centen, idem: op.idem });
    if (r && r.ok && Array.isArray(r.verzoeken)) for (const v of r.verzoeken) spoor.verzoeken.push({ id: v.id, aan: v.aan });
    return r;
  }
  if (op.soort === 'betaal') {
    if (!spoor.verzoeken.length) return { overgeslagen: 'er is nog geen verzoek' };
    const v = spoor.verzoeken[op.verzoek % spoor.verzoeken.length];
    return pay.verzoekBetaal({ codenaam: op.wie || v.aan, verzoekId: v.id, idem: op.idem });
  }
  return { overgeslagen: 'onbekende soort ' + op.soort };
}

/* ------------------------------------------------------------------ oordelen
   Drie regels, en alle drie staan ze al in de code. Geen daarvan is voor deze
   motor verzonnen; wie er een toevoegt, noemt waar hij beloofd wordt. */
const WETTEN = {
  geld: { wet: 'geld-conservatie', bron: 'server/kern/pay/kijken.js sluitcontrole() en WETTEN.json' },
  herhaling: { wet: 'een herhaling boekt niets', bron: 'MUTATIECONTRACT.md en de idem-laag van kern/pay (metIdem)' },
  verzoek: { wet: 'een verzoek wordt ten hoogste een keer betaald',
    bron: 'server/kern/pay/verzoeken.js verzoekBetaal() ("Dit verzoek is al afgehandeld")' }
};

function oordeel(w) {
  const sluit = w.pay.sluitcontrole();
  if (!sluit.klopt) {
    return { ...WETTEN.geld,
      wat: 'de som van alle saldi is ' + sluit.som + (sluit.rood.length ? ' en rood staat: ' + sluit.rood.join(', ') : '') };
  }
  boekingen(w);
  return null;
}

/* Het grootboek. Ontbreekt de lijst terwijl er al saldi staan, dan woont het
   grootboek ergens anders en beoordeelt deze motor niets -- dat is een storing
   van de meter en geen groen. Zonder saldi is er gewoon nog niets geboekt. */
function boekingen(w) {
  const rijen = w.db.data.payBoekingen;
  if (Array.isArray(rijen)) return rijen;
  if (Object.keys(w.db.data.paySaldi || {}).length)
    throw new Error('er staan saldi maar db.data.payBoekingen is geen lijst; dan is er niets te beoordelen en is dit geen groen');
  return [];
}

function oordeelMetSpoor(w, spoor) {
  const eerste = oordeel(w);
  if (eerste) return eerste;
  const rijen = boekingen(w);
  /* Elke overdracht tussen leden hoort bij een geslaagd antwoord met een eigen
     boeking-id. Een regel meer dan er ids zijn, is een boeking die niemand heeft
     gekregen -- een tweede handeling achter een herhaling (MUTATIECONTRACT.md:
     een herhaling doet geen tweede handeling). */
  const p2p = rijen.filter(r => r.soort === 'p2p' && String(r.van).startsWith('lid:') && String(r.naar).startsWith('lid:'));
  if (p2p.length !== spoor.stuurBoekingen.size) {
    return { ...WETTEN.herhaling,
      wat: p2p.length + ' overdrachten in het grootboek tegenover ' + spoor.stuurBoekingen.size + ' geslaagde antwoorden' };
  }
  /* Een verzoek wordt ten hoogste een keer betaald: verzoekBetaal() weigert met
     "Dit verzoek is al afgehandeld" (server/kern/pay/verzoeken.js). */
  const perVerzoek = new Map();
  for (const r of rijen) if (r.soort === 'klompje' && r.ref) perVerzoek.set(r.ref, (perVerzoek.get(r.ref) || 0) + 1);
  for (const [ref, n] of perVerzoek) {
    if (n > 1) return { ...WETTEN.verzoek,
      wat: 'verzoek ' + ref + ' is ' + n + ' keer betaald' };
  }
  return null;
}

async function voerUit(stappen, maak, tel) {
  const w = maak();
  const spoor = { stuurBoekingen: new Set(), verzoeken: [] };
  for (let s = 0; s < stappen.length; s++) {
    const antwoorden = await Promise.all(stappen[s].ops.map(op => doe(w, op, spoor)));
    if (tel) stappen[s].ops.forEach((op, i) => {
      const t = tel[op.soort] || (tel[op.soort] = { geslaagd: 0, geweigerd: 0 });
      t[antwoorden[i] && antwoorden[i].ok ? 'geslaagd' : 'geweigerd']++;
    });
    const fout = oordeelMetSpoor(w, spoor);
    if (fout) return { schending: fout, stap: s };
  }
  return { schending: null };
}

/* ------------------------------------------------------------------ krimpen
   Eerst hele stappen weg, dan losse handelingen binnen een stap. Een kandidaat
   telt alleen als hij DEZELFDE wet breekt -- anders ruil je het ene
   tegenvoorbeeld stilletjes in voor een ander. */
async function krimp(stappen, wet, maak) {
  const breekt = async (c) => { const u = await voerUit(c, maak); return u.schending && u.schending.wet === wet ? u : null; };
  let huidig = stappen.map(s => ({ ops: s.ops.slice() }));
  let pogingen = 0;
  for (let veranderd = true; veranderd;) {
    veranderd = false;
    for (let i = huidig.length - 1; i >= 0; i--) {
      const kandidaat = huidig.slice(0, i).concat(huidig.slice(i + 1));
      pogingen++;
      if (kandidaat.length && await breekt(kandidaat)) { huidig = kandidaat; veranderd = true; }
    }
    for (let i = 0; i < huidig.length; i++) {
      for (let k = huidig[i].ops.length - 1; k >= 0 && huidig[i].ops.length > 1; k--) {
        const kandidaat = huidig.map((s, j) => (j === i ? { ops: s.ops.filter((_, x) => x !== k) } : s));
        pogingen++;
        if (await breekt(kandidaat)) { huidig = kandidaat; veranderd = true; }
      }
    }
  }
  const eind = await voerUit(huidig, maak);
  return { stappen: huidig, schending: eind.schending, pogingen };
}

/* ------------------------------------------------------------------ zoeken */
async function zoek({ zaad = 1, reeksen = 100, lengte = 12, maak, spelers }) {
  const rng = maakTeller(zaad);
  /* HOE VAAK ELKE SOORT HANDELING WERKELIJK SLAAGDE. Zonder dit is "niets
     gevonden" ook de uitslag van reeksen die alleen maar geweigerd worden --
     de fout die de Magnaat-geldpomp al een keer maakte. Een soort die nooit
     slaagt, is niet beproefd en staat dan in `nietBeproefd`. */
  const tel = {};
  const nietBeproefd = () => ['laad', 'stuur', 'verzoek', 'betaal'].filter(k => !(tel[k] && tel[k].geslaagd));
  for (let r = 0; r < reeksen; r++) {
    const stappen = genereer(rng, lengte, spelers);
    const u = await voerUit(stappen, maak, tel);
    if (u.schending) {
      const klein = await krimp(stappen.slice(0, u.stap + 1), u.schending.wet, maak);
      return { gevonden: true, zaad, reeks: r, origineel: u.stap + 1, tel, ...klein };
    }
  }
  return { gevonden: false, zaad, reeksen, lengte, tel, nietBeproefd: nietBeproefd() };
}

module.exports = { WETTEN, maakWereld, storingsas, genereer, doe, oordeel, oordeelMetSpoor, boekingen, voerUit, krimp, zoek, ONBEKEND };

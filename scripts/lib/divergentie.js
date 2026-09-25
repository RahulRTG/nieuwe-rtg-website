/* ============================================================================
   DE EERSTE DIVERGENTIE -- bouwsteen 2 van BEWIJSLUS.md (par. 4), voor RTG Pay.

   De zoeker (./tegenvoorbeeld.js) zegt WELKE wet brak. Dit zegt WAAR het voor
   het eerst onwaar werd. Een handeling wordt gevolgd langs negen ijkpunten:

     E0 intentie  E1 bevoegdheid  E2 ingangstoestand  E3 effectbesluit
     E4 opslag    E5 extern effect  E6 gebeurtenis    E7 projectie
     E8 uitkomst voor de gebruiker

   Per ijkpunt: verwacht, waargenomen, bron -- en een stand: `klopt`, `wijkt`
   of `niet-waargenomen` (met de reden). De divergentie is het eerste ijkpunt dat
   wijkt, met het laatste waargenomen ijkpunt ervoor. Dat is een FEIT over twee
   waarnemingen, geen oordeel en geen graad.

   DRIE KEUZES, en alle drie komen ze uit BEWIJSLUS.md:

   1. NAAST DE ENVELOP, NIET ERIN (besluit par. 13.1). kern/envelop.js is
      gesloten op acht velden en zegt met opzet nooit WAT. Dit is een eigen spoor
      in de testwereld; er verandert geen letter aan de envelop.

   2. ELK IJKPUNT IS EEN VERBOD, GEEN MODEL. "Er is betaald zonder dat het
      verzoek aan jou stond" is te zien zonder na te bouwen wanneer RTG Pay wel
      of niet hoort te betalen. Een tweede model van RTG Pay zou zelf de fout
      bevatten die het moet vinden. Elk verbod noemt waar het beloofd wordt.

   3. METADATA EN RELATIES, GEEN INHOUD. Verwacht en waargenomen zijn tellingen,
      standen en ja/nee -- geen bedrag naast een codenaam, geen omschrijving.
      Anders is het spoor een tweede kopie van de data die het moet bewaken.

   WAT NIET WAARGENOMEN WORDT, STAAT ER MET DE REDEN, en telt nooit als `klopt`.
   E6 is voor RTG Pay altijd `niet-waargenomen`: kern/pay zet geen gebeurtenis in
   een envelop (gemeten 25 september 2026: nul verwijzingen naar kern/envelop.js
   in server/kern/pay/ en server/routes/pay*.js). Een divergentie die over zo'n
   gat heen springt, zegt dat erbij (`overgeslagen`).

   Alleen `stuur` en `betaal` (geld tussen leden). Voor `laad` en `verzoek` geeft
   dit `null` met de reden: die zijn niet ingericht, en dat is iets anders dan
   dat ze kloppen.
   ========================================================================== */
'use strict';

const tv = require('./tegenvoorbeeld');

const PUNTEN = ['E0 intentie', 'E1 bevoegdheid', 'E2 ingangstoestand', 'E3 effectbesluit',
  'E4 opslag', 'E5 extern effect', 'E6 gebeurtenis', 'E7 projectie', 'E8 uitkomst'];
const INGERICHT = ['stuur', 'betaal'];

const GEEN_GEBEURTENIS = 'kern/pay zet geen gebeurtenis in een envelop: nul verwijzingen naar kern/envelop.js ' +
  'in server/kern/pay/ en server/routes/pay*.js (gemeten 25 september 2026)';

/* ------------------------------------------------------------ waarnemen */
function momentopname(w) {
  const rijen = tv.boekingen(w);
  return {
    verzoeken: new Map((w.db.data.payVerzoeken || []).map(v => [v.id, { status: v.status, van: v.van, aan: v.aan }])),
    perRef: rijen.reduce((m, r) => (r.soort === 'klompje' && r.ref ? m.set(r.ref, (m.get(r.ref) || 0) + 1) : m), new Map()),
    ids: rijen.reduce((m, r) => m.set(r.id, (m.get(r.id) || 0) + 1), new Map()),
    p2p: rijen.filter(r => r.soort === 'p2p' && String(r.van).startsWith('lid:') && String(r.naar).startsWith('lid:')).length,
    sluit: w.pay.sluitcontrole().klopt,
    seintjes: w.seintjes.length
  };
}

const punt = (i, wijkt, verwacht, waargenomen, bron) =>
  ({ punt: PUNTEN[i], stand: wijkt ? 'wijkt' : 'klopt', verwacht, waargenomen, bron });
const nietGezien = (i, reden) => ({ punt: PUNTEN[i], stand: 'niet-waargenomen', reden });
const ok = (a) => !!(a && a.ok);
const sleutel = (codenaam) => 'proef:' + codenaam;   // zoals de rtg-keten hem maakt

/* De idem-sleutel zoals kern/pay hem ziet: zonder sleutel is elke poging een
   eigen handeling (index i maakt hem uniek). */
function sleutelVan(op, v, i) {
  return op.idem ? 'klompje:' + (op.wie || v.aan) + ':' + op.idem : 'los:' + i;
}

/* De seintjes die in deze stap naar een lid gingen. */
function seintjesAan(w, voor, codenaam) {
  return w.seintjes.slice(voor.seintjes).filter(k => k === sleutel(codenaam)).length;
}

function rijBetaal(w, ctx, op, a) {
  const { voor, na, stap, antwoorden, spoor } = ctx;
  const v = spoor.verzoeken[op.verzoek % Math.max(1, spoor.verzoeken.length)];
  if (!v) return null;   // er was nog geen verzoek; doe() sloeg hem over
  const wie = op.wie || v.aan;
  const in0 = voor.verzoeken.get(v.id);
  const uit = na.verzoeken.get(v.id);
  const vrager = in0 ? in0.van : null;   // het spoor van de zoeker kent alleen id en aan
  const bronV = 'server/kern/pay/verzoeken.js verzoekBetaal()';
  /* EFFECTEN, geen ok-antwoorden: een herhaling met een sleutel die al slaagde
     krijgt het bewaarde antwoord terug zonder iets te doen (metIdem), en twee
     gelijktijdige met DEZELFDE sleutel zijn samen een handeling. */
  const effecten = new Set(stap.ops.map((o, i) => (o.soort === 'betaal' && ok(antwoorden[i]) &&
    /* op id en niet op object: een herhaalde verzoekMaak met dezelfde sleutel
       geeft hetzelfde verzoek terug, en dan staat het twee keer in het spoor */
    spoor.verzoeken[o.verzoek % spoor.verzoeken.length].id === v.id ? sleutelVan(o, v, i) : null))
    .filter(k => k && !ctx.eerder.has(k)));
  const okHier = effecten.size;
  const ditEffect = ok(a) && !ctx.eerder.has(sleutelVan(op, v, stap.ops.indexOf(op)));
  const rijenVoor = voor.perRef.get(v.id) || 0;
  const nieuw = (na.perRef.get(v.id) || 0) - rijenVoor;
  const open = !!in0 && in0.status === 'open';
  const ov = ok(a) ? w.pay.overzicht(wie) : null;
  return [
    punt(0, !in0, 'het verzoek bestaat bij de ingang', in0 ? 'bestaat' : 'bestaat niet', 'het spoor van de zoeker'),
    punt(1, ok(a) && wie !== v.aan, 'geen betaling door iemand anders dan aan wie het verzoek staat',
      ok(a) ? (wie === v.aan ? 'betaald door de ontvanger' : 'betaald door een ander') : 'geweigerd', bronV + ' (x.aan === codenaam)'),
    punt(2, open === (rijenVoor > 0), 'stand open als en alleen als er nog geen klompje-regel is',
      'stand ' + (in0 ? in0.status : '-') + ', ' + rijenVoor + ' regel(s) in het grootboek', bronV + ' en het grootboek'),
    punt(3, okHier > (open ? 1 : 0), 'hooguit ' + (open ? 1 : 0) + ' toegestaan besluit op dit verzoek in deze stap',
      okHier + ' toegestaan', bronV + ' ("Dit verzoek is al afgehandeld")'),
    punt(4, nieuw !== okHier || (okHier > 0 && (!uit || uit.status !== 'betaald')),
      'nieuwe klompje-regels = toegestane besluiten, en de stand betaald',
      nieuw + ' nieuwe regel(s), stand ' + (uit ? uit.status : '-'), 'het grootboek (payBoekingen, ref = verzoek)'),
    punt(5, ditEffect && seintjesAan(w, voor, vrager) < 1, 'wie om het geld vroeg, krijgt een seintje bij een nieuwe betaling',
      seintjesAan(w, voor, vrager) + ' seintje(s) aan de vrager', bronV + ' seintje(v.van)'),
    nietGezien(6, GEEN_GEBEURTENIS),
    punt(7, !!ov && ov.aanMij.some(x => x.id === v.id), 'een betaald verzoek staat niet meer open in het overzicht',
      ov ? (ov.aanMij.some(x => x.id === v.id) ? 'staat nog open' : 'staat niet meer open') : 'niet van toepassing (geweigerd)',
      'server/kern/pay/verzoeken.js overzicht() aanMij'),
    punt(8, !ok(a) && !(a && (a.error || a.overgeslagen)), 'een weigering zegt waarom',
      ok(a) ? 'geslaagd' : (a && a.error ? 'weigering met reden' : 'weigering zonder reden'), 'KETENVORM.json, gedeelde belofte')
  ];
}

function rijStuur(w, ctx, op, a) {
  const { voor, na, stap, antwoorden } = ctx;
  const bronS = 'server/kern/pay/verzoeken.js stuur()';
  const bestaat = w.spelers.includes(op.aan);
  const nieuwIds = new Set(stap.ops.map((o, i) => (o.soort === 'stuur' && ok(antwoorden[i]) ? antwoorden[i].boeking : null))
    .filter(b => b && !voor.ids.has(b)));
  const ov = ok(a) ? w.pay.overzicht(op.van) : null;
  return [
    punt(0, !op.van || op.aan == null, 'een afzender en een ontvanger', (op.van ? 'afzender' : 'geen afzender') + ', ' +
      (op.aan != null ? 'ontvanger' : 'geen ontvanger'), 'het spoor van de zoeker'),
    punt(1, ok(a) && (op.aan === op.van || !bestaat), 'geen overdracht naar jezelf of naar een onbekende codenaam',
      ok(a) ? (bestaat && op.aan !== op.van ? 'naar een bestaand ander lid' : 'naar jezelf of onbekend') : 'geweigerd',
      bronS + ' (aan === van, bestaatLid)'),
    punt(2, !voor.sluit, 'het grootboek sloot bij de ingang', voor.sluit ? 'sloot' : 'sloot niet', 'server/kern/pay/kijken.js sluitcontrole()'),
    punt(3, ok(a) && !a.boeking, 'een toegestane overdracht draagt een eigen boeking', ok(a) ? (a.boeking ? 'boeking' : 'geen boeking') : 'geweigerd', bronS),
    punt(4, (ok(a) && na.ids.get(a.boeking) !== 1) || na.p2p - voor.p2p !== nieuwIds.size || !na.sluit,
      'de boeking staat er precies een keer, nieuwe overdrachten = nieuwe boekingen, en het grootboek sluit',
      (ok(a) ? (na.ids.get(a.boeking) || 0) + 'x deze boeking, ' : '') + (na.p2p - voor.p2p) + ' nieuwe overdracht(en) tegen ' +
        nieuwIds.size + ' nieuwe boeking(en), ' + (na.sluit ? 'sluit' : 'sluit niet'), 'het grootboek en sluitcontrole()'),
    punt(5, ok(a) && !voor.ids.has(a.boeking) && seintjesAan(w, voor, op.aan) < 1, 'de ontvanger krijgt een seintje bij een nieuwe overdracht',
      seintjesAan(w, voor, op.aan) + ' seintje(s) aan de ontvanger', bronS + ' seintje(aan)'),
    nietGezien(6, GEEN_GEBEURTENIS),
    /* De geschiedenis toont de laatste dertig regels; staan er meer, dan is
       "niet gevonden" geen afwijking maar een blik die niet ver genoeg reikt. */
    ov && ov.geschiedenis.length >= 30 ? nietGezien(7, 'de geschiedenis toont er dertig en deze boeking kan ervoor vallen')
      : punt(7, !!ov && !ov.geschiedenis.some(r => r.id === a.boeking), 'de overdracht staat in de geschiedenis van de afzender',
        ov ? (ov.geschiedenis.some(r => r.id === a.boeking) ? 'staat erin' : 'staat er niet in') : 'niet van toepassing (geweigerd)',
        'server/kern/pay/verzoeken.js overzicht() geschiedenis'),
    punt(8, !ok(a) && !(a && a.error), 'een weigering zegt waarom',
      ok(a) ? 'geslaagd' : (a && a.error ? 'weigering met reden' : 'weigering zonder reden'), 'KETENVORM.json, gedeelde belofte')
  ];
}

/* De ijkpunten van een handeling, of null met de reden. */
function rij(w, ctx, op, a) {
  if (!INGERICHT.includes(op.soort)) return { nietIngericht: 'de ijkpunten zijn (nog) alleen ingericht voor ' + INGERICHT.join(' en ') };
  const r = op.soort === 'betaal' ? rijBetaal(w, ctx, op, a) : rijStuur(w, ctx, op, a);
  if (r && ctx.e5 && !ctx.e5.zichtbaar) r[5] = nietGezien(5, ctx.e5.reden);
  return r ? { punten: r } : { nietIngericht: 'er was nog geen verzoek om te betalen' };
}

/* ------------------------------------------------------------ de divergentie */
function eersteDivergentie(punten) {
  const j = punten.findIndex(p => p.stand === 'wijkt');
  if (j < 0) return null;
  let i = j - 1;
  const overgeslagen = [];
  while (i >= 0 && punten[i].stand !== 'klopt') { overgeslagen.unshift(punten[i].punt); i--; }
  return { van: i >= 0 ? punten[i].punt : null, naar: punten[j].punt, overgeslagen, ijkpunt: punten[j] };
}

/* KAN DEZE WERELD EEN SEINTJE LATEN ZIEN? Een oudere proefopstelling gaf
   `keyVanCodenaam` een kale tekst, en dan gaat seintje() nooit af (par. 4a). Op
   zo'n artefact (de herhaalmatrix speelt ook oude commits na) zou E5 bij elke
   geslaagde handeling afwijken terwijl RTG Pay niets fout doet. Een proef van
   een overdracht beslist het; lukt zelfs die niet, dan is het onbekend. */
async function seintjesZichtbaar(maak) {
  const w = maak();
  const [a, b] = w.spelers;
  for (let p = 0; p < 20; p++) {
    const r = await w.pay.laadOp({ codenaam: a, centen: 1000, idem: 'seintjesproef:' + p });
    if (r && r.ok) {
      const s = await w.pay.stuur({ van: a, aanCodenaam: b, centen: 100, idem: 'seintjesproef', oms: 'proef' });
      await new Promise(r2 => setImmediate(r2));
      if (!(s && s.ok)) return { zichtbaar: false, reden: 'de proefoverdracht lukte niet, dus is niet vast te stellen of deze wereld seintjes laat zien' };
      return w.seintjes.length ? { zichtbaar: true }
        : { zichtbaar: false, reden: 'deze opstelling laat geen seintje zien (keyVanCodenaam geeft geen object); E5 is hier niet waar te nemen' };
    }
  }
  return { zichtbaar: false, reden: 'opladen lukte niet in deze wereld, dus is niet vast te stellen of hij seintjes laat zien' };
}

/* Speel stappen opnieuw met ijkpunten, en stop bij de eerste stap waarin er een
   wijkt. Wijkt er nergens een terwijl een wet wel brak, dan zegt de uitslag dat:
   dan zijn de ijkpunten te grof, en dat is een bevinding over dit instrument. */
async function ontleed(stappen, maak) {
  const e5 = await seintjesZichtbaar(maak);
  const w = maak();
  const spoor = { stuurBoekingen: new Set(), verzoeken: [] };
  const eerder = new Set();   // sleutels van betalingen die al slaagden
  for (let s = 0; s < stappen.length; s++) {
    const stap = stappen[s];
    const voor = momentopname(w);
    const bekend = spoor.verzoeken.slice();
    const antwoorden = await Promise.all(stap.ops.map(op => tv.doe(w, op, spoor)));
    await new Promise(r => setImmediate(r));   // seintje() loopt via een promise
    const na = momentopname(w);
    const ctx = { voor, na, stap, antwoorden, eerder, e5, spoor: { verzoeken: bekend } };
    const rijen = stap.ops.map((op, k) => ({ op: k, ...rij(w, ctx, op, antwoorden[k]) }));
    const met = rijen.filter(r => r.punten).map(r => ({ ...r, divergentie: eersteDivergentie(r.punten) }))
      .filter(r => r.divergentie).sort((x, y) => PUNTEN.indexOf(x.divergentie.naar) - PUNTEN.indexOf(y.divergentie.naar));
    stap.ops.forEach((op, k) => { if (op.soort === 'betaal' && op.idem && ok(antwoorden[k]) && bekend.length)
      eerder.add(sleutelVan(op, bekend[op.verzoek % bekend.length], k)); });
    if (met.length) return { gevonden: true, stap: s, op: met[0].op, divergentie: met[0].divergentie, punten: met[0].punten };
    if (tv.oordeelMetSpoor(w, spoor)) return { gevonden: false, stap: s, teGrof: 'een wet brak in deze stap, maar geen ijkpunt week af' };
  }
  return { gevonden: false };
}

module.exports = { PUNTEN, momentopname, rij, eersteDivergentie, ontleed, GEEN_GEBEURTENIS };

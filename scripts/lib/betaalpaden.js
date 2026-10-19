/* ============================================================================
   DE VIER BETAALPADEN -- een bankweigering is geen vals alarm, het is een
   geldige bedrijfssituatie (eigenaarsbesluit, 19 oktober 2026).

   Een proef die geld laat bewegen, beproeft niet alleen de zonnige dag. Dit
   instrument loopt vier paden, elk met een UITDRUKKELIJK gevraagde afloop van
   de bank (BEWIJSMACHINE.md par. 6a: geen muntworp in de meting):

     succes      'betaald'    betaald, afgerond, een afschrijving, een boeking,
                              leverbaar
     weigering   'geweigerd'  geen afschrijving, geen boeking, onbetaald, niet
                              leverbaar, een melding met woorden -- en opnieuw
                              betalen lukt en schrijft EEN keer af
     vertraging  'traag'      eerlijk "in behandeling" en nooit "betaald", geen
                              dubbele afschrijving bij herhaling, en een latere
                              bevestiging wordt verwerkt (dan wel leverbaar)
     crash       'betaald'    de server sterft tussen het bankantwoord en de
                              verwerking; na herstel eerst de echte stand, geen
                              tweede afschrijving, geen verweesde "betaald"

   HERBRUIKBAAR. Het instrument weet niets van ritten of boekingen. Een proef
   geeft een ADAPTER mee (alles async):

     nieuw(afloop)      een nieuw te betalen ding waarvan de eerste poging bij
                        de bank `afloop` geeft -> { ref } of null
     betaal(ref)        wat het lid doet: betalen -> { status, data }
     stand(ref)         wat RTG zegt -> { betaald, wacht, bekend? } (bekend:
                        staat er een gestarte betaling bij RTG)
     lever(ref)         de volgende stap die betaling eist (toewijzen,
                        uitleveren) -> { status }
     afschrift()        wat de BANK deed, als lijst { soort, sleutel, id,
                        status } (scripts/lib/betaalhaak.js schrijft hem)
     boekingen(ref)     hoeveel grootboekboekingen dit ding betalen
     bevestigLater(ref) optioneel: de bank bevestigt een trage betaling alsnog
     betaalEnCrash(ref) optioneel: betalen, de server laten sterven na het
                        bankantwoord, herstarten -> { gevraagd }

   EERLIJK OPEN. Ontbreekt een haak, of geeft nieuw() de gevraagde afloop niet,
   dan staat de stap OPEN met de reden. Nooit gesloten: wat niet gemeten is,
   is niet bewezen. Een stap die meet en tegenvalt, staat STUK.

   HET AFSCHRIFT TELT, NIET RTG. "Geen tweede afschrijving" lees je bij de bank
   en niet in de database van wie het mis kan hebben. Uitslagen met dezelfde
   sleutel zijn EEN betaling, zoals bij een echte bank met idempotentie: een
   herhaling met dezelfde sleutel is een opzoeking, geen tweede afschrijving.
   ========================================================================== */
'use strict';

const PADEN = ['succes', 'weigering', 'vertraging', 'crash'];
const AFLOOP = { succes: 'betaald', weigering: 'geweigerd', vertraging: 'traag', crash: 'betaald' };

/* Hoeveel betalingen de bank deed: verschillende sleutels met een 'betaald'. */
function afschrijvingen(regels) {
  const s = new Set();
  for (const r of regels || []) if (r && r.status === 'betaald') s.add(r.sleutel);
  return s.size;
}

const ok = (r) => !!r && r.status >= 200 && r.status < 300;
const weigert = (r) => !!r && r.status >= 400 && r.status < 500;
const woorden = (r) => (r && r.data && typeof r.data.error === 'string' ? r.data.error.trim() : '');

function maakPad(naam) {
  const stappen = [];
  const voeg = (nr, wat, stand, reden) => stappen.push({ nr, wat, stand, reden: String(reden || '').slice(0, 300) });
  /* `meet` geeft [goed, reden]; een fout in de adapter is een stuk stap met
     de fout als reden, niet een omgevallen proef. */
  async function stap(nr, wat, meet) {
    try { const [goed, reden] = await meet(); voeg(nr, wat, goed ? 'gesloten' : 'stuk', reden); }
    catch (e) { voeg(nr, wat, 'stuk', 'de meting viel om: ' + String(e && e.message || e)); }
  }
  const open = (nr, wat, reden) => voeg(nr, wat, 'open', reden);
  return { uit: { afloop: AFLOOP[naam], stappen }, stap, open };
}

async function venster(a) {
  const begin = (await a.afschrift()).length;
  return async () => afschrijvingen((await a.afschrift()).slice(begin));
}

const STAPPEN = {
  succes: [[1, 'het lid betaalt en krijgt een ja'], [2, 'RTG zegt betaald'], [3, 'de bank schreef precies een keer af'],
    [4, 'precies een boeking'], [5, 'leverbaar']],
  weigering: [[1, 'de bank weigert; het lid krijgt een melding met woorden'], [2, 'de bank schreef niets af'],
    [3, 'geen boeking'], [4, 'RTG zegt onbetaald'], [5, 'niet leverbaar'],
    [6, 'opnieuw betalen met een nieuwe poging lukt en schrijft een keer af']],
  vertraging: [[1, 'eerlijk in behandeling, nooit betaald'], [2, 'een herhaling schrijft niet af'], [3, 'niet leverbaar zolang de bank wacht'],
    [4, 'een latere bevestiging wordt verwerkt: betaald, een afschrijving, een boeking, leverbaar']],
  crash: [[1, 'de server sterft tussen het bankantwoord en de verwerking'],
    [2, 'na herstel eerst de echte stand: geen verweesde "betaald"'],
    [3, 'opnieuw betalen schrijft niet nog eens af en rondt af']]
};

async function succes(a, P, ref) {
  const tel = await venster(a);
  const r = await a.betaal(ref);
  await P.stap(1, STAPPEN.succes[0][1], () => [ok(r), 'betalen ' + r.status + (woorden(r) ? ': ' + woorden(r) : '')]);
  await P.stap(2, STAPPEN.succes[1][1], async () => { const s = await a.stand(ref); return [s.betaald === true && !s.wacht, JSON.stringify(s)]; });
  await P.stap(3, STAPPEN.succes[2][1], async () => { const n = await tel(); return [n === 1, n + ' afschrijving(en)']; });
  await P.stap(4, STAPPEN.succes[3][1], async () => { const n = await a.boekingen(ref); return [n === 1, n + ' boeking(en)']; });
  await P.stap(5, STAPPEN.succes[4][1], async () => { const l = await a.lever(ref); return [ok(l), 'leveren ' + l.status]; });
}

async function weigering(a, P, ref) {
  const tel = await venster(a);
  const r = await a.betaal(ref);
  await P.stap(1, STAPPEN.weigering[0][1], () => [weigert(r) && woorden(r).length >= 8,
    'betalen ' + r.status + ': ' + (woorden(r) || '(geen woorden)')]);
  await P.stap(2, STAPPEN.weigering[1][1], async () => { const n = await tel(); return [n === 0, n + ' afschrijving(en)']; });
  await P.stap(3, STAPPEN.weigering[2][1], async () => { const n = await a.boekingen(ref); return [n === 0, n + ' boeking(en)']; });
  await P.stap(4, STAPPEN.weigering[3][1], async () => { const s = await a.stand(ref); return [!s.betaald && !s.wacht, JSON.stringify(s)]; });
  await P.stap(5, STAPPEN.weigering[4][1], async () => { const l = await a.lever(ref); return [weigert(l), 'leveren ' + l.status]; });
  await P.stap(6, STAPPEN.weigering[5][1], async () => {
    const tel2 = await venster(a);
    const h = await a.betaal(ref);
    const n = await tel2(); const s = await a.stand(ref); const l = await a.lever(ref);
    const goed = ok(h) && n === 1 && s.betaald === true && ok(l);
    return [goed, goed ? 'opnieuw betaald, ' + n + ' afschrijving, leveren ' + l.status
      : 'geen nieuwe poging mogelijk: opnieuw betalen ' + h.status + (woorden(h) ? ' (' + woorden(h) + ')' : '') +
        ', ' + n + ' afschrijving(en), ' + JSON.stringify(s) + ', leveren ' + l.status];
  });
}

async function vertraging(a, P, ref) {
  const tel = await venster(a);
  const r = await a.betaal(ref);
  await P.stap(1, STAPPEN.vertraging[0][1], async () => { const s = await a.stand(ref);
    return [!ok(r) && woorden(r).length >= 8 && s.wacht === true && !s.betaald, 'betalen ' + r.status + ': ' + (woorden(r) || '(geen woorden)') + '; ' + JSON.stringify(s)]; });
  const r2 = await a.betaal(ref);
  await P.stap(2, STAPPEN.vertraging[1][1], async () => { const n = await tel(); const s = await a.stand(ref);
    return [!ok(r2) && n === 0 && !s.betaald, 'herhaling ' + r2.status + ', ' + n + ' afschrijving(en), ' + JSON.stringify(s)]; });
  await P.stap(3, STAPPEN.vertraging[2][1], async () => { const l = await a.lever(ref); return [weigert(l), 'leveren ' + l.status]; });
  if (typeof a.bevestigLater !== 'function') return P.open(4, STAPPEN.vertraging[3][1], 'de bank kan in deze wereld niet later bevestigen');
  await P.stap(4, STAPPEN.vertraging[3][1], async () => {
    await a.bevestigLater(ref);
    const h = await a.betaal(ref);
    const n = await tel(); const s = await a.stand(ref); const b = await a.boekingen(ref); const l = await a.lever(ref);
    return [s.betaald === true && n === 1 && b === 1 && ok(l),
      'na de bevestiging: betalen ' + h.status + (woorden(h) ? ' (' + woorden(h) + ')' : '') + ', ' + n + ' afschrijving(en), ' + b + ' boeking(en), ' + JSON.stringify(s) + ', leveren ' + l.status];
  });
}

async function crash(a, P, ref) {
  if (typeof a.betaalEnCrash !== 'function') {
    for (const [nr, wat] of STAPPEN.crash) P.open(nr, wat, 'deze wereld kan de server niet tijdens een betaling laten sterven');
    return;
  }
  const tel = await venster(a);
  let c = null;
  await P.stap(1, STAPPEN.crash[0][1], async () => { c = await a.betaalEnCrash(ref);
    return [!!(c && c.gevraagd), c && c.gevraagd ? 'bank gevraagd' + (c.bank ? ' (' + JSON.stringify(c.bank) + ')' : '') + ', server gestorven, herstart' : 'de bank werd voor de crash niet bereikt']; });
  if (!c || !c.gevraagd) {
    for (const [nr, wat] of STAPPEN.crash.slice(1)) P.open(nr, wat, 'de crash viel niet tussen bankverzoek en bevestiging');
    return;
  }
  await P.stap(2, STAPPEN.crash[1][1], async () => {
    const s = await a.stand(ref); const n = await tel(); const b = await a.boekingen(ref);
    /* Na herstel mag RTG twee dingen zeggen: nog niet betaald (en dan ook niet
       geleverd), of betaald MET de afschrijving en de boeking erbij. Betaald
       zonder een van beide is een verweesde "betaald". */
    const wees = s.betaald && (n !== 1 || b !== 1);
    const lekt = !s.betaald && b > 0;
    /* `bekend` (als de adapter het weet): staat de gestarte betaling na
       herstel nog bij RTG? Schreef de bank af en weet RTG van niets, dan valt
       er niets na te vragen -- dan hangt het herstel af van een lid dat
       toevallig opnieuw op betalen drukt, en blijft het geld anders bij de bank
       zonder dat iemand het ziet. */
    const vergeten = n > 0 && s.bekend === false;
    return [!wees && !lekt && !vergeten, (vergeten ? 'de bank schreef af en RTG kent na herstel geen gestarte betaling; ' : '') +
      JSON.stringify(s) + ', ' + n + ' afschrijving(en) bij de bank, ' + b + ' boeking(en)'];
  });
  await P.stap(3, STAPPEN.crash[2][1], async () => {
    const h = await a.betaal(ref);
    const n = await tel(); const s = await a.stand(ref); const b = await a.boekingen(ref); const l = await a.lever(ref);
    return [ok(h) && n === 1 && b === 1 && s.betaald === true && ok(l),
      'opnieuw betalen ' + h.status + (woorden(h) ? ' (' + woorden(h) + ')' : '') + ', ' + n + ' afschrijvingen, ' + b + ' boeking(en), leveren ' + l.status];
  });
}

const LOPER = { succes, weigering, vertraging, crash };

/* De vier paden, achter elkaar (het afschrift telt per venster, dus niet
   tegelijk). `paden`: een deel, als een proef er een eerder zelf liep. */
async function vierPaden(a, { paden = PADEN } = {}) {
  const uit = { paden: {}, gesloten: 0, open: 0, stuk: 0 };
  for (const naam of paden) {
    const P = maakPad(naam);
    let ding = null;
    try { ding = await a.nieuw(AFLOOP[naam]); } catch (e) { ding = null; }
    if (!ding || !ding.ref) {
      for (const [nr, wat] of STAPPEN[naam]) P.open(nr, wat, 'geen ding te krijgen waarvan de bank "' + AFLOOP[naam] + '" zegt');
    } else {
      await LOPER[naam](a, P, ding.ref);
    }
    uit.paden[naam] = P.uit;
    for (const s of P.uit.stappen) uit[s.stand]++;
  }
  return uit;
}

module.exports = { PADEN, AFLOOP, STAPPEN, afschrijvingen, vierPaden };

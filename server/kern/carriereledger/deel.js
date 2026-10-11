/* ============================================================================
   EEN REGEL BEWIJZEN ZONDER HET DOSSIER TE OPENEN.

   Dit is waarom het ledger een PLATFORMvermogen is en geen domeinfunctie
   (OS.md, en CARRIERE.md noemt hem met zoveel woorden): een sporter die een
   sponsor, een club of een visumloket een titel wil laten zien, hoort daarvoor
   niet zijn hele loopbaan te hoeven openen. Een dossier dat je alleen in zijn
   geheel kunt tonen, wordt in zijn geheel getoond.

   DE VORM KOMT VAN kern/rtgid-claims.js: selectieve deling, en een feit zonder
   herkomst is een half feit. Wat de ontvanger krijgt is EEN feit met zijn
   bevestigingen -- niet het kapitaal waar het bij hoort, niet hoeveel regels er
   nog meer zijn, en niet welke kapitalen leeg zijn. Dat laatste is geen detail:
   een lege voorraad is zelf een mededeling over een mens.

   ER WORDT GEEN TWEEDE SLEUTELMECHANISME UITGEVONDEN. kern/bearercode.js doet
   de code, de hash, de vergelijking met timingSafeEqual en het verval; op schijf
   staat alleen de hash, dus wie de opslag leest kan er geen bewijs mee tonen.

   DRIE DINGEN DIE NIET MOGEN SNEUVELEN.

   1. EEN DEELCODE VERLOOPT. LINK.md: alles wat met een oude foto nog iets in
      gang kan zetten, hoort tijdelijk te zijn. Maximaal een jaar, standaard
      dertig dagen.

   2. EEN INGETROKKEN FEIT WORDT GETOOND ALS INGETROKKEN, en de code gaat niet
      stilletjes op 404. Een sponsor die gisteren een titel zag en vandaag niets
      meer vindt, denkt aan een storing; hij hoort te lezen DAT het is
      teruggenomen. Stil verdwijnen is het gedrag waarmee je een ledger poetst.

   3. HET LID KAN HEM STOPPEN. Wat je hebt laten zien, kun je weer sluiten --
      wat de ontvanger al gelezen heeft, halen we niet terug, en dat staat erbij.
   ========================================================================== */
'use strict';

const DAG = 86400000;
const STANDAARD_DAGEN = 30;
const MAX_DAGEN = 365;

module.exports = function maakDeel({ eigen, crypto, schoon, save, bijeen, inBundel, feit, naam }) {
  const vastleggen = require('../../lib/duurzaam')({ bijeen, save, inBundel, bron: 'carriereledger-deel' });
  const bc = require('../bearercode')({ crypto, namespace: 'carriereledger' });

  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const nu = () => new Date().toISOString();
  const bak = () => eigen.bak('carriereDelen');
  const kijk = () => eigen.kijk('carriereDelen') || [];

  /* Wat de ontvanger NIET te horen krijgt, staat er even groot bij als wat hij
     wel krijgt (APPSTORE.md: een pak dat overal ja zegt is niets waard). */
  const VOORBEHOUD = [
    'Dit is EEN regel uit een loopbaan, gekozen door de mens zelf. Wat er niet bij staat, is niet noodzakelijk afwezig.',
    'RTG stelt niets vast over de prestatie zelf. Per bevestiging staat erbij wat zij wel en niet zegt.',
    'Er staat met opzet geen cijfer, niveau of vergelijking bij. Die bestaan hier niet.'
  ];

  /* Bevestigt de opslag een schrijfactie niet (lib/duurzaam.js geeft dan een
     503), dan gaat de wijziging ook uit het geheugen terug. Anders schrijft de
     gewone write-behind save() haar later alsnog weg, en was "niet vastgelegd"
     zelf de onwaarheid (zie schrijfVast() in ./index.js). */
  const herstel = (fn) => { try { fn(); } catch (e) { /* het geheugen is al zoals het was */ } };
  function terugzetten(rij, voor) {
    for (const k of Object.keys(rij)) if (!(k in voor)) delete rij[k];
    Object.assign(rij, voor);
  }

  async function deel(key, fid, { dagen, voor } = {}) {
    const f = feit(key, scho(fid, 20));
    if (!f) return { status: 404, error: 'Dit feit staat niet in uw ledger.' };
    const d = Math.max(1, Math.min(Math.round(Number(dagen) || STANDAARD_DAGEN), MAX_DAGEN));
    const { code, toegang } = bc.maak({ prefix: 'RTGCL', issuer: key, doel: 'carriere-regel',
      scope: ['carriere.regel.tonen'], onderwerp: { key, feit: f.id },
      geldigMs: d * DAG, maxGebruik: 10000 });
    const rij = Object.assign({ id: 'cd' + crypto.randomBytes(4).toString('hex'),
      voor: scho(voor, 120) || null }, toegang);
    const mis = await vastleggen(() => { bak().push(rij); });
    if (mis) { herstel(() => { const i = bak().findIndex((x) => x && x.id === rij.id); if (i >= 0) bak().splice(i, 1); }); return mis; }
    /* De kale code gaat precies EEN keer de deur uit. */
    return { status: 200, code, tot: toegang.expires_at, feit: f.id, voor: scho(voor, 120) || null };
  }

  async function toon(code) {
    const rij = bc.vind(kijk(), scho(code, 120));
    const waarom = bc.reden(rij, { doel: 'carriere-regel', scope: ['carriere.regel.tonen'], negeerGebruik: true });
    if (waarom) {
      return { status: 404, error: 'Deze code doet niets meer.', waarom };
    }
    const f = feit(rij.onderwerp.key, rij.onderwerp.feit);
    if (!f) return { status: 404, error: 'Deze code doet niets meer.', waarom: 'feit-weg' };
    /* Het tellen gebeurt op de SCHRIJFbak, niet op de rij uit kijk(). */
    const schrijf = bc.vind(bak(), scho(code, 120));
    if (schrijf) {
      const voor = Object.assign({}, schrijf);
      const mis = await vastleggen(() => { bc.gebruik(schrijf); });
      if (mis) { herstel(() => terugzetten(bak().find((x) => x && x.id === voor.id) || schrijf, voor)); return mis; }
    }
    return { status: 200, mens: naam(rij.onderwerp.key),
      feit: { wat: f.wat, op: f.op, ingetrokken: f.ingetrokken,
        bevestigingen: f.bevestigingen.filter(b => !b.ingetrokken) },
      getoondOp: nu(), voorbehoud: VOORBEHOUD };
  }

  function mijnDelen(key) {
    return kijk().filter(r => r.issuer === key).map(r => ({ id: r.id, feit: r.onderwerp.feit,
      voor: r.voor || null, tot: r.expires_at, gebruik: r.gebruik,
      gestopt: !!r.ingetrokken_at }));
  }

  async function stop(key, did) {
    const rij = bak().find(r => r.id === scho(did, 20) && r.issuer === key);
    if (!rij) return { status: 404, error: 'Deze deelcode kennen wij niet.' };
    if (rij.ingetrokken_at) return { status: 409, error: 'Deze deelcode is al gestopt.' };
    const voor = Object.assign({}, rij);
    const mis = await vastleggen(() => { bc.intrekken(rij, key, 'gestopt door het lid'); });
    if (mis) { herstel(() => terugzetten(bak().find((x) => x && x.id === voor.id) || rij, voor)); return mis; }
    return { status: 200, gestopt: rij.ingetrokken_at,
      let: 'Wie hem eerder heeft geopend, heeft de regel gelezen. Dat halen wij niet terug.' };
  }

  return { deel, toon, mijnDelen, stop, VOORBEHOUD };
};

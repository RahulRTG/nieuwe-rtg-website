/* Media OS (deelmodule): SAMEN LUISTEREN EN KIJKEN.

   Een luisterkamer is een gedeelde AANWIJZER, geen gedeelde stroom. De
   gastheer zegt: dit stuk, op deze seconde, spelend of stil. Iedereen in de
   kamer krijgt dat over de live-lijn en speelt het af met zijn EIGEN middelen
   -- de klankmotor op zijn toestel, de stroom uit het Theater, of het
   datakanaal van Clips. Er gaan hier dus geen bytes doorheen.

   WAAROM DAT DE ENIGE EERLIJKE VORM IS. De vier vormen spelen op vier
   verschillende manieren af, en bij twee ervan is de bron niet RTG maar het
   toestel van de maker. Een kamer die zou beloven "u hoort allemaal hetzelfde
   geluid" zou dat voor een korte video niet kunnen waarmaken zodra de maker
   offline is. Wat de kamer WEL waarmaakt is: u wijst allemaal naar hetzelfde
   stuk op dezelfde plek. Kan iemand het niet spelen, dan staat dat er met de
   reden bij in plaats van dat zijn scherm stil zwart blijft (LAT.md regel 5).

   EN DE DEUR BLIJFT VAN HET DOMEIN. Elke deelnemer lost het stuk op met zijn
   eigen sessie. Een kamer is dus geen manier om iemand iets te laten horen wat
   hij zelf niet mag openen -- precies dezelfde regel als bij het delen in een
   gesprek (routes/social/leden.js) en bij een gedeelde lijst.

   WIE ERIN MAG: alleen wie de gastheer uitnodigt, en alleen als er een echte
   verbinding tussen die twee bestaat. Een open kamer waar vreemden bij kunnen
   is een publiek kanaal, en dat is het Podium -- daar staat het beleid voor
   publiek al, inclusief de goedkeuring door een mens. */
'use strict';

const KAMER_TTL_MS = 20 * 60 * 1000;   // een kamer zonder leven is na 20 minuten weg
const AANWEZIG_MS = 2 * 60 * 1000;     // wie zich twee minuten niet meldt, is weg
const MAX_KAMERS = 200;

module.exports = ({ db, save, crypto, catalogus, codenaamVan, keyVanCodenaam, zijnVrienden, sseToCustomer }) => {
  const nuMs = () => Date.now();
  const nu = () => new Date().toISOString();
  const id = () => 'mk' + crypto.randomBytes(4).toString('hex');

  function tabel() {
    if (!db.data.mediaKamers || typeof db.data.mediaKamers !== 'object') db.data.mediaKamers = {};
    return db.data.mediaKamers;
  }
  /* Oude kamers opruimen bij elke aanraking. Een kamer die blijft staan nadat
     iedereen weg is, is een uitnodiging die eeuwig geldig blijft. */
  function schoonmaak() {
    const t = tabel();
    for (const k of Object.keys(t)) {
      if (nuMs() - new Date(t[k].leven || t[k].at).getTime() > KAMER_TTL_MS) delete t[k];
    }
    return t;
  }
  const kamerMet = (kid) => schoonmaak()[String(kid || '')] || null;
  const aanwezig = (k) => {
    const grens = nuMs() - AANWEZIG_MS;
    for (const key of Object.keys(k.mensen || {})) if (new Date(k.mensen[key]).getTime() < grens) delete k.mensen[key];
    return Object.keys(k.mensen || {});
  };
  const magErin = (k, key) => k.gastheer === key || (k.genodigd || []).includes(key);

  /* Het beeld van een kamer door de ogen van EEN deelnemer: de aanwijzer, wie
     er is, en of DIT stuk voor HEM speelbaar is. Die laatste vraag hoort per
     persoon beantwoord te worden, anders belooft de kamer iets namens iemand
     anders. */
  function beeld(k, sess) {
    const wereld = catalogus.alles(sess);
    const s = k.stand && k.stand.stukId ? wereld.rijen.find(r => r.id === k.stand.stukId) : null;
    return {
      id: k.id, gastheer: codenaamVan(k.gastheer), ikGastheer: k.gastheer === sess.key,
      lijstId: k.lijstId || null,
      stand: k.stand || null,
      stuk: s || null,
      speelbaar: !!s,
      reden: s ? null : (k.stand && k.stand.stukId
        ? 'Dit stuk is er voor u niet: weggehaald door de maker, of het staat achter een deur die voor u dicht is. De anderen horen het wel.'
        : 'De gastheer heeft nog niets gekozen.'),
      mensen: aanwezig(k).map(x => codenaamVan(x)),
      genodigd: (k.genodigd || []).map(x => codenaamVan(x)),
      uitleg: 'Een luisterkamer deelt de aanwijzer, niet het geluid: iedereen speelt hetzelfde stuk op dezelfde ' +
        'seconde af met zijn eigen toestel. Wat u niet mag openen, hoort u hier ook niet.'
    };
  }
  function rond(k, data) {
    for (const key of aanwezig(k)) sseToCustomer(key, 'mediasamen', data);
    if (!(k.mensen || {})[k.gastheer]) sseToCustomer(k.gastheer, 'mediasamen', data);
  }

  /* ---- een kamer beginnen, uitnodigen, erin en eruit ---- */
  function start(sess, opdracht) {
    const o = opdracht || {};
    const t = schoonmaak();
    if (Object.keys(t).length >= MAX_KAMERS) return { status: 429, error: 'Er lopen nu te veel luisterkamers. Probeer het zo nog eens.' };
    for (const kid of Object.keys(t)) if (t[kid].gastheer === sess.key) delete t[kid];   // een gastheer, een kamer
    const k = { id: id(), gastheer: sess.key, lijstId: o.lijstId ? String(o.lijstId) : null,
      stand: null, genodigd: [], mensen: { [sess.key]: nu() }, at: nu(), leven: nu() };
    t[k.id] = k; save();
    return { status: 200, ok: true, kamer: beeld(k, sess) };
  }
  async function nodig(sess, opdracht) {
    const o = opdracht || {};
    const k = kamerMet(o.id);
    if (!k) return { status: 404, error: 'Deze luisterkamer bestaat niet (meer).' };
    if (k.gastheer !== sess.key) return { status: 403, error: 'Alleen de gastheer nodigt uit.' };
    /* De gids is async en geeft een RIJ terug, geen sleutel. Wie dat vergeet,
       zet een Promise in de genodigdenlijst en nodigt daarmee niemand uit --
       dezelfde val als in ./hub.js en kern/podium/toegang.js. */
    const rij = keyVanCodenaam ? await keyVanCodenaam(String(o.codenaam || '')) : null;
    const doel = rij && rij.key ? rij.key : null;
    if (!doel) return { status: 404, error: 'Deze codenaam kent RTG niet.' };
    if (doel === sess.key) return { status: 400, error: 'Uzelf uitnodigen hoeft niet.' };
    /* Alleen wie u kent. Een kamer waar vreemden bij kunnen is een publiek
       kanaal, en daarvoor is het Podium -- met goedkeuring door een mens. */
    if (zijnVrienden && !zijnVrienden(sess.key, doel))
      return { status: 403, error: 'U kunt alleen mensen uitnodigen met wie u verbonden bent.' };
    k.genodigd = (k.genodigd || []).filter(x => x !== doel);
    if (o.aan !== false) k.genodigd.push(doel);
    k.leven = nu(); save();
    if (o.aan !== false) sseToCustomer(doel, 'mediasamen', { kind: 'uitnodiging', kamerId: k.id, van: codenaamVan(sess.key) });
    return { status: 200, ok: true, kamer: beeld(k, sess) };
  }
  function erin(sess, kid) {
    const k = kamerMet(kid);
    if (!k) return { status: 404, error: 'Deze luisterkamer bestaat niet (meer).' };
    if (!magErin(k, sess.key)) return { status: 403, error: 'De gastheer nodigt uit voor deze kamer.' };
    k.mensen = k.mensen || {};
    const nieuw = !k.mensen[sess.key];
    k.mensen[sess.key] = nu(); k.leven = nu(); save();
    if (nieuw) rond(k, { kind: 'erbij', kamerId: k.id, codenaam: codenaamVan(sess.key) });
    return { status: 200, ok: true, kamer: beeld(k, sess) };
  }
  function eruit(sess, kid) {
    const k = kamerMet(kid);
    if (!k) return { status: 200, ok: true };
    delete (k.mensen || {})[sess.key];
    /* Gaat de GASTHEER weg, dan gaat de kamer dicht. Een kamer zonder gastheer
       heeft niemand die de aanwijzer verzet en zou als een lege wachtkamer
       blijven staan. */
    if (k.gastheer === sess.key) {
      rond(k, { kind: 'einde', kamerId: k.id });
      delete tabel()[k.id];
    } else {
      rond(k, { kind: 'weg', kamerId: k.id, codenaam: codenaamVan(sess.key) });
    }
    save();
    return { status: 200, ok: true };
  }

  /* ---- de aanwijzer verzetten (alleen de gastheer) ---- */
  function zet(sess, opdracht) {
    const o = opdracht || {};
    const k = kamerMet(o.id);
    if (!k) return { status: 404, error: 'Deze luisterkamer bestaat niet (meer).' };
    if (k.gastheer !== sess.key) return { status: 403, error: 'Alleen de gastheer bepaalt wat er speelt.' };
    const sid = o.stukId != null ? String(o.stukId) : (k.stand && k.stand.stukId);
    if (!sid || !catalogus.deelId(sid)) return { status: 400, error: 'Dit is geen geldig stuk-id.' };
    /* De gastheer kan alleen aanwijzen wat HIJ ziet. Anders zet hij de kamer op
       een id dat hij zelf niet kent, en staat er bij iedereen een reden zonder
       dat er iets te horen viel. */
    const eigen = catalogus.alles(sess).rijen.some(r => r.id === sid);
    if (!eigen) return { status: 404, error: 'Dit stuk staat niet in uw wereld.' };
    const positieS = Math.max(0, Math.round(Number(o.positieS) || 0));
    k.stand = { stukId: sid, positieS, spelend: o.spelend !== false, at: nu() };
    k.mensen = k.mensen || {}; k.mensen[sess.key] = nu(); k.leven = nu(); save();
    rond(k, { kind: 'stand', kamerId: k.id, stand: k.stand });
    return { status: 200, ok: true, kamer: beeld(k, sess) };
  }

  /* De kamers die voor MIJ bestaan: die van mij, en die waarvoor ik ben
     uitgenodigd. Een lijst van alle kamers zou een lijst van andermans avond
     zijn. */
  function mijn(sess) {
    const t = schoonmaak();
    const rijen = Object.values(t).filter(k => magErin(k, sess.key)).map(k => ({
      id: k.id, gastheer: codenaamVan(k.gastheer), ikGastheer: k.gastheer === sess.key,
      mensen: aanwezig(k).length, at: k.at
    }));
    return { status: 200, kamers: rijen,
      uitleg: 'Een luisterkamer deelt de aanwijzer, niet het geluid. Alleen wie de gastheer uitnodigt komt erin.' };
  }

  return {
    mediaSamenStart: start, mediaSamenNodig: nodig, mediaSamenIn: erin,
    mediaSamenUit: eruit, mediaSamenZet: zet, mediaSamenMijn: mijn
  };
};

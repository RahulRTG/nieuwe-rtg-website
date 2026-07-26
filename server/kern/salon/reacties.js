/* Reacties in De Salon: reageren, antwoorden op een reactie, iemand noemen,
   en de veiligheidskant (verbergen, melden, en wie er mag reageren).

   De oude reactie was een plat regeltje: {who, tier, text}. Daar kun je niet op
   antwoorden en je kunt er niemand in noemen. Hier komt de draad erin, met drie
   grenzen die bij dit huis horen:

   1. WIE MAG REAGEREN bepaalt de maker: iedereen, alleen vrienden, of niemand.
      Dat is de eenvoudigste bescherming die er is, en hij ligt bij de persoon
      zelf in plaats van bij een moderatieteam.
   2. MELDEN werkt zoals bij Pulse: drie verschillende melders verbergen een post
      automatisch, en daarna heeft het kantoor het laatste woord. Geen enkele
      melder kan in zijn eentje iets van een ander wegkrijgen.
   3. VERBERGEN is prive en persoonlijk: jij ziet het niet meer, voor de rest
      verandert er niets. Dat is iets anders dan melden, en het hoort ook een
      andere knop te zijn. */
module.exports = ({ db, save, liveCodename, codenaamVan, keyVanCodenaam, zijnVrienden, salon, notify }) => {
  const { keur } = require('../veilig');
  const TEKST_MAX = 300;
  const MELD_GRENS = 3;
  const nu = () => new Date().toISOString();
  const NOEM = /@([\p{L}\p{N}_-]{2,40})/gu;

  /* Wie wordt er in deze tekst genoemd? Codenamen, en alleen bestaande. De
     opzoeking loopt over de ledengids (kern/gids.js) en die is async -- bij
     Postgres is het een tabel, geen object in het geheugen. Vindt de gids een
     naam niet, dan blijft het gewoon tekst: er gaat dan geen seintje uit, maar
     de reactie zelf komt er wel. */
  async function genoemd(tekst) {
    const uit = [];
    if (!keyVanCodenaam) return uit;
    for (const m of String(tekst || '').matchAll(NOEM)) {
      let key = null;
      try { const t = await keyVanCodenaam(m[1]); key = t && t.key; } catch (e) { key = null; }
      if (key && !uit.includes(key)) uit.push(key);
      if (uit.length >= 5) break;
    }
    return uit;
  }

  function reactieId(p) {
    let id = Date.now();
    while ((p.comments || []).some(c => c.id === id)) id++;
    return id;
  }

  function magReageren(sess, p) {
    const stand = p.reactiesVan || 'iedereen';
    if (p.authorKey === sess.key) return true;      // op je eigen post altijd
    if (stand === 'niemand') return false;
    if (stand === 'vrienden') {
      if (!p.authorKey || !zijnVrienden) return false;
      return !!zijnVrienden(sess.key, p.authorKey);
    }
    return true;
  }

  async function reageer(sess, postId, tekst, opId) {
    const p = salon.postMet(postId);
    if (!p) return { error: 'Deze post bestaat niet.' };
    if (!magReageren(sess, p)) return { error: 'De maker heeft reacties beperkt.' };
    const t = String(tekst || '').trim().slice(0, TEKST_MAX);
    if (!t) return { error: 'Schrijf eerst iets.' };
    const k = keur(t);
    if (!k.ok) return { error: k.reden };
    if (!Array.isArray(p.comments)) p.comments = [];
    // antwoorden gaan een niveau diep: een gesprek, geen boomstructuur waarin
    // niemand meer ziet wie waarop reageert
    const op = opId != null ? p.comments.find(c => String(c.id) === String(opId)) : null;
    const reactie = {
      // uniek BINNEN deze post: daar wordt hij ook alleen opgezocht (weghalen,
      // en `op` bij een antwoord). Zie kern/salon/index.js voor waarom een
      // willekeurig getal bij de tijd hier niet genoeg was.
      id: reactieId(p),
      who: liveCodename(sess) || 'Een lid', key: sess.key, tier: sess.tier,
      text: t, lang: 'nl', at: nu(), op: op ? op.id : null, noemt: await genoemd(t)
    };
    p.comments.push(reactie);
    if (p.comments.length > 500) p.comments = p.comments.slice(-500);
    save();
    // wie genoemd is krijgt een seintje, en de maker als iemand op zijn post reageert
    try {
      for (const key of reactie.noemt) if (key !== sess.key && notify) notify(key, 'Je bent genoemd in De Salon.');
      if (notify && p.authorKey && p.authorKey !== sess.key) notify(p.authorKey, 'Nieuwe reactie op je Salon-post.');
    } catch (e) {}
    return { ok: true, reactie: publiekeReactie(reactie, sess) };
  }

  const publiekeReactie = (c, sess) => ({
    id: c.id, who: c.who, tier: c.tier, text: c.text, at: c.at || null,
    op: c.op || null, vanMij: !!(sess && c.key === sess.key)
  });

  // De reacties van een post, nieuwste onderaan, met de antwoorden eronder.
  function reacties(sess, postId) {
    const p = salon.postMet(postId);
    if (!p) return { error: 'Deze post bestaat niet.' };
    const alle = (p.comments || []).map(c => publiekeReactie(c, sess));
    const hoofd = alle.filter(c => !c.op);
    return {
      ok: true,
      magIkReageren: magReageren(sess, p),
      reacties: hoofd.map(c => ({ ...c, antwoorden: alle.filter(a => a.op === c.id) }))
    };
  }

  function reactieWeg(sess, postId, reactieId) {
    const p = salon.postMet(postId);
    if (!p) return { error: 'Deze post bestaat niet.' };
    const i = (p.comments || []).findIndex(c => String(c.id) === String(reactieId));
    if (i < 0) return { error: 'Deze reactie bestaat niet.' };
    const c = p.comments[i];
    // je eigen reactie mag weg, en de maker mag opruimen onder zijn eigen post
    if (c.key !== sess.key && p.authorKey !== sess.key) return { error: 'Dat mag je niet.' };
    p.comments.splice(i, 1);
    save();
    return { ok: true };
  }

  // Wie mag er reageren op MIJN post: iedereen, alleen vrienden, of niemand.
  function reactiesVan(sess, postId, stand) {
    const p = salon.postMet(postId);
    if (!p) return { error: 'Deze post bestaat niet.' };
    if (p.authorKey !== sess.key) return { error: 'Dit is niet jouw post.' };
    if (!['iedereen', 'vrienden', 'niemand'].includes(stand)) return { error: 'Onbekende keuze.' };
    p.reactiesVan = stand;
    save();
    return { ok: true, reactiesVan: stand };
  }

  /* Verbergen: alleen voor jou. De post blijft voor iedereen bestaan; jij ziet
     hem niet meer. Geen melding aan de maker, want dat zou de knop onbruikbaar
     maken -- je verbergt juist iets zonder er ruzie over te willen. */
  function verberg(mij, postId, aan) {
    const s = salon.S();
    const p = salon.postMet(postId);
    if (!p) return { error: 'Deze post bestaat niet.' };
    const lijst = s.verborgen[mij] = s.verborgen[mij] || [];
    const i = lijst.indexOf(p.id);
    if (aan && i < 0) lijst.push(p.id);
    if (!aan && i >= 0) lijst.splice(i, 1);
    save();
    return { ok: true, verborgen: lijst.includes(p.id) };
  }

  /* Melden: drie VERSCHILLENDE melders verbergen de post voor iedereen, waarna
     het kantoor beslist. Een tweede melding van dezelfde persoon telt niet mee. */
  function meld(sess, postId, reden) {
    const p = salon.postMet(postId);
    if (!p) return { error: 'Deze post bestaat niet.' };
    if (!Array.isArray(p.meldingen)) p.meldingen = [];
    if (p.meldingen.some(m => m.key === sess.key)) return { ok: true, al: true, meldingen: p.meldingen.length };
    p.meldingen.push({ key: sess.key, reden: String(reden || '').slice(0, 200), at: nu() });
    if (p.meldingen.length >= MELD_GRENS) p.weg = true;   // uit de feed tot het kantoor kijkt
    save();
    return { ok: true, meldingen: p.meldingen.length, verborgen: !!p.weg };
  }

  return { reageer, reacties, reactieWeg, reactiesVan, verberg, meld, magReageren, genoemd, MELD_GRENS };
};

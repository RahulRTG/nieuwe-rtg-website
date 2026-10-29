/* Sessies herkennen en hun context lezen. Handhaving blijft bij de
   bestaande poorten; deze resolver krijgt geen middleware of domeinacties. */
module.exports = (ctx) => {
  const { DEMO, PERSONAS, sessionFor, accounts, sessieregister } = ctx;
/* Een token kan een demo-sessie zijn (in-memory) of een echt account-token
   (ondertekend, staatloos). Beide leveren een sessie met tier + unieke key.

   SINDS BLOK 1 hangt er een sid en een context aan, en dat gebeurt HIER omdat
   dit de enige plek is waar beide soorten sessies samenkomen. Twee dingen die
   niet mogen verschuiven:

     1. de context beslist NIETS. Hij komt er additief bij, na de geldigheids-
        toets, en een ontbrekend of vervallen register verandert nooit of iemand
        binnenkomt. Een storing in de bewijslaag hoort niet te klinken als een
        overtreding (CONTROLPLANE.md: ONBEKEND is geen WEIGEREN).
     2. de context wordt GELEZEN, niet aangevuld. Een claim vastleggen gebeurt
        op het moment van authenticatie; wie dat hier zou doen, legt bij elk
        verzoek opnieuw een 'afgeleide' vast en verliest daarmee het bewijs dat
        op het inlogmoment wel te halen was. */
function resolveSession(token) {
  if (!token) return null;
  const demo = sessionFor(token);
  // buiten de demo is een persona zonder account en zonder rol geen sessie (eigenaarsbesluit 19-10-2026)
  if (demo && !DEMO && !demo.account && !demo.role && PERSONAS[demo.tier]) return null;
  if (demo) return demo.sid ? metContext(demo, demo.sid) : demo;
  const user = accounts.verifyToken(token);
  if (user) {
    const sid = typeof accounts.sessieVan === 'function' ? accounts.sessieVan(token) : null;
    const sess = { tier: user.tier, key: 'user-' + user.id, account: user };
    return sid ? metContext(sess, sid) : sess;
  }
  return null;
}

/* Additief: req.session blijft precies wat hij was, hier komt alleen `sid` en
   een gelezen `sessieContext` bij. Een oud token (drie delen, geen sid) krijgt
   `sid: null` -- "deze sessie heeft geen identiteit", en dat is waar. */
function metContext(sess, sid) {
  sess.sid = sid;
  /* A-P1-04: EEN REGISTER DAT NIET TE LEZEN IS, IS NIET LEEG. Zonder deze vangst
     gooide een storing hier door tot in auth() en viel ELK ingelogd verzoek om --
     en de verleiding is dan een `catch` die stil verder gaat, waarna een sessie
     met een sleutelbinding eruitziet als een sessie zonder. In de stand
     `aanbevolen` komt die op een zwaar pad door: precies het gestolen token waar
     de binding voor bestaat. Dus: de lichte paden lopen door zonder context (een
     storing is geen overtreding), en de vlag zegt het bezitsbewijs dat het de
     binding NIET weet (kern/identiteit/bezitsbewijs.js weigert dan). */
  let rij;
  try { rij = sessieregister.lees(sid); }
  catch (e) { sess.sessieContextStoring = true; return sess; }
  if (rij) { sess.sessieContext = rij.context; try { sessieregister.raak(sid); } catch (e) { /* het venster opschuiven is extra */ } }
  return sess;
}

  return { resolveSession };
};

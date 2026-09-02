/* RTG Experience Kernel v1. Werelden orkestreren, domeinen bezitten,
   policies autoriseren, runtimes voeren uit en evidence bewijst. */
'use strict';

const { WORLD_CONTRACT } = require('./contract');
const manifesten = require('./manifesten');
const { kopie } = require('./canon');
const { geldig } = require('./objectrefs');

function maakExperience({ kern, db, save, crypto, bijeen, inBundel, nu }) {
  const opslag = require('./opslag')({ db, save, crypto, nu });
  const contexten = require('./contexts')({ kern, crypto });
  const attention = require('./attention')({ crypto, opslag });
  const projecties = require('./projections')({ kern, crypto, contexten, attention, manifesten });
  const commit = async fn => {
    if (typeof inBundel === 'function' && inBundel()) return fn();
    if (typeof bijeen === 'function') return bijeen(fn, { duurzaam: true });
    return fn();
  };
  const broker = require('./broker')({ crypto, opslag, projecteer: projecties.projecteer,
    contexten, kern, commit });

  function resumeVoor(key, world, context) {
    const opgeslagen = opslag.resumeLees(key);
    if (!opgeslagen) return null;
    const zelfdeWereld = opgeslagen.world === world;
    return { ...opgeslagen, world,
      contextId: zelfdeWereld && opgeslagen.contextId === (context && context.id)
        ? opgeslagen.contextId : (context && context.id),
      reconciled: !zelfdeWereld || opgeslagen.contextId !== (context && context.id) };
  }
  function bootstrap({ key, world, contextId, economicPrincipalRef }) {
    const bewaard = opslag.resumeLees(key);
    const w = manifesten.haal(world) ? world : (bewaard && manifesten.haal(bewaard.world) ? bewaard.world : 'living');
    const gekozenId = contextId || (bewaard && bewaard.world === w && bewaard.contextId);
    const projection = projecties.projecteer({ key, world: w, contextId: gekozenId, economicPrincipalRef });
    if (projection.error) return projection;
    return {
      ok: true, platformVersion: 1,
      principles: ['Worlds orchestrate', 'Domains own', 'Policies authorize',
        'Runtimes execute', 'Evidence proves'],
      worldContract: kopie(WORLD_CONTRACT), manifests: manifesten.publiek(),
      currentWorld: w, contexts: contexten.voor(key, w).map(kopie),
      currentContext: projection.context, projection,
      resume: resumeVoor(key, w, projection.context), intents: broker.registry()
    };
  }
  function projection(args) { return projecties.projecteer(args); }

  function resumeZet(key, invoer) {
    const b = invoer || {}, m = manifesten.haal(b.world);
    if (!m) return { error: 'Onbekende wereld.', status: 400 };
    const context = contexten.kies(key, b.world, b.contextId);
    if (!context || (b.contextId && context.id !== b.contextId))
      return { error: 'Deze context hoort niet bij deze gebruiker en wereld.', status: 403 };
    const surface = String(b.surface || '').slice(0, 180);
    if (surface && !/^\/apps\/[a-zA-Z0-9_./?=&%-]+$/.test(surface))
      return { error: 'Ongeldige surface.', status: 400 };
    if (b.objectRef && !geldig(b.objectRef)) return { error: 'Ongeldige object reference.', status: 400 };
    const waarde = { world: b.world, contextId: context.id, surface: surface || null,
      objectRef: b.objectRef ? kopie(b.objectRef) : null,
      navigationState: Array.isArray(b.navigationState)
        ? b.navigationState.map(x => String(x).slice(0, 64)).slice(0, 8) : [] };
    return { ok: true, resume: opslag.resumeZet(key, waarde) };
  }

  return { experience: {
    contract: () => kopie(WORLD_CONTRACT), manifests: manifesten.publiek,
    bootstrap, projection, resumeZet,
    preview: (key, body, economicPrincipalRef) => broker.preview(key, body, economicPrincipalRef),
    execute: (key, body) => broker.execute(key, body),
    evidence: (key, limit) => ({ ok: true, evidence: opslag.bewijsVoor(key, limit),
      integrity: opslag.bewijsIntegriteitVoor(key) }),
    intentRegistry: broker.registry
  } };
}

module.exports = { maakExperience };

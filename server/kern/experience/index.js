/* RTG Experience Kernel v1. Werelden orkestreren, domeinen bezitten,
   policies autoriseren, runtimes voeren uit en evidence bewijst. */
'use strict';

const { WORLD_CONTRACT } = require('./contract');
const manifesten = require('./manifesten');
const { kopie } = require('./canon');

function maakExperience({ kern, db, save, crypto, bijeen, inBundel, nu }) {
  const opslag = require('./opslag')({ db, save, crypto, nu });
  const contexten = require('./contexts')({ kern, crypto });
  const attention = require('./attention')({ crypto, opslag });
  const projecties = require('./projections')({ kern, crypto, contexten, attention, manifesten });
  const resume = require('./resume')({ opslag, contexten, manifesten, projecteer: projecties.projecteer });
  const network = require('./network')({ kern, db, crypto, contexten, manifesten,
    projecteer: projecties.projecteer });
  const commit = async fn => {
    if (typeof inBundel === 'function' && inBundel()) return fn();
    if (typeof bijeen === 'function') return bijeen(fn, { duurzaam: true });
    return fn();
  };
  const broker = require('./broker')({ crypto, opslag, projecteer: projecties.projecteer,
    contexten, kern, commit, network, trustPlane: require('../bewijsvlak/runtime').current() });

  function bootstrap({ key, world, contextId, economicPrincipalRef }) {
    const bewaard = opslag.resumeLees(key);
    const w = manifesten.haal(world) ? world : (bewaard && manifesten.haal(bewaard.world) ? bewaard.world : 'living');
    const contexts = contexten.voor(key, w);
    // Alleen een impliciet oud herstelpunt mag terugvallen. Een expliciet
    // gekozen vreemde of ingetrokken context blijft door de projector geweigerd.
    const opgeslagenId = bewaard && bewaard.world === w &&
      contexts.some(c => c.id === bewaard.contextId) ? bewaard.contextId : undefined;
    const gekozenId = contextId || opgeslagenId;
    const projection = projecties.projecteer({ key, world: w, contextId: gekozenId, economicPrincipalRef });
    if (projection.error) return projection;
    return {
      ok: true, platformVersion: 1,
      principles: ['Worlds orchestrate', 'Domains own', 'Policies authorize',
        'Runtimes execute', 'Evidence proves'],
      worldContract: kopie(WORLD_CONTRACT), manifests: manifesten.publiek(),
      currentWorld: w, contexts: contexts.map(kopie),
      currentContext: projection.context, projection,
      resume: resume.voor(key, projection), intents: broker.registry(), network: network.contract()
    };
  }
  function projection(args) { return projecties.projecteer(args); }

  return { experience: {
    contract: () => kopie(WORLD_CONTRACT), manifests: manifesten.publiek,
    bootstrap, projection, resumeZet: resume.zet,
    network: network.read,
    livingWorldView: (key, options) => kern.livingWorld.view(key, options),
    mediaExperiences: (key, id) => kern.livingWorld.mediaLinks(key, id),
    preview: (key, body, economicPrincipalRef) => broker.preview(key, body, economicPrincipalRef),
    execute: (key, body) => broker.execute(key, body),
    evidence: (key, limit) => ({ ok: true, evidence: opslag.bewijsVoor(key, limit),
      integrity: opslag.bewijsIntegriteitVoor(key) }),
    intentRegistry: broker.registry
  } };
}

module.exports = { maakExperience };

'use strict';
// Read existing accounts/Concern; no Library identity directory or Foundation owner.
module.exports = (kern, hulp) => {
  const member = ref => /^user-([1-9][0-9]*)$/.exec(String(ref || ''));
  const entity = ref => /^entiteit:(ent_[a-f0-9]+)$/.exec(String(ref || ''));
  const account = ref => { const m = member(ref); return m ? hulp.accounts.getUserById(Number(m[1])) : null; };
  const organization = ref => { const m = entity(ref); return m ? kern.entiteitVind(m[1]) : null; };
  const identities = {
    exists: ref => !!(member(ref) ? account(ref) : organization(ref)),
    represents: (actor, ref) => !!account(actor) && (actor === ref || organization(ref)?.eigenaar === actor)
  };
  kern.library = require('../kern/library')({ db: hulp.db, bewerkCollectie: hulp.bewerkCollectie,
    store: require('../db').STORE, identities, serviceProof: hulp.zegel });
};

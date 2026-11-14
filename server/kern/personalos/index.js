/* Personal Composition Engine als capability binnen Mijn RTG / Experience.
   Hij bezit geen dossiers, rechten of appinhoud. */
'use strict';

const klok = require('../../lib/klok');
const contract = require('./contract');
const catalogus = require('./catalog');
const engine = require('./engine');

function maakPersonalOS({ accounts, functieStand, crypto, toegankelijkVan }) {
  const digest = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const catalogVersion = 'sprong_' + digest(JSON.stringify(catalogus.BINDINGS)).slice(0, 12);
  const now = () => klok.datum().toISOString();
  const ids = catalogus.allIds();
  const leeg = () => ({ ...contract.normaliseer({}, ids), revision: 0, completed: false });
  const uitDossier = md => {
    const r = contract.normaliseer(md && md.personalOS || {}, ids);
    return r.error ? leeg() : { ...r, revision: Number(md && md.personalOS && md.personalOS.revision) || 0,
      completed: !!(md && md.personalOS && md.personalOS.completed) };
  };
  const bewaard = id => {
    const md = accounts.getMemberState(id) || {};
    return uitDossier(md);
  };

  function maakPreview(body) {
    const r = contract.normaliseer(body, ids);
    if (r.error) return r;
    const capabilities = catalogus.preview();
    return { ok: true, preview: true, authorizationClaim: false,
      composition: engine.maak({ catalog: capabilities, preferences: { ...r, revision: 0 },
        contextRef: 'public-preview', subjectRef: 'anonymous', authorityRevision: 'not_evaluated',
        catalogVersion, now, hash: digest }) };
  }

  function zet(userId, body) {
    const r = contract.normaliseer(body, ids);
    if (r.error) return r;
    return accounts.wijzigMemberState(userId, md => {
      const oud = uitDossier(md);
      const gelijk = JSON.stringify({ ...oud, revision: 0, completed: false }) ===
        JSON.stringify({ ...r, revision: 0, completed: false });
      /* Een tweede toestel mag een nieuwere keuze nooit overschrijven met een
         toevallig later antwoord. De eerste onboarding mag vanaf revisie nul
         zonder extra rondreis worden voltooid en een identieke herhaling blijft
         idempotent. Iedere echte wijziging daarna draagt de revisie die de mens
         zag; onbekend is fail-closed en verouderd levert de actuele voorkeuren
         terug waarmee de client bewust kan samenvoegen of opnieuw proberen. */
      const aangeboden = body && body.preferenceVersion;
      const verwacht = aangeboden == null || aangeboden === '' ? null : Number(aangeboden);
      if (!gelijk && oud.revision > 0 && verwacht == null) return { bewaar: false, waarde: {
        error: 'De actuele preferenceVersion is vereist om deze wijziging veilig op te slaan.',
        status: 428, conflict: true, currentPreferences: oud
      } };
      if (!gelijk && !(oud.revision === 0 && verwacht == null) &&
          (!Number.isInteger(verwacht) || verwacht !== oud.revision)) return { bewaar: false, waarde: {
        error: 'Deze persoonlijke indeling is intussen op een ander apparaat gewijzigd.',
        status: 409, conflict: true, currentPreferences: oud
      } };
      const personalOS = { ...r, revision: gelijk ? oud.revision : oud.revision + 1,
        completed: true, updatedAt: gelijk && md.personalOS && md.personalOS.updatedAt || now() };
      md.personalOS = personalOS;
      return { bewaar: true, waarde: { ok: true, changed: !gelijk, preferences: personalOS } };
    });
  }

  function composition({ user, session }) {
    if (!user || !user.id) return { error: 'Een eigen account is vereist.', status: 403 };
    const state = typeof functieStand === 'function' ? functieStand() : {};
    const catalog = catalogus.toegestaan({ tier: user.tier, state, person: session && session.key });
    const authorityRevision = 'a_' + digest(JSON.stringify(catalog.map(x => x.id)) + JSON.stringify(state)).slice(0, 16);
    const contextRef = 'private:' + digest((session && session.key) || ('user-' + user.id)).slice(0, 16);
    const result = engine.maak({ catalog, preferences: bewaard(user.id), contextRef,
      subjectRef: 'member:' + String(user.codename || digest(user.id).slice(0, 12)),
      authorityRevision, catalogVersion, now, hash: digest });
    /* Deze kern wordt voor de late route-aanbouw gemonteerd; lees daarom via
       exact dezelfde pure normalisator wanneer de runtimefunctie nog niet aan
       de kern hangt. Geen tweede toegankelijkheidsprofiel. */
    result.accessibility = toegankelijkVan ? toegankelijkVan(user.id)
      : require('../toegankelijk').schoonProfiel((accounts.getMemberState(user.id) || {}).toegankelijk);
    return { ok: true, composition: result };
  }

  return { personalOS: { contract: () => ({ schemaVersion: contract.SCHEMA_VERSION,
    goals: contract.GOALS, layouts: contract.LAYOUTS }), preview: maakPreview,
    preferences: bewaard, zet, composition } };
}

module.exports = { maakPersonalOS };

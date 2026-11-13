'use strict';
// Het ontvangstbewijs blijft bij de Mall-lijst. Geen procescache of tweede waarheid.
module.exports = ({ crypto, bak }) => {
  const hash = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
  const conflict = () => ({ status: 409, code: 'LIST_RECOVERY_CONFLICT',
    error: 'Deze herstelreferentie hoort bij een andere selectie.' });
  const actief = lijst => !lijst.verwijderdAt;
  function verwijder(lijsten, index, at) {
    const lijst = lijsten[index];
    if (!lijst.samenstellingBron) { lijsten.splice(index, 1); return; }
    const { bron, actor, invoerHash } = lijst.samenstellingBron;
    // Alleen de verwijdergrens blijft: geen titel, aanbod of lijstinhoud.
    lijsten[index] = { id: lijst.id, samenstellingBron: { bron, actor, invoerHash }, verwijderdAt: at };
  }
  function publiek(lijst) {
    const { samenstellingBron, ...uit } = lijst;
    return uit;
  }
  function binding(key, data, ref) {
    if (ref == null) return null;
    // Dezelfde onomkeerbare actoridentiteit als de server-side Experience-preview.
    const actor = 'actor_' + hash(String(key || '')).slice(0, 20);
    if (ref.actor !== actor) return { status: 403, code: 'LIST_RECOVERY_ACTOR',
      error: 'Deze herstelreferentie hoort niet bij uw account.' };
    if (!/^experience:xpv_[a-f0-9]{24}$/.test(ref.bron || '') || !data ||
        typeof data.naam !== 'string' || !Array.isArray(data.ids) ||
        !Array.isArray(ref.revisies) || ref.revisies.length !== data.ids.length ||
        ref.revisies.some(r => typeof r !== 'string' || !/^[a-f0-9]{64}$/.test(r)))
      return { status: 400, code: 'LIST_RECOVERY_INVALID', error: 'Ongeldige herstelreferentie.' };
    return { bron: ref.bron, actor, invoerHash: hash({ naam: data.naam,
      ids: data.ids, revisies: ref.revisies }) };
  }
  function vind(key, data, ref) {
    const b = binding(key, data, ref);
    if (!b || b.error) return b;
    const gevonden = bak(key).filter(l => l.samenstellingBron && l.samenstellingBron.bron === b.bron);
    if (!gevonden.length) return null;
    if (gevonden.length !== 1) return conflict();
    const lijst = gevonden[0], bron = lijst.samenstellingBron;
    if (bron.actor !== b.actor || bron.invoerHash !== b.invoerHash) return conflict();
    if (!actief(lijst)) return { status: 409, code: 'LIST_RECOVERY_DELETED',
      error: 'Deze bewaarde lijst is inmiddels verwijderd. Stel een nieuw plan samen.' };
    return { ok: true, lijst: publiek(lijst), hergebruikt: true,
      ontvangst: { id: lijst.id, naam: bron.naam, aantal: bron.aantal } };
  }
  return { binding, vind, publiek, actief, verwijder };
};

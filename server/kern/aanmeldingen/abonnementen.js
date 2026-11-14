/* Zelfservice verbindt de bestaande eigenaars: aanbod, contract, factuur,
   betaalwaarheid en rechten. Een releasepoort is geen betaalbewijs. */
'use strict';
const klok = require('../../lib/klok');
const { termijn } = require('./abonnementstermijn');

module.exports = ({ db, accounts, bewerkCollectie, betaal, betaalWaarheid, provisioneer,
  nu = () => new Date(klok.nu()).toISOString(), returnUrl, beschikbaar = false }) => {
  const context = require('./abonnementscontext')({ db, accounts });
  const aanbod = require('./abonnementsaanbod')({ db, accounts, bewerkCollectie, nu, ...context });
  const betaling = require('./abonnementsbetaling')({ db, accounts, bewerkCollectie, betaal, betaalWaarheid, nu, returnUrl });
  if (betaalWaarheid?.registreerStartcontrole) betaalWaarheid.registreerStartcontrole('abonnement', betaling.voorProvider);
  const meldingen = require('./abonnementsmeldingen')({ db, bewerkCollectie, nu });
  const activering = require('./abonnementsactivering')({ db, accounts, bewerkCollectie, betaal, nu,
    rechten: async c => {
      const vers = (db.data.contracten || []).find(x => x.id === c.id);
      if (!vers || !['ACTIEF', 'OPZEGGEND'].includes(vers.status)) return;
      if (['zaak', 'organisatie'].includes(c.aanbod.scope.soort)) {
        if (typeof provisioneer !== 'function') throw Error('Bedrijfsactivering is niet aangesloten.');
        const r = await provisioneer(c.id);
        if (!r || r.error || !r.ok) throw Error(r?.error || 'Bedrijfsactivering is nog niet bevestigd.');
      } else await accounts.achtergrondWerk(() => {
        if (!accounts.setTier(c.accountId, c.pas)) throw Error('De persoonlijke pas kon niet worden geactiveerd.');
      });
    } });
  const gate = () => beschikbaar === true && !!betaal && !!betaalWaarheid && !!returnUrl;
  const dicht = () => ({ status: 503, error: 'De nieuwe abonnementsroute is nog niet vrijgegeven; er is niets afgeschreven.', beschikbaar: false });
  const eigen = (id, contractId) => (db.data.contracten || []).find(c => c.id === contractId && c.accountId === id && c.automatischAbonnement);
  const schema = id => (db.data.lidmaatschapBetalingen || []).find(r => r.contractId === id);
  async function betaalZelf(id, input = {}) {
    if (!gate()) return dicht();
    const c = eigen(id, input.contractId);
    if (!c) return { status: 404, error: 'De eigen overeenkomst is niet gevonden.' };
    const r = await betaling.begin(id, c.id, 1);
    if (r.status === 'VERREKEND') return activering.afgewikkeld(id, c.id, 1);
    return r;
  }
  async function herstel(id, input = {}, { achtergrond = false } = {}) {
    if (!gate()) return dicht();
    const c = eigen(id, input.contractId);
    if (!c) return { status: 404, error: 'De eigen overeenkomst is niet gevonden.' };
    const rij = schema(c.id), t = rij?.termijnen.find(x => x.status !== 'voldaan') || rij?.termijnen[0];
    if (!t) return { ok: true, status: c.status };
    // Een bestaande opdracht hervatten verandert geen sleutel of bedrag.
    if (t.betaalWaarheidId) {
      const w = betaalWaarheid.van(t.betaalWaarheidId);
      if (!w) throw Error('De eerdere betalingsopdracht ontbreekt.');
      const r = await betaling.begin(id, c.id, t.nr);
      const vers = betaalWaarheid.van(t.betaalWaarheidId);
      if (!vers) throw Error('De eerdere betalingsopdracht ontbreekt na navraag.');
      if (vers.status !== 'BEVESTIGD') {
        if (!achtergrond && vers.start?.terugkerend?.modus === 'innen' &&
            ['GEWEIGERD', 'WACHT_OP_KLANT'].includes(vers.status)) {
          const klantactie = await betaalWaarheid.herstel(vers.id, 'acc:' + id);
          return { ...r, klantactie: { ...klantactie, returnUrl } };
        }
        return r;
      }
    } else if (t.setup && !t.setup.providerId) {
      return betaling.begin(id, c.id, t.nr);
    }
    return activering.afgewikkeld(id, c.id, t.nr);
  }
  function mijn(id) {
    if (!gate()) return { ok: true, beschikbaar: false, contracten: [] };
    const r = aanbod.mijn(id);
    if (!r.ok) return r;
    return { ...r, beschikbaar: true, contracten: r.contracten.map(c => {
      const rij = schema(c.id), t = rij?.termijnen.find(x => x.status !== 'voldaan') || rij?.termijnen[0];
      const w = t?.betaalWaarheidId && betaalWaarheid.van(t.betaalWaarheidId);
      return { ...c, herstel: eigen(id, c.id)?.herstel || null,
        herstelstand: meldingen.beoordeel(eigen(id, c.id)),
        betaalstand: { status: w?.status || (t?.setup ? 'WACHT_OP_KLANT' : c.status),
          checkoutUrl: t?.checkoutUrl || t?.setup?.checkoutUrl || null } };
    }) };
  }
  let bezig = false, naContract = null;
  async function ronde() {
    if (!gate() || bezig) return { bekeken: 0 };
    bezig = true;
    const fouten = [], alle = (db.data.contracten || []).filter(c => c.automatischAbonnement &&
      ['GEACCEPTEERD', 'ACTIEF', 'OPZEGGEND'].includes(c.status)).sort((a, b) => a.id.localeCompare(b.id));
    // Niet steeds dezelfde eerste honderd: ook grote bestanden en gewijzigde
    // contractlijsten blijven aan de beurt, zonder een tweede betaalplanning.
    const vanaf = naContract ? alle.findIndex(c => c.id.localeCompare(naContract) > 0) : 0;
    const rijen = alle.slice(vanaf < 0 ? 0 : vanaf, (vanaf < 0 ? 0 : vanaf) + 100);
    if (rijen.length) naContract = rijen.at(-1).id;
    try {
      for (const c of rijen) try {
        const rij = schema(c.id);
        // Een alleen getekend aanbod is GEEN toestemming de checkout buiten de klant te beginnen.
        if (!rij?.termijnen.length) continue;
        const open = rij.termijnen.find(t => t.status !== 'voldaan' && t.status !== 'vervallen');
        if (open || !c.activering?.rechtenAt) {
          try { await herstel(c.accountId, { contractId: c.id }, { achtergrond: true }); }
          finally { await meldingen.meld(c.id); }
          continue;
        }
        if (!['ACTIEF', 'OPZEGGEND'].includes(c.status)) continue;
        const nr = Math.max(...rij.termijnen.map(t => t.nr)) + 1, t = termijn(c, nr);
        if (Date.parse(t.van) > Date.parse(nu()) || c.eindigtOp && Date.parse(t.van) >= Date.parse(c.eindigtOp)) continue;
        const r = await betaling.begin(c.accountId, c.id, nr);
        if (r.status === 'VERREKEND') await activering.afgewikkeld(c.accountId, c.id, nr);
      } catch (e) { fouten.push({ contractId: c.id, error: String(e.message || e) }); }
      return { bekeken: rijen.length, fouten };
    } finally { bezig = false; }
  }
  function magDienst(accountId, dienst) {
    return (db.data.contracten || []).filter(c => c.accountId === accountId && c.automatischAbonnement &&
      c.aanbod?.scope.soort === 'persoon').every(c => meldingen.magDienst(meldingen.beoordeel(c), dienst));
  }
  return { mijn, betaal: betaalZelf, herstel, ronde, magDienst, afgewikkeld: activering.afgewikkeld,
    intrekken: (id, input) => gate() ? aanbod.intrekken(id, input) : dicht(),
    aanbod: (id, input) => gate() ? aanbod.aanbod(id, input) : dicht(),
    teken: (id, input) => gate() ? aanbod.teken(id, input) : dicht() };
};

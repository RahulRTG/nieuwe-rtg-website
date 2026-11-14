/* Activering consumeert de bestaande creditreservering en het echte bewijs.
   Betaald maar nog niet geactiveerd blijft herstelbaar, nooit opnieuw betaald. */
'use strict';
const { maakContracten, plusMaanden } = require('../commercie/contract');
const { valideOndertekening } = require('./abonnementsaanbod');
const { plan } = require('../commercie/abonnementsverrekening');
const { canon } = require('./abonnementsaanbod-vorm');
const { termijn } = require('./abonnementstermijn');
const eigenTermijnfactuur = require('./abonnementsfactuur');
const VORM = { contracten: 'lijst', aanmeldingen: 'lijst', onboarding: 'kaart',
  lidmaatschapBetalingen: 'lijst' };

module.exports = ({ db, accounts, betaal, bewerkCollectie, nu, rechten }) => {
  async function afgewikkeld(accountId, contractId, nr = 1) {
    let c = (db.data.contracten || []).find(x => x.id === contractId && x.accountId === accountId && x.automatischAbonnement);
    if (!c) throw Error('De eigen overeenkomst ontbreekt.');
    const rij = (db.data.lidmaatschapBetalingen || []).find(r => r.contractId === contractId);
    const t = rij?.termijnen.find(x => x.nr === nr);
    if (!t) throw Error('De contracttermijn ontbreekt.');
    let afspraak = null;
    if (nr === 1 && !c.activering) {
      const w = t.betaalWaarheidId && db.data.betaalWaarheid?.[t.betaalWaarheidId];
      const providerId = w ? w.providerId : t.setup?.providerId;
      if (!providerId) return { ok: false, status: 'WACHT_OP_KLANT' };
      afspraak = await betaal.haalBetaalafspraak({ aanbieder: 'stripe', providerId,
        referentie: w ? w.id : t.setup.referentie, toestemmingRef: c.aanbod.hash });
      if (afspraak.status !== 'gereed') return { ok: false, status: 'WACHT_OP_KLANT' };
    }
    if (nr > 1 && t.brutoCenten > 0 && t.status !== 'voldaan') {
      const w = db.data.betaalWaarheid?.[t.betaalWaarheidId];
      if (!w || w.status !== 'BEVESTIGD') return { ok: false, status: 'WACHT_OP_KLANT' };
      afspraak = await betaal.haalBetaalafspraak({ aanbieder: 'stripe', providerId: w.providerId,
        referentie: w.id, toestemmingRef: c.aanbod.hash,
        customerId: w.start.terugkerend.customerId, paymentMethodId: w.start.terugkerend.paymentMethodId });
      if (afspraak.status !== 'gereed') return { ok: false, status: 'WACHT_OP_KLANT' };
    }
    const md = accounts.getMemberState(accountId);
    const resultaat = await bewerkCollectie(VORM, data => {
      const contract = data.contracten.find(x => x.id === contractId && x.accountId === accountId && x.automatischAbonnement);
      if (!contract || !valideOndertekening(contract, data.onboarding)) throw Error('De specifieke ondertekening is ongeldig.');
      const schema = data.lidmaatschapBetalingen.find(r => r.contractId === contractId);
      const x = schema?.termijnen.find(x => x.nr === nr);
      if (!x) throw Error('De duurzame contracttermijn ontbreekt.');
      const inv = eigenTermijnfactuur(md, contract, x);
      let at = nu();
      if (x.brutoCenten > 0) {
        const w = db.data.betaalWaarheid?.[x.betaalWaarheidId];
        if (!w || w.status !== 'BEVESTIGD' || w.terugbetaaldCenten !== 0 || w.valuta !== 'eur' ||
            w.actor !== 'acc:' + accountId || w.soort !== 'factuur' || w.bronRef !== x.invoiceId ||
            w.context?.contractId !== contractId || w.context?.accountId !== accountId || w.context?.own !== true ||
            w.context?.invoiceId !== x.invoiceId || w.centen !== x.brutoCenten || inv.status !== 'paid' ||
            !inv.betaalBewijzen?.some(b => b.id === w.id && b.centen === w.centen))
          throw Error('De exacte eerste betaalverplichting is niet bewezen.');
        at = w.gebeurtenissen.find(g => g.soort === 'STATUS' && g.naar === 'BEVESTIGD')?.at;
        if (!at || !Number.isFinite(Date.parse(at))) throw Error('De betaalbevestiging mist haar tijdstip.');
      }
      if (nr === 1 && !contract.activering) {
        if (contract.status !== 'GEACCEPTEERD' || !afspraak || afspraak.toestemmingRef !== contract.aanbod.hash)
          throw Error('De betaalafspraak of contractstand is niet bevestigd.');
        const prijs = contract.aanbod.prijs, v = contract.aanbod.verrekening;
        if (contract.afgesprokenCenten !== prijs.maand.nettoCenten || contract.frequentie !== contract.aanbod.frequentie ||
            contract.btwProfiel !== prijs.btwProfiel || contract.minimumMaanden !== 12 || contract.opzegMaanden !== 1 ||
            contract.verlenging !== 'opzegbaar' || contract.verrekening.status !== 'GERESERVEERD' ||
            contract.verrekening.creditCenten !== v.creditCenten + v.overCenten ||
            canon(contract.verrekening.regels) !== canon(v.regels.map(r => ({ ...r, centen: r.beschikbaarCenten }))))
          throw Error('De contractprojectie wijkt af van het ondertekende aanbod.');
        if (contract.aanbod.geldigTot && Date.parse(at) > Date.parse(contract.aanbod.geldigTot))
          throw Error('De betaling volgde na de verrekenofferte; menselijke afstemming nodig, niet opnieuw betalen.');
        const bronId = contract.verrekening.bronContractId;
        if (bronId) {
          const bron = data.contracten.find(x => x.id === bronId);
          const eigenaar = data.aanmeldingen.find(a => a.id === bron?.aanmeldingId && a.accountId === accountId);
          if (!eigenaar || !['ACTIEF', 'OPZEGGEND', 'VERLENGBAAR'].includes(bron.status))
            throw Error('Het broncontract is niet meer verrekenbaar.');
          if (Object.values(db.data.betaalWaarheid || {}).some(w => w.context?.contractId === bronId &&
              !['BEVESTIGD', 'TERUGBETAALD'].includes(w.status)))
            throw Error('Een betaling op het broncontract is nog niet afgerond.');
          const controle = plan({ contract: { ...bron, accountId }, facturen: md.invoices,
            betaalWaarheid: db.data.betaalWaarheid, contracten: data.contracten.filter(k => k.id !== contractId),
            op: contract.aanbod.at, doelCenten: contract.aanbod.prijs.termijn.brutoCenten });
          const quote = contract.aanbod.verrekening;
          if (!controle.ok || controle.creditCenten !== quote.creditCenten || controle.overCenten !== quote.overCenten ||
              canon(controle.regels) !== canon(quote.regels)) throw Error('De bronbetaling of credit is gewijzigd; controle nodig.');
          const motor = maakContracten({ db: { data }, save() {}, nu: () => at });
          motor.beeindig(bron); bron.eindigtOp = at; bron.vervangenDoor = contractId;
          for (const b of data.lidmaatschapBetalingen.filter(b => b.contractId === bronId))
            for (const oud of b.termijnen || []) if (Date.parse(oud.vervalt) >= Date.parse(at) && oud.status !== 'voldaan')
              oud.status = 'vervallen';
        }
        contract.startAt = at; contract.prijsVastTot = plusMaanden(at, 12);
        contract.verrekening.status = 'TOEGEPAST'; contract.verrekening.toegepastAt = at;
        contract.betaalafspraak = { ...afspraak, termijnNr: 1 };
        const motor = maakContracten({ db: { data }, save() {}, nu: () => at });
        const stap = motor.activeer(contract);
        if (stap.error) throw Error(stap.error);
        contract.activering = { at, betaalWaarheidId: x.betaalWaarheidId, rechtenAt: null };
        const a = data.aanmeldingen.find(a => a.id === contract.aanmeldingId && a.accountId === accountId);
        if (!a) throw Error('De eigen aanmelding ontbreekt.');
        a.status = 'geaccepteerd'; a.bijgewerkt = at;
        if (!a.besluit) a.besluit = { besluit: 'geaccepteerd', door: 'getekend en betaald contract', at };
        schema.gestart = at;
        Object.assign(x, termijn(contract, 1)); x.vervalt = x.van;
      } else if (nr === 1 && !['ACTIEF', 'OPZEGGEND'].includes(contract.status)) {
        // Een late retry van een vervangen contract mag de nieuwe pas niet terugdraaien.
        return { ok: true, vervangen: true };
      }
      if (nr > 1 && afspraak && nr >= (contract.betaalafspraak?.termijnNr || 1)) {
        const w = db.data.betaalWaarheid?.[x.betaalWaarheidId];
        if (afspraak.referentie !== w.id || afspraak.providerId !== w.providerId ||
            afspraak.customerId !== w.start.terugkerend.customerId || afspraak.toestemmingRef !== contract.aanbod.hash)
          throw Error('De vernieuwde betaalafspraak hoort niet bij de bewezen termijn.');
        contract.betaalafspraak = { ...afspraak, termijnNr: nr };
      }
      x.status = 'voldaan'; x.voldaan = { at, bron: x.brutoCenten ? 'betaalwaarheid' : 'contractverrekening' };
      return { ok: true, contract, termijn: x };
    });
    if (resultaat.vervangen) return resultaat;
    c = resultaat.contract;
    // Periode begint op bevestiging. Een herhaling werkt dezelfde factuur bij.
    await accounts.achtergrondWerk(() => accounts.wijzigMemberState(accountId, md => {
      const i = eigenTermijnfactuur(md, c, resultaat.termijn);
      if (resultaat.termijn.brutoCenten) eigenTermijnfactuur.eisBetaald(i, resultaat.termijn,
        db.data.betaalWaarheid?.[resultaat.termijn.betaalWaarheidId]);
      Object.assign(i.abonnement, { van: resultaat.termijn.van, tot: resultaat.termijn.tot });
      if (!resultaat.termijn.brutoCenten) {
        i.status = 'paid'; i.verrekend = { contractId, creditCenten: resultaat.termijn.creditCenten };
        i.date = 'Voldaan door contractverrekening';
      }
      return { bewaar: true, waarde: true };
    }));
    if (nr === 1) {
      await rechten(c);
      await bewerkCollectie({ contracten: 'lijst' }, data => {
        const x = data.contracten.find(x => x.id === c.id);
        if (x?.activering && !x.activering.rechtenAt) x.activering.rechtenAt = nu();
      });
    }
    return { ok: true, status: 'ACTIEF' };
  }
  return { afgewikkeld };
};

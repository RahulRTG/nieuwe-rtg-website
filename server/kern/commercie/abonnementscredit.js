/* Bewijs van eerder doorgeschoven geld. De contractrij en haar ondertekende
   offerte zijn de ENIGE creditbron; geen nieuw saldo/register. Iedere pijl
   wordt opnieuw herleid tot betaalwaarheid op het oorspronkelijke offertemoment.
   Een later gewijzigde refund of concurrerende claim vraagt menselijke controle. */
'use strict';
const { geld, id, datum, account, aliases, betaling } = require('./abonnementsbewijs');
const { canon, aanbodGeldig, creditGeldig } = require('../aanmeldingen/abonnementsaanbod-vorm');
const { termijn } = require('./contract/abonnement');
const fout = reden => ({ ok: false, redenen: [reden] });

module.exports = function bewijs(input, herbereken) {
  const { contract: c, facturen, betaalWaarheid, contracten, op } = input;
  const eigen = facturen.filter(f => f?.abonnement?.contractId === c.id), v = c.verrekening;
  if (!(v?.creditCenten > 0) && !(c.aanbod?.verrekening?.creditCenten > 0) &&
      !(c.aanbod?.verrekening?.overCenten > 0) && !eigen.some(f => f.verrekend || f.abonnement.creditCenten > 0))
    return { ok: true, facturen: new Map(), rest: null };
  const a = c.aanbod, q = a?.verrekening, s = c.ondertekening, at = c.activering?.at;
  if (!c.automatischAbonnement || !aanbodGeldig(c) || !geld(v?.creditCenten) || v.creditCenten === 0 ||
      v.status !== 'TOEGEPAST' || !id(v.bronContractId) || v.bronContractId === c.id ||
      datum(at) === null || at !== c.startAt || v.toegepastAt !== at || datum(at) > datum(op) ||
      !s || s.scope !== 'abonnement:' + c.id || s.profiel !== 'user-' + c.accountId ||
      s.versie !== a.versie || !/^[a-f0-9]{64}$/.test(s.hash || '') || datum(s.at) === null ||
      datum(s.at) > datum(at) || datum(a.at) === null || datum(a.at) > datum(at) ||
      !creditGeldig(q, a.prijs.termijn.brutoCenten) || q.bronContractId !== v.bronContractId ||
      v.creditCenten !== q.creditCenten + q.overCenten ||
      canon(v.regels) !== canon(q.regels.map(r => ({ ...r, centen: r.beschikbaarCenten }))))
    return fout('Het toegepaste contracttegoed is niet exact gebonden aan het geactiveerde eigen aanbod.');
  const bronnen = contracten.filter(k => k?.id === v.bronContractId), bron = bronnen[0];
  if (bronnen.length !== 1 || account(bron.accountId) !== account(c.accountId) ||
      bron.status !== 'GEEINDIGD' || bron.vervangenDoor !== c.id || bron.eindigtOp !== at ||
      contracten.filter(k => k?.id === c.id).length > 1)
    return fout('De creditketen mist één exclusief beëindigde eigen voorganger.');
  // Alleen deze bewezen vervanging wordt teruggedraaid in de LEESPROJECTIE.
  // Anders zou een afgesloten voorganger ten onrechte nul bronwaarde geven.
  const r = herbereken({ ...input, contract: { ...bron, eindigtOp: null },
    contracten: contracten.filter(k => k?.id !== c.id), op: a.at, doelCenten: a.prijs.termijn.brutoCenten });
  if (!r.ok || r.creditCenten !== q.creditCenten || r.overCenten !== q.overCenten || canon(r.regels) !== canon(q.regels))
    return fout('De oorspronkelijke creditoverdracht is gewijzigd, dubbel ingezet of niet meer uit betaald geld bewijsbaar.');
  const bronIds = [...new Set(r.regels.flatMap(x => x.betaalWaarheidIds || []))].sort();
  const bronFacturen = [...new Set(r.regels.flatMap(x => x.factuurId ? [x.factuurId] : x.bronFactuurIds || []))].sort();
  const gezien = { betalingen: new Set(), providers: new Set(bronIds.flatMap(x => aliases(betaalWaarheid[x]))) };
  const nummers = new Set(), ids = new Set(), uit = new Map(); let toegewezen = 0n;
  for (const f of eigen) {
    const x = f.abonnement, nr = x.termijn;
    if (!Number.isSafeInteger(nr) || nr < 1 || nr > 600 || nummers.has(nr) || !id(f.id) || ids.has(f.id))
      return fout('De credittermijnen hebben geen unieke, begrensde opeenvolgende identiteit.');
    nummers.add(nr); ids.add(f.id);
    const t = termijn(c, nr);
    if (f.id !== t.invoiceId || account(x.accountId) !== account(c.accountId) || x.valuta !== 'eur' ||
        x.aanbodHash !== a.hash || x.van !== t.van || x.tot !== t.tot ||
        x.origineelBrutoCenten !== t.origineelBrutoCenten || x.creditCenten !== t.creditCenten ||
        x.brutoCenten !== t.brutoCenten || f.bijdrage !== t.brutoCenten / 100 || f.status !== 'paid')
      return fout('De credittermijn wijkt af van de oorspronkelijke prijs, periode of werkelijk voldane verplichting.');
    let cash;
    if (t.brutoCenten === 0) {
      if (f.verrekend?.contractId !== c.id || f.verrekend.creditCenten !== t.creditCenten ||
          f.betaalBewijzen != null && (!Array.isArray(f.betaalBewijzen) || f.betaalBewijzen.length))
        return fout('Een nultermijn mist haar exacte verrekenontvangst of bevat onecht betaalbewijs.');
      cash = { ok: true, terug: 0n, ids: [] };
    } else {
      if (!Array.isArray(f.betaalBewijzen) || !f.betaalBewijzen.length || f.verrekend)
        return fout('Een hybride credittermijn mist haar werkelijke resterende betaling.');
      cash = betaling(f, account(c.accountId), betaalWaarheid, datum(op), gezien);
      if (!cash.ok) return cash;
      if (f.betaalBewijzen.some(b => betaalWaarheid[b.id].context.contractId !== c.id ||
          betaalWaarheid[b.id].context.termijn !== nr)) return fout('Het cashbewijs hoort niet bij deze credittermijn.');
    }
    toegewezen += BigInt(t.creditCenten);
    uit.set(f.id, { waardeCenten: t.origineelBrutoCenten, cash,
      ...(t.creditCenten ? { herkomst: { contractId: c.id, aanbodHash: a.hash,
        cashCenten: t.brutoCenten, creditCenten: t.creditCenten, bronContractId: v.bronContractId }, bronIds } : {}) });
  }
  // Een verdwenen of nog niet afgeronde eerdere termijn mag nooit beschikbaar
  // resttegoed worden. Dezelfde canonieke termijneigenaar bepaalt wat al opeisbaar is.
  const laatste = Math.max(0, ...nummers);
  for (let nr = 1; nr <= 601; nr++) {
    if (nr > 600) return fout('De credittermijnketen overschrijdt de controlegrens.');
    const t = termijn(c, nr), verschuldigd = datum(t.van) <= datum(op) && (!c.eindigtOp || datum(t.van) < datum(c.eindigtOp));
    if (!verschuldigd && nr > laatste) break;
    if (!nummers.has(nr)) return fout('Een reeds verschuldigde of tussenliggende credittermijn ontbreekt.');
  }
  if (toegewezen > BigInt(v.creditCenten)) return fout('Meer contractcredit gebruikt dan uit de bron betaald is.');
  const rest = Number(BigInt(v.creditCenten) - toegewezen);
  return { ok: true, facturen: uit, rest: rest ? { soort: 'resttegoed', creditId: c.id,
    bronContractId: v.bronContractId, aanbodHash: a.hash, toegepastAt: at,
    betaalWaarheidIds: bronIds, bronFactuurIds: bronFacturen, totaalCenten: v.creditCenten,
    toegewezenCenten: Number(toegewezen), beschikbaarCenten: rest } : null };
};

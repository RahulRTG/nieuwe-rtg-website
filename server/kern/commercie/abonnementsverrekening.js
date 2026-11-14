/* De zuivere rekenkant van een directe abonnementsupgrade. De aanroeper leest
   deze bronnen onder het bestaande collectieslot en reserveert het resultaat
   op het doelcontract. Dit bestand schrijft niets, int niets en geeft geen
   rechten. Het rekent nooit uit de actuele catalogus of een afgevinkte termijn.

   Factuur.abonnement bindt contractId, accountId, van/tot (ISO UTC), valuta en
   brutoCenten NA de oorspronkelijke korting aan de bestaande ledenfactuur.
   Zonder die bronbinding is oud betaald geld niet automatisch verrekenbaar.
   contracten bevat ook andere upgradevoorstellen: hun verrekening met dezelfde
   bronContractId en status GERESERVEERD/TOEGEPAST sluit de bronfactuur uit.
   Alle bronnen komen van de server, nooit uit het aanvraaglichaam. */
'use strict';

const { geld, id, datum, account, betaling, regelSleutel } = require('./abonnementsbewijs');
function onduidelijk(redenen, overgeslagen = []) {
  return { ok: false, controleNodig: true, redenen, regels: [], overgeslagen,
    beschikbaarCenten: null, creditCenten: null, teBetalenCenten: null, overCenten: null };
}

function bereken(input, pad) {
  const { contract, facturen, betaalWaarheid, contracten, op, doelCenten } = input;
  const eigenaar = account(contract && contract.accountId), tijd = datum(op);
  if (!contract || !id(contract.id) || !eigenaar || datum(contract.startAt) === null ||
      tijd === null || tijd < datum(contract.startAt) || !geld(doelCenten) ||
      !Array.isArray(facturen) || !Array.isArray(contracten) || !betaalWaarheid ||
      typeof betaalWaarheid !== 'object' || Array.isArray(betaalWaarheid))
    return onduidelijk(['Broncontract, eigenaar, tijd, doelbedrag of volledige bronverzameling ontbreekt.']);
  if (contract.eindigtOp && datum(contract.eindigtOp) === null)
    return onduidelijk(['De einddatum van het broncontract is ongeldig.']);
  if (pad.has(contract.id) || pad.size >= 64) return onduidelijk(['De creditbronketen is cyclisch of te diep.']);
  const vervolg = new Set([...pad, contract.id]);
  const credit = require('./abonnementscredit')(input, bron => bereken(bron, vervolg));
  if (!credit.ok) return onduidelijk(credit.redenen);

  const bezet = new Map(), redenen = [], overgeslagen = [];
  const eigenFacturen = new Set(facturen.filter(f => f?.abonnement?.contractId === contract.id).map(f => f.id));
  for (const c of contracten) {
    const v = c && c.verrekening;
    if (v && v.status !== 'VRIJGEGEVEN' && v.bronContractId !== contract.id && Array.isArray(v.regels) &&
        v.regels.some(r => r && (eigenFacturen.has(r.factuurId) || r.soort === 'resttegoed' && r.creditId === contract.id)))
      redenen.push('Een andere contractbron claimt dezelfde factuur of hetzelfde resttegoed.');
    if (!v || v.bronContractId !== contract.id || v.status === 'VRIJGEGEVEN') continue;
    if (!['GERESERVEERD', 'TOEGEPAST'].includes(v.status) || !id(c.id) ||
        account(c.accountId) !== eigenaar || !Array.isArray(v.regels) || !v.regels.length) {
      redenen.push('Een eerdere verrekening van dit contract heeft geen eenduidige eigenaar of stand.');
      continue;
    }
    for (const r of v.regels) {
      if (!r || !regelSleutel(r) || !geld(r.centen)) {
        redenen.push('Een eerdere verrekening mist een geldige bronfactuur of centen.'); continue;
      }
      if (r.centen > 0) bezet.set(regelSleutel(r), c.id);
    }
  }
  const regels = [], factuurIds = new Set(), betalingIds = new Set(), providerIds = new Set();
  let bronAantal = 0;
  for (const f of facturen) {
    if (!f || typeof f !== 'object') { redenen.push('Een factuurbron is ongeldig.'); continue; }
    const a = f.abonnement;
    if (!a) {
      if (/lidmaatschap|jaarbijdrage|maandbijdrage|abonnement/i.test(String(f.desc || '')))
        redenen.push('Factuur ' + (f.id || '?') + ' mist de oorspronkelijke contract- en periodebinding.');
      continue;
    }
    if (!id(a.contractId)) { redenen.push('Een abonnementsfactuur mist een geldig broncontract.'); continue; }
    if (a.contractId !== contract.id) continue;
    bronAantal++;
    const fout = tekst => redenen.push('Factuur ' + (f.id || '?') + ': ' + tekst);
    const van = datum(a.van), tot = datum(a.tot);
    if (!id(f.id) || factuurIds.has(f.id)) { fout('geen unieke factuuridentiteit.'); continue; }
    factuurIds.add(f.id);
    if (account(a.accountId) !== eigenaar || a.valuta !== 'eur' || van === null || tot === null ||
        van < datum(contract.startAt) || tot <= van || !geld(a.brutoCenten) ||
        typeof f.bijdrage !== 'number' || !Number.isFinite(f.bijdrage) ||
        Math.abs(f.bijdrage * 100 - a.brutoCenten) > 0.000001) {
      fout('eigenaar, valuta, serviceperiode of oorspronkelijke factuurprijs is niet bewezen.'); continue;
    }
    if (bezet.has('factuur:' + f.id)) {
      overgeslagen.push({ factuurId: f.id, reden: 'al-gereserveerd-of-toegepast', doelContractId: bezet.get('factuur:' + f.id) });
      continue;
    }
    if (tijd >= tot || (contract.eindigtOp && tijd >= datum(contract.eindigtOp))) {
      overgeslagen.push({ factuurId: f.id, reden: 'geen-ongebruikte-periode' }); continue;
    }
    const doorgeschoven = credit.facturen.get(f.id), bewijzen = f.betaalBewijzen;
    if (!doorgeschoven && (!Array.isArray(bewijzen) || !bewijzen.length)) {
      if (f.status === 'paid') fout('betaald gemarkeerd zonder gekoppeld betaalbewijs.');
      else overgeslagen.push({ factuurId: f.id, reden: 'niet-aantoonbaar-betaald' });
      continue;
    }
    const bewijs = doorgeschoven?.cash || betaling(f, eigenaar, betaalWaarheid, tijd, { betalingen: betalingIds, providers: providerIds });
    if (!bewijs.ok) { bewijs.redenen.forEach(fout); continue; }
    const terug = bewijs.terug, bronBetalingen = [...new Set([...bewijs.ids, ...(doorgeschoven?.bronIds || [])])];
    const waarde = doorgeschoven?.waardeCenten ?? a.brutoCenten;
    const ongebruiktVanaf = Math.max(tijd, van);
    // Naar beneden op hele centen; geen krediet voor een fractie cent. Refunds
    // geheel aftrekken is voorzichtig: hun verdeling over de periode is onbekend.
    const rato = BigInt(waarde) * BigInt(tot - ongebruiktVanaf) / BigInt(tot - van);
    const beschikbaar = Number(rato > terug ? rato - terug : 0n);
    regels.push({ factuurId: f.id, betaalWaarheidIds: bronBetalingen.sort(),
      van: a.van, tot: a.tot, ongebruiktVanaf: new Date(ongebruiktVanaf).toISOString(),
      brutoCenten: waarde, terugbetaaldCenten: Number(terug), beschikbaarCenten: beschikbaar,
      ...(doorgeschoven?.herkomst ? { creditHerkomst: doorgeschoven.herkomst } : {}) });
  }
  if (bronAantal === 0 && contract.afgesprokenCenten !== 0)
    redenen.push('Het bestaande contract heeft geen gekoppelde bronfactuur; ontbrekend bewijs is geen nulcredit.');
  regels.sort((a, b) => a.van.localeCompare(b.van) || a.factuurId.localeCompare(b.factuurId));
  for (let i = 1; i < regels.length; i++) if (regels[i].van < regels[i - 1].tot)
    redenen.push('De betaalde serviceperiodes overlappen; de bronverdeling vraagt controle.');
  if (credit.rest && !(contract.eindigtOp && tijd >= datum(contract.eindigtOp))) {
    const sleutel = regelSleutel(credit.rest);
    if (bezet.has(sleutel)) overgeslagen.push({ creditId: contract.id,
      reden: 'al-gereserveerd-of-toegepast', doelContractId: bezet.get(sleutel) });
    else regels.push(credit.rest);
  }
  const totaal = regels.reduce((som, r) => som + BigInt(r.beschikbaarCenten), 0n);
  if (totaal > BigInt(Number.MAX_SAFE_INTEGER)) redenen.push('Het totale bronbedrag is niet veilig uitdrukbaar in centen.');
  if (redenen.length) return onduidelijk(redenen, overgeslagen);
  let rest = doelCenten;
  for (const r of regels) {
    r.centen = Math.min(rest, r.beschikbaarCenten); rest -= r.centen;
    r.overCenten = r.beschikbaarCenten - r.centen;
  }
  const beschikbaarCenten = Number(totaal), creditCenten = doelCenten - rest;
  return { ok: true, controleNodig: false, redenen: [], regels, overgeslagen,
    beschikbaarCenten, creditCenten, teBetalenCenten: rest, overCenten: beschikbaarCenten - creditCenten };
}

function plan(input = {}) {
  try { return bereken(input, new Set()); }
  catch (_) { return onduidelijk(['De bronketen is onleesbaar of bevat ongeldige contract- of termijnvelden.']); }
}

module.exports = { plan };

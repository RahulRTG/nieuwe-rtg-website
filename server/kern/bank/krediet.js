/* RTG Bank, deel "krediet": leningen en creditcard-krediet. Een lid vraagt een
   lening aan; het kantoor beslist (mens beslist, nooit de AI). Bij goedkeuring
   stort de bank het bedrag op de rekening (vanaf extern:krediet) en ontstaat een
   openstaand saldo dat het lid aflost; de rente gaat naar rtg:reserve. Rood staan
   op de betaalrekening is de andere kredietvorm en zit al in de rekening-bodem.
   Krijgt de gedeelde ctx van kern/bank/index.js. */
module.exports = (ctx) => {
  const { db, save, crypto, nu, d, boek, rekMeta, bankregie, seintje } = ctx;

  const RENTE_BP = 700;              // 7% per jaar op de openstaande hoofdsom (standaard)
  const MAX_CENTEN = 5000000000;    // tot 50 miljoen euro (zakelijk kan groot)
  function kredieten() { if (!Array.isArray(d().bankKredieten)) d().bankKredieten = []; return d().bankKredieten; }
  const publiek = k => ({ id: k.id, iban: k.iban, bedragCenten: k.bedragCenten, restCenten: k.restCenten,
    looptijdMnd: k.looptijdMnd, renteBp: k.renteBp, status: k.status, aangevraagd: k.aangevraagd, besluitAt: k.besluitAt || null });

  function aanvraag({ iban, euro, looptijdMnd, codenaam }) {
    const m = rekMeta(iban);
    if (!m || (codenaam && m.codenaam !== String(codenaam).trim())) return { status: 404, error: 'De rekening bestaat niet.' };
    const centen = Math.round(Number(euro) * 100);
    if (!Number.isFinite(centen) || centen < 10000 || centen > MAX_CENTEN) return { status: 400, error: 'Vraag een lening tussen 100 en 50 miljoen euro aan.' };
    const mnd = Math.round(Number(looptijdMnd));
    if (!Number.isFinite(mnd) || mnd < 1 || mnd > 360) return { status: 400, error: 'Kies een looptijd tussen 1 en 360 maanden.' };
    const k = { id: 'KR' + crypto.randomBytes(5).toString('hex').toUpperCase(), iban, codenaam: m.codenaam,
      bedragCenten: centen, restCenten: 0, looptijdMnd: mnd, renteBp: RENTE_BP, status: 'aangevraagd', aangevraagd: nu() };
    kredieten().unshift(k);
    if (kredieten().length > 20000) kredieten().pop();
    save();
    seintje(m.codenaam);
    return { ok: true, krediet: publiek(k) };
  }
  function lijst(codenaam) {
    const c = String(codenaam || '').trim();
    return { ok: true, kredieten: kredieten().filter(k => k.codenaam === c).map(publiek) };
  }
  // het kantoor: alle openstaande aanvragen die een besluit nodig hebben
  function openstaand() {
    return { ok: true, aanvragen: kredieten().filter(k => k.status === 'aangevraagd').map(k => ({ ...publiek(k), codenaam: k.codenaam })) };
  }
  /* Het besluit (kantoor). Bij akkoord stort de bank de hoofdsom op de rekening
     en zet het openstaande saldo; bij afwijzing blijft er niets staan. */
  function besluit({ id, akkoord, wie }) {
    const k = kredieten().find(x => x.id === id);
    if (!k) return { status: 404, error: 'Deze aanvraag bestaat niet meer.' };
    if (k.status !== 'aangevraagd') return { status: 409, error: 'Over deze aanvraag is al beslist.' };
    if (akkoord !== true) { k.status = 'afgewezen'; k.besluitAt = nu(); save(); seintje(k.codenaam); return { ok: true, krediet: publiek(k) }; }
    const b = boek({ van: 'extern:krediet', naar: k.iban, centen: k.bedragCenten, soort: 'lening', oms: 'Lening ' + k.id, ref: (wie || 'kantoor') });
    if (b.error) return b;
    k.status = 'goedgekeurd'; k.restCenten = k.bedragCenten; k.besluitAt = nu();
    save();
    seintje(k.codenaam);
    return { ok: true, krediet: publiek(k) };
  }
  /* Aflossen: het afgeloste deel gaat terug naar extern:krediet, de rente over
     het afgeloste deel (naar rato van het jaartarief, één maand) naar rtg:reserve. */
  function aflossing({ id, centen, codenaam }) {
    const k = kredieten().find(x => x.id === id);
    if (!k || (codenaam && k.codenaam !== String(codenaam).trim())) return { status: 404, error: 'Deze lening bestaat niet.' };
    if (k.status !== 'goedgekeurd' || k.restCenten <= 0) return { status: 409, error: 'Op deze lening valt niets af te lossen.' };
    const c = Math.min(Math.round(Number(centen)), k.restCenten);
    if (!Number.isFinite(c) || c < 1) return { status: 400, error: 'Dat bedrag kan niet.' };
    const rente = Math.round(c * (k.renteBp / 10000) / 12);
    const b = boek({ van: k.iban, naar: 'extern:krediet', centen: c, soort: 'aflossing', oms: 'Aflossing ' + k.id });
    if (b.error) return b;
    if (rente > 0) boek({ van: k.iban, naar: 'rtg:reserve', centen: rente, soort: 'kredietrente', oms: 'Rente ' + k.id });
    k.restCenten -= c;
    if (k.restCenten <= 0) k.status = 'afgelost';
    save();
    seintje(k.codenaam);
    return { ok: true, krediet: publiek(k), rentebetaaldCenten: rente };
  }

  return { bankKredietAanvraag: aanvraag, bankKredieten: lijst, bankKredietOpenstaand: openstaand, bankKredietBesluit: besluit, bankKredietAflossing: aflossing };
};

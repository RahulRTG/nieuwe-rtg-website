/* RTG Bank, deel "passen": betaalpassen en creditcards op een rekening. Een pas is
   een instrument OP een rekening: uitgeven, bevriezen, een daglimiet, en betalen
   (dat boekt van de gekoppelde rekening naar extern:kaartbetaling en respecteert de
   bodem van de rekening, dus ook de rood-staan-ruimte bij een creditcard). Het volle
   pasnummer en de CVC bewaren we NOOIT -- alleen een gemaskeerd nummer en de laatste
   vier cijfers. Krijgt de gedeelde ctx van kern/bank/index.js. */
module.exports = (ctx) => {
  const { db, save, crypto, nu, d, boek, rekMeta, saldoVan, seintje } = ctx;

  const DAG_MS = 86400000;
  const SOORTEN = { debit: 'Betaalpas', credit: 'Creditcard' };
  function passen() { if (!d().bankPassen || typeof d().bankPassen !== 'object') d().bankPassen = {}; return d().bankPassen; }

  // Luhn-geldig 16-cijferig nummer met RTG-prefix; we tonen alleen gemaskeerd.
  function genPan() {
    let cijfers = '5355'; // RTG-reeks
    for (let i = 0; i < 11; i++) cijfers += crypto.randomInt(0, 10);
    let som = 0, dubbel = true;
    for (let i = cijfers.length - 1; i >= 0; i--) { let n = Number(cijfers[i]); if (dubbel) { n *= 2; if (n > 9) n -= 9; } som += n; dubbel = !dubbel; }
    cijfers += String((10 - (som % 10)) % 10);
    return cijfers;
  }
  const masker = pan => '•••• •••• •••• ' + pan.slice(-4);
  const publiek = p => ({ id: p.id, iban: p.iban, soort: p.soort, soortLabel: SOORTEN[p.soort], naam: p.naam,
    nummer: p.masker, laatste4: p.laatste4, bevroren: !!p.bevroren, dagLimietCenten: p.dagLimietCenten, geopend: p.geopend });
  const eigen = (p, codenaam) => p && (!codenaam || p.codenaam === String(codenaam).trim());

  function uitgeven({ iban, soort = 'debit', naam, codenaam }) {
    const m = rekMeta(iban);
    if (!m || (codenaam && m.codenaam !== String(codenaam).trim())) return { status: 404, error: 'De rekening bestaat niet.' };
    if (!SOORTEN[soort]) return { status: 400, error: 'Kies een betaalpas of creditcard.' };
    if (Object.values(passen()).filter(p => p.codenaam === m.codenaam).length >= 20) return { status: 429, error: 'Het maximaal aantal passen is bereikt.' };
    const pan = genPan();
    const pas = { id: 'PAS' + crypto.randomBytes(5).toString('hex').toUpperCase(), iban, codenaam: m.codenaam, soort,
      naam: String(naam || SOORTEN[soort]).replace(/[<>]/g, '').slice(0, 40), masker: masker(pan), laatste4: pan.slice(-4),
      bevroren: false, dagLimietCenten: 100000, besteed: 0, besteedDag: 0, geopend: nu() };
    passen()[pas.id] = pas;
    save();
    seintje(m.codenaam);
    return { ok: true, pas: publiek(pas) };
  }
  function lijst(codenaam) {
    const c = String(codenaam || '').trim();
    return { ok: true, passen: Object.values(passen()).filter(p => p.codenaam === c).sort((a, b) => a.geopend - b.geopend).map(publiek) };
  }
  function bevries(id, aan, codenaam) {
    const p = passen()[id];
    if (!eigen(p, codenaam)) return { status: 404, error: 'De pas bestaat niet.' };
    p.bevroren = aan === true;
    save();
    seintje(p.codenaam);
    return { ok: true, id, bevroren: p.bevroren };
  }
  function limiet(id, euro, codenaam) {
    const p = passen()[id];
    if (!eigen(p, codenaam)) return { status: 404, error: 'De pas bestaat niet.' };
    const centen = Math.round(Number(euro) * 100);
    if (!Number.isFinite(centen) || centen < 0 || centen > 5000000) return { status: 400, error: 'Kies een daglimiet tot 50.000 euro.' };
    p.dagLimietCenten = centen;
    save();
    return { ok: true, id, dagLimietCenten: centen };
  }
  function sluit(id, codenaam) {
    const p = passen()[id];
    if (!eigen(p, codenaam)) return { status: 404, error: 'De pas bestaat niet.' };
    delete passen()[id];
    save();
    seintje(p.codenaam);
    return { ok: true, gesloten: id };
  }
  /* Betalen met de pas: bevroren kan niet, de daglimiet wordt bewaakt, en de
     boeking gaat van de gekoppelde rekening naar extern:kaartbetaling (de bodem
     van de rekening -- inclusief rood staan -- geldt gewoon). */
  function betaal({ id, centen, oms, codenaam }) {
    const p = passen()[id];
    if (!eigen(p, codenaam)) return { status: 404, error: 'De pas bestaat niet.' };
    if (p.bevroren) return { status: 423, error: 'Deze pas is bevroren.' };
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < 1) return { status: 400, error: 'Dat bedrag kan niet.' };
    const vandaag = Math.floor(nu() / DAG_MS);
    if (p.besteedDag !== vandaag) { p.besteedDag = vandaag; p.besteed = 0; }
    if (p.dagLimietCenten > 0 && p.besteed + c > p.dagLimietCenten) return { status: 429, error: 'De daglimiet van deze pas is bereikt.' };
    const b = boek({ van: p.iban, naar: 'extern:kaartbetaling', centen: c, soort: 'pasbetaling', oms: oms || ('Pasbetaling ' + p.laatste4) });
    if (b.error) return b;
    p.besteed += c;
    save();
    seintje(p.codenaam);
    return { ok: true, id, saldoCenten: saldoVan(p.iban), besteedVandaagCenten: p.besteed };
  }

  return { bankPasUitgeven: uitgeven, bankPassen: lijst, bankPasBevries: bevries, bankPasLimiet: limiet, bankPasSluit: sluit, bankPasBetaal: betaal };
};

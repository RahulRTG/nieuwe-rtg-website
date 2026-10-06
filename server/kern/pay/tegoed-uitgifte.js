/* UITGEVEN EN ROTEREN (kern/pay/tegoed-uitgifte.js): de twee momenten waarop
   een kale tegoedcode bestaat.

   UITGEVEN gebeurt binnen metIdem van de koop (./tegoed.js, ./tegoed-zaak.js):
   de boeking naar de escrow, de bon en de idem-sleutel landen daar als EEN
   duurzame bundel (lib/idem.js). Maar metIdem BEWAART zijn antwoord, om het
   bij een herhaling terug te geven -- en een bewaard antwoord met een kale code
   erin is de kale code op schijf, alleen in een andere collectie. Daarom geeft
   het werk de code NIET terug: `uitgeef()` legt hem in een doosje dat alleen
   deze aanroep ziet, en `metCode()` hangt hem pas NA metIdem aan een KOPIE van
   het antwoord. Een herhaling krijgt het bewaarde antwoord, zonder code, en
   de uitleg dat roteren de weg is.

   ROTEREN loopt door de collectietransactie: de oude toegang wordt
   ingetrokken (en blijft als hash in `historie`), er komt een nieuwe van 128
   bits met dezelfde vervaldatum, en dezelfde idempotentiesleutel levert een
   409 zonder code in plaats van een tweede nieuwe code. */
'use strict';

module.exports = ({ bon, crypto }) => {
  const { transactie, nieuweToegang, roteerToegang, verlopen, naarBuiten, iso } = bon;
  const afdruk = s => crypto.createHash('sha256').update(String(s)).digest('hex');

  /* Een nieuwe bon met een verse toegang; de kale code gaat in `doos`. */
  function uitgeef(rij, issuer, doos) {
    const t = Object.assign({}, rij, { status: 'open', claim: null, historie: [] });
    const g = nieuweToegang(issuer, t.id, t.at + bon.VERVAL_MS);
    t.toegang = g.toegang;
    doos.code = g.code;
    return t;
  }

  function metCode(r, doos) {
    if (!r || !r.ok || r.herhaald || !doos.code) {
      return r && r.herhaald
        ? Object.assign({}, r, { codeGetoond: false,
          uitleg: 'De code is alleen bij de eerste keer getoond. Kwijt? Vraag een nieuwe code aan; de oude vervalt dan.' })
        : r;
    }
    return Object.assign({}, r, { eenmalig: true, tegoed: Object.assign({}, r.tegoed, { code: doos.code }) });
  }

  async function roteer({ vind, door, idem }) {
    const sleutel = String(idem || '').trim().slice(0, 200);
    if (!sleutel) return { status: 400, code: 'IDEMPOTENTIESLEUTEL_VERPLICHT',
      error: 'Een nieuwe code vraagt een idempotentiesleutel: hij wordt maar een keer getoond.' };
    const idemHash = afdruk('pay-tegoed-roteer|' + door + '|' + sleutel);
    return transactie(bron => {
      const t = vind(bron);
      if (!t) return { status: 404, error: 'Dit tegoed is niet van jou.' };
      if (t.laatste_rotatie && t.laatste_rotatie.idem_hash === idemHash)
        return { status: 409, herhaald: true, tegoed: naarBuiten(t),
          error: 'De nieuwe code is al een keer getoond en wordt niet herhaald. Vraag opnieuw een nieuwe code aan.' };
      if (t.status !== 'open') return { status: 409, error: 'Dit tegoed staat niet meer open.' };
      if (verlopen(t)) return { status: 409, error: 'Dit tegoed is verlopen; neem het terug in plaats van een nieuwe code te maken.' };
      let g;
      try { g = roteerToegang(t.toegang, door); } catch (e) {
        if (e.code === 'geldigheid-ongeldig') return { status: 409, error: 'Dit tegoed is verlopen; neem het terug in plaats van een nieuwe code te maken.' };
        throw e;
      }
      t.historie = (Array.isArray(t.historie) ? t.historie : []).concat([{
        code_hash: t.toegang.code_hash, ingetrokken_at: t.toegang.ingetrokken_at, rotatie: t.toegang.rotatie
      }]).slice(-12);
      t.toegang = g.toegang;
      t.legacy96 = false;
      t.laatste_rotatie = { idem_hash: idemHash, at: iso() };
      const uit = naarBuiten(t);
      uit.code = g.code;
      return { ok: true, eenmalig: true, tegoed: uit };
    });
  }

  return { uitgeef, metCode, roteer };
};

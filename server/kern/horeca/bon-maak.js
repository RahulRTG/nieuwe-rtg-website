/* De horecabon (deellaag van ./bon.js): UITGEVEN -- een cadeaubon of tegoed
   maken, en een polsband maken of opwaarderen. Elk in een collectietransactie
   op `horecaBonnen`; de kale code bestaat alleen in de terugkeerwaarde, en een
   herhaling met dezelfde idempotentiesleutel krijgt de bon zonder code. */
'use strict';

module.exports = ({ transactie, geldig, mutatie, t, heel, crypto }) => {
  const { afdruk, sleutel, nieuweBonToegang, naarBuiten, nu } = t;

  /* Een nieuwe bon. `idem` maakt een herhaling tot DEZELFDE bon -- zonder
     code: die is een keer getoond, en wie hem kwijt is laat de zaak roteren. */
  function maak({ zaak, soort, centen, naam, geldigTot, door, idem }) {
    const s = sleutel(idem);
    const idemHash = s ? afdruk('hb-maak-v1|' + zaak + '|' + s) : null;
    return transactie(bron => {
      const eerder = idemHash ? bron.find(b => b && b.zaak === zaak && b.maak_idem === idemHash) : null;
      if (eerder) return { ok: true, herhaald: true, codeGetoond: false, bon: naarBuiten(eerder) };
      // herkomst: wie de waarde uitgaf (de zaak zelf; de bon loopt niet door kern/pay)
      const bon = { id: 'HB' + crypto.randomBytes(8).toString('hex'), zaak, herkomst: 'zaak:' + zaak, soort: soort === 'tegoed' ? 'tegoed' : 'cadeaubon',
        band: null, naam: String(naam || '').slice(0, 60) || null, uitgegeven: heel(centen), saldo: heel(centen),
        at: nu(), door: String(door || '').slice(0, 80), mutaties: [], historie: [], binding: null, maak_idem: idemHash };
      const g = nieuweBonToegang('zaak:' + zaak, bon, geldigTot);
      bon.toegang = g.toegang;
      bron.zet(bon);
      return { ok: true, eenmalig: true, code: g.code, bon: naarBuiten(bon) };
    });
  }

  /* De polsband: bestaat er al een levende band met dit nummer bij deze zaak,
     dan wordt hij opgewaardeerd (geen code); anders ontstaat hij (code een
     keer). In een transactie, dus twee kassa's die tegelijk dezelfde nieuwe
     band opwaarderen maken er een en niet twee. */
  function band({ zaak, nummer, centen, door, idem }) {
    const bedrag = heel(centen);
    const s = sleutel(idem);
    const idemHash = s ? afdruk('hb-band-v1|' + zaak + '|' + nummer + '|' + s) : null;
    return transactie(bron => {
      const bestaand = bron.find(b => b && b.zaak === zaak && b.band === nummer && !(b.toegang && b.toegang.ingetrokken_at));
      if (bestaand) {
        // dezelfde tik nog een keer: geen tweede opwaardering en geen code
        if (idemHash && (bestaand.maak_idem === idemHash || (bestaand.mutaties || []).some(m => m && m.idem_hash === idemHash)))
          return { ok: true, nieuw: false, herhaald: true, bon: naarBuiten(bestaand) };
        const fout = geldig(bestaand, { negeerGebruik: true });
        if (fout) return fout;
        bestaand.saldo += bedrag; bestaand.uitgegeven += bedrag;
        if (bedrag) mutatie(bestaand, { centen: bedrag, soort: 'opgewaardeerd', idem_hash: idemHash });
        return { ok: true, nieuw: false, bon: naarBuiten(bestaand) };
      }
      const bon = { id: 'HB' + crypto.randomBytes(8).toString('hex'), zaak, herkomst: 'zaak:' + zaak, soort: 'tegoed', band: nummer,
        naam: 'Polsband ' + nummer, uitgegeven: bedrag, saldo: bedrag, at: nu(), door: String(door || '').slice(0, 80),
        mutaties: [], historie: [], binding: null, maak_idem: idemHash };
      const g = nieuweBonToegang('zaak:' + zaak, bon);
      bon.toegang = g.toegang;
      bron.zet(bon);
      return { ok: true, nieuw: true, eenmalig: true, code: g.code, bon: naarBuiten(bon) };
    });
  }

  return { maak, band };
};

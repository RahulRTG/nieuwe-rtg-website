/* De horecabon (deellaag van ./bon.js): opzoeken, koppelen aan een
   gastsessie, intrekken, roteren, een afboeking terugzetten en een band leeg
   uitbetalen. Elk in een eigen collectietransactie op
   `horecaBonnen`; de claim zelf staat in ./bon.js.

   KOPPELEN IS HET BEWIJS DAT DE BON VAN JOU IS. Een gast met de code in de hand
   bindt de bon aan de deelnemer van zijn open rekening (de hash van zijn
   tafelsessie). Zolang die rekening open is, kan GEEN andere sessie dezelfde
   bon koppelen: wie een code afkijkt, kan hem niet tegelijk gebruiken. De
   binding eindigt vanzelf als de rekening sluit, en een rotatie door de zaak
   verbreekt haar meteen (een gast die zijn telefoon kwijt is, gaat naar de bar). */
'use strict';

module.exports = ({ transactie, zoekIn, vanId, geldig, mutatie, t }) => {
  const { bearer, afdruk, sleutel, nieuweBonToegang, naarBuiten, nu } = t;

  /* Kijken schept niets: de zaak ziet saldo en de laatste mutaties, nooit de code. */
  function lees({ zaak, code }) {
    return transactie(bron => {
      const v = zoekIn(bron, zaak, code);
      return v.error ? v : { ok: true, bon: naarBuiten(v.bon) };
    });
  }

  /* `leeft(binding)` vertelt of de rekening van een bestaande binding nog open
     is; dat weet alleen de horecalaag. */
  function koppel({ zaak, code, rekeningId, deelnemer, leeft }) {
    if (!rekeningId || !deelnemer) return Promise.resolve({ status: 401, error: 'Geen tafelsessie.', code: 'sessie-weg' });
    return transactie(bron => {
      const v = zoekIn(bron, zaak, code);
      if (v.error) return v;
      const b = v.bon;
      const fout = geldig(b, { negeerGebruik: true });
      if (fout) return fout;
      const nu0 = b.binding;
      const zelfde = nu0 && nu0.rekeningId === rekeningId && nu0.deelnemer === deelnemer;
      if (nu0 && !zelfde && leeft(nu0))
        return { status: 409, error: 'Deze bon is al aan een andere telefoon gekoppeld. Vraag de bediening.', code: 'bon-elders-gekoppeld' };
      // een sessie draagt een bon tegelijk: een eerdere koppeling van deze sessie vervalt
      for (const x of bron) if (x !== b && x && x.binding && x.binding.rekeningId === rekeningId &&
        x.binding.deelnemer === deelnemer) x.binding = null;
      b.binding = { zaak, rekeningId, deelnemer, at: nu() };
      return { ok: true, bon: naarBuiten(b) };
    });
  }

  /* De vinder voor de claim van een gast: alleen de bon die aan DEZE sessie
     hangt. Er is geen tweede weg -- een code in het verzoek opent hier niets. */
  const opSessie = (zaak, rekeningId, deelnemer) => bron => {
    let bon = null;
    for (const x of bron) if (x && x.zaak === zaak && x.binding && x.binding.rekeningId === rekeningId &&
      x.binding.deelnemer === deelnemer) bon = x;
    return bon ? { bon } : { status: 409, error: 'Koppel eerst je bon of polsband: scan de code en druk op "Saldo bekijken".', code: 'bon-niet-gekoppeld' };
  };

  /* Intrekken zonder nieuwe code (gestolen, verloren). Het saldo blijft staan:
     het is geld van de houder, en een rotatie geeft hem een nieuwe code. */
  function intrek({ zaak, id, door, reden }) {
    return transactie(bron => {
      const b = vanId(bron, zaak, id);
      if (!b) return { status: 404, error: 'Deze bon kennen we niet.', code: 'bon-onbekend' };
      bearer.intrekken(b.toegang, door, reden || 'ingetrokken door de zaak');
      b.binding = null;
      return { ok: true, bon: naarBuiten(b) };
    });
  }

  /* Roteren: de oude hash naar de historie (opent niets meer), een nieuwe code
     met dezelfde vervaldatum en teller alleen in dit antwoord, en de binding
     verbroken. Dezelfde sleutel geeft 409 zonder code. */
  function roteer({ zaak, id, door, idem }) {
    const s = sleutel(idem);
    if (!s) return Promise.resolve({ status: 400, code: 'IDEMPOTENTIESLEUTEL_VERPLICHT',
      error: 'Een nieuwe code vraagt een idempotentiesleutel: hij wordt maar een keer getoond.' });
    const idemHash = afdruk('hb-roteer-v1|' + zaak + '|' + s);
    return transactie(bron => {
      const b = vanId(bron, zaak, id);
      if (!b) return { status: 404, error: 'Deze bon kennen we niet.', code: 'bon-onbekend' };
      if (b.laatste_rotatie && b.laatste_rotatie.idem_hash === idemHash)
        return { status: 409, herhaald: true, bon: naarBuiten(b), code: 'bon-al-geroteerd',
          error: 'De nieuwe code is al een keer getoond en wordt niet herhaald. Roteer opnieuw.' };
      if (bearer.reden(b.toegang, { negeerGebruik: true }) === 'verlopen')
        return { status: 409, error: 'Deze bon is verlopen.', code: 'bon-verlopen' };
      if (!(b.saldo > 0)) return { status: 409, error: 'Op deze bon staat niets meer.', code: 'bon-leeg' };
      const oud = b.toegang;
      bearer.intrekken(oud, door, 'geroteerd');
      b.historie = (b.historie || []).concat([{ code_hash: oud.code_hash, ingetrokken_at: oud.ingetrokken_at,
        rotatie: oud.rotatie }]).slice(-12);
      const n = nieuweBonToegang(oud.issuer, b);
      n.toegang.expires_at = oud.expires_at;
      n.toegang.rotatie = (Number(oud.rotatie) || 1) + 1;
      n.toegang.gebruik = oud.gebruik;
      n.toegang.max_gebruik = oud.max_gebruik;
      b.toegang = n.toegang;
      b.legacy32 = false;
      b.binding = null;
      b.laatste_rotatie = { idem_hash: idemHash, at: nu() };
      mutatie(b, { centen: 0, soort: 'geroteerd' });
      return { ok: true, eenmalig: true, code: n.code, bon: naarBuiten(b) };
    });
  }

  /* Een afboeking terugzetten (de betaling erna kon niet meer): het saldo komt
     terug, de afboeking blijft zichtbaar met `hersteld`. Een keer. */
  function herstel({ zaak, id, ref }) {
    return transactie(bron => {
      const b = vanId(bron, zaak, id);
      const m = b && (b.mutaties || []).find(x => x && x.ref === ref && x.soort === 'afgeboekt');
      if (!m) return { status: 404, error: 'Deze afboeking kennen we niet.' };
      if (m.hersteld) return { ok: true, herhaald: true, saldo: b.saldo };
      m.hersteld = nu(); b.saldo += -m.centen;
      mutatie(b, { centen: -m.centen, soort: 'hersteld', ref });
      return { ok: true, saldo: b.saldo };
    });
  }

  /* Het restsaldo van een band terug naar de gast: op nul, in de transactie. */
  function leeg({ zaak, id }) {
    return transactie(bron => {
      const b = vanId(bron, zaak, id);
      if (!b) return { status: 404, error: 'Het tegoed van deze band is niet gevonden.' };
      if (!b.saldo) return { status: 409, error: 'Er staat niets meer op deze band.' };
      const terug = b.saldo; b.saldo = 0;
      mutatie(b, { centen: -terug, soort: 'uitbetaald' });
      return { ok: true, uitbetaald: terug, bon: naarBuiten(b) };
    });
  }

  return { lees, koppel, opSessie, intrek, roteer, herstel, leeg };
};

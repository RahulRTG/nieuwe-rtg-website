/* RTG Pay, de ZAAKKANT van het tegoed: een zaak zet tegoed klaar voor
   personeel of klanten.

   Dezelfde bon als in ./tegoed.js, dezelfde escrow-rekening en dezelfde
   vervaldatum. Wat anders is, is de BETALER, en dat zijn precies twee dingen:

   1. Een zaak heeft geen autolaad. Het saldo van een partnerrekening is echte
      omzet die naar zijn bank kan; er staat geen kaart achter die bijspringt.
      Niet genoeg saldo is hier dus gewoon niet genoeg, en dat weigert het
      grootboek zelf (een partnerrekening kan nooit onder nul).
   2. Een zaak heeft geen codenaam. In `van` staat een zaakcode, en daarom
      draagt de bon `vanSoort: 'zaak'`: zonder dat veld zou een zaakcode die
      toevallig gelijk is aan een codenaam, in het overzicht van een lid
      opduiken -- en erger, door dat lid teruggenomen kunnen worden. DAT GEVAL
      STAAT OP GEEN ENKELE TOETS: de proefinlog levert een zaakcode die per
      ongeluk nooit een codenaam is, dus `vanSoort` weghalen laat alle toetsen
      groen. Het is hier een grendel op vertrouwen, en dat hoort iemand te weten
      voordat hij hem "overbodig" noemt.

   WAAROM DIT EEN EIGEN BESTAND IS: ./tegoed.js zat met deze twee verschillen
   erbij tegen de grens uit keuringsregel 13 aan, en de vork zou in elke functie
   apart staan. Krijgt de gedeelde ctx van kern/pay/index.js plus de bon-helpers
   van ./tegoed.js. */
'use strict';

module.exports = (ctx, gedeeld) => {
  const { save, schoon, nu, rekPartner, saldoVan, id, metIdem, boekAsync, seintje, bestaatLid,
    MIN_CENTEN, MAX_CENTEN } = ctx;
  const { bonnen, bewaar, nieuweCode, naarBuiten, REK_TEGOED, VERVAL_MS } = gedeeld;

  /* ---------- de zaak zet tegoed klaar ---------- */
  async function tegoedZaakKoop({ supplierCode, centen, aanCodenaam, oms, idem }) {
    const zaak = schoon(supplierCode, 40);
    if (!zaak) return { status: 400, error: 'Welke zaak zet dit klaar?' };
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };
    const aan = schoon(aanCodenaam, 40) || null;
    if (aan && !(await bestaatLid(aan))) return { status: 404, error: 'Die codenaam kennen we niet.' };
    return metIdem(idem ? 'tegoedzaak:' + zaak + ':' + idem : null,
      'tegoedzaak|' + zaak + '|' + c + '|' + (aan || ''), async () => {
        /* Geen zorgSaldo hier, en dat is het hele verschil met de ledenkant:
           een zaak die te weinig heeft, hoort een 402 te krijgen en geen
           kaartbetaling die niemand heeft goedgekeurd. */
        const b = await boekAsync({ van: rekPartner(zaak), naar: REK_TEGOED, centen: c, soort: 'tegoed', oms: oms || 'Tegoed klaargezet' });
        if (b.error) return b;
        const t = {
          id: id('TG'), code: nieuweCode(), van: zaak, vanSoort: 'zaak', aan, centen: c,
          oms: schoon(oms, 80) || 'Tegoed', status: 'open',
          at: nu(), vervalt: nu() + VERVAL_MS, boeking: b.boeking.id
        };
        bewaar(t);
        if (aan) seintje(aan);
        return { ok: true, tegoed: naarBuiten(t), saldo: saldoVan(rekPartner(zaak)) };
      });
  }

  /* ---------- verlopen tegoed terug naar de zaak ----------
     Zelfde regel als bij een lid: het geld gaat terug naar wie het betaalde en
     niet naar RTG, en niet vanzelf. */
  async function tegoedZaakTerug({ supplierCode, tegoedId, idem }) {
    const zaak = schoon(supplierCode, 40);
    const t = bonnen().find(x => x.id === String(tegoedId || '') && x.vanSoort === 'zaak' && x.van === zaak);
    if (!t) return { status: 404, error: 'Dit tegoed is niet van deze zaak.' };
    if (t.status !== 'open') return { status: 409, error: 'Dit tegoed staat niet meer open.' };
    if (t.vervalt >= nu()) return { status: 409, error: 'Dit tegoed loopt nog; terugnemen kan pas na de vervaldatum.' };
    return metIdem(idem ? 'tegoedzaakterug:' + zaak + ':' + idem : null,
      'tegoedzaakterug|' + zaak + '|' + t.id, async () => {
        // Synchroon claimen vóór de await, en zonder save(); zie tegoedVerzilver
        // in ./tegoed.js waarom die claim niet op schijf hoort te landen.
        t.status = 'bezig';
        const b = await boekAsync({ van: REK_TEGOED, naar: rekPartner(zaak), centen: t.centen, soort: 'tegoed', oms: 'Verlopen tegoed terug', ref: t.id });
        if (b.error) { t.status = 'open'; return b; }
        t.status = 'terug';
        t.terugAt = nu();
        save();
        return { ok: true, centen: t.centen, saldo: saldoVan(rekPartner(zaak)), tegoed: naarBuiten(t) };
      });
  }

  function tegoedZaakOverzicht(supplierCode) {
    const zaak = schoon(supplierCode, 40);
    const eigen = bonnen().filter(t => t.vanSoort === 'zaak' && t.van === zaak).slice(0, 50).map(t => {
      const r = naarBuiten(t);
      if (r.status !== 'open') r.code = null;
      return r;
    });
    const openCenten = eigen.filter(t => t.status === 'open').reduce((s, t) => s + t.centen, 0);
    return { ok: true, klaargezet: eigen, openCenten, vervalDagen: Math.round(VERVAL_MS / 86400000) };
  }

  return { tegoedZaakKoop, tegoedZaakTerug, tegoedZaakOverzicht };
};

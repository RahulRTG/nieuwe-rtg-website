/* RTG Pay, de ZAAKKANT van het tegoed: een zaak zet tegoed klaar voor
   personeel of klanten.

   Dezelfde bon als in ./tegoed.js, dezelfde escrow, dezelfde saga en dezelfde
   vervaldatum (alles in ./tegoed-gedeeld.js). Wat anders is, is de BETALER,
   en dat zijn precies twee dingen:

   1. Een zaak heeft geen autolaad. Het saldo van een partnerrekening is echte
      omzet die naar zijn bank kan; er staat geen kaart achter die bijspringt.
      Niet genoeg saldo is hier dus gewoon niet genoeg, en dat weigert het
      grootboek zelf (een partnerrekening kan nooit onder nul).
   2. Een zaak heeft geen codenaam. In `van` staat een zaakcode, en daarom
      draagt de bon `vanSoort: 'zaak'`: zonder dat veld zou een zaakcode die
      toevallig gelijk is aan een codenaam, in het overzicht van een lid
      opduiken -- en erger, door dat lid teruggenomen kunnen worden. DAT GEVAL
      STAAT OP GEEN ENKELE TOETS: de proefinlog levert een zaakcode die per
      ongeluk nooit een codenaam is. Het is hier een grendel op vertrouwen, en
      dat hoort iemand te weten voordat hij hem "overbodig" noemt.

   Krijgt de gedeelde ctx van kern/pay/index.js plus ./tegoed-gedeeld.js. */
'use strict';

module.exports = (ctx, g) => {
  const { schoon, nu, rekPartner, saldoVan, id, metIdem, boekAsync, seintje, bestaatLid,
    MIN_CENTEN, MAX_CENTEN } = ctx;
  const { bon, migratie, uitgifte } = g;
  const { naarBuiten, kijk, REK_TEGOED, VERVAL_MS } = bon;
  const vanZaak = (zaak, tid) => bron => {
    const t = bron[String(tid || '')];
    return t && t.vanSoort === 'zaak' && t.van === zaak ? t : null;
  };

  /* ---------- de zaak zet tegoed klaar ---------- */
  async function tegoedZaakKoop({ supplierCode, centen, aanCodenaam, oms, idem }) {
    const zaak = schoon(supplierCode, 40);
    if (!zaak) return { status: 400, error: 'Welke zaak zet dit klaar?' };
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };
    const aan = schoon(aanCodenaam, 40) || null;
    if (aan && !(await bestaatLid(aan))) return { status: 404, error: 'Die codenaam kennen we niet.' };
    await migratie.zorg();
    const doos = {};
    const r = await metIdem(idem ? 'tegoedzaak:' + zaak + ':' + idem : null,
      'tegoedzaak|' + zaak + '|' + c + '|' + (aan || ''), async () => {
        /* Geen zorgSaldo hier, en dat is het hele verschil met de ledenkant:
           een zaak die te weinig heeft, hoort een 402 te krijgen en geen
           kaartbetaling die niemand heeft goedgekeurd. */
        const b = await boekAsync({ van: rekPartner(zaak), naar: REK_TEGOED, centen: c, soort: 'tegoed', oms: oms || 'Tegoed klaargezet' });
        if (b.error) return b;
        const t = uitgifte.uitgeef({ id: id('TG'), van: zaak, vanSoort: 'zaak', aan, centen: c,
          oms: schoon(oms, 80) || 'Tegoed', at: nu(), boeking: b.boeking.id }, 'zaak:' + zaak, doos);
        g.bewaarNieuw(t);
        if (aan) seintje(aan);
        return { ok: true, tegoed: naarBuiten(t), saldo: saldoVan(rekPartner(zaak)) };
      });
    return uitgifte.metCode(r, doos);
  }

  /* ---------- terug naar de kas: na de vervaldatum, of ingetrokken ervoor ----------
     Zelfde regel als bij een lid: het geld gaat terug naar wie het betaalde en
     niet naar RTG, en niet vanzelf. */
  function tegoedZaakTerug({ supplierCode, tegoedId, intrekken, idem }) {
    const zaak = schoon(supplierCode, 40);
    return g.terug({ vind: vanZaak(zaak, tegoedId),
      door: 'zaak:' + zaak, naar: rekPartner(zaak), intrekken, idem,
      saldo: () => saldoVan(rekPartner(zaak)) });
  }

  function tegoedZaakRoteer({ supplierCode, tegoedId, idem }) {
    const zaak = schoon(supplierCode, 40);
    return g.roteer({ vind: vanZaak(zaak, tegoedId),
      door: 'zaak:' + zaak, idem });
  }

  async function tegoedZaakOverzicht(supplierCode) {
    const zaak = schoon(supplierCode, 40);
    await migratie.zorg();
    const eigen = Object.values(kijk()).filter(t => t.vanSoort === 'zaak' && t.van === zaak)
      .sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 50).map(naarBuiten);
    const openCenten = eigen.filter(t => t.status === 'open').reduce((s, t) => s + t.centen, 0);
    return { ok: true, klaargezet: eigen, openCenten, vervalDagen: Math.round(VERVAL_MS / 86400000) };
  }

  return { tegoedZaakKoop, tegoedZaakTerug, tegoedZaakRoteer, tegoedZaakOverzicht };
};

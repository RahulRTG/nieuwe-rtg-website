/* RTG Pay, deelbestand "tegoed": een lid koopt tegoed voor iemand anders --
   en sinds het besluit van 27 september 2026 de basis onder de prepaid
   opwaardeerkaart.

   Waarom dit naast ./verzoeken.js staat en er geen variant van is: een Klompje
   VRAAGT geld van iemand die het nog heeft, dit ZET geld vast dat de koper al
   heeft. Een tegoed verplaatst meteen, en de ontvanger is dan nog niet bekend.

   DE ESCROW-REKENING. Gekocht tegoed staat op 'extern:tegoed' tot iemand het
   verzilvert, de koper het terugneemt of intrekt. Het grootboek bewaakt die
   rekening niet (boek() slaat de saldocontrole over voor 'extern:'), dus wat
   tegenhoudt dat dezelfde euro twee keer uit de escrow gaat is de STAAT VAN DE
   BON -- en die staat in een collectietransactie (./tegoed-bon.js) met een
   hervatbare saga eromheen (./tegoed-claim.js), niet meer in het geheugen van
   een proces.

   DE CODE bestaat een keer: in het antwoord op de koop of op een rotatie.
   Daarna alleen als hash; het overzicht toont hem niet meer. Wie hem kwijt is,
   vraagt een nieuwe (`tegoedRoteer`) en de oude is dan dood. Een gericht
   tegoed heeft geen code nodig: de ontvanger haalt het op met het id, en zijn
   sessie is het bewijs.

   WAT DIT NIET IS. Geen bestemming ("alleen voor Reizen"): dat vraagt een
   tweede saldo-dimensie in het grootboek. Zie TOKEN.md.

   Krijgt de gedeelde ctx van kern/pay/index.js. */
'use strict';

module.exports = (ctx) => {
  const { schoon, nu, rekLid, saldoVan, id, metIdem, boekAsync, betaalMetDekking, seintje, bestaatLid,
    MIN_CENTEN, MAX_CENTEN } = ctx;
  const g = require('./tegoed-gedeeld')(ctx);
  const { bon, claim, migratie, uitgifte } = g;
  const { naarBuiten, zoek, kijk, verlopen, REK_TEGOED, VERVAL_MS } = bon;

  /* ---------- kopen: geld uit de wallet, vast op de escrow ---------- */
  async function tegoedKoop({ codenaam, centen, aanCodenaam, oms, idem }) {
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };
    const aan = schoon(aanCodenaam, 40) || null;
    /* Een gericht tegoed voor een codenaam die niet bestaat is geld dat niemand
       ooit kan ophalen. Dat hoort een 404 te zijn en geen bon. */
    if (aan && !(await bestaatLid(aan))) return { status: 404, error: 'Die codenaam kennen we niet.' };
    if (aan && aan === codenaam) return { status: 400, error: 'Tegoed voor jezelf is gewoon je saldo.' };
    await migratie.zorg();
    const doos = {};
    const r = await metIdem(idem ? 'tegoedkoop:' + codenaam + ':' + idem : null,
      'tegoedkoop|' + codenaam + '|' + c + '|' + (aan || ''), async () => {
        const { z, b } = await betaalMetDekking({ codenaam, centen: c, idem,
          boeking: { van: rekLid(codenaam), naar: REK_TEGOED, centen: c, soort: 'tegoed', oms: oms || 'Tegoed gekocht' } });
        if (z.error) return z;
        if (b.error) return b;
        const t = uitgifte.uitgeef({ id: id('TG'), van: codenaam, vanSoort: 'lid', aan, centen: c,
          oms: schoon(oms, 80) || 'Tegoed', at: nu(), boeking: b.boeking.id }, 'lid:' + codenaam, doos);
        g.bewaarNieuw(t);
        if (aan) seintje(aan);
        return { ok: true, tegoed: naarBuiten(t), saldo: saldoVan(rekLid(codenaam)), bijgeladen: z.bijgeladen };
      }, { geld: 'koopt tegoed, en dat is een betaling' });
    return uitgifte.metCode(r, doos);
  }

  /* ---------- verzilveren: van de escrow naar de wallet van de ontvanger ----------
     Met de CODE (wie hem heeft, mag hem gebruiken) of met het ID van een
     tegoed dat op naam van deze codenaam staat. Onbekend en al-gebruikt
     krijgen met opzet verschillende antwoorden: wie een bon in handen heeft die
     op is, hoort te begrijpen waarom hij niets krijgt. */
  async function tegoedVerzilver({ codenaam, code, tegoedId, idem }) {
    const tid = String(tegoedId || '');
    if (!tid && !bon.kaal(code)) return { status: 400, error: 'Vul de tegoedcode in.' };
    await migratie.zorg();
    const r = await claim.neem({
      vind: bron => tid ? (bron[tid] && bron[tid].aan === codenaam ? bron[tid] : null) : zoek(bron, code),
      mag: t => {
        if (t.status === 'ingetrokken') return { status: 409, error: 'Dit tegoed is ingetrokken door wie het kocht.' };
        if (t.status !== 'open') return { status: 409, error: 'Dit tegoed is al gebruikt.' };
        if (t.aan && t.aan !== codenaam) return { status: 403, error: 'Dit tegoed staat op naam van iemand anders.' };
        const reden = bon.bearer.reden(t.toegang, { doel: bon.DOEL, scope: bon.SCOPE });
        if (reden === 'verlopen') return { status: 409, error: 'Dit tegoed is verlopen; de koper kan het terugnemen.' };
        if (reden) return { status: 409, error: 'Dit tegoed is niet meer geldig.' };
        return null;
      },
      soort: 'verzilver', door: codenaam, naar: rekLid(codenaam), idem,
      oms: (_s, t) => t.oms || 'Tegoed',
      onbekend: { status: 404, error: 'Deze tegoedcode kennen we niet.' }
    });
    if (!r.ok) return r;
    // Alleen een LID krijgt een seintje: bij een zaak-bon staat in `van` een zaakcode.
    if (!r.herhaald && r.tegoed.vanSoort !== 'zaak') seintje(r.tegoed.van);
    return { ok: true, herhaald: !!r.herhaald, centen: r.tegoed.centen,
      saldo: saldoVan(rekLid(codenaam)), tegoed: naarBuiten(r.tegoed) };
  }

  /* ---------- terugnemen en intrekken: het geld gaat terug naar de KOPER ----------
     En niet naar RTG: niet-opgehaald tegoed dat in huis blijft, is inkomen dat
     ontstaat doordat iemand iets vergat. Na de vervaldatum is het terugnemen;
     ervoor is het INTREKKEN (`intrekken: true`), bijvoorbeeld omdat de code
     is gelekt. Beide maken de code dood en beide drukt de koper zelf. */
  const tegoedTerug = ({ codenaam, tegoedId, intrekken, idem }) =>
    g.terug({ vind: bron => {
      const t = bron[String(tegoedId || '')];
      return t && t.vanSoort !== 'zaak' && t.van === codenaam ? t : null;
    }, door: codenaam, naar: rekLid(codenaam), intrekken, idem,
    saldo: () => saldoVan(rekLid(codenaam)) });

  const tegoedRoteer = ({ codenaam, tegoedId, idem }) => g.roteer({ vind: bron => {
    const t = bron[String(tegoedId || '')];
    return t && t.vanSoort !== 'zaak' && t.van === codenaam ? t : null;
  }, door: codenaam, idem });

  /* ---------- wat het lid ziet: metadata, nooit een code of een hash ---------- */
  async function tegoedOverzicht(codenaam) {
    await migratie.zorg();
    const alle = Object.values(kijk()).sort((a, b) => (b.at || 0) - (a.at || 0));
    const gekocht = alle.filter(t => t.vanSoort !== 'zaak' && t.van === codenaam).slice(0, 50).map(naarBuiten);
    const voorMij = alle.filter(t => t.aan === codenaam && t.status === 'open' && !verlopen(t))
      .slice(0, 50).map(naarBuiten);
    const openCenten = gekocht.filter(t => t.status === 'open').reduce((s, t) => s + t.centen, 0);
    return { ok: true, gekocht, voorMij, openCenten, vervalDagen: Math.round(VERVAL_MS / 86400000) };
  }

  return Object.assign({ tegoedKoop, tegoedVerzilver, tegoedTerug, tegoedRoteer, tegoedOverzicht },
    require('./tegoed-zaak')(ctx, g));
};

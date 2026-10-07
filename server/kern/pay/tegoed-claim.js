/* GELD UIT DE ESCROW (kern/pay/tegoed-claim.js): verzilveren, terugnemen en
   intrekken zijn drie keer dezelfde beweging -- `extern:tegoed` naar een
   wallet -- en lopen daarom door EEN hervatbare saga.

   WAAROM EEN SAGA EN GEEN SLOT IN HET GEHEUGEN. Het grootboek bewaakt de
   escrow niet: boek() slaat de saldocontrole over voor elke `extern:`-rekening
   (zie ./index.js), dus alleen de STAAT VAN DE BON houdt tegen dat dezelfde
   euro twee keer uit de escrow gaat. Die staat stond tot 27 september 2026 als
   'bezig' in het geheugen van EEN proces; een tweede instance zag hem niet.
   Nu, in drie stappen:

     1. CLAIMEN in de collectietransactie van ./tegoed-bon.js. De bon gaat van
        'open' naar 'claimend' met een claim-id, een bestemming en de actor.
        Een tweede aanvrager -- in dit proces of een ander -- leest die claim.
     2. BOEKEN met een economische sleutel die volgt uit bon-id + claim-id
        (../betaalopdracht/terugboeking.js, soort `pay-tegoed`). Sleutel en
        grootboekregel committen samen; een herhaling met dezelfde sleutel
        boekt niets nieuws maar geeft dezelfde regel terug.
     3. AFRONDEN in dezelfde collectietransactie: 'verzilverd', 'terug' of
        'ingetrokken', met de gebruiksteller of de intrekking op de toegang.

   EEN CRASH TUSSEN 1 EN 3 IS GEEN GELDVERLIES EN GEEN DUBBELE BOEKING. De bon
   blijft 'claimend' met zijn sleutel; WIE er daarna ook aan komt -- de
   ontvanger opnieuw, of de koper die wil terugnemen -- maakt DIE claim af,
   naar DIE bestemming, met DIE sleutel. Een lopende claim wordt nooit
   vervangen, dus er kan nooit een tweede sleutel voor dezelfde euro ontstaan.

   VRIJGEVEN ALLEEN BIJ EEN WEIGERING. Zegt de boekingslaag met een 4xx dat hij
   niet boekte (wallet vol, bedrag ongeldig), dan gaat de bon terug naar
   'open'. Een 5xx of een gooiende boeking is "weet niet": de claim blijft
   staan en wordt bij de volgende poging met dezelfde sleutel hervat. */
'use strict';

const STAND = { verzilver: 'verzilverd', terug: 'terug', intrek: 'ingetrokken' };

module.exports = ({ bon, crypto, boekEenmaal }) => {
  const { transactie, bearer, kopie, iso, REK_TEGOED } = bon;
  const afdruk = s => crypto.createHash('sha256').update(String(s)).digest('hex');

  /* `vind(bron)` levert de bon of null; `mag(t)` levert een weigering of
     null. Beide draaien BINNEN het slot, dus wat ze zien is de waarheid. */
  /* `poort` (optioneel): de vrijgavepoort voor een NIEUWE claim (verzilveren is
     nieuw geld naar een nieuwe houder). Na de herhaling en na een hervatting;
     terugnemen en intrekken geven hem niet mee, want dat is geld dat terug gaat
     naar wie het kocht. */
  async function neem({ vind, mag, soort, door, naar, oms, idem, onbekend, poort }) {
    const idemHash = idem ? afdruk('pay-tegoed-claim|' + soort + '|' + door + '|' + idem) : null;
    const stap1 = await transactie(bron => {
      const t = vind(bron);
      if (!t) return { fout: onbekend };
      if (t.status === 'claimend' && t.claim) return { t: kopie(t), hervat: true };
      if (t.claim && t.claim.door === door && t.claim.soort === soort &&
          idemHash && t.claim.idem_hash === idemHash && t.status === STAND[soort])
        return { klaar: kopie(t) };
      const f = mag(t);
      if (f) return { fout: f };
      const dicht = typeof poort === 'function' ? poort() : null;
      if (dicht) return { fout: dicht };
      t.status = 'claimend';
      t.claim = { id: 'C' + crypto.randomBytes(8).toString('hex'), soort, door, naar,
        idem_hash: idemHash, at: iso() };
      return { t: kopie(t) };
    });
    if (stap1.fout) return stap1.fout;
    if (stap1.klaar) return { ok: true, herhaald: true, tegoed: stap1.klaar };

    const t = stap1.t, c = t.claim;
    const b = await boekEenmaal({ van: REK_TEGOED, naar: c.naar, centen: t.centen,
      soort: 'tegoed', oms: oms(c.soort, t), ref: t.id + '/' + c.id });
    if (!b || b.error) {
      if (b && b.status >= 400 && b.status < 500) await transactie(bron => {
        const r = bron[t.id];
        if (r && r.status === 'claimend' && r.claim && r.claim.id === c.id) {
          r.status = 'open'; r.claim = null;
        }
      });
      return b || { status: 503, error: 'Het grootboek gaf geen antwoord; de claim blijft staan en wordt hervat.' };
    }

    const klaar = await transactie(bron => {
      const r = bron[t.id];
      if (!r || !r.claim || r.claim.id !== c.id)
        return { fout: { status: 503, error: 'De bon veranderde tijdens het boeken; herstel is vereist.' } };
      if (r.status === 'claimend') {
        r.status = STAND[c.soort];
        r.boekingUit = b.boeking.id;
        r.afgerondAt = iso();
        if (c.soort === 'verzilver') {
          bearer.gebruik(r.toegang);
          r.verzilverdDoor = c.door; r.verzilverdAt = r.afgerondAt;
        } else {
          bearer.intrekken(r.toegang, c.door, c.soort === 'intrek' ? 'ingetrokken door de koper' : 'verlopen tegoed terug');
          r.terugAt = r.afgerondAt;
        }
      }
      return { t: kopie(r) };
    });
    if (klaar.fout) return klaar.fout;
    /* Een hervatte claim van een ANDER is nu afgemaakt, maar deze aanvrager
       krijgt er niets van: dat geld ging naar de bestemming van die claim. */
    if (stap1.hervat && (c.door !== door || c.soort !== soort))
      return { status: 409, error: 'Dit tegoed is al gebruikt.', tegoed: klaar.t };
    return { ok: true, hervat: !!stap1.hervat, tegoed: klaar.t };
  }

  return { neem };
};

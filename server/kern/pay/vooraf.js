/* RTG Pay, deelbestand "vooraf": de pre-autorisatie aan de kassa.

   ./kassa.js kent EEN afrekenmoment: de zaak toetst de code en het bedrag is
   meteen definitief. Dat werkt voor een kop koffie en voor niets waar TIJD
   tussen zit. Een hotel wil bij het inchecken zeker weten dat de borg er bij
   het uitchecken nog staat; een taxi kent de ritprijs pas aan het eind; een
   rekening in een restaurant staat een uur open terwijl er nog rondjes bij
   komen. Zonder dit patroon is het antwoord op "heeft dit lid genoeg?" alleen
   waar op het moment dat je het vraagt.

   Drie handelingen in plaats van een:

     vooraf     de zaak zet een MAXIMUM vast. Er wordt niets geboekt en de zaak
                ontvangt niets; het lid kan dat deel alleen niet meer uitgeven.
     vastleggen het werkelijke bedrag wordt geboekt. Nooit meer dan het
                vastgezette maximum, vaak minder (de rit was goedkoper).
     vrijgeven  er komt niets van; het lid heeft zijn ruimte terug.

   DE GARANTIE MOET ECHT ZIJN, anders is het geen pre-autorisatie maar een
   voornemen. Daarom laadt de wallet bij het vastzetten zo nodig zelf bij
   (zorgSaldo), precies zoals bij een gewone betaling. Wie een maximum vastzet
   op een wallet die het niet heeft, heeft niets vastgezet.

   DE VOLGORDE BIJ HET VASTLEGGEN, en dit is de enige plek waar het mis kan.
   Eerst de reservering sluiten, dan pas boeken. Andersom zou de boeking tegen
   zijn EIGEN reservering aanlopen -- die houdt het bedrag immers vast, dus de
   waardepoort zou hem weigeren met "onvoldoende beschikbaar". Sluit de
   reservering eerst, dan is het saldo vrij en boekt hij gewoon.

   En als de boeking daarna alsnog faalt? Dan is de reservering weg en staat het
   geld weer vrij bij het lid. Dat is de veilige kant om op te falen: er is niets
   afgeschreven en niets zoekgeraakt, de zaak hoort dat het niet lukte en vraagt
   een nieuwe code. Een compensatie die de reservering "terugzet" zou hier
   dezelfde fout zijn als de compensatie die in ./kassa.js bij de uitbetaling is
   weggehaald: je weet bij een timeout juist niet of het gelukt is.

   Krijgt de gedeelde ctx van kern/pay/index.js. */
module.exports = (ctx) => {
  const { save, nu, kascodes, rekLid, rekPartner, schoon,
    metIdem, boekAsync, zorgSaldo, betaalUit, seintje, betaaldienstKosten, waarde,
    MIN_CENTEN, MAX_CENTEN } = ctx;

  const uit = () => ({ status: 501, error: 'Vooraf vastzetten is hier niet ingeschakeld.' });

  /* Dezelfde codetoets als ./kassa.js. Bewust nagetikt en niet gedeeld: het is
     drie regels, en een gedeelde helper zou de verleiding geven om er later een
     vlag in te zetten waarmee de ene kant soepeler wordt dan de andere. */
  function codeVan(code) {
    const k = kascodes().find(x => x.code === String(code || '').toUpperCase().trim());
    if (!k || k.gebruikt || k.geldigTot < nu()) return null;
    return k;
  }

  /* ---------- 1. vastzetten ---------- */
  async function kasVooraf({ supplierCode, code, maxCenten, oms, idem, urenGeldig }) {
    if (!waarde) return uit();
    const k = codeVan(code);
    if (!k) return { status: 404, error: 'Deze betaalcode is niet (meer) geldig.' };
    const c = Math.round(Number(maxCenten));
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Vul een maximum in.' };
    if (c > k.maxCenten) return { status: 402, error: 'Boven het maximum van deze code (' + (k.maxCenten / 100).toFixed(2) + ' euro).' };
    return metIdem(idem ? 'vooraf:' + supplierCode + ':' + idem : null,
      'vooraf|' + supplierCode + '|' + k.code + '|' + c, async () => {
      // de code hier consumeren, voor de awaits -- zelfde reden als in ./kassa.js
      if (k.gebruikt || k.geldigTot < nu()) return { status: 404, error: 'Deze betaalcode is niet (meer) geldig.' };
      k.gebruikt = true; save();
      const terug = (r) => { k.gebruikt = false; save(); return r; };

      const z = await zorgSaldo({ codenaam: k.codenaam, centen: c, idem });
      if (z.error) return terug(z);
      const uren = Math.min(24, Math.max(1, Math.round(Number(urenGeldig) || 4)));
      const r = waarde.reserveer({ rek: rekLid(k.codenaam), centen: c,
        doel: schoon(oms, 60) || 'Vooraf vastgezet', ref: supplierCode, msGeldig: uren * 3600000 });
      if (r.error) return terug(r);
      seintje(k.codenaam);
      return { ok: true, reservering: r.reservering.id, maxCenten: c, tot: r.reservering.tot,
        van: k.codenaam, bijgeladen: z.bijgeladen || 0 };
    });
  }

  /* De reservering moet van DEZE zaak zijn. Zonder die toets kon elke
     ingelogde leverancier het vastgezette bedrag van een andere zaak innen,
     puur door het id te raden of af te kijken. */
  function reserveringVanZaak(id, supplierCode) {
    const r = waarde.reservering(id);
    if (!r || r.ref !== supplierCode || r.status !== 'open') return null;
    return r;
  }

  /* ---------- 2. vastleggen: het werkelijke bedrag ---------- */
  async function kasVastleg({ supplierCode, reservering, centen, oms, idem, genre }) {
    if (!waarde) return uit();
    const r = reserveringVanZaak(String(reservering || ''), supplierCode);
    if (!r) return { status: 404, error: 'Deze reservering staat niet op uw naam.' };
    const codenaam = String(r.rek).replace(/^lid:/, '');
    return metIdem(idem ? 'vastleg:' + supplierCode + ':' + idem : null,
      'vastleg|' + supplierCode + '|' + r.id + '|' + Math.round(Number(centen) || r.centen), async () => {
      // eerst sluiten (anders blokkeert de reservering zijn eigen boeking), dan boeken
      const v = waarde.vastleggen({ id: r.id, centen });
      if (v.error) return v;
      /* Ook hier langs ./samen.js: is er een budget dat bij deze zaak geldt,
         dan gaat dat er eerst op. De reservering stond op de eigen wallet (daar
         zette de zaak hem vast), maar het is de samensteller die bepaalt waar
         het werkelijke bedrag vandaan komt -- en gebonden geld dat vervalt
         hoort vóór eigen geld op te gaan. */
      const b = await betaalUit({ codenaam, naar: rekPartner(supplierCode), centen: v.centen, genre,
        oms: schoon(oms, 120) || 'Kassa, vooraf vastgezet', ref: r.id, idem, soort: 'kassa' });
      if (b.error) return b;
      let kosten = 0;
      try { kosten = Math.max(0, Math.round(betaaldienstKosten(v.centen) || 0)); } catch (e) { kosten = 0; }
      if (kosten > 0) {
        const kb = await boekAsync({ van: rekPartner(supplierCode), naar: 'rtg:betaaldienst', centen: kosten,
          soort: 'betaaldienstkosten', oms: 'Betaaldienstkosten, direct verrekend', ref: r.id });
        if (kb.error) kosten = 0;
      }
      save();
      seintje(codenaam);
      return { ok: true, centen: v.centen, vrijgevallen: v.vrijgevallen, van: codenaam, kosten, delen: b.delen };
    });
  }

  /* ---------- 3. vrijgeven ---------- */
  function kasVrijgeef({ supplierCode, reservering }) {
    if (!waarde) return uit();
    const r = reserveringVanZaak(String(reservering || ''), supplierCode);
    if (!r) return { status: 404, error: 'Deze reservering staat niet op uw naam.' };
    const codenaam = String(r.rek).replace(/^lid:/, '');
    const v = waarde.vrijgeven({ id: r.id });
    if (v.error) return v;
    seintje(codenaam);
    return { ok: true, vrijgevallen: v.vrijgevallen || 0 };
  }

  /* Wat deze zaak op dit moment heeft vastgezet -- het bedrag dat zij mag
     verwachten maar nog niet heeft ontvangen. Voor een ondernemer is dat een
     ander getal dan zijn saldo, en het hoort niet door elkaar te lopen. */
  function voorafVanZaak(supplierCode) {
    const open = waarde.reserveringenVan(supplierCode);
    return { ok: true, aantal: open.length,
      vastgezetCenten: open.reduce((s, x) => s + x.centen, 0),
      reserveringen: open.map(x => ({ id: x.id, centen: x.centen, doel: x.doel, tot: x.tot,
        van: String(x.rek).replace(/^lid:/, '') })) };
  }

  return { kasVooraf, kasVastleg, kasVrijgeef, voorafVanZaak };
};

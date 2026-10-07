/* RTG Pay, deelbestand "vooraf": de pre-autorisatie aan de kassa.

   ./kassa.js kent EEN afrekenmoment; een hotel, een taxi of een open rekening
   heeft er twee met tijd ertussen. Daarom drie handelingen:

     vooraf     de zaak zet met een kascode een MAXIMUM vast; er wordt niets
                geboekt, het lid kan dat deel alleen niet meer uitgeven. De
                wallet laadt zo nodig bij, anders is het een voornemen.
     vastleggen het werkelijke bedrag wordt geboekt, nooit meer dan het maximum:
                eerst de reservering sluiten, dan boeken (anders loopt de boeking
                tegen haar eigen reservering aan).
     vrijgeven  er komt niets van. Beweegt geen geld en blijft daarom werken
                tijdens een betaalstop (server/opzet/betaalstop.js).

   ATOMAIR OVER INSTANCES (27 september 2026). Vastzetten claimt de kascode in
   de saga van ./kas-claim.js, met een reservering waarvan het id uit de claim
   volgt. Vastleggen en vrijgeven lopen per reservering door de
   collectietransactie van `payVoorafAfloop`: wie de rij als eerste zet, is de
   enige. Het boeken gebruikt de bevroren samenstelling en een economische
   sleutel per deel (./kas-boek.js), dus een hervatting boekt niets dubbel.

   Krijgt de gedeelde ctx van kern/pay/index.js. */
'use strict';

const COL = 'payVoorafAfloop';

module.exports = (ctx) => {
  const { save, nu, d, crypto, bewerkCollectie, rekPartner, schoon, seintje, stelSamen, waarde,
    MIN_CENTEN, MAX_CENTEN } = ctx;
  const LEASE_MS = require('./kas-claim').LEASE_MS;
  const uit = () => ({ status: 501, error: 'Vooraf vastzetten is hier niet ingeschakeld.' });
  const afdruk = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const iso = ms => new Date(ms == null ? nu() : ms).toISOString();
  const kopie = v => JSON.parse(JSON.stringify(v));
  const doe = require('./kasbak').transactieOp({ d, save, bewerkCollectie });
  const transactie = werk => doe(COL, bron => {
    if (!bron || typeof bron !== 'object' || Array.isArray(bron)) throw new Error(COL + ' hoort een kaart te zijn');
    return werk(bron);
  });
  const AFGEHANDELD = { status: 409, error: 'Deze reservering is al afgehandeld.' };
  const NIET_VAN_U = { status: 404, error: 'Deze reservering staat niet op uw naam.' };

  /* ---------- 1. vastzetten ---------- */
  async function kasVooraf({ supplierCode, code, maxCenten, oms, idem, urenGeldig }) {
    if (!waarde) return uit();
    const c = Math.round(Number(maxCenten));
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Vul een maximum in.' };
    return ctx.kasClaim.neem({ code, soort: 'vooraf', supplierCode, centen: c, idem: idem ? String(idem) : null,
      oms: schoon(oms, 60) || 'Vooraf vastgezet', urenGeldig }, { na: r => { seintje(r.codenaam); return {}; } });
  }

  // de reservering moet van DEZE zaak zijn, anders int elke leverancier die van een ander
  function reserveringVanZaak(id, supplierCode) {
    const r = waarde.reservering(id);
    if (!r || r.ref !== supplierCode || r.status !== 'open') return null;
    return r;
  }

  /* ---------- 2. vastleggen: het werkelijke bedrag ---------- */
  async function kasVastleg({ supplierCode, reservering, centen, oms, idem, genre }) {
    if (!waarde) return uit();
    const id = String(reservering || '');
    const idemHash = idem ? afdruk('vastleg|' + supplierCode + '|' + idem) : null;
    const s1 = await transactie(bron => {
      const x = bron[id];
      if (x) {
        if (x.supplierCode !== supplierCode) return { fout: NIET_VAN_U };
        const zelfde = !!idemHash && !!x.claim && x.claim.idem_hash === idemHash;
        if (x.stand === 'vastgelegd') return zelfde ? { klaar: x.uitkomst } : { fout: AFGEHANDELD };
        if (x.stand !== 'vastleggend') return { fout: AFGEHANDELD };
        if (Date.parse(x.claim.lease_tot) > nu()) return { fout: zelfde ? { status: 409, code: 'KASCODE_BEZIG',
          error: 'Dit bedrag wordt nog vastgelegd. Probeer het zo met dezelfde sleutel opnieuw.' } : AFGEHANDELD };
        x.claim.lease_tot = iso(nu() + LEASE_MS);
        return { x: kopie(x), vreemd: !zelfde };
      }
      const r = reserveringVanZaak(id, supplierCode);
      if (!r) return { fout: NIET_VAN_U };
      if (r.tot <= nu()) return { fout: { status: 409, error: 'Deze reservering is verlopen.' } };
      /* Vastleggen boekt NIEUW geld naar de zaak; na de herhaling en een
         hervatting (hierboven) vraagt het de vrijgavepoort. Dicht: de
         reservering blijft staan en kan nog steeds worden vrijgegeven. */
      const dicht = ctx.vrijgavePoort ? ctx.vrijgavePoort.intern() : null;
      if (dicht) return { fout: dicht };
      const c = centen == null ? r.centen : Math.round(Number(centen));
      if (!Number.isFinite(c) || c <= 0) return { fout: { status: 400, error: 'Dat bedrag kan niet.' } };
      if (c > r.centen) return { fout: { status: 409, error: 'Boven het gereserveerde bedrag.', gereserveerd: r.centen } };
      bron[id] = { id, supplierCode, codenaam: String(r.rek).replace(/^lid:/, ''), centen: c, gereserveerd: r.centen,
        stand: 'vastleggend', uitkomst: null, bijgewerkt_at: iso(),
        claim: { id: 'VL' + crypto.randomBytes(8).toString('hex'), idem_hash: idemHash, lease_tot: iso(nu() + LEASE_MS),
          genre: genre || null, oms: schoon(oms, 120) || 'Kassa, vooraf vastgezet', delen: null, terug: null } };
      return { x: kopie(bron[id]) };
    });
    if (s1.fout) return s1.fout;
    if (s1.klaar) return Object.assign({}, s1.klaar, { herhaald: true });
    const x = s1.x, c = x.claim;
    const opRij = werk => transactie(bron => {
      const y = bron[id];
      if (!y || !y.claim || y.claim.id !== c.id || y.stand !== 'vastleggend') return null;
      const u = werk(y); y.bijgewerkt_at = iso(); return u == null ? true : u;
    });

    /* Eerst de reservering sluiten (idempotent: bij een hervatting staat hij al
       op vastgelegd), dan de samenstelling bevriezen, dan boeken. */
    const rs = waarde.reservering(id);
    if (rs && rs.status === 'open') {
      const v = waarde.vastleggen({ id, centen: x.centen });
      if (v.error) { await opRij(y => { y.stand = 'mislukt'; }); return v; }
    } else if (!rs || rs.status !== 'vastgelegd') {
      await opRij(y => { y.stand = 'mislukt'; });
      return AFGEHANDELD;
    }
    if (!c.delen && !c.terug) {
      const s = stelSamen({ codenaam: x.codenaam, centen: x.centen, genre: c.genre, ontvanger: supplierCode, soort: 'kassa' });
      if (s.error) { await opRij(y => { y.stand = 'mislukt'; }); return s; }
      const delen = s.delen.map(z => ({ rek: z.rek, centen: z.centen, klasse: z.klasse || null }));
      const vast = await opRij(y => { if (!y.claim.delen) y.claim.delen = delen; return { delen: y.claim.delen }; });
      if (!vast) return AFGEHANDELD;
      c.delen = vast.delen;
    }
    const b = await ctx.kasBoek.betaalDelen({ ref: 'VL/' + c.id, delen: c.delen, naar: rekPartner(supplierCode),
      genre: c.genre, oms: c.oms, soort: 'kassa', terug: c.terug,
      markeer: (tot, fout) => opRij(y => { y.claim.terug = { tot, fout }; return true; }) });
    if (b.weetNiet) return { status: 503, code: 'KASCLAIM_HERVATBAAR',
      error: 'Het vastleggen is niet bevestigd; probeer het met dezelfde sleutel opnieuw.' };
    if (b.geweigerd) { await opRij(y => { y.stand = 'mislukt'; }); return b.geweigerd; }

    const u = { ok: true, centen: x.centen, vrijgevallen: x.gereserveerd - x.centen, van: x.codenaam, delen: b.delen };
    const r = { codenaam: x.codenaam, claim: { id: c.id, supplierCode } };
    const voor = await ctx.kasKosten.kosten(r, u);
    const uitkomst = Object.assign({}, u, voor.uitkomst);
    const af = await opRij(y => { y.stand = 'vastgelegd'; y.uitkomst = uitkomst; return true; });
    if (!af) return AFGEHANDELD;
    const na = ctx.kasKosten.naAfronden(r, uitkomst, voor);
    if (s1.vreemd) return AFGEHANDELD;
    return Object.assign({}, uitkomst, na);
  }

  /* ---------- 3. vrijgeven ---------- */
  async function kasVrijgeef({ supplierCode, reservering }) {
    if (!waarde) return uit();
    const id = String(reservering || '');
    const s = await transactie(bron => {
      const x = bron[id];
      if (x) return x.supplierCode !== supplierCode ? { fout: NIET_VAN_U }
        : x.stand === 'vrijgegeven' ? { alAf: true } : { fout: AFGEHANDELD };
      const r = reserveringVanZaak(id, supplierCode);
      if (!r) return { fout: NIET_VAN_U };
      bron[id] = { id, supplierCode, codenaam: String(r.rek).replace(/^lid:/, ''), stand: 'vrijgegeven',
        bijgewerkt_at: iso() };
      return { codenaam: bron[id].codenaam };
    });
    if (s.fout) return s.fout;
    const v = waarde.vrijgeven({ id });
    if (v.error) return v;
    if (s.codenaam) seintje(s.codenaam);
    return { ok: true, vrijgevallen: v.vrijgevallen || 0 };
  }

  // wat deze zaak heeft vastgezet: een ander getal dan haar saldo
  function voorafVanZaak(supplierCode) {
    const open = waarde.reserveringenVan(supplierCode);
    return { ok: true, aantal: open.length,
      vastgezetCenten: open.reduce((s, x) => s + x.centen, 0),
      reserveringen: open.map(x => ({ id: x.id, centen: x.centen, doel: x.doel, tot: x.tot,
        van: String(x.rek).replace(/^lid:/, '') })) };
  }

  return { kasVooraf, kasVastleg, kasVrijgeef, voorafVanZaak };
};

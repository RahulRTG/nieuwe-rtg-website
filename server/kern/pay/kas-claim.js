/* DE CLAIM OP EEN KASCODE (kern/pay/kas-claim.js): afrekenen (`kas`) en een
   bedrag vastzetten (`vooraf`) als hervatbare saga, in de vorm van
   ./tegoed-claim.js.

     1. CLAIMEN in de collectietransactie van ./kasbak.js: de code gaat van
        `open` naar `claimend`, `gebruik` wordt 1 (max_gebruik is 1), met een
        claim-id, de zaak, het bedrag en een lease. Een tweede kassa -- in dit
        proces of een ander -- leest die claim en krijgt 409.
     2. UITVOEREN: bijladen, de samenstelling bevriezen, en de delen boeken met
        een economische sleutel per deel (./kas-boek.js). Bij `vooraf` is het
        een reservering met een id dat uit de claim volgt, dus een hervatting
        zet geen tweede reservering.
     3. AFRONDEN in dezelfde collectie: `betaald` of `vooraf`, met de uitkomst.
        Een herhaling met dezelfde idem-sleutel krijgt die uitkomst terug.

   EEN CRASH TUSSEN 1 EN 3 is geen dubbele betaling: de claim blijft staan en
   wie er na de lease langskomt -- dezelfde kassa met dezelfde sleutel, of een
   andere -- maakt DIE claim af naar DIE zaak en DAT bedrag. Een andere kassa
   krijgt daarna 409: het geld ging naar de zaak van de claim.

   Een weigering (4xx, na het terugdraaien) geeft de code terug aan het lid,
   zoals de kassa altijd deed: te weinig saldo verbrandt geen code. */
'use strict';

const LEASE_MS = 60000;
const NIET = { status: 404, error: 'Deze betaalcode is niet (meer) geldig.' };
const GEBRUIKT = NIET;   // een gebruikte code is voor een ander gewoon niet (meer) geldig

module.exports = ({ bak, crypto, nu, stelSamen, zorgSaldo, rekPartner, betaalDelen, weigering, waarde, schoon, vrijgavePoort }) => {
  const { transactie, zoek, reden, bearer, afdruk, kopie, iso } = bak;

  async function stap1({ code, soort, supplierCode, centen, idem, idemVerplicht, genre, oms }) {
    const idemHash = idem ? afdruk('kas-claim|' + soort + '|' + supplierCode + '|' + idem) : null;
    return transactie(bron => {
      const r = zoek(bron, code);
      if (!r) return { fout: NIET };
      if (r.claim) {
        const zelfde = !!idemHash && bearer.zelfdeHash(r.claim.idem_hash, idemHash) &&
          r.claim.supplierCode === supplierCode && r.claim.soort === soort;
        if (r.stand !== 'claimend') return zelfde ? { klaar: kopie(r.uitkomst) } : { fout: GEBRUIKT };
        if (Date.parse(r.claim.lease_tot) > nu())
          return { fout: zelfde ? { status: 409, code: 'KASCODE_BEZIG',
            error: 'Deze betaling wordt nog verwerkt. Probeer het zo met dezelfde sleutel opnieuw.' } : GEBRUIKT };
        r.claim.lease_tot = iso(nu() + LEASE_MS);
        return { r: kopie(r), vreemd: !zelfde };
      }
      if (reden(r)) return { fout: NIET };
      if (centen > r.maxCenten)
        return { fout: { status: 402, error: 'Boven het maximum van deze code (' + (r.maxCenten / 100).toFixed(2) + ' euro).' } };
      if (idemVerplicht && !idemHash) return { fout: { status: 400, code: 'IDEMPOTENTIESLEUTEL_VERPLICHT',
        error: 'Deze opdracht verplaatst geld en vraagt een idempotentiesleutel. Stuur een `idem` mee en gebruik bij een herhaling dezelfde waarde.',
        waarom: idemVerplicht } };
      /* DE VRIJGAVEPOORT, op dezelfde plek als in ../../lib/idem.js: na de
         herhaling en na een hervatting (hierboven, die gaan door), voor een
         NIEUWE claim. Dicht = de code blijft open en er is niets geboekt. */
      const dicht = vrijgavePoort ? vrijgavePoort.intern() : null;
      if (dicht) return { fout: dicht };
      bearer.gebruik(r.toegang);
      r.stand = 'claimend';
      r.claim = { id: 'KC' + crypto.randomBytes(8).toString('hex'), soort, supplierCode, centen,
        genre: genre || null, oms: schoon(oms, 120) || null, idem_hash: idemHash,
        lease_tot: iso(nu() + LEASE_MS), at: iso(), delen: null, bijgeladen: 0, terug: null };
      r.bijgewerkt_at = iso();
      return { r: kopie(r) };
    });
  }

  /* Werk aan de claim, alleen als hij nog van DEZE claim-id is. */
  const opClaim = (r, werk) => transactie(bron => {
    const x = bron[r.id];
    if (!x || !x.claim || x.claim.id !== r.claim.id || x.stand !== 'claimend') return null;
    const u = werk(x);
    x.bijgewerkt_at = iso();
    return u == null ? true : u;
  });
  /* Een weigering: de code gaat terug naar het lid. */
  const geefVrij = r => opClaim(r, x => { x.stand = 'open'; x.claim = null; x.toegang.gebruik = 0; return true; });

  async function bijladen(r, centen) {
    const z = await zorgSaldo({ codenaam: r.codenaam, centen, idem: 'kas-claim:' + r.claim.id });
    if (!z.error) return z;
    if (weigering(z)) await geefVrij(r);
    return { fout: z };
  }

  async function kas(r) {
    const c = r.claim;
    if (!c.delen && !c.terug) {
      const s = stelSamen({ codenaam: r.codenaam, centen: c.centen, genre: c.genre, ontvanger: c.supplierCode, soort: 'kassa' });
      if (s.error) { if (weigering(s)) await geefVrij(r); return s; }
      const eigen = s.delen.find(x => x.eigen);
      const z = eigen ? await bijladen(r, eigen.centen) : { bijgeladen: 0 };
      if (z.fout) return z.fout;
      const delen = s.delen.map(x => ({ rek: x.rek, centen: x.centen, klasse: x.klasse || null }));
      const vast = await opClaim(r, x => { if (!x.claim.delen) { x.claim.delen = delen; x.claim.bijgeladen = z.bijgeladen || 0; }
        return { delen: x.claim.delen, bijgeladen: x.claim.bijgeladen }; });
      if (!vast) return GEBRUIKT;
      c.delen = vast.delen; c.bijgeladen = vast.bijgeladen;
    }
    const b = await betaalDelen({ ref: 'KC/' + c.id, delen: c.delen, naar: rekPartner(c.supplierCode), genre: c.genre,
      oms: c.oms || 'Kassa', soort: 'kassa', terug: c.terug,
      markeer: (tot, fout) => opClaim(r, x => { x.claim.terug = { tot, fout }; return true; }) });
    if (b.weetNiet) return { status: 503, code: 'KASCLAIM_HERVATBAAR',
      error: 'De betaling is niet bevestigd. De code blijft vastgehouden; probeer het met dezelfde sleutel opnieuw.' };
    if (b.geweigerd) { await geefVrij(r); return b.geweigerd; }
    return { ok: true, centen: c.centen, van: r.codenaam, delen: b.delen, bijgeladen: c.bijgeladen || 0 };
  }

  async function vooraf(r, urenGeldig) {
    const c = r.claim;
    const z = await bijladen(r, c.centen);
    if (z.fout) return z.fout;
    const resId = 'RS' + afdruk('kas-vooraf|' + c.id).slice(0, 10).toUpperCase();
    let res = waarde.reservering(resId);
    if (!res) {
      const uren = Math.min(24, Math.max(1, Math.round(Number(urenGeldig) || 4)));
      const n = waarde.reserveer({ rek: 'lid:' + r.codenaam, centen: c.centen,
        doel: c.oms || 'Vooraf vastgezet', ref: c.supplierCode, msGeldig: uren * 3600000 }, { id: resId });
      if (n.error) { if (weigering(n)) await geefVrij(r); return n; }
      res = n.reservering;
    }
    return { ok: true, reservering: res.id, maxCenten: c.centen, tot: res.tot, van: r.codenaam, bijgeladen: z.bijgeladen || 0 };
  }

  /* `stappen.voor(r, u)` draait voor het afronden en mag bij een hervatting
     opnieuw draaien (de kostenboeking heeft een eigen sleutel); `stappen.na`
     draait alleen bij wie de claim afrondt: de vergoedingenrij, het oormerk en
     het seintje gebeuren zo hoogstens een keer. */
  async function neem(args, stappen = {}) {
    const s1 = await stap1(args);
    if (s1.fout) return s1.fout;
    if (s1.klaar) return Object.assign({}, s1.klaar, { herhaald: true });
    const r = s1.r;
    const u = r.claim.soort === 'vooraf' ? await vooraf(r, args.urenGeldig) : await kas(r);
    if (!u.ok) return u;
    const voor = stappen.voor ? await stappen.voor(r, u) : {};
    const uitkomst = Object.assign({}, u, voor.uitkomst || {});
    const af = await opClaim(r, x => { x.stand = r.claim.soort === 'vooraf' ? 'vooraf' : 'betaald';
      x.uitkomst = uitkomst; return true; });
    if (!af) return GEBRUIKT;
    const na = stappen.na ? await stappen.na(r, uitkomst, voor) : {};
    if (s1.vreemd) return GEBRUIKT;
    return Object.assign({}, uitkomst, na || {});
  }

  return { neem, LEASE_MS };
};

module.exports.LEASE_MS = LEASE_MS;

/* Hospitality Guest OS (deelmodule): DE TAFELSESSIE.

   HET PROBLEEM DAT DIT OPLOST. Een gast scant een QR en moet daarna precies
   genoeg zijn: hij hoort bij DEZE zaak, aan DEZE tafel, op DIE ene rekening die
   daar openstaat -- en zijn tafelgenoten horen daar vanaf hun eigen telefoon
   bij te kunnen. Zonder deze laag lost elk scherm dat zelf op, en dan is de
   eerste vraag die niemand beantwoordt: als er vier mensen aan tafel 12 zitten,
   op welke rekening komt de vijfde bestelling?

   DRIE DINGEN DIE HIER BEWUST ZO ZIJN.

   1. DE QR HOORT BIJ DE TAFEL, NIET BIJ DE REKENING. Een sticker op tafel 12
      wordt een keer gedrukt en moet jaren mee. Het token staat dus per tafel in
      de instellingen van de zaak en verandert niet als de rekening sluit. Wat
      WEL per rekening leeft, is de sessie van de gast.
   2. HET TOKEN WORDT GEHASHT BEWAARD. Wie de database leest, kan er geen
      tafelsessie mee openen. Dat is dezelfde gedachte als bij een wachtwoord:
      wij hoeven het niet te weten, we hoeven het alleen te herkennen. De sticker
      draagt het echte token; wij dragen de afdruk.
   3. EEN DEELNEMER IS EEN CODENAAM OF EEN VOORNAAM, NOOIT EEN ACCOUNT. De
      rekening draagt geen sleutel van een lid en geen echte naam -- de
      identiteitskluis blijft gescheiden (CLAUDE.md). Aan tafel zie je "Sam" of
      een codenaam, en dat is genoeg om te weten wie welk biertje bestelde. */
'use strict';

module.exports = ({ db, save, crypto, schoon, horeca }) => {
  const { H, nu, id } = horeca;

  const afdruk = (t) => crypto.createHash('sha256').update(String(t || '')).digest('hex');

  /* ---------- de QR van een tafel ----------
     Een tafel krijgt zijn token bij de eerste keer opvragen en houdt het
     daarna. Opnieuw uitgeven is een aparte handeling (een sticker die is
     kwijtgeraakt), want stil vernieuwen zou elke gedrukte QR doodmaken. */
  function tafelToken(zaakcode, tafel, { vernieuw = false } = {}) {
    const h = H(zaakcode);
    if (!h.instel) h.instel = {};
    if (!h.instel.qr) h.instel.qr = {};
    const sleutel = String(tafel || '').trim();
    if (!sleutel) return { status: 400, error: 'Voor welke tafel?' };
    const bestaand = h.instel.qr[sleutel];
    if (bestaand && !vernieuw) return { tafel: sleutel, token: bestaand.token, at: bestaand.at };
    const token = crypto.randomBytes(9).toString('hex');
    h.instel.qr[sleutel] = { token, hash: afdruk(token), at: nu() };
    save();
    return { tafel: sleutel, token, at: h.instel.qr[sleutel].at, vernieuwd: !!bestaand };
  }

  /* Zoek de zaak en de tafel bij een gescand token. Loopt over de zaken die een
     QR-tafel hebben; dat zijn er in een gewone installatie enkele tientallen en
     de vergelijking gaat over de afdruk, niet over het token. */
  function zaakBijToken(token) {
    const t = String(token || '').trim();
    if (t.length < 12) return null;
    const h = afdruk(t);
    for (const [code, doos] of Object.entries(db.data.horeca || {})) {
      const qr = (doos.instel && doos.instel.qr) || {};
      for (const [tafel, rij] of Object.entries(qr)) {
        if (rij && (rij.hash === h || rij.token === t)) return { zaakcode: code, tafel };
      }
    }
    return null;
  }

  /* ---------- de rekening van een tafel ----------
     Er is er hooguit een open per tafel; die regel staat al in de
     leveranciersroute en wordt hier NIET overgeschreven maar gevolgd. Bestaat
     hij nog niet, dan opent de eerste gast hem. */
  function rekeningVoorTafel(zaakcode, tafel, { open = true } = {}) {
    const h = H(zaakcode);
    const bestaand = Object.values(h.rekeningen)
      .find(r => r.status === 'open' && r.kanaal === 'tafel' && r.tafel === tafel);
    if (bestaand) return bestaand;
    if (!open) return null;
    const r = { id: id(5), kanaal: 'tafel', tafel, naam: null, gasten: 1,
      status: 'open', regels: [], kortingen: [], betalingen: [], fooiCenten: 0,
      gastId: null, kamer: null, deelnemers: [], audit: [],
      geopendAt: nu(), door: 'gast', at: nu(), viaGast: true };
    h.rekeningen[r.id] = r;
    save();
    return r;
  }

  /* ---------- aanschuiven ----------
     Een deelnemer krijgt een nummer (dat is het `gastNr` dat de bestaande
     rekening al kent, dus de splitlaag per persoon werkt meteen) en een eigen
     sleutel. De sleutel gaat een keer over de lijn en wordt gehasht bewaard. */
  function schuifAan(zaakcode, tafel, { naam, codenaam, lid, leeftijd, leeftijdGeverifieerd }) {
    const r = rekeningVoorTafel(zaakcode, tafel);
    if (!Array.isArray(r.deelnemers)) r.deelnemers = [];
    if (r.deelnemers.length >= 40) return { status: 409, error: 'Er zitten al veertig mensen op deze rekening.' };
    const sleutel = crypto.randomBytes(16).toString('hex');
    const nr = r.deelnemers.reduce((m, d) => Math.max(m, d.nr), 0) + 1;
    const deelnemer = {
      nr,
      handle: schoon(codenaam, 40) || schoon(naam, 40) || ('Gast ' + nr),
      lid: !!lid,
      /* De leeftijd staat hier als FEIT en niet als bewering: alleen een
         geverifieerde leeftijd telt bij de alcoholregel in beleid.js. */
      leeftijd: leeftijd == null ? null : Math.max(0, Math.min(120, parseInt(leeftijd, 10) || 0)),
      leeftijdGeverifieerd: !!leeftijdGeverifieerd,
      hash: afdruk(sleutel),
      at: nu()
    };
    r.deelnemers.push(deelnemer);
    r.gasten = Math.max(r.gasten || 1, r.deelnemers.length);
    save();
    return { rekening: r, deelnemer, sleutel };
  }

  /* Herken een terugkerende deelnemer aan zijn sleutel. Geeft de rekening en de
     deelnemer, of null -- nooit een half antwoord waarmee de aanroeper alsnog
     iets op de verkeerde rekening zet. */
  function herken(sleutel) {
    const h = afdruk(String(sleutel || ''));
    if (!sleutel || String(sleutel).length < 24) return null;
    for (const [zaakcode, doos] of Object.entries(db.data.horeca || {})) {
      for (const r of Object.values(doos.rekeningen || {})) {
        if (r.status !== 'open') continue;
        const d = (r.deelnemers || []).find(x => x.hash === h);
        if (d) return { zaakcode, rekening: r, deelnemer: d };
      }
    }
    return null;
  }

  return { tafelToken, zaakBijToken, rekeningVoorTafel, schuifAan, herken, afdruk };
};

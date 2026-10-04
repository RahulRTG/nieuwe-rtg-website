/* DE HORECABON (deur horeca.bon_en_polsbandsaldo): cadeaubon, tegoed en
   polsbandsaldo van EEN zaak. Wie de code heeft, betaalt ermee.

   WAAROM. De oude code was 32 bits, stond kaal als sleutel in de horecadoos
   en op elke betaling, en elke gast aan elke tafel kon met /api/gast/betaal
   een geraden code van de zaak laten afboeken.

   HET GEHEIM (./bon-toegang.js): 128 bits, alleen als hash in `toegang`,
   kaal alleen in het antwoord op maken, de eerste band-opwaardering en een
   rotatie; issuer, doel, scope, vervaldatum en een gebruiksteller; intrekken
   en roteren aan de serverkant; zoeken vergelijkt elke hash (ook historische)
   met timingSafeEqual zonder vroege uitgang.

   AFBOEKEN is EEN collectietransactie op `horecaBonnen` (PostgreSQL: advisory
   lock + FOR UPDATE), dus twee kassa's of twee gasten op twee instances geven
   hetzelfde saldo nooit twee keer uit. Met een idempotentiesleutel krijgt een
   herhaling de eerste afboeking terug in plaats van een tweede.

   DE GAST boekt alleen af wat aan ZIJN sessie hangt: koppelen (met de code in
   de hand) bindt de bon aan de deelnemer van een open rekening, en zolang die
   rekening open is kan geen andere sessie hem koppelen. Betalen noemt geen
   code meer, alleen de sessie (./bon-beheer.js, koppel en opSessie).

   GEEN BOEKING IN HET GROOTBOEK. Een horecabon is een saldo bij de zaak zelf en
   loopt niet door kern/pay; er is dus geen economische sleutel nodig. */
'use strict';

const COL = 'horecaBonnen';

module.exports = ({ db, bewerkCollectie, crypto, nu }) => {
  if (typeof bewerkCollectie !== 'function') throw new Error('De horecabon vereist een collectietransactie.');
  const t = require('./bon-toegang')(nu ? { crypto, nu } : { crypto });
  const { bearer, codeHash, afdruk, sleutel, nieuweBonToegang, naarBuiten, DOEL, SCOPE } = t;
  nu = t.nu;
  const heel = v => Math.round(Math.max(0, Math.min(10000000, Number(v) || 0)));
  // een kaart op bon-ID; `werk` krijgt de rijen als lijst en zet met bron.zet(bon)
  const transactie = werk => bewerkCollectie(COL, kaart => {
    if (!kaart || typeof kaart !== 'object' || Array.isArray(kaart)) throw new Error('horecaBonnen hoort een kaart te zijn');
    const rijen = Object.values(kaart);
    rijen.zet = b => { kaart[b.id] = b; rijen.push(b); };
    return werk(rijen);
  });
  const kijk = () => { const k = db.data[COL]; return k && typeof k === 'object' && !Array.isArray(k) ? Object.values(k) : []; };

  /* Constant-time: elke rij, ook na een treffer; een treffer bij een ANDERE
     zaak telt niet, en een historische hash zegt alleen "vervangen". */
  function zoekIn(bron, zaak, code) {
    const gezocht = codeHash(code);
    let bon = null, oud = null;
    for (const x of bron) {
      if (bearer.zelfdeHash(x && x.toegang && x.toegang.code_hash, gezocht)) bon = x;
      for (const h of (x && x.historie) || []) if (bearer.zelfdeHash(h && h.code_hash, gezocht)) oud = x;
    }
    if (!bon && oud && oud.zaak === zaak) return { status: 409, error: 'Deze code is vervangen door een nieuwe.', code: 'bon-vervangen' };
    if (!bon || bon.zaak !== zaak) return { status: 404, error: 'Deze bon kennen we niet.', code: 'bon-onbekend' };
    return { bon };
  }
  const vanId = (bron, zaak, id) => bron.find(x => x && x.zaak === zaak && x.id === String(id || '')) || null;
  const geldig = (b, extra) => {
    const r = bearer.reden(b.toegang, Object.assign({ doel: DOEL, scope: SCOPE }, extra));
    if (r === 'verlopen') return { status: 409, error: 'Deze bon is verlopen op ' + String(b.toegang.expires_at).slice(0, 10) + '.', code: 'bon-verlopen' };
    if (r === 'ingetrokken') return { status: 409, error: 'Deze bon is ingetrokken.', code: 'bon-ingetrokken' };
    if (r === 'opgebruikt') return { status: 409, error: 'Deze bon is te vaak gebruikt; vraag de zaak om een nieuwe code.', code: 'bon-opgebruikt' };
    if (r) return { status: 409, error: 'Deze code is niet meer geldig.', code: 'bon-ongeldig' };
    const ow = b.toegang.onderwerp || {};
    if (ow.id !== b.id || ow.zaak !== b.zaak) return { status: 404, error: 'Deze bon kennen we niet.', code: 'bon-onbekend' };
    return null;
  };
  const mutatie = (b, m) => { b.mutaties = (b.mutaties || []).concat([Object.assign({ at: nu() }, m)]).slice(-200); };

  /* DE CLAIM. `vind` kiest de bon binnen de transactie (op code, op id of op
     sessie); daarna: geldig, saldo, teller, en de afboeking -- alles of niets.
     `idem` maakt een herhaling tot de eerste afboeking; ander bedrag = 409. */
  function boek({ zaak, vind, centen, idem, bron: herkomst }) {
    const wil = heel(centen);
    const s = sleutel(idem);
    const idemHash = s ? afdruk('hb-boek-v1|' + zaak + '|' + s) : null;
    return transactie(bron => {
      const v = vind(bron);
      if (v.error) return v;
      const b = v.bon;
      const w0 = idemHash ? (b.mutaties || []).find(m => m && m.idem_hash === idemHash) : null;
      if (w0 && w0.gevraagd !== wil) return { status: 409, error: 'Deze sleutel is al gebruikt voor een ander bedrag.', code: 'bon-sleutel' };
      if (w0) return { ok: true, herhaald: true, geboekt: -w0.centen, restVraag: w0.gevraagd + w0.centen, saldo: b.saldo, bon: b.id, ref: w0.ref };
      if (!wil) return { status: 400, error: 'Vul het bedrag in.', code: 'bon-bedrag' };
      const fout = geldig(b);
      if (fout) return fout;
      const echt = Math.min(wil, b.saldo);
      if (!echt) return { status: 409, error: 'Deze bon heeft geen saldo meer.', code: 'bon-leeg' };
      b.saldo -= echt;
      bearer.gebruik(b.toegang);
      const ref = crypto.randomBytes(6).toString('hex');
      mutatie(b, { centen: -echt, gevraagd: wil, soort: 'afgeboekt', bron: herkomst || null, ref, idem_hash: idemHash });
      return { ok: true, geboekt: echt, restVraag: wil - echt, saldo: b.saldo, bon: b.id, ref };
    });
  }

  const intern = { transactie, zoekIn, vanId, geldig, mutatie, t, heel, crypto };
  const beheer = require('./bon-beheer')(intern);
  const { maak, band } = require('./bon-maak')(intern);
  const migratie = require('./bon-migratie')({ lees: k => db.data[k], bewerkCollectie, transactie, t, crypto });
  /* Elke ingang zet eerst oude bonnen om: een bon met een kale code mag nooit
     langs een zoeklus komen die alleen hashes kent. */
  const na = fn => async (...a) => { await migratie.zorg(); return fn(...a); };

  return { COL, maak: na(maak), band: na(band), boek: na(boek), herstel: na(beheer.herstel), terug: na(beheer.terug), leeg: na(beheer.leeg),
    lees: na(beheer.lees), koppel: na(beheer.koppel), intrek: na(beheer.intrek), roteer: na(beheer.roteer),
    opCode: (zaak, code) => bron => zoekIn(bron, zaak, code),
    opId: (zaak, id) => bron => { const b = vanId(bron, zaak, id); return b ? { bon: b } : { status: 404, error: 'Deze bon kennen we niet.', code: 'bon-onbekend' }; },
    opSessie: beheer.opSessie, kijk, naarBuiten, zorg: migratie.zorg, migreer: migratie.migreer, DOEL, SCOPE };
};

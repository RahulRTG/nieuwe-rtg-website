/* DE CADEAUKAART (pay.giftcard_value_code): een kaart met saldo bij EEN zaak,
   in de app gekocht of aan de balie verkocht, en aan de kassa van diezelfde zaak
   in delen in te wisselen.

   WAAROM DIT ER IS. De oude code was 'RTG-GC-' plus zes hextekens (24 bits),
   stond kaal op de kaart, op de kassabon en in het bewaarde idem-antwoord, en
   werd lineair met === gezocht. Wie hem raadde of las, gaf het saldo uit.

   HET GEHEIM:
   - ontstaat alleen in uitgeef() en roteer() en staat alleen in dat antwoord
     kaal; op schijf staat `toegang.code_hash` (./bearercode.js: 128 bits,
     SHA-256 met een vaste namespace);
   - draagt issuer, doel en scope (de scope is DEZE zaak), een vervaldatum en
     een gebruiksteller (max_gebruik: een kaart wordt in delen verzilverd, het
     saldo is de echte grens);
   - wordt server-side ingetrokken (de zaak) en geroteerd (koper of zaak): de
     oude hash gaat de historie in en opent niets meer;
   - wordt constant-time gezocht: elke hash, ook na een treffer, en een treffer
     bij een ANDERE zaak telt niet;
   - wordt verzilverd in EEN collectietransactie op `giftcards` (PostgreSQL:
     advisory lock + FOR UPDATE), dus twee kassa's op twee instances kunnen
     hetzelfde saldo niet allebei uitgeven. Een verzilvering met een
     idempotentiesleutel wordt bij herhaling teruggegeven, niet opnieuw geboekt.

   Oude kaarten staan in ./cadeaukaart-migratie.js: hun code wordt gehasht en
   blijft voor de houder werken (`legacy24`). */
'use strict';

const COL = 'giftcards';

module.exports = ({ db, bewerkCollectie, crypto, nu }) => {
  if (typeof bewerkCollectie !== 'function') throw new Error('De cadeaukaart vereist een collectietransactie.');
  const t = require('./cadeaukaart-toegang')(nu ? { crypto, nu } : { crypto });
  const { bearer, kaal, codeHash, afdruk, sleutel, nieuweToegang, roteerToegang, naarBuiten, DOEL, SCOPE, GELDIG_MS, MAX_GEBRUIK } = t;
  nu = t.nu;
  const transactie = werk => bewerkCollectie(COL, bron => {
    if (!Array.isArray(bron)) throw new Error('giftcards hoort een lijst te zijn');
    return werk(bron);
  });
  const kijk = () => (Array.isArray(db.data[COL]) ? db.data[COL] : []);

  /* Een nieuwe kaart. `idem` maakt een herhaling (dubbeltik, retry na een
     crash) tot DEZELFDE kaart -- maar zonder code: die is een keer getoond, en
     wie hem kwijt is, roteert. */
  function uitgeef({ supplierCode, supplierName, bedrag, kocht, customerKey, issuer, idem }) {
    const s = sleutel(idem);
    const idemHash = s ? afdruk('gc-uitgifte-v1|' + supplierCode + '|' + (customerKey || '') + '|' + s) : null;
    return transactie(bron => {
      const eerder = idemHash ? bron.find(g => g && g.uitgifte_idem === idemHash) : null;
      if (eerder) return { ok: true, herhaald: true, codeGetoond: false, kaart: naarBuiten(eerder),
        uitleg: 'De code is alleen bij de eerste keer getoond. Kwijt? Vraag een nieuwe code aan; de oude vervalt dan.' };
      const kaart = { id: 'GC' + crypto.randomBytes(8).toString('hex'), supplierCode, supplierName,
        bedrag, saldo: bedrag, herkomst: issuer, kocht, customerKey: customerKey || null, at: nu(), verzilveringen: [],
        uitgifte_idem: idemHash, historie: [] };
      const g = nieuweToegang(issuer, kaart);
      kaart.toegang = g.toegang;
      bron.unshift(kaart);
      return { ok: true, eenmalig: true, code: g.code, kaart: naarBuiten(kaart) };
    });
  }

  /* Saldo afhalen. `viaBon` zegt of er een kassabon bij hoort (de boekhouding
     telt hem dan niet nog eens; zie kern/fiscaal/index.js). */
  function kaartVerzilver({ supplierCode, code, bedrag, actor, viaBon, idem }) {
    if (!kaal(code)) return { status: 400, error: 'Vul de code van de cadeaukaart in.' };
    const gezocht = codeHash(code);
    const s = sleutel(idem);
    const idemHash = s ? afdruk('gc-verzilver-v1|' + supplierCode + '|' + s) : null;
    const euro = Math.round(Number(bedrag) * 100) / 100;
    return transactie(bron => {
      let g = null, oud = null;
      for (const x of bron) {
        if (bearer.zelfdeHash(x && x.toegang && x.toegang.code_hash, gezocht)) g = x;
        for (const h of (x && x.historie) || []) if (bearer.zelfdeHash(h && h.code_hash, gezocht)) oud = x;
      }
      if (!g && oud && oud.supplierCode === supplierCode)
        return { status: 409, error: 'Deze code is vervangen door een nieuwe. Vraag de houder om de nieuwe code.' };
      if (!g || g.supplierCode !== supplierCode) return { status: 404, error: 'Deze cadeaukaart kennen we hier niet.' };
      const w0 = idemHash ? (g.verzilveringen || []).find(v => v && v.idem_hash === idemHash) : null;
      if (w0 && w0.bedrag !== euro) return { status: 409, error: 'Deze sleutel is al gebruikt voor een ander bedrag.' };
      if (w0) return { ok: true, herhaald: true, kaart: naarBuiten(g), bedrag: w0.bedrag, verzilvering: w0 };
      const reden = bearer.reden(g.toegang, { doel: DOEL, scope: SCOPE });
      if (reden === 'verlopen') return { status: 410, error: 'Deze cadeaukaart is verlopen.' };
      if (reden) return { status: 409, error: 'Deze code is niet meer geldig.' };
      const ow = g.toegang.onderwerp || {};
      if (ow.id !== g.id || ow.supplierCode !== supplierCode) return { status: 404, error: 'Deze cadeaukaart kennen we hier niet.' };
      if (!(euro > 0)) return { status: 400, error: 'Geen geldig bedrag.' };
      if (euro > g.saldo) return { status: 409, error: 'Onvoldoende saldo: er staat nog € ' + g.saldo + ' op deze kaart.' };
      g.saldo = Math.round((g.saldo - euro) * 100) / 100;
      bearer.gebruik(g.toegang);
      const w = { bedrag: euro, at: nu(), actor: String(actor || '').slice(0, 80),
        viaBon: viaBon || null, bron: viaBon ? 'kassa' : 'handmatig', idem_hash: idemHash };
      g.verzilveringen = (g.verzilveringen || []).concat([w]);
      return { ok: true, kaart: naarBuiten(g), bedrag: euro, verzilvering: w };
    });
  }

  /* Roteren: de oude code wordt ingetrokken en blijft als hash in de historie,
     de nieuwe (128 bits, zelfde vervaldatum en teller) staat alleen in dit
     antwoord. Dezelfde sleutel geeft een 409 zonder code: een tweede nieuwe
     code zou de eerste stil doden. */
  function roteer({ vind, door, idem }) {
    const s = sleutel(idem);
    if (!s) return { status: 400, code: 'IDEMPOTENTIESLEUTEL_VERPLICHT',
      error: 'Een nieuwe code vraagt een idempotentiesleutel: hij wordt maar een keer getoond.' };
    const idemHash = afdruk('gc-roteer-v1|' + door + '|' + s);
    return transactie(bron => {
      const g = bron.find(x => x && vind(x));
      if (!g) return { status: 404, error: 'Deze cadeaukaart is niet van u.' };
      if (g.laatste_rotatie && g.laatste_rotatie.idem_hash === idemHash)
        return { status: 409, herhaald: true, kaart: naarBuiten(g),
          error: 'De nieuwe code is al een keer getoond en wordt niet herhaald. Vraag opnieuw een nieuwe code aan.' };
      if (bearer.reden(g.toegang, { doel: DOEL, scope: SCOPE, negeerGebruik: true }) === 'verlopen')
        return { status: 409, error: 'Deze cadeaukaart is verlopen.' };
      if (!(g.saldo > 0)) return { status: 409, error: 'Op deze kaart staat niets meer.' };
      const oud = g.toegang;
      let n;
      try { n = roteerToegang(oud, door); } catch (e) {
        if (e.code === 'geldigheid-ongeldig') return { status: 409, error: 'Deze cadeaukaart is verlopen.' };
        throw e;
      }
      g.historie = (g.historie || []).concat([{ code_hash: oud.code_hash, ingetrokken_at: oud.ingetrokken_at,
        rotatie: oud.rotatie }]).slice(-12);
      g.toegang = n.toegang;
      g.legacy24 = false;
      g.laatste_rotatie = { idem_hash: idemHash, at: nu() };
      return { ok: true, eenmalig: true, code: n.code, kaart: naarBuiten(g) };
    });
  }

  /* Intrekken zonder nieuwe code (de zaak: gestolen, verloren). Het saldo
     blijft staan -- het is geld van de houder; een rotatie geeft hem een nieuwe
     code. Een tweede keer verandert niets. */
  function kaartIntrek({ vind, door, reden }) {
    return transactie(bron => {
      const g = bron.find(x => x && vind(x));
      if (!g) return { status: 404, error: 'Deze cadeaukaart kennen we hier niet.' };
      bearer.intrekken(g.toegang, door, reden || 'ingetrokken door de zaak');
      return { ok: true, kaart: naarBuiten(g) };
    });
  }

  const mijn = key => kijk().filter(g => g && key && g.customerKey === key).slice(0, 20).map(naarBuiten);

  const migratie = require('./cadeaukaart-migratie')({ db, bewerkCollectie, transactie, bearer, codeHash,
    crypto, nu, DOEL, SCOPE, GELDIG_MS, MAX_GEBRUIK });

  /* Elke ingang zet eerst oude kaarten om: een kaart met een kale code mag
     nooit langs een zoeklus komen die alleen hashes kent. */
  const na = fn => async (...a) => { await migratie.zorg(); return fn(...a); };

  return { uitgeef: na(uitgeef), verzilver: na(kaartVerzilver), roteer: na(roteer), intrek: na(kaartIntrek),
    mijn: na(mijn), kijk, naarBuiten, codeHash, zorg: migratie.zorg, migreer: migratie.migreer,
    DOEL, SCOPE, GELDIG_MS, MAX_GEBRUIK };
};


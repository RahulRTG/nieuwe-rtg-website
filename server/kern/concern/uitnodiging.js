/* CONCERN (deelmodule): UITNODIGEN. Stap 5.

   Wat de ondernemer ziet: naam, wat gaat deze persoon doen, waar, vanaf
   wanneer. Wat RTG onder water doet: dienstverband, entiteit, vestiging,
   afdeling, rol, reikwijdte, geldigheid, toegangsrechten, de juiste app en de
   audit-regel. Dat contrast IS de functie -- wet 3 en wet 5 in een scherm. Als
   dit scherm meer velden krijgt, is er iets misgegaan.

   EEN WERKNEMER KOOPT NOOIT EEN PAS OM TE MOGEN WERKEN. Grens uit CONCERN.md,
   en hij zit hier in de code: de uitnodiging draagt geen enkele pas-eis.

   HET DIENSTVERBAND ONTSTAAT PAS BIJ ACCEPTEREN. Een uitnodiging is een
   voorstel; zou zij meteen een dienstverband maken, dan staat iemand in het
   personeelsbestand die nog nooit ja heeft gezegd -- en die telt dan mee in het
   organigram, de functiescheiding en de readiness.

   EN ZIJ DRAAGT GEEN TECHNIEK IN DE TEKST. Geen zaakcode, geen rolsleutel.

   DE CODE IS EEN CREDENTIAL (workos.concern_uitnodiging, RELEASEKANDIDAAT.md
   B9): CU.<32 hex> (128 bit, ../bearercode.js), alleen als hash op de
   uitnodiging, kaal alleen in het antwoord op uitnodigen, bulk versturen of
   roteren, constant-time gezocht. Accepteren, intrekken en roteren lopen in
   EEN collectietransactie op `concern` (./opslag.js onder()), zodat de claim en
   het dienstverband samen landen en twee instances hem niet allebei claimen.
   Een uitnodiging van voor de migratie (acht hextekens, kaal bewaard) opent
   niets meer; de werkgever roteert hem en behoudt zo de uitnodiging zelf. */
'use strict';

/* Langs welke weg iemand wordt uitgenodigd; de uitnodiging zelf verschilt
   niet per weg. HERNOEMD VAN `KANALEN` (SEMANTIEK.json: vier betekenissen);
   `kanaal` is van de verkoopweg, zie COMMERCE.md par. 3. */
const UITNODIGINGSWEGEN = ['chat', 'email', 'telefoon', 'qr', 'code', 'bulk', 'directory'];

module.exports = (ctx) => {
  const { db, save, crypto, schoon, entiteitVind, entiteitBeeld, vestigingVind,
    employmentNieuw, employmentVanPersoon, tijdVandaag, opslag, bewerkCollectie } = ctx;

  const nu = () => new Date().toISOString();
  const DAGEN_GELDIG = 30;
  const T = require('./uitnodiging-toegang')({ crypto, opslag, bewerkCollectie, nu });
  const { vindCode, transactie, geefCode, schoonOud } = T;

  const bak = () => opslag.tak('uitnodigingen');
  const vind = (id) => bak()[String(id || '')] || null;

  const verlopen = (u) => u.geldigTot && u.geldigTot < tijdVandaag();

  /* ---- uitnodigen ---- */
  function uitnodigingNieuw(door, body) {
    const b = body || {};
    const ent = entiteitVind(b.entiteit);
    if (!ent) return { status: 404, error: 'Deze entiteit bestaat niet.' };

    const rol = schoon(b.rol, 80);
    if (!rol) return { status: 400, error: 'Wat gaat deze persoon doen?' };

    let vest = null;
    if (b.vestiging) {
      vest = vestigingVind(b.vestiging);
      if (!vest) return { status: 404, error: 'Deze vestiging bestaat niet.' };
      if (vest.entiteit !== ent.id) return { status: 400, error: 'Deze vestiging hoort bij een andere entiteit.' };
      if (vest.gesloten) return { status: 409, error: 'Deze vestiging is gesloten.' };
    }

    const kanaal = UITNODIGINGSWEGEN.includes(b.kanaal) ? b.kanaal : 'code';
    const van = b.van && /^\d{4}-\d{2}-\d{2}$/.test(b.van) ? b.van : tijdVandaag();

    const tot = new Date(tijdVandaag() + 'T00:00:00Z');
    tot.setUTCDate(tot.getUTCDate() + DAGEN_GELDIG);

    const u = {
      id: 'uit_' + crypto.randomBytes(8).toString('hex'),
      entiteit: ent.id, vestiging: vest ? vest.id : null,
      afdeling: schoon(b.afdeling, 60) || null,
      rol, soort: b.soort === 'mandaat' ? 'mandaat' : 'employment',
      contact: schoon(b.contact, 160) || null,
      kanaal, van,
      door: door || null,
      stand: 'open',
      geldigTot: tot.toISOString().slice(0, 10),
      gemaakt: nu()
    };
    const code = geefCode(u, door);
    schoonOud();
    bak()[u.id] = u;
    save();
    return { ok: true, uitnodiging: beeld(u), code, tonen: tekst(u) };
  }

  /* De tekst die de uitgenodigde ziet. Geen entiteit-id, geen zaakcode, geen
     rolsleutel: een plaats, een functie en een knop. */
  function tekst(u) {
    const ent = entiteitVind(u.entiteit);
    const naam = ent ? (entiteitBeeld(ent).naam || 'een bedrijf') : 'een bedrijf';
    const v = u.vestiging ? vestigingVind(u.vestiging) : null;
    return {
      kop: 'U bent uitgenodigd bij ' + naam,
      regels: [u.rol, v ? (v.plaats || v.naam) : null].filter(Boolean),
      knop: 'Accepteren',
      /* Wet 13 uit CONCERN.md, in de tekst zelf: wie dit leest hoort meteen te
         weten dat er geen abonnement achter zit. */
      voet: 'Werken bij dit bedrijf is gratis. U heeft hiervoor geen betaalde RTG-pas nodig.'
    };
  }

  /* ---- accepteren ----

     `persoon` is de codenaam van wie accepteert, en die komt van de AANROEPER
     uit een geverifieerde sessie -- nooit uit het verzoeklichaam. Anders
     accepteert de een de uitnodiging op naam van de ander. Dezelfde regel als
     bij ondernemingAanvraag(). */
  function uitnodigingAccepteer(code, persoon) {
    if (!persoon) return { status: 401, error: 'Log in of maak een gratis werkidentiteit aan.' };
    return transactie(() => accepteerBinnen(code, persoon));
  }
  function accepteerBinnen(code, persoon) {
    const u = vindCode(code);
    const reden = T.reden(u);
    if (reden === 'onbekend') return { status: 404, error: 'Deze uitnodiging kennen we niet.' };
    if (u.stand === 'geaccepteerd' || reden === 'opgebruikt') return { status: 409, error: 'Deze uitnodiging is al gebruikt.' };
    if (u.stand === 'ingetrokken' || reden === 'ingetrokken') return { status: 409, error: 'Deze uitnodiging is ingetrokken.' };
    if (reden && reden !== 'verlopen') return { status: 404, error: 'Deze uitnodiging kennen we niet.' };
    if (verlopen(u) || reden === 'verlopen') {
      u.stand = 'verlopen';
      return { status: 409, error: 'Deze uitnodiging is verlopen.',
        uitleg: 'Vraag de werkgever om een nieuwe; dat kost hem één tik.' };
    }

    const r = employmentNieuw({ persoon, entiteit: u.entiteit, vestiging: u.vestiging,
      afdeling: u.afdeling, rol: u.rol, soort: u.soort, van: u.van });
    if (!r.ok) return r;

    T.gebruik(u.toegang);
    u.stand = 'geaccepteerd';
    u.persoon = persoon;
    u.employment = r.employment.id;
    u.geaccepteerd = nu();

    const ent = entiteitVind(u.entiteit);
    const v = u.vestiging ? vestigingVind(u.vestiging) : null;
    return { ok: true, employment: r.employment,
      welkom: { kop: 'Welkom bij ' + (ent ? entiteitBeeld(ent).naam : 'uw nieuwe werkplek'),
        rol: u.rol, plaats: v ? (v.plaats || v.naam) : null,
        regel: 'Uw werkplek is klaar.' } };
  }

  /* Intrekken en roteren op de verse stand in de transactie: een accepteren
     dat net daarvoor landde, wint, en dan zegt dit dat eerlijk. */
  const alGeaccepteerd = { status: 409, error: 'Deze uitnodiging is al geaccepteerd.',
    uitleg: 'Beëindig het dienstverband; een geaccepteerde uitnodiging terugdraaien zou het werk dat er al op staat laten zweven.' };
  function uitnodigingIntrek(ui, door) {
    return transactie(() => {
      const u = vind(ui && ui.id);
      if (!u) return { status: 404, error: 'Deze uitnodiging bestaat niet.' };
      if (u.stand === 'geaccepteerd') return alGeaccepteerd;
      u.stand = 'ingetrokken';
      if (u.toegang) T.intrekken(u.toegang, door || 'werkgever', 'ingetrokken door de werkgever');
      return { ok: true, uitnodiging: beeld(u) };
    });
  }
  function uitnodigingRoteer(ui, door) {
    return transactie(() => {
      const u = vind(ui && ui.id);
      if (!u) return { status: 404, error: 'Deze uitnodiging bestaat niet.' };
      if (u.stand === 'geaccepteerd') return alGeaccepteerd;
      if (u.stand !== 'open' || verlopen(u)) return { status: 409, error: 'Deze uitnodiging is niet meer open; maak een nieuwe.' };
      const code = geefCode(u, door);
      return { ok: true, uitnodiging: beeld(u), code };
    });
  }

  /* ---- lezen ---- */
  function beeld(u) {
    return { id: u.id, toegang: T.publiek(u.toegang) || null,
      entiteit: u.entiteit, vestiging: u.vestiging, afdeling: u.afdeling,
      rol: u.rol, soort: u.soort, contact: u.contact, kanaal: u.kanaal,
      van: u.van, geldigTot: u.geldigTot,
      stand: verlopen(u) && u.stand === 'open' ? 'verlopen' : u.stand,
      persoon: u.persoon || null, employment: u.employment || null };
  }

  const vanEntiteit = (entiteitId) => Object.values(bak())
    .filter(u => u.entiteit === entiteitId).map(beeld);

  /* Wie is uitgenodigd en heeft nog niet gereageerd -- de readiness leest dit. */
  const openstaand = (entiteitId) => vanEntiteit(entiteitId).filter(u => u.stand === 'open');

  return Object.assign({ UITNODIGING_UITNODIGINGSWEGEN: UITNODIGINGSWEGEN, uitnodigingVind: vind,
    uitnodigingVindCode: vindCode, uitnodigingNieuw, uitnodigingAccepteer,
    uitnodigingIntrek, uitnodigingRoteer, uitnodigingTekst: tekst, uitnodigingBeeld: beeld,
    uitnodigingVanEntiteit: vanEntiteit, uitnodigingOpenstaand: openstaand },
    require('./uitnodiging-bulk')(Object.assign({}, ctx, { uitnodigingNieuw })));
};

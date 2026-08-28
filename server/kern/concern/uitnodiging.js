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

   EN ZIJ DRAAGT GEEN TECHNIEK IN DE TEKST. Geen zaakcode, geen rolsleutel. Wie
   techniek in een uitnodiging zet, leert mensen die techniek uit te wisselen. */
'use strict';

/* De kanalen. Ze verschillen alleen in HOE de code bij iemand komt; de
   uitnodiging zelf is er niet anders van. Zou elk kanaal zijn eigen soort
   uitnodiging krijgen, dan had je zes stromen die uiteenlopen. */
/* HERNOEMD VAN `KANALEN`. Vier domeinen droegen dat woord met vier
   betekenissen en een onderlinge overlap van 0,10 -- SEMANTIEK.json had het in
   de top staan als botsing. Het woord `kanaal` is nu van de VERKOOPWEG
   (kern/horeca.js: tafel, bar, terras, afhaal, bezorging), omdat dat de enige
   betekenis is waar een nieuwe laag hem voor nodig heeft; zie COMMERCE.md
   par. 3. Dit is langs welke weg iemand wordt uitgenodigd (chat, e-mail, qr, code).

   Er is niets aan de WAARDEN veranderd, alleen aan de naam ervan. */
const UITNODIGINGSWEGEN = ['chat', 'email', 'telefoon', 'qr', 'code', 'bulk', 'directory'];

module.exports = (ctx) => {
  const { db, save, crypto, schoon, entiteitVind, entiteitBeeld, vestigingVind,
    employmentNieuw, employmentVanPersoon, tijdVandaag, opslag } = ctx;

  const nu = () => new Date().toISOString();
  const DAGEN_GELDIG = 30;

  const bak = () => opslag.tak('uitnodigingen');

  const vind = (id) => bak()[String(id || '')] || null;
  const vindCode = (code) => Object.values(bak())
    .find(u => u.code === String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')) || null;

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
      id: 'uit_' + crypto.randomBytes(6).toString('hex'),
      /* De code is kort genoeg om voor te lezen en lang genoeg om niet te raden:
         acht tekens uit 32 mogelijkheden. Hij is EENMALIG -- accepteren maakt
         hem ongeldig, zodat een doorgestuurde uitnodiging geen tweede mens
         binnenlaat. */
      code: crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 8),
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
    bak()[u.id] = u;
    save();
    return { ok: true, uitnodiging: beeld(u), tonen: tekst(u) };
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
    const u = vindCode(code);
    if (!u) return { status: 404, error: 'Deze uitnodiging kennen we niet.' };
    if (u.stand === 'geaccepteerd') return { status: 409, error: 'Deze uitnodiging is al gebruikt.' };
    if (u.stand === 'ingetrokken') return { status: 409, error: 'Deze uitnodiging is ingetrokken.' };
    if (verlopen(u)) {
      u.stand = 'verlopen'; save();
      return { status: 409, error: 'Deze uitnodiging is verlopen.',
        uitleg: 'Vraag de werkgever om een nieuwe; dat kost hem één tik.' };
    }

    const r = employmentNieuw({ persoon, entiteit: u.entiteit, vestiging: u.vestiging,
      afdeling: u.afdeling, rol: u.rol, soort: u.soort, van: u.van });
    if (!r.ok) return r;

    u.stand = 'geaccepteerd';
    u.persoon = persoon;
    u.employment = r.employment.id;
    u.geaccepteerd = nu();
    save();

    const ent = entiteitVind(u.entiteit);
    const v = u.vestiging ? vestigingVind(u.vestiging) : null;
    return { ok: true, employment: r.employment,
      welkom: { kop: 'Welkom bij ' + (ent ? entiteitBeeld(ent).naam : 'uw nieuwe werkplek'),
        rol: u.rol, plaats: v ? (v.plaats || v.naam) : null,
        regel: 'Uw werkplek is klaar.' } };
  }

  function uitnodigingIntrek(u) {
    if (u.stand === 'geaccepteerd') {
      return { status: 409, error: 'Deze uitnodiging is al geaccepteerd.',
        uitleg: 'Beëindig het dienstverband; een geaccepteerde uitnodiging terugdraaien zou het werk dat er al op staat laten zweven.' };
    }
    u.stand = 'ingetrokken';
    save();
    return { ok: true, uitnodiging: beeld(u) };
  }

  /* ---- lezen ---- */
  function beeld(u) {
    return { id: u.id, code: u.stand === 'open' ? u.code : null,
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
    uitnodigingIntrek, uitnodigingTekst: tekst, uitnodigingBeeld: beeld,
    uitnodigingVanEntiteit: vanEntiteit, uitnodigingOpenstaand: openstaand },
    require('./uitnodiging-bulk')(Object.assign({}, ctx, { uitnodigingNieuw })));
};

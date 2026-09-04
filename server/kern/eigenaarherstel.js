/* HERSTEL VAN HET EIGENAARSACCOUNT -- de enige weg terug zonder toestel.

   Wat hij kan: EEN ding. Na een geldig quorum en een wachttijd mag er een
   nieuwe passkey op het eigenaarsaccount worden gezet. Geen sessie, geen
   inzage, geen geld, geen kluis. Een herstelweg die meer opent dan wat hij
   herstelt, is de weg waar iemand op gaat jagen.

   DRIE EIGENSCHAPPEN, EN ZE ZIJN ALLE DRIE NODIG (EIGENAAR.md par. 5.3):

   TRAAG -- een geldig quorum start een herstel dat pas na WACHTTIJD_MS werkt.
   Instant herstel maakt van twee gestolen delen een instant overname.

   LUID -- starten is een gebeurtenis: mail naar het eigenaarsadres, kritieke
   melding op het beveiligingsbord, regel in het logboek. Een herstel dat
   niemand ziet gebeuren is een achterdeur.

   AFBREEKBAAR -- zolang de wachttijd loopt, breekt ELKE nog werkende passkey
   het af (`eigenaar-herstel-af`, zie ./webauthn-acties.js). Dit is de kern: een
   dief met twee delen moet ook een week lang voorkomen dat de echte eigenaar
   een keer zijn vinger op zijn telefoon legt. Traag zonder afbreekbaar is
   alleen vertraging; samen is het een slot.

   FAIL-CLOSED. Zonder ingerichte verifier BESTAAT deze weg niet: elke route
   antwoordt dan dat er geen herstelweg is ingericht. Een half ingerichte
   herstelweg is gevaarlijker dan geen, want hij wekt de indruk van een vangnet.

   WIE ER GEEN DEEL HEEFT. RTG niet. Er is met opzet geen plek waar dit huis
   zelf een deel bewaart: EIGENAAR.md grens 5 zegt dat RTG het account van de
   eigenaar niet kan overnemen, en een deel bij RTG plus een gestolen deel is
   precies die overname. Wie dat ooit wil veranderen, verandert eerst die
   grens -- hardop. */
'use strict';
const quorum = require('./herstelquorum');

const WACHTTIJD_MS = 7 * 24 * 60 * 60 * 1000;   // zeven dagen; zie EIGENAAR.md par. 7 besluit 2
const POGING_MAX = 5;                            // foute quorumpogingen voor het slot dichtvalt
const SLOT_MS = 60 * 60 * 1000;

module.exports = ({ db, save, log, beveiligVan, mailVan, eigenaarEmail, nu }) => {
  const klok = () => (typeof nu === 'function' ? nu() : Date.now());
  const beveilig = () => { try { return typeof beveiligVan === 'function' ? beveiligVan() : null; } catch (e) { return null; } };

  /* De opslag loopt via ./eigencollectie.js en niet rechtstreeks over db.data:
     die deur declareert de collectie, geeft haar een eigenaar (keuringsregel 63)
     en houdt het aantal directe schrijvers omlaag. Een kaart en geen lijst --
     er is er maar een, en die draagt de verifier, de stand en het logje. */
  const eigen = require('./eigencollectie')({ db, domein: 'kern/eigenaarherstel',
    bezit: { eigenaarHerstel: 'kaart' } });

  function herstelstand() {
    const s = eigen.bak('eigenaarHerstel');
    if (!Array.isArray(s.log)) s.log = [];
    return s;
  }
  const ingericht = () => !!herstelstand().verifier;

  function meld(code, niveau, zin) {
    if (log && log.warn) log.warn(code, { zin });
    const b = beveilig();
    if (b) b.meld(code, niveau, zin, { bron: 'eigenaarherstel' });
    const s = herstelstand();
    s.log.unshift({ code, at: new Date(klok()).toISOString() });
    if (s.log.length > 50) s.log.length = 50;
  }

  /* INRICHTEN. Munt drie delen en bewaart alleen de verifier. De delen komen
     EEN keer terug en worden nergens opgeslagen; wie ze kwijtraakt richt
     opnieuw in (en dan vervalt het oude quorum). Opnieuw inrichten terwijl er
     een herstel loopt, breekt dat herstel af -- anders zou inrichten een manier
     zijn om een lopende afbreekbare procedure te omzeilen. */
  function richtIn() {
    const s = herstelstand();
    const m = quorum.munt();
    s.verifier = m.verifier;
    s.ingerichtOp = new Date(klok()).toISOString();
    if (s.lopend) { s.lopend = null; meld('eigenaarherstel-afgebroken-door-inrichting', 'kritiek',
      'Een lopend eigenaarsherstel is afgebroken doordat het quorum opnieuw is ingericht.'); }
    s.pogingen = 0; s.slotTot = 0;
    meld('eigenaarherstel-ingericht', 'kritiek',
      'Er is een nieuw herstelquorum voor het eigenaarsaccount ingericht. De drie delen zijn eenmalig ' +
      'getoond; het oude quorum werkt niet meer.');
    save();
    return { ok: true, delen: m.delen, wachttijdDagen: Math.round(WACHTTIJD_MS / 86400000) };
  }

  /* STARTEN. Twee delen. Bij een geldig paar begint de wachttijd; bij een fout
     paar telt de poging en valt het slot na POGING_MAX dicht. Het antwoord is
     in beide gevallen even karig -- of een quorum bestond, is zelf informatie. */
  function start(deelA, deelB) {
    const s = herstelstand();
    if (!ingericht()) return { status: 404, error: 'Er is geen herstelweg ingericht voor dit platform.' };
    if (s.slotTot && klok() < s.slotTot)
      return { status: 429, error: 'Te veel pogingen. Probeer het later opnieuw.' };

    if (!quorum.quorumKlopt(deelA, deelB, s.verifier)) {
      s.pogingen = (s.pogingen || 0) + 1;
      if (s.pogingen >= POGING_MAX) { s.slotTot = klok() + SLOT_MS; s.pogingen = 0; }
      meld('eigenaarherstel-mislukt', 'kritiek',
        'Mislukte poging om het eigenaarsaccount te herstellen met een onjuist quorum.');
      save();
      return { status: 401, error: 'Dit paar delen klopt niet.' };
    }

    s.pogingen = 0;
    if (s.lopend) return { status: 200, ok: true, klaarOp: s.lopend.klaarOp, alLopend: true };
    s.lopend = { gestartOp: new Date(klok()).toISOString(), klaarOp: new Date(klok() + WACHTTIJD_MS).toISOString() };
    meld('eigenaarherstel-gestart', 'kritiek',
      'Er is een herstel van het eigenaarsaccount gestart met een geldig quorum. Het wordt pas op ' +
      s.lopend.klaarOp + ' bruikbaar. Bent u dit niet zelf: breek het af met een van uw passkeys.');
    const mail = typeof mailVan === 'function' ? mailVan() : null;
    if (mail && mail.send) {
      try {
        mail.send(eigenaarEmail(), 'Herstel van uw RTG-eigenaarsaccount gestart',
          'Iemand is met een geldig herstelquorum een herstel van het eigenaarsaccount gestart.\n\n' +
          'Het wordt pas bruikbaar op ' + s.lopend.klaarOp + '.\n\n' +
          'Bent u dit niet zelf? Log in en breek het af met een van uw passkeys. Zolang u dat doet ' +
          'binnen de wachttijd, gebeurt er niets.');
      } catch (e) { /* de melding op het bord staat er sowieso */ }
    }
    save();
    return { status: 200, ok: true, klaarOp: s.lopend.klaarOp };
  }

  /* AFBREKEN. De aanroeper heeft zich al met een passkey bewezen (de route zet
     dat af via de zware poort); hier staat alleen wat er dan gebeurt. */
  function breekAf() {
    const s = herstelstand();
    if (!s.lopend) return { status: 404, error: 'Er loopt geen herstel.' };
    s.lopend = null;
    meld('eigenaarherstel-afgebroken', 'kritiek',
      'Een lopend herstel van het eigenaarsaccount is afgebroken met een passkey van de eigenaar.');
    save();
    return { status: 200, ok: true };
  }

  /* VOLTOOIEN. Opnieuw twee delen -- het starten alleen is geen bewijs dat de
     aanvrager ze een week later nog heeft -- en de wachttijd moet om zijn.
     Geeft een eenmalig venster terug waarin een nieuwe passkey mag worden
     geregistreerd; de route doet dat registreren, niet dit bestand. */
  function voltooi(deelA, deelB) {
    const s = herstelstand();
    if (!ingericht()) return { status: 404, error: 'Er is geen herstelweg ingericht voor dit platform.' };
    /* EERST HET QUORUM EN PAS DAARNA DE STAND, en die volgorde is geen smaak.
       Andersom antwoordt een FOUT paar met "er loopt geen herstel" en met "de
       wachttijd loopt nog" -- en dan is deze route een orakel waarmee iemand
       zonder enig deel kan aflezen of er een herstel loopt en hoe ver het is.
       Nu krijgt een fout paar altijd hetzelfde antwoord. */
    if (!quorum.quorumKlopt(deelA, deelB, s.verifier)) {
      meld('eigenaarherstel-mislukt', 'kritiek',
        'Mislukte poging om een lopend eigenaarsherstel te voltooien met een onjuist quorum.');
      save();
      return { status: 401, error: 'Dit paar delen klopt niet.' };
    }
    if (!s.lopend) return { status: 409, error: 'Er loopt geen herstel. Start er eerst een.' };
    if (klok() < Date.parse(s.lopend.klaarOp))
      return { status: 425, error: 'De wachttijd loopt nog.', klaarOp: s.lopend.klaarOp };

    s.lopend = null;
    s.venster = { tot: klok() + 15 * 60 * 1000 };
    meld('eigenaarherstel-voltooid', 'kritiek',
      'Een herstel van het eigenaarsaccount is voltooid. Er kan vijftien minuten lang een nieuwe ' +
      'passkey worden gezet; alle bestaande sessies zijn ongeldig gemaakt.');
    save();
    return { status: 200, ok: true, vensterTot: new Date(s.venster.tot).toISOString() };
  }

  /* Staat het venster open? De route vraagt dit vlak voor het registreren. Een
     venster gaat EEN keer op: wie hem gebruikt, sluit hem. */
  function herstelvensterOpen() {
    const s = herstelstand();
    return !!(s.venster && klok() < s.venster.tot);
  }
  function herstelvensterGebruikt() { const s = herstelstand(); s.venster = null; save(); }

  function stand() {
    const s = herstelstand();
    return {
      ingericht: ingericht(),
      ingerichtOp: s.ingerichtOp || null,
      lopend: s.lopend ? { klaarOp: s.lopend.klaarOp, gestartOp: s.lopend.gestartOp } : null,
      wachttijdDagen: Math.round(WACHTTIJD_MS / 86400000),
      log: s.log.slice(0, 10)
    };
  }

  return { richtIn, start, breekAf, voltooi, herstelvensterOpen, herstelvensterGebruikt, stand, ingericht, WACHTTIJD_MS };
};

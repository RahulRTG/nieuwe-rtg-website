/* ============================================================================
   HET PARTIJENREGISTER -- de Political Connector V1 (POLITIEK.md par. 7.1).

   HET REGISTER IS ZELF EEN MACHTSPUNT, dus toelating hangt uitsluitend aan een
   OFFICIELE REGISTRATIE en nooit aan een oordeel van dit systeem (besluit 3).
   Het kantoor schrijft een partij in op naam, met de bron van die registratie
   en de datum waarop een mens hem heeft nagekeken. Er is geen veld voor
   ideologie, grootte, zetels of betrouwbaarheid, en er komt er ook geen.

   TWEE CATEGORIEEN, EEN DEUR. `geregistreerd` (een geregistreerde aanduiding
   voor dat verkiezingsniveau) en `deelnemer` (neemt deel, ook als blanco lijst
   zonder aanduiding). De categorie zegt waar de toelating vandaan komt, niet
   hoeveel een partij mag: nergens in deze laag wordt erop vertakt.

   DE PARTIJ HANGT NIET AAN EEN RTG-ACCOUNT (besluit van de eigenaar, 29
   september 2026). Bij het inschrijven krijgt de partij EEN KEER een sleutel te
   zien. Die is een bearer uit kern/bearercode.js (namespace democratie.partij,
   128 bits): op schijf alleen de hash, zoeken in constante tijd over ALLE
   partijen, een vervaltijd van een jaar, en intrekken aan de serverkant. Een
   partij die morgen geen RTG meer wil, of een DemocratieOS zonder RTG (proef
   P3), heeft geen ledenaccount nodig om verder te gaan. Het kantoor kan de
   sleutel vervangen of de partij uitschrijven; de oude sleutel werkt dan niet
   meer.

   HET GEBRUIK WORDT NIET GETELD. Een partijsleutel opent een koppeling die bij
   elk verzoek wordt gebruikt; tellen zou van elke leesvraag een schrijfactie
   maken. Wat hem begrenst is de vervaltijd, vervangen, uitschrijven en de rem
   per bron op de deur. Er is ook geen eenmalige claim: uitgeven, vervangen en
   intrekken zijn elk een synchrone mutatie binnen een vastlegging.

   UITSCHRIJVEN WIST NIETS. Wat een partij heeft geplaatst blijft staan met de
   stand van de partij erbij (DO-10: geschiedenis wordt niet herschreven). */
'use strict';

const { schoon } = require('../util');

const NIVEAUS = ['europees', 'tweede-kamer', 'provincie', 'waterschap', 'gemeente'];
const CATEGORIEEN = ['geregistreerd', 'deelnemer'];
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const JAAR = 365 * 86400000;
const DOEL = 'partijdeur';
const SCOPE = 'democratie.partij.voorstel';

function maakPartijen({ kaart, kijk, vastleggen, crypto, nu }) {
  const bearer = require('../bearercode')({ crypto, namespace: 'democratie.partij', nu });
  const vind = (id) => kijk()[String(id || '').toUpperCase()] || null;

  /* Een nieuwe sleutel voor deze partij; de vorige wordt ingetrokken. */
  function nieuwGeheim(p, door) {
    if (p.sleutel) bearer.intrekken(p.sleutel, door, 'vervangen');
    const { code, toegang } = bearer.maak({ prefix: 'PP', issuer: 'democratie.kantoor', doel: DOEL, scope: SCOPE,
      onderwerp: { partij: p.id }, geldigMs: JAAR, maxGebruik: 1 });
    p.sleutel = toegang;
    return code;
  }

  /* Wat IEDEREEN over een partij ziet: het kantoor, een lid en de partij zelf
     krijgen dezelfde velden (PARTY_DATA_PARITY). */
  const beeld = (p) => ({ id: p.id, aanduiding: p.aanduiding, niveau: p.niveau, categorie: p.categorie,
    bron: { verwijzing: p.bron.verwijzing, gecontroleerd: p.bron.gecontroleerd }, stand: p.stand });

  function toets(b) {
    const aanduiding = schoon(b.aanduiding, 120);
    if (aanduiding.length < 2) return { fout: { status: 400, error: 'Geef de aanduiding zoals die in de officiele registratie staat.' } };
    if (!NIVEAUS.includes(b.niveau)) return { fout: { status: 400, error: 'Kies het verkiezingsniveau: ' + NIVEAUS.join(', ') + '.' } };
    if (!CATEGORIEEN.includes(b.categorie)) {
      return { fout: { status: 400, error: 'Kies geregistreerd (een geregistreerde aanduiding) of deelnemer (neemt deel, ook zonder aanduiding).' } };
    }
    const verwijzing = schoon(b.bron, 300);
    if (verwijzing.length < 5) return { fout: { status: 400, error: 'Zeg waar de officiele registratie staat. Het register oordeelt niet over partijen; de bron doet het werk.' } };
    if (!DATUM.test(String(b.gecontroleerd || ''))) return { fout: { status: 400, error: 'Zeg op welke dag een mens die registratie heeft nagekeken (JJJJ-MM-DD).' } };
    return { aanduiding, niveau: b.niveau, categorie: b.categorie, bron: { verwijzing, gecontroleerd: b.gecontroleerd } };
  }

  async function registreer(door, b) {
    const g = toets(b);
    if (g.fout) return g.fout;
    const dubbel = Object.values(kijk()).find(p => p.stand === 'actief' && p.niveau === g.niveau
      && p.aanduiding.toLowerCase() === g.aanduiding.toLowerCase());
    if (dubbel) return { status: 409, error: 'Deze aanduiding staat al ingeschreven voor dit niveau: ' + dubbel.id + '.' };
    let p = null, geheim = null;
    const mis = await vastleggen(() => {
      const register = kaart();
      let id;
      do { id = 'PP-' + crypto.randomBytes(3).toString('hex').toUpperCase(); } while (register[id]);
      p = Object.assign({ id, stand: 'actief', ingeschreven: { door, at: nu() }, historie: [] }, g);
      geheim = nieuwGeheim(p, door);
      p.historie.push({ wat: 'ingeschreven', door, at: nu() });
      register[id] = p;
    });
    return mis || { ok: true, partij: beeld(p), sleutel: geheim,
      let_op: 'Deze sleutel ziet u een keer. Geef hem aan de partij; wij bewaren alleen een hash.' };
  }

  async function vervangSleutel(door, id) {
    const p = vind(id);
    if (!p) return { status: 404, error: 'Onbekende partij.' };
    if (p.stand !== 'actief') return { status: 409, error: 'Deze partij is uitgeschreven.' };
    let geheim = null;
    const mis = await vastleggen(() => { geheim = nieuwGeheim(p, door); p.historie.push({ wat: 'sleutel-vervangen', door, at: nu() }); });
    return mis || { ok: true, partij: beeld(p), sleutel: geheim,
      let_op: 'De vorige sleutel werkt niet meer. Deze ziet u een keer.' };
  }

  async function uitschrijf(door, id, b) {
    const p = vind(id);
    if (!p) return { status: 404, error: 'Onbekende partij.' };
    if (p.stand !== 'actief') return { ok: true, herhaling: true, partij: beeld(p) };
    const reden = schoon(b.reden, 300);
    if (reden.length < 10) return { status: 400, error: 'Zeg in minstens tien tekens waarom, met de bron: een registratie die vervalt, of een verzoek van de partij zelf.' };
    const mis = await vastleggen(() => {
      p.stand = 'uitgeschreven';
      if (p.sleutel) bearer.intrekken(p.sleutel, door, 'uitgeschreven');
      p.historie.push({ wat: 'uitgeschreven', door, reden, at: nu() });
    });
    return mis || { ok: true, partij: beeld(p) };
  }

  /* Welke partij hoort bij dit geheim. bearer.vind vergelijkt met ELKE sleutel
     in het register en stopt niet bij de eerste; daarna moet de sleutel nog
     gelden (niet ingetrokken, niet verlopen, juiste doel en scope) en de
     partij actief zijn. */
  function vanSleutel(geheim) {
    if (!geheim) return null;
    const alle = Object.values(kijk());
    const toegang = bearer.vind(alle.map(p => p.sleutel).filter(Boolean), geheim);
    if (!toegang || bearer.reden(toegang, { doel: DOEL, scope: SCOPE, negeerGebruik: true })) return null;
    const p = vind(toegang.onderwerp && toegang.onderwerp.partij);
    return p && p.stand === 'actief' && p.sleutel && p.sleutel.code_hash === toegang.code_hash ? p : null;
  }

  const lijst = () => ({ ok: true, partijen: Object.values(kijk()).sort((a, b) => a.id.localeCompare(b.id)).map(beeld),
    niveaus: NIVEAUS, categorieen: CATEGORIEEN });

  return { registreer, vervangSleutel, uitschrijf, vanSleutel, lijst, beeld, vind };
}

module.exports = { maakPartijen, NIVEAUS, CATEGORIEEN };

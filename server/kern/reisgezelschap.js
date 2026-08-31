/* HET REISGEZELSCHAP -- de mensen rond ÉÉN reis.

   Dit is niet "vrienden" en niet "een tijdlijn". Het is de kleine kring die bij
   deze ene reis hoort: wie meereist, en wie meeleeft. Die twee zien met opzet
   niet hetzelfde, en dat verschil is de hele module.

   DE POORT IS HET PRODUCT. Niet het scherm, niet de tijdlijn: `zicht()`, en
   die staat in ./reisgezelschap-poort.js met de tabel erbij. Elke uitgifte van
   een reis aan iemand anders dan de reiziger gaat daar langs.

   Dit bestand gaat over het GEZELSCHAP zelf: uitnodigen, aanvaarden,
   weghalen, en wie er in staat. Wat er gedeeld wordt (tijdlijn, aankomst,
   beeld) staat in ./reisgezelschap-delen.js.

   De tabel "wie wat ziet" stond hier ook, en is weg: hij hoort bij de poort en
   niet op twee plekken. Twee tabellen over dezelfde regel lopen uit elkaar.

   DRIE GRENZEN DIE UIT LIFE.md PAR. 4 KOMEN EN HIER VORM KRIJGEN:

   1. WAT EEN TWEEDE PERSOON BEREIKT, BEVESTIGT EEN MENS. Een uitnodiging staat
      op `gevraagd` en doet niets tot de ANDER hem aanvaardt. Niemand wordt in
      een gezelschap gezet.
   2. ER IS GEEN LIVE LOCATIE, en dat is een besluit en geen ontbrekende
      functie. Een reiziger deelt een MOMENT ("ik ben er"); er loopt geen stip
      mee. Daarom kent deze module geen coördinaten -- ook niet als veld.
   3. ER KOMT GEEN CIJFER OP HET LEVEN TUSSEN MENSEN. Geen likes, geen teller
      wie het meest kijkt, geen volgorde op betrokkenheid. De tijdlijn is een
      tijdlijn: op tijd gesorteerd, en verder niets.

   INTREKKEN WERKT ECHT. Wie eruit gaat, ziet niets meer -- ook niet wat er
   eerder stond. Dat kan alleen omdat de tijdlijn bij de REIS hoort en niet bij
   de kijker: er is geen kopie in een postvak van iemand anders.

   EN ER KOMEN GEEN NAMEN IN. Een gezelschapslid staat hier met zijn CODENAAM,
   zoals overal buiten de identiteitskluis (CLAUDE.md). */
'use strict';

const klok = require('../lib/klok');
const poort = require('./reisgezelschap-poort');
const { ROLLEN, STANDEN } = poort;

const MAX_TEKST = 1200;
const MAX_LEDEN = 30;

module.exports.maakReisgezelschap = ({ db, save, crypto, mijnReizen, codenaamVan, keyVanCodenaam, bestandenDeel }) => {
  const nu = () => klok.datum().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const naam = (key) => (typeof codenaamVan === 'function' ? codenaamVan(key) : null) || key;

  const eigen = require('./eigencollectie')({
    db, domein: 'kern/reisgezelschap',
    bezit: { reisGezelschap: 'lijst', reisTijdlijn: 'lijst', reisDeelbeleid: 'kaart' }
  });
  const leden = () => eigen.bak('reisGezelschap');
  const posts = () => eigen.bak('reisTijdlijn');
  const beleidBak = () => eigen.bak('reisDeelbeleid');

  const reisVan = (key, reisId) => (mijnReizen(key).reizen || []).find(r => r.id === reisId) || null;

  /* DE POORT staat in ./reisgezelschap-poort.js: de witte lijst per rol, en
     wie welke rol heeft. Een eigen bestand omdat het het enige is dat tussen
     de boekingsgegevens van de een en het scherm van de ander staat -- wie
     daaraan werkt, hoort niet eerst door het uitnodigen heen te lezen. */
  const rolVan = poort.maakRolVan(leden);
  const zicht = poort.zicht;

  /* UITNODIGEN. Zet een verzoek klaar; de ander aanvaardt het zelf. */
  /* EEN CODENAAM IS GEEN SLEUTEL. Dit stond hier eerst wel zo: de opgegeven
     codenaam werd bewaard en later vergeleken met de SESSIESLEUTEL van de
     kijker. Dat kan alleen kloppen als een lid de sleutel van een ander kent --
     en die kent hij niet, dus de uitnodiging kwam nooit aan. De vertaling
     hoort hier, één keer, langs `keyVanCodenaam` uit de ledengids (kern/gids.js) --
     er komt geen tweede manier bij om iemand op te zoeken. */
  async function nodigUit(key, reisId, codenaam, rol) {
    const reis = reisVan(key, reisId);
    if (!reis) return { status: 404, error: 'Deze reis staat niet bij u.' };
    if (!ROLLEN.includes(rol)) return { status: 400, error: 'Kies reisgenoot of meekijker.' };
    const gevraagd = schoon(codenaam, 60);
    if (!gevraagd) return { status: 400, error: 'Geef de codenaam van de persoon die u uitnodigt.' };
    const treffer = typeof keyVanCodenaam === 'function' ? await keyVanCodenaam(gevraagd) : null;
    const lid = treffer && treffer.key;
    if (!lid) return { status: 404, error: 'Er is geen lid met de codenaam ' + gevraagd + '.' };
    if (lid === key) return { status: 400, error: 'U staat zelf al bij deze reis.' };
    const rij = leden().filter(x => x.reis === reisId && x.eigenaar === key);
    if (rij.length >= MAX_LEDEN) return { status: 400, error: 'Een gezelschap telt maximaal ' + MAX_LEDEN + ' mensen.' };
    const bestaat = rij.find(x => x.lid === lid);
    if (bestaat) return { status: 409, error: 'Deze persoon staat al in het gezelschap (' + bestaat.stand + ').' };
    const rec = {
      id: 'G-' + crypto.randomBytes(4).toString('hex'),
      reis: reisId, eigenaar: key, eigenaarCodenaam: naam(key),
      lid, lidCodenaam: treffer.codename || gevraagd,
      rol, stand: 'gevraagd', gevraagdOp: nu(), aanvaardOp: null
    };
    leden().push(rec); save();
    return { status: 200, ok: true, lid: toon(rec) };
  }

  /* AANVAARDEN doet de uitgenodigde zelf, en niemand anders. */
  function antwoord(key, id, ja) {
    const rec = leden().find(x => x.id === id && x.lid === key);
    if (!rec) return { status: 404, error: 'Geen openstaande uitnodiging.' };
    if (rec.stand !== 'gevraagd') return { status: 409, error: 'Deze uitnodiging is al afgehandeld.' };
    if (!ja) {
      db.data.reisGezelschap = leden().filter(x => x !== rec); save();
      return { status: 200, ok: true, stand: 'geweigerd' };
    }
    rec.stand = 'aanvaard'; rec.aanvaardOp = nu(); save();
    return { status: 200, ok: true, stand: 'aanvaard' };
  }

  /* INTREKKEN. Door de eigenaar (iemand eruit), of door het lid zelf (weggaan).
     In beide gevallen verdwijnt de toegang tot alles -- ook tot wat er eerder
     stond, want er is geen kopie elders. */
  async function verwijder(key, id) {
    const rec = leden().find(x => x.id === id && (x.eigenaar === key || x.lid === key));
    if (!rec) return { status: 404, error: 'Niet gevonden.' };
    db.data.reisGezelschap = leden().filter(x => x !== rec); save();
    /* EN DE BEELDEN GAAN MEE. Wie de tijdlijn kwijtraakt maar de fotos houdt,
       is niet weggehaald; dat is een halve waarheid en die is erger dan geen.
       De deellaag van de kluis is hier de baas -- wij zetten alleen de
       codenaam uit de lijst van elk beeld van deze reis. */
    const codenaam = rec.lidCodenaam || naam(rec.lid);
    if (typeof bestandenDeel === 'function') {
      const beelden = posts().filter(p => p.reis === rec.reis && p.eigenaar === rec.eigenaar && p.bestand);
      for (const p of beelden) {
        try { await bestandenDeel(rec.eigenaar, p.bestand, codenaam, false); } catch (e) { /* de kluis meldt zelf */ }
      }
    }
    return { status: 200, ok: true, beeldenIngetrokken: true };
  }

  const toon = (x) => ({
    id: x.id, reis: x.reis, codenaam: x.lidCodenaam || naam(x.lid), rol: x.rol, stand: x.stand,
    gevraagdOp: x.gevraagdOp, aanvaardOp: x.aanvaardOp
  });

  /* HET GEZELSCHAP van een reis. Alleen de eigenaar en aanvaarde leden zien
     wie erbij zit; een openstaande uitnodiging is alleen zichtbaar voor de
     eigenaar en voor de gevraagde zelf. */
  function gezelschap(key, reisId) {
    const eigenaar = reisVan(key, reisId);
    if (eigenaar) {
      return { status: 200, ok: true, rol: 'eigenaar',
        leden: leden().filter(x => x.reis === reisId && x.eigenaar === key).map(toon) };
    }
    const mijn = leden().find(x => x.reis === reisId && x.lid === key && x.stand === 'aanvaard');
    if (!mijn) return { status: 404, error: 'Deze reis staat niet bij u.' };
    return { status: 200, ok: true, rol: mijn.rol,
      leden: leden().filter(x => x.reis === reisId && x.eigenaar === mijn.eigenaar && x.stand === 'aanvaard').map(toon) };
  }

  /* WAT IEMAND VAN EEN REIS ZIET. Voor de eigenaar zijn eigen reis; voor een
     ander de reis van de eigenaar, door de poort. */
  function reisVoor(key, reisId) {
    const eigen = reisVan(key, reisId);
    if (eigen) return { status: 200, ok: true, reis: zicht(eigen, 'eigenaar') };
    const mijn = leden().find(x => x.reis === reisId && x.lid === key && x.stand === 'aanvaard');
    if (!mijn) return { status: 404, error: 'Deze reis staat niet bij u.' };
    const bron = reisVan(mijn.eigenaar, reisId);
    if (!bron) return { status: 404, error: 'De reis bestaat niet meer.' };
    return { status: 200, ok: true, reis: zicht(bron, mijn.rol), van: mijn.eigenaarCodenaam || naam(mijn.eigenaar) };
  }

  /* MIJN UITNODIGINGEN -- wat er aan mij gevraagd is, en wat ik zelf meereis. */
  function mijnKring(key) {
    return { status: 200, ok: true,
      gevraagd: leden().filter(x => x.lid === key && x.stand === 'gevraagd')
        .map(x => ({ id: x.id, reis: x.reis, van: x.eigenaarCodenaam, rol: x.rol, gevraagdOp: x.gevraagdOp })),
      meereizen: leden().filter(x => x.lid === key && x.stand === 'aanvaard')
        .map(x => ({ id: x.id, reis: x.reis, van: x.eigenaarCodenaam, rol: x.rol })) };
  }

  /* WAT ER GEDEELD WORDT staat in ./reisgezelschap-delen.js: de tijdlijn, het
     aankomstmoment en het beeld. Die deelmodule krijgt dezelfde bakken en
     dezelfde hulpjes mee -- er ontstaat geen tweede opslag en geen tweede
     manier om een reis van iemand op te zoeken. */
  const delen = require('./reisgezelschap-delen').maakGezelschapDelen({
    db, save, crypto, klok, posts, leden, beleidBak, reisVan, naam, schoon, MAX_TEKST, bestandenDeel
  });

  return {
    reisgezelschap: Object.assign({
      ROLLEN, STANDEN, zicht, rolVan, nodigUit, antwoord, verwijder,
      gezelschap, reisVoor, mijnKring
    }, delen)
  };
};

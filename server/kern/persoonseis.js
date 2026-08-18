/* Kern-module "persoonseis": WAT VRAAGT DIT GENRE VAN DE MENS ZELF.

   DE SPIEGEL VAN kern/aanmeldingen/bewijs.js. Daar staat wat een genre van de
   ZAAK vraagt voordat zij live gaat; hier staat wat datzelfde genre van de
   PERSOON vraagt voordat hij mag werken of iets zwaars mag doen. Dat die twee
   uit elkaar liepen was het gat: acht genres hielden de zaak tegen tot er een
   vergunning was gezien, en lieten daarna iedereen met vier cijfers binnen.

   TWEE REIKWIJDTES, EN HET VERSCHIL IS ECHT.

     werk         houdt de SESSIE tegen. Voor een kinderopvang geldt dat voor
                  iedereen die er werkt: er is geen functie in een opvang waarbij
                  je niet in de buurt van een kind komt.
     handelingen  houdt EEN HANDELING tegen en laat het werk staan. Een
                  huisartsenpraktijk heeft een balie, en die balie hoort gewoon
                  te kunnen werken; wat zij niet hoort te kunnen is een recept
                  uitschrijven. Dat onderscheid weglaten zou de poort onbruikbaar
                  maken, en een onbruikbare poort wordt uitgezet.

   DE EIS IS EEN FILTER, GEEN ROL. Verloopt een VOG, dan valt het werk weg en
   blijft de rol staan -- "u werkt hier niet meer" en "uw VOG is verlopen" vragen
   om een ander gesprek. Dezelfde vorm als magWerken() in kern/werkvenster.js:
   een geldige inlog tegenhouden zonder dat er iets aan rechten verandert. Er
   komt dus GEEN derde rechtenmodel bij; dat is een grens uit CONCERN.md.

   WAT ER BEWUST NIET IN STAAT. Een handeling die hier wel genoemd wordt maar
   nergens wordt afgedwongen. Dat zou LAT-regel 6 zijn (een belofte in tekst is
   een belofte in code) in zijn gevaarlijkste vorm: een register dat rust geeft
   die niemand heeft verdiend. test/persoonseis.test.js loopt daarom elke
   handeling uit dit bestand langs en eist dat de bijbehorende kernfunctie hem
   werkelijk weigert. Wie er een toevoegt zonder hem aan te sluiten, ziet die
   toets zakken.

   EN RTG VALIDEERT NIETS INHOUDELIJK, ook hier niet. Wij bellen het BIG-register
   niet. Wat een poort hier afdwingt is: er is een stuk, met een nummer en een
   einddatum, en een mens van RTG heeft het gezien. Zie kern/vakbewijs.js. */
'use strict';

/* De soorten, de handelingen en het register zelf staan in ./persoonseis-lijst.js
   -- pure data, afgesplitst omdat een productbestand niet over de 10 KB hoort
   (keuringsregel 13), net als seed/genres-lijst.js dat doet. */
const { SOORTEN, HANDELINGEN, EISEN } = require('./persoonseis-lijst');

module.exports = ({ vakbewijsHeeft, identiteitVan, sleutelLid }) => {

  const eisVan = (genre) => EISEN[String(genre || '')] || null;

  /* Heeft deze mens dit ENE stuk? De soort bepaalt waar we kijken, en dat is de
     hele reden dat `identiteit` erin zit: die stond al in de kluis
     (routes/auth/verificatie.js) en werd nergens afgedwongen. Er komt geen
     tweede intake naast; deze poort LEEST de bestaande. */
  function heeftStuk(persoon, soort) {
    const def = SOORTEN[soort];
    if (!def) return { ok: false, reden: 'onbekend', soort };
    if (def.bron === 'verificatie') {
      const st = identiteitVan(persoon);
      if (st && st.geverifieerd) return { ok: true, soort };
      return { ok: false, soort, reden: st && st.stand === 'pending' ? 'in-behandeling' : 'ontbreekt' };
    }
    const r = vakbewijsHeeft(persoon.sleutel, soort, { aftekening: true });
    return r.ok ? { ok: true, soort, vakbewijs: r.vakbewijs } : { ok: false, soort, reden: r.reden, tot: r.tot || null };
  }

  /* De zin die de mens te zien krijgt. Een weigering zonder uitleg leert mensen
     dingen stapelen tot het werkt; een weigering die het VERSCHIL niet noemt
     tussen ontbreekt en verlopen laat iemand het verkeerde stuk opsturen. */
  function zin(m, genre) {
    const def = SOORTEN[m.soort] || { naam: m.soort, uitleg: '' };
    const kop = 'Voor werk in dit genre (' + genre + ') is ' + def.naam + ' nodig. ';
    if (m.reden === 'verlopen') return kop + 'Het vastgelegde stuk is verlopen' + (m.tot ? ' op ' + m.tot : '') + '.';
    if (m.reden === 'ingetrokken') return kop + 'Het vastgelegde stuk is ingetrokken.';
    if (m.reden === 'niet-gezien') return kop + 'Er is een stuk ingediend, maar RTG heeft het nog niet gezien en afgetekend.';
    if (m.reden === 'in-behandeling') return kop + 'Uw verificatie loopt nog; zodra die rond is kunt u aan de slag.';
    return kop + def.uitleg;
  }

  /* ---- DE TWEE POORTEN ----
     Allebei geven ze { ok } of { ok:false, error, missend }. Nooit een
     half antwoord: wie hier "misschien" teruggeeft, dwingt elke aanroeper zijn
     eigen besluit te nemen en dan zijn er zoveel besluiten als aanroepers. */

  /* Mag deze mens hier WERKEN? Voor een genre zonder werk-eis altijd ja, en dat
     is geen versoepeling maar het register dat zijn werk doet. */
  function magWerkenHier(genre, persoon) {
    const eis = eisVan(genre);
    if (!eis || !eis.werk || !eis.werk.length) return { ok: true };
    if (!persoon || !persoon.sleutel) {
      return { ok: false, reden: 'geen-account', missend: eis.werk.slice(),
        error: 'Voor werk in dit genre is een eigen RTG-account met een vastgestelde identiteit nodig. ' +
          'Vraag uw werkgever om een uitnodiging op uw eigen naam.' };
    }
    const missend = eis.werk.map(s => heeftStuk(persoon, s)).filter(m => !m.ok);
    if (!missend.length) return { ok: true };
    return { ok: false, reden: 'persoonseis', missend,
      error: zin(missend[0], genre) };
  }

  /* Mag deze mens deze HANDELING doen? Een handeling die het genre niet kent,
     is geen handeling van dit genre -- dat weigeren we, want stil doorlaten is
     precies hoe receptMaak() jarenlang op het genre en niet op de mens toetste. */
  function magHandeling(genre, handeling, persoon) {
    if (!HANDELINGEN[handeling]) return { ok: false, reden: 'onbekende-handeling',
      error: 'Deze handeling kennen we niet: ' + handeling };
    const eis = eisVan(genre);
    const nodig = eis && eis.handelingen ? eis.handelingen[handeling] : null;
    if (!nodig || !nodig.length) return { ok: true };
    if (!persoon || !persoon.sleutel) {
      return { ok: false, reden: 'geen-account', missend: nodig.slice(),
        error: 'Om ' + HANDELINGEN[handeling] + ' is een persoonlijke inlog met een eigen RTG-account nodig.' };
    }
    const missend = nodig.map(s => heeftStuk(persoon, s)).filter(m => !m.ok);
    if (!missend.length) return { ok: true };
    const def = SOORTEN[missend[0].soort] || { naam: missend[0].soort };
    return { ok: false, reden: 'persoonseis', missend,
      error: 'Om ' + HANDELINGEN[handeling] + ' is ' + def.naam + ' op uw eigen naam nodig. ' +
        (missend[0].reden === 'verlopen' ? 'Het vastgelegde stuk is verlopen.'
          : missend[0].reden === 'niet-gezien' ? 'Uw stuk is ingediend maar nog niet door RTG gezien.'
            : 'Er staat er geen op uw naam.') };
  }

  /* De persoon-sleutel uit een supplier-actor. Personeel heeft altijd een eigen
     RTG-account (routes/werving.js), dus geen `lid` betekent hier werkelijk
     "niemand" -- een gedeelde bedrijfsinlog, en die hoort deze poorten niet te
     halen in een genre dat om een mens vraagt. */
  function persoonVanActor(actor) {
    const lid = actor && actor.lid != null ? Number(actor.lid) : null;
    if (lid == null || !Number.isFinite(lid)) return null;
    return { lid, sleutel: sleutelLid(lid) };
  }

  /* IS DIT DE GEDEELDE BEDRIJFSINLOG? Die draagt geen personeelsrij en geen
     lidnummer -- er valt letterlijk geen mens van te eisen. server.js laat hem
     als enige langs de poort, en ALLEEN in demostand (zie persoonsPoort daar).

     Deze vorm staat hier met een naam omdat hij het risicovolle deel van die
     uitzondering is: wordt hij te breed, dan glipt er personeel doorheen. Een
     personeelslid draagt altijd een staffId, en een eigenaar die met zijn eigen
     RTG-account binnenkomt draagt een lid -- allebei dus NIET gedeeld.
     test/persoonseis.test.js houdt die drie gevallen uit elkaar. */
  function isGedeeldeInlog(actor) {
    return !!(actor && actor.manager && actor.staffId == null && actor.lid == null);
  }

  /* Wat een zaak van dit genre van haar mensen moet hebben. Voor het
     personeelsscherm: niet pas bij de deur horen wat er ontbreekt. */
  function eisenVoorGenre(genre) {
    const eis = eisVan(genre);
    if (!eis) return { genre, werk: [], handelingen: {} };
    const uit = { genre, werk: (eis.werk || []).map(s => Object.assign({ id: s }, SOORTEN[s])), handelingen: {} };
    for (const [h, soorten] of Object.entries(eis.handelingen || {})) {
      uit.handelingen[h] = { wat: HANDELINGEN[h], nodig: soorten.map(s => Object.assign({ id: s }, SOORTEN[s])) };
    }
    return uit;
  }

  return { magWerkenHier, magHandeling, persoonVanActor, isGedeeldeInlog, eisenVoorGenre, eisVan, heeftStuk,
    SOORTEN, HANDELINGEN, EISEN };
};

module.exports.SOORTEN = SOORTEN;
module.exports.HANDELINGEN = HANDELINGEN;
module.exports.EISEN = EISEN;
/* De genres met een eis, voor de toetsen en voor het register-kruisverband:
   test/persoonseis.test.js eist dat elk genre hieronder ECHT bestaat in
   seed/genres-lijst.js. Een eis op een genre dat niet bestaat, bewaakt niets. */
module.exports.GENRES_MET_EIS = Object.keys(EISEN);

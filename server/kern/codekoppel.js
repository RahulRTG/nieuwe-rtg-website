/* DE CODE KOPPELT EEN ACCOUNT AAN EEN DOSSIER (eigenaarsbesluit 19 oktober
   2026, AGENTS.md: gebruiken vraagt een account).

   De codeportalen van de RTFoundation -- partnerstichting, gemeente,
   ondernemer, vrijwilliger, hulpvrager, donateur, club en stadsraadpartner --
   openden een dossier op een code alleen. De code was de geloofsbrief, en wie
   hem over een schouder meelas, was binnen. Nu staat `auth` voor elke codedeur
   (een gratis account is genoeg), en deze module beslist de tweede helft:

     - de EERSTE keer dat een account met een geldige code een dossier opent,
       hangt dat account aan die code. Wie het was en wanneer staat hier (de
       sessiesleutel en de codenaam, nooit een echte naam);
     - daarna is de code een EXTRA sleutel naast de sessie, en alleen voor dat
       account. Voor elk ander account bestaat de code niet: 404, met dezelfde
       zin als een code die nergens bij hoort -- een tweede account mag niet
       kunnen aflezen dat een code geldig is;
     - elke opening telt mee (aantal en laatste keer), zodat een inzage aan een
       codenaam hangt.

   Een ongeldige code koppelt niets: er wordt pas vastgelegd als het portaal
   zelf een antwoord zonder fout gaf. Twee accounts die tegelijk de eerste
   willen zijn: de koppeling wordt NA het werk nog een keer gelezen, en wie dan
   niet de gekoppelde is, krijgt 404 in plaats van het dossier.

   ATOMAIR (machinedekking, 19 oktober 2026). Elke schrijfactie hier loopt door
   een collectietransactie (db/collectie-bewerken.js: in PostgreSQL en SQLite
   een databaseslot, in het geheugen een kopie die pas na save() verschijnt):
   de koppeling zelf (lezen, controleren en schrijven in een slot, dus twee
   instances kunnen niet allebei de eerste zijn), het vervallen, en ROTEREN.
   Een rotatie is drie stappen -- oude code dicht, nieuwe code erin, koppeling
   weg -- en de eerste twee zijn EEN wissel op het dossier, in EEN transactie op
   de collectie van dat dossier. Valt het daarna stil, dan werkt de nieuwe code
   al volledig en opent de oude niets meer: de koppelregel van de oude code hangt
   dan aan een code die nergens meer bij hoort. Een tussenstand bestaat niet.

   WAT DIT NIET IS: een vervanging van de code. Het portaal kijkt nog steeds
   zelf of de code bestaat, verlopen of ingetrokken is. Een nieuwe code
   (roteren) is een nieuwe koppeling; het kantoor roteert juist wanneer een
   code in verkeerde handen is. De sleutel is een hash van soort en code: de
   code zelf staat hier niet. */
'use strict';

const crypto = require('crypto');
const verraad = require('../lib/verraad');

const ONBEKEND = 'Deze code kennen we niet. Vraag de stichting om de code.';
const volg = (r, fn) => (r && typeof r.then === 'function' ? r.then(fn) : fn(r));

module.exports = ({ db, save, nu, bewerkCollectie }) => {
  const tijd = () => (typeof nu === 'function' ? nu() : new Date().toISOString());
  const bak = () => (db.data.codekoppelingen = db.data.codekoppelingen || {});
  const bewerk = () => bewerkCollectie || require('../db').bewerkCollectie;
  /* Een schrijfactie op een collectie, heel of niet (zie de kop). */
  const metTransactie = (collectie, werk) => bewerk()(collectie, werk);
  const sleutel = (soort, code) => crypto.createHash('sha256')
    .update('codekoppel|' + soort + '|' + String(code || '').trim().toUpperCase()).digest('hex').slice(0, 40);
  const wie = (req) => {
    const s = (req && req.session) || {};
    return { key: s.key ? String(s.key) : '', codenaam: (s.account && s.account.codename) || null };
  };
  const vreemd = (rij, w) => !!(rij && rij.key && rij.key !== w.key);

  /* met(req, soort, code, werk): voer het portaalwerk uit voor dit account.
     Geeft het antwoord van het werk, of { status, error } als de code al aan
     een ander account hangt. Kan een belofte teruggeven (PostgreSQL); de
     routes wachten erop. */
  function met(req, soort, code, werk) {
    const w = wie(req);
    if (!w.key) return { status: 401, error: 'Log in met je RTG-account; een gratis account is genoeg.', accountNodig: true };
    const k = sleutel(soort, code);
    if (vreemd(bak()[k], w)) return { status: 404, error: ONBEKEND };
    return volg(werk(), r => leg(k, soort, w, r));
  }
  // de koppeling vastleggen: lezen, controleren en schrijven in een slot
  function leg(k, soort, w, r) {
    if (!r || r.error) return r;
    return volg(metTransactie('codekoppelingen', bron => {
      const rij = bron[k];
      if (vreemd(rij, w)) return false;
      const nu_ = tijd();
      bron[k] = Object.assign(rij || { soort, key: w.key, codenaam: w.codenaam, sinds: nu_, aantal: 0 },
        { laatst: nu_, aantal: ((rij && rij.aantal) || 0) + 1 });
      return true;
    }), ok => (ok ? r : { status: 404, error: ONBEKEND }));
  }

  /* Na roteren: de koppeling van de oude code vervalt. */
  function vervalt(soort, code) {
    if (!code) return false;
    const k = sleutel(soort, code);
    return metTransactie('codekoppelingen', bron => {
      if (!bron[k]) return false;
      delete bron[k];
      return true;
    });
  }

  /* ROTEREN, voor elke code die als tekst op een dossier staat (partner,
     gemeente, ondernemer, club, stadsraadpartner). `collectie` is de collectie
     van het dossier, `vind(bron)` geeft de rij in die (gekopieerde) collectie,
     `nieuw()` de nieuwe code, `naWissel(rij, bron)` mag in DEZELFDE transactie
     iets vastleggen (een auditregel). Geeft { oud, code } of null. */
  function roteer({ collectie, soort, vind, nieuw, naWissel }) {
    return volg(metTransactie(collectie, bron => {
      const rij = vind(bron);
      if (!rij) return null;
      const oud = rij.code;
      rij.code = nieuw();                                    // stap 1 en 2: een wissel
      if (verraad.sla('coderotatie-crasht-in-wissel')) throw new Error('verraad: coderotatie-crasht-in-wissel');
      if (typeof naWissel === 'function') naWissel(rij, bron);
      return { oud, code: rij.code };
    }), uit => {
      if (!uit) return null;
      if (verraad.sla('coderotatie-crasht-na-wissel')) throw new Error('verraad: coderotatie-crasht-na-wissel');
      return volg(vervalt(soort, uit.oud), () => uit);       // stap 3
    });
  }

  // voor het kantoor en de toetsen: hangt deze code aan een account, en aan welke codenaam
  function koppelingVan(soort, code) {
    const rij = bak()[sleutel(soort, code)];
    return rij ? { soort: rij.soort, codenaam: rij.codenaam, sinds: rij.sinds, laatst: rij.laatst, aantal: rij.aantal } : null;
  }

  return { met, vervalt, roteer, koppelingVan, ONBEKEND };
};

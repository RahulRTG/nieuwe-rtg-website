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

   WAT DIT NIET IS: een vervanging van de code. Het portaal kijkt nog steeds
   zelf of de code bestaat, verlopen of ingetrokken is. Een nieuwe code
   (roteren) is een nieuwe koppeling; het kantoor roteert juist wanneer een
   code in verkeerde handen is. De sleutel is een hash van soort en code: de
   code zelf staat hier niet. */
'use strict';

const crypto = require('crypto');

const ONBEKEND = 'Deze code kennen we niet. Vraag de stichting om de code.';

module.exports = ({ db, save, nu }) => {
  const tijd = () => (typeof nu === 'function' ? nu() : new Date().toISOString());
  const opslag = require('./eigencollectie')({ db, domein: 'kern/codekoppel', bezit: { codekoppelingen: 'kaart' } });
  const bak = () => opslag.bak('codekoppelingen');
  const kijk = () => opslag.kijk('codekoppelingen');
  const sleutel = (soort, code) => crypto.createHash('sha256')
    .update('codekoppel|' + soort + '|' + String(code || '').trim().toUpperCase()).digest('hex').slice(0, 40);
  const wie = (req) => {
    const s = (req && req.session) || {};
    return { key: s.key ? String(s.key) : '', codenaam: (s.account && s.account.codename) || null };
  };
  const vreemd = (rij, w) => !!(rij && rij.key && rij.key !== w.key);

  /* met(req, soort, code, werk): voer het portaalwerk uit voor dit account.
     Geeft het antwoord van het werk, of { status, error } als de code al aan
     een ander account hangt. Geeft `werk` een belofte, dan geeft dit er ook
     een; anders blijft het synchroon (de kantoorverpakking van rtfkantoor
     wacht niet). */
  function met(req, soort, code, werk) {
    const w = wie(req);
    if (!w.key) return { status: 401, error: 'Log in met je RTG-account; een gratis account is genoeg.', accountNodig: true };
    const k = sleutel(soort, code);
    if (vreemd(kijk()[k], w)) return { status: 404, error: ONBEKEND };
    const r = werk();
    return r && typeof r.then === 'function' ? r.then(x => leg(k, soort, w, x)) : leg(k, soort, w, r);
  }
  function leg(k, soort, w, r) {
    if (!r || r.error) return r;
    const rij = kijk()[k];
    if (vreemd(rij, w)) return { status: 404, error: ONBEKEND };
    const nu_ = tijd();
    bak()[k] = Object.assign(rij || { soort, key: w.key, codenaam: w.codenaam, sinds: nu_, aantal: 0 },
      { laatst: nu_, aantal: ((rij && rij.aantal) || 0) + 1 });
    if (typeof save === 'function') save();
    return r;
  }

  /* Na roteren: de koppeling van de oude code vervalt. De oude code vindt in
     het portaal al geen dossier meer; dit haalt ook de regel weg, zodat er
     geen koppeling blijft staan aan iets dat niet meer bestaat. */
  function vervalt(soort, code) {
    if (!code) return false;
    const k = sleutel(soort, code);
    if (!kijk()[k]) return false;
    delete bak()[k];
    if (typeof save === 'function') save();
    return true;
  }

  // voor het kantoor en de toetsen: hangt deze code aan een account, en aan welke codenaam
  function koppelingVan(soort, code) {
    const rij = kijk()[sleutel(soort, code)];
    return rij ? { soort: rij.soort, codenaam: rij.codenaam, sinds: rij.sinds, laatst: rij.laatst, aantal: rij.aantal } : null;
  }

  return { met, vervalt, koppelingVan, ONBEKEND };
};

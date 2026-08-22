/* Eenaccount (deelbestand): de AFGELEIDE sleutels aan de sleutelbos.

   De meeste sleutels zijn gekoppeld: je bewijst een keer je werk-inlog en de
   rol wordt opgeslagen in db.data.accountRollen (zie ./koppelen.js). Twee
   sleutels werken anders -- ze worden niet bewaard maar AFGELEID uit een
   waarheid die ergens anders al staat. Dat is met opzet: aan iets wat je al
   BENT valt niets te koppelen of te ontkoppelen, en een tweede kopie van die
   waarheid loopt gegarandeerd uit de pas met het origineel (LAT-regel 4).

   1. DE EIGENAAR HEEFT DE KANTOORDEUR AL. server/eigenaar.js legt vast dat de
      eigenaar overal bij de beheeromgevingen kan, met zoveel woorden: "de
      RTG-Backoffice (met zijn eigen accountlogin, zonder aparte code)".
      Achter de deur klopte dat ook -- boardroomWie() kent hem, en accStart
      munt voor de rol 'kantoor' netjes een office-sessie. Maar de sleutelbos
      zelf kende alleen GEKOPPELDE rollen, en koppelen vraagt om de
      backoffice-code. Gevolg: de eigenaar kreeg in de werk-kiezer op zijn
      telefoon "Nog geen werkplek gekoppeld" -- een belofte in de tekst die de
      code niet nakwam. De sleutel verdwijnt vanzelf bij een overdracht.

   2. EEN WERKRUIMTE WAAR JE AL AAN GEKOPPELD BENT. Het RTG Werk OS
      (server/bedrijf/) heeft zijn eigen inlog: een werkruimtecode plus een
      lid-token. Dat blijft zo -- een werkruimte hoort ook te werken voor
      iemand zonder RTG-pas. Maar wie zijn RTG-account er een keer aan
      koppelde (/api/bedrijf/lid/koppel, vanuit de werkruimte, met beide
      sleutels in de hand) hoefde daarna alsnog een TWEEDE keer in te loggen om
      binnen te komen: het ene account kende die werkruimte niet.

      Dat was de laatste plek waar "een account voor alles" niet waar was. De
      koppeling die er al ligt (lid.rtgKey) is nu ook een sleutel aan de bos.
      Geen nieuw bewijs, geen nieuwe opslag: dezelfde koppeling, nu ook de
      andere kant op leesbaar.

      De werkruimtes blijven APART van elkaar -- elke rij draagt zijn eigen
      functie en zijn eigen organisatie, en een lid van werkruimte A ziet
      niets van B. Dat is de grens die server/bedrijf/index.js trekt en die
      hier niet vervaagt: dit levert een lijst sleutels, geen bundel.

   Afgesplitst uit eenaccount.js: die stond op 7 bytes van de 10 KB-lat, en
   deze twee horen inhoudelijk bij elkaar. */
'use strict';

const { idVanKey } = require('../../lib/lidsleutel');

const eigenaar = require('../../eigenaar');

module.exports = ({ db, accounts }) => {
  function eigenaarKantoor(key) {
    const id = idVanKey(key);
    if (id == null) return null;
    let user = null;
    try { user = accounts.getUserById(id); } catch (e) { return null; }
    if (!user || !eigenaar.isEigenaar(accounts, user)) return null;
    return { rol: 'kantoor', code: null, staffId: null, naam: 'RTG-Backoffice',
      zaakNaam: null, at: null, viaEigenaar: true };
  }

  /* Alle werkruimtes waar dit account aan gekoppeld is, met de functie en de
     organisatie erbij. Alleen ACTIEVE lidmaatschappen: staat een lid op
     'wacht' of is het geschorst, dan is er geen werkplek om te openen -- en
     omdat we hier lezen en niets bewaren, telt dat meteen. */
  function werkruimtes(key) {
    if (!key) return [];
    const W = (db.data && db.data.werkruimtes) || {};
    const uit = [];
    for (const code of Object.keys(W)) {
      const w = W[code];
      if (!w || !w.leden) continue;
      for (const id of Object.keys(w.leden)) {
        const l = w.leden[id];
        if (!l || l.rtgKey !== key || l.status !== 'actief') continue;
        uit.push({ rol: 'werkruimte', code: w.code, staffId: null,
          naam: l.functie || l.naam || 'Medewerker', zaakNaam: w.naam,
          sinds: l.gekoppeldAt || null, viaKoppeling: true });
      }
    }
    return uit;
  }

  /* Het lidmaatschap zelf, vers opgezocht op het moment van openen. Vers is
     hier het punt: wie zijn koppeling losmaakt of geschorst wordt, komt er
     niet meer in -- ook niet met een lijst die een seconde eerder is gelezen.

     EERLIJK OVER WAT HIER GETOETST IS. De `rtgKey === key` hieronder is een
     TWEEDE slot. accStart komt hier alleen langs nadat werkruimtes() hierboven
     al op dezelfde sleutel heeft gefilterd, dus via de API valt dit slot niet
     te bereiken -- haal je het weg, dan blijft test/eenaccount-werkruimte.test.js
     groen (nagetrokken met precies die mutatie). Haal je het slot HIERBOVEN
     weg, dan zakken er twee toetsen. Het staat er dus voor de volgende
     aanroeper, die misschien niet via die filter binnenkomt; niet omdat een
     toets het bewaakt. Wie hier een derde ingang bij bouwt, moet dat weten. */
  function werkruimteLid(key, code) {
    const W = (db.data && db.data.werkruimtes) || {};
    const w = W[String(code || '').toUpperCase()];
    if (!w || !w.leden) return null;
    for (const id of Object.keys(w.leden)) {
      const l = w.leden[id];
      if (l && l.rtgKey === key && l.status === 'actief') return { w, l };
    }
    return null;
  }

  return { eigenaarKantoor, werkruimtes, werkruimteLid };
};

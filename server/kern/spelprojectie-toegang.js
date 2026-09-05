/* Toegang tot een gedeeld spelscherm.

   De korte kamercode was vroeger tegelijk koppelbewijs en blijvende sessie.
   Daardoor stond een 32-bits geheim in URL's, logs en iedere poll. Nu zijn er
   twee strikt gescheiden credentials:

   - een eenmalige 128-bits koppeling, alleen zichtbaar bij uitgifte;
   - een aparte 128-bits schermsessie, alleen zichtbaar bij koppeling.

   Beide staan uitsluitend gehasht in de spellen-collectie. De koppeling leeft
   vijftien minuten en wordt atomair verbruikt; de schermsessie leeft maximaal
   twee uur en kan door iedere speler meteen worden ingetrokken. */
'use strict';

const KOPPEL_DOEL = 'livingos-spelprojectie-koppelen';
const SCHERM_DOEL = 'livingos-spelprojectie-kijken';
const KOPPEL_SCOPE = ['spelprojectie.koppelen'];
const SCHERM_SCOPE = ['spelprojectie.kijken'];
const KOPPEL_MS = 15 * 60000;
const SCHERM_MS = 2 * 3600000;
const HISTORIE_MAX = 20;

module.exports = ({ crypto, nu }) => {
  const koppel = require('./bearercode')({ crypto, namespace: 'spelprojectie-koppeling', nu });
  const scherm = require('./bearercode')({ crypto, namespace: 'spelprojectie-scherm', nu });

  const geschiedenis = (rij, veld) => Array.isArray(rij && rij[veld]) ? rij[veld] : [];
  const alle = (rijen, veld, historie) => {
    const uit = [];
    for (const rij of (Array.isArray(rijen) ? rijen : [])) {
      if (rij && rij[veld]) uit.push({ rij, toegang: rij[veld], actief: true });
      for (const oud of geschiedenis(rij, historie)) uit.push({ rij, toegang: oud, actief: false });
    }
    return uit;
  };
  const bestaat = (rijen, codeHash, veld, historie, bearer) => {
    let gevonden = false;
    for (const item of alle(rijen, veld, historie))
      if (bearer.zelfdeHash(item.toegang && item.toegang.code_hash, codeHash)) gevonden = true;
    return gevonden;
  };
  const uniek = (rijen, rij, bearer, veld, historie, opties) => {
    for (let poging = 0; poging < 8; poging++) {
      const gemaakt = bearer.maak(opties);
      if (!bestaat(rijen, gemaakt.toegang.code_hash, veld, historie, bearer)) return gemaakt;
    }
    return null;
  };

  function nieuweKoppeling(rijen, rij, issuer, rotatie) {
    const gemaakt = uniek(rijen, rij, koppel, 'koppeling', 'koppeling_historie', {
      prefix: 'GAME', issuer, doel: KOPPEL_DOEL, scope: KOPPEL_SCOPE,
      onderwerp: { soort: 'spelprojectie', id: rij.id, potje: rij.potje },
      geldigMs: KOPPEL_MS, maxGebruik: 1
    });
    if (gemaakt) gemaakt.toegang.rotatie = Math.max(1, Number(rotatie) || 1);
    return gemaakt;
  }

  function nieuweSessie(rijen, rij) {
    const gemaakt = uniek(rijen, rij, scherm, 'scherm', 'scherm_historie', {
      prefix: 'SCREEN', issuer: 'spelprojectie', doel: SCHERM_DOEL,
      scope: SCHERM_SCOPE, onderwerp: { soort: 'spelprojectie', id: rij.id, potje: rij.potje },
      geldigMs: SCHERM_MS, maxGebruik: 1
    });
    /* `gebruik` betekent hier activering, niet iedere read-only poll. De harde
       gebruiksgrens van deze sessie is haar expires_at; polling wordt door de
       HTTP-rem begrensd en veroorzaakt geen opslagwrite om de drie seconden. */
    if (gemaakt) scherm.gebruik(gemaakt.toegang);
    return gemaakt;
  }

  function zoek(rijen, code, veld, historie, bearer) {
    const codeHash = bearer.hash(String(code || '').slice(0, 100));
    let gevonden = null;
    for (const item of alle(rijen, veld, historie)) {
      const gelijk = bearer.zelfdeHash(item.toegang && item.toegang.code_hash, codeHash);
      if (gelijk && item.actief) gevonden = item.rij;
    }
    return gevonden;
  }
  const zoekKoppeling = (rijen, code) => zoek(rijen, code, 'koppeling', 'koppeling_historie', koppel);
  const zoekScherm = (rijen, code) => zoek(rijen, code, 'scherm', 'scherm_historie', scherm);

  const redenKoppeling = rij => !rij || rij.gesloten_at ? 'onbekend' :
    koppel.reden(rij.koppeling, { doel: KOPPEL_DOEL, scope: KOPPEL_SCOPE });
  const redenScherm = rij => !rij || rij.gesloten_at ? 'onbekend' :
    scherm.reden(rij.scherm, { doel: SCHERM_DOEL, scope: SCHERM_SCOPE, negeerGebruik: true });

  function bewaarOud(rij, veld, historie, bearer, actor, waarom) {
    if (!rij || !rij[veld]) return;
    bearer.intrekken(rij[veld], actor, waarom);
    if (!Array.isArray(rij[historie])) rij[historie] = [];
    rij[historie].push(rij[veld]);
    if (rij[historie].length > HISTORIE_MAX)
      rij[historie].splice(0, rij[historie].length - HISTORIE_MAX);
    rij[veld] = null;
  }
  function intrekActief(rij, actor, waarom) {
    bewaarOud(rij, 'koppeling', 'koppeling_historie', koppel, actor, waarom);
    bewaarOud(rij, 'scherm', 'scherm_historie', scherm, actor, waarom);
  }

  /* Oude codes worden niet nog eenmaal geaccepteerd. We bewaren alleen hun
     hash als ingetrokken migratiebewijs en wissen de kale objectsleutel. */
  function migreerLegacy(staat) {
    if (!staat || Array.isArray(staat.projectie) || !staat.projectie ||
        typeof staat.projectie !== 'object') return;
    if (!Array.isArray(staat.projecties)) staat.projecties = [];
    for (const [code, oud] of Object.entries(staat.projectie)) {
      const issued = Number.isFinite(Date.parse(oud && oud.at)) ? oud.at : nu();
      const codeHash = koppel.hash(code);
      const toegang = {
        code_hash: codeHash, issuer: String((oud && oud.door) || 'legacy'), doel: KOPPEL_DOEL,
        scope: [...KOPPEL_SCOPE], onderwerp: { soort: 'spelprojectie', potje: oud && oud.potje },
        issued_at: issued, expires_at: (oud && oud.tot) || issued, max_gebruik: 1, gebruik: 1,
        laatst_gebruikt_at: null, ingetrokken_at: nu(), ingetrokken_door: 'systeem',
        intrekreden: 'legacy projectiecode met te lage entropie', rotatie: 1
      };
      staat.projecties.push({ id: 'legacy-' + codeHash.slice(0, 16), potje: oud && oud.potje,
        door: oud && oud.door, aangemaakt_at: issued, gesloten_at: nu(), sluitreden: toegang.intrekreden,
        koppeling: null, koppeling_historie: [toegang], scherm: null, scherm_historie: [], uitgiftes: [] });
    }
    delete staat.projectie;
  }

  return { nieuweKoppeling, nieuweSessie, zoekKoppeling, zoekScherm,
    redenKoppeling, redenScherm, intrekActief, migreerLegacy,
    gebruikKoppeling: rij => koppel.gebruik(rij.koppeling),
    KOPPEL_MS, SCHERM_MS };
};

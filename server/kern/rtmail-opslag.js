/* ============================================================================
   HET OPSLAGCONTRACT VAN RTMAIL -- de enige deur van dit domein naar db.data.

   Zes bestanden van RTMail (rtmail, vak, draad, sla, dossier, bewaar) droegen
   elk hun eigen kopie van dezelfde vier regels: maak db.data.rtmail aan als hij
   er niet is, haal de beperkte post eruit (schoonLeiding), geef hem terug. Twee
   lezers buiten de kern (routes/mailpost.js, bedrijf/postbrug.js) deden de
   helft ervan nog een keer met de hand. Dat zijn acht doorgangen waar er een
   hoort te zijn, en de ratels `dbDeuren` en `dbDeurenSchrijvend` in NORM.json
   telden ze. Een vijfde kopie die het vangnet vergeet, lekt beperkte post in
   het gedeelde postvak -- de kop van ./rtmail-leiding.js zegt waarom dat niet
   mag. Op een plek kan dat niet meer gebeuren.

   Dezelfde discipline als kern/connect/opslag.js en kern/mobiliteit/opslag.js,
   en met opzet niet een gedeelde klasse ermee: wat gedeeld wordt is de vorm
   (een register, pakken tegen peilen), niet de code.

   PAKKEN EN PEILEN ZIJN TWEE DINGEN.
   - `postvak()` MAAKT de collectie aan en draait het vangnet: de vorm die de
     zes kernbestanden altijd al gebruikten, gedrag ongewijzigd.
   - `ruw()` maakt aan zonder vangnet. Alleen ./rtmail.js en ./rtmail-leiding.js
     gebruiken hem: de migratie zelf mag niet op zichzelf wachten.
   - `peil()` maakt NIETS aan. Draait het vangnet als er post IS, en geeft
     anders null. Dat is wat de twee lezers buiten de kern deden; een leesroute
     die de opslag laat groeien klopt niet met zijn eigen mutatiecontract.
   - `bewaarbak()` is de bewaarlaag van ./rtmail-bewaar.js (beleid per vak en
     de vernietigingsregels), met dezelfde vormcontrole als daar stond.
   - `teams()` leest db.data.rtmailTeams, de collectie van ./rtmail-team.js,
     alleen lezend en zonder hem aan te maken.

   WAT DIT BESTAND MET OPZET NIET DOET: geen schema's, geen rechten, geen
   bewaartermijn. Die wonen bij de eigenaar (rtmail-recht, rtmail-bewaar) en
   zijn hier niet verzonnen.
   ========================================================================== */
'use strict';
const { schoonLeiding } = require('./rtmail-leiding');

const REGISTER = {
  rtmail:       { soort: 'wortel', wat: 'het gedeelde postvak: { berichten, leiding }' },
  rtmailBewaar: { soort: 'wortel', wat: 'bewaarbeleid per vak en het vernietigingsspoor' },
  rtmailTeams:  { soort: 'vreemd', wat: 'teampostvakken; eigenaar is ./rtmail-team.js, hier alleen gelezen' }
};

module.exports = function maakRtmailOpslag({ db, save }) {
  if (!db) throw new Error('kern/rtmail-opslag: zonder db is er niets om te bewaren');

  /* Pakken. `ruw` maakt aan zonder vangnet en is alleen voor ./rtmail.js (zijn
     store() draait eerst leiding.migreer) en ./rtmail-leiding.js zelf; elke
     andere schrijver pakt `postvak`, dat het vangnet direct erachter draait. */
  const ruw = () => (Array.isArray(db.data.rtmail && db.data.rtmail.berichten) ? db.data.rtmail : (db.data.rtmail = { berichten: [] }));
  function postvak() { const r = ruw(); schoonLeiding(r, save); return r; }
  const heeft = () => !!db.data.rtmail;

  /* Peilen: niets aanmaken. null als er geen postvak is. */
  function peil() {
    const r = db.data && db.data.rtmail;
    schoonLeiding(r, save);
    return r || null;
  }

  function bewaarbak() {
    if (!db.data.rtmailBewaar || typeof db.data.rtmailBewaar !== 'object')
      db.data.rtmailBewaar = { vakken: {}, vernietigingen: [] };
    const b = db.data.rtmailBewaar;
    if (!b.vakken || typeof b.vakken !== 'object') b.vakken = {};
    if (!Array.isArray(b.vernietigingen)) b.vernietigingen = [];
    return b;
  }

  const teams = () => (db.data.rtmailTeams && db.data.rtmailTeams.teams) || [];

  return { ruw, heeft, postvak, peil, bewaarbak, teams, REGISTER };
};

module.exports.REGISTER = REGISTER;

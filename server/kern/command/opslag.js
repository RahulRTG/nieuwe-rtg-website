/* ============================================================================
   HET OPSLAGCONTRACT VAN COMMAND, DE MACHINERIE. Welke veertien collecties dit
   domein bezit, welke gedeeld zijn en wat er NIET in zit -- met de hele
   afweging erachter -- staat in ./opslag-register.js. Hier staat wat die lijst
   doet: bak(), teller(), gedeeld, vreemd en vak().

   OPGEKNIPT OMDAT HET MOEST: samen 10.057 byte, en keuringsregel 13 trekt de
   grens op 10.240 met een advies vanaf 9.400. De naad is dezelfde als bij
   kern/levensdossier: het besluit tegenover de uitvoering. Wie wil weten wie
   waarover gaat, hoeft de machinerie niet te lezen.
   ========================================================================== */
'use strict';

const { REGISTER, NIET_GEBOUWD, LEEG } = require('./opslag-register');

module.exports = function maakOpslag({ db }) {
  if (!db || !db.data) throw new Error('command/opslag: zonder db.data is er niets om te bewaren');

  function eis(naam, soorten) {
    const spec = REGISTER[naam];
    if (!spec) {
      throw new Error('command/opslag: "' + naam + '" staat niet in het register. ' +
        'Een collectie die nergens is opgeschreven, kan niemand verhuizen.');
    }
    if (soorten && !soorten.includes(spec.soort)) {
      throw new Error('command/opslag: "' + naam + '" is een ' + spec.soort +
        ' en hoort niet langs deze ingang.');
    }
    return spec;
  }
  const klopt = (soort, w) => soort === 'lijst' ? Array.isArray(w)
    : soort === 'getal' ? Number.isFinite(w)
    : (w && typeof w === 'object' && !Array.isArray(w));

  /* DE ENIGE PLEK WAAR EEN COMMAND-COLLECTIE ONTSTAAT. */
  function bak(naam) {
    const spec = eis(naam, ['lijst', 'kaart']);
    if (!klopt(spec.soort, db.data[naam])) db.data[naam] = LEEG[spec.soort]();
    return db.data[naam];
  }

  /* EEN GETAL IS GEEN COLLECTIE, en een bak() die er een teruggeeft zou het
     doen voorkomen alsof je hem kunt muteren. Dit is de enige teller die dit
     domein heeft; hij telt op en geeft de nieuwe stand terug. */
  function teller(naam, erbij) {
    const spec = eis(naam, ['getal']);
    if (!klopt(spec.soort, db.data[naam])) db.data[naam] = LEEG[spec.soort]();
    if (erbij) db.data[naam] = db.data[naam] + Number(erbij);
    return db.data[naam];
  }

  /* ----------------------------------------------------------------------------
     GEDEELD EN SCHRIJFBAAR. Command bedient deze collectie; server/functies.js
     bezit hem. Zie de kop voor waarom dat een eigen woord verdient.
     ------------------------------------------------------------------------- */
  const gedeeld = {
    /* MET EEN DUBBELE PUNT EN NIET ALS METHODE-KORTSCHRIFT, en dat is geen
       smaak. scripts/kruisscan.js (keuringsregel 9) zoekt met een tekstpatroon
       naar een naam die in een ZUSTERBESTAND op het hoogste niveau staat --
       hier `schakelkast` in ./gezondheid.js -- en slaat een sleutel met een
       dubbele punt over. Het kortschrift `schakelkast() {` glipt daar
       tussendoor en werd als kruis-slice-verwijzing gemeld terwijl het een
       SLEUTEL is en geen verwijzing. Die scanner is met opzet grof (zie zijn
       kop); hem het verschil leren vraagt een ontleder. Deze vorm kost niets
       en neemt de valse melding weg. */
    schakelkast: () => {
      const t = (db.data.techniek && typeof db.data.techniek === 'object')
        ? db.data.techniek : (db.data.techniek = {});
      const f = t.functies;
      return (f && typeof f === 'object' && !Array.isArray(f)) ? f : (t.functies = {});
    },
    /* Alleen lezen, maar wel dezelfde gedeelde collectie -- vandaar hier en
       niet bij `vreemd`, zodat er één plek is die techniek noemt. */
    techniek: () => (db.data.techniek && typeof db.data.techniek === 'object') ? db.data.techniek : {},
    /* HET UITROLVAK, schrijvend -- zelfde snit als schakelkast() hierboven.
       techniek() hieronder geeft bewust een wegwerp-{} terug zolang de
       collectie niet bestaat (alleen lezen); een schrijver die dat vak
       gebruikte raakte zijn wijziging geruisloos kwijt. De uitrolregie
       schrijft, dus krijgt hij een vak dat beide lagen echt aanmaakt. */
    uitrol: () => {
      const t = (db.data.techniek && typeof db.data.techniek === 'object')
        ? db.data.techniek : (db.data.techniek = {});
      if (!t.uitrol || typeof t.uitrol !== 'object' || Array.isArray(t.uitrol)) {
        t.uitrol = { trede: null, sinds: null, stand: 'stil', reden: null, basis: null, geschiedenis: [] };
      }
      if (!Array.isArray(t.uitrol.geschiedenis)) t.uitrol.geschiedenis = [];
      return t.uitrol;
    }
  };

  /* ----------------------------------------------------------------------------
     VAN EEN ANDER, EN ALLEEN LEZEND.
     ------------------------------------------------------------------------- */
  const vreemd = {
    /* ./bijstand-melden.js: bestaat deze werkruimte, en van wie is hij. */
    werkruimte: (code) => {
      const w = db.data.werkruimtes;
      if (!code || !w) return null;
      return Object.prototype.hasOwnProperty.call(w, code) ? w[code] : null;
    },
    /* ./lagen.js: welke voertalen staan aan. */
    talen: () => db.data.talen || { actief: [] }
  };

  /* Het STANDAARDVAK van de compartimentenlaag. Zie de kop: dit is met opzet
     breed, en het is de zwakste plek van dit contract. */
  const vak = () => db.data;

  return { bak, teller, gedeeld, vreemd, vak, REGISTER, NIET_GEBOUWD };
};

module.exports.REGISTER = REGISTER;
module.exports.NIET_GEBOUWD = NIET_GEBOUWD;

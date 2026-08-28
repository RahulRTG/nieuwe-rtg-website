/* DE ZANDBAK -- een proces proeven zonder ook maar één productierij aan te raken.

   HET VERSCHIL MET EEN DROOGLOOP. Een droogloop (runbooks.js) laat zien wat één
   recept zou doen aan de echte gegevens. Dat is precies genoeg voor "mag dit
   nu", en te weinig voor "klopt dit recept eigenlijk": je kunt er niet mee
   dóórwerken, want de tweede stap zou de eerste echt moeten hebben uitgevoerd.
   In een zandbak kan dat wel, omdat er niets echts in staat.

   DE GEGEVENS KOMEN UIT DE ZAAISET EN NOOIT UIT DE PRODUCTIE. Dat is geen
   afspraak maar de bouw: maak() roept server/seed aan en kopieert niets uit
   db.data. Zou een zandbak "de echte gegevens, maar dan een kopie" zijn, dan
   staan er persoonsgegevens in een omgeving waar mensen juist dingen mogen
   proberen -- en dan is de zandbak zelf het datalek.

   EN ER SCHRIJFT NIETS TERUG, ook door de bouw: de laag krijgt een DB-VENSTER
   op het vak van deze zandbak ({ data: vak.data }). Elke motor eronder leest en
   schrijft daarin. Er is geen aanroep die van binnen de zandbak bij een
   productiecollectie kan; niet omdat er gefilterd wordt maar omdat het object
   dat hij ziet die collecties niet heeft.

   WAT HIJ NIET IS: een tweede installatie. Alleen de motoren van Command
   draaien erop (zoeken, dossier, kwaliteit, recepten, journaal, beleid). De
   gewone app-routes praten met de echte database, dus je proeft hier processen
   en geen schermen. Dat staat ook in de uitslag, want een zandbak waarvan
   iemand denkt dat het de hele app is, geeft vals vertrouwen. */
'use strict';

const MAX_ZANDBAKKEN = 10;
const STANDAARD_DAGEN = 7;
const DAG = 86400000;

function maakZandbak({ db, opslag, save, crypto, zaai, register, catalogus }) {
  function alle() {
    return opslag.bak('zandbakken');
  }

  const schoon = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 40);
  const nu = () => new Date().toISOString();

  function maak(naam, opties) {
    const o = opties || {};
    const id = schoon(naam);
    if (!id) return { error: 'Een zandbak heeft een naam nodig.', status: 400 };
    const lijst = alle();
    if (lijst[id]) return { error: 'Er is al een zandbak met die naam.', status: 409 };
    if (Object.keys(lijst).length >= MAX_ZANDBAKKEN) {
      return { error: 'Er staan al ' + MAX_ZANDBAKKEN + ' zandbakken. Ruim er een op; ze zijn niet gratis ' +
        'in opslag en een rij oude zandbakken is een rij die niemand meer vertrouwt.', status: 409 };
    }
    const dagen = Math.max(1, Math.min(Number(o.dagen || STANDAARD_DAGEN), 90));
    /* Hier komt de inhoud vandaan, en nergens anders. */
    const data = zaai();
    lijst[id] = {
      naam: id, gemaakt: nu(), door: String(o.door || 'onbekend'),
      vervalt: new Date(Date.now() + dagen * DAG).toISOString(),
      waarvoor: String(o.waarvoor || '').slice(0, 200),
      data
    };
    save();
    return { zandbak: kaart(lijst[id]) };
  }

  function weg(naam, door) {
    const lijst = alle();
    const z = lijst[schoon(naam)];
    if (!z) return { error: 'Die zandbak bestaat niet.', status: 404 };
    delete lijst[schoon(naam)];
    save();
    return { weg: true, naam: schoon(naam), door: String(door || 'onbekend') };
  }

  /* Verlopen zandbakken opruimen. Een zandbak zonder eind blijft liggen tot
     iemand hem voor productie aanziet. */
  function veeg() {
    const lijst = alle();
    const t = Date.now();
    const weggehaald = [];
    for (const id of Object.keys(lijst)) {
      const v = Date.parse(lijst[id] && lijst[id].vervalt);
      if (!isNaN(v) && v < t) { delete lijst[id]; weggehaald.push(id); }
    }
    if (weggehaald.length) save();
    return { weggehaald };
  }

  function tel(z) {
    let objecten = 0;
    for (const so of register.SOORTEN) {
      const v = z.data ? z.data[so.collectie] : null;
      if (Array.isArray(v)) objecten += v.length;
    }
    return objecten;
  }

  function kaart(z) {
    const objecten = tel(z);
    return {
      naam: z.naam, gemaakt: z.gemaakt, door: z.door, vervalt: z.vervalt,
      waarvoor: z.waarvoor || null, objecten,
      /* Een lege zandbak is in productie de normale uitkomst: de zaaiset start
         daar bewust zonder demozaken (zie server/seed/index.js). Dat hoort er
         te staan, anders lijkt het een storing. */
      let: objecten ? null : 'deze zandbak is leeg. In productie start de zaaiset zonder demogegevens; ' +
        'gebruik de afzonderlijke Magnaat-testomgeving, of voer zelf rijen in via de recepten.'
    };
  }

  function lijst() {
    veeg();
    const l = alle();
    return {
      zandbakken: Object.keys(l).map(id => kaart(l[id])),
      max: MAX_ZANDBAKKEN, standaardDagen: STANDAARD_DAGEN,
      uitleg: 'de inhoud komt uit de zaaiset (server/seed) en nooit uit de productiegegevens; ' +
        'er is geen pad waarlangs een handeling in een zandbak bij een productiecollectie komt',
      let: 'alleen de motoren van Command draaien op een zandbak (zoeken, dossier, kwaliteit, ' +
        'recepten, journaal, beleid). De gewone app-routes praten met de echte database, dus je ' +
        'proeft hier processen en geen schermen.'
    };
  }

  /* DE LAAG. Het venster is het enige wat de motoren van de zandbak zien; het
     vak is waar hun eigen sporen in komen (journaal, beleid, recepten). Twee
     verschillende dingen, allebei binnen dezelfde zandbak. */
  function laag(naam) {
    const z = alle()[schoon(naam)];
    if (!z) return null;
    const venster = { data: z.data };
    const vak = () => { z.eigen = z.eigen || {}; return z.eigen; };

    const journaal = require('./journaal').maakJournaal({ db, save, crypto, vak, opslag });
    const beleid = require('./beleid').maakBeleid({ db, save, crypto, journaal, vak, opslag });
    const risico = require('./risico').maakRisico({ beleid });
    const runbooks = require('./runbooks').maakRunbooks({
      db: venster, save, crypto, journaal, risico, beleid, register, catalogus, vak, opslag });
    const kwaliteit = require('./kwaliteit').maakKwaliteit({ db: venster, register });
    const zoeklaag = require('./zoek');
    const objectlaag = require('./object');

    return {
      naam: z.naam, zandbak: true, journaal, beleid, risico, runbooks, kwaliteit,
      zoek: (v, o) => zoeklaag.zoek(register, venster, v, o),
      dossier: (t, i) => objectlaag.dossier(register, venster, t, i, { journaal }),
      kaart: () => kaart(z)
    };
  }

  return { maak, weg, veeg, lijst, laag, kaart, MAX_ZANDBAKKEN };
}

module.exports = { maakZandbak, MAX_ZANDBAKKEN, STANDAARD_DAGEN };

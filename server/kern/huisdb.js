/* Een huis-eigen kijk op de database.

   De bureaus van RTG (het Atelier, de Studio, het Hardwarelab, het
   Architectenbureau en de Ideeenkamer) bewaren elk in een vaste sleutel:
   db.data.atelier, db.data.studio, enzovoort. Ze zijn geschreven alsof er
   maar een huis is.

   De RTFoundation moet diezelfde bureaus krijgen, maar met eigen inhoud:
   een ontwerp van de stichting hoort niet tussen dat van RTG te staan. In
   plaats van vijf modules te verbouwen (of erger: te kopieren) geven we ze
   een andere bril op. huisDb() levert een db-object dat er voor de module
   precies zo uitziet als altijd, maar dat de genoemde sleutels stilletjes
   omlegt naar een huis-eigen sleutel: atelier wordt atelierRtf.

   Zo draait er een tweede exemplaar van hetzelfde bureau, op eigen data, en
   blijft de bureau-code zelf onaangeraakt. Alle andere sleutels lopen
   gewoon door naar dezelfde database, zodat een bureau nog steeds de echte
   cijfers van het platform kan lezen. */

function huisDb(db, omleiding) {
  const map = Object.assign({}, omleiding || {});
  return {
    // db.data wordt bij elke aanroep opnieuw doorgegeven: de onderliggende
    // database mag intussen herladen zijn (snapshot, Postgres-spiegel).
    get data() {
      const echt = db.data;
      return new Proxy(echt, {
        get(doel, sleutel) {
          const s = typeof sleutel === 'string' && map[sleutel] ? map[sleutel] : sleutel;
          return doel[s];
        },
        set(doel, sleutel, waarde) {
          const s = typeof sleutel === 'string' && map[sleutel] ? map[sleutel] : sleutel;
          doel[s] = waarde;
          return true;
        },
        has(doel, sleutel) {
          const s = typeof sleutel === 'string' && map[sleutel] ? map[sleutel] : sleutel;
          return s in doel;
        },
        deleteProperty(doel, sleutel) {
          const s = typeof sleutel === 'string' && map[sleutel] ? map[sleutel] : sleutel;
          delete doel[s];
          return true;
        }
      });
    }
  };
}

/* De omleiding voor de RTFoundation: elk bureau krijgt zijn eigen la. */
const RTF_OMLEIDING = {
  atelier: 'atelierRtf',
  studio: 'studioRtf',
  hardware: 'hardwareRtf',
  architect: 'architectRtf',
  redactie: 'redactieRtf',
  ideeen: 'ideeenRtf',
  // de plank waar een afgerond concept in de verkoop gaat. Voor RTG is dat de
  // echte RTG-winkel; de stichting krijgt haar eigen plank, zodat haar werk
  // niet ongemerkt in de winkel van RTG belandt.
  winkelProducten: 'winkelProductenRtf'
};

/* De bureaus geven zichzelf terug onder hun eigen naam ({ atelier: api }).
   Voor het tweede exemplaar zetten we daar het huis achter, zodat kern.atelier
   van RTG blijft en kern.atelierRtf van de stichting is. */
function huisNaam(deel, achtervoegsel) {
  const uit = {};
  for (const sleutel of Object.keys(deel)) uit[sleutel + achtervoegsel] = deel[sleutel];
  return uit;
}

module.exports = { huisDb, RTF_OMLEIDING, huisNaam };

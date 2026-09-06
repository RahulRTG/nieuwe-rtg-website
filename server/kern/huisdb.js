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

/* WAAROM DEZE PROXY ALLE ZEVEN VALLEN MOET AFVANGEN EN NIET VIER.

   De eerste versie ving get, set, has en deleteProperty af, en dat leek genoeg:
   de bureaus lezen en schrijven met db.data.atelier en dat werkt. Maar een
   Proxy die maar de helft van zijn vallen zet, geeft ANTWOORDEN DIE ELKAAR
   TEGENSPREKEN -- en de gevaarlijkste is niet dat iets kapotgaat maar dat het
   een ander huis toont. Gemeten op de oude vorm, met beide laden gevuld:

     proxy.redactie                       -> de RTF-la      (goed)
     hasOwnProperty.call(proxy,'redactie')-> true           (de RTG-la!)
     Object.keys(proxy)                   -> beide namen    (fout)
     JSON.stringify(proxy)                -> RTF-inhoud ONDER BEIDE NAMEN

   Die derde en vierde regel komen doordat ownKeys en getOwnPropertyDescriptor
   ONGEMOEID naar het doel gaan terwijl get is omgelegd. Wie db.data serialiseert
   of overneemt, krijgt dan de gegevens van het ene huis onder de naam van het
   andere -- en de eigen la van dat andere huis is onzichtbaar.

   Vandaag raakt geen enkele bureaumodule die vallen: alle zes lezen met
   db.data[naam], en de twee die eigencollectie gebruiken (redactie, aiwinkel)
   doen dat met bak(), dat langs get/set loopt. Het is dus een VALSTRIK en geen
   storing. Maar kijk() uit kern/eigencollectie.js opent met precies die
   hasOwnProperty, dus de eerste die hier een leespad omzet, krijgt een
   collectie die GOOIT of die stilletjes leeg leest. Dat is te duur om te laten
   liggen voor de volgende, dus staat de bril nu heel.

   De regel eronder: vanuit dit huis gezien BESTAAT de la van het andere huis
   niet. `redactieRtf` verschijnt als `redactie`, en de echte `redactie` (van
   RTG) is vanuit de RTF-bril nergens te zien -- ook niet onder zijn eigen naam. */
function huisDb(db, omleiding) {
  const map = Object.assign({}, omleiding || {});
  // de terugweg: redactieRtf -> redactie, zodat de eigen la onder de gewone naam verschijnt
  const terug = {};
  for (const [van, naar] of Object.entries(map)) terug[naar] = van;
  const echteNaam = sleutel => (typeof sleutel === 'string' && map[sleutel]) ? map[sleutel] : sleutel;
  return {
    // db.data wordt bij elke aanroep opnieuw doorgegeven: de onderliggende
    // database mag intussen herladen zijn (snapshot, Postgres-spiegel).
    get data() {
      const echt = db.data;
      return new Proxy(echt, {
        get(doel, sleutel) {
          return doel[echteNaam(sleutel)];
        },
        set(doel, sleutel, waarde) {
          doel[echteNaam(sleutel)] = waarde;
          return true;
        },
        has(doel, sleutel) {
          if (typeof sleutel === 'string' && terug[sleutel]) return false;
          return echteNaam(sleutel) in doel;
        },
        deleteProperty(doel, sleutel) {
          delete doel[echteNaam(sleutel)];
          return true;
        },
        /* hasOwnProperty, Object.keys, JSON.stringify en de spread lopen alle
           vier langs deze twee vallen. Zonder hen spreken ze `get` tegen. */
        getOwnPropertyDescriptor(doel, sleutel) {
          if (typeof sleutel === 'string' && terug[sleutel]) return undefined;   // de la van het andere huis
          const d = Object.getOwnPropertyDescriptor(doel, echteNaam(sleutel));
          // configurable is geen keuze maar een Proxy-invariant: een eigenschap
          // die het doel niet zo heeft, mag niet als vast worden gemeld.
          return d ? Object.assign({}, d, { configurable: true }) : undefined;
        },
        ownKeys(doel) {
          const uit = [];
          for (const k of Reflect.ownKeys(doel)) {
            if (typeof k === 'string' && terug[k]) { uit.push(terug[k]); continue; }   // eigen la, gewone naam
            if (typeof k === 'string' && map[k]) {
              /* De la van het andere huis. Verbergen mag alleen als het doel hem
                 laat verbergen; een vaste eigenschap weglaten is een TypeError. */
              const d = Object.getOwnPropertyDescriptor(doel, k);
              if (d && d.configurable === false) uit.push(k);
              continue;
            }
            uit.push(k);
          }
          return [...new Set(uit)];
        },
        defineProperty(doel, sleutel, beschrijving) {
          Object.defineProperty(doel, echteNaam(sleutel), beschrijving);
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

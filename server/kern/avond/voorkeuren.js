/* HOSPITALITY DNA: wat een zaak van jou mag weten, en niets meer.

   HET IDEE. Een goede gastheer onthoudt dat je liever aan een ronde tafel zit,
   dat je bruiswater zonder ijs drinkt en dat je schoonvader slecht hoort. Een
   systeem dat dat onthoudt is prettig; een systeem dat dat overal rondstrooit
   is eng. Het verschil zit niet in WAT er wordt onthouden maar in WIE het te
   zien krijgt, en dat is precies waar deze laag over gaat.

   DRIE DINGEN DIE HIER BEWUST ZO ZIJN.

   1. DELEN GAAT PER SOORT, NIET PER PROFIEL. Eén schakelaar "deel mijn
      voorkeuren" is een schijnkeuze: je tafelvoorkeur en je verjaardag zijn
      niet hetzelfde soort gegeven. Elke soort heeft zijn eigen stand, en de
      standaard is de voorzichtige.
   2. HET ZORGPROFIEL BLIJFT WAAR HET STAAT. Allergenen, dieet en medische
      aandachtspunten zitten al in kern/gastzorg.js met hun eigen
      toestemmingsregel, en die wordt hier GELEZEN en niet gekopieerd. Een
      tweede allergie-administratie is precies de fout die je bij allergieën
      niet wilt maken (LAT-regel 4).
   3. EEN ZAAK KAN MEER OF MINDER KRIJGEN DAN DE STANDAARD. Bij je vaste zaak
      wil je misschien alles delen en bij een onbekende niets. Die uitzondering
      staat per zaak, en hij kan alleen SMALLER maken wat al open stond -- een
      zaak kan zichzelf nooit meer rechten geven.

   WAT HIER NIET STAAT: een profiel dat RTG zelf invult op grond van gedrag. Wat
   je hier deelt, heb je zelf opgeschreven. Een systeem dat uit je bestellingen
   afleidt dat je van pittig houdt en dat vervolgens aan een zaak doorgeeft, is
   iets anders dan een gast die zijn voorkeur opschrijft -- en dat verschil is
   het hele vertrouwen. */
'use strict';

/* De soorten, met per soort waarom hij bestaat en wat de standaard is. De
   standaard is overal 'nooit' behalve toegankelijkheid: dat is de enige waar
   niet-delen de gast schaadt in plaats van beschermt (een zaak die niet weet
   dat er een rolstoel komt, zet je aan een tafel waar je niet bij kunt). */
const SOORTEN = {
  tafel: { label: 'Tafelvoorkeur', uitleg: 'Rond, terras, rustige hoek, bij het raam.', standaard: 'gevraagd' },
  drank: { label: 'Drankvoorkeur', uitleg: 'Bruiswater zonder ijs, rode wijn, geen alcohol.', standaard: 'gevraagd' },
  sfeer: { label: 'Sfeer', uitleg: 'Rustig, levendig, geschikt om te werken.', standaard: 'gevraagd' },
  toegankelijkheid: { label: 'Toegankelijkheid', uitleg: 'Rolstoel, slechthorend, geleidehond.', standaard: 'altijd' },
  gelegenheid: { label: 'Gelegenheden', uitleg: 'Verjaardag, jubileum. Alleen als je dat wilt.', standaard: 'nooit' }
};
const STANDEN = ['nooit', 'gevraagd', 'altijd'];

module.exports = ({ db, save, schoon, zorgVoor }) => {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/avond/voorkeuren', bezit: { gastVoorkeuren: 'kaart' } });
  const lijst = () => {
    return eigen.bak('gastVoorkeuren');
  };

  function leeg() {
    const v = { waarden: {}, delen: {}, perZaak: {} };
    for (const [id, s] of Object.entries(SOORTEN)) { v.waarden[id] = ''; v.delen[id] = s.standaard; }
    return v;
  }

  const van = (key) => Object.assign(leeg(), lijst()[key] || {});

  function zet(key, invoer) {
    const v = van(key);
    const b = invoer || {};
    for (const id of Object.keys(SOORTEN)) {
      if (b.waarden && b.waarden[id] !== undefined) v.waarden[id] = schoon(b.waarden[id], 160) || '';
      if (b.delen && STANDEN.includes(String(b.delen[id]))) v.delen[id] = String(b.delen[id]);
    }
    lijst()[key] = v;
    save();
    return v;
  }

  /* Een uitzondering voor één zaak. Hij kan alleen SMALLER maken: een zaak die
     'nooit' heeft staan kan niet via deze weg alsnog 'altijd' worden, want dan
     zou de uitzondering de regel opeten. Ruimer delen doe je door de soort zelf
     ruimer te zetten -- dat is een bewuste handeling en geen bijeffect. */
  function zetVoorZaak(key, zaakcode, standen) {
    const v = van(key);
    const code = schoon(zaakcode, 30);
    if (!code) return { status: 400, error: 'Voor welke zaak?' };
    const uit = {};
    const geweigerd = [];
    for (const [id, stand] of Object.entries(standen || {})) {
      if (!SOORTEN[id] || !STANDEN.includes(String(stand))) continue;
      const algemeen = v.delen[id];
      if (STANDEN.indexOf(String(stand)) <= STANDEN.indexOf(algemeen)) { uit[id] = String(stand); continue; }
      /* RUIMER VRAGEN SLAAT NIETS OP. Hier stond eerst dat het verzoek werd
         teruggeknepen tot de algemene stand en zo werd BEWAARD -- en dat is een
         val: wie voor deze zaak 'altijd' vroeg terwijl de soort op 'nooit'
         stond, kreeg een vastgelegde uitzondering 'nooit' die hij nooit heeft
         gekozen. Zet hij de soort later ruimer, dan bleef die zaak stil
         afgeschermd. Nu blijft er niets staan en zegt het antwoord waarom. */
      geweigerd.push({ soort: id, gevraagd: String(stand), algemeen,
        uitleg: 'Ruimer delen bij één zaak kan niet via een uitzondering. Zet "' +
          SOORTEN[id].label + '" zelf ruimer als je dat wilt; dat is een bewuste keuze en geen bijeffect.' });
    }
    if (Object.keys(uit).length) v.perZaak[code] = Object.assign({}, v.perZaak[code], uit);
    lijst()[key] = v;
    save();
    return { ok: true, zaak: code, standen: v.perZaak[code] || {}, geweigerd };
  }

  const standVoor = (v, id, zaakcode) => {
    const uitz = (v.perZaak || {})[zaakcode] || {};
    return uitz[id] || v.delen[id] || 'nooit';
  };

  /* WAT EEN ZAAK KRIJGT. `gevraagd` betekent: alleen als de gast dit keer zelf
     heeft gezegd dat het mag (`nu` bij de aanvraag). Zo hoeft niemand voor elke
     reservering zijn hele profiel open te zetten, en blijft "altijd" een
     bewuste keuze in plaats van de weg van de minste weerstand. */
  function voorZaak(key, zaakcode, { nu = [] } = {}) {
    const v = van(key);
    const uit = { voorkeuren: {}, zorg: null, bron: 'de gast heeft dit zelf opgeschreven' };
    for (const id of Object.keys(SOORTEN)) {
      const waarde = String(v.waarden[id] || '').trim();
      if (!waarde) continue;
      const stand = standVoor(v, id, zaakcode);
      if (stand === 'altijd' || (stand === 'gevraagd' && nu.includes(id))) uit.voorkeuren[id] = waarde;
    }
    /* Het zorgprofiel komt uit zijn EIGEN laag met zijn eigen toestemming. Hier
       staat alleen de doorgifte; de regel eromheen blijft van gastzorg.js. */
    const zorg = zorgVoor ? zorgVoor(key, zaakcode ? { zaak: zaakcode, reden: 'voorkeuren klaarzetten voor een verblijf' } : null) : null;
    if (zorg) uit.zorg = zorg;
    return uit;
  }

  /* Wat de gast zelf ziet: zijn eigen profiel, met per soort wat een zaak
     ervan zou krijgen. Zonder dat laatste is een toestemmingsscherm een lijst
     schakelaars waarvan niemand het gevolg kent. */
  function overzicht(key, zaakcode) {
    const v = van(key);
    return {
      soorten: Object.entries(SOORTEN).map(([id, s]) => ({
        id, label: s.label, uitleg: s.uitleg, standaard: s.standaard,
        waarde: v.waarden[id] || '', delen: v.delen[id],
        bijDezeZaak: zaakcode ? standVoor(v, id, zaakcode) : null,
        ziet: zaakcode ? (standVoor(v, id, zaakcode) === 'altijd' && !!v.waarden[id]) : null
      })),
      standen: STANDEN,
      zorgDeeltMee: !!(zorgVoor && zorgVoor(key)),   // geen zaak: dit is de eigen stand, geen inzage
      let: 'Wat hier staat schrijf je zelf op. RTG leidt geen voorkeuren af uit je bestellingen.'
    };
  }

  return { SOORTEN, STANDEN, van, zet, zetVoorZaak, voorZaak, overzicht };
};

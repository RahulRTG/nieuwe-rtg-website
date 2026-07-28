/* De WERKVORMEN: een zaak is niet één hokje. Een zzp'er die taxi rijdt is
   allebei -- hij hoort de vervoerstools EN de zzp-tools te krijgen, zonder
   dat iemand iets aanzet. Deze module leidt de werkvormen van een zaak af
   uit wat de zaak IS (haar type) en wat de zaak DOET (voertuigen, kamers,
   menu, diensten, producten, activiteiten), en telt de bijbehorende
   capaciteiten bij elkaar op.

   Waarom afgeleid en niet opgeslagen? Omdat het dan altijd klopt: zet een
   eenmanszaak vandaag een auto in de vloot, dan staan morgen de rittools
   er gewoon. Zet zij de laatste auto weg, dan verdwijnen ze weer. Geen
   migratie, geen schakelaar die iemand vergeet.

   capsVan(db, s) is de enige waarheid over "wat mag deze zaak gebruiken":
   de caps van het type PLUS de caps van elke afgeleide werkvorm PLUS wat
   het kantoor handmatig heeft bijgezet (settings.extraVormen). De functie
   hangt aan db (db.capsVan) zodat elke laag hem heeft zonder extra import;
   de leesplekken door het hele systeem gebruiken hem. */

const VORMEN = {
  vervoer: { label: 'Vervoer & ritten', caps: ['rides', 'fleet'], app: 'Vervoer + RTG OV',
    wanneer: (s, t) => t.includes('rides') || (s.fleet || []).length > 0 || (s.ovLijnen || []).length > 0 },
  zelfstandig: { label: 'Zelfstandig (zzp)', caps: ['services', 'agenda'], app: 'Zzp-tools + belastingtool',
    wanneer: (s, t, hulp) => t.includes('services') || s.zzp === true || (s.settings && s.settings.zzp === true) || hulp.eenmanszaak },
  horeca: { label: 'Eten & drinken', caps: ['menu', 'orders', 'reservations'], app: 'Keuken, bar en bediening',
    wanneer: (s, t) => t.includes('menu') || (s.menu || []).length > 0 },
  verblijf: { label: 'Overnachten', caps: ['bookings', 'doors'], app: 'Kamers, receptie en keyless',
    wanneer: (s, t, hulp) => t.includes('bookings') || (s.rooms || []).length > 0 || hulp.thuisHuizen > 0 },
  bezorgen: { label: 'Bezorgen & afhalen', caps: ['bezorgen'], app: 'Bezorgketen en bezorgers-PDA',
    wanneer: (s) => !!(s.bezorg && (s.bezorg.aan || (s.bezorg.producten || []).length)) },
  tickets: { label: 'Tickets & entree', caps: ['tickets'], app: 'Programma, scan en deurverkoop',
    wanneer: (s, t) => t.includes('tickets') || (s.activiteiten || []).length > 0 },
  winkel: { label: 'Winkel & voorraad', caps: ['retail'], app: 'Winkelvloer en collecties',
    wanneer: (s, t) => t.includes('retail') || (s.collecties || []).length > 0 },
  kassa: { label: 'Kassa', caps: ['kassa'], app: 'De Kassa (elke sector)',
    wanneer: () => true },
  werkgever: { label: 'Werkgever', caps: ['personeel', 'payroll'], app: 'Rooster, klok en loonrun',
    wanneer: (s) => (s.staff || []).length > 1 }
};

/* De hulpsignalen die niet uit het type of een lijstje op de zaak komen. */
function hulpSignalen(db, s) {
  const staf = (s.staff || []).length;
  let thuisHuizen = 0;
  try {
    const vlag = 'zaak:' + s.code;
    thuisHuizen = Object.values((db.data && db.data.thuisHuizen) || {}).filter(h => h.host === vlag).length;
  } catch (e) { thuisHuizen = 0; }
  return { eenmanszaak: staf <= 1, thuisHuizen };
}

const typeCaps = (db, s) => (((db.data || {}).supplierTypes || {})[s && s.type] || {}).caps || [];

/* De werkvormen van een zaak, met per vorm waarom hij meetelt. */
function vormenVan(db, s) {
  if (!s) return [];
  const t = typeCaps(db, s);
  const hulp = hulpSignalen(db, s);
  const extra = (s.settings && Array.isArray(s.settings.extraVormen)) ? s.settings.extraVormen : [];
  return Object.entries(VORMEN)
    .filter(([id, v]) => extra.includes(id) || v.wanneer(s, t, hulp))
    .map(([id, v]) => ({ id, label: v.label, app: v.app, caps: v.caps, handmatig: extra.includes(id) }));
}

/* Alles wat deze zaak mag gebruiken: type + werkvormen, zonder dubbelen. */
function capsVan(db, s) {
  if (!s) return [];
  const uit = new Set(typeCaps(db, s));
  for (const v of vormenVan(db, s)) for (const c of v.caps) uit.add(c);
  // location en pricing horen bij elke zaak; ze zeggen alleen "sta op de kaart"
  uit.add('location'); uit.add('pricing');
  return [...uit];
}

const heeft = (db, s, cap) => capsVan(db, s).includes(cap);

/* Aanhaken op db, zodat elke laag db.capsVan(s) heeft zonder eigen import.
   Wordt aangeroepen door server/db/index.js bij het maken van de db. */
function haakAan(db) {
  if (typeof db.capsVan === 'function') return db;
  db.capsVan = (s) => capsVan(db, s);
  db.vormenVan = (s) => vormenVan(db, s);
  return db;
}

/* De kern-fabriek voor de routes: het overzicht dat een zaak van zichzelf
   ziet -- welke werkvormen we herkennen, en welke apps daarbij horen. */
module.exports = ({ db }) => ({
  werkvormen: {
    VORMEN,
    vormen: (s) => vormenVan(db, s),
    caps: (s) => capsVan(db, s),
    heeft: (s, cap) => heeft(db, s, cap),
    overzicht(s) {
      const vormen = vormenVan(db, s);
      return { ok: true, zaak: s ? s.name : null, type: s ? s.type : null,
        vormen, caps: capsVan(db, s),
        uitleg: 'Uw werkvormen worden automatisch herkend aan wat u bent en wat u doet. Rijdt u ritten en werkt u als zelfstandige, dan krijgt u allebei de gereedschapskisten -- zonder iets aan te zetten.' };
    }
  }
});

module.exports.VORMEN = VORMEN;
module.exports.vormenVan = vormenVan;
module.exports.capsVan = capsVan;
module.exports.heeft = heeft;
module.exports.haakAan = haakAan;

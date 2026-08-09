/* HET OBJECTREGISTER VAN EEN ZAAK -- en het is met opzet een ANDER register dan
   dat van RTG (kern/command/register.js).

   DE HELE VEILIGHEID VAN DEZE LAAG ZIT IN DIT BESTAND. De zoekbalk, het
   objectdossier, de afhankelijkhedenscan en de runbooks van de zaak-kant
   krijgen dit register mee en importeren er geen. Elke soort hier draagt zijn
   eigen `lees(db)`, en die leest NOOIT een hele collectie: hij leest de rijen
   van deze ene zaak. Er bestaat daardoor geen pad waarlangs een ongefilterde
   rij naar buiten komt -- niet doordat de aanroeper netjes filtert, maar
   doordat de bron het niet kan leveren.

   Dat is een bewuste keuze tegen de andere vorm, die veel makkelijker was
   geweest: het RTG-register hergebruiken en er een filter overheen leggen. Dan
   is er één vergeten filter genoeg. De afhankelijkhedenscan is daar het beste
   voorbeeld van: die loopt ALLE soorten van het register langs op zoek naar
   rijen die de sleutel noemen. Met het RTG-register zou een zaak die op zijn
   eigen code zoekt de bestellingen van de buurman terugkrijgen. Met dit
   register kan dat niet, want de buurman staat er niet in.

   DRIE KOPPELVORMEN, want zo ligt de data er nu eenmaal:
     a. een `supplierCode`-veld op de rij      (orders, rides, boekingen, ...)
     b. een collectie met de zaakcode als sleutel (tickets[code], verlof[code], ...)
     c. een genest lijstje op het zaak-object zelf (rooms, tables)

   WAT ER BEWUST NIET IN STAAT. Geen enkele RTG-collectie: geen leden, geen
   andere zaken, geen platformcijfers, geen kluis. Een zaak bestuurt zijn eigen
   zaak en verder niets. En geen supplierTeam: dat draagt pincodes, en een
   objectdossier is de verkeerde plek om personeelsgegevens te ontsluiten -- de
   HR-tab van de app doet dat al, met zijn eigen managerpoort. */
'use strict';

const { maakRegister, s, eerste } = require('../command/register');

/* De helpers voor de drie koppelvormen. Ze staan hier los omdat elke soort er
   precies een van gebruikt, en omdat je aan de naam moet kunnen zien hoe een
   soort aan de zaak vastzit. */
/* De code wordt aan BEIDE kanten genormaliseerd. findSupplier doet
   `String(code).trim().toUpperCase()` (server.js:1118); een kale === hier zou
   een rij met een kleine letter in supplierCode stil niet vinden -- en "stil
   niet gevonden" is bij een scoping-filter de gevaarlijke kant op: je ziet dan
   te weinig en denkt dat er niets is. */
const norm = (v) => s(v).trim().toUpperCase();
const veldVan = (collectie, code) => (db) => {
  const v = db && db.data ? db.data[collectie] : null;
  return Array.isArray(v) ? v.filter(r => r && norm(r.supplierCode) === code) : [];
};
const sleutelVan = (collectie, code) => (db) => {
  const v = db && db.data ? db.data[collectie] : null;
  if (!v || typeof v !== 'object') return [];
  /* De sleutel van deze collectie kan in een andere schrijfwijze zijn gezet dan
     de code die wij dragen; zoek hem daarom genormaliseerd op. */
  const sleutel = Object.keys(v).find(k => norm(k) === code);
  const rij = sleutel ? v[sleutel] : null;
  return Array.isArray(rij) ? rij : [];
};
const genestVan = (veld, zaakVan) => () => {
  const z = zaakVan();
  const v = z ? z[veld] : null;
  return Array.isArray(v) ? v : [];
};

/* De soorten. Elke regel: waar hij woont, hoe hij aan de zaak hangt, waarop de
   zoekbalk mag zoeken, en hoe hij heet in een lijst. `domein` groepeert hem in
   de puls van de zaak. */
function soortenVoor(code, zaakVan) {
  return [
    { type: 'bestelling', label: 'Bestelling', meervoud: 'bestellingen', domein: 'vloer',
      collectie: 'orders', sleutel: 'ref', lees: veldVan('orders', code),
      zoek: ['ref', 'status', 'table', 'customerCodename'],
      titel: r => 'Bestelling ' + eerste(r, 'ref', 'id'),
      sub: r => [s(r.status), r.table ? 'tafel ' + s(r.table) : '', s(r.customerCodename)].filter(Boolean).join(' · '),
      bedrag: r => Number(r.total || 0) },

    { type: 'rit', label: 'Rit', meervoud: 'ritten', domein: 'vervoer',
      collectie: 'rides', sleutel: 'ref', lees: veldVan('rides', code),
      zoek: ['ref', 'status', 'from', 'to', 'driver'],
      titel: r => 'Rit ' + eerste(r, 'ref', 'id'),
      sub: r => [s(r.status), [s(r.from), s(r.to)].filter(Boolean).join(' → '), r.driver ? 'chauffeur ' + s(r.driver) : 'geen chauffeur'].filter(Boolean).join(' · '),
      bedrag: r => Number(r.quote || 0) },

    { type: 'boeking', label: 'Boeking', meervoud: 'boekingen', domein: 'boeken',
      collectie: 'boekingen', sleutel: 'ref', lees: veldVan('boekingen', code),
      zoek: ['ref', 'status', 'kind', 'customerCodename'],
      titel: r => 'Boeking ' + eerste(r, 'ref', 'id'),
      sub: r => [s(r.status), eerste(r, 'kind'), s(r.customerCodename)].filter(Boolean).join(' · '),
      bedrag: r => Number(r.price || 0) },

    { type: 'reservering', label: 'Reservering', meervoud: 'reserveringen', domein: 'boeken',
      collectie: 'reserveringen', sleutel: 'id', lees: veldVan('reserveringen', code),
      zoek: ['id', 'status', 'naam', 'tijd'],
      titel: r => 'Reservering ' + eerste(r, 'id'),
      sub: r => [s(r.status), s(r.tijd), r.personen ? s(r.personen) + ' pers.' : ''].filter(Boolean).join(' · ') },

    { type: 'klus', label: 'Klus', meervoud: 'klussen', domein: 'onderhoud',
      collectie: 'tickets', sleutel: 'id', lees: sleutelVan('tickets', code),
      zoek: ['id', 'status', 'titel', 'waar', 'soort'],
      titel: r => eerste(r, 'titel', 'id'),
      sub: r => [s(r.status), s(r.waar), s(r.soort)].filter(Boolean).join(' · ') },

    { as: 'leiding', type: 'verlof', label: 'Verlofaanvraag', meervoud: 'verlofaanvragen', domein: 'team',
      collectie: 'verlof', sleutel: 'id', lees: sleutelVan('verlof', code),
      zoek: ['id', 'status', 'naam', 'van', 'tot'],
      titel: r => 'Verlof ' + eerste(r, 'naam', 'id'),
      sub: r => [s(r.status), [s(r.van), s(r.tot)].filter(Boolean).join(' t/m ')].filter(Boolean).join(' · ') },

    { as: 'leiding', type: 'sollicitatie', label: 'Sollicitatie', meervoud: 'sollicitaties', domein: 'team',
      collectie: 'applications', sleutel: 'id', lees: sleutelVan('applications', code),
      zoek: ['id', 'status', 'name', 'func'],
      titel: r => eerste(r, 'name', 'id'),
      sub: r => [s(r.func), s(r.status)].filter(Boolean).join(' · ') },

    { as: 'leiding', type: 'vacature', label: 'Vacature', meervoud: 'vacatures', domein: 'team',
      collectie: 'vacatures', sleutel: 'id', lees: sleutelVan('vacatures', code),
      zoek: ['id', 'titel', 'func', 'status'],
      titel: r => eerste(r, 'titel', 'func', 'id'),
      sub: r => [s(r.status), s(r.func)].filter(Boolean).join(' · ') },

    { type: 'kamer', label: 'Kamer', meervoud: 'kamers', domein: 'verblijf',
      collectie: null, sleutel: 'id', lees: genestVan('rooms', zaakVan),
      zoek: ['id', 'name', 'desc'],
      titel: r => eerste(r, 'name', 'id'),
      sub: r => [r.available === false ? 'bezet' : 'vrij', r.hk && r.hk.status ? 'schoonmaak: ' + s(r.hk.status) : ''].filter(Boolean).join(' · ') },

    { type: 'tafel', label: 'Tafel', meervoud: 'tafels', domein: 'vloer',
      collectie: null, sleutel: 'id', lees: genestVan('tables', zaakVan),
      zoek: ['id', 'naam', 'zone', 'status'],
      titel: r => 'Tafel ' + eerste(r, 'naam', 'id'),
      sub: r => [s(r.status), s(r.zone), r.seats ? s(r.seats) + ' pl.' : ''].filter(Boolean).join(' · ') }
  ];
}

/* Het register voor EEN zaak. `zaakVan` is een functie en geen object: het
   zaak-object wordt elders gemuteerd (kamers erbij, tafels verzet), en een
   bevroren kopie zou stilletjes verouderen. */
/* HET REGISTER KENT TWEE ASSEN, en de tweede is er bijgekomen doordat de eerste
   versie een lek had. Alles was gescoped op de ZAAK en niets op de ROL: een
   medewerker met een gewone zaak-sessie kon via de zoekbalk en het
   objectdossier de verlofaanvragen en sollicitaties van zijn collega's lezen --
   gegevens die overal elders in deze app achter managerOnly staan
   (routes/supplier/hrplus.js:47).

   De reparatie is WEGLATEN en niet filteren. Een soort met `as: 'leiding'`
   staat niet in het register van een medewerker; hij is er niet, dus geen enkele
   lezer -- de zoekbalk, het dossier, en vooral de afhankelijkhedenscan die ALLE
   soorten langsloopt -- kan hem nog vinden. Een filter had op één van die drie
   plekken vergeten kunnen worden.

   `leiding` staat standaard op FALSE. Wie de vlag vergeet, ziet te weinig; dat
   is de goede kant om fout te gaan. */
function maakZaakRegister(code, zaakVan, opties) {
  const c = norm(code);
  if (!c) throw new Error('een zaakregister zonder zaakcode bestaat niet');
  const leiding = !!(opties && opties.leiding);
  const soorten = soortenVoor(c, zaakVan || (() => null))
    .filter(so => leiding || so.as !== 'leiding');
  return maakRegister(soorten);
}

module.exports = { maakZaakRegister, soortenVoor };

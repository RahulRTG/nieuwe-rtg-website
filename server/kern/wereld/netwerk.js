/* RTG Wereld -- ZOEKEN EN HET NETWERK. Twee van de vermogens die in rechten.js
   wel een naam hadden en nog niets deden: `zoeken.geavanceerd` en
   `netwerk.analyse`.

   DE ENE BEREKENING VAN "WIE KEN IK". `connectiesVan` en `gedeeldeConnecties`
   stonden in routes/zakelijk.js, voor de gedeelde-connecties in de gids. Ze hier
   nog een keer schrijven zou dezelfde som op twee plekken zetten -- precies wat
   er met de PRO-lijst gebeurde (LAT-regel 4). Ze staan daarom HIER, en
   routes/zakelijk.js haalt ze hiervandaan. Eén implementatie, twee gebruikers.

   HET ONTWERPBESLUIT DAT ZOEKEN DRAAGT, en dit is het hele punt van deze
   module: ZOEKEN VINDT ALLEEN WAT JE MAG ZIEN. Wie zijn sector afschermt, is
   niet op sector te vinden -- ook niet als de zoeker precies de goede term
   intikt. Een zoekmachine die matcht op velden die hij vervolgens niet toont, is
   een lek met een nette voorkant: je leest de waarde niet, maar je leidt hem af
   uit het feit dat iemand in de uitslag staat. De filters lopen daarom stuk voor
   stuk langs dezelfde `magZien` als het profiel zelf (kern/wereld/profiel.js).

   Dat is meteen de reden dat zoeken hier woont en niet in het zakelijk-domein:
   de zichtbaarheid per veld is van de wereldlaag. */
'use strict';

module.exports = ({ db, codenaamVan, profiel }) => {
  // dezelfde regel als kern/sociaal.js: een verbinding telt pas als hij
  // geaccepteerd is en er geen voogd meer op wacht
  const actief = (c) => !!(c && c.status === 'accepted' && (!c.voogdWacht || c.voogdWacht.length === 0));

  function connectiesVan(key) {
    return (db.data.connections || [])
      .filter(c => (c.a === key || c.b === key) && actief(c))
      .map(c => (c.a === key ? c.b : c.a));
  }
  function gedeeldeConnecties(mij, ander) {
    if (!mij || !ander || mij === ander) return [];
    const set = new Set(connectiesVan(mij));
    return connectiesVan(ander).filter(k => set.has(k));
  }

  /* NETWERKANALYSE: "je kent drie mensen die je kunnen introduceren."

     Bewust op CODENAAM en bewust BEGRENSD tot een handjevol. Een volledige
     lijst van iedereen die jullie allebei kennen is een sociale kaart van een
     ander, en dat is meer dan nodig is om een introductie te vragen. */
  function introducties(mij, doel, hoeveel = 5) {
    const gedeeld = gedeeldeConnecties(mij, doel);
    return {
      aantal: gedeeld.length,
      via: gedeeld.slice(0, hoeveel).map(k => codenaamVan(k)).filter(Boolean)
    };
  }

  /* ---------------------------------------------------------- zoeken ----

     De kandidaten zijn de leden die IETS in hun wereldprofiel hebben staan --
     de sleutels uit de bronnen die dat profiel leest. Bewust niet de hele
     ledengids: wie nooit iets heeft ingevuld hoort niet als lege kaart in een
     zoekuitslag te staan, en de gids is bovendien async (Postgres) terwijl dit
     een synchrone leesronde is. */
  function kandidaten() {
    const uit = new Set();
    for (const k of Object.keys(((db.data.zakelijk || {}).profielen) || {})) uit.add(k);
    for (const k of Object.keys(((db.data.salon || {}).bio) || {})) uit.add(k);
    return [...uit];
  }

  const tekstVan = (w) => {
    if (w === null || w === undefined) return '';
    if (Array.isArray(w)) return w.map(x => (x && typeof x === 'object')
      ? [x.naam, x.handle, x.platform].filter(Boolean).join(' ') : String(x)).join(' ');
    if (typeof w === 'object') return Object.values(w).join(' ');
    return String(w);
  };

  /* Wat de zoeker van dit lid MAG zien, als kaart van pad -> waarde. Dit is de
     enige plek waar zoeken bij de gegevens komt, en hij komt er langs dezelfde
     poort als het profiel. Zo kan een filter niet matchen op iets wat de
     uitslag daarna niet toont. */
  function zichtbareVelden(zoeker, doel, doelTier) {
    const uit = {};
    for (const laag of profiel.profielVoor(zoeker, doel, doelTier)) {
      for (const v of laag.velden) uit[v.pad] = v.waarde;
    }
    return uit;
  }

  /* De filters. Elk filter noemt het VELD waar hij op kijkt, zodat de
     zichtbaarheid vanzelf meeloopt: staat het veld niet in `zichtbaar`, dan kan
     dit filter dit lid niet raken. Geen enkel filter leest rechtstreeks uit de
     opslag -- dat is de hele afspraak. */
  const FILTERS = [
    { naam: 'sector', pad: 'professioneel.sector' },
    { naam: 'plaats', pad: 'persoonlijk.plaats' },
    { naam: 'kop', pad: 'professioneel.kop' },
    { naam: 'vaardigheid', pad: 'professioneel.vaardigheden' }
  ];

  function zoek(zoeker, invoer, tierVan) {
    /* Zoeken kan niet zonder de profiellaag, want de zichtbaarheid IS de
       zoekregel. routes/zakelijk.js bouwt deze module met `profiel: null` (hij
       gebruikt alleen de graaf-functies); roept iemand daar tóch zoek() aan,
       dan hoort dat luid te breken en niet stil alles terug te geven. */
    if (!profiel) throw new Error('netwerk.zoek heeft de profiellaag nodig: zonder zichtbaarheid is zoeken een lek.');
    const v = invoer || {};
    const q = String(v.q || '').trim().toLowerCase();
    const openVoorWerk = v.openVoorWerk === true;
    const hoeveel = Math.min(50, Math.max(1, Number(v.hoeveel) || 20));

    const uit = [];
    for (const doel of kandidaten()) {
      if (doel === zoeker) continue;
      const doelTier = tierVan(doel);
      const zichtbaar = zichtbareVelden(zoeker, doel, doelTier);
      if (!Object.keys(zichtbaar).length) continue;   // niets te zien, niets te vinden

      // de benoemde filters, elk op zijn eigen veld
      let raak = true;
      for (const f of FILTERS) {
        const gevraagd = String(v[f.naam] || '').trim().toLowerCase();
        if (!gevraagd) continue;
        if (!(f.pad in zichtbaar)) { raak = false; break; }
        if (!tekstVan(zichtbaar[f.pad]).toLowerCase().includes(gevraagd)) { raak = false; break; }
      }
      if (!raak) continue;

      if (openVoorWerk && !('professioneel.openVoorWerk' in zichtbaar)) continue;

      // de vrije term loopt over ALLES wat deze zoeker van dit lid mag zien
      if (q) {
        const alles = Object.values(zichtbaar).map(tekstVan).join(' ').toLowerCase();
        if (!alles.includes(q)) continue;
      }

      const intro = introducties(zoeker, doel);
      uit.push({
        codenaam: codenaamVan(doel), pas: doelTier,
        velden: Object.keys(zichtbaar).map(pad => ({ pad, waarde: zichtbaar[pad] })),
        gedeeld: intro.aantal, via: intro.via
      });
    }

    /* Wie je via je netwerk al "kent" komt bovenaan, daarna op codenaam. Dat is
       een RANGSCHIKKING en geen algoritme dat je vasthoudt: hij is te verklaren
       in één zin en verandert niet met hoe lang je kijkt. */
    uit.sort((a, b) => (b.gedeeld - a.gedeeld) || String(a.codenaam).localeCompare(String(b.codenaam)));
    return { totaal: uit.length, treffers: uit.slice(0, hoeveel) };
  }

  return { connectiesVan, gedeeldeConnecties, introducties, zoek };
};

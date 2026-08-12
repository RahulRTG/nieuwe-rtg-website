/* Kern-module "objectlaag": niet apps maar OBJECTEN (LIFE.md par. 2, fase 2).

   DE OMKERING. Vandaag opent een lid een app en zoekt daarin de persoon. Deze
   laag draait dat om: hij opent een PERSOON, een GROEP of een EVENT, en het
   platform zegt wat daar bij hoort. Welke apps daarachter zitten is dan een
   detail van de uitvoering in plaats van de indeling van het scherm.

   DRIE TYPES IN FASE 2, en de rest van LIFE.md par. 2 (Reis, Match, Moment)
   later. Ze delen een catalogus (./caps.js) en verder niets: wat een cap AANZET
   verschilt per type en hoort bij dat type te wonen.

   DE TWEE REGELS UIT LIFE.md PAR. 2, hier in code:

   1. EEN OBJECT BEZIT NIETS. Er is geen opslag, geen collectie en geen
      schrijffunctie. Een groep woont in kern/genootschap, een gesprek in
      kern/comm, een match in kern/vonk; deze laag leest ze en zet er caps
      omheen. Zou een object gaan bewaren, dan bestaat een bijeenkomst op twee
      plekken en lopen ze uiteen (LAT.md regel 4).

   2. EEN OBJECTTYPE ERBIJ IS GEEN APP ERBIJ. Een type toevoegen is een module
      hiernaast plus een regel in SOORTEN. Brengt een type zijn eigen opslag en
      eigen workflow mee, dan is het geen object maar een domein, en dan hoort
      het ONDER deze laag te hangen in plaats van erin.

   HET WERKWOORD (LIFE.md par. 3): deze laag wijst aan, hij handelt niet. Elke
   cap is een weg naar de app die het echte werk doet. Er is geen enkele route
   hier die een bericht stuurt, iemand uitnodigt of iets betaalt -- dat is fase 5
   en dan nog uitsluitend als klaarzetten met een bevestiging door de mens.

   Gemount vanuit opzet/kernlaag3b.js, na de sociale domeinen. */
'use strict';

const { CAPS } = require('./caps');

module.exports = ({ kern }) => {
  const types = {
    persoon: require('./persoon')({ kern }),
    groep: require('./groep')({ kern }),
    event: require('./event')({ kern })
  };
  const SOORTEN = Object.keys(types);

  /* Een object opvragen. Geeft `null` als het niet bestaat OF als dit lid er
     niet bij hoort, en die twee zijn met opzet niet uit elkaar te houden: het
     verschil tussen "bestaat niet" en "mag niet" verraadt al dat een groep
     bestaat en hoe hij heet.

     De persoon is de uitzondering op "vinden": een codenaam die niets deelt met
     dit lid bestaat wel maar levert nul caps. Dat is geen fout en geen 404 --
     het is een mens waar u (nog) niets mee heeft, en dat is een geldig antwoord. */
  function object(key, soort, id) {
    const t = types[soort];
    if (!t) return null;
    const naam = String(id == null ? '' : id).slice(0, 80);
    if (!naam) return null;

    const r = t.caps(key, naam);
    if (!r) return null;

    /* Een cap die niet in de catalogus staat is er al uit gefilterd door
       capVoor(); deze regel is het vangnet dat het HARDOP maakt in plaats van
       stil. Een typemodule die een verzonnen cap-id noemt, hoort te knallen bij
       de eerste aanroep en niet een naamloos blokje op het scherm te geven. */
    for (const c of r.caps) {
      if (!CAPS[c.id]) throw new Error('objectlaag: onbekende cap "' + c.id + '" bij soort ' + soort);
    }

    const uit = { ok: true, soort, id: naam, titel: r.titel, over: r.over || {},
      caps: r.caps, stil: r.stil || [] };
    /* De relatieruimte hangt alleen aan een persoon (LIFE.md fase 3). Een groep
       en een event ZIJN al een gedeelde ruimte; daar zou "wat hebben wij samen"
       de vraag naar zichzelf zijn. */
    if (r.samen) { uit.samen = r.samen; uit.telling = r.telling; }
    /* De wereld om een event heen (fase 6). Alleen bij een event: een persoon en
       een groep zijn geen moment met een plek en een tijd. */
    if (r.eromheen) uit.eromheen = r.eromheen;
    return uit;
  }

  return { objectlaag: { object, SOORTEN, CAPS } };
};

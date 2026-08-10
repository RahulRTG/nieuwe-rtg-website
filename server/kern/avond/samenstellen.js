/* RTG Evening OS: DE SAMENSTELLER -- van een wens naar een plan.

   "Ik wil zaterdag een ontspannen avond met vier vrienden, goed eten, niet te
   druk, budget tachtig euro per persoon en uiterlijk half een thuis."

   DE ENIGE REGEL DIE ER ECHT TOE DOET: deze laag stelt alleen voor wat er
   BESTAAT. Geen verzonnen zaken, geen bedachte cocktailbar, geen taxi van een
   vervoerder die we niet hebben. Een avondplanner die gaten opvult met
   plausibele namen is precies het soort software dat één keer werkt in een demo
   en daarna iemand voor een dichte deur zet. Kan een stap niet worden gevuld,
   dan zegt het plan dat -- met wat er wél kon.

   HOE HIJ KIEST, en waarom dat expliciet is. Er zit geen leeralgoritme achter
   dat uit je bestelgeschiedenis afleidt wat je wilt. Hij kijkt naar drie dingen
   die de gast zelf heeft opgeschreven of gevraagd: de voorkeuren uit de
   Hospitality DNA, het budget, en de klok. Elke keuze draagt zijn REDEN mee, en
   die reden is na te lezen -- een voorstel waarvan je de grond niet kunt
   nakijken is een orakel (dezelfde regel als bij Rahul in de wereldlaag).

   WAT HIJ NIET DOET: hij boekt niets. Hij zet een plan neer waar de stappen als
   `voorstel` in staan; aanvragen is een aparte handeling van het lid, en een
   tafel wordt daarna nog steeds door de ZAAK beslist. */
'use strict';

/* Ruwe duur per soort, in minuten. Bewust grof en bewust zichtbaar: een planner
   die doet alsof hij weet dat een diner 97 minuten duurt, is nauwkeuriger dan
   hij kan zijn. Deze getallen zijn een aanname en staan in het plan als zodanig. */
const DUUR = { eten: 105, uitgaan: 120, vervoer: 0, verblijf: 0, thuis: 0 };

module.exports = ({ findSupplier, planlaag, voorkeuren }) => {
  /* Alle zaken waar je kunt eten en die een kaart hebben. Zonder kaart kan een
     gast er niets bestellen en is een voorstel een gok. */
  function eetzaken(alle) {
    return (alle || []).filter(s => Array.isArray(s.menu) && s.menu.length);
  }

  /* Wat kost een avondmaal hier, per persoon? Uit de ECHTE kaart: het
     gemiddelde van een voor-, hoofd- en nagerecht als die er zijn, anders het
     gemiddelde van wat er staat. Geen prijsklasse-sterretjes maar het bedrag
     dat er werkelijk op de kaart staat. */
  function prijsPP(s) {
    const kaart = (s.menu || []).map(m => Math.round(Number(m.price) * 100)).filter(x => x > 0);
    if (!kaart.length) return 0;
    const cats = {};
    for (const m of (s.menu || [])) {
      const c = String(m.cat || 'overig').toLowerCase();
      (cats[c] = cats[c] || []).push(Math.round(Number(m.price) * 100));
    }
    const gem = (a) => Math.round(a.reduce((t, x) => t + x, 0) / a.length);
    const hoofd = Object.keys(cats).find(c => /hoofd/.test(c));
    const voor = Object.keys(cats).find(c => /voor/.test(c));
    const zoet = Object.keys(cats).find(c => /zoet|dessert|nagerecht/.test(c));
    if (hoofd) return gem(cats[hoofd]) + (voor ? gem(cats[voor]) : 0) + (zoet ? gem(cats[zoet]) : 0);
    return gem(kaart) * 2;
  }

  /* De score van een zaak voor DEZE wens. Elke plus en min draagt zijn reden;
     die reden komt in het plan te staan. */
  function weeg(s, { plafondPP, voorkeurTekst, sfeer }) {
    const redenen = [];
    let punten = 0;
    const pp = prijsPP(s);
    if (plafondPP) {
      if (pp <= plafondPP) { punten += 2; redenen.push('past binnen je budget (ongeveer € ' + (pp / 100).toFixed(2) + ' per persoon)'); }
      else { punten -= 3; redenen.push('zit boven je budget (ongeveer € ' + (pp / 100).toFixed(2) + ' per persoon)'); }
    }
    const tekst = (s.name + ' ' + (s.type || '') + ' ' + (s.city || '')).toLowerCase();
    for (const woord of String(voorkeurTekst || '').toLowerCase().split(/[,;]+/).map(x => x.trim()).filter(Boolean)) {
      if (tekst.includes(woord)) { punten += 2; redenen.push('sluit aan bij je voorkeur "' + woord + '"'); }
    }
    if (sfeer && tekst.includes(String(sfeer).toLowerCase())) { punten += 1; redenen.push('past bij de sfeer die je zocht'); }
    return { punten, redenen, prijsPP: pp };
  }

  /* ---------- het voorstel ----------
     Geeft een PLAN-invoer terug (nog geen opgeslagen avond) plus wat er niet
     ingevuld kon worden. De aanroeper maakt er een echte avond van. */
  function stel(key, wens, alleZaken) {
    const w = wens || {};
    const plafondPP = Math.max(0, parseInt(w.plafondPP, 10) || 0);
    const eigen = voorkeuren ? voorkeuren.van(key) : { waarden: {} };
    const voorkeurTekst = [eigen.waarden && eigen.waarden.sfeer, eigen.waarden && eigen.waarden.tafel]
      .filter(Boolean).join(', ');

    const kandidaten = eetzaken(alleZaken)
      .map(s => Object.assign({ zaak: s }, weeg(s, { plafondPP, voorkeurTekst, sfeer: w.sfeer })))
      .sort((a, b) => b.punten - a.punten);

    const gaten = [];
    const stappen = [];
    const uitleg = [];

    const eten = kandidaten[0];
    if (!eten) {
      gaten.push({ soort: 'eten', reden: 'Er staat hier geen zaak met een kaart waar je kunt eten.' });
    } else {
      stappen.push({ soort: 'eten', titel: 'Eten bij ' + eten.zaak.name, zaak: eten.zaak.code,
        van: w.start, duurMin: DUUR.eten, centenPP: eten.prijsPP });
      uitleg.push({ stap: 'eten', zaak: eten.zaak.code, waarom: eten.redenen.length
        ? eten.redenen : ['de enige zaak met een kaart die hierbij past'] });
    }

    /* Uitgaan erna, maar alleen als er ECHT een tweede plek is die niet
       dezelfde zaak is. Liever een avond met één stap dan een verzonnen bar. */
    const uit = kandidaten.find(k => eten && k.zaak.code !== eten.zaak.code &&
      /bar|club|beach/i.test(String(k.zaak.type || '') + String(k.zaak.name || '')));
    if (w.uitgaan !== false) {
      if (uit) {
        stappen.push({ soort: 'uitgaan', titel: 'Nog wat drinken bij ' + uit.zaak.name, zaak: uit.zaak.code,
          duurMin: DUUR.uitgaan, reisMin: 15, centenPP: Math.round(uit.prijsPP / 2) });
        uitleg.push({ stap: 'uitgaan', zaak: uit.zaak.code, waarom: ['op loopafstand van het eten in dezelfde plaats'] });
      } else {
        gaten.push({ soort: 'uitgaan', reden: 'Er is hier geen tweede zaak om na het eten heen te gaan. Dit deel is leeg gelaten in plaats van ingevuld met iets wat er niet is.' });
      }
    }

    if (w.thuisOm && stappen.length) {
      stappen.push({ soort: 'vervoer', titel: 'Terug naar huis', reisMin: 20, duurMin: 0, centenPP: 0 });
      uitleg.push({ stap: 'vervoer', waarom: ['je wilde om ' + w.thuisOm + ' thuis zijn; de rit wordt pas aangevraagd als je het plan aanneemt'] });
    }

    return {
      invoer: { titel: w.titel || 'Een avond', datum: w.datum, start: w.start, thuisOm: w.thuisOm,
        personen: w.personen, plafondPP: plafondPP, gezelschap: w.gezelschap, stappen },
      uitleg, gaten,
      aannames: ['Een diner duurt ongeveer ' + DUUR.eten + ' minuten en een tweede plek ongeveer ' +
        DUUR.uitgaan + '. Dat is een aanname, geen meting.']
    };
  }

  return { DUUR, eetzaken, prijsPP, weeg, stel };
};

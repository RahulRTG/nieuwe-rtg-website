/* ============================================================================
   DE REPRODUCTIECAPSULE -- alles wat nodig is om te begrijpen hoe een conclusie
   tot stand kwam, en niets wat van een deelnemer is.

   "WE HEBBEN ERGENS EEN EXCELBESTAND" is hoe onderzoek onherhaalbaar wordt. Wat
   een ander nodig heeft om een studie te wegen, is niet de ruwe data maar de
   OPZET: welke vragen zijn gesteld, in welke versie, met welk apparaat, in welke
   ijkstand, volgens welke bewijsregels, en wat er onderweg is veranderd.

   HIJ WORDT AFGELEID EN NIET BEWAARD. Een capsule die bij het afsluiten wordt
   dichtgeklapt, vertelt over een half jaar iets anders dan het dossier -- en dan
   is de vraag welke van de twee klopt (LAT-regel 4). Wie hem als bestand wil
   meesturen, haalt hem op het moment dat hij hem nodig heeft.

   WAT ER MET OPZET NIET IN ZIT:

     de ruwe waarnemingen  die zijn van de deelnemers. Wat zij invulden blijft in
                           het dossier; wat het lab eruit concludeerde staat op de
                           openbare kaart (./publicatie.js).
     aliassen              een capsule die codenamen draagt, maakt de scheiding
                           van ./mensen.js ongedaan zodra iemand hem doorstuurt.
     een analysepakket     RTG rekent geen statistiek. Wat hier staat is hoe er is
                           gemeten, niet hoe er is gerekend -- dat gebeurt buiten
                           dit systeem en dat staat er ook.
   ========================================================================== */
'use strict';

const kader = require('./kader');
const lijn = require('./conclusielijn');

/* De versie van de software die deze capsule maakte. Uit package.json en niet
   uit een constante hier: een versienummer dat met de hand wordt bijgewerkt,
   loopt achter op de dag dat het ertoe doet. */
let SOFTWARE = null;
try { SOFTWARE = { naam: 'RTG', versie: require('../../../package.json').version || null }; }
catch (e) { SOFTWARE = { naam: 'RTG', versie: null }; }

module.exports = (ctx) => {
  const { vindStudie, vindLab, nu } = ctx;

  function capsule(id) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    const d = s.dossier;
    const lab = vindLab(s.labId);

    /* DE APPARATEN DIE ER WERKELIJK AAN HINGEN, met de ijkstand zoals die bij het
       meten was BEVROREN (./instrument.js). Niet de huidige stand opzoeken: die
       is inmiddels veranderd, en dan lijkt een meting gedaan met een ijking die
       er toen niet was. */
    const apparaten = {};
    for (const m of (d.metingen || [])) {
      if (!m.apparaat) continue;
      const k = m.apparaat.id;
      if (!apparaten[k]) apparaten[k] = { id: k, naam: m.apparaat.naam || null, metingen: 0, ijkstanden: [] };
      apparaten[k].metingen += 1;
      const stand = JSON.stringify(m.apparaat.kalibratie || null);
      if (!apparaten[k].ijkstanden.some(x => JSON.stringify(x) === stand)) {
        apparaten[k].ijkstanden.push(m.apparaat.kalibratie || null);
      }
    }

    return { ok: true, capsule: {
      onderzoek: { nummer: s.nummer || null, titel: s.titel, soort: s.soort,
        lab: lab ? { naam: lab.naam, stad: lab.stad } : null, gestart: s.at, stap: s.stap,
        besluit: s.besluit ? { soort: s.besluit.soort, at: s.besluit.at } : null },

      /* De vraag en de verwachting, inclusief het TEGENDEEL -- want dat is wat
         een hypothese van een wens onderscheidt (./plan.js). */
      opzet: { vraagstuk: s.vraagstuk, doel: s.doel,
        hypothese: d.hypothese && d.hypothese.at ? { tekst: d.hypothese.tekst, tegendeel: d.hypothese.tegendeel } : null,
        plan: d.plan && d.plan.at ? { methoden: d.plan.methoden, steekproef: d.plan.steekproef,
          meetmomenten: d.plan.meetmomenten, hoogstBewijs: d.plan.hoogstBewijs } : null },

      /* Het meetprotocol met zijn versie. Metingen per versie erbij, want dat is
         de vraag die een lezer als eerste stelt. */
      meetprotocol: d.protocol && d.protocol.versie
        ? { versie: d.protocol.versie, instrumenten: d.protocol.instrumenten,
            metingenPerVersie: (d.metingen || []).reduce((o, m) => { o[m.protocolversie] = (o[m.protocolversie] || 0) + 1; return o; }, {}) }
        : null,

      apparatuur: Object.values(apparaten),

      /* DE REGELS WAARMEE BEWIJS IS GEWOGEN. Ze staan hier voluit en niet als
         verwijzing: wie deze capsule over vijf jaar leest, heeft de code van dit
         lab niet bij de hand. */
      bewijsregels: { ladder: kader.BEWIJS.map(g => ({ graad: g.graad, naam: g.naam, uitleg: g.uitleg || null })),
        let: 'Een graad hangt aan drie plafonds tegelijk: wat er aan dragers ligt, wat de gekozen methoden kunnen dragen, en of er een menselijke handtekening onder staat. De laagste van de drie wint.' },

      /* De conclusies met hun VERSIES: elke graadverandering is een versie, en
         wat ertoe leidde staat erbij (./conclusielijn.js). */
      conclusies: d.conclusies.map(c => Object.assign({
        id: c.id, tekst: c.tekst, graad: c.graad,
        dragers: (c.bewijs || []).map(w => ({ soort: w.soort, ref: w.ref })),
        getekend: c.tekenaar ? { rol: c.tekenaar.rol, at: c.tekenaar.at } : null
      }, lijn.versies(c))),

      /* Wat er onderweg gebeurde en wat de meeste rapporten weglaten. */
      onderweg: {
        reflectie: d.reflectie.map(r => ({ soort: r.soort, tekst: r.tekst, at: r.at })),
        terugtrekkingen: (d.terugtrekkingen || []).map(t => ({ at: t.at, observaties: t.observaties,
          metingen: t.metingen, conclusiesGezakt: t.conclusiesGezakt })),
        stilgelegd: d.ethiek.stilgelegd ? { at: d.ethiek.stilgelegd.at, reden: d.ethiek.stilgelegd.reden } : null
      },

      ethiek: { klasse: d.ethiek.klasse, toestemming: d.ethiek.toestemming.regime,
        stopcriteria: d.ethiek.stopcriteria.map(x => x.tekst),
        reviews: d.ethiek.review.length },

      software: SOFTWARE,
      gemaaktOp: nu(),

      bevatNiet: {
        ruweWaarnemingen: 'De observaties en de ingevulde metingen zitten er niet in. Die zijn van de deelnemers; deze capsule beschrijft hoe er is gemeten, niet wat er is gemeten.',
        aliassen: 'Er staan geen codenamen in. Een capsule die die draagt, maakt de scheiding tussen mens en onderzoek ongedaan zodra iemand hem doorstuurt.',
        analyse: 'Er staat geen statistische analyse in. RTG rekent die niet uit; wat hier staat is de opzet en de weging van bewijs.'
      }
    } };
  }

  return { capsule };
};

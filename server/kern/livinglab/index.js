/* RTF LIVING LAB -- een professioneel onderzoeks- en innovatieplatform waarop
   buurtbewoners, onderzoekers, studenten, organisaties, bedrijven en gemeenten
   samen echte problemen onderzoeken en oplossingen testen.

   De stelling van dit hele domein in één zin: de voorkant mag speels zijn, de
   achterkant is een onderzoeksinstituut. "Spelenderwijs" betekent hier niet
   vrijblijvend -- ./spel.js beloont juist het gedrag dat onderzoek duur maakt
   (een bron natrekken, een fout toegeven, een conclusie herzien) en beloont
   nadrukkelijk NIET het aanleveren van meer data.

   Twee onderzoeken, dezelfde motor. "Vermindert een gezamenlijke buurttuin
   eenzaamheid?" en "Welke sensor meet wateroverlast het beste?" doorlopen
   dezelfde tien stappen, met dezelfde bewijsgraden en hetzelfde auditspoor. Wat
   verschilt is het GEWICHT: bij een menselijk onderwerp weegt de professionele
   beoordeling zwaarder, ligt de bewijslat hoger en houdt het lab de data
   gescheiden. Dat verschil zit in ./kader.js als data, niet als een aparte
   codepad -- anders krijgt de sociale kant vanzelf de tweederangs versie.

   DE MAP, in leesvolgorde:

     kader.js       DE tabellen: cyclus, soorten, methoden, rollen, bewijsgraden,
                    risicoklassen, uitgangen. Eén plek, drie lezers (server,
                    scherm, coach).
     opslag.js      de bak, het schoonmaakwerk, het auditspoor
     bestuur.js     meerdere labs per stad; wat centraal is en wat lokaal mag
     studie.js      wat een onderzoek is, en de drie ringen van zicht erop
     plan.js        hypothese (met tegendeel) en onderzoeksplan (met steekproefeis)
     mensen.js      deelnemers, rollen, aliassen, en de vragen uit de buurt
     ethiek.js      risicoklasse, review, privacytoets, toestemming, stopcriteria
     bewijs.js      de motor die voorkomt dat een verhaal een feit wordt
     cyclus.js      de tien stappen en de poort voor elke stap
     spel.js        missies, badges, niveaus, labpaspoort
     werkplaats.js  taken, documenten, logboek, besluitenlog
     apparatuur.js  ruimtes en apparaten, met bevoegdheid en kalibratie
     doorbraak.js   van resultaat naar pilot, werkorder, subsidie of beleid
     impact.js      wat het heeft opgeleverd, gestopte studies incluis
     ai.js          de coach, met zijn grenzen in code en niet in een prompt

   DE VERHOUDING TOT HET BESTAANDE ONDERZOEKSLAB (kern/onderzoekslab.js). Dat is
   de R&D-keten van RTG zelf: idee > onderzoek > prototype > proef > uitrol. Het
   Living Lab is de ONDERZOEKSketen ervoor. Ze delen niets en dupliceren niets;
   ze raken elkaar op één plek, en die loopt één kant op: een pilotvoorstel uit
   het Living Lab wordt via ./doorbraak.js een project in het Onderzoekslab, met
   een verwijzing terug. Zo blijft er één waarheid over waar een project staat
   (regel 4). */
'use strict';

module.exports = ({ db, save, crypto, anthropic, lab, kosten, economie }) => {
  /* De context wordt hier één keer opgebouwd en aan elke deelmodule meegegeven.
     De VOLGORDE hieronder is niet vrij: een module die iets uit `ctx`
     DESTRUCTUREERT, leest de waarde op het moment dat hij wordt gebouwd. Wie
     ethiek vóór bestuur bouwt, geeft hem `undefined` mee en krijgt dat pas
     terug als een tekenaar wil tekenen. Modules die elkaar pas tijdens een
     aanroep nodig hebben (plan -> spel, doorbraak -> studie) lezen via `ctx.x`
     en staan daarom niet aan deze volgorde vast. */
  const ctx = require('./opslag')({ db, save, crypto });
  ctx.anthropic = anthropic || null;
  ctx.lab = lab || null;

  ctx.bestuur = require('./bestuur')(ctx);
  ctx.studie = require('./studie')(ctx);
  ctx.spel = require('./spel')(ctx);
  ctx.ethiek = require('./ethiek')(ctx);        // leest ctx.bestuur bij de bouw
  /* De waarborgen horen bij de ethiek en staan alleen apart omdat het samen over
     de 10 KB ging. Ze worden hier tot ÉÉN naam samengevoegd: de rest van de map
     en alle routes kennen `ethiek` en hoeven niet te weten in welk van de twee
     bestanden een functie is beland. */
  ctx.waarborg = require('./waarborg')(ctx);
  Object.assign(ctx.ethiek, ctx.waarborg);
  ctx.plan = require('./plan')(ctx);
  ctx.mensen = require('./mensen')(ctx);        // leest ctx.studie bij de bouw
  ctx.themas = require('./themas')(ctx);
  ctx.waarnemen = require('./waarnemen')(ctx);
  ctx.bewijs = require('./bewijs')(ctx);        // leest ctx.bestuur bij de bouw
  /* Verzamelen en wegen staan in twee bestanden maar zijn één begrip voor de
     rest van de map: ./waarnemen.js levert het ruwe materiaal, ./bewijs.js weegt
     het. Ze worden hier samengevoegd zodat de routes één `bewijs` kennen. */
  Object.assign(ctx.bewijs, ctx.waarnemen);
  ctx.cyclus = require('./cyclus')(ctx);        // leest ctx.ethiek en ctx.spel bij de bouw
  ctx.werkplaats = require('./werkplaats')(ctx);
  ctx.apparatuur = require('./apparatuur')(ctx);
  // het register en het gebruik ervan: twee bestanden, één begrip voor de routes
  Object.assign(ctx.apparatuur, require('./apparatuurgebruik')(ctx));
  /* De meetinstrumenten (./instrument.js): wat een deelnemer met zijn labpas
     invult. Hij staat NA de apparatuur omdat hij de kalibratiestand van een
     apparaat bevriest op het moment van meten, en die rekensom staat daar. */
  ctx.instrument = require('./instrument')(ctx);
  ctx.doorbraak = require('./doorbraak')(ctx);
  ctx.impact = require('./impact')(ctx);
  ctx.ai = require('./ai')(ctx);

  /* HET ONDERZOEKSGROOTBOEK (./ledger.js): wat een studie kostte en waarom de
     stichting die rekening mocht betalen. Hij leest de kostenmeter en de
     economische firewall, en die worden als functie doorgegeven omdat ze pas in
     een latere laag bestaan (opzet/kernlaag2.js).

     Hij staat hier achteraan omdat hij alleen LEEST: geen enkele module
     hierboven hangt ervan af, en een grootboek dat iets zou veranderen aan wat
     het telt, is geen grootboek. */
  ctx.ledger = require('./ledger').maakLedger({
    kosten, economie,
    vindLab: (id) => ctx.vindLab(id), vindStudie: (id) => ctx.vindStudie(id), nu: ctx.nu });

  const kader = require('./kader');

  /* Het kader zoals het scherm het krijgt. Dit is de enige weg waarlangs een
     pagina de cyclus, de methoden en de risicoklassen leert kennen -- zodat een
     scherm nooit een stap aanbiedt die de server weigert. */
  const kaderVoorScherm = () => ({ ok: true,
    cyclus: kader.CYCLUS, soorten: kader.SOORTEN, methoden: kader.METHODEN, rollen: kader.ROLLEN,
    bewijs: kader.BEWIJS, risico: kader.RISICO, uitgangen: kader.UITGANGEN,
    bewijssoorten: ctx.bewijs.SOORTEN_BEWIJS, reflectiesoorten: ctx.bewijs.REFLECTIE,
    besluiten: ctx.cyclus.BESLUITEN, apparaatsoorten: ctx.apparatuur.SOORTEN,
    uitgangstatus: ctx.doorbraak.STATUS, uitgangeis: ctx.doorbraak.EIS,
    spel: ctx.spel.tabel(), bewaar: { min: ctx.bestuur.BEWAAR_MIN, max: ctx.bestuur.BEWAAR_MAX } });

  /* Het beeld dat een deelnemer met een labpas van zijn EIGEN onderzoek krijgt:
     de studie, wat er nu moet gebeuren, en zijn eigen stand in het spel. Meer
     niet -- een bewoner is medeonderzoeker, geen beheerder. */
  function mijn(pas) {
    const wie = ctx.mensen.opPas(pas);
    if (!wie) return { status: 404, error: 'Deze labpas kennen we niet.' };
    const kijker = { alias: wie.alias, staf: false };
    const s = ctx.studie.studie(wie.studieId, kijker);
    if (s.error) return s;
    const studie = ctx.vindStudie(wie.studieId);
    const ik = studie.dossier.deelnemers.find(d => d.alias === wie.alias);
    const nv = ctx.spel.niveauVan(ik.punten || 0);
    return { ok: true, alias: wie.alias, rol: wie.rol, studie: s.studie,
      watNu: ctx.cyclus.watNu(wie.studieId),
      ik: { punten: ik.punten || 0, niveau: nv.niveau, niveauNaam: nv.naam,
        badges: ik.badges.map(b => ctx.spel.BADGES.find(x => x.badge === b)).filter(Boolean),
        taken: studie.dossier.taken.filter(t => !t.af && t.voor === wie.alias) } };
  }

  return { livinglab: Object.assign({}, ctx, { kaderVoorScherm, mijn, kader }) };
};

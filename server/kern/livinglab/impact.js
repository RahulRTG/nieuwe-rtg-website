/* RTF Living Lab, deel "impact": wat het onderzoek heeft opgeleverd.

   "35 projecten uitgevoerd" is geen impact maar drukte. Dit bestand telt wat er
   werkelijk is veranderd, en het telt daarbij bewust ook de dingen die de meeste
   dashboards weglaten:

   - GESTOPTE STUDIES tellen als opbrengst, niet als verlies. Een lab dat nooit
     iets stopt, onderzoekt niets -- dan bevestigt het alleen wat het al vond.
     Daarom staat `gestopt` bij de opbrengst en niet bij de uitval, en daarom
     staat het STOPPERCENTAGE erbij als eigen getal.
   - HERZIENE CONCLUSIES tellen mee. Elke keer dat een team een eerdere conclusie
     terugnam, is dat een fout die niet is blijven staan.
   - UITGEVOERDE aanbevelingen tellen apart van INGEDIENDE. Het verschil tussen
     die twee is precies waar de meeste innovatieprogramma's hun cijfers halen.

   Wat hier NIET wordt uitgerekend: of een interventie "werkte". Dat oordeel
   hangt aan de bewijsgraad van de conclusie (./bewijs.js), en die is per studie
   verdiend. Deze module telt alleen wat daar al staat; hij promoveert nooit een
   indicatie tot een effect. */
'use strict';

const kader = require('./kader');

module.exports = (ctx) => {
  const { S, getal, vindLab } = ctx;

  function impact(labId) {
    const lab = vindLab(labId); if (!lab) return { status: 404, error: 'Dit lab bestaat niet.' };
    const studies = S().studies.filter(s => s.labId === lab.id);
    const af = studies.filter(s => s.besluit);
    const gestopt = af.filter(s => s.besluit.soort === 'gestopt');
    const opgeschaald = af.filter(s => s.besluit.soort === 'opschalen');

    /* Deelnemers worden geteld over studies heen, en dat is met opzet een
       BEZOEKENteller en geen personenteller: aliassen zijn per studie, dus
       dezelfde bewoner in drie studies telt hier als drie deelnames. Wie er één
       persoon van zou maken, moet de scheiding doorbreken die ./mensen.js juist
       aanbrengt. De naam van het veld zegt daarom `deelnames`. */
    const deelnames = studies.reduce((n, s) => n + s.dossier.deelnemers.length, 0);
    const bewoners = studies.reduce((n, s) => n + s.dossier.deelnemers.filter(d =>
      d.rol === 'buurtonderzoeker' || d.rol === 'ervaringsdeskundige').length, 0);

    const uitgangen = [];
    for (const s of studies) for (const x of s.dossier.uitgangen) uitgangen.push(x);
    const uitgevoerd = uitgangen.filter(x => x.status === 'uitgevoerd');
    const ingediend = uitgangen.filter(x => x.status !== 'voorstel');

    const conclusies = studies.reduce((a, s) => a.concat(s.dossier.conclusies), []);
    const perGraad = {};
    for (const g of kader.BEWIJS) perGraad[g.graad] = conclusies.filter(c => c.graad === g.graad).length;
    const herzien = studies.reduce((n, s) => n + s.dossier.reflectie.filter(r => r.soort === 'herzien').length, 0);
    const fouten = studies.reduce((n, s) => n + s.dossier.reflectie.filter(r => r.soort === 'misging').length, 0);

    // vaardigheden: deelnemers die een niveau haalden dat meer dan meedoen vraagt
    const badges = studies.reduce((n, s) => n + s.dossier.deelnemers.reduce((m, d) => m + d.badges.length, 0), 0);

    const besparing = uitgevoerd.reduce((n, x) => n + (x.bedrag || 0), 0);

    return { ok: true, lab: { id: lab.id, stad: lab.stad, naam: lab.naam },
      onderzoek: { totaal: studies.length, lopend: studies.length - af.length, afgerond: af.length,
        gestopt: gestopt.length, opgeschaald: opgeschaald.length,
        // het stoppercentage van de AFGERONDE studies; op nul afgerond is er
        // niets te delen en dan staat er null en geen misleidende 0%
        stoppercentage: af.length ? Math.round((gestopt.length / af.length) * 100) : null },
      mensen: { deelnames, bewoners, badges,
        aandeelBewoners: deelnames ? Math.round((bewoners / deelnames) * 100) : null },
      kennis: { conclusies: conclusies.length, perGraad, herzien, foutenVastgelegd: fouten,
        bronnen: studies.reduce((n, s) => n + s.dossier.bronnen.length, 0),
        nagetrokken: studies.reduce((n, s) => n + s.dossier.bronnen.filter(b => b.nagetrokken).length, 0) },
      verandering: { voorstellen: uitgangen.length, ingediend: ingediend.length, uitgevoerd: uitgevoerd.length,
        // het gat tussen indienen en uitvoeren, want daar zit het echte verhaal
        uitvoeringspercentage: ingediend.length ? Math.round((uitgevoerd.length / ingediend.length) * 100) : null,
        gemoeidBedrag: besparing },
      // wat dit getal NIET zegt, staat erbij zodat het niet los in een rapport belandt
      voorbehoud: 'Bewijsgraden gelden binnen de studie waarin ze zijn verdiend. Dit overzicht telt ze; het generaliseert ze niet.' };
  }

  /* De ranglijst die er WEL mag zijn: niet wie de meeste data leverde, maar
     welke studies het meeste hebben teruggegeven aan de buurt. Gesorteerd op
     uitgevoerde uitgangen, met de gestopte studies er gewoon tussen. */
  function opbrengst(labId, max) {
    const lab = vindLab(labId); if (!lab) return { status: 404, error: 'Dit lab bestaat niet.' };
    const rijen = S().studies.filter(s => s.labId === lab.id).map(s => ({
      id: s.id, titel: s.titel, soort: s.soort, stap: s.stap,
      besluit: s.besluit ? s.besluit.soort : null,
      uitgevoerd: s.dossier.uitgangen.filter(x => x.status === 'uitgevoerd').length,
      conclusies: s.dossier.conclusies.length,
      herzien: s.dossier.reflectie.filter(r => r.soort === 'herzien').length,
      deelnames: s.dossier.deelnemers.length, punten: s.punten || 0
    }));
    rijen.sort((a, b) => b.uitgevoerd - a.uitgevoerd || b.herzien - a.herzien || b.punten - a.punten);
    return { ok: true, studies: rijen.slice(0, getal(max || 50, 1, 500)) };
  }

  return { impact, opbrengst };
};

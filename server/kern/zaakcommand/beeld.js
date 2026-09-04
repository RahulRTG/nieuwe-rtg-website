/* Zaak Command, het BEELD: wat een ondernemer ziet als hij de app opent, en
   welke acties er bij een object horen.

   WAAROM DIT UIT ./index.js IS GEHAALD. Dat bestand doet de bedrading -- welke
   motoren draaien op welk register, met welk vak en welk beleid. Het beeld is
   iets anders: dat rekent uit die motoren een scherm. Ze stonden bij elkaar tot
   index.js over de 10 kB-grens ging, en dit was de naad die er al lag. Niet de
   grens is de reden om hier te knippen, maar de grens dwong hem wel aan te
   wijzen.

   DE PULS IS BEWUST NIET kern/command/puls.js. Die telt domeinen van het
   platform en spreekt over agents en rechtengrafen. Een ondernemer wil weten of
   er iets op hem wacht, of er iets recht te zetten valt, en of zijn journaal
   heel is. Drie regels, niet dertig. */
'use strict';

const { NIVEAUS } = require('../frictie');

/* Welke acties horen bij dit object, en op welk niveau staan ze nu? Hier komen
   het receptenboek van de zaak en de risicomotor bij elkaar; het objectdossier
   weet daardoor zelf niets van risico -- het krijgt de uitkomst. */
function maakActiesVoor({ catalogus, risico }) {
  return function actiesVoor(k, rij) {
    const uit = [];
    for (const rb of catalogus.RUNBOOKS) {
      if (rb.type !== k.type) continue;
      const past = rb.past(rij);
      const o = risico.beoordeel(rb.actie, { aantal: 1, klantImpact: rb.klantImpact,
        onomkeerbaar: !rb.terugDraaibaar, centen: k.bedrag || 0 });
      uit.push({ soort: 'runbook', id: rb.id, naam: rb.naam, wat: rb.wat, past,
        niveau: o.niveau, score: o.score, waarom: o.waarom, vierOgen: o.vierOgen,
        waaromNiet: past ? null : 'dit object voldoet nu niet aan de voorwaarde van dit recept' });
    }
    uit.push({ soort: 'zaak', id: 'zaak-openen', naam: 'Uitzondering openen',
      wat: 'Zet dit op de lijst, met een eigenaar en een termijn.', past: true,
      niveau: NIVEAUS.hand, score: risico.beoordeel('zaak toewijzen', {}).score,
      waarom: 'een uitzondering openen is altijd mensenwerk' });
    return uit;
  };
}

function maakPuls({ db, code, leiding, register, signalen, runbooks, zaken, beleid, journaal, zaakVan }) {
  return function puls() {
    const z = zaakVan();
    const sig = z ? signalen.voor(z, { leiding: leiding }) : [];
    const rbs = runbooks.lijst();
    const zt = zaken.tellingen();
    const teHerstellen = rbs.reduce((n, r) => n + r.kandidaten, 0);
    const rood = sig.filter(x => x.niveau === 'rood').length;
    const stand = rood || zt.overTermijn ? 'let op' : (sig.length || zt.open || teHerstellen) ? 'aandacht' : 'in orde';
    const perSoort = register.SOORTEN.map(so => ({ type: so.type, label: so.label,
      meervoud: so.meervoud, domein: so.domein, aantal: register.rijen(db, so).length }));
    return {
      stand, at: new Date().toISOString(),
      zaak: z ? { code: z.code, naam: z.name, soort: z.type, plaats: z.city } : { code },
      signalen: sig, rood,
      herstel: { runbooks: rbs.length, kandidaten: teHerstellen, lijst: rbs,
        autoAan: beleid.waarde('herstel.autoAan', true) !== false },
      uitzonderingen: zt,
      objecten: perSoort,
      journaal: { regels: journaal.aantal(), venster: journaal.venster(), keten: journaal.controleer() },
      /* Wat dit beeld NIET weet, en dat hoort erbij: het kent alleen de soorten
         uit het zaakregister. Wat daar niet in staat, staat hier niet op groen
         -- het staat er niet. */
      dekking: { soorten: register.SOORTEN.length }
    };
  };
}

module.exports = { maakActiesVoor, maakPuls };

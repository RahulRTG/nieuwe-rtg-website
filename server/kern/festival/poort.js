/* RTG Festival (deelmodule): DE VRAAG AAN DE POORT -- mag deze pas hier, nu?

   Afgesplitst van ./rechten.js op een echte naad: daar wordt een recht
   GESCHREVEN, hier wordt het GELEZEN. Die twee kanten hebben verschillende
   lezers (een backoffice tegenover een scanner die duizenden keren per uur
   draait) en verschillende foutbehoefte.

   DE VOLGORDE VAN DE WEIGERINGEN IS DE INHOUD, en dat is de hele reden dat dit
   bestand meer is dan een filter. Aan een poort staat een mens met vier
   seconden, en die heeft niets aan "geen toegang". Hij heeft de MEEST
   SPECIFIEKE WARE reden nodig:

     geen recht op deze plek     -> hier hoort deze gast niet, wijs hem door
     wel recht, verkeerde dag    -> hij komt een dag te vroeg
     wel recht, ander venster    -> hij mag om 13:00 naar binnen, nu nog niet
     wel recht, eis open         -> de instructie ontbreekt; DAT is ter plekke
                                    op te lossen, en dus de nuttigste zin

   Daarom stopt de zoektocht niet bij de eerste mismatch maar loopt hij alle
   rechten door: van alles wat deze plek raakt wint de reden die het DICHTST BIJ
   JA ligt. Een pas met vijf rechten waarvan er vier niet over deze plek gaan en
   een over de goede plek maar het verkeerde uur, hoort "van 13:00 tot 19:00" te
   zeggen en niet "geen toegang".

   HIER WORDT NIETS GESCHREVEN. Geen scan, geen teller, geen logregel: dit is
   een vraag en het antwoord mag herhaald worden zonder gevolgen. Wat er van een
   scan wordt onthouden, staat in ./toegang.js -- want dat is wel een handeling,
   en die hoort maar op een plek te wonen. */
'use strict';

module.exports = (ctx) => {
  const { editieVind, dagOpMoment, offset, momentOffset, plekVind, plekPad, plekIn, pasOpCode } = ctx;

  function magHier(fid, eid, vraag) {
    const e = editieVind(fid, eid);
    if (!e) return { ok: false, status: 404, reden: 'Deze editie bestaat niet.' };
    const v = vraag || {};
    const pas = pasOpCode(e, v.code);
    if (!pas) return { ok: false, status: 404, reden: 'Deze code hoort niet bij deze editie.' };
    const plek = plekVind(e, v.plek);
    if (!plek) return { ok: false, status: 404, pas, reden: 'Deze plek bestaat niet.' };
    /* Welke dag hoort bij dit moment -- en dus niet "is de datum vandaag". Een
       scan om 01:12 hoort bij de dag die gisteren om 12:00 opende; kern/festival
       /model.js rekent dat uit en het staat daar EEN keer. */
    const dag = dagOpMoment(e, String(v.datum || ''), String(v.tijd || ''));
    if (!dag) return { ok: false, pas, reden: 'Op dit moment is er geen festivaldag open.' };
    /* Het NU wordt met de datum erbij gerekend (momentOffset) en de VENSTERS
       van een recht met de kloktijd (offset). Dat lijkt inconsequent en is het
       niet: een scan is een tijdstip, een venster is een tijd-op-de-dag. Beide
       komen uit als minuten na de opening van DEZE dag, dus ze zijn onderling
       te vergelijken -- en dat is precies waar die eenheid voor bestaat. */
    const nu = momentOffset(dag, String(v.datum || ''), String(v.tijd || ''));

    /* DE INTREKKING WORDT PAS HIER GETOETST, EN DAT IS GEEN SLORDIGHEID.
       ./toegang.js laat een ingetrokken pas WEL naar buiten -- een mens die het
       terrein niet af mag omdat zijn kaartje is ingetrokken, is een ontwerpfout
       met een draaihek eromheen, en de telling zou er ook nog van gaan liegen.
       Om die uitgang te kunnen zetten heeft de scan de plek en de dag nodig, en
       die zijn hierboven pas bekend. Stond deze weigering vooraan, dan kwam er
       een oordeel terug zonder plek en viel de uitgang stil terug op rood. */
    if (pas.ingetrokken) {
      return { ok: false, pas, plek, dag, reden: 'Deze pas is ingetrokken'
        + (pas.redenIntrekking ? ' (' + pas.redenIntrekking + ')' : '') + '.' };
    }
    const bewijs = Array.isArray(v.bewijs) ? v.bewijs.map(String) : [];

    /* DE BESLOTENHEIDSGRENS. Loop van deze plek omhoog en pak de EERSTE (dus
       diepste) plek die niet erft. Ligt die er, dan telt een recht alleen mee
       als het die plek zelf noemt of iets dat erin ligt -- een recht op het
       terrein reikt niet tot backstage. Ligt er geen, dan erft alles gewoon.

       Dit staat hier en niet in de lus, want het is een eigenschap van de
       GEVRAAGDE plek en niet van het recht: een keer uitrekenen, elk recht
       eraan toetsen. */
    const pad = plekPad(e, plek.id);
    if (!pad) return { ok: false, pas, plek, reden: 'Deze plek hangt scheef in het terrein.' };
    const grens = pad.find(p => p.besloten) || null;

    /* De rang zegt hoe dicht een weigering bij "ja" lag; de hoogste wint. */
    let beste = null;
    const beter = (reden, rang) => { if (!beste || rang > beste.rang) beste = { rang, reden }; };

    for (const r of pas.rechten || []) {
      /* Een recht op een ZONE opent ook wat erin ligt (kern/festival/terrein.js,
         plekIn). Zonder die regel zou elk recht elke onderliggende plek apart
         moeten noemen en is de boom versiering. Een recht zonder plek geldt
         overal op het terrein. */
      if (r.plek && !plekIn(e, plek.id, r.plek)) continue;
      /* Besloten: het recht moet binnen de grens vallen, niet erboven. */
      if (grens && (!r.plek || !plekIn(e, r.plek, grens.id))) {
        beter('Deze pas geeft geen toegang tot ' + grens.naam + '.', 0);
        continue;
      }
      if (r.dagen && !r.dagen.includes(dag.id)) {
        beter('Deze pas geldt niet op ' + dag.datum + '.', 1);
        continue;
      }
      if (r.van) {
        const van = offset(dag, r.van), tot = offset(dag, r.tot);
        /* Een venster dat op DEZE dag buiten de openingstijden valt, telt hier
           niet mee. keurRecht() heeft bij het schrijven al geweigerd dat het op
           ALLE dagen zo is; dit is de toegestane rest -- een middagrecht op een
           avonddag hoort gewoon niet te openen. */
        if (van === null || tot === null || nu === null) {
          beter('Deze pas geldt hier op een ander moment.', 2);
          continue;
        }
        /* Het venster mag zelf over middernacht heen lopen (23:00-01:00). In
           offsets is dat gewoon van <= tot, want beide zijn geteld vanaf de
           opening van DEZE dag -- precies waarvoor die telling bestaat. */
        if (nu < van || nu > tot) {
          beter('Deze pas geldt hier van ' + r.van + ' tot ' + r.tot + '.', 2);
          continue;
        }
      }
      if (r.eis && !bewijs.includes(r.eis)) {
        beter('Nog niet in orde: ' + r.eis + '.', 3);
        continue;
      }
      return { ok: true, pas, plek, dag, recht: r };
    }
    return { ok: false, pas, plek, dag,
      reden: beste ? beste.reden : 'Deze pas geeft geen toegang tot ' + plek.naam + '.' };
  }

  return { magHier };
};

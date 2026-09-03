/* De objectlaag, deelbestand "paginabijdragers": WIE VULT WELKE SECTIE.

   De structuur staat in ./pagina.js; dit is de eerste lichting bijdragers. Zij
   lezen uitsluitend wat objectlaag.object() al teruggaf -- geen tweede weg naar
   een domein, want dan bezit deze laag alsnog iets (./index.js regel 1).

   DAT MAAKT DE EERSTE LICHTING MET OPZET MAGER, en dat is het punt van de
   structuur: de secties die niemand vult komen terug als `nietGevraagd`, met de
   soort erbij. Zes lege secties op een persoonspagina is geen tegenvaller maar
   de eerste eerlijke uitdraai van wat dit huis over een persoon kan zeggen
   zonder in zijn dossier te kijken. Wie geld, documenten of een tijdlijn wil
   zien, meldt daar een bijdrager voor aan -- dat is precies de weg die deze
   laag openzet.

   DE BEWIJSGRAAD IS HIER OVERAL `gemeten` EN NOOIT `bewezen`. Wat hier staat, is
   afgelezen uit de bron van het domein op dit moment; dat is een meting. Een
   bewering wordt pas `bewezen` als er een controle onder hangt die kan zakken,
   en die is er voor geen van deze regels. */
'use strict';

const NL = { persoon: 'persoon', groep: 'groep', event: 'bijeenkomst' };

module.exports = () => ([
  {
    id: 'objectlaag:wat', sectie: 'samenvatting', voor: ['*'], bron: 'kern/objectlaag',
    lever: (o) => ({ tekst: (NL[o.soort] || o.soort) + ': ' + (o.titel || o.id), graad: 'gemeten' })
  },
  {
    /* De caps ZIJN de volgende acties: de objectlaag beantwoordt de vraag "wat
       kan ik met dit ding" al, en elke cap draagt zijn bestemming. Dit is dus
       geen tweede lijst maar dezelfde (LAT.md regel 4). */
    id: 'objectlaag:caps', sectie: 'volgende', voor: ['*'], bron: 'kern/objectlaag/caps.js',
    lever: (o) => (o.caps || []).map(c => ({
      tekst: c.titel || c.naam || c.id, naar: c.naar || c.bestemming || null, graad: 'gemeten'
    }))
  },
  {
    /* Wat de objectlaag STIL houdt, is zelf een mededeling: een cap die er niet
       is omdat hij hier niet mag, hoort niet als leegte te verschijnen. */
    id: 'objectlaag:stil', sectie: 'rechten', voor: ['*'], bron: 'kern/objectlaag',
    lever: (o) => (o.stil || []).map(s => ({
      tekst: typeof s === 'string' ? s : (s.reden || s.titel || ''), graad: 'gemeten'
    }))
  },
  {
    id: 'event:wanneer', sectie: 'status', voor: ['event'], bron: 'kern/bijeenkomst',
    lever: (o) => {
      const v = o.over || {};
      const regels = [];
      if (v.afgelast) regels.push({ tekst: 'Afgelast.', graad: 'gemeten' });
      if (v.datum) regels.push({ tekst: (v.datum + (v.tijd ? ' om ' + v.tijd : '')) + (v.waar ? ', ' + v.waar : ''), graad: 'gemeten' });
      if (v.vol) regels.push({ tekst: 'Vol.', graad: 'gemeten' });
      return regels;
    }
  },
  {
    id: 'event:wie', sectie: 'betrokkenen', voor: ['event'], bron: 'kern/bijeenkomst',
    lever: (o) => {
      const v = o.over || {};
      const regels = [];
      if (v.gastheer) regels.push({ tekst: 'Gastheer: ' + v.gastheer, graad: 'gemeten' });
      if (Number.isFinite(v.ja)) regels.push({ tekst: v.ja + ' komen, ' + (v.misschien || 0) + ' misschien', graad: 'gemeten' });
      return regels;
    }
  },
  {
    id: 'groep:wie', sectie: 'betrokkenen', voor: ['groep'], bron: 'kern/genootschap',
    lever: (o) => {
      const v = o.over || {};
      /* Een aantal en geen namenlijst: die hoort in Genootschap zelf te staan
         en niet op een pagina die over het object gaat. */
      const n = Array.isArray(v.leden) ? v.leden.length : v.leden;
      return Number.isFinite(n) ? { tekst: n + ' leden', graad: 'gemeten' } : null;
    }
  },
  {
    id: 'persoon:samen', sectie: 'tijdlijn', voor: ['persoon'], bron: 'kern/objectlaag/samen.js',
    lever: (o) => (o.samen || []).slice(0, 12).map(s => ({
      tekst: s.tekst || s.wat || s.titel || '', naar: s.naar || null, op: s.op || s.datum || null, graad: 'gemeten'
    }))
  }
]);

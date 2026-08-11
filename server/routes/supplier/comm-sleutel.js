/* De zakelijke kant van het communicatieplatform: ONDER WELKE SLEUTEL.

   Drie vragen die voor elke route hieronder eerst beantwoord moeten worden --
   wie is deze sessie, onder welke van haar sleutels is dit gesprek van haar, en
   met welke deur gaat de draad open. Geknipt uit ./comm.js omdat dat bestand
   over de leesgrens ging, en dit het stuk was dat op zichzelf staat: hier zit
   geen enkele route in, alleen het antwoord op "wie ben ik hier".

   Dat maakt het ook de plek om na te kijken of een zaak kan meelezen waar ze
   niet hoort. De regel uit ./comm.js geldt onverkort: de sleutel wordt
   AFGELEID uit de sessie, nooit aangeleverd. */
'use strict';
const wie = require('../../kern/comm/wie');

module.exports = ({ comm }) => {
  /* Wie deze sessie is. Geen zaak in de sessie is geen actor -- en dan is er
     niets om mee te proberen. */
  function actor(req, res) {
    const a = wie.vanZaak(req);
    if (!a) { res.status(401).json({ error: 'Geen zaak in deze sessie.' }); return null; }
    return a;
  }

  /* Onder WELKE sleutel dit gesprek van jou is. In de praktijk staat er een
     van de twee in een gesprek -- een gedeelde zaakinbox en een collega-DM
     zijn verschillende dingen -- maar niets in de kern verbiedt allebei, en
     een route hoort niet te leunen op wat er meestal staat. De volgorde van
     `alle` beslist dus, en die is met opzet zaak-eerst: staat de zaak erin,
     dan is het gesprek van het bedrijf en hoort het antwoord ook van het
     bedrijf te komen.

     Geen van beide is een weigering, en die weigering komt van de kern zelf
     zodat er maar een plek is waar dat antwoord wordt geformuleerd. */
  function alsWie(a, gesprekId) {
    const g = comm.gesprekVan(String(gesprekId || ''));
    const sleutel = g && a.alle.find((s) => comm.magErin(g, s));
    if (!sleutel) throw new Error(g ? 'Dit gesprek is niet van jou.' : 'Dit gesprek bestaat niet.');
    return sleutel;
  }

  /* HOE JE DIT GESPREK OPENT, en waarom dat hier staat en niet in de app.

     De zaak-app had drie lijsten: gastchat, sollicitaties en collega's. Elk met
     een eigen tabblad, een eigen teller en een eigen "is er nog iets?" -- terwijl
     het onderhuids allemaal gesprekken uit dezelfde kern zijn. Een mens die
     wil weten of er iets ligt, hoort niet op drie plekken te kijken.

     De LIJST wordt daarom een. De DRADEN blijven waar ze zijn: de gastchat kan
     de Salon van de klant tonen en vertaalt per kijker, de sollicitatiechat
     hangt aan de werk-module met haar eigen controles, en de collega-DM is een
     paneel in elke werk-app. Die drie zijn niet hetzelfde en samenvoegen zou
     functies kosten in ruil voor uniformiteit.

     Wat de app dan nog mist is de sleutel waarmee zo'n draad opengaat, en die
     staat in de meta van het gesprek -- bij de kern dus, niet in het scherm.
     Vandaar dit veld: de lijst zegt zelf welke deur erbij hoort. Zonder dat
     zou de app de meta moeten raden uit de titel, en dat is precies hoe een
     scherm stil aan een opslagvorm vast komt te zitten. */
  function hoeTeOpenen(gesprekId, sleutel) {
    const g = comm.gesprekVan(gesprekId);
    const m = (g && g.meta) || {};
    if (m.bron === 'Zaak' && m.zaak) {
      const lid = (g.deelnemers || []).find((d) => wie.isLid(d)) || '';
      /* MET het voorvoegsel 'gast:', want zo heet deze sleutel al in de
         zaak-state (kern/comm/gast.js, voorZaak). De chat-route slikt beide
         vormen -- hij strippt het voorvoegsel -- en dat maakte dit verschil
         onzichtbaar in een toets die alleen kijkt of de deur OPENT. Op het
         scherm niet: daar wordt deze sleutel VERGELEKEN met die uit de state,
         en dan opent de rij gewoon niets. Een sleutel heeft een vorm, niet
         twee. */
      return { soort: 'gast', sleutel: 'gast:' + m.zaak + '|' + lid + '|' + (m.dept || 'Team'), dept: m.dept || 'Team' };
    }
    if (m.bron === 'Werk' && m.sleutel) {
      return { soort: 'werk', sleutel: String(m.sleutel).replace(/^werk:/, ''), metWie: m.metWie || null };
    }
    /* Wat overblijft is een gesprek tussen twee mensen van deze zaak: de
       collega-DM. De ander is de deelnemer die ik niet ben, en zijn nummer is
       waarmee het bestaande paneel opengaat. */
    const ander = (g.deelnemers || []).find((d) => d !== sleutel);
    const a = ander ? wie.ontleed(ander) : null;
    if (a && a.soort === 'mens') return { soort: 'collega', staffId: a.nummer };
    return null;
  }
  return { actor, alsWie, hoeTeOpenen };
};

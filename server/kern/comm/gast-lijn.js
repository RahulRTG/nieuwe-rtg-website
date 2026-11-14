/* De identiteit en herkomst van een gastcontactlijn. Aanleggen en alleen
   opzoeken zijn aparte ingangen: lezen mag geen relatie creëren, een import
   mag geen ingetrokken deelnemer herstellen. Berichtvorm en verzending
   blijven in ./gast.js; de historische omzetting in ./gast-verhuizing.js. */
'use strict';
const wie = require('./wie');
const { maakGastVerhuizing } = require('./gast-verhuizing');

function maakGastLijn({ db, save, comm }) {
  const codeVan = (c) => String(c || '').trim().toUpperCase();
  // exact de oude sleutel (kern/leverancier/gastcontact.js, chatKeyOf)
  const lijnSleutel = (code, key, dept) => codeVan(code) + '|' + key + '|' + (dept || 'Team');
  const zaakVan = (code) => wie.zaak(code);
  const verhuizing = maakGastVerhuizing({ db, save, comm, lijnSleutel, zaakVan });

  /* De lijn tussen dit lid en deze zaak, voor deze afdeling. De enige ingang.
     `soort: 'order'` zet hem in de la Onderweg van de inbox -- het gaat over
     iets dat loopt -- en `meta` draagt wat het scherm nodig heeft. */
  function gesprek(code, lidKey, dept, opties) {
    const o = opties || {};
    const c = codeVan(code);
    // Een oude import of herlezing herstelt nooit verwijderde deelnemers.
    const sleutel = 'gast:' + lijnSleutel(c, lidKey, dept);
    const g = comm.gesprekMetSleutel(sleutel) || comm.gesprekMaak({
      soort: 'order', deelnemers: [String(lidKey), zaakVan(c)], door: String(lidKey),
      titel: o.zaakNaam || null,
      meta: { sleutel, zaak: c,
        dept: dept || 'Team', bron: 'Zaak', codename: o.codename || null,
        /* De pas van het lid reist mee omdat de zaak-route er een melding op
           adresseert. Hij hoort bij de LIJN en niet bij een los record in een
           tweede voorraad -- anders is er weer een plek die dit weet. */
        tier: o.tier || null }
    });
    if (!comm.magErin(g, String(lidKey)) || !comm.magErin(g, zaakVan(c))) return g;
    if (o.codename && g.meta.codename !== o.codename) g.meta.codename = o.codename;
    if (o.tier && g.meta.tier !== o.tier) g.meta.tier = o.tier;
    return verhuizing.importeer(g, c, String(lidKey), dept);
  }

  /* De lijn OPZOEKEN zonder hem aan te leggen, en dat verschil is een
     beveiliging en geen netheid. Er hangt een controle aan ("een zaak mag de
     Salon van een lid alleen zien als er echt een open lijn is"), en die valt
     om zodra de vraag zelf de lijn aanlegt: dan bestaat elke lijn die je
     noemt. Een verzonnen sleutel was zo genoeg geweest om het profiel van elk
     lid op te vragen.

     Een lijn die alleen nog in de OUDE voorraad staat, telt wel als bestaand
     -- die is er immers echt; hij is alleen nog niet verhuisd. Een bestaande
     kernlijn blijft leidend, ook als een deelnemer inmiddels verwijderd is. */
  function bestaand(code, lidKey, dept) {
    const c = codeVan(code);
    const kernlijn = comm.gesprekMetSleutel('gast:' + lijnSleutel(c, lidKey, dept));
    if (kernlijn) {
      // Hervat een afgebroken import, maar nooit over een ingetrokken relatie.
      return comm.magErin(kernlijn, String(lidKey)) && comm.magErin(kernlijn, zaakVan(c))
        ? verhuizing.importeer(kernlijn, c, String(lidKey), dept) : kernlijn;
    }
    let oud = null;
    try { oud = (db.data.guestChats || {})[lijnSleutel(c, lidKey, dept)]; } catch (e) {}
    if (oud) return gesprek(c, lidKey, dept);
    return null;
  }

  return { codeVan, lijnSleutel, zaakVan, gesprek, bestaand };
}

module.exports = { maakGastLijn };

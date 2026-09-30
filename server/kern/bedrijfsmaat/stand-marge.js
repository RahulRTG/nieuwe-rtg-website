/* DE MARGE PER LID, per pas -- besluit C15 van de eigenaar (29 september 2026),
   de laatste schakel van de kostenketen (van verbruik naar unit economics).

   WAT HIER GEREKEND WORDT. Per pas: de afgesproken maandbijdrage van die pas
   (./../ledenregister/omzet.js: lijstprijs maal aantal, of de som van de lopende
   contracten) min wat de leden van die pas het huis die maand kostten (de
   kostenlaag, per drager), gedeeld door ALLE leden van die pas. Een lid dat niets
   gebruikte draagt bij en kost niets, en hoort dus in de noemer.

   WAAROM PER PAS. De pas reist met elke meting mee (kern/kosten/meter.js zet hem
   bij het meten, "laatst gezien wint"). Per cohort zou de kostenlaag de
   aanmeldweek van een sessiesleutel moeten opzoeken, en die laag kent met opzet
   geen identiteit.

   DRIE DINGEN DIE GEEN GETAL KRIJGEN, elk met de reden:
   - een eerdere maand: de bijdrage per pas is een stand van VANDAAG, en die voor
     een oude maand afzetten tegen de kosten van toen is een vergelijking die er
     niet is;
   - verbruik zonder tarief: dan zijn de kosten te laag, en een te lage kostprijs
     is een mooie marge die niet bestaat;
   - een contractuele pas met een lid zonder lopend contract: zijn bijdrage is niet
     bekend, en hem als nul tellen drukt de marge op een manier die niemand ziet.

   DE GROEPSPOORT staat hier, aan de bron: onder tien leden geen getal en geen
   aantal, met secundaire onderdrukking (./poort.js groepeer), want het totaal
   aantal leden staat elders en een enkele verborgen pas is anders terug te
   rekenen. Er is geen totaal over de passen: dat is marge.bruto-rtg. */
'use strict';

const { groepeer, KLASSEN } = require('./poort');
const { DEFINITIES } = require('./definities');
const { pasVan } = require('../passen');

module.exports = ({ m, peilmoment, maat, kosten, omzetPerPas }) => {
  const niet = (waarom, extra) => Object.assign({ stand: 'NIET_UIT_TE_REKENEN', waarde: null, waarom }, extra || {});
  const k = typeof kosten === 'function' ? kosten() : null;
  const dekt = ['De kosten per lid dragen de graad vermoed: stroom en serverhuur zijn verdeeld met een sleutel.',
    'De bijdrage is afgesproken (prijslijst en contracten), geen ontvangen geld.',
    'De pas bij de kosten is die bij de laatste meting van de maand; wie halverwege overstapte, telt met al zijn kosten bij zijn laatste pas.'];

  function margePerPas() {
    if (m !== peilmoment.slice(0, 7)) return niet('De bijdrage per pas is een stand van vandaag; voor een eerdere maand is die niet bewaard.');
    if (!k || typeof k.alleDragers !== 'function' || typeof omzetPerPas !== 'function')
      return niet('De kostenlaag of het ledenregister is niet beschikbaar.');
    const zonderTarief = (k.afstemming(m) || []).filter(r => r && r.gerekendCenten == null && Number(r.aantal) > 0).map(r => r.soort);
    if (zonderTarief.length) return niet('Verbruik zonder tarief (' + zonderTarief.join(', ') + '); de kosten zijn niet uit te rekenen.', { zonderTarief });

    /* De passen van de ladder (het ledenregister volgt kern/pasladder.js); een pas
       die de ladder kent blijft zichzelf, zodat een nieuwe trede niet stil bij
       RTG Pass belandt. Alleen wat de ladder niet kent, gaat langs kern/passen.js. */
    const rijen = omzetPerPas();
    if (!Array.isArray(rijen)) return niet('Het ledenregister telde niet alle leden; zonder volledige noemer geen marge per lid.');
    const bekend = new Set(rijen.map(o => o.pas));
    const kostenPas = {};
    let zonderPasCenten = 0;
    for (const r of k.alleDragers(m)) {
      if (k.ontleed(r.drager).soort !== 'lid') continue;
      const rij = k.kijk(m, r.drager);
      if (!rij || !rij.pas) { zonderPasCenten += r.centen; continue; }
      const p = rij.pas === 'guest' ? 'gratis' : bekend.has(rij.pas) ? rij.pas : pasVan(rij.pas);
      kostenPas[p] = (kostenPas[p] || 0) + r.centen;
    }
    const grens = KLASSEN.leden.grens;
    const perPas = groepeer(rijen.map(o => ({ pas: o.pas, pasNaam: o.pasNaam, aantal: o.aantal || 0, o })), { grens, benoemd: true })
      .map(({ pas, pasNaam, aantal, o, stand }) => {
        const basis = { pas, pasNaam };
        if (stand) return Object.assign(basis, { stand, waarde: null, grens });
        if (!aantal) return Object.assign(basis, niet('Er zijn geen leden op deze pas.'));
        if (o.opMaat && (o.maandOmzet == null || o.zonderContract > 0))
          return Object.assign(basis, niet('Er zijn leden op deze pas zonder lopend contract; hun bijdrage is niet bekend.'));
        const bijdrageCenten = Math.round(o.maandOmzet * 100), kostenCenten = kostenPas[pas] || 0;
        return Object.assign(basis, { stand: 'TOONBAAR', waarde: Math.round((bijdrageCenten - kostenCenten) / aantal),
          eenheid: 'eurocent per lid per maand', n: aantal, bijdrageCenten, kostenCenten });
      });
    if (zonderPasCenten) dekt.push('Kosten van leden zonder pas in de meting tellen bij geen enkele pas mee.');
    return { stand: 'PER_PAS', waarde: null, perPas };
  }

  return Object.assign(maat('marge.per-lid', DEFINITIES.margePerLid, margePerPas(), dekt), { graad: 'vermoed' });
};

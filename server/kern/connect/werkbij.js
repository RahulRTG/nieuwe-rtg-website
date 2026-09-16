/* ============================================================================
   WERK ERBIJ -- de eigen werken uit het vertrouwde register in het dossier.

   Twee van de vijf overdrachtstreden gaan over de maker zelf: `gemaakt` (er
   bestaat iets van jou) en `aangeboden` (jij hebt toegestaan dat een ander het
   kan ontvangen). Die twee komen niet van een ander mens, dus er is geen
   naklank die ze veroorzaakt -- ze staan al vast in kern/mediaos/werkherkomst.js
   op het moment dat een domein `nieuwWerk()` aanriep.

   DIT IS DUS GEEN NIEUWE WAARHEID MAAR EEN OVERNAME, en dat is precies de zin
   waar besluit 2 op rust: Connect mag auteurschap CONSUMEREN, niet uitvinden.
   Er wordt hier niets vastgesteld; er wordt gelezen wat het domein al beweerde
   en er wordt een dossierregel van gemaakt.

   WAAROM `nieuwWerk` ALLEBEI OPLEVERT. Die haak wordt aangeroepen op het moment
   dat er iets TE ZIEN is -- een uitgave, een video waarvan de bytes binnen zijn,
   een clip, live gaan. Hij WEKT ook volgers. Dat is dus tegelijk "het bestaat"
   en "een ander kan het ontvangen": `gemaakt` en `aangeboden` vallen hier samen,
   en dat is een eigenschap van deze bron en geen algemene regel. Een bron waar
   maken en aanbieden WEL uit elkaar lopen (een concept dat later wordt
   vrijgegeven) hoort de twee apart te melden; dat is waarom het twee treden
   zijn en niet een.

   HET IS EEN HANDELING EN GEEN LEZING, en daarom staat hij achter een eigen
   route en niet in `dossier()`. Zou het dossier bij het LEZEN bijwerken, dan
   schrijft een leesroute in db.data -- exact de fout die drie lezers van deze
   laag al een keer maakten, en die `test/connect.test.js` toets 16 sindsdien
   bewaakt. Een lezer die stiekem schrijft, is een lezer die je niet kunt
   vertrouwen.

   IDEMPOTENT OMDAT DE TREDEN HET ZIJN. `gemaakt` en `aangeboden` dragen allebei
   `eenmalig: true` en hun bron is het werk-id, dus twee keer bijwerken levert
   geen tweede regel op. Deze module hoeft dus niets te onthouden over wat hij
   al heeft gedaan -- en dat is beter dan een eigen "tot hier bijgewerkt"-stand,
   die kan verschuiven en dan stilletjes werken overslaat.
   ========================================================================== */
'use strict';

/* Hoeveel werken er per aanroep hoogstens worden opgehaald. Ruim boven wat een
   mens in een sessie maakt, en begrensd omdat dit register duizenden rijen kan
   dragen. */
const MAX = 50;

module.exports = ({ werkenVan, noteer }) => {
  /* Geeft terug wat er is BIJGEKOMEN en wat er al stond -- nooit alleen een
     aantal. Een aanroeper die "3" leest weet niet of er drie nieuwe werken
     waren of drie regels die al bestonden, en dat verschil is het hele punt
     van een eenmalige trede. */
  function werkBij(sleutel) {
    const key = String(sleutel || '');
    if (!key) return { ok: false, reden: 'Een dossier hangt aan een codenaam; die ontbreekt.' };
    if (typeof werkenVan !== 'function') {
      return { ok: true, nieuw: [], stond: [], geenBron: true,
        reden: 'Er is geen register van werken aangesloten, dus er valt niets over te nemen. ' +
          'Dat is een stand en geen storing: zonder kern/mediaos/werkherkomst.js weet dit huis ' +
          'niet van wie een stuk werk is.' };
    }
    let werken = [];
    try { werken = werkenVan(key, MAX) || []; } catch (e) { werken = []; }

    const nieuw = [], stond = [];
    for (const w of werken) {
      if (!w || !w.id || !w.soort) continue;
      /* De bron is het WERK-ID en niet de titel: een maker die zijn werk
         hernoemt, hoort er geen tweede regel bij te krijgen. */
      const bron = 'mediaos:' + w.id;
      for (const trede of ['gemaakt', 'aangeboden']) {
        const r = noteer(key, { trede, onderwerp: w.soort, bron, door: 'hetSysteem',
          werkwoord: trede === 'gemaakt' ? 'maak' : 'deel', herkomst: 'mediaos' });
        if (!r || !r.ok) continue;
        (r.nieuw ? nieuw : stond).push({ trede, werk: w.id, titel: w.titel || null });
      }
    }
    return { ok: true, nieuw, stond,
      uitleg: 'Overgenomen uit het register waar uw eigen domeinen uw werk hebben aangemeld. Er wordt hier ' +
        'niets vastgesteld: wat hier staat, stond daar al. Dat iemand het heeft GEZIEN of ERMEE heeft ' +
        'gewerkt, komt niet hiervandaan -- dat moet een ander mens doen.' };
  }

  return { werkBij, MAX };
};

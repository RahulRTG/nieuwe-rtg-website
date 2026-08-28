/* ============================================================================
   DE TOEGANKELIJKHEIDSPOORT -- besloten op 27 augustus 2026: hij blokkeert.

   HET BESLUIT. De eigenaar heeft gekozen dat de toegankelijkheidskeuring vanaf
   nu alles tegenhoudt, ook een update van een app die vandaag live is. De prijs
   is bekend en aanvaard: een bestaande app kan zonder aanpassing geen nieuwe
   versie meer publiceren.

   WAAR DE POORT STAAT, EN WAAROM DAAR. Niet bij het inzenden. `keur()` is
   synchroon en heeft geen browser, terwijl deze keuring de app juist RENDERT --
   in de cel, met dezelfde CSP, op telefoonformaat. De poort staat daarom bij het
   BESLUIT: inzenden mag altijd, publiceren niet zolang de keuring niet is
   gedraaid en geslaagd.

   Dat is bovendien waar hij hoort. Twee bestaande grenzen zeggen het al:

     - de machine keurt nooit goed (APPSTORE.md grens 2). Deze uitslag laat een
       versie dus niet DOOR, hij houdt hem alleen TEGEN. Een mens tekent nog
       steeds af.
     - een ingediend stuk is geen bewijs (CLAUDE.md). De uitgever levert geen
       uitslag aan; RTG draait de keuring op de bundel die er ligt.

   DRIE STANDEN, EN 'NIET VAST TE STELLEN' IS GEEN JA. Precies dezelfde regel als
   de virusscanner in de machinepoort: draait de keuring niet -- geen browser,
   een bundel die niet opent -- dan gaat de poort dicht en niet open.

   DE UITSLAG HANGT AAN DE BYTES. Een uitslag geldt voor EEN bundelhash. Zendt de
   uitgever een nieuwe bundel in, dan is er geen uitslag meer, ook al heette het
   dezelfde app. Zou de uitslag aan de app hangen, dan keurt de eerste versie de
   volgende goed -- en dat is precies het gat waar zo'n poort doorheen lekt.
   ========================================================================== */
'use strict';

const STANDEN = ['in-orde', 'blokkeert', 'niet-vast-te-stellen'];

/* De uitleg per stand, in de woorden die een uitgever te lezen krijgt. Ze staan
   hier en niet in de route, zodat het kantoorscherm en de foutmelding hetzelfde
   zeggen. */
const UITLEG = {
  'in-orde': 'De toegankelijkheidskeuring is gedraaid en vond geen structurele fouten of contrastfouten.',
  'blokkeert': 'De toegankelijkheidskeuring vond fouten die een mens met een schermlezer of met weinig zicht tegenhouden.',
  'niet-vast-te-stellen': 'De keuring kon niet draaien. Dat is geen goedkeuring: zolang niemand het heeft gemeten, gaat deze versie niet live.'
};

function maakToegankelijk({ S, save, nu, versie, boek }) {
  /* De uitslag wordt op de VERSIE bewaard en niet in een eigen kast: hij hoort
     bij die bundel en bij niets anders, en dan hoeft niemand twee dingen bij
     elkaar te zoeken. */
  function noteer({ versieId, stand, fouten, bevindingen, door }) {
    const v = versie(versieId);
    if (!v) return { status: 404, error: 'Deze inzending bestaat niet.' };
    if (!STANDEN.includes(stand)) {
      return { status: 400, error: 'Een uitslag is er een van: ' + STANDEN.join(', ') + '.' };
    }
    const wie = String(door || '').trim().slice(0, 80);
    if (!wie) return { status: 400, error: 'Zet erbij wie de keuring heeft gedraaid.' };

    v.toegankelijk = {
      stand,
      hash: v.hash,                       // aan de BYTES, niet aan de app
      fouten: Math.max(0, Math.min(9999, Number(fouten) || 0)),
      /* Hooguit twintig bevindingen mee. Genoeg om te repareren, en de bundel
         zelf blijft de plek waar alles staat -- een versie is geen logboek. */
      bevindingen: (Array.isArray(bevindingen) ? bevindingen : []).slice(0, 20).map(b => ({
        ernst: String(b && b.ernst || 'fout').slice(0, 20),
        bestand: String(b && b.bestand || '').slice(0, 120),
        wat: String(b && b.wat || '').slice(0, 300),
        hoe: String(b && b.hoe || '').slice(0, 400)
      })),
      door: wie,
      at: nu()
    };
    if (boek) boek('toegankelijkheid-' + stand, v.sleutel, wie, { versie: v.manifest.versie, hash: v.hash, fouten: v.toegankelijk.fouten });
    save();
    return { status: 200, ok: true, toegankelijk: v.toegankelijk };
  }

  /* De poort zelf. Geeft `null` als er niets in de weg staat, en anders precies
     de melding die de mens van RTG te zien krijgt -- met wat hij eraan kan doen,
     want een weigering zonder weg vooruit is een muur. */
  function belet(v) {
    const t = v && v.toegankelijk;
    if (!t || t.hash !== v.hash) {
      return { status: 409,
        error: 'De toegankelijkheidskeuring is nog niet over deze bundel gedraaid. Publiceren kan pas daarna.',
        toegankelijk: null,
        hoe: 'Draai de keurloper over de wachtrij (scripts/appstore-a11y.js); die rendert de bundel in de cel en noteert de uitslag.' };
    }
    if (t.stand === 'in-orde') return null;
    return { status: 409,
      error: t.stand === 'blokkeert'
        ? 'Deze versie houdt ' + t.fouten + ' toegankelijkheidsfout(en) vast; die gaan niet live.'
        : UITLEG['niet-vast-te-stellen'],
      toegankelijk: t,
      hoe: t.stand === 'blokkeert'
        ? 'De bevindingen staan bij de versie, met per stuk hoe het wel kan. De uitgever lost ze op en zendt een nieuwe versie in.'
        : 'Draai de keuring opnieuw op een machine met een browser.' };
  }

  /* Wat er nog gekeurd moet worden. De keurloper vraagt dit op; alles wat wacht
     op een mens en nog geen uitslag voor ZIJN EIGEN hash heeft. */
  function wachtOpKeuring() {
    return Object.values(S().versies)
      .filter(v => v.status === 'wacht-op-mens')
      .filter(v => !v.toegankelijk || v.toegankelijk.hash !== v.hash)
      .map(v => ({ id: v.id, sleutel: v.sleutel, hash: v.hash, versie: v.manifest.versie, start: v.manifest.start }));
  }

  return { noteer, belet, wachtOpKeuring, STANDEN, UITLEG };
}

module.exports = { maakToegankelijk, STANDEN, UITLEG };

/* Het toegankelijkheidsprofiel: hoe het scherm zich hoort te gedragen.

   Dit is met opzet klein. Er staan vier instellingen in, en dat zijn precies de
   vier die een GEDEELDE laag ook echt kan waarmaken: ze werken op elke pagina
   die shared/basis.js laadt, zonder dat een app er iets voor hoeft te doen.

   Wat hier NIET in staat is even belangrijk. Eenvoudige taal, een taak per
   scherm, schermlezer-teksten, spraakbesturing: dat zijn stuk voor stuk dingen
   die per pagina gemaakt moeten worden. Ze als schakelaar aanbieden zou een
   belofte zijn die de code niet waarmaakt, en dat is precies de fout die
   LAT.md regel 6 beschrijft. Ze komen erbij als ze gebouwd zijn, niet eerder.

   Het profiel hoort bij het lid en gaat NOOIT mee naar een partner: dat iemand
   groot contrast nodig heeft is iets over hem, niet iets wat een zaak moet
   weten. Opslag hangt daarom aan de memberState van het account (dezelfde bak
   als de rest van "wie ben ik"), en niet aan een bestelling of een boeking. */

/* De keuzes zijn hier de enige waarheid. Het scherm rendert ze uit deze lijst,
   dus een optie erbij is een regel hier en niet ook nog een knop daar. */
const KEUZES = {
  tekst: {
    label: 'Tekstgrootte',
    uitleg: 'Alle tekst schaalt mee, op elk scherm van RTG.',
    opties: [
      { id: 'normaal', naam: 'Normaal' },
      { id: 'groot', naam: 'Groot', uitleg: 'Ongeveer een vijfde groter.' },
      { id: 'groter', naam: 'Nog groter', uitleg: 'Ruim een derde groter.' }
    ]
  },
  contrast: {
    label: 'Contrast',
    uitleg: 'Meer verschil tussen tekst en achtergrond, en duidelijker lijnen.',
    opties: [
      { id: 'normaal', naam: 'Normaal' },
      { id: 'hoog', naam: 'Hoog contrast' }
    ]
  },
  beweging: {
    label: 'Beweging',
    uitleg: 'Zet u dit uit, dan staat alles er meteen in plaats van dat het aan komt glijden.',
    opties: [
      { id: 'normaal', naam: 'Normaal' },
      { id: 'stil', naam: 'Zo min mogelijk' }
    ]
  },
  links: {
    label: 'Links',
    uitleg: 'Links krijgen een streep, zodat kleur niet het enige verschil is.',
    opties: [
      { id: 'normaal', naam: 'Zoals het huis ze zet' },
      { id: 'streep', naam: 'Altijd onderstreept' }
    ]
  }
};

const STANDAARD = { tekst: 'normaal', contrast: 'normaal', beweging: 'normaal', links: 'normaal' };

/* Een onbekende waarde valt terug op de standaard en wordt niet stil bewaard:
   wie een veld meestuurt dat niet bestaat, krijgt zijn oude waarde terug en
   geen halve instelling die nergens op slaat. */
function schoonProfiel(inGaand) {
  const uit = {};
  for (const veld of Object.keys(STANDAARD)) {
    const gewenst = String((inGaand || {})[veld] || '');
    const kent = KEUZES[veld].opties.some(o => o.id === gewenst);
    uit[veld] = kent ? gewenst : STANDAARD[veld];
  }
  return uit;
}

/* Staat er iets anders dan de standaard? Het scherm gebruikt dit om te zeggen
   of er iets aan staat, zonder de hele vergelijking na te bouwen. */
const wijktAf = p => Object.keys(STANDAARD).some(v => p[v] !== STANDAARD[v]);

module.exports = ({ accounts }) => {
  function toegankelijkVan(userId) {
    const md = accounts.getMemberState(userId) || {};
    return schoonProfiel(md.toegankelijk);
  }
  function toegankelijkZet(userId, body) {
    const md = accounts.getMemberState(userId) || {};
    // een bestaande instelling blijft staan als hij niet wordt meegestuurd
    const profiel = schoonProfiel({ ...schoonProfiel(md.toegankelijk), ...(body || {}) });
    md.toegankelijk = profiel;
    accounts.saveMemberState(userId, md);
    return { ok: true, toegankelijk: profiel, staatAan: wijktAf(profiel) };
  }
  return { toegankelijkVan, toegankelijkZet, TOEGANKELIJK_KEUZES: KEUZES };
};

module.exports.KEUZES = KEUZES;
module.exports.STANDAARD = STANDAARD;
module.exports.schoonProfiel = schoonProfiel;

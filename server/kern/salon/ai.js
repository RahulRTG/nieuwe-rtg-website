/* De AI in De Salon. Drie taken, en alle drie volgen dezelfde regel als in de
   Berichten-app: de AI STELT VOOR, de mens plaatst.

   1. bijschrift  -- je geeft steekwoorden, je krijgt een bijschrift terug in je
      invoerveld. Er wordt niets geplaatst.
   2. reactiesSamen -- staan er tachtig reacties onder je post, dan lees je in
      vijf zinnen waar het over gaat en of er iets is waar je op moet reageren.
   3. waarOverGaatHet -- welke onderwerpen leven er vandaag in De Salon, in
      gewone taal. Dit is de ONTDEK-kant, en met opzet niet "voor jou": het kijkt
      naar wat er gedeeld wordt, niet naar wat jou het langst vasthoudt.

   Wat hier bewust NIET zit: een motor die de feed rangschikt op wat jou
   vasthoudt. Dat is precies het patroon dat de huisregels verbieden. */
const { tekst } = require('../../ai');
const { reactiesSamenvatting } = require('../../lib/lokale-taal');

const TOON = 'Je bent Rahul, de assistent van Rahul Travel Group. Schrijf rustig, ' +
  'zeker en zonder opsmuk. Nooit uitroeptekens, geen overdrijving, geen verkooppraat. ' +
  'Antwoord in het Nederlands.';
const geenAI = { ok: false, status: 503, reden: 'De AI is nu niet bereikbaar. Probeer het zo nog eens.' };

module.exports = ({ anthropic, salon }) => {

  /* Een bijschrift bij wat je wilt delen. Komt terug als tekst; jij plaatst.
     De opdracht zegt expliciet "geen hashtag-regen": de onderwerpen zijn er om
     iets terug te vinden, niet om bereik te kopen. */
  async function bijschrift(steekwoorden, plaats) {
    const w = String(steekwoorden || '').slice(0, 300).trim();
    if (!w) return { ok: false, reden: 'Geef me eerst een paar woorden om mee te werken.' };
    const t = await tekst(anthropic, TOON + ' Schrijf EEN bijschrift voor een bericht in De Salon, ' +
      'hooguit drie zinnen. Alleen de tekst zelf. Je mag hooguit twee onderwerpen met een hekje ' +
      'toevoegen als ze echt passen; nooit een rij hashtags.',
    w + (plaats ? '\nPlaats: ' + String(plaats).slice(0, 60) : ''), { max: 250 });
    return t ? { ok: true, bijschrift: t } : geenAI;
  }

  /* Vat de reacties onder een post samen. Alleen op je EIGEN post: de reacties
     van een ander samenvatten is zijn gesprek, niet het jouwe. */
  async function reactiesSamen(sess, postId) {
    const p = salon.postMet(postId);
    if (!p) return { ok: false, reden: 'Deze post bestaat niet.' };
    if (p.authorKey !== sess.key) return { ok: false, status: 403, reden: 'Dit kan alleen op je eigen post.' };
    const regels = (p.comments || []).slice(-120).map(c => c.who + ': ' + String(c.text || ''));
    return { ok: true, aantal: regels.length, samenvatting: reactiesSamenvatting(regels),
      bron: 'lokale-taal', ai: false };
  }

  /* Waar gaat De Salon vandaag over? De tellingen komen uit de eigen module
     (geen AI nodig om te tellen); de AI zet er een leesbare zin omheen. Zo
     blijft het cijfer waar en de tekst prettig. */
  async function waarOverGaatHet() {
    const lijst = salon.onderwerpen(12);
    if (!lijst.length) return { ok: true, onderwerpen: [], tekst: 'Er is vandaag nog weinig gedeeld.',
      bron: 'lokale-regels', ai: false };
    const top = lijst.slice(0, 3);
    const namen = top.map(o => o.naam);
    const opsomming = namen.length === 1 ? namen[0] : namen.slice(0, -1).join(', ') + ' en ' + namen[namen.length - 1];
    const tekstVandaag = 'Vandaag gaat het in De Salon vooral over ' + opsomming + '. ' +
      'Daarover zijn samen ' + top.reduce((n, o) => n + o.aantal, 0) + ' bijdragen gedeeld.';
    return { ok: true, onderwerpen: lijst, tekst: tekstVandaag, bron: 'lokale-regels', ai: false };
  }

  return { bijschrift, reactiesSamen, waarOverGaatHet };
};

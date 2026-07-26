/* Genootschap (deelmodule): Rahul in de groep. Drie taken, en alle drie volgen
   de regel van de vorige rondes: hij stelt voor, de mens plaatst.

   1. aankondiging -- je geeft een paar woorden, je krijgt een nette aankondiging
      terug in je invoerveld. Er wordt niets op het prikbord gezet.
   2. prikbordSamen -- vijftig berichten terug in vijf zinnen: waar gaat het over,
      en is er iets waar de beheerder op moet reageren.
   3. datumRaad -- de nuttigste van de drie. Rahul kijkt naar de ANTWOORDEN op de
      aanstaande bijeenkomsten van dit genootschap en zegt welke dag de meeste
      leden past. Hij verzint geen agenda's van mensen: hij rekent met wat de
      leden zelf hebben geantwoord.

   Wat hij hier NOOIT doet: iemand uitnodigen, iemand eruit zetten, of een
   bijeenkomst plaatsen. Dat zijn handelingen tussen mensen; de AI schrijft
   hoogstens de woorden. */
const { tekst } = require('../../ai');

const TOON = 'Je bent Rahul, de assistent van Rahul Travel Group. Je helpt bij een besloten ' +
  'genootschap van leden. Schrijf rustig, zeker en zonder opsmuk: geen uitroeptekens, geen ' +
  'overdrijving, geen verkooppraat. Antwoord in het Nederlands. Verzin nooit feiten, namen of ' +
  'afspraken die niet in de aangeleverde gegevens staan.';
const geenAI = { ok: false, reden: 'De AI is nu niet bereikbaar. Probeer het zo nog eens.' };

module.exports = ({ anthropic, genootschap, prikbord, bijeenkomst }) => {

  async function aankondiging(sess, groepId, steekwoorden) {
    const gr = genootschap.groepMet(groepId);
    if (!gr || !genootschap.isLid(gr, sess.key)) return { ok: false, reden: 'Je bent hier geen lid van.' };
    const w = String(steekwoorden || '').slice(0, 300).trim();
    if (!w) return { ok: false, reden: 'Geef me eerst een paar woorden om mee te werken.' };
    const t = await tekst(anthropic, TOON + ' Schrijf EEN aankondiging voor het prikbord, hooguit vier zinnen. ' +
      'Alleen de tekst zelf, zonder aanhef of ondertekening.',
    'Het genootschap heet: ' + gr.naam + (gr.over ? '\nWaar het over gaat: ' + gr.over : '') +
    '\n\nDe steekwoorden van het lid: ' + w, { max: 300 });
    return t ? { ok: true, aankondiging: t } : geenAI;
  }

  async function prikbordSamen(sess, groepId) {
    const gr = genootschap.groepMet(groepId);
    if (!gr || !genootschap.isLid(gr, sess.key)) return { ok: false, reden: 'Je bent hier geen lid van.' };
    const regels = prikbord.regels(groepId, 60);
    if (!regels.length) return { ok: true, samenvatting: 'Er staat nog niets op het prikbord.' };
    const t = await tekst(anthropic, TOON + ' Vat het prikbord samen in maximaal vijf korte zinnen: ' +
      'waar gaat het over, welke vragen liggen er open, en is er iets waar iemand op zou moeten ' +
      'reageren. Noem geen namen die er niet staan.', regels.join('\n'), { max: 400 });
    return t ? { ok: true, aantal: regels.length, samenvatting: t } : geenAI;
  }

  /* Welke dag past de meesten? De REKENSOM doet deze module zelf -- een AI die
     moet tellen gaat fouten maken, en dit zijn de antwoorden van echte mensen.
     De AI zet er alleen een leesbare zin omheen. Zonder AI blijft het cijfer
     staan, en dat is het antwoord ook. */
  async function datumRaad(sess, groepId) {
    const gr = genootschap.groepMet(groepId);
    if (!gr || !genootschap.isLid(gr, sess.key)) return { ok: false, reden: 'Je bent hier geen lid van.' };
    const a = bijeenkomst.agenda(sess, groepId);
    if (a.error) return { ok: false, reden: a.error };
    const leden = (gr.leden || []).length;
    const gemeten = (a.komt || []).map(b => ({
      datum: b.datum, tijd: b.tijd, wat: b.wat,
      ja: b.ja, misschien: b.misschien, nee: b.nee,
      stil: Math.max(0, leden - (b.ja + b.misschien + b.nee))
    })).sort((x, y) => (y.ja - x.ja) || (y.misschien - x.misschien) || x.datum.localeCompare(y.datum));

    if (!gemeten.length) return { ok: true, meting: [], tekst: 'Er staat nog niets in de agenda van dit genootschap.' };
    const beste = gemeten[0];
    const t = await tekst(anthropic, TOON + ' Zeg in twee zinnen welke bijeenkomst de meeste leden schikt ' +
      'en wat de gastheer daaraan kan doen. Reken niet zelf; gebruik de getallen zoals ze er staan.',
    'Het genootschap heeft ' + leden + ' leden.\n' + gemeten.map(g =>
      g.datum + (g.tijd ? ' ' + g.tijd : '') + ' - ' + g.wat + ': ja ' + g.ja + ', misschien ' + g.misschien +
      ', nee ' + g.nee + ', nog niet geantwoord ' + g.stil).join('\n'), { max: 250 });
    return { ok: true, meting: gemeten, beste: beste.datum, tekst: t || null };
  }

  return { aankondiging, prikbordSamen, datumRaad };
};

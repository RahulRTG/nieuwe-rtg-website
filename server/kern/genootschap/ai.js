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
const { tekst } = require('../../ai-kort');
const { samenvat: lokaalSamenvatten } = require('../../lib/lokale-taal');

const TOON = 'Je bent Rahul, de assistent van Rahul Travel Group. Je helpt bij een besloten ' +
  'genootschap van leden. Schrijf rustig, zeker en zonder opsmuk: geen uitroeptekens, geen ' +
  'overdrijving, geen verkooppraat. Antwoord in het Nederlands. Verzin nooit feiten, namen of ' +
  'afspraken die niet in de aangeleverde gegevens staan.';
const geenAI = { ok: false, status: 503, reden: 'De AI is nu niet bereikbaar. Probeer het zo nog eens.' };

module.exports = ({ anthropic, genootschap, prikbord, bijeenkomst }) => {

  async function aankondiging(sess, groepId, steekwoorden) {
    const gr = genootschap.groepMet(groepId);
    if (!gr || !genootschap.isLid(gr, sess.key)) return { ok: false, status: 403, reden: 'Je bent hier geen lid van.' };
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
    if (!gr || !genootschap.isLid(gr, sess.key)) return { ok: false, status: 403, reden: 'Je bent hier geen lid van.' };
    const regels = prikbord.regels(groepId, 60);
    const t = regels.length
      ? lokaalSamenvatten(regels.join('\n'), { maxZinnen: 5, maxTekens: 900 })
      : 'Er staat nog niets op het prikbord.';
    return { ok: true, aantal: regels.length, samenvatting: t, bron: 'lokale-taal', ai: false };
  }

  /* Welke dag past de meesten? Zowel de rekensom als de feitelijke formulering
     blijft lokaal: een model maakt tellen niet betrouwbaarder. */
  async function datumRaad(sess, groepId) {
    const gr = genootschap.groepMet(groepId);
    if (!gr || !genootschap.isLid(gr, sess.key)) return { ok: false, status: 403, reden: 'Je bent hier geen lid van.' };
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
    const moment = beste.datum + (beste.tijd ? ' om ' + beste.tijd : '');
    const t = moment + ' past op dit moment de meeste leden: ' + beste.ja + ' ja, ' +
      beste.misschien + ' misschien en ' + beste.nee + ' nee. ' +
      (beste.stil ? beste.stil + ' ' + (beste.stil === 1 ? 'lid heeft' : 'leden hebben') + ' nog niet geantwoord.' :
        'Iedereen heeft geantwoord.');
    return { ok: true, meting: gemeten, beste: beste.datum, tekst: t,
      bron: 'lokale-regels', ai: false };
  }

  return { aankondiging, prikbordSamen, datumRaad };
};

/* De persoonlijke AI-laag: de systeemprompt per pas (de AI heet Rahul, de enige
   AI-hulp in het hele systeem), demo-antwoorden zonder API-sleutel, het echte
   Claude-antwoord, en de doorlopende conversatie in de app. RTG wordt door de AI
   beantwoord; Lifestyle en Business gaan naar de menselijke concierge.

   AI_TONE is pure data; de rest draagt state (db, accounts, de Claude-client en
   de realtime-helpers) en komt uit maakAi(state). De interne kanaalsleutel van
   Rahul's berichten is 'rahul' (dataplumbing, niet zichtbaar voor het lid). */

// Het register verschilt per pas; het karakter van Rahul (zie aiSystemPrompt)
// blijft altijd hetzelfde.
const AI_TONE = {
  rtg: 'Register: ingetogen "old money", rustig en zeker. Je tutoyeert het lid (je/jij-vorm).',
  lifestyle: 'Register: warm, voorkomend en persoonlijk, naast de menselijke concierge. U-vorm.',
  business: 'Register: kort, precies en uitvoerend. U-vorm, geen overbodige woorden.'
};

const { naamEn } = require('../talen');
const { dagContext } = require('./context');

function maakAi({ db, PERSONAS, anthropic, accounts, broadcastSync, sseToOffice, i18n }) {
  /* De promptlaag (system prompt + demo-antwoorden) draait als submodule
     op een gedeelde context, een keer opgebouwd bij het opstarten. */
  const ctx = { db, PERSONAS, anthropic, accounts, broadcastSync, sseToOffice, i18n,
    AI_TONE, naamEn, dagContext };
  const { aiSystemPrompt, cannedAnswer } = require('./ai/prompt')(ctx);

  /* Geeft { text, lang }: met AI antwoordt Rahul direct in de taal van het
     lid; zonder AI proberen we het demo-antwoord te vertalen en anders blijft
     het Nederlands, eerlijk gelabeld met de echte taal van de tekst. */
  async function generateAiReply(tier, convo, lang, key) {
    lang = lang || 'nl';
    const history = convo
      .filter(m => m.from === 'member' || m.from === 'rahul')
      .map(m => ({ role: m.from === 'member' ? 'user' : 'assistant', content: String(m.text).slice(0, 2000) }))
      .slice(-12);
    while (history.length && history[0].role !== 'user') history.shift();
    const last = history.length ? history[history.length - 1].content : '';
    if (anthropic && history.length && history[history.length - 1].role === 'user') {
      try {
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 1024, system: aiSystemPrompt(tier, lang, key), messages: history });
        const reply = r.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
        if (reply) return { text: reply, lang };
      } catch (e) { console.error('Claude-fout (rahul):', e.message); }
    }
    const canned = cannedAnswer(last);
    if (lang !== 'nl' && i18n) {
      try {
        const t = await i18n.translate(canned, lang, 'nl');
        if (t && t.translated) return { text: t.text, lang };
      } catch (e) { /* val terug op Nederlands */ }
    }
    return { text: canned, lang: 'nl' };
  }

  function convOf(userId) { const md = accounts.getMemberState(userId) || {}; return md.conversation || []; }

  async function memberSays(user, text, channel, lang) {
    const md = accounts.getMemberState(user.id) || {};
    md.conversation = md.conversation || [];
    md.conversation.push({ from: 'member', text: String(text).slice(0, 1000), lang: lang || 'nl', at: new Date().toISOString(), channel });
    if (user.tier === 'rtg') {
      // Rahul (AI) antwoordt meteen, in de taal van het lid.
      const reply = await generateAiReply(user.tier, md.conversation, lang, 'user-' + user.id);
      md.conversation.push({ from: 'rahul', text: reply.text, lang: reply.lang, at: new Date().toISOString(), channel: 'rahul' });
      md.needsConcierge = false;
    } else {
      // Lifestyle/Business: een mens (concierge) reageert via de backoffice.
      md.needsConcierge = true;
    }
    md.conversation = md.conversation.slice(-120);
    accounts.saveMemberState(user.id, md);
    broadcastSync([user.tier], 'chat');
    if (user.tier !== 'rtg') sseToOffice('sync', { scope: 'concierge' });
  }

  /* Backoffice: concierge-inbox voor Lifestyle/Business-leden. */
  function conciergeInbox() {
    return accounts.conversations()
      .filter(c => c.tier === 'lifestyle' || c.tier === 'business')
      .map(c => {
        const last = c.conversation[c.conversation.length - 1] || {};
        return { userId: c.id, codename: c.codename, tier: c.tier, needsConcierge: c.needsConcierge,
          last: last.text || '', lastAt: last.at || null, lastFrom: last.from || '', messages: c.conversation };
      })
      .sort((a, b) => (b.needsConcierge - a.needsConcierge) || (new Date(b.lastAt) - new Date(a.lastAt)));
  }

  return { aiSystemPrompt, cannedAnswer, generateAiReply, convOf, memberSays, conciergeInbox };
}
module.exports = { AI_TONE, maakAi };

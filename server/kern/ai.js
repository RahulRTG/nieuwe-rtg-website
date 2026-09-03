/* De persoonlijke AI-laag: de systeemprompt per pas (de AI heet Rahul, de enige
   AI-hulp in het hele systeem), regelantwoorden zonder API-sleutel, het echte
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
// Geen AI-taal: de schrobber gaat over alles wat Rahul zegt, ook over de vaste
// regelantwoorden (die komen niet langs een model, dus een prompt helpt daar niet).
const { schrob } = require('./rahul/taal');
const router = require('./ai/router');
/* De overnameregel woont in de servicelaag en niet hier: welke pas een mens
   kent, is geen eigenschap van de AI. Pure module, geen state -- zie
   kern/service/mens.js. */
const mensLaag = require('./service/mens');

function maakAi({ db, PERSONAS, anthropic, accounts, broadcastSync, sseToOffice, i18n, ledenInhoudVan, stemmingVoor, geloofRegel }) {
  /* DE HAAK NAAR RTG SERVICE, LAAT GEBONDEN. maakAi() draait in server.js
     ruim voordat kern/service in kernlaag7 wordt opgehangen, dus de laag kan
     hier niet gewoon worden meegegeven. Zelfde vorm als zetRtgai elders: een
     zetter, en een eerlijke tak voor het geval hij nooit wordt aangeroepen. */
  let overdracht = null;
  const zetServiceOverdracht = (fn) => { overdracht = typeof fn === 'function' ? fn : null; };
  /* De promptlaag (system prompt + regelantwoorden) draait als submodule
     op een gedeelde context, een keer opgebouwd bij het opstarten. */
  const ctx = { db, PERSONAS, anthropic, accounts, broadcastSync, sseToOffice, i18n, ledenInhoudVan,
    AI_TONE, naamEn, dagContext, stemmingVoor, geloofRegel };
  const { aiSystemPrompt, cannedAnswer } = require('./ai/prompt')(ctx);

  /* Geeft { text, lang }: met AI antwoordt Rahul direct in de taal van het
     lid; zonder AI proberen we het regelantwoord te vertalen en anders blijft
     het Nederlands, eerlijk gelabeld met de echte taal van de tekst. */
  async function generateAiReply(tier, convo, lang, key) {
    lang = lang || 'nl';
    const history = convo
      .filter(m => m.from === 'member' || m.from === 'rahul')
      .map(m => ({ role: m.from === 'member' ? 'user' : 'assistant', content: String(m.text).slice(0, 2000) }))
      .slice(-12);
    while (history.length && history[0].role !== 'user') history.shift();
    const last = history.length ? history[history.length - 1].content : '';

    /* DE INTELLIGENTIEROUTER, IN DE SCHADUW (EXECUTIE.md blok 8). Hij zegt welke
       techniek bij deze vraag hoort -- een regel, een algoritme, een voorspeller
       of toch een model -- en hij BESLIST NIETS: de aanroep hieronder gaat
       gewoon door. Eerst meten hoe vaak een goedkopere techniek het gedekt zou
       hebben; pas met dat getal is het omdraaien van de volgorde een besluit in
       plaats van een gok. De keuze reist mee met het antwoord, zodat achteraf
       narekenbaar is waarom er een model aan te pas kwam. */
    const keuze = router.schaduw(last);

    if (anthropic && history.length && history[history.length - 1].role === 'user') {
      try {
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 1024, system: aiSystemPrompt(tier, lang, key), messages: history });
        const reply = r.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
        if (reply) return { text: schrob(reply), lang, techniek: 'ai', waarom: keuze.reden, schaduw: keuze.techniek };
      } catch (e) { console.error('Claude-fout (rahul):', e.message); }
    }
    // de eigen reis van het lid mee: zonder reis noemt Rahul geen bestemming
    const eigenReis = (ledenInhoudVan ? (ledenInhoudVan(key) || {}) : {}).trip || null;
    const canned = schrob(cannedAnswer(last, tier, eigenReis));
    if (lang !== 'nl' && i18n) {
      try {
        const t = await i18n.translate(canned, lang, 'nl');
        if (t && t.translated) return { text: t.text, lang, techniek: 'regels', waarom: keuze.reden, schaduw: keuze.techniek };
      } catch (e) { /* val terug op Nederlands */ }
    }
    return { text: canned, lang: 'nl', techniek: 'regels', waarom: keuze.reden, schaduw: keuze.techniek };
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

      /* HIER STOND `md.needsConcierge = false;` EN VERDER NIETS.

         Dat was geen bug maar de merkregel, eerlijk uitgevoerd: de RTG Pass
         krijgt De Rechterhand niet. Het GEVOLG was wel een gebrek -- een
         RTG-lid dat in de chat om een mens vroeg, kwam nergens uit. Er was een
         mens voor hem (de ledenbalie helpt elk lid), en de melder was de enige
         die niet bij hem kon.

         De regel blijft dus staan, met de betekenis die hij hoorde te hebben:
         geen CONCIERGE. Dat is iets anders dan geen mens. Vraagt het lid om
         een mens, dan gaat dat verzoek naar RTG Service, dat er een zaak van
         maakt en hem bij het team Leden neerlegt. De concierge-inbox blijft
         onaangeroerd -- die is en blijft van Lifestyle en Business.

         WAAROM DE ANDERS-TAK LUID IS. Zonder haak zou dit stilletjes terugvallen
         op precies het gedrag dat hersteld moest worden, en niemand zou het
         merken. Een lid dat om een mens vraagt en niets hoort, is de duurste
         stille breuk die deze laag kan hebben (LAT.md regel 5). */
      md.needsConcierge = false;
      if (mensLaag.vraagtOmMens(text)) {
        if (overdracht) {
          try { overdracht(user, String(text).slice(0, 500)); }
          catch (e) { console.error('[ai] overdracht naar service', e && e.message); }
        } else {
          console.error('[ai] een lid vroeg om een mens, maar RTG Service is niet aangesloten ' +
            '(zetServiceOverdracht is nooit aangeroepen). Het verzoek is NIET doorgezet.');
        }
      }
    } else {
      // Lifestyle/Business: een mens (concierge) reageert via de backoffice.
      md.needsConcierge = true;
    }
    md.conversation = md.conversation.slice(-120);
    accounts.saveMemberState(user.id, md);
    broadcastSync([user.tier], 'chat');
    if (user.tier !== 'rtg') sseToOffice('sync', { scope: 'concierge' });
  }

  /* Een uitwisseling die AL heeft plaatsgevonden vastleggen in het gesprek.
     Nodig omdat de assistent (/api/fluister) buiten deze chat om antwoordt: zonder
     dit zou de balk in het OS een ander gesprek tonen dan de chat in de app, en
     zou je geschiedenis half zijn.

     Twee dingen die dit met opzet NIET doet:
     - geen tweede antwoord genereren (memberSays doet dat; hier is het antwoord
       er al, en nog een beurt erbij zou een dubbel gesprek opleveren);
     - niets aanraken van needsConcierge, en alleen voor de RTG Pass schrijven.
       Bij Lifestyle en Business is de chat de lijn naar een MENS. Zou de AI daar
       beurten in het draadje zetten, dan leest de concierge straks antwoorden
       die zij niet gaf, en lijkt het alsof de AI in haar naam heeft gesproken.
       Dat is precies de grens die niet mag verschuiven. */
  function noteerBeurt(user, vraag, antwoord, lang) {
    if (!user || user.tier !== 'rtg') return false;
    const v = String(vraag || '').trim(), a = String(antwoord || '').trim();
    if (!v || !a) return false;
    const md = accounts.getMemberState(user.id) || {};
    md.conversation = md.conversation || [];
    const nu = new Date().toISOString();
    md.conversation.push({ from: 'member', text: v.slice(0, 1000), lang: lang || 'nl', at: nu, channel: 'assistent' });
    md.conversation.push({ from: 'rahul', text: a.slice(0, 4000), lang: lang || 'nl', at: nu, channel: 'assistent' });
    md.conversation = md.conversation.slice(-120);
    accounts.saveMemberState(user.id, md);
    broadcastSync([user.tier], 'chat');
    return true;
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

  return { aiSystemPrompt, cannedAnswer, generateAiReply, convOf, memberSays, noteerBeurt, conciergeInbox, zetServiceOverdracht };
}
module.exports = { AI_TONE, maakAi };

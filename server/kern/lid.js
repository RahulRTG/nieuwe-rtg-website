/* De leden-laag: de contactregels tussen de pas-niveaus (wie mag wie
   aanspreken), de startinhoud van een nieuw account (memberTemplate), de
   volledige leden-app-state (stateFor) en de eigen sollicitaties (myApplications).

   Alle functies dragen state (db, accounts, i18n, de foundation en de
   leeftijd-/leverancier-helpers) en komen uit maakLid(state). De hoger-pas-leden
   (Lifestyle/Business) mogen elk RTG-lid aanspreken; een RTG-lid reageert alleen
   met andere RTG-leden, tenzij een hoger lid het contact eerst legde. */

const salonviraal = require('./salonviraal');
// Wat een pas per maand kost: een antwoord, gedeeld met het betaalschema en
// het ledenregister. Zie de kop van ./pasprijs.js.
const { maandCentenUit } = require('./pasprijs');

function maakLid(deps) {
  const { db, accounts, PERSONAS, findSupplier, i18n, rtf, talen, leeftijdVan, leeftijdsgroepVan, geborenVan } = deps;
  // Laat-gebonden vriendencheck: de sociale laag wordt ná de leden-kern
  // opgebouwd, dus server.js vult deps.zijnVrienden later in. Zonder die functie
  // (bijv. losse module-test) telt niemand als vriend.
  const zijnVriendenVan = (a, b) => { try { return typeof deps.zijnVrienden === 'function' ? !!deps.zijnVrienden(a, b) : false; } catch (e) { return false; } };
  const { hasContact, addContact, canEngage, engageError, registerContact } =
    require('./lid/contact')({ db, PERSONAS });

  /* Startinhoud voor een nieuw account: een eigen kopie van de voorbeeldreis en
     -facturen, zodat elk lid zijn eigen boekingen/betalingen heeft. */
  function memberTemplate() {
    return {
      invoices: JSON.parse(JSON.stringify(db.data.invoices)),
      trip: JSON.parse(JSON.stringify(db.data.trip)),
      creatorCredit: 0,
      creatorLikes: 0
    };
  }

  function stateFor(sess, lang) {
    // Elke actieve wereldtaal mag; systeeminhoud (facturen, reis) lokaliseert naar
    // Nederlands of de Engelse terugval (via localize). Berichten van leden houden
    // hun originele tekst + auteurstaal en worden per kijker vertaald.
    lang = talen ? talen.taalVan(lang) : (lang === 'en' ? 'en' : 'nl');
    // Echte accounts tonen hun eigen identiteit (naam, codenaam); demo-sessies
    // vallen terug op de vaste persona's.
    const persona = sess.account ? accounts.publicUser(sess.account) : PERSONAS[sess.tier];
    // Systeeminhoud (facturen, reis, menu) wordt gelokaliseerd. Berichten van
    // leden (posts, reacties) houden hun originele tekst + de taal van de auteur,
    // zodat de ontvanger ze in zijn eigen taal vertaald kan lezen.
    // De Salon toont aan vreemden alleen wat viraal gaat of maatschappelijk
    // belangrijk is; de zakelijke partner-etalage en de door RTG uitgelichte
    // posts staan daar los van en blijven altijd zichtbaar. Maar van een vriend
    // of iemand die je volgt zie je een bericht altijd (zie kern/salonviraal.js).
    const volgtAuteur = (p) => {
      if (p.partnerCode) { const s = findSupplier(p.partnerCode); return !!(s && s.salon && Array.isArray(s.salon.volgers) && s.salon.volgers.includes(sess.key)); }
      return false;
    };
    const bevriendMet = (p) => {
      if (!p.authorKey || sess.tier === 'guest' || !sess.key) return false;
      return zijnVriendenVan(sess.key, p.authorKey);
    };
    const kijker = { volgt: volgtAuteur, bevriend: bevriendMet };
    const posts = db.data.posts.filter(p => salonviraal.toonInSalon(p, kijker)).map(p => {
      const sup = p.partnerCode ? findSupplier(p.partnerCode) : null;
      const claim = p.deal ? (p.deal.claims || []).find(c => c.key === sess.key) : null;
      return {
        id: p.id, author: p.author, tier: p.tier, place: p.place, visual: p.visual, at: p.at || null,
        photo: p.photo || null, partner: !!p.partner,
        reden: salonviraal.reden(p, kijker),
        text: p.text, lang: p.lang || 'nl', reward: p.reward, featured: !!p.featured,
        likes: p.baseLikes + Object.keys(p.likedBy).length,
        liked: !!p.likedBy[sess.key],
        comments: p.comments.map(c => ({ who: c.who, tier: c.tier, text: c.text, lang: c.lang || 'nl' })),
        canEngage: canEngage(sess, p),
        // bedrijfslaag: volgen, exclusieve aanbiedingen en polls
        partnerCode: p.partnerCode || null,
        volgIk: sup && sup.salon ? sup.salon.volgers.includes(sess.key) : false,
        volgers: sup && sup.salon ? sup.salon.volgers.length : undefined,
        deal: p.deal ? { titel: p.deal.titel, geldigTot: p.deal.geldigTot || null,
          claims: (p.deal.claims || []).length, mijnCode: claim ? claim.code : null } : null,
        poll: p.poll ? {
          vraag: p.poll.vraag,
          totaal: p.poll.opties.reduce((n, o) => n + o.stemmen.length, 0),
          opties: p.poll.opties.map((o, i) => ({ tekst: o.tekst, stemmen: o.stemmen.length, mijn: o.stemmen.includes(sess.key) })),
          gestemd: p.poll.opties.some(o => o.stemmen.includes(sess.key))
        } : null,
        // folder (digitale brochure): titel, foto's en producten/hoogtepunten
        folder: p.folder ? { titel: p.folder.titel, fotos: p.folder.fotos || [], items: p.folder.items || [] } : null
      };
    });
    const state = { user: { tier: sess.tier, ...persona }, posts, creatorCredit: 0, creatorLikes: 0, lang };
    // Ook gratis gebruikers (zonder pas) mogen solliciteren en hun sollicitaties
    // met status terugzien; de rest van het ledenpaneel blijft voor leden.
    state.myApplications = myApplications(sess.key);
    if (sess.tier !== 'guest') {
      // Echte accounts hebben hun eigen boekingen/betalingen; demo-sessies delen
      // de vaste demo-inhoud.
      const md = sess.account ? (accounts.getMemberState(sess.account.id) || memberTemplate()) : db.data;
      /* Elke factuur krijgt een afboekcode (grootboeksuggestie) en de btw die in
         de ledenbijdrage is begrepen. Business-leden zien de volledige specificatie.

         HIER STOND DE PRIJS EEN TWEEDE KEER. `{ rtg: 65, lifestyle: 20000,
         business: 7500 }`, hard in euro's, terwijl de eigenaar de pasprijs in de
         boardroom zet (kern/geldregie.js). Wie daar de prijs veranderde, kreeg
         een lid te zien met de OUDE prijs op zijn factuur -- en het betaalschema
         van de aanmelding rekende ondertussen wel met de nieuwe. Twee plekken,
         een waarheid, en de factuur trok aan het kortste eind.

         Erger nog was de Business Pass. Die is volgens de regie nadrukkelijk
         `opMaat: true` en heeft dus GEEN maandprijs; hier stond 7500, en dat
         werd 7500 x 1,21 = 9.075 euro op de factuur van een lid. Een bedrag dat
         nergens is afgesproken. maandCentenVoor geeft voor business null, en
         null is hier een antwoord: dan blijft staan wat er stond en verzinnen we
         niets. */
      const PASNAAM = { rtg: 'RTG Pass', lifestyle: 'Lifestyle Pass', business: 'Business Pass' };
      const bijdrageCenten = maandCentenUit(deps.geldPasprijzen, sess.tier);
      state.invoices = (md.invoices || []).map(inv => {
        const contrib = /lidmaatschap|jaarbijdrage|maandbijdrage/i.test(inv.desc);
        if (contrib && PASNAAM[sess.tier]) {
          inv = {
            ...inv,
            desc: (lang === 'en' ? 'Monthly contribution ' : 'Maandbijdrage ') + PASNAAM[sess.tier] +
                  (bijdrageCenten == null ? (lang === 'en' ? ' (bespoke)' : ' (prijs op maat)') : '') +
                  (lang === 'en' ? ' · July 2026' : ' · juli 2026'),
            // alleen invullen als er echt een prijs IS; anders het bedrag laten staan
            ...(bijdrageCenten == null ? {} : { netto: 0, bijdrage: Math.round(bijdrageCenten * 1.21) / 100 })
          };
        }
        return {
          ...inv, desc: contrib ? inv.desc : i18n.localize(inv.desc, lang), date: i18n.localize(inv.date, lang),
          afboekcode: contrib ? '4560' : '4510',
          afboeklabel: lang === 'en'
            ? (contrib ? 'subscriptions and memberships' : 'travel and lodging expenses')
            : (contrib ? 'contributies en abonnementen' : 'reis- en verblijfkosten'),
          btw: Math.round((inv.bijdrage - inv.bijdrage / 1.21) * 100) / 100
        };
      });
      if (md.trip) {
        state.trip = {
          ...md.trip,
          dates: i18n.localize(md.trip.dates, lang),
          items: (md.trip.items || []).map(it => ({
            ...it, when: i18n.localize(it.when, lang), title: i18n.localize(it.title, lang), sub: i18n.localize(it.sub, lang)
          }))
        };
      }
      state.creatorCredit = sess.account ? (md.creatorCredit || 0) : (db.data.creatorCredit[sess.tier] || 0);
      state.creatorLikes = sess.account ? (md.creatorLikes || 0) : (db.data.creatorLikes[sess.tier] || 0);
      // RTFoundation: gezinnen die dit lid als oppas/familie koppelde + hun meldingen
      if (sess.account) {
        state.foundation = { gekoppeld: rtf.gekoppeldeGezinnen(sess.account.id), meldingen: md.foundationMeldingen || [] };
      }
      // leeftijd uit het paspoort: het lid ziet de eigen groep; partners nooit
      // (geborenVan las member_state hier een tweede keer; `md` heeft het al)
      const lft = leeftijdVan(sess.account ? (md.geboren || null) : geborenVan(sess));
      if (lft != null) { state.user.leeftijd = lft; state.user.leeftijdsgroep = leeftijdsgroepVan(lft); }
    }
    return state;
  }

  // De sollicitaties van dit lid, over alle partners heen, nieuwste eerst.
  function myApplications(key) {
    const out = [];
    for (const [code, list] of Object.entries(db.data.applications || {})) {
      const s = findSupplier(code);
      for (const a of list) if (a.key === key) {
        const chat = (db.data.applyChats || {})[a.id];
        out.push({ company: s ? s.name : code, func: a.func, status: a.status, at: a.at, chatId: chat ? a.id : null });
      }
    }
    return out.sort((x, y) => new Date(y.at) - new Date(x.at)).slice(0, 10);
  }

  // memberTemplate blijft intern (stateFor gebruikt hem); server.js houdt zijn
  // eigen hoisted memberTemplate voor de demo-seed die vóór deze fabriek draait.
  return { hasContact, addContact, canEngage, engageError, registerContact, stateFor, myApplications };
}

module.exports = { maakLid };

/* De leden-laag: de contactregels tussen de pas-niveaus (wie mag wie
   aanspreken), de startinhoud van een nieuw account (memberTemplate), de
   volledige leden-app-state (stateFor) en de eigen sollicitaties (myApplications).

   Alle functies dragen state (db, accounts, i18n, de foundation en de
   leeftijd-/leverancier-helpers) en komen uit maakLid(state). De hoger-pas-leden
   (Lifestyle/Business) mogen elk RTG-lid aanspreken; een RTG-lid reageert alleen
   met andere RTG-leden, tenzij een hoger lid het contact eerst legde. */

const salonviraal = require('./salonviraal');

function maakLid(deps) {
  const { db, accounts, PERSONAS, findSupplier, i18n, rtf, talen, leeftijdVan, leeftijdsgroepVan, geborenVan } = deps;
  // Laat-gebonden vriendencheck: de sociale laag wordt ná de leden-kern
  // opgebouwd, dus server.js vult deps.zijnVrienden later in. Zonder die functie
  // (bijv. losse module-test) telt niemand als vriend.
  const zijnVriendenVan = (a, b) => { try { return typeof deps.zijnVrienden === 'function' ? !!deps.zijnVrienden(a, b) : false; } catch (e) { return false; } };
  const { hasContact, addContact, canEngage, engageError, registerContact } =
    require('./lid/contact')({ db, PERSONAS });
  const { facturenVoor, reisVoor } = require('./lid/facturen')({ i18n, deps });

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
      // facturen (afboekcode, btw, pasprijs uit de boardroom) en de reis staan in
      // ./lid/facturen.js -- inclusief waarom de prijs daar NIET hard staat
      state.invoices = facturenVoor(md, sess.tier, lang);
      const reis = reisVoor(md, lang);
      if (reis) state.trip = reis;
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

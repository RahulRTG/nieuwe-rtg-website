/* De content-creator-laag: een eigen genre voor content creators (influencers,
   videomakers, fotografen, podcasters) met een carriere-app. Alsof elke creator
   zijn hele loopbaan op RTG runt.

   De creator beheert:
   - een profiel: niche, bio, platforms (met handle + bereik/volgers), portfolio;
   - tarieven per soort content (reel, video, post, ...);
   - een content-kalender met ideeen en hun status (idee -> in productie -> gepost);
   - een AI content/script-helper die ideeen bedenkt EN kant-en-klare scripts
     schrijft (hook, opbouw, call-to-action), met Claude wanneer beschikbaar en
     anders via ingebouwde sjablonen.

   Samenwerkingen met leveranciers en de financiele kant lopen via de gedeelde
   lagen (kern/samenwerking.js en de supplier-finance). maakCreator(state) volgt
   het vaste kern-patroon. */

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'x', 'twitch', 'podcast', 'blog'];
const SOORTEN = ['reel', 'post', 'story', 'video', 'vlog', 'review', 'unboxing', 'livestream', 'fotoshoot', 'blogartikel'];
const IDEE_STATUS = ['idee', 'productie', 'gepost'];

function maakCreator({ db, save, crypto, anthropic, schoon }) {
  const id = (p) => (p || 'x') + crypto.randomBytes(3).toString('hex');
  const nu = () => new Date().toISOString();
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 120));
  const getal = (v, max) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0; };

  function isCreator(s) { return !!s && ((db.data.supplierTypes[s.type] || {}).caps || []).includes('creator'); }
  function ensure(s) {
    if (!s.creator) s.creator = { niche: '', bio: '', platforms: [], portfolio: [], tarieven: [], ideeen: [], opgezet: false };
    const c = s.creator;
    for (const k of ['platforms', 'portfolio', 'tarieven', 'ideeen']) if (!Array.isArray(c[k])) c[k] = [];
    return c;
  }
  function bereik(c) { return c.platforms.reduce((n, p) => n + (p.volgers || 0), 0); }

  function overzicht(s) {
    const c = ensure(s);
    const ideeen = c.ideeen.slice().sort((a, b) => IDEE_STATUS.indexOf(a.status) - IDEE_STATUS.indexOf(b.status) || String(b.at).localeCompare(String(a.at)));
    return {
      opgezet: c.opgezet, niche: c.niche || '', bio: c.bio || '',
      platformkeuze: PLATFORMS, soortkeuze: SOORTEN,
      platforms: c.platforms.map(p => ({ id: p.id, platform: p.platform, handle: p.handle, volgers: p.volgers || 0 })),
      portfolio: c.portfolio.map(p => ({ id: p.id, titel: p.titel, link: p.link || null, soort: p.soort || null })),
      tarieven: c.tarieven.map(t => ({ id: t.id, soort: t.soort, prijs: t.prijs || 0 })),
      ideeen: ideeen.map(i => ({ id: i.id, tekst: i.tekst, status: i.status, voor: i.voor || null, script: i.script || null, at: i.at })),
      stats: {
        bereik: bereik(c), platforms: c.platforms.length, portfolio: c.portfolio.length,
        ideeen: c.ideeen.length, teProduceren: c.ideeen.filter(i => i.status === 'productie').length,
        gepost: c.ideeen.filter(i => i.status === 'gepost').length,
        gemTarief: c.tarieven.length ? Math.round(c.tarieven.reduce((n, t) => n + (t.prijs || 0), 0) / c.tarieven.length) : 0
      }
    };
  }

  function zetProfiel(s, data) {
    const c = ensure(s);
    if (data.niche != null) c.niche = scho(data.niche, 60);
    if (data.bio != null) c.bio = scho(data.bio, 400);
    c.opgezet = true; save(); return { ok: true };
  }
  function zetPlatform(s, data) {
    const c = ensure(s);
    if (data.weg) { c.platforms = c.platforms.filter(p => p.id !== data.id); save(); return { ok: true }; }
    if (!PLATFORMS.includes(data.platform)) return { error: 'Onbekend platform.' };
    if (data.id) {
      const p = c.platforms.find(x => x.id === data.id); if (!p) return { error: 'Platform niet gevonden.' };
      if (data.handle != null) p.handle = scho(data.handle, 40);
      if (data.volgers != null) p.volgers = getal(data.volgers, 1e12);
      save(); return { ok: true };
    }
    if (c.platforms.length >= 20) return { error: 'Tot 20 platforms.' };
    c.platforms.push({ id: id('pf'), platform: data.platform, handle: scho(data.handle, 40), volgers: getal(data.volgers, 1e12) });
    save(); return { ok: true };
  }
  function zetTarief(s, data) {
    const c = ensure(s);
    if (data.weg) { c.tarieven = c.tarieven.filter(t => t.id !== data.id); save(); return { ok: true }; }
    if (!SOORTEN.includes(data.soort)) return { error: 'Onbekende contentsoort.' };
    if (data.id) { const t = c.tarieven.find(x => x.id === data.id); if (!t) return { error: 'Tarief niet gevonden.' }; if (data.prijs != null) t.prijs = Math.round(getal(data.prijs, 1e7)); save(); return { ok: true }; }
    if (c.tarieven.length >= 40) return { error: 'Tot 40 tarieven.' };
    c.tarieven.push({ id: id('tr'), soort: data.soort, prijs: Math.round(getal(data.prijs, 1e7)) });
    save(); return { ok: true };
  }
  function zetPortfolio(s, data) {
    const c = ensure(s);
    if (data.weg) { c.portfolio = c.portfolio.filter(p => p.id !== data.id); save(); return { ok: true }; }
    const titel = scho(data.titel, 80); if (!titel) return { error: 'Geef het werk een titel.' };
    if (c.portfolio.length >= 100) return { error: 'Tot 100 portfolio-items.' };
    c.portfolio.push({ id: id('po'), titel, link: scho(data.link, 300) || null, soort: SOORTEN.includes(data.soort) ? data.soort : null });
    save(); return { ok: true };
  }
  function zetIdee(s, data) {
    const c = ensure(s);
    if (data.weg) { c.ideeen = c.ideeen.filter(i => i.id !== data.id); save(); return { ok: true }; }
    if (data.id) {
      const i = c.ideeen.find(x => x.id === data.id); if (!i) return { error: 'Idee niet gevonden.' };
      if (data.status && IDEE_STATUS.includes(data.status)) i.status = data.status;
      if (data.voor != null) i.voor = /^\d{4}-\d{2}-\d{2}$/.test(data.voor) ? data.voor : null;
      if (data.script != null) i.script = scho(data.script, 4000);
      save(); return { ok: true };
    }
    const tekst = scho(data.tekst, 200); if (!tekst) return { error: 'Beschrijf het idee.' };
    if (c.ideeen.length >= 500) c.ideeen = c.ideeen.filter(i => i.status !== 'gepost').slice(-400);
    const idee = { id: id('id'), tekst, status: 'idee', voor: /^\d{4}-\d{2}-\d{2}$/.test(data.voor || '') ? data.voor : null, script: data.script ? scho(data.script, 4000) : null, at: nu() };
    c.ideeen.push(idee);
    save(); return { ok: true, idee };
  }

  /* ---- de AI content/script-helper ---- */
  function ingebouwdScript(onderwerp, soort) {
    const o = onderwerp || 'je onderwerp';
    const s2 = soort || 'reel';
    return [
      'SCRIPT (' + s2 + ') - ' + o,
      '',
      'HOOK (0-3 sec): Begin met een prikkelende vraag of een sterk beeld over ' + o + '. Bijv. "Dit wist je nog niet over ' + o + '..."',
      'INTRO (3-8 sec): Vertel in EGn zin waarom de kijker moet blijven kijken.',
      'KERN (8-40 sec): Laat 3 concrete dingen zien of leg 3 punten uit over ' + o + '. Toon, vertel niet alleen.',
      'BEWIJS: Voeg een echt moment, cijfer of reactie toe die het geloofwaardig maakt.',
      'CALL-TO-ACTION: Sluit af met een duidelijke vraag ("Wat zou jij kiezen?") en een reden om te volgen/opslaan.',
      '',
      'TIP: houd het onder de 45 seconden, ondertitel alles, en post op je drukste tijdstip.'
    ].join('\n');
  }
  function ingebouwdeIdeeen(niche) {
    const n = niche || 'je niche';
    return [
      '5 dingen die niemand je vertelt over ' + n,
      'Een dag uit mijn leven als ' + n + '-creator',
      'Voor/na: mijn grootste fout in ' + n,
      'Ik test een virale ' + n + '-tip (werkt het echt?)',
      'Beantwoord jullie meestgestelde vraag over ' + n
    ];
  }
  // Herken opdrachten die iets DOEN of een script/ideeen vragen.
  async function contentHulp(s, opdracht, aiAan) {
    opdracht = scho(opdracht, 500);
    if (!opdracht) return { antwoord: 'Vertel waar je content over wil maken, of vraag om een script of ideeen.' };
    const c = ensure(s);
    const q = opdracht.toLowerCase();
    // "voeg idee <tekst> toe" / "zet <tekst> op de kalender"
    let m = q.match(/(?:voeg|zet)\s+(?:het\s+)?idee[:\s]+(.{3,180})(?:\s+toe)?$/) || q.match(/(?:zet|plan)\s+(.{3,180})\s+op\s+(?:de\s+)?kalender$/);
    if (m) { const r = zetIdee(s, { tekst: m[1].trim() }); return r.error ? { antwoord: r.error } : { antwoord: 'Op je kalender gezet: ' + m[1].trim(), gedaan: true }; }
    // "maak/schrijf een script voor <onderwerp>"
    m = q.match(/(?:maak|schrijf|geef).*script.*(?:voor|over)\s+(.{2,120})$/);
    const isScript = !!m || /\bscript\b/.test(q);
    if (aiAan && anthropic) {
      try {
        const { RAHUL_LEAD } = require('./rahul');
        const sys = RAHUL_LEAD + 'je werkt als ervaren content-strateeg en scriptschrijver voor een content creator op RTG. Niche: ' + (c.niche || 'algemeen') + '. Antwoord kort en concreet in het Nederlands. Als om een script wordt gevraagd, lever een kant-en-klaar script met hook, opbouw en call-to-action.';
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 700, system: sys, messages: [{ role: 'user', content: opdracht }] });
        const tekst = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (tekst) return { antwoord: tekst };
      } catch (e) { /* val terug op sjablonen */ }
    }
    if (isScript) { const onderwerp = m ? m[1].trim() : (c.niche || opdracht); return { antwoord: ingebouwdScript(onderwerp, null) }; }
    if (/idee|ideeen|ideeën|content(?!\w)/.test(q)) return { antwoord: 'Contentideeen:\n- ' + ingebouwdeIdeeen(c.niche).join('\n- ') };
    return { antwoord: 'Ik help je met content. Vraag bijv. "schrijf een script voor een reel over een strandclub", "geef me 5 ideeen", of "voeg idee ... toe aan de kalender".' };
  }

  return {
    PLATFORMS, SOORTEN, IDEE_STATUS,
    isCreator, ensure, overzicht,
    zetProfiel, zetPlatform, zetTarief, zetPortfolio, zetIdee, contentHulp, bereik
  };
}

module.exports = { maakCreator, CREATOR_PLATFORMS: PLATFORMS, CREATOR_SOORTEN: SOORTEN };

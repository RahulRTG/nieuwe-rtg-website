/* Afdelingen (deelmodule): het kantoorleven: de chat per kamer, de
   huisregels, de onboarding per kamer en het dienstbord (in/uit dienst,
   wie is er nu). Krijgt de gedeelde context een keer bij het opstarten
   vanuit kern/afdelingen.js. */
module.exports = (ctx) => {
  const { db, save, crypto, anthropic, ledenGeteld, nu, DAG, lijst, tel, recent, d, AFDELINGEN, KAMER_IDS, functies } = ctx;
  function chatRij(kamerId) {
    if (!AFDELINGEN[kamerId] && kamerId !== 'boardroom' && kamerId !== 'paniekkamer') return null;
    if (!d().kantoorChat) d().kantoorChat = {};
    if (!Array.isArray(d().kantoorChat[kamerId])) d().kantoorChat[kamerId] = [];
    return d().kantoorChat[kamerId];
  }
  function chatLijst(kamerId) {
    const rij = chatRij(kamerId);
    if (!rij) return { status: 404, error: 'Deze kamer bestaat niet.' };
    return { ok: true, berichten: rij.slice(-60) };
  }
  function chatStuur(kamerId, naam, tekst, foto) {
    const rij = chatRij(kamerId);
    if (!rij) return { status: 404, error: 'Deze kamer bestaat niet.' };
    const t = String(tekst || '').replace(/[<>]/g, '').trim().slice(0, 500);
    const f = (typeof foto === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(foto) && foto.length < 300000) ? foto : null;
    if (!t && !f) return { status: 400, error: 'Typ een bericht of stuur een snap.' };
    rij.push({ id: crypto.randomBytes(4).toString('hex'), naam: String(naam || 'collega').replace(/[<>]/g, '').slice(0, 30), tekst: t, foto: f, at: nu() });
    if (rij.length > 200) rij.shift();
    save();
    return { ok: true };
  }

  /* ---------- onboarding per afdeling: nieuwe mensen meteen thuis ---------- */
  const HUISREGELS = [
    'Vragen stellen is sterk, nooit dom; niemand hoeft hier iets te raden.',
    'Fouten meld je meteen en zonder schaamte; we repareren samen, we wijzen niet.',
    'Elke stagiair krijgt een buddy; je eerste week loop je overal gewoon mee.',
    'Voel je je niet gehoord of niet veilig? De vertrouwenspersoon zit in de personeels-app, en HR heeft altijd een open deur.',
    'Privacy is heilig: klantdata bekijk je alleen als je taak erom vraagt.'
  ];
  const ONBOARDING_EXTRA = {
    sales: { knoppen: ['De winkel (/site/winkel.html): wat we verkopen en voor welke prijs', 'Deze kamer: open bestellingen en partner-aanvragen', 'De werklijst: pak een taak, vink hem af'], handelingen: ['Nieuwe bestelling? Binnen twee werkdagen bellen.', 'Partner-aanvraag? Eerst het Business Pass-bewijs controleren.'] },
    hr: { knoppen: ['Sollicitaties en vacatures in deze kamer', 'Verlof en klok in de personeels-app'], handelingen: ['Elke sollicitant krijgt altijd antwoord, ook bij een nee.', 'Verlofaanvragen beslis je binnen een week.'] },
    financien: { knoppen: ['Betalingen en munt-ontvangsten in deze kamer', 'Facturen lopen automatisch via de factuurmotor'], handelingen: ['Twijfel over een bedrag? Eerst vragen, nooit gokken.'] },
    intern: { knoppen: ['Het schakelbord staat in de boardroom; de zekeringen op techniek.html', 'De Zaakdozen in het veld zie je in deze kamer'], handelingen: ['Bij een storing: eerst de verbeterkamer en het techniekbord lezen, dan pas schakelen (via de paniekkamer).'] }
  };
  function onboarding(kamerId) {
    const a = AFDELINGEN[kamerId];
    if (!a) return { status: 404, error: 'Deze kamer bestaat niet.' };
    const extra = ONBOARDING_EXTRA[kamerId] || {};
    return { ok: true, onboarding: {
      welkom: 'Welkom bij ' + a.naam + '! ' + a.missie + ' Fijn dat je er bent; deze pagina is er zodat jij je vanaf dag een gehoord, gesteund en thuis voelt.',
      regels: HUISREGELS,
      knoppen: extra.knoppen || ['De cijfers van deze kamer staan bovenaan; de werklijst eronder.', 'De chat-tab is voor de kamer zelf: vraag alles.', 'De statistieken-tab toont het hele platform, zodat je snapt waar jouw werk landt.'],
      handelingen: extra.handelingen || ['Begin elke dienst met de werklijst en de verbeterpunten uit de boardroom.', 'Sluit af met een korte notitie in de chat: wat is af, wat blijft liggen.']
    } };
  }

  /* ---------- aanmelden: wie werkt er nu, op kantoor of thuis ---------- */
  function dienstRij() { if (!Array.isArray(d().kantoorDienst)) d().kantoorDienst = []; return d().kantoorDienst; }
  function dienstIn(naam, kamerId, waar) {
    const n = String(naam || '').replace(/[<>]/g, '').trim().slice(0, 30);
    if (!n) return { status: 400, error: 'Wie meldt zich aan?' };
    if (!AFDELINGEN[kamerId] && kamerId !== 'boardroom' && kamerId !== 'paniekkamer') return { status: 404, error: 'Deze kamer bestaat niet.' };
    const rij = dienstRij();
    const open = rij.find(x => !x.uit && x.naam.toLowerCase() === n.toLowerCase());
    if (open) return { status: 409, error: n + ' is al aangemeld (' + open.waar + '). Eerst afmelden.' };
    const e = { id: crypto.randomBytes(4).toString('hex'), naam: n, kamer: kamerId, waar: waar === 'thuis' ? 'thuis' : 'kantoor', in: nu(), uit: null };
    rij.unshift(e);
    if (rij.length > 500) rij.pop();
    save();
    return { ok: true, dienst: e };
  }
  function dienstUit(id) {
    const e = dienstRij().find(x => x.id === id && !x.uit);
    if (!e) return { status: 404, error: 'Deze aanmelding staat niet (meer) open.' };
    e.uit = nu();
    save();
    return { ok: true, dienst: e };
  }
  function dienstNu() {
    return { ok: true, aangemeld: dienstRij().filter(x => !x.uit).map(x => ({ id: x.id, naam: x.naam, kamer: x.kamer, waar: x.waar, sinds: x.in })) };
  }

  /* ---------- de kantine: de kaart van vandaag ----------
     De kantine-kamer mag zelf iets MAKEN: het dagmenu. Wie het zet, staat
     erbij; de kamer toont het meteen aan iedereen. */
  function kantineMenu() { return { ok: true, menu: d().kantineMenu || null }; }
  function kantineMenuZet(items, door) {
    const rij = lijst(items).map(x => String(x == null ? '' : x).replace(/[<>]/g, '').trim().slice(0, 80)).filter(Boolean).slice(0, 12);
    if (!rij.length) return { status: 400, error: 'Wat staat er vandaag op de kaart?' };
    d().kantineMenu = { datum: new Date().toISOString().slice(0, 10), items: rij,
      door: String(door || 'kantine').replace(/[<>]/g, '').trim().slice(0, 30), at: nu() };
    save();
    return { ok: true, menu: d().kantineMenu };
  }

  /* ---------- de paniekkamer ----------
     Dezelfde knoppen als de boardroom, maar met het vier-ogen-principe: een
     omgezette knop wordt een voorstel. De boardroom accepteert (dan schakelt
     hij echt), wijst af, of discussieert er eerst over. */
  return { chatRij, chatLijst, chatStuur, HUISREGELS, ONBOARDING_EXTRA, onboarding, dienstRij, dienstIn, dienstUit, dienstNu, kantineMenu, kantineMenuZet };
};

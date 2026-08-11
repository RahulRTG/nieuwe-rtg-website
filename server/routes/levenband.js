/* RTFoundation, fase 2: de routes van de rechten per relatie (LEVEN.md par.
   2.8). Hoort bij ./leven.js en is er alleen van gescheiden omdat het samen
   over de omvangregel zou gaan.

   DIT IS DE ENIGE SCHRIJVENDE LAAG VAN DEZE WERELD, en dat is geen breuk met
   het werkwoord "openen" uit par. 0: wat hier geschreven wordt is niet het
   LEVEN van iemand maar zijn TOESTEMMING. De levenslijn en de graaf blijven
   alleen-lezen; deze routes raken uitsluitend db.data.levensbanden aan.

   TWEE SESSIEWERELDEN, EEN GRAMMATICA. Het foundation-huis draait op een
   gezinscode met een profieltoken (identiteit: rtf:CODE:pid), de levenslijn op
   de RTG-lidsleutel. Fase 2 knoopt ze aan elkaar, en daarom staat elke actie
   hier TWEE KEER: een keer achter `auth` voor het lid en een keer achter
   `gezinsPoort` voor het gezinsprofiel. Dat is met opzet geen gedeelde
   "wie-ben-je"-poort geworden: een deur die twee heel verschillende
   inlogwerelden moet bedienen, wordt vanzelf de zwakste van de twee.

   NOOIT EEN RAUWE IDENTITEIT NAAR BUITEN. Binnen bestaat een lid als
   sessiesleutel (zoals overal in kern/sociaal), maar die sleutel is een
   geheim: hij gaat dus door codenaamVan voor hij het scherm haalt, precies
   zoals de codenaam-gids het bedoelt. Vragen doet u dan ook OP CODENAAM en
   niet op een handle -- de privacy by design uit CLAUDE.md, doorgetrokken tot
   in het adresveld.

   Identiteit: het token reist in de Authorization-kop, nooit in een URL. */
'use strict';

module.exports = (kern) => {
  const { app, auth, rtf } = kern;

  /* Late binding op kern.levensband: de kernlaag hangt eerder dan deze router,
     maar hem hier vastpakken zou die volgorde stilzwijgend tot eis maken. */
  const L = () => kern.levensband;

  /* De codenaam van een identiteit -- voor een lid EN voor een gezinsprofiel;
     kern/sociaal kent beide vormen al. Faalt hij, dan liever "onbekend" dan de
     rauwe sleutel: dit is precies de plek waar zo'n lek zou ontstaan. */
  const naam = (id) => { try { return kern.codenaamVan(id) || 'onbekend'; } catch (e) { return 'onbekend'; } };

  /* De omgekeerde weg: van een ingetypte codenaam naar de identiteit erachter.
     Eerst de ledengids, dan de gezinsprofielen. Niet gevonden is niet gevonden;
     er wordt niets geraden en er komt geen lijst met bijna-treffers terug --
     zo'n lijst is een zoekmachine door alle mensen heen. */
  async function wieVan(codenaam) {
    const c = String(codenaam == null ? '' : codenaam).trim();
    if (!c) return null;
    const lid = await kern.keyVanCodenaam(c);
    if (lid && lid.key) return lid.key;
    const p = (rtf.socialProfielen() || []).find((x) =>
      String(x.codenaam || '').toLowerCase() === c.toLowerCase());
    return p ? p.handle : null;
  }

  /* HET HELE SCHERM IN EEN AANROEP. Wat ik deel staat per band, en wat de
     ander deelt ook: een lijst "delingen" los van de banden zou de lezer zelf
     laten uitrekenen wie wat ziet, en dat is precies de rekensom die niemand
     maakt en iedereen fout heeft. */
  function kring(wie) {
    const l = L();
    const mijn = l.delingen(wie);
    const banden = l.banden(wie).map((b) => {
      const ander = b.lid === wie ? b.profiel : b.lid;
      return {
        id: b.id, soort: b.soort, staat: b.staat, vervalt: b.vervalt,
        ander: naam(ander),
        ikVroeg: b.gevraagdDoor === wie,
        /* wat IK aan deze ander geef, en wat DEZE ander aan mij geeft. Twee
           kanten die los van elkaar staan: een band is geen ruil. */
        ikDeel: mijn.filter((x) => x.bandId === b.id),
        ikZie: l.inzage(wie, ander).stukken
      };
    });
    /* UITZONDERINGSGESTUURD, zoals elke cockpit in dit huis (ONTWERP.md): wie
       op MIJ wacht staat bovenaan, want dat is het enige wat een handeling
       vraagt. Daarna wat loopt, dan wat ik zelf vroeg (daar valt te wachten en
       niets te doen), en onderaan wat voorbij is. De volgorde staat HIER en
       niet in het scherm, zodat beide werelden hem delen -- twee schermen die
       dezelfde lijst anders rangschikken, is twee keer uitleggen wat er aan de
       hand is. */
    const rang = (b) => (b.staat === 'gevraagd' ? (b.ikVroeg ? 2 : 0)
      : b.staat === 'verlopen' ? 3 : 1);
    banden.sort((a, b) => rang(a) - rang(b));
    return { banden,
      verzoeken: l.bandVerzoeken(wie).map((v) => ({ id: v.id, soort: v.soort, van: naam(v.van) })),
      soorten: l.SOORTEN, stukken: l.deelStukken(), nooit: l.deelNooit() };
  }

  /* De acties, een keer opgeschreven en door beide poorten gebruikt. Ze krijgen
     de identiteit van de aanroeper mee en kennen zijn sessie verder niet: zo
     kan geen enkele actie per ongeluk namens een ander werken. */
  const ACTIES = {
    kring: async (wie) => Object.assign({ status: 200 }, kring(wie)),
    vraag: async (wie, b) => {
      const doel = await wieVan(b.codenaam);
      if (!doel) return { status: 404, error: 'Die codenaam kennen wij niet. Vraag hem nog eens na.' };
      const isH = (x) => String(x).indexOf('rtf:') === 0;
      const lidKant = !isH(wie) ? 'van' : (!isH(doel) ? 'doel' : 'geen');
      return L().bandVraag(wie, doel, { soort: b.soort, vervalt: b.vervalt, lidKant,
        gezin: isH(wie) ? String(wie).split(':')[1] : '' });
    },
    bevestig: async (wie, b) => L().bandBevestig(wie, b.bandId),
    verbreek: async (wie, b) => L().bandVerbreek(wie, b.bandId),
    deel: async (wie, b) => L().deelZet(wie, { bandId: b.bandId, stuk: b.stuk, vervalt: b.vervalt }),
    trekIn: async (wie, b) => L().deelIn(wie, b.delingId)
  };

  /* De kern antwoordt met een HTTP-status IN het antwoord; die hoort in de kop
     en niet in het lichaam, anders gaat een schil hem vroeg of laat lezen in
     plaats van r.ok. Hij wordt hier dus verzet en niet gekopieerd. */
  function stuur(res, r) {
    const a = Object.assign({ ok: true }, r);
    const code = a.status || 200;
    delete a.status;
    return a.error ? res.status(code).json({ error: a.error }) : res.status(code).json(a);
  }

  /* Express 4 vangt async-fouten niet zelf (zelfde vangnet als routes/welzijn).
     De fout blijft in de serverlog staan; het lid krijgt geen stapelspoor. */
  async function veilig(res, werk) {
    try { stuur(res, await werk()); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  }

  /* De ledenkant. `auth` is de poort; gasten blijven erbuiten om dezelfde reden
     als in ./leven.js -- een anonieme gast heeft geen codenaam, en een band
     zonder codenaam is een band met niemand. */
  const lidDoet = (fn) => (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Een band leggen is voor leden.' });
    return veilig(res, () => fn(req.session.key, req.body || {}));
  };

  /* De gezinskant. Dezelfde deur als routes/welzijn.js: gezinscode plus
     profieltoken, en gasten (oppas, opa en oma, familie) blijven erbuiten. Een
     gast heeft de code ooit gekregen, en bezit van een sleutel is geen
     instemming -- zie kern/levensband/index.js besluit 1. */
  function gezinsPoort(req, res, next) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    if (sess.gast) return res.status(403).json({ error: 'Banden zijn van de gezinsleden zelf.' });
    req.gezinslid = sess;
    next();
  }
  const huisDoet = (fn) => (req, res) => veilig(res, () => fn(req.gezinslid.handle, req.body || {}));

  /* ELK PAD VOLUIT (scripts/check.js regel 45). Een pad dat met een plus wordt
     gebouwd ziet de schakelkast niet, en wat die census niet ziet is vanuit de
     boardroom niet uit te zetten. Dat de twaalf regels hieronder twee keer
     hetzelfde lijstje zijn, is dus geen slordigheid maar de prijs van
     zichtbaarheid -- en het maakt in een oogopslag zichtbaar dat beide werelden
     precies evenveel mogen. */
  app.post('/api/leven/kring', auth, lidDoet(ACTIES.kring));
  app.post('/api/leven/band/vraag', auth, lidDoet(ACTIES.vraag));
  app.post('/api/leven/band/bevestig', auth, lidDoet(ACTIES.bevestig));
  app.post('/api/leven/band/verbreek', auth, lidDoet(ACTIES.verbreek));
  app.post('/api/leven/deel/zet', auth, lidDoet(ACTIES.deel));
  app.post('/api/leven/deel/in', auth, lidDoet(ACTIES.trekIn));

  app.post('/api/rtf/leven/kring', gezinsPoort, huisDoet(ACTIES.kring));
  app.post('/api/rtf/leven/band/vraag', gezinsPoort, huisDoet(ACTIES.vraag));
  app.post('/api/rtf/leven/band/bevestig', gezinsPoort, huisDoet(ACTIES.bevestig));
  app.post('/api/rtf/leven/band/verbreek', gezinsPoort, huisDoet(ACTIES.verbreek));
  app.post('/api/rtf/leven/deel/zet', gezinsPoort, huisDoet(ACTIES.deel));
  app.post('/api/rtf/leven/deel/in', gezinsPoort, huisDoet(ACTIES.trekIn));
};

/* Supplier-werving (deelmodule): DE UITNODIGING zelf.

   Personeel heeft altijd een eigen RTG-account; een betaalde pas is niet nodig,
   het gratis account is genoeg. Een manager nodigt iemand uit, en die
   uitnodiging is eenmalig, dertig dagen geldig, en op twee manieren in te
   wisselen:

     - als KASSACODE, over te typen in de leverancier-app (nodig op een gedeeld
       apparaat, en voor wie zijn account al heeft);
     - als LINK, /werken/<code>, die de aanmelding opent, zegt wie je uitnodigt
       en je meteen aan het bedrijf verbindt zodra je account er is.

   Twee wegen naar DEZELFDE uitnodiging, niet twee uitnodigingen. Dat verschil
   is de hele reden dat de code hier op een plek staat: de link kwam erbij en
   het zou verleidelijk zijn geweest hem zijn eigen aanmeldweg te geven, met
   binnen een maand twee regels over wie er bij een bedrijf mag.

   WAAROM DIT APART VAN personeel.js STAAT. Daar staan de routes. Toen de link
   en het verbinden erbij kwamen, groeide dat bestand van 9,9 naar 13,2 KB en
   ging het over de 10 KB-lat. De uitnodiging is een eigen onderwerp -- hem
   maken, hem terugvinden, en er iemand mee verbinden -- dus die knip loopt
   langs een naad die er toch al lag. */
module.exports = ({ kern }) => {
  const { accounts, crypto, db, logActivity, notifySupplier, save } = kern;

  const KASSA_ALFABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // zonder verwarrende tekens
  function maakKassacode() {
    let c = '';
    for (let i = 0; i < 6; i++) c += KASSA_ALFABET[crypto.randomInt(KASSA_ALFABET.length)];
    return c;
  }
  function invitesVan(code) {
    db.data.staffInvites = db.data.staffInvites || {};
    db.data.staffInvites[code] = db.data.staffInvites[code] || [];
    return db.data.staffInvites[code];
  }
  function findSupplierByName(naam) {
    const n = String(naam || '').trim().toLowerCase();
    if (!n) return null;
    return (db.data.suppliers || []).find(s => String(s.name || '').trim().toLowerCase() === n) || null;
  }

  // Eenmalige uitnodiging aanmaken (gedeeld door /staff/invite en het aannemen
  // van een sollicitant). Ruimt meteen verlopen/gebruikte codes op.
  function maakInvite(supplier, actor, { naam, role, func }) {
    const lijst = invitesVan(supplier.code);
    const nu = Date.now();
    db.data.staffInvites[supplier.code] = lijst.filter(i => !i.used && i.expires > nu);
    const inv = {
      kassacode: maakKassacode(), naam: naam || null,
      role: role === 'manager' ? 'manager' : 'staff', func: func || null,
      door: actor.name, expires: nu + 30 * 86400000, // 30 dagen geldig
      used: false, createdAt: new Date().toISOString()
    };
    db.data.staffInvites[supplier.code].push(inv);
    save();
    logActivity(supplier.code, actor, actor.name + ' nodigde een medewerker uit' + (inv.naam ? ' (' + inv.naam + ')' : ''));
    return inv;
  }

  /* De link die de uitnodiging draagt. Achter een omgekeerde proxy is
     req.protocol 'http' terwijl de bezoeker https gebruikt; dan wint de
     x-forwarded-proto, want een link naar http is er een die onderweg te lezen
     valt. Zonder host (een aanroep buiten een verzoek om) een pad. */
  function wervingsLink(req, kassacode) {
    const host = req && req.get && req.get('host');
    if (!host) return '/werken/' + kassacode;
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
    return proto + '://' + host + '/werken/' + kassacode;
  }

  /* Een uitnodiging opzoeken op de code ALLEEN. De link draagt de bedrijfsnaam
     niet, en dat is maar goed ook: daar strandde de oude weg op ("we kennen
     geen bedrijf met die naam" bij een spatie of een B.V. te veel). De code is
     zes tekens uit een alfabet van 32, eenmalig en dertig dagen geldig; de
     snelheidsrem op de route eromheen blijft staan, want zoeken op code alleen
     is een bredere deur dan zoeken op naam plus code. */
  function zoekInvite(kassacode) {
    const code = String(kassacode || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return null;
    const nu = Date.now();
    for (const s of (db.data.suppliers || [])) {
      const inv = invitesVan(s.code).find(i => i.kassacode === code && !i.used && i.expires > nu);
      if (inv) return { s, inv };
    }
    return null;
  }

  /* ---- het lid aan de zaak verbinden ----
     EEN plek, want er zijn drie wegen naartoe: de losse aanmelding met
     bedrijfsnaam + code, de wervingslink (met of zonder verse registratie) en
     het aannemen van een sollicitant. Drie keer hetzelfde met de hand doen is
     drie keer een andere regel over een maand.

     Hier wordt ook de HERKOMST vastgelegd: via welk bedrijf iemand binnenkwam.
     Dat stond nergens -- de uitnodiging wist wel wie hem inwisselde, maar het
     lid wist niet meer waar het vandaan kwam, en het RTG-kantoor dus ook niet.
     Het staat in member_state (versleuteld, zoals de rest van het dossier) en
     draagt de code en de naam van de zaak, nooit iets van een ander lid. */
  async function verbindLid(s, inv, lid, opties) {
    const pin = (opties && opties.pin) || accounts.makePin();
    const naam = inv.naam || accounts.realNameOf(lid) || 'Medewerker';
    const staff = await accounts.createStaff({ supplierCode: s.code, name: naam, role: inv.role,
      func: inv.func, pin, memberId: lid.id, memberTier: lid.tier });
    inv.used = true; inv.memberId = lid.id; inv.usedAt = new Date().toISOString();

    try {
      const st = accounts.getMemberState(lid.id) || {};
      /* Alleen de EERSTE herkomst blijft staan. Wie later bij een tweede zaak
         gaat werken is niet opnieuw lid geworden; die tweede werkgever hoort
         niet de aanbrenger te worden van een lid dat er al was. */
      if (!st.via) {
        st.via = { soort: 'zaak', code: s.code, naam: s.name, at: new Date().toISOString() };
        accounts.saveMemberState(lid.id, st);
      }
    } catch (e) { /* herkomst is boekhouding; geen reden de aanmelding te laten mislukken */ }

    save();
    logActivity(s.code, { name: naam, role: inv.role }, naam + ' meldde zich aan als teamlid (RTG-lid)');
    try { notifySupplier(s.code, { kind: 'team', text: naam + ' heeft zich aangemeld bij het team.' }); } catch (e) {}
    return { staff, naam, pin };
  }

  /* Een wervingscode inwisselen voor een lid dat er net is (registratie) of dat
     er al was. Levert null als er niets in te wisselen valt -- een verzonnen of
     verbruikte code is geen reden om een registratie te laten mislukken; het
     account is echt en de persoon is binnen, alleen de koppeling ontbreekt en
     die kan hij daarna nog leggen. Een halve registratie terugdraaien zou hem
     zonder account achterlaten met een verbruikte uitnodiging: de slechtste
     van de twee uitkomsten. */
  async function wisselCodeIn(lid, kassacode) {
    if (!lid || !kassacode) return null;
    try {
      const g = zoekInvite(kassacode);
      if (!g) return null;
      if (accounts.staffByMember(g.s.code, lid.id)) return null;
      const v = await verbindLid(g.s, g.inv, lid, {});
      return { code: g.s.code, bedrijf: g.s.name, staffId: v.staff.id, role: g.inv.role, pin: v.pin };
    } catch (e) { return null; }
  }

  /* Een AANGENOMEN sollicitant meteen in dienst nemen. Wie via de app
     solliciteerde heeft al een RTG-account -- daar solliciteerde hij mee, en
     a.key is de sleutel ervan. Hem dan een kassacode sturen met "meld u aan in
     de leverancier-app met bedrijfsnaam X en code Y" is een omweg langs
     gegevens die het systeem zelf al heeft, en precies de stap waar mensen op
     afhaken: de bedrijfsnaam moet exact kloppen, de code verloopt.

     Wie BUITEN de app solliciteerde (naam en telefoon, zonder account) levert
     hier null op en houdt de code plus de wervingslink -- die moet nog een
     account maken, en daar is de link nou juist voor. */
  async function neemAan(supplier, inv, sollicitatieKey) {
    const m = /^user-(\d+)$/.exec(String(sollicitatieKey || ''));
    if (!m) return null;
    try {
      const lid = accounts.getUserById(Number(m[1]));
      if (!lid || accounts.staffByMember(supplier.code, lid.id)) return null;
      const v = await verbindLid(supplier, inv, lid, {});
      return { staffId: v.staff.id, naam: v.naam };
    } catch (e) { return null; }
  }

  return { maakKassacode, invitesVan, findSupplierByName, maakInvite, wervingsLink,
    zoekInvite, verbindLid, wisselCodeIn, neemAan };
};

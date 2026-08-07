/* ========= HET GASTCONTACT VERHUIST NAAR DE KERN =========

   De derde voorraad, en de eerste waarin een LID en een ZAAK samen in een
   gesprek zitten: aan de ene kant een codenaam, aan de andere kant een
   bedrijf. Precies het gesprek waarvoor ./wie.js is gemaakt -- en precies het
   gesprek waar een fout twee kanten op lekt.

   Dezelfde drie regels als bij ./dm.js en ./collega.js: een gesprek per lijn
   uit de kern, de geschiedenis eenmalig mee op het moment dat de lijn toch al
   wordt geopend, en de oude voorraad blijft staan.

   DRIE DINGEN ZIJN HIER EIGEN, en alle drie zouden ze stil misgaan:

   1. DE AFDELING HOORT BIJ HET GESPREK. Een hotel heeft Receptie,
      Roomservice, Housekeeping, Onderhoud en Security, en dat waren vijf
      aparte lijnen -- de oude sleutel was CODE|lid|afdeling. Vallen ze samen,
      dan leest Housekeeping mee met wat je aan Security schreef. De sleutel
      draagt de afdeling dus mee, letterlijk dezelfde als vroeger, zodat
      importeer() de oude lijn ook terugvindt.

   2. TWEE TELLERS, EEN PER KANT. unreadGuest en unreadPartner. De kern houdt
      "gelezen tot" per DEELNEMER bij, dus dat komt vanzelf goed -- zolang je
      ze ook echt als twee behandelt. Een gedeelde stand zou de ene kant een
      badge geven die van de andere was.

   3. HET SYSTEEMBERICHT HEEFT GEEN AFZENDER. "U heeft nu een open lijn met X"
      stond er als from:'systeem'. De kern EIST dat een afzender deelnemer is
      -- dat is de poort, en die zetten we niet open voor een uitzondering.
      Dus staat de zaak eronder, met soort 'systeem', en gaat het in de oude
      vorm weer als 'systeem' naar buiten. Eerlijker dan een lege afzender:
      de regel gaat over die zaak en komt uit haar systeem.

   WAT HIER NIET IN ZIT: de controles en de bijwerking eromheen. Of de gastchat
   aanstaat bij deze zaak, of het lid geen gast is, de vertaling, de melding
   aan het personeel en het activiteitenlog -- dat blijft in de routes
   (member/terplaatse.js en supplier/gastcontact.js) staan. Die gaan over de
   zaak en niet over berichten. */
'use strict';

const wie = require('./wie');

const MAX_TEKST = 500;      // zoals de oude routes hem afkapten

function maakCommGast({ db, save, comm }) {
  const codeVan = (c) => String(c || '').trim().toUpperCase();
  // exact de oude sleutel (kern/leverancier/gastcontact.js, chatKeyOf)
  const lijnSleutel = (code, key, dept) => codeVan(code) + '|' + key + '|' + (dept || 'Team');
  const zaakVan = (code) => wie.zaak(code);

  /* De vertaling tussen de twee vormen, op EEN plek. `from` was de kant van
     het gesprek ('guest' | 'partner' | 'systeem'); in de kern is dat de
     afzender plus, voor de systeemregel, het soort. */
  const kantVan = (m, lidKey) => (m.soort === 'systeem' ? 'systeem' : (m.van === lidKey ? 'guest' : 'partner'));

  const oudeVorm = (m, lidKey) => ({
    id: m.id, from: kantVan(m, lidKey), who: m.who || '',
    text: m.tekst || '', lang: m.lang || null, at: m.at
  });

  function importeer(gesprek, code, lidKey, dept) {
    if (!gesprek || gesprek.meta.oudBinnen) return gesprek;
    gesprek.meta.oudBinnen = new Date().toISOString();
    let oud = null;
    try { oud = (db.data.guestChats || {})[lijnSleutel(code, lidKey, dept)]; } catch (e) {}
    const berichten = (oud && Array.isArray(oud.messages)) ? oud.messages : [];
    if (berichten.length) {
      /* Rechtstreeks in de voorraad van de kern en niet via comm.bericht():
         die zet elk bericht op NU, en dan ziet een gesprek van vorig jaar
         eruit alsof het vanmiddag gebeurde. Geen migratie maar een
         vervalsing, en niet terug te draaien. */
      const lijst = comm.berichtenVan(gesprek.id);
      for (const m of berichten) {
        if (!m || !m.text) continue;
        const systeem = m.from === 'systeem';
        lijst.push({
          id: 'brc_oud_' + (lijst.length + 1) + '_' + gesprek.id.slice(-6),
          van: (m.from === 'guest') ? lidKey : zaakVan(code), door: null,
          at: m.at || gesprek.op,
          tekst: String(m.text).slice(0, 4000),
          soort: systeem ? 'systeem' : 'tekst',
          who: m.who || '', antwoordOp: null, bijlage: null,
          lang: m.lang || null, reacties: {}
        });
      }
      lijst.sort((x, y) => String(x.at || '').localeCompare(String(y.at || '')));
      const laatste = lijst[lijst.length - 1];
      if (laatste && laatste.at > gesprek.laatst) gesprek.laatst = laatste.at;
      /* De tellers omrekenen naar "gelezen tot", per kant. Ging dit mis, dan
         springt bij iedereen elk oud gesprek op ongelezen: een stapel rode
         bolletjes die niemand heeft veroorzaakt. */
      leesUitTeller(lijst, gesprek, lidKey, zaakVan(code), (oud && oud.unreadGuest) || 0);
      leesUitTeller(lijst, gesprek, zaakVan(code), lidKey, (oud && oud.unreadPartner) || 0);
    }
    save();
    return gesprek;
  }

  /* `n` ongelezen betekende: de laatste n berichten VAN DE ANDER heeft deze
     kant niet gezien. Dus terugtellen tot je er n voorbij bent, en "gelezen
     tot" op het bericht daarvoor zetten. Staat de teller op nul, dan is alles
     gelezen -- en dat is juist de kant die je moet zetten, want zonder
     tijdstip telt de kern ALLES van de ander als ongelezen. */
  function leesUitTeller(lijst, gesprek, mij, ander, aantal) {
    const n = Math.max(0, Number(aantal) || 0);
    let gezien = 0;
    for (let i = lijst.length - 1; i >= 0; i--) {
      if (lijst[i].van === mij) continue;      // eigen berichten tellen niet mee
      if (gezien >= n) { comm.leesZet(mij, gesprek.id, lijst[i].at); return; }
      gezien++;
    }
    // de ander schreef minder dan de teller beweert: alles blijft ongelezen
  }

  /* De lijn tussen dit lid en deze zaak, voor deze afdeling. De enige ingang.
     `soort: 'order'` zet hem in de la Onderweg van de inbox -- het gaat over
     iets dat loopt -- en `meta` draagt wat het scherm nodig heeft. */
  function gesprek(code, lidKey, dept, opties) {
    const o = opties || {};
    const c = codeVan(code);
    const g = comm.gesprekMaak({
      soort: 'order', deelnemers: [String(lidKey), zaakVan(c)], door: String(lidKey),
      titel: o.zaakNaam || null,
      meta: { sleutel: 'gast:' + lijnSleutel(c, lidKey, dept), zaak: c,
        dept: dept || 'Team', bron: 'Zaak', codename: o.codename || null,
        /* De pas van het lid reist mee omdat de zaak-route er een melding op
           adresseert. Hij hoort bij de LIJN en niet bij een los record in een
           tweede voorraad -- anders is er weer een plek die dit weet. */
        tier: o.tier || null }
    });
    if (o.codename && g.meta.codename !== o.codename) g.meta.codename = o.codename;
    if (o.tier && g.meta.tier !== o.tier) g.meta.tier = o.tier;
    return importeer(g, c, String(lidKey), dept);
  }

  /* De lijn OPZOEKEN zonder hem aan te leggen, en dat verschil is een
     beveiliging en geen netheid. Er hangt een controle aan ("een zaak mag de
     Salon van een lid alleen zien als er echt een open lijn is"), en die valt
     om zodra de vraag zelf de lijn aanlegt: dan bestaat elke lijn die je
     noemt. Een verzonnen sleutel was zo genoeg geweest om het profiel van elk
     lid op te vragen.

     Een lijn die alleen nog in de OUDE voorraad staat, telt wel als bestaand
     -- die is er immers echt; hij is alleen nog niet verhuisd. Daarom eerst
     daar kijken, en pas dan in de kern. */
  function bestaand(code, lidKey, dept) {
    const c = codeVan(code);
    let oud = null;
    try { oud = (db.data.guestChats || {})[lijnSleutel(c, lidKey, dept)]; } catch (e) {}
    if (oud) return gesprek(c, lidKey, dept);
    return comm.gesprekMetSleutel('gast:' + lijnSleutel(c, lidKey, dept));
  }

  /* Sturen, per kant. Twee functies en geen vlag: wie stuurt bepaalt de
     afzender, en dat is niet iets wat je aan een parameter wilt ophangen die
     iemand per ongeluk andersom zet. */
  function stuurGast(code, lidKey, dept, tekst, codename, opties) {
    return stuur(code, lidKey, dept, tekst, String(lidKey), codename, opties);
  }
  function stuurZaak(code, lidKey, dept, tekst, wieSchreef, opties) {
    return stuur(code, lidKey, dept, tekst, zaakVan(code), wieSchreef, opties);
  }
  function stuur(code, lidKey, dept, tekst, van, who, opties) {
    const o = opties || {};
    const g = gesprek(code, lidKey, dept, { codename: o.codename, tier: o.tier });
    const m = comm.bericht({ gesprekId: g.id, van,
      tekst: String(tekst == null ? '' : tekst).slice(0, MAX_TEKST), lang: o.lang || null });
    /* `who` -- de voornaam van wie er namens de zaak antwoordde -- stond ook in
       de oude vorm en gaat mee zoals hij ging. Het is geen deelnemer en geen
       codenaam; het scherm van de gast toonde hem al. */
    if (who) { m.who = String(who).slice(0, 60); save(); }
    return oudeVorm(m, String(lidKey));
  }

  /* De openingsregel van een nieuwe lijn. Van de zaak, met soort 'systeem'. */
  function opening(code, lidKey, dept, tekst, opties) {
    const g = gesprek(code, lidKey, dept, opties);
    const lijst = comm.berichtenVan(g.id);
    if (lijst.length) return null;                 // er staat al iets: geen opening meer
    const m = comm.bericht({ gesprekId: g.id, van: zaakVan(code), tekst: String(tekst || '').slice(0, MAX_TEKST) });
    m.soort = 'systeem';
    save();
    return oudeVorm(m, String(lidKey));
  }

  function berichten(code, lidKey, dept, hoeveel) {
    const g = gesprek(code, lidKey, dept);
    const lijst = comm.berichtenVan(g.id).filter((m) => !m.weg);
    return lijst.slice(-(hoeveel || 120)).map((m) => oudeVorm(m, String(lidKey)));
  }

  const ongelezenGast = (code, lidKey, dept) =>
    comm.gesprek(String(lidKey), gesprek(code, lidKey, dept).id, { aantal: 500 }).ongelezen;
  const ongelezenZaak = (code, lidKey, dept) =>
    comm.gesprek(zaakVan(code), gesprek(code, lidKey, dept).id, { aantal: 500 }).ongelezen;

  function leesGast(code, lidKey, dept) {
    comm.leesZet(String(lidKey), gesprek(code, lidKey, dept).id, new Date().toISOString()); save();
  }
  function leesZaak(code, lidKey, dept) {
    comm.leesZet(zaakVan(code), gesprek(code, lidKey, dept).id, new Date().toISOString()); save();
  }

  /* ------------------------------------------------- de lijsten

     Het zaakscherm en de gegevensuitvoer van een lid lazen allebei
     rechtstreeks in db.data.guestChats. Nu lezen ze hier, en dat is meer dan
     een verplaatsing: de zaak krijgt ALLEEN de gesprekken waar haar eigen
     sleutel in zit, en dat is dezelfde poort die de rest van de kern gebruikt
     -- geen filter op een veld dat iemand kan vergeten.

     MAAR EERST DIT, EN HET IS DE BELANGRIJKSTE REGEL VAN DIT BESTAND.

     De import gebeurt per lijn, op het moment dat die lijn wordt geopend. Dat
     is bij ./dm.js en ./collega.js precies goed: daar is de lijst opgebouwd
     uit iets anders (de vriendenlijst, de personeelslijst) en wordt elke lijn
     onderweg aangeraakt. Hier niet. Een lijst die rechtstreeks uit de kern
     komt, ziet alleen wat al verhuisd IS -- en de lijst is nu juist de enige
     manier om een gesprek te openen.

     Het gevolg zou zijn: op de dag van de verhuizing staat het gastenscherm
     van elke zaak LEEG, en elk gesprek lijkt weg. Niet stuk, niet te
     herstellen door te wachten -- gewoon onbereikbaar, want de deur die je
     nodig hebt om te importeren is de deur die je niet meer kunt vinden.

     Vandaar dat de lijst zijn eigen voorraad eerst binnenhaalt. Begrensd tot
     wat bij DEZE zaak of DIT lid hoort, dus het blijft een verhuizing op
     aanraking en geen script over de hele database. */
  function haalBinnen(mij, filter) {
    let oud = null;
    try { oud = db.data.guestChats || {}; } catch (e) { return; }
    /* Wat er AL is, in een keer opgehaald. Zonder deze verzameling zou elke
       oude regel opnieuw langs gesprekMaak() gaan om te ontdekken dat hij er
       al staat -- en die zoekt zelf ook de hele lijst af. Op een scherm dat
       bij elke verversing langskomt is dat het verschil tussen een wandeling
       en een wandeling per stap. */
    const binnen = new Set();
    for (const g of comm.inbox(mij, {}).gesprekken) {
      const kern = comm.gesprekVan(g.id);
      if (kern && kern.meta && kern.meta.sleutel) binnen.add(kern.meta.sleutel);
    }
    for (const [sleutel, chat] of Object.entries(oud)) {
      const stuk = String(sleutel).split('|');
      if (stuk.length < 3 || !chat) continue;
      const [code, lidKey, dept] = [stuk[0], stuk[1], stuk.slice(2).join('|')];
      if (!filter(code, lidKey)) continue;
      if (binnen.has('gast:' + lijnSleutel(code, lidKey, dept))) continue;
      gesprek(code, lidKey, dept, { codename: chat.codename || null });
    }
  }

  function voorZaak(code) {
    const c = codeVan(code), mij = zaakVan(c);
    haalBinnen(mij, (k) => codeVan(k) === c);
    const uit = [];
    for (const g of comm.inbox(mij, {}).gesprekken) {
      const kern = comm.gesprekVan(g.id);
      if (!kern || !kern.meta || kern.meta.bron !== 'Zaak') continue;
      const lidKey = kern.deelnemers.find((d) => d !== mij) || '';
      const lijst = comm.berichtenVan(g.id).filter((m) => !m.weg);
      if (!lijst.length) continue;
      const laatste = lijst[lijst.length - 1];
      uit.push({ key: 'gast:' + lijnSleutel(c, lidKey, kern.meta.dept), gesprekId: g.id,
        codename: kern.meta.codename || g.titel, dept: kern.meta.dept || 'Team',
        unread: g.ongelezen, last: String(laatste.tekst || '').slice(0, 60),
        lastFrom: kantVan(laatste, lidKey), lastAt: g.at });
    }
    return uit.sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || '')));
  }

  /* Alles wat dit lid met zaken besproken heeft, voor de gegevensuitvoer
     (routes/member/privacy.js). Die uitvoer is een RECHT en geen extraatje:
     mist er een gesprek, dan is het antwoord op "wat heeft u van mij"
     onvolledig, en dat merkt niemand tot het te laat is. */
  function voorLid(lidKey) {
    const uit = {};
    haalBinnen(String(lidKey), (c, k) => k === String(lidKey));
    for (const g of comm.inbox(String(lidKey), {}).gesprekken) {
      const kern = comm.gesprekVan(g.id);
      if (!kern || !kern.meta || kern.meta.bron !== 'Zaak') continue;
      const sleutel = lijnSleutel(kern.meta.zaak, lidKey, kern.meta.dept);
      uit[sleutel] = {
        supplierCode: kern.meta.zaak, customerKey: String(lidKey),
        codename: kern.meta.codename || null, tier: kern.meta.tier || null,
        dept: kern.meta.dept || 'Team', lastAt: g.at,
        messages: comm.berichtenVan(g.id).filter((m) => !m.weg).map((m) => oudeVorm(m, String(lidKey)))
      };
    }
    return uit;
  }

  return { gesprek, bestaand, stuurGast, stuurZaak, opening, berichten, oudeVorm,
    ongelezenGast, ongelezenZaak, leesGast, leesZaak, voorZaak, voorLid, lijnSleutel };
}

module.exports = { maakCommGast };

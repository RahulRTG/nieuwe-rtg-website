/* ============== DE BRONNEN: wat er al was, in dezelfde inbox ==============

   De kern (./index.js) is het model waar alles naartoe hoort. Maar er staan al
   gesprekken in dit huis die er niet in zitten: sollicitatie-chats, de
   Berichtenbox van MijnOverheid, het gastcontact met een zaak, en het
   doorlopende gesprek met Rahul zelf. Die staan in hun eigen voorraden, met
   hun eigen vorm, en ze zijn niet stuk -- ze horen alleen thuis in dezelfde
   lijst.

   TWEE MANIEREN OM DAT OP TE LOSSEN, en de keuze is hier belangrijk.

   Je kunt ze MIGREREN: alles overzetten naar het nieuwe model en de oude
   voorraad opruimen. Dat is waar het naartoe moet, en voor de priveberichten
   tussen leden is het ook precies wat er gebeurd is (zie sociaal/vrienden:
   die schrijven nu in de kern). Maar migreren van vier voorraden tegelijk,
   elk met een eigen module die er ook nog in schrijft, is vier keer de kans
   om berichten kwijt te raken in een ronde waarin niemand dat merkt totdat
   iemand iets terugzoekt.

   Of je kunt ze LEZEN waar ze staan, en ze in de inbox laten meelopen als wat
   ze zijn: gesprekken met een soort, een titel en een laatste regel, met een
   weg naar de app waar ze wonen. Dat is wat hier gebeurt. Het is eerlijk over
   wat het is -- deze gesprekken zijn nog niet van de kern, en dat zie je ook:
   je leest ze hier, je beantwoordt ze daar.

   Zo is de Universal Inbox vanaf dag een waar, zonder dat er een migratie
   nodig is die niemand durft te doen. Elke bron die later wel overgaat,
   verdwijnt gewoon uit dit bestand.

   REGEL: een bron SCHRIJFT NIET ZELF. Hij mag wel een bericht DOORGEVEN aan
   de module die de voorraad beheert -- en dat verschil is het hele punt. Een
   sollicitatiechat beantwoorden gaat via de werk-module, met haar eigen
   controles (is dit jouw sollicitatie?), haar eigen vertaallaag en haar eigen
   melding aan de werkgever. Dit bestand kopieert daar niets van; het roept aan.

   Zonder dat doorgeven was de ene app voor deze kanalen weer een leeslijst:
   je zag dat er iets lag en werd naar een andere app gestuurd om te antwoorden
   -- precies wat er hiervoor mis was. Met een eigen schrijfweg zou hij de
   tweede schrijver op een voorraad zijn, en dat is de splitsing die we aan het
   opheffen zijn. Doorgeven is de enige vorm die allebei vermijdt. */
'use strict';

const MAX_PER_BRON = 40;

function maakBronnen({ db, codenaamVan, convOf, overheid, rtmail, werk, zaak }) {
  const snij = (t, n) => String(t == null ? '' : t).slice(0, n || 140);

  /* Elke bron levert dezelfde vorm als comm.toonGesprek(), plus `extern: true`
     zodat de app weet dat hier gelezen en niet geantwoord wordt. De id draagt
     zijn herkomst (`bron:...`), want een id uit de kern en een id uit een bron
     mogen nooit door elkaar lopen. */
  function rij(o) {
    return {
      id: 'bron:' + o.id, extern: true, soort: o.soort, lade: o.lade,
      titel: o.titel, deelnemers: [], aantal: 2,
      laatste: snij(o.laatste), laatsteVanMij: false,
      at: o.at || null, ongelezen: o.ongelezen || 0,
      vast: false, stil: false, weg: false, concept: null, online: false,
      bron: o.bronnaam, link: o.link
    };
  }

  /* 1. Rahul zelf. Het doorlopende gesprek in de leden-app is het enige
        gesprek dat iedereen heeft, en het hoort dus ook gewoon in de lijst --
        niet als los icoon ergens anders. */
  function rahul(mij, account) {
    if (!account || !convOf) return [];
    let laatste = null;
    try {
      const conv = convOf(account.id) || [];
      laatste = conv[conv.length - 1] || null;
    } catch (e) { return []; }
    return [rij({
      id: 'rahul', soort: 'ai', lade: 'rahul', titel: 'Rahul',
      laatste: laatste ? snij(laatste.text) : 'Stel me gerust een vraag.',
      at: laatste ? laatste.at : null, bronnaam: 'Rahul', link: '/apps/app.html'
    })];
  }

  /* 2. De Berichtenbox van MijnOverheid. Officiele post, en die hoort zichtbaar
        te zijn zonder dat je een aparte app opent om te ontdekken dat er iets
        ligt. */
  function overheidBox(mij) {
    if (!overheid) return [];
    try {
      const box = overheid.berichten(mij) || {};
      const eerste = (box.berichten || [])[0];
      if (!eerste) return [];
      return [rij({
        id: 'overheid', soort: 'government', lade: 'officieel',
        titel: 'Berichtenbox (MijnOverheid)', laatste: eerste.titel,
        at: eerste.at, ongelezen: box.ongelezen || 0,
        bronnaam: 'Overheid', link: '/apps/overheid.html'
      })];
    } catch (e) { return []; }
  }

  /* 3. De sollicitatie-chats. Een gesprek met een bedrijf over een vacature is
        een zakelijk gesprek, en dus hoort het in de la Zaken -- niet in een
        tabblad binnen de werk-app waar je het alleen vindt als je er al was. */
  function sollicitaties(mij) {
    const uit = [];
    try {
      for (const c of Object.values(db.data.applyChats || {})) {
        if (!c.applicant || c.applicant.kind !== 'rtg' || c.applicant.key !== mij) continue;
        const b = (c.berichten || [])[(c.berichten || []).length - 1];
        uit.push(rij({
          id: 'werk:' + (c.id || c.vacId), soort: 'business', lade: 'zaken',
          titel: (c.bedrijf || 'Werkgever') + ' · ' + (c.func || 'sollicitatie'),
          laatste: b ? b.tekst : 'Nog geen bericht.', at: b ? b.at : null,
          bronnaam: 'Werk', link: '/apps/app.html'
        }));
      }
    } catch (e) {}
    return uit.slice(0, MAX_PER_BRON);
  }

  /* 4. Het gastcontact met een zaak: de lijn tussen een lid en een horeca- of
        winkelbedrijf waar hij besteld heeft. Dat is de la Onderweg -- het gaat
        over iets dat loopt. */
  function zaken(mij) {
    const uit = [];
    try {
      for (const [sleutel, chat] of Object.entries(db.data.guestChats || {})) {
        if (!sleutel.includes(mij)) continue;
        const berichten = chat.messages || chat.berichten || [];
        const b = berichten[berichten.length - 1];
        if (!b) continue;
        uit.push(rij({
          id: 'zaak:' + sleutel, soort: 'order', lade: 'onderweg',
          titel: chat.zaakNaam || chat.naam || 'Een zaak',
          laatste: b.text || b.tekst, at: b.at,
          bronnaam: 'Zaak', link: '/apps/app.html'
        }));
      }
    } catch (e) {}
    return uit.slice(0, MAX_PER_BRON);
  }

  /* Alles bij elkaar. De volgorde doet er niet toe -- de inbox sorteert zelf
     op tijd -- maar de bronnen wel: valt er een om, dan vallen de andere niet
     mee. Vandaar dat elke bron zijn eigen try/catch heeft en een lege lijst
     teruggeeft in plaats van de hele inbox mee te slepen. */
  function alles(mij, account) {
    return [].concat(rahul(mij, account), overheidBox(mij), sollicitaties(mij), zaken(mij));
  }

  /* ---------------- open en beantwoorden, via de module ----------------

     De id draagt zijn herkomst ('bron:werk:123'), dus hier is precies te zien
     welke module het is en welk gesprek. Wat een bron NIET kan, zegt hij ook:
     de Berichtenbox van de overheid is eenrichtingsverkeer en Rahul heeft zijn
     eigen scherm. Een invoerveld tonen bij iets waar je niet op kunt
     antwoorden is erger dan geen invoerveld. */
  function ontleed(bronId) {
    const kaal = String(bronId || '').replace(/^bron:/, '');
    const i = kaal.indexOf(':');
    return { soort: i < 0 ? kaal : kaal.slice(0, i), sleutel: i < 0 ? '' : kaal.slice(i + 1) };
  }

  /* De berichten in de vorm van de kern, zodat de app er geen tweede
     tekenroutine voor nodig heeft. */
  const alsBericht = (m, mij) => ({
    id: m.id || null, at: m.at, vanMij: !!m.vanMij, van: m.van || '',
    tekst: m.tekst == null ? null : String(m.tekst), soort: 'tekst',
    bijlage: null, antwoordOp: null, reacties: [], gewijzigd: null, was: null,
    lang: m.lang || null, weg: null
  });

  function open(mij, bronId, lang) {
    const b = ontleed(bronId);
    if (b.soort === 'werk' && werk) {
      const chat = (db.data.applyChats || {})[b.sleutel];
      if (!chat || !chat.applicant || chat.applicant.key !== mij) return null;
      return {
        titel: (chat.bedrijf || 'Werkgever') + ' \u00b7 ' + (chat.func || 'sollicitatie'),
        /* Waar een antwoord heen moet: de eigen route van de werk-module, met
           de velden die zij verwacht. De app post daar rechtstreeks naartoe --
           zo blijft die route de enige ingang op deze voorraad, met al haar
           controles, en staat er hier niets nagebouwd. */
        antwoord: { pad: '/api/member/apply/chat/send', vast: { id: b.sleutel }, veld: 'text' },
        berichten: (chat.berichten || []).map((m) => alsBericht({
          at: m.at, vanMij: m.van === 'sollicitant', van: m.van === 'sollicitant' ? 'Ik' : (chat.bedrijf || 'Werkgever'),
          tekst: m.tekst, lang: m.lang
        }, mij))
      };
    }
    if (b.soort === 'zaak' && zaak) {
      const chat = (db.data.guestChats || {})[b.sleutel];
      if (!chat || !String(b.sleutel).includes(mij)) return null;
      return {
        titel: chat.zaakNaam || chat.naam || 'Een zaak',
        antwoord: { pad: '/api/partner/chat/send',
          vast: { supplierCode: chat.supplierCode || null, dept: chat.dept || null }, veld: 'text' },
        berichten: (chat.messages || []).map((m) => alsBericht({
          at: m.at, vanMij: m.from === 'guest', van: m.from === 'guest' ? 'Ik' : (chat.zaakNaam || 'De zaak'),
          tekst: m.text, lang: m.lang
        }, mij))
      };
    }
    /* De rest is te lezen in de lijst en verder niet: officiele post is
       eenrichtingsverkeer, en Rahul heeft zijn eigen scherm. */
    return null;
  }

  return { alles, open, ontleed };
}

module.exports = { maakBronnen };

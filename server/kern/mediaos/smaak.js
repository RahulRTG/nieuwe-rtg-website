/* Media OS (deelmodule): DE SMAAK, EN WAAROM U IETS ZIET.

   Dit is de enige plek in de Media OS die zelf iets bewaart over een lid, en
   dat is met opzet klein: wat u ZELF heeft gezegd. Geen kijkgedrag, geen
   afspeelduur, geen stil meegeschreven profiel. Wie meer Afrobeat wil, zegt
   dat; wie een maker nooit meer wil zien, zegt dat ook. Daardoor kan het
   scherm bij ELK stuk uitleggen waarom het er staat, en klopt die uitleg ook.

   DRIE DINGEN DIE HIER NIET GEBEUREN, en dat is geen tekortkoming:

   1. Geen volgorde op populariteit. Klankwerk, Theater en Clips weigeren die
      alle drie met zoveel woorden; een laag erboven die stiekem toch op
      kijkcijfers sorteert, draait die keuze terug zonder dat iemand het ziet.
   2. Geen oneindige lijst. De wereld is eindig en zegt waar hij ophoudt.
   3. Geen verborgen afweging. Elke rij draagt een `waarom` die uit DEZE code
      komt en niet uit een tekstje ernaast (regel 6: een belofte in tekst is
      een belofte in code).

   De banden zijn de hele "aanbeveling": gevolgde makers eerst, dan wat u zelf
   als "meer" heeft aangewezen, dan de rest op datum. Wat u op "minder" zet
   zakt naar achteren, wat u op "nooit" zet valt eruit -- geteld, niet stil. */
'use strict';

const RICHTINGEN = ['meer', 'minder', 'nooit', 'reset'];

function maakSmaak({ db, save, schoon }) {
  const nu = () => new Date().toISOString();

  function tabel() {
    if (!db.data.mediaSmaak || typeof db.data.mediaSmaak !== 'object') db.data.mediaSmaak = {};
    return db.data.mediaSmaak;
  }
  function leeg() {
    return { makers: {}, onderwerpen: {}, nooitMakers: [], nooitOnderwerpen: [], verras: false, at: null };
  }
  function van(key) {
    const t = tabel();
    const s = t[key] && typeof t[key] === 'object' ? t[key] : leeg();
    // altijd een volledige vorm terug, ook als er ooit iets half is opgeslagen
    return Object.assign(leeg(), s, {
      makers: s.makers || {}, onderwerpen: s.onderwerpen || {},
      nooitMakers: Array.isArray(s.nooitMakers) ? s.nooitMakers : [],
      nooitOnderwerpen: Array.isArray(s.nooitOnderwerpen) ? s.nooitOnderwerpen : []
    });
  }

  /* Bijsturen. Eén knop per bedoeling, en elke knop is omkeerbaar: "reset" op
     dezelfde maker of hetzelfde onderwerp haalt precies dit signaal weer weg.
     Een reset zonder doel wist het hele profiel -- dat mag, het is van u. */
  function stuur(key, opdracht) {
    const o = opdracht || {};
    const richting = String(o.richting || '');
    if (!RICHTINGEN.includes(richting) && richting !== 'verras')
      return { status: 400, error: 'Kies: meer, minder, nooit, verras of reset.' };
    const t = tabel();
    const s = van(key);
    const maker = schoon(o.maker, 60) || '';
    const onderwerp = schoon(o.onderwerp, 40) || '';

    if (richting === 'verras') {
      s.verras = o.aan !== false;
    } else if (richting === 'reset' && !maker && !onderwerp) {
      t[key] = leeg(); t[key].at = nu(); save();
      return { status: 200, ok: true, smaak: t[key], gedaan: 'Uw hele smaakprofiel is gewist.' };
    } else {
      if (!maker && !onderwerp) return { status: 400, error: 'Zeg erbij om welke maker of welk onderwerp het gaat.' };
      const veld = maker ? 'makers' : 'onderwerpen';
      const nooit = maker ? 'nooitMakers' : 'nooitOnderwerpen';
      const naam = maker || onderwerp;
      s[nooit] = s[nooit].filter(x => x !== naam);
      if (richting === 'meer') s[veld][naam] = 1;
      else if (richting === 'minder') s[veld][naam] = -1;
      else if (richting === 'nooit') { delete s[veld][naam]; s[nooit].push(naam); }
      else delete s[veld][naam];
    }
    s.at = nu();
    t[key] = s; save();
    return { status: 200, ok: true, smaak: s,
      gedaan: uitlegVanZet(richting, maker || onderwerp) };
  }

  function uitlegVanZet(richting, naam) {
    if (richting === 'verras') return 'Verrassen staat aan: stukken waar u nog niets van heeft gezegd komen naar voren.';
    if (richting === 'meer') return 'Meer van ' + naam + '. U ziet het per stuk terug in de uitleg.';
    if (richting === 'minder') return 'Minder van ' + naam + '. Het verdwijnt niet, het zakt naar achteren.';
    if (richting === 'nooit') return naam + ' valt weg uit uw wereld. Dat kunt u hier ook weer terugdraaien.';
    return 'Uw voorkeur voor ' + naam + ' is weggehaald.';
  }

  /* De sortering. Geeft elke rij een band (0 = hoogst) en een `waarom`, en
     zegt erbij hoeveel er door de eigen regels van het lid is weggelaten. */
  function orden(rijen, s, volgt) {
    const nooitM = new Set(s.nooitMakers), nooitO = new Set(s.nooitOnderwerpen);
    const weg = [];
    const houd = [];
    for (const r of rijen) {
      const mk = (r.maker || {}).codenaam || '';
      if (nooitM.has(mk)) { weg.push({ id: r.id, reden: 'u wilt niets van ' + mk }); continue; }
      if (r.onderwerp && nooitO.has(r.onderwerp)) { weg.push({ id: r.id, reden: 'u wilt niets over ' + r.onderwerp }); continue; }
      houd.push(r);
    }
    const gemerkt = houd.map(r => {
      const mk = (r.maker || {}).codenaam || '';
      const ow = r.onderwerp || '';
      const gevolgd = r.volgIk === true || volgt.has(mk);
      const meer = s.makers[mk] === 1 || (ow && s.onderwerpen[ow] === 1);
      const minder = s.makers[mk] === -1 || (ow && s.onderwerpen[ow] === -1);
      const onbekend = !gevolgd && !meer && !minder && !s.makers[mk] && !(ow && s.onderwerpen[ow]);
      let band = 2, waarom = 'Nieuw binnengekomen; verder weet ik niets van uw smaak hier.';
      if (gevolgd) { band = 0; waarom = 'U volgt ' + mk + '.'; }
      else if (meer) { band = 1; waarom = 'U vroeg om meer ' + (s.makers[mk] === 1 ? mk : ow) + '.'; }
      else if (s.verras && onbekend) { band = 1; waarom = 'U vroeg om verrassing: hier weet ik nog niets van u.'; }
      if (minder) { band = 3; waarom = 'U vroeg om minder ' + (s.makers[mk] === -1 ? mk : ow) + '; daarom staat het achteraan.'; }
      if (r.mijn) waarom = 'Van uzelf.';
      return Object.assign({}, r, { band, waarom });
    });
    gemerkt.sort((a, b) => a.band - b.band || String(b.at || '').localeCompare(String(a.at || '')));
    return { rijen: gemerkt, weggelaten: weg };
  }

  /* Wat het scherm als regelaars laat zien: precies de knoppen die `stuur`
     ook echt kent. Eén lijst, twee gebruikers (regel 4). */
  const regelaars = () => ([
    { richting: 'meer', naam: 'Meer hiervan', doel: 'maker of onderwerp' },
    { richting: 'minder', naam: 'Minder hiervan', doel: 'maker of onderwerp' },
    { richting: 'nooit', naam: 'Nooit meer', doel: 'maker of onderwerp' },
    { richting: 'verras', naam: 'Verras me', doel: 'aan of uit' },
    { richting: 'reset', naam: 'Wis dit deel van mijn profiel', doel: 'maker, onderwerp of alles' }
  ]);

  return { smaakVan: van, smaakStuur: stuur, smaakOrden: orden, smaakRegelaars: regelaars, SMAAK_RICHTINGEN: RICHTINGEN };
}

module.exports = { maakSmaak, RICHTINGEN };

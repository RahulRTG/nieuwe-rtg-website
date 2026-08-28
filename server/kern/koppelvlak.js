/* RTG School: de Integration Fabric -- adapters eromheen, canoniek model binnen.

   Grens 12 uit SCHOOL.md: geen enkele externe standaard dicteert ons
   domeinmodel. Edu-V, Entree, Edu-API en OSO krijgen een adapter; andersom is
   permanente schade, want dan draagt onze administratie voorgoed de vorm van
   een koppelvlak dat over vijf jaar anders is.

   Deze module doet twee dingen en geen derde:

     naarBuiten -- ons model vertalen naar de velden van een standaard;
     naarBinnen -- velden van buiten terugbrengen tot ons model.

   De kaarten zelf staan in ./koppelvlak-kaarten.js, met per veld waar de naam
   vandaan komt. Dat is bewust een apart bestand: dit hier is het mechaniek,
   dat daar is het bewijs.

   DRIE HARDE REGELS.

   1. WAT WIJ NIET KENNEN, KOMT ER NIET IN. Een veld van buiten dat niet op de
      kaart staat, wordt GEWEIGERD en gemeld -- niet meegenomen "voor later".
      Zo groeit ons model niet stilletjes mee met wat een leverancier stuurt.
   2. WAT EEN STANDAARD NIET KAN, STAAT ERBIJ. Elke kaart draagt een lijst
      `kanNiet`. Dat is de zin die het verschil maakt tussen eerlijk in de code
      en oneerlijk in een verkooppraatje: wie deze adapter gebruikt, hoort van
      tevoren te weten wat er onderweg verdwijnt.
   3. EEN ONGECONTROLEERDE VELDNAAM REIST NOOIT ZONDER DAT ETIKET. Elk antwoord
      draagt `bevestigd` en een lijst `onbevestigd`. Een vertaling die er
      gecontroleerd uitziet terwijl niemand de specificatie heeft gelezen, is
      erger dan geen vertaling: daar bouwt de volgende iemand op.

   WAT DIT NIET IS. Er wordt hier niets verstuurd en niets opgehaald; er is geen
   verbinding met Edu-V of Entree. Dit is de VERTALING, en die is los te
   toetsen -- maar alleen de Entree-kaart is tegen een specificatie gehouden.
   Zolang er geen echte koppeling staat, hoort er ook niet te worden gedaan
   alsof. */
const { STANDAARDEN } = require('./koppelvlak-kaarten');

const kies = (standaard) => STANDAARDEN[String(standaard || '')] || null;
const onbekend = () => ({ status: 400,
  error: 'Deze standaard kennen we niet. Bekend: ' + Object.keys(STANDAARDEN).join(', ') + '.' });

/* Een veld dat helemaal niet op de kaart staat. Of dat betekent "de standaard
   kent dit niet" hangt ervan af of iemand die standaard heeft gelezen; bij een
   ongelezen specificatie is "kent hij niet" zelf een gok. */
function buitenDeKaart(s) {
  return s.gelezen
    ? 'Dit gegeven kent ' + s.naam + ' niet.'
    : 'Dit gegeven staat niet op onze kaart, en die kaart is niet tegen de specificatie gehouden. Of ' + s.naam + ' het kent, weten wij dus niet.';
}

/* De staat van een vertaling. Bevestigd vraagt TWEE dingen: de specificatie is
   gelezen, EN elke veldnaam die meereist is nagekeken. Een kaart met een half
   nagekeken naam is niet half betrouwbaar maar onbetrouwbaar, en een kaart uit
   een specificatie die niemand heeft geopend is dat helemaal -- ook als er
   toevallig geen veld meereist. */
function staatVan(s, onbev) {
  const bevestigd = !!s.gelezen && onbev.length === 0;
  const reden = [];
  if (!s.gelezen) reden.push('de specificatie van ' + s.naam + ' is nooit gelezen (' + s.bron + ')');
  if (onbev.length) reden.push(onbev.length + (onbev.length === 1 ? ' veldnaam is' : ' veldnamen zijn') + ' niet nagekeken; welke, staat in de lijst onbevestigd');
  return { bevestigd,
    onbevestigd: onbev,
    bron: s.bron,
    waarschuwing: bevestigd ? null
      : reden.join(', en ') + '. Zolang dat zo is, is dit geen koppeling maar een voorstel.' };
}

/* Ons model naar buiten. Velden die de standaard niet kent, gaan niet mee en
   worden GEMELD -- stil weglaten is hoe gegevens onderweg verdwijnen zonder
   dat iemand het merkt. */
function naarBuiten(canoniek, standaard) {
  const s = kies(standaard);
  if (!s) return onbekend();
  const uit = {}, weg = [], onbev = [];
  for (const [veld, waarde] of Object.entries(canoniek || {})) {
    const r = Object.prototype.hasOwnProperty.call(s.heen, veld) ? s.heen[veld] : null;
    if (r && r.veld) {
      uit[r.veld] = waarde;
      if (r.staat !== 'bevestigd') onbev.push({ veld, extern: r.veld, waarom: r.waarom });
      continue;
    }
    weg.push({ veld, waarom: r ? r.waarom : buitenDeKaart(s), staat: r ? r.staat : (s.gelezen ? 'bevestigd' : 'onbevestigd') });
  }
  return Object.assign({ ok: true, standaard, naam: s.naam, velden: uit, weggelaten: weg, kanNiet: s.kanNiet,
    uitleg: 'Wat ' + s.naam + ' niet kan dragen, staat hierboven. Een koppeling die dat verzwijgt, laat de ontvanger denken dat hij alles heeft.' },
  staatVan(s, onbev));
}

/* Van buiten naar binnen. Alles wat niet op de kaart staat wordt geweigerd en
   gemeld; ons model groeit niet mee met wat een leverancier stuurt. */
function naarBinnen(extern, standaard) {
  const s = kies(standaard);
  if (!s) return onbekend();
  const terug = {};
  for (const [veld, r] of Object.entries(s.heen)) if (r && r.veld) terug[r.veld] = { veld, r };
  const uit = {}, geweigerd = [], onbev = [];
  for (const [naam, waarde] of Object.entries(extern || {})) {
    const t = Object.prototype.hasOwnProperty.call(terug, naam) ? terug[naam] : null;
    if (!t) { geweigerd.push({ veld: naam, waarom: 'Dit veld staat niet op onze kaart en wordt niet overgenomen.' }); continue; }
    uit[t.veld] = waarde;
    if (t.r.staat !== 'bevestigd') onbev.push({ veld: t.veld, extern: naam, waarom: t.r.waarom });
  }
  return Object.assign({ ok: true, standaard, naam: s.naam, velden: uit, geweigerd,
    uitleg: 'Geweigerde velden zijn niet bewaard "voor later": ons model volgt geen koppelvlak. Hoort een veld er wel bij, dan komt het op de kaart en niet in een uitzondering.' },
  staatVan(s, onbev));
}

/* `staatVan` staat in de uitvoer omdat hij anders niet te beproeven is. Sinds
   20 augustus 2026 zijn alle vier de kaarten nagekeken, dus de regel "een
   ongelezen specificatie is nooit bevestigd" heeft geen voorbeeld meer in de
   echte data -- en een regel zonder voorbeeld is een regel die je niet hebt
   zien werken. Met een verzonnen kaart is hij wel te beproeven; zie
   test/overdracht.test.js. */
module.exports = { naarBuiten, naarBinnen, STANDAARDEN, staatVan };

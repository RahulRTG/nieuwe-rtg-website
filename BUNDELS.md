# De bundeldelen

**Dit bestand wordt voortgebracht door `node scripts/deelindex.js`.** Wijzig het
niet met de hand; wijzig de onderwerpregel bovenin het deel zelf.

Vijftig bundels in `public/` worden aan de browser geserveerd als één bestand en
bewerkt als losse delen. `test/bundeldelen.test.js` bewaakt dat die twee niet
uiteenlopen; deze index zegt waar je moet zijn. Een deel zonder onderwerp staat
er als een liggend streepje; de meter `delenZonderOnderwerp` in `NORM.json` telt ze en mag alleen
omlaag.

**50 bundels, 396 delen, 0 zonder onderwerp.**

## `apps/app-main.js`

`public/apps/app-main/` -- 84 delen, 8886 regels in de delen

| deel | onderwerp |
|---|---|
| `app-main-01.js` | de bouwstempel: HTML en script moeten van dezelfde bouw zijn (function(){ /* HTML EN SCRIPT MOETEN VAN DEZELFDE BOUW... |
| `app-main-02.js` | de API-laag van de app: elke aanroep met token, taal en foutafhandeling if (!API.token) return; try { const res = awa... |
| `app-main-02a.js` | de demomelding: een demo is een toestand, geen terugval na een storing const explicieteDemo = magnaatProef \|\| zoekPar... |
| `app-main-02b.js` | pas-thema (kleuren van de website) |
| `app-main-03.js` | de stem van de pas: welke koppen en teksten bij RTG, Lifestyle of Business horen const s = pasStem(); return s 'busin... |
| `app-main-04.js` | inloggen en de staat binnenhalen: token, pas en het eerste scherm API.token = t; try { applyState((await API.call('/s... |
| `app-main-04a.js` | Vervolg van app-main-04: de compositieregels van de poort (een kolom: klok, lippen, aanspreking, veld) |
| `app-main-04aa.js` | De koekjesmelding hoort niet midden in de kennismaking |
| `app-main-04ab.js` | Slotstuk van de poortstijl: de brede-schermregels, en daarna pas het insluiten van het blad |
| `app-main-04b.js` | Vervolg van app-main-04: de poort-inhoud (mond, zin, invoerveld, passkey) en het gesprek erachter |
| `app-main-05.js` | een zin, geen logboek: Rahuls woorden vervangen elkaar rustig function zeg(wie, tekst){ if (wie !== 'rahul') return;... |
| `app-main-06.js` | het gesprek met Rahul: versturen, wachten en het antwoord tonen async function stuur(){ const tekst = inp.value.trim(... |
| `app-main-07.js` | het contactenblok op het beginscherm, met de lege staat if (!conns.length && !reqs.length){ html += '<div class="big"... |
| `app-main-08.js` | de onboarding: het paspoort scannen of een bestand kiezen onbActies([ { txt: T('onb.scan','Scan je paspoort'), prim:... |
| `app-main-09.js` | de storyrij bovenaan De Salon let h = '<div style="display:flex;gap:.6rem;overflow-x:auto;padding:.2rem 0 .7rem;">';... |
| `app-main-09a.js` | de contactpin: je eigen code, als tekst en als QR |
| `app-main-09a2.js` | de levende code en de aan/uit-schakelaar |
| `app-main-09b.js` | dm async function openDm(key, naam){ dmWith = key; dmNaam = naam; $('#dmNaam').textContent = naam; |
| `app-main-10.js` | de directe berichten: versturen en aan het gesprek toevoegen $('#dmInput').value = ''; try { const d = await API.call... |
| `app-main-11.js` | het videogesprek: aanbod, antwoord en de verbinding if (d.kind 'accept'){ const pc = maakPc(); const offer = await pc... |
| `app-main-12.js` | de meldingenlijst en het ongelezen-merk list.innerHTML = R.notifications.length ? R.notifications.map(x => '<div clas... |
| `app-main-12a.js` | De opbouw van het beginscherm: het vangnet, de melding als er iets leeg blijft, en de volgorde eerst-beeld-dan-gegevens |
| `app-main-12b.js` | De tickets van het lid: het aanbod en wat hij al heeft |
| `app-main-13.js` | het ticketkanaal: partners, activiteiten en hun tijden for (const p of tkPartners){ html += '<div class="card"><b>'+e... |
| `app-main-14.js` | het zorgaanbod: klinieken, behandelingen en het medische onderscheid for (const a of aanb){ const medisch = a.soort '... |
| `app-main-14a.js` | verzorging: de kapper, de barbier en de nagelstudio |
| `app-main-14b.js` | de zorgpakketten: wat er loopt en wat er te kiezen valt function renderCarePakketten(){ const el = $('#carePakketten'... |
| `app-main-15.js` | de knoppen onder een zorgpakket: betalen en openen el.querySelectorAll('[data-carepakpay]').forEach(x => x.addEventLi... |
| `app-main-16.js` | het voertuigkanaal: partners en hun auto's for (const p of vhPartners){ html += '<div class="card"><b>'+esc(p.name)+'... |
| `app-main-17.js` | het chauffeurskanaal: vaste prijzen per partner let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-... |
| `app-main-18.js` | een bezichtiging aanvragen bij een vastgoedpartner document.querySelectorAll('[data-vgint]').forEach(b => b.addEventL... |
| `app-main-19.js` | een auto kopen of inruilen, met een bod el.querySelectorAll('.js-vkkoop').forEach(b => b.addEventListener('click', as... |
| `app-main-20.js` | de bazaar van een partner: producten en bestellen el.innerHTML = '<button class="bz-btn" id="bzTerug" style="margin-b... |
| `app-main-21.js` | mijn bestellingen: betalen en volgen $('#myOrders').querySelectorAll('.myorder').forEach(el => { const o = active.fin... |
| `app-main-22.js` | het boekingsblad: de diensten van een partner kiezen $('#boekBody').innerHTML = (s.vak ? '<div style="font-size:0.72r... |
| `app-main-23.js` | de lopende rekening bij een partner opvragen API.call('/rekening', { supplierCode: code }).then(d => { const r = d.re... |
| `app-main-24.js` | Veiligheid en verbinding |
| `app-main-24a2.js` | Afgesplitst van app-main-24.js, dat over de 10 KB ging |
| `app-main-24b.js` | Afgesplitst van app-main-24.js, dat over de 10 KB ging toen "Mijn loon" erbij kwam |
| `app-main-25.js` | de algemene pin: zetten of vragen API.call('/pin/status', {}).then(st => { const zetten = !st.gezet; belTitel.textCon... |
| `app-main-25b.js` | Mappen, gebruik en het bouwen van de tegels |
| `app-main-26.js` | de taakbalk: welke knop welk tabblad opent if (item.startsWith('tab:')) { const svg = tabKnop(item.slice(4)) && tabKn... |
| `app-main-26b.js` | Rahuls signatuurmond in de balk onderaan het beginscherm |
| `app-main-27.js` | een map hernoemen op het springboard setTimeout(() => { hernoemIn.focus(); hernoemIn.select(); }, 60); } if (hernoemO... |
| `app-main-27b.js` | Afgesplitst van app-main-27.js, dat over de 10 KB ging |
| `app-main-28.js` | het springboard verslepen, met vinger en met muis grid.addEventListener('pointerdown', e => { const el = e.target.clo... |
| `app-main-29.js` | de realtime-verbinding starten en herstellen RTGRealtime.start = (token, opts) => { opts = opts \|\| {}; const oud = op... |
| `app-main-29b.js` | het gesprek met Rahul op het beginscherm |
| `app-main-29c.js` | de werelden aanreiken aan de bank van RTG Command |
| `app-main-30.js` | de app-regie van de boardroom: uitgezette apps verdwijnen van het springboard bouw(); |
| `app-main-31.js` | Achtergrond (wallpaper) in het bedieningspaneel |
| `app-main-31c.js` | Onderweg: de live reis })(); })(); /* Onderweg (live reis) |
| `app-main-32.js` | het live-paneel: van modus wisselen $('#livePanel').querySelectorAll('[data-mode]').forEach(b => b.addEventListener('... |
| `app-main-33.js` | een asset herroepen binnen de bedenktijd el.querySelectorAll('.js-asherroep').forEach(b => b.addEventListener('click'... |
| `app-main-34.js` | mijn zorgprofiel el.innerHTML = '<div class="live-start" style="margin-top:0.8rem;">' + '<div class="lh">' + T('zorg.... |
| `app-main-35.js` | betalen met Face ID vanuit een rekeningregel document.querySelectorAll('.js-rpay').forEach(b => b.addEventListener('c... |
| `app-main-36.js` | een verblijf tonen: foto's en kamers if (s.photos && s.photos.length) head += '<div class="ms-photos">' + s.photos.ma... |
| `app-main-37.js` | de deur van kamer of entree openen, en een kamer boeken const dk = $('#vbDeurKamer'); if (dk) dk.addEventListener('cl... |
| `app-main-38.js` | de artikelen van een partner, met drops die nog niet los zijn const now = Date.now(); html += (r.artikelen \|\| []).map... |
| `app-main-39.js` | de cv-kaart: klaar of nog niet el.innerHTML = '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:upp... |
| `app-main-40.js` | een chatbericht opmaken, met vertaling voor de ander const inner = mij ? escT(m.tekst) : '<span class="xlate">' + esc... |
| `app-main-41.js` | sparren met Rahul, en de geparkeerde gedachten catch(e){ toast(e.message); } })); |
| `app-main-42.js` | de verzoeken van partners om een niveau: u beslist if (open.length) html += open.map(v => '<div class="vbanner" style... |
| `app-main-43.js` | de betaalgeschiedenis van de gratis gebruiker if (user.account) loadSocial(); else { const c = $('#homeContacts'); if... |
| `app-main-44.js` | het gezinsblok: chatten en bellen met het gezin box.innerHTML='<div class="label">Chat en bellen</div>'+ '<div class=... |
| `app-main-45.js` | pushmeldingen aanzetten en de sleutel omzetten const raw=atob(b); const arr=new Uint8Array(raw.length); for(let i=0;i... |
| `app-main-46.js` | de details van een verzending catch(e){ if (det) det.innerHTML = '<div style="font-size:0.8rem;color:var(--burgundy);... |
| `app-main-47.js` | de zakelijke specificatie op een factuur const bizSpec = inv => { if (user.tier !== 'business') return ''; const tota... |
| `app-main-48.js` | alles in een keer betalen $('#payAllWrap').innerHTML = (open.length ? '<button class="btn-pay payall" id="payAll">' +... |
| `app-main-49.js` | het boekland van een zakelijk lid if (user.tier !== 'business'){ wrap.innerHTML = ''; return; } let land = 'NL'; try... |
| `app-main-50.js` | de antwoorden van Rahul op een bevestiging of een paklijst if (/^(ja\|graag\|ja graag\|doe maar\|prima\|goed\|regel het\|ja,... |
| `app-main-51.js` | een betaalpartner kiezen ov.querySelectorAll('.js-dppick').forEach(b => b.addEventListener('click', () => { const s =... |
| `app-main-52.js` | het zakelijke blad: feed en lijsten body.innerHTML = '<div style="color:var(--soft);font-size:0.8rem;padding:1rem 0;"... |
| `app-main-52b.js` | de reactieteller onder een bericht (k.reactiesTotaal ? '<div style="font-size:0.62rem;color:var(--soft);margin-top:0.... |
| `app-main-53.js` | de ballon op de boardroom-knop const btn = document.getElementById('boBtn'); if (!btn) return; btn.style.position = '... |
| `app-main-53b.js` | De Vooruit-kaart: uw termijnen, voor elke pas |
| `app-main-53c.js` | De post-voorstellen: datums die zichzelf aandienen |
| `app-main-54.js` | de Toestelkluis: eigen kopieen op het eigen toestel |
| `app-main-55.js` | het thema van de vaste pas if (vastePas 'rtg' \|\| vastePas 'lifestyle'){ const pasNaam = vastePas 'rtg' ? T('bo2.thema... |
| `app-main-56.js` | het zegel: aftellen en sluiten document.getElementById('zgSluit').addEventListener('click', sluitZegel); const eind =... |
| `app-main-57.js` | de zakelijke lade voor Business en Lifestyle if (user && (user.tier 'business' \|\| user.tier 'lifestyle')){ zakL.style... |
| `app-main-58.js` | de knoppen onder een Salon-bericht document.querySelectorAll('.post').forEach(el => { const post = posts.find(p => p.... |
| `app-main-59.js` | de afspraken en hun status for (const d of (s.dates \|\| [])){ const metNaam = escT(d.met); if (d.status 'wacht-op-teke... |
| `app-main-60.js` | van taal wisselen: alles opnieuw ophalen const tab = active ? active.tab : 'home'; // inhoud opnieuw ophalen in de ni... |

## `apps/backoffice.js`

`public/apps/backoffice/` -- 6 delen, 670 regels in de delen

| deel | onderwerp |
|---|---|
| `backoffice-01.js` | de backoffice: de basis (helpers, taal, elementen) (function(){ const $ = s => document.querySelector(s); const T = (... |
| `backoffice-01b.js` | backoffice, vervolg van deel 01 |
| `backoffice-01c.js` | backoffice, vervolg van deel 01b: DE VAKBEWIJZEN |
| `backoffice-02.js` | paspoort-incidenten: RTG beoordeelt of een opgeeiste identiteit vrijkomt |
| `backoffice-03.js` | Live meekijken bij een SOS: het lid stuurt een WebRTC-aanbod via de office- stream ('ontmoeting-signaal'); wij openen... |
| `backoffice-04.js` | De tijdlijn is schaalvast: de server bladert en zoekt door de volledige // historie; het scherm toont altijd 25 regel... |

## `apps/boardroom.js`

`public/apps/boardroom/` -- 2 delen, 290 regels in de delen

| deel | onderwerp |
|---|---|
| `boardroom-01.js` | De boardroom van het lid: haalt het schakelbord op (/api/member/boardroom) en laat elke functie aan/uitzetten |
| `boardroom-02.js` | Onderaan: wanneer dit bord voor het laatst veranderde |

## `apps/command.js`

`public/apps/command/` -- 16 delen, 2109 regels in de delen

| deel | onderwerp |
|---|---|
| `command-01.js` | RTG Command, deel 1: de schil |
| `command-02.js` | RTG Command, deel 2: het Command Center en de werkplek |
| `command-03.js` | RTG Command, deel 3: de zoekbalk over alles, en het objectdossier |
| `command-04.js` | RTG Command, deel 4: de operator en de uitzonderingenrij |
| `command-05.js` | RTG Command, deel 5: het herstel -- de runbooks, de rondes en de terugzetknop |
| `command-06.js` | RTG Command, deel 6: het beleid en de simulatie |
| `command-07.js` | RTG Command, deel 7: het toezicht -- agents en tijdelijke rechten |
| `command-08.js` | RTG Command, deel 8: de werkbesparing en het journaal -- de twee spiegels |
| `command-09.js` | RTG Command, deel 9: de gegevenskwaliteit en de kennisgraaf |
| `command-10.js` | RTG Command, deel 10: de servicedoelen met hun foutbudget, en de sonde |
| `command-11.js` | RTG Command, deel 11: de herkomst -- waar komt een gegeven vandaan en wie hangt ervan af |
| `command-12.js` | RTG Command, deel 12: de uitrol (canary) en de zandbak |
| `command-13.js` | RTG Command, deel 13: master data |
| `command-14.js` | RTG Command, deel 14: de overname |
| `command-15.js` | RTG Command, deel 15: koppelingen en landen |
| `command-16.js` | RTG Command, deel 16: de steden en het alarm |

## `apps/defensie.js`

`public/apps/defensie/` -- 2 delen, 176 regels in de delen

| deel | onderwerp |
|---|---|
| `defensie-01.js` | RTG Defensie: het commando- en logistiekscherm |
| `defensie-02.js` | het overzicht laden en de stand bijhouden async function laad() { const d = await api('def/overzicht'); STAND = d; |

## `apps/foundation/gezin-rt.js`

`public/apps/foundation/gezin-rt/` -- 2 delen, 169 regels in de delen

| deel | onderwerp |
|---|---|
| `gezin-rt-01.js` | GezinRT: chatten en (beeld)bellen tussen gezinsleden, in de app |
| `gezin-rt-02.js` | WebRTC bellen |

## `apps/foundation/samen.js`

`public/apps/foundation/samen/` -- 2 delen, 180 regels in de delen

| deel | onderwerp |
|---|---|
| `samen-01.js` | Samen voor de gezinsapps: een rustige meekijk-laag voor gezin en bevestigde vrienden |
| `samen-02.js` | Rahul voor het gezin: de kindveilige vraagbaak op elke RTF-pagina |

## `apps/foundation/sessie.js`

`public/apps/foundation/sessie/` -- 3 delen, 242 regels in de delen

| deel | onderwerp |
|---|---|
| `sessie-00.js` | Sessie: het gezin-account en het gekozen profiel, net als bij een streamingdienst |
| `sessie-01.js` | de sessie van de hulppas: lezen, actief en bewaren var Sessie = { huidig: lees, actief: function () { var s = lees();... |
| `sessie-02.js` | de ongelezen-teller telOngelezen(el); } }; |

## `apps/leverancier.js`

`public/apps/leverancier/` -- 105 delen, 9022 regels in de delen

| deel | onderwerp |
|---|---|
| `leverancier-01.js` | de leverancier-app: de basis (helpers, taal, elementen) (function(){ const $ = s => document.querySelector(s); const... |
| `leverancier-01b.js` | de partnercatalogus: welke zaken er in de demo bestaan { code:'LEXNOVA', name:'LexNova Advocaten & Notarissen', type:... |
| `leverancier-02.js` | de sector van een zaak bepalen if (!sup) return null; for (const k of Object.keys(SECTOR_DEF)){ if (!SECTOR_DEF[k].le... |
| `leverancier-03.js` | de sectorwissel en de tabbladen per sector location.replace(location.pathname + '?sector=' + doel); return true; } |
| `leverancier-03b.js` | de sectoriconen zorgbalie:{ label:'Zorgbalie', svg:'<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.4... |
| `leverancier-04.js` | het chatvenster met een partner let ov = document.getElementById('apchat'); if (ov) return ov; ov = document.createEl... |
| `leverancier-05.js` | aanmelden als medewerker bij een zaak msg.textContent = T('enr.busy','Bezig met aanmelden...'); try { const r = await... |
| `leverancier-06.js` | de personeelskiezer: wie ben jij if (fallback) list = all; spH2().textContent = mgmt ? T('sp.r.mgmt','Management') :... |
| `leverancier-07.js` | een account voor alles: partner kiezen en de staat toepassen if (pickCode) pickPartner(pickCode); else $('#staffPick'... |
| `leverancier-08.js` | de bonnenstatistiek van de kassa const oudste = ages.length ? Math.max.apply(null, ages) : 0; return '<div class="st-... |
| `leverancier-09.js` | de looplijst per station, op tijd gesorteerd out.sort((a, b) => a.due.localeCompare(b.due) \|\| (a.it.time.localeCompar... |
| `leverancier-10.js` | de bedieningspas: wat kan er nu gelopen worden, en waarheen if (stationMode 'bediening'){ /* De bedieningspas: wat ka... |
| `leverancier-10b.js` | de rittenkaart van een chauffeur '<div class="tkc-who">'+ritRegel(r)+(r.vehicle?' · '+r.vehicle.name+' ('+(r.vehicle.... |
| `leverancier-10c.js` | de straks-taken en de mise-en-place van vandaag }); const straksRows = Object.entries(straks).sort((a,b)=>a[1].min-b[... |
| `leverancier-11.js` | de keukenhulp: live advies van het model of de regelcoach el.innerHTML = html; bindStation(el); } |
| `leverancier-12.js` | de tafelstatus en het inchecken van gasten el.querySelectorAll('[data-sttbl]').forEach(b => b.addEventListener('click... |
| `leverancier-12a.js` | de btw-aangifte van de zaak (server: kern/fiscaal/btwaangifte.js) |
| `leverancier-12a1.js` | de btw-aangifte, deel 2: HET DETAIL van een aangifte |
| `leverancier-12b.js` | het vakwerk-dashboard (dienstverlenende genres): vandaag-bord, aanvragen, KPI's en AI let vakData = null, vakBusy = f... |
| `leverancier-13.js` | de secties van een taxi- of jetzaak if (type 'taxi' \|\| type 'jet') secs.push( ['ritten','\uD83D\uDDFA',T('kt.ritten',... |
| `leverancier-14.js` | de eigen backoffice van de zaak if (kantoorSec 'bo'){ // de eigen backoffice van de zaak, met dezelfde patronen als h... |
| `leverancier-14b.js` | de aandelen in een deal, en wie akkoord is const mij = d.aandelen.find(a => a.code mijnCode) \|\| {}; return '<div clas... |
| `leverancier-15.js` | de boekhouding van de zaak: btw, personeelskosten en cadeaukaarten if (kantoorSec 'fin'){ // de boekhouding van de za... |
| `leverancier-15c.js` | het thuiskantoor: de zaak als host op RTG Thuis if (kantoorSec 'thuis'){ // het THUIS-KANTOOR: de zaak als host op RT... |
| `leverancier-15d.js` | Een gezette handtekening terugtekenen: de paden staan in verhoudingen (0 tot 1), dus hij past op elk formaat |
| `leverancier-16.js` | het AI-weekrooster: een voorstel op de verwachte drukte if (kantoorSec 'hr'){ // het AI-weekrooster: voorstel op de v... |
| `leverancier-16z.js` | hr-plus: inwerken, groeigesprekken, certificaten en dienstjaren if (kantoorSec 'hr'){ // hr-plus (los script leveranc... |
| `leverancier-17.js` | de menukaart per station (keuken of bar) if (kantoorSec 'keuken' \|\| kantoorSec 'bar'){ const stn = kantoorSec; const... |
| `leverancier-18.js` | de events van de zaak if (kantoorSec 'events'){ const evs = state.events \|\| []; html += '<div class="tkc"><h3>'+T('kt... |
| `leverancier-19.js` | de minibar-catalogus if (kantoorSec 'minibar'){ const cat = (state.minibar && state.minibar.catalog) \|\| []; html += '... |
| `leverancier-20.js` | het tarief van de zaak if (kantoorSec 'tarief'){ const t2 = (state.settings && state.settings.tarief) \|\| {}; html +=... |
| `leverancier-20b.js` | Vakwerk Pro op het vandaag-bord: de functies waar vakbedrijven elders per maand voor betalen -- offertes, werkbonnen,... |
| `leverancier-20c.js` | Vakwerk Pro, tweede laag: vaste afspraken, wachtlijst, beoordelingen en de team-capaciteit -- ook dit elders betaalde... |
| `leverancier-21.js` | een prijs doorgeven aan RTG if (kantoorSec 'prijzen'){ const h = state.prices \|\| []; html += '<div class="tkc"><h3>'+... |
| `leverancier-22.js` | de instellingen van de zaak opslaan const fnS = el.querySelector('#fnSave'); if (fnS) fnS.addEventListener('click', a... |
| `leverancier-22a.js` | schakelaars van de zaak: elke functie aan of uit, direct doorgevoerd wireFuncBlok(el); bindWerkvenster(el); el.queryS... |
| `leverancier-22b.js` | binds van het THUIS-KANTOOR (sectie 'thuis' in het Kantoor) el.querySelectorAll('[data-thok]').forEach(b => b.addEven... |
| `leverancier-22c.js` | binds van de WERKVLOER (sectie 'werkvloer' in het Kantoor) el.querySelectorAll('[data-wvtab]').forEach(b => b.addEven... |
| `leverancier-23.js` | een medewerker uitnodigen const ktInvite = el.querySelector('#ktInvite'); if (ktInvite) ktInvite.addEventListener('cl... |
| `leverancier-24.js` | een reactie toevoegen aan een kaartrij el.querySelectorAll('[data-kradd]').forEach(b => b.addEventListener('click', a... |
| `leverancier-24b.js` | Vakwerk Pro: offertes beantwoorden, werkbonnen schrijven, klantnotities // bewaren en onderhoudsherinneringen sturen... |
| `leverancier-25.js` | vakwerk: werkdagen aan/uit tikken (lokaal, tot Opslaan) el.querySelectorAll('[data-vakdag]').forEach(b => b.addEventL... |
| `leverancier-26.js` | de weekbeschikbaarheid per dag const rows = DAG.map(d => { const slot = wv.dagen[d[0]] \|\| {}; return '<div class="st-... |
| `leverancier-27.js` | de weekbeschikbaarheid opslaan if (opslaan) opslaan.addEventListener('click', async () => { const dagen = {}; el.quer... |
| `leverancier-28.js` | panden html += '<div class="card"><div class="tt-h">'+T('vg.panden','Panden')+' ('+(vg.panden\|\|[]).length+')</div>'+... |
| `leverancier-29.js` | het aanmeldformulier aanpassen in gewone taal if (canEdit) h += '<div class="card" style="border-color:var(--gold);">... |
| `leverancier-30.js` | de boerderijkaart: dier of gewas, met zijn cijfers const o = boer, st = o.stats \|\| {}, isDier = o.kind !== 'gewas', i... |
| `leverancier-31.js` | Verkoop: producten (oogst vult de voorraad) en verkopen via de Salon html += '<div class="card"><div class="tt-h">'+T... |
| `leverancier-32.js` | de boerderij-AI: een vraag over het bedrijf const aiGo = $('#boerAiGo'); if (aiGo){ const doeAi = async () => { const... |
| `leverancier-33.js` | portfolio en trajecten van een creator const pfAdd = $('#crPfAdd'); if (pfAdd) pfAdd.addEventListener('click', async... |
| `leverancier-34.js` | creator: leveranciers vinden en open oproepen if (mk){ // CREATOR: leveranciers vinden + open oproepen html += '<div... |
| `leverancier-35.js` | de AI-factuurtool if (canEdit){ html += '<div class="card"><div class="tt-h">'+T('fact.ai','AI-factuurtool')+'</div>'... |
| `leverancier-36.js` | iets op de marktplaats plaatsen const plaatsBtn = $('#mktPlaatsBtn'); if (plaatsBtn) plaatsBtn.addEventListener('clic... |
| `leverancier-37.js` | de collecties van een retailzaak const cols = retailData.collecties \|\| []; html += '<div class="card"><div class="tt-... |
| `leverancier-38.js` | clienteling: het klantdossier van een retailzaak let html = '<div class="card"><div class="tt-h">'+T('rt.klantdossier... |
| `leverancier-39.js` | een artikel bewaren in de retailcatalogus if (artBewaar) artBewaar.addEventListener('click', async () => { const naam... |
| `leverancier-40.js` | incident melden html += '<div class="card"><div class="tt-h">'+T('pn.incident','Incident: identiteit opeisen')+'</div... |
| `leverancier-41.js` | de functies van een groothandel aan- en uitzetten el.querySelectorAll('.js-ghf').forEach(b => b.addEventListener('cli... |
| `leverancier-42.js` | de inkoop-AI: wat is er nodig bij deze groothandel const box = $('#inkai-'+code); if (box) box.innerHTML = '<p class=... |
| `leverancier-43.js` | een verkoopaanvraag aanvaarden of een tegenbod doen el.querySelectorAll('[data-vkact]').forEach(b => b.addEventListen... |
| `leverancier-44.js` | de statusknoppen van een vrachtzending if (z.status 'onderweg') acties += '<button data-vret="'+z.id+'" style="flex:1... |
| `leverancier-45.js` | een melding in het vrachtlogboek el.querySelectorAll('[data-vrmeld]').forEach(b => b.addEventListener('click', async... |
| `leverancier-46.js` | het gebouwbeheer: de knoppen en hun acties const doe = (sel, pad, body) => el.querySelectorAll('['+sel+']').forEach(b... |
| `leverancier-47.js` | de golfbaan: status en de winkel el.querySelectorAll('[data-gfbaan]').forEach(b => b.addEventListener('click', async... |
| `leverancier-48.js` | de kengetallen van een beautysalon let h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5... |
| `leverancier-49.js` | petcare: de acties op een verblijf const doe = (sel, pad, body) => el.querySelectorAll('['+sel+']').forEach(b => b.ad... |
| `leverancier-50.js` | de kengetallen van een jachthaven let h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5r... |
| `leverancier-51.js` | de kengetallen van een weddingplanner let h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(... |
| `leverancier-52.js` | de polis van een verzekeringszaak let d; try { d = await API.call('/supplier/polis'); } catch(e){ el.innerHTML = '<p... |
| `leverancier-53.js` | de skischool h += '<div class="st-sec h-mt100">'+T('al.school','De skischool')+'</div>'; h += d.groepslessen.map(l=>'... |
| `leverancier-54.js` | de pas-controle: alleen actief, pakket en codenaam h += '<div class="st-sec h-mt100">'+T('zp.check','Pas-controle')+'... |
| `leverancier-55.js` | de HR-cijfers op het zaakbord const hr = d.hr \|\| {}; h += '<div class="st-sec">'+T('zb.hr','HR')+'</div><div class="s... |
| `leverancier-55b.js` | Werkbeleid: wat staat er dicht op de passen van uw mensen? |
| `leverancier-55c.js` | "Vooruit": wat er op de zaak afkomt |
| `leverancier-55d.js` | De post-voorstellen van de zaak: datums die zichzelf aandienen |
| `leverancier-56.js` | een cel op het zaakbord, en de samenvatting van schakelaars function zbCel(n, label, waarschuw){ return '<div class="... |
| `leverancier-57.js` | de incidenten op het beveiligingsbord if (cmd.incidenten && cmd.incidenten.length){ h += '<div class="st-sec">'+T('be... |
| `leverancier-58.js` | alles opnieuw tekenen, en het actieve tabblad zichtbaar maken renderHome(); renderOrders(); renderRides(); renderMenu... |
| `leverancier-59.js` | een bestelkaart opbouwen const E = Util.el; return E('div', { class: 'order', dataset: { ref: o.ref } }, E('div', { c... |
| `leverancier-60.js` | een tafel afrekenen wrap.querySelectorAll('[data-tafelrek]').forEach(el => { const rekenAf = async (extra) => { try { |
| `leverancier-61.js` | een gerecht aan de menukaart toevoegen if (canEdit){ html += '<div class="card" style="margin-top:1.2rem;"><div class... |
| `leverancier-62.js` | de shift-samenvatting: het avondbriefingmoment laadShift(); } |
| `leverancier-63.js` | afrekenen, of op de kamer laten schrijven const rooms = state.rooms \|\| []; return '<div class="card"><div class="tt-h... |
| `leverancier-64.js` | de bon van de kassa naar een bestelling if (type 'restaurant'\|\|type 'bar'\|\|type 'club'){ const items = (state.menu\|\|[... |
| `leverancier-65.js` | een activiteit toevoegen of verwijderen document.querySelectorAll('[data-tkdel]').forEach(k => k.addEventListener('cl... |
| `leverancier-66.js` | de vloot van een voertuigzaak const autos = state.autos \|\| []; html += '<div class="card"><div class="tt-h">'+T('vh.v... |
| `leverancier-67.js` | lopende en geboekte charters html += '<div class="card"><div class="tt-h">'+T('ch.charters','Charters')+' ('+charters... |
| `leverancier-68.js` | een boot toevoegen of verwijderen document.querySelectorAll('[data-chdel]').forEach(k => k.addEventListener('click',... |
| `leverancier-69.js` | de receptie van vandaag el.innerHTML = '<div class="card"><div class="tt-h">'+T('rc.h','Receptie vandaag')+'</div>'+... |
| `leverancier-70.js` | de kamerkalender el.innerHTML = '<div class="card"><div class="tt-h">'+T('rc.plan','Kamerkalender')+' <span class="su... |
| `leverancier-71.js` | een bericht van de zaak verder plaatsen el.querySelectorAll('[data-dpost]').forEach(elp => { const knop = elp.querySe... |
| `leverancier-72.js` | de minibar tellen, per kamer const items = Object.entries(mbQty).filter(([,q]) => q > 0).map(([id, qty]) => ({ id, qt... |
| `leverancier-73.js` | een uitgiftebundel openen el.querySelectorAll('[data-ugdl]').forEach(b => b.addEventListener('click', async () => { t... |
| `leverancier-74.js` | een gastlocatie stoppen el.querySelectorAll('[data-glstop]').forEach(b => b.addEventListener('click', async () => { t... |
| `leverancier-74b.js` | Afgesplitst van leverancier-74.js, dat over de 10 KB ging toen de drie berichtenlijsten er een werden |
| `leverancier-75.js` | De Salon is verplicht: de profielkaart met compleetheidsmeter if (salonStatus null){ laadSalonStatus(); } let html =... |
| `leverancier-76.js` | een foto uploaden bij de zaak const f = $('#phFile'); if (f) f.addEventListener('change', () => { const file = f.file... |
| `leverancier-77.js` | de paskamerverzoeken van een retailzaak const pk = wvRetail.paskamer \|\| []; html += '<div class="card"><div class="tt... |
| `leverancier-78.js` | de stijl van het zegelvenster const st = document.createElement('style'); st.id = 'rtg-zc-stijl'; st.textContent = [... |
| `leverancier-79.js` | de aanwezigheidsteller op nul zetten document.getElementById('awLeeg').addEventListener('click', async () => { if (!c... |
| `leverancier-80.js` | de AI-draad van de zaak renderAIThread(); try { const d = await API.call('/supplier/ai', { q }); |
| `leverancier-81.js` | het cv van een sollicitant die via RTG kwam const apCv = x => { if (!x.viaRTG \|\| !x.cv) return ''; const c = x.cv, pa... |
| `leverancier-82.js` | het alarmvenster let el = document.getElementById('alarmOverlay'); if (!el){ el = document.createElement('div'); |
| `leverancier-83.js` | de recepten en hun marges if (rec.length) h += '<div class="card"><div class="tt-h">'+T('vr.recepten','Recepten en ma... |
| `leverancier-84.js` | de meldingenlijst van de zaak $('#notifList').innerHTML = notifs.length ? notifs.map(n => '<div class="notif-item'+(n... |

## `apps/meldkamer.js`

`public/apps/meldkamer/` -- 4 delen, 480 regels in de delen

| deel | onderwerp |
|---|---|
| `meldkamer-01.js` | RTG Meldkamer: het werkscherm van de zes hulpdienst-korpsen |
| `meldkamer-02.js` | doorverwijzen naar een andere dienst if (z.verwijsDoelen && z.verwijsDoelen.length) { $('#kVerwijs').hidden = false;... |
| `meldkamer-03.js` | het ketengesprek if (!ktGekozen) { $('#ktChat').innerHTML = ''; return; } try { const g = await api('keten/gesprek',... |
| `meldkamer-04.js` | het gezamenlijke rampbeeld |

## `apps/notities/app.js`

`public/apps/notities/app/` -- 2 delen, 208 regels in de delen

| deel | onderwerp |
|---|---|
| `app-01.js` | RTG Notities & Taken, het scherm: het bord (vastgepind eerst), de editor voor notities en lijsten, vinkjes die meteen... |
| `app-02.js` | de editor |

## `apps/office/app.js`

`public/apps/office/app/` -- 8 delen, 899 regels in de delen

| deel | onderwerp |
|---|---|
| `app-01.js` | RTG Office, de app zelf: de drive en de schil om de drie editors heen |
| `app-01b.js` | de drive |
| `app-02.js` | openen |
| `app-02a.js` | tekstdocument |
| `app-02a2.js` | menselijke documentwerkstroom |
| `app-02b.js` | delen |
| `app-02c.js` | live samenwerking en documentbeleid |
| `app-03.js` | Rahul leest mee |

## `apps/office/blad.js`

`public/apps/office/blad/` -- 2 delen, 262 regels in de delen

| deel | onderwerp |
|---|---|
| `blad-01.js` | RTG Office, het rekenblad: het raster en wat je ziet |
| `blad-02.js` | de actieve cel: invoer, selectie en het blad invoer.value = data.cellen[ref] \|\| ''; Array.prototype.forEach.call(tabe... |

## `apps/personeel.js`

`public/apps/personeel/` -- 31 delen, 3056 regels in de delen

| deel | onderwerp |
|---|---|
| `personeel-01.js` | de personeelsapp: de basis (helpers, taal, elementen) (function(){ const $ = s => document.querySelector(s); const T... |
| `personeel-02.js` | de gebeurtenissen van vandaag: valet, jetset en bevestigingen (j.status 'aangevraagd' ? '<button class="abtn" data-pg... |
| `personeel-03.js` | de pas-controle html += '<div class="card"><div class="k">'+T('pd.pol.pas','Pas-controle')+'</div>'+ '<div style="dis... |
| `personeel-03a.js` | De vaste-PDA-ingang kent niet alleen de geseede demonstratiezaken |
| `personeel-03b.js` | Personeel, deel 3b: het oude inlogFORMULIER, nog als vangnet |
| `personeel-04.js` | Land (of wissel) naar een van de eigen werkplekken: sessie zetten en de app openen |
| `personeel-05.js` | aanmelden met de kassacode const go = async () => { $('#kaFout').textContent = ''; try { |
| `personeel-05a.js` | de dienstkeuze en de sectorstap $('#kaTerug').addEventListener('click', stepSector); const toonDienst = () => { $('#k... |
| `personeel-06.js` | de borden van dit personeelslid const wrap = $('#pdBordenWrap'); if (!wrap \|\| !window.BordenUI) return; if (pdBordenU... |
| `personeel-06a.js` | de voorspeller op de PDA: het team ziet de piek van morgen aankomen let vwPda = null, vwPdaBezig = false; function la... |
| `personeel-07.js` | in- en uitklokken const kb = document.getElementById('klokBtn'); if (kb) kb.addEventListener('click', async () => { k... |
| `personeel-08.js` | gevonden voorwerpen melden const lm = $('#lfMeld'); if (lm) lm.addEventListener('click', async () => { const item = $... |
| `personeel-09.js` | de gereedschappen op een bord tekenen const regel = (icoon, links, rechts, rood) => '<div style="display:flex;justify... |
| `personeel-10.js` | de dorpschat, en de leeftijdscheck die ja of nee zegt en nooit gegevens const pdc = wrap.querySelector('#pkDorpChat')... |
| `personeel-11.js` | de minibar boeken vanaf de kamer wrap.querySelectorAll('[data-mbboek]').forEach(b => b.addEventListener('click', asyn... |
| `personeel-12.js` | een teamtip plaatsen if (t.kanBeheren) { const titelInp = E('input', { placeholder: T('pd.tr.title', 'Titel, bijv |
| `personeel-13.js` | Fluister: de persoonlijke assistent, nooit gedeeld met de werkgever $('#hulpWrap').innerHTML = // Fluister: de persoo... |
| `personeel-14.js` | de flitszoeker if (pkfs) pkfs.addEventListener('click', () => { const inp = document.getElementById('pkFlIn'); const... |
| `personeel-15.js` | de afstand tot een opdracht, uit GPS if (!gpsPos \|\| !o.geo \|\| !Number.isFinite(o.geo.lat)) return null; return meters... |
| `personeel-15b.js` | -- de handlers van de bezorg-tab: inpakken, pakken, vertrekken, nemen -- const g = document.getElementById('pdGps');... |
| `personeel-15c.js` | DE WERKVLOER op de PDA: de telefoonkant van de koppellaag |
| `personeel-16.js` | de bezorg-AI: advies bij een rit document.querySelectorAll('[data-pdbzai]').forEach(b => b.addEventListener('click',... |
| `personeel-17.js` | de pas: wat er klaarstaat en wat er nog loopt if (pdaKant 'pas'){ const opDePas = live.filter(o => (o.stations\|\|{}).k... |
| `personeel-18.js` | van kant wisselen op het keukenbord wrap.innerHTML = html; wrap.querySelectorAll('[data-pkkant]').forEach(b => b.addE... |
| `personeel-19.js` | apart gelegd: de klant erbij pakken if (ap.length) html += '<div class="card"><div class="k">'+T('pd.w.apart','Apart... |
| `personeel-20.js` | de percelen en het oogsten if (perc.length) html += '<div class="card"><div class="k">'+T('pd.boer.perc','Percelen')+... |
| `personeel-21.js` | een verkoopslot kiezen wrap.querySelectorAll('[data-pdvk]').forEach(b => b.addEventListener('click', async () => { co... |
| `personeel-22.js` | de deals: koop of huur wrap.innerHTML = lijst.length ? lijst.map(d => { const koop = d.soort 'koop'; const knop = koop |
| `personeel-23.js` | het team van vandaag $('#teamWrap').innerHTML = (staff.length ? '<div class="card"><div class="k" style="display:flex... |
| `personeel-24.js` | het alarm: trillen en tonen setTimeout(() => el.classList.remove('on'), 8000); } |
| `personeel-25.js` | de ketenchat if (mkKeten && (mkKeten.kanalen \|\| []).length){ html += '<div class="card"><div class="k">'+T('pd.mk.ket... |

## `apps/residentie.js`

`public/apps/residentie/` -- 16 delen, 2027 regels in de delen

| deel | onderwerp |
|---|---|
| `residentie-01.js` | De Residence, deel 1: de staat, de isometrie en de zaal zelf (vloer, muren, sfeer) |
| `residentie-02.js` | deel 2: de meubels van RTG Maison en de gasten |
| `residentie-02b.js` | deel 2b: RTG Maison deluxe en de activiteiten |
| `residentie-02c.js` | deel 2c: het bal, de biljartkamer en de sterrenwacht |
| `residentie-03.js` | deel 3: de tekenlus, het netwerk en het gesprek |
| `residentie-03b.js` | deel 3b: samen spelen |
| `residentie-03c.js` | deel 3c: de vragen van het huis en de huistelefoon |
| `residentie-03d.js` | deel 3d: samen wandelen (het paar) |
| `residentie-03e.js` | deel 3e: de wereld speelt mee |
| `residentie-03f.js` | deel 3f: de speelschermen |
| `residentie-03g.js` | deel 3g: de baanscenes |
| `residentie-03h.js` | deel 3h: de zaalscenes |
| `residentie-03i.js` | deel 3i: de vloerscenes |
| `residentie-03j.js` | deel 3j: de renbaan-scene |
| `residentie-03k.js` | deel 3k: de spellenkast |
| `residentie-04.js` | deel 4: de gids, het suite-atelier en de start |

## `apps/rtg-protect.js`

`public/apps/rtg-protect/` -- 2 delen, 260 regels in de delen

| deel | onderwerp |
|---|---|
| `rtg-protect-01.js` | RTG contentbescherming: de DRM-route (Encrypted Media Extensions) plus de visuele guard uit rtg-protect.css |
| `rtg-protect-02.js` | het beveiligd-merk op het scherm var badge = document.createElement('div'); badge.className = 'rtgp-badge zicht'; bad... |

## `apps/rtgschool/leer.js`

`public/apps/rtgschool/leer/` -- 2 delen, 227 regels in de delen

| deel | onderwerp |
|---|---|
| `leer-01.js` | RTG School (leden), deel 1: het leerpaspoort op de officiële ladder, de leerlijn per groep of fase, de les in gewone... |
| `leer-02.js` | de leerlijn: vakken en doelen, met wat je al behaald hebt |

## `apps/schoolpartner/app.js`

`public/apps/schoolpartner/app/` -- 2 delen, 220 regels in de delen

| deel | onderwerp |
|---|---|
| `app-01.js` | RTG School Partner, het scherm: een werkbank voor directie en lerarenteam op de bestaande school-API's |
| `app-02.js` | leraar |

## `apps/techniek.js`

`public/apps/techniek/` -- 9 delen, 882 regels in de delen

| deel | onderwerp |
|---|---|
| `techniek-01.js` | de techniekpagina: de basis (function(){ var $ = function(s){ return document.querySelector(s); }; var el = Util.el,... |
| `techniek-01a.js` | eigenaarschap overdragen, en de modernisering door de AI /* eigenaarschap overdragen Bewust stroef: een bevestiging w... |
| `techniek-02.js` | de virusscanner beproeven met een EICAR-bestand api('/api/techniek/wacht/av-test', { method:'POST', body:{ inhoud:eic... |
| `techniek-02a-betalingen.js` | BETAALREGIE. IT begeleidt en beproeft; alleen de eigenaar kiest en zet |
| `techniek-02b.js` | DE CONTROLEKAMER -- afgesplitst uit techniek-02.js |
| `techniek-03.js` | een functie globaal aan- of uitzetten var schakel = el('button',{class:'schakel '+(f.aan?'aan':'uit'), disabled: wach... |
| `techniek-03a.js` | het doelgroepfilter met chips, en het zoeken erin /* doelgroep-filter (chips) + zoeken function chip(id, label, kleur... |
| `techniek-03c.js` | de automatische noodrem aan- of uitzetten if (noodremAan && !confirm('De automatische noodrem uitzetten? Bij een brut... |
| `techniek-04.js` | De laatste stand van het statusbord, zodat "meenemen" uit het EIGEN model leest en niet uit de kaartjes op het scherm |

## `apps/werkplek-bureaus.js`

`public/apps/werkplek-bureaus/` -- 2 delen, 223 regels in de delen

| deel | onderwerp |
|---|---|
| `werkplek-bureaus-01.js` | De ontwerptak van een huis: het atelier, de ontwerpstudio, het hardwarelab, het architectenbureau, de redactie en de... |
| `werkplek-bureaus-02.js` | De plank van dit huis: wat er nu echt in de verkoop staat |

## `shared/appmenu.js`

`public/shared/appmenu/` -- 6 delen, 635 regels in de delen

| deel | onderwerp |
|---|---|
| `appmenu-01.js` | HET APP-MENU: één hamburger, in de apps |
| `appmenu-02.js` | stijl /* De vormtaal van het bedieningspaneel (shared/bediening.js): een blad dat van onderen opkomt, donker, met een... |
| `appmenu-03.js` | de eigen functies /* Wat een app kan, staat al op zijn scherm |
| `appmenu-04.js` | de vaste functies function el(id) { return d.getElementById(id); } function klik(id) { var k = el(id); if (k) k.click... |
| `appmenu-05.js` | het blad var scrim = null, blad = null, knop = null, laatstFocus = null; |
| `appmenu-06.js` | de knop /* DE RTG-HEADERSTANDAARD: de hamburger staat LINKS, en verder niets |

## `shared/basis.js`

`public/shared/basis/` -- 4 delen, 545 regels in de delen

| deel | onderwerp |
|---|---|
| `basis-01.js` | De gedeelde basis-laag: het vangnet dat elke app-pagina op 9+-niveau houdt |
| `basis-01b.js` | Vervolg van basis-01 (op de 10 kB-grens geknipt na de thema-toevoeging van de consolidatieronde; de bundelvolgorde is... |
| `basis-01c.js` | de toegankelijkheidshelpers van de gedeelde laag var MELDPLEKKEN = '#toast,.toast,#melding,.melding,[data-toast],.sta... |
| `basis-02.js` | 5. het lopende werk: de gangreserve-laag van het huis |

## `shared/bediening.js`

`public/shared/bediening/` -- 2 delen, 202 regels in de delen

| deel | onderwerp |
|---|---|
| `bediening-01.js` | HET BEDIENINGSPANEEL -- één plek voor de instellingen van dit scherm |
| `bediening-02.js` | Deel 2 van het bedieningspaneel: de rijen, het blad en de ingang |

## `shared/borden.js`

`public/shared/borden/` -- 2 delen, 169 regels in de delen

| deel | onderwerp |
|---|---|
| `borden-01.js` | Het werkbord (Trello-stijl), als gedeelde module voor alle RTG-apps: de leverancier-app, de PDA en de Business Pass g... |
| `borden-02.js` | de knoppen op een bord binden function bind(b){ el.querySelectorAll('[data-open]').forEach(x => x.addEventListener('c... |

## `shared/bureaupda.js`

`public/shared/bureaupda/` -- 2 delen, 268 regels in de delen

| deel | onderwerp |
|---|---|
| `bureaupda-01.js` | DE BUREAU-PDA -- één scherm voor de drie ontwerpbureaus van de kantoren |
| `bureaupda-02.js` | De bureau-PDA, deel 2: de werking |

## `shared/clipdeler.js`

`public/shared/clipdeler/` -- 2 delen, 218 regels in de delen

| deel | onderwerp |
|---|---|
| `clipdeler-01.js` | DE CLIPDELER -- korte video's die het toestel van de maker nooit verlaten |
| `clipdeler-02.js` | de ontvangende kant van een gedeelde clip function kijkOntvang(d) { if (!ontvangst \|\| d.clipId !== ontvangst.clipId)... |

## `shared/deelmenu.js`

`public/shared/deelmenu/` -- 3 delen, 358 regels in de delen

| deel | onderwerp |
|---|---|
| `deelmenu-01.js` | Het deelmenu: een app-pagina met veel delen wordt een menu met EEN deel tegelijk, zoals een echt werksysteem -- in pl... |
| `deelmenu-02.js` | Het menu van DEZE ronde: de balk op het scherm plus de API die window.RTGDeel uitdeelt |
| `deelmenu-03.js` | DEEL 3: het menu in leven houden |

## `shared/drie.js`

`public/shared/drie/` -- 2 delen, 256 regels in de delen

| deel | onderwerp |
|---|---|
| `drie-01.js` | Drie: de kleine, huiseigen 3D-laag van RTG |
| `drie-02.js` | de buffers van een mesh naar de GPU function bufferVan(mesh) { var b = { pos: gl.createBuffer(), nor: gl.createBuffer... |

## `shared/geluid.js`

`public/shared/geluid/` -- 2 delen, 212 regels in de delen

| deel | onderwerp |
|---|---|
| `geluid-01.js` | RTG Geluid: de altijd-aanwezige geluidsmotor van het huis |
| `geluid-02.js` | audio-focus: wijken voor een ander geluid |

## `shared/glyf.js`

`public/shared/glyf/` -- 3 delen, 206 regels in de delen

| deel | onderwerp |
|---|---|
| `glyf-01.js` | RTG Glyfen: één gedeelde, ingetogen lijn-iconenset in huisstijl - de plek van de vroegere emoji op de app-tegels |
| `glyf-02.js` | elk glyf op een 24x24-raster; alleen paden/vormen, de <svg>-jas komt hieronder var P = { /* de telefoon-basis /* RTG... |
| `glyf-03.js` | De <svg>-jas als string (voor code die HTML samenstelt i.p.v |

## `shared/handenvrij-balk.js`

`public/shared/handenvrij-balk/` -- 3 delen, 315 regels in de delen

| deel | onderwerp |
|---|---|
| `handenvrij-balk-01.js` | Muisvrij bedienen, deel 2: de balk |
| `handenvrij-balk-01b.js` | Muisvrij bedienen, deel 2a: WAAR DE BALK VAN GEMAAKT IS |
| `handenvrij-balk-02.js` | Alles wat geen navigatie is, gaat hiernaartoe: onveranderd naar Rahul, met de eigen inlog |

## `shared/handenvrij-bureau.js`

`public/shared/handenvrij-bureau/` -- 2 delen, 256 regels in de delen

| deel | onderwerp |
|---|---|
| `handenvrij-bureau-01.js` | Muisvrij bedienen, deel 7: het bureaublad |
| `handenvrij-bureau-02.js` | de maat-greep rechtsonder in het gesprek var maat = document.createElement('div'); maat.className = 'hv-maat'; maat.s... |

## `shared/handenvrij-scherm.js`

`public/shared/handenvrij-scherm/` -- 2 delen, 201 regels in de delen

| deel | onderwerp |
|---|---|
| `handenvrij-scherm-01.js` | Muisvrij bedienen, deel 5: het scherm van Rahul zelf |
| `handenvrij-scherm-02.js` | iets anders staat op vol scherm |

## `shared/i18n.js`

`public/shared/i18n/` -- 4 delen, 703 regels in de delen

| deel | onderwerp |
|---|---|
| `i18n-00.js` | Automatische UI-vertaling voor de volledige RTG-schermfamilie |
| `i18n-01.js` | RTG i18n, taalkeuze + automatische detectie voor de website en alle apps |
| `i18n-02.js` | spreken: de eigen stem invullen en meteen laten herkennen const mic = scrim.querySelector('#rtg-lang-mic'); if (mic)... |
| `i18n-03.js` | De keuze mag nooit de pagina gijzelen: klik ernaast = huidige taal houden |

## `shared/ios.js`

`public/shared/ios/` -- 4 delen, 629 regels in de delen

| deel | onderwerp |
|---|---|
| `ios-01.js` | De iOS-laag, het gedrag |
| `ios-02.js` | Zoekvelden en filterrijen horen niet op de balk zelf maar eronder -- dat is waar Mail en Berichten ze zetten |
| `ios-02b.js` | Afgesplitst van ios-02.js, dat over de 10 KB ging toen de bijregels van de kop meeverhuisden |
| `ios-03.js` | de randveeg: vanaf de schermrand naar binnen vegen |

## `shared/klok.js`

`public/shared/klok/` -- 5 delen, 577 regels in de delen

| deel | onderwerp |
|---|---|
| `klok-01.js` | De RTG-klok: EEN klok voor het hele besturingssysteem |
| `klok-01b.js` | Vervolg van klok-01: het glas en de rest van de ringstijl |
| `klok-02.js` | de wijzerplaat tekenen svg.appendChild(n); return n; }; |
| `klok-02b.js` | de wijzers: slank, gepolijst goud met een lume-kanaal |
| `klok-03.js` | de wijzers laten draaien wijzers.appendChild(g); let vorige = null; return { draai: graden => { |

## `shared/klok3d.js`

`public/shared/klok3d/` -- 2 delen, 263 regels in de delen

| deel | onderwerp |
|---|---|
| `klok3d-01.js` | De RTG-klok als 3D-skelethorloge: een progressieve verrijking boven de bestaande wijzerplaat (shared/klok.js) |
| `klok3d-02.js` | kleur die meeademt met de dagkleur, maar goud blijft var goud = GOUD.slice(); try { var raw = getComputedStyle(ring).... |

## `shared/levendekleur.js`

`public/shared/levendekleur/` -- 2 delen, 281 regels in de delen

| deel | onderwerp |
|---|---|
| `levendekleur-01.js` | De levende grond van de hele ROS |
| `levendekleur-02.js` | toepassen |

## `shared/metgezel.js`

`public/shared/metgezel/` -- 7 delen, 768 regels in de delen

| deel | onderwerp |
|---|---|
| `metgezel-01.js` | De metgezel: Rahul + Samen, op elke app-pagina |
| `metgezel-01b.js` | de stijl en de bouwstenen van de metgezel '.rahul-leeg-knop:hover{background:var(--gold,#857007);color:#0C0C0B;}'; va... |
| `metgezel-01b2.js` | Afgesplitst van metgezel-01b.js, dat over de 10 KB ging |
| `metgezel-01c.js` | HET BLOK VAN RAHUL: het antwoord boven, de balk eronder, en de ruimte die de pagina ervoor vrijhoudt |
| `metgezel-01d.js` | RAHUL STAAT NERGENS OVERHEEN -- OOK NIET OVER EEN VASTE LAAG |
| `metgezel-02.js` | Rahul heeft een melding: de lippen verkleuren en bewegen |
| `metgezel-03.js` | Lege-toestand-nudge: elke plek met data-rahul-leeg="opdracht" opent Rahul met die opdracht al ingevuld |

## `shared/mond.js`

`public/shared/mond/` -- 3 delen, 396 regels in de delen

| deel | onderwerp |
|---|---|
| `mond-01.js` | De RTG-signatuurmond: EEN mond voor het hele systeem, nu in 3D |
| `mond-01b.js` | vanaf hier: alleen in de browser |
| `mond-02.js` | 2D-terugval: hetzelfde gezicht, dezelfde spraak, zonder WebGL |

## `shared/qr.js`

`public/shared/qr/` -- 2 delen, 353 regels in de delen

| deel | onderwerp |
|---|---|
| `qr-01.js` | RTG QR: een eigen QR-code-codec (encode + decode), i.p.v |
| `qr-02.js` | de zigzag: de bits in de QR-matrix leggen var n = M.n, idx = 0, dir = -1, col = n - 1; while (col > 0) { if (col 6) c... |

## `shared/rahulpoort.js`

`public/shared/rahulpoort/` -- 2 delen, 257 regels in de delen

| deel | onderwerp |
|---|---|
| `rahulpoort-01.js` | DE RAHUL-POORT -- inloggen als een gesprek, ook op de werkschermen |
| `rahulpoort-02.js` | het gesprek in stappen function gesprek(el, opt) { if (!el \|\| !opt \|\| !opt.stappen \|\| !opt.stappen.length) return nul... |

## `shared/rtg-schil.js`

`public/shared/rtg-schil/` -- 8 delen, 729 regels in de delen

| deel | onderwerp |
|---|---|
| `01-kern.js` | RTG Spatial Shell: de laag die van de desktop een werkruimte maakt |
| `02-indeling.js` | de indeling -- De console is het ANKER en schuift naar waar hij het minst stoort (WERKRUIMTE.md par |
| `03-surfaces.js` | surfaces -- function open(id, opties) { opties = opties \|\| {}; var bestaand = vind(id); |
| `04-slepen.js` | verplaatsen -- function sleep(s, ev) { var m = meet(); var start = s.el.getBoundingClientRect(); |
| `05-context.js` | context linking -- De shell stuurt alleen een VERWIJZING rond: soort, id, label |
| `06-werkruimtes.js` | werkruimtes -- Stap 5 uit WERKRUIMTE.md |
| `06b-objecten.js` | objecten tussen apps -- Stap 7 uit WERKRUIMTE.md |
| `07-start.js` | opstarten -- Dit deel sluit de omhulsel-functie af en hangt RTGSchil op |

## `shared/rtghorloge.js`

`public/shared/rtghorloge/` -- 4 delen, 474 regels in de delen

| deel | onderwerp |
|---|---|
| `rtghorloge-01.js` | Het RTG-signatuurhorloge: een compleet, opengewerkt (skeleton) horloge dat naast de Rahul-lippen het tweede gezicht v... |
| `rtghorloge-02.js` | toegepaste baton-indexen (AP), dubbel op 12 |
| `rtghorloge-03.js` | een heel lichte saffier-sheen bovenop alles |
| `rtghorloge-04.js` | het gaande werk: de middelpunten liggen op EXACT meshende afstand -- voor // elk grijpend paar geldt afstand = steeks... |

## `shared/sterren.js`

`public/shared/sterren/` -- 3 delen, 335 regels in de delen

| deel | onderwerp |
|---|---|
| `sterren-01.js` | RTG Sterrenhemel: een diepe, levende sterrenkoepel in huisstijl - de rust van een Rolls-Royce Starlight-hemel, maar d... |
| `sterren-02.js` | de waarnemer: eerst een schatting uit de tijdzone, daarna (na toestemming) // de echte locatie |
| `sterren-03.js` | Afgesplitst van sterren-02.js, dat over de 10 KB ging toen het stofveld van een gebakken plaatje een bewegend veld werd |

## `shared/teamcall.js`

`public/shared/teamcall/` -- 2 delen, 267 regels in de delen

| deel | onderwerp |
|---|---|
| `teamcall-01.js` | De teamcall: echt (video)bellen op de werkvloer via WebRTC |
| `teamcall-02.js` | de publieke knoppen |

## `shared/uitvoer.js`

`public/shared/uitvoer/` -- 2 delen, 270 regels in de delen

| deel | onderwerp |
|---|---|
| `uitvoer-01.js` | Uitvoer: uw gegevens meenemen uit elke app |
| `uitvoer-02.js` | De bediening. Die was er niet: neemMee() had als enige aanroeper de |

## `shared/verbinding.js`

`public/shared/verbinding/` -- 2 delen, 344 regels in de delen

| deel | onderwerp |
|---|---|
| `verbinding-01.js` | Gedeelde verbindingslaag voor alle apps |
| `verbinding-02.js` | het satelliet-noodbericht |

## `shared/werkos.js`

`public/shared/werkos/` -- 3 delen, 475 regels in de delen

| deel | onderwerp |
|---|---|
| `werkos-01.js` | RTG Werk-OS |
| `werkos-02.js` | dock const dock = document.createElement('nav'); dock.className = 'wos-dock'; dock.setAttribute('aria-label', 'Dock'); |
| `werkos-03.js` | bouwen en spiegelen function maakDockKnop(svgHtml, label, doe) { const b = document.createElement('button'); b.innerH... |

## `shared/zaakcommand.js`

`public/shared/zaakcommand/` -- 4 delen, 502 regels in de delen

| deel | onderwerp |
|---|---|
| `zaakcommand-01.js` | DE REGIE VAN DE ZAAK -- één weergave, twee huizen |
| `zaakcommand-02.js` | De Regie van de zaak, deel 2: de werkplekken zelf |
| `zaakcommand-03.js` | De Regie van de zaak, deel 3: zoeken en het objectdossier |
| `zaakcommand-04.js` | De Regie van de zaak, deel 4: rechtzetten en de regels |


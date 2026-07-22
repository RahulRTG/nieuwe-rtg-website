/* De naamdelen van de Geloof & Wijsheid-Bibliotheek (kern/geloofbieb.js): de
   40 tradities, de 25 thema's met hun leeftijdsgeschiktheid, en de reeks- en
   uitgavenamen. Bewust apart gehouden zodat de motor klein en leesbaar blijft;
   dit bestand is pure data, geen logica.

   Alle tradities staan als gelijken naast elkaar: wereldreligies en hun
   stromingen, inheemse en oude tradities, mystiek, filosofie en het
   niet-religieuze. Geen enkele staat "boven" een andere. */

/* 40 tradities en levensbeschouwingen, respectvol en breed. */
const TRADITIES = [
  { id: 'christendom', label: 'Christendom' },
  { id: 'katholicisme', label: 'Katholicisme' },
  { id: 'orthodoxie', label: 'Oosters-orthodox christendom' },
  { id: 'protestantisme', label: 'Protestantse tradities' },
  { id: 'islam', label: 'Islam' },
  { id: 'soefisme', label: 'Soefisme' },
  { id: 'jodendom', label: 'Jodendom' },
  { id: 'kabbala', label: 'Kabbala' },
  { id: 'hindoeisme', label: 'Hindoeïsme' },
  { id: 'vedanta', label: 'Advaita Vedanta' },
  { id: 'boeddhisme', label: 'Boeddhisme' },
  { id: 'zen', label: 'Zen' },
  { id: 'tibetaans', label: 'Tibetaans boeddhisme' },
  { id: 'sikhisme', label: 'Sikhisme' },
  { id: 'jainisme', label: 'Jaïnisme' },
  { id: 'taoisme', label: 'Taoïsme' },
  { id: 'confucianisme', label: 'Confucianisme' },
  { id: 'shinto', label: 'Shintoïsme' },
  { id: 'bahai', label: 'Bahá’í-geloof' },
  { id: 'zoroastrisme', label: 'Zoroastrisme' },
  { id: 'gnostiek', label: 'Gnostiek' },
  { id: 'mystiek', label: 'Christelijke mystiek' },
  { id: 'inheems', label: 'Inheemse tradities' },
  { id: 'afrikaans', label: 'Afrikaanse tradities' },
  { id: 'yoruba', label: 'Yoruba & Ifá' },
  { id: 'dreaming', label: 'Aboriginal Dreaming' },
  { id: 'sjamanisme', label: 'Sjamanisme' },
  { id: 'heidendom', label: 'Modern heidendom & Wicca' },
  { id: 'keltisch', label: 'Keltische & druïdische wijsheid' },
  { id: 'noors', label: 'Noorse & Germaanse tradities' },
  { id: 'hellenisme', label: 'Griekse & Romeinse tradities' },
  { id: 'egyptisch', label: 'Oud-Egyptische tradities' },
  { id: 'rastafari', label: 'Rastafari' },
  { id: 'stoa', label: 'Stoïcijnse filosofie' },
  { id: 'humanisme', label: 'Humanisme' },
  { id: 'existentie', label: 'Existentiële filosofie' },
  { id: 'natuur', label: 'Natuurspiritualiteit' },
  { id: 'dialoog', label: 'Interreligieuze dialoog' },
  { id: 'twijfel', label: 'Vrije gedachte & twijfel' },
  { id: 'perennis', label: 'Perennialisme (de ene bron)' }
];
/* Een neutrale, waardige set iconen; bewust niet één heilig symbool aan één
   traditie gekoppeld (dat zou misrepresenteren). Ze rouleren op nummer. */
const ICONEN = ['🕊️', '📜', '🪔', '📿', '🌿', '✨', '📖', '🔔', '🌏', '💠'];

/* 25 thema's. Elk draagt de leeftijdsgeschiktheid (doel): de zachte verhalen
   voor de kleinsten, de diepere weg voor tiener en volwassene. Alle doel-waarden
   liggen binnen {mini, kind, tiener, gezin}; een volwassene ziet alles. */
const THEMA = [
  { label: 'Verhalen voor de kleinsten', doel: ['mini'] },
  { label: 'Prentenverhalen', doel: ['mini', 'kind'] },
  { label: 'Feesten & vieringen', doel: ['kind', 'gezin'] },
  { label: 'Gebruiken & rituelen', doel: ['kind', 'tiener', 'gezin'] },
  { label: 'Wijze verhalen & parabels', doel: ['kind', 'gezin'] },
  { label: 'Levens van wijzen & stichters', doel: ['kind', 'tiener'] },
  { label: 'Heilige teksten & bronnen', doel: ['tiener'] },
  { label: 'Uitleg & commentaar', doel: ['tiener'] },
  { label: 'Gebeden & liederen', doel: ['kind', 'gezin'] },
  { label: 'Meditatie & stilte', doel: ['tiener', 'gezin'] },
  { label: 'Filosofie & grote vragen', doel: ['tiener'] },
  { label: 'Ethiek & goed leven', doel: ['tiener', 'gezin'] },
  { label: 'Mystiek & innerlijke weg', doel: ['tiener'] },
  { label: 'Kunst & symboliek', doel: ['kind', 'tiener', 'gezin'] },
  { label: 'Muziek & klank', doel: ['kind', 'gezin'] },
  { label: 'Kalender & seizoenen', doel: ['kind', 'gezin'] },
  { label: 'Keuken & gastvrijheid', doel: ['kind', 'gezin'] },
  { label: 'Pelgrimage & plaatsen', doel: ['tiener', 'gezin'] },
  { label: 'Geschiedenis & stromingen', doel: ['tiener'] },
  { label: 'Interreligieuze ontmoeting', doel: ['tiener', 'gezin'] },
  { label: 'Twijfel & vrije gedachte', doel: ['tiener'] },
  { label: 'Natuur & verwondering', doel: ['kind', 'gezin'] },
  { label: 'Rites bij leven & afscheid', doel: ['tiener', 'gezin'] },
  { label: 'Vrede & vergeving', doel: ['kind', 'tiener', 'gezin'] },
  { label: 'Woordenlijst & begrippen', doel: ['tiener', 'gezin'] }
];
const REEKS = ['Bronnen', 'Wegwijzer', 'Kompas', 'Lantaarn', 'Drempel', 'Pelgrim', 'Horizon', 'Stiltehuis', 'Levensboom', 'Pad',
  'Licht', 'Draad', 'Herberg', 'Vuur', 'Water', 'Adem', 'Wortel', 'Kring', 'Zaad', 'Oogst',
  'Brug', 'Poort', 'Sleutel', 'Kaars', 'Spiegel', 'Anker', 'Ster', 'Dauw', 'Berg', 'Rivier',
  'Tuin', 'Zaailing', 'Vlam', 'Uur', 'Bel', 'Boekrol', 'Perkament', 'Zegel', 'Vaas', 'Krans'];
const UITGAVE = ['Inleiding', 'Voor kinderen', 'Voor het gezin', 'Handreiking', 'Bloemlezing', 'Naslag', 'Verdieping', 'Dagboek', 'Metgezel', 'Gids',
  'Klassiek', 'Modern', 'Kort', 'Compleet', 'Geïllustreerd', 'Verhalen', 'Vragen', 'Stil', 'Samen', 'Onderweg',
  'Bezinning', 'Jaar', 'Drempel', 'Ontmoeting', 'Vrede'];

module.exports = { TRADITIES, ICONEN, THEMA, REEKS, UITGAVE };

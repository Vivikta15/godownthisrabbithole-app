// Topic pool for the autonomous generator. Hand-picked, everyday and non-sensitive, India-first. Tags must be in TOPIC_TAGS.
// When this list is used up the generator stops and reports pool_empty; it does not wander into unvetted topics.
export type Topic = { title: string; tags: string[]; countries?: string[] };
const I = ['IN'];
export const TOPICS: Topic[] = [
  { title: 'Rail transport in India', tags: ['everyday life', 'places', 'history'], countries: I }, // placeholder titles are validated at runtime: a missing page is skipped
  { title: 'Masala chai', tags: ['food', 'everyday life'], countries: I },
  { title: 'Trams in Kolkata', tags: ['places', 'history', 'everyday life'], countries: I }, { title: 'Monsoon of South Asia', tags: ['nature', 'places'], countries: I },
  { title: 'Kumbh Mela', tags: ['places', 'history'], countries: I }, { title: 'Indian Standard Time', tags: ['science', 'everyday life'], countries: I },
  { title: 'Jantar Mantar, Jaipur', tags: ['science', 'history', 'places'], countries: I }, { title: 'Stepwell', tags: ['places', 'history', 'science'], countries: I },
  { title: 'Rupee', tags: ['money & tech', 'history'], countries: I }, { title: 'Unified Payments Interface', tags: ['money & tech', 'everyday life'], countries: I },
  { title: 'Aadhaar', tags: ['money & tech', 'everyday life'], countries: I }, { title: 'Jaipur', tags: ['places', 'history'], countries: I },
  { title: 'Sundarbans', tags: ['nature', 'animals', 'places'], countries: I }, { title: 'Asiatic lion', tags: ['animals', 'nature'], countries: I },
  { title: 'Indian elephant', tags: ['animals', 'nature'], countries: I }, { title: 'Banyan', tags: ['nature'], countries: I },
  { title: 'Turmeric', tags: ['food', 'science', 'everyday life'], countries: I }, { title: 'Basmati', tags: ['food', 'everyday life'], countries: I },
  { title: 'Mango', tags: ['food', 'nature'], countries: I }, { title: 'Jalebi', tags: ['food', 'history'], countries: I },
  { title: 'Kabaddi', tags: ['history', 'everyday life'], countries: I }, { title: 'Carrom', tags: ['history', 'everyday life'], countries: I },
  { title: 'Ludo', tags: ['history', 'everyday life'], countries: I }, { title: 'Snakes and ladders', tags: ['history', 'everyday life'], countries: I },
  { title: 'Hindu–Arabic numeral system', tags: ['science', 'history'], countries: I },
  { title: 'Wootz steel', tags: ['science', 'history'], countries: I }, { title: 'Iron pillar of Delhi', tags: ['science', 'history', 'places'], countries: I },
  { title: 'Indus Valley Civilisation', tags: ['history', 'places'], countries: I }, { title: 'Ashoka Chakra', tags: ['history'], countries: I },
  { title: 'Taj Mahal', tags: ['history', 'places'], countries: I }, { title: 'Hampi', tags: ['history', 'places'], countries: I },
  { title: 'Ajanta Caves', tags: ['history', 'places'], countries: I }, { title: 'Living root bridge', tags: ['nature', 'places', 'science'], countries: I },
  { title: 'Cherrapunji', tags: ['nature', 'places'], countries: I }, { title: 'Thar Desert', tags: ['nature', 'places'], countries: I },
  { title: 'ISRO', tags: ['space', 'science'], countries: I }, { title: 'Mars Orbiter Mission', tags: ['space', 'science'], countries: I },
  { title: 'Chandrayaan-3', tags: ['space', 'science'], countries: I }, { title: 'Aryabhata', tags: ['science', 'history', 'space'], countries: I },
  { title: 'Honey', tags: ['food', 'science', 'animals'] }, { title: 'Octopus', tags: ['animals', 'nature', 'science'] },
  { title: 'Venus', tags: ['space', 'science'] }, { title: 'Moon', tags: ['space', 'science'] }, { title: 'Tardigrade', tags: ['animals', 'science'] },
  { title: 'Bioluminescence', tags: ['nature', 'science', 'animals'] }, { title: 'Salt', tags: ['food', 'history', 'science'] }, { title: 'Coffee', tags: ['food', 'history', 'everyday life'] },
  { title: 'Zipper', tags: ['everyday life', 'money & tech'] }, { title: 'Barcode', tags: ['everyday life', 'money & tech'] }, { title: 'Elevator', tags: ['everyday life', 'money & tech', 'places'] },
  { title: 'Time zone', tags: ['everyday life', 'science'] }, { title: 'Lighthouse', tags: ['places', 'history', 'science'] }, { title: 'Mushroom', tags: ['nature', 'food', 'science'] },
];
// Words that stop a topic or a story from being generated unattended. Conservative on purpose.
export const SENSITIVE = /\b(suicide|self-harm|massacre|genocide|terror|rape|murder|abuse|porn|sex|drug|overdose|cure|treatment|diagnos|dosage|cancer|vaccin|election|party|religious riot|caste violence|communal|war crime|assassinat)\b/i;
export const topicAllowed = (t: Topic) => !SENSITIVE.test(t.title);

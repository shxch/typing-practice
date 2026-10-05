// Vocabulary from the world of Wings of Fire (Tui T. Sutherland): the words its dragons,
// tribes and places are made of. Only single words and names — no text from the books.
// Lessons take about half their words from here and half from the general word list.

const RAW_WORDS = `
dragon dragons dragonet dragonets wing wings winged scale scales scaled claw claws clawed talon talons tail tails
horn horns fang fangs tooth teeth snout spine spines frill frills gills ribs eye eyes snarl snarls
fire fires flame flames blaze burn burned burning smoke ash ashes ember embers spark sparks heat hot lava magma volcano
ice icy frost frozen freeze cold snow glacier blizzard storm storms hail chill
sand sands dune dunes desert cactus oasis scorpion scorpions sun sunny sunlight
mud muddy swamp marsh river rivers bog reeds delta
sea seas ocean wave waves reef coral tide tides deep kelp shell shells pearl pearls island islands shore
rain rainy rainforest jungle vine vines tree trees leaf leaves sloth fruit mango mangoes banana
night nights moon moons star stars dark darkness shadow shadows silver
sky skies cloud clouds wind winds peak peaks mountain mountains cliff cliffs cave caves tunnel tunnels
silk thread web webs cocoon hive hives wasp wasps bee bees flower flowers
queen queens king prince princess heir throne crown palace kingdom kingdoms tribe tribes
guard guards soldier soldiers army armies battle battles war wars peace ally allies enemy enemies
prophecy seer seers vision visions future dream dreams mind minds animus magic spell spells enchanted
scroll scrolls library school student students teacher lesson class
egg eggs hatch hatched hatching nest hatchling
hunt hunted hunter prey scavenger scavengers cow cows goat goats sheep deer rabbit
fly flying flew flight soar soared glide dive swoop roar roared hiss hissed growl breathe breath
venom poison glow glowing camouflage color colors
brave loyal clever fierce wise kind gentle secret secrets hidden destiny fate hope trust
friend friends family sister sisters brother brothers mother father
arena prison prisoner escape escaped rescue save quest journey map
jade gold golden treasure gem gems ruby emerald diamond crystal stone
talk tell told listen read write sleep awake alone together help find lost home
`

/** Characters, tribes and places. Capitalized, so they appear once capitals are unlocked. */
const RAW_NAMES = `
Clay Tsunami Glory Starflight Sunny Peril Kinkajou Qibli Winter Moon Moonwatcher Turtle Darkstalker Fathom
Clearsight Blue Cricket Luna Sundew Swordtail Bumblebee Blister Blaze Burn Scarlet Ruby Coral Anemone Riptide
Webs Kestrel Dune Morrowseer Deathbringer Mastermind Hailstorm Icicle Snowfall Glacier Grandeur Magnificent
Mangrove Hazel Willow Hawthorn Wasp Onyx Tamarin Umber Sora Stonemover Foeslayer Arctic Whiteout Lynx
Carnelian Flame Smolder Thorn Jambu Nautilus Battlewinner Scarab
MudWing MudWings SeaWing SeaWings RainWing RainWings NightWing NightWings SandWing SandWings IceWing IceWings
SkyWing SkyWings SilkWing SilkWings HiveWing HiveWings LeafWing LeafWings
Pyrrhia Pantala Possibility
`

const unique = (raw: string) => Array.from(new Set(raw.split(/\s+/).filter(Boolean)))

export const WOF_WORDS: string[] = unique(RAW_WORDS).filter((w) => /^[a-z]+$/.test(w))
export const WOF_NAMES: string[] = unique(RAW_NAMES).filter((w) => /^[A-Z][A-Za-z]+$/.test(w))

/** Contractions and hyphenated words for the punctuation stage, in the same spirit. */
export const WOF_HYPHENATED = [
  'fire-breathing', 'ice-cold', 'mind-reading', 'sea-green', 'sky-blue', 'night-black', 'sand-colored',
  'sharp-eyed', 'half-hatched', 'moon-bright', 'star-shaped', 'rain-soaked', 'sun-warmed', 'three-moon',
]

/**
 * Short original sentences set in the Wings of Fire world (written for this app, not quoted
 * from the books). Used in the punctuation stage; a lesson only uses the ones whose keys are
 * unlocked and never two that share a word.
 */
export const WOF_SENTENCES = [
  'Clay loves eating cows more than anything.',
  'Tsunami dove deep beneath the waves.',
  "Glory's scales turned bright gold with joy.",
  'Starflight read every scroll in his library.',
  'Sunny believed peace was possible.',
  "Peril's firescales burn whatever she touches.",
  'Kinkajou changed her colors to happy pink!',
  'Qibli always has a clever plan.',
  'Winter flew north toward the Ice Kingdom.',
  'Moon can hear what other dragons think.',
  'Turtle kept his animus magic a secret.',
  '"Wake up, dragonets!" shouted a guard.',
  'Can a NightWing really see the future?',
  "Blue's wings shimmered like silk.",
  'Cricket asked many questions; nobody minded.',
  'Sundew made vines wrap around tall towers.',
  'Jade Mountain Academy welcomed every tribe.',
  'SandWings live in a hot, dry desert.',
  'RainWings nap in trees on sunny afternoons.',
  'MudWings are loyal to their siblings.',
  'SkyWings soar above tall, rocky peaks.',
  'Who hid that dragon egg under the mountain?',
  'Darkstalker waited for two thousand years.',
  'Fathom promised never to use his magic again.',
  'Three moons glowed in a clear night sky.',
  "An IceWing's breath can freeze a river.",
  'Queen Scarlet loved watching arena battles.',
  'Webs hid the dragonets in a secret cave.',
  'Pantala is home to HiveWings, SilkWings, and LeafWings.',
  'Luna spun a glowing cocoon of flamesilk.',
  'Swordtail laughed, then flew after Blue.',
  "Don't wake a sleeping SkyWing!",
  "It's hard to hide from a mind reader.",
  'Pyrrhia has seven tribes (and many secrets).',
  'Morrowseer spoke about a strange prophecy.',
  'Queen Wasp ruled every HiveWing on Pantala.',
  'Scavengers stole treasure from Queen Oasis.',
  "Clay's brothers and sisters welcomed him home.",
  'Lava bubbled deep inside the volcano.',
  '"Is anyone hungry?" asked Clay.',
  'Tsunami grabbed a fish; Glory rolled her eyes.',
  'Starflight loved old scrolls: maps, poems, and stories.',
  'Peril wanted to be a good dragon.',
  "Qibli's tail twitched with excitement.",
  "Moon's visions come at strange times.",
  "Winter's brother Hailstorm was lost for years.",
  "Kinkajou's scales flashed bright yellow.",
  'Every dragonet dreamed of flying free.',
  'An ice-cold wind howled across frozen hills.',
  'Fire-breathing guards watched the palace gates.',
  '(Nobody knew where the other egg went.)',
  "Sundew's temper was quick; her heart stayed kind.",
  'Why do NightWings keep so many secrets?',
  'Bumblebee giggled and grabbed a mango.',
  'Riptide swam fast to find Tsunami.',
  'Hazel was a brave LeafWing princess.',
  'Snowfall became queen of the IceWings.',
  'Deathbringer followed Glory everywhere.',
  'Clearsight could see many possible futures.',
  'Onyx was a fierce SandWing student.',
]

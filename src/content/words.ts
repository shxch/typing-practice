// Common, kid-friendly English words (lowercase). Used to build lessons from real words
// instead of random letter soup. Duplicates are removed at load time.

const RAW = `
a about above across act add after afternoon again age ago air all almost alone along already also always am
among an and angry animal another answer ant any anyone anything apple are area arm army around art as ask
asleep at aunt autumn away baby back bad bag bake ball banana band bank bark basket bat bath be beach bean
bear beard beat beautiful became because become bed bee been before began begin behind being bell belong below
belt bench berry best better between bicycle big bike bird birthday bit bite black blanket blew block blue
board boat body bone book boot born both bottle bottom bought bowl box boy brain branch brave bread break
breakfast brick bridge bright bring brother brought brown brush bubble bug build built bunny burn bus bush busy
but butter butterfly button buy by cage cake call calm came camel camp can candle candy cap car card care
careful carrot carry case castle cat catch caught cave center chair chalk chance change chase cheek cheese
cherry chess chicken child children chin chip chocolate choose circle city class clean clear clever climb clock
close cloth cloud clown coat cocoa cold color come cook cookie cool copy corn corner could count country cousin
cow crab crayon cream cross crowd crown cry cub cup cupcake curious cut cute dad daddy daisy dance danger dark
date day dead deal dear deep deer desk did different dig dinner dinosaur dirt dish do doctor does dog doll
dollar dolphin done door dot down dragon draw dream dress drink drive drop drum dry duck during dust each eagle
ear early earth easy eat edge egg eight either elephant else empty end enjoy enough even evening ever every
everyone everything eye face fact fair fairy fall family fan far farm fast fat father favorite feather feed feel
feet fell felt fence few field fifteen fight fill find fine finger finish fire first fish five fix flag flat
flew float floor flower fly fog follow food foot for forest forget fork found four fox free fresh friend frog
from front fruit full fun funny fur game garden gate gave gentle get giant gift giraffe girl give glad glass
glove glue go goat gold golden gone good goose got grab grade grandma grandpa grape grass gray great green grew
ground group grow guess guitar had hair half hall hand happy hard has hat have he head hear heard heart heat
heavy hello help hen her here hero hid hide high hill him his hit hold hole home honey hop hope horse hot hour
house how hug huge hungry hunt hurry hurt ice idea if important in inch insect inside into is island it its
jacket jam jar jeans jelly job join joke joy juice jump jungle just kangaroo keep kept key kick kid kind king
kiss kitchen kite kitten knee knew knock know koala lady lake lamb lamp land large last late laugh lay lazy lead
leaf learn least leave led left leg lemon less lesson let letter lid lie life lift light like line lion lip
list listen little live lizard long look lose lost lot loud love low lucky lunch made magic mail make man many
map march mark may me meal mean meat meet melon men met middle might milk mind minute mirror miss mix mom money
monkey month moon more morning most mother mountain mouse mouth move much mud music must my nail name near neck
need nest never new next nice night nine no noise none noon nose not note nothing now number nurse nut ocean
of off often oil old on once one only open or orange other our out outside oven over owl own page paint pair
pan panda paper parent park part party pass past paw pea peach pear pen pencil penguin people pet piano pick
picnic picture pie piece pig pillow pilot pink pizza place plan plane plant plate play please pocket point pond
pony pool poor pop pot potato pour present pretty prince princess prize pull pumpkin puppy purple push put
puzzle queen quick quiet quilt quite rabbit race rain rainbow ran reach read ready real red remember rest rice
rich ride right ring river road robin robot rock rocket roll roof room root rope rose round row rug rule run
sad safe said sail salad salt same sand sang sat save saw say school sea seal season seat second see seed seem
seen sell send set seven shape share shark she sheep shell shine ship shirt shoe shop short should shout show
shut sick side sign silly sing sister sit six size skate skip skirt sky sleep slide slow small smell smile
snack snail snake snow so soap sock sofa soft some someone something song soon sorry sound soup space speak
special spell spider spoon sport spot spring square squirrel stairs stamp stand star start stay step stick
still stone stop store storm story strange strawberry street strong student study such sugar summer sun sunny
supper sure surprise swan sweet swim swing table tail take talk tall taste taxi tea teach teacher team teeth
tell ten tent than thank that the their them then there these they thing think third this those though
thought three threw through throw tiger time tiny tired to toast today toe together told tomato tomorrow tonight
too took tooth top touch towel tower town toy track train tree trip truck true try turn turtle twelve twenty
two uncle under until up upon us use useful very visit voice wait wake walk wall want warm was wash watch
water wave way we wear weather week well went were wet whale what wheel when where which while white who whole
why wide wild will win wind window wing winter wise wish with without wolf woman won wonder wood word work
world worm would write wrong yard year yellow yes yesterday yet you young your zebra zero zoo
able ads aid aim ale all alas asks elf ideal jade kale kid lad lads lake lakes leaf lease led less self sell
sells shelf sled slide sale sake safe seek seeks fee feel feels fed fad fade fades deal deals desk desks dessert
dad dads sad sadly salad salads flea fleas flask ask asked seal seals sea seas see sees seed seeds lease jail
jell else eel eels ease easel dive dial did die dies fiddle field file files fill fills fin find fire firs
fish fled flies fries idle ill isle kiss kid kids lid lids life like likes lift lie lies line lies ride rides
rise risk said sail sir sister ski skies slid side sides silk sink sit fir fear dear deer ear ears
feed free freed jar jars red reds real read reader rake raid rail rid ride rider fries sir stir tear tree trees
tail tale tall tart task taste tea test tide tie tied tile till tire tired treat trade trail star start stare
sea set sit site sister kite kites fit fist fast fat feet fleet lit let tell tells tilt treat street sweet
`

export const WORDS: string[] = Array.from(
  new Set(RAW.split(/\s+/).filter((w) => /^[a-z]+$/.test(w) && w.length > 0)),
)

/** Names and proper nouns, used when practicing capital letters. */
export const PROPER_NOUNS: string[] = Array.from(
  new Set(
    `Anna Ella Ada Lily Mia Emma Sofia Zoe Kate Jake Sam Leo Max Ben Tom Jack Luke Noah Owen Ryan Eric Ivy Olive
     Grace Hazel Ruby Wendy Quinn Xena Yara Violet Paris London Tokyo Rome Sydney Boston Denver Dallas Seattle
     Chicago Texas Ohio Utah Iowa Kansas Maine Idaho Asia Africa Europe Japan China Canada Mexico Brazil India
     Egypt Kenya Norway Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April
     May June July August September October November December Earth Mars Venus Jupiter Saturn Pluto`
      .split(/\s+/)
      .filter(Boolean),
  ),
)

/** Contractions, used when practicing the apostrophe. */
export const CONTRACTIONS: string[] = [
  "don't", "can't", "won't", "it's", "I'm", "we're", "you're", "they're", "let's", "she's", "he's",
  "isn't", "aren't", "wasn't", "didn't", "doesn't", "I'll", "we'll", "you'll", "that's", "what's",
  "there's", "I've", "we've", "couldn't", "wouldn't", "shouldn't",
]

/** Hyphenated compounds, used when practicing the hyphen. */
export const HYPHENATED: string[] = [
  "well-known", "sun-kissed", "self-made", "old-fashioned", "one-way", "red-hot", "long-term",
  "brand-new", "two-thirds", "high-five", "real-time", "good-looking", "follow-up", "part-time", "full-time",
]

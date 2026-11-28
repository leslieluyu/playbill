/** English copy for pages whose Chinese text lives in the database. */

export const places: Record<string, string> = {
  美国: "United States",
  英国: "United Kingdom",
  美英: "United States, United Kingdom",
  加拿大: "Canada",
  爱尔兰: "Ireland",
  韩国: "South Korea",
  法国: "France",
  中国香港: "Hong Kong",
  日本: "Japan",
  "澳大利亚、美国": "Australia, United States",
  "英国、波兰": "United Kingdom, Poland",
  巴西: "Brazil",
  "中国香港、中国台湾": "Hong Kong, Taiwan",
  墨西哥: "Mexico",
  伊朗: "Iran",
  "意大利、法国": "Italy, France",
  中国台湾: "Taiwan",
  德国: "Germany",
  "墨西哥、西班牙": "Mexico, Spain",
  "美国、英国": "United States, United Kingdom",
  瑞典: "Sweden",
  西班牙: "Spain",
  丹麦: "Denmark",
  挪威: "Norway",
};

export const forms: Record<string, string> = {
  剧集: "Series",
  迷你剧: "Miniseries",
  纪录片: "Documentary",
  第一季: "Season 1",
  单元剧: "Anthology",
  动画: "Animation",
  小品: "Sketch show",
  真人秀: "Reality",
  真人实验: "Reality experiment",
  电影: "Film",
};

export function yearsEn(years: string) {
  return years.replaceAll("至今", "present");
}

export function placeEn(place?: string) {
  if (!place) return "";
  return places[place] ?? place;
}

export function formEn(form?: string) {
  if (!form) return "";
  return forms[form] ?? form;
}

type SectionCopy = { name: string; blurb: string };

type ListCopy = {
  title: string;
  kicker: string;
  dek: string;
  noun: string;
  creator: string;
  search: string;
  idle: string;
  empty: string;
  found: string;
  none: string;
  sections: Record<string, SectionCopy>;
  colophon: string;
  ratings: string;
};

export const lists: Record<string, ListCopy> = {
  "nyt-100-movies": {
    title: "The 100 Best Movies of the 21st Century",
    kicker: "The New York Times · a reading copy",
    dek: "In June 2025 The New York Times asked more than 500 directors, actors, and film workers to vote for the best movies of the 21st century. Each film has its year, director, and cast. Search by title, name, or rank to jump to it on the page.",
    noun: "film",
    creator: "Director",
    search: "Title, director, or cast, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that film.",
    empty: "No matches. Try a title, a name, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {
      crime: {
        name: "Crime & Mystery",
        blurb:
          "Crime, mystery, and revenge. Parasite, No Country for Old Men, Zodiac, and Memories of Murder stay tense the whole way. Ocean’s Eleven and Gone Girl play more like genre films. Memento runs backward, and Mulholland Drive undoes what came before. The first time through, those two are better if you don’t look them up.",
      },
      love: {
        name: "Love",
        blurb:
          "Romances, and also marriage and the ones who miss each other. In the Mood for Love, Lost in Translation, Carol, and Portrait of a Lady on Fire are slow. Eternal Sunshine of the Spotless Mind and Her use a science-fiction premise, but the subject is still the relationship. Brokeback Mountain, Call Me by Your Name, and Past Lives are about people who do not end up together.",
      },
      comedy: {
        name: "Comedy",
        blurb:
          "Borat, Bridesmaids, Superbad, and Anchorman are straightforwardly funny. The Grand Budapest Hotel, The Royal Tenenbaums, Little Miss Sunshine, and Frances Ha leave a little sadness after the laughs. The Favourite is set in the eighteenth-century British court and is nastier than it is warm. Toni Erdmann runs nearly three hours, and the jokes arrive slowly.",
      },
      spec: {
        name: "Sci-Fi, Fantasy & Action",
        blurb:
          "Science fiction, fantasy, action, and wuxia share this section. Arrival, Inception, Interstellar, and Minority Report are science fiction. The Lord of the Rings: The Fellowship of the Ring, Pan’s Labyrinth, and Everything Everywhere All at Once are fantasy. Mad Max: Fury Road, The Dark Knight, Kill Bill, Gladiator, and Black Panther are action. Crouching Tiger, Hidden Dragon is wuxia. Gravity, at 91 minutes, is the shortest here.",
      },
      history: {
        name: "History & True Stories",
        blurb:
          "Most of these track real people and events, but all of them are fiction films. 12 Years a Slave, The Lives of Others, Oppenheimer, and The Zone of Interest are historical. The Social Network, The Wolf of Wall Street, Moneyball, Spotlight, and The Hurt Locker are about people and industries of recent decades. Inglourious Basterds and Once Upon a Time in Hollywood are Quentin Tarantino’s rewritten history, not a record of what happened. There Will Be Blood and The Master have models for their characters; the stories are invented.",
      },
      life: {
        name: "A Life",
        blurb:
          "Growing up, families, and what a person makes of a life. Boyhood followed the same actor for twelve years. Moonlight, Lady Bird, Fish Tank, and The Florida Project are stories about young people. Yi Yi, Amour, The Tree of Life, and Volver are about families. The protagonists of Tár, Whiplash, and Black Swan take one pursuit past the point of obsession.",
      },
      doc: {
        name: "Animation & Documentary",
        blurb:
          "Four animated films. Spirited Away is Studio Ghibli. WALL-E, Up, and Ratatouille are Pixar, and children can watch those three. The Act of Killing asks participants in the Indonesian mass killings to reenact what they did. The Gleaners and I follows people in rural France who pick up what others leave behind. Grizzly Man is about a man who spent thirteen summers with grizzly bears and then died in a bear’s mouth.",
      },
    },
    colophon:
      "Chinese titles use the names most common in Chinese-speaking places, and search also accepts familiar aliases. Directors, cast, and plots are short notes from public sources. Highlight is the blurb The New York Times wrote for that film on this list (Chinese is a translation; English is the original). Playbill notes are ours and stay with the work; they are still being filled in for this list.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "criterion-spine": {
    title: "The Criterion Collection",
    kicker: "The Criterion Collection · by spine number",
    dek: "The Criterion Collection catalog, ordered by spine number. Filter by country, genre, or form. Numbers come from Criterion’s official shop list; box sets and titles without a spine are left out for now. Search by spine number, English title, or director.",
    noun: "film",
    creator: "Director",
    search: "Title, director, or a spine number such as 065",
    idle: "Press Enter, or pick a result, to jump to that film.",
    empty: "No matches. Try a title, a name, or a spine number.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Chinese titles use the names most common in Chinese-speaking places, and search also accepts familiar aliases. Directors, cast, and plots are short notes from public sources. Highlights for a small set of spines are taken from Criterion’s film pages (English) with provisional Chinese translations. Spine numbers are Criterion’s; the list is refreshed from their shop browse page. Playbill notes are ours and stay with the work.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "sight-sound-2020": {
    title: "Sight & Sound’s 100 Greatest Movies (2020)",
    kicker: "Sight & Sound · a reading copy",
    dek: "A 2020 reading of Sight & Sound’s greatest films of all time: one hundred movies rearranged into seven sections by type, kept in their original rank order inside each section. Each film has its year, director, and cast. Search by title, name, or rank to jump to it on the page.",
    noun: "film",
    creator: "Director",
    search: "Title, director, or cast, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that film.",
    empty: "No matches. Try a title, a name, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {
      crime: {
        name: "Crime & Mystery",
        blurb:
          "Crime, mystery, and dread. Vertigo, Psycho, Rear Window, and North by Northwest are Hitchcock. The two Godfather films, Chinatown, M, and Touch of Evil are hard crime. Mulholland Drive and Blue Velvet play like nightmares. Breathless, Pierrot le fou, and Close-Up take the genre apart and rebuild it.",
      },
      love: {
        name: "Love",
        blurb:
          "Romance, marriage, and the ones who miss each other. In the Mood for Love, Sunrise, Casablanca, and Children of Paradise are about love. L’Atalante and A Day in the Country are lighter. In L’Avventura, L’Eclisse, Contempt, and Journey to Italy, the relationship is already coming apart. Fear Eats the Soul, Imitation of Life, and Touki Bouki put love next to class, race, and leaving home.",
      },
      comedy: {
        name: "Comedy",
        blurb:
          "Chaplin (City Lights, Modern Times), Keaton (The General, Sherlock Jr.), plus Singin’ in the Rain, Some Like It Hot, and Playtime. The Rules of the Game and La Dolce Vita have a sting under the laughs. Nashville is a chorus of overlapping stories.",
      },
      spec: {
        name: "Sci-Fi, Fantasy & Western",
        blurb:
          "Science fiction includes 2001, Metropolis, Blade Runner, Stalker, and La Jetée. Fantasy and parable include Ugetsu, The Seventh Seal, A Matter of Life and Death, and The Spirit of the Beehive. The Searchers, Rio Bravo, Once Upon a Time in the West, and The Wild Bunch are westerns.",
      },
      history: {
        name: "History & War",
        blurb:
          "History, war, and eras tipping over. Battleship Potemkin, The Passion of Joan of Arc, and Intolerance are early epics. Apocalypse Now, The Battle of Algiers, Grand Illusion, and Lawrence of Arabia are about war and empire. Seven Samurai, Andrei Rublev, The Leopard, and Barry Lyndon put one life inside a larger age.",
      },
      life: {
        name: "A Life",
        blurb:
          "Families, growing up, and what someone makes of a life. Tokyo Story, Late Spring, Yi Yi, and Bicycle Thieves are about home. The 400 Blows is a boy’s story. Citizen Kane, 8½, Persona, The Mirror, and Jeanne Dielman turn inward. Sunset Boulevard is about the rest of a life inside Hollywood.",
      },
      doc: {
        name: "Documentary & Experimental",
        blurb:
          "Documentaries and experiments. Shoah is a long testimony. Man with a Movie Camera, Sans Soleil, and Histoire(s) du cinéma work on the act of filming itself. An Andalusian Dog is a surrealist short that refuses a standard plot.",
      },
    },
    colophon:
      "Chinese titles use the names most common in Chinese-speaking places, and search also accepts familiar aliases. Directors, cast, and plots are short notes from public sources. Rank order follows the IMDb user list linked in the footer; reading sections are ours. Playbill notes are ours and stay with the work; they are still being filled in for this list.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "japan-academy-picture": {
    title: "Japan Academy Prize · Best Picture",
    kicker: "Japan Academy Film Prize · Picture of the Year",
    dek: "Every Picture of the Year at the Japan Academy Film Prize (日本アカデミー賞), from the 48th ceremony down to the first. Each entry has its year, director, and cast. Search by title, name, or rank to jump to it on the page.",
    noun: "film",
    creator: "Director",
    search: "Title, director, or cast, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that film.",
    empty: "No matches. Try a title, a name, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Chinese titles use the names most common in Chinese-speaking places, and search also accepts familiar aliases. Directors, cast, and plots are short notes from public sources. Order follows the Douban doulist linked in the footer (newest ceremony first). Playbill notes are ours and stay with the work; they are still being filled in for this list.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "kinema-junpo-ten": {
    title: "Kinema Junpo · Best Ten",
    kicker: "Kinema Junpo · year-by-year",
    dek: "Kinema Junpo (キネマ旬報) annual Best Ten lists, including separate Japanese/foreign and artistic/entertainment charts where the source doulist marks them. Newest 旬报 year first. Use the sidebar decades and years to filter, and chart-type tags to narrow further.",
    noun: "film",
    creator: "Director",
    search: "Title, director, or cast, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that film.",
    empty: "No matches. Try a title, a name, a tag, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Chinese titles use the names most common in Chinese-speaking places, and search also accepts familiar aliases. Directors, cast, and plots are short notes from public sources. Order and chart labels follow the Douban doulist linked in the footer (newest 旬报 year first). Slots marked 暂缺 on Douban are noted in the footer only. Playbill notes are ours and stay with the work; they are still being filled in for this list.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "oscar-best-picture": {
    title: "Oscar · Best Picture",
    kicker: "Academy Awards · Best Picture",
    dek: "Academy Award for Best Picture winners and nominees, newest ceremony year first. Filter by decade and year in the sidebar, and by Winner / Nominated tags.",
    noun: "film",
    creator: "Director",
    search: "Title, director, or cast, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that film.",
    empty: "No matches. Try a title, a name, a tag, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Chinese titles use the names most common in Chinese-speaking places, and search also accepts familiar aliases. Directors, cast, and plots are short notes from public sources. Ceremony year and winner/nominee status follow Douban’s Oscar awards pages (Best Picture section). Early editions may label the category as 最佳作品奖 on Douban. Playbill notes are ours and stay with the work; they are still being filled in for this list.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "cannes-palme-dor": {
    title: "Cannes · Palme d’Or",
    kicker: "Cannes Film Festival · Palme d’Or",
    dek: "Palme d’Or winners and main-competition nominees at the Cannes Film Festival, newest festival year first. Filter by decade and year in the sidebar, and by Winner / Nominated tags.",
    noun: "film",
    creator: "Director",
    search: "Title, director, or cast, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that film.",
    empty: "No matches. Try a title, a name, a tag, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Chinese titles use the names most common in Chinese-speaking places, and search also accepts familiar aliases. Directors, cast, and plots are short notes from public sources. Festival year and winner/nominee status follow Douban’s Cannes awards pages (main competition Palme d’Or section). Playbill notes are ours and stay with the work; they are still being filled in for this list.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "berlin-golden-bear": {
    title: "Berlin · Golden Bear",
    kicker: "Berlinale · Golden Bear",
    dek: "Golden Bear winners and main-competition nominees at the Berlin International Film Festival, newest festival year first. Filter by decade and year in the sidebar, and by Winner / Nominated tags.",
    noun: "film",
    creator: "Director",
    search: "Title, director, or cast, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that film.",
    empty: "No matches. Try a title, a name, a tag, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Chinese titles use the names most common in Chinese-speaking places, and search also accepts familiar aliases. Directors, cast, and plots are short notes from public sources. Festival year and winner/nominee status follow Douban’s Berlinale awards pages (Golden Bear section). Playbill notes are ours and stay with the work; they are still being filled in for this list.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "venice-golden-lion": {
    title: "Venice · Golden Lion",
    kicker: "Venice Film Festival · Golden Lion",
    dek: "Golden Lion winners and main-competition nominees at the Venice Film Festival, newest festival year first. Filter by decade and year in the sidebar, and by Winner / Nominated tags.",
    noun: "film",
    creator: "Director",
    search: "Title, director, or cast, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that film.",
    empty: "No matches. Try a title, a name, a tag, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Chinese titles use the names most common in Chinese-speaking places, and search also accepts familiar aliases. Directors, cast, and plots are short notes from public sources. Festival year and winner/nominee status follow Douban’s Venice awards pages (Golden Lion section). Playbill notes are ours and stay with the work; they are still being filled in for this list.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "afi-100-movies": {
    title: "AFI’s 100 Movies",
    kicker: "AFI’s 100 Years…100 Movies · 10th Anniversary",
    dek: "The American Film Institute’s 2007 10th-anniversary poll of the greatest American films. The page defaults to the final 100; open the full list to browse all 400 ballot nominees. Filter by country, genre, or form. Ranks 1–100 are the official winners; the rest follow ballot order among the remaining nominees.",
    noun: "film",
    creator: "Director",
    search: "Title, director, or cast, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that film.",
    empty: "No matches. Try a title, a name, a tag, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Chinese titles use the names most common in Chinese-speaking places, and search also accepts familiar aliases. Directors, cast, and plots are short notes from public sources. The top 100 follow AFI’s 2007 ranking; the remaining titles are the other films from AFI’s 400-nominee ballot, ordered by ballot number. Playbill notes are ours and stay with the work; they are still being filled in for this list.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "nyt-100-tv": {
    title: "The 100 Best TV Shows of the 21st Century",
    kicker: "The New York Times · a reading copy",
    dek: "One hundred shows, rearranged into seven sections by type, kept in their original rank order inside each section. Each one has the title, years on air, creators, cast, plot, and a highlight. Search by title, name, or rank to jump to it on the page.",
    noun: "show",
    creator: "Creators",
    search: "Title, cast, or creator, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that show.",
    empty: "No matches. Try a title, a name, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {
      crime: {
        name: "Crime",
        blurb:
          "Dealers, police, gangs, and lawyers. The top two shows on the list are both here, and they barely resemble each other: Breaking Bad is about one man getting worse, and The Wire is about how drugs, the police, the docks, the schools, and the newspaper in one city connect. For something short, Adolescence, Mare of Easttown, and The Night Of are miniseries that end in one season. True Detective’s first season is also a complete story on its own.",
      },
      history: {
        name: "History",
        blurb:
          "All of these are set in the past: a mining town in the 1870s West (Deadwood), an English estate around the First World War (Downton Abbey), the European theater of the Second World War (Band of Brothers), New York advertising in the 1960s (Mad Men), the 1986 nuclear accident (Chernobyl), the reign of Elizabeth II (The Crown), and Japan around 1600 (Shōgun). Chernobyl is five episodes and Band of Brothers is ten, the easiest ways in.",
      },
      power: {
        name: "Power",
        blurb:
          "Politics, spies, and family businesses, in roughly two kinds. The Americans, Homeland, House of Cards, The Bureau, and The Diplomat are dramas. Succession, Veep, and The Thick of It lean satirical: most of the people in power are incompetent and cruel, and the last two share the creator Armando Iannucci. Slow Horses sits between them. It is a spy story, and it is also funny.",
      },
      comedy: {
        name: "Comedy",
        blurb:
          "The largest section on the list. There are mockumentary workplace comedies (both versions of The Office, and Parks and Recreation), fast sitcoms (30 Rock, Arrested Development, Community), semi-autobiographical shows with an author’s stamp (Fleabag, Atlanta, Louie, Girls), and three sketch shows (Key & Peele, Chappelle’s Show, I Think You Should Leave). Most episodes run 20 to 30 minutes.",
      },
      spec: {
        name: "Sci-Fi & Fantasy",
        blurb:
          "Invented worlds (Game of Thrones), space (Battlestar Galactica, Andor), near-future technology (Black Mirror, Severance), dystopias (The Handmaid’s Tale, Squid Game), and the time after a plague (Station Eleven) are all here. Lost, Twin Peaks: The Return, and The OA pile on mysteries and refuse a tidy answer. People who like that like it a lot, and some people cannot stay with it.",
      },
      life: {
        name: "A Life",
        blurb:
          "Dramas that don’t sit in the sections above: family, love, growing up, illness, and work. There are job shows, about football (Friday Night Lights), hospitals (House, The Pitt), a restaurant (The Bear), and a law firm (The Good Wife), and also Six Feet Under and The Leftovers, which go straight at death and loss. The Bear is submitted to the Emmys as a comedy, but it plays more like a drama, so it is in this section.",
      },
      doc: {
        name: "Nonfiction",
        blurb:
          "Reality shows and documentaries. The competition shows are Survivor, RuPaul’s Drag Race, and The Great British Baking Show. The documentaries are Anthony Bourdain’s two food-travel series and the BBC’s Planet Earth. Nathan Fielder’s Nathan for You and The Rehearsal, and How To with John Wilson, film real people and real events, and the jokes come as thick as in a comedy.",
      },
    },
    colophon:
      "Chinese titles use the names most common in Chinese-speaking places, and search also accepts familiar aliases. Creators, cast, and plots are short notes from public sources. Playbill notes are ours and stay with the work. List-native highlights for this ranking will be added later.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "century-tv-20th": {
    title: "Great TV of the 20th Century (Global)",
    kicker: "Playbill · curated anthology",
    dek: "A curated anthology of representative TV dramas from the 20th century and selected extensions into the 2000s. Thirteen sections follow the source document’s regions and themes. Each entry has a plot and a highlight; titles may also appear on other Playbill lists.",
    noun: "show",
    creator: "Creators",
    search: "Title, cast, or creator, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that show.",
    empty: "No matches. Try a title, a name, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {
      cn: { name: "Chinese-language", blurb: "Classics from mainland and Hong Kong TV." },
      uk: { name: "United Kingdom", blurb: "BBC and ITV: adaptations, satire, and comedy." },
      jp: { name: "Japan", blurb: "The golden age of Japanese serial drama." },
      euro: { name: "Europe & Latin America", blurb: "Heimat, La Piovra, and other regional landmarks." },
      "us-picks": { name: "U.S. highlights", blurb: "Hand-picked American series from the 20th century." },
      "tv-book": { name: "TV: The Book", blurb: "Sepinwall & Seitz’s top thirty American series." },
      us70: { name: "1970s U.S.", blurb: "Mass-audience hits and social resonance." },
      us80: { name: "1980s U.S.", blurb: "Family viewing and network dominance." },
      us90: { name: "1990s U.S.", blurb: "Must-see network television." },
      us00: { name: "2000s U.S.", blurb: "Cable and cultural breakout shows." },
      us10: { name: "2010s U.S.", blurb: "Streaming-era phenomena." },
      aesthetics: { name: "Cinematography", blurb: "Shows chosen for image and sound design." },
      "more-art": { name: "Further picks", blurb: "Additional high-prestige series from the anthology." },
    },
    colophon:
      "Plots and highlights are taken from the Playbill anthology document unless noted. Creators, cast, and titles in Chinese follow TMDB and Douban where available.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "emmy-outstanding-series": {
    title: "Emmy · Outstanding Series",
    kicker: "Primetime Emmy Awards",
    dek: "Primetime Emmy Award winners for Outstanding Drama Series and Outstanding Comedy Series, newest ceremony year first. Each row is one winning season (season labeled). When a series wins more than once, the full plot and playbill appear only on the newest win; earlier years keep the win line only. Filter by decade and year in the sidebar, and by Drama / Comedy tags. Early decades are representative highlights from the source anthology.",
    noun: "show",
    creator: "Creators",
    search: "Title, cast, or creator, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that show.",
    empty: "No matches. Try a title, a name, a tag, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Ceremony years and Drama / Comedy winners follow chapter 10 of the Playbill anthology PDF. Each entry is one winning season (season from the source or a verified mapping). When a series wins in several years, plot and playbill show only on the newest win; older rows keep the win line and a link to that primary entry. Early decades list representative winners rather than a complete yearly roll. Titles may also appear on other Playbill lists.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "critics-choice-film": {
    title: "Critics Choice · Best Picture",
    kicker: "Critics Choice Awards · Best Picture",
    dek: "Critics Choice Award for Best Picture winners, newest ceremony year first. Filter by decade and year in the sidebar. Coverage runs from the first awards (1996) through the latest ceremony.",
    noun: "film",
    creator: "Director",
    search: "Title, director, or cast, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that film.",
    empty: "No matches. Try a title, a name, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Ceremony years and Best Picture winners follow the Wikipedia Critics' Choice Movie Award for Best Picture roll and official Critics Choice Association archives. Edition notes use the annual ceremony numbering. Titles may also appear on other Playbill lists.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "critics-choice-tv": {
    title: "Critics Choice · Best Series",
    kicker: "Critics Choice Awards · Best Series",
    dek: "Critics Choice Award winners for Best Drama Series and Best Comedy Series, newest ceremony year first. Each row is one winning season (season labeled). When a series wins more than once, the full plot and playbill appear only on the newest win; earlier years keep the win line only. Filter by decade and year in the sidebar, and by Drama / Comedy tags. Two ceremonies were held in 2016 (mid-year and December); both are included. Television awards began in 2011.",
    noun: "show",
    creator: "Creators",
    search: "Title, cast, or creator, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that show.",
    empty: "No matches. Try a title, a name, a tag, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Ceremony years and Drama / Comedy winners follow Wikipedia’s Critics' Choice Television Award pages and official Critics Choice Association winners lists. Each entry is one winning season (season from a verified mapping where known). When a series wins in several years, plot and playbill show only on the newest win; older rows keep the win line and a link to that primary entry. Titles may also appear on other Playbill lists.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "great-directors": {
    title: "TSPDT Top 250 Directors",
    kicker: "They Shoot Pictures, Don't They?",
    dek: "Curated filmographies for the TSPDT 2026 Top 250 directors: acclaimed features (classics, festival/Oscar notes, or hot picks)—shorts omitted. Browse by director or by film; filter by country, tags, and awards.",
    noun: "film",
    creator: "Director",
    search: "Title or director",
    idle: "",
    empty: "No matches.",
    found: "{n} found",
    none: "No matches.",
    sections: {},
    colophon:
      "Chinese titles prefer mainland usage where known. Filmographies are curated from Wikidata-based research (Grok v3); co-directed titles may appear under each director.",
    ratings: "Ratings from Douban and IMDb when available.",
  },
  "golden-horse-best-film": {
    title: "Golden Horse · Best Narrative Feature",
    kicker: "Taipei Golden Horse Awards · Best Narrative Feature",
    dek: "Golden Horse Award for Best Narrative Feature winners, newest ceremony year first. Filter by decade and year in the sidebar. No awards were held in 1964 or 1974.",
    noun: "film",
    creator: "Director",
    search: "Title, director, or cast, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that film.",
    empty: "No matches. Try a title, a name, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Ceremony years and Best Narrative Feature winners follow the Wikipedia Golden Horse Award for Best Narrative Feature roll. Edition notes use the annual ceremony numbering. Titles may also appear on other Playbill lists.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "hkfa-best-film": {
    title: "Hong Kong Film Awards · Best Film",
    kicker: "Hong Kong Film Awards · Best Film",
    dek: "Hong Kong Film Award for Best Film winners, newest ceremony year first. Filter by decade and year in the sidebar. Coverage runs from the first awards (1982) through the latest ceremony.",
    noun: "film",
    creator: "Director",
    search: "Title, director, or cast, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that film.",
    empty: "No matches. Try a title, a name, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Ceremony years and Best Film winners follow the Wikipedia Hong Kong Film Award for Best Film roll. Edition notes use the annual ceremony numbering. Titles may also appear on other Playbill lists.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "bafta-best-film": {
    title: "BAFTA · Best Film",
    kicker: "BAFTA · Best Film",
    dek: "BAFTA Award for Best Film winners, newest ceremony year first. Filter by decade and year in the sidebar. Wikipedia lists films by release year; the sidebar uses ceremony year (release year + 1), matching Oscar and Critics Choice on this site. The 1962 ceremony tied Ballad of a Soldier and The Hustler; both are included.",
    noun: "film",
    creator: "Director",
    search: "Title, director, or cast, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that film.",
    empty: "No matches. Try a title, a name, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Film years and Best Film winners follow the Wikipedia BAFTA Award for Best Film roll; ceremony year in the sidebar is film year + 1. Edition notes use BAFTA ceremony numbering. Titles may also appear on other Playbill lists.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "tspdt-1000": {
    title: "TSPDT 1,000 Greatest Films",
    kicker: "They Shoot Pictures, Don't They? · 2025",
    dek: "They Shoot Pictures, Don't They? 1,000 Greatest Films (2025 edition), in official rank order. Filter by rank band (100 titles each) in the sidebar. Titles and years follow the TSPDT sortable table; article-final forms are normalized slightly for search.",
    noun: "film",
    creator: "Director",
    search: "Title, director, or cast, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that film.",
    empty: "No matches. Try a title, a name, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {
      r001: { name: "1–100", blurb: "" },
      r101: { name: "101–200", blurb: "" },
      r201: { name: "201–300", blurb: "" },
      r301: { name: "301–400", blurb: "" },
      r401: { name: "401–500", blurb: "" },
      r501: { name: "501–600", blurb: "" },
      r601: { name: "601–700", blurb: "" },
      r701: { name: "701–800", blurb: "" },
      r801: { name: "801–900", blurb: "" },
      r901: { name: "901–1000", blurb: "" },
    },
    colophon:
      "Rank order, titles, and years follow the TSPDT 2025 1,000 Greatest Films sortable table. Directors in the seed note column are from that table. Titles may also appear on other Playbill lists.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "cesar-best-film": {
    title: "César · Best Film",
    kicker: "César · Meilleur film",
    dek: "César Award for Best Film winners, newest ceremony year first. Filter by decade and year in the sidebar. Coverage runs from the first awards (1976) through the latest ceremony.",
    noun: "film",
    creator: "Director",
    search: "Title, director, or cast, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that film.",
    empty: "No matches. Try a title, a name, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Ceremony years and Best Film winners follow the Wikipedia César Award for Best Film roll. Edition notes use the annual ceremony numbering. Titles may also appear on other Playbill lists.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "bafta-tv": {
    title: "BAFTA Television · Best Series",
    kicker: "BAFTA Television Awards",
    dek: "BAFTA Television Award winners for Best Drama Series, Best Scripted Comedy, and Best Limited Drama (Mini-Series), newest ceremony year first. When a series wins more than once, the full plot and playbill appear only on the newest win; earlier years keep the win line only. Filter by decade and year in the sidebar, and by Drama / Comedy / Limited tags.",
    noun: "show",
    creator: "Creators",
    search: "Title, cast, or creator, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that show.",
    empty: "No matches. Try a title, a name, a tag, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Ceremony years and Drama / Scripted Comedy / Limited (Mini-Series) winners follow the Wikipedia BAFTA Television Award pages. Limited Drama uses the Best Mini-Series roll (recent official name). When a series wins in several years, plot and playbill show only on the newest win. Titles may also appear on other Playbill lists.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "peabody-entertainment": {
    title: "Peabody · Entertainment Series",
    kicker: "Peabody Awards · Entertainment",
    dek: "Peabody Award entertainment honorees that are scripted series or miniseries, newest award year first. News, documentaries, children’s/youth, features, music films, standup specials, late-night talk/satire, and single-segment awards are filtered out. Pre-2010 coverage adds verified entertainment landmarks. Filter by decade and year in the sidebar.",
    noun: "show",
    creator: "Creators",
    search: "Title, cast, or creator, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that show.",
    empty: "No matches. Try a title, a name, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Award years follow Wikipedia Peabody winner lists. Entertainment sections (including combined entertainment headings) are kept; news, docs, kids/youth, features, music films, standup specials, late-night talk/satire, and segment awards are excluded. A curated set of pre-2010 entertainment series Peabodys is included. Titles may also appear on other Playbill lists.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "tca-awards": {
    title: "TCA Awards",
    kicker: "Television Critics Association",
    dek: "TCA Award winners for Program of the Year, Outstanding Achievement in Drama, and Outstanding Achievement in Comedy, newest ceremony year first. Wikipedia labels broadcast seasons (e.g. 2024–2025); the sidebar uses the season’s end year as the ceremony year. When a series wins more than once, the full plot and playbill appear only on the newest win. Filter by decade and year, and by Program of the Year / Drama / Comedy tags.",
    noun: "show",
    creator: "Creators",
    search: "Title, cast, or creator, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that show.",
    empty: "No matches. Try a title, a name, a tag, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Ceremony years and Program of the Year / Drama / Comedy winners follow the Wikipedia TCA Award pages (season end year = ceremony year). When a series wins in several years, plot and playbill show only on the newest win. Titles may also appear on other Playbill lists.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "baeksang-best-drama": {
    title: "Baeksang · Best Drama",
    kicker: "Baeksang Arts Awards · Best Drama",
    dek: "Baeksang Arts Award for Best Drama (TV) winners, newest ceremony year first. Filter by decade and year in the sidebar. Coverage runs from the 11th awards (1975) through the latest ceremony.",
    noun: "show",
    creator: "Creators",
    search: "Title, cast, or creator, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that show.",
    empty: "No matches. Try a title, a name, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Ceremony years and Best Drama winners follow the Wikipedia Baeksang Arts Award for Best Drama roll. Edition notes use the annual ceremony numbering. Titles may also appear on other Playbill lists.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
  "galaxy-awards-drama": {
    title: "Galaxy Awards · Drama",
    kicker: "ギャラクシー賞 · Television Drama",
    dek: "Japanese Galaxy Award (ギャラクシー賞) television-division drama Grand Prix and Outstanding winners only, newest ceremony year first. Broadcast year N maps to ceremony year N+1 in the sidebar. News, documentaries, and variety sprawl are excluded so the page stays list-shaped. Filter by decade and year, and by Grand Prix / Outstanding tags.",
    noun: "show",
    creator: "Creators",
    search: "Title, cast, or creator, or a rank such as 27",
    idle: "Press Enter, or pick a result, to jump to that show.",
    empty: "No matches. Try a title, a name, a tag, or a rank.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Ceremony years follow the Japanese Wikipedia Galaxy Award tables (broadcast year + 1). Only television-division drama Grand Prix and Outstanding titles are kept. Titles may also appear on other Playbill lists.",
    ratings:
      "Ratings are from Douban and IMDb, as of {date}. Douban scores each season separately. A show with several seasons displays the average (marked avg; hover for each season). Seasons with too few votes are left out.",
  },
};

export const home = {
  titleEn: "Playbill",
  dekEn:
    "Film and television lists, arranged so you can pick something to watch. Each title has the name, the dates, the creators, the cast, a plot, and a highlight, grouped by type, and searchable on the page.",
  descriptionEn: "Film and television lists: titles, creators, cast, plots, and highlights.",
};

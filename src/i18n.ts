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
    dek: "The Criterion Collection catalog, ordered by spine number. Numbers come from Criterion’s official shop list; box sets and titles without a spine are left out for now. Search by spine number, English title, or director.",
    noun: "film",
    creator: "Director",
    search: "Title, director, or a spine number such as 65",
    idle: "Press Enter, or pick a result, to jump to that film.",
    empty: "No matches. Try a title, a name, or a spine number.",
    found: "Found {n}. Press Enter for the first, or pick one from the list.",
    none: "No matches.",
    sections: {},
    colophon:
      "Chinese titles use the names most common in Chinese-speaking places, and search also accepts familiar aliases. Directors, cast, and plots are short notes from public sources. Spine numbers are Criterion’s; the list is refreshed from their shop browse page. Playbill notes are ours and stay with the work.",
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
};

export const home = {
  titleEn: "Playbill",
  dekEn:
    "Film and television lists, arranged so you can pick something to watch. Each title has the name, the dates, the creators, the cast, a plot, and a highlight, grouped by type, and searchable on the page.",
  descriptionEn: "Film and television lists: titles, creators, cast, plots, and highlights.",
};

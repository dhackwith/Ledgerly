/**
 * Built-in, region-neutral keyword lexicon for cold start (plan 2.6). It enters
 * the model only as Dirichlet pseudo-counts, so a user's own labels outweigh it
 * after a couple of examples. Keys are already normalized (see the integrity
 * test) and hold at most MAX_LEXICON_TOKENS tokens. No user data lives here.
 */
import type { Category } from "@/lib/types";

/** Bump on any lexicon edit; MODEL_VERSION should be bumped with it. */
export const LEXICON_VERSION = "1";

export const MAX_LEXICON_TOKENS = 3;

export const LEXICON: Readonly<Record<Category, readonly string[]>> = {
  Food: [
    "restaurant", "cafe", "coffee", "espresso", "latte", "bakery", "bagel", "bagels", "deli", "diner",
    "bistro", "grill", "pizza", "pizzeria", "sushi", "ramen", "taco", "tacos", "taqueria", "burrito",
    "burger", "burgers", "bbq", "steakhouse", "kitchen", "eatery", "noodle", "noodles", "pho", "thai",
    "curry", "kebab", "falafel", "sandwich", "sandwiches", "salad", "brunch", "breakfast", "lunch",
    "dinner", "takeout", "snack", "snacks", "dessert", "donut", "donuts", "ice cream", "smoothie",
    "juice", "tea", "boba", "bubble tea", "pub", "beer", "groceries", "grocery", "supermarket",
    "market", "farmers market", "butcher", "produce", "food", "meal", "starbucks", "dunkin", "peets",
    "tim hortons", "costa", "blue bottle", "mcdonalds", "burger king", "wendys", "kfc", "subway", "chipotle",
    "panera", "dominos", "pizza hut", "papa johns", "taco bell", "chick fil a", "five guys",
    "shake shack", "popeyes", "panda express", "sweetgreen", "dennys", "ihop", "olive garden",
    "applebees", "whole foods", "trader joes", "safeway", "kroger", "aldi", "lidl", "publix",
    "wegmans", "albertsons", "tesco", "sainsburys", "heb", "sprouts", "instacart", "doordash",
    "uber eats", "grubhub", "deliveroo", "just eat", "postmates", "seamless", "hellofresh",
    "blue apron", "7 eleven", "\u2615", "\u{1f355}", "\u{1f354}", "\u{1f363}",
  ],
  Transportation: [
    "uber", "lyft", "taxi", "cab", "bolt", "grab", "didi", "shell", "chevron", "exxon", "exxonmobil",
    "mobil", "bp", "texaco", "arco", "sunoco", "valero", "citgo", "speedway", "circle k", "gas",
    "fuel", "gasoline", "petrol", "diesel", "gas station", "parking", "parkmobile", "toll", "tolls",
    "e zpass", "ezpass", "metro", "metrocard", "transit", "bus", "bus fare", "train", "rail",
    "amtrak", "greyhound", "mta", "bart", "airline", "airlines", "flight", "airfare", "delta",
    "united airlines", "american airlines", "southwest", "jetblue", "ryanair", "easyjet", "car wash",
    "oil change", "jiffy lube", "tire", "tires", "auto repair", "mechanic", "dmv", "rental car",
    "hertz", "avis", "zipcar", "bike share", "citi bike", "scooter", "ferry", "garage",
    "\u26fd", "\u{1f695}", "\u{1f697}",
  ],
  Entertainment: [
    "netflix", "spotify", "hulu", "disney", "disney plus", "hbo", "hbo max", "youtube premium",
    "apple music", "apple tv", "paramount", "peacock", "prime video", "twitch", "steam",
    "playstation", "xbox", "nintendo", "epic games", "game", "games", "gaming", "movie", "movies",
    "cinema", "cinemas", "theater", "theatre", "theatres", "amc", "regal", "cinemark", "imax",
    "concert", "tickets", "ticketmaster", "stubhub", "eventbrite", "live nation", "festival",
    "museum", "zoo", "aquarium", "bowling", "lanes", "arcade", "mini golf", "golf", "karaoke",
    "comedy", "nightclub", "theme park", "six flags", "patreon", "bar", "\u{1f3ac}", "\u{1f3ae}",
  ],
  Shopping: [
    "amazon", "amzn", "amzn mktp", "walmart", "target", "costco", "best buy", "bestbuy", "ikea",
    "home depot", "lowes", "ebay", "etsy", "wayfair", "macys", "nordstrom", "kohls", "tj maxx",
    "marshalls", "old navy", "gap", "h&m", "zara", "uniqlo", "nike", "adidas", "sephora", "ulta",
    "apple store", "newegg", "shein", "temu", "aliexpress", "asos", "primark", "argos",
    "dollar tree", "dollar general", "staples", "office depot", "barnes noble", "clothes",
    "clothing", "shoes", "shirt", "jeans", "dress", "jacket", "electronics", "headphones", "laptop",
    "furniture", "hardware", "hardware store", "mall", "outlet", "boutique", "books", "bookstore",
    "toys", "toy", "cosmetics", "makeup", "jewelry", "mattress", "appliance", "outfitters",
    "\u{1f6cd}",
  ],
  Bills: [
    "rent", "mortgage", "landlord", "hoa", "electric", "electricity", "electric bill", "power bill",
    "utility", "utilities", "water bill", "gas bill", "sewer", "trash", "internet", "wifi",
    "broadband", "cable", "comcast", "xfinity", "spectrum", "cox", "verizon", "at&t", "t mobile",
    "sprint", "vodafone", "phone bill", "cell phone", "insurance", "geico", "state farm",
    "progressive", "allstate", "health insurance", "car insurance", "loan", "student loan",
    "car payment", "credit union", "gym", "gym membership", "planet fitness", "la fitness",
    "equinox", "icloud", "google storage", "google one", "dropbox", "microsoft", "adobe", "tax",
    "taxes", "irs", "daycare", "tuition", "childcare", "pg&e", "con edison", "duke energy",
    "national grid", "amazon prime", "property management", "\u{1f9fe}",
  ],
  Other: [
    "atm", "cash withdrawal", "withdrawal", "haircut", "barber", "salon", "nails", "laundry",
    "laundromat", "dry cleaning", "dry cleaner", "cleaners", "donation", "charity", "church", "gift",
    "gifts", "doctor", "dentist", "copay", "pharmacy", "cvs", "walgreens", "rite aid", "hospital",
    "clinic", "vet", "veterinarian", "pet", "petco", "petsmart", "post office", "usps", "fedex",
    "ups", "shipping", "stamps", "fine", "parking ticket", "bank fee", "fee", "fees", "venmo",
    "zelle", "transfer",
  ],
};

let index: Map<string, Category> | null = null;

/** Normalized key -> category. Built once; later duplicates never override earlier keys. */
export function lexiconIndex(): ReadonlyMap<string, Category> {
  if (index) return index;
  const built = new Map<string, Category>();
  for (const [category, keys] of Object.entries(LEXICON) as [Category, readonly string[]][]) {
    for (const key of keys) if (!built.has(key)) built.set(key, category);
  }
  index = built;
  return built;
}

export interface LexiconHit {
  key: string;
  category: Category;
}

/**
 * Greedy longest-match over the tokens, left to right, so "uber eats" wins over
 * "uber" and "gas bill" over "gas". Linear in the number of tokens.
 */
export function matchLexicon(tokens: readonly string[]): LexiconHit[] {
  const lex = lexiconIndex();
  const hits: LexiconHit[] = [];
  let i = 0;
  while (i < tokens.length) {
    let matched = 0;
    for (let n = Math.min(MAX_LEXICON_TOKENS, tokens.length - i); n >= 1; n--) {
      const key = n === 1 ? tokens[i] : tokens.slice(i, i + n).join(" ");
      const category = lex.get(key);
      if (category) {
        hits.push({ key, category });
        matched = n;
        break;
      }
    }
    i += matched || 1;
  }
  return hits;
}

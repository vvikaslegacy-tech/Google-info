function sanitizeText(value) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return /^(?:n\/a|null|undefined|-|no reviews?)$/i.test(text) ? "" : text;
}

export function formatSearchQuery({ query, category, location, targetRole = "CEO" }) {
  const parts = [];
  if (query && query.trim()) {
    const q = query.trim();
    if (!q.toLowerCase().includes("ceo") && !q.toLowerCase().includes("owner") && !q.toLowerCase().includes("executive") && !q.toLowerCase().includes("founder") && !q.toLowerCase().includes("president") && !q.toLowerCase().includes("superintendent") && !q.toLowerCase().includes("director")) {
      parts.push(`${targetRole} of ${q}`);
    } else {
      parts.push(q);
    }
  }
  if (category && category.trim()) {
    const cat = category.trim();
    const existing = parts.join(" ").toLowerCase();
    if (!existing.includes(cat.toLowerCase())) {
      parts.push(cat);
    }
  }
  if (location && location.trim()) {
    const loc = location.trim();
    const existing = parts.join(" ").toLowerCase();
    // Do not append location if query is specifically an executive/leadership query
    const isExecQuery = parts.some(p => /^(?:ceo|owner|founder|president|executive|superintendent|director)/i.test(p) || /\b(?:ceo|founder|president|executive|superintendent|director)\b/i.test(p));
    if (!isExecQuery && !existing.includes(loc.toLowerCase())) {
      parts.push(loc);
    }
  }
  return parts.join(" ");
}

// Comprehensive stop words list to prevent prepositions, conjunctions, verbs, corporate terms and dates from matching as executive names
const STOP_WORDS = new Set([
  'in', 'on', 'at', 'for', 'of', 'with', 'from', 'by', 'to', 'into', 'over', 'under',
  'about', 'between', 'through', 'after', 'before', 'during', 'and', 'or', 'but', 'nor',
  'yet', 'so', 'than', 'as', 'via', 'per', 'all', 'any', 'both', 'each', 'more', 'most',
  'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'too', 'very',
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'his', 'her', 'their', 'its', 'our',
  'your', 'my', 'who', 'whom', 'whose', 'which', 'what', 'he', 'she', 'it', 'they', 'we',
  'is', 'was', 'were', 'been', 'being', 'are', 'has', 'have', 'had', 'does', 'do', 'did',
  'serves', 'served', 'serving', 'service', 'services', 'sits', 'sat', 'sitting',
  'leads', 'led', 'leading', 'heads', 'headed', 'heading', 'steps', 'stepped', 'retired',
  'assumes', 'assumed', 'assuming', 'joined', 'joins', 'joining', 'appointed', 'appointing',
  'named', 'naming', 'elected', 'electing', 'announced', 'announcing', 'succeed', 'succeeds',
  'succeeding', 'succeeded', 'founded', 'founding', 'operates', 'operating', 'operated',
  'manages', 'managing', 'managed', 'directs', 'directing', 'directed', 'works', 'working',
  'worked', 'helping', 'helped', 'helps', 'help', 'welcomed', 'became', 'become', 'takes',
  'taken', 'taking', 'preceding', 'succeeding', 'challenge', 'challenging', 'challenged',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
  'october', 'november', 'december', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
  'saturday', 'sunday',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'twenty', 'thirty', 'forty',
  'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million',
  'billion', 'first', 'second', 'third', 'fourth', 'fifth', 'year', 'years', 'month', 'months',
  'day', 'days', 'time', 'times',
  'company', 'corporation', 'corporate', 'corp', 'inc', 'llc', 'ltd', 'group', 'partners',
  'capital', 'holdings', 'holding', 'management', 'ventures', 'solutions', 'consulting',
  'systems', 'technologies', 'technology', 'media', 'labs', 'interactive', 'enterprises',
  'industries', 'industry', 'global', 'national', 'international', 'federal', 'state',
  'city', 'county', 'district', 'school', 'hospital', 'health', 'healthcare', 'clinic',
  'medical', 'foundation', 'charity', 'institute', 'university', 'college', 'academy',
  'association', 'union', 'organization', 'agency', 'firm', 'studio', 'studios', 'center',
  'centre', 'club', 'bank', 'financial', 'insurance', 'realty', 'properties', 'property',
  'living', 'housing', 'development', 'energy', 'midstream', 'fund', 'funds', 'oil', 'gas',
  'petroleum', 'fractional', 'commercial', 'residential', 'retail', 'wholesale',
  'hotel', 'hotels', 'motel', 'resort', 'resorts', 'inn', 'suites', 'food', 'foods',
  'recycling', 'innovation', 'operations', 'operation', 'unity', 'peak', 'trust',
  'alliance', 'network', 'networks', 'services', 'service', 'products', 'brands', 'brand',
  'ceo', 'cfo', 'coo', 'cto', 'cmo', 'cio', 'cro', 'cso', 'executive', 'chief', 'officer',
  'director', 'president', 'founder', 'co-founder', 'owner', 'co-owner', 'chairman',
  'chairwoman', 'chairperson', 'head', 'leader', 'partner', 'manager', 'superintendent',
  'chancellor', 'principal', 'associate', 'assistant', 'deputy', 'vice', 'senior', 'junior',
  'interim', 'past', 'former', 'current', 'previous', 'incoming', 'outgoing',
  'com', 'org', 'net', 'edu', 'gov', 'io', 'co', 'biz', 'info', 'www', 'http', 'https',
  'html', 'pdf', 'url', 'linkedin', 'twitter', 'facebook', 'instagram', 'youtube', 'wikipedia',
  'zoominfo', 'google', 'yahoo', 'duckduckgo', 'serper', 'search', 'results', 'result'
]);

export function cleanDomainToCompanyName(domain) {
  if (!domain || typeof domain !== "string") return "";
  const clean = domain.trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\.(?:com|org|net|co|io|biz|info|us|ca|uk|gov|edu)(?:\.[a-z]{2})?$/i, "");

  if (!clean) return "";

  const KNOWN = {
    "att": "AT&T",
    "hpb": "Half Price Books",
    "hsgd": "HSGD",
    "s2cp": "S2 Capital",
    "txwf": "Texas Women's Foundation",
    "uspi": "USPI",
    "vnatexas": "VNA Texas",
    "srsre": "SRS Real Estate Partners",
    "dpr": "DPR Construction",
    "r-o": "R-O",
    "bcwilliams": "BC Williams Food",
    "aegvision": "AEG Vision",
    "usacpartners": "USAC Partners",
    "aiscaregroup": "AIS Care Group",
    "hksinc": "HKS Inc",
    "pmg": "PMG",
    "jmbullion": "JM Bullion",
    "embarkwithus": "Embark",
    "austin-ind": "Austin Industries",
    "ieaworld": "IEA World"
  };

  if (KNOWN[clean]) return KNOWN[clean];

  if (clean.includes("-")) {
    return clean.split("-")
      .filter(Boolean)
      .map(part => KNOWN[part] || (part.charAt(0).toUpperCase() + part.slice(1)))
      .join("-");
  }

  const dictionary = [
    "atlantic", "hotels", "hotel", "group", "empire", "central", "financial", "sales",
    "tailwater", "capital", "petro", "midstream", "energy", "methodist", "recycling",
    "movie", "grill", "wealth", "management", "transfer", "lending", "property",
    "solutions", "company", "industries", "living", "senior", "supply", "truss",
    "dairy", "healthcare", "health", "system", "mechanical", "agency", "studios",
    "partners", "holdings", "ventures", "consulting", "interactive", "enterprises",
    "housing", "bottle", "rocket", "national", "wholesale", "consolidated", "choice",
    "compass", "medical", "city", "rehab", "rehabilitation", "harvest", "infinite",
    "field", "pulse", "prime", "rosewood", "pariveda", "sonida", "trive", "pharos",
    "oak", "corgan", "zion", "headington", "everest", "borden", "compatriot", "callbox",
    "spentra", "salmeron", "dove", "organ", "munck", "wilson", "yendo", "sebastian",
    "hunt", "sewell", "hillwood", "atmos", "vaquero", "talus", "pay", "texas", "bhr",
    "reit", "benchmark", "aspire", "hr", "duke", "project", "unity", "carson", "kpost",
    "moroch", "entech", "one", "day"
  ];

  let remaining = clean;
  const words = [];
  while (remaining.length > 0) {
    let matched = null;
    for (const w of dictionary) {
      if (remaining.startsWith(w)) {
        if (!matched || w.length > matched.length) {
          matched = w;
        }
      }
    }
    if (matched) {
      words.push(matched.charAt(0).toUpperCase() + matched.slice(1));
      remaining = remaining.slice(matched.length);
    } else {
      words.push(remaining.charAt(0).toUpperCase() + remaining.slice(1));
      break;
    }
  }

  return words.join(" ");
}

export function sanitizeCandidateName(raw) {
  if (!raw || typeof raw !== "string") return "";
  let str = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .trim();

  // Strip prefixes like "com ", "org ", "and ", "Dr. ", etc.
  const prefixRegex = /^(?:https?:\/\/\S+|www\.\S+|[a-z0-9-]+\.(?:com|org|net|io|co|edu|gov)|\b(?:com|org|net|edu|gov)\b|and|or|the|a|an|in|at|on|for|of|with|from|by|to|as|is|our|former|new|interim|current|serves|joined|includes|including|succeed|president|founder|ceo|cfo|coo|dr\.|dr|mr\.|mr|mrs\.|mrs|ms\.|ms|prof\.|prof)\s+/i;
  while (prefixRegex.test(str)) {
    str = str.replace(prefixRegex, "").trim();
  }

  // Strip suffixes like " serves", " and", " Jr.", etc.
  const suffixRegex = /\s+(?:serves|served|serving|sits|sat|leads|led|heads|headed|steps|stepped|retired|assumes|assumed|joined|and|or|is|was|has|had|com|org|inc|llc|corp|ltd)$/i;
  while (suffixRegex.test(str)) {
    str = str.replace(suffixRegex, "").trim();
  }

  // Strip trailing punctuation
  str = str.replace(/[.,:;!?'"\\/|\\-]+$/, "").trim();

  // Deduplicate consecutive identical words: e.g. "Wojciechowski Matt Wojciechowski"
  const tokens = str.split(/\s+/);
  if (tokens.length >= 3 && tokens[0].toLowerCase() === tokens[tokens.length - 1].toLowerCase()) {
    str = tokens.slice(1).join(" ");
  }

  return str;
}

export function isValidExecutiveName(name, companyName = "", domain = "") {
  if (!name || typeof name !== "string") return false;
  const clean = sanitizeCandidateName(name);
  if (!clean || clean.length < 4 || clean.length > 40) return false;

  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 4) return false;

  const normComp = (companyName || "").toLowerCase().replace(/[^a-z]/g, "");
  const normDomain = (domain || "").toLowerCase().replace(/[^a-z]/g, "");
  const normCandidate = clean.toLowerCase().replace(/[^a-z]/g, "");

  if (normComp && (normCandidate === normComp || (normComp.length > 3 && normComp.includes(normCandidate)))) return false;
  if (normDomain && (normCandidate === normDomain || (normDomain.length > 3 && normDomain.includes(normCandidate)))) return false;

  for (const token of tokens) {
    const rawWord = token.replace(/[^a-zA-Z]/g, "");
    const lower = rawWord.toLowerCase();
    if (!rawWord) return false;

    // Single letter initial like "T." or "M."
    if (token.length <= 2 && /^[A-Z]\.?$/.test(token)) continue;

    // Must be capitalized: First letter uppercase, remainder letters/hyphens (allows McCartney, O'Connor)
    if (!/^[A-Z][A-Za-z'-]+$/.test(token)) return false;

    // Word CANNOT be a stop word
    if (STOP_WORDS.has(lower)) return false;
  }

  return true;
}

export function isPersonName(name, companyName = "", domain = "") {
  return isValidExecutiveName(name, companyName, domain);
}

export function extractExecutiveName(title, snippet, companyName = "", domain = "") {
  let text = `${title || ""} ${snippet || ""}`;
  if (!text.trim()) return "";

  // Pre-clean text: strip URLs, domain artifacts and HTML entities
  text = text.replace(/<[^>]+>/g, " ")
             .replace(/&quot;/g, '"')
             .replace(/&#x27;/g, "'")
             .replace(/&amp;/g, "&")
             .replace(/&nbsp;/g, " ")
             .replace(/\b(?:https?:\/\/|www\.)\S+\b/g, " ")
             .replace(/\b[a-z0-9-]+\.(?:com|org|net|io|co|edu|gov)\b/gi, " ")
             .replace(/[\r\n\t]+/g, " ");

  const honorific = "(?:Dr\\.|Dr|Mr\\.|Mr|Mrs\\.|Mrs|Ms\\.|Ms|Prof\\.|Prof)?\\s*";
  // Strict capitalized name token: e.g. "John Smith", "Christopher T. Forsythe", "Kathryn McCartney"
  const namePattern = "([A-Z][A-Za-z'-]+(?:\\s+[A-Z]\\.?|\\s+[A-Z][A-Za-z'-]+){1,3})";
  const ceoRoles = "(?:CEO|Chief Executive Officer|Chief Executive)";
  const secondaryRoles = "(?:Owner|Founder|Co-Founder|President|Superintendent|Managing Director|Executive Director|Director|Headmaster|Chancellor|Chairman|Chairwoman|Chairperson|Principal)";

  // Strict CEO patterns
  const ceoPatterns = [
    new RegExp(`\\b${honorific}${namePattern}\\b[^,.\\n]{0,80}?\\b(?:will\\s+assume|assumes?|stepped into|transitioning to|appointed as|named as|serves as|is(?:\\s+the)?|takes\\s+over\\s+as|became)\\s+(?:the\\s+role\\s+of\\s+)?(?:the\\s+)?(?:new\\s+)?${ceoRoles}\\b`),
    new RegExp(`\\b${honorific}${namePattern}\\s*(?:,\\s*|\\s+[-–—|]\\s+|\\s+is\\s+(?:the\\s+)?|\\s+as\\s+)${ceoRoles}\\b`),
    new RegExp(`\\b${ceoRoles}\\s*(?::|[-–—|]|is|named)?\\s+${honorific}${namePattern}\\b`),
    new RegExp(`\\b${namePattern}\\s*\\(${ceoRoles}\\)`),
    new RegExp(`\\b${ceoRoles}\\s*(?:and|&)?\\s*(?:founder|co-founder)?\\s+${honorific}${namePattern}\\b`),
    new RegExp(`\\b${namePattern}\\s*,\\s*(?:founder|co-founder)?\\s*(?:and|&)?\\s*${ceoRoles}\\b`)
  ];

  for (const pat of ceoPatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      const candidate = sanitizeCandidateName(match[1]);
      if (isValidExecutiveName(candidate, companyName, domain)) {
        return candidate;
      }
    }
  }

  // Secondary leadership roles
  const secondaryPatterns = [
    new RegExp(`\\b${honorific}${namePattern}\\s*(?:,\\s*|\\s+[-–—|]\\s+|\\s+is\\s+(?:the\\s+)?|\\s+as\\s+)${secondaryRoles}\\b`),
    new RegExp(`\\b${secondaryRoles}\\s*(?::|[-–—|]|is|named)?\\s+${honorific}${namePattern}\\b`),
    new RegExp(`\\b${honorific}${namePattern}\\b[^,.\\n]{0,80}?\\b(?:will\\s+assume|assumes?|stepped into|transitioning to|appointed as|named as|serves as|is(?:\\s+the)?|as|to\\s+become|takes\\s+over\\s+as)\\s+(?:the\\s+role\\s+of\\s+)?(?:the\\s+)?(?:new\\s+)?${secondaryRoles}\\b`),
    new RegExp(`\\b(?:appointed|named|announced|elected|welcomed)\\s+${honorific}${namePattern}\\s+(?:as\\s+)?(?:new\\s+)?${secondaryRoles}\\b`),
    new RegExp(`\\b(?:founded|co-founded|led|headed|directed|managed)\\s+by\\s+${honorific}${namePattern}\\b`),
    new RegExp(`\\b${namePattern}\\s*\\(${secondaryRoles}\\)`)
  ];

  for (const pat of secondaryPatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      const candidate = sanitizeCandidateName(match[1]);
      if (isValidExecutiveName(candidate, companyName, domain)) {
        return candidate;
      }
    }
  }

  return "";
}

export function parseGoogleBusinessRecord(rawItem) {
  const name = sanitizeText(rawItem.name || rawItem.title || rawItem.companyName);
  const phone = sanitizeText(rawItem.phone || rawItem.phoneNumber || rawItem.tel);
  const website = sanitizeText(rawItem.website || rawItem.url || rawItem.link);
  const category = sanitizeText(rawItem.category || rawItem.type || rawItem.industry);
  const address = sanitizeText(rawItem.address || rawItem.location || rawItem.fullAddress);
  const rating = rawItem.rating != null ? String(rawItem.rating) : "";
  const reviewsCount = rawItem.reviewsCount != null ? String(rawItem.reviewsCount) : (rawItem.reviews != null ? String(rawItem.reviews) : "");
  const email = sanitizeText(rawItem.email);
  const ceoName = sanitizeText(rawItem.ceoName);
  return { name, ceoName, phone, website, category, address, rating, reviewsCount, email };
}

export function parseSerperResponse(data, companyName = "", domain = "") {
  const results = [];
  if (!data || typeof data !== "object") return results;

  let kgCeoName = "";

  // 1. Check Google Answer Box (direct executive/CEO answers from Google)
  if (data.answerBox) {
    const ab = data.answerBox;
    if (ab.answer) {
      const cleaned = sanitizeCandidateName(ab.answer);
      if (isValidExecutiveName(cleaned, companyName, domain)) {
        kgCeoName = cleaned;
      }
    }
    // Google bold highlighted entity from answerBox
    if (!kgCeoName && Array.isArray(ab.snippetHighlighted) && ab.snippetHighlighted.length > 0) {
      for (const h of ab.snippetHighlighted) {
        const cleanH = sanitizeCandidateName(h);
        if (isValidExecutiveName(cleanH, companyName, domain)) {
          kgCeoName = cleanH;
          break;
        }
      }
    }
    if (!kgCeoName && (ab.snippet || ab.title)) {
      kgCeoName = extractExecutiveName(ab.title, ab.snippet, companyName, domain);
    }
  }

  // 2. Check Knowledge Graph
  if (!kgCeoName && data.knowledgeGraph) {
    const kg = data.knowledgeGraph;
    if (kg.ceo) {
      const cleanCeo = sanitizeCandidateName(kg.ceo);
      if (isValidExecutiveName(cleanCeo, companyName, domain)) {
        kgCeoName = cleanCeo;
      }
    } else if (kg.attributes && typeof kg.attributes === "object") {
      for (const [k, v] of Object.entries(kg.attributes)) {
        if (/^(?:ceo|chief executive officer|founder|owner|president|co-founder|superintendent|executive director|managing director|headmaster|chancellor|principal|key people|leadership)/i.test(k)) {
          const val = sanitizeCandidateName(v);
          if (isValidExecutiveName(val, companyName, domain)) {
            kgCeoName = val;
            break;
          }
        }
      }
    }
    // Check if the Knowledge Graph card itself is for the CEO person
    if (!kgCeoName && kg.title) {
      const typeStr = String(kg.type || "").toLowerCase();
      const descStr = String(kg.description || "").toLowerCase();
      const isExecPerson = /chief executive|ceo|executive|founder|president|businessman|businessperson|director|superintendent/i.test(typeStr) ||
                           /chief executive|ceo|founder|president|director|appointed as|executive of/i.test(descStr);
      if (isExecPerson) {
        const cleanTitle = sanitizeCandidateName(kg.title);
        if (isValidExecutiveName(cleanTitle, companyName, domain)) {
          kgCeoName = cleanTitle;
        }
      }
    }
    if (!kgCeoName && kg.title) {
      kgCeoName = extractExecutiveName(kg.title, kg.description || "", companyName, domain);
    }
  }

  // 3. Scan organic search snippets if no CEO yet
  if (!kgCeoName && Array.isArray(data.organic)) {
    for (const item of data.organic) {
      const match = extractExecutiveName(item.title, item.snippet, companyName, domain);
      if (match) {
        kgCeoName = match;
        break;
      }
    }
  }

  if (Array.isArray(data.places)) {
    for (const p of data.places) {
      results.push({
        ceoName: kgCeoName,
        name: sanitizeText(p.title || p.name),
        phone: sanitizeText(p.phoneNumber || p.phone),
        website: sanitizeText(p.website || p.link),
        category: sanitizeText(p.category || p.type),
        address: sanitizeText(p.address || p.location),
        rating: p.rating != null ? String(p.rating) : "",
        reviewsCount: p.ratingCount != null ? String(p.ratingCount) : "",
        email: ""
      });
    }
  }

  if (Array.isArray(data.organic)) {
    for (const item of data.organic) {
      const execName = kgCeoName || extractExecutiveName(item.title, item.snippet, companyName, domain);
      results.push({
        ceoName: execName,
        name: sanitizeText(item.title),
        phone: "",
        website: sanitizeText(item.link),
        category: "Search Result",
        address: sanitizeText(item.snippet || ""),
        rating: "",
        reviewsCount: "",
        email: ""
      });
    }
  }

  return results;
}

export function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function extractDomainFromEmail(email) {
  if (!email || !email.includes("@")) return "";
  const parts = email.split("@");
  const domain = parts[1] ? parts[1].trim().toLowerCase() : "";
  if (/^(?:gmail|yahoo|hotmail|outlook|icloud|aol|protonmail|live|msn)\.com$/i.test(domain)) return "";
  return domain;
}

/**
 * Extracts city, state, and zip from a full address string.
 * "109 W Park Dr, Birmingham, Alabama, 35211, United States" → "Birmingham, Alabama 35211"
 */
export function extractCityStateZip(fullAddress) {
  if (!fullAddress) return "";
  const addr = fullAddress.trim();

  // Pattern: look for City, State Zip or City, State, Zip
  // Try to find a zip code first
  const zipMatch = addr.match(/\b(\d{5}(?:-\d{4})?)\b/);
  const zip = zipMatch ? zipMatch[1] : "";

  // Split by commas
  const parts = addr.split(",").map(p => p.trim()).filter(Boolean);

  if (parts.length === 1) return addr; // single value, return as-is

  // Remove country if last part is USA/United States/UK etc.
  const countryNames = /^(united states|usa|u\.s\.a|uk|united kingdom|canada|australia)$/i;
  const filtered = parts.filter(p => !countryNames.test(p));

  if (filtered.length === 0) return addr;

  // Try: last 2-3 meaningful parts = city, state [zip]
  // Usually: [street, city, state, zip, country]
  // We want city + state + zip
  if (filtered.length >= 3) {
    // Street is usually first — skip it if it has a number at start
    const startsWithNumber = /^\d+\s/.test(filtered[0]);
    const cityIdx = startsWithNumber ? 1 : 0;
    const city = filtered[cityIdx] || "";
    const state = filtered[cityIdx + 1] || "";
    const result = [city, state].filter(Boolean).join(", ");
    return zip && !result.includes(zip) ? `${result} ${zip}`.trim() : result;
  }

  if (filtered.length === 2) {
    return filtered.join(", ");
  }

  return filtered[filtered.length - 1]; // fallback: last part
}

/**
 * Extracts just the street address line (line 1 of address).
 * "109 W Park Dr, Birmingham, Alabama, 35211, United States" → "109 W Park Dr"
 */
export function extractStreetAddress(fullAddress) {
  if (!fullAddress) return "";
  const parts = fullAddress.split(",").map(p => p.trim()).filter(Boolean);
  // If starts with a number it's a street address
  if (parts.length >= 2 && /^\d+\s/.test(parts[0])) return parts[0];
  // If only one part or no number prefix, return the whole thing
  if (parts.length === 1) return parts[0];
  return parts[0]; // first comma-segment as street
}

/**
 * Normalise field label from ZoomInfo key-value exports
 */
function normaliseLabel(meta) {
  return meta.toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detect if a line looks like an email address
 */
function looksLikeEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

// ─── ZoomInfo V6 CSV Parser ───────────────────────────────────────────────────
// Handles 3 real export formats from ZoomInfo:
//
// FORMAT A — Key-Value pair (one field per line):
//   john.huhn@storytelleroverland.com,Email
//   John Huhn,Full Name
//   John,First Name
//   "109 W Park Dr, Birmingham, Alabama, 35211, United States",Company Address
//   Storyteller Overland,Company Name
//   Purchasing Agent,Job Title
//
// FORMAT B — Standard header CSV (one row per contact):
//   Email,First Name,Last Name,Job Title,Company Name,Company Address,...
//   john@acme.com,John,Huhn,CEO,Acme Corp,...
//
// FORMAT C — Headerless CSV (positional columns, no header row):
//   shandre.martin@storytelleroverland.com,"Shandre Martin","Production Associate",Storyteller Overland,"109 W Park Dr",...
//
export function parseZoomInfoCsv(csvText, targetRole = "CEO") {
  if (!csvText || typeof csvText !== "string") return [];

  const allLines = csvText.split(/\r?\n/);
  const nonDividerLines = allLines.map(l => l.trim()).filter(l => l && !/^={3,}/.test(l));
  if (!nonDividerLines.length) return [];

  const rawRecords = [];

  // ── Detect Format ──────────────────────────────────────────────────────────
  const ZOOM_FIELD_LABELS = /^(email|full name|fullname|first name|last name|firstname|lastname|job title|title|company name|company|company address|address|location|website|domain|phone|mobile|direct phone)$/i;

  let isKeyValueFormat = false;
  for (let i = 0; i < Math.min(10, nonDividerLines.length); i++) {
    const parts = parseCsvLine(nonDividerLines[i]);
    if (parts.length >= 2 && ZOOM_FIELD_LABELS.test(parts[1])) {
      isKeyValueFormat = true;
      break;
    }
  }

  const firstParsed = parseCsvLine(nonDividerLines[0]);
  const firstColIsEmail = looksLikeEmail(firstParsed[0]);
  const firstIsHeader = !firstColIsEmail && !isKeyValueFormat &&
    /email|first.?name|last.?name|full.?name|job.?title|company/i.test(nonDividerLines[0]);

  // ── FORMAT A: Key-Value Format ─────────────────────────────────────────────
  if (isKeyValueFormat) {
    let current = {};

    const saveRecord = () => {
      // Build full name from parts if needed
      if (!current.fullName) {
        const first = current.firstName || "";
        const last = current.lastName || "";
        current.fullName = `${first} ${last}`.trim();
      }
      if (current.email || current.fullName || current.companyName) {
        rawRecords.push({ ...current });
      }
    };

    for (const rawLine of allLines) {
      const line = rawLine.trim();
      // Empty line or divider between contact records
      if (!line || /^={3,}/.test(line)) {
        if (current.email || current.fullName || current.companyName) {
          saveRecord();
          current = {};
        }
        continue;
      }

      const parts = parseCsvLine(line);
      if (parts.length < 2) continue;

      let val = "";
      let label = "";
      const lastPart = normaliseLabel(parts[parts.length - 1] || "");
      if (ZOOM_FIELD_LABELS.test(lastPart)) {
        label = lastPart;
        val = sanitizeText(parts.slice(0, -1).join(", ").trim());
      } else {
        val = sanitizeText(parts[0] || "");
        label = normaliseLabel(parts[1] || "");
      }

      // Ignore header lines like "Details,Metadata" or "Key,Value"
      if ((val.toLowerCase() === "details" && label === "metadata") || (val.toLowerCase() === "key" && label === "value")) {
        continue;
      }

      // Start new contact ONLY if current already has this field populated!
      let isNewContact = false;
      if ((label === "email" || looksLikeEmail(val)) && current.email) {
        isNewContact = true;
      } else if ((label === "full name" || label === "fullname") && current.fullName) {
        isNewContact = true;
      } else if ((label === "first name" || label === "firstname") && current.firstName && !current.email) {
        isNewContact = true;
      }

      if (isNewContact) {
        saveRecord();
        current = {};
      }

      if (looksLikeEmail(val) || label === "email") {
        current.email = val || sanitizeText(parts[0] || "");
        if (val) current.domain = extractDomainFromEmail(val);
      } else if (label === "full name" || label === "fullname") {
        current.fullName = val;
      } else if (label === "first name" || label === "firstname") {
        current.firstName = val;
      } else if (label === "last name" || label === "lastname") {
        current.lastName = val;
      } else if (label === "job title" || label === "title") {
        current.jobTitle = val;
      } else if (label === "company name" || label === "company") {
        current.companyName = val;
      } else if (label === "company address" || label === "address" || label === "location") {
        current.companyAddress = val;
      } else if (label === "website" || label === "domain") {
        current.website = val;
        current.domain = val.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
      } else if (label === "phone" || label === "direct phone" || label === "mobile") {
        current.phone = val;
      }
    }
    if (current.email || current.fullName || current.companyName) saveRecord();
  }

  // ── FORMAT B: Standard Header CSV ─────────────────────────────────────────
  else if (firstIsHeader) {
    const headers = parseCsvLine(nonDividerLines[0]).map(h => h.trim().toLowerCase());

    for (let i = 1; i < nonDividerLines.length; i++) {
      const values = parseCsvLine(nonDividerLines[i]);
      if (!values.length || values.every(v => !v)) continue;

      const row = {};
      headers.forEach((h, idx) => { row[h] = (values[idx] || "").trim(); });

      const firstName = row["first name"] || row["firstname"] || "";
      const lastName = row["last name"] || row["lastname"] || "";
      const fullName = row["full name"] || row["fullname"] || row["name"] ||
        `${firstName} ${lastName}`.trim();
      const email = row["email"] || row["email address"] || row["work email"] || "";
      const jobTitle = row["job title"] || row["title"] || row["position"] || row["job function"] || "";
      const companyName = row["company name"] || row["company"] || row["organization"] || row["employer"] || "";
      const companyAddress = row["company address"] || row["address"] || row["location"] ||
        [row["city"], row["state"], row["zip"] || row["zip code"] || row["postal code"]].filter(Boolean).join(", ");
      const website = row["website"] || row["company website"] || row["domain"] || "";
      const domain = website
        ? website.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase()
        : extractDomainFromEmail(email);

      if (fullName || companyName || email) {
        rawRecords.push({ fullName, firstName, lastName, email, jobTitle, companyName, companyAddress, website, domain });
      }
    }
  }

  // ── FORMAT C: Headerless positional CSV ────────────────────────────────────
  // Columns: email, full name, job title, company name, address, ...
  else {
    for (const line of nonDividerLines) {
      const cols = parseCsvLine(line);
      if (!cols.length) continue;

      // Skip lines that don't have an email-like value anywhere
      const emailCol = cols.find(c => looksLikeEmail(c));
      if (!emailCol && !cols[0]) continue;

      const email = emailCol || "";
      const fullName = sanitizeText(cols[1] || "");
      const jobTitle = sanitizeText(cols[2] || "");
      const companyName = sanitizeText(cols[3] || "");
      const companyAddress = sanitizeText(cols[4] || "");
      const domain = email ? extractDomainFromEmail(email) : "";

      if (email || fullName || companyName) {
        rawRecords.push({ fullName, email, jobTitle, companyName, companyAddress, website: "", domain });
      }
    }
  }

  // ── Pre-scan records to detect any internal CEO / Founder / Superintendent ──
  const companyCeoMap = new Map();
  const exactCeoRegex = /^(?:chief executive officer|ceo)$/i;
  const containsCeoRegex = /\b(?:chief executive officer|ceo)\b/i;
  const secondaryCeoRegex = /\b(?:president|owner|founder|co-founder|superintendent|managing director|executive director|chancellor|headmaster)\b/i;

  // Pass 1: Look for exact CEO person (e.g. "Neil Grimmer" -> "Chief Executive Officer")
  for (const r of rawRecords) {
    const compKey = (r.companyName || r.domain || "").toLowerCase().trim();
    if (compKey && !companyCeoMap.has(compKey) && r.jobTitle && exactCeoRegex.test(r.jobTitle.trim()) && isPersonName(r.fullName, r.companyName, r.domain)) {
      companyCeoMap.set(compKey, r.fullName.trim());
    }
  }

  // Pass 2: Look for title containing CEO person
  for (const r of rawRecords) {
    const compKey = (r.companyName || r.domain || "").toLowerCase().trim();
    if (compKey && !companyCeoMap.has(compKey) && r.jobTitle && containsCeoRegex.test(r.jobTitle) && isPersonName(r.fullName, r.companyName, r.domain)) {
      companyCeoMap.set(compKey, r.fullName.trim());
    }
  }

  // Pass 3: Secondary leadership roles if no CEO found
  for (const r of rawRecords) {
    const compKey = (r.companyName || r.domain || "").toLowerCase().trim();
    if (compKey && !companyCeoMap.has(compKey) && r.jobTitle && secondaryCeoRegex.test(r.jobTitle) && isPersonName(r.fullName, r.companyName, r.domain)) {
      companyCeoMap.set(compKey, r.fullName.trim());
    }
  }

  // ── Convert raw records → search jobs ─────────────────────────────────────
  return rawRecords.map(r => {
    // Build full name from parts if missing
    if (!r.fullName && (r.firstName || r.lastName)) {
      r.fullName = `${r.firstName || ""} ${r.lastName || ""}`.trim();
    }

    // If companyName is missing, resolve it from email domain
    if (!r.companyName && r.domain) {
      r.companyName = cleanDomainToCompanyName(r.domain);
    }

    const compKey = (r.companyName || r.domain || "").toLowerCase().trim();
    let knownCeo = "";
    if (r.jobTitle && (exactCeoRegex.test(r.jobTitle.trim()) || containsCeoRegex.test(r.jobTitle)) && isPersonName(r.fullName, r.companyName, r.domain)) {
      knownCeo = r.fullName.trim();
    } else {
      knownCeo = companyCeoMap.get(compKey) || "";
    }

    // Prioritize Company Name > Domain > Full Name as the search target
    const searchTarget = r.companyName || r.domain || r.fullName || "";

    // Extract city/state/zip for a cleaner Google Maps search location
    const searchLocation = extractCityStateZip(r.companyAddress);

    // Clean query: e.g. "Storyteller Overland CEO"
    const query = searchTarget ? `${searchTarget} ${targetRole}` : r.fullName;

    return {
      query,
      category: targetRole,
      location: searchLocation,
      targetRole,
      zoomInfo: {
        fullName: r.fullName || "",
        firstName: r.firstName || "",
        lastName: r.lastName || "",
        email: r.email || "",
        jobTitle: r.jobTitle || "",
        companyName: r.companyName || "",
        companyAddress: r.companyAddress || "",
        website: r.website || "",
        domain: r.domain || "",
        phone: r.phone || "",
        knownCeo
      }
    };
  }).filter(j => j.query);
}

export function isZoomInfoFormat(text) {
  if (!text || typeof text !== "string") return false;
  const sample = text.slice(0, 4000);
  return /(?:details,\s*metadata|key,\s*value|,\s*email|,\s*full\s*name|,\s*company\s*(?:name|address)|,\s*job\s*title)/i.test(sample) ||
         /(?:email\s*address|first\s*name|last\s*name|job\s*title|company\s*name|direct\s*phone)/i.test(sample.split(/\r?\n/)[0] || "");
}

export function parseQueryString(inputLine) {
  if (!inputLine || typeof inputLine !== "string") return null;
  const line = inputLine.trim();
  if (!line) return null;

  const labeledMatch = line.match(/(?:c|q|name):\s*([^,]+)?(?:,\s*(?:p|cat|category):\s*([^,]+))?(?:,\s*(?:l|loc|location):\s*(.+))?/i);
  if (labeledMatch && (labeledMatch[1] || labeledMatch[2] || labeledMatch[3])) {
    return {
      query: (labeledMatch[1] || "").trim(),
      category: (labeledMatch[2] || "").trim(),
      location: (labeledMatch[3] || "").trim()
    };
  }

  const atInMatch = line.match(/^(.+?)\s+(?:at|in|near)\s+(.+)$/i);
  if (atInMatch) {
    return { query: atInMatch[1].trim(), category: "", location: atInMatch[2].trim() };
  }

  const commaParts = line.split(",").map(p => p.trim());
  if (commaParts.length >= 3) {
    return { query: commaParts[0], category: commaParts[1], location: commaParts.slice(2).join(", ") };
  } else if (commaParts.length === 2) {
    return { query: commaParts[0], category: commaParts[1], location: "" };
  }

  return { query: line, category: "", location: "" };
}

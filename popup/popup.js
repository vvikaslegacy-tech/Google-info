function sanitizeText(value) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return /^(?:n\/a|null|undefined|-|no reviews?)$/i.test(text) ? "" : text;
}

function parseCsvLine(line) {
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

function extractCityStateZip(fullAddress) {
  if (!fullAddress) return "";
  const addr = fullAddress.trim();
  const zipMatch = addr.match(/\b(\d{5}(?:-\d{4})?)\b/);
  const zip = zipMatch ? zipMatch[1] : "";
  const parts = addr.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length === 1) return addr;
  const countryNames = /^(united states|usa|u\.s\.a|uk|united kingdom|canada|australia)$/i;
  const filtered = parts.filter(p => !countryNames.test(p));
  if (filtered.length === 0) return addr;
  if (filtered.length >= 3) {
    const startsWithNumber = /^\d+\s/.test(filtered[0]);
    const cityIdx = startsWithNumber ? 1 : 0;
    const city = filtered[cityIdx] || "";
    const state = filtered[cityIdx + 1] || "";
    const result = [city, state].filter(Boolean).join(", ");
    return zip && !result.includes(zip) ? `${result} ${zip}`.trim() : result;
  }
  if (filtered.length === 2) return filtered.join(", ");
  return filtered[filtered.length - 1];
}

function normaliseLabel(meta) {
  return meta.toLowerCase().replace(/\s+/g, " ").trim();
}

function looksLikeEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

function isPersonName(name, companyName = "", domain = "") {
  if (!name || typeof name !== "string") return false;
  const cleanName = name.trim();
  if (cleanName.length < 3) return false;
  const normName = cleanName.toLowerCase().replace(/[^a-z]/g, "");
  const normComp = (companyName || "").toLowerCase().replace(/[^a-z]/g, "");
  const normDomain = (domain || "").toLowerCase().replace(/[^a-z]/g, "");
  if (normComp && (normName === normComp || normComp.includes(normName) || normName.includes(normComp))) return false;
  if (normDomain && (normName === normDomain || normDomain.includes(normName))) return false;
  if (/^(?:admin|info|contact|support|sales|team|office|headquarters|company|details|metadata|executive|board|user)$/i.test(cleanName)) return false;
  return true;
}

function cleanDomainToCompanyName(domain) {
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

function parseZoomInfoCsv(csvText, targetRole = "CEO") {
  if (!csvText || typeof csvText !== "string") return [];
  const allLines = csvText.split(/\r?\n/);
  const nonDividerLines = allLines.map(l => l.trim()).filter(l => l && !/^={3,}/.test(l));
  if (!nonDividerLines.length) return [];
  const rawRecords = [];
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
  const firstIsHeader = !firstColIsEmail && !isKeyValueFormat && /email|first.?name|last.?name|full.?name|job.?title|company/i.test(nonDividerLines[0]);

  if (isKeyValueFormat) {
    let current = {};
    const saveRecord = () => {
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

      if ((val.toLowerCase() === "details" && label === "metadata") || (val.toLowerCase() === "key" && label === "value")) continue;

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
  } else if (firstIsHeader) {
    const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      if (!values.length || values.every(v => !v)) continue;
      const row = {};
      headers.forEach((h, idx) => { row[h] = (values[idx] || "").trim(); });
      const firstName = row["first name"] || row["firstname"] || "";
      const lastName = row["last name"] || row["lastname"] || "";
      const fullName = row["full name"] || row["fullname"] || row["name"] || `${firstName} ${lastName}`.trim();
      const email = row["email"] || row["email address"] || row["work email"] || "";
      const jobTitle = row["job title"] || row["title"] || row["position"] || row["job function"] || "";
      const companyName = row["company name"] || row["company"] || row["organization"] || row["employer"] || "";
      const companyAddress = row["company address"] || row["address"] || row["location"] || [row["city"], row["state"], row["zip"] || row["zip code"] || row["postal code"]].filter(Boolean).join(", ");
      const website = row["website"] || row["company website"] || row["domain"] || "";
      const domain = website ? website.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase() : extractDomainFromEmail(email);
      if (fullName || companyName || email) {
        rawRecords.push({ fullName, firstName, lastName, email, jobTitle, companyName, companyAddress, website, domain });
      }
    }
  } else {
    for (const line of lines) {
      const cols = parseCsvLine(line);
      if (!cols.length) continue;
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

  return rawRecords.map(r => {
    if (!r.fullName && (r.firstName || r.lastName)) {
      r.fullName = `${r.firstName || ""} ${r.lastName || ""}`.trim();
    }
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

    const searchTarget = r.companyName || r.domain || r.fullName || "";
    const searchLocation = extractCityStateZip(r.companyAddress);
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

function isZoomInfoFormat(text) {
  if (!text || typeof text !== "string") return false;
  const sample = text.slice(0, 4000);
  return /(?:details,\s*metadata|key,\s*value|,\s*email|,\s*full\s*name|,\s*company\s*(?:name|address)|,\s*job\s*title)/i.test(sample) ||
         /(?:email\s*address|first\s*name|last\s*name|job\s*title|company\s*name|direct\s*phone)/i.test(sample.split(/\r?\n/)[0] || "");
}

function parseQueryString(inputLine) {
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

const els = {
  sessionStatus: document.querySelector("#sessionStatus"),
  loginBadge: document.querySelector("#loginBadge"),
  loggedInView: document.querySelector("#loggedInView"),
  profileName: document.querySelector("#profileName"),
  refreshSession: document.querySelector("#refreshSession"),
  logout: document.querySelector("#logout"),
  engineBadge: document.querySelector("#engineBadge"),
  serperApiKey: document.querySelector("#serperApiKey"),
  saveSerperKey: document.querySelector("#saveSerperKey"),
  serperKeyStatus: document.querySelector("#serperKeyStatus"),
  aiApiKey: document.querySelector("#aiApiKey"),
  aiModelName: document.querySelector("#aiModelName"),
  aiSystemPrompt: document.querySelector("#aiSystemPrompt"),
  aiFallbackCheckbox: document.querySelector("#aiFallbackCheckbox"),
  saveAiSettingsBtn: document.querySelector("#saveAiSettingsBtn"),
  aiSettingsStatus: document.querySelector("#aiSettingsStatus"),
  singleMode: document.querySelector("#singleMode"),
  bulkMode: document.querySelector("#bulkMode"),
  singlePanel: document.querySelector("#singlePanel"),
  bulkPanel: document.querySelector("#bulkPanel"),
  query: document.querySelector("#query"),
  category: document.querySelector("#category"),
  location: document.querySelector("#location"),
  singleSearch: document.querySelector("#singleSearch"),
  fileInput: document.querySelector("#fileInput"),
  fileDrop: document.querySelector("#fileDrop"),
  fileName: document.querySelector("#fileName"),
  zoomFileInput: document.querySelector("#zoomFileInput"),
  zoomFileDrop: document.querySelector("#zoomFileDrop"),
  zoomFileName: document.querySelector("#zoomFileName"),
  bulkText: document.querySelector("#bulkText"),
  addBulkText: document.querySelector("#addBulkText"),
  bulkImportSearch: document.querySelector("#bulkImportSearch"),
  bulkImportBody: document.querySelector("#bulkImportBody"),
  bulkImportPageInfo: document.querySelector("#bulkImportPageInfo"),
  bulkImportPrev: document.querySelector("#bulkImportPrev"),
  bulkImportNext: document.querySelector("#bulkImportNext"),
  selectBulkVisible: document.querySelector("#selectBulkVisible"),
  selectBulkPage: document.querySelector("#selectBulkPage"),
  selectBulkAll: document.querySelector("#selectBulkAll"),
  clearBulkSelection: document.querySelector("#clearBulkSelection"),
  deleteBulkSelected: document.querySelector("#deleteBulkSelected"),
  bulkSelectedCount: document.querySelector("#bulkSelectedCount"),
  deleteBulkAll: document.querySelector("#deleteBulkAll"),
  bulkSearch: document.querySelector("#bulkSearch"),
  deleteAll: document.querySelector("#deleteAll"),
  exportCsv: document.querySelector("#exportCsv"),
  exportTxt: document.querySelector("#exportTxt"),
  exportDialog: document.querySelector("#exportDialog"),
  exportForm: document.querySelector("#exportForm"),
  exportDescription: document.querySelector("#exportDescription"),
  exportPresets: document.querySelector("#exportPresets"),
  exportFields: document.querySelector("#exportFields"),
  exportFieldsList: document.querySelector("#exportFieldsList"),
  targetRoleInput: document.querySelector("#targetRoleInput"),
  exportCancel: document.querySelector("#exportCancel"),
  exportDownload: document.querySelector("#exportDownload"),
  resultCount: document.querySelector("#resultCount"),
  closeWarning: document.querySelector("#closeWarning"),
  summary: document.querySelector("#summary"),
  resultSearch: document.querySelector("#resultSearch"),
  progressPanel: document.querySelector("#progressPanel"),
  progressTitle: document.querySelector("#progressTitle"),
  progressDetail: document.querySelector("#progressDetail"),
  pauseSearch: document.querySelector("#pauseSearch"),
  resumeSearch: document.querySelector("#resumeSearch"),
  stopSearch: document.querySelector("#stopSearch"),
  selectPage: document.querySelector("#selectPage"),
  selectAll: document.querySelector("#selectAll"),
  clearSelection: document.querySelector("#clearSelection"),
  selectVisible: document.querySelector("#selectVisible"),
  pageInfo: document.querySelector("#pageInfo"),
  prevPage: document.querySelector("#prevPage"),
  nextPage: document.querySelector("#nextPage"),
  resultsBody: document.querySelector("#resultsBody"),
  confirmOverlay: document.querySelector("#confirmOverlay"),
  confirmTitle: document.querySelector("#confirmTitle"),
  confirmMessage: document.querySelector("#confirmMessage"),
  confirmCancel: document.querySelector("#confirmCancel"),
  confirmOk: document.querySelector("#confirmOk"),
  licenseStatusBanner: document.querySelector("#licenseStatusBanner"),
  licenseStatusText: document.querySelector("#licenseStatusText"),
  licenseKeyInput: document.querySelector("#licenseKeyInput"),
  btnActivateLicense: document.querySelector("#btnActivateLicense"),
  btnActivateLabel: document.querySelector("#btnActivateLabel"),
  lockOverlay: document.querySelector("#lockOverlay"),
  lockErrorMsg: document.querySelector("#lockErrorMsg"),
  lockSuccessMsg: document.querySelector("#lockSuccessMsg"),
  machineIdDisplay: document.querySelector("#machineIdDisplay"),
  licenseInvalidOverlay: document.querySelector("#licenseInvalidOverlay"),
  licenseInvalidHeader: document.querySelector("#licenseInvalidHeader"),
  licenseInvalidBody: document.querySelector("#licenseInvalidBody"),
  licenseInvalidKey: document.querySelector("#licenseInvalidKey"),
  btnLicenseRetry: document.querySelector("#btnLicenseRetry")
};

let currentRows = [];
let currentSummaries = [];
let parsedBulkJobs = [];
let bulkImportPage = 1;
let selectedBulkIndexes = new Set();
let selectedKeys = new Set();
let resultPage = 1;
const RESULTS_PER_PAGE = 100;
const IMPORT_ROWS_PER_PAGE = 100;
const BULK_SEARCH_BATCH_SIZE = 50;
const STATE_DB_NAME = "GoogleInfoSearchState";
const STATE_STORE_NAME = "state";
const STATE_KEY = "latest";
const BULK_JOBS_KEY = "bulkJobs";
let confirmResolver = null;
let pendingExportRows = [];
let searchStopped = false;
let searchActive = false;
let activeSearchId = 0;

let dragSourceIdx = null;
let exportFieldsConfig = [
  { key: "email", label: "Email (ZoomInfo)", checked: true },
  { key: "ceoName", label: "CEO / Executive Name", checked: true },
  { key: "firstName", label: "First Name (ZoomInfo)", checked: true },
  { key: "fullName", label: "Full Name (ZoomInfo)", checked: true },
  { key: "zoomCompany", label: "ZoomInfo Company", checked: true },
  { key: "streetAddress", label: "Street Address (Line 1)", checked: true },
  { key: "cityStateZip", label: "City, State Zip (Line 2)", checked: true },
  { key: "name", label: "Google Business Name", checked: true },
  { key: "phone", label: "Phone", checked: true },
  { key: "website", label: "Website", checked: true },
  { key: "category", label: "Category", checked: true },
  { key: "rating", label: "Rating", checked: true }
];

async function loadExportFieldsConfig() {
  try {
    const data = await chrome.storage.local.get(["savedExportFieldsConfig"]);
    if (data.savedExportFieldsConfig && Array.isArray(data.savedExportFieldsConfig)) {
      const savedMap = new Map(data.savedExportFieldsConfig.map(f => [f.key, f]));
      const ordered = [];
      data.savedExportFieldsConfig.forEach(f => {
        const def = exportFieldsConfig.find(d => d.key === f.key);
        if (def) ordered.push({ ...def, checked: f.checked });
      });
      exportFieldsConfig.forEach(def => {
        if (!savedMap.has(def.key)) ordered.push(def);
      });
      exportFieldsConfig = ordered;
    }
  } catch (_) {}
}

async function saveExportFieldsConfig() {
  try {
    await chrome.storage.local.set({ savedExportFieldsConfig: exportFieldsConfig });
  } catch (_) {}
}

// Tab Switching & Navigation
function setSearchMode(mode) {
  const isSingle = mode === "single";
  const singleBtn = document.querySelector("#singleMode") || els.singleMode;
  const bulkBtn = document.querySelector("#bulkMode") || els.bulkMode;
  const singlePanel = document.querySelector("#singlePanel") || els.singlePanel;
  const bulkPanel = document.querySelector("#bulkPanel") || els.bulkPanel;

  if (singleBtn) {
    singleBtn.classList.toggle("active", isSingle);
    singleBtn.setAttribute("aria-selected", isSingle ? "true" : "false");
  }
  if (bulkBtn) {
    bulkBtn.classList.toggle("active", !isSingle);
    bulkBtn.setAttribute("aria-selected", !isSingle ? "true" : "false");
  }

  if (singlePanel) {
    if (isSingle) {
      singlePanel.hidden = false;
      singlePanel.removeAttribute("hidden");
      singlePanel.style.display = "flex";
    } else {
      singlePanel.hidden = true;
      singlePanel.setAttribute("hidden", "");
      singlePanel.style.display = "none";
    }
  }

  if (bulkPanel) {
    if (!isSingle) {
      bulkPanel.hidden = false;
      bulkPanel.removeAttribute("hidden");
      bulkPanel.style.display = "flex";
    } else {
      bulkPanel.hidden = true;
      bulkPanel.setAttribute("hidden", "");
      bulkPanel.style.display = "none";
    }
  }
}

// Make setSearchMode globally callable
if (typeof window !== "undefined") {
  window.setSearchMode = setSearchMode;
}

// Bulletproof capture-phase event listener for immediate click response
document.addEventListener("click", (e) => {
  const target = e.target;
  if (!target) return;
  const singleBtn = target.closest?.("#singleMode");
  if (singleBtn) {
    e.preventDefault();
    e.stopPropagation();
    setSearchMode("single");
    return;
  }
  const bulkBtn = target.closest?.("#bulkMode");
  if (bulkBtn) {
    e.preventDefault();
    e.stopPropagation();
    setSearchMode("bulk");
    return;
  }
}, true);

// Safe Event Listener Binding
if (typeof chrome !== "undefined" && chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
}

// Initialize when ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    init();
  });
} else {
  bindEvents();
  init();
}

function bindEvents() {
  const singleBtn = document.querySelector("#singleMode") || els.singleMode;
  const bulkBtn = document.querySelector("#bulkMode") || els.bulkMode;
  singleBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    setSearchMode("single");
  });
  bulkBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    setSearchMode("bulk");
  });

  els.refreshSession?.addEventListener("click", refreshSession);
  els.logout?.addEventListener("click", logout);
  els.saveSerperKey?.addEventListener("click", saveSerperKey);
  els.saveAiSettingsBtn?.addEventListener("click", saveAiSettings);
  els.singleSearch?.addEventListener("click", runSingleSearch);
  els.bulkSearch?.addEventListener("click", runBulkSearch);
  els.addBulkText?.addEventListener("click", addBulkTextFromInput);
  els.bulkImportSearch?.addEventListener("input", () => {
    bulkImportPage = 1;
    renderBulkImportList();
  });
  els.bulkImportPrev?.addEventListener("click", () => changeBulkImportPage(-1));
  els.bulkImportNext?.addEventListener("click", () => changeBulkImportPage(1));
  els.selectBulkPage?.addEventListener("click", selectBulkPage);
  els.selectBulkAll?.addEventListener("click", selectBulkAll);
  els.clearBulkSelection?.addEventListener("click", clearBulkSelection);
  els.deleteBulkSelected?.addEventListener("click", deleteSelectedBulkImports);
  els.selectBulkVisible?.addEventListener("change", toggleBulkVisibleSelection);
  els.deleteBulkAll?.addEventListener("click", deleteAllBulkImports);
  els.bulkImportBody?.addEventListener("click", handleBulkImportAction);
  els.bulkImportBody?.addEventListener("change", handleBulkRowSelection);
  els.deleteAll?.addEventListener("click", deleteAllResults);
  els.exportCsv?.addEventListener("click", exportCsv);
  els.exportTxt?.addEventListener("click", exportTxt);
  els.exportForm?.addEventListener("submit", downloadSelectedCsv);
  els.exportForm?.addEventListener("change", updateExportOptions);
  els.exportCancel?.addEventListener("click", () => els.exportDialog?.close());
  els.exportDialog?.addEventListener("close", () => { pendingExportRows = []; });

  // Standard File Drag & Drop
  els.fileInput?.addEventListener("change", loadFile);
  els.fileDrop?.addEventListener("dragenter", handleFileDrag);
  els.fileDrop?.addEventListener("dragover", handleFileDrag);
  els.fileDrop?.addEventListener("dragleave", handleFileDragLeave);
  els.fileDrop?.addEventListener("drop", dropFile);

  // ZoomInfo CSV Special Drag & Drop
  els.zoomFileInput?.addEventListener("change", loadZoomFile);
  els.zoomFileDrop?.addEventListener("dragenter", handleFileDrag);
  els.zoomFileDrop?.addEventListener("dragover", handleFileDrag);
  els.zoomFileDrop?.addEventListener("dragleave", handleFileDragLeave);
  els.zoomFileDrop?.addEventListener("drop", dropZoomFile);

  els.pauseSearch?.addEventListener("click", pauseSearch);
  els.resumeSearch?.addEventListener("click", resumeSearch);
  els.stopSearch?.addEventListener("click", stopSearch);
  els.resultSearch?.addEventListener("input", () => {
    resultPage = 1;
    renderRows(currentRows);
  });
  els.selectPage?.addEventListener("click", selectCurrentPage);
  els.selectAll?.addEventListener("click", selectAllRows);
  els.clearSelection?.addEventListener("click", clearSelection);
  els.selectVisible?.addEventListener("change", toggleVisibleSelection);
  els.prevPage?.addEventListener("click", () => changeResultPage(-1));
  els.nextPage?.addEventListener("click", () => changeResultPage(1));
  els.resultsBody?.addEventListener("change", handleRowSelection);
  els.confirmCancel?.addEventListener("click", () => closeConfirm(false));
  els.confirmOk?.addEventListener("click", () => closeConfirm(true));

  // Instant Sort controls
  const sortByCeoBtn = document.querySelector("#sortByCeoBtn");
  sortByCeoBtn?.addEventListener("click", () => sortRowsBy("ceoName", false));

  document.querySelectorAll(".results-table th.sortable-th").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      if (col) sortRowsBy(col, true);
    });
  });
}

async function init() {
  initLicenseUI();
  const response = await send("GET_SESSION");
  if (response.ok) renderSession(response.session);
  await loadStoredSerperKey();
  await loadAiSettings();
  await loadExportFieldsConfig();
  await restoreSavedState();
}

async function loadAiSettings() {
  const res = await send("GET_AI_SETTINGS");
  if (res.ok && res.settings) {
    if (els.aiApiKey && res.settings.apiKey) els.aiApiKey.value = res.settings.apiKey;
    if (els.aiModelName && res.settings.model) els.aiModelName.value = res.settings.model;
    if (els.aiSystemPrompt && res.settings.systemPrompt) els.aiSystemPrompt.value = res.settings.systemPrompt;
    if (els.aiFallbackCheckbox) els.aiFallbackCheckbox.checked = res.settings.fallbackEnabled !== false;
    if (els.aiSettingsStatus) {
      els.aiSettingsStatus.textContent = res.settings.apiKey ? "✓ NVIDIA NIM AI Fallback Configured" : "NVIDIA NIM API endpoint: integrate.api.nvidia.com";
      if (res.settings.apiKey) els.aiSettingsStatus.style.color = "var(--emerald)";
    }
  }
}

async function saveAiSettings() {
  const settings = {
    apiKey: els.aiApiKey ? els.aiApiKey.value.trim() : "",
    model: els.aiModelName ? els.aiModelName.value.trim() : "google/gemma-2-27b-it",
    systemPrompt: els.aiSystemPrompt ? els.aiSystemPrompt.value.trim() : "",
    fallbackEnabled: els.aiFallbackCheckbox ? els.aiFallbackCheckbox.checked : true
  };
  const res = await send("SAVE_AI_SETTINGS", { settings });
  if (res.ok && els.aiSettingsStatus) {
    els.aiSettingsStatus.textContent = settings.apiKey ? "✓ AI Settings Saved Successfully" : "AI Settings Saved (No API Key)";
    els.aiSettingsStatus.style.color = settings.apiKey ? "var(--emerald)" : "var(--muted-dim)";
  }
}

async function loadStoredSerperKey() {
  const res = await send("GET_SERPER_KEY");
  if (res.ok && res.key) {
    els.serperApiKey.value = res.key;
    els.serperKeyStatus.textContent = "✓ Serper.dev API Key Saved";
    els.serperKeyStatus.style.color = "var(--emerald)";
  }
}

async function saveSerperKey() {
  const key = els.serperApiKey.value.trim();
  const res = await send("SAVE_SERPER_KEY", { key });
  if (res.ok) {
    els.serperKeyStatus.textContent = key ? "✓ Serper.dev API Key Saved" : "API key cleared";
    els.serperKeyStatus.style.color = key ? "var(--emerald)" : "var(--muted-dim)";
  }
}

function getSelectedEngine() {
  const radio = document.querySelector('input[name="searchEngine"]:checked');
  return radio ? radio.value : "serper";
}

async function refreshSession() {
  setBusy(true, "Refreshing Google session...");
  const response = await send("REFRESH_SESSION");
  if (!response.ok) return showError(response.error);
  renderSession(response.session);
  setBusy(false, "Session Refreshed");
}

async function logout() {
  const response = await send("LOGOUT");
  if (response.ok) renderSession(null);
}

async function runSingleSearch() {
  const job = {
    query: els.query.value.trim(),
    category: els.category.value.trim(),
    location: els.location.value.trim()
  };
  if (!job.query && !job.category && !job.location) {
    showError("Enter a keyword, category, location, or zip code.");
    return;
  }
  els.query.value = "";
  els.category.value = "";
  els.location.value = "";
  await runSearch([job]);
}

async function addBulkTextFromInput() {
  const text = String(els.bulkText.value || "").trim();
  if (!text || text.includes("imported rows ready")) {
    showError("Enter or paste search query lines first.");
    return;
  }
  const targetRole = els.targetRoleInput?.value.trim() || "CEO";
  const newJobs = isZoomInfoFormat(text) ? parseZoomInfoCsv(text, targetRole) : parseBulk(text);
  if (!newJobs.length) {
    showError("Could not parse any valid search queries or contacts from the input.");
    return;
  }
  parsedBulkJobs = parsedBulkJobs.concat(newJobs);
  selectedBulkIndexes = new Set();
  await saveBulkJobs(parsedBulkJobs);
  bulkImportPage = 1;
  els.bulkImportSearch.value = "";
  renderBulkImportList();
  if (els.fileName) els.fileName.textContent = `${parsedBulkJobs.length} rows ready in queue`;
  els.bulkText.value = "";
  if (isZoomInfoFormat(text)) {
    setBusy(false, `Loaded ${newJobs.length} ZoomInfo contacts ready to search & merge (${targetRole})`);
  }
}

function parseBulk(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const jobs = [];
  for (const line of lines) {
    const job = parseQueryString(line);
    if (job && (job.query || job.category || job.location)) {
      jobs.push(job);
    }
  }
  return jobs;
}

async function runBulkSearch() {
  const directText = String(els.bulkText.value || "").trim();
  if (directText && !directText.includes("imported rows ready")) {
    const targetRole = els.targetRoleInput?.value.trim() || "CEO";
    const directJobs = isZoomInfoFormat(directText) ? parseZoomInfoCsv(directText, targetRole) : parseBulk(directText);
    if (directJobs.length) {
      parsedBulkJobs = parsedBulkJobs.concat(directJobs);
      await saveBulkJobs(parsedBulkJobs);
      renderBulkImportList();
      els.bulkText.value = "";
    }
  }

  if (!parsedBulkJobs.length) {
    parsedBulkJobs = await readBulkJobs();
  }
  const jobs = selectedBulkIndexes.size
    ? [...selectedBulkIndexes].sort((a, b) => a - b).map((idx) => parsedBulkJobs[idx]).filter(Boolean)
    : parsedBulkJobs;
  if (!jobs.length) {
    showError("Add keywords, location or CSV rows before running bulk search.");
    return;
  }
  els.bulkText.value = "";
  clearFileInput();
  await runBulkSearchSequentially(jobs);
}

async function runSearch(jobs, options = {}) {
  const engine = getSelectedEngine();
  const serperKey = els.serperApiKey.value.trim();
  const searchId = beginSearch("Searching Google & Merging Contacts...");
  showProgress("Searching", "Starting search & merge...");
  if (!options.append) resetResultState();
  const response = await send("SEARCH", { jobs, engine, serperKey });
  if (searchId !== activeSearchId) return;
  if (!response.ok) return showError(response.error);
  if (response.stopped) searchStopped = true;
  if (!options.streamOnly) {
    currentRows = addRowKeys(response.results || []);
    currentSummaries = response.summaries || [];
    renderRows(currentRows);
    renderSummary(currentSummaries);
  }
  finishSearch(searchId, searchStopped ? `Stopped - found ${currentRows.length} merged records` : `Found ${currentRows.length} merged records`);
}

async function runBulkSearchSequentially(jobs) {
  const engine = getSelectedEngine();
  const serperKey = els.serperApiKey.value.trim();
  const searchId = beginSearch("Searching Google & Merging Contacts...");
  resetResultState();
  showProgress("Bulk search", `Queued ${jobs.length} contact searches`);
  updateLiveCount(0, jobs.length);

  for (let index = 0; index < jobs.length; index += BULK_SEARCH_BATCH_SIZE) {
    if (searchStopped || searchId !== activeSearchId) break;
    const batch = jobs.slice(index, index + BULK_SEARCH_BATCH_SIZE);
    const batchNumber = Math.floor(index / BULK_SEARCH_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(jobs.length / BULK_SEARCH_BATCH_SIZE);
    const label = formatJobForUi(batch[0]);
    showProgress(
      `Batch ${batchNumber} of ${totalBatches}`,
      `Searching: ${label}  —  ${currentRows.length} records found so far`
    );
    const response = await send("SEARCH", { jobs: batch, engine, serperKey, continueOnError: true });
    if (searchId !== activeSearchId) return;
    if (!response.ok) return showError(response.error);
    if (response.results) {
      currentRows = currentRows.concat(addRowKeys(response.results));
      renderRows(currentRows);
      // ✅ AUTO-SAVE after every batch — results are safe even if panel closes
      await saveStateNow();
      updateLiveCount(Math.min(index + BULK_SEARCH_BATCH_SIZE, jobs.length), jobs.length);
    }
    if (response.stopped) {
      searchStopped = true;
      break;
    }
  }

  finishSearch(searchId, searchStopped
    ? `Stopped — ${currentRows.length} records saved`
    : `✅ Done! ${currentRows.length} merged records — ready to export`);
}

function formatJobForUi(job) {
  const zoomName = job.zoomInfo?.fullName ? ` (${job.zoomInfo.fullName})` : "";
  return ([job.query, job.category, job.location].filter(Boolean).join(" / ") || "Search") + zoomName;
}

function resetResultState() {
  currentRows = [];
  currentSummaries = [];
  selectedKeys = new Set();
  renderRows(currentRows);
}

function renderBulkImportList() {
  const filtered = parsedBulkJobs.map((job, idx) => ({ ...job, _index: idx }));
  const totalPages = Math.max(1, Math.ceil(filtered.length / IMPORT_ROWS_PER_PAGE));
  bulkImportPage = Math.min(Math.max(bulkImportPage, 1), totalPages);
  const start = (bulkImportPage - 1) * IMPORT_ROWS_PER_PAGE;
  const visible = filtered.slice(start, start + IMPORT_ROWS_PER_PAGE);

  if (els.deleteBulkAll) els.deleteBulkAll.disabled = !parsedBulkJobs.length;
  if (els.deleteBulkSelected) els.deleteBulkSelected.disabled = !selectedBulkIndexes.size;
  if (els.selectBulkPage) els.selectBulkPage.disabled = !visible.length;
  if (els.selectBulkAll) els.selectBulkAll.disabled = !parsedBulkJobs.length;
  if (els.clearBulkSelection) els.clearBulkSelection.disabled = !selectedBulkIndexes.size;
  if (els.bulkSelectedCount) els.bulkSelectedCount.textContent = `${selectedBulkIndexes.size} selected`;
  if (els.bulkImportPrev) els.bulkImportPrev.disabled = bulkImportPage <= 1 || !filtered.length;
  if (els.bulkImportNext) els.bulkImportNext.disabled = bulkImportPage >= totalPages || !filtered.length;
  if (els.bulkImportPageInfo) {
    els.bulkImportPageInfo.textContent = filtered.length
      ? `Page ${bulkImportPage} of ${totalPages}  -  ${filtered.length} rows`
      : "Page 0 of 0";
  }

  if (!filtered.length) {
    if (els.bulkImportBody) els.bulkImportBody.innerHTML = `<tr><td colspan="5" class="empty">No imported rows</td></tr>`;
    return;
  }

  if (els.bulkImportBody) {
    els.bulkImportBody.innerHTML = visible.map((job) => `
      <tr>
        <td class="select-col">
          <input class="bulk-row-select" type="checkbox" data-index="${job._index}" ${selectedBulkIndexes.has(job._index) ? "checked" : ""}>
        </td>
        <td><strong>${escapeHtml(job.query || "")}</strong> ${job.zoomInfo?.fullName ? `<span class="format-hint">(${escapeHtml(job.zoomInfo.fullName)})</span>` : ""}</td>
        <td>${escapeHtml(job.category || "")}</td>
        <td>${escapeHtml(job.location || "")}</td>
        <td class="action-col"><button class="danger import-delete" type="button" data-index="${job._index}">Delete</button></td>
      </tr>
    `).join("");
  }
}

function changeBulkImportPage(delta) {
  bulkImportPage += delta;
  renderBulkImportList();
}

function handleBulkRowSelection(event) {
  const checkbox = event.target.closest(".bulk-row-select");
  if (!checkbox) return;
  const index = Number(checkbox.dataset.index);
  if (checkbox.checked) selectedBulkIndexes.add(index);
  else selectedBulkIndexes.delete(index);
  renderBulkImportList();
}

function toggleBulkVisibleSelection() {
  if (els.selectBulkVisible?.checked) selectBulkAll();
  else clearBulkSelection();
}

function selectBulkPage() {
  const start = (bulkImportPage - 1) * IMPORT_ROWS_PER_PAGE;
  const visible = parsedBulkJobs.slice(start, start + IMPORT_ROWS_PER_PAGE);
  visible.forEach((_, idx) => selectedBulkIndexes.add(start + idx));
  renderBulkImportList();
}

function selectBulkAll() {
  parsedBulkJobs.forEach((_, index) => selectedBulkIndexes.add(index));
  renderBulkImportList();
}

function clearBulkSelection() {
  selectedBulkIndexes = new Set();
  renderBulkImportList();
}

async function handleBulkImportAction(event) {
  const button = event.target.closest(".import-delete");
  if (!button) return;
  const index = Number(button.dataset.index);
  parsedBulkJobs.splice(index, 1);
  selectedBulkIndexes = new Set();
  await saveBulkJobs(parsedBulkJobs);
  renderBulkImportList();
}

async function deleteSelectedBulkImports() {
  if (!selectedBulkIndexes.size) return;
  parsedBulkJobs = parsedBulkJobs.filter((_, idx) => !selectedBulkIndexes.has(idx));
  selectedBulkIndexes = new Set();
  await saveBulkJobs(parsedBulkJobs);
  renderBulkImportList();
}

async function deleteAllBulkImports() {
  if (!parsedBulkJobs.length) return;
  parsedBulkJobs = [];
  selectedBulkIndexes = new Set();
  await saveBulkJobs([]);
  renderBulkImportList();
}

async function pauseSearch() {
  await send("PAUSE_SEARCH");
  if (els.pauseSearch) els.pauseSearch.disabled = true;
  if (els.resumeSearch) els.resumeSearch.disabled = false;
  showProgress("Paused", "Search is paused. Resume to continue.");
}

async function resumeSearch() {
  await send("RESUME_SEARCH");
  if (els.pauseSearch) els.pauseSearch.disabled = false;
  if (els.resumeSearch) els.resumeSearch.disabled = true;
  showProgress("Searching", "Resuming search...");
}

async function stopSearch() {
  await send("STOP_SEARCH");
  searchStopped = true;
  finishSearch(activeSearchId, "Stopped search");
}

function beginSearch(message) {
  activeSearchId += 1;
  searchActive = true;
  searchStopped = false;
  setBusy(true, message);
  if (els.progressPanel) els.progressPanel.hidden = false;
  if (els.pauseSearch) els.pauseSearch.disabled = false;
  if (els.resumeSearch) els.resumeSearch.disabled = true;
  return activeSearchId;
}

function finishSearch(searchId, detail) {
  if (searchId !== activeSearchId) return;
  searchActive = false;
  setBusy(false, detail);
  if (els.progressPanel) els.progressPanel.hidden = true;
}

function showProgress(title, detail) {
  if (els.progressTitle) els.progressTitle.textContent = title;
  if (els.progressDetail) els.progressDetail.textContent = detail;
}

function updateLiveCount(searched, total) {
  const liveCount = document.getElementById("liveProgressCount");
  if (liveCount) {
    const pct = total > 0 ? Math.round((searched / total) * 100) : 0;
    liveCount.textContent = `${searched} / ${total} contacts searched  •  ${currentRows.length} records found  •  ${pct}%`;
    // update progress bar width
    const bar = document.getElementById("liveProgressBar");
    if (bar) bar.style.width = `${pct}%`;
  }
}

function renderRows(rows) {
  const query = els.resultSearch ? els.resultSearch.value.trim().toLowerCase() : "";
  const filtered = rows.filter(r => {
    if (!query) return true;
    return String(r.fullName || "").toLowerCase().includes(query)
      || String(r.email || "").toLowerCase().includes(query)
      || String(r.zoomCompany || "").toLowerCase().includes(query)
      || String(r.ceoName || "").toLowerCase().includes(query)
      || String(r.name || "").toLowerCase().includes(query)
      || String(r.phone || "").toLowerCase().includes(query)
      || String(r.category || "").toLowerCase().includes(query)
      || String(r.address || "").toLowerCase().includes(query);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / RESULTS_PER_PAGE));
  resultPage = Math.min(Math.max(resultPage, 1), totalPages);
  const start = (resultPage - 1) * RESULTS_PER_PAGE;
  const visible = filtered.slice(start, start + RESULTS_PER_PAGE);

  if (els.resultCount) els.resultCount.textContent = `${rows.length} records - ${selectedKeys.size} selected`;
  if (els.deleteAll) els.deleteAll.disabled = !rows.length;
  if (els.exportCsv) els.exportCsv.disabled = !selectedKeys.size && !rows.length;
  if (els.exportTxt) els.exportTxt.disabled = !selectedKeys.size && !rows.length;
  if (els.selectPage) els.selectPage.disabled = !visible.length;
  if (els.selectAll) els.selectAll.disabled = !rows.length;
  if (els.clearSelection) els.clearSelection.disabled = !selectedKeys.size;
  if (els.prevPage) els.prevPage.disabled = resultPage <= 1 || !filtered.length;
  if (els.nextPage) els.nextPage.disabled = resultPage >= totalPages || !filtered.length;
  if (els.pageInfo) els.pageInfo.textContent = filtered.length ? `Page ${resultPage} of ${totalPages}` : "Page 0 of 0";

  if (!visible.length) {
    if (els.resultsBody) els.resultsBody.innerHTML = `<tr><td colspan="10" class="empty">No merged results found</td></tr>`;
    return;
  }

  if (els.resultsBody) {
    let lastGroup = null;
    let html = "";
    for (const r of visible) {
      const group = r._groupLabel || "";
      // Insert group header when contact changes
      if (group && group !== lastGroup) {
        html += `
          <tr class="group-header-row">
            <td colspan="10">
              <div class="group-header">
                <span class="group-icon">👤</span>
                <span class="group-label">${escapeHtml(group)}</span>
              </div>
            </td>
          </tr>`;
        lastGroup = group;
      }
      html += `
        <tr>
          <td class="select-col">
            <input class="row-select" type="checkbox" data-key="${r._key}" ${selectedKeys.has(r._key) ? "checked" : ""}>
          </td>
          <td><strong>${escapeHtml(r.fullName || "-")}</strong></td>
          <td>${escapeHtml(r.firstName || (r.fullName ? r.fullName.split(" ")[0] : "-"))}</td>
          <td>${escapeHtml(r.email || "-")}</td>
          <td>${escapeHtml(r.zoomCompany || "-")}</td>
          <td>${escapeHtml(r.name || "-")}</td>
          <td><span style="color:var(--primary);font-weight:600;">${escapeHtml(r.ceoName || "-")}</span></td>
          <td>${escapeHtml(r.phone || "-")}</td>
          <td>${r.website ? `<a href="${escapeHtml(r.website)}" target="_blank" style="color:var(--primary);">${escapeHtml(r.website)}</a>` : "-"}</td>
          <td>${escapeHtml(r.rating || "-")}</td>
        </tr>`;
    }
    els.resultsBody.innerHTML = html;
  }
}

function handleRowSelection(event) {
  const cb = event.target.closest(".row-select");
  if (!cb) return;
  const key = cb.dataset.key;
  if (cb.checked) selectedKeys.add(key);
  else selectedKeys.delete(key);
  renderRows(currentRows);
}

function selectCurrentPage() {
  const start = (resultPage - 1) * RESULTS_PER_PAGE;
  const visible = currentRows.slice(start, start + RESULTS_PER_PAGE);
  visible.forEach(r => selectedKeys.add(r._key));
  renderRows(currentRows);
}

function selectAllRows() {
  currentRows.forEach(r => selectedKeys.add(r._key));
  renderRows(currentRows);
}

function clearSelection() {
  selectedKeys = new Set();
  renderRows(currentRows);
}

function toggleVisibleSelection() {
  if (els.selectVisible?.checked) selectAllRows();
  else clearSelection();
}

function changeResultPage(delta) {
  resultPage += delta;
  renderRows(currentRows);
}

async function deleteAllResults() {
  currentRows = [];
  selectedKeys = new Set();
  renderRows(currentRows);
  await saveStateNow();
}

function exportCsv() {
  if (!currentRows.length) return showError("No records to export.");
  openExportDialog("csv");
}

function exportTxt() {
  if (!currentRows.length) return showError("No records to export.");
  openExportDialog("txt");
}

function openExportDialog(fileType) {
  const radio = document.querySelector(`input[name="exportFileType"][value="${fileType}"]`);
  if (radio) radio.checked = true;

  const allScopeRadio = document.querySelector('input[name="exportScope"][value="all"]');
  const scopeSelectedWrapper = document.querySelector('#exportScopeSelectedWrapper');
  const allLabel = document.querySelector('#exportScopeAllLabel');
  const selectedLabel = document.querySelector('#exportScopeSelectedLabel');

  if (allLabel) allLabel.textContent = `🌐 All Results (${currentRows.length} records)`;
  if (selectedLabel) selectedLabel.textContent = `☑ Selected Rows Only (${selectedKeys.size} records)`;

  // Always default to 'all' so "BRING ALL RESULT" is guaranteed
  if (allScopeRadio) allScopeRadio.checked = true;

  if (selectedKeys.size > 0) {
    if (scopeSelectedWrapper) scopeSelectedWrapper.style.display = "flex";
  } else {
    if (scopeSelectedWrapper) scopeSelectedWrapper.style.display = "none";
  }

  updateExportDownloadBtnText();
  updateExportDescription();
  renderExportFields();
  updateExportOptions();
  els.exportDialog?.showModal();
}

function updateExportDescription() {
  const scope = document.querySelector('input[name="exportScope"]:checked')?.value || "all";
  const count = (scope === "selected" && selectedKeys.size > 0) ? selectedKeys.size : currentRows.length;
  const fileType = document.querySelector('input[name="exportFileType"]:checked')?.value || "txt";
  if (els.exportDescription) {
    els.exportDescription.textContent = fileType === "txt"
      ? `Exporting ${count} merged ZoomInfo + Google Info records as plain text for Notepad / Notepad++.`
      : `Exporting ${count} merged ZoomInfo + Google Info records to CSV.`;
  }
}

function updateExportDownloadBtnText() {
  const fileType = document.querySelector('input[name="exportFileType"]:checked')?.value || "txt";
  if (els.exportDownload) {
    els.exportDownload.textContent = fileType === "txt" ? "📄 Download .TXT for Notepad" : "📊 Download Merged CSV";
  }
}

function renderExportFields() {
  if (!els.exportFieldsList) return;
  els.exportFieldsList.innerHTML = exportFieldsConfig.map((field, idx) => `
    <div class="export-field-item" draggable="true" data-idx="${idx}">
      <span class="drag-handle" title="Drag to reorder column">⋮⋮</span>
      <input type="checkbox" id="ef_${field.key}" data-key="${field.key}" ${field.checked ? "checked" : ""}>
      <label for="ef_${field.key}" class="export-field-label">${escapeHtml(field.label)}</label>
    </div>
  `).join("");

  const items = els.exportFieldsList.querySelectorAll(".export-field-item");
  items.forEach(item => {
    item.addEventListener("dragstart", handleFieldDragStart);
    item.addEventListener("dragover", handleFieldDragOver);
    item.addEventListener("dragleave", handleFieldDragLeave);
    item.addEventListener("drop", handleFieldDrop);
    item.addEventListener("dragend", handleFieldDragEnd);

    const cb = item.querySelector("input[type='checkbox']");
    cb?.addEventListener("change", (e) => {
      const key = e.target.dataset.key;
      const found = exportFieldsConfig.find(f => f.key === key);
      if (found) {
        found.checked = e.target.checked;
        saveExportFieldsConfig();
      }
      const customRadio = document.querySelector('input[name="exportPreset"][value="custom"]');
      if (customRadio) customRadio.checked = true;
    });
  });
}

function handleFieldDragStart(e) {
  dragSourceIdx = Number(e.currentTarget.dataset.idx);
  e.currentTarget.classList.add("dragging");
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
}

function handleFieldDragOver(e) {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  e.currentTarget.classList.add("drag-over");
}

function handleFieldDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}

function handleFieldDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");
  const targetIdx = Number(e.currentTarget.dataset.idx);
  if (dragSourceIdx === null || dragSourceIdx === targetIdx) return;

  const movedItem = exportFieldsConfig.splice(dragSourceIdx, 1)[0];
  exportFieldsConfig.splice(targetIdx, 0, movedItem);
  dragSourceIdx = null;
  saveExportFieldsConfig();
  renderExportFields();

  const customRadio = document.querySelector('input[name="exportPreset"][value="custom"]');
  if (customRadio) customRadio.checked = true;
}

function handleFieldDragEnd(e) {
  e.currentTarget.classList.remove("dragging");
  dragSourceIdx = null;
}

async function downloadSelectedCsv(e) {
  e.preventDefault();
  els.exportDialog?.close();

  const scope = document.querySelector('input[name="exportScope"]:checked')?.value || "all";
  const exportList = (scope === "selected" && selectedKeys.size > 0)
    ? currentRows.filter(r => selectedKeys.has(r._key))
    : currentRows;

  if (!exportList.length) return showError("No records to export.");

  const fileType = document.querySelector('input[name="exportFileType"]:checked')?.value || "txt";
  const presetVal = document.querySelector('input[name="exportPreset"]:checked')?.value || "notepad_clean";
  let fieldsToSend = null;

  if (presetVal === "client_block") {
    // Template without filled values
    fieldsToSend = null;
  } else {
    // Strictly export whatever fields are checked in exportFieldsConfig!
    fieldsToSend = exportFieldsConfig
      .filter(f => f.checked)
      .map(f => ({ key: f.key, label: f.label.replace(/\s*\(.*?\)/, "") }));
  }

  if (fileType === "txt") {
    await send("EXPORT_TXT", {
      rows: exportList,
      exportFormat: presetVal,
      fields: fieldsToSend,
      filename: "google-info-notepad-export.txt"
    });
    showSuccess?.(`Downloaded ${exportList.length} records as plain text for Notepad!`);
  } else {
    await send("EXPORT_CSV", {
      rows: exportList,
      exportFormat: presetVal,
      fields: fieldsToSend,
      demarcate: presetVal !== "flat",
      filename: "google-info-merged-export.csv"
    });
    showSuccess?.(`Downloaded ${exportList.length} records to merged CSV!`);
  }
}

let currentSortColumn = null;
let currentSortAsc = true;

function sortRowsBy(columnKey, toggle = true) {
  if (toggle) {
    if (currentSortColumn === columnKey) {
      currentSortAsc = !currentSortAsc;
    } else {
      currentSortColumn = columnKey;
      currentSortAsc = columnKey === "ceoName" ? false : true;
    }
  } else {
    currentSortColumn = columnKey;
    currentSortAsc = false;
  }

  currentRows.sort((a, b) => {
    const valA = (a[columnKey] || "").toString().trim();
    const valB = (b[columnKey] || "").toString().trim();

    if (columnKey === "ceoName") {
      const hasA = valA.length > 0;
      const hasB = valB.length > 0;
      if (hasA !== hasB) {
        return currentSortAsc ? (hasA ? 1 : -1) : (hasA ? -1 : 1);
      }
    }

    const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
    return currentSortAsc ? cmp : -cmp;
  });

  updateSortHeaderIcons();
  resultPage = 1;
  renderRows(currentRows);
}

function updateSortHeaderIcons() {
  document.querySelectorAll(".results-table th.sortable-th").forEach(th => {
    const col = th.dataset.sort;
    const iconSpan = th.querySelector(".sort-icon");
    if (!iconSpan) return;
    if (col === currentSortColumn) {
      iconSpan.textContent = currentSortAsc ? " ▲" : " ▼";
      iconSpan.style.opacity = "1";
    } else {
      iconSpan.textContent = "";
      iconSpan.style.opacity = "0.5";
    }
  });
}

function updateExportOptions(e) {
  updateExportDownloadBtnText();
  updateExportDescription();

  const presetRadio = document.querySelector('input[name="exportPreset"]:checked');
  const presetVal = presetRadio?.value || "notepad_clean";

  // When a preset is clicked, immediately pre-populate the checkboxes
  if (e && e.target && e.target.name === "exportPreset") {
    if (presetVal === "contacts") {
      exportFieldsConfig.forEach(f => {
        // Pre-check only Contacts & CEO & Phone & Website (Full Name, Address, Rating are UNCHECKED)
        f.checked = ["email", "ceoName", "firstName", "zoomCompany", "phone", "website"].includes(f.key);
      });
      renderExportFields();
      saveExportFieldsConfig();
    } else if (presetVal === "all") {
      exportFieldsConfig.forEach(f => { f.checked = true; });
      renderExportFields();
      saveExportFieldsConfig();
    } else if (presetVal === "notepad_clean") {
      exportFieldsConfig.forEach(f => {
        f.checked = f.key !== "category";
      });
      renderExportFields();
      saveExportFieldsConfig();
    }
  }

  // Always keep exportFields visible and customizable so the user is always in control!
  if (els.exportFields) {
    els.exportFields.hidden = false;
    els.exportFields.removeAttribute("hidden");
    els.exportFields.style.display = "flex";
  }
}

function renderSummary(summaries) {
  if (!els.summary) return;
  if (!summaries || !summaries.length) {
    els.summary.innerHTML = "";
    return;
  }
  els.summary.innerHTML = summaries.map(s => `
    <div class="summary-pill">${escapeHtml(s.query)}: ${s.count} merged</div>
  `).join("");
}

function loadFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const targetRole = els.targetRoleInput?.value.trim() || "CEO";
  const reader = new FileReader();
  reader.onload = async (event) => {
    const text = event.target.result;
    const isZoom = isZoomInfoFormat(text);
    const newJobs = isZoom ? parseZoomInfoCsv(text, targetRole) : parseBulk(text);
    if (newJobs.length) {
      parsedBulkJobs = parsedBulkJobs.concat(newJobs);
      await saveBulkJobs(parsedBulkJobs);
      renderBulkImportList();
      if (els.fileName) els.fileName.textContent = `${file.name} (${newJobs.length} rows)`;
      if (isZoom) {
        if (els.zoomFileName) els.zoomFileName.textContent = `${file.name} (${newJobs.length} contacts)`;
        setBusy(false, `Loaded ${newJobs.length} ZoomInfo contacts ready to search & merge (${targetRole})`);
      }
    } else {
      showError("Could not parse any valid contacts or search queries from file.");
    }
  };
  reader.readAsText(file);
}

function loadZoomFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const targetRole = els.targetRoleInput?.value.trim() || "CEO";
  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target.result;
    const newJobs = parseZoomInfoCsv(text, targetRole);
    if (newJobs.length) {
      parsedBulkJobs = parsedBulkJobs.concat(newJobs);
      saveBulkJobs(parsedBulkJobs);
      renderBulkImportList();
      if (els.zoomFileName) els.zoomFileName.textContent = `${file.name} (${newJobs.length} contacts, target: ${targetRole})`;
      setBusy(false, `Loaded ${newJobs.length} ZoomInfo contacts ready to search & merge (${targetRole})`);
    } else {
      showError("Could not parse any valid contacts or company rows from ZoomInfo CSV.");
    }
  };
  reader.readAsText(file);
}

function handleFileDrag(e) {
  e.preventDefault();
  els.fileDrop?.classList.add("drag-over");
  els.zoomFileDrop?.classList.add("drag-over");
}

function handleFileDragLeave(e) {
  e.preventDefault();
  els.fileDrop?.classList.remove("drag-over");
  els.zoomFileDrop?.classList.remove("drag-over");
}

function dropFile(e) {
  e.preventDefault();
  els.fileDrop?.classList.remove("drag-over");
  if (e.dataTransfer?.files.length) {
    if (els.fileInput) els.fileInput.files = e.dataTransfer.files;
    loadFile({ target: { files: e.dataTransfer.files } });
  }
}

function dropZoomFile(e) {
  e.preventDefault();
  els.zoomFileDrop?.classList.remove("drag-over");
  if (e.dataTransfer?.files.length) {
    if (els.zoomFileInput) els.zoomFileInput.files = e.dataTransfer.files;
    loadZoomFile({ target: { files: e.dataTransfer.files } });
  }
}

function clearFileInput() {
  if (els.fileInput) els.fileInput.value = "";
  if (els.fileName) els.fileName.textContent = "Supports standard CSV / TXT lists";
  if (els.zoomFileInput) els.zoomFileInput.value = "";
  if (els.zoomFileName) els.zoomFileName.textContent = "Supports ZoomInfo CSV exports with contacts & domains";
}

function renderSession(session) {
  if (session) {
    if (els.sessionStatus) els.sessionStatus.textContent = "Google Engine Ready";
    if (els.loginBadge) {
      els.loginBadge.textContent = "Ready";
      els.loginBadge.className = "badge success";
    }
    if (els.profileName) els.profileName.textContent = session.name || "Connected to Google";
  } else {
    if (els.sessionStatus) els.sessionStatus.textContent = "Ready to Search";
    if (els.loginBadge) {
      els.loginBadge.textContent = "Ready";
      els.loginBadge.className = "badge success";
    }
    if (els.profileName) els.profileName.textContent = "Google Info Search Active";
  }
}

function setBusy(busy, statusText) {
  if (statusText && els.sessionStatus) els.sessionStatus.textContent = statusText;
  if (els.refreshSession) els.refreshSession.disabled = busy;
  if (els.singleSearch) els.singleSearch.disabled = busy;
  if (els.bulkSearch) els.bulkSearch.disabled = busy;
}

function showError(msg) {
  if (els.sessionStatus) els.sessionStatus.textContent = `Error: ${msg}`;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function addRowKeys(rows) {
  return rows.map((r, i) => ({
    ...r,
    _key: r._key || `${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`
  }));
}

function send(action, payload = {}) {
  if (typeof chrome === "undefined" || !chrome?.runtime?.sendMessage) {
    return Promise.resolve({ ok: true, session: { email: "active_session" } });
  }
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ action, payload }, (res) => {
        if (chrome.runtime?.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(res || { ok: false, error: "Empty response" });
        }
      });
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
}

function showConfirm({ title, message }) {
  if (els.confirmTitle) els.confirmTitle.textContent = title;
  if (els.confirmMessage) els.confirmMessage.textContent = message;
  if (els.confirmOverlay) els.confirmOverlay.hidden = false;
  return new Promise((resolve) => { confirmResolver = resolve; });
}

function closeConfirm(res) {
  if (els.confirmOverlay) els.confirmOverlay.hidden = true;
  if (confirmResolver) {
    confirmResolver(res);
    confirmResolver = null;
  }
}

async function saveStateNow() {
  const db = await openDB();
  const tx = db.transaction(STATE_STORE_NAME, "readwrite");
  tx.objectStore(STATE_STORE_NAME).put({
    id: STATE_KEY,
    rows: currentRows,
    summaries: currentSummaries,
    savedAt: Date.now()
  });
}

async function restoreSavedState() {
  try {
    const db = await openDB();
    const tx = db.transaction(STATE_STORE_NAME, "readonly");
    const req = tx.objectStore(STATE_STORE_NAME).get(STATE_KEY);
    req.onsuccess = () => {
      if (req.result && Array.isArray(req.result.rows)) {
        currentRows = req.result.rows;
        currentSummaries = req.result.summaries || [];
        renderRows(currentRows);
        renderSummary(currentSummaries);
      }
    };
    parsedBulkJobs = await readBulkJobs();
    renderBulkImportList();
  } catch (_) {}
}

async function saveBulkJobs(jobs) {
  const db = await openDB();
  const tx = db.transaction(STATE_STORE_NAME, "readwrite");
  tx.objectStore(STATE_STORE_NAME).put({
    id: BULK_JOBS_KEY,
    jobs,
    savedAt: Date.now()
  });
}

async function readBulkJobs() {
  return new Promise(async (resolve) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STATE_STORE_NAME, "readonly");
      const req = tx.objectStore(STATE_STORE_NAME).get(BULK_JOBS_KEY);
      req.onsuccess = () => {
        resolve(req.result && Array.isArray(req.result.jobs) ? req.result.jobs : []);
      };
      req.onerror = () => resolve([]);
    } catch (_) {
      resolve([]);
    }
  });
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(STATE_DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STATE_STORE_NAME)) {
        db.createObjectStore(STATE_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function handleRuntimeMessage(message) {
  if (message.type === "SECURITY_STATE_CHANGED" || message.action === "SECURITY_STATE_CHANGED") {
    if (message.state) updateLicenseUI(message.state);
  }
}

// ─── License UI Management ───────────────────────────────────────────────────

function initLicenseUI() {
  if (typeof chrome !== "undefined" && chrome?.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ action: "GET_LICENSE_STATE" }, (resp) => {
      if (!resp) return;
      if (els.machineIdDisplay) els.machineIdDisplay.textContent = resp.machineId || "-";
      if (els.licenseKeyInput && resp.storedKey) els.licenseKeyInput.value = resp.storedKey;
    });
  } else {
    // Generate or retrieve local machine ID for standalone preview
    let localMid = localStorage.getItem("zim_machine_id");
    if (!localMid) {
      localMid = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `mach-${Math.random().toString(36).slice(2, 10)}`;
      try { localStorage.setItem("zim_machine_id", localMid); } catch (_) {}
    }
    if (els.machineIdDisplay) els.machineIdDisplay.textContent = localMid;
  }

  if (els.btnActivateLicense && els.licenseKeyInput) {
    const setBusyState = (busy) => {
      els.btnActivateLicense.disabled = busy;
      if (els.btnActivateLabel) els.btnActivateLabel.textContent = busy ? "Verifying..." : "Activate Extension";
    };

    const directVerify = async (key) => {
      try {
        const currentMachineId = els.machineIdDisplay?.textContent?.trim() || "browser-client";
        const res = await fetch("https://node.justfinejob.store/api/licensing/activate", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ licenseKey: key, machineId: currentMachineId })
        });
        if (!res.ok) throw new Error(`License server returned HTTP ${res.status}`);
        const data = await res.json();

        if (!data.valid) {
          const msgs = {
            not_found: "License key not found.",
            disabled: "This license has been deactivated by the administrator.",
            expired: "This license has expired.",
            activation_limit_reached: "Seat limit reached. All available seats are in use.",
            not_activated: "License activation failed."
          };
          throw new Error(msgs[data.status] || data.message || "License validation failed.");
        }

        const expiresAt = data.license?.expiryDate
          ? new Date(`${data.license.expiryDate}T23:59:59.999Z`).getTime()
          : null;

        const secState = {
          isActive: true,
          needsLicense: false,
          licenseState: {
            ok: true,
            key,
            machineId: currentMachineId,
            expiresAt
          }
        };

        if (typeof chrome !== "undefined" && chrome?.storage?.local) {
          chrome.storage.local.set({
            licenseKey: key,
            licenseState: secState.licenseState,
            securityState: secState
          });
        }

        return { success: true, securityState: secState };
      } catch (err) {
        return { success: false, error: err.message || "License validation failed." };
      }
    };

    const handleActivate = async () => {
      const key = els.licenseKeyInput.value.trim();
      if (!key) {
        if (els.lockErrorMsg) {
          els.lockErrorMsg.textContent = "Please enter your license key.";
          els.lockErrorMsg.style.display = "block";
        }
        return;
      }
      if (els.lockErrorMsg) els.lockErrorMsg.style.display = "none";
      if (els.lockSuccessMsg) els.lockSuccessMsg.style.display = "none";
      setBusyState(true);

      const unlockWithState = (secState) => {
        if (els.lockSuccessMsg) {
          els.lockSuccessMsg.textContent = "License activated successfully - unlocking...";
          els.lockSuccessMsg.style.display = "block";
        }
        setTimeout(() => {
          updateLicenseUI(secState);
        }, 500);
      };

      if (typeof chrome !== "undefined" && chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ action: "VALIDATE_LICENSE", key }, async (response) => {
          if (response && response.success) {
            setBusyState(false);
            unlockWithState(response.securityState);
          } else {
            // Direct fallback
            const fallback = await directVerify(key);
            setBusyState(false);
            if (fallback.success) {
              unlockWithState(fallback.securityState);
            } else {
              if (els.lockErrorMsg) {
                els.lockErrorMsg.textContent = fallback.error || response?.error || "License validation failed.";
                els.lockErrorMsg.style.display = "block";
              }
            }
          }
        });
      } else {
        const fallback = await directVerify(key);
        setBusyState(false);
        if (fallback.success) {
          unlockWithState(fallback.securityState);
        } else {
          if (els.lockErrorMsg) {
            els.lockErrorMsg.textContent = fallback.error || "License validation failed.";
            els.lockErrorMsg.style.display = "block";
          }
        }
      }
    };

    els.btnActivateLicense.addEventListener("click", handleActivate);
    els.licenseKeyInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleActivate();
    });
    els.licenseKeyInput.addEventListener("paste", () => {
      setTimeout(() => {
        els.licenseKeyInput.value = els.licenseKeyInput.value.trim();
      }, 0);
    });
  }

  if (els.btnLicenseRetry) {
    els.btnLicenseRetry.addEventListener("click", () => {
      els.btnLicenseRetry.disabled = true;
      chrome.runtime.sendMessage({ action: "CLEAR_LICENSE" }, () => {
        els.btnLicenseRetry.disabled = false;
        if (els.licenseInvalidOverlay) els.licenseInvalidOverlay.style.display = "none";
        if (els.lockOverlay) {
          els.lockOverlay.style.display = "flex";
          if (els.licenseKeyInput) {
            els.licenseKeyInput.value = "";
            els.licenseKeyInput.focus();
          }
        }
      });
    });
  }

  chrome.runtime.sendMessage({ action: "GET_SECURITY_STATE" }, (state) => {
    if (state) {
      updateLicenseUI(state);
    } else {
      chrome.runtime.sendMessage({ action: "FORCE_CHECK_SECURITY" }, (newState) => {
        if (newState) updateLicenseUI(newState);
      });
    }
  });
}

function updateLicenseUI(state) {
  if (!state) return;
  const lockOverlay = els.lockOverlay;
  const invalidOverlay = els.licenseInvalidOverlay;
  const banner = els.licenseStatusBanner;

  if (lockOverlay) lockOverlay.style.display = "none";
  if (invalidOverlay) invalidOverlay.style.display = "none";

  if (!state.isActive || state.needsLicense) {
    if (banner) banner.style.display = "none";
    const reason = state.licenseState?.reason;
    if (reason === "expired" || reason === "inactive") {
      if (invalidOverlay) {
        invalidOverlay.style.display = "flex";
        if (els.licenseInvalidHeader) {
          els.licenseInvalidHeader.textContent = reason === "expired" ? "License Expired" : "License Deactivated";
        }
        if (els.licenseInvalidBody) {
          els.licenseInvalidBody.textContent = reason === "expired"
            ? "Your ZoomInfo license has reached its expiration date. Please renew or enter a new license."
            : "This license has been deactivated by the administrator.";
        }
        if (els.licenseInvalidKey && state.licenseState?.key) {
          els.licenseInvalidKey.textContent = state.licenseState.key;
          els.licenseInvalidKey.style.display = "block";
        }
      }
    } else {
      if (lockOverlay) {
        lockOverlay.style.display = "flex";
        if (els.lockErrorMsg && state.licenseState?.reason && state.licenseState.reason !== "no_key") {
          let errText = "License invalid.";
          if (reason === "not_found") errText = "License key not found.";
          else if (reason === "seat_limit_reached") errText = "Seat limit reached for this license.";
          els.lockErrorMsg.textContent = errText;
          els.lockErrorMsg.style.display = "block";
        }
      }
    }
    return;
  }

  // Active License Banner
  if (banner && els.licenseStatusText) {
    const lic = state.licenseState || {};
    const keyTail = lic.key ? lic.key.slice(-8) : "";
    let label = keyTail ? `✓ License Active (…${keyTail})` : "✓ License Active";
    if (lic.expiresAt) {
      const expDate = new Date(Number(lic.expiresAt));
      const diffMs = lic.expiresAt - Date.now();
      const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
      if (diffDays <= 7 && diffDays > 0) {
        label += ` • Expires in ${diffDays}d`;
        banner.classList.add("warning");
      } else {
        label += ` • Exp: ${expDate.toLocaleDateString()}`;
        banner.classList.remove("warning");
      }
    } else {
      banner.classList.remove("warning");
    }
    els.licenseStatusText.textContent = label;
    banner.title = [
      lic.key ? `License: ${lic.key}` : "License Active",
      lic.machineId ? `Machine ID: ${lic.machineId}` : "",
      lic.expiresAt ? `Expires: ${new Date(Number(lic.expiresAt)).toLocaleString()}` : "No expiration set"
    ].filter(Boolean).join("\n");
    banner.style.display = "block";
  }
}


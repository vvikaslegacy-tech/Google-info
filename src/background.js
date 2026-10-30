import { formatSearchQuery, parseGoogleBusinessRecord, parseSerperResponse, extractStreetAddress, extractCityStateZip, extractExecutiveName, isPersonName, isValidExecutiveName, cleanDomainToCompanyName } from './info-utils.js';
import {
  validateLicense,
  bindMachineId,
  persistLicenseState,
  readPersistedLicenseState,
  saveLicenseKey,
  clearLicenseKey,
  isValidKeyFormat
} from './license-client.js';
import { getMachineId } from './machine-id.js';

const GOOGLE_HOME_URL = "https://www.google.com/";
const GOOGLE_MAPS_URL = "https://www.google.com/maps/";
const SERPER_PLACES_URL = "https://google.serper.dev/places";
const SERPER_SEARCH_URL = "https://google.serper.dev/search";
const SESSION_KEY = "googleSession";
const LOGGED_OUT_KEY = "googleLoggedOut";
const SERPER_KEY_STORAGE = "serperApiKey";
const SEARCH_CONTROL_POLL_MS = 250;

const searchControl = {
  active: false,
  paused: false,
  stopped: false
};

configureStickyPanel();

if (chrome.sidePanel?.setPanelBehavior) {
  chrome.runtime.onInstalled?.addListener?.(configureStickyPanel);
  chrome.runtime.onStartup?.addListener?.(configureStickyPanel);
}

function configureStickyPanel() {
  if (!chrome.sidePanel?.setPanelBehavior) return;
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const actionType = message.type || message.action;
  const run = async () => {
    switch (actionType) {
      case "LOGIN":
        return login();
      case "GET_SESSION":
        return getStoredSession();
      case "REFRESH_SESSION":
        return refreshSession();
      case "LOGOUT":
        return logout();
      case "SEARCH":
        return searchAll(message.payload || {});
      case "PAUSE_SEARCH":
        return pauseSearch();
      case "RESUME_SEARCH":
        return resumeSearch();
      case "STOP_SEARCH":
        return stopSearch();
      case "EXPORT_CSV":
        return exportCsv(message.payload || {});
      case "EXPORT_TXT":
        return exportTxt(message.payload || {});
      case "SAVE_SERPER_KEY":
        return saveSerperKey(message.payload?.key);
      case "GET_SERPER_KEY":
        return getSerperKey();
      case "SAVE_AI_SETTINGS":
        return saveAiSettings(message.payload?.settings);
      case "GET_AI_SETTINGS":
        return getAiSettings();
      case "VALIDATE_LICENSE":
        return handleValidateLicense(message.key || message.payload?.key);
      case "GET_LICENSE_STATE":
        return handleGetLicenseState();
      case "CLEAR_LICENSE":
        return handleClearLicense();
      case "GET_SECURITY_STATE":
        return getSecurityState();
      case "FORCE_CHECK_SECURITY":
        return fetchConfigAndValidate();
      default:
        throw new Error(`Unknown message type: ${actionType}`);
    }
  };

  run().then((res) => {
    sendResponse(res);
  }).catch((error) => {
    sendResponse({ ok: false, error: error.message || String(error) });
  });
  return true;
});

async function getStoredSession() {
  const data = await chrome.storage.local.get([SESSION_KEY, LOGGED_OUT_KEY]);
  if (data[LOGGED_OUT_KEY]) return { ok: true, session: null };
  const session = data[SESSION_KEY] || { name: "Google Connected", profileText: "Active" };
  return { ok: true, session };
}

async function login() {
  const tab = await chrome.tabs.create({ url: GOOGLE_HOME_URL, active: true });
  await waitForTabLoaded(tab.id);
  const session = { name: "Google User", profileText: "Connected" };
  await chrome.storage.local.set({ [SESSION_KEY]: session, [LOGGED_OUT_KEY]: false });
  return { ok: true, session };
}

async function refreshSession() {
  const session = { name: "Google Active", profileText: "Refreshed" };
  await chrome.storage.local.set({ [SESSION_KEY]: session, [LOGGED_OUT_KEY]: false });
  return { ok: true, session };
}

async function logout() {
  await chrome.storage.local.remove([SESSION_KEY]);
  await chrome.storage.local.set({ [LOGGED_OUT_KEY]: true });
  return { ok: true };
}

async function pauseSearch() {
  searchControl.paused = true;
  return { ok: true };
}

async function resumeSearch() {
  searchControl.paused = false;
  return { ok: true };
}

async function stopSearch() {
  searchControl.stopped = true;
  searchControl.active = false;
  return { ok: true };
}

async function saveSerperKey(key) {
  const cleanKey = String(key || '').trim();
  await chrome.storage.local.set({ [SERPER_KEY_STORAGE]: cleanKey });
  return { ok: true, key: cleanKey };
}

async function getSerperKey() {
  const data = await chrome.storage.local.get([SERPER_KEY_STORAGE]);
  return { ok: true, key: data[SERPER_KEY_STORAGE] || "" };
}

async function searchAll({ jobs = [], engine = "serper", serperKey = "", continueOnError = true }) {
  const secState = await getSecurityState();
  if (!secState || !secState.isActive || secState.needsLicense) {
    const reason = secState?.licenseState?.reason || 'unlicensed';
    throw new Error(`Search blocked: Valid ZoomInfo license required (${reason}). Please activate your license.`);
  }

  searchControl.active = true;
  searchControl.paused = false;
  searchControl.stopped = false;

  const results = [];
  const summaries = [];
  const searchedJobs = [];
  const searchCache = new Map();
  const companyCeoCache = new Map();

  const storedSerperKey = serperKey || (await getSerperKey()).key;

  const CONCURRENCY = 6;
  for (let idx = 0; idx < jobs.length; idx += CONCURRENCY) {
    if (searchControl.stopped) break;
    await checkPauseState();
    if (searchControl.stopped) break;

    const chunk = jobs.slice(idx, idx + CONCURRENCY);
    await Promise.all(chunk.map(async (job) => {
      const queryStr = formatSearchQuery(job);
      if (!queryStr) return;

      searchedJobs.push(job);
      const zoomInfo = job.zoomInfo || null;
      if (zoomInfo && !zoomInfo.companyName && zoomInfo.domain) {
        zoomInfo.companyName = cleanDomainToCompanyName(zoomInfo.domain);
      }
      const targetComp = (zoomInfo?.companyName || cleanDomainToCompanyName(zoomInfo?.domain) || queryStr.replace(/\b(?:CEO|Chief Executive Officer|Owner|Founder|President|Executive|Superintendent|Director)\b/gi, "").trim());
      const targetDomain = zoomInfo?.domain || "";
      const compKey = targetComp.toLowerCase().trim();

      let bestCeoName = (zoomInfo?.knownCeo && isValidExecutiveName(zoomInfo.knownCeo, targetComp, targetDomain)) ? zoomInfo.knownCeo : "";
      if (!bestCeoName && compKey && companyCeoCache.has(compKey)) {
        bestCeoName = companyCeoCache.get(compKey);
      }

      try {
        let extracted = [];
        if (searchCache.has(queryStr)) {
          extracted = searchCache.get(queryStr);
        } else {
          const isExecQuery = /ceo|chief executive|owner|founder|president|superintendent|director/i.test(queryStr);
          if (engine === "serper" || (storedSerperKey && engine !== "maps")) {
            const useSearchEndpoint = !!zoomInfo || isExecQuery;
            let placesOverride = "";
            if (zoomInfo) {
              const loc = job.location || extractCityStateZip(zoomInfo.companyAddress) || "";
              placesOverride = `${targetComp} ${loc}`.trim() || targetComp;
            } else if (isExecQuery) {
              const loc = job.location || "";
              placesOverride = `${targetComp} ${loc}`.trim() || targetComp;
            }
            extracted = await fetchSerperApi(queryStr, storedSerperKey, useSearchEndpoint, placesOverride, targetComp, targetDomain);
          } else {
            extracted = await scrapeGoogleSearch(queryStr, targetComp);
          }
          searchCache.set(queryStr, extracted);
        }

        // Check if CEO name was found in any result
        if (!bestCeoName) {
          for (const item of extracted) {
            if (item.ceoName && isValidExecutiveName(item.ceoName, targetComp, targetDomain)) {
              bestCeoName = item.ceoName;
              break;
            }
          }
        }

        // Public Web Search Fallback for CEO: only if Serper wasn't used or returned 0 results
        if (!bestCeoName && targetComp && !storedSerperKey) {
          bestCeoName = await fetchCeoFromWeb(targetComp, job.targetRole || "CEO", targetDomain);
        }

        // Strict validation on final CEO name
        if (bestCeoName && !isValidExecutiveName(bestCeoName, targetComp, targetDomain)) {
          bestCeoName = "";
        }

        if (bestCeoName && compKey) {
          companyCeoCache.set(compKey, bestCeoName);
        }

        // ── ZoomInfo Contact Mode: merge best Google result with ZoomInfo row ──
        if (zoomInfo) {
          const topPlace = extracted.find(p => p.name && p.category !== "Search Result") || (extracted.length > 0 ? parseGoogleBusinessRecord(extracted[0]) : null);
          const resolvedCompany = zoomInfo.companyName || topPlace?.name || cleanDomainToCompanyName(zoomInfo.domain);
          const fullAddr = topPlace?.address || zoomInfo.companyAddress || "";

          const groupLabel = zoomInfo.email || zoomInfo.fullName || resolvedCompany || queryStr;

          results.push({
            _groupLabel: groupLabel,
            fullName: zoomInfo.fullName || "",
            firstName: zoomInfo.firstName || (zoomInfo.fullName ? zoomInfo.fullName.split(" ")[0] : ""),
            email: zoomInfo.email || "",
            jobTitle: zoomInfo.jobTitle || "",
            zoomCompany: resolvedCompany || "",

            ceoName: (bestCeoName && isValidExecutiveName(bestCeoName, resolvedCompany, targetDomain)) ? bestCeoName : "",
            name: topPlace?.name || resolvedCompany || "No Google Business Match",
            phone: topPlace?.phone || zoomInfo.phone || "",
            website: topPlace?.website || zoomInfo.website || (targetDomain ? `https://${targetDomain}` : ""),
            category: topPlace?.category || zoomInfo.jobTitle || "",
            streetAddress: extractStreetAddress(fullAddr),
            cityStateZip: extractCityStateZip(fullAddr),
            address: fullAddr,
            rating: topPlace?.rating || "",
            reviewsCount: topPlace?.reviewsCount || ""
          });
        } else {
          // ── Standard Multi-Result Mode for General Keyword Searches ──
          if (extracted.length > 0) {
            for (const item of extracted) {
              const rec = parseGoogleBusinessRecord(item);
              if (rec.name) {
                const fullAddr = rec.address || "";
                results.push({
                  query: queryStr,
                  ceoName: (bestCeoName && isValidExecutiveName(bestCeoName, rec.name, targetDomain)) ? bestCeoName : "",
                  name: rec.name,
                  phone: rec.phone,
                  website: rec.website,
                  category: rec.category,
                  streetAddress: extractStreetAddress(fullAddr),
                  cityStateZip: extractCityStateZip(fullAddr),
                  address: fullAddr,
                  rating: rec.rating,
                  reviewsCount: rec.reviewsCount
                });
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error processing job "${queryStr}":`, err);
      }
    }));
  }

  searchControl.active = false;
  return {
    ok: true,
    results,
    summaries,
    searchedJobs,
    stopped: searchControl.stopped
  };
}

async function fetchSerperApi(queryStr, apiKey, useSearchEndpoint = false, placesQueryOverride = "", companyName = "", domain = "") {
  if (!apiKey) {
    throw new Error("Serper.dev API Key is missing. Enter your Serper API Key in Settings.");
  }

  const headers = {
    "X-API-KEY": apiKey,
    "Content-Type": "application/json"
  };

  if (useSearchEndpoint) {
    const placesQuery = placesQueryOverride || queryStr.replace(/\b(?:CEO|Owner|Founder|President|Executive|Superintendent|Director)\b/gi, "").trim();

    // Fire BOTH /search and /places in parallel for instant sub-second response
    const searchPromise = fetch(SERPER_SEARCH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ q: queryStr })
    }).then(r => r.ok ? r.json() : null).catch(() => null);

    const placesPromise = placesQuery ? fetch(SERPER_PLACES_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ q: placesQuery })
    }).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null);

    const [searchData, placesData] = await Promise.all([searchPromise, placesPromise]);

    const searchResults = searchData ? parseSerperResponse(searchData, companyName, domain) : [];
    const foundCeo = searchResults.find(r => r.ceoName && isValidExecutiveName(r.ceoName, companyName, domain))?.ceoName || "";

    if (placesData) {
      const placesResults = parseSerperResponse(placesData, companyName, domain);
      if (placesResults.length > 0) {
        // Enrich places results with CEO name found from search
        for (const pr of placesResults) {
          if (!pr.ceoName && foundCeo) pr.ceoName = foundCeo;
        }
        return placesResults;
      }
    }

    // Fallback: if places had no results, ensure searchResults carry foundCeo
    if (foundCeo) {
      for (const sr of searchResults) {
        if (!sr.ceoName) sr.ceoName = foundCeo;
      }
    }
    return searchResults;
  }

  // Default: use /places endpoint for general business queries
  const res = await fetch(SERPER_PLACES_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ q: queryStr })
  });
  if (!res.ok) {
    throw new Error(`Serper API responded with HTTP ${res.status}`);
  }
  const data = await res.json();
  return parseSerperResponse(data);
}

const NVIDIA_NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const AI_SETTINGS_STORAGE = "ai_model_settings";

async function saveAiSettings(settings) {
  const clean = {
    apiKey: String(settings?.apiKey || "").trim(),
    model: String(settings?.model || "google/gemma-2-27b-it").trim(),
    systemPrompt: String(settings?.systemPrompt || "").trim(),
    fallbackEnabled: settings?.fallbackEnabled !== false
  };
  await chrome.storage.local.set({ [AI_SETTINGS_STORAGE]: clean });
  return { ok: true, settings: clean };
}

async function getAiSettings() {
  const data = await chrome.storage.local.get([AI_SETTINGS_STORAGE]);
  const defaultSettings = {
    apiKey: "",
    model: "google/gemma-2-27b-it",
    systemPrompt: "You are an executive research AI. Extract business details for the requested company/domain in JSON ONLY format: {\"ceoName\":\"...\", \"name\":\"...\", \"phone\":\"...\", \"website\":\"...\", \"category\":\"...\"}",
    fallbackEnabled: true
  };
  return { ok: true, settings: data[AI_SETTINGS_STORAGE] || defaultSettings };
}

async function fetchNvidiaNimApi(queryStr, zoomInfo, aiSettings) {
  if (!aiSettings || !aiSettings.apiKey) return null;

  const targetComp = zoomInfo?.companyName || zoomInfo?.domain || queryStr;
  const targetDomain = zoomInfo?.domain || zoomInfo?.website || "";

  const systemPrompt = aiSettings.systemPrompt ||
    "You are an executive research AI. Extract business details for the requested company/domain in JSON ONLY format with keys: ceoName, name, phone, website, category.";

  const userMessage = `Find executive/CEO details for:
Company: ${targetComp}
Domain: ${targetDomain}
Target Query: ${queryStr}

Return valid JSON object ONLY with keys: ceoName, name, phone, website, category.`;

  try {
    const res = await fetch(NVIDIA_NIM_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${aiSettings.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: aiSettings.model || "google/gemma-2-27b-it",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.1,
        max_tokens: 300
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ceoName: parsed.ceoName || "",
        name: parsed.name || targetComp,
        phone: parsed.phone || "",
        website: parsed.website || targetDomain,
        category: parsed.category || "AI Model",
        address: "",
        rating: "",
        reviewsCount: ""
      };
    }
  } catch (err) {
    console.error("NVIDIA NIM AI Fetch Error:", err);
  }
  return null;
}

async function fetchCeoFromWeb(companyName, targetRole = "CEO", domain = "") {
  if (!companyName) return "";
  const cleanComp = cleanDomainToCompanyName(companyName) || companyName.trim();
  const query = `${cleanComp} ${targetRole}`;

  const fetchDdg = async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
      clearTimeout(timeout);
      if (!res.ok) return "";
      const html = await res.text();
      const snipRegex = /class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
      let sMatch;
      while ((sMatch = snipRegex.exec(html)) !== null) {
        const snippet = sMatch[1].replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").trim();
        const ceo = extractExecutiveName("", snippet, cleanComp, domain);
        if (ceo && isValidExecutiveName(ceo, cleanComp, domain)) return ceo;
      }
    } catch (_) {}
    return "";
  };

  const fetchYahoo = async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`https://search.yahoo.com/search?p=${encodeURIComponent(query)}`, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
      clearTimeout(timeout);
      if (!res.ok) return "";
      const html = await res.text();
      const snipRegex = /class="compText[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      let sMatch;
      while ((sMatch = snipRegex.exec(html)) !== null) {
        const snip = sMatch[1].replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").trim();
        const ceo = extractExecutiveName("", snip, cleanComp, domain);
        if (ceo && isValidExecutiveName(ceo, cleanComp, domain)) return ceo;
      }
    } catch (_) {}
    return "";
  };

  const [ddgResult, yahooResult] = await Promise.all([fetchDdg(), fetchYahoo()]);
  return ddgResult || yahooResult || "";
}

async function scrapeGoogleSearch(queryStr, companyName = "") {
  const isExec = /ceo|chief executive|owner|founder|president|superintendent|director/i.test(queryStr);
  const searchUrl = isExec 
    ? `${GOOGLE_HOME_URL}search?q=${encodeURIComponent(queryStr)}&hl=en`
    : `${GOOGLE_MAPS_URL}search/${encodeURIComponent(queryStr)}`;

  const tab = await chrome.tabs.create({ url: searchUrl, active: false });

  try {
    await waitForTabLoaded(tab.id, 15000);
    await delay(2000);

    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractGoogleSearchResults,
      args: [isExec, companyName]
    });

    if (injected && injected[0] && Array.isArray(injected[0].result)) {
      return injected[0].result;
    }
    return [];
  } catch (err) {
    return [];
  } finally {
    try { await chrome.tabs.remove(tab.id); } catch (_) {}
  }
}

function extractGoogleSearchResults(isExec, companyName) {
  const records = [];
  let foundCeo = "";

  if (isExec) {
    // Answer Box / Direct Knowledge Panel extraction
    const ceoEl = document.querySelector('div.Z0LcW, div[data-attrid="kc:/location/location:ceo"], div[data-attrid*="ceo"], div.FLP8od, [data-attrid*="key_people"]');
    if (ceoEl) foundCeo = ceoEl.textContent.trim();

    if (!foundCeo) {
      const kgTitleEl = document.querySelector('.kno-ecr-pt');
      const kgSubtitleEl = document.querySelector('div[data-attrid="subtitle"]');
      if (kgTitleEl && kgSubtitleEl && /ceo|chief executive|founder|president|businessman|executive/i.test(kgSubtitleEl.textContent)) {
        foundCeo = kgTitleEl.textContent.trim();
      }
    }

    if (!foundCeo) {
      const snippetEls = document.querySelectorAll('.VwiC3b, div.BNeawe');
      for (const el of snippetEls) {
        const text = el.textContent || "";
        const m = text.match(/(?:CEO|Chief Executive Officer|Founder|President)\s*[:|-]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i)
               || text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*(?:is|serves as|appointed as|,)\s*(?:the\s+)?(?:CEO|Chief Executive Officer)/i);
        if (m && m[1]) {
          foundCeo = m[1].trim();
          break;
        }
      }
    }
  }

  // Extract Places (Local pack on Google Web Search OR Google Maps)
  const items = document.querySelectorAll('div[role="feed"] > div, div.Nv2PK, div.VkpFyc');
  if (items.length > 0) {
    items.forEach((item) => {
      const nameEl = item.querySelector('.qBF1Pd, .fontHeadlineSmall, .heading-title, .OSr24b, [role="heading"]');
      const name = nameEl ? nameEl.textContent.trim() : '';
      if (!name) return;

      const ratingEl = item.querySelector('.MW4fe dense, .MW4fe, span.ce3Tcd, span.yi40Hd');
      const rating = ratingEl ? ratingEl.textContent.trim() : '';

      const phoneEl = item.querySelector('button[data-tooltip*="phone"], span.usrbj');
      const phone = phoneEl ? phoneEl.textContent.trim() : '';

      const websiteEl = item.querySelector('a[aria-label*="website"], a.lBs37d, a[data-website]');
      const website = websiteEl ? websiteEl.href : '';

      const categoryEl = item.querySelector('.W4Efsd span, .fontBodyMedium span');
      const category = categoryEl ? categoryEl.textContent.trim() : '';

      const addressEl = item.querySelector('.W4Efsd:nth-child(2)');
      const address = addressEl ? addressEl.textContent.trim() : '';

      records.push({ ceoName: foundCeo, name, phone, website, category, address, rating });
    });
  }

  if (records.length === 0 && foundCeo) {
    records.push({
      ceoName: foundCeo,
      name: companyName || "Search Result",
      phone: "",
      website: "",
      category: "Executive Result",
      address: "",
      rating: "",
      reviewsCount: ""
    });
  }

  return records;
}

async function checkPauseState() {
  while (searchControl.paused && !searchControl.stopped) {
    await delay(SEARCH_CONTROL_POLL_MS);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForTabLoaded(tabId, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const listener = (id, changeInfo) => {
      if (id === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        clearInterval(checkInterval);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);

    const checkInterval = setInterval(() => {
      if (Date.now() - started > timeoutMs) {
        chrome.tabs.onUpdated.removeListener(listener);
        clearInterval(checkInterval);
        resolve();
      }
    }, 500);
  });
}

async function exportTxt({ rows = [], exportFormat = "client_block", fields = null, filename = "google-info-notepad-export.txt" }) {
  if (!rows || !rows.length) return { ok: false, error: "No rows to export" };

  const lines = [];

  if (exportFormat === "client_block" && (!fields || !fields.length)) {
    // Exact Notepad block format requested by client (Ball Ball) in Telegram:
    // Lines ending with "=" after Job Title
    for (const r of rows) {
      const email = r.email || "";
      const rating = r.rating || "";
      const googlePlace = (r.name || "").replace(/[\r\n]+/g, " ").trim();
      const ratingReviews = rating ? `${rating}(${r.userRatingsTotal || 1})` : "";
      const ratingStr = ratingReviews 
        ? `",${ratingReviews}","${ratingReviews}","${googlePlace}"` 
        : (rating ? `",${rating}","${rating}","${googlePlace}"` : "");

      lines.push(`"${email}`);
      lines.push("Full Name");
      lines.push("First Name");
      if (ratingStr && (r.streetAddress || r.address)) {
        lines.push(`Company Address${ratingStr}`);
      } else {
        lines.push("Company Address");
      }
      lines.push("Company Name");
      if (ratingStr && !(r.streetAddress || r.address)) {
        lines.push(`Job Title${ratingStr}`);
      } else {
        lines.push("Job Title");
      }
      lines.push("=");
    }
  } else if (exportFormat === "client_filled" && (!fields || !fields.length)) {
    // Notepad block format with actual filled values:
    for (const r of rows) {
      const email = r.email || "";
      const fullName = (r.fullName || "").replace(/[\r\n]+/g, " ").trim();
      const firstName = (r.firstName || (fullName ? fullName.split(" ")[0] : "")).replace(/[\r\n]+/g, " ").trim();
      const fullAddr = (r.address || "").replace(/[\r\n]+/g, " ").trim();
      const street = (r.streetAddress || extractStreetAddress(fullAddr)).replace(/[\r\n]+/g, " ").trim();
      const company = (r.zoomCompany || "").replace(/[\r\n]+/g, " ").trim();
      const jobTitle = (r.jobTitle || "").replace(/[\r\n]+/g, " ").trim();
      const rating = r.rating || "";
      const googlePlace = (r.name || "").replace(/[\r\n]+/g, " ").trim();
      const ratingReviews = rating ? `${rating}(${r.userRatingsTotal || 1})` : "";
      const ratingStr = ratingReviews 
        ? `",${ratingReviews}","${ratingReviews}","${googlePlace}"` 
        : (rating ? `",${rating}","${rating}","${googlePlace}"` : "");

      lines.push(`"${email}`);
      lines.push(fullName || "Full Name");
      lines.push(firstName || "First Name");
      if (ratingStr && street) {
        lines.push(`${street}${ratingStr}`);
      } else {
        lines.push(street || "Company Address");
      }
      lines.push(company || "Company Name");
      if (ratingStr && !street) {
        lines.push(`${jobTitle || "Job Title"}${ratingStr}`);
      } else {
        lines.push(jobTitle || "Job Title");
      }
      lines.push("=");
    }
  } else if (Array.isArray(fields) && fields.length > 0) {
    // Dynamic field-based report strictly respecting user's checkboxes and ordering
    const activeFields = fields.filter(f => f && f.checked !== false);
    for (const r of rows) {
      lines.push("--------------------------------------------------");
      const companyVal = (r.zoomCompany || r.name || "").replace(/[\r\n]+/g, " ").trim();
      const fullAddr = (r.address || r.streetAddress || "").replace(/[\r\n]+/g, " ").trim();
      const street = (r.streetAddress || extractStreetAddress(fullAddr)).replace(/[\r\n]+/g, " ").trim();
      const cityZip = (r.cityStateZip || extractCityStateZip(fullAddr)).replace(/[\r\n]+/g, " ").trim();

      for (let i = 0; i < activeFields.length; i++) {
        const f = activeFields[i];
        const key = f.key;

        if (key === "email") {
          lines.push(`Email:           ${r.email || ""}`);
        } else if (key === "ceoName") {
          const ceoVal = (r.ceoName || "").trim();
          if (ceoVal && isValidExecutiveName(ceoVal, companyVal, r.website)) {
            lines.push(`CEO / Exec:      ${ceoVal}`);
          } else {
            lines.push(`CEO / Exec:      `);
          }
        } else if (key === "fullName") {
          lines.push(`Full Name:       ${(r.fullName || "").replace(/[\r\n]+/g, " ").trim()}`);
        } else if (key === "firstName") {
          const fName = (r.firstName || (r.fullName ? r.fullName.split(" ")[0] : "")).replace(/[\r\n]+/g, " ").trim();
          lines.push(`First Name:      ${fName}`);
        } else if (key === "zoomCompany") {
          lines.push(`Company:         ${companyVal}`);
        } else if (key === "jobTitle") {
          lines.push(`Job Title:       ${(r.jobTitle || "").replace(/[\r\n]+/g, " ").trim()}`);
        } else if (key === "streetAddress") {
          // If cityStateZip follows immediately, format as 2-step address block
          const nextField = activeFields[i + 1];
          if (nextField && nextField.key === "cityStateZip") {
            const streetText = street ? (street.endsWith(",") ? street : `${street},`) : "";
            lines.push(`Address:         ${streetText}`);
            lines.push(`                 ${cityZip}`);
            i++; // skip next since rendered together
          } else {
            lines.push(`Address:         ${street}`);
          }
        } else if (key === "cityStateZip") {
          lines.push(`City, State Zip: ${cityZip}`);
        } else if (key === "address") {
          if (fullAddr) {
            const firstComma = fullAddr.indexOf(",");
            if (firstComma !== -1 && firstComma < fullAddr.length - 1) {
              const step1 = fullAddr.slice(0, firstComma + 1).trim();
              const step2 = fullAddr.slice(firstComma + 1).trim();
              lines.push(`Address:         ${step1}`);
              lines.push(`                 ${step2}`);
            } else {
              lines.push(`Address:         ${fullAddr}`);
            }
          } else {
            lines.push(`Address:         `);
          }
        } else if (key === "name") {
          let businessName = (r.name || "").replace(/[\r\n]+/g, " ").trim();
          if (!businessName || businessName === r.fullName || businessName === "No match") {
            businessName = companyVal || "";
          }
          lines.push(`Google Business: ${businessName}`);
        } else if (key === "phone") {
          lines.push(`Phone:           ${r.phone || ""}`);
        } else if (key === "website") {
          lines.push(`Website:         ${r.website || ""}`);
        } else if (key === "category") {
          lines.push(`Category:        ${r.category || ""}`);
        } else if (key === "rating") {
          lines.push(`Rating:          ${r.rating || ""}`);
        } else if (r[key] !== undefined) {
          const label = (f.label || key).replace(/:$/, "");
          lines.push(`${(label + ":").padEnd(17, " ")}${r[key] || ""}`);
        }
      }
      lines.push("=");
    }
  } else {
    // Clean formatted text report for Notepad
    for (const r of rows) {
      lines.push("--------------------------------------------------");
      lines.push(`Email:           ${r.email || ""}`);
      const companyVal = (r.zoomCompany || r.name || "").replace(/[\r\n]+/g, " ").trim();
      const ceoVal = (r.ceoName || "").trim();
      if (ceoVal && isValidExecutiveName(ceoVal, companyVal, r.website)) {
        lines.push(`CEO / Exec:      ${ceoVal}`);
      }
      lines.push(`Full Name:       ${(r.fullName || "").replace(/[\r\n]+/g, " ").trim()}`);
      lines.push(`First Name:      ${(r.firstName || (r.fullName ? r.fullName.split(" ")[0] : "")).replace(/[\r\n]+/g, " ").trim()}`);
      lines.push(`Company:         ${companyVal}`);
      lines.push(`Job Title:       ${(r.jobTitle || "").replace(/[\r\n]+/g, " ").trim()}`);
      
      const rawAddr = (r.address || r.streetAddress || "").replace(/[\r\n]+/g, " ").trim();
      if (rawAddr) {
        const firstComma = rawAddr.indexOf(",");
        if (firstComma !== -1 && firstComma < rawAddr.length - 1) {
          const step1 = rawAddr.slice(0, firstComma + 1).trim();
          const step2 = rawAddr.slice(firstComma + 1).trim();
          lines.push(`Address:         ${step1}`);
          lines.push(`                 ${step2}`);
        } else {
          lines.push(`Address:         ${rawAddr}`);
        }
      } else {
        lines.push(`Address:         `);
      }

      // Google Business name must never be the person's name
      let businessName = (r.name || "").replace(/[\r\n]+/g, " ").trim();
      if (!businessName || businessName === r.fullName || businessName === "No match") {
        businessName = companyVal || "No Google Business Match";
      }
      lines.push(`Google Business: ${businessName}`);
      lines.push(`Phone:           ${r.phone || ""}`);
      lines.push(`Website:         ${r.website || ""}`);
      lines.push(`Rating:          ${r.rating || ""}`);
      lines.push("=");
    }
  }

  const textContent = lines.join("\r\n");
  const dataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(textContent)}`;
  await chrome.downloads.download({
    url: dataUrl,
    filename,
    saveAs: true
  });
  return { ok: true };
}

async function exportCsv({ rows = [], exportFormat = "client_block", fields = null, demarcate = true, filename = "google-info-merged-export.csv" }) {
  if (!rows || !rows.length) return { ok: false, error: "No rows to export" };

  // ── CLIENT BLOCK FORMAT (Matches Notepad++ screenshot with "=" after Job Title) ──
  if (exportFormat === "client_block") {
    const lines = [];
    for (const r of rows) {
      const email = r.email || "";
      const rating = r.rating || "";
      const googlePlace = (r.name || "").replace(/[\r\n]+/g, " ").trim();
      const ratingReviews = rating ? `${rating}(${r.userRatingsTotal || 1})` : "";
      const ratingStr = ratingReviews 
        ? `",${ratingReviews}","${ratingReviews}","${googlePlace}"` 
        : (rating ? `",${rating}","${rating}","${googlePlace}"` : "");

      lines.push(`"${email}`);
      lines.push("Full Name");
      lines.push("First Name");
      if (ratingStr && (r.streetAddress || r.address)) {
        lines.push(`Company Address${ratingStr}`);
      } else {
        lines.push("Company Address");
      }
      lines.push("Company Name");
      if (ratingStr && !(r.streetAddress || r.address)) {
        lines.push(`Job Title${ratingStr}`);
      } else {
        lines.push("Job Title");
      }
      lines.push("=");
    }
    const csvContent = lines.join("\r\n");
    const dataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
    await chrome.downloads.download({
      url: dataUrl,
      filename,
      saveAs: true
    });
    return { ok: true };
  }

  const activeFields = (fields && fields.length) ? fields : [
    { key: "email", label: "Email" },
    { key: "ceoName", label: "CEO / Executive Name" },
    { key: "firstName", label: "First Name" },
    { key: "fullName", label: "Full Name" },
    { key: "zoomCompany", label: "ZoomInfo Company" },
    { key: "streetAddress", label: "Street Address" },
    { key: "cityStateZip", label: "City, State Zip" },
    { key: "name", label: "Google Business Name" },
    { key: "phone", label: "Phone" },
    { key: "website", label: "Website" },
    { key: "category", label: "Category" },
    { key: "rating", label: "Rating" }
  ];

  const headers = activeFields.map(f => escapeCsvField(f.label));
  const csvLines = [headers.join(",")];

  for (const r of rows) {
    const fullAddr = (r.address || "").replace(/[\r\n]+/g, " ").trim();
    const street = (r.streetAddress || extractStreetAddress(fullAddr)).replace(/[\r\n]+/g, " ").trim();
    const cityZip = (r.cityStateZip || extractCityStateZip(fullAddr)).replace(/[\r\n]+/g, " ").trim();

    if (demarcate) {
      const emailOrName = r.email || r.fullName || r.name || "Contact";
      const groupHeader = activeFields.map((f, i) => i === 0 ? escapeCsvField(`=== ${emailOrName} ===`) : '""').join(",");
      csvLines.push(groupHeader);
    }

    const line = activeFields.map(f => {
      let val = "";
      if (f.key === "streetAddress") val = street;
      else if (f.key === "cityStateZip") val = cityZip;
      else if (f.key === "firstName") val = r.firstName || (r.fullName ? r.fullName.split(" ")[0] : "");
      else val = r[f.key] || "";
      return escapeCsvField(val);
    }).join(",");

    csvLines.push(line);

    if (demarcate) {
      csvLines.push(activeFields.map(() => '""').join(","));
    }
  }

  const csvContent = csvLines.join("\r\n");
  const dataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
  await chrome.downloads.download({
    url: dataUrl,
    filename,
    saveAs: true
  });
  return { ok: true };
}

function escapeCsvField(val) {
  if (val == null) return '""';
  // Strip out any line breaks so Notepad++ doesn't break a single record onto multiple lines
  const str = String(val).replace(/[\r\n]+/g, ' ').replace(/"/g, '""').trim();
  return `"${str}"`;
}

// ─── License Management & Security Background Engine ─────────────────────────

async function handleValidateLicense(rawKey) {
  const key = String(rawKey || '').trim();
  if (!key) {
    return { ok: false, success: false, error: 'Please enter your license key.' };
  }
  if (!isValidKeyFormat(key)) {
    return { ok: false, success: false, error: 'Invalid key format. Expected "ZIM-" followed by 32 characters.' };
  }

  const result = await validateLicense(key);
  if (!result.ok) {
    let errorMsg = 'License validation failed.';
    if (result.reason === 'not_found') errorMsg = 'License key not found.';
    else if (result.reason === 'inactive') errorMsg = 'This license has been deactivated by the administrator.';
    else if (result.reason === 'expired') errorMsg = 'This license has expired.';
    else if (result.reason === 'seat_limit_reached') errorMsg = 'Seat limit reached for this license. All available seats are in use.';
    else if (result.reason === 'network_error') errorMsg = 'Network error connecting to license server.';
    return { ok: false, success: false, error: errorMsg, reason: result.reason };
  }

  if (!result.alreadyBound) {
    const bindResult = await bindMachineId(key, result.machineId);
    if (!bindResult.ok) {
      if (bindResult.reason === 'seat_limit_reached') {
        return { ok: false, success: false, error: 'Seat limit reached for this license.' };
      }
      return { ok: false, success: false, error: bindResult.error || 'Failed to bind machine ID to license.' };
    }
  }

  await saveLicenseKey(key);
  await persistLicenseState({
    ok: true,
    reason: 'ok',
    key,
    machineId: result.machineId,
    expiresAt: result.row?.expiresAt ? Number(result.row.expiresAt) : null
  });

  const secState = await fetchConfigAndValidate();
  return { ok: true, success: true, securityState: secState };
}

async function handleGetLicenseState() {
  const { storedKey, storedState } = await readPersistedLicenseState();
  const machineId = await getMachineId();
  return { ok: true, storedKey, storedState, machineId };
}

async function handleClearLicense() {
  await clearLicenseKey();
  const secState = await fetchConfigAndValidate();
  return { ok: true, success: true, securityState: secState };
}

async function refreshLicenseState() {
  const { storedKey, storedState } = await readPersistedLicenseState();
  if (!storedKey) {
    return { ok: false, reason: 'no_key', key: null, machineId: null, checkedAt: Date.now() };
  }

  const result = await validateLicense(storedKey);

  if (result.reason === 'network_error') {
    if (storedState && storedState.ok) return storedState;
    return await persistLicenseState({
      ok: false, reason: 'network_error', key: storedKey
    });
  }

  return await persistLicenseState({
    ok: result.ok,
    reason: result.reason,
    key: result.key,
    machineId: result.machineId || (storedState && storedState.machineId) || null,
    expiresAt: (result.row && result.row.expiresAt != null)
      ? Number(result.row.expiresAt)
      : (storedState && storedState.expiresAt != null ? storedState.expiresAt : null)
  });
}

async function getSecurityState() {
  const data = await chrome.storage.local.get(['securityState']);
  return data.securityState || null;
}

async function fetchConfigAndValidate() {
  const licenseState = await refreshLicenseState();
  const isActive = !!licenseState.ok;
  const needsLicense = !licenseState.ok;

  const securityState = {
    isActive,
    needsLicense,
    licenseState
  };

  await chrome.storage.local.set({ securityState });

  if (!isActive && searchControl.active) {
    stopSearch();
  }

  try {
    chrome.runtime.sendMessage?.({
      type: 'SECURITY_STATE_CHANGED',
      action: 'SECURITY_STATE_CHANGED',
      state: securityState
    })?.catch?.(() => {});
  } catch (_) {}

  return securityState;
}

fetchConfigAndValidate();
setInterval(fetchConfigAndValidate, 30000);

if (chrome.alarms) {
  chrome.alarms.create('license_heartbeat', { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'license_heartbeat') {
      fetchConfigAndValidate();
    }
  });
}

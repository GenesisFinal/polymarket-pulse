// Polymarket Pulse - Client Application

const CATEGORIES = [
  { id: "trending", name: "Trending", emoji: "🔥" },
  { id: "argentina", name: "Argentina", emoji: "🇦🇷" },
  { id: "macro", name: "Macroeconomía", emoji: "📈" },
  { id: "politica", name: "Política", emoji: "🏛️" },
  { id: "cripto", name: "Cripto", emoji: "⚡" },
  { id: "ia-tech", name: "IA & Tech", emoji: "🤖" },
  { id: "deportes", name: "Deportes", emoji: "⚽" },
  { id: "all", name: "Todos", emoji: "🌐" },
  { id: "watchlist", name: "Favoritos", emoji: "⭐" }
];

const CATEGORY_COLORS = {
  argentina: { bg: "bg-sky-500/15", text: "text-sky-400", border: "border-sky-500/30" },
  macro: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" },
  politica: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
  cripto: { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/30" },
  "ia-tech": { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/30" },
  deportes: { bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/30" },
  general: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30" }
};

// Application State
let currentCategory = "trending";
let searchQuery = "";
let sortBy = "volume24hr";
let allLoadedEvents = [];
let favorites = new Set(JSON.parse(localStorage.getItem("poly_favorites") || "[]"));

// Modal State
let activeModalEvent = null;
let activeModalOutcomeIdx = 0;
let activeModalInterval = "all";
let chartInstance = null;

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  renderCategoryPills();
  setupEventListeners();
  loadMarkets();

  // Auto refresh every 40 seconds
  setInterval(() => {
    loadMarkets(true);
  }, 40000);
});

// Setup UI Event Listeners
function setupEventListeners() {
  const searchInput = document.getElementById("searchInput");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const sortSelect = document.getElementById("sortSelect");

  // Debounced search
  let searchTimeout = null;
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.trim();
    if (searchQuery.length > 0) {
      clearSearchBtn.classList.remove("hidden");
    } else {
      clearSearchBtn.classList.add("hidden");
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadMarkets();
    }, 300);
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchQuery = "";
    clearSearchBtn.classList.add("hidden");
    loadMarkets();
  });

  refreshBtn.addEventListener("click", () => {
    const icon = document.getElementById("refreshIcon");
    icon.classList.add("animate-spin");
    loadMarkets().finally(() => {
      setTimeout(() => icon.classList.remove("animate-spin"), 500);
    });
  });

  sortSelect.addEventListener("change", (e) => {
    sortBy = e.target.value;
    sortAndRenderEvents();
  });

  // Modal event listeners
  document.getElementById("closeModalBtn").addEventListener("click", closeModal);
  document.getElementById("detailModal").addEventListener("click", (e) => {
    if (e.target.id === "detailModal") closeModal();
  });

  // Timeframe buttons
  const tfButtons = document.querySelectorAll("#timeframeSelector button");
  tfButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tfButtons.forEach((b) => {
        b.className = "px-2.5 py-1 rounded-lg text-slate-400 hover:text-white transition";
      });
      btn.className = "px-2.5 py-1 rounded-lg bg-blue-600 text-white font-semibold transition";
      activeModalInterval = btn.dataset.interval;
      loadChartData();
    });
  });

  // iPhone guide modal
  const guideModal = document.getElementById("iphoneGuideModal");
  document.getElementById("installGuideBtn").addEventListener("click", () => {
    guideModal.classList.remove("hidden");
  });
  document.getElementById("closeGuideBtn").addEventListener("click", () => {
    guideModal.classList.add("hidden");
  });
  document.getElementById("dismissGuideBtn").addEventListener("click", () => {
    guideModal.classList.add("hidden");
  });
  guideModal.addEventListener("click", (e) => {
    if (e.target.id === "iphoneGuideModal") guideModal.classList.add("hidden");
  });
}

// Render horizontal category navigation pills
function renderCategoryPills() {
  const container = document.getElementById("categoryContainer");
  container.innerHTML = CATEGORIES.map((cat) => {
    const isActive = cat.id === currentCategory;
    const activeClass = isActive
      ? "bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/25 border-blue-500"
      : "bg-poly-surface text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border-poly-border";

    const badge = cat.id === "watchlist" && favorites.size > 0
      ? `<span class="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-black font-extrabold">${favorites.size}</span>`
      : "";

    return `
      <button 
        onclick="setCategory('${cat.id}')"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap border transition-all active:scale-95 ${activeClass}"
      >
        <span>${cat.emoji}</span>
        <span>${cat.name}</span>
        ${badge}
      </button>
    `;
  }).join("");

  lucide.createIcons();
}

// Set active category
function setCategory(catId) {
  currentCategory = catId;
  renderCategoryPills();
  
  const cat = CATEGORIES.find(c => c.id === catId);
  document.getElementById("sectionTitle").innerHTML = `<span>${cat.emoji}</span> Mercados ${cat.name}`;
  
  loadMarkets();
}

// Regex patterns for client-side category classification (when running on Netlify/Cloud)
const CLIENT_CATEGORY_PATTERNS = {
  argentina: /\b(argentina\w*|milei|buenos aires|indec|peso argentino|cepo|kirchner\w*|peronis\w*|boca juniors?|river plate|scaloni|casa rosada|bullrich|caputo)\b/i,
  deportes: /\b(nfl|football|soccer|champions league|premier league|la liga|world cup|copa america|copa libertadores|nba|tennis|grand slam|formula 1|f1|super bowl|messi|ronaldo|panthers|broncos|49ers|cowboys|texans|eagles|rams|vs\.?|versus|fifa|uefa|touchdown|ufc)\b/i,
  cripto: /\b(bitcoin|btc|ethereum|eth|solana|sol|crypto\w*|etf|binance|coinbase|tether|stablecoin|halving|doge\w*|memecoin|cardano|ripple|xrp|blockchain)\b/i,
  "ia-tech": /\b(ai\b|artificial intelligence|openai|chatgpt|gpt-?5?|gpt-?4o?|claude|anthropic|gemini|deepseek|meta ai|nvidia|spacex|starship|apple|tesla|robot\w*|quantum\w*|agi\b|altman|tsmc|semiconductor\w*)\b/i,
  macro: /\b(fed\b|interest rate\w*|rate cut\w*|rate hike\w*|inflation|cpi\b|gdp\b|recession\w*|treasury\w*|s&p\s*500|nasdaq|dow jones|ipo\b|unemployment|central bank\w*|powell|oil price\w*|gold\b|tariffs?|debt ceiling)\b/i,
  politica: /\b(election\w*|president\w*|senate|congress\w*|parliament\w*|vote\w*|prime minister|cabinet|democrat\w*|republican\w*|trump|biden|starmer|macron|modi|labor|labour|impeach\w*|governor|supreme court|putin|zelensky|nato|ceasefire|war\b|sanction\w*)\b/i
};

function assignCategoryClient(rawEvent) {
  const title = rawEvent.title || "";
  const desc = rawEvent.description || "";
  const tags = (rawEvent.tags || []).map(t => (typeof t === "object" ? t.label : t)).join(" ");
  const fullText = `${title} ${desc} ${tags}`;

  if (CLIENT_CATEGORY_PATTERNS.argentina.test(fullText)) return "argentina";
  if (CLIENT_CATEGORY_PATTERNS.deportes.test(title)) return "deportes";
  
  for (const cat of ["ia-tech", "cripto", "macro", "politica", "deportes"]) {
    if (CLIENT_CATEGORY_PATTERNS[cat].test(fullText)) return cat;
  }
  return "general";
}

function normalizeRawGammaEvent(raw) {
  const markets = (raw.markets || []).map(m => {
    let outcomes = [];
    let prices = [];
    let tokens = [];

    try { outcomes = typeof m.outcomes === "string" ? JSON.parse(m.outcomes) : (m.outcomes || []); } catch(e) { outcomes = ["Sí", "No"]; }
    try { prices = typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : (m.outcomePrices || []); } catch(e) { prices = ["0.5", "0.5"]; }
    try { tokens = typeof m.clobTokenIds === "string" ? JSON.parse(m.clobTokenIds) : (m.clobTokenIds || []); } catch(e) { tokens = []; }

    const outcomeItems = outcomes.map((name, i) => {
      const priceVal = parseFloat(prices[i]) || 0;
      return {
        name: name,
        price: priceVal,
        probability: Math.round(priceVal * 1000) / 10,
        tokenId: tokens[i] || null
      };
    });

    return {
      id: m.id,
      question: m.question,
      conditionId: m.conditionId,
      slug: m.slug,
      description: m.description,
      volume: parseFloat(m.volume || 0),
      liquidity: parseFloat(m.liquidity || 0),
      outcomes: outcomeItems
    };
  });

  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    category: assignCategoryClient(raw),
    image: raw.image || raw.icon,
    volume24hr: parseFloat(raw.volume24hr || 0),
    volume: parseFloat(raw.volume || 0),
    liquidity: parseFloat(raw.liquidity || 0),
    markets: markets
  };
}

// Fetch markets from backend API (with automatic Netlify/direct fallback)
async function loadMarkets(silent = false) {
  const skeleton = document.getElementById("loadingSkeleton");
  const grid = document.getElementById("marketsGrid");
  const emptyState = document.getElementById("emptyState");

  if (!silent) {
    skeleton.classList.remove("hidden");
    grid.classList.add("hidden");
    emptyState.classList.add("hidden");
  }

  try {
    let events = [];
    
    // 1. Try local server first
    try {
      let localUrl = `/api/events?limit=80&sort_by=${sortBy}`;
      if (currentCategory !== "all" && currentCategory !== "trending" && currentCategory !== "watchlist") {
        localUrl += `&category=${currentCategory}`;
      }
      if (searchQuery) {
        localUrl += `&search=${encodeURIComponent(searchQuery)}`;
      }

      const res = await fetch(localUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.events && Array.isArray(data.events)) {
          events = data.events;
        }
      }
    } catch (e) {
      // Local server not available, will use Netlify proxy below
    }

    // 2. If no events from local server, use Netlify proxy or direct Gamma API
    if (events.length === 0) {
      const endpoints = [
        "/api/gamma/events?limit=80&active=true&closed=false&order=volume24hr&ascending=false",
        "https://gamma-api.polymarket.com/events?limit=80&active=true&closed=false&order=volume24hr&ascending=false"
      ];

      for (const endpoint of endpoints) {
        try {
          const resp = await fetch(endpoint);
          if (resp.ok) {
            const rawData = await resp.json();
            if (Array.isArray(rawData)) {
              events = rawData.map(normalizeRawGammaEvent).filter(e => e.markets && e.markets.length > 0);
              break;
            }
          }
        } catch (err) {
          // try next endpoint
        }
      }

      // Filter client-side
      if (currentCategory !== "all" && currentCategory !== "trending" && currentCategory !== "watchlist") {
        events = events.filter(e => e.category === currentCategory);
      }

      if (searchQuery) {
        const sq = searchQuery.toLowerCase();
        events = events.filter(e => {
          const title = (e.title || "").toLowerCase();
          const q = (e.markets && e.markets[0] ? e.markets[0].question : "").toLowerCase();
          return title.includes(sq) || q.includes(sq);
        });
      }
    }

    allLoadedEvents = events;

    // Filter by favorites if in watchlist view
    if (currentCategory === "watchlist") {
      allLoadedEvents = allLoadedEvents.filter(e => favorites.has(String(e.id)));
    }

    sortAndRenderEvents();

    const now = new Date();
    document.getElementById("lastUpdatedText").innerText = `Actualizado ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

  } catch (err) {
    console.error("Error loading markets:", err);
    if (!silent) {
      grid.classList.add("hidden");
      emptyState.classList.remove("hidden");
    }
  } finally {
    skeleton.classList.add("hidden");
  }
}

// Sort and render events in grid
function sortAndRenderEvents() {
  const grid = document.getElementById("marketsGrid");
  const emptyState = document.getElementById("emptyState");
  const countBadge = document.getElementById("marketCount");

  // Apply sorting
  const events = [...allLoadedEvents].sort((a, b) => {
    if (sortBy === "volume") return (b.volume || 0) - (a.volume || 0);
    if (sortBy === "liquidity") return (b.liquidity || 0) - (a.liquidity || 0);
    return (b.volume24hr || 0) - (a.volume24hr || 0);
  });

  countBadge.innerText = events.length;

  if (events.length === 0) {
    grid.classList.add("hidden");
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  grid.classList.remove("hidden");

  grid.innerHTML = events.map((event) => renderEventCard(event)).join("");
  lucide.createIcons();
}

// Render a single market card
function renderEventCard(event) {
  const isFav = favorites.has(String(event.id));
  const catStyle = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.general;

  // Format volume
  const vol24h = formatCurrency(event.volume24hr);
  const volTotal = formatCurrency(event.volume);

  // Take the primary market
  const primaryMarket = event.markets && event.markets.length > 0 ? event.markets[0] : null;
  const outcomes = primaryMarket ? primaryMarket.outcomes.slice(0, 3) : [];

  const outcomesHtml = outcomes.map((o) => {
    const isYes = o.name.toLowerCase() === "yes" || o.name.toLowerCase() === "sí";
    const isNo = o.name.toLowerCase() === "no";
    
    let barColor = "bg-blue-500";
    let textColor = "text-blue-400";
    if (isYes) {
      barColor = "bg-emerald-500";
      textColor = "text-emerald-400";
    } else if (isNo) {
      barColor = "bg-rose-500";
      textColor = "text-rose-400";
    }

    return `
      <div class="space-y-1">
        <div class="flex items-center justify-between text-xs">
          <span class="font-medium text-slate-300 truncate max-w-[65%]">${escapeHtml(o.name)}</span>
          <span class="font-mono font-bold ${textColor}">${o.probability}%</span>
        </div>
        <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
          <div class="h-full rounded-full ${barColor} transition-all duration-500" style="width: ${Math.min(o.probability, 100)}%"></div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="group bg-poly-card border border-poly-border hover:border-blue-500/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/5">
      
      <!-- Card Top: Category, 24h Vol & Favorite -->
      <div>
        <div class="flex items-center justify-between gap-2 mb-3">
          <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-bold tracking-wider uppercase border ${catStyle.bg} ${catStyle.text} ${catStyle.border}">
            ${event.category}
          </span>

          <div class="flex items-center gap-1.5">
            <span class="text-[11px] font-mono font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md">
              24h: ${vol24h}
            </span>
            <button 
              onclick="toggleFavorite(event, '${event.id}')" 
              title="Guardar en favoritos" 
              class="p-1 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition ${isFav ? 'text-amber-400' : ''}"
            >
              <i data-lucide="star" class="w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-400' : ''}"></i>
            </button>
          </div>
        </div>

        <!-- Title & Subquestion -->
        <h3 class="text-sm sm:text-base font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug">
          ${escapeHtml(event.title)}
        </h3>
        ${primaryMarket && primaryMarket.question !== event.title ? `
          <p class="text-xs text-slate-400 mt-1 line-clamp-1">${escapeHtml(primaryMarket.question)}</p>
        ` : ''}

        <!-- Outcomes Probability Bars -->
        <div class="mt-4 space-y-2.5">
          ${outcomesHtml}
        </div>
      </div>

      <!-- Card Footer -->
      <div class="mt-5 pt-3.5 border-t border-poly-border/60 flex items-center justify-between gap-2 text-xs">
        <span class="text-[11px] text-slate-500 font-mono">
          Total: ${volTotal}
        </span>
        <button 
          onclick="openModal('${event.id}')"
          class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 font-semibold transition active:scale-95"
        >
          <span>Ver Gráfico</span>
          <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
        </button>
      </div>

    </div>
  `;
}

// Toggle favorites in localStorage
function toggleFavorite(evt, eventId) {
  evt.stopPropagation();
  const idStr = String(eventId);
  if (favorites.has(idStr)) {
    favorites.delete(idStr);
  } else {
    favorites.add(idStr);
  }
  localStorage.setItem("poly_favorites", JSON.stringify(Array.from(favorites)));
  
  renderCategoryPills();
  sortAndRenderEvents();
}

// Reset filters button
function resetFilters() {
  document.getElementById("searchInput").value = "";
  searchQuery = "";
  document.getElementById("clearSearchBtn").classList.add("hidden");
  setCategory("trending");
}

// Open modal and display market details + chart
function openModal(eventId) {
  const event = allLoadedEvents.find(e => String(e.id) === String(eventId));
  if (!event) return;

  activeModalEvent = event;
  activeModalOutcomeIdx = 0;
  activeModalInterval = "all";

  const modal = document.getElementById("detailModal");
  document.getElementById("modalTitle").innerText = event.title;
  
  const primaryMarket = event.markets && event.markets.length > 0 ? event.markets[0] : null;
  document.getElementById("modalQuestion").innerText = primaryMarket ? primaryMarket.question : "";
  
  document.getElementById("modalVol24h").innerText = formatCurrency(event.volume24hr);
  document.getElementById("modalVolTotal").innerText = formatCurrency(event.volume);
  document.getElementById("modalLiquidity").innerText = formatCurrency(event.liquidity);
  
  document.getElementById("modalDescription").innerText = 
    (primaryMarket && primaryMarket.description) || "Resolución según las fuentes oficiales y consenso de mercado de Polymarket.";

  const badge = document.getElementById("modalCategoryBadge");
  badge.innerText = event.category.toUpperCase();
  const style = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.general;
  badge.className = `px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase border shrink-0 ${style.bg} ${style.text} ${style.border}`;

  renderModalOutcomesList();
  loadChartData();

  modal.classList.remove("hidden");
  lucide.createIcons();
}

function closeModal() {
  const modal = document.getElementById("detailModal");
  modal.classList.add("hidden");
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

// Render outcome selector pills inside modal
function renderModalOutcomesList() {
  const container = document.getElementById("modalOutcomesList");
  if (!activeModalEvent || !activeModalEvent.markets || activeModalEvent.markets.length === 0) {
    container.innerHTML = "";
    return;
  }

  // Aggregate all outcomes from the primary market
  const outcomes = activeModalEvent.markets[0].outcomes;

  container.innerHTML = outcomes.map((o, idx) => {
    const isSelected = idx === activeModalOutcomeIdx;
    const activeClass = isSelected
      ? "bg-blue-600 text-white font-bold border-blue-500 shadow-md shadow-blue-500/20"
      : "bg-poly-surface text-slate-300 hover:bg-slate-800 border-poly-border";

    return `
      <button 
        onclick="selectModalOutcome(${idx})"
        class="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition active:scale-95 ${activeClass}"
      >
        <span>${escapeHtml(o.name)}</span>
        <span class="font-mono ${isSelected ? 'text-white' : 'text-blue-400'} font-bold">${o.probability}%</span>
      </button>
    `;
  }).join("");
}

function selectModalOutcome(idx) {
  activeModalOutcomeIdx = idx;
  renderModalOutcomesList();
  loadChartData();
}

// Fetch historical price data and render Chart.js
async function loadChartData() {
  if (!activeModalEvent || !activeModalEvent.markets || activeModalEvent.markets.length === 0) return;

  const market = activeModalEvent.markets[0];
  const outcome = market.outcomes[activeModalOutcomeIdx];
  if (!outcome || !outcome.tokenId) {
    renderEmptyChart("No hay historial disponible para este activo.");
    return;
  }

  document.getElementById("chartActiveOutcomeBadge").innerText = `${outcome.name} (${outcome.probability}%)`;

  const chartLoading = document.getElementById("chartLoading");
  chartLoading.classList.remove("hidden");

  try {
    let points = [];

    // 1. Try local server
    try {
      const res = await fetch(`/api/history?token_id=${outcome.tokenId}&interval=${activeModalInterval}`);
      if (res.ok) {
        const data = await res.json();
        if (data.points) points = data.points;
      }
    } catch (e) {
      // Local server not available
    }

    // 2. If no points, try Netlify CLOB proxy or direct CLOB
    if (points.length === 0) {
      const fidelityMap = { "1d": 5, "1w": 60, "1m": 60, "all": 60 };
      const fidelity = fidelityMap[activeModalInterval] || 60;
      const clobUrls = [
        `/api/clob/prices-history?interval=${activeModalInterval}&fidelity=${fidelity}&market=${outcome.tokenId}`,
        `https://clob.polymarket.com/prices-history?interval=${activeModalInterval}&fidelity=${fidelity}&market=${outcome.tokenId}`
      ];

      for (const curl of clobUrls) {
        try {
          const resp = await fetch(curl);
          if (resp.ok) {
            const cdata = await resp.json();
            const rawHist = cdata.history || [];
            points = rawHist.map(pt => ({
              time: pt.t < 10000000000 ? pt.t * 1000 : pt.t,
              probability: Math.round(parseFloat(pt.p) * 10000) / 100,
              price: parseFloat(pt.p)
            }));
            if (points.length > 0) break;
          }
        } catch (err) {
          // try next
        }
      }
    }

    if (points.length === 0) {
      renderEmptyChart("Historial en construcción para este mercado reciente.");
      return;
    }

    renderChart(points, outcome.name);
  } catch (e) {
    console.error("Error loading chart data:", e);
    renderEmptyChart("Error al cargar la serie temporal.");
  } finally {
    chartLoading.classList.add("hidden");
  }
}

// Render Chart.js line chart
function renderChart(points, label) {
  const ctx = document.getElementById("priceHistoryChart").getContext("2d");

  if (chartInstance) {
    chartInstance.destroy();
  }

  const labels = points.map(p => {
    const d = new Date(p.time);
    if (activeModalInterval === "1d") {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
  });

  const values = points.map(p => p.probability);

  // Gradient background fill
  const gradient = ctx.createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, "rgba(59, 130, 246, 0.35)");
  gradient.addColorStop(1, "rgba(59, 130, 246, 0.0)");

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: `Probabilidad ${label}`,
        data: values,
        borderColor: "#3b82f6",
        borderWidth: 2.5,
        backgroundColor: gradient,
        fill: true,
        tension: 0.25,
        pointRadius: values.length > 50 ? 0 : 2,
        pointHoverRadius: 5,
        pointBackgroundColor: "#60a5fa"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0f172a",
          titleColor: "#94a3b8",
          bodyColor: "#38bdf8",
          borderColor: "#1e293b",
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (ctx) => `Probabilidad: ${ctx.parsed.y.toFixed(1)}%`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#64748b",
            font: { size: 10 },
            maxTicksLimit: 6
          }
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: {
            color: "#64748b",
            font: { size: 10 },
            callback: (v) => `${v}%`
          }
        }
      }
    }
  });
}

function renderEmptyChart(msg) {
  const ctx = document.getElementById("priceHistoryChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  ctx.clearRect(0, 0, 600, 300);
  ctx.fillStyle = "#64748b";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(msg, 300, 120);
}

// Utility formatting helpers
function formatCurrency(val) {
  const num = parseFloat(val) || 0;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

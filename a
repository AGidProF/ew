const express = require("express");
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const app = express();
const PORT = 7860;

// Set EJS sebagai template engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Global variables untuk tracking
let serverStats = {
  startTime: Date.now(),
  totalRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  errors: 0,
  requestHistory: [],
  browserRestarts: 0,
  lastError: null,
  averageResponseTime: 0,
  totalResponseTime: 0,
  croxyProxyRequests: 0,
  croxyProxyErrors: 0
};

// Folder cache persisten
const CACHE_DIR = path.join("/data", "cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// TTL cache dalam ms (30 menit)
const CACHE_TTL = 30 * 60 * 1000;

// In-memory cache untuk kecepatan instant
const memoryCache = new Map();

// Browser instance yang persistent
let browserInstance = null;
let browserContext = null;

// Helper functions
function getCacheKey(url) {
  return crypto.createHash('md5').update(url).digest('hex');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function getSystemInfo() {
  const memUsage = process.memoryUsage();
  return {
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    cpuCount: os.cpus().length,
    totalMemory: formatBytes(os.totalmem()),
    freeMemory: formatBytes(os.freemem()),
    processMemory: {
      rss: formatBytes(memUsage.rss),
      heapUsed: formatBytes(memUsage.heapUsed),
      heapTotal: formatBytes(memUsage.heapTotal),
      external: formatBytes(memUsage.external)
    },
    uptime: formatDuration(os.uptime() * 1000),
    loadAverage: os.loadavg().map(avg => avg.toFixed(2))
  };
}

function getCacheStats() {
  const fileStats = fs.existsSync(CACHE_DIR) ? fs.readdirSync(CACHE_DIR) : [];
  let totalFileSize = 0;
  let oldestCache = null;
  let newestCache = null;
  
  fileStats.forEach(file => {
    try {
      const filePath = path.join(CACHE_DIR, file);
      const stats = fs.statSync(filePath);
      totalFileSize += stats.size;
      
      if (!oldestCache || stats.mtime < oldestCache) oldestCache = stats.mtime;
      if (!newestCache || stats.mtime > newestCache) newestCache = stats.mtime;
    } catch (error) {
      // Skip corrupted files
    }
  });

  return {
    memoryEntries: memoryCache.size,
    fileEntries: fileStats.length,
    totalFileSize: formatBytes(totalFileSize),
    cacheTTL: CACHE_TTL / 1000 / 60 + " minutes",
    oldestCache: oldestCache ? new Date(oldestCache).toLocaleString() : "N/A",
    newestCache: newestCache ? new Date(newestCache).toLocaleString() : "N/A"
  };
}

// Initialize browser
async function initBrowser() {
  try {
    if (browserInstance && browserInstance.isConnected()) {
      return; // Browser sudah running
    }
    
    browserInstance = await chromium.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });
    
    browserContext = await browserInstance.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    serverStats.browserRestarts++;
    console.log("✅ Browser initialized successfully");
  } catch (error) {
    serverStats.lastError = error.message;
    console.error("❌ Failed to initialize browser:", error);
    throw error;
  }
}

// Load cache dari file ke memory
function loadFileCache() {
  try {
    const files = fs.readdirSync(CACHE_DIR);
    let loadedCount = 0;
    
    files.forEach(file => {
      try {
        const filePath = path.join(CACHE_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (Date.now() - data.timestamp < CACHE_TTL) {
          memoryCache.set(file, data);
          loadedCount++;
        } else {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error(`Failed to load cache file ${file}:`, error);
      }
    });
    
    console.log(`📦 Loaded ${loadedCount} cache entries to memory`);
  } catch (error) {
    console.error("Failed to load file cache:", error);
  }
}

// Save cache
function saveCache(cacheKey, data) {
  const cacheData = { ...data, timestamp: Date.now() };
  memoryCache.set(cacheKey, cacheData);
  
  setImmediate(() => {
    try {
      fs.writeFileSync(
        path.join(CACHE_DIR, cacheKey), 
        JSON.stringify(cacheData, null, 2)
      );
    } catch (error) {
      console.error("Failed to save cache to file:", error);
    }
  });
}

// Get cache
function getCache(cacheKey) {
  const cached = memoryCache.get(cacheKey);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    memoryCache.delete(cacheKey);
    setImmediate(() => {
      try {
        const filePath = path.join(CACHE_DIR, cacheKey);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (error) {
        console.error("Failed to delete expired cache file:", error);
      }
    });
    return null;
  }
  
  return cached;
}

// IMPROVED: CroxyProxy scraping function - FIXED VERSION
async function scrapeViaCroxyProxy(targetUrl) {
  console.log(`🔄 [CROXYPROXY] Starting scrape for: ${targetUrl}`);
  
  const page = await browserContext.newPage();
  
  try {
    await page.goto("https://www.croxyproxy.com/", { 
      waitUntil: "domcontentloaded",
      timeout: 15000 
    });
    await page.waitForSelector('input#url', { timeout: 10000 });
    await page.fill('input#url', targetUrl);
    
    // Monitor network requests untuk menangkap response target
    let targetContent = null;
    let proxyUrl = null;
    let bestMatch = null;
    
    // Setup response handler sebelum klik submit
    page.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      // Filter hanya HTML response yang mengandung __cpo= parameter
      if (url.includes('__cpo=') && 
          response.status() === 200 && 
          contentType.includes('text/html')) {
        
        // Skip file assets saja, jangan skip URL utama
        const urlPath = url.toLowerCase();
        if (urlPath.includes('.js') || 
            urlPath.includes('.css') || 
            urlPath.includes('.png') || 
            urlPath.includes('.jpg') || 
            urlPath.includes('.jpeg') || 
            urlPath.includes('.gif') || 
            urlPath.includes('.ico') || 
            urlPath.includes('.svg') || 
            urlPath.includes('.woff') || 
            urlPath.includes('.ttf') || 
            urlPath.includes('__cpa.cp.js') ||
            urlPath.includes('favicon')) {
          return; // Skip file assets
        }
        
        try {
          const responseText = await response.text();
          
          // Validasi lebih fleksibel - prioritaskan content yang lebih besar dan memiliki struktur HTML
          if (responseText.length > 1000 && // Minimal 1KB (lebih fleksibel)
              responseText.includes('<html') && // Harus ada tag HTML
              responseText.includes('<body') && // Harus ada tag BODY
              !responseText.includes('Proxy is launching') && // Bukan loading page
              !responseText.includes('Please wait while') && // Bukan loading intermediate
              !responseText.includes('Redirecting...')) { // Bukan redirect page
            
            // Hitung skor kualitas content
            let score = responseText.length; // Base score dari ukuran
            
            // Bonus jika mengandung content yang relevan
            if (responseText.includes('<title>')) score += 5000;
            if (responseText.includes('<meta')) score += 3000;
            if (responseText.includes('<script')) score += 2000;
            if (responseText.includes('<link')) score += 1000;
            
            // Penalty jika mengandung indikator CroxyProxy
            if (responseText.includes('croxyproxy.com')) score -= 10000;
            if (responseText.includes('Enter the address')) score -= 15000;
            if (responseText.includes('__cpi.php')) score -= 8000;
            if (responseText.includes('__cpa.cp.js')) score -= 5000;
            
            // Simpan jika ini content terbaik sejauh ini
            if (!bestMatch || score > bestMatch.score) {
              bestMatch = {
                content: responseText,
                url: url,
                score: score
              };
              console.log(`🏆 [CROXYPROXY] Dataset Found: ${url} (score: ${score})`);
            }
            
          } else {
            return;
          }
        } catch (error) {
            return
        }
      } else if (url.includes('__cpo=')) {
        return
      }
    });
    
    // Klik tombol Go!
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
      page.click('button#requestSubmit')
    ]);
    
    // Tunggu sebentar untuk memastikan semua content ter-load
    await page.waitForTimeout(8000); // Tambah waktu tunggu
    
    // Gunakan best match jika ada
    if (bestMatch && bestMatch.score > 0) {
      targetContent = bestMatch.content;
      proxyUrl = bestMatch.url;
    }
    
    // Jika belum mendapat content dari response listener, ambil dari current page
    if (!targetContent) {
      // Double check apakah halaman sudah final
      const currentUrl = page.url();
      const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '').catch(() => '');
      if (!currentUrl.includes('__cpo=')) {
        throw new Error("Tidak berhasil mencapai target site melalui CroxyProxy");
      }
      
      if (bodyText.includes('Proxy is launching') || 
          bodyText.includes('Loading...') ||
          bodyText.includes('Please wait') ||
          bodyText.includes('Enter the address')) {
        throw new Error("Masih stuck di halaman loading CroxyProxy");
      }
      
      targetContent = await page.content();
      proxyUrl = currentUrl;
    }
    
    // Validasi content
    if (!targetContent || targetContent.length < 500) {
      throw new Error(`Content terlalu kecil atau tidak ditemukan (${targetContent ? targetContent.length : 0} bytes)`);
    }
    
    // Cek apakah content masih menunjukkan halaman error/loading CroxyProxy
    if (targetContent.includes("Proxy is launching") || 
        targetContent.includes("Enter the address") ||
        (targetContent.includes("croxyproxy.com") && !targetContent.includes('<title>') && targetContent.length < 10000)) {
      throw new Error("Masih menampilkan halaman CroxyProxy, bukan target site");
    }
    
    // FIXED: Clean content dari elemen CroxyProxy
    let cleanedContent = targetContent;
    
    // Hapus script CroxyProxy
    cleanedContent = cleanedContent.replace(/<script[^>]*__cpa\.cp\.js[^>]*><\/script>/gi, '');
    cleanedContent = cleanedContent.replace(/<script[^>]*croxyproxy[^>]*>.*?<\/script>/gis, '');
    
    // Hapus meta tags CroxyProxy
    cleanedContent = cleanedContent.replace(/<meta[^>]*croxyproxy[^>]*>/gi, '');
    
    // Fix relative URLs - ganti dengan proxy URLs
    if (proxyUrl) {
      try {
        const proxyBase = proxyUrl.split('?')[0];
        const encodedUrl = Buffer.from(targetUrl).toString('base64');
        cleanedContent = cleanedContent.replace(/href=["']\/([^"']*)/g, `href="${proxyBase}/$1?__cpo=${encodedUrl}"`);
        cleanedContent = cleanedContent.replace(/src=["']\/([^"']*)/g, `src="${proxyBase}/$1?__cpo=${encodedUrl}"`);
      } catch (error) {
        console.log(`⚠️ [CROXYPROXY] Failed to fix relative URLs: ${error.message}`);
      }
    }
    
    console.log(`✅ [CROXYPROXY] Successfully scraped via CroxyProxy`);
    console.log(`🔗 [CROXYPROXY] Proxy URL: ${proxyUrl}`);
    
    return { 
      html: cleanedContent, // Return cleaned HTML!
      url: proxyUrl || page.url(),
      originalUrl: targetUrl 
    };
    
  } catch (error) {
    console.error(`❌ [CROXYPROXY] Error:`, error.message);
    serverStats.croxyProxyErrors++;
    throw error;
  } finally {
    await page.close().catch(() => {});
  }
}

// DASHBOARD ROUTE - Server-side rendering
app.get("/", (req, res) => {
  const systemInfo = getSystemInfo();
  const cacheStats = getCacheStats();
  
  const uptime = Date.now() - serverStats.startTime;
  const avgResponseTime = serverStats.totalRequests > 0 
    ? (serverStats.totalResponseTime / serverStats.totalRequests).toFixed(2)
    : 0;
  
  const hitRate = serverStats.totalRequests > 0 
    ? ((serverStats.cacheHits / serverStats.totalRequests) * 100).toFixed(1)
    : 0;

  const recentRequests = serverStats.requestHistory.slice(-10).reverse();
  
  const cacheEntries = Array.from(memoryCache.entries()).map(([key, data]) => ({
    key: key.substring(0, 8) + '...',
    url: data.originalUrl || data.url || 'Unknown',
    size: formatBytes(JSON.stringify(data.html).length),
    created: new Date(data.timestamp).toLocaleString(),
    age: formatDuration(Date.now() - data.timestamp)
  })).slice(0, 20);

  res.render("dashboard", {
    title: "CroxyProxy Scraper Dashboard",
    serverStats: {
      ...serverStats,
      uptime: formatDuration(uptime),
      averageResponseTime: avgResponseTime,
      hitRate: hitRate,
      errorRate: serverStats.totalRequests > 0 
        ? ((serverStats.errors / serverStats.totalRequests) * 100).toFixed(1)
        : 0,
      croxyProxySuccessRate: serverStats.croxyProxyRequests > 0
        ? (((serverStats.croxyProxyRequests - serverStats.croxyProxyErrors) / serverStats.croxyProxyRequests) * 100).toFixed(1)
        : 0
    },
    systemInfo,
    cacheStats,
    recentRequests,
    cacheEntries,
    browserStatus: browserInstance?.isConnected() ? 'Connected' : 'Disconnected',
    currentTime: new Date().toLocaleString(),
    query: req.query
  });
});

// Test URL form handler
app.post("/test", async (req, res) => {
  const { testUrl } = req.body;
  
  if (!testUrl) {
    return res.redirect("/?error=URL is required");
  }
  
  try {
    const startTime = Date.now();
    const cacheKey = getCacheKey(testUrl);
    const cached = getCache(cacheKey);
    
    let result = {
      url: testUrl,
      cached: !!cached,
      responseTime: 0,
      success: false,
      contentLength: 0,
      error: null,
      method: 'CroxyProxy'
    };
    
    if (cached) {
      result.success = true;
      result.responseTime = Date.now() - startTime;
      result.contentLength = cached.html.length;
      serverStats.cacheHits++;
    } else {
      if (!browserInstance || !browserInstance.isConnected()) {
        await initBrowser();
      }

      try {
        serverStats.croxyProxyRequests++;
        const scrapeResult = await scrapeViaCroxyProxy(testUrl);
        
        result.success = true;
        result.responseTime = Date.now() - startTime;
        result.contentLength = scrapeResult.html.length;
        
        saveCache(cacheKey, scrapeResult);
        serverStats.cacheMisses++;
        
      } catch (error) {
        result.error = error.message;
        serverStats.errors++;
      }
    }
    
    serverStats.totalRequests++;
    serverStats.totalResponseTime += result.responseTime;
    serverStats.requestHistory.push({
      ...result,
      timestamp: new Date().toLocaleString()
    });
    
    const queryParams = new URLSearchParams({
      testResult: JSON.stringify(result)
    });
    
    res.redirect(`/?${queryParams.toString()}`);
    
  } catch (error) {
    serverStats.errors++;
    serverStats.lastError = error.message;
    res.redirect(`/?error=${encodeURIComponent(error.message)}`);
  }
});

// Clear cache handler
app.post("/clear-cache", (req, res) => {
  memoryCache.clear();
  
  setImmediate(() => {
    try {
      const files = fs.readdirSync(CACHE_DIR);
      files.forEach(file => fs.unlinkSync(path.join(CACHE_DIR, file)));
    } catch (error) {
      console.error("Failed to clear file cache:", error);
    }
  });
  
  res.redirect("/?success=Cache cleared successfully");
});

// Restart browser handler
app.post("/restart-browser", async (req, res) => {
  try {
    if (browserContext) await browserContext.close();
    if (browserInstance) await browserInstance.close();
    
    await initBrowser();
    res.redirect("/?success=Browser restarted successfully");
  } catch (error) {
    serverStats.lastError = error.message;
    res.redirect(`/?error=${encodeURIComponent(error.message)}`);
  }
});

// MAIN PROXY ENDPOINT - Updated untuk menggunakan CroxyProxy tanpa redirect
app.get("/proxy", async (req, res) => {
  const startTime = Date.now();
  const targetUrl = req.query.url;
  const noCache = req.query.nocache === 'true';
  
  serverStats.totalRequests++;
  
  if (!targetUrl) {
    serverStats.errors++;
    return res.status(400).json({ error: "Missing ?url= parameter" });
  }

  const cacheKey = getCacheKey(targetUrl);
  const cached = noCache ? null : getCache(cacheKey);
  
  if (cached && !noCache) {
    console.log(`⚡ [CACHE HIT] ${targetUrl}`);
    serverStats.cacheHits++;
    const responseTime = Date.now() - startTime;
    serverStats.totalResponseTime += responseTime;
    
    serverStats.requestHistory.push({
      url: targetUrl,
      cached: true,
      responseTime,
      success: true,
      contentLength: cached.html.length,
      timestamp: new Date().toLocaleString(),
      method: 'Cache'
    });
    
    res.set('X-Cache', 'HIT');
    res.set('X-Method', 'Cache');
    res.set('X-Original-URL', targetUrl);
    return res.send(cached.html);
  }

  if (noCache) {
    console.log(`🚫 [NO CACHE] Bypassing cache: ${targetUrl}`);
  } else {
    console.log(`🔄 [CACHE MISS] Fetching via CroxyProxy: ${targetUrl}`);
  }
  
  serverStats.cacheMisses++;
  
  if (!browserInstance || !browserInstance.isConnected()) {
    await initBrowser();
  }
  
  try {
    serverStats.croxyProxyRequests++;
    const scrapeResult = await scrapeViaCroxyProxy(targetUrl);
    const responseTime = Date.now() - startTime;

    if (!noCache) {
      saveCache(cacheKey, scrapeResult);
    }
    
    serverStats.totalResponseTime += responseTime;

    serverStats.requestHistory.push({
      url: targetUrl,
      cached: false,
      responseTime,
      success: true,
      contentLength: scrapeResult.html.length,
      timestamp: new Date().toLocaleString(),
      method: 'CroxyProxy'
    });

    if (noCache) {
      console.log(`🚫 [NO CACHE] ${targetUrl} (${responseTime}ms) - CroxyProxy direct content`);
      res.set('X-Cache', 'BYPASS');
    } else {
      console.log(`💾 [CACHED] ${targetUrl} (${responseTime}ms) - CroxyProxy direct content`);
      res.set('X-Cache', 'MISS');
    }
    
    res.set('X-Method', 'CroxyProxy');
    res.set('X-Original-URL', targetUrl);
    res.set('X-Proxy-URL', scrapeResult.url);
    res.send(scrapeResult.html);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    serverStats.errors++;
    serverStats.lastError = error.message;
    serverStats.totalResponseTime += responseTime;
    
    serverStats.requestHistory.push({
      url: targetUrl,
      cached: false,
      responseTime,
      success: false,
      error: error.message,
      timestamp: new Date().toLocaleString(),
      method: 'CroxyProxy'
    });

    console.error(`❌ [ERROR] ${targetUrl}: ${error.message}`);
    res.status(500).json({ 
      error: "Failed to fetch via CroxyProxy", 
      message: error.message,
      url: targetUrl 
    });
  }
});

// API endpoint untuk refresh dashboard data
app.get("/api/stats", (req, res) => {
  const systemInfo = getSystemInfo();
  const cacheStats = getCacheStats();
  const uptime = Date.now() - serverStats.startTime;
  
  res.json({
    serverStats: {
      ...serverStats,
      uptime: formatDuration(uptime),
      averageResponseTime: serverStats.totalRequests > 0 
        ? (serverStats.totalResponseTime / serverStats.totalRequests).toFixed(2)
        : 0,
      hitRate: serverStats.totalRequests > 0 
        ? ((serverStats.cacheHits / serverStats.totalRequests) * 100).toFixed(1)
        : 0,
      errorRate: serverStats.totalRequests > 0 
        ? ((serverStats.errors / serverStats.totalRequests) * 100).toFixed(1)
        : 0,
      croxyProxySuccessRate: serverStats.croxyProxyRequests > 0
        ? (((serverStats.croxyProxyRequests - serverStats.croxyProxyErrors) / serverStats.croxyProxyRequests) * 100).toFixed(1)
        : 0
    },
    systemInfo,
    cacheStats,
    browserStatus: browserInstance?.isConnected() ? 'Connected' : 'Disconnected',
    currentTime: new Date().toLocaleString(),
    recentRequests: serverStats.requestHistory.slice(-10).reverse()
  });
});

// Cleanup expired cache
setInterval(() => {
  const now = Date.now();
  let deletedCount = 0;
  
  for (const [key, data] of memoryCache.entries()) {
    if (now - data.timestamp > CACHE_TTL) {
      memoryCache.delete(key);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`🧹 Cleaned up ${deletedCount} expired cache entries`);
  }
}, 5 * 60 * 1000);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  if (browserContext) await browserContext.close();
  if (browserInstance) await browserInstance.close();
  
  process.exit(0);
});

// Start server
async function startServer() {
  await initBrowser();
  loadFileCache();
  
  app.listen(PORT, () => {
    console.log(`🚀 CroxyProxy Scraper Dashboard running on http://localhost:${PORT}`);
    console.log(`📊 Loaded ${memoryCache.size} cache entries`);
    console.log(`🎯 Dashboard: http://localhost:${PORT}`);
    console.log(`🔧 Proxy API: http://localhost:${PORT}/proxy?url=WEBSITE_URL`);
    console.log(`🚫 No Cache: http://localhost:${PORT}/proxy?url=WEBSITE_URL&nocache=true`);
    console.log(`🌐 Method: CroxyProxy Integration (Direct Content)`);
  });
}

startServer().catch(console.error);

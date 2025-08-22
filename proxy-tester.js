// proxy-tester.js - Fixed Version (Error 400 Resolved)
const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");
const fs = require("fs").promises;

// Proxy sources - Updated working URLs
const proxySources = [
  "https://api.proxyscrape.com/v2/?request=get&protocol=http&timeout=10000&format=textplain",
  "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
  "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt",
  "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt",
  "https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt",
  "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
  "https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies.txt"
];

// Test URLs yang lebih reliable
const testUrls = [
  "http://httpbin.org/ip",
  "https://api.ipify.org?format=json",
  "https://icanhazip.com"
];

class GitHubProxyTester {
  constructor() {
    this.allProxies = new Set();
    this.workingProxies = [];
    this.deadProxies = [];
    this.workingProxiesFile = 'hasil.txt';
    this.workingLogFile = 'working_proxies.log';
    this.deadLogFile = 'dead_proxies.log';
    this.liveLogFile = 'live_testing.log';
    this.stats = {
      totalFetched: 0,
      totalTested: 0,
      totalWorking: 0,
      totalDead: 0,
      startTime: new Date(),
      endTime: null,
      errors: [],
      sources: {}
    };
  }

  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  async initializeResultFiles() {
    try {
      await fs.writeFile(this.workingProxiesFile, '# Working Proxies - Real-time Updates\n# Format: proxy (response_time ms)\n\n');
      await fs.writeFile(this.workingLogFile, '# Working Proxies Log - Started at ' + new Date().toISOString() + '\n');
      await fs.writeFile(this.deadLogFile, '# Dead Proxies Log - Started at ' + new Date().toISOString() + '\n');
      await fs.writeFile(this.liveLogFile, '# REAL-TIME LOG - Every Proxy Test\n# Started at ' + new Date().toISOString() + '\n\n');
      this.log("📄 Initialized all result files");
    } catch (error) {
      this.log(`❌ Error initializing files: ${error.message}`);
    }
  }

  async logEveryProxyTest(proxyData) {
    try {
      const status = proxyData.success ? '✅ WORKING' : '❌ DEAD';
      const emoji = proxyData.success ? '🟢' : '🔴';
      
      const liveLogLine = `[${new Date().toISOString()}] ${emoji} ${status}: ${proxyData.proxy} | ${proxyData.responseTime}ms | via ${proxyData.testUrl || 'N/A'}${proxyData.error ? ' | error: ' + proxyData.error : ''}\n`;
      
      await fs.appendFile(this.liveLogFile, liveLogLine);
      
      const consoleMsg = proxyData.success 
        ? `🟢 WORKING: ${proxyData.proxy} (${proxyData.responseTime}ms)`
        : `🔴 DEAD: ${proxyData.proxy} (${proxyData.responseTime}ms) - ${proxyData.error || 'timeout'}`;
      
      this.log(consoleMsg);
      
    } catch (error) {
      // Silent fail to not interrupt main flow
    }
  }

  async appendWorkingProxy(proxyData) {
    try {
      const line = `${proxyData.proxy}\n`;
      await fs.appendFile(this.workingProxiesFile, line);
      
      const logLine = `[${new Date().toISOString()}] ✅ WORKING: ${proxyData.proxy} | ${proxyData.responseTime}ms | via ${proxyData.testUrl} | speed: ${this.getSpeedCategory(proxyData.responseTime)}\n`;
      await fs.appendFile(this.workingLogFile, logLine);
      
    } catch (error) {
      this.log(`❌ Error saving working proxy: ${error.message}`);
    }
  }

  async appendDeadProxy(proxyData) {
    try {
      const logLine = `[${new Date().toISOString()}] ❌ DEAD: ${proxyData.proxy} | ${proxyData.responseTime}ms | error: ${proxyData.error || 'timeout'} | test_url: ${proxyData.testUrl || 'N/A'}\n`;
      await fs.appendFile(this.deadLogFile, logLine);
    } catch (error) {
      // Silent fail
    }
  }

  getSpeedCategory(responseTime) {
    if (responseTime < 1000) return 'FAST';
    if (responseTime < 3000) return 'MEDIUM';
    if (responseTime < 5000) return 'SLOW';
    return 'VERY_SLOW';
  }

  async fetchProxies() {
    this.log("🔄 Fetching proxies from all sources...");
    
    const fetchPromises = proxySources.map(async (url, index) => {
      try {
        this.log(`📡 Fetching from source ${index + 1}/${proxySources.length}: ${url.split('/')[2]}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        // Fixed axios configuration for 400 error prevention
        const res = await axios.get(url, {
          timeout: 30000,
          maxRedirects: 5,
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/plain, text/html, application/json, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          validateStatus: function (status) {
            return status >= 200 && status < 400; // Accept redirects
          }
        });
        
        clearTimeout(timeoutId);
        
        let proxies = [];
        const sourceName = url.split('/')[2];
        
        // Enhanced parsing for different formats
        if (typeof res.data === 'string') {
          proxies = res.data
            .split(/[\r\n]+/)
            .map(line => {
              // Clean the line
              let cleaned = line.trim();
              
              // Remove protocol prefix if present
              cleaned = cleaned.replace(/^https?:\/\//, "");
              
              // Remove any extra characters or comments
              cleaned = cleaned.split(/[\s#]/)[0];
              
              return cleaned;
            })
            .filter(line => {
              // Validate IP:PORT format
              return line && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/.test(line);
            });
        }
        
        // Add unique proxies
        let newCount = 0;
        proxies.forEach(proxy => {
          if (!this.allProxies.has(proxy)) {
            this.allProxies.add(proxy);
            newCount++;
          }
        });
        
        this.stats.sources[sourceName] = {
          total: proxies.length,
          new: newCount,
          status: 'success'
        };
        
        this.log(`✅ Source ${index + 1}: ${proxies.length} proxies (${newCount} new)`);
        return newCount;
        
      } catch (error) {
        const sourceName = url.split('/')[2];
        this.stats.sources[sourceName] = {
          total: 0,
          new: 0,
          status: 'failed',
          error: error.message.substring(0, 100)
        };
        
        this.stats.errors.push(`Source ${index + 1} (${sourceName}): ${error.message}`);
        this.log(`❌ Source ${index + 1} failed: ${error.message.substring(0, 100)}`);
        return 0;
      }
    });
    
    try {
      const results = await Promise.allSettled(fetchPromises);
      const totalNew = results.reduce((sum, result) => {
        return sum + (result.status === 'fulfilled' ? result.value : 0);
      }, 0);
      
      this.stats.totalFetched = this.allProxies.size;
      this.log(`📊 Fetch complete: ${this.allProxies.size} total proxies (${totalNew} new)`);
      
    } catch (error) {
      this.stats.errors.push(`Fetch error: ${error.message}`);
      this.log(`❌ Fetch error: ${error.message}`);
    }
  }

  async testProxy(proxy, testUrlIndex = 0) {
    const startTime = Date.now();
    const maxRetries = testUrls.length;
    
    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        const testUrl = testUrls[(testUrlIndex + retry) % testUrls.length];
        
        // Create proxy agent with proper configuration
        const agent = new HttpsProxyAgent(`http://${proxy}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        // Enhanced request configuration to prevent 400 errors
        const axiosConfig = {
          timeout: 10000,
          signal: controller.signal,
          validateStatus: status => status === 200,
          maxRedirects: 3,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'DNT': '1',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site'
          }
        };
        
        // Set proxy agents
        if (testUrl.startsWith('https://')) {
          axiosConfig.httpsAgent = agent;
        } else {
          axiosConfig.httpAgent = agent;
        }
        
        const response = await axios.get(testUrl, axiosConfig);
        
        clearTimeout(timeoutId);
        
        if (response.data && response.status === 200) {
          const responseTime = Date.now() - startTime;
          
          // Verify response contains valid data
          const responseText = typeof response.data === 'string' 
            ? response.data 
            : JSON.stringify(response.data);
            
          // Check if response is valid (contains IP or expected data)
          const hasValidData = responseText.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/) || 
                              responseText.includes('origin') ||
                              responseText.length > 5;
            
          if (hasValidData) {
            return { 
              proxy, 
              success: true, 
              responseTime, 
              testUrl: new URL(testUrl).hostname,
              attempt: retry + 1,
              responseSize: responseText.length
            };
          }
        }
      } catch (error) {
        // Log specific error types for debugging
        const errorType = error.code || error.response?.status || 'UNKNOWN';
        
        if (retry === maxRetries - 1) {
          return { 
            proxy, 
            success: false, 
            responseTime: Date.now() - startTime,
            error: `${errorType}: ${error.message.substring(0, 50)}`,
            attempts: retry + 1,
            testUrl: testUrls[(testUrlIndex + retry) % testUrls.length].split('/')[2]
          };
        }
        
        // Continue to next URL if not last retry
      }
    }
    
    return { 
      proxy, 
      success: false, 
      responseTime: Date.now() - startTime,
      attempts: maxRetries,
      error: 'All test URLs failed',
      testUrl: 'multiple'
    };
  }

  async testAllProxies() {
    const proxiesToTest = Array.from(this.allProxies);
    
    if (proxiesToTest.length === 0) {
      this.log("❌ No proxies to test!");
      return;
    }
    
    await this.initializeResultFiles();
    
    this.log(`🧪 Starting to test ${proxiesToTest.length} proxies...`);
    this.log(`🔥 REAL-TIME MODE: Every proxy will be logged immediately!`);
    this.log(`📄 Results file: ${this.workingProxiesFile}`);
    
    // Reduced concurrency to prevent overwhelming the system
    const batchSize = 30; // Smaller batches
    const concurrency = 10; // Lower concurrency
    
    let totalTested = 0;
    let workingCount = 0;
    
    for (let i = 0; i < proxiesToTest.length; i += batchSize) {
      const batch = proxiesToTest.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(proxiesToTest.length / batchSize);
      
      this.log(`🔄 Testing batch ${batchNumber}/${totalBatches} (${batch.length} proxies)`);
      
      const batchPromises = [];
      
      for (let j = 0; j < batch.length; j += concurrency) {
        const concurrent = batch.slice(j, j + concurrency);
        
        const concurrentPromises = concurrent.map((proxy, idx) => 
          this.testProxy(proxy, (i + j + idx) % testUrls.length)
        );
        
        batchPromises.push(Promise.allSettled(concurrentPromises));
      }
      
      const batchResults = await Promise.all(batchPromises);
      
      let batchWorking = 0;
      for (const concurrentResults of batchResults) {
        for (const result of concurrentResults) {
          if (result.status === 'fulfilled') {
            const testResult = result.value;
            totalTested++;
            
            if (testResult.success) {
              const workingProxy = {
                proxy: testResult.proxy,
                responseTime: testResult.responseTime,
                testUrl: testResult.testUrl,
                testedAt: new Date().toISOString(),
                attempt: testResult.attempt,
                responseSize: testResult.responseSize
              };
              
              this.workingProxies.push(workingProxy);
              
              await this.logEveryProxyTest(workingProxy);
              await this.appendWorkingProxy(workingProxy);
              batchWorking++;
              workingCount++;
              
            } else {
              const deadProxy = {
                proxy: testResult.proxy,
                responseTime: testResult.responseTime,
                error: testResult.error,
                attempts: testResult.attempts,
                testUrl: testResult.testUrl,
                testedAt: new Date().toISOString()
              };
              
              this.deadProxies.push(deadProxy);
              await this.logEveryProxyTest(deadProxy);
              await this.appendDeadProxy(deadProxy);
            }
          }
        }
      }
      
      const progress = ((totalTested / proxiesToTest.length) * 100).toFixed(1);
      
      const batchSummary = `📊 BATCH ${batchNumber}/${totalBatches} | Working: ${batchWorking}/${batch.length} | Progress: ${progress}% | Total Working: ${workingCount}`;
      this.log(batchSummary);
      
      await fs.appendFile(this.liveLogFile, `\n[${new Date().toISOString()}] ${batchSummary}\n\n`);
      
      // Delay between batches to prevent rate limiting
      if (i + batchSize < proxiesToTest.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    this.stats.totalTested = totalTested;
    this.stats.totalWorking = this.workingProxies.length;
    this.stats.totalDead = this.deadProxies.length;
    
    this.log(`🎯 Testing complete!`);
    this.log(`📊 Results: ${this.workingProxies.length} working, ${this.deadProxies.length} dead out of ${totalTested} tested`);
    
    await fs.appendFile(this.liveLogFile, `\n# TESTING COMPLETED at ${new Date().toISOString()}\n# RESULTS: ${this.workingProxies.length} working, ${this.deadProxies.length} dead\n`);
  }

  async saveResults() {
    try {
      this.stats.endTime = new Date();
      const duration = Math.round((this.stats.endTime - this.stats.startTime) / 1000);
      
      // Sort working proxies by response time
      this.workingProxies.sort((a, b) => a.responseTime - b.responseTime);
      
      const finalHeader = `# Working Proxies - Final Results
# Total Working: ${this.workingProxies.length}
# Total Tested: ${this.stats.totalTested}
# Success Rate: ${((this.stats.totalWorking / this.stats.totalTested) * 100).toFixed(2)}%
# Duration: ${duration}s
# Generated: ${new Date().toISOString()}
# Sorted by: Response time (fastest first)

`;
      
      const sortedProxiesList = this.workingProxies.map(p => p.proxy).join('\n');
      await fs.writeFile(this.workingProxiesFile, finalHeader + sortedProxiesList + '\n');
      
      const statsData = {
        summary: {
          totalFetched: this.stats.totalFetched,
          totalTested: this.stats.totalTested,
          totalWorking: this.stats.totalWorking,
          totalDead: this.stats.totalDead,
          successRate: ((this.stats.totalWorking / this.stats.totalTested) * 100).toFixed(2) + '%',
          duration: duration + 's'
        },
        timing: {
          startTime: this.stats.startTime,
          endTime: this.stats.endTime,
          durationSeconds: duration
        },
        files: {
          workingProxies: this.workingProxiesFile,
          workingLog: this.workingLogFile,
          deadLog: this.deadLogFile,
          liveLog: this.liveLogFile,
          stats: 'stats.json'
        },
        sources: this.stats.sources,
        topWorkingProxies: this.workingProxies.slice(0, 10),
        errors: this.stats.errors,
        lastUpdate: new Date().toISOString()
      };
      
      await fs.writeFile('stats.json', JSON.stringify(statsData, null, 2));
      
      this.log(`💾 Results saved successfully`);
      this.log(`⏱️ Total execution time: ${duration} seconds`);
      
      console.log('\n' + '='.repeat(60));
      console.log('🎯 PROXY TESTING SUMMARY');
      console.log('='.repeat(60));
      console.log(`📡 Total Fetched: ${this.stats.totalFetched}`);
      console.log(`🧪 Total Tested: ${this.stats.totalTested}`);
      console.log(`✅ Working: ${this.stats.totalWorking}`);
      console.log(`❌ Dead: ${this.stats.totalDead}`);
      console.log(`📊 Success Rate: ${((this.stats.totalWorking / this.stats.totalTested) * 100).toFixed(2)}%`);
      console.log(`⏱️ Duration: ${duration}s`);
      
      if (this.workingProxies.length > 0) {
        console.log(`🏆 Fastest Proxy: ${this.workingProxies[0].proxy} (${this.workingProxies[0].responseTime}ms)`);
      }
      console.log('='.repeat(60));
      
    } catch (error) {
      this.log(`❌ Save error: ${error.message}`);
      throw error;
    }
  }

  async run() {
    try {
      this.log("🚀 Starting Fixed Proxy Tester...");
      
      await this.fetchProxies();
      
      if (this.allProxies.size === 0) {
        throw new Error("No proxies fetched from any source!");
      }
      
      await this.testAllProxies();
      await this.saveResults();
      
      this.log("✅ Proxy testing completed successfully!");
      
    } catch (error) {
      this.log(`❌ Fatal error: ${error.message}`);
      
      try {
        const errorStats = {
          error: true,
          message: error.message,
          partialResults: {
            fetched: this.stats.totalFetched,
            tested: this.stats.totalTested,
            working: this.workingProxies.length
          },
          timestamp: new Date().toISOString()
        };
        
        await fs.writeFile('stats.json', JSON.stringify(errorStats, null, 2));
        
        if (this.workingProxies.length > 0) {
          const workingList = this.workingProxies.map(p => p.proxy).join('\n');
          await fs.writeFile('hasil.txt', workingList + '\n');
        } else {
          await fs.writeFile('hasil.txt', '# No working proxies found due to error\n# Error: ' + error.message + '\n');
        }
      } catch (saveError) {
        this.log(`❌ Could not save error info: ${saveError.message}`);
      }
      
      process.exit(1);
    }
  }
}

// Main execution
if (require.main === module) {
  const tester = new GitHubProxyTester();
  tester.run();
}

module.exports = GitHubProxyTester;

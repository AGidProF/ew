// proxy-tester.js
const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");
const fs = require("fs").promises;

// Proxy sources
const proxySources = [
  "https://api.proxyscrape.com/v4/free-proxy-list/get?request=get_proxies&protocol=http&proxy_format=ipport&format=text&timeout=10000",
  "https://proxylist.geonode.com/api/proxy-list?protocols=http%2Chttps&limit=500&page=1&sort_by=lastChecked&sort_type=desc",
  "https://raw.githubusercontent.com/proxifly/free-proxy-list/refs/heads/main/proxies/protocols/http/data.txt",
  "https://raw.githubusercontent.com/monosans/proxy-list/refs/heads/main/proxies/http.txt",
  "https://raw.githubusercontent.com/elliottophellia/proxylist/refs/heads/master/results/mix_checked.txt",
  "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt",
  "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt",
  "https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt"
];

// Test URLs untuk memverifikasi proxy
const testUrls = [
  "https://httpbin.org/ip",
  "https://icanhazip.com",
  "https://ipinfo.io/ip",
  "https://otakudesu.best/anime/watanare-sub-indo"
];

class GitHubProxyTester {
  constructor() {
    this.allProxies = new Set();
    this.workingProxies = [];
    this.deadProxies = [];
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

  async fetchProxies() {
    this.log("🔄 Fetching proxies from all sources...");
    
    const fetchPromises = proxySources.map(async (url, index) => {
      try {
        this.log(`📡 Fetching from source ${index + 1}/${proxySources.length}: ${url.split('/')[2]}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        
        const res = await axios.get(url, {
          timeout: 20000,
          maxRedirects: 3,
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; GitHubProxyTester/1.0)',
            'Accept': 'text/plain, application/json, */*'
          }
        });
        
        clearTimeout(timeoutId);
        
        let proxies = [];
        const sourceName = url.split('/')[2];
        
        // Parse different response formats
        if (url.includes("geonode") && res.data?.data) {
          proxies = res.data.data.map(p => `${p.ip}:${p.port}`);
        } else if (typeof res.data === 'string') {
          proxies = res.data
            .split("\n")
            .map(line => line.trim().replace(/^https?:\/\//, ""))
            .filter(line => line && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/.test(line));
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
        this.log(`❌ Source ${index + 1} failed: ${error.message.substring(0, 50)}`);
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
    const maxRetries = Math.min(2, testUrls.length);
    
    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        const testUrl = testUrls[(testUrlIndex + retry) % testUrls.length];
        const agent = new HttpsProxyAgent(`http://${proxy}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await axios.get(testUrl, {
          httpAgent: agent,
          httpsAgent: agent,
          timeout: 8000,
          signal: controller.signal,
          validateStatus: status => status === 200,
          maxRedirects: 2,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ProxyTester/1.0)'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (response.data && response.status === 200) {
          const responseTime = Date.now() - startTime;
          
          // Verify response contains IP-like data
          const responseText = typeof response.data === 'string' 
            ? response.data 
            : JSON.stringify(response.data);
            
          if (responseText.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)) {
            return { 
              proxy, 
              success: true, 
              responseTime, 
              testUrl: testUrl.split('/')[2],
              attempt: retry + 1 
            };
          }
        }
      } catch (error) {
        // Try next URL or fail
        if (retry === maxRetries - 1) {
          return { 
            proxy, 
            success: false, 
            responseTime: Date.now() - startTime,
            error: error.message.substring(0, 50),
            attempts: retry + 1
          };
        }
      }
    }
    
    return { 
      proxy, 
      success: false, 
      responseTime: Date.now() - startTime,
      attempts: maxRetries 
    };
  }

  async testAllProxies() {
    const proxiesToTest = Array.from(this.allProxies);
    
    if (proxiesToTest.length === 0) {
      this.log("❌ No proxies to test!");
      return;
    }
    
    this.log(`🧪 Starting to test ${proxiesToTest.length} proxies...`);
    this.log(`⚡ Using concurrent testing for faster results`);
    
    // Concurrent testing dengan batch processing
    const batchSize = 50; // Test 50 proxies at a time
    const concurrency = 15; // 15 concurrent requests per batch
    
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
      
      // Wait for all concurrent groups in this batch
      const batchResults = await Promise.all(batchPromises);
      
      // Process results
      let batchWorking = 0;
      for (const concurrentResults of batchResults) {
        for (const result of concurrentResults) {
          if (result.status === 'fulfilled') {
            const testResult = result.value;
            totalTested++;
            
            if (testResult.success) {
              this.workingProxies.push({
                proxy: testResult.proxy,
                responseTime: testResult.responseTime,
                testUrl: testResult.testUrl,
                testedAt: new Date().toISOString()
              });
              batchWorking++;
              workingCount++;
              
              if (workingCount % 10 === 0 || testResult.responseTime < 2000) {
                this.log(`✅ Working: ${testResult.proxy} (${testResult.responseTime}ms via ${testResult.testUrl})`);
              }
            } else {
              this.deadProxies.push({
                proxy: testResult.proxy,
                responseTime: testResult.responseTime,
                error: testResult.error,
                testedAt: new Date().toISOString()
              });
            }
          }
        }
      }
      
      const progress = ((totalTested / proxiesToTest.length) * 100).toFixed(1);
      this.log(`📊 Batch ${batchNumber} complete: ${batchWorking}/${batch.length} working | Progress: ${progress}% (${workingCount}/${totalTested} total working)`);
      
      // Small delay between batches to prevent overwhelming
      if (i + batchSize < proxiesToTest.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    this.stats.totalTested = totalTested;
    this.stats.totalWorking = this.workingProxies.length;
    this.stats.totalDead = this.deadProxies.length;
    
    this.log(`🎯 Testing complete!`);
    this.log(`📊 Results: ${this.workingProxies.length} working, ${this.deadProxies.length} dead out of ${totalTested} tested`);
  }

  async saveResults() {
    try {
      this.stats.endTime = new Date();
      const duration = Math.round((this.stats.endTime - this.stats.startTime) / 1000);
      
      // Sort working proxies by response time (fastest first)
      this.workingProxies.sort((a, b) => a.responseTime - b.responseTime);
      
      // Save working proxies to hasil.txt
      const workingProxiesList = this.workingProxies.map(p => p.proxy).join('\n');
      await fs.writeFile('hasil.txt', workingProxiesList + '\n');
      
      // Create comprehensive stats
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
        sources: this.stats.sources,
        workingProxies: this.workingProxies.slice(0, 10), // Top 10 fastest
        errors: this.stats.errors,
        lastUpdate: new Date().toISOString(),
        generatedBy: 'GitHub Actions Proxy Tester'
      };
      
      await fs.writeFile('stats.json', JSON.stringify(statsData, null, 2));
      
      this.log(`💾 Results saved:`);
      this.log(`   📄 hasil.txt: ${this.workingProxies.length} working proxies`);
      this.log(`   📊 stats.json: Complete statistics and metadata`);
      this.log(`⏱️ Total execution time: ${duration} seconds`);
      
      // Log summary
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
      this.log("🚀 Starting GitHub Proxy Tester...");
      
      // Step 1: Fetch all proxies
      await this.fetchProxies();
      
      if (this.allProxies.size === 0) {
        throw new Error("No proxies fetched from any source!");
      }
      
      // Step 2: Test all proxies
      await this.testAllProxies();
      
      // Step 3: Save results
      await this.saveResults();
      
      this.log("✅ GitHub Proxy Tester completed successfully!");
      
    } catch (error) {
      this.log(`❌ Fatal error: ${error.message}`);
      
      // Save error info even if testing failed
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
        
        // Save any working proxies we found before the error
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

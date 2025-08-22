# 🔍 GitHub Proxy Tester

Automated proxy testing system yang berjalan di GitHub Actions setiap jam dan menghasilkan file `hasil.txt` berisi proxy yang bekerja.

## ✨ Features

- 🔄 **Otomatis**: Berjalan setiap jam menggunakan GitHub Actions
- 🧪 **Testing Komprehensif**: Semua proxy diuji, tidak ada yang terlewat
- ⚡ **Concurrent Testing**: Testing paralel untuk hasil yang cepat
- 📊 **Statistics Lengkap**: Data detail di `stats.json`
- 🎯 **Hasil Terurut**: Proxy tersortir berdasarkan kecepatan response
- 🛡️ **Error Handling**: Robust error handling dan recovery

## 📁 File Structure

```
├── .github/workflows/proxy-tester.yml  # GitHub Actions workflow
├── proxy-tester.js                     # Script utama
├── package.json                        # Dependencies
├── hasil.txt                          # Output: daftar proxy yang bekerja
├── stats.json                         # Statistik lengkap
└── README.md                          # Dokumentasi ini
```

## 🚀 Setup

1. **Clone/Fork repository ini**

2. **File otomatis terbuat**:
   - `hasil.txt` - Daftar proxy yang bekerja (satu proxy per baris)
   - `stats.json` - Statistik lengkap dan metadata

## ⏰ Jadwal Eksekusi

- **Otomatis**: Setiap jam (cron: `0 * * * *`)
- **Manual**: Bisa trigger manual lewat GitHub Actions tab
- **Push**: Otomatis saat ada push ke branch `main`

## 📊 Output Files

### hasil.txt
```
1.2.3.4:8080
5.6.7.8:3128
9.10.11.12:80
...
```

### stats.json
```json
{
  "summary": {
    "totalFetched": 1250,
    "totalTested": 1250,
    "totalWorking": 45,
    "totalDead": 1205,
    "successRate": "3.6%",
    "duration": "245s"
  },
  "timing": {
    "startTime": "2025-01-20T10:00:00.000Z",
    "endTime": "2025-01-20T10:04:05.000Z",
    "durationSeconds": 245
  },
  "sources": {
    "api.proxyscrape.com": {
      "total": 200,
      "new": 180,
      "status": "success"
    },
    ...
  },
  "workingProxies": [
    {
      "proxy": "1.2.3.4:8080",
      "responseTime": 856,
      "testUrl": "httpbin.org",
      "testedAt": "2025-01-20T10:03:45.123Z"
    }
  ]
}
```

## 🔧 Customization

### Mengubah Jadwal
Edit file `.github/workflows/proxy-tester.yml`:
```yaml
schedule:
  # Setiap 30 menit
  - cron: '*/30 * * * *'
  
  # Setiap 6 jam
  - cron: '0 */6 * * *'
  
  # Hanya jam 9 pagi setiap hari
  - cron: '0 9 * * *'
```

### Menambah Proxy Sources
Edit array `proxySources` di `proxy-tester.js`:
```javascript
const proxySources = [
  "https://your-proxy-source.com/api",
  // ... sources lainnya
];
```

### Mengubah Test URLs
Edit array `testUrls` di `proxy-tester.js`:
```javascript
const testUrls = [
  "https://httpbin.org/ip",
  "https://your-test-url.com",
  // ... URLs lainnya
];
```

## 📈 Performance

- **Concurrent Testing**: 15 proxy ditest bersamaan
- **Batch Processing**: 50 proxy per batch untuk stabilitas
- **Smart Retry**: Retry dengan URL berbeda jika gagal
- **Timeout Optimized**: 8 detik timeout per test
- **Memory Efficient**: Optimized untuk GitHub Actions limits

## 🎯 Fitur Advanced

### Multi-URL Testing
Setiap proxy ditest dengan beberapa URL untuk akurasi tinggi.

### Response Validation
Memverifikasi response mengandung data IP yang valid.

### Speed Sorting
Hasil disortir berdasarkan response time (tercepat di atas).

### Error Recovery
Jika ada error, tetap save hasil parsial yang berhasil.

### Comprehensive Logging
Log detail untuk debugging dan monitoring.

## 🔍 Monitoring

### Check Status
1. Go to **Actions** tab di GitHub repo
2. Lihat status workflow terakhir
3. Check file `stats.json` untuk detail

### Download Results
```bash
# Download hasil.txt
curl -O https://raw.githubusercontent.com/USERNAME/REPO/main/hasil.txt

# Download stats.json  
curl -O https://raw.githubusercontent.com/USERNAME/REPO/main/stats.json
```

### Usage in Code
```javascript
// Fetch working proxies
const response = await fetch('https://raw.githubusercontent.com/USERNAME/REPO/main/hasil.txt');
const proxies = (await response.text()).split('\n').filter(p => p.trim());

console.log(`Found ${proxies.length} working proxies`);
```

## 🛠️ Troubleshooting

### Workflow Tidak Jalan
- Check apakah Actions enabled di repo settings
- Pastikan file `.github/workflows/proxy-tester.yml` ada
- Check syntax YAML dengan validator

### Tidak Ada hasil.txt
- Check Actions logs untuk error
- Mungkin semua proxy dead (check stats.json)
- Pastikan sources masih valid

### Memory/Timeout Issues
- Kurangi `batchSize` atau `concurrency` di script
- Tambah timeout di workflow (max 360 menit)

## 📋 Requirements

- **GitHub Repository** (public/private)
- **GitHub Actions enabled**
- **Node.js 18+** (auto-installed di workflow)

## 🆓 Cost

- **GitHub Actions**: Free tier = 2000 menit/bulan
- **Script Runtime**: ~4-8 menit per eksekusi
- **Monthly Usage**: ~240 menit (jika jalan tiap jam)
- **Result**: Masih dalam free tier! 🎉

## 📝 Notes

- Semua proxy akan diuji, tidak ada yang terlewat
- Hasil tersimpan otomatis di repository
- Files di-commit otomatis setelah setiap run
- Bisa diakses via raw GitHub URLs
- Compatible dengan semua tools yang bisa baca HTTP proxy

## 🤝 Contributing

Feel free to:
- Add more proxy sources
- Improve testing logic
- Add new output formats
- Optimize performance

## 📜 License

MIT License - bebas digunakan untuk apapun!

---

**Last updated**: Auto-generated setiap run ⚡

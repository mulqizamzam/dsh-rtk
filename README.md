# DSH-RTK

**Plugin native untuk DeepSeek Harness (DSH)** yang merapikan output engineering yang berisik, mempertahankan diagnostik kegagalan, dan menghitung penghematan konteks selama proses DSH berjalan.

> Target kompatibilitas: **DeepSeek Harness `0.2.1-rc.2`**. Versi plugin saat ini: `0.1.0`.

DSH-RTK adalah port independen yang mengambil tujuan produktivitas RTK—mengurangi output command yang tidak perlu dibaca model—dan menerapkannya lewat hook native `tools/post-execute` di DSH. Plugin ini **tidak** menyertakan binary Rust RTK, source engine BUSL, RTK Proxy, maupun installer hook untuk agent lain.

## Untuk pemula: pasang di DSH

### 1. Pastikan DSH sudah berjalan

Buka terminal dan jalankan:

```bash
npx @deepseek-ai/dsh web
```

Jika DSH sudah terpasang secara global, gunakan `dsh web`. Pilih profile `web` dan workspace yang akan digunakan.

### 2. Pasang plugin dari GitHub

Di terminal lain, jalankan:

```bash
dsh plugin --profile web add "github:mulqizamzam/dsh-rtk#main"
```

Perintah ini meng-install bundle GitHub ke profile `web`.

### Pasang lintas profile (rekomendasi #1)

Bundle DSH dipasang **per profile**, bukan otomatis berlaku untuk semua profile. Untuk mengaktifkan kompresi konsisten di profile `web`, `desktop`, `cli`, dan profile lain yang Anda gunakan, jalankan dari checkout repo:

```bash
git clone https://github.com/mulqizamzam/dsh-rtk.git
cd dsh-rtk
bash scripts/install-profiles.sh web desktop cli
```

Ganti daftar tersebut dengan **nama profile yang memang Anda gunakan**. Alternatifnya, jalankan `dsh plugin --profile <nama-profile> add "github:mulqizamzam/dsh-rtk#main"` untuk setiap profile. Perintah `dsh plugin` dapat menginisialisasi profile yang belum ada, jadi periksa nama profile sebelum menjalankan helper. Setelah instalasi, restart setiap proses DSH yang menggunakan profile tersebut.

### 3. Mulai ulang DSH Web

Bundle plugin dipasang sebagai layer profile dan perlu proses DSH Web dimulai ulang agar perubahan aktif:

```bash
# Hentikan proses DSH Web dengan Ctrl+C, lalu jalankan lagi
npx @deepseek-ai/dsh web
```

### 4. Pastikan plugin termuat

```bash
dsh --profile web --dump-config | grep dsh-rtk
```

Cari row `dsh-rtk` pada hasil konfigurasi. Jika tidak muncul, periksa output perintah pemasangan dan pastikan DSH berjalan dengan versi yang kompatibel.

### 5. Gunakan saat bekerja

Tidak ada command baru yang harus diketik untuk compaction otomatis. Saat DSH menjalankan **Bash command yang berhasil**, plugin dapat merapikan output test/build/install yang panjang dan output berulang yang aman dikompresi. Kegagalan command dan command untuk membaca source/diff/search diteruskan apa adanya.

Anda juga bisa meminta DSH menggunakan tool:

- `dsh_rtk_stats` — lihat statistik compaction untuk proses DSH saat ini.
- `dsh_rtk_compact` — ringkas teks log yang Anda berikan secara eksplisit; tool ini tidak menjalankan command dan tidak membaca file.

Contoh instruksi ke DSH: *“Tampilkan statistik DSH-RTK untuk sesi/proses ini.”* atau *“Ringkas output `cargo test` berikut; exit code 0.”*

## Cara menggunakan bypass

Untuk satu Bash command, tambahkan environment prefix di depan command:

```bash
DSH_RTK_BYPASS=1 cargo test --workspace
```

Untuk CI job atau sesi DSH yang harus mempertahankan **seluruh output diagnostik**, atur environment variable pada proses/job yang menjalankan DSH:

```yaml
jobs:
  integration:
    runs-on: ubuntu-latest
    env:
      DSH_RTK_BYPASS: "1"
    steps:
      # checkout/setup steps ...
      - run: dsh --profile headless "run the required checks with full diagnostics"
```

`RTK_DSH_BYPASS=1` juga diterima. Environment bypass berlaku untuk semua command yang diproses oleh proses DSH tersebut; command-prefix bypass hanya berlaku untuk command itu. Bypass tidak mengubah permission/sandbox DSH dan tidak memberi command akses tambahan. Jangan atur bypass pada job unit-test yang memang sedang menguji kompresi, kecuali bypass itu hanya dipasang pada step terpisah.

## Pengaturan

Default config ada di `cordis.patch.yml` dan bisa diubah pada row `dsh-rtk` dalam patch/profile Anda:

| Opsi | Default | Fungsi |
|---|---:|---|
| `enabled` | `true` | Aktif/nonaktifkan compaction otomatis. Tool manual dan statistik tetap tersedia. |
| `compactSuccessfulTests` | `true` | Rangkum output test/lint/build yang berhasil jika pola summary terdeteksi dengan aman. |
| `compactInstallOutput` | `true` | Pangkas baris progress package manager yang dikenali, tetap mempertahankan warning/lifecycle message. |
| `maxOutputChars` | `12000` | Batas karakter untuk output sukses yang bukan command inspeksi detail. |
| `maxOutputLines` | `160` | Batas baris untuk output sukses yang bukan command inspeksi detail. |
| `excludedCommands` | `["git diff"]` | Prefix command tambahan yang dikecualikan. `git diff` selalu dikecualikan sebagai default aman, termasuk saat daftar kustom kosong. |

Contoh mengecualikan command tertentu:

```yaml
- insert:
    - id: dsh-rtk
      name: dsh-rtk
      config:
        enabled: true
        excludedCommands:
          - "git diff"
          - "my-command"
          - "git status --porcelain=v2"
```

Konfigurasi profile/patch dapat berbeda dari default bundle. Ubah config di salinan/patch Anda, bukan edit file di `node_modules` secara langsung.

## Apa yang dipertahankan dari workflow RTK?

- **Kompresi output command** pada jalur Bash DSH, terutama ringkasan test/build yang berhasil, progress instalasi berulang, dan output sukses yang melampaui budget.
- **Jangan sembunyikan kegagalan:** output dengan exit code non-zero diteruskan utuh oleh hook otomatis.
- **Pengecualian/bypass per command** dan daftar prefix command yang bisa dikecualikan.
- **Metrik penghematan lokal** selama satu proses DSH, melalui `dsh_rtk_stats`; perkiraan token menggunakan heuristik byte ÷ 4, bukan pengukuran tokenizer atau billing.
- **Compaction manual** untuk log yang diberikan secara eksplisit ke `dsh_rtk_compact`.

Port ini tidak mengklaim paritas fitur penuh dengan RTK CLI. Hook native DSH tidak mengubah argumen command yang sudah dicatat; karena itu, versi ini tidak meniru rewrite transparan `git status` → `rtk git status`. Statistik belum persisten antar restart, tidak ada `rtk gain`/`discover` lintas sesi, dan RTK Proxy/pipeline engine tidak dibundel. Detail port: [`docs/PORTING-NOTES.md`](docs/PORTING-NOTES.md).

## Development dan pengujian

Butuh Node.js dan npm. Tes unit tidak memerlukan instalasi dependensi DSH:

```bash
npm test
npm run check
npm run pack:check
```

Untuk meng-install working tree lokal ke profile `web`:

```bash
dsh plugin --profile web add link:/absolute/path/to/dsh-rtk
```

Gunakan path absolut ke direktori repo, lalu restart DSH Web dan verifikasi dengan `--dump-config`.

## Lisensi dan atribusi

Kode port DSH-RTK di repo ini dirilis di bawah MIT. RTK asli: [rtk-ai/rtk](https://github.com/rtk-ai/rtk). Ini adalah implementasi DSH independen dan tidak menyertakan source/binary RTK atau komponen RTK Engine/Proxy. Lihat [`NOTICE.md`](NOTICE.md) dan [`LICENSE`](LICENSE).

---

[README English](README.en.md) · [Porting notes](docs/PORTING-NOTES.md) · [Report a bug](https://github.com/mulqizamzam/dsh-rtk/issues)

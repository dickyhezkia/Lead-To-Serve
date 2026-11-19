/* =============================================================================
 *  Lead To Serve 1 · lapisan data Supabase
 *  Dipakai oleh index.html. Butuh @supabase/supabase-js (UMD) sudah dimuat.
 *
 *  2026-09-22 (permintaan user, "Opsi C" — kerangka: login s/d pilihan
 *  Strength/Experience/Relationship/Vision/Expansion, isian tool-nya
 *  MENYUSUL): disederhanakan besar-besaran —
 *   - EMAIL_DOMAIN ganti jadi "jb3.app" (SAMA persis dgn JB3 HOME Tracker,
 *     lihat db.js JB3 — toEmail()/EMAIL_DOMAIN) supaya No. HP + kata sandi
 *     yg SAMA bisa dipakai login di kedua aplikasi tanpa akun terpisah.
 *   - register() DIHAPUS — akun sudah ada di JB3 HOME Tracker (jemaat &
 *     pengurus gereja sudah lama terdaftar di sana), aplikasi ini TIDAK lagi
 *     membuat akun baru sendiri (kalau dibiarkan ada, berisiko bikin baris
 *     profiles dgn skema yg tak lengkap dibanding yg dibuat trigger asli JB3).
 *   - hydrateMine/hydrateAll/saveDisc/saveSsd/saveGifts/saveRoadmap DIHAPUS
 *     SEMENTARA — instrumen (tabel disc_results dkk milik project Supabase
 *     LAMA yg terpisah) belum dipindah/dibangun ulang di sini, itu tahap
 *     BERIKUTNYA ("isian toolnya nanti saja", instruksi user). myProfile()
 *     SAJA yg cukup utk kerangka login->pilihan S-E-R-V-E ini.
 *   - inProfile: field "role" JB3 nilainya 'jemaat'/'hl'/'hf'/'hp'/'sp'/'admin'
 *     (BUKAN lagi "peserta"/"admin" spt project lama Lead To Serve) — dipetakan
 *     ke persona 2-tingkat aplikasi ini di index.html (myProfile().role==="admin"),
 *     bukan di sini, spy db.js tetap murni lapisan data (tak ada logika UI).
 *
 *  window.makeDB(supabaseClient)  →  objek DB dengan:
 *    DB.session() / DB.myProfile()
 *    DB.login({id,password})  id = No. HP atau nama — SAMA dgn akun JB3 HOME Tracker
 *    DB.logout()
 *    DB.changePassword(newPassword)
 *    DB.myAccessStatus() / DB.requestAccess()          (peserta)
 *    DB.listAllAccessRequests() / DB.decideAccessRequest(id, approve)  (Admin saja)
 *    DB.myDisc(year) / DB.saveDisc(year, {picks,graph1,graph2,graph3})  (peserta, 1 baris/tahun)
 *    DB.myRoadmap(year) / DB.saveRoadmapSection(year, patch)  (peserta, 1 baris/tahun, `data` gabungan semua bagian S-E-R-V-E)
 *    DB.mySsd(year) / DB.saveSsd(year, {answers,scores})  (peserta, 1 baris/tahun)
 *    DB.myGifts(year) / DB.saveGifts(year, {answers,scores})  (peserta, 1 baris/tahun)
 *    DB.deleteAccessRequest(id)  (Admin saja)
 *    DB.myRs3Status() / DB.requestRs3Access()          (peserta, post-test Rock Solid 3)
 *    DB.listAllRs3AccessRequests() / DB.decideRs3AccessRequest(id, approve) / DB.deleteRs3AccessRequest(id)  (Admin saja)
 *    DB.myRs3Latest() / DB.saveRs3Result({answers,correct,total,pct,band,passed})  (peserta, riwayat percobaan; lulus = auto-tandai kelas RS3 di JB3)
 *    DB.myLts2Status() / DB.requestLts2Access()          (peserta, post-test Lead To Serve 2)
 *    DB.listAllLts2AccessRequests() / DB.decideLts2AccessRequest(id, approve) / DB.deleteLts2AccessRequest(id)  (Admin saja)
 *    DB.myLts2Latest() / DB.saveLts2Result({answers,correct,total,pct,band,passed})  (peserta, riwayat percobaan; lulus = auto-tandai kelas LTS2 di JB3)
 *    DB.myLwHistory() / DB.saveLw({ministry,answers,scores,selfTotal,selfLevel})  (peserta, Leadership Wheel LTS2, riwayat)
 *    DB.myPtStatus(k) / DB.requestPtAccess(k) / DB.myPtLatest(k) / DB.savePtResult(k, {...})  (peserta, post-test RS1/RS2, k = "rs1"|"rs2")
 *    DB.listAllPtAccessRequests() / DB.decidePtAccessRequest(id, approve) / DB.deletePtAccessRequest(id) / DB.listMateri()  (Admin saja)
 *    DB.myAttendance() / DB.attRoster(k) / DB.setAttendance(pid,k,bab,on)  (absensi per sesi/bab RS1–3, LTS1–2)
 *    DB.listParticipantResults(year)  (Admin saja — hasil SEMUA peserta yg aksesnya disetujui)
 *    DB.grantAccess(k, pid) / DB.revokeAccess(k, pid)  (Admin/SP — buka/cabut akses khusus 1 peserta, k = rs1|rs2|rs3|lts1|lts2)
 * ========================================================================== */
window.makeDB = function makeDB(sb) {
  const ACC_TBL = { rs1:"rs12_access_requests", rs2:"rs12_access_requests", rs3:"rs3_access_requests", lts1:"lts_access_requests", lts2:"lts2_access_requests" };
  // 2026-10-26 (HOME v_pii_privacy.sql): no. HP orang lain hanya terbaca lewat view tersamar profiles_v;
  // view belum ada di server → tabel profiles seperti dulu.
  let PV = true;
  const profRead = async build => {
    if (PV) {
      const r = await build(sb.from("profiles_v"));
      if (!r.error || !/PGRST205|42P01|does not exist|Could not find the table/i.test(String(r.error.code || "") + " " + String(r.error.message || ""))) return r;
      PV = false;
    }
    return build(sb.from("profiles"));
  };
  // 2026-10-15 (user: "pastikan kelulusan RS dan LTS terhubung dengan 5 bintang
  // di aplikasi"): profiles.classes = boolean[5] (RS1,RS2,RS3,LTS1,LTS2) =
  // 5 bintang JB3. Format lama (angka n = n bintang pertama, atau array beda
  // panjang) DIPERTAHANKAN — dulu di-reset jadi kosong → bintang lama hilang.
  const normClasses = v => Array.isArray(v) ? Array.from({ length:5 }, (_, i) => !!v[i])
    : (typeof v === "number" ? Array.from({ length:5 }, (_, i) => i < v) : Array(5).fill(false));
  "use strict";
  const EMAIL_DOMAIN = "jb3.app";   // SAMA persis dgn JB3 HOME Tracker — 1 akun, 2 aplikasi.
  const toEmail = idOrPhone => {
    const v = String(idOrPhone || "").trim();
    if (v.includes("@")) return v.toLowerCase();
    return `${v.toLowerCase().replace(/[^a-z0-9]/g, "")}@${EMAIL_DOMAIN}`;
  };
  const wrap = ({ data, error }) => { if (error) throw error; return data; };

  // 2026-10-16 (user: "Dicky sudah lulus LTS2, perbaiki juga setiap koneksi pengguna"): classes DULU
  // DIBUANG di sini → state.myProfile.classes selalu kosong utk SEMUA peserta (Beranda 0/5, "Belum
  // ditandai selesai" di tab kelas) walau di DB sudah [true×5]. Sekarang ikut dibawa, dinormalisasi.
  // 2026-10-21: is_sp dulu diambil tapi tak ikut ke sini (SP tak melihat Bahan Ajar) + content = melayani di
  // Departemen Content (ministry_roles dept "Content") → boleh baca Bahan Ajar (user: "content ministry, admin, SP").
  const inProfile = r => ({ id:r.id, name:r.name || "", phone:r.phone || "", role:r.role || "jemaat", createdAt:r.created_at || null, classes:normClasses(r.classes),
    is_sp:r.is_sp === true, content:Array.isArray(r.ministry_roles) && r.ministry_roles.some(x => x && x.dept === "Content"),
    djteam:Array.isArray(r.ministry_roles) && r.ministry_roles.some(x => x && x.team === "Discipleship Journey Ministry"),   // 2026-10-24: Bahan Ajar DJ = Admin + tim ini saja
    // 2026-10-21: fam = tim "The Gap Family Ministry" → Bahan Ajar Pre-Marriage & Marriage
    fam:Array.isArray(r.ministry_roles) && r.ministry_roles.some(x => x && x.team === "The Gap Family Ministry"),
    // 2026-10-21: kids = tim "The Gap Kids Ministry" → Bahan Ajar Kelas Gap Kids
    kids:Array.isArray(r.ministry_roles) && r.ministry_roles.some(x => x && x.team === "The Gap Kids Ministry"),
    // 2026-11-03: nama tim pelayanan (JB3 HOME) → isian awal "Ministry" di Leadership Wheel LTS2 (peserta boleh ubah)
    ministry:Array.isArray(r.ministry_roles) ? [...new Set(r.ministry_roles.map(x => x && (x.team || x.dept)).filter(Boolean))].join(", ") : "" });

  return {
    async session() { const { data } = await sb.auth.getSession(); return data.session; },

    async myProfile() {
      const s = await this.session();
      if (!s) return null;
      const { data, error } = await profRead(q => q.select("id,name,phone,role,created_at,classes,is_sp,ministry_roles").eq("id", s.user.id).maybeSingle());
      if (error) throw error;
      return data ? inProfile(data) : null;
    },

    // 19 Nov 2026: No. HP 0… ⇄ 62… dianggap sama — dicoba bentuk lain bila yg diketik salah (pola JB3 HOME db.js).
    async login({ id, password }) {
      const r = await sb.auth.signInWithPassword({ email:toEmail(id), password });
      const v = String(id || "").trim(), d = v.replace(/[^0-9]/g, "");
      if (r.error && /invalid/i.test(r.error.message || "") && !v.includes("@") && /^[+0-9\s().-]+$/.test(v) && d.length >= 9) {
        const alt = d.startsWith("62") ? "0" + d.slice(2) : d.startsWith("0") ? "62" + d.slice(1) : "";
        if (alt) { const r2 = await sb.auth.signInWithPassword({ email:toEmail(alt), password }); if (!r2.error) return; }
      }
      wrap(r);
    },

    // 2026-10-04: scope "local" — keluar HANYA dari app ini di perangkat ini. Default
    // supabase ("global") mencabut SEMUA sesi akun ini → JB3 HOME Tracker (sesi yg
    // sama via handoff, kini juga dibuka di dalam JB3) ikut ter-logout.
    async logout() { wrap(await sb.auth.signOut({ scope:"local" })); },

    async changePassword(newPassword) {
      wrap(await sb.auth.updateUser({ password:newPassword }));
    },

    // ---------- 2026-09-22 (permintaan user, "tombol assesment yang terkunci
    // dan hanya bisa dibuka dengan request ke admin"): tabel lts_access_requests,
    // lihat supabase/v_lts_access_requests.sql. Status terakhir SAJA yg relevan
    // (kalau pernah ditolak lalu ajukan lagi, baris pending BARU dibuat — lihat
    // unique index "1 pending aktif" di migrasi, jadi order+limit(1) di bawah
    // selalu ambil yg TERBARU). ----------
    async myAccessStatus() {
      const s = await this.session();
      if (!s) return null;
      const { data, error } = await sb.from("lts_access_requests").select("status").eq("profile_id", s.user.id).order("requested_at", { ascending:false }).limit(1).maybeSingle();
      if (error) throw error;
      return data ? data.status : null;   // null = belum pernah mengajukan
    },
    async requestAccess() {
      const s = await this.session();
      if (!s) throw new Error("Belum login");
      wrap(await sb.from("lts_access_requests").insert({ profile_id:s.user.id }));
    },

    // ---------- Admin saja (RLS menolak diam2 utk peserta biasa) ----------
    // 2026-09-22 susulan (permintaan user, "admin1... akan melihat dashboard
    // secara keseluruhan"): SEMUA status (dulu cuma "pending") — dipakai utk
    // kartu ringkasan (jumlah disetujui/menunggu/ditolak) di Dashboard, bukan
    // cuma daftar yg perlu diputuskan.
    // 2026-09-22 perbaikan bug nyata ("admin1 tidak bisa masuk" — root cause:
    // login SEMPAT berhasil tapi fungsi ini melempar error saat dipanggil,
    // lihat komentar besar di boot()): SENGAJA tak lagi pakai sintaks embed
    // PostgREST "profile:profiles(name,phone)" (butuh cache skema PostgREST
    // sudah mengenali relasi FK tabel BARU lts_access_requests — bisa
    // terlambat tepat setelah migrasi baru dijalankan lewat SQL Editor) —
    // diganti 2 query terpisah + digabung manual di sini, TAK bergantung ke
    // cache skema PostgREST sama sekali, jadi lebih tahan gangguan.
    async listAllAccessRequests() {
      const { data: reqs, error: e1 } = await sb.from("lts_access_requests")
        .select("id,profile_id,status,requested_at,decided_at")
        .order("requested_at", { ascending:false });
      if (e1) throw e1;
      const rows = reqs || [];
      if (!rows.length) return [];
      const ids = [...new Set(rows.map(r => r.profile_id))];
      const { data: profs, error: e2 } = await profRead(q => q.select("id,name,phone").in("id", ids));
      if (e2) throw e2;
      const profOf = id => (profs || []).find(p => p.id === id) || null;
      return rows.map(r => ({ ...r, profile: profOf(r.profile_id) }));
    },
    async decideAccessRequest(id, approve) {
      const s = await this.session();
      wrap(await sb.from("lts_access_requests").update({
        status: approve ? "approved" : "rejected",
        decided_at: new Date().toISOString(),
        decided_by: s.user.id,
      }).eq("id", id));
    },
    // 2026-09-23 (permintaan user, "bagian nama-nama disetujui tambahkan
    // tombol hapus"): hapus baris SEPENUHNYA (bukan sekadar ganti status)
    // — lihat supabase/v_lts_access_requests_delete.sql utk kebijakan RLS-nya
    // (baru ditambahkan, sebelumnya delete tak diizinkan sama sekali).
    // Efeknya: myAccessStatus() org itu balik jadi null, asesmen terkunci
    // lagi baginya sampai ia mengajukan ulang.
    async deleteAccessRequest(id) {
      wrap(await sb.from("lts_access_requests").delete().eq("id", id));
    },

    // ---------- DISC (2026-09-22, permintaan user "bangun assesment DISC
    // dengan hasil masking, real, stress") — lihat supabase/v_lts_disc_results.sql.
    // 1 baris per PROFIL per TAHUN (bukan seumur hidup) — sesuai keputusan
    // "diperbaharui setiap tahunnya". graph1/2/3 (Masking/Stress/Real)
    // dihitung di index.html (pakai computeDiscGraphs() dari common.js) lalu
    // dikirim ke sini utk disimpan apa adanya — db.js sendiri tak menghitung
    // apa2, murni lapisan simpan/baca. ----------
    async myDisc(year) {
      const s = await this.session();
      if (!s) return null;
      const { data, error } = await sb.from("lts_disc_results").select("*").eq("profile_id", s.user.id).eq("year", year).maybeSingle();
      if (error) throw error;
      return data || null;
    },
    async saveDisc(year, { picks, graph1, graph2, graph3 }) {
      const s = await this.session();
      if (!s) throw new Error("Belum login");
      wrap(await sb.from("lts_disc_results").upsert({
        profile_id: s.user.id, year, picks, graph1, graph2, graph3, updated_at: new Date().toISOString(),
      }, { onConflict: "profile_id,year" }));
    },

    // ---------- Serve Road Map / S-E-R-V-E (2026-09-23, "kerjakan yang
    // experience" — pertama dari 5 bagian, dibangun satu-satu) — lihat
    // supabase/v_lts_roadmap_results.sql. 1 baris/tahun, `data` jsonb
    // menampung field SEMUA bagian yg sudah diisi (bukan 1 tabel per
    // bagian) — saveRoadmapSection() MENGGABUNG (bukan menimpa) spy
    // menyimpan 1 bagian tak menghapus bagian lain yg sudah diisi lebih
    // dulu di tahun yg sama. ----------
    async myRoadmap(year) {
      const s = await this.session();
      if (!s) return null;
      const { data, error } = await sb.from("lts_roadmap_results").select("*").eq("profile_id", s.user.id).eq("year", year).maybeSingle();
      if (error) throw error;
      return data || null;
    },
    async saveRoadmapSection(year, patch) {
      const s = await this.session();
      if (!s) throw new Error("Belum login");
      const { data: existing, error: e1 } = await sb.from("lts_roadmap_results").select("data").eq("profile_id", s.user.id).eq("year", year).maybeSingle();
      if (e1) throw e1;
      const merged = { ...(existing && existing.data ? existing.data : {}), ...patch };
      wrap(await sb.from("lts_roadmap_results").upsert({
        profile_id: s.user.id, year, data: merged, updated_at: new Date().toISOString(),
      }, { onConflict: "profile_id,year" }));
    },

    // ---------- SSD (2026-09-23, "tambahkan tools/isian SSD") — pola SAMA
    // persis dgn DISC (myDisc/saveDisc di atas) — lihat
    // supabase/v_lts_ssd_results.sql. scores dihitung di index.html (pakai
    // computeSsdScores() dari common.js). ----------
    async mySsd(year) {
      const s = await this.session();
      if (!s) return null;
      const { data, error } = await sb.from("lts_ssd_results").select("*").eq("profile_id", s.user.id).eq("year", year).maybeSingle();
      if (error) throw error;
      return data || null;
    },
    async saveSsd(year, { answers, scores }) {
      const s = await this.session();
      if (!s) throw new Error("Belum login");
      wrap(await sb.from("lts_ssd_results").upsert({
        profile_id: s.user.id, year, answers, scores, updated_at: new Date().toISOString(),
      }, { onConflict: "profile_id,year" }));
    },

    // ---------- Karunia Rohani / Spiritual Gifts (2026-09-23, "Karunia
    // Rohani adalah bagian dari Strength. kamu buatkan isiannya") — pola SAMA
    // persis dgn DISC/SSD di atas — lihat supabase/v_lts_gifts_results.sql.
    // scores dihitung di index.html (pakai computeGiftsScores() dari
    // common.js). ----------
    async myGifts(year) {
      const s = await this.session();
      if (!s) return null;
      const { data, error } = await sb.from("lts_gifts_results").select("*").eq("profile_id", s.user.id).eq("year", year).maybeSingle();
      if (error) throw error;
      return data || null;
    },
    async saveGifts(year, { answers, scores }) {
      const s = await this.session();
      if (!s) throw new Error("Belum login");
      wrap(await sb.from("lts_gifts_results").upsert({
        profile_id: s.user.id, year, answers, scores, updated_at: new Date().toISOString(),
      }, { onConflict: "profile_id,year" }));
    },

    // ---------- Rock Solid 3 post-test (2026-09-23, permintaan user:
    // "buatkan link dari kartu carousel Rock solid 3 (seperti LTS1) perlu
    // ijin admin, baru bisa mengikuti test") — pola access-gate SAMA PERSIS
    // dgn lts_access_requests di atas, tabel TERPISAH ("rs3_" prefix) krn
    // konsepnya beda (post-test kelas, bukan S-E-R-V-E). Lihat
    // supabase/v_rs3_access_requests.sql / v_rs3_test_results.sql. ----------
    async myRs3Status() {
      const s = await this.session();
      if (!s) return null;
      const { data, error } = await sb.from("rs3_access_requests").select("status").eq("profile_id", s.user.id).order("requested_at", { ascending:false }).limit(1).maybeSingle();
      if (error) throw error;
      return data ? data.status : null;
    },
    async requestRs3Access() {
      const s = await this.session();
      if (!s) throw new Error("Belum login");
      wrap(await sb.from("rs3_access_requests").insert({ profile_id:s.user.id }));
    },
    // Admin saja (RLS menolak diam2 utk peserta biasa) — sama pola dgn
    // listAllAccessRequests(): 2 query terpisah + gabung manual, TAK
    // bergantung ke embed PostgREST/cache skema (lihat komentar besar di
    // listAllAccessRequests soal bug "admin1 tidak bisa masuk").
    async listAllRs3AccessRequests() {
      const { data: reqs, error: e1 } = await sb.from("rs3_access_requests")
        .select("id,profile_id,status,requested_at,decided_at")
        .order("requested_at", { ascending:false });
      if (e1) throw e1;
      const rows = reqs || [];
      if (!rows.length) return [];
      const ids = [...new Set(rows.map(r => r.profile_id))];
      const { data: profs, error: e2 } = await profRead(q => q.select("id,name,phone").in("id", ids));
      if (e2) throw e2;
      const profOf = id => (profs || []).find(p => p.id === id) || null;
      return rows.map(r => ({ ...r, profile: profOf(r.profile_id) }));
    },
    async decideRs3AccessRequest(id, approve) {
      const s = await this.session();
      wrap(await sb.from("rs3_access_requests").update({
        status: approve ? "approved" : "rejected",
        decided_at: new Date().toISOString(),
        decided_by: s.user.id,
      }).eq("id", id));
    },
    async deleteRs3AccessRequest(id) {
      wrap(await sb.from("rs3_access_requests").delete().eq("id", id));
    },
    // Riwayat percobaan post-test (TIDAK per-tahun, boleh diulang kapan saja
    // sampai lulus — lihat v_rs3_test_results.sql). myRs3Latest() ambil
    // percobaan TERBARU saja (utk tampilan status di beranda/halaman test);
    // riwayat lengkap tak perlu ditampilkan di app ini utk saat ini.
    async myRs3Latest() {
      const s = await this.session();
      if (!s) return null;
      const { data, error } = await sb.from("rs3_test_results").select("*").eq("profile_id", s.user.id).order("created_at", { ascending:false }).limit(1).maybeSingle();
      if (error) throw error;
      return data || null;
    },
    // Menyimpan 1 percobaan BARU + (kalau lulus) otomatis menandai kelas
    // "Rock Solid 3" selesai di profiles.classes milik JB3 HOME Tracker
    // (index 2 dari 5 — lihat CLASS_LABELS di common.js JB3: Rock Solid 1/2/3,
    // Lead To Serve 1/2). Baca-ubah-tulis manual (bukan RPC/SECURITY DEFINER)
    // krn RLS profiles_update JB3 SUDAH mengizinkan "id = auth.uid()" utk
    // update baris sendiri, dan trigger protect_profile() di sana HANYA
    // membatasi kolom role/role2 — classes bebas ditulis pemiliknya sendiri,
    // jadi tak perlu fungsi Postgres tambahan.
    async saveRs3Result({ answers, correct, total, pct, band, passed }) {
      const s = await this.session();
      if (!s) throw new Error("Belum login");
      wrap(await sb.from("rs3_test_results").insert({
        profile_id: s.user.id, answers, correct, total, score_pct: pct, band, passed,
      }));
      if (passed) await this.markClassComplete(2);   // bintang ke-3 di JB3
    },

    // ---------- Lead To Serve 2 post-test (2026-09-23, "jika limit cukup,
    // buatkan post test utk LTS2") — SAMA PERSIS pola RS3 di atas, tabel
    // TERPISAH ("lts2_" prefix). Lihat supabase/v_lts2_access_requests.sql /
    // v_lts2_test_results.sql. ----------
    async myLts2Status() {
      const s = await this.session();
      if (!s) return null;
      const { data, error } = await sb.from("lts2_access_requests").select("status").eq("profile_id", s.user.id).order("requested_at", { ascending:false }).limit(1).maybeSingle();
      if (error) throw error;
      return data ? data.status : null;
    },
    async requestLts2Access() {
      const s = await this.session();
      if (!s) throw new Error("Belum login");
      wrap(await sb.from("lts2_access_requests").insert({ profile_id:s.user.id }));
    },
    async listAllLts2AccessRequests() {
      const { data: reqs, error: e1 } = await sb.from("lts2_access_requests")
        .select("id,profile_id,status,requested_at,decided_at")
        .order("requested_at", { ascending:false });
      if (e1) throw e1;
      const rows = reqs || [];
      if (!rows.length) return [];
      const ids = [...new Set(rows.map(r => r.profile_id))];
      const { data: profs, error: e2 } = await profRead(q => q.select("id,name,phone").in("id", ids));
      if (e2) throw e2;
      const profOf = id => (profs || []).find(p => p.id === id) || null;
      return rows.map(r => ({ ...r, profile: profOf(r.profile_id) }));
    },
    async decideLts2AccessRequest(id, approve) {
      const s = await this.session();
      wrap(await sb.from("lts2_access_requests").update({
        status: approve ? "approved" : "rejected",
        decided_at: new Date().toISOString(),
        decided_by: s.user.id,
      }).eq("id", id));
    },
    async deleteLts2AccessRequest(id) {
      wrap(await sb.from("lts2_access_requests").delete().eq("id", id));
    },
    async myLts2Latest() {
      const s = await this.session();
      if (!s) return null;
      const { data, error } = await sb.from("lts2_test_results").select("*").eq("profile_id", s.user.id).order("created_at", { ascending:false }).limit(1).maybeSingle();
      if (error) throw error;
      return data || null;
    },
    // Lulus -> menandai kelas "Lead To Serve 2" (index 4 dari 5, CLASS_LABELS
    // JB3: Rock Solid 1/2/3, Lead To Serve 1/2) — pola SAMA PERSIS dgn
    // saveRs3Result() di atas.
    async saveLts2Result({ answers, correct, total, pct, band, passed }) {
      const s = await this.session();
      if (!s) throw new Error("Belum login");
      wrap(await sb.from("lts2_test_results").insert({
        profile_id: s.user.id, answers, correct, total, score_pct: pct, band, passed,
      }));
      // 2026-11-08 (user): LTS2 lulus = Leadership Wheel + post-test Good ke atas → ditandai di index.html (lts2TryComplete).
    },

    // ---------- LTS2 Leadership Wheel (2026-11-03) — tabel lts2_wheel_results (jb3-supabase-vps/sql/v_dj_lts2_wheel.sql).
    // Boleh diisi ulang; tiap kirim = baris baru (riwayat).
    async myLwHistory() {
      const s = await this.session();
      if (!s) return [];
      const { data, error } = await sb.from("lts2_wheel_results").select("*").eq("profile_id", s.user.id).order("created_at", { ascending:false }).limit(12);
      if (error) throw error;
      return data || [];
    },
    async saveLw({ ministry, answers, scores, selfTotal, selfLevel, scale }) {
      const s = await this.session();
      if (!s) throw new Error("Belum login");
      wrap(await sb.from("lts2_wheel_results").insert({
        profile_id: s.user.id, ministry: String(ministry || "").trim().slice(0, 120), answers, scores, self_total: selfTotal, self_level: selfLevel, scale: scale || 10,
      }));
    },

    // ---------- Rock Solid 1 & 2 post-test (2026-10-15, "buat Post test
    // untuk Rock Solid 1 dan 2 di Discipleship Journey") — pola SAMA dgn
    // RS3, tapi satu pasang tabel utk dua kelas (kolom class_key 'rs1'|'rs2').
    // Lihat supabase/v_rs12_posttest.sql. k = "rs1" | "rs2". ----------
    async myPtStatus(k) {
      const s = await this.session();
      if (!s) return null;
      const { data, error } = await sb.from("rs12_access_requests").select("status").eq("profile_id", s.user.id).eq("class_key", k).order("requested_at", { ascending:false }).limit(1).maybeSingle();
      if (error) throw error;
      return data ? data.status : null;
    },
    async requestPtAccess(k) {
      const s = await this.session();
      if (!s) throw new Error("Belum login");
      wrap(await sb.from("rs12_access_requests").insert({ profile_id:s.user.id, class_key:k }));
    },
    // Admin/SP: semua permintaan RS1+RS2 → { rs1:[...], rs2:[...] } (profil digabung manual).
    async listAllPtAccessRequests() {
      const { data: reqs, error: e1 } = await sb.from("rs12_access_requests")
        .select("id,profile_id,class_key,status,requested_at,decided_at")
        .order("requested_at", { ascending:false });
      if (e1) throw e1;
      const rows = reqs || [];
      const out = { rs1:[], rs2:[] };
      if (!rows.length) return out;
      const ids = [...new Set(rows.map(r => r.profile_id))];
      const { data: profs, error: e2 } = await profRead(q => q.select("id,name,phone").in("id", ids));
      if (e2) throw e2;
      rows.forEach(r => { if (out[r.class_key]) out[r.class_key].push({ ...r, profile:(profs || []).find(p => p.id === r.profile_id) || null }); });
      return out;
    },
    async decidePtAccessRequest(id, approve) {
      const s = await this.session();
      wrap(await sb.from("rs12_access_requests").update({
        status: approve ? "approved" : "rejected",
        decided_at: new Date().toISOString(),
        decided_by: s.user.id,
      }).eq("id", id));
    },
    async deletePtAccessRequest(id) {
      wrap(await sb.from("rs12_access_requests").delete().eq("id", id));
    },
    // 2026-11-08 (user: "admin dapat membuka asesmen dan post test RS1-3, LTS1-2 peserta tertentu (sesuai permintaan)"):
    // Admin/SP membuka akses 1 peserta tanpa absensi → baris "approved" di tabel akses kelasnya (RLS *_admin_insert,
    // jb3-supabase-vps/sql/v_dj_akses_admin.sql). Permintaan pending org itu ikut disetujui. LTS1 = asesmen + post-test.
    async grantAccess(k, pid) {
      const s = await this.session();
      const tbl = ACC_TBL[k], ck = k === "rs1" || k === "rs2" ? { class_key:k } : {};
      const dec = { status:"approved", decided_at:new Date().toISOString(), decided_by:s.user.id };
      let q = sb.from(tbl).update(dec).eq("profile_id", pid).eq("status", "pending");
      if (ck.class_key) q = q.eq("class_key", k);
      const { data, error } = await q.select("id");
      if (error) throw error;
      if (!(data || []).length) wrap(await sb.from(tbl).insert({ profile_id:pid, ...ck, ...dec }));
    },
    // cabut = hapus semua baris akses org itu di kelas tsb (terkunci lagi kecuali absensinya sudah lengkap)
    async revokeAccess(k, pid) {
      let q = sb.from(ACC_TBL[k]).delete().eq("profile_id", pid);
      if (k === "rs1" || k === "rs2") q = q.eq("class_key", k);
      wrap(await q);
    },
    async myPtLatest(k) {
      const s = await this.session();
      if (!s) return null;
      const { data, error } = await sb.from("rs12_test_results").select("*").eq("profile_id", s.user.id).eq("class_key", k).order("created_at", { ascending:false }).limit(1).maybeSingle();
      if (error) throw error;
      return data || null;
    },
    // Lulus → tandai kelas selesai di profiles.classes JB3 (RS1 = index 0, RS2 = index 1).
    async savePtResult(k, { answers, correct, total, pct, band, passed }) {
      const s = await this.session();
      if (!s) throw new Error("Belum login");
      wrap(await sb.from("rs12_test_results").insert({
        profile_id: s.user.id, class_key:k, answers, correct, total, score_pct: pct, band, passed,
      }));
      // LTS1: lulus kelas = post-test + asesmen + S-E-R-V-E + absensi → ditandai di index.html (lts1TryComplete).
      if (passed && k !== "lts1") await this.markClassComplete(k === "rs1" ? 0 : 1);
    },
    // Bahan Ajar RS1–3 — tabel dj_materi, RLS hanya Admin (v_rs12_posttest.sql).
    async listMateri() {
      const { data, error } = await sb.from("dj_materi").select("key,title,body,sort,updated_at").order("sort");
      if (error) throw error;
      return data || [];
    },
    // 2026-10-26 editor Bahan Ajar: simpan isi 1 kelas. since = updated_at saat editor dibuka → bila sudah berubah
    // (orang lain menyimpan lebih dulu) lempar "STALE" (null = timpa saja). RLS djm_edit (v_dj_materi_edit.sql).
    async saveMateri(key, body, since) {
      if (since) {
        const { data: cur, error: e1 } = await sb.from("dj_materi").select("updated_at").eq("key", key).maybeSingle();
        if (e1) throw e1;
        if (cur && Date.parse(cur.updated_at) !== Date.parse(since)) throw new Error("STALE");
      }
      const { data, error } = await sb.from("dj_materi").update({ body, updated_at: new Date().toISOString() }).eq("key", key).select("key,title,body,sort,updated_at");
      if (error) throw error;
      if (!data || !data.length) throw new Error("Kamu belum punya izin mengubah bahan ajar ini.");
      return data[0];
    },

    // 2026-09-23 (permintaan user - ide "auto-tandai kelas Lead To Serve 1
    // di JB3 begitu 5 bagian S-E-R-V-E lengkap", diusulkan Claude & dipilih
    // user "1,3 jalankan"): generik (classIdx apa pun), dipakai SEKARANG
    // hanya utk LTS1 (index 3) — baca-ubah-tulis manual, pola PERSIS SAMA
    // dgn saveRs3Result()/saveLts2Result() di atas. Definisi "lengkap" itu
    // SENDIRI (serveSectionFilled()/SERVE_SECTIONS) SENGAJA tetap di
    // index.html, bukan diduplikasi di sini — fungsi ini murni "tulis
    // classes[idx]=true", pemanggil yg memutuskan KAPAN. Return boolean:
    // true = baru saja ditandai (belum true sebelumnya, worth di-toast),
    // false = sudah true dari dulu (tak perlu nulis ulang/toast lagi).
    // 2026-10-04 (permintaan user, nav Admin "RS1, RS2, RS3, LTS1, LTS2 yang
    // menampilkan dashboard masing-masing"): progres kelas SEMUA akun dari
    // profiles.classes (boolean[5]: RS1,RS2,RS3,LTS1,LTS2 — sumber yg sama
    // dgn bintang kelas di JB3 HOME Tracker). Murni baca.
    // 2026-10-04 — Feedback Rock Solid 3 (ANONIM, lihat v_rs3_feedback.sql):
    // insert TANPA .select() (peserta tak boleh baca balik barisnya), baca &
    // hapus Admin saja.
    async submitRs3Feedback(f) {
      wrap(await sb.from("rs3_feedback").insert({
        rating_materi:f.materi, rating_durasi:f.durasi, rating_pengajar:f.pengajar,
        berkesan:f.berkesan || null, saran:f.saran || null, class_key:f.classKey || "rs3",
      }));
    },
    async listRs3Feedback() {
      const { data, error } = await sb.from("rs3_feedback").select("*").order("created_at", { ascending:false });
      if (error) throw error;
      return data || [];
    },
    // Batch feedback RS3 (v_rs3_feedback_batch.sql) — Admin saja. Batch baru:
    // nonaktifkan yg lama DULU (unique index: cuma 1 baris is_active=true).
    async listRs3FbBatches() {
      const { data, error } = await sb.from("rs3_fb_batches").select("*").order("created_at", { ascending:false });
      if (error) throw error;
      return data || [];
    },
    // 2026-10-04: per kelas (class_key, v_class_feedback.sql) — batch aktif 1 per kelas.
    async startRs3FbBatch(name, classKey) {
      classKey = classKey || "rs3";
      wrap(await sb.from("rs3_fb_batches").update({ is_active:false }).eq("is_active", true).eq("class_key", classKey));
      wrap(await sb.from("rs3_fb_batches").insert({ name, is_active:true, class_key:classKey }));
    },
    async renameRs3FbBatch(id, name) { wrap(await sb.from("rs3_fb_batches").update({ name }).eq("id", id)); },
    async deleteRs3Feedback(id) { wrap(await sb.from("rs3_feedback").delete().eq("id", id)); },
    async listClassProgress() {
      const { data, error } = await profRead(q => q.select("id,name,phone,role,classes"));
      if (error) throw error;
      return (data || []).filter(r => String(r.role || "").toLowerCase() !== "barista")
        .map(r => ({ id:r.id, name:r.name || "?", phone:r.phone || "", classes:Array.isArray(r.classes) ? r.classes : [] }));
    },
    // 2026-10-04: nilai post-test terbaik per peserta (RS3/LTS2) utk daftar
    // "Sudah selesai kelas" di dashboard Admin → { rs3:{pid:row}, lts2:{pid:row} }.
    async listPostTestBest() {
      const pick = rows => {
        const m = {};
        (rows || []).forEach(r => { const o = m[r.profile_id]; if (!o || (r.score_pct || 0) > (o.score_pct || 0)) m[r.profile_id] = r; });
        return m;
      };
      const [a, b, c] = await Promise.all([
        sb.from("rs3_test_results").select("profile_id,score_pct,band,passed,correct,total,created_at"),
        sb.from("lts2_test_results").select("profile_id,score_pct,band,passed,correct,total,created_at"),
        sb.from("rs12_test_results").select("profile_id,class_key,score_pct,band,passed,correct,total,created_at"),
      ]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      const pt = c.error ? [] : (c.data || []);   // tabel baru: jangan gagalkan dashboard bila migrasi belum jalan
      return { rs3: pick(a.data), lts2: pick(b.data), rs1: pick(pt.filter(r => r.class_key === "rs1")), rs2: pick(pt.filter(r => r.class_key === "rs2")), lts1: pick(pt.filter(r => r.class_key === "lts1")) };
    },
    // 2026-10-24 (user: "absensi per bab utk LTS1 dan LTS2 … tidak akan lulus atau dapat bintang ketika
    // tidak hadir semua"): tabel dj_attendance (v_dj_absensi.sql). Peserta baca miliknya sendiri; dicentang
    // Admin/SP/Departemen Content (RLS dja_*). Roster = RPC dj_att_roster (security definer).
    // 2026-10-26: judul pelajaran Bahan Ajar (tanpa isi) → nama bab LTS1/LTS2 di absensi & kartu peserta. null bila RPC belum ada.
    async babNames() {
      const { data, error } = await sb.rpc("dj_bab_names");
      if (error) return null;
      return data || null;
    },
    async myAttendance() {
      const s = await this.session();
      const out = { rs1:[], rs2:[], rs3:[], lts1:[], lts2:[] };
      if (!s) return out;
      const { data, error } = await sb.from("dj_attendance").select("class_key,bab").eq("profile_id", s.user.id);
      if (error) throw error;
      (data || []).forEach(r => { if (out[r.class_key]) out[r.class_key].push(r.bab); });
      return out;
    },
    async attRoster(k) {
      const { data, error } = await sb.rpc("dj_att_roster", { p_class:k });
      if (error) throw error;
      return (data || []).map(r => ({ id:r.id, name:r.name || "?", done:!!r.done, babs:(r.babs || []).map(Number) }));
    },
    // 2026-10-29 (user: "saya ingin liat batch yg berjalan apakah semua asesmen sudah diisi oleh peserta"): kartu Admin
    // "Batch berjalan" LTS1 = hadir ≥1 bab LTS1 tapi belum lulus kelas. 1 query per tabel (bukan per orang); tanpa SQL baru.
    async lts1Batch(year) {
      const ppl = (await this.attRoster("lts1")).filter(p => !p.done && p.babs.length);
      if (!ppl.length) return [];
      const ids = ppl.map(p => p.id);
      const res = await Promise.all([
        sb.from("lts_disc_results").select("profile_id").eq("year", year).in("profile_id", ids),
        sb.from("lts_ssd_results").select("profile_id").eq("year", year).in("profile_id", ids),
        sb.from("lts_gifts_results").select("profile_id").eq("year", year).in("profile_id", ids),
        sb.from("lts_roadmap_results").select("profile_id,data").eq("year", year).in("profile_id", ids),
        sb.from("rs12_test_results").select("profile_id,band,score_pct,passed,created_at").eq("class_key", "lts1").in("profile_id", ids).order("created_at", { ascending:false }),
      ]);
      res.forEach(r => { if (r.error) throw r.error; });
      const [disc, ssd, gifts] = res.slice(0, 3).map(r => new Set((r.data || []).map(x => x.profile_id)));
      const rm = {}; (res[3].data || []).forEach(r => { rm[r.profile_id] = r.data || {}; });
      // post-test: percobaan lulus diutamakan, selain itu yg terbaru
      const pt = {}; (res[4].data || []).forEach(r => { const c = pt[r.profile_id]; if (!c || (r.passed && !c.passed)) pt[r.profile_id] = r; });
      return ppl.map(p => ({ id:p.id, name:p.name, babs:p.babs, disc:disc.has(p.id), ssd:ssd.has(p.id), gifts:gifts.has(p.id), roadmap:rm[p.id] || null, pt:pt[p.id] || null }));
    },
    // 2026-11-03 (user: "tambahkan kartu Batch berjalan pada setiap kelas"): versi umum utk RS1/RS2/RS3/LTS2 —
    // hadir ≥1 sesi/bab tapi belum lulus kelas + post-test (lulus diutamakan, selain itu terbaru) + LTS2: Leadership Wheel terakhir.
    async classBatch(k) {
      const ppl = (await this.attRoster(k)).filter(p => !p.done && p.babs.length);
      if (!ppl.length) return [];
      const ids = ppl.map(p => p.id), cols = "profile_id,band,score_pct,passed,created_at";
      const ptQ = k === "rs3" ? sb.from("rs3_test_results").select(cols)
        : k === "lts2" ? sb.from("lts2_test_results").select(cols)
        : sb.from("rs12_test_results").select(cols).eq("class_key", k);
      const res = await Promise.all([ptQ.in("profile_id", ids).order("created_at", { ascending:false }),
        k === "lts2" ? sb.from("lts2_wheel_results").select("profile_id,self_level,created_at").in("profile_id", ids).order("created_at", { ascending:false }) : null]);
      if (res[0].error) throw res[0].error;
      const pt = {}; (res[0].data || []).forEach(r => { const c = pt[r.profile_id]; if (!c || (r.passed && !c.passed)) pt[r.profile_id] = r; });
      const lw = {}; if (res[1] && !res[1].error) (res[1].data || []).forEach(r => { if (!lw[r.profile_id]) lw[r.profile_id] = r; });
      return ppl.map(p => ({ id:p.id, name:p.name, babs:p.babs, pt:pt[p.id] || null, lw:lw[p.id] || null }));
    },
    // 2026-10-24: token QR absensi hari ini (v_dj_absensi_scan.sql) — set lts1a | lts1b | lts2.
    async attCode(set) {
      const { data, error } = await sb.rpc("dj_att_code", { p_set:set });
      if (error) throw error;
      return data;
    },
    async setAttendance(pid, k, bab, on) {
      if (on) wrap(await sb.from("dj_attendance").upsert({ profile_id:pid, class_key:k, bab }, { onConflict:"profile_id,class_key,bab", ignoreDuplicates:true }));
      else wrap(await sb.from("dj_attendance").delete().eq("profile_id", pid).eq("class_key", k).eq("bab", bab));
    },
    async markClassComplete(classIdx) {
      const s = await this.session();
      if (!s) throw new Error("Belum login");
      const { data: prof, error: e1 } = await sb.from("profiles").select("classes").eq("id", s.user.id).maybeSingle();
      if (e1) throw e1;
      const arr = normClasses(prof && prof.classes);
      if (arr[classIdx]) return false;
      arr[classIdx] = true;
      wrap(await sb.from("profiles").update({ classes:arr }).eq("id", s.user.id));
      return true;
    },

    // ---------- Admin saja: hasil SEMUA peserta yg aksesnya sudah disetujui
    // (2026-09-23, permintaan user: "admin dapat melihat setiap hasil test
    // dan asesment dari setiap pengguna yang telah mengikuti discipleship
    // journey"). RLS tabel lts_disc_results/lts_ssd_results/lts_gifts_
    // results/lts_roadmap_results/rs3_test_results SEMUANYA SUDAH mengizinkan
    // is_admin() baca semua baris (dibuat sejak awal tiap tabel itu) — jadi
    // TIDAK perlu migrasi baru sama sekali di sini, murni query baca.
    // SENGAJA 1 query per-TABEL (bukan per-ORANG) — cuma ~8 query TOTAL
    // apa pun jumlah peserta, lalu digabung manual di sini via profile_id —
    // jauh lebih murah drpd N query per peserta. ----------
    async listParticipantResults(year) {
      const [
        { data: reqs1, error: e1 }, { data: reqs2, error: e2 }, { data: reqs3, error: e9 },
        { data: discs, error: e3 }, { data: ssds, error: e4 },
        { data: gifts, error: e5 }, { data: roadmaps, error: e6 },
        { data: rs3s, error: e7 }, { data: lts2s, error: e10 },
        pr12, pt12, lw12, att,
      ] = await Promise.all([
        sb.from("lts_access_requests").select("profile_id").eq("status", "approved"),
        sb.from("rs3_access_requests").select("profile_id").eq("status", "approved"),
        sb.from("lts2_access_requests").select("profile_id").eq("status", "approved"),
        sb.from("lts_disc_results").select("*").eq("year", year),
        sb.from("lts_ssd_results").select("*").eq("year", year),
        sb.from("lts_gifts_results").select("*").eq("year", year),
        sb.from("lts_roadmap_results").select("*").eq("year", year),
        sb.from("rs3_test_results").select("*").order("created_at", { ascending:false }),
        sb.from("lts2_test_results").select("*").order("created_at", { ascending:false }),
        sb.from("rs12_access_requests").select("profile_id").eq("status", "approved"),
        sb.from("rs12_test_results").select("*").order("created_at", { ascending:false }),
        sb.from("lts2_wheel_results").select("*").order("created_at", { ascending:false }),
        sb.from("dj_attendance").select("profile_id"),
      ]);
      // 2026-10-15: RS1/RS2 (tabel baru) — kalau migrasi belum dijalankan, abaikan saja.
      const reqs12 = pr12.error ? [] : (pr12.data || []), pts = pt12.error ? [] : (pt12.data || []);
      const lws = lw12.error ? [] : (lw12.data || []);   // 2026-11-03 Leadership Wheel (soft, sama spt RS1/RS2)
      [e1, e2, e3, e4, e5, e6, e7, e9, e10].forEach(e => { if (e) throw e; });
      // Peserta yg dihitung = siapa pun yg akses LTS, RS3, ATAU LTS2-nya
      // PERNAH disetujui (approved) — bukan cuma yg py hasil, spy Admin jg
      // lihat org yg sudah diizinkan tp belum sempat isi apa2 (baris kosong).
      // 2026-11-03 (user: "semua hasil asesmen peserta DJ di kumpulkan tombol peserta admin"): + siapa pun yg sudah
      // absensi barcode atau py hasil APA PUN (DISC/SSD/Karunia/Road Map/post-test/Leadership Wheel) — jalur absensi
      // tak lewat Ajukan Akses, dulu mereka tak muncul di daftar.
      const atts = att.error ? [] : (att.data || []);
      const ids = [...new Set([reqs1, reqs2, reqs3, reqs12, lws, atts, discs, ssds, gifts, roadmaps, rs3s, lts2s, pts].flatMap(a => (a || []).map(r => r.profile_id)))].filter(Boolean);
      if (!ids.length) return [];
      const { data: profs, error: e8 } = await profRead(q => q.select("id,name,phone").in("id", ids));
      if (e8) throw e8;
      const findFor = (arr, pid) => (arr || []).find(r => r.profile_id === pid) || null;
      // rs3_test_results/lts2_test_results: BANYAK baris per orang (riwayat
      // percobaan) — ambil yg PALING BARU per profil (array sudah diurutkan
      // created_at desc dari query di atas).
      const latestOf = rows => { const m = {}; (rows || []).forEach(r => { if (!m[r.profile_id]) m[r.profile_id] = r; }); return m; };
      const rs3Latest = latestOf(rs3s), lts2Latest = latestOf(lts2s);
      const rs1Latest = latestOf(pts.filter(r => r.class_key === "rs1")), rs2Latest = latestOf(pts.filter(r => r.class_key === "rs2")), lts1PtLatest = latestOf(pts.filter(r => r.class_key === "lts1"));
      return ids.map(id => {
        const prof = (profs || []).find(p => p.id === id) || { id, name:"?", phone:"" };
        return {
          profileId:id, name:prof.name, phone:prof.phone,
          disc: findFor(discs, id), ssd: findFor(ssds, id), gifts: findFor(gifts, id), roadmap: findFor(roadmaps, id),
          rs3: rs3Latest[id] || null, lts2: lts2Latest[id] || null,
          rs1: rs1Latest[id] || null, rs2: rs2Latest[id] || null, lts1pt: lts1PtLatest[id] || null,
          lw: lws.filter(r => r.profile_id === id),   // riwayat Leadership Wheel, terbaru dulu
        };
      });
    },
  };
};

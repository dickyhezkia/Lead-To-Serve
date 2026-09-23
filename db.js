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
 *    DB.listParticipantResults(year)  (Admin saja — hasil SEMUA peserta yg aksesnya disetujui)
 * ========================================================================== */
window.makeDB = function makeDB(sb) {
  "use strict";
  const EMAIL_DOMAIN = "jb3.app";   // SAMA persis dgn JB3 HOME Tracker — 1 akun, 2 aplikasi.
  const toEmail = idOrPhone => {
    const v = String(idOrPhone || "").trim();
    if (v.includes("@")) return v.toLowerCase();
    return `${v.toLowerCase().replace(/[^a-z0-9]/g, "")}@${EMAIL_DOMAIN}`;
  };
  const wrap = ({ data, error }) => { if (error) throw error; return data; };

  const inProfile = r => ({ id:r.id, name:r.name || "", phone:r.phone || "", role:r.role || "jemaat", createdAt:r.created_at || null });

  return {
    async session() { const { data } = await sb.auth.getSession(); return data.session; },

    async myProfile() {
      const s = await this.session();
      if (!s) return null;
      const { data, error } = await sb.from("profiles").select("id,name,phone,role,created_at").eq("id", s.user.id).maybeSingle();
      if (error) throw error;
      return data ? inProfile(data) : null;
    },

    async login({ id, password }) {
      wrap(await sb.auth.signInWithPassword({ email:toEmail(id), password }));
    },

    async logout() { wrap(await sb.auth.signOut()); },

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
      const { data: profs, error: e2 } = await sb.from("profiles").select("id,name,phone").in("id", ids);
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
      const { data: profs, error: e2 } = await sb.from("profiles").select("id,name,phone").in("id", ids);
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
      if (passed) {
        const { data: prof, error: e1 } = await sb.from("profiles").select("classes").eq("id", s.user.id).maybeSingle();
        if (e1) throw e1;
        const NCLASS = 5, RS3_IDX = 2;
        let arr = Array.isArray(prof && prof.classes) && prof.classes.length === NCLASS ? [...prof.classes] : Array(NCLASS).fill(false);
        arr[RS3_IDX] = true;
        wrap(await sb.from("profiles").update({ classes:arr }).eq("id", s.user.id));
      }
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
        { data: reqs1, error: e1 }, { data: reqs2, error: e2 },
        { data: discs, error: e3 }, { data: ssds, error: e4 },
        { data: gifts, error: e5 }, { data: roadmaps, error: e6 },
        { data: rs3s, error: e7 },
      ] = await Promise.all([
        sb.from("lts_access_requests").select("profile_id").eq("status", "approved"),
        sb.from("rs3_access_requests").select("profile_id").eq("status", "approved"),
        sb.from("lts_disc_results").select("*").eq("year", year),
        sb.from("lts_ssd_results").select("*").eq("year", year),
        sb.from("lts_gifts_results").select("*").eq("year", year),
        sb.from("lts_roadmap_results").select("*").eq("year", year),
        sb.from("rs3_test_results").select("*").order("created_at", { ascending:false }),
      ]);
      [e1, e2, e3, e4, e5, e6, e7].forEach(e => { if (e) throw e; });
      // Peserta yg dihitung = siapa pun yg akses LTS ATAU RS3-nya PERNAH
      // disetujui (approved) — bukan cuma yg py hasil, spy Admin jg lihat
      // org yg sudah diizinkan tp belum sempat isi apa2 (baris kosong).
      const ids = [...new Set([...(reqs1 || []).map(r => r.profile_id), ...(reqs2 || []).map(r => r.profile_id)])];
      if (!ids.length) return [];
      const { data: profs, error: e8 } = await sb.from("profiles").select("id,name,phone").in("id", ids);
      if (e8) throw e8;
      const findFor = (arr, pid) => (arr || []).find(r => r.profile_id === pid) || null;
      // rs3_test_results: BANYAK baris per orang (riwayat percobaan, lihat
      // v_rs3_test_results.sql) — ambil yg PALING BARU per profil (array
      // sudah diurutkan created_at desc dari query di atas).
      const rs3Latest = {};
      (rs3s || []).forEach(r => { if (!rs3Latest[r.profile_id]) rs3Latest[r.profile_id] = r; });
      return ids.map(id => {
        const prof = (profs || []).find(p => p.id === id) || { id, name:"?", phone:"" };
        return {
          profileId:id, name:prof.name, phone:prof.phone,
          disc: findFor(discs, id), ssd: findFor(ssds, id), gifts: findFor(gifts, id), roadmap: findFor(roadmaps, id),
          rs3: rs3Latest[id] || null,
        };
      });
    },
  };
};

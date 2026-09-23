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
 *    DB.deleteAccessRequest(id)  (Admin saja)
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
  };
};

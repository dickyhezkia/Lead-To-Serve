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
    async listAllAccessRequests() {
      const { data, error } = await sb.from("lts_access_requests")
        .select("id,profile_id,status,requested_at,decided_at,profile:profiles(name,phone)")
        .order("requested_at", { ascending:false });
      if (error) throw error;
      return data || [];
    },
    async decideAccessRequest(id, approve) {
      const s = await this.session();
      wrap(await sb.from("lts_access_requests").update({
        status: approve ? "approved" : "rejected",
        decided_at: new Date().toISOString(),
        decided_by: s.user.id,
      }).eq("id", id));
    },
  };
};

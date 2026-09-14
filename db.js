/* =============================================================================
 *  Lead To Serve 1 · lapisan data Supabase
 *  Dipakai oleh index.html. Butuh @supabase/supabase-js (UMD) sudah dimuat.
 *
 *  window.makeDB(supabaseClient)  →  objek DB dengan:
 *    DB.session() / DB.myProfile()
 *    DB.register({name,phone,password})
 *    DB.login({id,password})  id = No. HP atau nama
 *    DB.logout()
 *    DB.hydrateMine()   → Promise<{profile, disc, ssd, gifts, roadmap}>  (punya saya sendiri)
 *    DB.hydrateAll()    → Promise<{profiles, disc, ssd, gifts, roadmap}> (SEMUA — hanya admin, RLS yg menjaga)
 *    DB.saveDisc/saveSsd/saveGifts/saveRoadmap(profileId, payload)
 *    DB.onChange(cb)    → realtime, kembalikan fungsi unsubscribe
 * ========================================================================== */
window.makeDB = function makeDB(sb) {
  "use strict";
  const EMAIL_DOMAIN = "leadtoserve1.app";   // domain sintetis utk login No. HP/nama — pola sama spt JB3 HOME Tracker
  const toEmail = idOrPhone => {
    const v = String(idOrPhone || "").trim();
    if (v.includes("@")) return v.toLowerCase();
    return `${v.toLowerCase().replace(/[^a-z0-9]/g, "")}@${EMAIL_DOMAIN}`;
  };
  const wrap = ({ data, error }) => { if (error) throw error; return data; };

  const inProfile = r => ({ id:r.id, name:r.name || "", phone:r.phone || "", role:r.role || "peserta", createdAt:r.created_at || null });
  const inDisc = r => ({ id:r.id, picks:r.picks || [], graph1:r.graph1 || null, graph2:r.graph2 || null, graph3:r.graph3 || null, updatedAt:r.updated_at });
  const inSsd = r => ({ id:r.id, answers:r.answers || {}, scores:r.scores || null, updatedAt:r.updated_at });
  const inGifts = r => ({ id:r.id, answers:r.answers || {}, scores:r.scores || null, top3:r.top3 || null, bottom3:r.bottom3 || null, updatedAt:r.updated_at });
  const inRoadmap = r => ({ id:r.id, data:r.data || {}, updatedAt:r.updated_at });

  return {
    async session() { const { data } = await sb.auth.getSession(); return data.session; },

    async myProfile() {
      const s = await this.session();
      if (!s) return null;
      let { data, error } = await sb.from("profiles").select("*").eq("id", s.user.id).maybeSingle();
      if (error) throw error;
      if (!data) {           // trigger blm selesai buat baris profil, tunggu sebentar & coba lagi sekali
        await new Promise(r => setTimeout(r, 800));
        ({ data, error } = await sb.from("profiles").select("*").eq("id", s.user.id).maybeSingle());
        if (error) throw error;
      }
      return data ? inProfile(data) : null;
    },

    async register(p) {
      const loginId = (p.phone && p.phone.trim()) || p.name;
      const email = toEmail(loginId);
      const auth = wrap(await sb.auth.signUp({
        email, password:p.password,
        options: { data: { name:p.name, phone:p.phone || null } },
      }));
      return auth.user.id;
    },

    async login({ id, password }) {
      wrap(await sb.auth.signInWithPassword({ email:toEmail(id), password }));
    },

    async logout() { wrap(await sb.auth.signOut()); },

    async changePassword(newPassword) {
      wrap(await sb.auth.updateUser({ password:newPassword }));
    },

    // ---------- data milik SENDIRI (peserta) ----------
    async hydrateMine() {
      const s = await this.session();
      if (!s) return null;
      const uid = s.user.id;
      const [prof, disc, ssd, gifts, roadmap] = await Promise.all([
        sb.from("profiles").select("*").eq("id", uid).maybeSingle(),
        sb.from("disc_results").select("*").eq("id", uid).maybeSingle(),
        sb.from("ssd_results").select("*").eq("id", uid).maybeSingle(),
        sb.from("gifts_results").select("*").eq("id", uid).maybeSingle(),
        sb.from("roadmap_results").select("*").eq("id", uid).maybeSingle(),
      ]);
      return {
        profile: prof.data ? inProfile(prof.data) : null,
        disc: disc.data ? inDisc(disc.data) : null,
        ssd: ssd.data ? inSsd(ssd.data) : null,
        gifts: gifts.data ? inGifts(gifts.data) : null,
        roadmap: roadmap.data ? inRoadmap(roadmap.data) : null,
      };
    },

    // ---------- SEMUA data (Admin saja — RLS menolak diam2 utk peserta biasa) ----------
    async hydrateAll() {
      const [prof, disc, ssd, gifts, roadmap] = await Promise.all([
        sb.from("profiles").select("*").order("created_at"),
        sb.from("disc_results").select("*"),
        sb.from("ssd_results").select("*"),
        sb.from("gifts_results").select("*"),
        sb.from("roadmap_results").select("*"),
      ]);
      return {
        profiles: wrap(prof).map(inProfile),
        disc: wrap(disc).map(inDisc),
        ssd: wrap(ssd).map(inSsd),
        gifts: wrap(gifts).map(inGifts),
        roadmap: wrap(roadmap).map(inRoadmap),
      };
    },

    // ---------- simpan hasil (upsert baris milik sendiri — RLS yg menjaga id = auth.uid()) ----------
    async saveDisc(id, { picks, graph1, graph2, graph3 }) {
      wrap(await sb.from("disc_results").upsert({ id, picks, graph1, graph2, graph3, updated_at:new Date().toISOString() }));
    },
    async saveSsd(id, { answers, scores }) {
      wrap(await sb.from("ssd_results").upsert({ id, answers, scores, updated_at:new Date().toISOString() }));
    },
    async saveGifts(id, { answers, scores, top3, bottom3 }) {
      wrap(await sb.from("gifts_results").upsert({ id, answers, scores, top3, bottom3, updated_at:new Date().toISOString() }));
    },
    async saveRoadmap(id, { data }) {
      wrap(await sb.from("roadmap_results").upsert({ id, data, updated_at:new Date().toISOString() }));
    },

    onChange(cb) {
      // Realtime yg tahan putus: reconnect otomatis dgn backoff — pola sama spt JB3 HOME Tracker.
      let ch = null, killed = false, tries = 0, t = null;
      const connect = () => {
        if (killed) return;
        ch = sb.channel("lts-all-" + Date.now())
          .on("postgres_changes", { event:"*", schema:"public" }, cb)
          .subscribe(status => {
            if (killed) return;
            if (status === "SUBSCRIBED") { tries = 0; try { cb({ _resync:true }); } catch (e) {} }
            else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              if (ch) { try { sb.removeChannel(ch); } catch (e) {} ch = null; }
              clearTimeout(t);
              t = setTimeout(connect, Math.min(1000 * 2 ** tries++, 15000));
            }
          });
      };
      connect();
      return () => { killed = true; clearTimeout(t); if (ch) { try { sb.removeChannel(ch); } catch (e) {} } };
    },
  };
};

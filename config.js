/* Konfigurasi Supabase — Lead To Serve 1
 * 2026-09-22 (permintaan user, "Opsi C" — lihat memory jb3-mmc-separate-app.md
 * utk pola yg sama dipakai di proyek MMC): aplikasi ini SEKARANG memakai
 * project Supabase yg SAMA dgn JB3 HOME Tracker (bukan project sendiri lagi)
 * — supaya login & data ministry/peserta selalu 1 sumber, tak perlu daftar
 * akun baru. Kode aplikasi ini TETAP terpisah total (repo/file sendiri),
 * cuma "menyambung" ke database yg sama — sama prinsipnya dgn rencana MMC.
 * anon key AMAN dipakai di browser (RLS yang menjaga data).
 */
window.LTS_CONFIG = {
  url:     "https://rnyycigmtqeakryqrrip.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJueXljaWdtdHFlYWtyeXFycmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMjk0NjYsImV4cCI6MjEwMzYwNTQ2Nn0.vblAzFayuimGKmDylKrKMTb49b8PgP-nmm5qmyn090I",
};

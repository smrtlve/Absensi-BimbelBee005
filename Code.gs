// ==============================================================================
// 1. MASUKKAN ID SPREADSHEET KAMU DI SINI
// ==============================================================================
const SPREADSHEET_ID = "1YS-1CSnHAxGZubtE9NNpX95h26Y48nn0-eMyIgwCB-g";

function getDB() {
  try { return SpreadsheetApp.openById(SPREADSHEET_ID); } 
  catch (e) { throw new Error("ID Spreadsheet salah atau akses ditolak."); }
}

/**
 * MENGUBAH GAS MENJADI REST API (Endpoint)
 * Menerima request dari Vercel
 */
function doPost(e) {
  try {
    // Parsing data dari Vercel
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    let responseData = {};

    if (action === "getAppData") {
      responseData = getAppDataAPI();
    } else if (action === "loginAdmin") {
      responseData = loginAdminAPI(payload.username, payload.password);
    } else if (action === "catatKehadiran") {
      responseData = catatKehadiranAPI(payload.idAtauNama, payload.tipe);
    } else {
      throw new Error("Action tidak dikenali.");
    }

    // Kembalikan respons dalam bentuk JSON
    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: responseData }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Tes API via Browser (Jika URL dibuka langsung)
 */
function doGet(e) {
  return ContentService.createTextOutput("Backend SmartAbsen API Berjalan Normal. Silakan gunakan POST request dari Vercel.");
}


// --- FUNGSI DATABASE INTI ---

function getAppDataAPI() {
  const ss = getDB();
  
  // Data Siswa
  const sheetSiswa = ss.getSheetByName('Siswa');
  const dSiswa = sheetSiswa.getDataRange().getValues(); dSiswa.shift(); 
  const dataSiswa = [];
  dSiswa.forEach(r => {
    if (r[0] && r[0].toString().trim() !== "") {
      dataSiswa.push({
        id: String(r[0]||""), nama: String(r[1]||""), wali: String(r[2]||""), 
        hp: String(r[3]||""), pin: String(r[4]||""), jenjang: String(r[5]||"")
      });
    }
  });

  // Data Tarif
  const sheetTarif = ss.getSheetByName('Tarif');
  const dTarif = sheetTarif.getDataRange().getValues(); dTarif.shift();
  const dataTarif = [];
  dTarif.forEach(r => {
    if (r[0] && r[0].toString().trim() !== "") {
      dataTarif.push({
        nama: String(r[0]||""), jenjang: String(r[1]||""), hari: String(r[2]||""), 
        reg: Number(r[3])||0, over: Number(r[4])||0
      });
    }
  });

  // Data Log
  const sheetLog = ss.getSheetByName('Kehadiran');
  const dLog = sheetLog.getDataRange().getValues(); dLog.shift();
  const dataLog = [];
  dLog.forEach(r => {
    if (r[1] && r[1].toString().trim() !== "") { 
      let tglFormatted = String(r[1]);
      let namaHari = "-";
      try {
        let tglObj = new Date(r[1]);
        if (!isNaN(tglObj.getTime())) {
           namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][tglObj.getDay()];
           tglFormatted = Utilities.formatDate(tglObj, Session.getScriptTimeZone(), "dd MMM yyyy HH:mm");
        }
      } catch(e) {}
      dataLog.push({
        idSiswa: String(r[2]||""), nama: String(r[3]||""), hari: namaHari, tgl: tglFormatted, 
        status: String(r[4]||"Hadir"), reg: Number(r[5])||0, over: Number(r[6])||0, bulan: String(r[7]||"")
      });
    }
  });

  return { siswa: dataSiswa, tarif: dataTarif, log: dataLog };
}

function loginAdminAPI(username, password) {
  const sheetAdmin = getDB().getSheetByName('Admin');
  const data = sheetAdmin.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString() === String(username) && data[i][1].toString() === String(password)) {
      return { auth: true, message: "Login Berhasil" };
    }
  }
  return { auth: false, message: "Username atau Password salah!" };
}

function catatKehadiranAPI(idAtauNama, tipe) {
  const ss = getDB();
  const sheetSiswa = ss.getSheetByName('Siswa');
  const sheetAbsen = ss.getSheetByName('Kehadiran');
  const dataSiswa = sheetSiswa.getDataRange().getValues();
  
  const siswa = dataSiswa.find(r => 
    (r[0] && r[0].toString().toLowerCase() === String(idAtauNama).toLowerCase()) || 
    (r[1] && r[1].toString().toLowerCase() === String(idAtauNama).toLowerCase())
  );
  if (!siswa) throw new Error("Data Siswa tidak ditemukan di Database!");

  const idLog = 'LOG-' + new Date().getTime();
  const timestamp = new Date();
  const bulan = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "yyyy-MM");
  
  let tarifReg = tipe === 'Hadir' ? 35000 : 0;
  let tarifOver = tipe === 'Overtime' ? 50000 : 0;
  
  sheetAbsen.appendRow([idLog, timestamp, siswa[0], siswa[1], tipe, tarifReg, tarifOver, bulan]);
  return { success: true, message: `Absensi ${siswa[1]} (${tipe}) Berhasil!` };
}

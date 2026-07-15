// Google Apps Script - Form Submission Handler (v2)
// POST langsung ke Supabase, tidak perlu n8n

const SUPA_URL = "https://tpkgmixemhnxwznolaeq.supabase.co";
const SUPA_KEY = "***"; // GANTI dengan SUPABASE_SERVICE_KEY

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    
    const payload = {
      event_type: body.type || "new",
      timestamp: body.timestamp || new Date().toISOString(),
      nama: body.nama || "Tidak Diketahui",
      divisi: body.divisi || "-",
      jabatan: body.jabatan || "-",
      alasan: body.alasan || "-",
      raw_payload: JSON.stringify(body)
    };

    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "apikey": SUPA_KEY,
        "Authorization": "Bearer " + SUPA_KEY,
        "Prefer": "return=representation"
      },
      payload: JSON.stringify(payload)
    };

    const response = UrlFetchApp.fetch(SUPA_URL + "/rest/v1/form_submissions", options);
    const result = JSON.parse(response.getContentText());
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      id: result[0]?.id,
      message: "Data tersimpan. Notifikasi WA akan dikirim dalam maksimal 1 menit."
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

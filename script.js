/* ============================================================
   SURABAYA TRIP — script.js
   Handles: mobile nav, booking modal (3 steps), payment tabs,
   file upload preview, e-ticket generation, WhatsApp integration
   ============================================================ */

/* ===== CONFIG ===== */
// 🔥 PERBAIKAN: Gunakan if (!window.SUPABASE_URL) untuk cegah deklarasi ulang
if (typeof window.SUPABASE_URL === 'undefined') {
    window.SUPABASE_URL = "https://mbztqucbxsxsqazokwwz.supabase.co";
    window.SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ienRxdWNieHN4c3Fhem9rd3d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMjc4NjIsImV4cCI6MjA5NzYwMzg2Mn0.qyr11Su8LNgdUqmcj2qxletujl4KM8dAxkcAIXlv-n4";
}

// 🔥 PERBAIKAN: Gunakan supabaseClient (bukan supabase)
if (typeof window.supabaseClient === 'undefined' && window.supabase) {
    window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
}

const WA_NUMBER = "6285746044128";

/* ===== STATE ===== */
let currentPackage = "";
let currentPrice = "";
let currentBookingId = "";
let proofFileName = "";

/* ===== DOM READY ===== */
document.addEventListener("DOMContentLoaded", () => {
  // Sinkronisasi dropdown dengan currentPackage
  const packageSelect = document.getElementById("bPackageSelect");
  if (packageSelect) {
    packageSelect.addEventListener("change", function() {
      currentPackage = this.value;
      // Update label juga
      const label = document.getElementById("selectedPackageLabel");
      if (label) {
        label.textContent = `Package: ${this.value} — ${currentPrice || "Price"}`;
      }
    });
  }

  // Drag & drop setup
  setupDragAndDrop();
});

/* ===== MOBILE NAV ===== */
function toggleMenu() {
  document.getElementById("mobileMenu").classList.toggle("open");
}
function closeMenu() {
  document.getElementById("mobileMenu").classList.remove("open");
}

window.addEventListener("resize", () => {
  if (window.innerWidth > 768) closeMenu();
});

/* ===== NAVBAR SCROLL EFFECT ===== */
const navbar = document.getElementById("navbar");
window.addEventListener("scroll", () => {
  if (window.scrollY > 30) {
    navbar.style.boxShadow = "0 4px 24px rgba(0,0,0,0.25)";
  } else {
    navbar.style.boxShadow = "none";
  }
});

/* ===== BOOKING MODAL ===== */
function openBooking(packageName, price) {
  currentPackage = packageName;
  currentPrice = price;

  // Update label
  document.getElementById("selectedPackageLabel").textContent = `Package: ${packageName} — ${price}`;
  
  // Sinkronkan dropdown dengan package yang dipilih
  const packageSelect = document.getElementById("bPackageSelect");
  if (packageSelect) {
    // Cari option yang sesuai
    for (let option of packageSelect.options) {
      if (option.value === packageName) {
        packageSelect.value = packageName;
        break;
      }
    }
  }

  document.getElementById("bookingModal").classList.add("open");
  document.body.style.overflow = "hidden";

  goToStep(1);
  closeMenu();
}

function closeBooking() {
  document.getElementById("bookingModal").classList.remove("open");
  document.body.style.overflow = "";
}

function closeIfOverlay(e) {
  if (e.target.id === "bookingModal") closeBooking();
}

function goToStep(stepNumber) {
  document.querySelectorAll(".modal-step").forEach(s => s.classList.remove("active"));
  document.getElementById("step" + stepNumber).classList.add("active");
  document.querySelector(".modal-box").scrollTop = 0;
}

/* ===== FUNGSI SUBMIT BOOKING KE SUPABASE ===== */
async function submitBookingToSupabase(data) {
  try {
    // 🔥 PERBAIKAN: Sesuaikan dengan struktur tabel yang ada
    // Tabel: id, booking_code, full_name, email, whatsapp, nationality, 
    //        package_name, passengers, ship_name, arrival_date, departure_time,
    //        notes, payment_method, payment_proof, booking_status, created_at
    
    const bookingData = {
      booking_code: data.booking_code,
      full_name: data.full_name,
      email: data.email,
      whatsapp: data.whatsapp,
      nationality: data.nationality,
      package_name: data.package_name,
      passengers: data.passengers,
      ship_name: data.ship_name,
      arrival_date: data.arrival_date,
      departure_time: data.departure_time,
      notes: data.special_requests || "", // Gunakan notes, bukan special_requests
      payment_method: data.payment_method || "",
      payment_proof: data.payment_proof || "",
      booking_status: data.booking_status || "pending"
      // created_at akan otomatis diisi oleh database (DEFAULT NOW())
    };
    
    console.log("📤 Sending data to Supabase:", bookingData);
    
    const { error } = await window.supabaseClient
      .from("bookings")
      .insert([bookingData]);

    if (error) {
      console.error("❌ Supabase Error:", error);
      showToast("Gagal menyimpan data booking! Error: " + (error.message || "Silakan coba lagi."));
      return false;
    } else {
      console.log("✅ Booking saved successfully!");
      showToast("Booking berhasil disimpan!");
      currentBookingId = data.booking_code;
      return true;
    }
  } catch (err) {
    console.error("❌ Error:", err);
    showToast("Terjadi kesalahan. Silakan coba lagi.");
    return false;
  }
}

/* ===== STEP 1 -> STEP 2 (validate personal info + save to Supabase) ===== */
async function goToPayment() {
  // Validasi field
  const required = [
    { id: "bName", label: "Full Name" },
    { id: "bWa", label: "WhatsApp Number" },
    { id: "bEmail", label: "Email Address" },
    { id: "bNation", label: "Nationality" },
    { id: "bPassport", label: "Passport Number" },
    { id: "bPax", label: "Number of Passengers" },
    { id: "bShip", label: "Ship Name" },
    { id: "bDate", label: "Port Arrival Date" },
    { id: "bDepTime", label: "Ship Departure Time" }
  ];

  for (const field of required) {
    const el = document.getElementById(field.id);
    if (!el.value.trim()) {
      showToast(`Please fill in: ${field.label}`);
      el.focus();
      return;
    }
  }

  const email = document.getElementById("bEmail").value.trim();
  if (!email.includes("@") || !email.includes(".")) {
    showToast("Please enter a valid email address");
    document.getElementById("bEmail").focus();
    return;
  }

  // Generate booking code
  const bookingCode = "ST" + Date.now().toString().slice(-6);
  currentBookingId = bookingCode;

  // Kumpulkan data booking - SESUAIKAN dengan struktur tabel
  const data = {
    booking_code: bookingCode,
    full_name: document.getElementById("bName").value.trim(),
    email: document.getElementById("bEmail").value.trim(),
    whatsapp: document.getElementById("bWa").value.trim(),
    nationality: document.getElementById("bNation").value.trim(),
    // Passport number tidak ada di tabel, tapi kita simpan di notes
    passport_number: document.getElementById("bPassport").value.trim(),
    package_name: currentPackage,
    passengers: parseInt(document.getElementById("bPax").value.trim()),
    ship_name: document.getElementById("bShip").value.trim(),
    arrival_date: document.getElementById("bDate").value,
    departure_time: document.getElementById("bDepTime").value,
    special_requests: document.getElementById("bNotes").value.trim() || "",
    price: currentPrice,
    booking_status: "pending",
    payment_method: "",
    payment_proof: ""
  };

  // Kirim ke Supabase
  const success = await submitBookingToSupabase(data);
  
  if (!success) {
    return;
  }

  // Tampilkan summary
  const name = document.getElementById("bName").value.trim();
  const pax = document.getElementById("bPax").value.trim();
  const date = document.getElementById("bDate").value;

  document.getElementById("paymentSummary").innerHTML = `
    <p><strong>Package:</strong> ${currentPackage}</p>
    <p><strong>Passenger:</strong> ${name} (${pax} pax)</p>
    <p><strong>Tour Date:</strong> ${formatDate(date)}</p>
    <p><strong>Total Price:</strong> ${currentPrice}</p>
    <p style="margin-top:8px; color:var(--coral); font-size:13px;">
      ✅ Booking Code: ${currentBookingId}
    </p>
    <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
      Passport: ${document.getElementById("bPassport").value.trim()}
    </p>
  `;

  goToStep(2);
}

/* ===== PAYMENT METHOD TABS ===== */
function switchPm(method, tabEl) {
  document.querySelectorAll(".pm-tab").forEach(t => t.classList.remove("active"));
  tabEl.classList.add("active");

  document.querySelectorAll(".pm-content").forEach(c => c.classList.remove("active"));
  document.getElementById(method === "qris" ? "pmQris" : "pmTransfer").classList.add("active");
}

/* ===== COPY BANK ACCOUNT NUMBER ===== */
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("Account number copied!");
  }).catch(() => {
    showToast("Could not copy. Please copy manually: " + text);
  });
}

/* ===== PROOF UPLOAD PREVIEW ===== */
function previewProof(input) {
  const file = input.files[0];
  const previewBox = document.getElementById("proofPreview");
  const uploadText = document.getElementById("uploadText");

  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast("File too large. Max 5MB.");
    input.value = "";
    return;
  }

  proofFileName = file.name;
  uploadText.textContent = `✓ ${file.name}`;
  document.getElementById("uploadArea").style.borderColor = "var(--coral)";

  previewBox.classList.remove("hidden");

  if (file.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = e => {
      previewBox.innerHTML = `<img src="${e.target.result}" alt="Payment proof preview"/>`;
    };
    reader.readAsDataURL(file);
  } else {
    previewBox.innerHTML = `<p>📄 ${file.name} (PDF attached)</p>`;
  }
}

/* ===== STEP 2 -> STEP 3 (validate payment proof + submit) ===== */
function submitBooking() {
  const proofInput = document.getElementById("bProof");
  if (!proofInput.files || proofInput.files.length === 0) {
    showToast("Please upload your payment proof before submitting");
    return;
  }

  updateBookingStatus(currentBookingId, "payment_uploaded");

  buildETicket();
  goToStep(3);
}

/* ===== UPDATE BOOKING STATUS ===== */
async function updateBookingStatus(bookingCode, status) {
  try {
    const { error } = await window.supabaseClient
      .from("bookings")
      .update({ 
        booking_status: status, 
        payment_proof: proofFileName 
      })
      .eq("booking_code", bookingCode);

    if (error) {
      console.error("Error updating status:", error);
    } else {
      console.log("✅ Booking status updated:", status);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

/* ===== BUILD E-TICKET ===== */
function buildETicket() {
  const name = document.getElementById("bName").value.trim();
  const pax = document.getElementById("bPax").value.trim();
  const ship = document.getElementById("bShip").value.trim();
  const date = document.getElementById("bDate").value;
  const depTime = document.getElementById("bDepTime").value;
  const passport = document.getElementById("bPassport").value.trim();

  document.getElementById("eticketBox").innerHTML = `
    <div class="eticket-header">
      <span class="eticket-title">⚓ Surabaya Trip</span>
      <span class="eticket-tag">PENDING VERIFICATION</span>
    </div>
    <div class="eticket-row"><span>Booking Code</span><span><strong>${currentBookingId}</strong></span></div>
    <div class="eticket-row"><span>Passenger Name</span><span>${escapeHtml(name)}</span></div>
    <div class="eticket-row"><span>Passport</span><span>${escapeHtml(passport)}</span></div>
    <div class="eticket-row"><span>Package</span><span>${escapeHtml(currentPackage)}</span></div>
    <div class="eticket-row"><span>Passengers</span><span>${escapeHtml(pax)} pax</span></div>
    <div class="eticket-row"><span>Ship Name</span><span>${escapeHtml(ship)}</span></div>
    <div class="eticket-row"><span>Tour Date</span><span>${formatDate(date)}</span></div>
    <div class="eticket-row"><span>Ship Departure</span><span>${escapeHtml(depTime)}</span></div>
    <div class="eticket-row"><span>Total Price</span><span>${escapeHtml(currentPrice)}</span></div>
    <div class="eticket-id">Booking ID: ${currentBookingId}</div>
  `;
}

/* ===== SEND BOOKING TO WHATSAPP ===== */
function sendToWA() {
  const name = document.getElementById("bName").value.trim();
  const wa = document.getElementById("bWa").value.trim();
  const email = document.getElementById("bEmail").value.trim();
  const nation = document.getElementById("bNation").value.trim();
  const passport = document.getElementById("bPassport").value.trim();
  const pax = document.getElementById("bPax").value.trim();
  const ship = document.getElementById("bShip").value.trim();
  const date = document.getElementById("bDate").value;
  const depTime = document.getElementById("bDepTime").value;
  const notes = document.getElementById("bNotes").value.trim();

  const message =
`New Booking Request — Surabaya Trip

Booking ID: ${currentBookingId}
Package: ${currentPackage} (${currentPrice})

--- Passenger Info ---
Name: ${name}
WhatsApp: ${wa}
Email: ${email}
Nationality: ${nation}
Passport: ${passport}
Passengers: ${pax} pax

--- Ship Info ---
Ship Name: ${ship}
Tour Date: ${formatDate(date)}
Departure Time: ${depTime}

Special Requests: ${notes || "None"}

Payment proof file: ${proofFileName || "Attached in form (please send manually if not received)"}

Please confirm my booking and send the e-ticket. Thank you!`;

  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

/* ===== CONTACT FORM -> WHATSAPP ===== */
function sendContactWA(e) {
  e.preventDefault();

  const name = document.getElementById("cName").value.trim();
  const wa = document.getElementById("cWa").value.trim();
  const msg = document.getElementById("cMsg").value.trim();

  const message =
`Hello Surabaya Trip!

Name: ${name}
WhatsApp: ${wa}

Message: ${msg}`;

  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");

  showToast("Redirecting you to WhatsApp...");
  e.target.reset();
}

/* ===== TOAST NOTIFICATION ===== */
let toastTimer;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}

/* ===== HELPERS ===== */
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  return d.toLocaleDateString("en-US", options);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ===== CLOSE MODAL WITH ESC KEY ===== */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("bookingModal");
    if (modal.classList.contains("open")) closeBooking();
  }
});

/* ===== DRAG & DROP FOR FILE UPLOAD ===== */
function setupDragAndDrop() {
  const uploadArea = document.getElementById("uploadArea");
  const fileInput = document.getElementById("bProof");

  if (!uploadArea || !fileInput) return;

  uploadArea.addEventListener("click", () => fileInput.click());

  ["dragenter", "dragover"].forEach(evt => {
    uploadArea.addEventListener(evt, (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = "var(--coral)";
      uploadArea.style.background = "var(--coral-pale)";
    });
  });

  ["dragleave", "drop"].forEach(evt => {
    uploadArea.addEventListener(evt, (e) => {
      e.preventDefault();
      uploadArea.style.background = "";
    });
  });

  uploadArea.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) {
      fileInput.files = e.dataTransfer.files;
      previewProof(fileInput);
    }
  });
}
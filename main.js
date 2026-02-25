import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  get,
  push,
  update,
  onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyC6h88OX0rD2V2cI9wunZ838BDt4IwjUcg",
    authDomain: "shop-adfbb.firebaseapp.com",
    databaseURL: "https://shop-adfbb-default-rtdb.firebaseio.com",
    projectId: "shop-adfbb",
    storageBucket: "shop-adfbb.firebasestorage.app",
    messagingSenderId: "783316092198",
    appId: "1:783316092198:web:e199e1c12cdf81e924ade7",
    measurementId: "G-K2JNSQBPX2"
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const messageEl = document.getElementById("message");

const authBox = document.getElementById("authBox");
const dashboard = document.getElementById("dashboard");
const STOCK_CACHE_KEY = "cp_stock_cache_v1";
let visibleCount = 100;
let filteredStock = [];





document.getElementById("registerBtn").onclick = async () => {
  try {
    const userCred = await createUserWithEmailAndPassword(
      auth,
      emailEl.value,
      passwordEl.value
    );

    await sendEmailVerification(userCred.user);

    // Create profile in Realtime DB
    await set(ref(db, "users/" + userCred.user.uid), {
      email: userCred.user.email,
      role: "admin",
      createdAt: Date.now()
    });

    messageEl.innerText = "Verification email sent. Check inbox.";
  } catch (err) {
    messageEl.innerText = err.message;
  }
};


document.getElementById("loginBtn").onclick = async () => {
  try {
    const userCred = await signInWithEmailAndPassword(
      auth,
      emailEl.value,
      passwordEl.value
    );

    if (!userCred.user.emailVerified) {
      messageEl.innerText = "Verify email first.";
      await signOut(auth);
      return;
    }

    showDashboard();
  } catch (err) {
    messageEl.innerText = err.message;
  }
};

document.getElementById("logoutBtn").onclick = async () => {
  await signOut(auth);
};

onAuthStateChanged(auth, async (user) => {
  if (user && user.emailVerified) {

    const snapshot = await get(ref(db, "users/" + user.uid));

    if (!snapshot.exists()) {
      await set(ref(db, "users/" + user.uid), {
        email: user.email,
        role: "admin",
        createdAt: Date.now()
      });
    }

    showDashboard();
  } else {
    authBox.style.display = "block";
    dashboard.style.display = "none";
  }
});

function showDashboard() {
  authBox.style.display = "none";
  dashboard.style.display = "block";
}









document.getElementById("forgotBtn").onclick = async () => {
  try {
    await sendPasswordResetEmail(auth, emailEl.value);
    messageEl.innerText = "Password reset email sent.";
  } catch (err) {
    messageEl.innerText = err.message;
  }
};









// Add / update stock


const partName = document.getElementById("partName");
const partModel = document.getElementById("partModel");
const partQty = document.getElementById("partQty");
const partCost = document.getElementById("partCost");
const minStock = document.getElementById("minStock");

document.getElementById("addStockBtn").onclick = async () => {

  const name = partName.value.trim();
  const modelInput = partModel.value.trim(); // comma separated
  const qty = Number(partQty.value);
  const cost = Number(partCost.value);
  const min = Number(minStock.value);

  if(!name || !modelInput || !qty){
    alert("Fill required fields");
    return;
  }

  // 🔹 Convert comma separated models into object
  const models = modelInput.split(",");
  const compatible = {};

  models.forEach(m => {
    compatible[m.trim().toUpperCase()] = true;
  });

  // 🔹 Create unique ID based on part name (NOT model)
  const id = name.replace(/\s+/g, "_").toLowerCase();

  await update(ref(db, "stock/" + id), {
    name,
    compatibleModels: compatible,
    quantity: qty,
    cost,
    minStock: min,
    updatedAt: Date.now()
  });
  history.back()

};


// Load stock list

const stockList = document.getElementById("stockList");
const jobPartSelect = document.getElementById("jobPartSelect");

onValue(ref(db, "stock"), snapshot => {

  stockList.innerHTML = "";
  jobPartSelect.innerHTML = "";

  const data = snapshot.val();
  if(!data) return;

  Object.entries(data).forEach(([id, item]) => {

  const low = item.quantity <= item.minStock;

  const models = Object.keys(item.compatibleModels || {}).join(", ");

  stockList.innerHTML += `
    <div>
      ${item.name} (${models}) - Qty: ${item.quantity}
      ${low ? "<span style='color:red;'> LOW</span>" : ""}
    </div>
  `;

  jobPartSelect.innerHTML += `
    <option value="${id}">
      ${item.name} (${models})
    </option>
  `;
});

});



// Create Job (Auto Deduct)

document.getElementById("createJobBtn").onclick = async () => {

  const partId = jobPartSelect.value;
  const usedQty = Number(document.getElementById("jobQty").value);

  const stockSnap = await get(ref(db, "stock/" + partId));
  const stockData = stockSnap.val();

  if(!stockData || stockData.quantity < usedQty){
    alert("Not enough stock");
    return;
  }

  // Deduct stock
  await update(ref(db, "stock/" + partId), {
    quantity: stockData.quantity - usedQty
  });

  // Create job record
  await push(ref(db, "jobs"), {
    customer: document.getElementById("jobCustomer").value,
    device: document.getElementById("jobModel").value,
    usedPart: partId,
    qty: usedQty,
    createdAt: Date.now()
  });

  // Log stock movement
  await push(ref(db, "stockLogs"), {
    partId,
    change: -usedQty,
    type: "JOB_USE",
    createdAt: Date.now()
  });

};


// search logic
const stockSearch = document.getElementById("stockSearch");
let allStockData = {};

// 1️⃣ Load from localStorage first
const cachedStock = localStorage.getItem(STOCK_CACHE_KEY);

if (cachedStock) {
  try {
    allStockData = JSON.parse(cachedStock);
    renderStock(allStockData);
  } catch (err) {
    console.error("Cache parse error");
  }
}

// 2️⃣ Then listen realtime from Firebase
onValue(ref(db, "stock"), snapshot => {

  allStockData = snapshot.val() || {};

  // Update UI
  renderStock(allStockData);

  // Save fresh copy to localStorage
  localStorage.setItem(
    STOCK_CACHE_KEY,
    JSON.stringify(allStockData)
  );

});

//render fiunction 
function renderStock(data, searchTerm = "") {

  stockList.innerHTML = "";

  const rawSearch = searchTerm.trim().toUpperCase();
  const keywords = rawSearch.split(/\s+/).filter(Boolean);

  // Convert object → array
  const entries = Object.entries(data);

  // Apply search filter
  filteredStock = entries.filter(([id, item]) => {

    const models = Object.keys(item.compatibleModels || {});
    const searchableText = (
      item.name + " " + models.join(" ")
    ).toUpperCase();

    return keywords.every(keyword =>
      searchableText.includes(keyword)
    );
  });

  // Reset visibleCount when searching
  if (searchTerm) visibleCount = filteredStock.length;

  // Render only visibleCount
  filteredStock.slice(0, visibleCount).forEach(([id, item]) => {

    const models = Object.keys(item.compatibleModels || {});
    const modelSpans = models
      .map(m => `<span class="model-badge">${m}</span>`)
      .join("");

    const low = item.quantity <= item.minStock;

    stockList.innerHTML += `
      <div class='list-item'>
        <p class='name'>${item.name}</p>
        <div class='models'>${modelSpans}</div>
        <div class="qty-control">
          <button class="qty-btn minus" data-id="${id}">-</button>
          <span class="${low ? 'low-count' : 'stock-count'}">
            ${item.quantity}
          </span>
          <button class="qty-btn plus" data-id="${id}">+</button>
        </div>
      </div>
    `;
  });

}


// infinity scroll

window.addEventListener("scroll", () => {

  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100) {

    if (visibleCount < filteredStock.length) {
      visibleCount += 100;
      renderStock(allStockData, stockSearch.value);
    }

  }

});

//


stockList.onclick = async (e) => {

  if (!e.target.classList.contains("qty-btn")) return;

  const partId = e.target.dataset.id;
  const isPlus = e.target.classList.contains("plus");

  const snap = await get(ref(db, "stock/" + partId));
  const item = snap.val();

  if (!item) return;

  let newQty = item.quantity;

  if (isPlus) {
    newQty += 1;
  } else {
    if (item.quantity <= 0) return; // prevent negative
    newQty -= 1;
  }

  await update(ref(db, "stock/" + partId), {
    quantity: newQty,
    updatedAt: Date.now()
  });

  // Log movement
  await push(ref(db, "stockLogs"), {
    partId,
    change: isPlus ? 1 : -1,
    type: "MANUAL_ADJUST",
    createdAt: Date.now()
  });

};


// listen to search input
stockSearch.addEventListener("input", e => {
  renderStock(allStockData, e.target.value);
});




// router function 

const pages = document.querySelectorAll(".page");

function showPage(pageId) {
  
  pages.forEach(p => p.classList.add("hidden"));
  
  const target = document.getElementById(pageId);
  
  if (target) {
    target.classList.remove("hidden");
  } else {
    document.getElementById("home").classList.remove("hidden");
  }
  
}

// hash change listener

function router() {
  
  const hash = window.location.hash.replace("#", "") || "home";
  showPage(hash);
  
}

window.addEventListener("hashchange", router);
window.addEventListener("load", router);

document.querySelector('#fab').onclick=()=>location.hash='add-item'







/* KEEP IT BOTTOM*/
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}



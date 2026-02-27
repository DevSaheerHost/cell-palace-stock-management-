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

const bottomNavs = document.querySelectorAll('#bottomNav span')


const authBox = document.getElementById("authBox");
const dashboard = document.getElementById("dashboard");
const STOCK_CACHE_KEY = "cp_stock_cache_v1";
let visibleCount = 100;
let filteredStock = [];
let currentFilter = "all"; // "all" | "low"
let editingId = null;



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

    history.replaceState(null, null, "#home");

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
    history.replaceState(null, null, "#auth");
router();
  }
});

function showDashboard() {
     //history.replaceState(null, null, "#home");
     showPage('home');
  
     

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
  //const id = name.replace(/\s+/g, "_").toLowerCase();
  const id = editingId 
  ? editingId 
  : name.replace(/\s+/g, "_").toLowerCase();

  await update(ref(db, "stock/" + id), {
    name,
    compatibleModels: compatible,
    quantity: qty,
    cost,
    minStock: min,
    updatedAt: Date.now()
  });
  history.back()
  editingId = null;
  
  partName.value = ''
  partModel.value = ''
  partQty.value = ''
  partCost.value = ''
  minStock.value = ''
};


// Load stock list

const stockList = document.getElementById("stockList");
const jobPartSelect = document.getElementById("jobPartSelect");

const jobPartInput = document.getElementById("jobPartInput");
const suggestions = document.getElementById("suggestions");
const selectedPartId = document.getElementById("selectedPartId");

let stockItems = [];

onValue(ref(db, "stock"), snapshot => {
  const data = snapshot.val();
  if (!data) return;

  stockItems = Object.entries(data).map(([id, item]) => {
    return {
      id,
      name: item.name,
      models: Object.keys(item.compatibleModels || {}).join(", "),
      quantity: item.quantity,
      minStock: item.minStock
    };
  });
});



jobPartInput.addEventListener("input", () => {
  const value = jobPartInput.value.toLowerCase();
  suggestions.innerHTML = "";

  if (!value) return;

  const filtered = stockItems.filter(item =>
    item.name.toLowerCase().includes(value) ||
    item.models.toLowerCase().includes(value)
  );

  filtered.forEach(item => {
    const div = document.createElement("div");
    if (item.quantity === 0) {
  div.classList.add("outof-stock");
}
    const modelSpans = item.models
  .split(",")
  .map(model => `<span class="model-tag">${model.trim()}</span>`)
  .join(" ");
      const low = item.quantity <= item.minStock;

    div.innerHTML = `
    ${item.name} 
    <br>
    <span>${modelSpans}</span> -  <p class='qty ${low?'low':''} ${item.minStock==0?'empty': ''}'>${item.quantity}</p>`;
    
    div.onclick = () => {
      jobPartInput.value = `${item.name} (${item.models})`;
      selectedPartId.value = item.id;
      suggestions.innerHTML = "";
    };

    suggestions.appendChild(div);
  });
});



// Create Job (Auto Deduct)

document.getElementById("createJobBtn").onclick = async () => {

  //const partId = jobPartSelect.value;
  const partId = document.getElementById("selectedPartId").value;
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
  //document.querySelector('#fab').classList.remove('hidden')
  document.querySelector('#bottomNavContainer').classList.remove('hidden')
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

  // 🔥 SORT by latest updated
  const entries = Object.entries(data)
    .sort((a, b) => {
      const aTime = a[1].updatedAt || 0;
      const bTime = b[1].updatedAt || 0;
      return bTime - aTime;
    });
    
//     const lowCount = Object.values(data).filter(item =>
//   item.quantity <= item.minStock
// ).length;



// const totalItems = Object.keys(data).length;
// const totalQuantity = Object.values(data)
//   .reduce((sum, item) => sum + (item.quantity || 0), 0);





const values = Object.values(data);

// Total different products
const totalItems = values.length;

// Total physical pieces
const totalQuantity = values.reduce(
  (sum, item) => sum + (item.quantity || 0), 0
);

// Low stock count
const lowCount = values.filter(item =>
  item.quantity <= item.minStock
).length;

// Last updated
let lastUpdatedItem = null;

Object.values(data).forEach(item => {
  if (!lastUpdatedItem || 
      (item.updatedAt || 0) > (lastUpdatedItem.updatedAt || 0)) {
    lastUpdatedItem = item;
  }
});

const lastUpdatedName = lastUpdatedItem
  ? lastUpdatedItem.name
  : "—";


document.getElementById("lowCount").innerText = lowCount;
document.getElementById("lowCount2").innerText = lowCount;
document.getElementById("lastUpdated").innerText = lastUpdatedName;
document.getElementById("totalCount").innerText = `${totalItems}, Number of spares : ${totalQuantity}`;





  // 🔍 Filter
  filteredStock = entries.filter(([id, item]) => {

  const models = Object.keys(item.compatibleModels || {});
  const searchableText = (
    item.name + " " + models.join(" ")
  ).toUpperCase();

  const matchesSearch = keywords.every(keyword =>
    searchableText.includes(keyword)
  );

  const isLowStock = item.quantity <= item.minStock;

  if (currentFilter === "low" && !isLowStock) {
    return false;
  }

  return matchesSearch;
});

  if (searchTerm) visibleCount = filteredStock.length;

  // 🔢 Render limited
  filteredStock.slice(0, visibleCount).forEach(([id, item]) => {

    const models = Object.keys(item.compatibleModels || {});
    const modelSpans = models
      .map(m => `<span class="model-badge">${m}</span>`)
      .join("");

    const low = item.quantity <= item.minStock;
    
const isOut = item.quantity === 0;
const isLow = item.quantity > 0 && item.quantity <= item.minStock;
    stockList.innerHTML += `
  <div class='list-item ${isOut ? 'outof-stock' : ''}'>
    <p class='name'>${item.name}</p>
    <div class='models'>${modelSpans}</div>

    <div class="qty-control">
      <button class="qty-btn minus" data-id="${id}">-</button>
      <span class="${isLow ? 'low-count' : isOut? 'out-count' : 'stock-count'}">
        ${item.quantity}
      </span>
      <button class="qty-btn plus" data-id="${id}">+</button>
    </div>

    <button class="edit-btn" data-id="${id}">Edit</button>

    ${
      isOut
        ? `<p class='out'>Out of stock</p>`
        : isLow
        ? `<p class='low'>Low stock</p>`
        : ''
    }

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

  //if (!e.target.classList.contains("qty-btn")) return;
  const editBtn = e.target.closest(".edit-btn");
if (editBtn) {
  const partId = editBtn.dataset.id;
  startEdit(partId);
  return;
}

const qtyBtn = e.target.closest(".qty-btn");
if (!qtyBtn) return;

  const partId = qtyBtn.dataset.id;
const isPlus = qtyBtn.classList.contains("plus");

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




// startEdit Function
function startEdit(partId) {

  const item = allStockData[partId];
  if (!item) return;

  editingId = partId;

  partName.value = item.name;
  partModel.value = Object.keys(item.compatibleModels || {}).join(", ");
  partQty.value = item.quantity;
  partCost.value = item.cost || "";
  minStock.value = item.minStock || "";

  location.hash = "add-item";
}


// listen to search input
stockSearch.addEventListener("input", e => {
  renderStock(allStockData, e.target.value);
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
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






// filter by header filter
const allBtn = document.querySelector(".all");
const lowBtn = document.querySelector(".low");

allBtn.onclick = () => {
  currentFilter = "all";
  allBtn.classList.add("active");
  lowBtn.classList.remove("active");
  renderStock(allStockData, stockSearch.value);
};

lowBtn.onclick = () => {
  currentFilter = "low";
  lowBtn.classList.add("active");
  allBtn.classList.remove("active");
  renderStock(allStockData, stockSearch.value);
};




/* KEEP IT BOTTOM*/
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}




// bottom nav


bottomNavs.forEach(n=>{
  n.onclick = (e)=>{
    const link = e.currentTarget.dataset.link;
   //location.hash = link
    bottomNavs.forEach(e=>e.classList.remove('active'))
    e.currentTarget.classList.add('active')
  // location.replace(`/#${link}`)
  history.replaceState(null, null, `#${link}`)
  router()
  }
});
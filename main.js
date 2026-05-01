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
const GIZMOS_CACHE_KEY = 'cp_gizmos_cache_v1';
const TECHNICIAN_NAME_KEY = 'technician_name';
const USER_NAME_KEY = 'user_name'
let visibleCount = 100;
let filteredStock = [];
let currentFilter = "all"; // "all" | "low"
let editingId = null;

const $=(s)=>document.querySelector(s)

/** In-app alert / prompt (replaces window.alert / prompt) */
function showAlert(message, { title = '', variant = 'default' } = {}) {
  return new Promise((resolve) => {
    const root = document.getElementById('app-modal-root');
    const sheet = document.getElementById('modalSheet');
    const titleEl = document.getElementById('modalTitle');
    const messageEl = document.getElementById('modalMessage');
    const inputWrap = document.getElementById('modalInputWrap');
    const btnSecondary = document.getElementById('modalBtnSecondary');
    const btnPrimary = document.getElementById('modalBtnPrimary');
    const backdrop = document.getElementById('modalBackdrop');

    sheet.className =
      'modal-sheet glass-sheet' +
      (variant === 'error' ? ' glass-sheet--error' : variant === 'success' ? ' glass-sheet--success' : '');
    const autoTitle =
      variant === 'error' ? 'Something went wrong' : variant === 'success' ? 'Done' : 'Notice';
    titleEl.textContent = title || autoTitle;
    messageEl.textContent = message;
    inputWrap.classList.add('hidden');
    btnSecondary.classList.add('hidden');
    btnPrimary.textContent = 'OK';

    const finish = () => {
      root.classList.add('hidden');
      root.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      backdrop.onclick = null;
      btnPrimary.onclick = null;
      document.removeEventListener('keydown', onKey);
      resolve();
    };

    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Enter') finish();
    }

    root.classList.remove('hidden');
    root.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    backdrop.onclick = finish;
    btnPrimary.onclick = finish;
    btnPrimary.focus();
  });
}

function showPrompt(message, {
  title = 'Enter value',
  placeholder = '',
  defaultValue = '',
  confirmText = 'OK',
  cancelText = 'Cancel'
} = {}) {
  return new Promise((resolve) => {
    const root = document.getElementById('app-modal-root');
    const sheet = document.getElementById('modalSheet');
    const titleEl = document.getElementById('modalTitle');
    const messageEl = document.getElementById('modalMessage');
    const inputWrap = document.getElementById('modalInputWrap');
    const inputEl = document.getElementById('modalInput');
    const btnSecondary = document.getElementById('modalBtnSecondary');
    const btnPrimary = document.getElementById('modalBtnPrimary');
    const backdrop = document.getElementById('modalBackdrop');

    sheet.className = 'modal-sheet glass-sheet';
    titleEl.textContent = title;
    messageEl.textContent = message;
    inputWrap.classList.remove('hidden');
    btnSecondary.classList.remove('hidden');
    btnPrimary.textContent = confirmText;
    btnSecondary.textContent = cancelText;
    inputEl.placeholder = placeholder;
    inputEl.value = defaultValue;

    const cleanup = () => {
      root.classList.add('hidden');
      root.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      backdrop.onclick = null;
      btnPrimary.onclick = null;
      btnSecondary.onclick = null;
      inputEl.onkeydown = null;
      document.removeEventListener('keydown', onKey);
    };

    const ok = () => {
      cleanup();
      resolve(inputEl.value.trim());
    };

    const cancel = () => {
      cleanup();
      resolve(null);
    };

    function onKey(e) {
      if (e.key === 'Escape') cancel();
    }

    root.classList.remove('hidden');
    root.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    backdrop.onclick = cancel;
    btnSecondary.onclick = cancel;
    btnPrimary.onclick = ok;
    inputEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        ok();
      }
    };
    setTimeout(() => {
      inputEl.focus();
      inputEl.select();
    }, 30);
  });
}

async function ensureTechnicianName() {
  const existing = localStorage.getItem(TECHNICIAN_NAME_KEY);
  if (existing && existing.trim()) return existing.trim();
  const entered = await showPrompt('This name is saved with jobs and stock changes.', {
    title: 'Enter your name',
    placeholder: 'Your name',
    confirmText: 'Continue',
    cancelText: 'Cancel'
  });
  if (!entered || !entered.trim()) return null;
  const name = entered.trim();
  localStorage.setItem(TECHNICIAN_NAME_KEY, name);
  return name;
}

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

const isUserauth = () => {
  const user = auth.currentUser;

  if (!user) {
    console.log("User not logged in");
    messageEl.innerText = "Login first.";
    return false;
  }

  if (!user.emailVerified) {
    console.log("Email not verified");
    messageEl.innerText = "Verify email first.";
    return false;
  }

  console.log("User authenticated:", user.uid);
  return true;
};







document.getElementById("forgotBtn").onclick = async () => {
  try {
    await sendPasswordResetEmail(auth, emailEl.value);
    messageEl.innerText = "Password reset email sent.";
  } catch (err) {
    messageEl.innerText = err.message;
  }
};







const askUserName = async () => {
  let name = localStorage.getItem(USER_NAME_KEY);

  if (name && name.trim().length >= 3) return name;

  const input = await showPrompt('We use this to personalize your experience.', {
    title: 'Enter your name',
    placeholder: 'Your name',
    confirmText: 'Save',
    cancelText: 'Skip'
  });

  if (!input) return null;

  name = input.trim();

  if (name.length < 3) return null;

  localStorage.setItem(USER_NAME_KEY, name);

  return name;
};




// Add / update stock


const partName = document.getElementById("partName");
const partModel = document.getElementById("partModel");
const partQty = document.getElementById("partQty");
const partCost = document.getElementById("partCost");
const minStock = document.getElementById("minStock");

document.getElementById("addStockBtn").onclick = async () => {

if(!isUserauth()){
  history.replaceState(null, null, "#auth");
router();
  return
}
  const tech = await ensureTechnicianName();
  if (!tech) return;

  const name = partName.value.trim();
  const modelInput = partModel.value.trim(); // comma separated
  const qty = Number(partQty.value);
  const cost = Number(partCost.value);
  const min = Number(minStock.value);

  if(!name || !modelInput || !qty){
    await showAlert('Please fill in part name, model, and quantity.', {
      title: 'Missing fields',
      variant: 'error'
    });
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
    updatedAt: Date.now(),
    editedBy: localStorage.getItem(TECHNICIAN_NAME_KEY)
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
if(!isUserauth()){
  history.replaceState(null, null, "#auth");
router();
  return
}

  const tech = await ensureTechnicianName();
  if (!tech) return;

  //const partId = jobPartSelect.value;
  const partId = document.getElementById("selectedPartId").value;
  const usedQty = Number(document.getElementById("jobQty").value);
  const stockSnap = await get(ref(db, "stock/" + partId));
  const stockData = stockSnap.val();

  if(!stockData || stockData.quantity < usedQty){
    await showAlert('Not enough stock for this part. Choose a lower quantity or restock first.', {
      title: 'Insufficient stock',
      variant: 'error'
    });
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
    createdAt: Date.now(),
    createdBy: localStorage.getItem(TECHNICIAN_NAME_KEY)
  });

  // Log stock movement
  await push(ref(db, "stockLogs"), {
    partId,
    change: -usedQty,
    type: "JOB_USE",
    createdAt: Date.now(),
    createdBy: localStorage.getItem(TECHNICIAN_NAME_KEY)
  });


history.replaceState(null, null, "#home");
router();
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
  const isOutStock = item.quantity === 0;

  if (currentFilter === "low" && !isLowStock) {
    return false;
  }

  if (currentFilter === "out" && !isOutStock) {
    return false;
  }

  return matchesSearch;
});

  if (searchTerm) visibleCount = filteredStock.length;

  // 🔢 Render limited
 // console.log(filteredStock)
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
      <button class="qty-btn minus hidden" data-id="${id}">-</button>
      QTY : <span class="${isLow ? 'low-count' : isOut? 'out-count' : 'stock-count'}">
        ${item.quantity}
      </span>
      <button class="qty-btn plus hidden" data-id="${id}">+</button>
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
  
if (filteredStock.length === 0) {
  stockList.innerHTML = `
    <div class="empty-state">
      <p class="noProductText">No matching products found</p>
      <p class="subText">Try a different name or clear filters</p>

      <div class="empty-actions">
        <button class="btn secondary" id="clearFiltersBtn">Clear Filters</button>
        <button class="btn primary" id="addProductBtn">+ Add Product</button>
      </div>
    </div>
  `;

  // actions
  document.getElementById('clearFiltersBtn').onclick = () => {
    // reset your search/filter logic
    console.log('clear filters');
    $('#clearFilter').click()
  };

  document.getElementById('addProductBtn').onclick = () => {
    // open add product UI / modal
    history.replaceState(null, null, "#add-item");
router();
document.querySelector('#partName').value=$('#stockSearch').value
    
  };
}
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

function router(link) {
  
  const hash = window.location.hash.replace("#", "") || "home";
  showPage(hash);
  
  if (hash === 'gizmos' || hash==='create-gizmos') {
  document.documentElement.style.setProperty('--accent', 'rgba(0, 0, 0, 0.82)');
} else {
  document.documentElement.style.setProperty('--accent', '#0BA2FF');
}
if (hash==='create-gizmos') {
  $('#bottomNav').classList.add('hidden')
}else{
  $('#bottomNav').classList.remove('hidden')
}
}

window.addEventListener("hashchange", router);
window.addEventListener("load", router);

document.querySelector('#fab').onclick=()=>location.hash='add-item'






// filter by header filter
const allBtn = document.querySelector(".all");
const lowBtn = document.querySelector(".low");
const outBtn = document.querySelector(".out");

allBtn.onclick = () => {
  currentFilter = "all";
  allBtn.classList.add("active");
  lowBtn.classList.remove("active");
  outBtn.classList.remove('active')
  renderStock(allStockData, stockSearch.value);
};

lowBtn.onclick = () => {
  currentFilter = "low";
  lowBtn.classList.add("active");
  allBtn.classList.remove("active");
  outBtn.classList.remove('active')
  renderStock(allStockData, stockSearch.value);
};

outBtn.onclick = () => {
  currentFilter = "out";
  outBtn.classList.add("active");
  allBtn.classList.remove("active");
  lowBtn.classList.remove('active')
  renderStock(allStockData, stockSearch.value);
};




/* KEEP IT BOTTOM*/
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}




// bottom nav

const nav = document.querySelector('.bottom-nav');

window.addEventListener('load', () => {
  nav.classList.add('init');
});

bottomNavs.forEach(n=>{
  n.onclick = (e)=>{
    nav.classList.remove('init')
    const link = e.currentTarget.dataset.link;
   //location.hash = link
    bottomNavs.forEach(e=>e.classList.remove('active'))
    e.currentTarget.classList.add('active')
  // location.replace(`/#${link}`)
  history.replaceState(null, null, `#${link}`)
  router(link)
  }
});


window.addEventListener("error", (event) => {
  logError({
    type: "runtime",
    message: event.message,
    source: event.filename,
    line: event.lineno,
    column: event.colno,
    stack: event.error?.stack
  });
});


window.addEventListener("unhandledrejection", (event) => {
  logError({
    type: "promise",
    message: event.reason?.message || "Unhandled Promise",
    stack: event.reason?.stack
  });
});



function logError(data) {
  const errorData = {
    ...data,
    url: location.href,
    userAgent: navigator.userAgent,
    time: new Date().toISOString()
  };

  console.error("Logged Error:", errorData);

  saveToFirebase(errorData);
}



// send errors to db
function saveToFirebase(errorData) {
  push(ref(db, `logs/errors`), errorData);
  showAlert(String(errorData.message || 'Unknown error'), {
    title: 'Error',
    variant: 'error'
  });
}






const getJobUI=j=>{
  const date = new Date(j.createdAt);

  return`
  <div class='job-card'>
  <p class='name'>
  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
</svg>
${j.customer}</p>
  <p class='device'>${j.device}</p>
  <p class='part'>${j.usedPart}</p>
  <p class='part'>${date.toLocaleString()}</p>
<hr>
  </div>
  `
}

//get history 
async function getAllJobs() {
  try {
    const snapshot = await get(ref(db, "jobs"));

    if (!snapshot.exists()) {
      console.log("No jobs found");
      return [];
    }

    const data = snapshot.val();

    // Convert object → array with id
    const jobs = Object.entries(data).map(([id, value]) => ({
      id,
      ...value
    }));

    return jobs;

  } catch (error) {
    console.error("Error fetching jobs:", error);
    return [];
  }
}


getAllJobs().then(jobs => {
  
  jobs.forEach(j=>showJobsToUI(j))
});

const showJobsToUI=job=>{
  const jobcontainer=document.querySelector('#jobcontainer')
  jobcontainer.innerHTML+=getJobUI(job)
 //console.log(job)
}







// ########### Gizmos codes #############


// helper fiunction 

const isCurrentMonth = (dateKey) => {
  const today = new Date()
  
  const [day, month, year] = dateKey.split("-").map(Number)
  const jobDate = new Date(year, month - 1, day)
  // change months here today.getMonth()-1
  return (
    jobDate.getFullYear() === today.getFullYear() &&
    jobDate.getMonth() === today.getMonth()-1 &&
    jobDate <= today
  )
}


const formatTime = (timestamp) => {

  const d = new Date(timestamp)

  const date = d.toLocaleDateString("en-GB")

  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })

  return `${date}, ${time}`
}


// List splitter Header helper
const getDateLabel = (dateKey) => {

  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const format = d => d.toLocaleDateString("en-GB").replaceAll("/", "-")

  if (dateKey === format(today)) return "Today"
  if (dateKey === format(yesterday)) return "Yesterday"

  return dateKey
}

const renderGizmos = (jobs) => {

  let totalJobCount = 0;

  let counts = {
    display: 0,
    curved: 0,
    motherboard: 0,
    backpanel: 0,
    iphoneGlass: 0
  };

  const prices = {
    display: 100,
    curved: 250,
    motherboard: 300,
    backpanel: 100,
    iphoneGlass: 500
  };

  const keywords = {
    curved: ['CURVED'],
    display: ['LCD', 'LED', 'DISPLAY', 'COMBO'],
    motherboard: ['MOTHER BOARD', 'MOTHERBOARD', 'BOARD', 'BACKLIGHT'],
    backpanel: ['PACKPANEL', 'PACKPANNEL', 'BACK PANEL', 'BACK PANNEL'],
    iphoneGlass: ['BACKGLASS', 'BACK GLASS']
  };
  
  // Define the status options array for easy iteration
  const statusOptions = [
    { value: "pending", label: "⏳ Pending" },
    { value: "progress", label: "🔨 In Progress" },
    { value: "spare", label: "📦 Waiting for Spare" },
    { value: "complete", label: "✅ Complete" },
    { value: "collected", label: "🎉 Collected" },
    { value: "returned", label: "↩️ Returned" }
  ];

  const getJobType = (text) => {
    if (keywords.curved.some(k => text.includes(k))) return 'curved';
    if (keywords.display.some(k => text.includes(k))) return 'display';
    if (keywords.motherboard.some(k => text.includes(k))) return 'motherboard';
    if (keywords.backpanel.some(k => text.includes(k))) return 'backpanel';
    if (keywords.iphoneGlass.some(k => text.includes(k))) return 'iphoneGlass';
    return null;
  };

  const list = document.querySelector("#gizmos-list");
  list.innerHTML = "";

  const sortedDates = Object.keys(jobs)
    .filter(date => isCurrentMonth(date))
    .sort()
    .reverse();

  sortedDates.forEach(date => {

    const header = document.createElement("div");
    header.className = "date-splitter";
    header.textContent = getDateLabel(date);
    list.appendChild(header);

    Object.entries(jobs[date]).forEach(([id, job]) => {

      totalJobCount++;

      const complaintText = (job.complaint || "").toUpperCase();
      const type = getJobType(complaintText);

      // Increment amount counts ONLY if the job is 'collected'
      if (type && job.status === 'collected') {
        counts[type]++;
      }

      const amountText = type ? `+₹${prices[type]}` : '';
      
      // Determine the CSS class based on the collection status
      const amountStatusClass = (job.status === 'collected') ? 'amount' : 'amount dim-amount';
      
      // Generate options HTML and mark the current job status as selected
      let selectOptionsHtml = "";
      statusOptions.forEach(option => {
        const isSelected = job.status === option.value ? "selected" : "";
        selectOptionsHtml += `<option value="${option.value}" ${isSelected}>${option.label}</option>`;
      });

      const card = document.createElement("div");
      card.className = "job-card gizmo-card";

      card.innerHTML = `
        <h3>${job.device}</h3>
        <p><b>Complaint:</b> ${job.complaint}</p>
        <p><b>Notes:</b> ${job.notes || ''}</p>
        <p class='technician'>${job.technician || ''}</p>
        <p class='${amountStatusClass}'>${amountText}</p>
        
        <div class="status-updater">
          <label for="status-${id}"><b>Status:</b></label>
          <select id="status-${id}" class="status-dropdown" data-job-id="${id}" data-date="${date}">
            ${selectOptionsHtml}
          </select>
        </div>
      `;

      list.appendChild(card);
      
      // Attach the event listener directly to the newly created select element
      const statusDropdown = card.querySelector(`#status-${id}`);

      statusDropdown.addEventListener("change", async (event) => {
        const newStatus = event.target.value;
        const jobId = event.target.getAttribute("data-job-id");
        const jobDate = event.target.getAttribute("data-date");

        // Disable the dropdown while updating to prevent multiple clicks
        event.target.disabled = true;

        try {
          // Create a reference directly to the specific job using its date and ID
          const jobRef = ref(db, `gizmos/jobs/${jobDate}/${jobId}`);

          // Update only the 'status' property of that specific job
          await update(jobRef, {
            status: newStatus
          });

          // Update the local state so it doesn't revert incorrectly later
          job.status = newStatus;
          
          console.log(`Successfully updated job ${jobId} to ${newStatus}`);
          
          // NOTE: If you are not using Firebase onValue() listener to auto-refresh the UI,
          // you might need to re-fetch or re-render the list here to update the total counts immediately.

        } catch (error) {
          console.error("Error updating status in database:", error);
          
          // Revert the dropdown UI back to the old status if the update fails
          event.target.value = job.status; 
          alert("Failed to update status. Please check your connection and try again.");
          
        } finally {
          // Re-enable the dropdown
          event.target.disabled = false;
        }
      });
    });
  });

  // Empty state
  if (sortedDates.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <h3>📅 No jobs this month</h3>
        <p>Try adding a new job or check another date range.</p>
      </div>
    `;
  }

  // Totals
  const totals = {
    display: counts.display * prices.display,
    curved: counts.curved * prices.curved,
    motherboard: counts.motherboard * prices.motherboard,
    backpanel: counts.backpanel * prices.backpanel,
    iphoneGlass: counts.iphoneGlass * prices.iphoneGlass
  };

  const totalPrice = Object.values(totals).reduce((a, b) => a + b, 0);

  // UI update
  document.querySelector('#totJobEl').innerHTML =
    `<div class='workAmountElement'>Total Jobs : ${totalJobCount} - <span class='amount'>₹${totalPrice.toLocaleString()}</span></div>`;

  document.querySelector('#displayJobEl').innerHTML =
    `<div class='workAmountElement'>Display : ${counts.display} - <span class='amount'>₹${totals.display.toLocaleString()}</span></div>`;

  document.querySelector('#curvedDisplayEl').innerHTML =
    `<div class='workAmountElement'>Curved Display : ${counts.curved} - <span class='amount'>₹${totals.curved.toLocaleString()}</span></div>`;

  document.querySelector('#motherboardJobEl').innerHTML =
    `<div class='workAmountElement'>Motherboard : ${counts.motherboard} - <span class='amount'>₹${totals.motherboard.toLocaleString()}</span></div>`;

  document.querySelector('#backpanelEle').innerHTML =
    `<div class='workAmountElement'>Back Panel : ${counts.backpanel} - <span class='amount'>₹${totals.backpanel.toLocaleString()}</span></div>`;

  document.querySelector('#iphoneGlassEle').innerHTML =
    `<div class='workAmountElement'>iPhone Back Glass : ${counts.iphoneGlass} - <span class='amount'>₹${totals.iphoneGlass.toLocaleString()}</span></div>`;
};


const loadGizmosWorks = () => {
  const listContainer = document.querySelector('#gizmos-list')
  
  
  let allJobs = []
  onValue(ref(db, "gizmos/jobs"), snapshot => {
  allJobs = snapshot.val() || {};
  // Update UI
  renderGizmos(allJobs);

  // Save fresh copy to localStorage
  localStorage.setItem(
    GIZMOS_CACHE_KEY,
    JSON.stringify(allJobs)
  );

});
}




loadGizmosWorks()


  
  


// gizmos scroll effect
const header = document.querySelector(".gizmos.flex-between")

window.addEventListener("scroll", () => {

  if (window.scrollY > 70){
    header.classList.add("scrolled")
  }else{
    header.classList.remove("scrolled")
  }

})



// create gizmos job
const createGizmosJobBtn = document.querySelector("#createGizmosJobBtn")

createGizmosJobBtn.onclick = async () => {
  if(!isUserauth()){
  history.replaceState(null, null, "#auth");
router();
  return
}

  const tech = await ensureTechnicianName();
  if (!tech) return;

  const device = $("#device").value.trim()
  const complaint = $("#complaint").value.trim()
  const notes = $("#notes").value.trim()

  if(!device || !complaint){
    await showAlert('Please enter both device model and complaint.', {
      title: 'Required fields',
      variant: 'error'
    });
    return
  }

  const now = new Date()

  const dateKey = now
    .toLocaleDateString("en-GB")
    .replaceAll("/", "-")

  await push(ref(db, `gizmos/jobs/${dateKey}`), {

    device,
    complaint,
    notes,
    technician: localStorage.getItem(TECHNICIAN_NAME_KEY),
    createdAt: Date.now()

  })

  $("#device").value = ""
  $("#complaint").value = ""
  $("#notes").value = ""

  location.hash = "gizmos"
router()

}


document.querySelector('#open_gizmos_create_page').onclick=()=>{
  location.hash="create-gizmos"
  router()
}







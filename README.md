


Login
   ↓
Dashboard
   ↓
Add Stock / Update Stock / Use Stock
   ↓
Stock List
   ↓
Reports






Open Add Stock Page
    ↓
Enter:
   - Part Name (Display / Strip / Button etc)
   - Model Compatibility
   - Quantity
   - Cost Price
   - Supplier
    ↓
Save to Database
    ↓
Update Total Stock






Open Job
   ↓
Select Used Spare
   ↓
Enter Quantity Used
   ↓
Stock - Quantity
   ↓
Update Job Record






If Quantity <= Minimum Threshold
     ↓
Show Warning on Dashboard





Select Spare
   ↓
Adjust Quantity (+ / -)
   ↓
Add Reason (Damage / Lost / Return)
   ↓
Save Log





# auth flow 

App Start
   ↓
Check Auth State (onAuthStateChanged)
   ↓
User Logged In ?
     ↙           ↘
   Yes             No
   ↓               ↓
Dashboard        Login Page



# Registration Flow
User Enter:
   - Email
   - Password
   ↓
createUserWithEmailAndPassword()
   ↓
Send Email Verification
   ↓
If emailVerified == true
       Allow Login
Else
       Block Access


# Login Flow
User Enter Email + Password
    ↓
signInWithEmailAndPassword()
    ↓
Check emailVerified
    ↓
If false → Show “Verify your email”
If true → Go Dashboard


# Auto Login Session Flow
onAuthStateChanged(user => {
   if(user && user.emailVerified){
       goToDashboard()
   } else {
       goToLogin()
   }
})



# 🗂 Structure Recommendation (Clean Architecture)








function renderStock(data, searchTerm = "") {

  stockList.innerHTML = "";

  // const search = searchTerm
  // .trim()
  // .toUpperCase()
  // .replace("SAMSUNG", "") // remove brand noise
  // .trim();
    
//=
const rawSearch = searchTerm.trim().toUpperCase();
// split words
const words = rawSearch.split(" ");
// take last word as probable model
const search = words[words.length - 1];
//=
  Object.entries(data).forEach(([id, item]) => {

    const models = Object.keys(item.compatibleModels || {});
    const modelString = models.join(", ");
    const modelSpans = models
  .map(m => `<span class="model-badge">${m}</span>`)
  .join("");

    const matchPart =
      item.name.toUpperCase().includes(search);

    const matchModel =
      models.some(m => m.includes(search));

    if(search && !matchPart && !matchModel){
      return;
    }

    const low = item.quantity <= item.minStock;

    stockList.innerHTML += `
      <div class='list-item'>
        <p class='name'>${item.name} </p>
        <p class='models'>${modelSpans}</p>
        <hr>
        <div class='bottom-box'>
          <span>
          <p class='title'>Current stock</p>
          <p class='${low?'low-count':'stock-count'}'>${item.quantity}</p>

          </span>
        </div>
        ${low ? "<span class='low'> Low stock</span>" : ""}
      </div>
    `;
  });
}
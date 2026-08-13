const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
const $=id=>document.getElementById(id);
let products=[],customers=[],suppliers=[],sales=[],repayments=[],purchases=[],supplierPayments=[];
let editingProduct=null,tempPhoto=null;

const money=n=>"KES "+Number(n||0).toLocaleString("en-KE",{maximumFractionDigits:2});
const today=()=>new Date().toISOString().slice(0,10);
const val=(o,...keys)=>{for(const k of keys)if(o&&o[k]!=null)return o[k];return null};
const num=(o,...keys)=>Number(val(o,...keys)||0);
function created(r){return val(r,"created_at","sale_date","date","purchased_at","paid_at")||""}
function showView(id){document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));$(id).classList.add("active");if(id==="admin")loadAdmin();if(id==="history")renderHistory();window.scrollTo(0,0)}
function goHome(){showView("home");refreshAll()}
function closeModal(){$("modal").classList.add("hidden");tempPhoto=null;editingProduct=null}
function modal(title,html){$("modalTitle").textContent=title;$("modalBody").innerHTML=html;$("modal").classList.remove("hidden")}
async function q(table,select="*"){const {data,error}=await sb.from(table).select(select);if(error){console.warn(table,error.message);return []}return data||[]}
async function refreshAll(){
 [products,customers,suppliers,sales,repayments,purchases,supplierPayments]=await Promise.all([
  q("products"),q("customers"),q("suppliers"),q("sales"),q("repayments"),q("purchases"),q("supplier_payments")
 ]);
 renderProducts();renderCustomers();fillSelects();renderHome();renderHistory();
}
function saleTotal(s){return num(s,"total_amount","total","amount")}
function purchaseTotal(p){return num(p,"total_amount","total","amount")}
function isCredit(s){return String(val(s,"payment_method","payment_type","type")||"").toLowerCase().includes("credit") || !!val(s,"customer_id")}
function renderHome(){
 const ts=sales.filter(s=>String(created(s)).slice(0,10)===today());
 $("todaySales").textContent=money(ts.reduce((a,s)=>a+saleTotal(s),0));
 $("todayCredit").textContent=money(ts.filter(isCredit).reduce((a,s)=>a+saleTotal(s),0));
 $("receivable").textContent=money(customerCredit());
}
function customerCredit(){
 const creditSales=sales.filter(isCredit).reduce((a,s)=>a+saleTotal(s),0);
 const paid=repayments.reduce((a,r)=>a+num(r,"amount","paid_amount"),0);
 return Math.max(0,creditSales-paid);
}
function productName(id){return val(products.find(p=>String(p.id)===String(id)),"name","product_name")||"Product"}
function customerName(id){return val(customers.find(c=>String(c.id)===String(id)),"name","customer_name")||"Customer"}
function supplierName(id){return val(suppliers.find(c=>String(c.id)===String(id)),"name","supplier_name")||"Supplier"}
function renderProducts(){
 if(!$("productList"))return;
 $("productList").innerHTML=products.length?products.map(p=>`<div class="row">
  ${val(p,"image_url","photo_url")?`<img src="${val(p,"image_url","photo_url")}">`:`<div style="width:62px"></div>`}
  <div class="grow"><b>${val(p,"name","product_name")||"Unnamed"}</b><small>${money(num(p,"price","selling_price"))} · Stock ${num(p,"stock_qty","stock","quantity")} ${val(p,"unit")||""}</small></div>
  <div class="row-actions"><button onclick="openProduct('${p.id}')">EDIT</button></div></div>`).join(""):'<p class="muted">No products yet.</p>'
}
function renderCustomers(){
 if(!$("customerList"))return;
 $("customerList").innerHTML=customers.length?customers.map(c=>`<div class="row"><div class="grow"><b>${val(c,"name","customer_name")||"Unnamed"}</b><small>${val(c,"phone")||""}</small></div></div>`).join(""):'<p class="muted">No customers yet.</p>'
}
function fillSelect(id,arr,labelFn){const e=$(id);if(!e)return;e.innerHTML='<option value="">Select</option>'+arr.map(x=>`<option value="${x.id}">${labelFn(x)}</option>`).join("")}
function fillSelects(){
 ["saleProduct","creditProduct"].forEach(id=>fillSelect(id,products,p=>`${val(p,"name","product_name")} — ${money(num(p,"price","selling_price"))}`));
 ["creditCustomer","repayCustomer"].forEach(id=>fillSelect(id,customers,c=>val(c,"name","customer_name")));
}
function openProduct(id=null){
 editingProduct=products.find(p=>String(p.id)===String(id))||null; const p=editingProduct||{};
 modal(editingProduct?"Edit Product":"Add Product",`
 <label>Product photo <input id="pPhoto" type="file" accept="image/*" capture="environment" onchange="previewPhoto(event)"></label>
 <img id="pPreview" class="preview ${val(p,"image_url","photo_url")?"":"hidden"}" src="${val(p,"image_url","photo_url")||""}">
 <p class="muted">The selected photo is only a temporary preview. It is uploaded only when you choose “Use as representative photo”.</p>
 <label><input id="pKeepPhoto" type="checkbox" ${editingProduct?"":"checked"}> Use selected photo as representative photo</label>
 <label>Name<input id="pName" value="${val(p,"name","product_name")||""}"></label>
 <label>Price (KES)<input id="pPrice" type="number" value="${num(p,"price","selling_price")||""}"></label>
 <label>Unit<select id="pUnit"><option>piece</option><option>kg</option><option>packet</option><option>bottle</option><option>crate</option><option>other</option></select></label>
 <button class="primary" onclick="saveProduct()">SAVE</button>`);
 if(val(p,"unit"))$("pUnit").value=val(p,"unit");
}
function previewPhoto(e){const f=e.target.files?.[0];if(!f)return;tempPhoto=f;const u=URL.createObjectURL(f);$("pPreview").src=u;$("pPreview").classList.remove("hidden")}
async function uploadRepresentative(file){
 if(!file)return null;
 const ext=(file.name.split(".").pop()||"jpg").toLowerCase(), path=`products/${crypto.randomUUID?crypto.randomUUID():Date.now()}.${ext}`;
 const {error}=await sb.storage.from("product-images").upload(path,file,{upsert:false,contentType:file.type});
 if(error){console.warn(error);return null}
 return sb.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}
async function saveProduct(){
 const name=$("pName").value.trim(),price=Number($("pPrice").value||0),unit=$("pUnit").value;if(!name)return alert("Enter product name.");
 let image=val(editingProduct,"image_url","photo_url")||null;
 if(tempPhoto && $("pKeepPhoto").checked){const u=await uploadRepresentative(tempPhoto);if(u)image=u}
 let payload={name,price,unit,image_url:image};
 let res=editingProduct?await sb.from("products").update(payload).eq("id",editingProduct.id):await sb.from("products").insert(payload);
 if(res.error){
   payload={name,selling_price:price,unit,photo_url:image};
   res=editingProduct?await sb.from("products").update(payload).eq("id",editingProduct.id):await sb.from("products").insert(payload);
 }
 if(res.error)return alert("Could not save product: "+res.error.message);
 closeModal();await refreshAll();
}
function openCustomer(){
 modal("Add Customer",`<label>Name<input id="cName"></label><label>Phone (optional)<input id="cPhone"></label><button class="primary" onclick="saveCustomer()">SAVE</button>`)
}
async function saveCustomer(){
 const name=$("cName").value.trim(),phone=$("cPhone").value.trim();if(!name)return;
 let {error}=await sb.from("customers").insert({name,phone});if(error){({error}=await sb.from("customers").insert({customer_name:name,phone}))}
 if(error)return alert(error.message);closeModal();await refreshAll()
}
async function saveSale(credit){
 const pid=$(credit?"creditProduct":"saleProduct").value,qty=Number($(credit?"creditQty":"saleQty").value||0),cid=credit?$("creditCustomer").value:null;
 const p=products.find(x=>String(x.id)===String(pid));if(!p||qty<=0||credit&&!cid)return alert("Complete all fields.");
 const price=num(p,"price","selling_price"),total=price*qty,method=credit?"Credit":$("salePayment").value;
 let salePayload={customer_id:cid||null,payment_method:method,total_amount:total};
 let {data:sale,error}=await sb.from("sales").insert(salePayload).select().single();
 if(error){({data:sale,error}=await sb.from("sales").insert({customer_id:cid||null,payment_type:method,total}).select().single())}
 if(error)return alert(error.message);
 let item={sale_id:sale.id,product_id:pid,quantity:qty,unit_price:price,total_amount:total};
 let r=await sb.from("sale_items").insert(item);if(r.error)r=await sb.from("sale_items").insert({sale_id:sale.id,product_id:pid,qty,price,total});
 if(r.error)return alert("Sale saved, but item detail failed: "+r.error.message);
 await adjustStock(pid,-qty,"sale");
 alert("Saved.");goHome()
}
async function adjustStock(productId,change,reason){
 let r=await sb.from("stock_adjustments").insert({product_id:productId,quantity_change:change,reason});
 if(r.error)r=await sb.from("stock_adjustments").insert({product_id:productId,qty_change:change,note:reason});
 const p=products.find(x=>String(x.id)===String(productId));if(!p)return;
 const current=num(p,"stock_qty","stock","quantity"),next=current+change;
 for(const col of ["stock_qty","stock","quantity"]){const u=await sb.from("products").update({[col]:next}).eq("id",productId);if(!u.error)break}
}
async function saveRepayment(){
 const customer_id=$("repayCustomer").value,amount=Number($("repayAmount").value||0),method=$("repayMethod").value;if(!customer_id||amount<=0)return;
 let {error}=await sb.from("repayments").insert({customer_id,amount,payment_method:method});
 if(error)({error}=await sb.from("repayments").insert({customer_id,paid_amount:amount,method}));
 if(error)return alert(error.message);alert("Payment saved.");goHome()
}
function renderHistory(){
 if(!$("historyList"))return;
 const rows=[...sales.map(x=>({...x,_kind:"Sale"})),...repayments.map(x=>({...x,_kind:"Repayment"}))].sort((a,b)=>String(created(b)).localeCompare(String(created(a)))).slice(0,100);
 $("historyList").innerHTML=rows.map(r=>`<div class="row"><div class="grow"><b>${r._kind}</b><small>${created(r)?new Date(created(r)).toLocaleString():""} ${val(r,"customer_id")?"· "+customerName(val(r,"customer_id")):""}</small></div><b>${money(r._kind==="Sale"?saleTotal(r):num(r,"amount","paid_amount"))}</b></div>`).join("")||'<p class="muted">No history.</p>'
}
async function loadAdmin(){
 await refreshAll();
 const totalSales=sales.reduce((a,x)=>a+saleTotal(x),0),totalPurch=purchases.reduce((a,x)=>a+purchaseTotal(x),0);
 $("aSales").textContent=money(totalSales);$("aPurchases").textContent=money(totalPurch);$("aMargin").textContent=money(totalSales-totalPurch);
 $("aCredit").textContent=money(customerCredit());
 $("aSupplierDue").textContent=money(Math.max(0,totalPurch-supplierPayments.reduce((a,x)=>a+num(x,"amount","paid_amount"),0)));
 $("aStock").textContent=money(products.reduce((a,p)=>a+num(p,"stock_qty","stock","quantity")*num(p,"cost_price","purchase_price","buying_price"),0));
}
function showAdminPanel(kind){
 if(kind==="suppliers")renderSuppliersAdmin();
 if(kind==="purchase")renderPurchaseAdmin();
 if(kind==="stock")renderStockAdmin();
 if(kind==="manageCustomers")renderCustomerAdmin();
}
function renderSuppliersAdmin(){
 $("adminPanel").innerHTML=`<div class="card"><h3>Suppliers</h3><button onclick="openSupplier()">+ Add supplier</button></div>`+
 (suppliers.map(s=>`<div class="row"><div class="grow"><b>${val(s,"name","supplier_name")}</b><small>${val(s,"phone")||""}</small></div><button onclick="paySupplier('${s.id}')">PAY</button></div>`).join("")||'<p class="muted">No suppliers.</p>')
}
function openSupplier(){modal("Add Supplier",`<label>Name<input id="sName"></label><label>Phone<input id="sPhone"></label><button class="primary" onclick="saveSupplier()">SAVE</button>`)}
async function saveSupplier(){
 const name=$("sName").value.trim(),phone=$("sPhone").value.trim();let {error}=await sb.from("suppliers").insert({name,phone});
 if(error)({error}=await sb.from("suppliers").insert({supplier_name:name,phone}));if(error)return alert(error.message);closeModal();await refreshAll();showAdminPanel("suppliers")
}
function paySupplier(id){modal("Supplier Payment",`<label>Amount (KES)<input id="spAmount" type="number"></label><label>Method<select id="spMethod"><option>Cash</option><option>M-Pesa</option></select></label><button class="primary" onclick="saveSupplierPayment('${id}')">SAVE</button>`)}
async function saveSupplierPayment(id){
 const amount=Number($("spAmount").value||0),method=$("spMethod").value;let {error}=await sb.from("supplier_payments").insert({supplier_id:id,amount,payment_method:method});
 if(error)({error}=await sb.from("supplier_payments").insert({supplier_id:id,paid_amount:amount,method}));if(error)return alert(error.message);closeModal();await loadAdmin();showAdminPanel("suppliers")
}
function renderPurchaseAdmin(){
 $("adminPanel").innerHTML=`<div class="card"><h3>Record Purchase</h3>
 <label>Supplier<select id="buySupplier">${suppliers.map(s=>`<option value="${s.id}">${val(s,"name","supplier_name")}</option>`).join("")}</select></label>
 <label>Product<select id="buyProduct">${products.map(p=>`<option value="${p.id}">${val(p,"name","product_name")}</option>`).join("")}</select></label>
 <label>Quantity<input id="buyQty" type="number" min=".01" step=".01"></label>
 <label>Buy price / unit (KES)<input id="buyPrice" type="number" min="0"></label>
 <button class="primary" onclick="savePurchase()">SAVE PURCHASE</button></div>`
}
async function savePurchase(){
 const supplier_id=$("buySupplier").value,product_id=$("buyProduct").value,qty=Number($("buyQty").value||0),price=Number($("buyPrice").value||0),total=qty*price;if(!supplier_id||!product_id||qty<=0)return;
 let {data:p,error}=await sb.from("purchases").insert({supplier_id,total_amount:total}).select().single();
 if(error)({data:p,error}=await sb.from("purchases").insert({supplier_id,total}).select().single());if(error)return alert(error.message);
 let r=await sb.from("purchase_items").insert({purchase_id:p.id,product_id,quantity:qty,unit_cost:price,total_amount:total});
 if(r.error)r=await sb.from("purchase_items").insert({purchase_id:p.id,product_id,qty,price,total});
 await adjustStock(product_id,qty,"purchase");
 for(const col of ["cost_price","purchase_price","buying_price"]){const u=await sb.from("products").update({[col]:price}).eq("id",product_id);if(!u.error)break}
 alert("Purchase saved.");await loadAdmin()
}
function renderStockAdmin(){
 $("adminPanel").innerHTML=`<div class="card"><h3>Stock Adjustment</h3><label>Product<select id="adjProduct">${products.map(p=>`<option value="${p.id}">${val(p,"name","product_name")} · ${num(p,"stock_qty","stock","quantity")}</option>`).join("")}</select></label><label>Change (+ / -)<input id="adjQty" type="number" step=".01"></label><label>Reason<input id="adjReason" placeholder="damage, correction, gift..."></label><button class="primary" onclick="saveAdjustment()">SAVE</button></div>`
}
async function saveAdjustment(){const id=$("adjProduct").value,n=Number($("adjQty").value||0),reason=$("adjReason").value.trim();if(!id||!n)return;await adjustStock(id,n,reason||"manual");await refreshAll();showAdminPanel("stock")}
function renderCustomerAdmin(){
 $("adminPanel").innerHTML=`<div class="card"><h3>Manage Customers</h3><p class="warn">Delete only customers with no needed transaction history.</p></div>`+
 customers.map(c=>`<div class="row"><div class="grow"><b>${val(c,"name","customer_name")}</b></div><button onclick="deleteCustomer('${c.id}')">DELETE</button></div>`).join("")
}
async function deleteCustomer(id){
 if(!confirm("Delete this customer? Customers referenced by transactions may be protected by the database."))return;
 const {error}=await sb.from("customers").delete().eq("id",id);if(error)return alert(error.message);await refreshAll();showAdminPanel("manageCustomers")
}
window.addEventListener("load",async()=>{if(!SUPABASE_URL||!SUPABASE_KEY){alert("Supabase config not found. Keep your existing config.js.");return}await refreshAll()});

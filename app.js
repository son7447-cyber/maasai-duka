const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let products=[], customers=[], balances=[], saleCart={}, creditCart={};
let salePay='cash', repayPay='cash';

const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const money=n=>'KES '+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
function toast(msg){const t=$('#toast');t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',2200)}
function go(id){$$('.screen').forEach(x=>x.classList.remove('active'));$('#'+id).classList.add('active');window.scrollTo(0,0)}
$$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));$$('.back').forEach(b=>b.onclick=()=>go('home'));

async function loadAll(){
  const [p,c,b,s,r]=await Promise.all([
    db.from('products').select('*').eq('active',true).order('name'),
    db.from('customers').select('*').order('name'),
    db.from('customer_balances').select('*').order('balance',{ascending:false}),
    db.from('sales').select('*').order('created_at',{ascending:false}).limit(100),
    db.from('repayments').select('*').order('created_at',{ascending:false}).limit(100)
  ]);
  if(p.error||c.error||b.error){toast('Database connection problem');console.error(p.error,c.error,b.error);return}
  products=p.data||[];customers=c.data||[];balances=b.data||[];
  renderProducts();renderCustomers();renderHistory(s.data||[],r.data||[]);renderDashboard(s.data||[]);
}
function productImage(p){return p.image_url?`<img src="${p.image_url}" alt="">`:`<div class="product-placeholder">📦</div>`}
function productButtons(target,cart){
  $(target).innerHTML=products.map(p=>`<button class="product-card" data-id="${p.id}">${productImage(p)}<b>${p.name}</b><span>${money(p.price)} / ${p.unit}</span></button>`).join('');
  $$(target+' .product-card').forEach(b=>b.onclick=()=>{const id=Number(b.dataset.id);cart[id]=(cart[id]||0)+1;renderCart(cart,target==='#saleProducts'?'sale':'credit')});
}
function renderProducts(){productButtons('#saleProducts',saleCart);productButtons('#creditProducts',creditCart);
  $('#productAdmin').innerHTML=products.map(p=>`<div class="list-card"><div class="row"><b>${p.name}</b><b>${money(p.price)}</b></div><small>${p.unit}</small></div>`).join('')||'No products yet';
}
function renderCart(cart,type){
  const box=$('#'+type+'Cart'); let total=0;
  box.innerHTML=Object.entries(cart).map(([id,q])=>{const p=products.find(x=>x.id==id);if(!p)return'';const sub=Number(p.price)*q;total+=sub;return `<div class="cart-row"><div><b>${p.name}</b><small> ${money(sub)}</small></div><div class="qty"><button data-a="minus" data-id="${id}">−</button><b>${q}</b><button data-a="plus" data-id="${id}">+</button></div></div>`}).join('')||'<small>Tap a product above.</small>';
  $('#'+type+'Total').textContent=money(total);
  box.querySelectorAll('button').forEach(b=>b.onclick=()=>{const id=b.dataset.id;if(b.dataset.a==='plus')cart[id]++;else{cart[id]--;if(cart[id]<=0)delete cart[id]}renderCart(cart,type)});
  return total;
}
function renderCustomers(){
  const opts=customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  $('#creditCustomer').innerHTML='<option value="">Choose customer</option>'+opts;
  $('#repayCustomer').innerHTML='<option value="">Choose customer</option>'+opts;
  $('#customerList').innerHTML=balances.map(b=>`<div class="list-card"><div class="row"><div><b>${b.name}</b><small>${b.phone||''}</small></div><div class="${Number(b.balance)>0?'owed':'paid'}">${Number(b.balance)>0?money(b.balance):'PAID'}</div></div><small>Credit ${money(b.total_credit)} · Repaid ${money(b.total_repaid)}</small></div>`).join('')||'No customers yet';
}
function renderDashboard(sales){
  const now=new Date(), same=d=>{const x=new Date(d);return x.getFullYear()==now.getFullYear()&&x.getMonth()==now.getMonth()&&x.getDate()==now.getDate()};
  const today=sales.filter(s=>same(s.created_at));
  $('#todaySales').textContent=money(today.reduce((a,s)=>a+Number(s.total_amount),0));
  $('#todayCredit').textContent=money(today.filter(s=>s.payment_type==='credit').reduce((a,s)=>a+Number(s.total_amount),0));
  $('#totalCredit').textContent=money(balances.reduce((a,b)=>a+Math.max(0,Number(b.balance)),0));
}
function renderHistory(sales,reps){
  const names=Object.fromEntries(customers.map(c=>[c.id,c.name]));
  const rows=[
    ...sales.map(x=>({date:x.created_at,text:(x.payment_type==='credit'?'CREDIT':'SALE')+' · '+(names[x.customer_id]||x.payment_type.toUpperCase()),amount:Number(x.total_amount),kind:x.payment_type==='credit'?'owed':''})),
    ...reps.map(x=>({date:x.created_at,text:'REPAY · '+(names[x.customer_id]||'Customer'),amount:-Number(x.amount),kind:'paid'}))
  ].sort((a,b)=>new Date(b.date)-new Date(a.date));
  $('#historyList').innerHTML=rows.map(x=>`<div class="list-card"><div class="row"><div><b>${x.text}</b><small>${new Date(x.date).toLocaleString()}</small></div><strong class="${x.kind}">${x.amount<0?'− ':'+ '}${money(Math.abs(x.amount))}</strong></div></div>`).join('')||'No transactions yet';
}
async function saveSale(payment,cart,customerId=null){
  const entries=Object.entries(cart);if(!entries.length)return toast('Choose a product first');
  const total=entries.reduce((a,[id,q])=>a+Number(products.find(p=>p.id==id).price)*q,0);
  if(total<=0)return toast('Set product prices first');
  const {data:s,error}=await db.from('sales').insert({customer_id:customerId,payment_type:payment,total_amount:total}).select().single();
  if(error)return toast(error.message);
  const items=entries.map(([id,q])=>{const p=products.find(x=>x.id==id);return{sale_id:s.id,product_id:p.id,product_name:p.name,quantity:q,unit_price:p.price,subtotal:Number(p.price)*q}});
  const {error:e2}=await db.from('sale_items').insert(items);if(e2)return toast(e2.message);
  Object.keys(cart).forEach(k=>delete cart[k]);renderCart(cart,payment==='credit'?'credit':'sale');toast(payment==='credit'?'Credit saved':'Sale saved');await loadAll();go('home');
}
$$('.pay').forEach(b=>b.onclick=()=>{$$('.pay').forEach(x=>x.classList.remove('active'));b.classList.add('active');salePay=b.dataset.pay});
$$('.repay-pay').forEach(b=>b.onclick=()=>{$$('.repay-pay').forEach(x=>x.classList.remove('active'));b.classList.add('active');repayPay=b.dataset.pay});
$('#saveSale').onclick=()=>saveSale(salePay,saleCart);
$('#saveCredit').onclick=()=>{const id=Number($('#creditCustomer').value);if(!id)return toast('Choose a customer');saveSale('credit',creditCart,id)};
$('#repayCustomer').onchange=()=>{const b=balances.find(x=>x.customer_id==Number($('#repayCustomer').value));$('#repayBalance').textContent=money(b?.balance||0)};
$('#saveRepay').onclick=async()=>{const customer_id=Number($('#repayCustomer').value),amount=Number($('#repayAmount').value);if(!customer_id||amount<=0)return toast('Choose customer and enter amount');const b=balances.find(x=>x.customer_id===customer_id);if(b&&amount>Number(b.balance))return toast('Payment is more than the balance');const {error}=await db.from('repayments').insert({customer_id,amount,payment_type:repayPay});if(error)return toast(error.message);$('#repayAmount').value='';toast('Payment saved');await loadAll();go('home')};

const cd=$('#customerDialog');$('#addCustomerBtn').onclick=()=>cd.showModal();$('#quickCustomer').onclick=()=>cd.showModal();
$('#customerSave').onclick=async e=>{e.preventDefault();const name=$('#customerName').value.trim();if(!name)return;const {error}=await db.from('customers').insert({name,phone:$('#customerPhone').value.trim()||null});if(error)return toast(error.message);cd.close();$('#customerForm').reset();toast('Customer added');await loadAll()};

const pd=$('#productDialog');$('#addProductBtn').onclick=()=>pd.showModal();
let photoData=null;$('#productPhoto').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{photoData=r.result;$('#photoPreview').src=photoData;$('#photoPreview').style.display='block'};r.readAsDataURL(f)};
$('#productSave').onclick=async e=>{e.preventDefault();const name=$('#productName').value.trim(),price=Number($('#productPrice').value),unit=$('#productUnit').value;if(!name||price<0)return;
  // V1 stores the photo locally in this browser to keep setup simple.
  const {data,error}=await db.from('products').insert({name,price,unit}).select().single();if(error)return toast(error.message);
  if(photoData) localStorage.setItem('product_photo_'+data.id,photoData);
  pd.close();$('#productForm').reset();$('#photoPreview').style.display='none';photoData=null;toast('Product added');await loadAll()
};
// apply locally stored photos to cards after rendering
const oldRenderProducts=renderProducts;renderProducts=function(){products.forEach(p=>{const local=localStorage.getItem('product_photo_'+p.id);if(local&&!p.image_url)p.image_url=local});oldRenderProducts()}

$('#refreshBtn').onclick=loadAll;
renderCart(saleCart,'sale');renderCart(creditCart,'credit');loadAll();

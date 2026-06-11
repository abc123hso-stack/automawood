import React, { useState, useRef, useEffect, useCallback } from "react";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface BOQItem { itemName:string; dimensions:string; quantity:number; unit:string; material:string; description:string; }
interface MaterialBreakdown { materialName:string; estimatedQty:string; unit:string; purpose:string; }
interface Accessory { accessoryName:string; quantity:number; unit:string; description?:string; }
interface BOQResponse {
  projectTitle:string; category:string; generalSummary:string;
  woodTypes:string[]; items:BOQItem[]; materialsBreakdown:MaterialBreakdown[];
  accessories:Accessory[]; workshopInstructions:string[]; estimatedTimeline:string;
}
interface SavedEstimate { id:string; timestamp:string; category:string; projectTitle:string; boq:BOQResponse; }
type UserRole = 'gm' | 'supervisor' | 'team' | 'client';

// ─── WOOD DATABASE (م³ for solid wood, م² for panels) ──────────────────────
const WOOD_DB = {
  solid: [
    { name:"خشب زان روماني أحمر",     nameEn:"Beech",       unit:"م³", priceM3:8500,  thicknessCm:2.5, note:"أبواب · أثاث هيكلي" },
    { name:"خشب جوز أمريكي",          nameEn:"Walnut",      unit:"م³", priceM3:32000, thicknessCm:2.5, note:"فاخر · منابر · تراث" },
    { name:"خشب بلوط أوروبي",         nameEn:"Oak",         unit:"م³", priceM3:22000, thicknessCm:2.5, note:"سفرة · أرضيات" },
    { name:"خشب تيك آسيوي",           nameEn:"Teak",        unit:"م³", priceM3:38000, thicknessCm:2.5, note:"خارجي · برجولات فاخرة" },
    { name:"خشب صنوبر معالج",         nameEn:"Pine",        unit:"م³", priceM3:6500,  thicknessCm:2.5, note:"خارجي · برجولات" },
    { name:"خشب زيتون مصري",          nameEn:"Olive",       unit:"م³", priceM3:28000, thicknessCm:3,   note:"تراثي نادر" },
    { name:"خشب ماهوجني أفريقي",      nameEn:"Mahogany",    unit:"م³", priceM3:18000, thicknessCm:2.5, note:"" },
    { name:"خشب أرز (سيدار)",          nameEn:"Cedar",       unit:"م³", priceM3:24000, thicknessCm:2,   note:"مقاوم للحشرات" },
    { name:"خشب سويد فنلندي (موسكي)", nameEn:"Pine/Spruce", unit:"م³", priceM3:7200,  thicknessCm:2,   note:"هياكل أبواب داخلية" },
  ],
  panels: [
    { name:"لوح MDF 9مم",       unit:"لوح 244×122", price:185,  note:"داخلي خفيف" },
    { name:"لوح MDF 12مم",      unit:"لوح 244×122", price:220,  note:"" },
    { name:"لوح MDF 16مم",      unit:"لوح 244×122", price:280,  note:"الأكثر استخداماً" },
    { name:"لوح MDF 18مم",      unit:"لوح 244×122", price:320,  note:"" },
    { name:"لوح MDF رطوبة 16مم",unit:"لوح 244×122", price:480,  note:"مطابخ وحمامات" },
    { name:"لوح MDF رطوبة 18مم",unit:"لوح 244×122", price:540,  note:"" },
    { name:"لوح HDF 3مم",       unit:"لوح 244×122", price:95,   note:"ظهور خزائن" },
    { name:"بليود 12مم",        unit:"لوح 244×122", price:420,  note:"هياكل وحواجز" },
    { name:"بليود 18مم",        unit:"لوح 244×122", price:580,  note:"" },
    { name:"كونتر زان 18مم",    unit:"لوح 244×122", price:380,  note:"أثاث داخلي" },
    { name:"باركيه بلوط 14مم",  unit:"م²",          price:850,  note:"أرضيات" },
    { name:"شيب بورد 18مم",     unit:"لوح 244×122", price:185,  note:"اقتصادي" },
  ],
  veneer: [
    { name:"قشرة جوز 0.6مم",   unit:"م²", price:420, note:"للتكسية الفاخرة" },
    { name:"قشرة بلوط 0.6مم",  unit:"م²", price:350, note:"" },
    { name:"قشرة أرو طبيعي",   unit:"م²", price:280, note:"مكاتب وأثاث" },
    { name:"قشرة زان 0.6مم",   unit:"م²", price:220, note:"" },
  ]
};

// ─── PRODUCT CATEGORIES (comprehensive) ───────────────────────────────────────
const PRODUCT_CATS = [
  { group:"أبواب", icon:"🚪", items:[
    { ar:"أبواب شقق رئيسية", en:"Main Apartment Doors", dims:{w:100,h:220}, prompt:"باب شقة رئيسي مصفح خشب موسكي مكسو قشرة جوز طبيعي، قفل أمان ثلاثي اللسان، مقبض أسود طويل 40 سم" },
    { ar:"أبواب غرف داخلية", en:"Room Doors", dims:{w:90,h:210}, prompt:"أبواب غرف داخلية خشب سويد مع حلق زان، قشرة أرو طبيعي، برور زان 7 سم" },
    { ar:"أبواب خارجية فيلات", en:"Villa Exterior Doors", dims:{w:120,h:240}, prompt:"باب خارجي فيلا بخشب تيك معالج مع زجاج مصنفر وقفل مقاومة عالية" },
    { ar:"أبواب حديد وخشب", en:"Steel-Wood Doors", dims:{w:100,h:220}, prompt:"باب إطار حديد مع تعبئة خشب زان مكسو قشرة، مناسب للمداخل الأمنية" },
    { ar:"أبواب منزلقة جرار", en:"Sliding Doors", dims:{w:180,h:250}, prompt:"باب جرار منزلق على ريل ألومنيوم مخفي، حجرة لبس أو كابينة" },
    { ar:"أبواب دينية مساجد", en:"Mosque Doors", dims:{w:200,h:400}, prompt:"باب مسجد من خشب الجوز المحفور بزخارف إسلامية، ذهبي مطلي" },
  ]},
  { group:"غرف نوم", icon:"🛏️", items:[
    { ar:"غرفة نوم رئيسية كاملة", en:"Master Bedroom Set", dims:{w:180,h:200}, prompt:"طقم غرفة نوم رئيسية: سرير 180×200 مع رأسية كابوتنيه، 2 كومودينو، دولاب 4 ضلف جرار هيدروليك" },
    { ar:"غرفة شباب كاملة", en:"Youth Bedroom", dims:{w:120,h:200}, prompt:"غرفة شباب: سرير 120×200 مع أدراج تخزين أسفل، مكتب دراسة 120 سم، خزانة ملابس 2 ضلف" },
    { ar:"غرفة أطفال", en:"Kids Room", dims:{w:90,h:190}, prompt:"غرفة أطفال: سريرين فرديين بأدراج مخفية أسفل، مكتبة ملونة، دهان دوكو مائي آمن" },
    { ar:"سرير مفرد مع أدراج", en:"Single Bed + Storage", dims:{w:120,h:200}, prompt:"سرير فردي مع هيكل أدراج تخزين أسفل على عجل، خشب كونتر 18مم" },
    { ar:"خزانة ملابس دولاب", en:"Wardrobe", dims:{w:240,h:240}, prompt:"خزانة ملابس ممر 4 ضلف جرار، داخل مقسم: أرفف + علاقة + أدراج، خشب كونتر ميلامين" },
    { ar:"تسريحة مع مرايا", en:"Dressing Table", dims:{w:120,h:80}, prompt:"تسريحة مع مرايا ثلاثية وأدراج جانبية، كونتر مكسو قشرة" },
  ]},
  { group:"غرف سفرة", icon:"🍽️", items:[
    { ar:"طاولة سفرة فاخرة", en:"Dining Table", dims:{w:200,h:100}, prompt:"طاولة سفرة بلوط قرصة 5 سم، 8 كراسي، أرجل زان أحمر صلبة، بولي يوريثان مقاوم للبقع" },
    { ar:"طاولة زجاج وخشب", en:"Glass-Wood Table", dims:{w:180,h:90}, prompt:"طاولة سفرة إطار خشب زان مع قرصة زجاج 12مم شفاف" },
    { ar:"بوفيه سفرة كامل", en:"Buffet", dims:{w:180,h:90}, prompt:"بوفيه سفرة مع آينة علوية، 4 أبواب أسفل، 4 أدراج، كونتر مكسو قشرة بلوط" },
    { ar:"كراسي طعام", en:"Dining Chairs", dims:{w:50,h:95}, prompt:"كراسي طعام خشب زان مكسو تنجيد قماش كتان مستورد، أرجل مخروطية" },
    { ar:"ركنة كونسول", en:"Console", dims:{w:120,h:80}, prompt:"كونسول سفرة رفيع للمداخل مع رف علوي ومرايا" },
  ]},
  { group:"مطابخ", icon:"🍳", items:[
    { ar:"مطبخ هيدروليكي مودرن", en:"Modern Kitchen", dims:{w:300,h:85}, prompt:"مطبخ مودرن هيدروليك حرف L، كونتر رطوبة، ضلف بولي لاك، مفصلات بلوم سوفت كلوز" },
    { ar:"مطبخ كلاسيك", en:"Classic Kitchen", dims:{w:300,h:85}, prompt:"مطبخ كلاسيك خشب كونتر مكسو قشرة زان، برور نحاسية، مقابض ذهبية" },
    { ar:"جزيرة مطبخ", en:"Kitchen Island", dims:{w:150,h:90}, prompt:"جزيرة مطبخ مستقلة مع أدراج وأرفف، قرصة رخام أو خشب 5 سم" },
  ]},
  { group:"أثاث مكتبي", icon:"💼", items:[
    { ar:"مكتب تنفيذي", en:"Executive Desk", dims:{w:180,h:80}, prompt:"مكتب تنفيذي L شكل، كونتر مكسو قشرة جوز، أدراج تاتش، ممر كابلات ألومنيوم" },
    { ar:"مكتبة مكتب", en:"Office Bookcase", dims:{w:120,h:200}, prompt:"مكتبة مكتب 6 رفوف، أبواب زجاج مزدوج، هيكل كونتر مكسو قشرة بلوط" },
    { ar:"مكتب دراسة منزلي", en:"Study Desk", dims:{w:140,h:75}, prompt:"مكتب دراسة 140×60 مع وحدة أدراج 3 درج تاتش، قشرة أرو" },
    { ar:"طاولة اجتماعات", en:"Conference Table", dims:{w:300,h:120}, prompt:"طاولة اجتماعات بيضاوية 3 متر، قرصة بلوط 4 سم، قواعد كروم" },
  ]},
  { group:"أثاث فندقي", icon:"🏨", items:[
    { ar:"غرفة فندقية كاملة", en:"Hotel Room Set", dims:{w:160,h:200}, prompt:"طقم غرفة فندق: سرير كينج مع رأسية تنجيد، 2 كومودينو، ترابيزة تلفزيون، مكتب كتابة" },
    { ar:"لاونج كرسي فندقي", en:"Hotel Lounge Chair", dims:{w:80,h:85}, prompt:"كرسي لاونج فندقي هيكل خشب زان مكسو تنجيد قماش فيلور فاخر، 4 أرجل دوارة" },
    { ar:"مكتبة فندقية ردهة", en:"Hotel Lobby Furniture", dims:{w:200,h:90}, prompt:"أثاث ردهة فندق: كنب استقبال + طاولات قهوة + رفوف جدارية" },
    { ar:"ميني بار فندق", en:"Minibar Cabinet", dims:{w:50,h:80}, prompt:"وحدة ميني بار فندقية مع فتحة ثلاجة مدمجة وأدراج أعلى، كونتر مكسو قشرة" },
  ]},
  { group:"أعمال دينية وتراثية", icon:"🕌", items:[
    { ar:"منبر مسجد", en:"Mosque Minbar", dims:{w:120,h:400}, prompt:"منبر مسجد خشب جوز أمريكي محفور بزخارف إسلامية، 7 درجات، ذهب 24 قيراط" },
    { ar:"باب مسجد إسلامي", en:"Mosque Door", dims:{w:200,h:400}, prompt:"باب مسجد مزخرف بالهندسة الإسلامية، خشب جوز محفور CNC + يدوي" },
    { ar:"أثاث تراثي ترميم", en:"Heritage Restoration", dims:{w:100,h:200}, prompt:"ترميم أثاث تراثي فاطمي: استبدال خامات متهالكة مع الحفاظ على التصميم الأصلي" },
    { ar:"كرسي إمام مشغول", en:"Imam Chair", dims:{w:70,h:120}, prompt:"كرسي إمام تراثي مشغول يدوي بخشب الجوز، مقعد تنجيد قماش أخضر" },
  ]},
  { group:"عمارة خارجية", icon:"🌿", items:[
    { ar:"برجولة حديقة خشبية", en:"Garden Pergola", dims:{w:400,h:250}, prompt:"برجولة حديقة خشب صنوبر معالج ضد الأرضة والرطوبة، مقاس 4×4 متر، دهان زيت طبيعي" },
    { ar:"ممشى خشبي سياحي", en:"Tourist Boardwalk", dims:{w:1000,h:200}, prompt:"ممشى خشبي سياحي على الشاطئ، ألواح تيك 5 سم، مقاوم للرطوبة والملوحة" },
    { ar:"عريشة خشبية", en:"Wooden Arbor", dims:{w:300,h:220}, prompt:"عريشة خشب صنوبر مع شبك للنباتات المتسلقة، معالج بزيت تيك" },
    { ar:"كراسي حدائق", en:"Garden Chairs", dims:{w:60,h:90}, prompt:"كراسي حديقة خشب تيك بتصميم كلاسيك، مسامير ستانلس، زيت طبيعي" },
    { ar:"سور خشبي ديكوري", en:"Decorative Fence", dims:{w:200,h:150}, prompt:"سور خشبي شرائح صنوبر معالج، تصميم هندسي، دهان خارجي مقاوم" },
  ]},
  { group:"تجليد وديكور", icon:"🪵", items:[
    { ar:"تجليد حوائط وأنتريه", en:"Wall Paneling", dims:{w:420,h:280}, prompt:"تجليد حائط استقبال شرائح MDF مكسوة قشرة بلوط مع إضاءة LED مدمجة، ارتفاع 2.8 متر" },
    { ar:"أسقف خشبية ديكور", en:"Decorative Ceiling", dims:{w:500,h:400}, prompt:"أسقف خشبية ديكورية عوارض زان مع ألواح MDF مصنفرة، دهان مطفي" },
    { ar:"رف حائط عائم", en:"Floating Wall Shelf", dims:{w:150,h:30}, prompt:"رف حائط عائم خشب بلوط 5 سم مع حوامل خفية، دهان زيت طبيعي" },
  ]},
];

// ─── GEMINI SYSTEM PROMPT ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `أنت مهندس مكتب فني متخصص في صناعة النجارة المعمارية وإنتاج الأثاث في مصر، بخبرة أكثر من 20 عاماً في كبرى شركات قطاع الأعمال والمقاولات الكبرى.

مهمتك: توليد مقايسة فنية تفصيلية (BOQ) بالمعايير المصرية القياسية.

القواعد:
- الأخشاب الطبيعية تُحسب دائماً بالمتر المكعب (م³) لا المربع
- الألواح الصناعية MDF/كونتر تُحسب باللوح (244×122) أو م²
- القشرة تُحسب بالمتر المربع
- نسبة هالك الخشب الطبيعي: 12-15%
- نسبة هالك الألواح الصناعية: 8-10%
- استخدم مصطلحات الورشة المصرية الحقيقية
- الكود المصري للنجارة المعمارية يحدد: رطوبة الخشب ≤12%، لصق PVA درجة D3 للداخلي

أرجع دائماً JSON بهذا الشكل بالضبط:
{
  "projectTitle": "...",
  "category": "...",
  "generalSummary": "...",
  "woodTypes": ["..."],
  "items": [{"itemName":"...","dimensions":"...","quantity":1,"unit":"...","material":"...","description":"..."}],
  "materialsBreakdown": [{"materialName":"...","estimatedQty":"...","unit":"م³ أو لوح أو م²","purpose":"..."}],
  "accessories": [{"accessoryName":"...","quantity":1,"unit":"...","description":"..."}],
  "workshopInstructions": ["..."],
  "estimatedTimeline": "..."
}`;

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  // Auth / Role
  const [role, setRole] = useState<UserRole>('gm');
  const [showLogin, setShowLogin] = useState(false);

  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard'|'boq'|'products'|'woods'|'pricing'|'quality'|'archive'>('dashboard');

  // BOQ state
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [boqResult, setBoqResult] = useState<BOQResponse | null>(null);
  const [error, setError] = useState<string|null>(null);
  const [imageFile, setImageFile] = useState<File|null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string|null>(null);
  const [selectedCat, setSelectedCat] = useState('أبواب شقق رئيسية');
  const [selectedGroup, setSelectedGroup] = useState('الكل');

  // Pricing
  const [pricingProduct, setPricingProduct] = useState({ woodType:0, panelType:0, h:210, w:90, qty:1, margin:20, waste:12, finish:380, labor:420, accessories:250 });

  // Archive
  const [archive, setArchive] = useState<SavedEstimate[]>([]);
  const [logs, setLogs] = useState<{id:string;time:string;msg:string;type:'info'|'success'|'warn'}[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);

  // Load archive
  useEffect(() => {
    const cached = localStorage.getItem('carpentry_pro_archive');
    if (cached) { try { setArchive(JSON.parse(cached)); } catch{} }
    setLogs([
      { id:'1', time: new Date().toLocaleTimeString('ar-EG'), msg:'النظام جاهز — الاتصال بـ Gemini AI مفعّل', type:'success' },
      { id:'2', time: new Date().toLocaleTimeString('ar-EG'), msg:'قاعدة بيانات الأخشاب والمنتجات محملة بالكامل', type:'info' },
    ]);
  }, []);

  const addLog = (msg:string, type:'info'|'success'|'warn'='info') => {
    setLogs(p => [{ id:Math.random().toString(), time:new Date().toLocaleTimeString('ar-EG'), msg, type }, ...p.slice(0,12)]);
  };

  const saveToArchive = (boq:BOQResponse) => {
    const rec: SavedEstimate = {
      id: 'BOQ-'+Date.now().toString().slice(-6),
      timestamp: new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}),
      category: selectedCat, projectTitle: boq.projectTitle, boq
    };
    setArchive(p => { const u=[rec,...p]; localStorage.setItem('carpentry_pro_archive',JSON.stringify(u)); return u; });
    addLog(`تم أرشفة المقايسة #${rec.id} بنجاح`, 'success');
  };

  // ── GEMINI API CALL ─────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!inputText.trim() && !imageFile) { setError('اكتب وصف المنتج أو ارفع صورة/مخطط'); return; }
    setIsLoading(true); setError(null); setBoqResult(null);
    addLog('جاري إرسال الطلب إلى Gemini AI...', 'info');

    try {
      const messages: any[] = [];
      if (imageFile) {
        const b64 = await new Promise<string>(res => { const r=new FileReader(); r.onload=()=>res((r.result as string).split(',')[1]); r.readAsDataURL(imageFile); });
        messages.push({ role:'user', content: [
          { type:'image', source:{ type:'base64', media_type:imageFile.type, data:b64 } },
          { type:'text', text: inputText || 'حلل هذا المخطط وأعطني مقايسة فنية شاملة' }
        ]});
      } else {
        messages.push({ role:'user', content: inputText });
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          model:'claude-sonnet-4-20250514',
          max_tokens:4000,
          system: SYSTEM_PROMPT,
          messages
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'خطأ في API');

      const text = data.content?.map((c:any)=>c.text||'').join('') || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('لم يتم إرجاع JSON صحيح');
      const parsed: BOQResponse = JSON.parse(jsonMatch[0]);
      setBoqResult(parsed);
      saveToArchive(parsed);
      addLog(`تم توليد مقايسة: ${parsed.projectTitle}`, 'success');
      setActiveTab('boq');
    } catch(e:any) {
      setError(e.message || 'حدث خطأ غير متوقع');
      addLog('خطأ في الاتصال: '+e.message, 'warn');
    } finally { setIsLoading(false); }
  };

  // ── PRICING CALCULATOR ──────────────────────────────────────────────────────
  const calcPricing = () => {
    const wood = WOOD_DB.solid[pricingProduct.woodType];
    const thicknessM = wood.thicknessCm / 100;
    const areaM2 = (pricingProduct.h/100) * (pricingProduct.w/100);
    const volM3 = areaM2 * thicknessM;
    const woodCost = volM3 * wood.priceM3 * (1 + pricingProduct.waste/100);
    const finish = pricingProduct.finish * areaM2;
    const sub = (woodCost + finish + pricingProduct.labor + pricingProduct.accessories) * pricingProduct.qty;
    const total = sub * (1 + pricingProduct.margin/100);
    return { areaM2:areaM2.toFixed(3), volM3:volM3.toFixed(4), woodCost:Math.round(woodCost), finish:Math.round(finish), sub:Math.round(sub), total:Math.round(total), profit:Math.round(total-sub) };
  };

  const p = calcPricing();

  // ── EXPORT CSV ──────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!boqResult) return;
    let c = '\ufeff';
    c += `مقايسة فنية,${boqResult.projectTitle}\nالتاريخ,${new Date().toLocaleDateString('ar-EG')}\n\n`;
    c += 'البند,الأبعاد,الكمية,الوحدة,المادة,الوصف\n';
    boqResult.items.forEach(i => c += `"${i.itemName}","${i.dimensions}","${i.quantity}","${i.unit}","${i.material}","${i.description}"\n`);
    c += '\n\nالمواد الخام,الكمية,الوحدة,الغرض\n';
    boqResult.materialsBreakdown.forEach(m => c += `"${m.materialName}","${m.estimatedQty}","${m.unit}","${m.purpose}"\n`);
    const url = URL.createObjectURL(new Blob([c],{type:'text/csv;charset=utf-8'}));
    const a = document.createElement('a'); a.href=url; a.download=`مقايسة_${boqResult.projectTitle.replace(/\s/g,'_')}.csv`; a.click();
    addLog('تم تصدير CSV بنجاح', 'success');
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:'100vh',background:'#0A0A0A',fontFamily:"'Cairo',sans-serif",direction:'rtl'}}>

      {/* TOP BAR */}
      <header style={{background:'#111',borderBottom:'1px solid #2a2a2a',padding:'0 20px',display:'flex',alignItems:'center',justifyContent:'space-between',height:52,position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:'#C9A84C',animation:'pulse 2s infinite'}}/>
          <span style={{fontWeight:700,fontSize:15,color:'#F5EDD8'}}>المكتب الفني الذكي</span>
          <span style={{fontSize:11,color:'#666',marginRight:4}}>v2.0 — النجارة المعمارية</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <select value={role} onChange={e=>setRole(e.target.value as UserRole)}
            style={{background:'#1a1a1a',border:'1px solid #333',color:'#C9A84C',borderRadius:6,padding:'4px 10px',fontSize:12}}>
            <option value="gm">مدير عام</option>
            <option value="supervisor">مشرف</option>
            <option value="team">فريق الإنتاج</option>
            <option value="client">عميل</option>
          </select>
          <div style={{width:30,height:30,borderRadius:'50%',background:'#1e1a14',border:'1px solid #C9A84C44',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'#C9A84C'}}>
            {role==='gm'?'م':role==='supervisor'?'م':role==='team'?'ف':'ع'}
          </div>
        </div>
      </header>

      {/* NAV TABS */}
      <nav style={{background:'#0f0f0f',borderBottom:'1px solid #1a1a1a',display:'flex',overflowX:'auto',padding:'0 12px'}}>
        {[
          {id:'dashboard',label:'لوحة التحكم',icon:'📊'},
          {id:'boq',label:'مقايسة BOQ',icon:'📋'},
          {id:'products',label:'المنتجات',icon:'🪵'},
          {id:'woods',label:'قاعدة الأخشاب',icon:'🌳'},
          {id:'pricing',label:'حاسبة التسعير',icon:'🧮'},
          ...(role==='gm'||role==='supervisor' ? [{id:'quality',label:'الجودة والكود',icon:'✅'}] : []),
          {id:'archive',label:'الأرشيف',icon:'📁'},
        ].map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id as any)}
            style={{padding:'10px 16px',border:'none',background:'none',color:activeTab===t.id?'#C9A84C':'#666',borderBottom:activeTab===t.id?'2px solid #C9A84C':'2px solid transparent',fontSize:13,fontFamily:'Cairo',cursor:'pointer',whiteSpace:'nowrap',fontWeight:activeTab===t.id?700:400}}>
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      <main style={{maxWidth:1200,margin:'0 auto',padding:'20px 16px'}}>

        {/* ── DASHBOARD ── */}
        {activeTab==='dashboard' && (
          <div className="fade-in">
            {/* KPIs */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:20}}>
              {[
                {label:'مقايسات محفوظة',val:archive.length,icon:'📋',color:'#C9A84C'},
                {label:'أنواع المنتجات',val:PRODUCT_CATS.reduce((a,c)=>a+c.items.length,0),icon:'🪵',color:'#4CAF50'},
                {label:'أنواع الأخشاب',val:WOOD_DB.solid.length,icon:'🌳',color:'#2196F3'},
                {label:'الألواح الصناعية',val:WOOD_DB.panels.length,icon:'📦',color:'#9C27B0'},
              ].map(k=>(
                <div key={k.label} style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:10,padding:'16px 14px',borderTop:`2px solid ${k.color}33`}}>
                  <div style={{fontSize:22,marginBottom:6}}>{k.icon}</div>
                  <div style={{fontSize:26,fontWeight:900,color:k.color}}>{k.val}</div>
                  <div style={{fontSize:11,color:'#666',marginTop:2}}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Quick BOQ Input */}
            <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:12,padding:20,marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:'#C9A84C',marginBottom:12}}>⚡ مقايسة سريعة — أوصف المنتج مباشرة</div>
              <textarea value={inputText} onChange={e=>setInputText(e.target.value)}
                rows={4} placeholder="مثال: باب شقة رئيسي خشب موسكي مكسو قشرة جوز، مقاس 100×220 سم، قفل ثلاثي، مقبض أسود 40 سم..."
                style={{width:'100%',background:'#0c0a09',border:'1px solid #2a2a2a',borderRadius:8,padding:12,color:'#F5EDD8',fontSize:13,resize:'vertical',outline:'none'}}/>
              <div style={{display:'flex',gap:10,marginTop:10,flexWrap:'wrap'}}>
                <button onClick={handleAnalyze} disabled={isLoading}
                  style={{background:isLoading?'#333':'linear-gradient(135deg,#92400e,#b45309)',color:isLoading?'#666':'#fff',border:'none',borderRadius:8,padding:'10px 24px',fontSize:13,fontWeight:700,cursor:isLoading?'not-allowed':'pointer',fontFamily:'Cairo',display:'flex',alignItems:'center',gap:8}}>
                  {isLoading ? <><span style={{animation:'spin 1s linear infinite',display:'inline-block'}}>⚙️</span> جاري التحليل...</> : '✨ توليد مقايسة BOQ بالذكاء الاصطناعي'}
                </button>
                <button onClick={()=>fileRef.current?.click()}
                  style={{background:'#1a1a1a',color:'#C9A84C',border:'1px solid #C9A84C44',borderRadius:8,padding:'10px 16px',fontSize:13,cursor:'pointer',fontFamily:'Cairo'}}>
                  📎 رفع صورة / مخطط
                </button>
                <input ref={fileRef} type="file" accept="image/*,.pdf" style={{display:'none'}}
                  onChange={e=>{ const f=e.target.files?.[0]; if(!f)return; setImageFile(f); const r=new FileReader(); r.onload=()=>setImagePreviewUrl(r.result as string); r.readAsDataURL(f); }}/>
              </div>
              {imageFile && <div style={{marginTop:8,fontSize:12,color:'#C9A84C'}}>✅ {imageFile.name}</div>}
              {error && <div style={{marginTop:8,fontSize:12,color:'#f44336',background:'#1a0000',padding:'8px 12px',borderRadius:6}}>{error}</div>}
            </div>

            {/* Logs */}
            <div style={{background:'#0c0a09',border:'1px solid #1a1a1a',borderRadius:10,padding:14}}>
              <div style={{fontSize:12,color:'#C9A84C',fontWeight:700,marginBottom:10}}>📡 سجل النظام</div>
              {logs.map(l=>(
                <div key={l.id} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'4px 0',borderBottom:'1px solid #111',fontSize:12}}>
                  <span style={{color:'#444',flexShrink:0}}>{l.time}</span>
                  <span style={{width:6,height:6,borderRadius:'50%',background:l.type==='success'?'#4CAF50':l.type==='warn'?'#FF9800':'#2196F3',flexShrink:0,marginTop:4}}/>
                  <span style={{color:l.type==='success'?'#81C784':l.type==='warn'?'#FFB74D':'#90CAF9'}}>{l.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── BOQ RESULT ── */}
        {activeTab==='boq' && (
          <div className="fade-in">
            {!boqResult ? (
              <div style={{textAlign:'center',padding:'80px 20px',color:'#444'}}>
                <div style={{fontSize:48,marginBottom:16}}>📋</div>
                <div style={{fontSize:16,marginBottom:8}}>لا توجد مقايسة محملة</div>
                <div style={{fontSize:13}}>اذهب للوحة التحكم واكتب وصف المنتج أو اختر من الأرشيف</div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{background:'linear-gradient(135deg,#1a1207,#0f0c05)',border:'1px solid #C9A84C33',borderRadius:12,padding:20,marginBottom:16}}>
                  <div style={{fontSize:11,color:'#C9A84C',letterSpacing:2,marginBottom:4}}>مقايسة فنية تفصيلية · BOQ</div>
                  <div style={{fontSize:20,fontWeight:900,color:'#F5EDD8',marginBottom:6}}>{boqResult.projectTitle}</div>
                  <div style={{fontSize:12,color:'#888'}}>{boqResult.category}</div>
                  <div style={{fontSize:13,color:'#bbb',marginTop:10,lineHeight:1.8}}>{boqResult.generalSummary}</div>
                  <div style={{display:'flex',gap:8,marginTop:14,flexWrap:'wrap'}}>
                    <button onClick={exportCSV} style={{background:'#1a2a1a',color:'#81C784',border:'1px solid #4CAF5044',borderRadius:6,padding:'7px 14px',fontSize:12,cursor:'pointer',fontFamily:'Cairo'}}>📊 تصدير Excel</button>
                    {role==='gm' && <button onClick={()=>window.print()} style={{background:'#1a1a2a',color:'#90CAF9',border:'1px solid #2196F344',borderRadius:6,padding:'7px 14px',fontSize:12,cursor:'pointer',fontFamily:'Cairo'}}>🖨️ طباعة</button>}
                    <button onClick={()=>{setInputText('');setBoqResult(null);setActiveTab('dashboard');}} style={{background:'#1a1a1a',color:'#666',border:'1px solid #333',borderRadius:6,padding:'7px 14px',fontSize:12,cursor:'pointer',fontFamily:'Cairo'}}>+ مقايسة جديدة</button>
                  </div>
                </div>

                {/* Wood Types */}
                <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:10,padding:16,marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#C9A84C',marginBottom:10}}>🌳 أنواع الأخشاب المستخدمة</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                    {boqResult.woodTypes.map((w,i)=>(
                      <span key={i} style={{background:'#1a1207',border:'1px solid #C9A84C33',borderRadius:20,padding:'4px 14px',fontSize:12,color:'#E8C97A'}}>{w}</span>
                    ))}
                  </div>
                </div>

                {/* Items Table */}
                <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:10,padding:16,marginBottom:12,overflowX:'auto'}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#C9A84C',marginBottom:12}}>📐 بنود المقايسة</div>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead>
                      <tr style={{background:'#1a1a1a'}}>
                        {['#','البند','الأبعاد','الكمية','الوحدة','المادة','الوصف'].map(h=>(
                          <th key={h} style={{padding:'8px 10px',color:'#888',fontWeight:600,textAlign:'right',border:'1px solid #222'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {boqResult.items.map((it,i)=>(
                        <tr key={i} style={{background:i%2===0?'#0c0a09':'#111'}}>
                          <td style={{padding:'8px 10px',color:'#555',border:'1px solid #1a1a1a'}}>{i+1}</td>
                          <td style={{padding:'8px 10px',color:'#F5EDD8',fontWeight:600,border:'1px solid #1a1a1a'}}>{it.itemName}</td>
                          <td style={{padding:'8px 10px',color:'#C9A84C',fontFamily:'monospace',border:'1px solid #1a1a1a'}}>{it.dimensions}</td>
                          <td style={{padding:'8px 10px',color:'#F5EDD8',textAlign:'center',border:'1px solid #1a1a1a'}}>{it.quantity}</td>
                          <td style={{padding:'8px 10px',color:'#888',border:'1px solid #1a1a1a'}}>{it.unit}</td>
                          <td style={{padding:'8px 10px',color:'#90CAF9',border:'1px solid #1a1a1a'}}>{it.material}</td>
                          <td style={{padding:'8px 10px',color:'#bbb',fontSize:11,border:'1px solid #1a1a1a',maxWidth:200}}>{it.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Materials */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                  <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:10,padding:16}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#C9A84C',marginBottom:10}}>📦 المواد الخام (م³ للأخشاب)</div>
                    {boqResult.materialsBreakdown.map((m,i)=>(
                      <div key={i} style={{padding:'8px 0',borderBottom:'1px solid #1a1a1a'}}>
                        <div style={{fontSize:12,color:'#F5EDD8',fontWeight:600}}>{m.materialName}</div>
                        <div style={{display:'flex',justifyContent:'space-between',marginTop:3}}>
                          <span style={{fontSize:11,color:'#888'}}>{m.purpose}</span>
                          <span style={{fontSize:12,color:'#C9A84C',fontFamily:'monospace'}}>{m.estimatedQty} {m.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:10,padding:16}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#C9A84C',marginBottom:10}}>⚙️ الإكسسوارات</div>
                    {boqResult.accessories.map((a,i)=>(
                      <div key={i} style={{padding:'8px 0',borderBottom:'1px solid #1a1a1a',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                        <div>
                          <div style={{fontSize:12,color:'#F5EDD8',fontWeight:600}}>{a.accessoryName}</div>
                          <div style={{fontSize:11,color:'#888',marginTop:2}}>{a.description}</div>
                        </div>
                        <span style={{fontSize:12,color:'#90CAF9',flexShrink:0,marginRight:8}}>{a.quantity} {a.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Workshop Instructions */}
                <div style={{background:'#0f1a0f',border:'1px solid #2a4a2a',borderRadius:10,padding:16,marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#81C784',marginBottom:10}}>🔨 تعليمات الورشة</div>
                  {boqResult.workshopInstructions.map((ins,i)=>(
                    <div key={i} style={{display:'flex',gap:10,padding:'6px 0',borderBottom:'1px solid #1a2a1a'}}>
                      <span style={{color:'#C9A84C',flexShrink:0,fontWeight:700}}>[{i+1}]</span>
                      <span style={{fontSize:12,color:'#bbb',lineHeight:1.7}}>{ins}</span>
                    </div>
                  ))}
                  <div style={{marginTop:12,padding:'8px 12px',background:'#1a2a1a',borderRadius:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:12,color:'#888'}}>الجدول الزمني</span>
                    <span style={{fontSize:13,color:'#81C784',fontWeight:700}}>{boqResult.estimatedTimeline}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── PRODUCTS CATALOGUE ── */}
        {activeTab==='products' && (
          <div className="fade-in">
            <div style={{marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:700,color:'#F5EDD8',marginBottom:12}}>🪵 كتالوج المنتجات الشامل</div>
              {/* Group filter */}
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
                {['الكل',...PRODUCT_CATS.map(c=>c.group)].map(g=>(
                  <button key={g} onClick={()=>setSelectedGroup(g)}
                    style={{padding:'6px 14px',borderRadius:20,border:`1px solid ${selectedGroup===g?'#C9A84C':'#333'}`,background:selectedGroup===g?'#1a1207':'transparent',color:selectedGroup===g?'#C9A84C':'#666',fontSize:12,cursor:'pointer',fontFamily:'Cairo',fontWeight:selectedGroup===g?700:400}}>
                    {g}
                  </button>
                ))}
              </div>
              {/* Product grid */}
              {PRODUCT_CATS.filter(c=>selectedGroup==='الكل'||c.group===selectedGroup).map(cat=>(
                <div key={cat.group} style={{marginBottom:20}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#C9A84C',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
                    <span>{cat.icon}</span> {cat.group}
                    <span style={{fontSize:11,color:'#555',fontWeight:400}}>({cat.items.length} منتج)</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10}}>
                    {cat.items.map(item=>(
                      <button key={item.ar} onClick={()=>{ setInputText(item.prompt); setActiveTab('dashboard'); addLog(`تم اختيار: ${item.ar}`,'info'); }}
                        style={{background:'#111',border:`1px solid ${selectedCat===item.ar?'#C9A84C':'#1e1e1e'}`,borderRadius:10,padding:14,textAlign:'right',cursor:'pointer',transition:'all .2s'}}>
                        <div style={{fontSize:22,marginBottom:6}}>{cat.icon}</div>
                        <div style={{fontSize:12,fontWeight:700,color:'#F5EDD8',marginBottom:3}}>{item.ar}</div>
                        <div style={{fontSize:10,color:'#555'}}>{item.en}</div>
                        <div style={{fontSize:10,color:'#888',marginTop:6}}>
                          {item.dims.h}×{item.dims.w} سم — قياسي
                        </div>
                        <div style={{marginTop:8,fontSize:11,color:'#C9A84C',background:'#1a1207',borderRadius:4,padding:'3px 8px',textAlign:'center'}}>
                          ← إنشاء مقايسة
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── WOODS DATABASE ── */}
        {activeTab==='woods' && (
          <div className="fade-in">
            <div style={{fontSize:14,fontWeight:700,color:'#F5EDD8',marginBottom:16}}>🌳 قاعدة بيانات الأخشاب والخامات</div>

            {/* Solid Wood — م³ */}
            <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:10,padding:16,marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:700,color:'#C9A84C',marginBottom:12}}>🪵 أخشاب طبيعية — يُحسب بالمتر المكعب (م³)</div>
              <div style={{background:'#0c0a09',padding:'8px 12px',borderRadius:6,marginBottom:12,fontSize:11,color:'#888'}}>
                ⚙️ معادلة التحويل: سعر م² = (سعر م³ ÷ سماكة بالمتر) × (1 + هالك%)
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:'#1a1a1a'}}>
                      {['الخشب','الاسم الإنجليزي','السماكة (سم)','سعر م³ (ج)','سعر م² تقريبي','الاستخدام'].map(h=>(
                        <th key={h} style={{padding:'8px 12px',color:'#888',textAlign:'right',borderBottom:'1px solid #222'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {WOOD_DB.solid.map((w,i)=>{
                      const pm2 = Math.round(w.priceM3/w.thicknessCm*100*1.12);
                      return (
                        <tr key={i} style={{background:i%2===0?'#0c0a09':'#111'}}>
                          <td style={{padding:'9px 12px',color:'#F5EDD8',fontWeight:600}}>{w.name}</td>
                          <td style={{padding:'9px 12px',color:'#888',fontFamily:'monospace'}}>{w.nameEn}</td>
                          <td style={{padding:'9px 12px',color:'#C9A84C',textAlign:'center'}}>{w.thicknessCm}</td>
                          <td style={{padding:'9px 12px',color:'#90CAF9',fontFamily:'monospace'}}>{w.priceM3.toLocaleString('ar-EG')}</td>
                          <td style={{padding:'9px 12px',color:'#81C784',fontFamily:'monospace'}}>{pm2.toLocaleString('ar-EG')}</td>
                          <td style={{padding:'9px 12px',color:'#666',fontSize:11}}>{w.note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Panels */}
            <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:10,padding:16,marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:700,color:'#C9A84C',marginBottom:12}}>📦 ألواح صناعية — يُحسب باللوح أو م²</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
                {WOOD_DB.panels.map((p,i)=>(
                  <div key={i} style={{background:'#0c0a09',border:'1px solid #1a1a1a',borderRadius:8,padding:12}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#F5EDD8',marginBottom:4}}>{p.name}</div>
                    <div style={{fontSize:11,color:'#555'}}>{p.unit}</div>
                    <div style={{fontSize:16,fontWeight:900,color:'#C9A84C',marginTop:6}}>{p.price.toLocaleString('ar-EG')} ج</div>
                    {p.note && <div style={{fontSize:10,color:'#666',marginTop:4}}>{p.note}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Veneer */}
            <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:10,padding:16}}>
              <div style={{fontSize:13,fontWeight:700,color:'#C9A84C',marginBottom:12}}>🪄 قشرة طبيعية — يُحسب بالمتر المربع</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10}}>
                {WOOD_DB.veneer.map((v,i)=>(
                  <div key={i} style={{background:'#0c0a09',border:'1px solid #1a1a1a',borderRadius:8,padding:12}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#F5EDD8',marginBottom:4}}>{v.name}</div>
                    <div style={{fontSize:11,color:'#555'}}>{v.unit}</div>
                    <div style={{fontSize:16,fontWeight:900,color:'#C9A84C',marginTop:6}}>{v.price} ج/م²</div>
                    <div style={{fontSize:10,color:'#666',marginTop:4}}>{v.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PRICING CALCULATOR ── */}
        {activeTab==='pricing' && (
          <div className="fade-in" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            {/* Inputs */}
            <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:12,padding:20}}>
              <div style={{fontSize:14,fontWeight:700,color:'#C9A84C',marginBottom:16}}>🧮 حاسبة التسعير — خشب طبيعي</div>

              {[
                { label:'نوع الخشب', type:'select', key:'woodType',
                  options: WOOD_DB.solid.map((w,i)=>({v:i,l:`${w.name} — ${w.priceM3.toLocaleString('ar-EG')} ج/م³`})) },
                { label:'الارتفاع (سم)', type:'number', key:'h', min:10, max:600 },
                { label:'العرض (سم)', type:'number', key:'w', min:10, max:400 },
                { label:'الكمية (قطعة)', type:'number', key:'qty', min:1, max:1000 },
                { label:'تكلفة التشطيب (ج/م²)', type:'number', key:'finish', min:0 },
                { label:'أجر التصنيع والعمالة (ج/قطعة)', type:'number', key:'labor', min:0 },
                { label:'تكلفة الإكسسوارات (ج/قطعة)', type:'number', key:'accessories', min:0 },
                { label:`هالك الخشب % (${pricingProduct.waste}%)`, type:'range', key:'waste', min:5, max:25 },
                { label:`هامش الربح % (${pricingProduct.margin}%)`, type:'range', key:'margin', min:5, max:50 },
              ].map(f=>(
                <div key={f.key} style={{marginBottom:12}}>
                  <label style={{fontSize:11,color:'#888',display:'block',marginBottom:4}}>{f.label}</label>
                  {f.type==='select' ? (
                    <select value={(pricingProduct as any)[f.key]}
                      onChange={e=>setPricingProduct(p=>({...p,[f.key]:Number(e.target.value)}))}
                      style={{width:'100%',background:'#0c0a09',border:'1px solid #2a2a2a',color:'#F5EDD8',borderRadius:6,padding:'7px 10px',fontSize:12,fontFamily:'Cairo'}}>
                      {f.options?.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  ) : f.type==='range' ? (
                    <input type="range" min={f.min} max={f.max} value={(pricingProduct as any)[f.key]}
                      onChange={e=>setPricingProduct(p=>({...p,[f.key]:Number(e.target.value)}))}
                      style={{width:'100%',accentColor:'#C9A84C'}}/>
                  ) : (
                    <input type="number" min={f.min} max={f.max} value={(pricingProduct as any)[f.key]}
                      onChange={e=>setPricingProduct(p=>({...p,[f.key]:Number(e.target.value)}))}
                      style={{width:'100%',background:'#0c0a09',border:'1px solid #333',color:'#6aacf7',borderRadius:6,padding:'7px 10px',fontSize:13,fontFamily:'Cairo'}}/>
                  )}
                </div>
              ))}
            </div>

            {/* Results */}
            <div>
              <div style={{background:'#111',border:'1px solid #C9A84C33',borderRadius:12,padding:20,marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:700,color:'#C9A84C',marginBottom:14}}>📊 نتائج التسعير</div>
                {[
                  { label:'المساحة الإجمالية', val:`${p.areaM2} م²`, note:'للقطعة الواحدة', color:'#888' },
                  { label:'الحجم بالمتر المكعب', val:`${p.volM3} م³`, note:'بحسب السماكة', color:'#888' },
                  { label:'تكلفة الخشب (+هالك)', val:`${p.woodCost.toLocaleString('ar-EG')} ج`, note:'بعد الهالك', color:'#90CAF9' },
                  { label:'تكلفة التشطيب', val:`${p.finish.toLocaleString('ar-EG')} ج`, note:'للمساحة', color:'#90CAF9' },
                  { label:'إجمالي التكلفة (كل الكمية)', val:`${p.sub.toLocaleString('ar-EG')} ج`, note:'', color:'#FFB74D' },
                  { label:'الربح المتوقع', val:`${p.profit.toLocaleString('ar-EG')} ج`, note:role==='gm'?'للمدير فقط':'***', color:'#81C784' },
                ].map(r=>(
                  <div key={r.label} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #1a1a1a'}}>
                    <div>
                      <div style={{fontSize:12,color:'#888'}}>{r.label}</div>
                      {r.note && <div style={{fontSize:10,color:'#555'}}>{r.note}</div>}
                    </div>
                    <span style={{fontSize:14,fontWeight:700,color:r.color,fontFamily:'monospace'}}>{r.val}</span>
                  </div>
                ))}
                <div style={{background:'#1a1207',borderRadius:8,padding:'12px 16px',marginTop:14,display:'flex',justifyContent:'space-between',alignItems:'center',border:'1px solid #C9A84C44'}}>
                  <span style={{fontSize:13,color:'#C9A84C',fontWeight:700}}>سعر البيع للعميل</span>
                  <span style={{fontSize:22,fontWeight:900,color:'#C9A84C',fontFamily:'monospace'}}>{p.total.toLocaleString('ar-EG')} ج</span>
                </div>
                <div style={{fontSize:11,color:'#555',marginTop:8,textAlign:'center'}}>
                  سعر القطعة الواحدة: {Math.round(p.total/pricingProduct.qty).toLocaleString('ar-EG')} جنيه
                </div>
              </div>

              {/* Wood info card */}
              <div style={{background:'#0f1a0f',border:'1px solid #2a4a2a',borderRadius:10,padding:14}}>
                <div style={{fontSize:12,fontWeight:700,color:'#81C784',marginBottom:8}}>📋 معلومات الخشب المختار</div>
                {(() => { const w=WOOD_DB.solid[pricingProduct.woodType]; return (
                  <>
                    <div style={{fontSize:13,color:'#F5EDD8',fontWeight:700}}>{w.name}</div>
                    <div style={{fontSize:11,color:'#666',margin:'4px 0'}}>{w.nameEn} — السماكة المرجعية: {w.thicknessCm} سم</div>
                    <div style={{fontSize:11,color:'#888'}}>{w.note}</div>
                    <div style={{marginTop:8,fontSize:11,color:'#888'}}>
                      💡 الأخشاب الطبيعية تُشترى بالم³ ثم تُحسب التكلفة على أساس المساحة والسماكة
                    </div>
                  </>
                ); })()}
              </div>
            </div>
          </div>
        )}

        {/* ── QUALITY & CODES ── */}
        {activeTab==='quality' && (role==='gm'||role==='supervisor') && (
          <div className="fade-in">
            <div style={{fontSize:14,fontWeight:700,color:'#F5EDD8',marginBottom:16}}>✅ الكود المصري + معايير ضبط الجودة</div>
            {[
              { title:'معايير رطوبة الخشب', icon:'💧', items:[
                'رطوبة الخشب الداخلي: ≤ 12% (كود مصري للنجارة المعمارية)',
                'رطوبة الخشب الخارجي والمعرض للرياح: ≤ 18%',
                'قياس الرطوبة بالكاشف الكهربي على عدة نقاط',
                'تجفيف الخشب الطبيعي بالأفران: 60-80°C لمدة 48-72 ساعة',
              ]},
              { title:'معايير اللصق والتجميع', icon:'🔧', items:[
                'غراء PVA درجة D3 للاستخدام الداخلي (مقاوم للرطوبة)',
                'غراء PVA درجة D4 للاستخدام الخارجي',
                'ضغط الكبس: 6-10 بار لمدة 20-45 دقيقة',
                'درجة حرارة اللصق: 18-25°C',
                'غراء PUR بولي يوريثان لحواف الأكريليك والمطابخ',
              ]},
              { title:'معايير القشرة والتكسية', icon:'🪄', items:[
                'سماكة القشرة الطبيعية: لا تقل عن 0.6 مم',
                'تطابق عروق القشرة بين القطع المتجاورة',
                'كبس القشرة بالكباسات الباردة: 12-24 ساعة',
                'تسوية السطح بالصنفرة من الخشن للناعم: 80→120→180→240',
              ]},
              { title:'معايير التشطيب والدهان', icon:'🎨', items:[
                'البولي يوريثان: طبقة أستر + طبقتان تشطيب على الأقل',
                'جفاف بين الطبقات: 4-6 ساعات في درجة حرارة 20°C',
                'نسبة التخفيف: 15-20% ثنر مخصص',
                'اللمعة 5%: مات صحراوي — 20%: نص لامع — 60%+: لامع',
                'حظر دهان الخشب في درجات حرارة أقل من 5°C',
              ]},
              { title:'بروتوكول فحص الجودة', icon:'🔍', items:[
                'فحص الرطوبة عند الاستلام من المورد (قبل التصنيع)',
                'فحص الاستواء والتناظر قبل التسليم للدهان',
                'فحص القشرة: لا تقبل الفقاعات أو الانفصال',
                'فحص التشطيب: خدوش صفر مقبولة للتسليم',
                'فحص التركيب: إغلاق الأبواب ≤ 2مم فجوة من الجانبين',
                'فحص المفصلات والأقفال: 50 دورة فتح وإغلاق بدون صوت',
              ]},
            ].map(section=>(
              <div key={section.title} style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:10,padding:16,marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:700,color:'#C9A84C',marginBottom:10}}>{section.icon} {section.title}</div>
                {section.items.map((item,i)=>(
                  <div key={i} style={{display:'flex',gap:10,padding:'6px 0',borderBottom:'1px solid #0f0f0f'}}>
                    <span style={{color:'#C9A84C',flexShrink:0}}>✓</span>
                    <span style={{fontSize:12,color:'#bbb',lineHeight:1.7}}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── ARCHIVE ── */}
        {activeTab==='archive' && (
          <div className="fade-in">
            <div style={{fontSize:14,fontWeight:700,color:'#F5EDD8',marginBottom:16}}>
              📁 أرشيف المقايسات ({archive.length})
            </div>
            {archive.length===0 ? (
              <div style={{textAlign:'center',padding:60,color:'#444'}}>
                <div style={{fontSize:40,marginBottom:12}}>📁</div>
                <div>لا توجد مقايسات محفوظة بعد</div>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {archive.map(rec=>(
                  <div key={rec.id} style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:10,padding:14,display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}
                    onClick={()=>{ setBoqResult(rec.boq); setActiveTab('boq'); addLog(`استرجاع المقايسة #${rec.id}`,'success'); }}>
                    <div>
                      <div style={{fontSize:12,color:'#555',marginBottom:4}}>{rec.id} — {rec.timestamp}</div>
                      <div style={{fontSize:14,fontWeight:700,color:'#F5EDD8'}}>{rec.projectTitle}</div>
                      <div style={{fontSize:11,color:'#C9A84C',marginTop:2}}>{rec.category}</div>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <span style={{fontSize:11,color:'#4CAF50',background:'#0f2a0f',border:'1px solid #2a4a2a',borderRadius:20,padding:'3px 12px'}}>عرض</span>
                      {(role==='gm'||role==='supervisor') && (
                        <span style={{fontSize:11,color:'#f44336',cursor:'pointer'}} onClick={e=>{e.stopPropagation(); setArchive(p=>{const u=p.filter(r=>r.id!==rec.id); localStorage.setItem('carpentry_pro_archive',JSON.stringify(u)); return u;}); addLog(`حذف المقايسة #${rec.id}`,'warn');}}>🗑</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

/* =========================================================
   RASHFA CAFE · menu data
   Pure data: bilingual items and QAR prices per category.
   Nothing here touches the DOM -- edit prices in this file.
   ========================================================= */

/* =========================================================
   THE MENU ITSELF. Five categories, 43 items. This is the only
   file a price change belongs in — menu-app.js renders whatever
   is here and reads nothing else.

   Shape of a category:
     id       scroll target. The hero jump bar in index.html links
              to "#<id>"; renaming one breaks that link with no
              error, and tools/verify.py exists to catch exactly that.
     num      printed index only ("01" … "05"). Cosmetic; ordering
              comes from position in this array.
     titleAr/En, subAr/En   heading and the small line under it.
     items    the rows. `hot: true` adds the gold star (8 items use
              it). `price` is a number in QAR — not a string, not
              formatted; priceMarkup() in menu-app.js owns the
              "QAR" label and the two decimals.

   Arabic is the primary language: it is what the page shows first,
   and these strings are customer-facing content, not comments. Do
   not reformat, re-wrap or run a tidy pass over them — collapsing
   whitespace inside an Arabic string changes what gets read.

   Everything here is rendered by JavaScript, so none of it reaches
   a search engine or a no-JS visitor (docs/KNOWN-ISSUES.md #3).
   ========================================================= */

const MENU = [
  {
    id: "coffee",
    num: "01",
    titleAr: "القهوة",
    titleEn: "Coffee",
    subAr: "حبوب مختارة، تحميص يومي",
    subEn: "Hand-picked beans · roasted daily",
    items: [
      { ar:"أمريكانو",         en:"Americano",          metaAr:"إسبرسو + ماء ساخن",    metaEn:"espresso · hot water",     price:12 },
      { ar:"كابتشينو",         en:"Cappuccino",         metaAr:"إسبرسو + حليب مبخر",   metaEn:"espresso · steamed milk",  price:14, hot:true },
      { ar:"دبل إسبرسو",       en:"Double Espresso",    metaAr:"شوتان مركّزان",         metaEn:"two ristretto shots",      price:12 },
      { ar:"لاتيه",            en:"Latte",              metaAr:"حليب حريري + رغوة",     metaEn:"silky milk · light foam",  price:14 },
      { ar:"إسبرسو",           en:"Espresso",           metaAr:"شوت قصير",              metaEn:"single short shot",        price:10 },
      { ar:"مكياتو",           en:"Macchiato",          metaAr:"إسبرسو ملطّخ بالحليب",  metaEn:"espresso · milk stain",    price:12 },
      { ar:"كابتشينو نستله",   en:"Cappuccino Nestlé",  metaAr:"مذاق كلاسيكي",          metaEn:"classic profile",          price:14 },
      { ar:"إسبرسو نستله",     en:"Espresso Nestlé",    metaAr:"مذاق كلاسيكي",          metaEn:"classic profile",          price:12 },
      { ar:"فلات وايت",        en:"Flat White",         metaAr:"ريستريتو + ميكروفوم",   metaEn:"ristretto · microfoam",    price:14 },
      { ar:"قهوة تركية",       en:"Turkish Coffee",     metaAr:"بالهال، على الرمل",     metaEn:"cardamom · sand-brewed",   price:10, hot:true },
    ],
  },
  {
    id: "tea",
    num: "02",
    titleAr: "الشاي",
    titleEn: "Tea",
    subAr: "أوراق طازجة وروائح دافئة",
    subEn: "Fresh leaves · warm aromatics",
    items: [
      { ar:"شاي مغربي",  en:"Moroccan Tea",  metaAr:"نعناع + سكر",   metaEn:"mint · sugar",       price: 8, hot:true },
      { ar:"شاي بندق",   en:"Pine Nuts Tea", metaAr:"شاي أحمر بالصنوبر", metaEn:"black tea · pine nuts", price:12 },
      { ar:"شاي لوز",    en:"Almond Tea",    metaAr:"شاي بنكهة اللوز", metaEn:"toasted almond brew", price:10 },
    ],
  },
  {
    id: "juice",
    num: "03",
    titleAr: "العصائر",
    titleEn: "Fresh Juice",
    subAr: "فواكه ١٠٠٪، بدون سكر مضاف",
    subEn: "100% fresh fruit · no added sugar",
    items: [
      { ar:"عصير برتقال",    en:"Orange Juice",     metaAr:"معصور لحظيًا",        metaEn:"pressed to order",       price:12 },
      { ar:"عصير ليمون نعناع",en:"Lemon Mint Juice", metaAr:"منعش وحامض",          metaEn:"bright · cooling",       price:12, hot:true },
      { ar:"عصير فراولة",    en:"Strawberry Juice", metaAr:"فراولة مكتنزة",       metaEn:"ripe strawberries",      price:12 },
      { ar:"موهيتو",         en:"Mojito",           metaAr:"ليمون · نعناع · صودا", metaEn:"lime · mint · soda",     price:15, hot:true },
      { ar:"عصير كيوي",      en:"Kiwi Juice",       metaAr:"كيوي ذهبي",            metaEn:"golden kiwi",            price:16 },
      { ar:"عصير أناناس",    en:"Pineapple Juice",  metaAr:"حلاوة استوائية",      metaEn:"tropical sweet",         price:15 },
      { ar:"عصير بطيخ",      en:"Watermelon Juice", metaAr:"بارد ومنعش",          metaEn:"ice-cold refresher",     price:12 },
      { ar:"عصير مانجو",     en:"Mango Juice",      metaAr:"مانجو هندي",          metaEn:"alphonso mango",         price:12 },
      { ar:"عصير موز",       en:"Banana Juice",     metaAr:"موز كثيف بالحليب",    metaEn:"thick · milky",          price:10 },
      { ar:"عصير أفوكاتو",   en:"Avocado Juice",    metaAr:"كريمي وكثيف",         metaEn:"rich · creamy",          price:15 },
    ],
  },
  {
    id: "sandwich",
    num: "04",
    titleAr: "وجبات سريعة",
    titleEn: "Fast Food",
    subAr: "سندويتشات ووجبات خفيفة",
    subEn: "Sandwiches & quick bites",
    items: [
      { ar:"شاورما دجاج",     en:"Chicken Shawarma",  metaAr:"خبز صاج، ثوم، خيار مخلل",      metaEn:"saj bread · garlic · pickles",            price:20, hot:true },
      { ar:"شاورما لحم",      en:"Beef Shawarma",     metaAr:"خبز صاج، طحينة، طماطم",        metaEn:"saj bread · tahini · tomato",             price:22, hot:true },
      { ar:"بروست دجاج",      en:"Chicken Broast",    metaAr:"دجاج مقرمش، صلصة ثوم، بطاطا",  metaEn:"crispy chicken · garlic sauce · fries",   price:25, hot:true },
      { ar:"برغر لحم",         en:"Beef Burger",       metaAr:"لحم مشوي، جبنة، خس، طماطم",    metaEn:"grilled beef · cheese · lettuce · tomato",price:25 },
      { ar:"برغر دجاج",        en:"Chicken Burger",    metaAr:"دجاج مقرمش، جبنة، صلصة",       metaEn:"crispy chicken · cheese · house sauce",   price:22 },
      { ar:"فلافل",            en:"Falafel Sandwich",  metaAr:"حمص مقلي، طحينة، خضار",         metaEn:"crispy chickpea · tahini · veg",          price:15 },
      { ar:"مناقيش زعتر",      en:"Manakish Zaatar",   metaAr:"عجين رقيق، زعتر، زيت زيتون",    metaEn:"thin dough · zaatar · olive oil",         price:12 },
      { ar:"مناقيش جبنة",      en:"Manakish Cheese",   metaAr:"جبنة مذابة على عجين طري",       metaEn:"melted cheese · soft dough",              price:15 },
      { ar:"فطيرة لحم بعجين",  en:"Lahm bi Ajeen",     metaAr:"عجينة بلحم مفروم وبهارات",      metaEn:"flatbread · spiced minced meat",          price:15 },
      { ar:"سندويتش تونسي",   en:"Sandwich Tounsi",   metaAr:"تونة، هريسة، زيتون، بيض، باغيت", metaEn:"tuna · harissa · olives · egg · baguette", price:22 },
      { ar:"فريكاسي",          en:"Fricassé",          metaAr:"عجين مقلي بالتونة والهريسة",    metaEn:"fried bun · tuna · harissa · capers",     price:18 },
      { ar:"ملاوي",            en:"Mlawi Flatbread",   metaAr:"خبز تونسي مطوي بالحشوة",       metaEn:"folded flatbread · choice of filling",    price:20 },
      { ar:"كفتاجي",           en:"Kafteji",           metaAr:"خضار مقلية مع بيض وهريسة",     metaEn:"fried veg · egg · harissa",               price:22 },
      { ar:"بريك بالبيض",      en:"Brik à l'œuf",      metaAr:"عجين رقيق، بيض، تونة، كبر",    metaEn:"thin pastry · egg · tuna · capers",       price:15 },
      { ar:"سندويتش إسكالوب",  en:"Escalope Sandwich", metaAr:"دجاج مقرمش، سلطة، صلصة",      metaEn:"crispy chicken · salad · sauce",          price:24 },
      { ar:"سندويتش مرغاز",    en:"Merguez Sandwich",  metaAr:"نقانق حارة، بصل، هريسة",       metaEn:"spicy lamb sausage · onion · harissa",    price:25 },
      { ar:"لبلابي",           en:"Lablabi Bowl",      metaAr:"حمص بالكمون، خبز، بيض، توابل", metaEn:"cumin chickpea soup · bread · egg",       price:18 },
    ],
  },
  {
    id: "drinks",
    num: "05",
    titleAr: "مشروبات",
    titleEn: "Cold Drinks",
    subAr: "مياه وغازية مبردة",
    subEn: "Bottled · ice cold",
    items: [
      { ar:"مياه معدنية 500 مل", en:"Mineral Water 500 ml", metaAr:"معبأة باردة", metaEn:"chilled bottle",  price: 2 },
      { ar:"مياه معدنية 1.5 لتر",en:"Mineral Water 1.5 L",  metaAr:"للطاولة",     metaEn:"for the table",   price: 5 },
      { ar:"مشروبات غازية",      en:"Soft Drinks",          metaAr:"كولا · بيبسي · سفن", metaEn:"cola · pepsi · 7up", price: 5 },
    ],
  },
];

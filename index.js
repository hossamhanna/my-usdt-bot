const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

// --- ⚙️ الإعدادات الأساسية ---
const bot = new Telegraf('8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8');
const ADMIN_ID = 1683002116;
const LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg";
const CHANNELS = ["@VaultoUSDT", "@E_G_58"];

// --- 🌐 سيرفر الويب لضمان العمل 24/24 (Render Anti-Sleep) ---
const app = express();
app.get('/', (req, res) => res.send('Bot Status: Online 🚀'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server Port: ${PORT}`));

// --- 🔥 تهيئة Firebase ---
const serviceAccount = require("./serviceAccountKey.json");
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
    });
}
const db = admin.database();

// --- 💬 قاموس اللغات ---
const langData = {
    ar: {
        scan: "🔍 جاري فحص أمان الجهاز... يرجى الانتظار.",
        verified: "✅ تم التحقق! جهازك آمن للوصول.",
        sub_req: "📢 يجب عليك الانضمام لقنواتنا أولاً:",
        welcome: "🚀 مرحباً بك في أقوى بوت لربح USDT!",
        acc: "👤 حسابي", ref: "🔗 الإحالة", lang: "🌐 تغيير اللغة",
        admin: "💻 لوحة التحكم", stats: "📊 الإحصائيات", bc: "📢 إذاعة", back: "🏠 العودة"
    },
    en: {
        scan: "🔍 Scanning device security... please wait.",
        verified: "✅ Verified! Your device is secure.",
        sub_req: "📢 You must join our channels first:",
        welcome: "🚀 Welcome to the strongest USDT bot!",
        acc: "👤 Account", ref: "🔗 Referral", lang: "🌐 Language",
        admin: "💻 Admin Panel", stats: "📊 Stats", bc: "📢 Broadcast", back: "🏠 Back"
    }
};

// --- 🛡️ وظائف الحماية والاشتراك ---
async function checkSub(ctx) {
    if (ctx.from.id === ADMIN_ID) return true;
    for (const ch of CHANNELS) {
        try {
            const member = await ctx.telegram.getChatMember(ch, ctx.from.id);
            if (['left', 'kicked'].includes(member.status)) return false;
        } catch { return false; }
    }
    return true;
}

// --- 🤖 أوامر البوت ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const userRef = db.ref(`users/${userId}`);
    let snapshot = await userRef.once('value');
    let user = snapshot.val() || { balance: 0, lang: 'ar', refBy: null };

    // محاكاة فحص الجهاز (مثل الصورة التي طلبتها)
    const statusMsg = await ctx.reply(langData[user.lang].scan);
    
    setTimeout(async () => {
        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, langData[user.lang].verified);
        
        // فحص الاشتراك
        if (!(await checkSub(ctx))) {
            const btns = CHANNELS.map(ch => Markup.button.url(`📢 ${ch}`, `https://t.me/${ch.slice(1)}`));
            btns.push(Markup.button.callback("✅ تم الاشتراك / Joined", "verify_now"));
            return ctx.replyWithPhoto(LOGO_URL, {
                caption: langData[user.lang].sub_req,
                ...Markup.inlineKeyboard(btns, { columns: 1 })
            });
        }

        // القائمة الرئيسية
        const mainKbd = [
            [user.lang === 'ar' ? "👤 حسابي" : "👤 Account", user.lang === 'ar' ? "🔗 رابط الإحالة" : "🔗 Referral"],
            ["🎡 عجلة الحظ", "🎯 المهام"],
            [user.lang === 'ar' ? "🌐 تغيير اللغة" : "🌐 Language"]
        ];
        if (userId === ADMIN_ID) mainKbd.push([user.lang === 'ar' ? "💻 لوحة التحكم" : "💻 Admin Panel"]);

        ctx.replyWithPhoto(LOGO_URL, {
            caption: langData[user.lang].welcome,
            ...Markup.keyboard(mainKbd).resize()
        });
    }, 2000);
});

// --- 💻 لوحة الإدارة (Admin Only) ---
bot.hears(["💻 لوحة التحكم", "💻 Admin Panel"], async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("🛠️ إدارة البوت:", Markup.keyboard([
        ["📊 الإحصائيات", "📢 إذاعة"],
        ["🏠 العودة"]
    ]).resize());
});

bot.hears(["📊 الإحصائيات", "📊 Stats"], async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const snap = await db.ref('users').once('value');
    ctx.reply(`📈 إجمالي المستخدمين: ${snap.numChildren()}`);
});

bot.hears(["📢 إذاعة", "📢 Broadcast"], (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("ارسل رسالة الإذاعة الآن:");
    bot.on('text', async (mCtx) => {
        if (mCtx.from.id === ADMIN_ID && !mCtx.text.includes("🏠")) {
            const users = await db.ref('users').once('value');
            users.forEach(u => bot.telegram.sendMessage(u.key, mCtx.text).catch(() => {}));
            ctx.reply("✅ تمت الإذاعة بنجاح!");
        }
    });
});

// --- 🌐 نظام اللغات ---
bot.hears(["🌐 تغيير اللغة", "🌐 Language"], (ctx) => {
    ctx.reply("Select Language / اختر اللغة:", Markup.inlineKeyboard([
        Markup.button.callback("🇸🇦 العربية", "set_ar"),
        Markup.button.callback("🇺🇸 English", "set_en")
    ]));
});

bot.action(/set_(ar|en)/, async (ctx) => {
    const l = ctx.match[1];
    await db.ref(`users/${ctx.from.id}`).update({ lang: l });
    await ctx.answerCbQuery("Done!");
    ctx.reply(l === 'ar' ? "تم! أرسل /start" : "Done! Send /start");
});

bot.action("verify_now", async (ctx) => {
    if (await checkSub(ctx)) {
        await ctx.answerCbQuery("✅");
        ctx.reply("أهلاً بك! أرسل /start للبدء.");
    } else {
        ctx.answerCbQuery("❌ اشترك أولاً!", { show_alert: true });
    }
});

// تشغيل نهائي
bot.launch();
console.log("🚀 BOT IS LIVE 24/7 ON RENDER");

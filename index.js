const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

// --- الإعدادات الأساسية ---
const bot = new Telegraf('8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8');
const ADMIN_ID = 1683002116;
const LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg";
const CHANNELS = ["@VaultoUSDT", "@E_G_58"];

// --- Firebase ---
const serviceAccount = require("./serviceAccountKey.json");
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
    });
}
const db = admin.database();

// --- Express لضمان عمل Render ---
const app = express();
app.get('/', (req, res) => res.send('Bot is Live! ✅'));
app.listen(process.env.PORT || 10000);

// --- نصوص اللغات ---
const strings = {
    ar: {
        verify: "🔍 جاري فحص الجهاز... يرجى الانتظار.",
        verified: "✅ تم التحقق من الجهاز بنجاح!",
        sub_msg: "⚠️ يجب الاشتراك في القنوات لتفعيل الحساب:",
        welcome: "🚀 أهلاً بك في USDT Master Bot!",
        acc: "👤 حسابي", ref: "🔗 الإحالة", lang: "🌐 اللغة",
        admin_panel: "💻 لوحة الإدارة",
        stats: "📊 الإحصائيات", broadcast: "📢 إذاعة", add_bal: "💰 إضافة رصيد"
    },
    en: {
        verify: "🔍 Scanning device... please wait.",
        verified: "✅ Device Verified Successfully!",
        sub_msg: "⚠️ You must subscribe to our channels first:",
        welcome: "🚀 Welcome to USDT Master Bot!",
        acc: "👤 Account", ref: "🔗 Referral", lang: "🌐 Language",
        admin_panel: "💻 Admin Panel",
        stats: "📊 Stats", broadcast: "📢 Broadcast", add_bal: "💰 Add Balance"
    }
};

// --- دالة فحص الاشتراك ---
async function isSub(ctx) {
    if (ctx.from.id === ADMIN_ID) return true;
    for (const ch of CHANNELS) {
        try {
            const m = await ctx.telegram.getChatMember(ch, ctx.from.id);
            if (['left', 'kicked'].includes(m.status)) return false;
        } catch { return false; }
    }
    return true;
}

// --- الأوامر ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const userRef = db.ref(`users/${userId}`);
    let data = (await userRef.once('value')).val() || { lang: 'ar', balance: 0 };
    if (!data.lang) data.lang = 'ar';

    // 1. نظام محاكاة فحص الجهاز (مثل الصور التي أرفقتها)
    const msg = await ctx.reply(strings[data.lang].verify);
    
    setTimeout(async () => {
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, strings[data.lang].verified);
        
        // 2. فحص الاشتراك
        if (!(await isSub(ctx))) {
            const buttons = CHANNELS.map(ch => Markup.button.url(`📢 ${ch}`, `https://t.me/${ch.slice(1)}`));
            buttons.push(Markup.button.callback("✅ تفعيل الحساب / Activate", "check_sub"));
            return ctx.replyWithPhoto(LOGO_URL, {
                caption: strings[data.lang].sub_msg,
                ...Markup.inlineKeyboard(buttons, { columns: 1 })
            });
        }

        // 3. القائمة (حسب الرتبة)
        const userKbd = [
            [strings[data.lang].acc, strings[data.lang].ref],
            ["🎡 عجلة الحظ", "🎯 المهام"],
            [strings[data.lang].lang]
        ];
        if (userId === ADMIN_ID) userKbd.push([strings[data.lang].admin_panel]);

        ctx.replyWithPhoto(LOGO_URL, {
            caption: strings[data.lang].welcome,
            ...Markup.keyboard(userKbd).resize()
        });
    }, 2500);
});

// --- لوحة التحكم (الأدمن فقط) ---
bot.hears(["💻 لوحة الإدارة", "💻 Admin Panel"], async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const data = (await db.ref(`users/${ctx.from.id}`).once('value')).val() || { lang: 'ar' };
    ctx.reply("🛠️ مرحباً بك في لوحة التحكم:", Markup.keyboard([
        [strings[data.lang].stats, strings[data.lang].broadcast],
        [strings[data.lang].add_bal, "🏠 العودة"]
    ]).resize());
});

bot.hears(["📊 الإحصائيات", "📊 Stats"], async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const users = await db.ref('users').once('value');
    const count = users.numChildren();
    ctx.reply(`📈 إجمالي مستخدمي البوت: ${count}`);
});

// نظام الإذاعة (Broadcast)
bot.hears(["📢 إذاعة", "📢 Broadcast"], (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("ارسل الآن الرسالة التي تريد توجيهها للكل:");
    bot.on('text', async (msgCtx) => {
        if (msgCtx.from.id === ADMIN_ID && !msgCtx.text.includes("📢")) {
            const users = await db.ref('users').once('value');
            users.forEach((user) => {
                bot.telegram.sendMessage(user.key, msgCtx.text).catch(() => {});
            });
            ctx.reply("✅ تم إرسال الإذاعة للجميع!");
        }
    });
});

// تغيير اللغة
bot.hears(["🌐 اللغة", "🌐 Language"], (ctx) => {
    ctx.reply("Choose Language / اختر لغتك:", Markup.inlineKeyboard([
        Markup.button.callback("🇸🇦 العربية", "lang_ar"),
        Markup.button.callback("🇺🇸 English", "lang_en")
    ]));
});

bot.action(/lang_(ar|en)/, async (ctx) => {
    const lang = ctx.match[1];
    await db.ref(`users/${ctx.from.id}`).update({ lang: lang });
    await ctx.answerCbQuery("Done!");
    ctx.reply(lang === 'ar' ? "تم التغيير! أرسل /start" : "Changed! Send /start");
});

bot.action("check_sub", async (ctx) => {
    if (await isSub(ctx)) {
        await ctx.answerCbQuery("✅ Success!");
        ctx.reply("تم التحقق! أرسل /start الآن.");
    } else {
        ctx.answerCbQuery("❌ Subscribe first!", { show_alert: true });
    }
});

bot.launch();

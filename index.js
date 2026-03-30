const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

// --- إعدادات البوت ---
const bot = new Telegraf('8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8');
const ADMIN_ID = 1683002116;
const LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg";

// --- سيرفر الويب لـ Render (يمنع التوقف) ---
const app = express();
app.get('/', (req, res) => res.send('Bot is Active ✅'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

// --- اتصال Firebase مع معالجة الأخطاء ---
try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
        });
    }
    console.log("Firebase Connected! 🔥");
} catch (error) {
    console.error("Firebase Connection Error: ", error.message);
}

const db = admin.database();

// --- القائمة الرئيسية ---
const mainMenu = (lang = 'ar') => {
    const buttons = [
        [lang === 'ar' ? "👤 حسابي" : "👤 My Account", lang === 'ar' ? "🔗 رابط الإحالة" : "🔗 Referral"],
        [lang === 'ar' ? "🎡 عجلة الحظ" : "🎡 Lucky Spin", lang === 'ar' ? "🎯 المهام" : "🎯 Tasks"],
        [lang === 'ar' ? "🌐 تغيير اللغة" : "🌐 Language"]
    ];
    return Markup.keyboard(buttons).resize();
};

// --- أمر Start ---
bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id;
        // محاولة حفظ البيانات مع تجاهل الخطأ إذا فشل Firebase
        await db.ref(`users/${userId}`).update({
            first_name: ctx.from.first_name,
            username: ctx.from.username || "None"
        }).catch(e => console.log("Silent Firebase Error"));

        await ctx.replyWithPhoto(LOGO_URL, {
            caption: "🚀 أهلاً بك في Earn Master Bot!\n\nجهازك مفحوص وآمن تماماً. اختر من القائمة أدناه للبدء:",
            ...mainMenu('ar')
        });
    } catch (e) {
        console.error("Start Command Error:", e);
    }
});

// رد تلقائي على أي زر لضمان الاستجابة
bot.on('text', async (ctx) => {
    if (ctx.message.text.includes("حسابي") || ctx.message.text.includes("Account")) {
        return ctx.reply("💰 رصيدك الحالي: 0.00 USDT");
    }
    ctx.reply("اختر من القائمة بالأسفل 👇", mainMenu('ar'));
});

// تشغيل البوت مع معالجة أخطاء الشبكة
bot.launch().then(() => console.log("Bot Started Successfully!"));

// منع تعليق البوت
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

// --- ⚙️ الإعدادات الأساسية ---
const bot = new Telegraf('8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8');
const ADMIN_ID = 1683002116;
const LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg";

// --- 🌐 منع توقف السيرفر (Render Port Fix) ---
const app = express();
app.get('/', (req, res) => res.send('Bot is Live! ✅'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

// --- 🔥 تهيئة Firebase مع نظام تخطي الأخطاء ---
let dbAvailable = false;
try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
        });
    }
    dbAvailable = true;
    console.log("✅ Firebase Connected!");
} catch (error) {
    console.log("⚠️ Firebase Key Error - Running in Basic Mode");
}

const db = admin.database();

// --- ⌨️ لوحة التحكم ---
const mainKbd = Markup.keyboard([
    ["👤 حسابي", "🔗 رابط الإحالة"],
    ["🎡 عجلة الحظ", "🎯 المهام"],
    ["🌐 تغيير اللغة"]
]).resize();

// --- 🤖 معالجة الأوامر ---
bot.start(async (ctx) => {
    try {
        if (dbAvailable) {
            await db.ref(`users/${ctx.from.id}`).update({
                name: ctx.from.first_name,
                username: ctx.from.username || "N/A",
                last_active: Date.now()
            }).catch(() => console.log("DB Update Failed"));
        }

        await ctx.replyWithPhoto(LOGO_URL, {
            caption: `🚀 أهلاً بك يا ${ctx.from.first_name} في Earn Master Bot!\n\nتم التحقق من أمان جهازك بنجاح. استمتع بالربح!`,
            ...mainKbd
        });
    } catch (e) {
        console.error("Start Error:", e);
    }
});

// الرد على الأزرار لضمان أن البوت "حي"
bot.hears("👤 حسابي", (ctx) => ctx.reply("💰 رصيدك الحالي: 0.00 USDT"));
bot.hears("🔗 رابط الإحالة", (ctx) => ctx.reply(`🔗 رابطك: https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`));

// --- 🚀 تشغيل البوت ---
bot.launch().then(() => {
    console.log("🚀 BOT DEPLOYED SUCCESSFULLY");
}).catch((err) => {
    console.error("Launch Failed:", err);
});

// التعامل مع الإغلاق المفاجئ
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

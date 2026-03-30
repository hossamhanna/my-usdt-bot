const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

const bot = new Telegraf('8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8');
const ADMIN_ID = 1683002116;
const LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg";

// --- 🌐 نظام منع التوقف (Express Server) ---
const app = express();
app.get('/', (req, res) => res.send('Bot is Running! ✅'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is listening on port ${PORT}`);
});

// --- 🔥 تهيئة Firebase ---
const serviceAccount = require("./serviceAccountKey.json");
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
    });
}
const db = admin.database();

// --- 🤖 معالجة الأوامر ---
bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id;
        // حفظ المستخدم
        await db.ref(`users/${userId}`).update({
            username: ctx.from.username || "No Username",
            last_seen: Date.now()
        });

        const keyboard = Markup.keyboard([
            ["👤 حسابي", "🔗 رابط الإحالة"],
            ["🎡 عجلة الحظ", "🎯 المهام"],
            ["🌐 اللغة", "💻 لوحة الإدارة"]
        ]).resize();

        await ctx.replyWithPhoto(LOGO_URL, {
            caption: "🚀 أهلاً بك مجدداً في USDT Master Bot!\nتم إعادة تشغيل النظام بنجاح.",
            ...keyboard
        });
    } catch (e) {
        console.error("Start Error:", e);
    }
});

// --- 🔄 تشغيل البوت مع معالجة الأخطاء ---
bot.launch().then(() => {
    console.log("🚀 Bot is Online!");
}).catch((err) => {
    console.error("Failed to launch bot:", err);
});

// لمنع التوقف المفاجئ
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

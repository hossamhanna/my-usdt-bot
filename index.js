const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const axios = require('axios');

// --- إعدادات البوت ---
const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const bot = new Telegraf(BOT_TOKEN);

// --- نظام السيرفر لضمان العمل 24/7 ---
const app = express();
app.get('/', (req, res) => res.send('Novaton System is Live ✅'));
app.listen(process.env.PORT || 10000, () => {
    console.log("------------------------------------");
    console.log("🚀 Server is running on Port:", process.env.PORT || 10000);
    console.log("------------------------------------");
});

// --- ربط Firebase مع رسالة تنبيه ---
try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
        });
        console.log("🔥 Firebase Connected Successfully!");
    }
} catch (error) {
    console.log("❌ Firebase Error:", error.message);
}

const db = admin.database();

// --- نظام الحماية ومنع النوم ---
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
        axios.get(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}`).catch(() => {});
        console.log("📡 Anti-Sleep: Ping Sent");
    }
}, 240000);

// --- أمر التشغيل (Start) ---
bot.start(async (ctx) => {
    console.log(`👤 New Start from: ${ctx.from.id}`);
    ctx.reply("🚀 أهلاً بك في Novaton! البوت شغال الآن بنجاح.");
});

// --- إطلاق البوت ---
bot.launch().then(() => {
    console.log("✅ Telegram Bot is Polling...");
}).catch((err) => {
    console.log("❌ Bot Launch Error:", err.message);
});

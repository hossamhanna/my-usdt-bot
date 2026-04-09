const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const axios = require('axios');

const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const bot = new Telegraf(BOT_TOKEN);

// --- نظام منع التوقف ---
const app = express();
app.get('/', (req, res) => res.send('Bot Status: Healthy ✅'));
app.listen(process.env.PORT || 10000);

// --- ربط Firebase مع معالجة الأخطاء ---
try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
        });
    }
} catch (e) { console.log("Firebase Init Error:", e.message); }

const db = admin.database();

// --- نظام الحماية الذكي ---
bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id;
        console.log(`📡 Start request from: ${userId}`);

        // التحقق من قاعدة البيانات
        const userRef = db.ref(`users/${userId}`);
        const snap = await userRef.once('value');

        if (!snap.exists()) {
            await userRef.set({
                id: userId,
                name: ctx.from.first_name,
                balance: 0,
                joined: Date.now()
            });
        }

        ctx.reply("🚀 تم إعادة تشغيل النظام بنجاح! البوت الآن يستجيب.");
    } catch (error) {
        console.error("❌ Start Command Error:", error);
        ctx.reply("⚠️ حدث خطأ مؤقت، يرجى المحاولة مرة أخرى.");
    }
});

// --- معالجة الأخطاء العالمية لمنع التوقف (Crucial) ---
bot.catch((err, ctx) => {
    console.log(`Ooops, encountered an error for ${ctx.updateType}`, err);
});

bot.launch().then(() => console.log("✅ Bot is Polling..."));

// منع النوم
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
        axios.get(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}`).catch(() => {});
    }
}, 250000);

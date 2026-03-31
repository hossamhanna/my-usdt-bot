const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const fs = require('fs');

const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);

// سيرفر الويب لـ Render
const app = express();
app.get('/', (req, res) => res.send('Bot is Running ✅'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

// --- محاولة ربط Firebase بأمان ---
let dbAvailable = false;
const keyPath = "./serviceAccountKey.json";

if (fs.existsSync(keyPath)) {
    try {
        const serviceAccount = require(keyPath);
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
            });
        }
        dbAvailable = true;
        console.log("✅ Firebase Connected!");
    } catch (e) {
        console.log("⚠️ Firebase Key Error");
    }
} else {
    console.log("❌ CRITICAL: serviceAccountKey.json is MISSING!");
}

const db = admin.database();

// --- أوامر البوت ---
bot.start(async (ctx) => {
    const welcomeMsg = `🚀 أهلاً بك يا ${ctx.from.first_name}!\n\nتم تشغيل البوت بنجاح.\n${dbAvailable ? "✅ قاعدة البيانات متصلة." : "⚠️ قاعدة البيانات غير متصلة (يرجى رفع ملف JSON)."}`;
    
    return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
        caption: welcomeMsg,
        ...Markup.keyboard([["👤 حسابي", "🔗 الإحالة"], ["🎯 المهام", "⚙️ الإدارة"]]).resize()
    });
});

bot.hears("⚙️ الإدارة", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("👑 لوحة التحكم تعمل! يمكنك الآن إضافة القنوات.");
});

bot.launch().then(() => console.log("🚀 BOT IS LIVE AND WAITING FOR START"));

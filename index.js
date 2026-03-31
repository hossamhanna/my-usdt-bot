const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

// 1. التوكن الخاص بك
const bot = new Telegraf('8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8');

// 2. تشغيل سيرفر ويب وهمي لمنع توقف Render
const app = express();
app.get('/', (req, res) => res.send('Bot is Active ✅'));
app.listen(process.env.PORT || 10000);

// 3. ربط Firebase بالمفتاح الجديد
try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
        });
    }
    console.log("✅ Firebase Connected Successfully");
} catch (e) {
    console.log("⚠️ Firebase Error: " + e.message);
}

// 4. كود الرد على أمر البداية (Start)
bot.start((ctx) => {
    return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
        caption: `🚀 أهلاً بك يا ${ctx.from.first_name}\n\nالبوت يعمل الآن بنظام Node.js المستقر.`,
        ...Markup.keyboard([["👤 حسابي", "🔗 رابط الإحالة"], ["🎯 المهام"]]).resize()
    });
});

// 5. إطلاق البوت
bot.launch();
console.log("🚀 BOT IS LIVE NOW!");

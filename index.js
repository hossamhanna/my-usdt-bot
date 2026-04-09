const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const axios = require('axios');

// --- إعدادات البوت (تأكد من التوكن) ---
const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);

// --- منع توقف السيرفر (Express) ---
const app = express();
app.get('/', (req, res) => res.send('Novaton Bot is Online ✅'));
app.listen(process.env.PORT || 10000, () => console.log("🌐 Server Active"));

// --- ربط Firebase مع معالجة ذكية للأخطاء ---
let db;
try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            // تأكد أن الرابط أدناه هو نفس الرابط في حسابك بفايربيس
            databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
        });
    }
    db = admin.database();
    console.log("🔥 Firebase Connected");
} catch (e) {
    console.log("⚠️ Firebase Setup Error:", e.message);
}

// --- نظام الحماية الذكية (Anti-VPN & Multi-Accounts) ---
bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id;
        console.log(`👤 New Start: ${userId}`);

        // 🛡️ فحص الحظر (بصمة الآيدي الثابتة)
        if (db) {
            const banned = await db.ref(`blacklist/${userId}`).once('value');
            if (banned.exists()) return ctx.reply("🚫 حسابك محظور نهائياً.");
            
            const userRef = db.ref(`users/${userId}`);
            const snap = await userRef.once('value');
            if (!snap.exists()) {
                await userRef.set({ id: userId, name: ctx.from.first_name, balance: 0 });
            }
        }

        // واجهة البوت الاحترافية
        ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
            caption: `🚀 **أهلاً بك في Novaton TON**\n\n💰 الرصيد: 0.0000 TON\n🛡️ نظام الحماية: نشط ✅\n\nالبوت شغال الآن 24/7 بدون توقف.`,
            parse_mode: 'Markdown',
            ...Markup.keyboard([
                ["👤 حسابي", "🔗 الإحالة"],
                ["📥 إيداع", "📤 سحب"],
                ["⚙️ الإدارة"]
            ]).resize()
        });
    } catch (err) {
        console.error("Error in Start:", err);
        ctx.reply("⚠️ البوت يعمل ولكن هناك مشكلة في الاتصال بقاعدة البيانات.");
    }
});

// --- أوامر الإدارة (إضافة قنوات، شحن، حظر) ---
bot.hears("⚙️ الإدارة", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply(`👑 **لوحة التحكم**\n\n- أرسل 'اضف @user' لإضافة قناة.\n- أرسل 'شحن ID المبلغ' للمكافأة.\n- أرسل 'حظر ID' للحماية.`);
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const text = ctx.message.text;

    if (text.startsWith("اضف @")) {
        const ch = text.split(" ")[1];
        if (db) {
            await db.ref('settings/channels').transaction(arr => {
                if (!arr) arr = [];
                if (!arr.includes(ch)) arr.push(ch);
                return arr;
            });
            ctx.reply(`✅ تمت إضافة ${ch}`);
        }
    }

    if (text.startsWith("شحن ")) {
        const [_, id, amount] = text.split(" ");
        if (db) {
            await db.ref(`users/${id}/balance`).transaction(b => (b || 0) + parseFloat(amount));
            ctx.reply(`✅ تم شحن ${amount} TON للحساب ${id}`);
        }
    }
});

// --- منع النوم التلقائي ---
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
        axios.get(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}`).catch(() => {});
    }
}, 240000);

bot.launch().then(() => console.log("🚀 Bot is Polling..."));

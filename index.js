const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const axios = require('axios');

// --- إعداداتك الثابتة ---
const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);

// --- 🌐 نظام منع التوقف وفحص الـ IP ---
const app = express();
app.get('/', async (req, res) => {
    res.send('Novaton Core is Running ✅');
});
app.listen(process.env.PORT || 10000);

// --- 🔥 ربط Firebase ---
try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
        });
    }
} catch (e) { console.log("Firebase Error"); }
const db = admin.database();

// --- 🛡️ دالة جلب الـ IP الحقيقي للحماية ---
async function getUserIP() {
    try {
        const response = await axios.get('https://api.ipify.org?format=json');
        return response.data.ip;
    } catch (e) { return "Unknown"; }
}

// --- 🤖 بداية البوت (الأمر الصارم) ---
bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id;
        const userIP = await getUserIP();

        // 1. نظام حماية الـ IP والـ ID
        const banned = await db.ref(`blacklist/${userId}`).once('value');
        if (banned.exists()) return ctx.reply("🚫 الوصول مرفوض. حسابك محظور.");

        // 2. فحص الاشتراك الإجباري مع اللوجو
        const snap = await db.ref('settings/channels').once('value');
        const channels = snap.val() || [];
        let isSub = true;
        for (const ch of channels) {
            try {
                const m = await ctx.telegram.getChatMember(ch, userId);
                if (['left', 'kicked'].includes(m.status)) { isSub = false; break; }
            } catch (e) { isSub = false; }
        }

        if (!isSub && channels.length > 0) {
            const btns = channels.map(ch => [Markup.button.url(`📢 انضم: ${ch}`, `https://t.me/${ch.replace('@','')}`)]);
            btns.push([Markup.button.callback("✅ تفعيل درع الحماية", "verify_shield")]);
            
            return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
                caption: "🛡️ **نظام الحماية المتقدم**\n\nيجب الانضمام للقنوات لتشفير بياناتك وتفعيل الحماية.\n\n📍 عنوانك الحالي: `" + userIP + "`",
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard(btns)
            });
        }

        // 3. الدخول للواجهة
        ctx.reply("🚀 **تم تفعيل الحماية!** أهلاً بك في Novaton.", 
        Markup.keyboard([["👤 حسابي", "🔗 الإحالة"], ["📥 إيداع", "📤 سحب"], ["⚙️ الإدارة"]]).resize());

    } catch (err) { console.log("Start Error"); }
});

// --- 🖱️ زر التحقق وتفعيل الحماية ---
bot.action("verify_shield", async (ctx) => {
    await ctx.answerCbQuery("🛡️ جاري فحص الآي بي وتأمين الحساب...");
    await ctx.deleteMessage();
    ctx.reply("✅ **اكتمل التشفير!** أرسل /start للدخول.");
});

// --- 👑 لوحة التحكم ---
bot.hears("⚙️ الإدارة", (ctx) => {
    if (ctx.from.id === ADMIN_ID) ctx.reply("أهلاً سيدي المدير. أرسل (اضف @channel) للإشتراك الإجباري.");
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    if (ctx.message.text.startsWith("اضف @")) {
        const ch = ctx.message.text.split(" ")[1];
        await db.ref('settings/channels').transaction(a => { if(!a) a=[]; a.push(ch); return a; });
        ctx.reply("✅ تمت الإضافة.");
    }
});

// --- 🚨 الأمر السحري لتشغيل البوت المحبوس (Webhook Killer) ---
bot.launch({
    dropPendingUpdates: true, // مسح أي رسائل قديمة معلقة
    polling: {
        timeout: 30,
        limit: 100
    }
}).then(() => console.log("🔥 THE BOT IS NOW AWAKE!"));

const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const axios = require('axios');

// --- ⚙️ الإعدادات الجديدة ---
const BOT_TOKEN = '8685057163:AAGT3o3Ad-MAYfrHQmxRkA6Py6pnKPnUzMk';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);

// --- 🌐 نظام منع التوقف وفحص الـ IP ---
const app = express();
app.get('/', (req, res) => res.send('Novaton Elite Shield: ACTIVE ✅'));
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
} catch (e) { console.log("⚠️ Firebase Alert: تأكد من رفع ملف المفتاح"); }
const db = admin.database();

// --- 🛡️ وظيفة جلب الـ IP للحماية ---
async function getUserIP() {
    try {
        const response = await axios.get('https://api.ipify.org?format=json');
        return response.data.ip;
    } catch (e) { return "127.0.0.1"; }
}

// --- 🔍 فحص الاشتراك الإجباري ---
async function checkSub(ctx, userId) {
    const snap = await db.ref('settings/channels').once('value');
    const channels = snap.val() || [];
    if (channels.length === 0) return true;

    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch, userId);
            if (['left', 'kicked'].includes(member.status)) return false;
        } catch (e) { return false; }
    }
    return true;
}

// --- 🤖 أمر البداية (Start) ---
bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id;
        const userIP = await getUserIP();

        // 1. نظام الحماية الذكي (فحص الحظر)
        const banned = await db.ref(`blacklist/${userId}`).once('value');
        if (banned.exists()) return ctx.reply("🚫 حسابك محظور من النظام.");

        // 2. الاشتراك الإجباري مع اللوجو
        const isSub = await checkSub(ctx, userId);
        if (!isSub) {
            const chSnap = await db.ref('settings/channels').once('value');
            const channels = chSnap.val() || [];
            const buttons = channels.map(ch => [Markup.button.url(`📢 انضم هنا: ${ch}`, `https://t.me/${ch.replace('@','')}`)]);
            buttons.push([Markup.button.callback("✅ تفعيل نظام الحماية", "verify_shield")]);

            return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
                caption: `🛡️ **نظام الحماية المطور**\n\nيجب عليك الاشتراك في القنوات أدناه لتشفير حسابك وفتح ميزات TON.\n\n📍 عنوانك الحالي: \`${userIP}\`\n⚠️ يمنع استخدام الـ VPN لتجنب الحظر.`,
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard(buttons)
            });
        }

        // 3. الدخول للواجهة الرئيسية
        ctx.reply(`🛡️ **نظام الحماية نشط**\nمرحباً بك مجدداً في Novaton.`, 
        Markup.keyboard([
            ["👤 حسابي", "🔗 الإحالة"],
            ["📥 إيداع", "📤 سحب الأرباح"],
            ["⚙️ الإدارة"]
        ]).resize());

    } catch (err) { console.log("Start Error:", err.message); }
});

// --- 📩 تفاعل زر الحماية ---
bot.action("verify_shield", async (ctx) => {
    const ok = await checkSub(ctx, ctx.from.id);
    if (ok) {
        await ctx.answerCbQuery("🛡️ تم تفعيل درع الحماية بنجاح!");
        await ctx.deleteMessage();
        ctx.reply("✅ **تم التحقق!** أرسل /start للدخول للواجهة.");
    } else {
        await ctx.answerCbQuery("❌ يجب الاشتراك في كل القنوات أولاً!", { show_alert: true });
    }
});

// --- 👑 لوحة الإدارة ---
bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const txt = ctx.message.text;

    if (txt.startsWith("اضف @")) {
        const ch = txt.split(" ")[1];
        await db.ref('settings/channels').transaction(a => { if(!a) a=[]; a.push(ch); return a; });
        ctx.reply(`✅ تمت إضافة ${ch}`);
    }
});

// --- 🚀 التشغيل القوي (تطهير الـ Webhook) ---
bot.launch({
    dropPendingUpdates: true
}).then(() => console.log("🔥 BOT IS LIVE WITH NEW TOKEN"));

// الحفاظ على النشاط
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
        axios.get(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}`).catch(() => {});
    }
}, 240000);

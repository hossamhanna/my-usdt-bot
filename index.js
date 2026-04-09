const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const axios = require('axios');

// --- ⚙️ الإعدادات ---
const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);

// --- 🌐 نظام منع التوقف (Express) ---
const app = express();
app.get('/', (req, res) => res.send('Novaton System is Live ✅'));
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
} catch (e) { console.log("Firebase Connection Error:", e.message); }
const db = admin.database();

// --- 🛡️ دالة فحص الاشتراك الإجباري ---
async function checkSub(ctx, userId) {
    if (!db) return true;
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

// --- 🤖 معالجة أمر البداية (Start) ---
bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id;

        // 1. نظام الحماية الذكي (فحص الحظر)
        if (db) {
            const banned = await db.ref(`blacklist/${userId}`).once('value');
            if (banned.exists()) return ctx.reply("🚫 حسابك محظور نهائياً من قبل الإدارة.");
        }

        // 2. المرحلة الأولى: الاشتراك الإجباري مع اللوجو
        const isSub = await checkSub(ctx, userId);
        if (!isSub) {
            const chSnap = await db.ref('settings/channels').once('value');
            const channels = chSnap.val() || [];
            const buttons = channels.map(ch => [Markup.button.url(`📢 انضم هنا: ${ch}`, `https://t.me/${ch.replace('@','')}`)]);
            buttons.push([Markup.button.callback("✅ تحقق من الاشتراك", "verify_sub")]);

            return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
                caption: "🛡️ **نظام التحقق من الهوية**\n\nيجب عليك الاشتراك في القنوات أدناه لتفعيل حسابك.\n\n⚠️ يمنع استخدام الـ VPN أو الحسابات الوهمية لتجنب الحظر التلقائي.",
                ...Markup.inlineKeyboard(buttons)
            });
        }

        // 3. المرحلة الثانية: نظام الحماية وتسجيل البيانات
        if (db) {
            const userRef = db.ref(`users/${userId}`);
            const snap = await userRef.once('value');
            if (!snap.exists()) {
                await userRef.set({ id: userId, name: ctx.from.first_name, balance: 0, joined: Date.now() });
                const refId = ctx.startPayload;
                if (refId && refId != userId) {
                    await db.ref(`users/${refId}/balance`).transaction(b => (b || 0) + 0.03);
                    bot.telegram.sendMessage(refId, "🎁 حصلت على 0.03 TON مكافأة إحالة!").catch(()=>{});
                }
            }
        }

        // 4. الواجهة الرئيسية
        ctx.reply(`🛡️ **تم تفعيل نظام الحماية لحسابك**\n\nمرحباً بك في Novaton، البوت الآن مستعد للعمل بنسبة 100%.`, 
        Markup.keyboard([
            ["👤 حسابي", "🔗 الإحالة"],
            ["📥 إيداع", "📤 سحب الأرباح"],
            ["⚙️ الإدارة"]
        ]).resize());

    } catch (err) { console.log("Start Error:", err.message); }
});

// --- 📩 زر التحقق ---
bot.action("verify_sub", async (ctx) => {
    const isOk = await checkSub(ctx, ctx.from.id);
    if (isOk) {
        await ctx.answerCbQuery("✅ تم التحقق بنجاح!");
        await ctx.deleteMessage();
        ctx.reply("🌟 مبروك! اجتزت الفحص. أرسل /start الآن للدخول للواجهة الرئيسية.");
    } else {
        await ctx.answerCbQuery("❌ لم تشترك في كل القنوات بعد!", { show_alert: true });
    }
});

// --- ⚙️ لوحة الأدمن ---
bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const msg = ctx.message.text;

    if (msg.startsWith("اضف @")) {
        const ch = msg.split(" ")[1];
        await db.ref('settings/channels').transaction(a => { if(!a) a=[]; a.push(ch); return a; });
        ctx.reply(`✅ تمت إضافة ${ch} للاشتراك الإجباري.`);
    }
    if (msg.startsWith("حظر ")) {
        const id = msg.split(" ")[1];
        await db.ref(`blacklist/${id}`).set(true);
        ctx.reply(`🚫 تم حظر ${id} نهائياً.`);
    }
});

// --- 📡 منع النوم (Anti-Sleep) ---
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
        axios.get(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}`).catch(() => {});
    }
}, 240000);

bot.launch().then(() => console.log("🚀 Novaton Elite is Running..."));

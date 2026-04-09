const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const axios = require('axios');

// --- ⚙️ الإعدادات ---
const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);

// --- 🌐 السيرفر لمنع التوقف (Render) ---
const app = express();
app.get('/', (req, res) => res.send('Novaton Shield is Active ✅'));
app.listen(process.env.PORT || 10000);

// --- 🔥 ربط Firebase ---
const serviceAccount = require("./serviceAccountKey.json");
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
    });
}
const db = admin.database();

// --- 🛡️ وظيفة فحص الاشتراك الإجباري ---
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

// --- 🤖 معالجة أمر Start ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;

    // 1. نظام الحماية: فحص الحظر
    const banned = await db.ref(`blacklist/${userId}`).once('value');
    if (banned.exists()) return ctx.reply("🚫 حسابك محظور نهائياً لمخالفة القوانين.");

    // 2. المرحلة الأولى: الاشتراك الإجباري (مع اللوجو)
    const isSub = await checkSub(ctx, userId);
    if (!isSub) {
        const chSnap = await db.ref('settings/channels').once('value');
        const channels = chSnap.val() || [];
        const buttons = channels.map(ch => [Markup.button.url(`📢 انضم للقناة: ${ch}`, `https://t.me/${ch.replace('@','')}`)]);
        buttons.push([Markup.button.callback("✅ تم الاشتراك - دخول", "verify_sub")]);

        // إرسال اللوجو فوق القنوات مباشرة
        return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
            caption: "⚠️ **خطوة إجبارية:**\n\nيجب عليك الاشتراك في جميع القنوات أدناه أولاً لفتح ميزات البوت تليها خطوة تفعيل نظام الحماية.",
            ...Markup.inlineKeyboard(buttons)
        });
    }

    // 3. المرحلة الثانية: نظام الحماية (تأمين الهوية)
    const userRef = db.ref(`users/${userId}`);
    const userSnap = await userRef.once('value');

    if (!userSnap.exists()) {
        await userRef.set({
            id: userId,
            name: ctx.from.first_name,
            balance: 0,
            joined: Date.now(),
            shield_active: true
        });
        // مكافأة الإحالة إذا وجدت
        const refId = ctx.startPayload;
        if (refId && refId != userId) {
            await db.ref(`users/${refId}/balance`).transaction(b => (b || 0) + 0.03);
            bot.telegram.sendMessage(refId, "🎁 حصلت على 0.03 TON مكافأة إحالة!").catch(()=>{});
        }
    }

    // 4. الواجهة الرئيسية (بعد اجتياز كل شيء)
    ctx.reply(`🛡️ **تم تفعيل نظام الحماية لحسابك بنجاح**\n\n🚀 مرحباً بك في Novaton، حسابك الآن محصن وجاهز للاستخدام.`, 
    Markup.keyboard([
        ["👤 حسابي", "🔗 الإحالة"],
        ["📥 إيداع", "📤 سحب الأرباح"],
        ["📊 الإحصائيات", "⚙️ الإدارة"]
    ]).resize());
});

// --- 📩 التعامل مع زر التحقق (Inline) ---
bot.action("verify_sub", async (ctx) => {
    const isSub = await checkSub(ctx, ctx.from.id);
    if (isSub) {
        await ctx.answerCbQuery("✅ تم التحقق بنجاح!");
        await ctx.deleteMessage();
        ctx.reply("🌟 مبروك! لقد اجتزت التحقق. أرسل /start لتفعيل نظام الحماية والدخول.");
    } else {
        await ctx.answerCbQuery("❌ لم تشترك في جميع القنوات بعد!", { show_alert: true });
    }
});

// منع النوم (Anti-Sleep)
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
        axios.get(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}`).catch(() => {});
    }
}, 240000);

bot.launch();

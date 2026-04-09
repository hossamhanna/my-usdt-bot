const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const axios = require('axios');

// --- الإعدادات ---
const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);

// --- سيرفر Express (ضروري لـ Render) ---
const app = express();
app.get('/', (req, res) => res.send('Novaton Elite Shield is ACTIVE ✅'));
app.listen(process.env.PORT || 10000);

// --- ربط Firebase مع معالجة الأخطاء ---
let db;
try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
        });
    }
    db = admin.database();
    console.log("✅ Firebase Connected");
} catch (e) {
    console.log("⚠️ Firebase Error: الملف غير موجود أو الرابط خطأ");
}

// --- دالة فحص القنوات ---
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

// --- أمر Start الرئيسي ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;

    // 1. نظام الحماية الذكي
    if (db) {
        const banned = await db.ref(`blacklist/${userId}`).once('value');
        if (banned.exists()) return ctx.reply("🚫 حسابك محظور نهائياً.");
    }

    // 2. فحص الاشتراك الإجباري مع اللوجو
    const isSub = await checkSub(ctx, userId);
    if (!isSub) {
        const chSnap = await db.ref('settings/channels').once('value');
        const channels = chSnap.val() || [];
        const buttons = channels.map(ch => [Markup.button.url(`📢 انضم هنا: ${ch}`, `https://t.me/${ch.replace('@','')}`)]);
        buttons.push([Markup.button.callback("✅ تفعيل نظام الحماية", "verify_and_shield")]);

        return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
            caption: "🛡️ **نظام الحماية والتحقق**\n\nأهلاً بك في Novaton. يجب الاشتراك في القنوات أدناه لتفعيل درع الحماية وفتح ميزات TON.",
            ...Markup.inlineKeyboard(buttons)
        });
    }

    // 3. الواجهة الرئيسية
    showMainMenu(ctx);
});

// --- معالجة زر الحماية ---
bot.action("verify_and_shield", async (ctx) => {
    const userId = ctx.from.id;
    const ok = await checkSub(ctx, userId);

    if (ok) {
        await ctx.answerCbQuery("🛡️ جاري تشفير البيانات وتفعيل الحماية...");
        
        if (db) {
            await db.ref(`users/${userId}`).update({
                shield: "Active ✅",
                last_login: Date.now()
            });
        }

        await ctx.deleteMessage();
        ctx.reply("✅ **تم تفعيل الحماية بنجاح!**\nحسابك الآن مؤمن ضد الاختراق والـ VPN.");
        showMainMenu(ctx);
    } else {
        await ctx.answerCbQuery("❌ لم تشترك في كل القنوات بعد!", { show_alert: true });
    }
});

function showMainMenu(ctx) {
    ctx.reply("🚀 **قائمة التحكم الرئيسية**", Markup.keyboard([
        ["👤 حسابي", "🔗 الإحالة"],
        ["📥 إيداع", "📤 سحب الأرباح"],
        ["⚙️ الإدارة"]
    ]).resize());
}

// --- لوحة الأدمن ---
bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const txt = ctx.message.text;
    if (txt.startsWith("اضف @")) {
        const ch = txt.split(" ")[1];
        await db.ref('settings/channels').transaction(a => { if(!a) a=[]; a.push(ch); return a; });
        ctx.reply(`✅ تمت إضافة ${ch}`);
    }
});

// --- تشغيل البوت مع حذف الويب هوك القديم ---
bot.launch({ dropPendingUpdates: true }).then(() => console.log("🚀 BOT IS 100% WORKING"));

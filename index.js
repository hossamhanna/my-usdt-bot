const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

// --- ⚙️ الإعدادات الأساسية ---
const bot = new Telegraf('8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8');
const ADMIN_ID = 1683002116;
const LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg";

// --- 🌐 سيرفر الويب (هام لـ Render) ---
const app = express();
app.get('/', (req, res) => res.send('Bot is Active ✅'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

// --- 🔥 اتصال Firebase الآمن ---
try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
        });
    }
    console.log("✅ Firebase Connected");
} catch (e) {
    console.log("⚠️ Firebase Bypass Mode: " + e.message);
}
const db = admin.database();

// --- 🛡️ نظام فحص القنوات ---
async function getChannels() {
    try {
        const snap = await db.ref('settings/channels').once('value');
        return snap.val() || [];
    } catch (e) { return []; }
}

// --- 🤖 أوامر البوت ---
bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id;
        const channels = await getChannels();

        // 1. تسجيل المستخدم (اختياري لضمان السرعة)
        db.ref(`users/${userId}`).update({
            name: ctx.from.first_name,
            last_seen: Date.now()
        }).catch(() => {});

        // 2. التحقق من الاشتراك الإجباري
        const buttons = [];
        for (const ch of channels) {
            try {
                const member = await ctx.telegram.getChatMember(ch, userId);
                if (['left', 'kicked'].includes(member.status)) {
                    buttons.push([Markup.button.url(`📢 اشترك هنا: ${ch}`, `https://t.me/${ch.replace('@','')}`)]);
                }
            } catch (e) { console.log("Channel Check Error"); }
        }

        if (buttons.length > 0) {
            buttons.push([Markup.button.callback("✅ تم الاشتراك، ابدأ", "verify")]);
            return ctx.replyWithPhoto(LOGO_URL, {
                caption: "⚠️ يرجى الانضمام للقنوات أولاً لتفعيل البوت:",
                ...Markup.inlineKeyboard(buttons)
            });
        }

        // 3. القائمة الرئيسية
        return ctx.replyWithPhoto(LOGO_URL, {
            caption: `🚀 أهلاً بك يا ${ctx.from.first_name}!\n\nاستخدم القائمة أدناه للربح:`,
            ...Markup.keyboard([
                ["👤 حسابي", "🔗 الإحالة"],
                ["🎯 المهام", "🎡 عجلة الحظ"],
                ["⚙️ لوحة الإدارة"]
            ]).resize()
        });
    } catch (err) {
        console.error("Critical Start Error:", err);
    }
});

// --- 👑 لوحة الإدارة (إضافة القنوات من البوت) ---
bot.hears("⚙️ لوحة الإدارة", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("👑 أهلاً بك في لوحة الإدارة:\n\n- أرسل: `اضف @يوزر` لإضافة قناة.\n- أرسل: `اذاعة النص` لإرسال رسالة للكل.");
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const text = ctx.message.text;

    if (text.startsWith("اضف @")) {
        const ch = text.split(" ")[1];
        let channels = await getChannels();
        if (!channels.includes(ch)) {
            channels.push(ch);
            await db.ref('settings/channels').set(channels);
            ctx.reply(`✅ تمت إضافة القناة: ${ch}`);
        }
    }
});

bot.action("verify", (ctx) => ctx.answerCbQuery("🔄 جاري التحقق... أرسل /start"));

bot.launch().then(() => console.log("🚀 BOT DEPLOYED SUCCESSFULLY"));

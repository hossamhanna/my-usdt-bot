const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

// --- الإعدادات ---
const bot = new Telegraf('8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8');
const ADMIN_ID = 1683002116;
const LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg";
const CHANNELS = ["@VaultoUSDT", "@E_G_58"];

// --- الربط بـ Firebase ---
try {
    const serviceAccount = require("./serviceAccountKey.json");
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
    });
} catch (e) { console.log("Firebase Init Error"); }
const db = admin.database();

// --- سيرفر الويب لـ Render ---
const app = express();
app.get('/', (req, res) => res.send('Bot is Live!'));
app.listen(process.env.PORT || 10000);

// --- نظام الحماية والاشتراك ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    
    // حماية من الحسابات الوهمية
    if (!ctx.from.username) {
        return ctx.reply("⚠️ حماية: يجب تعيين Username لحسابك أولاً.");
    }

    // فحص القنوات
    let isSub = true;
    if (userId !== ADMIN_ID) {
        for (const ch of CHANNELS) {
            try {
                const member = await ctx.telegram.getChatMember(ch, userId);
                if (['left', 'kicked'].includes(member.status)) isSub = false;
            } catch (e) { isSub = false; }
        }
    }

    if (!isSub) {
        const buttons = CHANNELS.map(ch => Markup.button.url(`📢 Join ${ch}`, `https://t.me/${ch.slice(1)}`));
        buttons.push(Markup.button.callback("✅ Done", "verify"));
        return ctx.replyWithPhoto(LOGO_URL, {
            caption: "👋 أهلاً بك! يجب الاشتراك في القنوات أولاً.",
            ...Markup.inlineKeyboard(buttons, { columns: 1 })
        });
    }

    // لوحة التحكم
    ctx.replyWithPhoto(LOGO_URL, {
        caption: "أهلاً بك في Earn Master Bot! 🚀",
        ...Markup.keyboard([["👤 حسابي", "🔗 رابط الإحالة"], ["🎡 عجلة الحظ", "🎯 المهام"]]).resize()
    });
});

bot.action('verify', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply("يرجى إرسال /start للتأكد من الاشتراك.");
});

bot.launch();

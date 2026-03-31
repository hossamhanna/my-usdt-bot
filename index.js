const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);

// سيرفر الويب لضمان الاستقرار 24/7
const app = express();
app.get('/', (req, res) => res.send('Bot status: Active ✅'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

// ربط Firebase
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

// دالة جلب القنوات من القاعدة
async function getChannels() {
    const snap = await db.ref('settings/channels').once('value');
    return snap.val() || [];
}

// دالة فحص الاشتراك
async function checkSub(ctx, channels) {
    if (ctx.from.id === ADMIN_ID) return true;
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch, ctx.from.id);
            if (['left', 'kicked'].includes(member.status)) return false;
        } catch { return false; }
    }
    return true;
}

bot.start(async (ctx) => {
    const channels = await getChannels();
    const isSubscribed = await checkSub(ctx, channels);

    if (!isSubscribed && channels.length > 0) {
        let msg = "⚠️ يجب الاشتراك في القنوات لتفعيل البوت:\n";
        const buttons = channels.map(ch => [Markup.button.url(ch, `https://t.me/${ch.replace('@','')}`)]);
        buttons.push([Markup.button.callback("✅ تم الاشتراك", "verify")]);
        return ctx.reply(msg, Markup.inlineKeyboard(buttons));
    }

    ctx.reply("🚀 أهلاً بك! البوت يعمل الآن بنجاح.\nاستخدم /admin للدخول للوحة التحكم (للأدمن فقط).", 
    Markup.keyboard([["👤 حسابي", "🔗 الإحالة"], ["🎡 عجلة الحظ", "🎯 المهام"]]).resize());
});

// لوحة التحكم للأدمن فقط
bot.command('admin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("🛠️ لوحة الأدمن:\nلإضافة قناة: أرسل 'اضف @اسم_القناة'\nلحذف قناة: أرسل 'حذف @اسم_القناة'");
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const text = ctx.message.text;
    let channels = await getChannels();

    if (text.startsWith("اضف ")) {
        const ch = text.split(" ")[1];
        if (!channels.includes(ch)) {
            channels.push(ch);
            await db.ref('settings/channels').set(channels);
            ctx.reply(`✅ تمت إضافة ${ch}`);
        }
    } else if (text.startsWith("حذف ")) {
        const ch = text.split(" ")[1];
        channels = channels.filter(c => c !== ch);
        await db.ref('settings/channels').set(channels);
        ctx.reply(`🗑️ تم حذف ${ch}`);
    }
});

bot.action("verify", (ctx) => ctx.reply("تم! أرسل /start للتأكد."));

bot.launch();
console.log("Bot is Online!");

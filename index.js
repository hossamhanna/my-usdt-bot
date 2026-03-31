const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

// --- إعدادات أساسية ---
const bot = new Telegraf('8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8');
const ADMIN_ID = 1683002116;
const LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg";

// --- سيرفر الويب لـ Render ---
const app = express();
app.get('/', (req, res) => res.send('Bot is Live! ✅'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

// --- ربط Firebase ---
try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
        });
    }
} catch (e) { console.log("Firebase Init Error"); }

const db = admin.database();

// --- وظائف مساعدة ---
async function getChannels() {
    const snap = await db.ref('settings/channels').once('value');
    return snap.val() || [];
}

async function isSubscribed(ctx, channels) {
    if (ctx.from.id === ADMIN_ID) return true;
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch, ctx.from.id);
            if (['left', 'kicked'].includes(member.status)) return false;
        } catch { return false; }
    }
    return true;
}

// --- الأوامر ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const channels = await getChannels();

    // فحص الاشتراك
    if (!(await isSubscribed(ctx, channels)) && channels.length > 0) {
        let msg = "⚠️ يرجى الاشتراك في القنوات للمتابعة:\n";
        const buttons = channels.map(ch => [Markup.button.url(`📢 ${ch}`, `https://t.me/${ch.replace('@','')}`)]);
        buttons.push([Markup.button.callback("✅ تحقق من الاشتراك", "check")]);
        return ctx.reply(msg, Markup.inlineKeyboard(buttons));
    }

    ctx.replyWithPhoto(LOGO_URL, {
        caption: `🚀 أهلاً بك يا ${ctx.from.first_name}!\nالبوت يعمل الآن بأقصى سرعة.`,
        ...Markup.keyboard([["👤 حسابي", "🔗 الإحالة"], ["🎡 عجلة الحظ", "🎯 المهام"]]).resize()
    });
});

// --- لوحة التحكم (للأدمن فقط) ---
bot.command('admin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("👑 لوحة التحكم:\n\nلإضافة قناة: `اضف @يوزر` \nلحذف قناة: `حذف @يوزر` \nلإرسال إذاعة: `اذاعة النص`", { parse_mode: 'Markdown' });
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
            ctx.reply(`✅ تمت إضافة ${ch}`);
        }
    } else if (text.startsWith("اذاعة ")) {
        const msg = text.replace("اذاعة ", "");
        const users = (await db.ref('users').once('value')).val();
        Object.keys(users || {}).forEach(id => bot.telegram.sendMessage(id, msg).catch(() => {}));
        ctx.reply("📢 تم إرسال الإذاعة للجميع.");
    }
});

bot.action("check", (ctx) => ctx.reply("🔄 جاري التحقق... أرسل /start مجدداً."));

bot.launch();
console.log("🚀 BOT IS LIVE ON NEW PROJECT");

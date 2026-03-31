const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

// --- ⚙️ الإعدادات ---
const bot = new Telegraf('8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8');
const ADMIN_ID = 1683002116;
const LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg";

// --- 🌐 سيرفر لضمان عدم توقف البوت ---
const app = express();
app.get('/', (req, res) => res.send('Active ✅'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

// --- 🔥 تهيئة Firebase ---
try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
        });
    }
} catch (e) { console.log("Firebase Error: " + e.message); }

const db = admin.database();

// --- 🛡️ وظائف التحقق ---
async function getChannels() {
    try {
        const snap = await db.ref('settings/channels').once('value');
        return snap.val() || [];
    } catch (e) { return []; }
}

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

// --- 🤖 معالجة الأوامر ---
bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id;
        const channels = await getChannels();

        // الرد الفوري لكسر الصمت
        await ctx.reply("⏳ جاري التحميل...").then(m => setTimeout(() => ctx.deleteMessage(m.message_id).catch(e=>{}), 1000));

        // التحقق من الاشتراك
        const isSubscribed = await checkSub(ctx, channels);
        if (!isSubscribed && channels.length > 0) {
            const buttons = channels.map(ch => [Markup.button.url(`📢 انضم: ${ch}`, `https://t.me/${ch.replace('@','')}`)]);
            buttons.push([Markup.button.callback("✅ تحقق الآن", "verify")]);
            return ctx.replyWithPhoto(LOGO_URL, {
                caption: "⚠️ يرجى الاشتراك في القنوات أدناه للبدء:",
                ...Markup.inlineKeyboard(buttons)
            });
        }

        // تسجيل المستخدم وتحديث النقاط
        db.ref(`users/${userId}`).update({
            name: ctx.from.first_name,
            last_active: Date.now()
        }).catch(e => console.log("DB Update error"));

        ctx.replyWithPhoto(LOGO_URL, {
            caption: `🚀 أهلاً بك يا ${ctx.from.first_name}!\n\nاستخدم القائمة بالأسفل لبدء الربح:`,
            ...Markup.keyboard([
                ["👤 حسابي", "🔗 الإحالة"],
                ["🎯 المهام", "🎡 عجلة الحظ"],
                ["⚙️ لوحة الإدارة"]
            ]).resize()
        });
    } catch (error) {
        console.error("Start Error: ", error);
        ctx.reply("❌ حدث خطأ بسيط، أرسل /start مرة أخرى.");
    }
});

// لوحة التحكم للأدمن
bot.hears("⚙️ لوحة الإدارة", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("🛠️ أهلاً بك يا مطور:\n\n- لإضافة قناة: `اضف @يوزر` \n- لحذف قناة: `حذف @يوزر` \n- للإذاعة: `اذاعة النص`", {parse_mode: 'Markdown'});
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
    }
});

bot.action("verify", (ctx) => ctx.answerCbQuery("تم! أرسل /start مجدداً."));

bot.launch().catch(e => console.error("Launch Error: ", e));
console.log("🚀 BOT IS ONLINE AND RESPONDING");

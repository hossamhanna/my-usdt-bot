const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

// --- ⚙️ الإعدادات ---
const bot = new Telegraf('8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8');
const ADMIN_ID = 1683002116; // الـ ID الخاص بك
const LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg";

const app = express();
app.get('/', (req, res) => res.send('System Status: Online ✅'));
app.listen(process.env.PORT || 10000);

// --- 🔥 تهيئة Firebase ---
try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
        });
    }
} catch (e) { console.error("Firebase Error: " + e.message); }

const db = admin.database();

// --- 🛡️ وظائف الحماية والاشتراك الإجباري ---
async function getChannels() {
    const snap = await db.ref('settings/channels').once('value');
    return snap.val() || []; // جلب القنوات من قاعدة البيانات مباشرة
}

async function checkSub(ctx, channels) {
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch, ctx.from.id);
            if (['left', 'kicked'].includes(member.status)) return false;
        } catch (e) { return false; }
    }
    return true;
}

// --- 🤖 معالجة الأوامر ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const channels = await getChannels();
    
    // تسجيل المستخدم وتدقيق الأمان
    const userRef = db.ref(`users/${userId}`);
    const snapshot = await userRef.once('value');
    let userData = snapshot.val();

    if (!userData) {
        userData = { id: userId, points: 0, isBanned: false, joined: Date.now() };
        await userRef.set(userData);
    }

    if (userData.isBanned) return ctx.reply("🚫 حسابك محظور من استخدام النظام.");

    // التحقق من القنوات
    const isSubscribed = await checkSub(ctx, channels);
    if (!isSubscribed && channels.length > 0) {
        let msg = "⚠️ يجب عليك الاشتراك في القنوات التالية أولاً:\n\n";
        channels.forEach(c => msg += `${c}\n`);
        return ctx.reply(msg, Markup.inlineKeyboard([[Markup.button.callback("✅ تم الاشتراك، تحقق الآن", "verify")]]));
    }

    ctx.replyWithPhoto(LOGO_URL, {
        caption: `🚀 أهلاً بك يا ${ctx.from.first_name}!\n\nالبوت يعمل الآن بأقصى حماية. استمتع بجمع الـ USDT.`,
        ...Markup.keyboard([["👤 حسابي", "🔗 رابط الإحالة"], ["🎯 المهام", "⚙️ الإدارة"]]).resize()
    });
});

// --- 👑 لوحة الأدمن المتطورة ---
bot.hears("⚙️ الإدارة", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("🛠️ لوحة التحكم:\nأرسل 'إضافة قناة @يوزر' أو 'حذف قناة @يوزر'", Markup.keyboard([
        ["📢 إذاعة", "📊 إحصائيات"], ["🏠 القائمة الرئيسية"]
    ]).resize());
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const text = ctx.message.text;

    if (text.startsWith("إضافة قناة")) {
        const ch = text.split(" ")[2];
        const channels = await getChannels();
        if (!channels.includes(ch)) {
            channels.push(ch);
            await db.ref('settings/channels').set(channels);
            ctx.reply(`✅ تمت إضافة القناة ${ch} بنجاح.`);
        }
    }

    if (text.startsWith("حذف قناة")) {
        const ch = text.split(" ")[2];
        let channels = await getChannels();
        channels = channels.filter(c => c !== ch);
        await db.ref('settings/channels').set(channels);
        ctx.reply(`🗑️ تم حذف القناة ${ch}.`);
    }
});

bot.action("verify", (ctx) => ctx.reply("🔄 جاري التحقق... أرسل /start مجدداً."));

bot.launch().then(() => console.log("🚀 BOT DEPLOYED AND PROTECTED"));

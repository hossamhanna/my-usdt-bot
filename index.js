const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

// --- ⚙️ الإعدادات ---
const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116; // الـ ID الخاص بك
const CHANNELS = ['@VaultoUSDT']; // استبدلها بيوزرات قنواتك
const LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg";

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// --- 🌐 سيرفر لضمان عمل Render ---
app.get('/', (req, res) => res.send('Bot is Online! ✅'));
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
} catch (e) { console.error("Firebase Init Error"); }

const db = admin.database();

// --- 🛡️ وظائف التحقق والحماية ---

// التحقق من الاشتراك الإجباري
async function checkSubscription(ctx) {
    for (const channel of CHANNELS) {
        try {
            const member = await ctx.telegram.getChatMember(channel, ctx.from.id);
            if (member.status === 'left' || member.status === 'kicked') return false;
        } catch (e) { return false; }
    }
    return true;
}

// --- ⌨️ لوحات المفاتيح ---
const mainKbd = Markup.keyboard([
    ["👤 حسابي", "🔗 رابط الإحالة"],
    ["🎡 عجلة الحظ", "🎯 المهام"],
    ["🌐 تغيير اللغة", "📊 الإحصائيات"]
]).resize();

const adminKbd = Markup.keyboard([
    ["📢 إذاعة جماعية", "👥 إدارة المستخدمين"],
    ["➕ إضافة نقاط", "➖ خصم نقاط"],
    ["🚫 حظر مستخدم", "🏠 القائمة الرئيسية"]
]).resize();

// --- 🤖 أوامر البوت ---

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refId = ctx.startPayload; // معرف الشخص الذي دعا المستخدم

    // 1. نظام الحماية من التعدد
    const snapshot = await db.ref(`users/${userId}`).once('value');
    const userData = snapshot.val();

    if (userData && userData.isBanned) return ctx.reply("🚫 عذراً، حسابك محظور.");

    if (!userData) {
        // تسجيل مستخدم جديد مع "داتا" أولية لمنع التلاعب
        await db.ref(`users/${userId}`).set({
            id: userId,
            name: ctx.from.first_name,
            points: 0,
            invitedBy: refId || null,
            joinDate: new Date().toISOString(),
            isBanned: false
        });

        // إذا جاء عن طريق إحالة
        if (refId && refId != userId) {
            await db.ref(`users/${refId}/points`).transaction(p => (p || 0) + 0.03); // مكافأة الإحالة
        }
    }

    // 2. التحقق من الاشتراك الإجباري
    const isSubscribed = await checkSubscription(ctx);
    if (!isSubscribed) {
        let msg = "⚠️ يجب عليك الاشتراك في قنواتنا أولاً لاستخدام البوت:\n\n";
        CHANNELS.forEach(ch => msg += `${ch}\n`);
        return ctx.reply(msg, Markup.inlineKeyboard([
            [Markup.button.callback("✅ تم الاشتراك، تحقق الآن", "check_sub")]
        ]));
    }

    ctx.replyWithPhoto(LOGO_URL, {
        caption: `🚀 أهلاً بك يا ${ctx.from.first_name} في USDT Master Bot!\n\nاستخدم القائمة أدناه للبدء بجمع الأرباح.`,
        ...mainKbd
    });
});

// --- 🔑 قسم الإدارة (Admin) ---

bot.command('admin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("👑 أهلاً بك في لوحة التحكم العلوية:", adminKbd);
});

bot.hears("📢 إذاعة جماعية", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("أرسل الرسالة التي تريد توجيهها للكل:");
    bot.on('text', async (msgCtx) => {
        if (msgCtx.from.id !== ADMIN_ID) return;
        const users = (await db.ref('users').once('value')).val();
        Object.keys(users).forEach(id => {
            bot.telegram.sendMessage(id, msgCtx.message.text).catch(e => {});
        });
        ctx.reply("✅ تمت الإذاعة بنجاح.");
    });
});

// --- 💰 وظائف المستخدم ---

bot.hears("👤 حسابي", async (ctx) => {
    const snap = await db.ref(`users/${ctx.from.id}`).once('value');
    const data = snap.val();
    ctx.reply(`👤 الاسم: ${data.name}\n💰 رصيدك: ${data.points.toFixed(3)} USDT\n🆔 معرفك: ${ctx.from.id}`);
});

bot.hears("🔗 رابط الإحالة", (ctx) => {
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    ctx.reply(`🔗 رابط الإحالة الخاص بك:\n${link}\n\n🎁 ستحصل على 0.03 USDT لكل شخص تدعوه!`);
});

// --- 🚀 تشغيل البوت ---
bot.action("check_sub", async (ctx) => {
    const sub = await checkSubscription(ctx);
    if (sub) {
        ctx.deleteMessage();
        ctx.reply("✅ تم التحقق! اضغط /start للبدء.");
    } else {
        ctx.answerCbQuery("⚠️ لم تشترك في كل القنوات بعد!", { show_alert: true });
    }
});

bot.launch();
console.log("🔥 FULL SYSTEM ACTIVE");

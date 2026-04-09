const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const fs = require('fs');

// --- إعداداتك الأساسية ---
const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const REF_REWARD = 0.03; // مكافأة الإحالة بالـ TON
const MIN_WITHDRAW = 0.10; // حد السحب بالـ TON

const bot = new Telegraf(BOT_TOKEN);

// --- 🌐 نظام منع التوقف (للسيرفر) ---
const app = express();
app.get('/', (req, res) => res.send('Novaton Bot is Running ✅'));
app.listen(process.env.PORT || 10000);

// --- 🔥 ربط قاعدة البيانات Firebase ---
let dbAvailable = false;
try {
    const keyPath = "./serviceAccountKey.json";
    if (fs.existsSync(keyPath)) {
        const serviceAccount = require(keyPath);
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
            });
        }
        dbAvailable = true;
    }
} catch (e) { console.log("Firebase Connection Error"); }
const db = admin.database();

// --- 🛡️ وظيفة فحص الاشتراك الإجباري ---
async function checkSubscription(ctx, userId) {
    const snap = await db.ref('settings/channels').once('value');
    const channels = snap.val() || [];
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch, userId);
            if (['left', 'kicked'].includes(member.status)) return false;
        } catch (e) { console.log("Error checking sub for", ch); }
    }
    return true;
}

// --- 🤖 أوامر البوت ---

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const userName = ctx.from.first_name;

    if (!dbAvailable) return ctx.reply("❌ هناك مشكلة في الاتصال بقاعدة البيانات.");

    const userRef = db.ref(`users/${userId}`);
    let userSnap = await userRef.once('value');

    // 1. تسجيل المستخدم الجديد ونظام الإحالة
    if (!userSnap.exists()) {
        const refId = ctx.startPayload;
        await userRef.set({
            id: userId,
            name: userName,
            balance: 0.0,
            joined: Date.now()
        });

        // إذا دخل عن طريق رابط إحالة
        if (refId && refId != userId) {
            const referrerRef = db.ref(`users/${refId}/balance`);
            await referrerRef.transaction(b => (b || 0) + REF_REWARD);
            bot.telegram.sendMessage(refId, `🎁 مبروك! حصلت على ${REF_REWARD} TON مكافأة إحالة صديق جديد.`).catch(()=>{});
        }
        userSnap = await userRef.once('value'); // تحديث البيانات
    }

    // 2. فحص الاشتراك الإجباري
    const isSubbed = await checkSubscription(ctx, userId);
    if (!isSubbed) {
        const snap = await db.ref('settings/channels').once('value');
        const channels = snap.val() || [];
        const msg = `🛡️ **نظام الحماية والتحقق**\n\nيجب عليك الاشتراك في قنواتنا أولاً لتفعيل حسابك:\n${channels.join('\n')}\n\nبعد الاشتراك، أرسل /start مجدداً.`;
        return ctx.reply(msg);
    }

    // 3. الواجهة الرئيسية (مثل الصورة تماماً)
    const userBalance = userSnap.val().balance || 0;
    const welcomeMsg = `🚀 **أهلاً بك في Novaton TON**\n\n` +
                       `👤 الاسم: ${userName}\n` +
                       `💰 رصيدك الحالي: ${userBalance.toFixed(4)} TON\n` +
                       `----------------------------\n` +
                       `استخدم الأزرار أدناه للتحكم في حسابك 👇`;

    ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
        caption: welcomeMsg,
        parse_mode: 'Markdown',
        ...Markup.keyboard([
            ["👤 حسابي", "🔗 الإحالة"],
            ["📥 إيداع", "📤 سحب الأرباح"],
            ["📊 الإحصائيات"]
        ]).resize()
    });
});

// --- 📩 التعامل مع الرسائل النصية ---
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    // 👑 لوحة تحكم الأدمن
    if (userId === ADMIN_ID) {
        if (text === "⚙️ الإدارة") {
            const snap = await db.ref('users').once('value');
            const userCount = snap.exists() ? Object.keys(snap.val()).length : 0;
            return ctx.reply(`👑 **لوحة تحكم الأدمن**\n\n👥 عدد المشتركين: ${userCount}\n💰 مكافأة الإحالة: ${REF_REWARD} TON\n------------------------\n➕ لإضافة قناة: \`اضف @يوزر\`\n📢 لإرسال إذاعة: \`اذاعة النص\`\nشحن رصيد: \`شحن ID المبلغ\``);
        }

        if (text.startsWith("اضف @")) {
            const ch = text.split(" ")[1];
            await db.ref('settings/channels').transaction(arr => {
                if (!arr) arr = [];
                if (!arr.includes(ch)) arr.push(ch);
                return arr;
            });
            return ctx.reply(`✅ تمت إضافة القناة ${ch}`);
        }

        if (text.startsWith("شحن ")) {
            const [_, targetId, amount] = text.split(" ");
            await db.ref(`users/${targetId}/balance`).transaction(b => (b || 0) + parseFloat(amount));
            ctx.reply(`✅ تم شحن ${amount} TON للآيدي ${targetId}`);
            return bot.telegram.sendMessage(targetId, `💰 تم إضافة ${amount} TON لرصيدك من قبل الإدارة!`);
        }
    }

    // الأزرار العادية للمستخدم
    if (text === "👤 حسابي") {
        const snap = await db.ref(`users/${userId}`).once('value');
        const bal = snap.val().balance || 0;
        ctx.reply(`👤 **تفاصيل حسابك**\n\nالاسم: ${ctx.from.first_name}\nالآيدي: \`${userId}\`\nالرصيد: ${bal.toFixed(4)} TON`, {parse_mode: 'Markdown'});
    }

    else if (text === "🔗 الإحالة") {
        const link = `https://t.me/${ctx.botInfo.username}?start=${userId}`;
        ctx.reply(`🔗 **رابط الإحالة الخاص بك**\n\n${link}\n\n🎁 اربح ${REF_REWARD} TON عن كل صديق تدعوه!`);
    }

    else if (text === "📤 سحب الأرباح") {
        const snap = await db.ref(`users/${userId}/balance`).once('value');
        const bal = snap.val() || 0;
        if (bal < MIN_WITHDRAW) {
            ctx.reply(`❌ رصيدك غير كافٍ. الحد الأدنى للسحب هو ${MIN_WITHDRAW} TON`);
        } else {
            ctx.reply(`📤 رصيدك هو ${bal.toFixed(4)} TON\nأرسل عنوان محفظتك وصورة من عملية التحقق للدعم الفني للمطالبة بسحبك.`);
        }
    }

    else if (text === "📥 إيداع") {
        ctx.reply(`📥 **قسم الإيداع وتفعيل التعدين**\n\nيرجى إرسال TON إلى المحفظة التالية:\n\n\`UQCMPOCWRU785YTzS8tSyUsSaNksGHI6BlzdnWyt01FF46Bj\`\n\nبعد التحويل، أرسل لقطة شاشة للإدارة لشحن حسابك.`);
    }
});

bot.launch();
console.log("Novaton Bot is live and running...");

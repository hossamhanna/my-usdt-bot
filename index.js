const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const fs = require('fs');

const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);

// سيرفر الويب لـ Render
const app = express();
app.get('/', (req, res) => res.send('Bot is Running ✅'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

// --- ربط Firebase ---
let dbAvailable = false;
const keyPath = "./serviceAccountKey.json";

if (fs.existsSync(keyPath)) {
    try {
        const serviceAccount = require(keyPath);
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
            });
        }
        dbAvailable = true;
        console.log("✅ Firebase Connected!");
    } catch (e) { console.log("⚠️ Firebase Key Error"); }
}

const db = admin.database();

// --- وظائف مساعدة ---
async function getChannels() {
    const snap = await db.ref('settings/channels').once('value');
    return snap.val() || [];
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

// --- أوامر البوت ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const channels = await getChannels();
    
    // 1. التحقق من الاشتراك الإجباري
    const isSub = await checkSub(ctx, channels);
    if (!isSub && channels.length > 0) {
        const buttons = channels.map(ch => [Markup.button.url(`📢 انضم: ${ch}`, `https://t.me/${ch.replace('@','')}`)]);
        buttons.push([Markup.button.callback("✅ تم الاشتراك، ابدأ الآن", "verify")]);
        return ctx.reply("⚠️ يجب عليك الاشتراك في القنوات أولاً للمتابعة:", Markup.inlineKeyboard(buttons));
    }

    // 2. تسجيل المستخدم ونظام الإحالة
    const userRef = db.ref(`users/${userId}`);
    const snap = await userRef.once('value');
    if (!snap.exists()) {
        const refId = ctx.startPayload;
        await userRef.set({ id: userId, points: 0, name: ctx.from.first_name });
        if (refId && refId != userId) {
            await db.ref(`users/${refId}/points`).transaction(p => (p || 0) + 0.03);
            bot.telegram.sendMessage(refId, "🎁 حصلت على 0.03 USDT من إحالة جديدة!").catch(()=>{});
        }
    }

    const welcomeMsg = `🚀 أهلاً بك يا ${ctx.from.first_name}!\n\nتم تشغيل البوت بنجاح.\nاستخدم القائمة بالأسفل للجمع.`;
    
    return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
        caption: welcomeMsg,
        ...Markup.keyboard([
            ["👤 حسابي", "🔗 الإحالة"],
            ["🎯 المهام", "💰 سحب الأرباح"],
            ["⚙️ الإدارة"]
        ]).resize()
    });
});

// --- الأزرار ---
bot.hears("👤 حسابي", async (ctx) => {
    const snap = await db.ref(`users/${ctx.from.id}`).once('value');
    const user = snap.val() || { points: 0 };
    ctx.reply(`💰 رصيدك: ${parseFloat(user.points).toFixed(3)} USDT`);
});

bot.hears("🔗 الإحالة", (ctx) => {
    ctx.reply(`🔗 رابط الإحالة الخاص بك:\nhttps://t.me/${ctx.botInfo.username}?start=${ctx.from.id}\n\n🎁 مكافأة الإحالة: 0.03 USDT`);
});

bot.hears("💰 سحب الأرباح", (ctx) => {
    ctx.reply("⚠️ الحد الأدنى للسحب هو 5 USDT.\nعند الوصول للحد، أرسل عنوان محفظتك هنا.");
});

// --- لوحة الإدارة (إضافة القنوات من البوت) ---
bot.hears("⚙️ الإدارة", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("👑 لوحة الإدارة:\n\n1️⃣ لإضافة قناة: أرسل `اضف @يوزر` \n2️⃣ لحذف قناة: أرسل `حذف @يوزر` \n3️⃣ إذاعة: أرسل `اذاعة النص`", { parse_mode: 'Markdown' });
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
            ctx.reply(`✅ تمت إضافة القناة ${ch}`);
        }
    }

    if (text.startsWith("حذف @")) {
        const ch = text.split(" ")[1];
        let channels = await getChannels();
        channels = channels.filter(c => c !== ch);
        await db.ref('settings/channels').set(channels);
        ctx.reply(`🗑️ تم حذف القناة ${ch}`);
    }

    if (text.startsWith("اذاعة ")) {
        const msg = text.replace("اذاعة ", "");
        const snap = await db.ref('users').once('value');
        const users = snap.val();
        if (users) {
            Object.keys(users).forEach(id => bot.telegram.sendMessage(id, msg).catch(()=>{}));
            ctx.reply("📢 تم إرسال الإذاعة للكل.");
        }
    }
});

bot.action("verify", (ctx) => ctx.reply("🔄 جاري التحقق... أرسل /start"));

bot.launch().then(() => console.log("🚀 BOT IS LIVE AND FULLY FUNCTIONAL"));

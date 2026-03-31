const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

const bot = new Telegraf('8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8');
const ADMIN_ID = 1683002116;

// سيرفر الويب لضمان العمل 24/7
const app = express();
app.get('/', (req, res) => res.send('Bot is Live! ✅'));
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
    console.log("✅ Firebase Connected");
} catch (e) { console.log("⚠️ Firebase Error"); }

const db = admin.database();

// دالة جلب القنوات من القاعدة
async function getChannels() {
    const snap = await db.ref('settings/channels').once('value');
    return snap.val() || [];
}

bot.start(async (ctx) => {
    const channels = await getChannels();
    const welcomePhoto = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg";
    
    // تسجيل المستخدم في القاعدة
    await db.ref(`users/${ctx.from.id}`).update({
        name: ctx.from.first_name,
        username: ctx.from.username || "None"
    });

    ctx.replyWithPhoto(welcomePhoto, {
        caption: `🚀 أهلاً بك يا ${ctx.from.first_name} في البوت المطور!\n\nاستخدم القائمة أدناه للبدء بالربح.`,
        ...Markup.keyboard([["👤 حسابي", "🔗 الإحالة"], ["🎡 عجلة الحظ", "🎯 المهام"]]).resize()
    });
});

// لوحة التحكم للأدمن فقط لإضافة قنوات
bot.command('admin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("👑 لوحة التحكم بالاشتراك الإجباري:\n\n➕ لإضافة قناة أرسل:\nاضف @يوزر_القناة\n\n🗑️ لحذف قناة أرسل:\nحذف @يوزر_القناة");
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const msg = ctx.message.text;

    if (msg.startsWith("اضف @")) {
        const ch = msg.split(" ")[1];
        let channels = await getChannels();
        if (!channels.includes(ch)) {
            channels.push(ch);
            await db.ref('settings/channels').set(channels);
            ctx.reply(`✅ تمت إضافة ${ch} بنجاح.`);
        }
    } else if (msg.startsWith("حذف @")) {
        const ch = msg.split(" ")[1];
        let channels = await getChannels();
        channels = channels.filter(c => c !== ch);
        await db.ref('settings/channels').set(channels);
        ctx.reply(`🗑️ تم حذف ${ch} من القائمة.`);
    }
});

bot.launch();
console.log("🚀 Bot is running on New Project!");

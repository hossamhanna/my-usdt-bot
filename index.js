const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const fs = require('fs');

const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);

// سيرفر الويب لـ Render
const app = express();
app.get('/', (req, res) => res.send('Bot Status: Active ✅'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

// --- ربط Firebase ---
const keyPath = "./serviceAccountKey.json";
if (fs.existsSync(keyPath)) {
    const serviceAccount = require(keyPath);
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
        });
    }
}
const db = admin.database();

// --- وظائف مساعدة ---
async function getUser(id) {
    const snap = await db.ref(`users/${id}`).once('value');
    return snap.val() || { id, points: 0, joined: Date.now() };
}

// --- أوامر البوت ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    let user = await getUser(userId);
    
    // تسجيل المستخدم الجديد
    if (!user.name) {
        user.name = ctx.from.first_name;
        await db.ref(`users/${userId}`).set(user);
        
        // نظام الإحالة (0.03 USDT)
        const refId = ctx.startPayload;
        if (refId && refId != userId) {
            await db.ref(`users/${refId}/points`).transaction(p => (p || 0) + 0.03);
            bot.telegram.sendMessage(refId, "🎁 حصلت على 0.03 USDT من إحالة جديدة!").catch(()=>{});
        }
    }

    ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
        caption: `🚀 أهلاً بك يا ${ctx.from.first_name}\n\nرصيدك الحالي: ${user.points.toFixed(3)} USDT`,
        ...Markup.keyboard([
            ["👤 حسابي", "🔗 الإحالة"],
            ["🎯 المهام", "🎡 عجلة الحظ"],
            ["⚙️ لوحة الإدارة"]
        ]).resize()
    });
});

bot.hears("👤 حسابي", async (ctx) => {
    const user = await getUser(ctx.from.id);
    ctx.reply(`👤 الاسم: ${user.name}\n💰 الرصيد: ${user.points.toFixed(3)} USDT\n🆔 معرفك: ${ctx.from.id}`);
});

bot.hears("🔗 الإحالة", (ctx) => {
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    ctx.reply(`🔗 رابط الإحالة الخاص بك:\n${link}\n\n🎁 ستحصل على 0.03 USDT عن كل صديق!`);
});

// --- قسم الإدارة (Admin Panel) ---
bot.hears("⚙️ لوحة الإدارة", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("👑 لوحة التحكم بالبوت:\n\n1️⃣ لإضافة قناة إجبارية:\nأرسل: `اضف @يوزر` \n\n2️⃣ لإضافة نقاط لمستخدم:\nأرسل: `شحن ID_المستخدم عدد_النقاط` \n\n3️⃣ إذاعة للكل:\nأرسل: `اذاعة النص`", {parse_mode: 'Markdown'});
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const text = ctx.message.text;

    // شحن نقاط يدوياً
    if (text.startsWith("شحن ")) {
        const parts = text.split(" ");
        const targetId = parts[1];
        const amount = parseFloat(parts[2]);
        await db.ref(`users/${targetId}/points`).transaction(p => (p || 0) + amount);
        ctx.reply(`✅ تم إضافة ${amount} USDT للمستخدم ${targetId}`);
    }
});

bot.launch();
console.log("🔥 Full System Active!");

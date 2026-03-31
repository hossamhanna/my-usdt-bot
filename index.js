const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const fs = require('fs');

const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);

// --- سيرفر الويب لضمان عمل Render ---
const app = express();
app.get('/', (req, res) => res.send('Bot is Live ✅'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

// --- تهيئة Firebase الآمنة ---
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
        console.log("✅ Firebase Connected");
    }
} catch (e) { console.log("⚠️ Firebase Bypass"); }

const db = admin.database();

// --- وظائف النظام ---
async function getSettings() {
    if (!dbAvailable) return { channels: [] };
    const snap = await db.ref('settings').once('value');
    return snap.val() || { channels: [] };
}

// --- معالج أمر Start ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    
    // 1. الرد الفوري (لضمان أن البوت شغال أمام المستخدم)
    const welcomePhoto = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg";
    
    await ctx.replyWithPhoto(welcomePhoto, {
        caption: `🚀 أهلاً بك يا ${ctx.from.first_name} في بوت USDT المطور!\n\nاستخدم القائمة أدناه للبدء بالربح.`,
        ...Markup.keyboard([
            ["👤 حسابي", "🔗 الإحالة"],
            ["🎯 المهام", "🎡 عجلة الحظ"],
            ["💰 سحب الأرباح", "⚙️ الإدارة"]
        ]).resize()
    });

    // 2. معالجة البيانات في الخلفية (نظام الإحالة والتسجيل)
    if (dbAvailable) {
        const userRef = db.ref(`users/${userId}`);
        const snap = await userRef.once('value');
        if (!snap.exists()) {
            const refId = ctx.startPayload;
            await userRef.set({ id: userId, points: 0, name: ctx.from.first_name, joined: Date.now() });
            
            if (refId && refId != userId) {
                await db.ref(`users/${refId}/points`).transaction(p => (p || 0) + 0.03);
                bot.telegram.sendMessage(refId, "🎁 شخص جديد انضم عبر رابطك! حصلت على 0.03 USDT").catch(()=>{});
            }
        }
    }
});

// --- الأزرار والتفاعل ---
bot.hears("👤 حسابي", async (ctx) => {
    if (!dbAvailable) return ctx.reply("⚠️ الخدمة غير متوفرة حالياً.");
    const snap = await db.ref(`users/${ctx.from.id}`).once('value');
    const user = snap.val() || { points: 0 };
    ctx.reply(`👤 الاسم: ${ctx.from.first_name}\n💰 الرصيد: ${parseFloat(user.points || 0).toFixed(3)} USDT`);
});

bot.hears("🔗 الإحالة", (ctx) => {
    ctx.reply(`🔗 رابط الإحالة الخاص بك:\nhttps://t.me/${ctx.botInfo.username}?start=${ctx.from.id}\n\n🎁 اربح 0.03 USDT عن كل صديق!`);
});

bot.hears("💰 سحب الأرباح", (ctx) => {
    ctx.reply("💵 الحد الأدنى للسحب هو 5 USDT.\nعند الوصول للحد، أرسل عنوان محفظتك TRC20 هنا.");
});

// --- لوحة الإدارة (Admin) ---
bot.hears("⚙️ الإدارة", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("👑 لوحة التحكم:\n\n- لإضافة قناة: `اضف @يوزر` \n- للإذاعة: `اذاعة النص` \n- لشحن نقاط: `شحن ID المبلغ`", { parse_mode: 'Markdown' });
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const text = ctx.message.text;

    // إضافة قناة اشتراك إجباري
    if (text.startsWith("اضف @")) {
        const ch = text.split(" ")[1];
        const snap = await db.ref('settings/channels').once('value');
        let channels = snap.val() || [];
        if (!channels.includes(ch)) {
            channels.push(ch);
            await db.ref('settings/channels').set(channels);
            ctx.reply(`✅ تمت إضافة القناة: ${ch}`);
        }
    }

    // إذاعة جماعية
    if (text.startsWith("اذاعة ")) {
        const msg = text.replace("اذاعة ", "");
        const snap = await db.ref('users').once('value');
        const users = snap.val();
        if (users) {
            Object.keys(users).forEach(id => bot.telegram.sendMessage(id, msg).catch(()=>{}));
            ctx.reply("📢 تم إرسال الإذاعة لجميع المستخدمين.");
        }
    }
});

// تشغيل البوت
bot.launch().then(() => console.log("🚀 FULL SYSTEM READY"));

// لمنع التوقف المفاجئ
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

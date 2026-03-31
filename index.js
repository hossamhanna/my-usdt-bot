const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const fs = require('fs');

const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);

// سيرفر الويب لـ Render
const app = express();
app.get('/', (req, res) => res.send('Bot Status: Online ✅'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

// --- ربط Firebase مع معالجة الأخطاء لضمان عدم توقف البوت ---
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
    } catch (e) { console.log("Firebase Init Error"); }
}
const db = admin.database();

// --- وظائف مساعدة ---
async function getChannels() {
    if (!dbAvailable) return [];
    try {
        const snap = await db.ref('settings/channels').once('value');
        return snap.val() || [];
    } catch (e) { return []; }
}

// --- أوامر البوت ---
bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id;
        
        // تسجيل المستخدم (بشكل صامت لعدم تعطيل الرد)
        if (dbAvailable) {
            db.ref(`users/${userId}`).update({
                name: ctx.from.first_name,
                last_start: Date.now()
            }).catch(() => {});
        }

        const channels = await getChannels();
        
        // إرسال رسالة الترحيب فوراً (هذا يضمن أن البوت سيتحرك)
        const welcomePhoto = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg";
        const msg = `🚀 أهلاً بك يا ${ctx.from.first_name} في USDT Master!\n\nالبوت جاهز للعمل. استخدم القائمة أدناه:`;

        return ctx.replyWithPhoto(welcomePhoto, {
            caption: msg,
            ...Markup.keyboard([
                ["👤 حسابي", "🔗 الإحالة"],
                ["🎯 المهام", "💰 سحب الأرباح"],
                ["⚙️ الإدارة"]
            ]).resize()
        });
    } catch (err) {
        console.error("Start Error:", err);
    }
});

// --- الأزرار ---
bot.hears("👤 حسابي", async (ctx) => {
    if (!dbAvailable) return ctx.reply("⚠️ قاعدة البيانات غير متصلة حالياً.");
    const snap = await db.ref(`users/${ctx.from.id}`).once('value');
    const user = snap.val() || { points: 0 };
    ctx.reply(`💰 رصيدك الحالي: ${parseFloat(user.points || 0).toFixed(3)} USDT`);
});

bot.hears("🔗 الإحالة", (ctx) => {
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    ctx.reply(`🎁 شارك الرابط واربح 0.03 USDT عن كل صديق:\n\n${link}`);
});

bot.hears("💰 سحب الأرباح", (ctx) => {
    ctx.reply("💵 الحد الأدنى للسحب هو 5 USDT.\nعند الوصول للحد، أرسل عنوان محفظتك TRC20 هنا.");
});

// --- الإدارة ---
bot.hears("⚙️ الإدارة", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("👑 لوحة التحكم:\n\n- لإضافة قناة: `اضف @يوزر` \n- للإذاعة: `اذاعة النص`", { parse_mode: 'Markdown' });
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const text = ctx.message.text;

    if (text.startsWith("اضف @")) {
        const ch = text.split(" ")[1];
        if (dbAvailable) {
            const snap = await db.ref('settings/channels').once('value');
            let channels = snap.val() || [];
            if (!channels.includes(ch)) {
                channels.push(ch);
                await db.ref('settings/channels').set(channels);
                ctx.reply(`✅ تمت إضافة ${ch}`);
            }
        }
    }
    
    if (text.startsWith("اذاعة ")) {
        const msg = text.replace("اذاعة ", "");
        const snap = await db.ref('users').once('value');
        const users = snap.val();
        if (users) {
            Object.keys(users).forEach(id => bot.telegram.sendMessage(id, msg).catch(()=>{}));
            ctx.reply("📢 تم الإرسال للجميع.");
        }
    }
});

bot.launch().then(() => console.log("🚀 BOT DEPLOYED"));

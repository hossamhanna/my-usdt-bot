const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const fs = require('fs');

const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);

// --- سيرفر الويب لضمان عمل Render ---
const app = express();
app.get('/', (req, res) => res.send('Bot is Running ✅'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

// --- إعداد Firebase الآمن ---
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
        console.log("✅ Firebase Connected");
    } catch (e) { console.log("⚠️ Firebase Error"); }
}
const db = admin.database();

// --- ميزات البوت ---

// 1. الرد على أمر Start فوراً
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const welcomePhoto = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg";
    
    // الرد الفوري بالقائمة (لضمان الاستجابة)
    ctx.replyWithPhoto(welcomePhoto, {
        caption: `🚀 أهلاً بك يا ${ctx.from.first_name}!\nاستخدم القائمة بالأسفل للجمع الأرباح.`,
        ...Markup.keyboard([
            ["👤 حسابي", "🔗 الإحالة"],
            ["🎯 المهام", "🎡 عجلة الحظ"],
            ["💰 سحب الأرباح", "⚙️ الإدارة"]
        ]).resize()
    }).catch(e => console.log("Reply Error"));

    // تسجيل البيانات في الخلفية
    if (dbAvailable) {
        const userRef = db.ref(`users/${userId}`);
        userRef.once('value').then(snap => {
            if (!snap.exists()) {
                const refId = ctx.startPayload;
                userRef.set({ id: userId, points: 0, name: ctx.from.first_name });
                if (refId && refId != userId) {
                    db.ref(`users/${refId}/points`).transaction(p => (p || 0) + 0.03);
                    bot.telegram.sendMessage(refId, "🎁 حصلت على 0.03 USDT من إحالة جديدة!").catch(()=>{});
                }
            }
        });
    }
});

// 2. زر حسابي
bot.hears("👤 حسابي", async (ctx) => {
    if (!dbAvailable) return ctx.reply("⚠️ الخدمة مؤقتاً غير متوفرة.");
    const snap = await db.ref(`users/${ctx.from.id}`).once('value');
    const user = snap.val() || { points: 0 };
    ctx.reply(`💰 رصيدك الحالي: ${parseFloat(user.points || 0).toFixed(3)} USDT`);
});

// 3. زر الإحالة
bot.hears("🔗 الإحالة", (ctx) => {
    ctx.reply(`🔗 رابط الإحالة الخاص بك:\nhttps://t.me/${ctx.botInfo.username}?start=${ctx.from.id}\n\n🎁 مكافأة كل إحالة: 0.03 USDT`);
});

// 4. سحب الأرباح
bot.hears("💰 سحب الأرباح", (ctx) => {
    ctx.reply("⚠️ الحد الأدنى للسحب: 5 USDT.\nأرسل عنوان محفظتك هنا عند الوصول للحد.");
});

// 5. لوحة الإدارة (للأدمن فقط)
bot.hears("⚙️ الإدارة", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("👑 لوحة التحكم:\n\n- لإضافة قناة: `اضف @يوزر` \n- للإذاعة: `اذاعة النص`", { parse_mode: 'Markdown' });
});

// معالجة النصوص (للأدمن)
bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const text = ctx.message.text;

    if (text.startsWith("اضف @")) {
        const ch = text.split(" ")[1];
        await db.ref('settings/channels').transaction(arr => {
            if (!arr) arr = [];
            if (!arr.includes(ch)) arr.push(ch);
            return arr;
        });
        ctx.reply(`✅ تمت إضافة القناة ${ch}`);
    }

    if (text.startsWith("اذاعة ")) {
        const msg = text.replace("اذاعة ", "");
        const snap = await db.ref('users').once('value');
        const users = snap.val();
        if (users) {
            Object.keys(users).forEach(id => bot.telegram.sendMessage(id, msg).catch(()=>{}));
            ctx.reply("📢 تم إرسال الإذاعة للجميع.");
        }
    }
});

bot.launch().then(() => console.log("🚀 BOT IS LIVE"));

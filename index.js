const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const fs = require('fs');

// --- إعدادات البوت والقاعدة ---
const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);

// --- نظام منع التوقف 24/7 ---
const app = express();
app.get('/', (req, res) => res.send('Novaton Bot is Active 🚀'));
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

// --- ميكانيكية الحماية والتحقق ---
async function isUserNew(userId) {
    const snap = await db.ref(`users/${userId}`).once('value');
    return !snap.exists();
}

// --- واجهة المستخدم (User Interface) ---
const userMenu = Markup.keyboard([
    ["👤 حسابي", "🔗 الإحالة"],
    ["🎯 المهام", "🎡 عجلة الحظ"],
    ["💰 سحب الأرباح", "⚙️ الإدارة"]
]).resize();

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refId = ctx.startPayload; // معرف الشخص الذي دعا المستخدم

    // حماية: تسجيل المستخدم الجديد ومنع التكرار
    if (await isUserNew(userId)) {
        await db.ref(`users/${userId}`).set({
            id: userId,
            name: ctx.from.first_name,
            points: 0,
            invitedBy: refId || null,
            joinedAt: Date.now()
        });

        // إذا جاء عن طريق رابط إحالة
        if (refId && refId != userId) {
            await db.ref(`users/${refId}/points`).transaction(p => (p || 0) + 0.03);
            bot.telegram.sendMessage(refId, "🎁 رائع! انضم مستخدم جديد عبر رابطك وحصلت على 0.03 USDT.");
        }
    }

    ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
        caption: `🚀 مرحباً بك في **Novaton**\n\nأقوى بوت لربح USDT وتجميع النقاط.\nاستخدم الأزرار بالأسفل لبدء رحلتك!`,
        parse_mode: 'Markdown',
        ...userMenu
    });
});

bot.hears("👤 حسابي", async (ctx) => {
    const snap = await db.ref(`users/${ctx.from.id}`).once('value');
    const user = snap.val() || { points: 0 };
    ctx.reply(`👤 الاسم: ${ctx.from.first_name}\n💰 رصيدك: ${user.points.toFixed(3)} USDT\n🆔 معرفك: \`${ctx.from.id}\``, { parse_mode: 'Markdown' });
});

bot.hears("🔗 الإحالة", (ctx) => {
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    ctx.reply(`🔗 رابط الإحالة الخاص بك:\n\`${link}\`\n\n🎁 شارك الرابط واربح 0.03 USDT عن كل شخص يسجل من خلالك!`, { parse_mode: 'Markdown' });
});

// --- لوحة التحكم (Admin Panel) ---
bot.hears("⚙️ الإدارة", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply("❌ عذراً، هذا القسم للمطور فقط.");
    
    const snap = await db.ref('users').once('value');
    const totalUsers = snap.exists() ? Object.keys(snap.val()).length : 0;

    ctx.reply(`👑 **أهلاً بك في لوحة التحكم**\n\n👥 إجمالي المستخدمين: ${totalUsers}\n\n**التحكم السريع:**\n- لإضافة قناة: \`اضف @يوزر\`\n- للإذاعة: \`اذاعة النص\`\n- لشحن رصيد: \`شحن ID المبلغ\``, { parse_mode: 'Markdown' });
});

// معالجة أوامر الأدمن النصية
bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const text = ctx.message.text;

    // إضافة قناة اشتراك إجباري
    if (text.startsWith("اضف @")) {
        const channel = text.split(" ")[1];
        await db.ref('settings/channels').transaction(arr => {
            if (!arr) arr = [];
            arr.push(channel);
            return arr;
        });
        ctx.reply(`✅ تمت إضافة القناة ${channel} بنجاح.`);
    }

    // إذاعة رسالة للكل
    if (text.startsWith("اذاعة ")) {
        const announcement = text.replace("اذاعة ", "");
        const snap = await db.ref('users').once('value');
        const users = snap.val();
        if (users) {
            Object.keys(users).forEach(id => {
                bot.telegram.sendMessage(id, announcement).catch(() => {});
            });
            ctx.reply("📢 تم إرسال الإذاعة لجميع المستخدمين.");
        }
    }
});

bot.launch();
console.log("✅ Novaton Bot is Online");

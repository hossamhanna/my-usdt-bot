const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const path = require('path');

const BOT_TOKEN = '8685057163:AAGT3o3Ad-MAYfrHQmxRkA6Py6pnKPnUzMk';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);
const app = express();

// --- ربط قاعدة البيانات ---
try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
        });
    }
} catch (e) { console.log("⚠️ Firebase Not Linked!"); }
const db = admin.database();

app.use(express.static(path.join(__dirname)));
app.get('/validate', (req, res) => res.sendFile(path.join(__dirname, 'validate.html')));
app.listen(process.env.PORT || 10000);

// --- الأوامر الأساسية ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    
    // فحص الحظر
    const banned = await db.ref(`blacklist/${userId}`).once('value');
    if (banned.exists()) return ctx.reply("🚫 حسابك محظور نهائياً من قبل الإدارة.");

    // تسجيل مستخدم جديد
    await db.ref(`users/${userId}`).update({
        first_name: ctx.from.first_name,
        username: ctx.from.username || "None",
        joinedAt: Date.now()
    });

    const webAppUrl = `https://novaton-bot.onrender.com/validate`; // استبدله برابطك

    return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
        caption: `🛡️ **مرحباً بك في Novaton المطور**\n\nيجب عليك أولاً إجراء فحص الأمان واشتراك في القناة الرسمية لتفعيل الحساب.\n\n📢 القناة: @VaultoUSDT`,
        ...Markup.inlineKeyboard([
            [Markup.button.url("📢 اشترك في القناة", "https://t.me/VaultoUSDT")],
            [Markup.button.webApp("🔍 فحص الأمان والدخول", webAppUrl)]
        ])
    });
});

// --- 👑 لوحة تحكم الإدارة (/admin) ---
bot.command('admin', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    const snapshot = await db.ref('users').once('value');
    const userCount = snapshot.numChildren() || 0;

    const adminMenu = `👑 **لوحة تحكم المدير**\n\n👥 إجمالي الأعضاء: ${userCount}\n💰 طلبات السحب المعلقة: جاري الفحص...`;

    ctx.reply(adminMenu, Markup.inlineKeyboard([
        [Markup.button.callback("📢 إذاعة عامة", "broadcast"), Markup.button.callback("🚫 حظر عضو", "ban_user")],
        [Markup.button.callback("📥 طلبات السحب", "view_withdrawals")],
        [Markup.button.callback("⚙️ إعدادات القنوات", "edit_channels")]
    ]));
});

// --- معالجة الإذاعة (Broadcast) ---
bot.action('broadcast', (ctx) => {
    ctx.reply("أرسل الآن الرسالة التي تريد توجيهها لجميع الأعضاء (نص فقط):");
    bot.on('text', async (msgCtx) => {
        if (msgCtx.from.id !== ADMIN_ID) return;
        const users = await db.ref('users').once('value');
        let count = 0;
        users.forEach((child) => {
            bot.telegram.sendMessage(child.key, msgCtx.message.text).catch(() => {});
            count++;
        });
        msgCtx.reply(`✅ تم إرسال الرسالة إلى ${count} عضو.`);
    });
});

// --- نظام السحب (للمستخدمين) ---
bot.hears("📤 سحب الأرباح", (ctx) => {
    ctx.reply("أرسل عنوان محفظة TON الخاصة بك ومبلغ السحب.\nسيتم مراجعة الطلب من الإدارة.");
});

bot.launch();

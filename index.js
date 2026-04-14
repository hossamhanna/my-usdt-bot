const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const path = require('path');

const BOT_TOKEN = '8685057163:AAGT3o3Ad-MAYfrHQmxRkA6Py6pnKPnUzMk';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);
const app = express();

// --- قواعد البيانات المؤقتة ---
let users = new Map();
let deviceRegistry = new Map();
let bannedUsers = new Set();
let forceChannels = ['@VaultoUSDT']; // يمكنك إضافتها من لوحة الأدمن

app.use(express.static(path.join(__dirname)));
app.get('/validate', (req, res) => res.sendFile(path.join(__dirname, 'validate.html')));
app.listen(process.env.PORT || 10000);

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

// أزرار القائمة الرئيسية (الإنجليزية)
const mainMenu = (lang = 'en') => {
    const btns = lang === 'en' ? 
        [["👤 Account", "👥 Referral"], ["📥 Deposit", "📤 Withdraw"], ["🌐 Language", "📢 Channel"]] :
        [["👤 حسابي", "👥 الإحالة"], ["📥 إيداع", "📤 سحب"], ["🌐 اللغة", "📢 القناة"]];
    return Markup.keyboard(btns).resize();
};

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    if (bannedUsers.has(userId)) return ctx.reply("🚫 You are banned.");

    if (!users.has(userId)) {
        users.set(userId, { balance: 0, lang: 'en', verified: false, invited: 0 });
    }

    // المرحلة 1: الاشتراك الإجباري
    if (!(await isSubscribed(ctx))) {
        return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
            caption: `🛡️ **Novaton Protection**\n\nPlease join our channels to continue.`,
            ...Markup.inlineKeyboard([
                [Markup.button.url("📢 Official Channel", "https://t.me/VaultoUSDT")],
                [Markup.button.callback("✅ Verify Membership", "check_sub")]
            ])
        });
    }
    sendSecurityScan(ctx);
});

bot.action('check_sub', async (ctx) => {
    if (await isSubscribed(ctx)) {
        await ctx.deleteMessage();
        sendSecurityScan(ctx);
    } else {
        await ctx.answerCbQuery("❌ Please join all channels!", { show_alert: true });
    }
});

function sendSecurityScan(ctx) {
    const domain = process.env.RENDER_EXTERNAL_HOSTNAME || 'novaton-bot.onrender.com';
    ctx.reply(`🛡️ **Identity Scan Required**\nStart the hardware scan to unlock your dashboard.`, 
    Markup.inlineKeyboard([[Markup.button.webApp("🔍 Start Security Scan", `https://${domain}/validate`)]]));
}

// المرحلة 2: معالجة بيانات الحماية وكشف التعدد
bot.on('web_app_data', (ctx) => {
    const data = JSON.parse(ctx.webAppData.data);
    const userId = ctx.from.id;
    const hwid = data.hwid;

    // كشف التعدد
    if (deviceRegistry.has(hwid) && deviceRegistry.get(hwid) !== userId) {
        bannedUsers.add(userId);
        return ctx.reply("🚨 **Multi-Account Detected!**\nThis device is linked to another account. Your account has been banned.");
    }

    deviceRegistry.set(hwid, userId);
    users.get(userId).verified = true;
    ctx.reply("✅ **Verification Successful!**", mainMenu(users.get(userId).lang));
});

// --- 👑 لوحة الإدارة الشاملة ---
bot.command('admin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply(`👑 **Novaton Admin Panel**\n\nUsers: ${users.size}\nBanned: ${bannedUsers.size}`, 
    Markup.inlineKeyboard([
        [Markup.button.callback("📢 Broadcast", "adm_cast"), Markup.button.callback("➕ Add Channel", "adm_add_ch")],
        [Markup.button.callback("💰 Give Points", "adm_give"), Markup.button.callback("🚫 Ban User", "adm_ban")]
    ]));
});

// مثال لإضافة قناة اشتراك إجباري من البوت
bot.action('adm_add_ch', (ctx) => {
    ctx.reply("Send the channel username (e.g., @MyChannel):");
    bot.on('text', (msg) => {
        if (msg.from.id === ADMIN_ID && msg.message.text.startsWith('@')) {
            forceChannels.push(msg.message.text);
            msg.reply("✅ Channel added to mandatory list.");
        }
    });
});

bot.launch();

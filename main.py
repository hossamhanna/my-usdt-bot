import telebot
from telebot import types
from telebot.types import WebAppInfo
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os

# --- الإعدادات الأساسية ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116  # معرف حسابك (المدير)
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/"
REQUIRED_CHANNELS = ["@VaultoUSDT", "@E_G_58"]

# --- نظام Flask لضمان استقرار النشر على Render ---
app = Flask(__name__)
@app.route('/')
def home(): return "Bot System is Live & Protected!", 200

def run_flask():
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

# --- الاتصال بـ Firebase ---
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
        print("✅ Connected to Firebase successfully")
except Exception as e:
    print(f"❌ Firebase Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- وظائف الإدارة والحماية ---
def is_maintenance():
    return db.reference('settings/maintenance').get() == True

def is_verified(user_id):
    data = db.reference(f'users/{user_id}').get()
    return data and data.get('is_verified') == True

# --- لوحات المفاتيح ---
def admin_keyboard():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("📊 إحصائيات البوت", "🛡️ وضع الصيانة (إيقاف/تشغيل)")
    markup.add("➕ إضافة نقاط", "➖ خصم نقاط")
    markup.add("📢 إرسال إعلان للكل", "🏠 خروج من لوحة الإدارة")
    return markup

def user_keyboard():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

# --- الأوامر الرئيسية ---
@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    
    # 1. فحص وضع الصيانة
    if is_maintenance() and message.chat.id != ADMIN_ID:
        maintenance_msg = "⚠️ **نعتذر، البوت في وضع الصيانة حالياً!**\n\nيتم تحديث الأنظمة لضمان حمايتكم. سنعود للعمل قريباً جداً! 🚀"
        bot.send_message(message.chat.id, maintenance_msg, parse_mode="Markdown")
        return

    # 2. تسجيل المستخدم الجديد
    user_ref = db.reference(f'users/{user_id}')
    if not user_ref.get():
        user_ref.set({
            'balance': 0.0,
            'referrals': 0,
            'is_verified': False,
            'username': message.from_user.username or "N/A",
            'joined_at': str(message.date)
        })

    # 3. التحقق من العضوية والتوثيق
    if is_verified(user_id):
        bot.send_message(message.chat.id, "✅ أهلاً بك مجدداً في القائمة الرئيسية!", reply_markup=user_keyboard())
    else:
        markup = types.InlineKeyboardMarkup(row_width=1)
        for ch in REQUIRED_CHANNELS:
            markup.add(types.InlineKeyboardButton(f"➕ Join {ch}", url=f"https://t.me/{ch.strip('@')}"))
        markup.add(types.InlineKeyboardButton("🛡️ Verify Device (Strong System)", web_app=WebAppInfo(url=WEB_APP_URL)))
        
        bot.send_message(message.chat.id, "⚠️ **يجب التحقق من جهازك أولاً!**\n\nلمنع الحسابات المتعددة، يرجى الانضمام للقنوات ثم الضغط على زر التحقق.", 
                         parse_mode="Markdown", reply_markup=markup)

# --- أوامر لوحة الإدارة ---
@bot.message_handler(commands=['admin'])
def open_admin(message):
    if message.chat.id == ADMIN_ID:
        bot.send_message(message.chat.id, "💻 مرحباً بك في لوحة تحكم المدير:", reply_markup=admin_keyboard())

@bot.message_handler(func=lambda m: True)
def handle_messages(message):
    if is_maintenance() and message.chat.id != ADMIN_ID: return

    # منطق الأدمن
    if message.chat.id == ADMIN_ID:
        if message.text == "📊 إحصائيات البوت":
            users = db.reference('users').get() or {}
            total = len(users)
            verified = sum(1 for u in users.values() if u.get('is_verified'))
            bot.send_message(ADMIN_ID, f"📈 **إحصائيات البوت:**\n\n👥 عدد المستخدمين: {total}\n✅ المحققين: {verified}")
        
        elif message.text == "🛡️ وضع الصيانة (إيقاف/تشغيل)":
            current = db.reference('settings/maintenance').get()
            new = not current
            db.reference('settings/maintenance').set(new)
            status = "🔴 تم إيقاف البوت" if new else "🟢 البوت يعمل الآن"
            bot.send_message(ADMIN_ID, status)

        elif message.text == "➕ إضافة نقاط":
            msg = bot.send_message(ADMIN_ID, "أرسل (ID المستخدم) ثم (المبلغ) مثال:\n`1683002116 10`", parse_mode="Markdown")
            bot.register_next_step_handler(msg, add_points)

        elif message.text == "🏠 خروج من لوحة الإدارة":
            bot.send_message(ADMIN_ID, "تم العودة لوضع المستخدم.", reply_markup=user_keyboard())

    # منطق المستخدم
    if is_verified(message.chat.id):
        if message.text == "👤 Profile & Balance":
            data = db.reference(f'users/{message.chat.id}').get()
            bot.send_message(message.chat.id, f"💰 **رصيدك الحالي:** {data.get('balance', 0.0)} USDT\n🔗 **إحالاتك:** {data.get('referrals', 0)}", parse_mode="Markdown")

def add_points(message):
    try:
        uid, amt = message.text.split()
        ref = db.reference(f'users/{uid}/balance')
        new_val = (ref.get() or 0.0) + float(amt)
        ref.set(new_val)
        bot.send_message(ADMIN_ID, f"✅ تمت إضافة {amt} لليوزر {uid}")
        bot.send_message(uid, f"🎁 **لقد أضاف لك المدير {amt} USDT إلى رصيدك!**", parse_mode="Markdown")
    except: bot.send_message(ADMIN_ID, "❌ خطأ في التنسيق!")

if __name__ == "__main__":
    Thread(target=run_flask).start() # لتجاوز Port Binding في Render
    print("🚀 Bot is Polling...")
    bot.polling(none_stop=True)

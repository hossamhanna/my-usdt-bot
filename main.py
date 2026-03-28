import telebot
from telebot import types
from telebot.types import WebAppInfo
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os

# ================= إعدادات البوت (تأكد من صحتها) =================
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
# رابط الـ Web App الخاص بك الذي أرسلته
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/" 
# رابط قاعدة البيانات من Firebase
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
# ==========================================================

# تشغيل Flask لإبقاء البوت مستيقظاً 24/7
app = Flask('')

@app.route('/')
def home():
    return "Bot is Alive!"

def run():
    app.run(host='0.0.0.0', port=8080)

def keep_alive():
    t = Thread(target=run)
    t.daemon = True
    t.start()

# تهيئة اتصال Firebase مع معالجة الأخطاء لضمان استمرار البوت
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
    users_ref = db.reference('users')
    print("✅ Connected to Firebase successfully")
except Exception as e:
    print(f"❌ Firebase Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# القائمة الرئيسية للأزرار السفلى
def main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    
    # محاولة تسجيل المستخدم في قاعدة البيانات
    try:
        user_data = users_ref.child(user_id).get()
        if not user_data:
            users_ref.child(user_id).set({
                'balance': 0.0,
                'referrals': 0,
                'verified': False
            })
    except Exception as e:
        print(f"❌ Database Record Error: {e}")

    # زر التحقق (Web App)
    markup = types.InlineKeyboardMarkup()
    # استخدام الرابط الذي زودتني به لفتح صفحة الحماية
    btn_verify = types.InlineKeyboardButton("🛡️ Device Verification", web_app=WebAppInfo(url=WEB_APP_URL))
    markup.add(btn_verify)
    
    welcome_text = (
        "👋 Welcome to Novaton Bot!\n\n"
        "🏆 Join our channels to start earning USDT.\n"
        "🤝 To unlock all features, please verify your device below."
    )
    
    bot.send_message(message.chat.id, welcome_text, reply_markup=markup)
    # إرسال القائمة الرئيسية أيضاً
    bot.send_message(message.chat.id, "Use the menu below to navigate:", reply_markup=main_menu())

@bot.message_handler(func=lambda m: m.text == "👤 Profile & Balance")
def profile(message):
    user_id = str(message.chat.id)
    try:
        data = users_ref.child(user_id).get() or {'balance': 0.0, 'referrals': 0}
        text = (
            f"👤 *Your Profile*\n\n"
            f"🆔 ID: `{user_id}`\n"
            f"💰 Balance: *{data['balance']} USDT*\n"
            f"👥 Referrals: *{data['referrals']}*"
        )
        bot.send_message(message.chat.id, text, parse_mode="Markdown")
    except Exception as e:
        bot.send_message(message.chat.id, "⚠️ Error fetching profile data.")

# تشغيل البوت
if __name__ == "__main__":
    keep_alive() # تشغيل سيرفر Flask في الخلفية
    print("🚀 Bot is starting now...")
    bot.polling(none_stop=True)

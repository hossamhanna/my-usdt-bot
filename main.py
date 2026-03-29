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
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/" 
REQUIRED_CHANNELS = ["@VaultoUSDT", "@E_G_58"]

# --- نظام Flask لضمان استقرار النشر على Render ---
app = Flask('')
@app.route('/')
def home(): return "Bot is Online and Secure!"

def run():
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)

def keep_alive():
    t = Thread(target=run)
    t.daemon = True
    t.start()

# --- الاتصال بـ Firebase ---
if not firebase_admin._apps:
    try:
        # تأكد من رفع ملف serviceAccountKey.json بجانب هذا الملف
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
    except Exception as e:
        print(f"Firebase Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- القائمة الرئيسية (تظهر بعد التحقق فقط) ---
def main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

# --- فحص حالة التحقق من الجهاز ---
def is_verified(user_id):
    try:
        user_data = db.reference(f'users/{user_id}').get()
        return user_data and user_data.get('is_verified') == True
    except:
        return False

# --- أمر البداية /start ---
@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    user_ref = db.reference(f'users/{user_id}')
    data = user_ref.get()

    # إنشاء سجل للمستخدم الجديد
    if not data:
        user_ref.set({'balance': 0.0, 'referrals': 0, 'is_verified': False})
        data = {'is_verified': False}

    # إذا كان المستخدم محققاً، أرسل القائمة فوراً
    if data.get('is_verified'):
        bot.send_message(message.chat.id, "✅ Welcome back!", reply_markup=main_menu())
    else:
        # إذا لم يتحقق، أظهر أزرار القنوات والتحقق فقط
        markup = types.InlineKeyboardMarkup(row_width=1)
        for ch in REQUIRED_CHANNELS:
            markup.add(types.InlineKeyboardButton(f"➕ Join {ch}", url=f"https://t.me/{ch.strip('@')}"))
        
        # ربط الـ Web App لنظام التحقق القوي
        markup.add(types.InlineKeyboardButton("🛡️ Verify Device & Start", web_app=WebAppInfo(url=WEB_APP_URL)))
        
        welcome_text = (
            "👋 **Welcome to Vaulto USDT Bot!**\n\n"
            "🛡️ **Security Check Required:**\n"
            "To prevent multi-accounts and fraud, you must verify your device.\n\n"
            "1️⃣ Join our official channels.\n"
            "2️⃣ Click the button below to verify (No VPN allowed).\n"
            "⚠️ **The menu will unlock automatically after verification.**"
        )
        bot.send_message(message.chat.id, welcome_text, parse_mode="Markdown", reply_markup=markup)

# --- معالجة الرسائل والتحقق من القفل ---
@bot.message_handler(func=lambda m: True)
def handle_all(message):
    user_id = str(message.chat.id)
    if is_verified(user_id):
        if message.text == "👤 Profile & Balance":
            balance = db.reference(f'users/{user_id}/balance').get() or 0.0
            bot.send_message(message.chat.id, f"💰 **Your Balance:** {balance} USDT", parse_mode="Markdown")
        # يمكنك إضافة بقية وظائف الأزرار هنا
        else:
            bot.send_message(message.chat.id, "🏠 **Main Menu**", reply_markup=main_menu(), parse_mode="Markdown")
    else:
        bot.send_message(message.chat.id, "❌ **Access Denied!**\nPlease complete the verification first using /start", parse_mode="Markdown")

if __name__ == "__main__":
    keep_alive() # تشغيل السيرفر لإبقاء الخدمة "Live"
    print("🚀 Bot is running...")
    bot.polling(none_stop=True)

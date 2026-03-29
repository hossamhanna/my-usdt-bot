import telebot
from telebot import types
from telebot.types import WebAppInfo
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os

# --- الإعدادات ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/" 
REQUIRED_CHANNELS = ["@VaultoUSDT", "@E_G_58"]

# --- سيرفر Flask لإرضاء Render ---
app = Flask('')
@app.route('/')
def home(): return "Bot is Online!"

def run():
    # Render يحتاج المنفذ من متغيرات البيئة
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)

def keep_alive():
    t = Thread(target=run)
    t.daemon = True
    t.start()

# اتصال Firebase
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
    except: pass

bot = telebot.TeleBot(API_TOKEN)

# --- القوائم ---
def main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

def is_user_verified(user_id):
    try:
        user_data = db.reference(f'users/{user_id}').get()
        return user_data and user_data.get('is_verified') == True
    except: return False

@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    user_ref = db.reference(f'users/{user_id}')
    data = user_ref.get()

    if not data:
        user_ref.set({'balance': 0.0, 'referrals': 0, 'is_verified': False})
        data = {'is_verified': False}

    if data.get('is_verified'):
        bot.send_message(message.chat.id, "✅ Welcome back!", reply_markup=main_menu())
    else:
        markup = types.InlineKeyboardMarkup(row_width=1)
        for ch in REQUIRED_CHANNELS:
            markup.add(types.InlineKeyboardButton(f"➕ Join {ch}", url=f"https://t.me/{ch.strip('@')}"))
        markup.add(types.InlineKeyboardButton("🛡️ Verify & Start", web_app=WebAppInfo(url=WEB_APP_URL)))
        
        bot.send_message(message.chat.id, "⚠️ **Access Denied!**\n\nPlease verify your device to unlock the bot.", parse_mode="Markdown", reply_markup=markup)

@bot.message_handler(func=lambda m: True)
def handle_all(message):
    if is_user_verified(message.chat.id):
        # هنا تضع منطق الأزرار (Profile, etc.)
        bot.send_message(message.chat.id, "Main Menu:", reply_markup=main_menu())
    else:
        bot.send_message(message.chat.id, "❌ Please verify first!")

if __name__ == "__main__":
    keep_alive() # تشغيل السيرفر أولاً
    bot.polling(none_stop=True)

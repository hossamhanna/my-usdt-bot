import telebot
from telebot import types
from telebot.types import WebAppInfo
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os

# ================= إعدادات البوت (جاهزة) =================
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/" 
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
# ==========================================================

# --- كود السيرفر لإبقاء البوت يعمل 24/7 ---
app = Flask('')

@app.route('/')
def home():
    return "Bot is Online and Healthy!"

def run():
    app.run(host='0.0.0.0', port=8080)

def keep_alive():
    t = Thread(target=run)
    t.daemon = True
    t.start()
# ------------------------------------------

# تهيئة اتصال Firebase
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
    users_ref = db.reference('users')
    print("✅ Firebase Connected")
except Exception as e:
    print(f"❌ Firebase Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# القائمة الرئيسية
def main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    
    try:
        user_data = users_ref.child(user_id).get()
        if not user_data:
            users_ref.child(user_id).set({
                'balance': 0.0,
                'referrals': 0,
                'verified': False
            })
    except Exception as e:
        print(f"❌ DB Error: {e}")

    markup = types.InlineKeyboardMarkup()
    btn_verify = types.InlineKeyboardButton("🛡️ Device Verification", web_app=WebAppInfo(url=WEB_APP_URL))
    markup.add(btn_verify)
    
    bot.send_message(
        message.chat.id, 
        "👋 Welcome to Novaton Bot!\n\n🏆 Start earning USDT now.\n🤝 Verify your device to unlock withdrawal.", 
        reply_markup=markup
    )
    bot.send_message(message.chat.id, "Main Menu:", reply_markup=main_menu())

@bot.message_handler(func=lambda m: m.text == "👤 Profile & Balance")
def profile(message):
    user_id = str(message.chat.id)
    try:
        data = users_ref.child(user_id).get() or {'balance': 0.0, 'referrals': 0}
        text = f"👤 *Profile*\n\n💰 Balance: {data['balance']} USDT\n👥 Referrals: {data['referrals']}"
        bot.send_message(message.chat.id, text, parse_mode="Markdown")
    except:
        bot.send_message(message.chat.id, "⚠️ Error reading data.")

# التشغيل النهائي
if __name__ == "__main__":
    keep_alive() # تشغيل Flask أولاً
    print("🚀 Bot is starting...")
    bot.polling(none_stop=True)

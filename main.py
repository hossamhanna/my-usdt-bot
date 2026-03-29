import telebot
from telebot import types
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os
import time

# --- ⚙️ الإعدادات ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116 
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
# تأكد من كتابة يوزر قناتك هنا بشكل صحيح أو اتركه فارغاً لتجربة البوت أولاً
CHANNEL_ID = "@VaultoUSDT" 

# --- 🔥 الاتصال بـ Firebase ---
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
        print("✅ Firebase Connected")
except Exception as e:
    print(f"❌ Firebase Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- 📢 دالة فحص الاشتراك (محمية من التوقف) ---
def check_sub(user_id):
    if not CHANNEL_ID or user_id == ADMIN_ID:
        return True
    try:
        status = bot.get_chat_member(CHANNEL_ID, user_id).status
        return status in ['member', 'administrator', 'creator']
    except Exception as e:
        print(f"⚠️ Sub Check Error (Make sure bot is admin in channel): {e}")
        return True # السماح بالدخول إذا كان البوت ليس أدمن في القناة لتجنب التوقف

# --- ⌨️ اللوحات ---
def get_admin_keyboard():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("📊 إحصائيات البوت", "🛡️ وضع الصيانة")
    markup.add("➕ إضافة رصيد", "📢 رسالة للكل")
    return markup

def get_user_keyboard():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 حسابي", "🔗 رابط الإحالة")
    markup.add("🎡 عجلة الحظ", "🎯 المهام")
    return markup

# --- 🤖 معالجة الأوامر ---
@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    
    # 1. فحص الاشتراك الإجباري
    if not check_sub(message.chat.id):
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton("📢 انضم للقناة هنا", url=f"https://t.me/{CHANNEL_ID.replace('@','')}"))
        bot.send_message(message.chat.id, f"⚠️ يجب عليك الانضمام لقناتنا {CHANNEL_ID} لاستخدام البوت!", reply_markup=markup)
        return

    # 2. تسجيل المستخدم
    try:
        user_ref = db.reference(f'users/{user_id}')
        if not user_ref.get():
            user_ref.set({'balance': 0.0, 'referrals': 0, 'is_verified': True})
    except: pass

    if message.chat.id == ADMIN_ID:
        bot.send_message(message.chat.id, "✅ أهلاً بك يا مدير! اللوحة جاهزة.", reply_markup=get_admin_keyboard())
    else:
        bot.send_message(message.chat.id, "👋 أهلاً بك في البوت!", reply_markup=get_user_keyboard())

@bot.message_handler(func=lambda m: m.text == "👤 حسابي")
def account(message):
    u = db.reference(f'users/{message.chat.id}').get() or {}
    bot.send_message(message.chat.id, f"💰 رصيدك الحالي: {u.get('balance', 0)} USDT")

# --- 🌐 Flask لضمان استقرار Render ---
app = Flask(__name__)
@app.route('/')
def home(): return "<h1>Bot is Live</h1>", 200

def run_flask():
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

if __name__ == "__main__":
    Thread(target=run_flask).start()
    print("🚀 Bot is Polling...")
    while True:
        try:
            bot.polling(none_stop=True, timeout=20)
        except Exception as e:
            print(f"🔄 Restarting due to: {e}")
            time.sleep(5)

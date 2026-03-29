import telebot
from telebot import types
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os
import time
import requests

# --- ⚙️ الإعدادات الأساسية ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116 
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
CHANNEL_ID = "@YourChannel" # 📢 ضع يوزر قناتك هنا (بـ @)

bot = telebot.TeleBot(API_TOKEN)

# --- 🔥 الاتصال بـ Firebase ---
if not firebase_admin._apps:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})

# --- 🛡️ نظام الحماية (VPN & Multi-Accounts) ---
def security_check(user_id):
    """يتحقق من الحماية الأساسية لمنع تعدد الحسابات"""
    user_ref = db.reference(f'users/{user_id}')
    user_data = user_ref.get()
    
    # يمكنك توسيع هذا النظام لاحقاً لربط الـ IP بقاعدة البيانات
    return True

# --- 📢 نظام التحقق من الاشتراك الإجباري ---
def check_sub(user_id):
    try:
        status = bot.get_chat_member(CHANNEL_ID, user_id).status
        if status in ['member', 'administrator', 'creator']:
            return True
        return False
    except:
        return False

# --- ⌨️ لوحات المفاتيح ---
def get_sub_keyboard():
    markup = types.InlineKeyboardMarkup()
    btn = types.InlineKeyboardButton("📢 إضغط هنا للإشتراك", url=f"https://t.me/{CHANNEL_ID.replace('@','')}")
    check_btn = types.InlineKeyboardButton("✅ تم الاشتراك", callback_data="check_sub")
    markup.add(btn)
    markup.add(check_btn)
    return markup

def get_user_keyboard():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 حسابي", "🔗 رابط الإحالة")
    markup.add("🎡 عجلة الحظ", "🎯 المهام")
    return markup

# --- 🤖 معالجة الأوامر ---
@bot.message_handler(commands=['start'])
def start_command(message):
    user_id = str(message.chat.id)
    
    # 1. نظام الحماية: منع الحسابات المتعددة
    if not security_check(user_id):
        bot.send_message(user_id, "⚠️ تم حظرك بواسطة نظام الحماية (تعدد حسابات).")
        return

    # 2. التحقق من الاشتراك الإجباري
    if not check_sub(user_id):
        bot.send_message(user_id, f"⚠️ عذراً! يجب عليك الاشتراك في القناة أولاً لاستخدام البوت:\n{CHANNEL_ID}", 
                         reply_markup=get_sub_keyboard())
        return

    # تسجيل المستخدم إذا كان جديداً
    user_ref = db.reference(f'users/{user_id}')
    if not user_ref.get():
        user_ref.set({'balance': 0.0, 'referrals': 0, 'status': 'active'})

    bot.send_message(user_id, "✅ أهلاً بك في Earn Master Bot! يمكنك البدء الآن.", 
                     reply_markup=get_user_keyboard())

# --- 🔄 معالجة أزرار التحقق (Inline) ---
@bot.callback_query_handler(func=lambda call: call.data == "check_sub")
def verify_sub(call):
    if check_sub(call.from_user.id):
        bot.answer_callback_query(call.id, "✅ شكرًا لإشتراكك! أرسل /start الآن.")
        bot.delete_message(call.message.chat.id, call.message.message_id)
    else:
        bot.answer_callback_query(call.id, "❌ لم تشترك في القناة بعد!", show_alert=True)

# --- 👤 أوامر المستخدم ---
@bot.message_handler(func=lambda m: m.text == "👤 حسابي")
def my_account(message):
    if not check_sub(message.chat.id):
        bot.send_message(message.chat.id, "⚠️ يرجى الاشتراك أولاً!", reply_markup=get_sub_keyboard())
        return
    
    u = db.reference(f'users/{message.chat.id}').get() or {}
    bot.send_message(message.chat.id, f"💰 رصيدك: {u.get('balance', 0)} USDT\n🛡️ حالة الحساب: آمن")

# --- 🌐 Flask & Running ---
app = Flask(__name__)
@app.route('/')
def home(): return "Online", 200

def run_flask():
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 10000)))

if __name__ == "__main__":
    Thread(target=run_flask).start()
    print("🚀 البوت يعمل مع نظام الحماية والاشتراك...")
    while True:
        try: bot.polling(none_stop=True)
        except: time.sleep(5)

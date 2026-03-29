import telebot
from telebot import types
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os
import time

# --- ⚙️ الإعدادات الأساسية ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116 
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'

# --- 🌐 نظام Flask لضمان استقرار Render ---
app = Flask(__name__)
@app.route('/')
def home(): return "<h1>Bot System is Online</h1>", 200

def run_flask():
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

# --- 🔥 الاتصال بـ Firebase (نسخة مستقرة) ---
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
        print("✅ Firebase Connected Successfully")
except Exception as e:
    print(f"❌ Firebase Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- ⌨️ لوحات المفاتيح (UI/UX) ---
def get_admin_keyboard():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("📊 إحصائيات البوت", "🛡️ وضع الصيانة")
    markup.add("➕ إضافة رصيد", "📢 رسالة للكل")
    markup.add("🏠 قائمة المستخدم")
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
    # تسجيل المستخدم في قاعدة البيانات
    try:
        user_ref = db.reference(f'users/{user_id}')
        if not user_ref.get():
            user_ref.set({
                'balance': 0.0,
                'referrals': 0,
                'username': message.from_user.username or "User"
            })
    except: pass

    if message.chat.id == ADMIN_ID:
        bot.send_message(message.chat.id, "✅ أهلاً بك يا مدير! اللوحة جاهزة.", reply_markup=get_admin_keyboard())
    else:
        bot.send_message(message.chat.id, "👋 أهلاً بك في **Earn Master Bot**", reply_markup=get_user_keyboard(), parse_mode="Markdown")

@bot.message_handler(commands=['admin'])
def admin_command(message):
    if message.chat.id == ADMIN_ID:
        bot.send_message(message.chat.id, "💻 لوحة تحكم الإدارة مفتوحة الآن:", reply_markup=get_admin_keyboard())

# --- 🛠️ وظائف الإدارة ---
@bot.message_handler(func=lambda m: True)
def handle_all_messages(message):
    if message.chat.id == ADMIN_ID:
        if message.text == "📊 إحصائيات البوت":
            users = db.reference('users').get() or {}
            bot.send_message(ADMIN_ID, f"📈 إجمالي المشتركين: {len(users)}")
        
        elif message.text == "➕ إضافة رصيد":
            msg = bot.send_message(ADMIN_ID, "أرسل ID المستخدم ثم المبلغ (مثال: `1683002116 5`)")
            bot.register_next_step_handler(msg, process_add_points)
            
        elif message.text == "📢 رسالة للكل":
            msg = bot.send_message(ADMIN_ID, "أرسل نص الرسالة التي تريد إرسالها للجميع:")
            bot.register_next_step_handler(msg, process_broadcast)

        elif message.text == "🏠 قائمة المستخدم":
            bot.send_message(ADMIN_ID, "تم التحويل لوضع المستخدم.", reply_markup=get_user_keyboard())

    # استجابات المستخدم العادي
    if message.text == "👤 حسابي":
        u = db.reference(f'users/{message.chat.id}').get() or {}
        bot.send_message(message.chat.id, f"💰 رصيدك الحالي: {u.get('balance', 0)} USDT")

def process_add_points(message):
    try:
        uid, amt = message.text.split()
        ref = db.reference(f'users/{uid}/balance')
        new_val = (ref.get() or 0.0) + float(amt)
        ref.set(new_val)
        bot.send_message(ADMIN_ID, f"✅ تم إضافة {amt} لـ {uid}")
        bot.send_message(uid, f"🎁 تم إضافة {amt} USDT لرصيدك!")
    except:
        bot.send_message(ADMIN_ID, "❌ خطأ في الإدخال!")

def process_broadcast(message):
    users = db.reference('users').get() or {}
    for uid in users:
        try: bot.send_message(uid, f"📢 رسالة من الإدارة:\n\n{message.text}")
        except: continue
    bot.send_message(ADMIN_ID, "✅ تم الإرسال للجميع.")

# --- 🔄 تشغيل البوت ---
if __name__ == "__main__":
    # تشغيل Flask في خيط منفصل
    t = Thread(target=run_flask)
    t.daemon = True
    t.start()
    
    print("🚀 Bot is starting now...")
    while True:
        try:
            bot.polling(none_stop=True, interval=0, timeout=20)
        except Exception as e:
            print(f"🔄 Error in polling, restarting... {e}")
            time.sleep(5)
